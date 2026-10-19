/** A presentation-only adapter over the host's durable theme service. */
export function createMobileTheme({theme,subscribe,window,document,enabled=()=>true}){
  const root=document.documentElement,reduced=window.matchMedia('(prefers-reduced-motion: reduce)')
  const listeners=new Set()
  let closed=false,sequence=0,intent,active=null,fadeTimer=null,animation=null
  const snapshot=()=>theme.getTheme()
  const clearVisual=()=>{
    if(fadeTimer!==null)window.clearTimeout(fadeTimer)
    fadeTimer=null
    animation?.cancel();animation=null
    delete root.dataset.dsmThemeEffect
  }
  const cancel=()=>{sequence++;intent=undefined;active?.skipTransition();clearVisual()}
  const allowed=()=>enabled()&&!document.hidden&&!reduced.matches
  const canReveal=()=>{
    if(typeof document.startViewTransition!=='function'||typeof root.animate!=='function'||!window.CSS?.supports?.('clip-path','circle(1px)'))return false
    // Older animation engines may ignore pseudoElement and animate <html> itself.
    try{return new window.KeyframeEffect(root,[],{pseudoElement:'::view-transition-new(root)'}).pseudoElement==='::view-transition-new(root)'}catch{return false}
  }
  const fade=target=>{
    root.dataset.dsmThemeEffect='fade'
    // Resolve the old colors with the scoped transition installed first.
    window.getComputedStyle(document.body).backgroundColor
    theme.setTheme(target)
    fadeTimer=window.setTimeout(clearVisual,200)
  }
  const off=subscribe(()=>{for(const listener of listeners)listener()})
  const visibility=()=>{if(document.hidden)cancel()}
  const motion=()=>{
    if(!reduced.matches)return
    const target=intent
    cancel()
    if(target!==undefined)theme.setTheme(target)
  }
  document.addEventListener('visibilitychange',visibility)
  reduced.addEventListener('change',motion)
  return {
    snapshot,
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
    toggle(button){
      if(closed||!enabled())return
      const target=(intent??snapshot().active.colorScheme)==='dark'?'light':'dark'
      intent=target
      const id=++sequence
      if(active||fadeTimer!==null){
        active?.skipTransition();clearVisual()
        theme.setTheme(target);intent=undefined
        return
      }
      if(!allowed()){
        theme.setTheme(target);intent=undefined
        return
      }
      if(!canReveal()){
        fade(target);intent=undefined
        return
      }
      const bounds=button?.getBoundingClientRect()
      const x=bounds?bounds.left+bounds.width/2:window.innerWidth/2
      const y=bounds?bounds.top+bounds.height/2:window.innerHeight/2
      const radius=Math.hypot(Math.max(x,window.innerWidth-x),Math.max(y,window.innerHeight-y))
      root.dataset.dsmThemeEffect='reveal'
      let transition
      try{
        transition=document.startViewTransition(()=>{
          if(closed||id!==sequence)return
          theme.setTheme(target);intent=undefined
        })
        active=transition
      }catch{
        clearVisual();fade(target);intent=undefined
        return
      }
      transition.updateCallbackDone.catch(()=>{})
      transition.ready.then(()=>{
        if(closed||id!==sequence||!allowed()){transition.skipTransition();return}
        try{
          animation=root.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]},
            {duration:300,easing:'cubic-bezier(.22,.7,.25,1)',pseudoElement:'::view-transition-new(root)'})
          animation.finished.catch(()=>{})
        }catch{transition.skipTransition()}
      }).catch(()=>{})
      transition.finished.catch(()=>{}).then(()=>{
        if(active===transition){active=null;clearVisual()}
      })
    },
    cancel,
    close(){
      if(closed)return
      closed=true;cancel();off();listeners.clear()
      document.removeEventListener('visibilitychange',visibility)
      reduced.removeEventListener('change',motion)
    },
  }
}
