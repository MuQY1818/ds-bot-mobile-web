// Runs before application code so iOS can choose readable status-bar content.
// Uses the host's resolved theme; this is not another preference store.
export function installMobileBrowserAppearance(window){
  const document=window.document,root=document.documentElement
  const mobile=window.matchMedia('(max-width:767px), (max-width:1024px) and (max-height:500px)')
  const system=window.matchMedia('(prefers-color-scheme: dark)')
  const originals=new Map(),styles=new Map()
  let body,closed=false,active=false
  const remember=node=>{
    if(!originals.has(node))originals.set(node,{content:node.getAttribute('content'),media:node.getAttribute('media')})
    return node
  }
  const meta=(name,content)=>{
    const existing=[...document.head.querySelectorAll(`meta[name="${name}"]`)]
    if(!existing.length){
      const node=document.createElement('meta');node.name=name;node.dataset.dsmBrowserAppearance='true'
      originals.set(node,null);document.head.append(node);existing.push(node)
    }
    for(const node of existing){remember(node);if(node.content!==content)node.content=content;node.removeAttribute('media')}
  }
  const restore=()=>{
    for(const [node,original]of originals){
      if(original===null){node.remove();continue}
      for(const name of ['content','media']){
        if(original[name]===null)node.removeAttribute(name);else node.setAttribute(name,original[name])
      }
    }
    originals.clear()
    for(const [name,{value,priority}]of styles){
      if(value)root.style.setProperty(name,value,priority);else root.style.removeProperty(name)
    }
    styles.clear();active=false
  }
  const sync=()=>{
    if(closed)return
    let enabled=true
    try{enabled=window.localStorage.getItem('dsh-mobile-layout-local.enabled')!=='false'}catch{}
    if(!enabled||!mobile.matches){if(active)restore();return}
    active=true
    const source=root.dataset.dsThemeSource
    const dark=source==='dark'||source!=='light'&&(document.body?.hasAttribute('data-ds-dark-theme')||system.matches)
    const color=dark?'#141414':'#ffffff',scheme=dark?'dark':'light'
    meta('theme-color',color);meta('color-scheme',scheme)
    meta('apple-mobile-web-app-capable','yes')
    meta('apple-mobile-web-app-status-bar-style','default')
    for(const [name,value]of [['background-color',color],['color-scheme',scheme]]){
      if(!styles.has(name))styles.set(name,{value:root.style.getPropertyValue(name),priority:root.style.getPropertyPriority(name)})
      if(root.style.getPropertyValue(name)!==value)root.style.setProperty(name,value)
    }
  }
  const bodyObserver=new window.MutationObserver(sync)
  const attach=()=>{
    if(body!==document.body){bodyObserver.disconnect();body=document.body;if(body)bodyObserver.observe(body,{attributes:true,attributeFilter:['data-ds-dark-theme']})}
    sync()
  }
  const rootObserver=new window.MutationObserver(attach)
  rootObserver.observe(root,{childList:true,attributes:true,attributeFilter:['data-ds-theme-source']})
  mobile.addEventListener('change',sync);system.addEventListener('change',sync)
  window.addEventListener('pageshow',sync);window.addEventListener('storage',sync)
  attach()
  return {sync,close(){
    if(closed)return
    closed=true;rootObserver.disconnect();bodyObserver.disconnect()
    mobile.removeEventListener('change',sync);system.removeEventListener('change',sync)
    window.removeEventListener('pageshow',sync);window.removeEventListener('storage',sync)
    restore()
  }}
}
