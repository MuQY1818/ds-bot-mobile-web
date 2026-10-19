import test from 'node:test'
import assert from 'node:assert/strict'
import {installMobileBrowserAppearance} from '../web-appearance.mjs'

function fixture(){
  const nodes=[],bodyNodes=[],observers=[],events=new Map(),properties=new Map()
  const media=()=>({matches:false,addEventListener(_,fn){this.listener=fn},removeEventListener(){delete this.listener}})
  const mobile=media(),system=media();mobile.matches=true
  const style={getPropertyValue:key=>properties.get(key)?.[0]??'',getPropertyPriority:key=>properties.get(key)?.[1]??'',setProperty(key,value,priority=''){properties.set(key,[value,priority])},removeProperty:key=>properties.delete(key)}
  const root={dataset:{},style},body={dark:false,hasAttribute(){return this.dark},append(node){bodyNodes.push(node);node.parentElement=this}}
  const document={documentElement:root,body,createElement(){
    const attributes=new Map()
    return {dataset:{},style:{},get content(){return attributes.get('content')??''},set content(value){attributes.set('content',value)},getAttribute:key=>attributes.get(key)??null,setAttribute(key,value){attributes.set(key,value)},removeAttribute:key=>attributes.delete(key),remove(){for(const list of [nodes,bodyNodes]){const index=list.indexOf(this);if(index>=0)list.splice(index,1)}this.parentElement=null}}
  },head:{querySelectorAll(selector){const name=selector.match(/name="([^"]+)"/)[1];return nodes.filter(node=>node.name===name)},append:node=>nodes.push(node)}}
  let enabled=true
  const window={document,localStorage:{getItem(){return enabled?null:'false'}},matchMedia:query=>query.includes('max-width')?mobile:system,
    MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this)}observe(){}disconnect(){this.disconnected=true}},
    addEventListener(type,fn){events.set(type,fn)},removeEventListener(type){events.delete(type)},
  }
  const meta=(name,value)=>{const node=document.createElement('meta');node.name=name;node.content=value;document.head.append(node);return node}
  return {root,body,bodyNodes,window,mobile,system,nodes,events,observers,meta,setEnabled:value=>{enabled=value},value:name=>nodes.find(node=>node.name===name)?.content,publish(){for(const observer of observers)if(!observer.disconnected)observer.fn()}}
}

test('Home Screen status background exists before the app mounts, follows themes and cleans up',()=>{
  const f=fixture();f.window.navigator={standalone:true};f.window.document.body=null
  const owner=installMobileBrowserAppearance(f.window)
  assert.equal(f.bodyNodes.length,0)
  f.window.document.body=f.body;f.publish()
  assert.equal(f.bodyNodes.length,1)
  const background=f.bodyNodes[0]
  assert.equal(background.parentElement,f.body)
  assert.equal(background.getAttribute('aria-hidden'),'true')
  assert.equal(background.style.backgroundColor,'#ffffff')
  f.root.dataset.dsThemeSource='dark';f.publish()
  assert.equal(f.bodyNodes[0],background)
  assert.equal(background.style.backgroundColor,'#141414')
  f.setEnabled(false);owner.sync();assert.equal(f.bodyNodes.length,0)
  f.setEnabled(true);owner.sync();assert.equal(f.bodyNodes.length,1)
  owner.close();assert.equal(f.bodyNodes.length,0)
})

test('ordinary browser pages do not get an iOS Home Screen status background',()=>{
  const f=fixture();f.window.navigator={standalone:false}
  const owner=installMobileBrowserAppearance(f.window)
  assert.equal(f.bodyNodes.length,0);owner.close()
})

test('only iOS 27 iPhone Home Screen reserves native edge space, including frozen OS tokens',()=>{
  const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1'
  for(const [standalone,userAgent,expected]of [
    [true,iphone,'min(24px, env(safe-area-inset-top))'],
    [false,iphone,'0px'],
    [true,iphone.replace('Version/27.0','Version/26.5'),'0px'],
    [true,iphone.replaceAll('iPhone','iPad'),'0px'],
    [true,'Mozilla/5.0 (Linux; Android 15) Chrome/127.0.0.0','0px'],
  ]){
    const f=fixture();f.window.navigator={standalone,userAgent}
    f.root.style.setProperty('--dsm-edge-inset','5px','important')
    const owner=installMobileBrowserAppearance(f.window)
    assert.equal(f.root.style.getPropertyValue('--dsm-edge-inset'),expected)
    f.mobile.matches=false;f.mobile.listener()
    assert.equal(f.root.style.getPropertyValue('--dsm-edge-inset'),'5px')
    assert.equal(f.root.style.getPropertyPriority('--dsm-edge-inset'),'important')
    f.mobile.matches=true;f.mobile.listener()
    assert.equal(f.root.style.getPropertyValue('--dsm-edge-inset'),expected)
    owner.close();assert.equal(f.root.style.getPropertyValue('--dsm-edge-inset'),'5px')
  }
})

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
  // `black-translucent` lets the page background reach the status bar; `default`
  // would paint it from the system appearance and ignore the in-app theme.
  assert.equal(f.value('apple-mobile-web-app-status-bar-style'),'black-translucent')
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
