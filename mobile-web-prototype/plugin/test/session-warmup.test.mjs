import test from 'node:test'
import assert from 'node:assert/strict'
import {createSessionWarmup,sessionWarmupTargets} from '../src/session-warmup.mjs'
import {createSessionRetention} from '../src/session-retention.mjs'
import {createMobileNavigation} from '../src/controller.mjs'

const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
const target=(id,sessionId=id,extra={})=>({id,sessionId,name:id,kind:'bot',...extra})
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
function idleClock(){
  const tasks=new Set()
  return {idle(callback){tasks.add(callback);return()=>tasks.delete(callback)},run(){const next=tasks.values().next().value;if(next){tasks.delete(next);next()}},get pending(){return tasks.size}}
}
function source(initial){let value=initial;const listeners=new Set();return {getSnapshot:()=>value,subscribe(callback){listeners.add(callback);return()=>listeners.delete(callback)},set(next){value=next;for(const callback of listeners)callback()}}}
function service(){
  const generations=new Map(),requests=[],list=source({byId:{}})
  const publish=()=>list.set({byId:Object.fromEntries([...generations].map(([id,g])=>[id,{id,retainedBy:Object.fromEntries(g.owners)}]))})
  return {list,refresh:async()=>{},requests,
    retain(id,{source}){
      let g=generations.get(id)
      if(!g){g={...deferred(),owners:new Map(),binding:{sessionId:id,session:{getSnapshot:()=>({openState:'open'})}}};generations.set(id,g);requests.push(id)}
      g.owners.set(source,(g.owners.get(source)||0)+1);publish()
      let live=true,reject
      const ready=new Promise((yes,no)=>{reject=no;g.promise.then(yes,no)})
      return {ready,release(){if(!live)return;live=false;reject(new Error('Released'));const count=g.owners.get(source)-1;if(count)g.owners.set(source,count);else g.owners.delete(source);if(!g.owners.size&&generations.get(id)===g)generations.delete(id);publish()}}
    },
    finish(id){const g=generations.get(id);g?.resolve(g.binding)},
    count:id=>[...(generations.get(id)?.owners.values()||[])].reduce((sum,count)=>sum+count,0),
  }
}

test('warmup candidates use only fresh roster identities, prioritizing active, Main and recent targets',()=>{
  const items=[target('a','new-a',{isMain:true}),target('b'),target('c'),target('alias','b')]
  assert.deepEqual(sessionWarmupTargets(items,{activeId:'b',recentIds:['deleted','c']}).map(x=>x.sessionId),['b','new-a'])
  assert.deepEqual(sessionWarmupTargets(items,{activeId:'a',recentIds:['alias','b']}).map(x=>x.sessionId),['new-a','b'])
  assert.deepEqual(sessionWarmupTargets([target('a')]),[],'an arbitrary unopened conversation is never fetched')
})

test('canonical warmup is idle, serial, bounded to two and unchanged polling never repeats it',async()=>{
  const clock=idleClock(),calls=[],opening=[]
  const warmup=createSessionWarmup({idle:clock.idle,prewarm(item){calls.push(item.id);const gate=deferred();opening.push(gate);return {target:item,ready:gate.promise,release(){gate.reject(new Error('Released'))}}}})
  const targets=['a','b','c'].map(id=>target(id))
  warmup.sync({enabled:true,targets});assert.deepEqual(calls,[]);assert.equal(clock.pending,1)
  clock.run();assert.deepEqual(calls,['a']);assert.equal(clock.pending,0)
  warmup.sync({enabled:true,targets});assert.equal(clock.pending,0)
  opening[0].resolve();await settle();assert.equal(clock.pending,1)
  clock.run();assert.deepEqual(calls,['a','b']);opening[1].resolve();await settle()
  for(let i=0;i<20;i++)warmup.sync({enabled:true,targets:targets.map(item=>({...item}))})
  assert.equal(clock.pending,0);assert.deepEqual(calls,['a','b']);warmup.close()
})

test('hide, offline and close cancel idle or in-flight optional ownership and late readiness cannot continue',async()=>{
  const clock=idleClock(),events=new Map(),opening=deferred();let calls=0,releases=0,online=true
  const warmup=createSessionWarmup({idle:clock.idle,online:()=>online,events:{addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)},prewarm(item){calls++;return {target:item,ready:opening.promise,release(){releases++}}}})
  const targets=[target('a'),target('b')]
  warmup.sync({enabled:true,targets});warmup.sync({enabled:false});clock.run();assert.equal(calls,0)
  warmup.sync({enabled:true,targets});clock.run();assert.equal(calls,1)
  online=false;events.get('offline')();assert.equal(releases,1)
  opening.resolve();await settle();assert.equal(clock.pending,0)
  warmup.sync({enabled:true,targets});assert.equal(clock.pending,0)
  warmup.close();warmup.close();assert.equal(events.size,0)
})

test('replacing a stale roster cancels its optional request; failed acquisition stays outside navigation',async()=>{
  const clock=idleClock(),old=deferred(),calls=[];let released=0
  const warmup=createSessionWarmup({idle:clock.idle,prewarm(item){calls.push(item.sessionId);if(item.sessionId==='old')return {target:item,ready:old.promise,release(){released++;old.reject(new Error('Obsolete'))}};throw new Error('Unavailable optional history')}})
  warmup.sync({enabled:true,targets:[target('a','old')]});clock.run()
  warmup.sync({enabled:true,targets:[target('a','new')]});assert.equal(released,1)
  clock.run();await settle();assert.deepEqual(calls,['old','new']);assert.equal(clock.pending,0);warmup.close()
})

test('prewarm does not renew TTL or evict visited entries; visiting protects an opening from warmup cancellation',async()=>{
  const sessions=service();let now=0
  const timers=new Map();let serial=0
  const cache=createSessionRetention({sessions,now:()=>now,ttlMs:100,setTimer(callback,delay){const id=++serial;timers.set(id,{callback,at:now+delay});return id},clearTimer:id=>timers.delete(id)})
  const advance=ms=>{now+=ms;for(const [id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.callback()}}
  cache.setEnabled(true);cache.prewarm(target('a'));advance(50);assert.equal(cache.prewarm(target('a')),undefined)
  advance(50);assert.equal(sessions.count('a'),0,'polling warmup does not extend the initial expiry')
  const warming=cache.prewarm(target('b'));cache.visit(target('b'));warming.release();assert.equal(sessions.count('b'),1)
  cache.visit(target('c'));cache.visit(target('d'));assert.equal(cache.prewarm(target('e')),undefined)
  assert.deepEqual(['b','c','d'].map(id=>sessions.count(id)),[1,1,1]);assert.equal(sessions.count('e'),0)
  cache.close();await settle();assert.equal(timers.size,0)
})

test('fresh-roster idle prewarm moves the same history opening before a click, while every click still validates its target',async()=>{
  const sessions=service(),clock=idleClock(),connection={state:source('connected')},opened=[]
  let checks=0,main
  const team={mainBotId:'a',bots:[target('a'),target('b')],rooms:[]}
  const controller=createMobileNavigation({sessions,connection,idle:clock.idle,history:{state:null,pushState(){}},api:{refresh:async()=>team,target:async id=>{checks++;return target(id)}},workspace:{openSession(id){main?.release();main=sessions.retain(id,{source:'mainView'});void main.ready.catch(()=>{});opened.push(id)}}})
  controller.setCacheEnabled(true);clock.run();assert.deepEqual(sessions.requests,[])
  await controller.refresh();assert.deepEqual(sessions.requests,[])
  clock.run();assert.deepEqual(sessions.requests,['a'])
  await controller.open('a');assert.equal(checks,1);assert.deepEqual(opened,['a']);assert.deepEqual(sessions.requests,['a'],'the main view borrows the already-opening canonical generation')
  sessions.finish('a');await settle();await controller.refresh();assert.equal(clock.pending,0)
  controller.setCacheEnabled(false);assert.equal(sessions.count('a'),1,'hiding drops only the optional cache, not main-view ownership')
  controller.close();main.release();await settle()
})

test('disconnect and authentication errors discard scheduled warmup until another successful fresh roster',async()=>{
  const sessions=service(),clock=idleClock(),state=source('connected');let unauthorized=false
  const controller=createMobileNavigation({sessions,idle:clock.idle,connection:{state},history:{},workspace:{},api:{refresh:async()=>{if(unauthorized)throw Object.assign(new Error('No access'),{code:'HTTP_401'});return {mainBotId:'a',bots:[target('a')],rooms:[]}}}})
  controller.setCacheEnabled(true);await controller.refresh();assert.equal(clock.pending,1)
  state.set('disconnected');assert.equal(clock.pending,0);state.set('connected');clock.run();assert.deepEqual(sessions.requests,[])
  await controller.refresh();unauthorized=true;await controller.refresh();clock.run();assert.deepEqual(sessions.requests,[])
  assert.match(controller.snapshot().error,/登录已失效/);controller.close();await settle()
})

test('hidden pauses warmup immediately while keeping recent history; a late roster cannot start hidden reads',async()=>{
  const sessions=service(),clock=idleClock(),roster=deferred()
  const team={mainBotId:'b',bots:[target('a'),target('b')],rooms:[]}
  const controller=createMobileNavigation({sessions,idle:clock.idle,connection:{state:source('connected')},history:{state:null,pushState(){}},workspace:{openSession(){}},api:{refresh:()=>roster.promise,target:async()=>target('a')}})
  controller.setCacheEnabled(true);await controller.open('a')
  const loading=controller.refresh();controller.pauseWarmup();roster.resolve(team);await loading
  clock.run();await settle();clock.run()
  assert.deepEqual(sessions.requests,['a'],'the in-flight successful roster cannot resume hidden warmup')
  assert.equal(sessions.count('a'),1,'the separate 30-second recent-history grace remains intact')
  controller.setCacheEnabled(true);await controller.refresh();clock.run();clock.run()
  assert.deepEqual(sessions.requests,['a','b'],'only another visible fresh refresh resumes warming')
  controller.close();await settle()
})
