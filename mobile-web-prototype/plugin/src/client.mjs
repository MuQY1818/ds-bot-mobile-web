import {createElement as h,useEffect,useSyncExternalStore} from 'react'
import {createMobileClient} from '../../../mobile-host-adapter/client.mjs'
import {createMobileNavigation} from './controller.mjs'
import {createLayoutPreference} from './preference.mjs'
import {createPhoneController} from './phone-controller.mjs'
import {PhoneAccess} from './phone-access.mjs'
import phoneCss from './phone.css'
import css from './mobile.css'
import {BotAvatar,RoomAvatar,botState} from '../../../ds-bot-upstream/ds-bot/src/client/mark.js'

export const inject=['slots','uiWorkspace','sessions','connection','configForms']
const connectionLabel=state=>state==='connected'?'已连接':state==='disconnected'?'已离线':'正在连接'
const iconPaths={chat:['M5 4h14v11H9l-4 4V4Z'],team:['M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M16 4a4 4 0 0 1 0 8','M22 20v-2a4 4 0 0 0-3-3.87','M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],connection:['M3 9a15 15 0 0 1 18 0','M6 12a10 10 0 0 1 12 0','M9 15a5 5 0 0 1 6 0','M12 19h.01'],back:['m14 5-7 7 7 7'],search:['M21 21l-5-5','M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0']}
function Icon({name}){return h('svg',{viewBox:'0 0 24 24',width:24,height:24,fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},...(iconPaths[name]||[]).map((d,i)=>h('path',{d,key:i})))}
function Mascot({item,items,size=48}){
  if(item.kind==='room')return h(RoomAvatar,{room:item,roster:{byId:Object.fromEntries(items.filter(x=>x.kind==='bot').map(x=>[x.id,x]))},size})
  return h(BotAvatar,{bot:item,size,state:botState(item.running,item.activity,item.alert),main:item.isMain,live:true,gaze:size>=60})
}
export function MobileSettings({preference,phone,view}){
  const enabled=useSyncExternalStore(preference.subscribe,preference.snapshot,preference.snapshot)
  if(view==='summary')return '手机会话布局、扫码登录与原版界面切换。'
  return h('div',null,
    h('label',null,h('input',{type:'checkbox','aria-label':'启用手机布局',checked:enabled,onChange:event=>preference.set(event.target.checked)}),' 启用手机布局'),
    h('p',null,'仅保存在当前浏览器。关闭后恢复原版布局，可随时重新开启。'),
    h('button',{type:'button',onClick:()=>phone.open()},'手机访问'))
}
export function MobileChrome({controller,preference}){
  const state=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot)
  const enabled=useSyncExternalStore(preference.subscribe,preference.snapshot,preference.snapshot)
  const setEnabled=value=>preference.set(value)
  useEffect(()=>{
    if(enabled){document.body.dataset.dsmEnabled='true';document.body.dataset.dsmPage=state.page}
    else{delete document.body.dataset.dsmEnabled;delete document.body.dataset.dsmPage}
    return()=>{delete document.body.dataset.dsmEnabled;delete document.body.dataset.dsmPage}
  },[enabled,state.page])
  if(!enabled)return h('button',{className:'dsm-return',onClick:()=>setEnabled(true)},'手机布局')
  const isChat=state.page==='chat',status=connectionLabel(state.connected)
  const results=state.items.filter(item=>(state.tab!=='team'||item.kind==='bot')&&item.name.toLowerCase().includes(state.query.toLowerCase()))
  const chief=state.tab==='chats'&&!state.query?results.find(item=>item.isMain):null
  const titles={chats:'DS Bot',team:'团队',connection:'连接'}
  const row=item=>h('button',{key:item.id,className:'dsm-row',onClick:()=>controller.open(item.id)},
    h('span',{className:'dsm-avatar','data-kind':item.kind,'data-bot-id':item.id},h(Mascot,{item,items:state.items})),
    h('span',{className:'dsm-row-copy'},h('strong',null,item.name),h('small',null,item.preview||item.role||(item.kind==='room'?'团队群聊':'开始或继续对话'))),
    h('span',{className:'dsm-chevron','aria-hidden':true},'›'))
  return h('div',{className:'dsm-chrome'},
    h('header',{className:'dsm-bar'},
      isChat?h('button',{onClick:()=>controller.home(),'aria-label':'返回会话列表'},h(Icon,{name:'back'})):h('button',{className:'dsm-profile',onClick:()=>controller.selectTab('connection'),'aria-label':'查看连接与界面'},'DS'),
      h('div',{className:'dsm-current'},isChat?h('span',{className:'dsm-title-mascot'},state.items.find(x=>x.id===state.active?.id)?h(Mascot,{item:state.items.find(x=>x.id===state.active.id),items:state.items,size:28}):null,state.active?.name||'当前会话'):titles[state.tab],h('span',{'data-connected':state.connected,role:'status'},status)),
      isChat?h('button',{className:'dsm-mode-switch',onClick:()=>setEnabled(false),'aria-label':'切换回原版布局'},'原版'):h('button',{onClick:()=>{if(state.tab==='connection')controller.selectTab('chats');requestAnimationFrame(()=>document.getElementById('dsm-search')?.focus())},'aria-label':'搜索会话'},h(Icon,{name:'search'}))),
    state.error?h('div',{className:'dsm-error',role:'status'},state.error,h('button',{onClick:controller.restore},'重试')):null,
    !isChat?h('section',{className:'dsm-home','aria-label':state.tab==='connection'?'手机连接设置':state.tab==='team'?'Bot团队':'手机会话列表'},
      state.tab==='connection'?h('div',{className:'dsm-settings'},
        h('div',{className:'dsm-connection-symbol','data-connected':state.connected},h(Icon,{name:'connection'})),h('h1',null,status),
        h('p',{className:'dsm-lead'},'电脑保持运行时，随时接着聊。'),
        h('dl',{className:'dsm-details'},h('div',null,h('dt',null,'电脑连接'),h('dd',null,status)),h('div',null,h('dt',null,'最近同步'),h('dd',null,state.lastSync?new Date(state.lastSync).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'尚未同步'))),
        h('div',{className:'dsm-setting-actions'},h('button',{onClick:controller.restore,disabled:state.loading},state.loading?'正在同步…':'同步消息'),h('button',{onClick:()=>controller.reconnect()},'重新连接')),
        h('h2',null,'界面'),h('button',{className:'dsm-setting-row',onClick:()=>setEnabled(false)},h('span',null,'切换原版布局'),h('span',{'aria-hidden':true},'›')),
        h('p',{className:'dsm-setting-note'},'切回手机布局后，可以继续当前会话。电脑休眠或断网时，连接恢复后再查看最新进度。')):
      h('div',null,
        chief?h('button',{className:'dsm-chief',onClick:()=>controller.open(chief.id)},h('span',{className:'dsm-avatar dsm-chief-avatar','data-bot-id':chief.id},h(Mascot,{item:chief,items:state.items,size:72})),h('strong',null,chief.name),h('small',null,chief.role||'主 Bot')):null,
        h('label',{className:'dsm-search'},h('span',{className:'dsm-sr'},'搜索会话'),h(Icon,{name:'search'}),h('input',{id:'dsm-search',type:'search',value:state.query,onChange:event=>controller.search(event.target.value),placeholder:state.tab==='team'?'搜索你的 Bot':'搜索会话',autoComplete:'off'})),
        state.tab==='team'?h('div',{className:'dsm-section-heading'},h('h1',null,'你的团队'),h('span',null,results.length+' 位 Bot')):null,
        h('div',{className:'dsm-list'},...results.filter(item=>item!==chief).map(row)),
        !results.length?h('p',{className:'dsm-empty',role:'status'},state.loading?'正在同步团队…':state.query?'没有匹配的会话':'团队准备中，可切回原版完成首次设置。'):null,
        h('p',{className:'dsm-list-foot'},state.loading?'正在同步…':state.connected==='connected'?'与电脑保持同步':'连接恢复后将同步最新消息')),
    ):null,
    !isChat?h('nav',{className:'dsm-tabs','aria-label':'手机主导航'},...Object.entries({chats:'聊天',team:'团队',connection:'连接'}).map(([tab,label])=>h('button',{key:tab,onClick:()=>controller.selectTab(tab),'aria-current':state.tab===tab?'page':undefined},h(Icon,{name:tab==='chats'?'chat':tab}),h('span',null,label)))):null,
  )
}
export function apply(ctx){
  let storage
  try{storage=window.localStorage}catch{}
  const preference=createLayoutPreference(storage)
  const api=createMobileClient({appRoot:new URL('./',location.href).href})
  const controller=createMobileNavigation({api,workspace:ctx.uiWorkspace,sessions:ctx.sessions,connection:ctx.connection,history:window.history})
  const phone=createPhoneController({appRoot:new URL('./',location.href).href,form:ctx.configForms.get('mobile-layout-local')})
  ctx.effect(()=>()=>phone.dispose())
  ctx.effect(()=>{
    const style=document.createElement('style');style.dataset.mobileLayout='local';style.textContent=css+'\n'+phoneCss;document.head.append(style)
    const meta=document.querySelector('meta[name=viewport]'),originalViewport=meta?.content
    if(meta&&!meta.content.includes('viewport-fit'))meta.content+=', viewport-fit=cover'
    let timer,suspended=false
    const viewport=()=>{const v=window.visualViewport;document.documentElement.style.setProperty('--dsm-height',(v?.height??innerHeight)+'px');document.documentElement.style.setProperty('--dsm-top',(v?.offsetTop??0)+'px')}
    const poll=()=>{clearInterval(timer);if(preference.snapshot())timer=setInterval(()=>{if(!document.hidden)void controller.refresh()},1500)}
    const offPreference=preference.subscribe(()=>{poll();if(preference.snapshot())void controller.restore()})
    const recover=()=>{viewport();poll();void controller.restore()}
    const visible=()=>{if(document.hidden){suspended=true;clearInterval(timer)}else if(suspended){suspended=false;recover()}}
    const hide=()=>{suspended=true;clearInterval(timer)}
    const show=event=>{if(event.persisted&&suspended){suspended=false;recover()}}
    const resume=()=>{if(suspended){suspended=false;recover()}}
    const pop=event=>controller.pop(event)
    window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport)
    window.addEventListener('resize',viewport);window.addEventListener('pageshow',show);window.addEventListener('pagehide',hide)
    window.addEventListener('online',recover);window.addEventListener('popstate',pop)
    document.addEventListener('visibilitychange',visible);document.addEventListener('freeze',hide);document.addEventListener('resume',resume)
    viewport();poll();void controller.refresh()
    return()=>{
      clearInterval(timer);offPreference();controller.close();style.remove();if(meta)meta.content=originalViewport
      window.visualViewport?.removeEventListener('resize',viewport);window.visualViewport?.removeEventListener('scroll',viewport)
      window.removeEventListener('resize',viewport);window.removeEventListener('pageshow',show);window.removeEventListener('pagehide',hide)
      window.removeEventListener('online',recover);window.removeEventListener('popstate',pop)
      document.removeEventListener('visibilitychange',visible);document.removeEventListener('freeze',hide);document.removeEventListener('resume',resume)
      document.documentElement.style.removeProperty('--dsm-height');document.documentElement.style.removeProperty('--dsm-top')
      delete document.body.dataset.dsmEnabled;delete document.body.dataset.dsmPage
    }
  })
  ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'mobile-layout-local',order:40,inject:()=>({controller,preference})},MobileChrome))
  ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'mobile-phone-access',order:41,inject:()=>({phone})},PhoneAccess))
  ctx.slots.inject('plugins.item',()=>ctx.slots.register({name:'plugins.item',id:'mobile-layout-local-settings',order:140,label:'DS Bot Mobile Web',inject:()=>({preference,phone})},MobileSettings))
}
