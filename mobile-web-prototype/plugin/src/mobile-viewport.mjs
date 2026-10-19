const DURATION=200,DISMISS_WINDOW=700,DISCRETE_GROWTH=80

/** Follow native viewport frames; soften only a discrete composer keyboard dismissal. */
export function createMobileViewport({window,document,enabled=()=>true}){
  const root=document.documentElement,viewport=window.visualViewport
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const properties=['--dsm-height','--dsm-top']
  const original=properties.map(name=>[name,root.style.getPropertyValue(name),root.style.getPropertyPriority(name)])
  const animations=new Set(),listeners=[]
  let closed=false,frame=null,previous=null,pending=null,expiry=null,finishTimer=null
  const now=()=>window.performance?.now?.()??Date.now()
  const number=(value,fallback)=>Number.isFinite(value)?value:fallback
  // CSS establishes the standalone root's full canvas. Follow its visual
  // viewport here so opening the keyboard still keeps the composer visible.
  const read=()=>({
    height:viewport?.height>0?viewport.height:window.innerHeight,
    top:number(viewport?.offsetTop,0),
    width:viewport?.width>0?viewport.width:window.innerWidth,
    scale:number(viewport?.scale,1),
  })
  const listen=(target,type,callback,options)=>{
    target?.addEventListener?.(type,callback,options)
    listeners.push(()=>target?.removeEventListener?.(type,callback,options))
  }
  const cancelMotion=()=>{
    pending=null
    if(expiry!==null)window.clearTimeout(expiry)
    if(finishTimer!==null)window.clearTimeout(finishTimer)
    expiry=finishTimer=null
    for(const animation of animations)animation.cancel()
    animations.clear()
  }
  const changedGeometry=(a,b)=>Math.abs(a.width-b.width)>3||Math.abs(a.scale-b.scale)>.01
  const allowed=sample=>enabled()&&!document.hidden&&!reduced?.matches&&Math.abs(sample.scale-1)<.01
  const validTarget=target=>target.seat.isConnected&&target.scroll.isConnected&&
    target.seat.closest('[data-conversation-scroll]')===target.scroll&&
    target.host?.getAttribute('data-conversation-session')===target.session
  const flip=(element,before)=>{
    if(!element?.isConnected||typeof element.animate!=='function')return
    const delta=before-element.getBoundingClientRect().top
    if(!Number.isFinite(delta)||Math.abs(delta)<2)return
    try{
      const animation=element.animate([
        {transform:`translateY(${delta}px)`},
        {transform:'translateY(0px)'},
      ],{duration:DURATION,easing:'cubic-bezier(.22,.7,.25,1)',composite:'add',fill:'none'})
      animations.add(animation)
      // A cancelled WAAPI animation rejects finished; always consume that rejection.
      animation.finished?.then(()=>{animations.delete(animation);animation.cancel()},()=>animations.delete(animation))
    }catch{/* Older engines keep the native viewport movement. */}
  }
  const apply=()=>{
    frame=null
    if(closed)return
    const sample=read(),last=previous
    if(!allowed(sample)||last&&(changedGeometry(last,sample)||sample.height<last.height-2))cancelMotion()
    if(animations.size&&last&&(Math.abs(sample.height-last.height)>2||Math.abs(sample.top-last.top)>2))cancelMotion()
    let target
    if(pending){
      if(now()>pending.deadline||changedGeometry(pending.viewport,sample)||!validTarget(pending))cancelMotion()
      else if(last&&sample.height-last.height>=DISCRETE_GROWTH){
        target={...pending,seatTop:pending.seat.getBoundingClientRect().top,
          flowTop:pending.atBottom&&pending.flow?.isConnected?pending.flow.getBoundingClientRect().top:null}
        pending=null
        window.clearTimeout(expiry);expiry=null
      }
    }
    const values=[`${sample.height}px`,`${sample.top}px`]
    properties.forEach((name,index)=>{
      if(root.style.getPropertyValue(name)!==values[index])root.style.setProperty(name,values[index])
    })
    previous=sample
    if(target){
      flip(target.seat,target.seatTop)
      if(target.flowTop!==null)flip(target.flow,target.flowTop)
      if(animations.size)finishTimer=window.setTimeout(()=>{finishTimer=null;cancelMotion()},DURATION+50)
    }
  }
  const sync=()=>{
    if(closed)return
    const sample=read()
    if(!allowed(sample)||previous&&(changedGeometry(previous,sample)||sample.height<previous.height-2))cancelMotion()
    if(frame===null)frame=window.requestAnimationFrame(apply)
  }
  const prepareDismiss=input=>{
    if(closed)return false
    const sample=read()
    if(!allowed(sample)||!input?.matches?.('[data-composer-input]'))return false
    const seat=input.closest('[data-composer-seat]'),scroll=seat?.closest('[data-conversation-scroll]')
    if(!seat?.isConnected||!scroll?.isConnected)return false
    cancelMotion()
    const host=seat.closest('[data-conversation-content]')
    pending={seat,scroll,host,session:host?.getAttribute('data-conversation-session'),
      flow:scroll.querySelector('[data-chat-flow]'),
      atBottom:scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop<=48,
      viewport:sample,deadline:now()+DISMISS_WINDOW}
    expiry=window.setTimeout(()=>{expiry=null;pending=null},DISMISS_WINDOW)
    return true
  }
  const beginDismiss=()=>prepareDismiss(document.activeElement)
  const editable=element=>element?.isContentEditable||element?.matches?.('input,textarea,[contenteditable]:not([contenteditable="false"])')
  const focus=event=>{
    if(editable(event.target))cancelMotion()
  }
  const focusOut=event=>{
    if(!event.target?.matches?.('[data-composer-input]'))return
    if(editable(event.relatedTarget)){cancelMotion();return}
    // Touch browsers can move focus to Send before a Session submission exists.
    // Observe the native blur only; never infer a send or dismiss another input.
    prepareDismiss(event.target)
  }
  const visibility=()=>{if(document.hidden)cancelMotion();else sync()}
  const orientation=()=>{cancelMotion();sync()}
  listen(viewport,'resize',sync);listen(viewport,'scroll',sync)
  listen(window,'resize',sync);listen(window,'orientationchange',orientation)
  listen(document,'focusin',focus);listen(document,'focusout',focusOut);listen(document,'visibilitychange',visibility)
  listen(document,'pointerdown',cancelMotion,{passive:true})
  listen(document,'touchstart',cancelMotion,{passive:true})
  listen(document,'wheel',cancelMotion,{passive:true})
  listen(reduced,'change',()=>{cancelMotion();sync()})
  sync()
  return {
    sync,beginDismiss,
    close(){
      if(closed)return
      closed=true;cancelMotion()
      if(frame!==null)window.cancelAnimationFrame(frame)
      frame=null
      for(const off of listeners)off()
      for(const [name,value,priority] of original){
        if(value)root.style.setProperty(name,value,priority)
        else root.style.removeProperty(name)
      }
    },
  }
}
