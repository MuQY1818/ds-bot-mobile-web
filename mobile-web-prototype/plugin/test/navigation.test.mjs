import test from 'node:test'
import assert from 'node:assert/strict'
import {createMobileNavigation,summarizeTeam} from '../src/controller.mjs'
const source=initial=>{let value=initial;const listeners=new Set();return{getSnapshot:()=>value,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},set(next){value=next;for(const fn of listeners)fn()},get size(){return listeners.size}}}
function fixture(api={}){
  const opened=[],list=source({byId:{}}),state=source('connected')
  let refreshes=0,reconnects=0
  const history={state:null,pushState(value){this.state=value},back(){this.state=null}}
  const controller=createMobileNavigation({api:{conversations:async()=>[{id:'bot',name:'测试Bot',sessionId:'part-1',kind:'bot'}],target:async id=>({id,name:'测试Bot',sessionId:'part-1',kind:'bot'}),...api},workspace:{openSession:id=>opened.push(id)},sessions:{list,refresh:async()=>{refreshes++}},connection:{state,reconnect:()=>{reconnects++}},history,now:()=>123})
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
test('refresh races preserve newest roster and ignore aborted old result',async()=>{
  const requests=[];const f=fixture({conversations:signal=>new Promise(resolve=>requests.push({signal,resolve}))});const old=f.controller.refresh(),latest=f.controller.refresh();assert.equal(requests[0].signal.aborted,true);requests[1].resolve([{id:'new'}]);await latest;requests[0].resolve([{id:'old'}]);await old;assert.equal(f.controller.snapshot().items[0].id,'new');f.controller.close()
})
test('foreground refresh does not submit text or force reconnect',async()=>{
  const f=fixture();await f.controller.restore();await f.controller.restore();assert.equal(f.refreshes,2);assert.equal(f.reconnects,0);f.controller.reconnect();assert.equal(f.reconnects,1);f.state.set('disconnected');assert.equal(f.controller.snapshot().connected,'disconnected');f.controller.close()
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
