const scheduleIdle=callback=>{
  if(typeof globalThis.requestIdleCallback==='function'){
    const id=globalThis.requestIdleCallback(callback,{timeout:1500})
    return ()=>globalThis.cancelIdleCallback(id)
  }
  const id=setTimeout(callback,350)
  id?.unref?.()
  return ()=>clearTimeout(id)
}

// Identities come only from the latest successful roster, never browser storage.
export function sessionWarmupTargets(items,{activeId,recentIds=[]}={}){
  const byId=new Map(items.map(item=>[item.id,item]))
  const ordered=[byId.get(activeId),items.find(item=>item.isMain),...recentIds.map(id=>byId.get(id))]
  const used=new Set()
  return ordered.filter(item=>{
    if(!item?.sessionId||used.has(item.sessionId))return false
    used.add(item.sessionId);return true
  }).slice(0,2)
}

// One optional canonical opening at a time, after the page's foreground work.
// Unchanged roster polling cannot renew the cache's LRU position or expiry.
export function createSessionWarmup({prewarm,idle=scheduleIdle,events=globalThis,online=()=>globalThis.navigator?.onLine!==false}){
  let closed=false,enabled=false,signature='',pending=[],cancelIdle,active
  const cancel=()=>{
    cancelIdle?.();cancelIdle=undefined
    const current=active;active=undefined
    current?.release()
  }
  const schedule=()=>{
    if(closed||!enabled||active||cancelIdle||!pending.length)return
    cancelIdle=idle(run)
  }
  const run=()=>{
    cancelIdle=undefined
    if(closed||!enabled||!online()){sync({enabled:false});return}
    const target=pending.shift()
    if(!target)return
    let reference
    try{reference=prewarm(target)}catch{/* Preloading must never block navigation. */}
    if(!reference){schedule();return}
    active=reference
    Promise.resolve(reference.ready).catch(()=>{}).finally(()=>{
      if(active!==reference)return
      active=undefined;schedule()
    })
  }
  function sync({enabled:next,targets=[]}){
    if(closed)return
    if(!next||!online()){enabled=false;signature='';pending=[];cancel();return}
    enabled=true
    const wanted=targets.slice(0,2)
    const key=JSON.stringify(wanted.map(target=>[target.id,target.sessionId]))
    if(signature!==key){
      signature=key;pending=wanted
      if(active&&!wanted.some(target=>target.id===active.target.id&&target.sessionId===active.target.sessionId))cancel()
    }
    schedule()
  }
  const offline=()=>sync({enabled:false})
  events.addEventListener?.('offline',offline)
  return {sync,close(){if(closed)return;sync({enabled:false});closed=true;events.removeEventListener?.('offline',offline)}}
}
