import test from 'node:test'
import assert from 'node:assert/strict'
import {createMobileViewport} from '../src/mobile-viewport.mjs'
import {createComposerKeyboard} from '../src/composer-keyboard.mjs'

function target(){
  const listeners=new Map()
  return {
    listeners,
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn)},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn)},
    emit(type,event={}){for(const fn of listeners.get(type)??[])fn(event)},
    listenerCount(){return [...listeners.values()].reduce((sum,set)=>sum+set.size,0)},
  }
}
function fixture({bottom=true,visual=true,original={}}={}){
  let time=0,id=0,enabled=true,session='one',scrollTop=bottom?1100:450
  const frames=new Map(),timers=new Map(),writes=[],effects=[]
  const values=new Map(Object.entries(original)),priorities=new Map()
  const style={
    getPropertyValue:name=>values.get(name)??'',getPropertyPriority:name=>priorities.get(name)??'',
    setProperty(name,value,priority=''){values.set(name,value);priorities.set(name,priority);writes.push([name,value])},
    removeProperty(name){values.delete(name);priorities.delete(name)},
  }
  const window=Object.assign(target(),{
    innerWidth:390,innerHeight:800,performance:{now:()=>time},
    requestAnimationFrame(fn){frames.set(++id,fn);return id},cancelAnimationFrame(id){frames.delete(id)},
    setTimeout(fn,ms){timers.set(++id,{fn,at:time+ms});return id},clearTimeout(id){timers.delete(id)},
  })
  const viewport=Object.assign(target(),{height:500,offsetTop:0,width:390,scale:1})
  const reduced=Object.assign(target(),{matches:false})
  window.visualViewport=visual?viewport:undefined;window.matchMedia=()=>reduced
  const document=Object.assign(target(),{documentElement:{style},hidden:false,activeElement:null})
  const height=()=>parseFloat(values.get('--dsm-height')??'500')
  const top=()=>parseFloat(values.get('--dsm-top')??'0')
  const animate=name=>(frames,options)=>{
    let resolve,reject,settled=false
    const finished=new Promise((yes,no)=>{resolve=yes;reject=no})
    const effect={name,frames,options,finished,cancelled:false,
      cancel(){this.cancelled=true;if(!settled){settled=true;reject(Error('cancelled'))}},
      finish(){if(!settled){settled=true;resolve()}},
    }
    effects.push(effect);return effect
  }
  const host={getAttribute(name){assert.equal(name,'data-conversation-session');return session}}
  const flow={isConnected:true,getBoundingClientRect:()=>({top:top()+height()-1000}),animate:animate('flow')}
  const scroll={isConnected:true,scrollHeight:1500,clientHeight:400,
    get scrollTop(){return scrollTop},set scrollTop(_){assert.fail('viewport helper must not write scrollTop')},
    querySelector(selector){assert.equal(selector,'[data-chat-flow]');return flow},
  }
  const seat={isConnected:true,getBoundingClientRect:()=>({top:top()+height()-70}),animate:animate('seat'),
    closest(selector){return selector==='[data-conversation-scroll]'?scroll:selector==='[data-conversation-content]'?host:null},
  }
  const input={matches(selector){return selector==='[data-composer-input]'||selector.includes('contenteditable')},
    closest(selector){return selector==='[data-composer-seat]'?seat:null},
  }
  document.activeElement=input
  const controller=createMobileViewport({window,document,enabled:()=>enabled})
  const flush=()=>{const current=[...frames.values()];frames.clear();for(const fn of current)fn(time)}
  const advance=ms=>{time+=ms;for(const [id,timer] of [...timers])if(timer.at<=time){timers.delete(id);timer.fn()}}
  const grow=(amount=300)=>{viewport.height+=amount;viewport.emit('resize');flush()}
  flush();writes.length=0
  return {controller,window,document,viewport,reduced,frames,timers,writes,effects,style,seat,scroll,flow,input,
    flush,advance,grow,enable(value){enabled=value},session(value){session=value},readAt(value){scrollTop=value}}
}

test('native resize/scroll bursts publish the latest viewport once per animation frame',()=>{
  const f=fixture()
  f.viewport.height=610;f.viewport.emit('resize')
  f.viewport.offsetTop=12;f.viewport.emit('scroll');f.window.emit('resize');f.controller.sync()
  assert.equal(f.frames.size,1);assert.equal(f.writes.length,0)
  f.flush()
  assert.deepEqual(f.writes,[['--dsm-height','610px'],['--dsm-top','12px']])
  f.controller.sync();f.flush();assert.equal(f.writes.length,2)
  assert.equal(f.effects.length,0);f.controller.close()
})

test('a discrete dismissal moves only composer and the pinned chat flow, then removes effects',async()=>{
  const f=fixture();assert.equal(f.controller.beginDismiss(),true)
  f.document.activeElement=null;f.grow()
  assert.equal(f.style.getPropertyValue('--dsm-height'),'800px')
  assert.deepEqual(f.effects.map(effect=>effect.name),['seat','flow'])
  for(const effect of f.effects){
    assert.deepEqual(effect.frames,[{transform:'translateY(-300px)'},{transform:'translateY(0px)'}])
    assert.equal(effect.options.duration,200);assert.equal(effect.options.fill,'none');assert.equal(effect.options.composite,'add')
    effect.finish()
  }
  await Promise.resolve();assert.ok(f.effects.every(effect=>effect.cancelled))
  f.advance(250);assert.equal(f.timers.size,0);f.controller.close()
})

test('old history never receives a flow animation and user scroll position is untouched',()=>{
  const f=fixture({bottom:false});const before=f.scroll.scrollTop
  f.controller.beginDismiss();f.grow()
  assert.deepEqual(f.effects.map(effect=>effect.name),['seat'])
  assert.equal(f.scroll.scrollTop,before);f.controller.close()
})

test('a tap moving focus to Send before its submission still prepares native dismissal once',()=>{
  const f=fixture(),button={matches:()=>false}
  const card={querySelector:()=>f.input},anchor={closest:()=>card}
  const keyboard=createComposerKeyboard({anchor:()=>anchor,enabled:()=>true,document:f.document,beforeDismiss:f.controller.beginDismiss})
  keyboard.update([])
  f.document.emit('pointerdown',{target:button})
  f.document.activeElement=button
  f.document.emit('focusout',{target:f.input,relatedTarget:button})
  f.document.emit('focusin',{target:button})
  assert.equal(keyboard.update([{requestId:'tap-send'}]),false)
  assert.equal(f.document.activeElement,button)
  f.grow()
  assert.deepEqual(f.effects.map(effect=>effect.name),['seat','flow'])
  f.controller.close()
})

test('composer focusout followed by another editable focus never animates its keyboard movement',()=>{
  const other={matches:()=>true}
  for(const relatedTarget of [other,null]){
    const f=fixture()
    f.document.activeElement=other
    f.document.emit('focusout',{target:f.input,relatedTarget})
    f.document.emit('focusin',{target:other})
    f.grow();assert.equal(f.effects.length,0);f.controller.close()
  }
  for(const change of [f=>f.enable(false),f=>{f.document.hidden=true},f=>{f.reduced.matches=true}]){
    const f=fixture();change(f)
    f.document.emit('focusout',{target:f.input,relatedTarget:null});f.grow()
    assert.equal(f.effects.length,0);f.controller.close()
  }
})

test('explicit send preparation and its following native focusout reuse one dismissal window',()=>{
  const f=fixture();assert.equal(f.controller.beginDismiss(),true)
  f.document.activeElement=null
  f.document.emit('focusout',{target:f.input,relatedTarget:null})
  assert.equal(f.controller.beginDismiss(),false)
  assert.equal(f.timers.size,1)
  f.grow();assert.equal(f.effects.length,2);f.controller.close()
})

test('ordinary viewport changes and native continuous dismissal frames remain unanimated',()=>{
  const f=fixture();f.grow();assert.equal(f.effects.length,0)
  f.viewport.height=500;f.viewport.emit('resize');f.flush()
  f.controller.beginDismiss()
  for(let n=0;n<15;n++){f.advance(16);f.grow(20)}
  assert.equal(f.style.getPropertyValue('--dsm-height'),'800px');assert.equal(f.effects.length,0)
  f.controller.close()
})

test('dismissal eligibility expires and cannot animate another conversation or a detached composer',()=>{
  for(const change of [f=>f.advance(701),f=>f.session('two'),f=>{f.seat.isConnected=false}]){
    const f=fixture();f.controller.beginDismiss();change(f);f.grow()
    assert.equal(f.effects.length,0);f.controller.close()
  }
})

test('desktop/disabled, reduced motion, zoom and unrelated focus never arm dismissal effects',()=>{
  for(const change of [f=>f.enable(false),f=>{f.reduced.matches=true},f=>{f.viewport.scale=1.2},f=>{f.document.activeElement={matches:()=>false}}]){
    const f=fixture();change(f)
    assert.equal(f.controller.beginDismiss(),false);f.grow();assert.equal(f.effects.length,0)
    assert.equal(f.style.getPropertyValue('--dsm-height'),'800px');f.controller.close()
  }
})

test('reopening keyboard, zoom, rotation, focus, backgrounding and reduced motion cancel active effects',()=>{
  const actions=[
    f=>{f.viewport.height=480;f.viewport.emit('resize')},
    f=>{f.viewport.scale=1.25;f.viewport.emit('resize')},
    f=>{f.viewport.width=800;f.viewport.emit('resize')},
    f=>f.window.emit('orientationchange'),
    f=>f.document.emit('focusin',{target:f.input}),
    f=>{f.document.hidden=true;f.document.emit('visibilitychange')},
    f=>{f.reduced.matches=true;f.reduced.emit('change')},
    f=>{f.enable(false);f.controller.sync()},
    f=>f.document.emit('touchstart'),
  ]
  for(const action of actions){
    const f=fixture();f.controller.beginDismiss();f.grow();assert.equal(f.effects.length,2)
    action(f);assert.ok(f.effects.every(effect=>effect.cancelled));f.flush();f.controller.close()
  }
})

test('later native geometry frames cancel rather than restart or stack a dismissal transition',()=>{
  const f=fixture();f.controller.beginDismiss();f.grow()
  f.viewport.offsetTop=30;f.viewport.emit('scroll');f.flush()
  assert.ok(f.effects.every(effect=>effect.cancelled));assert.equal(f.effects.length,2)
  assert.equal(f.style.getPropertyValue('--dsm-top'),'30px');f.controller.close()
})

test('fallback viewport and missing WAAPI still publish usable native geometry',()=>{
  const f=fixture({visual:false});assert.equal(f.style.getPropertyValue('--dsm-height'),'800px')
  f.window.innerHeight=700;f.window.emit('resize');f.flush()
  assert.equal(f.style.getPropertyValue('--dsm-height'),'700px');f.controller.close()
  const g=fixture();g.seat.animate=undefined;g.flow.animate=()=>{throw Error('unsupported composite')}
  g.controller.beginDismiss();g.grow();assert.equal(g.effects.length,0)
  assert.equal(g.style.getPropertyValue('--dsm-height'),'800px');g.controller.close()
})

test('close cancels pending frames, timers, animations and listeners, restoring prior variables',()=>{
  const f=fixture({original:{'--dsm-height':'97dvh','--dsm-top':'3px'}})
  f.controller.beginDismiss();f.grow();f.controller.sync()
  assert.ok(f.frames.size);assert.ok(f.timers.size);f.controller.close();f.controller.close()
  assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);assert.ok(f.effects.every(effect=>effect.cancelled))
  for(const target of [f.document,f.window,f.viewport,f.reduced])assert.equal(target.listenerCount(),0)
  assert.equal(f.style.getPropertyValue('--dsm-height'),'97dvh');assert.equal(f.style.getPropertyValue('--dsm-top'),'3px')
  f.controller.sync();assert.equal(f.controller.beginDismiss(),false);assert.equal(f.frames.size,0)
})
