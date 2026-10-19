import {readFileSync} from 'node:fs'

export const MOBILE_MANIFEST_PATH='/ds-bot-mobile-web.webmanifest'
export const ICON_DIRECTORY='/ds-bot-mobile-web-icon/'

// iOS snapshots the Home Screen icon and status-bar style when the user taps
// "Add to Home Screen", so both must already be present in the served
// document. iOS ignores SVG icons, and a `default` status bar paints an opaque
// strip that cannot follow the page theme.
export const ICONS=[
  {file:'apple-touch-icon.png',size:180,mime:'image/png'},
  {file:'icon-192.png',size:192,mime:'image/png'},
  {file:'icon-512.png',size:512,mime:'image/png'},
]

const iconLink=icon=>`<link rel="apple-touch-icon" sizes="${icon.size}x${icon.size}" href="${ICON_DIRECTORY}${icon.file}">`

export function appleTouchIconMarkup(){
  return ICONS.filter(icon=>icon.file==='apple-touch-icon.png').map(iconLink).join('')
}

export function renderMobileManifest(html){
  const withManifest=html.replace(/<link\b(?=[^>]*\brel\s*=\s*["']manifest["'])[^>]*>/i,
    link=>link.replace(/\bhref\s*=\s*(["']).*?\1/i,`href="${MOBILE_MANIFEST_PATH}"`))
  const links=appleTouchIconMarkup()
  // A host-provided apple-touch-icon may be an SVG (ignored by iOS) or point at
  // a path this plugin does not serve, so replace any it declares instead of
  // adding a second, competing icon the system might prefer.
  if(/<link\b(?=[^>]*\brel\s*=\s*["']apple-touch-icon["'])[^>]*>/i.test(withManifest))
    return withManifest.replace(/(?:<link\b(?=[^>]*\brel\s*=\s*["']apple-touch-icon["'])[^>]*>\s*)+/gi,links)
  return withManifest.replace(/(<link\b(?=[^>]*\brel\s*=\s*["']manifest["'])[^>]*>)/i,`${links}$1`)
}

export function mobileManifest(){
  return {
    name:'DS Bot',
    short_name:'DS Bot',
    id:'/',
    start_url:'/',
    scope:'/',
    display:'standalone',
    background_color:'#ffffff',
    theme_color:'#ffffff',
    icons:ICONS.map(icon=>({src:`${ICON_DIRECTORY}${icon.file}`,sizes:`${icon.size}x${icon.size}`,type:icon.mime,purpose:'any'})),
  }
}

function readIcon(file){
  return readFileSync(new URL(`./icons/${file}`,import.meta.url))
}

export function applyMobileManifest(ctx){
  if(typeof ctx.webServer?.tapIndex!=='function'||typeof ctx.webServer?.register!=='function')return
  const loaded=new Map(ICONS.map(icon=>[icon.file,readIcon(icon.file)]))
  ctx.effect(()=>ctx.webServer.tapIndex(renderMobileManifest))
  ctx.effect(()=>ctx.webServer.register({kind:'exact',path:MOBILE_MANIFEST_PATH,handler(request,response){
    const headers={'content-type':'application/manifest+json; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff'}
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{...headers,allow:'GET, HEAD'});response.end();return}
    response.writeHead(200,headers)
    response.end(request.method==='HEAD'?undefined:JSON.stringify(mobileManifest()))
  }}))
  for(const icon of ICONS){
    ctx.effect(()=>ctx.webServer.register({kind:'exact',path:`${ICON_DIRECTORY}${icon.file}`,handler(request,response){
      const headers={'content-type':icon.mime,'cache-control':'public, max-age=604800','x-content-type-options':'nosniff'}
      if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{...headers,allow:'GET, HEAD'});response.end();return}
      const bytes=loaded.get(icon.file)
      response.writeHead(200,{...headers,'content-length':String(bytes.length)})
      response.end(request.method==='HEAD'?undefined:bytes)
    }}))
  }
}
