import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {applyPhoneAccess,phoneDestination,phoneReply} from '../phone-access.mjs'
const browserPeer={}
const connection={browserPeer,requestRejection:request=>request.headers.host==='dsh.example.com'?401:403,admit:request=>request.headers.cookie==='owner'?{peer:browserPeer}:request.headers.cookie==='other'?{peer:{}}:{rejection:401},authenticatedUrl:base=>base+'?token=fixture'}
const ctxFor=()=>{let route,dispose=0;const ctx={connection,webApp:{getAdvertisedUrl:()=> 'https://dsh.example.com/'},webServer:{port:3399,protocol:'http:',register(value){route=value;return()=>dispose++}},effect:effect=>{ctx.cleanup=effect()}};return {ctx,route:()=>route,disposed:()=>dispose}}
async function invoke(route,{host='127.0.0.1:3399',origin='http://127.0.0.1:3399',cookie='owner',address='127.0.0.1',method='POST',body='{"action":"login"}',contentType='application/json'}={}){
  const req=Readable.from([body]);Object.assign(req,{headers:{host,origin,cookie,'content-type':contentType},socket:{remoteAddress:address},method})
  const res={headers:{},setHeader(key,value){this.headers[key]=value},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers)},end(body){this.body=body?JSON.parse(body):undefined}}
  await route.handler(req,res);return res
}
test('only a clean trusted remote HTTPS destination can receive a login URL',()=>{
  for(const [input,status] of [['','not-configured'],['http://127.0.0.1:3399','local-only'],['https://localhost','local-only'],['https://dsh.example.com/?token=fixture','invalid-url'],['https://user:pass@dsh.example.com','invalid-url'],['http://dsh.example.com','needs-https'],['https://unknown.example.com','not-trusted']])assert.equal(phoneDestination(input,connection).status,status)
  assert.equal(phoneReply({connection,config:{},webApp:{getAdvertisedUrl:()=> 'https://dsh.example.com/'},body:{action:'login'}}).loginUrl,'https://dsh.example.com/?token=fixture')
  assert.equal(phoneReply({connection,config:{phoneUrl:'https://dsh.example.com/'},body:{action:'status'}}).loginUrl,undefined)
})
test('signed URLs cannot change the selected authority or leak through an unexpected query',()=>{
  for(const changed of ['https://other.example.com/?token=fixture','https://dsh.example.com/?token=fixture&next=bad','https://dsh.example.com/path/?token=fixture'])assert.equal(phoneReply({connection:{...connection,authenticatedUrl:()=>changed},config:{phoneUrl:'https://dsh.example.com/'},body:{action:'login'}}).status,'unavailable')
})
test('route enforces local port, same Origin, owner authentication and POST',async()=>{
  const fixture=ctxFor();applyPhoneAccess(fixture.ctx,{})
  for(const options of [{address:'192.0.2.1'},{host:'dsh.example.com',origin:'https://dsh.example.com'},{origin:'https://other.example.com'},{host:'127.0.0.1:3400',origin:'http://127.0.0.1:3400'},{cookie:'other'}])assert.equal((await invoke(fixture.route(),options)).status,403)
  assert.equal((await invoke(fixture.route(),{cookie:''})).status,401)
  assert.equal((await invoke(fixture.route(),{method:'GET'})).status,405)
  const ready=await invoke(fixture.route());assert.equal(ready.status,200);assert.equal(ready.body.status,'ready');assert.match(ready.headers['cache-control'],/no-store/);assert.equal(ready.headers['referrer-policy'],'no-referrer')
})
test('malformed or oversized input is rejected and disposal unregisters the route',async()=>{
  const fixture=ctxFor();applyPhoneAccess(fixture.ctx,{})
  for(const body of ['null','[]','{','{"action":"anything"}','{"action":"login","unexpected":true}'])assert.equal((await invoke(fixture.route(),{body})).status,400)
  assert.equal((await invoke(fixture.route(),{body:' '.repeat(2049)})).status,413)
  assert.equal((await invoke(fixture.route(),{contentType:'text/plain'})).status,415)
  fixture.ctx.cleanup();assert.equal(fixture.disposed(),1)
})
