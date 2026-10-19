import {installMobileBrowserAppearance} from './web-appearance.mjs'

export const WORKER_PATH='/ds-bot-mobile-web-worker.js'

// Only version-addressed public executable resources. In particular, a query
// string is accepted solely for DSH's exact immutable plugin-code protocol.
export function versionedCodeKind(value,origin){
  let url
  try{url=new URL(value,origin)}catch{return undefined}
  if(url.origin!==origin||url.hash||url.username||url.password)return undefined
  if(!url.search&&/^\/assets\/[\w.-]+-[\w-]{8,}\.(?:js|css|woff2)$/.test(url.pathname))return 'core'
  const entry='(?:@[\\w.-]+/)?[\\w.-]+/client\\.js'
  if(url.pathname==='/plugins/'&&url.search.length<=3072&&new RegExp('^\\?\\?'+entry+'(?:,'+entry+')*&rev=[a-f0-9]{12}$').test(url.search))return 'plugin'
  if(/^\/plugins\/(?:@[\w.-]+\/)?[\w.-]+\/client\.[\w.-]+\.js$/.test(url.pathname)&&/^\?rev=[a-f0-9]{12}$/.test(url.search))return 'plugin'
  return undefined
}

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
export function installAssetWorker(worker,resourceKind=versionedCodeKind){
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
      Boolean(resourceKind(url.href,worker.location.origin))
  }
  const first=async request=>{
    let cache
    try{cache=await worker.caches.open(name);const hit=await cache.match(request);if(hit)return {response:hit}}catch{}
    const response=await worker.fetch(request)
    const type=response.headers.get('content-type')??''
    const policy=response.headers.get('cache-control')??''
    // Plugin bytes may be very large. Only the host's explicitly public,
    // immutable code responses can become durable browser assets.
    const plugin=resourceKind(request.url,worker.location.origin)==='plugin'
    if(plugin&&(!/(?:^|,)\s*public\b/i.test(policy)||!/(?:^|,)\s*immutable\b/i.test(policy)||/(?:^|,)\s*private\b/i.test(policy)))return {response}
    if(!cache||response.status!==200||response.redirected||!/(?:javascript|text\/css|font\/woff2)/i.test(type)||
      /(?:^|,)\s*no-store\b/i.test(policy)||/(?:\*|\bcookie\b|\bauthorization\b)/i.test(response.headers.get('vary')??''))return {response}
    const copy=response.clone()
    const saved=writes=writes.then(async()=>{
      if(inactive)return
      await cache.put(request,copy)
      const keys=await cache.keys()
      for(const key of keys.slice(0,Math.max(0,keys.length-16)))await cache.delete(key)
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
      for(const path of event.data.paths.slice(0,12)){
        if(typeof path!=='string')continue
        try{const request=new Request(new URL(path,worker.location.origin),{credentials:'omit',cache:'force-cache'});if(eligible(request)){const result=await first(request);await result.saved}}catch{}
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
  const message=text=>{
    html.dataset.dsmBootMessage=text
    const label=document.querySelector('#dsm-boot [data-dsm-boot-message]')
    if(label&&label.textContent!==text)label.textContent=text
  }
  html.dataset.dsmBoot='true'
  message('正在打开 DS Bot…')
  let finished=false,active,warmed=false,cancelIdle
  const warm=()=>{
    if(warmed||!finished||!active||document.hidden||!enabledNow()||!mobileNow()||navigator.connection?.saveData)return
    warmed=true
    const run=()=>{
      cancelIdle=undefined
      if(document.hidden||!enabledNow()||!mobileNow())return
      const loaded=[...document.querySelectorAll('script[src],link[rel=preload],link[rel=modulepreload],link[rel=stylesheet]')].map(node=>node.src||node.href)
      const resources=performance.getEntriesByType('resource').map(entry=>entry.name)
      const urls=[...new Set([...paths,...loaded,...resources].filter(value=>versionedCodeKind(value,location.origin)).map(value=>{const url=new URL(value,location.origin);return url.pathname+url.search}))]
      active.postMessage({type:'ds-bot-mobile-web/warm',paths:urls})
    }
    if(window.requestIdleCallback){const id=window.requestIdleCallback(run,{timeout:3000});cancelIdle=()=>window.cancelIdleCallback(id)}
    else{const id=setTimeout(run,400);cancelIdle=()=>clearTimeout(id)}
  }
  const cleanup=()=>{
    delete html.dataset.dsmBoot;delete html.dataset.dsmBootMessage
    document.getElementById('dsm-boot')?.remove()
  }
  const finish=()=>{
    if(finished)return
    finished=true;observer.disconnect();clearTimeout(slow);clearTimeout(fallback)
    if(matchMedia('(prefers-reduced-motion:reduce)').matches)cleanup()
    else{html.dataset.dsmBoot='leaving';setTimeout(cleanup,180)}
    warm()
  }
  const check=()=>{
    if(html.dataset.dsmReady==='true'||!enabledNow()||!mobileNow())finish()
    else if(!finished)message(html.dataset.dsmBootMessage)
  }
  // A root child may only be the host's empty frame. Wait for the mobile
  // navigation and its first roster/error state rather than flashing it early.
  const observer=new MutationObserver(check)
  observer.observe(html,{childList:true,subtree:true,attributes:true,attributeFilter:['data-dsm-ready']})
  const slow=setTimeout(()=>{if(!finished)message('连接较慢，正在等待电脑…')},10000)
  const fallback=setTimeout(()=>{if(document.getElementById('root')?.childElementCount)finish()},20000)
  check()
  if(!isSecureContext||!('serviceWorker' in navigator))return
  const claimed=()=>{
    const next=navigator.serviceWorker.controller
    if(next?.scriptURL!==new URL('/ds-bot-mobile-web-worker.js',location.origin).href||next===active)return
    cancelIdle?.();cancelIdle=undefined;active=next;warmed=false;warm()
  }
  // ready may resolve with the previous active worker while an update installs.
  // Warm again after the new worker claims the page so upgrades also cache code.
  navigator.serviceWorker.addEventListener('controllerchange',claimed)
  const start=()=>{
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
      active=ready.active;warm()
    })().catch(()=>{})
  }
  if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true})
  window.addEventListener('pagehide',()=>{cancelIdle?.();navigator.serviceWorker.removeEventListener('controllerchange',claimed)},{once:true})
}

export function renderMobileStartup(html){
  if(/\bid\s*=\s*(["'])dsm-boot\1/i.test(html))return html
  // The host's module scripts precede its viewport meta. Establish the same
  // viewport first so a phone is not measured as the default 980px desktop.
  const originalViewport=html.match(/<meta\b(?=[^>]*\bname\s*=\s*["']viewport["'])[^>]*>/i)?.[0]??''
  if(originalViewport)html=html.replace(originalViewport,'')
  const viewport=originalViewport&&!/viewport-fit\s*=/i.test(originalViewport)?originalViewport.replace(/(\bcontent\s*=\s*)(["'])(.*?)\2/i,(_,name,quote,content)=>name+quote+content+', viewport-fit=cover'+quote):originalViewport||'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  const paths=[...new Set([...html.matchAll(/(?:src|href)=["']((?:\.\/|\/)assets\/[\w.-]+-[\w-]{8,}\.(?:js|css|woff2))["']/g)].map(match=>'/'+match[1].replace(/^\.?\//,'')))]
  const shell='<div id="dsm-boot" role="status" aria-live="polite" aria-atomic="true"><span class="dsm-boot-spinner" aria-hidden="true"></span><p data-dsm-boot-message>正在打开 DS Bot…</p></div>'
  const style=`<style>
html[data-dsm-boot]{--dsm-boot-bg:#fff;--dsm-boot-ink:#666;--dsm-boot-ring:#e9e9e9;--dsm-boot-active:#202020}
#dsm-boot{display:none;position:fixed;inset:0;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:24px;box-sizing:border-box;z-index:2147483647;background:var(--dsm-boot-bg);color:var(--dsm-boot-ink);font:14px/1.6 -apple-system,BlinkMacSystemFont,sans-serif;text-align:center;opacity:1;transition:opacity 180ms ease-out}
#dsm-boot .dsm-boot-spinner{display:block;flex:none;width:34px;height:34px;box-sizing:border-box;border:2.5px solid var(--dsm-boot-ring);border-top-color:var(--dsm-boot-active);border-radius:50%;animation:dsm-start-spin 850ms linear infinite}
#dsm-boot [data-dsm-boot-message]{margin:0;font:inherit;color:inherit}
html[data-dsm-boot=leaving] #dsm-boot{opacity:0;pointer-events:none}
@media(max-width:767px),(max-width:1024px) and (max-height:500px){html[data-dsm-boot] #dsm-boot{display:flex}}
@keyframes dsm-start-spin{to{transform:rotate(360deg)}}
@media(prefers-color-scheme:dark){html[data-dsm-boot]{--dsm-boot-bg:#141414;--dsm-boot-ink:#aaa;--dsm-boot-ring:#343434;--dsm-boot-active:#e5e5e5}}
html[data-ds-theme-source=light][data-dsm-boot]{--dsm-boot-bg:#fff;--dsm-boot-ink:#666;--dsm-boot-ring:#e9e9e9;--dsm-boot-active:#202020}
html[data-ds-theme-source=dark][data-dsm-boot]{--dsm-boot-bg:#141414;--dsm-boot-ink:#aaa;--dsm-boot-ring:#343434;--dsm-boot-active:#e5e5e5}
@media(prefers-reduced-motion:reduce){#dsm-boot{transition:none}#dsm-boot .dsm-boot-spinner{animation:none}}
</style>`
  // The loading surface belongs to the document, outside React's replaceable root.
  // iOS resolves the status-bar style at launch and ignores a later script
  // rewrite, so the served document has to carry the final value. `default`
  // paints an opaque strip from the *system* appearance, which is why a dark
  // app on a light phone got a white bar. `black-translucent` is the only value
  // that lets the page background reach the bar so the glyphs follow the theme.
  const browserMeta='<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="theme-color" content="#ffffff"><meta name="color-scheme" content="light dark">'
  const appearance=`<script>window[Symbol.for('ds-bot-mobile-web/browser-appearance')]=(${installMobileBrowserAppearance.toString()})(window);</script>`
  return html.replace(/<head(?:\s[^>]*)?>/i,open=>open+viewport+browserMeta+appearance+style+`<script>(()=>{const clearMobileAssetCache=(${clearMobileAssetCache.toString()});const versionedCodeKind=(${versionedCodeKind.toString()});(${boot.toString()})(${JSON.stringify(paths)});})();</script>`).replace(/<body\b(?:[^>"']|"[^"]*"|'[^']*')*>/i,open=>open+shell)
}

export function applyWebStartup(ctx){
  if(typeof ctx.webServer?.tapIndex!=='function')return
  ctx.effect(()=>ctx.webServer.tapIndex(renderMobileStartup))
  ctx.effect(()=>ctx.webServer.register({kind:'exact',path:WORKER_PATH,handler(request,response){
    const headers={'content-type':'text/javascript; charset=utf-8','cache-control':'no-store','service-worker-allowed':'/','x-content-type-options':'nosniff'}
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{...headers,allow:'GET, HEAD'});response.end();return}
    response.writeHead(200,headers)
    response.end(request.method==='HEAD'?undefined:`(${installAssetWorker.toString()})(self,${versionedCodeKind.toString()});`)
  }}))
}
