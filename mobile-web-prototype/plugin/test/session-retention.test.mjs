import test from 'node:test'
import assert from 'node:assert/strict'
import {createSessionRetention} from '../src/session-retention.mjs'
import {createMobileNavigation} from '../src/controller.mjs'

const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()}
const source=initial=>{let state=initial;const subscribers=new Set();return{getSnapshot:()=>state,subscribe:callback=>{subscribers.add(callback);return()=>subscribers.delete(callback)},set(value){state=value;for(const callback of subscribers)callback()}}}
function clock(){
  let current=0,serial=0
  const timers=new Map()
  return {
    now:()=>current,
    setTimer(callback,delay){const id=++serial;timers.set(id,{callback,at:current+delay});return id},
    clearTimer:id=>timers.delete(id),
    advance(ms){
      const end=current+ms
      while(true){
        const next=[...timers].filter(([,entry])=>entry.at<=end).sort((a,b)=>a[1].at-b[1].at)[0]
        if(!next)break
        current=next[1].at;timers.delete(next[0]);next[1].callback()
      }
      current=end
    },
    get pending(){return timers.size},
  }
}

// Model the public reference contract: one history opening per live generation,
// shared by mainView and the plugin, with an independently cancellable waiter.
function sessionService({deferred=false,openState='ready'}={}){
  const generations=new Map(),requests=[],releases=[]
  const list=source({byId:{}})
  const publish=()=>list.set({byId:Object.fromEntries([...generations].map(([id,generation])=>[id,{id,retainedBy:Object.fromEntries(generation.sources)}]))})
  return {
    list,refresh:async()=>{},requests,releases,
    retain(id,{source}){
      let generation=generations.get(id)
      if(!generation){
        let resolve,reject
        const opening=new Promise((yes,no)=>{resolve=yes;reject=no})
        generation={sources:new Map(),opening,resolve,reject,binding:{sessionId:id,session:{getSnapshot:()=>({openState})}}}
        generations.set(id,generation);requests.push(id)
        if(!deferred)resolve(generation.binding)
      }
      generation.sources.set(source,(generation.sources.get(source)??0)+1)
      let cancelled,live=true
      const ready=new Promise((resolve,reject)=>{cancelled=reject;generation.opening.then(resolve,reject)})
      publish()
      return {ready,
        release(){
          if(!live)return
          live=false;cancelled(new Error('Reference released'))
          const count=generation.sources.get(source)-1
          if(count)generation.sources.set(source,count);else generation.sources.delete(source)
          releases.push({id,source})
          if(!generation.sources.size&&generations.get(id)===generation)generations.delete(id)
          publish()
        },
      }
    },
    finish(id){generations.get(id).resolve(generations.get(id).binding)},
    fail(id){generations.get(id).reject(new Error('History opening failed'))},
    retained(id,owner='dsBotMobileWebRecent'){return generations.get(id)?.sources.get(owner)??0},
  }
}
const target=(id,sessionId=id)=>({id,sessionId,name:id,kind:'bot'})
function navigationFixture(){
  const sessions=sessionService(),connection={state:source('connected'),reconnect(){}},history={state:null,pushState(value){this.state=value},back(){this.state=null}}
  let roster=[target('a'),target('b'),target('c'),target('d')],main,checks=0,failure
  const controller=createMobileNavigation({
    sessions,connection,history,
    api:{
      async conversations(){if(failure)throw failure;return roster},
      async target(id){checks++;if(failure)throw failure;const item=roster.find(item=>item.id===id);if(!item)throw Object.assign(new Error('Missing target'),{code:'mobile/not-found'});return item},
    },
    workspace:{openSession(id){
      if(main?.id===id)return
      main?.reference.release()
      const reference=sessions.retain(id,{source:'mainView'});void reference.ready.catch(()=>{})
      main={id,reference}
    }},
  })
  return {controller,sessions,set roster(value){roster=value},set failure(value){failure=value},get checks(){return checks},close(){controller.close();main?.reference.release()}}
}

test('mobile cache is opt-in and retains only explicitly visited conversations',async()=>{
  const f=navigationFixture()
  await f.controller.refresh()
  assert.deepEqual(f.sessions.requests,[])
  await f.controller.open('a');await f.controller.open('b');await f.controller.open('a')
  assert.deepEqual(f.sessions.requests,['a','b','a'])
  assert.equal(f.sessions.retained('a'),0)
  f.controller.setCacheEnabled(true)
  await f.controller.refresh()
  assert.equal(f.sessions.retained('b'),0)
  await f.controller.open('a');await f.controller.open('b');await f.controller.open('a')
  assert.deepEqual(f.sessions.requests,['a','b','a','b'])
  assert.equal(f.checks,6,'each revisit still validates the current canonical identity')
  assert.equal(f.sessions.retained('a'),1)
  assert.equal(f.sessions.retained('b'),1)
  assert.equal(f.sessions.retained('c'),0)
  f.close();await settle()
})

test('least recently visited generation is released at a bound of three',async()=>{
  const sessions=sessionService(),time=clock(),cache=createSessionRetention({sessions,...time})
  cache.setEnabled(true)
  for(const id of ['a','b','c']){cache.visit(target(id));time.advance(1)}
  cache.visit(target('a'));cache.visit(target('d'))
  assert.equal(sessions.retained('b'),0)
  for(const id of ['a','c','d'])assert.equal(sessions.retained(id),1)
  cache.close();await settle();assert.equal(time.pending,0)
})

test('TTL releases history while idle and revisits renew the retention period',async()=>{
  const sessions=sessionService(),time=clock(),cache=createSessionRetention({sessions,...time,ttlMs:100})
  cache.setEnabled(true);cache.visit(target('a'));time.advance(50);cache.visit(target('a'))
  time.advance(50);assert.equal(sessions.retained('a'),1)
  time.advance(49);assert.equal(sessions.retained('a'),1)
  time.advance(1);assert.equal(sessions.retained('a'),0)
  assert.equal(time.pending,0)
  cache.visit(target('a'));assert.deepEqual(sessions.requests,['a','a'])
  cache.close();await settle()
})

test('preference disable and disposal release pending readiness safely',async()=>{
  const sessions=sessionService({deferred:true}),time=clock(),cache=createSessionRetention({sessions,...time})
  cache.setEnabled(true);cache.visit(target('a'));cache.visit(target('b'))
  cache.setEnabled(false)
  assert.equal(sessions.retained('a'),0);assert.equal(sessions.retained('b'),0);assert.equal(time.pending,0)
  cache.visit(target('c'));assert.deepEqual(sessions.requests,['a','b'])
  cache.setEnabled(true);cache.visit(target('c'));cache.close();cache.close()
  cache.setEnabled(true);cache.visit(target('d'))
  await settle();assert.equal(sessions.retained('c'),0);assert.deepEqual(sessions.requests,['a','b','c'])
})

test('rejected readiness and resolved Remote errors never pin a failed history generation',async()=>{
  const sessions=sessionService({deferred:true}),time=clock(),cache=createSessionRetention({sessions,...time})
  cache.setEnabled(true);cache.visit(target('a'));sessions.fail('a');await settle()
  assert.equal(sessions.retained('a'),0)
  cache.visit(target('a'));sessions.finish('a');await settle();assert.equal(sessions.retained('a'),1)
  cache.close()
  const failed=sessionService({openState:'error'}),failedCache=createSessionRetention({sessions:failed,...time})
  failedCache.setEnabled(true);failedCache.visit(target('bad'));await settle()
  assert.equal(failed.retained('bad'),0);failedCache.close()
})

test('an old cancelled waiter cannot release a newer generation of the same target',async()=>{
  const sessions=sessionService({deferred:true}),time=clock(),cache=createSessionRetention({sessions,...time})
  cache.setEnabled(true);cache.visit(target('a'));cache.discard('a');cache.visit(target('a'))
  await settle();assert.equal(sessions.retained('a'),1)
  sessions.finish('a');await settle();assert.equal(sessions.retained('a'),1)
  assert.deepEqual(sessions.requests,['a','a']);cache.close();await settle()
})

test('fresh identity validation replaces rolled-over Sessions and removes deleted conversations',async()=>{
  const f=navigationFixture();f.controller.setCacheEnabled(true)
  await f.controller.open('a');await f.controller.open('b')
  f.roster=[target('a','a-next'),target('b')]
  await f.controller.open('a')
  assert.equal(f.sessions.retained('a'),0);assert.equal(f.sessions.retained('a-next'),1)
  f.roster=[target('b')];await f.controller.refresh()
  assert.equal(f.sessions.retained('a-next'),0)
  await f.controller.open('a');assert.match(f.controller.snapshot().error,/无法打开/)
  assert.equal(f.sessions.requests.includes('a-next'),true)
  f.close();await settle()
})

test('401 or 403 clears cached histories instead of opening a cached identity',async()=>{
  for(const code of ['HTTP_401','HTTP_403']){
    const f=navigationFixture();f.controller.setCacheEnabled(true)
    await f.controller.open('a');await f.controller.open('b')
    f.failure=Object.assign(new Error('Unauthorized'),{code})
    await f.controller.open('a')
    assert.equal(f.sessions.retained('a'),0);assert.equal(f.sessions.retained('b'),0)
    assert.match(f.controller.snapshot().error,code==='HTTP_401'?/登录已失效/:/拒绝访问/)
    assert.deepEqual(f.sessions.requests,['a','b'])
    f.close();await settle()
  }
  const f=navigationFixture();f.controller.setCacheEnabled(true);await f.controller.open('a')
  f.failure=Object.assign(new Error('Unauthorized'),{code:'HTTP_401'});await f.controller.refresh()
  assert.equal(f.sessions.retained('a'),0);f.close();await settle()
})

test('late target responses after another navigation or home never retain unseen history',async()=>{
  const sessions=sessionService(),pending=new Map(),opened=[]
  const controller=createMobileNavigation({sessions,connection:{state:source('connected')},history:{state:null,pushState(){}},workspace:{openSession:id=>opened.push(id)},api:{target:id=>new Promise(resolve=>pending.set(id,resolve))}})
  controller.setCacheEnabled(true)
  const first=controller.open('a'),second=controller.open('b')
  pending.get('b')(target('b'));await second;pending.get('a')(target('a'));await first
  const third=controller.open('c');controller.home();pending.get('c')(target('c'));await third
  assert.deepEqual(opened,['b']);assert.deepEqual(sessions.requests,['b'])
  controller.close();await settle()
})

test('a failed optional retain does not block canonical main-view navigation',async()=>{
  const opened=[],sessions={list:source({byId:{}}),retain(){throw new Error('Opening refused')}}
  const controller=createMobileNavigation({sessions,connection:{state:source('connected')},history:{state:null,pushState(){}},workspace:{openSession:id=>opened.push(id)},api:{target:async()=>target('a')}})
  controller.setCacheEnabled(true);await controller.open('a')
  assert.deepEqual(opened,['a']);assert.equal(controller.snapshot().page,'chat');controller.close()
})

test('suspension and transient target failure retain visited generations without opening stale identities',async()=>{
  const f=navigationFixture();f.controller.setCacheEnabled(true)
  await f.controller.open('a');await f.controller.open('b')
  f.controller.suspend()
  assert.equal(f.sessions.retained('a'),1);assert.equal(f.sessions.retained('b'),1)
  f.failure=Object.assign(new Error('Interrupted'),{code:'mobile/transport'})
  await f.controller.open('a')
  assert.equal(f.controller.snapshot().active.id,'b');assert.equal(f.sessions.retained('a'),1)
  f.failure=undefined;await f.controller.restore();await f.controller.open('a')
  assert.deepEqual(f.sessions.requests,['a','b'],'resume reuses the canonical histories')
  f.close();await settle()
})
