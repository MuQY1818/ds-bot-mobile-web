import test from 'node:test'
import assert from 'node:assert/strict'
import {readOperation} from './read-operation.mjs'

test('timeout releases a stalled read even if the underlying transport never settles',async()=>{
  let expire,signal,cleared=0
  const pending=readOperation(value=>{signal=value;return new Promise(()=>{})},{setTimer:fn=>{expire=fn;return 1},clearTimer:()=>cleared++})
  expire();await assert.rejects(pending,{code:'mobile/timeout'});assert.equal(signal.aborted,true);assert.equal(cleared,1)
})
test('cancellation and successful completion clean up; cancelled work cannot start',async()=>{
  const controller=new AbortController();let called=0
  controller.abort();await assert.rejects(readOperation(()=>called++,{signal:controller.signal}),{name:'AbortError'});assert.equal(called,0)
  let resolve;const active=new AbortController(),pending=readOperation(()=>new Promise(yes=>{resolve=yes}),{signal:active.signal})
  active.abort();await assert.rejects(pending,{name:'AbortError'});resolve('late')
  assert.equal(await readOperation(()=>42),42)
})
