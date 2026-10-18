export const WORKER_PATH='/ds-bot-mobile-web-worker.js'

export async function clearMobileAssetCache(environment){
  try{
    const registration=await environment.navigator.serviceWorker?.getRegistration('/')
    const script=new URL('/ds-bot-mobile-web-worker.js',environment.location.origin).href
    if(registration?.active?.scriptURL===script&&registration.active.postMessage){
      if(environment.MessageChannel)await new Promise(resolve=>{
        const channel=new environment.MessageChannel(),timer=setTimeout(done,1000)
        function done(){clearTimeout(timer);channel.port1.close();resolve()}
        channel.port1.onmessage=done
        registration.active.postMessage({type:'ds-bot-mobile-web/retire'},[channel.port2])
      })
      else registration.active.postMessage({type:'ds-bot-mobile-web/retire'})
    }
    const current=await environment.navigator.serviceWorker?.getRegistration('/')
    const owners=[current?.active,current?.waiting,current?.installing].filter(Boolean)
    if(owners.length&&owners.every(owner=>owner.scriptURL===script))await current.unregister()
  }catch{}
  try{for(const key of await environment.caches.keys())if(key.startsWith('ds-bot-mobile-web-assets-'))await environment.caches.delete(key)}catch{}
}

// Runs without the application bundle. Only public, versioned static assets
// belong here; documents, login URLs, APIs and messages always use the network.
export function installAssetWorker(worker){
  const prefix='ds-bot-mobile-web-assets-',name=prefix+'v1'
  let writes=Promise.resolve(),inactive=false,retirement
  const retire=()=>{
    if(retirement)return retirement
    inactive=true
    retirement=(async()=>{
      await writes
      try{for(const key of await worker.caches.keys())if(key.startsWith(prefix))await worker.caches.delete(key)}catch{}
      const script=new URL('/ds-bot-mobile-web-worker.js',worker.location.origin).href
      const owners=[worker.registration.active,worker.registration.waiting,worker.registration.installing].filter(Boolean)
      if(!owners.length||owners.every(owner=>owner.scriptURL===script))await worker.registration.unregister()
    })()
    return retirement
  }
  const eligible=request=>{
    const url=new URL(request.url)
    return !inactive&&request.method==='GET'&&request.mode!=='navigate'&&!request.headers?.has('range')&&request.cache!=='no-store'&&request.cache!=='reload'&&
      url.origin===worker.location.origin&&!url.search&&!url.hash&&/^\/assets\/[\w.-]+-[\w-]{8,}\.(?:js|css|woff2)$/.test(url.pathname)
  }
  const first=async request=>{
    let cache
    try{cache=await worker.caches.open(name);const hit=await cache.match(request);if(hit)return {response:hit}}catch{}
    const response=await worker.fetch(request)
    const type=response.headers.get('content-type')??''
    if(!cache||response.status!==200||response.redirected||!/(?:javascript|text\/css|font\/woff2)/i.test(type)||
      /(?:^|,)\s*no-store\b/i.test(response.headers.get('cache-control')??'')||/(?:\*|\bcookie\b|\bauthorization\b)/i.test(response.headers.get('vary')??''))return {response}
    const copy=response.clone()
    const saved=writes=writes.then(async()=>{
      if(inactive)return
      await cache.put(request,copy)
      const keys=await cache.keys()
      for(const key of keys.slice(0,Math.max(0,keys.length-32)))await cache.delete(key)
    }).catch(()=>{})
    return {response,saved}
  }
  worker.addEventListener('install',event=>event.waitUntil(worker.skipWaiting()))
  worker.addEventListener('activate',event=>event.waitUntil((async()=>{
    try{for(const key of await worker.caches.keys())if(key.startsWith(prefix)&&key!==name)await worker.caches.delete(key)}catch{}
    await worker.clients.claim()
  })()))
  worker.addEventListener('fetch',event=>{
    if(event.request.mode==='navigate'){
      // A disabled/uninstalled plugin removes this public route. This probe is
      // independent of the document request; it never serves or caches HTML.
      event.waitUntil(worker.fetch(new URL('/ds-bot-mobile-web-worker.js',worker.location.origin),{method:'HEAD',cache:'no-store',credentials:'omit'}).then(response=>{if([404,410].includes(response.status))return retire()}).catch(()=>{}))
      return
    }
    if(!eligible(event.request))return
    const result=first(event.request)
    event.respondWith(result.then(value=>value.response))
    event.waitUntil(result.then(value=>value.saved).catch(()=>{}))
  })
  worker.addEventListener('message',event=>{
    if(event.data?.type==='ds-bot-mobile-web/retire'){
      event.waitUntil(retire().then(()=>event.ports?.[0]?.postMessage('retired')))
      return
    }
    if(event.data?.type!=='ds-bot-mobile-web/warm'||!Array.isArray(event.data.paths))return
    event.waitUntil((async()=>{
      for(const path of event.data.paths.slice(0,8)){
        if(typeof path!=='string')continue
        try{const request=new Request(new URL(path,worker.location.origin),{credentials:'omit'});if(eligible(request)){const result=await first(request);await result.saved}}catch{}
      }
    })())
  })
}

// Registration follows the completed first load, so warming never competes
// with startup. A different application's service worker keeps its scope.
function boot(paths){
  const enabledNow=()=>{try{return localStorage.getItem('dsh-mobile-layout-local.enabled')!=='false'}catch{return true}}
  const mobileNow=()=>matchMedia('(max-width:767px), (max-width:1024px) and (max-height:500px)').matches
  const enabled=enabledNow(),mobile=mobileNow()
  if(!enabled){void clearMobileAssetCache(window);return}
  if(!mobile)return
  const html=document.documentElement
  html.dataset.dsmBoot='true'
  html.dataset.dsmBootMessage='正在连接你的电脑…'
  const observer=new MutationObserver(()=>{
    const root=document.getElementById('root')
    if(root&&[...root.children].some(child=>child.id!=='dsm-boot')){
      delete html.dataset.dsmBoot;delete html.dataset.dsmBootMessage;observer.disconnect()
    }
  })
  observer.observe(html,{childList:true,subtree:true})
  setTimeout(()=>{if(html.dataset.dsmBoot)html.dataset.dsmBootMessage='连接耗时较长，请确认电脑和 Tailscale 在线。'},15000)
  if(!isSecureContext||!('serviceWorker' in navigator))return
  const start=()=>setTimeout(()=>{
    if(document.hidden||!enabledNow()||!mobileNow())return
    void (async()=>{
      const script=new URL('/ds-bot-mobile-web-worker.js',location.origin).href
      const existing=await navigator.serviceWorker.getRegistration('/')
      if([existing?.active,existing?.waiting,existing?.installing].some(owner=>owner&&owner.scriptURL!==script))return
      const registration=await navigator.serviceWorker.register(script,{scope:'/',updateViaCache:'none'})
      if(!enabledNow()||!mobileNow()){await clearMobileAssetCache(window);return}
      const ready=await navigator.serviceWorker.ready
      if(ready.scope!==registration.scope||ready.active?.scriptURL!==script)return
      if(document.hidden||!enabledNow()||!mobileNow()){if(!enabledNow())await clearMobileAssetCache(window);return}
      if(!navigator.connection?.saveData)ready.active.postMessage({type:'ds-bot-mobile-web/warm',paths})
    })().catch(()=>{})
  },5000)
  if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true})
}

export function renderMobileStartup(html){
  if(html.includes('id="dsm-boot"'))return html
  const paths=[...new Set([...html.matchAll(/(?:src|href)=["']((?:\.\/|\/)assets\/[\w.-]+-[\w-]{8,}\.(?:js|css|woff2))["']/g)].map(match=>'/'+match[1].replace(/^\.?\//,'')))]
  const shell='<div id="dsm-boot" role="status" aria-label="正在连接你的电脑"></div>'
  const style='<style>html[data-dsm-boot]::before{content:"DS Bot\\a" attr(data-dsm-boot-message);white-space:pre-line;position:fixed;inset:0;display:grid;place-content:center;gap:12px;padding:32px;box-sizing:border-box;z-index:2147483646;pointer-events:none;background:#fff;color:#555;font:18px/2 -apple-system,BlinkMacSystemFont,sans-serif;text-align:center}@media(prefers-color-scheme:dark){html[data-dsm-boot]::before{background:#141414;color:#ddd}}</style>'
  // createRoot replaces this temporary child on the first real render.
  return html.replace(/<head(?:\s[^>]*)?>/i,open=>open+style+`<script>(()=>{const clearMobileAssetCache=(${clearMobileAssetCache.toString()});(${boot.toString()})(${JSON.stringify(paths)});})();</script>`).replace(/(<div\s+id=["']root["'][^>]*>)\s*(<\/div>)/i,(_,open,close)=>open+shell+close)
}

export function applyWebStartup(ctx){
  if(typeof ctx.webServer?.tapIndex!=='function')return
  ctx.effect(()=>ctx.webServer.tapIndex(renderMobileStartup))
  ctx.effect(()=>ctx.webServer.register({kind:'exact',path:WORKER_PATH,handler(request,response){
    const headers={'content-type':'text/javascript; charset=utf-8','cache-control':'no-store','service-worker-allowed':'/','x-content-type-options':'nosniff'}
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{...headers,allow:'GET, HEAD'});response.end();return}
    response.writeHead(200,headers)
    response.end(request.method==='HEAD'?undefined:`(${installAssetWorker.toString()})(self);`)
  }}))
}
