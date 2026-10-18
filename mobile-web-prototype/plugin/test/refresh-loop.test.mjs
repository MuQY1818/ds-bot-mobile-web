import test from 'node:test'
import assert from 'node:assert/strict'
import {createRefreshLoop} from '../src/refresh-loop.mjs'

function fixture(){
  let enabled=true,now=0,serial=0,reads=0,complete
  const timers=new Map()
  const loop=createRefreshLoop({enabled:()=>enabled,refresh:()=>{reads++;return new Promise(resolve=>{complete=resolve})},setTimer(callback,delay){const id=++serial;timers.set(id,{callback,at:now+delay});return id},clearTimer:id=>timers.delete(id)})
  return {loop,timers,set enabled(value){enabled=value},get reads(){return reads},finish:()=>complete(),async advance(ms){now+=ms;for(const [id,entry] of [...timers])if(entry.at<=now){timers.delete(id);void entry.callback()}await Promise.resolve()}}
}

test('metadata waits five seconds and schedules again after a completed read',async()=>{
  const f=fixture();f.loop.sync();await f.advance(4999);assert.equal(f.reads,0);await f.advance(1);assert.equal(f.reads,1);assert.equal(f.timers.size,0)
  await f.advance(20000);assert.equal(f.reads,1,'slow network never overlaps periodic state reads')
  f.finish();await Promise.resolve();assert.equal(f.timers.size,1);await f.advance(5000);assert.equal(f.reads,2);f.loop.close();f.finish();await Promise.resolve();assert.equal(f.timers.size,0)
})
test('hidden, disabled or desktop surfaces pause and visible mobile resumes one timer',async()=>{
  const f=fixture();f.loop.sync();f.enabled=false;f.loop.sync();await f.advance(30000);assert.equal(f.reads,0);assert.equal(f.timers.size,0)
  f.enabled=true;f.loop.sync();f.loop.sync();assert.equal(f.timers.size,1);await f.advance(5000);assert.equal(f.reads,1)
  f.enabled=false;f.loop.sync();f.finish();await Promise.resolve();assert.equal(f.timers.size,0);f.loop.close()
})
