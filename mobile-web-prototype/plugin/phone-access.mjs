export const PHONE_PATH='/api/dsh-mobile-layout/phone-access'
const loopback=value=>{const host=value.toLowerCase().replace(/\.$/,'');return host==='localhost'||host==='[::1]'||host==='::1'||/^127(?:\.\d{1,3}){3}$/.test(host)}
const localSocket=address=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)

export function phoneDestination(value,connection){
  if(!value)return {status:'not-configured'}
  let url
  try{url=new URL(value)}catch{return {status:'invalid-url'}}
  if(url.username||url.password||url.search||url.hash||!['http:','https:'].includes(url.protocol))return {status:'invalid-url'}
  if(loopback(url.hostname))return {status:'local-only'}
  if(url.protocol!=='https:')return {status:'needs-https'}
  if(!url.pathname.endsWith('/'))url.pathname+='/'
  // A public URL is an announcement, not permission to issue credentials for it.
  const rejection=connection.requestRejection({headers:{host:url.host,origin:url.origin}})
  if(rejection!==401)return {status:'not-trusted'}
  return {status:'ready',baseUrl:url.href}
}

export function phoneReply({connection,webApp,config,body}){
  const requested=typeof body.url==='string'?body.url.trim():undefined
  const configured=typeof config.phoneUrl?.get==='function'?config.phoneUrl.get():config.phoneUrl
  const base=requested??(configured?.trim()||webApp?.getAdvertisedUrl?.()||'')
  const state=phoneDestination(base,connection)
  if(state.status!=='ready'||body.action!=='login')return state
  const baseUrl=new URL(state.baseUrl)
  const login=new URL(connection.authenticatedUrl(state.baseUrl))
  if(login.origin!==baseUrl.origin||login.pathname!==baseUrl.pathname||login.hash||login.username||login.password||
    login.searchParams.getAll('token').length!==1||!login.searchParams.get('token')||[...login.searchParams.keys()].some(key=>key!=='token')){
    return {status:'unavailable'}
  }
  return {...state,loginUrl:login.href}
}

export function applyPhoneAccess(ctx,config){
  if(!ctx.webServer)return
  ctx.effect(()=>ctx.webServer.register({kind:'exact',path:PHONE_PATH,async handler(request,response){
    const send=(status,value)=>{if(response.destroyed)return;response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY'});response.end(JSON.stringify(value))}
    const host=request.headers.host??''
    let caller
    try{caller=new URL(`${ctx.webServer.protocol??'http:'}//${host}`)}catch{send(403,{status:'local-computer-required'});return}
    // An HTTPS proxy can have a loopback socket; require its literal local Host too.
    if(!localSocket(request.socket?.remoteAddress)||!loopback(caller.hostname)||Number(caller.port||(caller.protocol==='https:'?443:80))!==ctx.webServer.port||request.headers.origin!==caller.origin){send(403,{status:'local-computer-required'});return}
    const admission=ctx.connection.admit(request)
    if('rejection' in admission){send(admission.rejection,{status:'authentication-required'});return}
    if(admission.peer!==ctx.connection.browserPeer){send(403,{status:'local-computer-required'});return}
    if(request.method!=='POST'){response.setHeader('allow','POST');send(405,{status:'method-not-allowed'});return}
    if(!/^application\/json(?:;|$)/i.test(request.headers['content-type']??'')){send(415,{status:'invalid-request'});return}
    try{
      let text=''
      for await(const part of request){text+=part;if(Buffer.byteLength(text)>2048){send(413,{status:'invalid-request'});return}}
      let body
      try{body=JSON.parse(text)}catch{send(400,{status:'invalid-request'});return}
      if(!body||typeof body!=='object'||Array.isArray(body)||!['status','login'].includes(body.action)||
        Object.keys(body).some(key=>!['action','url'].includes(key))||(body.url!==undefined&&typeof body.url!=='string')){send(400,{status:'invalid-request'});return}
      send(200,phoneReply({connection:ctx.connection,webApp:ctx.webApp,config,body}))
    }catch{send(503,{status:'unavailable'})}
  }}))
}
