import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {WEB_LAUNCH_IMAGES,renderWebLaunch,applyWebLaunch} from '../web-launch.mjs'

function fixture(){
  const routes=new Map(),taps=new Set(),effects=[]
  const ctx={webServer:{
    register(route){assert.equal(route.kind,'exact');assert.equal(routes.has(route.path),false);routes.set(route.path,route);return()=>routes.delete(route.path)},
    tapIndex(transform){taps.add(transform);return()=>taps.delete(transform)},
  },effect(run){effects.push(run())}}
  applyWebLaunch(ctx)
  return {routes,taps,close(){for(const dispose of effects.reverse())dispose()}}
}

function request(route,method){
  const result={}
  route.handler({method},{writeHead(status,headers){result.status=status;result.headers=headers},end(body){result.body=body}})
  return result
}

test('static launch PNG routes cover required portrait iPhones in both themes',()=>{
  const f=fixture()
  const required=['430x932@3','390x844@3','393x852@3','402x874@3','440x956@3','428x926@3','414x896@2','414x896@3','375x812@3','375x667@2']
  assert.equal(WEB_LAUNCH_IMAGES.length,20);assert.equal(f.routes.size,20)
  for(const size of required)for(const theme of ['light','dark'])assert.ok(WEB_LAUNCH_IMAGES.some(image=>`${image.width}x${image.height}@${image.ratio}`===size&&image.theme===theme))
  for(const image of WEB_LAUNCH_IMAGES){
    assert.equal('base64'in image,false)
    const result=request(f.routes.get(image.path),'GET'),bytes=result.body
    assert.equal(result.status,200);assert.equal(result.headers['content-type'],'image/png')
    assert.match(result.headers['cache-control'],/public.*immutable/)
    assert.equal(result.headers['x-content-type-options'],'nosniff')
    assert.equal(Number(result.headers['content-length']),bytes.length)
    assert.deepEqual(bytes.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]))
    assert.equal(bytes.subarray(12,16).toString(),'IHDR')
    assert.equal(bytes.readUInt32BE(16),image.width*image.ratio)
    assert.equal(bytes.readUInt32BE(20),image.height*image.ratio)
    assert.ok(image.path.endsWith(`-${createHash('sha256').update(bytes).digest('hex').slice(0,16)}.png`))
    assert.ok(image.path.startsWith('/ds-bot-mobile-web-launch/v1/'))
    assert.equal(new URL(image.path,'https://example.invalid').search,'')
  }
  f.close()
})

test('HTML contributes only media-specific links and preserves manifest identity',()=>{
  const html='<html><head><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#fff"></head><body><div id="root"></div></body></html>'
  const rendered=renderWebLaunch(html)
  assert.equal((rendered.match(/rel="apple-touch-startup-image"/g)||[]).length,20)
  assert.equal(renderWebLaunch(rendered),rendered)
  assert.ok(rendered.includes('<link rel="manifest" href="/manifest.webmanifest">'))
  assert.ok(rendered.includes('<body><div id="root"></div></body>'))
  assert.doesNotMatch(rendered,/base64|data:image|<script|apple-mobile-web-app-capable/)
  for(const image of WEB_LAUNCH_IMAGES){
    assert.ok(rendered.includes(`href="${image.path}"`))
    assert.ok(rendered.includes(`media="${image.media}"`))
    assert.match(image.media,/orientation: portrait/)
    assert.match(image.media,new RegExp(`prefers-color-scheme: ${image.theme}`))
    assert.ok(image.media.includes(`device-width: ${image.width}px`))
    assert.ok(image.media.includes(`device-height: ${image.height}px`))
    assert.ok(image.media.includes(`-webkit-device-pixel-ratio: ${image.ratio}`))
  }
  assert.equal(renderWebLaunch('<div>no head</div>'),'<div>no head</div>')
})

test('HEAD preserves image length without a body; unsupported methods are refused',()=>{
  const f=fixture(),route=f.routes.values().next().value
  const get=request(route,'GET'),head=request(route,'HEAD'),post=request(route,'POST')
  assert.equal(head.status,200);assert.equal(head.body,undefined);assert.deepEqual(head.headers,get.headers)
  assert.equal(post.status,405);assert.equal(post.headers.allow,'GET, HEAD');assert.equal(post.body,undefined)
  f.close()
})

test('plugin disposal removes all routes and the index tap',()=>{
  const f=fixture();assert.equal(f.taps.size,1);f.close();assert.equal(f.taps.size,0);assert.equal(f.routes.size,0)
  applyWebLaunch({effect(){throw Error('unsupported host must be ignored')},webServer:{}})
})

test('registration failure rolls back previously registered public routes',()=>{
  const active=new Set();let registrations=0
  assert.throws(()=>applyWebLaunch({effect:run=>run(),webServer:{
    register(route){if(++registrations===3)throw Error('route collision');active.add(route.path);return()=>active.delete(route.path)},
    tapIndex(){throw Error('not reached')},
  }}),/route collision/)
  assert.equal(active.size,0)
})
