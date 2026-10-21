// Keep visited Session references across suspension. iOS may pause sockets;
// restore the carrier after a long absence, without reloading or logging in.
export function installConnectionLifecycle({window,document,controller,enabled,sync,now=Date.now,reconnectAfterMs=15000}){
  let suspended=Boolean(document.hidden),hiddenAt=suspended?now():undefined,networkChanged=false,closed=false
  const active=()=>!closed&&enabled()&&!document.hidden&&!suspended
  const pause=()=>{
    if(hiddenAt===undefined)hiddenAt=now()
    suspended=true
    controller.suspend()
    sync()
  }
  const recover=()=>{
    if(closed||document.hidden)return
    const reconnect=networkChanged||(hiddenAt!==undefined&&now()-hiddenAt>=reconnectAfterMs)
    suspended=false;hiddenAt=undefined;networkChanged=false
    sync()
    if(active())void controller.restore({reconnect})
  }
  const visible=()=>{if(document.hidden)pause();else if(suspended)recover()}
  const online=()=>{networkChanged=true;recover()}
  const offline=()=>{networkChanged=true;controller.suspend()}
  const show=event=>{if(event.persisted||suspended)recover()}
  const resume=()=>{if(suspended)recover()}
  const listeners=[[window,'pagehide',pause],[window,'pageshow',show],[window,'online',online],[window,'offline',offline],
    [document,'visibilitychange',visible],[document,'freeze',pause],[document,'resume',resume]]
  for(const [target,event,listener]of listeners)target.addEventListener(event,listener)
  return {active,close(){closed=true;for(const [target,event,listener]of listeners)target.removeEventListener(event,listener)}}
}
