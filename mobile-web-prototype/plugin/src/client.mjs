import {createElement as h,useEffect,useLayoutEffect,useRef,useSyncExternalStore} from 'react'
import {createMobileClient} from '../../../mobile-host-adapter/client.mjs'
import {createMobileNavigation} from './controller.mjs'
import {createLayoutPreference} from './preference.mjs'
import {createRefreshLoop} from './refresh-loop.mjs'
import {installConnectionLifecycle} from './connection-lifecycle.mjs'
import {createComposerKeyboard} from './composer-keyboard.mjs'
import {createMobileViewport} from './mobile-viewport.mjs'
import {installMobileStyles} from './mobile-styles.mjs'
import {createMobileTheme} from './mobile-theme.mjs'
import {clearMobileAssetCache} from '../web-startup.mjs'
import {installMobileBrowserAppearance} from '../web-appearance.mjs'
import {createPhoneController} from './phone-controller.mjs'
import {WebAccessPanel} from './phone-access.mjs'
import {registerMobileAccessProvider} from './mobile-access-registry.mjs'
import {MobileAccessHost} from './mobile-access-shell.mjs'
import phoneCss from './phone.css'
import css from './mobile.css'
import {mascotCss} from './mascot-css.mjs'
import {BotAvatar,RoomAvatar,botState} from '../../../ds-bot-upstream/ds-bot/src/client/mark.js'

export const inject=['slots','uiWorkspace','sessions','connection','configForms','theme']
const connectionLabel=state=>state==='connected'?'已连接':state==='disconnected'?'已离线':'正在连接'
const iconPaths={chat:['M5 4h14v11H9l-4 4V4Z'],team:['M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M16 4a4 4 0 0 1 0 8','M22 20v-2a4 4 0 0 0-3-3.87','M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],settings:['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8','M12 2v2','M12 20v2','M2 12h2','M20 12h2','m5 5 1.5 1.5','m17.5 17.5 1.5 1.5','m5 19 1.5-1.5','m17.5 6.5 1.5-1.5'],connection:['M3 9a15 15 0 0 1 18 0','M6 12a10 10 0 0 1 12 0','M9 15a5 5 0 0 1 6 0','M12 19h.01'],back:['m14 5-7 7 7 7'],search:['M21 21l-5-5','M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0']}
function Icon({name}){return h('svg',{viewBox:'0 0 24 24',width:24,height:24,fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},...(iconPaths[name]||[]).map((d,i)=>h('path',{d,key:i})))}
function ThemeIcon({dark}){
  return dark?h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},
    h('circle',{cx:12,cy:12,r:4}),h('path',{d:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5'})):
    h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M20.8 13.2A8.8 8.8 0 0 1 10.8 3.2 8.8 8.8 0 1 0 20.8 13.2Z'}))
}
function Mascot({item,items,size=48}){
  if(item.kind==='room')return h(RoomAvatar,{room:item,roster:{byId:Object.fromEntries(items.filter(x=>x.kind==='bot').map(x=>[x.id,x]))},size})
  return h(BotAvatar,{bot:item,size,state:botState(item.running,item.activity,item.alert),main:item.isMain,live:true,gaze:size>=60})
}
export function MobileSettings({preference,access,view}){
  const enabled=useSyncExternalStore(preference.subscribe,preference.snapshot,preference.snapshot)
  if(view==='summary')return '手机会话界面与扫码登录入口。'
  return h('div',null,
    h('label',null,h('input',{type:'checkbox','aria-label':'启用手机布局',checked:enabled,onChange:event=>preference.set(event.target.checked)}),' 启用手机布局'),
    h('p',null,'手机布局开关仅保存在当前浏览器。'),
    h('button',{type:'button',onClick:access.open},'手机访问'))
}
export function ComposerKeyboard({sessionId,useSession,keyboardActive,keyboardDismiss}){
  const anchor=useRef(null),state=useRef(null)
  const submissions=useSession(snapshot=>snapshot.pendingSubmissions)
  if(state.current?.sessionId!==sessionId)state.current={sessionId,observer:createComposerKeyboard({anchor:()=>anchor.current,enabled:keyboardActive,document,beforeDismiss:keyboardDismiss})}
  useLayoutEffect(()=>{state.current.observer.update(submissions)},[sessionId,submissions])
  return h('span',{ref:anchor,hidden:true,'aria-hidden':true})
}
export function MobileChrome({controller,preference,appearance}){
  const state=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot)
  const enabled=useSyncExternalStore(preference.subscribe,preference.snapshot,preference.snapshot)
  const theme=useSyncExternalStore(appearance.subscribe,appearance.snapshot,appearance.snapshot)
  const dark=theme.active.colorScheme==='dark',themeLabel=dark?'切换到日间模式':'切换到夜间模式'
  const setEnabled=value=>preference.set(value)
  useLayoutEffect(()=>{
    if(enabled){document.body.dataset.dsmEnabled='true';document.body.dataset.dsmPage=state.page}
    else{delete document.body.dataset.dsmEnabled;delete document.body.dataset.dsmPage}
    return()=>{delete document.body.dataset.dsmEnabled;delete document.body.dataset.dsmPage}
  },[enabled,state.page])
  const prepared=Boolean(state.lastSync||state.error)
  useLayoutEffect(()=>{
    if(enabled&&prepared)document.documentElement.dataset.dsmReady='true'
    else delete document.documentElement.dataset.dsmReady
    return()=>{delete document.documentElement.dataset.dsmReady}
  },[enabled,prepared])
  if(!enabled)return h('button',{className:'dsm-return',onClick:()=>setEnabled(true)},'手机布局')
  const isChat=state.page==='chat',status=connectionLabel(state.connected)
  const results=state.items.filter(item=>(state.tab!=='team'||item.kind==='bot')&&item.name.toLowerCase().includes(state.query.toLowerCase()))
  const titles={chats:'DS Bot',team:'团队',connection:'连接'}
  const row=item=>h('button',{key:item.id,className:'dsm-row',onClick:()=>controller.open(item.id)},
    h('span',{className:'dsm-avatar','data-kind':item.kind,'data-bot-id':item.id},h(Mascot,{item,items:state.items})),
    h('span',{className:'dsm-row-copy'},h('strong',null,item.name,item.isMain?h('span',{className:'dsm-main-badge'},'主 Bot'):null),h('small',null,item.preview||item.role||(item.kind==='room'?'团队群聊':'开始或继续对话'))),
    h('span',{className:'dsm-row-status','data-running':item.running||undefined,'aria-label':item.running?'正在工作':undefined},item.running?h('span',null):null))
  return h('div',{className:'dsm-chrome'},
    h('header',{className:'dsm-bar'},
      isChat?h('button',{onClick:()=>controller.home(),'aria-label':'返回会话列表'},h(Icon,{name:'back'})):h('button',{className:'dsm-theme-toggle',type:'button',onClick:event=>appearance.toggle(event.currentTarget),'aria-label':themeLabel,title:themeLabel},h(ThemeIcon,{dark})),
      h('div',{className:'dsm-current'},isChat?h('span',{className:'dsm-title-mascot'},state.items.find(x=>x.id===state.active?.id)?h(Mascot,{item:state.items.find(x=>x.id===state.active.id),items:state.items,size:28}):null,state.active?.name||'当前会话'):titles[state.tab],h('span',{'data-connected':state.connected,role:'status'},status)),
      isChat?h('span',{className:'dsm-header-spacer','aria-hidden':true}):h('button',{onClick:()=>{if(state.tab==='connection')controller.selectTab('chats');requestAnimationFrame(()=>document.getElementById('dsm-search')?.focus())},'aria-label':'搜索会话'},h(Icon,{name:'search'}))),
    state.error?h('div',{className:'dsm-error',role:'status'},state.error,h('button',{onClick:controller.restore},'重试')):null,
    !isChat?h('section',{className:'dsm-home','aria-label':state.tab==='connection'?'手机连接设置':state.tab==='team'?'Bot团队':'手机会话列表'},
      state.tab==='connection'?h('div',{className:'dsm-settings'},
        h('div',{className:'dsm-connection-symbol','data-connected':state.connected},h(Icon,{name:'connection'})),h('h1',null,status),
        h('p',{className:'dsm-lead'},'电脑保持运行时，随时接着聊。'),
        h('dl',{className:'dsm-details'},h('div',null,h('dt',null,'电脑连接'),h('dd',null,status)),h('div',null,h('dt',null,'最近同步'),h('dd',null,state.lastSync?new Date(state.lastSync).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'尚未同步'))),
        h('div',{className:'dsm-setting-actions'},h('button',{onClick:controller.restore,disabled:state.loading},state.loading?'正在同步…':'同步消息'),h('button',{onClick:()=>controller.reconnect()},'重新连接')),
        h('p',{className:'dsm-setting-note'},'电脑休眠或断网时，连接恢复后再查看最新进度。')):
      h('div',null,
        h('label',{className:'dsm-search'},h('span',{className:'dsm-sr'},'搜索会话'),h(Icon,{name:'search'}),h('input',{id:'dsm-search',type:'search',value:state.query,onChange:event=>controller.search(event.target.value),placeholder:state.tab==='team'?'搜索你的 Bot':'搜索会话',autoComplete:'off'})),
        state.tab==='team'?h('div',{className:'dsm-section-heading'},h('h1',null,'你的团队'),h('span',null,results.length+' 位 Bot')):null,
        h('div',{className:'dsm-list'},...results.map(row)),
        !results.length?h('p',{className:'dsm-empty',role:'status'},state.loading?'正在同步团队…':state.query?'没有匹配的会话':'团队准备中，请在电脑端完成首次设置。'):null),
    ):null,
    !isChat?h('nav',{className:'dsm-tabs','aria-label':'手机主导航'},...Object.entries({chats:'聊天',team:'团队',connection:'连接'}).map(([tab,label])=>h('button',{key:tab,onClick:()=>controller.selectTab(tab),'aria-current':state.tab===tab?'page':undefined},h(Icon,{name:tab==='chats'?'chat':tab}),h('span',null,label)))):null,
  )
}
export function apply(ctx){
  let storage
  try{storage=window.localStorage}catch{}
  const preference=createLayoutPreference(storage)
  const browserAppearance=window[Symbol.for('ds-bot-mobile-web/browser-appearance')]??installMobileBrowserAppearance(window)
  const api=createMobileClient({appRoot:new URL('./',location.href).href})
  const controller=createMobileNavigation({api,workspace:ctx.uiWorkspace,sessions:ctx.sessions,connection:ctx.connection,history:window.history})
  const phone=createPhoneController({appRoot:new URL('./',location.href).href,form:ctx.configForms.get('mobile-layout-local')})
  const access=registerMobileAccessProvider({id:'web',label:'Web',order:10,render:()=>h(WebAccessPanel,{phone})})
  const mobileMedia=window.matchMedia('(max-width:767px), (max-width:1024px) and (max-height:500px)')
  let lifecycle,viewport
  const mobileActive=()=>preference.snapshot()&&mobileMedia.matches&&!document.hidden&&(!lifecycle||lifecycle.active())
  const appearance=createMobileTheme({theme:ctx.theme,subscribe:listener=>ctx.on('theme/change',listener),window,document,enabled:mobileActive})
  const keyboardActive=()=>mobileActive()&&controller.snapshot().page==='chat'
  const keyboardDismiss=()=>viewport?.beginDismiss()
  ctx.effect(()=>()=>{appearance.close();browserAppearance.close();delete window[Symbol.for('ds-bot-mobile-web/browser-appearance')];access.dispose();phone.dispose()})
  ctx.effect(()=>{
    const styles=installMobileStyles({window,document,text:css+'\n'+mascotCss+'\n'+phoneCss})
    const meta=document.querySelector('meta[name=viewport]'),originalViewport=meta?.content
    if(meta&&!meta.content.includes('viewport-fit'))meta.content+=', viewport-fit=cover'
    viewport=createMobileViewport({window,document,enabled:keyboardActive})
    const polling=createRefreshLoop({enabled:mobileActive,refresh:()=>{if(!controller.snapshot().loading)return controller.refresh()}})
    const cacheMode=()=>{browserAppearance.sync();controller.setCacheEnabled(preference.snapshot()&&mobileMedia.matches);if(!mobileActive())controller.pauseWarmup();if(!preference.snapshot())void clearMobileAssetCache(window)}
    const poll=()=>polling.sync()
    const offPreference=preference.subscribe(()=>{appearance.cancel();viewport.sync();cacheMode();poll();if(mobileActive())void controller.restore()})
    lifecycle=installConnectionLifecycle({window,document,controller,enabled:()=>preference.snapshot()&&mobileMedia.matches,sync:()=>{viewport.sync();cacheMode();poll()}})
    const mediaChange=()=>{viewport.sync();cacheMode();poll();if(mobileActive())void controller.restore()}
    const pop=event=>controller.pop(event)
    window.addEventListener('popstate',pop)
    mobileMedia.addEventListener('change',mediaChange)
    cacheMode();poll();if(mobileActive())void controller.refresh()
    return()=>{
      lifecycle.close();lifecycle=undefined;polling.close();mobileMedia.removeEventListener('change',mediaChange);offPreference();controller.close();styles.close();if(meta)meta.content=originalViewport
      viewport.close();viewport=undefined
      window.removeEventListener('popstate',pop)
      delete document.body.dataset.dsmEnabled;delete document.body.dataset.dsmPage
    }
  })
  ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'mobile-layout-local',order:40,inject:()=>({controller,preference,appearance})},MobileChrome))
  ctx.slots.inject('conversation.input.right',()=>ctx.slots.register({name:'conversation.input.right',id:'mobile-composer-keyboard',order:1000,inject:()=>({keyboardActive,keyboardDismiss})},ComposerKeyboard))
  ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'mobile-phone-access',order:41,inject:()=>({access})},MobileAccessHost))
  ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',key:'ds-bot-mobile-web',inject:()=>({preference,access})},MobileSettings))
}
