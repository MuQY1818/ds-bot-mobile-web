export const name='ds-bot-mobile-startup-diagnostics'
export const inject=['connection','webServer']
export const PATH='/api/ds-bot-mobile-startup-diagnostics'
const loopback=value=>/^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(value)
const local=address=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)
const fields=['at','bootstrap','enabled','root','ready','dom','load','lag','navStart','dns','connect','tls','ttfb','htmlEnd','redirects','cacheCore','cachePlugin','widthAtBoot','widthAtReport']
const flags=['standalone','secure','workerSupport','controlled','cacheKnown','mobileAtBoot','mobileAtReport','animationSeen']
const resourceFields=['start','request','response','end','worker','transfer','encoded','decoded']
export function validReport(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false
  const keys=['page','phase',...flags,...fields,'resources']
  if(Object.keys(value).some(key=>!keys.includes(key))||!/^[a-f0-9]{16}$/.test(value.page)||!['loaded','ready','timeout','leaving'].includes(value.phase))return false
  if(flags.some(key=>typeof value[key]!=='boolean'))return false
  if(fields.some(key=>!Number.isFinite(value[key])||value[key]<-1||value[key]>600000))return false
  if(!Array.isArray(value.resources)||value.resources.length>48)return false
  return value.resources.every(row=>row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).length===resourceFields.length+1&&
    ['core','plugin','bot-api','api'].includes(row.kind)&&resourceFields.every(key=>Number.isFinite(row[key])&&row[key]>=0&&row[key]<=300000000)&&
    Object.keys(row).every(key=>key==='kind'||resourceFields.includes(key)))
}

// This optional probe never reads application state, cookies or request bodies.
// URLs are classified locally and discarded before a report is constructed.
export function captureStartup(){
  const mobileNow=()=>matchMedia('(max-width:767px), (max-width:1024px) and (max-height:500px)').matches
  const mobileAtBoot=mobileNow(),widthAtBoot=innerWidth
  let animationSeen=false
  const started=performance.now(),marks={bootstrap:started,enabled:-1,root:-1,ready:-1,dom:-1,load:-1,lag:0}
  const page=[...crypto.getRandomValues(new Uint8Array(8))].map(x=>x.toString(16).padStart(2,'0')).join('')
  const round=value=>Number.isFinite(value)?Math.round(value*10)/10:0
  const resources=new Map()
  const kindOf=value=>{
    try{const u=new URL(value,location.origin);if(u.origin!==location.origin)return
      if(u.pathname.startsWith('/assets/')&&/\.(js|css|woff2)$/.test(u.pathname))return 'core'
      if(u.pathname.startsWith('/plugins/'))return 'plugin'
      if(u.pathname==='/api/bot')return 'bot-api'
      if(u.pathname.startsWith('/api/')&&u.pathname!=='/api/ds-bot-mobile-startup-diagnostics')return 'api'
    }catch{}
  }
  const collect=entries=>{for(const entry of entries){const kind=kindOf(entry.name);if(!kind||resources.size>=48)continue
    resources.set(entry.name+':'+entry.startTime,{kind,start:round(entry.startTime),request:round(entry.requestStart),response:round(entry.responseStart),end:round(entry.responseEnd),worker:round(entry.workerStart),transfer:round(entry.transferSize),encoded:round(entry.encodedBodySize),decoded:round(entry.decodedBodySize)})}}
  let resourceObserver
  try{resourceObserver=new PerformanceObserver(list=>collect(list.getEntries()));resourceObserver.observe({type:'resource',buffered:true})}catch{}
  let sent=0,stopped=false,expected=performance.now()+100
  const pulse=setInterval(()=>{const now=performance.now();marks.lag=Math.max(marks.lag,now-expected);expected=now+100},100)
  const cacheState=async()=>{
    let known=false,core=0,plugin=0
    try{for(const key of await caches.keys()){if(!key.startsWith('ds-bot-mobile-web-assets-'))continue;known=true
      for(const request of await (await caches.open(key)).keys()){const kind=kindOf(request.url);if(kind==='core')core++;if(kind==='plugin')plugin++}}}catch{}
    return {cacheKnown:known,cacheCore:core,cachePlugin:plugin}
  }
  const report=async phase=>{
    if(sent++>=4)return
    collect(performance.getEntriesByType('resource'))
    const n=performance.getEntriesByType('navigation')[0]
    const payload={page,phase,at:round(performance.now()),...Object.fromEntries(Object.entries(marks).map(([key,value])=>[key,round(value)])),
      standalone:navigator.standalone===true||matchMedia('(display-mode:standalone)').matches,secure:isSecureContext,workerSupport:'serviceWorker' in navigator,
      mobileAtBoot,mobileAtReport:mobileNow(),widthAtBoot,widthAtReport:innerWidth,animationSeen,
      controlled:Boolean(navigator.serviceWorker?.controller),navStart:round(n?.startTime),dns:round((n?.domainLookupEnd||0)-(n?.domainLookupStart||0)),
      connect:round((n?.connectEnd||0)-(n?.connectStart||0)),tls:round(n?.secureConnectionStart?(n.connectEnd-n.secureConnectionStart):0),
      ttfb:round(n?.responseStart),htmlEnd:round(n?.responseEnd),redirects:round(n?.redirectCount),...await cacheState(),resources:[...resources.values()]}
    try{await fetch('/api/ds-bot-mobile-startup-diagnostics',{method:'POST',credentials:'same-origin',cache:'no-store',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify(payload)})}catch{}
  }
  const check=()=>{
    if(document.documentElement.dataset.dsmBoot)animationSeen=true
    if(marks.enabled<0&&document.body?.dataset.dsmEnabled==='true')marks.enabled=performance.now()
    if(marks.root<0&&document.getElementById('root')?.childElementCount)marks.root=performance.now()
    if(marks.ready<0&&document.documentElement.dataset.dsmReady==='true'){
      marks.ready=performance.now();observer.disconnect();clearInterval(pulse)
      requestAnimationFrame(()=>requestAnimationFrame(()=>void report('ready')))
    }
  }
  const observer=new MutationObserver(check)
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-dsm-ready','data-dsm-enabled','data-dsm-boot']})
  const stop=()=>{if(stopped)return;stopped=true;observer.disconnect();resourceObserver?.disconnect();clearInterval(pulse);clearTimeout(timeout)}
  const timeout=setTimeout(()=>{void report('timeout');stop()},30000)
  document.addEventListener('DOMContentLoaded',()=>{marks.dom=performance.now();check()},{once:true})
  window.addEventListener('load',()=>{marks.load=performance.now();void report('loaded')},{once:true})
  window.addEventListener('pagehide',()=>{void report('leaving');stop()},{once:true})
  check()
}

export function apply(ctx){
  const reports=[],headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff'}
  ctx.effect(()=>ctx.webServer.tapIndex(html=>{
    const script=`<script>(${captureStartup.toString()})();</script>`
    const viewport=/<meta\b(?=[^>]*\bname\s*=\s*["']viewport["'])[^>]*>/i
    return viewport.test(html)?html.replace(viewport,meta=>meta+script):html.replace(/<head(?:\s[^>]*)?>/i,open=>open+script)
  }))
  ctx.effect(()=>ctx.webServer.register({kind:'exact',path:PATH,async handler(request,response){
    const send=(status,value)=>{if(response.destroyed)return;response.writeHead(status,headers);response.end(JSON.stringify(value))}
    const admission=ctx.connection.admit(request)
    if('rejection' in admission){send(admission.rejection,{error:'authentication-required'});return}
    if(admission.peer!==ctx.connection.browserPeer){send(403,{error:'owner-required'});return}
    const host=request.headers.host??''
    let caller,origin
    try{caller=new URL(`${ctx.webServer.protocol??'http:'}//${host}`);if(request.headers.origin)origin=new URL(request.headers.origin)}catch{send(403,{error:'same-origin-required'});return}
    const localOwner=local(request.socket?.remoteAddress)&&loopback(caller.hostname)&&Number(caller.port||80)===ctx.webServer.port
    if(request.method==='GET'){
      if(!localOwner){send(403,{error:'local-owner-required'});return}
      send(200,{reports:reports.filter(row=>row.received>Date.now()-600000)});return
    }
    if(request.method!=='POST'){response.setHeader('allow','GET, POST');send(405,{error:'method-not-allowed'});return}
    if((!origin&&!localOwner)||(origin&&(!['http:','https:'].includes(origin.protocol)||origin.host!==caller.host))||request.headers['sec-fetch-site']==='cross-site'){
      send(403,{error:'same-origin-required'});return
    }
    if(!/^application\/json(?:;|$)/i.test(request.headers['content-type']??'')){send(415,{error:'invalid-report'});return}
    try{
      let body=''
      for await(const part of request){body+=part;if(Buffer.byteLength(body)>24576){send(413,{error:'invalid-report'});return}}
      const value=JSON.parse(body)
      if(!validReport(value)){send(400,{error:'invalid-report'});return}
      reports.push({received:Date.now(),...value});if(reports.length>20)reports.shift()
      send(200,{ok:true})
    }catch{send(400,{error:'invalid-report'})}
  }}))
}
