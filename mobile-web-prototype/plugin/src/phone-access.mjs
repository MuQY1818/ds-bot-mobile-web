import {createElement as h,useEffect,useState,useSyncExternalStore} from 'react'
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

export function WebAccessPanel({phone}){
  const state=useSyncExternalStore(phone.subscribe,phone.snapshot,phone.snapshot)
  const form=useSyncExternalStore(listener=>phone.form.subscribe(listener),()=>phone.form.getSnapshot(),()=>phone.form.getSnapshot())
  const [editing,setEditing]=useState(false),[address,setAddress]=useState(()=>form.value?.phoneUrl??''),[saving,setSaving]=useState(false)
  useEffect(()=>{phone.open();return()=>phone.close()},[phone])
  const ready=state.status==='ready'&&Boolean(state.loginUrl),configure=editing||(!ready&&!state.loading&&['not-configured','local-only','invalid-url','needs-https','not-trusted'].includes(state.status))
  const save=async event=>{event.preventDefault();setSaving(true);const ok=await phone.configure(address);setSaving(false);if(ok)setEditing(false)}
  return h('section',{className:'dsm-phone-panel','aria-label':'Web 浏览器登录'},
    h('div',{className:'dsm-phone-status',role:'status','data-ready':ready},h('span',{'aria-hidden':true}),state.loading?'正在读取入口…':ready?'登录入口已就绪':'手机入口尚未就绪'),
    ready?h('div',{className:'dsm-phone-ready'},h(Qr,{value:state.loginUrl}),h('p',{className:'dsm-phone-scan'},'用手机相机扫描，在浏览器中打开。'),h('p',{className:'dsm-phone-address'},state.baseUrl),
      h('button',{type:'button',className:'dsm-phone-primary',onClick:()=>phone.copy(navigator.clipboard)},state.copied?'已复制登录链接':'复制登录链接'),
      h('details',{className:'dsm-phone-manual'},h('summary',null,'手动复制链接'),h('textarea',{'aria-label':'手机登录链接',readOnly:true,value:state.loginUrl,onFocus:event=>event.target.select()})),
      h('div',{className:'dsm-phone-actions'},h('button',{type:'button',onClick:()=>phone.refresh()},'刷新入口'),h('button',{type:'button',onClick:()=>{setAddress(form.value?.phoneUrl??state.baseUrl);setEditing(value=>!value)}},'修改地址'))):
      h('p',{className:'dsm-phone-help'},state.loading?'请保持电脑和手机联网。':phoneStatusText(state.status)),
    configure?h('form',{className:'dsm-phone-config',onSubmit:save},h('label',{htmlFor:'dsm-phone-url'},'手机访问地址'),h('input',{id:'dsm-phone-url',type:'url',value:address,onChange:event=>setAddress(event.target.value),placeholder:'https://dsh.example.com/',autoComplete:'off',spellCheck:false,required:true}),h('p',null,'填写已配置且受宿主信任的 HTTPS 入口。'),h('button',{type:'submit',disabled:saving||form.status!=='ready'||!form.writable},saving?'正在保存…':'保存并检查')):null,
    state.error?h('p',{className:'dsm-phone-error',role:'alert'},state.error):null,
    h('p',{className:'dsm-phone-note'},'请只向自己的设备提供登录链接，电脑需保持运行。'))
}
