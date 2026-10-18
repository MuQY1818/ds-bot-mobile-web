// Roster metadata supplements the canonical live Session stream; it does not
// carry chat messages. Keep it quiet outside the visible mobile surface.
export function createRefreshLoop({refresh,enabled,intervalMs=5000,setTimer=setTimeout,clearTimer=clearTimeout}){
  let timer,closed=false,running=false
  const clear=()=>{if(timer!==undefined)clearTimer(timer);timer=undefined}
  const sync=()=>{
    clear()
    if(closed||running||!enabled())return
    timer=setTimer(run,intervalMs)
    timer?.unref?.()
  }
  async function run(){
    clear()
    if(closed||running||!enabled())return
    running=true
    try{await refresh()}catch{/* The controller owns visible sync errors. */}
    finally{running=false;sync()}
  }
  return {sync,close(){closed=true;clear()}}
}
