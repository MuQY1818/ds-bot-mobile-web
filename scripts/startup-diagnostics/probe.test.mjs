import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {apply,validReport} from './index.mjs'
const example=()=>({page:'0123456789abcdef',phase:'ready',standalone:true,secure:true,workerSupport:true,controlled:true,cacheKnown:true,
  mobileAtBoot:true,mobileAtReport:true,animationSeen:true,widthAtBoot:390,widthAtReport:390,
  at:1000,bootstrap:12,enabled:900,root:14,ready:1000,dom:800,load:850,lag:80,navStart:0,dns:1,connect:2,tls:1,ttfb:8,htmlEnd:10,redirects:0,cacheCore:4,cachePlugin:3,
  resources:[{kind:'plugin',start:20,request:25,response:30,end:800,worker:20,transfer:0,encoded:4000,decoded:10000}]})
function fixture(){
  let route,tap;const disposers=[],owner={}
  const ctx={webServer:{protocol:'http:',port:3399,tapIndex(fn){tap=fn;return()=>{}},register(value){route=value;return()=>{}}},
    connection:{browserPeer:owner,admit:request=>request.headers.cookie==='owner'?{peer:owner}:request.headers.cookie==='other'?{peer:{}}:{rejection:401}},effect:fn=>disposers.push(fn())}
  apply(ctx)
  return {tap:()=>tap,route:()=>route,close:()=>disposers.forEach(fn=>fn())}
}
async function invoke(route,{method='POST',host='phone.example.test',address='127.0.0.1',origin='https://phone.example.test',cookie='owner',body=JSON.stringify(example()),contentType='application/json',site='same-origin'}={}){
  const request=Readable.from([body]);Object.assign(request,{method,socket:{remoteAddress:address},headers:{host,origin,cookie,'content-type':contentType,'sec-fetch-site':site}})
  const response={destroyed:false,headers:{},setHeader(key,value){this.headers[key]=value},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers)},end(body){this.body=JSON.parse(body)}}
  await route.handler(request,response);return response
}
test('only numeric timing data and fixed categories can enter the report ring',()=>{
  assert.equal(validReport(example()),true)
  for(const bad of [{...example(),url:'https://private.test/?token=secret'},{...example(),at:Infinity},{...example(),phase:'message'},
    {...example(),resources:[{...example().resources[0],name:'https://private.test'}]},{...example(),resources:[{...example().resources[0],kind:'conversation'}]},
    {...example(),resources:Array(49).fill(example().resources[0])}])assert.equal(validReport(bad),false)
})
test('authenticated phone may submit; reading requires the local owner listener',async()=>{
  const f=fixture()
  assert.equal((await invoke(f.route())).status,200)
  assert.equal((await invoke(f.route(),{cookie:''})).status,401)
  assert.equal((await invoke(f.route(),{cookie:'other'})).status,403)
  assert.equal((await invoke(f.route(),{origin:'https://evil.test'})).status,403)
  assert.equal((await invoke(f.route(),{origin:null,address:'192.0.2.10'})).status,403)
  assert.equal((await invoke(f.route(),{site:'cross-site'})).status,403)
  assert.equal((await invoke(f.route(),{method:'GET'})).status,403)
  const read=await invoke(f.route(),{method:'GET',host:'127.0.0.1:3399',origin:'http://127.0.0.1:3399'})
  assert.equal(read.status,200);assert.equal(read.body.reports.length,1);assert.match(read.headers['cache-control'],/no-store/)
  assert.equal((await invoke(f.route(),{method:'GET',host:'127.0.0.1:3399',address:'192.0.2.10'})).status,403)
  f.close()
})
test('ring and input are bounded and injected probe follows the viewport',async()=>{
  const f=fixture()
  for(let i=0;i<23;i++)assert.equal((await invoke(f.route())).status,200)
  const read=await invoke(f.route(),{method:'GET',host:'127.0.0.1:3399',origin:'http://127.0.0.1:3399'})
  assert.equal(read.body.reports.length,20)
  assert.equal((await invoke(f.route(),{body:' '.repeat(24577)})).status,413)
  assert.equal((await invoke(f.route(),{body:'{"chat":"private"}'})).status,400)
  const html=f.tap()('<html><head><meta name="viewport" content="width=device-width"><script src="/code.js"></script></head></html>')
  assert.ok(html.indexOf('name="viewport"')<html.indexOf('function captureStartup'))
  assert.ok(html.indexOf('function captureStartup')<html.indexOf('src="/code.js"'))
  f.close()
})
