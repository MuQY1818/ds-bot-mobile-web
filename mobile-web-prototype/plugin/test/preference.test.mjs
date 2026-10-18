import test from 'node:test'
import assert from 'node:assert/strict'
import {createLayoutPreference} from '../src/preference.mjs'

test('layout preference persists the choice and releases subscribers',()=>{
  const saved=new Map()
  const storage={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)}
  const preference=createLayoutPreference(storage)
  let updates=0
  const off=preference.subscribe(()=>updates++)
  assert.equal(preference.snapshot(),true)
  preference.set(false)
  assert.equal(updates,1)
  assert.equal(createLayoutPreference(storage).snapshot(),false)
  preference.set(false)
  assert.equal(updates,1)
  off()
  preference.set(true)
  assert.equal(updates,1)
  assert.equal(createLayoutPreference(storage).snapshot(),true)
})

test('restricted storage still allows a session layout switch',()=>{
  const storage={getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')}}
  const preference=createLayoutPreference(storage)
  assert.equal(preference.snapshot(),true)
  preference.set(false)
  assert.equal(preference.snapshot(),false)
})
