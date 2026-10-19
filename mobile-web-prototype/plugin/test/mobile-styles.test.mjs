import test from 'node:test'
import assert from 'node:assert/strict'
import {compileMobileStyles,installMobileStyles} from '../src/mobile-styles.mjs'

const original='@media(max-width:767px){body[data-dsm-enabled] header[class*="_header"]:has(.bt-head),[class*="_frame"]>[class*="_unknown"]{color:red}}'
const owner=(localName='style',dataset={})=>({localName,dataset,nodeType:1})
function fixture(sheets=[]){
  let observer,removed=false,writes=0,id=0,reads=0
  const timers=new Map(),events=new Map(),style=owner(),head={append(node){assert.equal(node,style)}}
  let content=''
  Object.defineProperty(style,'textContent',{get:()=>content,set:value=>{content=value;writes++}})
  style.remove=()=>{removed=true}
  const document={head,createElement(name){assert.equal(name,'style');return style},
    get styleSheets(){reads++;return sheets},
    addEventListener(type,callback){events.set(type,callback)},removeEventListener(type,callback){assert.equal(events.get(type),callback);events.delete(type)},
    querySelectorAll(){assert.fail('stylesheet compilation must not scan the transcript')},
  }
  const window={MutationObserver:class{
    constructor(callback){this.callback=callback;observer=this}
    observe(target,options){assert.equal(target,head);assert.deepEqual(options,{childList:true,subtree:true,characterData:true})}
    disconnect(){this.disconnected=true}
  },setTimeout(callback){timers.set(++id,callback);return id},clearTimeout(key){timers.delete(key)}}
  const styles=installMobileStyles({window,document,text:original})
  return {styles,style,sheets,timers,events,head,
    get removed(){return removed},get writes(){return writes},get reads(){return reads},get observer(){return observer},
    mutate(records){observer.callback(records)},
    flush(){const pending=[...timers.values()];timers.clear();for(const callback of pending)callback()},
  }
}

test('exact class selectors preserve nested rules, all matching host classes and unknown-host fallback',()=>{
  const names=new Set(['zz_header','aa_header','xx_frame','some_unrelated','aa_header'])
  const next=compileMobileStyles(original,names)
  assert.equal(next,'@media(max-width:767px){body[data-dsm-enabled] header:is(.aa_header,.zz_header):has(.bt-head),:is(.xx_frame)>[class*="_unknown"]{color:red}}')
  assert.equal(compileMobileStyles(original,new Set()),original)
})

test('late stylesheets and inline edits update only the owned style, without stale derived names',()=>{
  const source=owner(),sheet={ownerNode:source,cssRules:[]}
  const f=fixture([sheet]);assert.equal(f.style.textContent,original)
  sheet.cssRules=[{cssRules:[{selectorText:'.current_header, .current_frame'}]}]
  f.mutate([{target:source,addedNodes:[],removedNodes:[]}])
  f.mutate([{target:source,addedNodes:[],removedNodes:[]}])
  assert.equal(f.timers.size,1);f.flush()
  assert.match(f.style.textContent,/header:is\(\.current_header\)/)
  const firstReads=f.reads,firstWrites=f.writes
  f.mutate([{target:f.style,addedNodes:[],removedNodes:[]}])
  f.mutate([{target:owner('style',{dshBot:'shell'}),addedNodes:[],removedNodes:[]}])
  assert.equal(f.timers.size,0);assert.equal(f.reads,firstReads)
  f.sheets.push({ownerNode:owner('style',{dshBot:'shell'}),cssRules:[{selectorText:'.obsolete_header'}]})
  f.mutate([{target:f.head,addedNodes:[owner('link')],removedNodes:[]}]);f.flush()
  assert.equal(f.writes,firstWrites,'unchanged compiled CSS must not trigger style invalidation')
  f.sheets.splice(0,1)
  f.mutate([{target:f.head,addedNodes:[],removedNodes:[source]}]);f.flush()
  assert.equal(f.style.textContent,original,'removed host classes must not survive via derived styles')
  f.styles.close();assert.equal(f.removed,true);assert.equal(f.observer.disconnected,true)
})

test('unreadable and initially empty linked sheets retain fallback, then compile after load and fully dispose',()=>{
  const link=owner('link'),external={ownerNode:owner('link'),get cssRules(){throw Error('SecurityError')}}
  const linked={ownerNode:link,cssRules:[]}
  const f=fixture([external,linked]);assert.equal(f.style.textContent,original)
  linked.cssRules=[{selectorText:'.loaded_header,.loaded_frame'}]
  f.events.get('load')({target:link});f.flush()
  assert.match(f.style.textContent,/\.loaded_header/)
  const reads=f.reads
  f.events.get('load')({target:owner('img')});assert.equal(f.timers.size,0)
  f.events.get('load')({target:link});assert.equal(f.timers.size,1)
  f.styles.close();assert.equal(f.timers.size,0);assert.equal(f.events.size,0)
  f.mutate([{target:f.head,addedNodes:[owner()],removedNodes:[]}]);f.flush()
  assert.equal(f.reads,reads);f.styles.close()
})
