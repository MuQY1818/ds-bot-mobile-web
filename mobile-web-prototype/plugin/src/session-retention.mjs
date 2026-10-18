// Keep the host's canonical Client Session generation alive between mobile visits.
// This owns references only: no transcript, credentials, or messages are serialized.
export function createSessionRetention({sessions,now=Date.now,maxEntries=3,ttlMs=5*60*1000,setTimer=setTimeout,clearTimer=clearTimeout}){
  const entries=new Map()
  let enabled=false,closed=false,timer
  const release=entry=>{
    if(entries.get(entry.id)!==entry)return
    entries.delete(entry.id)
    try{entry.reference.release()}catch{/* Cache teardown must not prevent navigation or disposal. */}
  }
  const schedule=()=>{
    if(timer!==undefined)clearTimer(timer)
    timer=undefined
    if(!entries.size||closed)return
    const next=Math.min(...[...entries.values()].map(entry=>entry.visitedAt+ttlMs))
    timer=setTimer(()=>{timer=undefined;prune();schedule()},Math.max(0,next-now()))
    timer?.unref?.()
  }
  const prune=()=>{
    for(const entry of entries.values())if(now()-entry.visitedAt>=ttlMs)release(entry)
  }
  const clear=()=>{
    if(timer!==undefined)clearTimer(timer)
    timer=undefined
    for(const entry of entries.values())release(entry)
  }
  const discard=id=>{
    const entry=entries.get(id)
    if(entry)release(entry)
    schedule()
  }
  function acquire(target,warming){
    if(!enabled||closed||typeof sessions.retain!=='function')return
    prune()
    let entry=entries.get(target.id)
    if(entry&&entry.sessionId!==target.sessionId){release(entry);entry=undefined}
    if(entry){
      if(warming)return
      entry.warming=false
      entry.visitedAt=now()
      entries.delete(target.id);entries.set(target.id,entry)
      schedule();return
    }
    // Optional warmups never evict a conversation the user already visited.
    if(warming&&entries.size>=maxEntries)return
    while(entries.size>=maxEntries&&entries.size)release(entries.values().next().value)
    let reference
    try{reference=sessions.retain(target.sessionId,{source:'dsBotMobileWebRecent'})}catch{schedule();return}
    entry={id:target.id,sessionId:target.sessionId,visitedAt:now(),reference,warming}
    entries.set(target.id,entry)
    const failed=()=>{release(entry);schedule()}
    const ready=Promise.resolve(reference.ready)
    ready.then(binding=>{
      if(entries.get(entry.id)===entry&&binding.session.getSnapshot().openState==='error')failed()
    },failed).catch(failed)
    schedule()
    if(warming)return {target,ready,release(){if(entry.warming){release(entry);schedule()}}}
  }
  return {
    setEnabled(value){enabled=Boolean(value)&&!closed;if(!enabled)clear()},
    visit:target=>acquire(target,false),
    prewarm:target=>acquire(target,true),
    reconcile(items){
      const current=new Map(items.map(item=>[item.id,item.sessionId]))
      for(const entry of entries.values())if(current.get(entry.id)!==entry.sessionId)release(entry)
      prune();schedule()
    },
    discard,
    clear,
    close(){closed=true;enabled=false;clear()},
  }
}
