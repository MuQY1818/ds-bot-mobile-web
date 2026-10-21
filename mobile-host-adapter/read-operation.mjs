// A read must release its waiter even when a suspended carrier ignores abort.
// Never use this helper to retry or replay a message submission.
export function readOperation(read,{signal,timeoutMs=12000,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  const controller=new AbortController()
  return new Promise((resolve,reject)=>{
    let settled=false,timer
    const finish=(settle,value)=>{
      if(settled)return
      settled=true
      clearTimer(timer)
      signal?.removeEventListener('abort',cancel)
      settle(value)
    }
    const abort=reason=>{finish(reject,reason);controller.abort(reason)}
    const cancel=()=>abort(signal.reason)
    if(signal?.aborted){cancel();return}
    signal?.addEventListener('abort',cancel,{once:true})
    timer=setTimer(()=>abort(Object.assign(new Error('Read timed out'),{code:'mobile/timeout'})),timeoutMs)
    try{Promise.resolve(read(controller.signal)).then(value=>finish(resolve,value),error=>finish(reject,error))}
    catch(error){finish(reject,error)}
  })
}
