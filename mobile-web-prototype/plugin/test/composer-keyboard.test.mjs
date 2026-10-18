import test from 'node:test'
import assert from 'node:assert/strict'
import {createComposerKeyboard} from '../src/composer-keyboard.mjs'

function fixture(){
  let enabled=true,blurs=0
  const document={activeElement:null}
  const input={blur(){blurs++;document.activeElement=null}}
  const card={querySelector(selector){assert.equal(selector,'[data-composer-input]');return input}}
  const anchor={closest(selector){assert.equal(selector,'[data-composer-card]');return card}}
  const observer=createComposerKeyboard({anchor:()=>anchor,enabled:()=>enabled,document})
  return {observer,input,document,focus(){document.activeElement=input},enable(value){enabled=value},get blurs(){return blurs}}
}
test('only a new real submission dismisses the focused composer, without waiting for its network result',()=>{
  const f=fixture();f.focus()
  assert.equal(f.observer.update([{requestId:'already-pending'}]),false)
  assert.equal(f.observer.update([{requestId:'already-pending',phase:'sending'}]),false)
  assert.equal(f.observer.update([{requestId:'already-pending'},{requestId:'new-send'}]),true)
  assert.equal(f.document.activeElement,null);assert.equal(f.blurs,1)
  f.focus();f.observer.update([]);f.observer.update([{requestId:'new-send'}]);assert.equal(f.blurs,1)
})
test('empty/blocked/Shift+Enter activity without a submission never blurs, and desktop changes are not replayed later',()=>{
  const f=fixture();f.focus();f.observer.update([])
  for(let n=0;n<4;n++)assert.equal(f.observer.update([]),false)
  assert.equal(f.document.activeElement,f.input)
  f.enable(false);assert.equal(f.observer.update([{requestId:'desktop-send'}]),false)
  f.enable(true);assert.equal(f.observer.update([{requestId:'desktop-send'}]),false)
  assert.equal(f.document.activeElement,f.input);assert.equal(f.blurs,0)
})
test('a submission never blurs another composer, search or modal input',()=>{
  const f=fixture();f.observer.update([])
  const other={blur(){assert.fail('unrelated input was blurred')}}
  f.document.activeElement=other
  assert.equal(f.observer.update([{requestId:'new-send'}]),false)
  assert.equal(f.document.activeElement,other);assert.equal(f.blurs,0)
})
test('large unchanged pending snapshots are never mistaken for another send',()=>{
  const f=fixture(),pending=Array.from({length:300},(_,n)=>({requestId:`pending-${n}`}))
  f.focus();f.observer.update(pending)
  for(let n=0;n<3;n++)assert.equal(f.observer.update(pending.map(item=>({...item}))),false)
  assert.equal(f.blurs,0);assert.equal(f.document.activeElement,f.input)
})
