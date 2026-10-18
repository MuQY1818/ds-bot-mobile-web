export function createLayoutPreference(storage){
  const key='dsh-mobile-layout-local.enabled'
  const listeners=new Set()
  let enabled=true
  try{enabled=storage?.getItem(key)!=='false'}catch{}
  return {
    snapshot:()=>enabled,
    subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},
    set(value){
      const next=Boolean(value)
      if(enabled===next)return
      enabled=next
      try{storage?.setItem(key,String(next))}catch{}
      for(const listener of listeners)listener()
    },
  }
}
