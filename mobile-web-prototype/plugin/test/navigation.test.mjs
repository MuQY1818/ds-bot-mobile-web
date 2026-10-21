import test from 'node:test'
import assert from 'node:assert/strict'
import {createMobileNavigation,summarizeTeam} from '../src/controller.mjs'
const source=initial=>{let value=initial;const listeners=new Set();return{getSnapshot:()=>value,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},set(next){value=next;for(const fn of listeners)fn()},get size(){return listeners.size}}}
function fixture(api={},refreshSessions=async()=>{}){
  const opened=[],list=source({byId:{}}),state=source('connected')
  let refreshes=0,reconnects=0
  const history={state:null,pushState(value){this.state=value},back(){this.state=null}}
  const controller=createMobileNavigation({api:{conversations:async()=>[{id:'bot',name:'测试Bot',sessionId:'part-1',kind:'bot'}],target:async id=>({id,name:'测试Bot',sessionId:'part-1',kind:'bot'}),...api},workspace:{openSession:id=>opened.push(id)},sessions:{list,refresh:()=>{refreshes++;return refreshSessions()}},connection:{state,reconnect:()=>{reconnects++}},history,now:()=>123})
  return{controller,opened,list,state,history,get refreshes(){return refreshes},get reconnects(){return reconnects}}
}
test('logical target navigation selects the canonical Session',async()=>{
  const f=fixture();await f.controller.refresh();await f.controller.open('bot');assert.deepEqual(f.opened,['part-1']);assert.equal(f.controller.snapshot().page,'chat');assert.equal(f.history.state.dsMobilePage,'chat');f.controller.home();assert.equal(f.controller.snapshot().page,'home');assert.equal(f.history.state,null);f.controller.close()
})
test('late navigation cannot overwrite a newer selection or home',async()=>{
  const pending=new Map();const f=fixture({target:id=>new Promise(resolve=>pending.set(id,resolve))})
  const first=f.controller.open('old'),second=f.controller.open('new');pending.get('new')({id:'new',sessionId:'new-part',name:'new'});await second;pending.get('old')({id:'old',sessionId:'old-part',name:'old'});await first;assert.deepEqual(f.opened,['new-part'])
  const third=f.controller.open('old');f.controller.home();pending.get('old')({id:'old',sessionId:'old-part',name:'old'});await third;assert.deepEqual(f.opened,['new-part']);f.controller.close()
})
test('overlapping refreshes share one request without cancelling useful work',async()=>{
  const requests=[];const f=fixture({conversations:signal=>new Promise(resolve=>requests.push({signal,resolve}))});const first=f.controller.refresh(),second=f.controller.refresh();assert.equal(requests.length,1);assert.equal(requests[0].signal.aborted,false);requests[0].resolve([{id:'current'}]);await Promise.all([first,second]);assert.equal(f.controller.snapshot().items[0].id,'current');const next=f.controller.refresh();assert.equal(requests.length,2);requests[1].resolve([{id:'next'}]);await next;assert.equal(f.controller.snapshot().items[0].id,'next');f.controller.close()
})
test('superseded navigation and home cancel their metadata waiters',async()=>{
  const requests=[];const f=fixture({target:(id,signal)=>new Promise(resolve=>requests.push({id,signal,resolve}))})
  const old=f.controller.open('old'),current=f.controller.open('current')
  assert.equal(requests[0].signal.aborted,true);assert.equal(requests[1].signal.aborted,false)
  f.controller.home();assert.equal(requests[1].signal.aborted,true)
  for(const request of requests)request.resolve({id:request.id,sessionId:request.id,name:request.id})
  await Promise.all([old,current]);assert.deepEqual(f.opened,[]);assert.equal(f.controller.snapshot().page,'home');f.controller.close()
})
test('foreground refresh does not submit text or force reconnect',async()=>{
  const f=fixture();await f.controller.restore();await f.controller.restore();assert.equal(f.refreshes,2);assert.equal(f.reconnects,0);f.controller.reconnect();assert.equal(f.reconnects,1);f.state.set('disconnected');assert.equal(f.controller.snapshot().connected,'disconnected');f.controller.close()
})
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
test('recovery starts independent catalog and roster reads together and shares overlapping calls',async()=>{
  const catalog=deferred(),roster=deferred();let rosterReads=0
  const f=fixture({conversations:()=>{rosterReads++;return roster.promise}},()=>catalog.promise)
  const calls=[f.controller.restore(),f.controller.restore(),f.controller.restore()]
  await Promise.resolve()
  assert.equal(f.refreshes,1);assert.equal(rosterReads,1)
  roster.resolve([{id:'current'}]);await Promise.resolve();await Promise.resolve()
  assert.equal(f.controller.snapshot().items[0].id,'current')
  catalog.resolve();await Promise.all(calls)
  await f.controller.restore();assert.equal(f.refreshes,2);assert.equal(rosterReads,2);f.controller.close()
})
test('recovery remains shared after one read fails until the other settles',async()=>{
  const catalog=deferred(),roster=deferred();let rosterReads=0
  const f=fixture({conversations:()=>{rosterReads++;return roster.promise}},()=>catalog.promise)
  const first=f.controller.restore();await Promise.resolve()
  catalog.reject(new Error('catalog unavailable'));await Promise.resolve();await Promise.resolve()
  const second=f.controller.restore();await Promise.resolve()
  assert.equal(f.refreshes,1);assert.equal(rosterReads,1)
  roster.resolve([{id:'current'}]);await Promise.all([first,second])
  assert.match(f.controller.snapshot().error,/会话恢复尚未完成/)
  await f.controller.restore();assert.equal(f.refreshes,2);assert.equal(rosterReads,2);f.controller.close()
})
test('a synchronous catalog failure still starts the roster read and preserves its auth error',async()=>{
  let rosterReads=0
  const f=fixture({conversations:async()=>{rosterReads++;throw Object.assign(new Error('unauthorized'),{code:'HTTP_401'})}},()=>{throw new Error('catalog unavailable')})
  await f.controller.restore();assert.equal(f.refreshes,1);assert.equal(rosterReads,1);assert.match(f.controller.snapshot().error,/登录已失效/);f.controller.close()
})
test('closing before deferred recovery starts prevents new reads',async()=>{
  let rosterReads=0;const f=fixture({conversations:async()=>{rosterReads++;return[]}})
  const pending=f.controller.restore();f.controller.close();await pending
  assert.equal(f.refreshes,0);assert.equal(rosterReads,0);assert.equal(f.list.size,0);assert.equal(f.state.size,0)
})
test('401 is visible without credential fields or false connected claim',async()=>{
  const f=fixture({conversations:async()=>{throw Object.assign(new Error('unauthorized'),{code:'HTTP_401'})}});await f.controller.refresh();assert.match(f.controller.snapshot().error,/登录已失效/);assert.equal(f.controller.snapshot().loading,false);f.controller.close()
})
test('App tabs keep native selection and reject invalid pages',async()=>{
  const f=fixture();await f.controller.open('bot');f.controller.selectTab('connection');assert.equal(f.controller.snapshot().page,'home');assert.equal(f.controller.snapshot().tab,'connection');assert.deepEqual(f.opened,['part-1']);f.controller.selectTab('invalid');assert.equal(f.controller.snapshot().tab,'connection');f.controller.selectTab('team');assert.equal(f.controller.snapshot().tab,'team');f.controller.close()
})
test('team projection identifies the actual main Bot without exposing other state',()=>{
  const items=summarizeTeam({mainBotId:'b',bots:[{id:'b',name:'Chief',sessionId:'current',role:'统筹',secret:'never'}],rooms:[{id:'r',name:'群',preview:'真实群摘要',parts:['hidden']}]});assert.equal(items[0].isMain,true);assert.equal(items[0].sessionId,'current');assert.equal(items[1].sessionId,'r');assert.equal(items[1].preview,'真实群摘要');assert.equal('parts' in items[1],false);assert.equal('secret' in items[0],false)
})

test('mascot projection preserves custom avatar, work, activity and group members',()=>{
  const avatar={shape:'kitty',image:'data:image/png;base64,fixture'}
  const items=summarizeTeam({mainBotId:'b',bots:[{id:'b',name:'Bot',sessionId:'s',avatar,color:'red'}],rooms:[{id:'r',name:'Room',members:['b']}],work:{bots:{b:{since:1}},approvals:[]},activity:{b:'searching'},questions:{s:{id:'q'}}})
  assert.deepEqual(items[0].avatar,avatar);assert.equal(items[0].color,'red');assert.equal(items[0].running,true);assert.equal(items[0].activity,'searching');assert.equal(items[0].alert,true);assert.deepEqual(items[1].members,['b'])
})

test('dispose cancels state and releases service subscriptions once',async()=>{
  let resolve;const f=fixture({conversations:()=>new Promise(r=>{resolve=r})});const pending=f.controller.refresh();assert.equal(f.list.size,1);f.controller.close();f.controller.close();resolve([]);await pending;assert.equal(f.list.size,0);assert.equal(f.state.size,0)
})

test('suspending an unresolved recovery releases its waiters and ignores its late roster',async()=>{
  const requests=[],catalogs=[]
  const f=fixture({conversations:signal=>new Promise(resolve=>requests.push({signal,resolve}))},()=>new Promise(resolve=>catalogs.push(resolve)))
  const old=f.controller.restore();await Promise.resolve()
  f.controller.suspend();await old
  assert.equal(requests[0].signal.aborted,true);assert.equal(f.controller.snapshot().loading,false)
  const current=f.controller.restore();await Promise.resolve()
  assert.equal(requests.length,2);assert.equal(catalogs.length,2)
  requests[1].resolve([{id:'new'}]);catalogs[1]();await current
  requests[0].resolve([{id:'old'}]);catalogs[0]();await Promise.resolve()
  assert.equal(f.controller.snapshot().items[0].id,'new');f.controller.close()
})
test('a silent carrier times out, reconnects once, and allows a later successful recovery',async()=>{
  let stuck=true,reconnects=0
  const list=source({byId:{}}),state=source('connected')
  const controller=createMobileNavigation({api:{conversations:async()=>[{id:'a'}]},workspace:{},history:{},sessions:{list,refresh:()=>stuck?new Promise(()=>{}):Promise.resolve()},connection:{state,reconnect(){reconnects++;stuck=false}},readTimeoutMs:10})
  await controller.restore();assert.equal(reconnects,1);assert.match(controller.snapshot().error,/恢复尚未完成/)
  await controller.restore();assert.equal(controller.snapshot().error,'');assert.equal(reconnects,1);controller.close()
})
test('explicit network repair coalesces repeated requests without reconnect storms',async()=>{
  const gate=deferred(),f=fixture({},()=>gate.promise)
  const one=f.controller.restore({reconnect:true}),two=f.controller.restore({reconnect:true})
  assert.equal(one,two);assert.equal(f.reconnects,1)
  gate.resolve();await one;f.controller.close()
})
