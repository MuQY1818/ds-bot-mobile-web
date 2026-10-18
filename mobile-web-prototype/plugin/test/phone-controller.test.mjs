import test from 'node:test'
import assert from 'node:assert/strict'
import {createPhoneController} from '../src/phone-controller.mjs'
import {phoneQr} from '../src/phone-access.mjs'
const ready={status:'ready',baseUrl:'https://dsh.example.com/',loginUrl:'https://dsh.example.com/?token=fixture'}
const fixture=fetchImpl=>{const writes=[];const form={async set(...args){writes.push(args);return true}};return {phone:createPhoneController({appRoot:'http://127.0.0.1:3399/',form,fetchImpl}),writes}}
test('closing while a login request is in flight never retains its credential',async()=>{
  let respond
  const {phone}=fixture(()=>new Promise(resolve=>respond=resolve))
  phone.open();phone.close();respond({json:async()=>ready});await new Promise(resolve=>setImmediate(resolve));assert.equal(phone.snapshot().open,false);assert.equal(phone.snapshot().loginUrl,'')
})
test('credentials stay ephemeral and clipboard failure offers a manual fallback',async()=>{
  const {phone}=fixture(async()=>({json:async()=>ready}));await phone.refresh();assert.equal(phone.snapshot().loginUrl,ready.loginUrl)
  assert.equal(await phone.copy({writeText:async()=>{throw Error('sensitive error')}}),false);assert.match(phone.snapshot().error,/手动复制/);assert.doesNotMatch(phone.snapshot().error,/sensitive/)
  phone.close();assert.equal(phone.snapshot().loginUrl,'');phone.dispose();assert.equal(phone.snapshot().loginUrl,'')
})
test('configuration saves only a clean HTTPS base URL through the public form',async()=>{
  const {phone,writes}=fixture(async()=>({json:async()=>ready}));assert.equal(await phone.configure('https://dsh.example.com/?token=fixture'),false);assert.equal(writes.length,0)
  assert.equal(await phone.configure('https://dsh.example.com'),true);assert.deepEqual(writes,[['phoneUrl','https://dsh.example.com/']])
})
test('unexpected signed destination is rejected rather than rendered or copied',async()=>{
  const {phone}=fixture(async()=>({json:async()=>({...ready,loginUrl:'https://other.example.com/?token=fixture'})}));await phone.refresh();assert.equal(phone.snapshot().status,'unavailable');assert.equal(phone.snapshot().loginUrl,'')
})
test('QR SVG reserves a quiet zone and renders fixed black modules locally',()=>{
  const qr=phoneQr(ready.loginUrl);assert.ok(qr.size>8);assert.ok(qr.path.startsWith('M4 4'));assert.match(qr.path,/h1v1h-1z/);assert.doesNotMatch(qr.path,/https?:/)
})
