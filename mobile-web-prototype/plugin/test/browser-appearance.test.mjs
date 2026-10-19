import test from 'node:test'
import assert from 'node:assert/strict'
import {installMobileBrowserAppearance} from '../web-appearance.mjs'

function fixture(){
  const nodes=[],observers=[],events=new Map(),properties=new Map()
  const media=()=>({matches:false,addEventListener(_,fn){this.listener=fn},removeEventListener(){delete this.listener}})
  const mobile=media(),system=media();mobile.matches=true
  const style={getPropertyValue:key=>properties.get(key)?.[0]??'',getPropertyPriority:key=>properties.get(key)?.[1]??'',setProperty(key,value,priority=''){properties.set(key,[value,priority])},removeProperty:key=>properties.delete(key)}
  const root={dataset:{},style},body={dark:false,hasAttribute(){return this.dark}}
  const document={documentElement:root,body,createElement(){
    const attributes=new Map()
    return {dataset:{},get content(){return attributes.get('content')??''},set content(value){attributes.set('content',value)},getAttribute:key=>attributes.get(key)??null,setAttribute(key,value){attributes.set(key,value)},removeAttribute:key=>attributes.delete(key),remove(){nodes.splice(nodes.indexOf(this),1)}}
  },head:{querySelectorAll(selector){const name=selector.match(/name="([^"]+)"/)[1];return nodes.filter(node=>node.name===name)},append:node=>nodes.push(node)}}
  let enabled=true
  const window={document,localStorage:{getItem(){return enabled?null:'false'}},matchMedia:query=>query.includes('max-width')?mobile:system,
    MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this)}observe(){}disconnect(){this.disconnected=true}},
    addEventListener(type,fn){events.set(type,fn)},removeEventListener(type){events.delete(type)},
  }
  const meta=(name,value)=>{const node=document.createElement('meta');node.name=name;node.content=value;document.head.append(node);return node}
  return {root,body,window,mobile,system,nodes,events,observers,meta,setEnabled:value=>{enabled=value},value:name=>nodes.find(node=>node.name===name)?.content,publish(){for(const observer of observers)if(!observer.disconnected)observer.fn()}}
}

test('browser chrome follows explicit and system themes before and after the body appears',()=>{
  const f=fixture();f.window.document.body=null;f.system.matches=true
  const owner=installMobileBrowserAppearance(f.window)
  assert.equal(f.value('theme-color'),'#141414');assert.equal(f.value('color-scheme'),'dark')
  f.window.document.body=f.body;f.root.dataset.dsThemeSource='light';f.publish()
  assert.equal(f.value('theme-color'),'#ffffff');assert.equal(f.value('color-scheme'),'light')
  f.root.dataset.dsThemeSource='dark';f.publish()
  assert.equal(f.root.style.getPropertyValue('background-color'),'#141414')
  f.root.dataset.dsThemeSource='system';f.system.matches=false;f.system.listener()
  assert.equal(f.value('theme-color'),'#ffffff')
  owner.close()
})

test('existing media-qualified metadata and inline style priority restore on disable and disposal',()=>{
  const f=fixture(),light=f.meta('theme-color','cornflowerblue'),dark=f.meta('theme-color','dimgray')
  light.setAttribute('media','(prefers-color-scheme:light)');dark.setAttribute('media','(prefers-color-scheme:dark)')
  f.root.style.setProperty('background-color','pink','important')
  const owner=installMobileBrowserAppearance(f.window)
  assert.equal(light.content,'#ffffff');assert.equal(dark.content,'#ffffff');assert.equal(dark.getAttribute('media'),null)
  f.setEnabled(false);owner.sync()
  assert.equal(f.nodes.length,2);assert.equal(light.content,'cornflowerblue');assert.equal(dark.content,'dimgray')
  assert.equal(dark.getAttribute('media'),'(prefers-color-scheme:dark)');assert.equal(f.root.style.getPropertyPriority('background-color'),'important')
  f.setEnabled(true);owner.sync();assert.equal(f.value('theme-color'),'#ffffff')
  owner.close();owner.close();f.root.dataset.dsThemeSource='dark';f.publish()
  assert.equal(light.content,'cornflowerblue');assert.equal(f.root.style.getPropertyValue('background-color'),'pink')
  assert.equal(f.events.size,0);assert.equal(f.mobile.listener,undefined);assert.equal(f.system.listener,undefined)
})

test('wide layout relinquishes mobile metadata and re-entry reacquires it without touching the manifest',()=>{
  const f=fixture(),owner=installMobileBrowserAppearance(f.window)
  assert.equal(f.value('apple-mobile-web-app-status-bar-style'),'default')
  assert.equal(f.value('apple-mobile-web-app-capable'),'yes')
  f.mobile.matches=false;f.mobile.listener()
  assert.equal(f.nodes.length,0);assert.equal(f.root.style.getPropertyValue('color-scheme'),'')
  f.mobile.matches=true;f.mobile.listener();assert.equal(f.value('color-scheme'),'light')
  owner.close();assert.equal(f.nodes.length,0)
})

test('restricted local storage does not prevent mobile appearance',()=>{
  const f=fixture();f.window.localStorage={getItem(){throw Error('storage unavailable')}}
  const owner=installMobileBrowserAppearance(f.window)
  assert.equal(f.value('theme-color'),'#ffffff');owner.close()
})
