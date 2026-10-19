import test from 'node:test'
import assert from 'node:assert/strict'
import {createMobileTheme} from '../src/mobile-theme.mjs'

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
const tick=async()=>{for(let n=0;n<5;n++)await Promise.resolve()}
function fixture({native=false,reduced=false,scheme='light',preference='system'}={}){
  let snapshot={preference,active:{colorScheme:scheme},revision:0},enabled=true,closed=0,id=0
  const events=new Set(),writes=[],transitions=[],animations=[],timers=new Map(),mediaListeners=new Set(),documentListeners=new Map()
  const publish=(nextPreference,nextScheme)=>{snapshot={preference:nextPreference,active:{colorScheme:nextScheme},revision:snapshot.revision+1};for(const fn of events)fn()}
  const theme={getTheme:()=>snapshot,setTheme(value){writes.push(value);publish(value,value)}}
  const root={dataset:{},animate(frames,options){const finished=deferred();const animation={frames,options,finished:finished.promise,cancelled:false,cancel(){this.cancelled=true;finished.reject(Error('cancelled'))}};animations.push(animation);return animation}}
  const document={documentElement:root,body:{},hidden:false,
    addEventListener(type,fn){documentListeners.set(type,fn)},removeEventListener(type){documentListeners.delete(type)},
  }
  const media={matches:reduced,addEventListener(_,fn){mediaListeners.add(fn)},removeEventListener(_,fn){mediaListeners.delete(fn)}}
  const window={innerWidth:390,innerHeight:844,CSS:{supports:()=>true},KeyframeEffect:class{constructor(_,__,options){this.pseudoElement=options.pseudoElement}},matchMedia:()=>media,getComputedStyle:()=>({backgroundColor:'#fff'}),
    setTimeout(fn,ms){timers.set(++id,{fn,ms});return id},clearTimeout(id){timers.delete(id)},
    get localStorage(){assert.fail('mobile theme must use only host preference storage')},
  }
  if(native)document.startViewTransition=update=>{
    const ready=deferred(),finished=deferred(),callback=deferred()
    const transition={ready:ready.promise,finished:finished.promise,updateCallbackDone:callback.promise,skips:0,
      async update(){try{await update();callback.resolve()}catch(error){callback.reject(error)}},
      makeReady:ready.resolve,finish:finished.resolve,
      skipTransition(){this.skips++;ready.reject(Error('skipped'));finished.resolve()},
    }
    transitions.push(transition);return transition
  }
  const controller=createMobileTheme({theme,subscribe(fn){events.add(fn);return()=>{closed++;events.delete(fn)}},window,document,enabled:()=>enabled})
  const button={getBoundingClientRect:()=>({left:18,top:8,width:44,height:44})}
  return {controller,document,root,window,media,events,writes,transitions,animations,timers,mediaListeners,documentListeners,button,publish,
    setEnabled(value){enabled=value},get closed(){return closed},runTimers(){for(const {fn} of [...timers.values()])fn()},
  }
}

test('the resolved host theme drives toggles and host changes publish without a second preference store',()=>{
  const f=fixture({scheme:'dark'});let updates=0
  const off=f.controller.subscribe(()=>updates++)
  assert.equal(f.controller.snapshot().preference,'system')
  f.controller.toggle(f.button)
  assert.deepEqual(f.writes,['light']);assert.equal(f.controller.snapshot().active.colorScheme,'light')
  f.publish('system','dark');assert.equal(updates,2);assert.equal(f.controller.snapshot().active.colorScheme,'dark')
  off();f.controller.close();assert.equal(f.closed,1)
})

test('native transition updates once and reveals the new palette from the button over 300ms',async()=>{
  const f=fixture({native:true});f.controller.toggle(f.button)
  assert.deepEqual(f.writes,[]);assert.equal(f.root.dataset.dsmThemeEffect,'reveal')
  const transition=f.transitions[0];await transition.update();transition.makeReady();await tick()
  assert.deepEqual(f.writes,['dark']);assert.equal(f.animations.length,1)
  const effect=f.animations[0]
  assert.equal(effect.options.duration,300);assert.equal(effect.options.pseudoElement,'::view-transition-new(root)')
  assert.equal(effect.frames.clipPath[0],'circle(0px at 40px 30px)')
  const radius=Number(effect.frames.clipPath[1].match(/circle\(([\d.]+)/)[1]);assert.ok(radius>=Math.hypot(350,814))
  transition.finish();await tick();assert.equal(effect.cancelled,true);assert.equal(f.root.dataset.dsmThemeEffect,undefined)
  f.controller.close()
})

test('rapid taps invalidate pending callbacks and do not stack snapshots or animations',async()=>{
  const f=fixture({native:true})
  f.controller.toggle(f.button);const first=f.transitions[0]
  f.controller.toggle(f.button);f.controller.toggle(f.button)
  assert.deepEqual(f.writes,['light','dark']);assert.equal(f.transitions.length,1);assert.ok(first.skips>=1)
  await first.update();await tick()
  assert.deepEqual(f.writes,['light','dark']);assert.equal(f.controller.snapshot().active.colorScheme,'dark')
  assert.equal(f.animations.length,0);assert.equal(f.root.dataset.dsmThemeEffect,undefined);f.controller.close()
})

test('unsupported native transitions use only a short scoped color fade; rapid taps cancel it',()=>{
  const f=fixture();f.controller.toggle(f.button)
  assert.equal(f.root.dataset.dsmThemeEffect,'fade');assert.equal([...f.timers.values()][0].ms,200)
  assert.deepEqual(f.writes,['dark']);assert.equal(f.animations.length,0)
  f.controller.toggle(f.button);assert.deepEqual(f.writes,['dark','light']);assert.equal(f.timers.size,0)
  assert.equal(f.root.dataset.dsmThemeEffect,undefined);f.controller.close()
  const g=fixture({native:true});g.document.startViewTransition=()=>{throw Error('not available')}
  g.controller.toggle(g.button);assert.deepEqual(g.writes,['dark']);assert.equal(g.root.dataset.dsmThemeEffect,'fade');g.controller.close()
  const h=fixture({native:true});h.window.KeyframeEffect=class{}
  h.controller.toggle(h.button);assert.deepEqual(h.writes,['dark']);assert.equal(h.transitions.length,0);assert.equal(h.root.dataset.dsmThemeEffect,'fade');h.controller.close()
})

test('reduced motion switches immediately and disabling or closing prevents late native writes',async()=>{
  const f=fixture({native:true,reduced:true});f.controller.toggle(f.button)
  assert.deepEqual(f.writes,['dark']);assert.equal(f.transitions.length,0);assert.equal(f.timers.size,0);f.controller.close()
  const g=fixture({native:true});g.controller.toggle(g.button);const transition=g.transitions[0]
  g.setEnabled(false);g.controller.cancel();await transition.update();await tick()
  assert.deepEqual(g.writes,[]);g.controller.toggle(g.button);assert.equal(g.transitions.length,1);g.controller.close()
  assert.equal(g.events.size,0);assert.equal(g.mediaListeners.size,0);assert.equal(g.documentListeners.size,0)
  assert.equal(g.root.dataset.dsmThemeEffect,undefined)
})

test('motion and visibility changes cancel active effects and consume native promise rejections',async()=>{
  const f=fixture({native:true});f.controller.toggle(f.button);const transition=f.transitions[0]
  await transition.update();transition.makeReady();await tick();assert.equal(f.animations.length,1)
  f.media.matches=true;for(const listener of f.mediaListeners)listener()
  await tick();assert.equal(f.animations[0].cancelled,true);assert.equal(f.root.dataset.dsmThemeEffect,undefined)
  f.media.matches=false;f.controller.toggle(f.button);f.document.hidden=true;f.documentListeners.get('visibilitychange')()
  await f.transitions.at(-1).update();await tick();assert.deepEqual(f.writes,['dark']);f.controller.close()
})

test('reduced motion enabled before the native callback commits the latest choice immediately',async()=>{
  const f=fixture({native:true});f.controller.toggle(f.button)
  f.media.matches=true;for(const listener of f.mediaListeners)listener()
  assert.deepEqual(f.writes,['dark']);assert.equal(f.root.dataset.dsmThemeEffect,undefined)
  await f.transitions[0].update();await tick();assert.deepEqual(f.writes,['dark']);f.controller.close()
})
