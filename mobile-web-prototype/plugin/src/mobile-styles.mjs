// Follow DS Bot's compiled-style approach without importing its global shell CSS.
// Hashed host classes are discovered from stylesheets, never the transcript DOM.
const FRAGMENT=/\[class\*="(_[\w-]+)"\]/g
const CLASS=/\.((?:\\.|[\w-])+)/g

export function compileMobileStyles(text,names){
  const matches=new Map()
  return text.replace(FRAGMENT,(original,fragment)=>{
    if(!matches.has(fragment)){
      const exact=[...names].filter(name=>name.includes(fragment)).sort().map(name=>`.${name}`)
      // :is() preserves the class/attribute specificity of the original selector.
      matches.set(fragment,exact.length?`:is(${exact.join(',')})`:original)
    }
    return matches.get(fragment)
  })
}

export function installMobileStyles({window,document,text}){
  const style=document.createElement('style')
  style.dataset.mobileLayout='local'
  let closed=false,timer=null
  const derived=node=>node===style||node?.dataset?.dshBot!==undefined
  const stylesheet=node=>!derived(node)&&(node?.localName==='style'||node?.localName==='link')
  const render=()=>{
    timer=null
    if(closed)return
    const names=new Set(),visited=new Set()
    const rules=list=>{
      for(const rule of list){
        if(rule.selectorText)for(const match of rule.selectorText.matchAll(CLASS))names.add(match[1])
        if(rule.cssRules)rules(rule.cssRules)
        if(rule.styleSheet)sheet(rule.styleSheet)
      }
    }
    const sheet=value=>{
      if(visited.has(value)||derived(value.ownerNode)||value.disabled)return
      visited.add(value)
      try{rules(value.cssRules??[])}catch{/* Unreadable sheets are skipped; unresolved fragments keep their original selectors. */}
    }
    for(const value of document.styleSheets)sheet(value)
    const next=compileMobileStyles(text,names)
    if(style.textContent!==next)style.textContent=next
  }
  const schedule=()=>{
    if(closed)return
    if(timer!==null)window.clearTimeout(timer)
    timer=window.setTimeout(render,80)
  }
  render();document.head.append(style)
  const observer=new window.MutationObserver(records=>{
    if(records.some(record=>{
      if(record.target===document.head)return [...record.addedNodes,...record.removedNodes].some(stylesheet)
      // Support a late inline stylesheet edit, while ignoring our own compilation
      // and DS Bot's derived sheets. Observation stays inside <head>.
      const node=record.target.nodeType===3?record.target.parentElement:record.target
      return node?.localName==='style'&&stylesheet(node)
    }))schedule()
  })
  observer.observe(document.head,{childList:true,subtree:true,characterData:true})
  const load=event=>{if(event.target?.localName==='link'&&stylesheet(event.target))schedule()}
  document.addEventListener('load',load,true)
  return {style,close(){
    if(closed)return
    closed=true
    if(timer!==null)window.clearTimeout(timer)
    observer.disconnect();document.removeEventListener('load',load,true);style.remove()
  }}
}
