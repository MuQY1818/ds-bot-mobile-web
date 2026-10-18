import test from 'node:test'
import assert from 'node:assert/strict'
import {createMobileClient} from './client.mjs'

function fixture(){
  const requests=[]
  const api=createMobileClient({appRoot:'http://fixture.invalid/',fetch:(url,options)=>new Promise(resolve=>requests.push({signal:options.signal,payload:JSON.parse(options.body).payload,resolve(value,status=200){resolve(Response.json({ok:true,value},{status}))}}))})
  const state={revision:1,modelsKey:'fixture',bots:[{id:'bot',name:'Bot',sessionId:'part-1'}],rooms:[]}
  return {api,requests,state}
}

test('poll and overlapping target validations share only the in-flight authenticated read',async()=>{
  const f=fixture(),poll=f.api.refresh(),target=f.api.target('bot')
  assert.equal(f.requests.length,1);f.requests[0].resolve(f.state)
  assert.equal((await poll).bots[0].sessionId,'part-1');assert.equal((await target).sessionId,'part-1')
  const next=f.api.target('bot');assert.equal(f.requests.length,2,'completed metadata never bypasses the next identity validation')
  f.requests[1].resolve({...f.state,revision:2,bots:[{id:'bot',name:'Bot',sessionId:'part-2'}]});assert.equal((await next).sessionId,'part-2')
})
test('cancelling one target cannot abort another reader of the shared request',async()=>{
  const f=fixture(),cancelled=new AbortController(),poll=f.api.refresh(),target=f.api.target('bot',cancelled.signal)
  cancelled.abort();await assert.rejects(target,{name:'AbortError'});assert.equal(f.requests[0].signal.aborted,false)
  f.requests[0].resolve(f.state);assert.equal((await poll).revision,1)
})
test('the final cancelled reader aborts transport and a late result cannot seed another request',async()=>{
  const f=fixture(),controller=new AbortController(),old=f.api.target('bot',controller.signal)
  controller.abort();await assert.rejects(old,{name:'AbortError'});assert.equal(f.requests[0].signal.aborted,true)
  const current=f.api.refresh();assert.equal(f.requests.length,2);assert.deepEqual(f.requests[1].payload,{})
  f.requests[1].resolve({...f.state,revision:2});await current
  f.requests[0].resolve({...f.state,revision:999});await Promise.resolve();await Promise.resolve()
  const latest=f.api.refresh();assert.equal(f.requests[2].payload.since,2);f.requests[2].resolve({revision:2,unchanged:true});await latest
})
test('independent clients never share state or cancellation across identities',async()=>{
  const one=fixture(),two=fixture(),first=one.api.refresh(),second=two.api.refresh()
  assert.equal(one.requests.length,1);assert.equal(two.requests.length,1)
  one.requests[0].resolve(one.state);two.requests[0].resolve({...two.state,bots:[]});assert.equal((await first).bots.length,1);assert.equal((await second).bots.length,0)
})
test('authorization refusal rejects every shared reader and clears the previous incremental identity',async()=>{
  const f=fixture(),initial=f.api.refresh();f.requests[0].resolve(f.state);await initial
  const poll=f.api.refresh(),target=f.api.target('bot')
  f.requests[1].resolve(null,401);await assert.rejects(poll,{code:'HTTP_401'});await assert.rejects(target,{code:'HTTP_401'})
  const next=f.api.refresh();assert.deepEqual(f.requests[2].payload,{})
  f.requests[2].resolve({...f.state,bots:[]});assert.equal((await next).bots.length,0)
})
