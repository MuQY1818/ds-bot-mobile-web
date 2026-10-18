import {createElement as h,useEffect,useRef,useState,useSyncExternalStore} from 'react'
import {createPortal} from 'react-dom'
import QRCode from 'qrcode/lib/core/qrcode.js'
import {phoneStatusText} from './phone-controller.mjs'

export function PhoneIcon(){return h('svg',{viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},h('rect',{x:6,y:2.5,width:12,height:19,rx:3}),h('path',{d:'M10 18h4'}))}
export function phoneQr(value){
  const code=QRCode.create(value,{errorCorrectionLevel:'M'}),size=code.modules.size,parts=[]
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(code.modules.get(y,x))parts.push(`M${x+4} ${y+4}h1v1h-1z`)
  return {size:size+8,path:parts.join('')}
}
function Qr({value}){
  const qr=phoneQr(value)
  return h('svg',{className:'dsm-phone-qr',viewBox:`0 0 ${qr.size} ${qr.size}`,width:224,height:224,role:'img','aria-label':'手机登录二维码',shapeRendering:'crispEdges'},h('rect',{width:'100%',height:'100%',fill:'#fff'}),h('path',{d:qr.path,fill:'#000'}))
}

export function AccountPhoneEntry({phone}){
  const [container,setContainer]=useState(null)
  useEffect(()=>{
    let owned
    const sync=()=>{
      const menu=document.querySelector('.bt-account-menu')
      if(owned?.parentElement===menu)return
      owned?.remove();owned=undefined;setContainer(null)
      if(!menu)return
      owned=document.createElement('div');owned.dataset.dsmPhoneEntry='true';owned.style.display='contents'
      menu.insertBefore(owned,menu.querySelector('[role=separator]'))
      setContainer(owned)
    }
    // DS Bot currently has no menu-item slot. Its account menu is a body portal;
    // observe that boundary only, without watching streamed conversation content.
    const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true});sync()
    return()=>{observer.disconnect();owned?.remove()}
  },[])
  if(!container)return null
  return createPortal(h('button',{type:'button',role:'menuitem',className:'dsm-menu-phone',onClick:()=>{
    document.querySelector('.bt-account[aria-expanded=true]')?.click();phone.open()
  }},h(PhoneIcon),h('span',{className:'bt-menu-label'},'手机访问')),container)
}

export function PhoneDialog({phone}){
  const state=useSyncExternalStore(phone.subscribe,phone.snapshot,phone.snapshot)
  const form=useSyncExternalStore(listener=>phone.form.subscribe(listener),()=>phone.form.getSnapshot(),()=>phone.form.getSnapshot())
  const [editing,setEditing]=useState(false),[address,setAddress]=useState(''),[saving,setSaving]=useState(false)
  const root=useRef(null),close=useRef(null),restoreFocus=useRef(null)
  useEffect(()=>{
    if(!state.open)return
    restoreFocus.current=document.activeElement;setEditing(false);setAddress(form.value?.phoneUrl??'')
    close.current?.focus()
    const key=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();phone.close();return}
      if(event.key!=='Tab')return
      const controls=[...root.current.querySelectorAll('button:not([disabled]),input,textarea,a[href],summary,[tabindex]:not([tabindex="-1"])')].filter(node=>node.getClientRects().length)
      const first=controls[0],last=controls.at(-1)
      if(!root.current.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first)?.focus()}
      else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }
    document.addEventListener('keydown',key,true)
    return()=>{document.removeEventListener('keydown',key,true);const prior=restoreFocus.current;if(prior?.isConnected&&prior!==document.body)prior.focus();else document.querySelector('.bt-account')?.focus()}
  },[state.open,phone])
  useEffect(()=>{if(state.open&&root.current&&!root.current.contains(document.activeElement))close.current?.focus()},[state.open,state.loading,state.status,editing])
  if(!state.open)return null
  const ready=state.status==='ready'&&Boolean(state.loginUrl),configure=editing||(!ready&&!state.loading&&['not-configured','local-only','invalid-url','needs-https','not-trusted'].includes(state.status))
  const save=async event=>{event.preventDefault();setSaving(true);const ok=await phone.configure(address);setSaving(false);if(ok)setEditing(false)}
  return h('div',{className:'dsm-phone-backdrop',onMouseDown:event=>{if(event.target===event.currentTarget)phone.close()}},
    h('section',{ref:root,className:'dsm-phone-dialog',role:'dialog','aria-modal':true,'aria-labelledby':'dsm-phone-heading'},
      h('header',null,h('div',{className:'dsm-phone-heading'},h(PhoneIcon),h('h1',{id:'dsm-phone-heading'},'手机访问')),h('button',{ref:close,type:'button',className:'dsm-phone-close','aria-label':'关闭手机访问',onClick:()=>phone.close()},'×')),
      h('p',{className:'dsm-phone-intro'},'在手机上接着聊，继续使用同一支 Bot 团队。'),
      h('div',{className:'dsm-phone-status',role:'status','data-ready':ready},h('span',{'aria-hidden':true}),state.loading?'正在读取入口…':ready?'登录入口已就绪':'手机入口尚未就绪'),
      ready?h('div',{className:'dsm-phone-ready'},h(Qr,{value:state.loginUrl}),h('p',{className:'dsm-phone-scan'},'用手机相机扫描，在浏览器中打开。'),h('p',{className:'dsm-phone-address'},state.baseUrl),
        h('button',{type:'button',className:'dsm-phone-primary',onClick:()=>phone.copy(navigator.clipboard)},state.copied?'已复制登录链接':'复制登录链接'),
        h('details',{className:'dsm-phone-manual'},h('summary',null,'手动复制登录链接'),h('textarea',{'aria-label':'手机登录链接',readOnly:true,value:state.loginUrl,onFocus:event=>event.target.select()})),
        h('div',{className:'dsm-phone-actions'},h('button',{type:'button',onClick:()=>phone.refresh()},'刷新入口'),h('button',{type:'button',onClick:()=>{setAddress(form.value?.phoneUrl??state.baseUrl);setEditing(value=>!value)}},'修改地址'))):
        h('p',{className:'dsm-phone-help'},state.loading?'请保持电脑和手机联网。':phoneStatusText(state.status)),
      configure?h('form',{className:'dsm-phone-config',onSubmit:save},h('label',{htmlFor:'dsm-phone-url'},'手机访问地址'),h('input',{id:'dsm-phone-url',type:'url',value:address,onChange:event=>setAddress(event.target.value),placeholder:'https://dsh.example.com/',autoComplete:'off',spellCheck:false,required:true}),h('p',null,'填写已配置且受宿主信任的 HTTPS 入口。这里只保存地址，不会开放端口或建立隧道。'),h('button',{type:'submit',disabled:saving||form.status!=='ready'||!form.writable},saving?'正在保存…':'保存并检查')):null,
      state.error?h('p',{className:'dsm-phone-error',role:'alert'},state.error):null,
      h('footer',null,h('p',null,'登录链接包含访问权限，请只发给自己。宿主重启后重新打开此面板获取。'),h('p',null,'电脑需保持运行；使用私网入口时，手机也要连接对应私网。')),
    ))
}

export function PhoneAccess({phone}){return h('div',null,h(AccountPhoneEntry,{phone}),h(PhoneDialog,{phone}))}
