import {createSessionRetention} from './session-retention.mjs'
import {createSessionWarmup,sessionWarmupTargets} from './session-warmup.mjs'
import {readOperation} from '../../../mobile-host-adapter/read-operation.mjs'

const unauthorized=error=>error?.code==='HTTP_401'||error?.code==='HTTP_403'
const accessError=error=>error?.code==='HTTP_401'?'登录已失效，请刷新页面重新登录。':error?.code==='HTTP_403'?'当前入口拒绝访问，请检查电脑端的访问权限。':undefined

export function summarizeTeam(team){
  const approvals=team.work?.approvals??[]
  const bots=team.bots.map(bot=>{
    const running=Boolean(team.work?.bots?.[bot.id])||Object.values(team.work?.rooms??{}).some(entries=>Array.isArray(entries)&&entries.some(entry=>entry.botId===bot.id))
    return {id:bot.id,name:bot.name,kind:'bot',sessionId:bot.sessionId,isMain:bot.id===team.mainBotId,role:typeof bot.role==='string'?bot.role:'',preview:typeof bot.preview==='string'?bot.preview:'',color:bot.color,avatar:bot.avatar,running,activity:team.activity?.[bot.id],alert:team.questions?.[bot.sessionId]!==undefined||approvals.some(entry=>entry.botId===bot.id)}
  })
  return [...bots,...team.rooms.map(room=>({id:room.id,name:room.name,kind:'room',sessionId:room.id,preview:typeof room.preview==='string'?room.preview:'',members:room.members??[]}))]
}

export function createMobileNavigation({ api, workspace, sessions, connection, history, now=Date.now, idle,readTimeoutMs=12000 }) {
  const listeners=new Set()
  const retention=createSessionRetention({sessions,now})
  const warmup=createSessionWarmup({prewarm:target=>retention.prewarm(target),idle})
  let cacheEnabled=false,warmingEnabled=false
  const recentIds=[]
  let state={page:history.state?.dsMobilePage==='chat'?'chat':'home',tab:'chats',items:[],active:null,error:'',loading:false,query:'',connected:connection.state.getSnapshot(),lastSync:null}
  let disposed=false,nav=0,pull=0,controller,restoring,refreshing,navigation,lastReconnect=-Infinity
  const reconnect=()=>{
    if(disposed||now()-lastReconnect<15000||connection.state.getSnapshot()==='connecting')return
    lastReconnect=now();connection.reconnect?.()
  }
  const publish=patch=>{if(disposed)return;state={...state,...patch};for(const callback of listeners)callback()}
  const selectedSession=()=>Object.values(sessions.list.getSnapshot().byId??{}).find(item=>(item.retainedBy?.mainView??0)>0)?.id
  const syncSelection=()=>{
    const id=selectedSession()
    const target=state.items.find(item=>item.sessionId===id)
    if(target&&target!==state.active)publish({active:target})
  }
  const offSessions=sessions.list.subscribe(syncSelection)
  const offConnection=connection.state.subscribe(()=>{
    const connected=connection.state.getSnapshot()
    if(connected!=='connected')warmup.sync({enabled:false})
    publish({connected})
  })
  function cancelNavigation(){nav++;navigation?.abort();navigation=undefined}
  function refresh(){
    if(disposed)return
    if(refreshing)return refreshing
    const issued=++pull
    controller=new AbortController()
    const request=controller
    publish({loading:true})
    refreshing=(async()=>{try{
      const items=await readOperation(signal=>typeof api.refresh==='function'?api.refresh(signal).then(summarizeTeam):api.conversations(signal),{signal:request.signal,timeoutMs:readTimeoutMs})
      if(disposed||issued!==pull)return
      retention.reconcile(items)
      publish({items,loading:false,error:'',lastSync:now()});syncSelection()
      if(cacheEnabled&&warmingEnabled&&state.connected==='connected')warmup.sync({enabled:true,targets:sessionWarmupTargets(items,{activeId:state.active?.id,recentIds})})
    }catch(error){
      if(disposed||issued!==pull||request.signal.aborted)return
      if(unauthorized(error)){warmup.sync({enabled:false});retention.clear()}
      if(error?.code==='mobile/timeout')reconnect()
      const errorText=accessError(error)||'暂时无法同步电脑。输入草稿由原版会话保留，请检查网络后重试。'
      publish({loading:false,error:errorText})
    }})().finally(()=>{if(controller===request)refreshing=undefined})
    return refreshing
  }
  async function open(id){
    cancelNavigation()
    const attempt=nav,request=new AbortController()
    navigation=request
    publish({loading:true,error:''})
    try{
      const target=await readOperation(signal=>api.target(id,signal),{signal:request.signal,timeoutMs:readTimeoutMs})
      if(disposed||attempt!==nav||request.signal.aborted)return
      // Validate the current Bot/Room identity before retaining. Session rollover,
      // deletion, and authentication checks stay authoritative on every visit.
      retention.visit(target)
      const recent=recentIds.indexOf(target.id)
      if(recent>=0)recentIds.splice(recent,1)
      recentIds.unshift(target.id);recentIds.length=Math.min(recentIds.length,3)
      workspace.openSession(target.sessionId)
      if(state.page!=='chat')history.pushState({...history.state,dsMobilePage:'chat'},'')
      publish({active:target,page:'chat',loading:false})
    }catch(error){
      if(disposed||attempt!==nav)return
      if(unauthorized(error)){warmup.sync({enabled:false});retention.clear()}
      else if(error?.code==='mobile/not-found')retention.discard(id)
      if(error?.code==='mobile/timeout')reconnect()
      publish({loading:false,error:accessError(error)||'无法打开会话，请刷新列表后重试。'})
    }finally{if(navigation===request)navigation=undefined}
  }
  function suspend(){
    warmup.sync({enabled:false});warmingEnabled=false
    cancelNavigation();pull++;controller?.abort();controller=undefined;refreshing=undefined
    const previous=restoring;restoring=undefined;previous?.controller.abort()
    publish({loading:false})
  }
  function restore({reconnect:repair=false}={}){
    if(disposed)return
    if(restoring)return restoring.promise
    if(repair){suspend();reconnect()}
    warmingEnabled=cacheEnabled
    // The Session catalog and Bot/Room roster are independent reads. Keep the
    // recovery shared until both settle, including when one fails first.
    const recovery={controller:new AbortController()}
    restoring=recovery
    recovery.promise=Promise.allSettled([
      Promise.resolve().then(()=>{if(!disposed&&!recovery.controller.signal.aborted)return readOperation(()=>sessions.refresh(),{signal:recovery.controller.signal,timeoutMs:readTimeoutMs})}),
      Promise.resolve().then(()=>{if(!disposed&&!recovery.controller.signal.aborted)return refresh()}),
    ]).then(results=>{
      if(disposed||restoring!==recovery||recovery.controller.signal.aborted)return
      if(results.some(result=>result.status==='rejected'&&result.reason?.code==='mobile/timeout'))reconnect()
      if(results.some(result=>result.status==='rejected')&&!state.error)publish({error:'会话恢复尚未完成，请检查电脑连接。'})
    }).finally(()=>{if(restoring===recovery)restoring=undefined})
    return recovery.promise
  }
  return {
    snapshot:()=>state,
    subscribe:callback=>{listeners.add(callback);return()=>listeners.delete(callback)},
    refresh,open,restore,suspend,
    pauseWarmup(){warmingEnabled=false;warmup.sync({enabled:false})},
    setCacheEnabled(enabled){cacheEnabled=Boolean(enabled);warmingEnabled=cacheEnabled;if(!warmingEnabled)warmup.sync({enabled:false});retention.setEnabled(cacheEnabled)},
    search:query=>publish({query}),
    selectTab(tab){if(!['chats','team','connection'].includes(tab))return;cancelNavigation();publish({page:'home',tab,query:'',loading:false})},
    home(){cancelNavigation();publish({page:'home',loading:false});if(history.state?.dsMobilePage==='chat')history.back()},
    pop(event){cancelNavigation();publish({page:event.state?.dsMobilePage==='chat'?'chat':'home',loading:false});syncSelection()},
    reconnect(){connection.reconnect()},
    close(){if(disposed)return;suspend();disposed=true;warmup.close();retention.close();offSessions();offConnection();listeners.clear()},
  }
}
