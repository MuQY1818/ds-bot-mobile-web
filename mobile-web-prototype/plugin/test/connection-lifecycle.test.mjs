import test from 'node:test'
import assert from 'node:assert/strict'
import {installConnectionLifecycle} from '../src/connection-lifecycle.mjs'

function fixture(){
  const window=new EventTarget(),document=new EventTarget(),calls=[]
  let time=0,enabled=true
  document.hidden=false
  const lifecycle=installConnectionLifecycle({window,document,now:()=>time,enabled:()=>enabled,sync:()=>calls.push('sync'),controller:{suspend:()=>calls.push('pause'),restore:options=>calls.push(options)}})
  const event=(target,name,props={})=>target.dispatchEvent(Object.assign(new Event(name),props))
  return {window,document,calls,lifecycle,event,advance:ms=>{time+=ms},enable:value=>{enabled=value},hide(){document.hidden=true;event(document,'visibilitychange')},show(){document.hidden=false;event(document,'visibilitychange')}}
}
test('short background resumes without resetting a healthy carrier; long background repairs it once',()=>{
  const f=fixture();f.hide();f.advance(2000);f.show()
  assert.deepEqual(f.calls,['pause','sync','sync',{reconnect:false}])
  f.calls.length=0;f.hide();f.advance(31000);f.show();f.event(f.document,'resume');f.event(f.window,'pageshow')
  assert.deepEqual(f.calls,['pause','sync','sync',{reconnect:true}]);assert.equal(f.lifecycle.active(),true);f.lifecycle.close()
})
test('network changes while hidden do not start reads; foreground uses existing login',()=>{
  const f=fixture();f.hide();f.event(f.window,'offline');f.event(f.window,'online')
  assert.equal(f.calls.some(value=>typeof value==='object'),false)
  f.show();assert.deepEqual(f.calls.at(-1),{reconnect:true});f.lifecycle.close()
})
test('BFCache and freeze preserve page state and resume; disabled layout never starts recovery',()=>{
  const f=fixture();f.event(f.window,'pagehide',{persisted:true});assert.equal(f.lifecycle.active(),false)
  f.advance(20000);f.event(f.window,'pageshow',{persisted:true});assert.deepEqual(f.calls.at(-1),{reconnect:true})
  f.enable(false);f.calls.length=0;f.event(f.document,'freeze');f.event(f.document,'resume');f.event(f.window,'online')
  assert.equal(f.calls.some(value=>typeof value==='object'),false)
  f.lifecycle.close();f.calls.length=0;f.event(f.window,'online');f.event(f.document,'visibilitychange');assert.deepEqual(f.calls,[])
})
