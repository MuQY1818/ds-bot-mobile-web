const messages={
  'not-configured':'先设置手机可访问的 HTTPS 地址。插件会沿用现有入口，不创建隧道。',
  'local-only':'当前是电脑本机地址，手机无法访问。请填写已配置的私网或 HTTPS 入口。',
  'invalid-url':'请填写不含登录凭据的完整 HTTPS 地址。',
  'needs-https':'登录链接需要 HTTPS 入口，可使用现有 Tailscale 或 HTTPS 代理。',
  'not-trusted':'此地址尚未加入宿主信任列表。先完成宿主的精确域名信任配置，再刷新入口。',
  'local-computer-required':'请在电脑本机的 DS Bot 页面打开此面板，手机端不能生成其他设备的登录链接。',
  'authentication-required':'当前登录已失效，请从宿主提供的登录入口重新进入。',
  unavailable:'暂时无法取得登录入口，请确认宿主和手机访问服务已启用。',
}
export const phoneStatusText=status=>messages[status]??messages.unavailable
export function cleanPhoneUrl(value){
  const url=new URL(value.trim())
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('invalid-url')
  if(!url.pathname.endsWith('/'))url.pathname+='/'
  return url.href
}
export function createPhoneController({appRoot,form,fetchImpl=fetch}){
  const listeners=new Set()
  let state={open:false,loading:false,status:'not-configured',baseUrl:'',loginUrl:'',error:'',copied:false}
  let request,serial=0,disposed=false
  const publish=patch=>{if(disposed)return;state={...state,...patch};for(const listener of listeners)listener()}
  async function refresh(url){
    const issued=++serial
    request?.abort();request=new AbortController();const current=request
    publish({loading:true,error:'',copied:false,loginUrl:''})
    try{
      const response=await fetchImpl(new URL('api/dsh-mobile-layout/phone-access',appRoot),{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({action:'login',...(url?{url}:{})}),signal:current.signal})
      const value=await response.json()
      if(disposed||issued!==serial||current.signal.aborted)return
      const status=typeof value.status==='string'?value.status:'unavailable'
      if(status==='ready'){
        const base=cleanPhoneUrl(value.baseUrl),login=new URL(value.loginUrl)
        if(login.origin!==new URL(base).origin||login.pathname!==new URL(base).pathname||login.username||login.password||login.hash||login.searchParams.getAll('token').length!==1||!login.searchParams.get('token')||[...login.searchParams.keys()].some(key=>key!=='token'))throw Error('unavailable')
        publish({status,baseUrl:base,loginUrl:login.href,loading:false})
      }else publish({status,baseUrl:'',loginUrl:'',loading:false})
    }catch(error){if(!disposed&&issued===serial&&!current.signal.aborted)publish({status:'unavailable',loading:false,loginUrl:'',error:'无法读取手机入口，请确认电脑连接后重试。'})}
  }
  return {
    snapshot:()=>state,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},form,
    open(){publish({open:true});void refresh()},refresh,
    close(){serial++;request?.abort();publish({open:false,loading:false,loginUrl:'',copied:false,error:''})},
    async configure(value){
      const issued=serial
      let url
      try{url=cleanPhoneUrl(value)}catch{publish({error:phoneStatusText('invalid-url')});return false}
      try{
        const saved=await form.set('phoneUrl',url)
        if(disposed||issued!==serial||!state.open)return saved
        if(!saved){publish({error:'地址未保存，请确认宿主允许修改该插件设置。'});return false}
      }catch{if(!disposed&&issued===serial&&state.open)publish({error:'地址未保存，请检查电脑连接后重试。'});return false}
      await refresh(url)
      return true
    },
    async copy(clipboard){
      const value=state.loginUrl
      if(!value)return false
      try{await clipboard.writeText(value);if(!disposed&&state.open&&state.loginUrl===value)publish({copied:true,error:''});return true}
      catch{if(!disposed)publish({error:'浏览器未允许复制。可选中下方登录链接后手动复制。'});return false}
    },
    dispose(){disposed=true;serial++;request?.abort();state={...state,open:false,loginUrl:''};listeners.clear()},
  }
}
