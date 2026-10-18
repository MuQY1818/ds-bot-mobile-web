import {createSessionRetention} from './session-retention.mjs'

const unauthorized=error=>error?.code==='HTTP_401'||error?.code==='HTTP_403'

export function summarizeTeam(team){
  const approvals=team.work?.approvals??[]
  const bots=team.bots.map(bot=>{
    const running=Boolean(team.work?.bots?.[bot.id])||Object.values(team.work?.rooms??{}).some(entries=>Array.isArray(entries)&&entries.some(entry=>entry.botId===bot.id))
    return {id:bot.id,name:bot.name,kind:'bot',sessionId:bot.sessionId,isMain:bot.id===team.mainBotId,role:typeof bot.role==='string'?bot.role:'',preview:typeof bot.preview==='string'?bot.preview:'',color:bot.color,avatar:bot.avatar,running,activity:team.activity?.[bot.id],alert:team.questions?.[bot.sessionId]!==undefined||approvals.some(entry=>entry.botId===bot.id)}
  })
  return [...bots,...team.rooms.map(room=>({id:room.id,name:room.name,kind:'room',sessionId:room.id,preview:typeof room.preview==='string'?room.preview:'',members:room.members??[]}))]
}

export function createMobileNavigation({ api, workspace, sessions, connection, history, now=Date.now }) {
  const listeners=new Set()
  const retention=createSessionRetention({sessions,now})
  let state={page:history.state?.dsMobilePage==='chat'?'chat':'home',tab:'chats',items:[],active:null,error:'',loading:false,query:'',connected:connection.state.getSnapshot(),lastSync:null}
  let disposed=false,nav=0,pull=0,controller,restoring
  const publish=patch=>{if(disposed)return;state={...state,...patch};for(const callback of listeners)callback()}
  const selectedSession=()=>Object.values(sessions.list.getSnapshot().byId??{}).find(item=>(item.retainedBy?.mainView??0)>0)?.id
  const syncSelection=()=>{
    const id=selectedSession()
    const target=state.items.find(item=>item.sessionId===id)
    if(target&&target!==state.active)publish({active:target})
  }
  const offSessions=sessions.list.subscribe(syncSelection)
  const offConnection=connection.state.subscribe(()=>publish({connected:connection.state.getSnapshot()}))
  async function refresh(){
    if(disposed)return
    const issued=++pull
    controller?.abort();controller=new AbortController()
    const request=controller
    publish({loading:true})
    try{
      const items=typeof api.refresh==='function'?summarizeTeam(await api.refresh(request.signal)):await api.conversations(request.signal)
      if(disposed||issued!==pull)return
      retention.reconcile(items)
      publish({items,loading:false,error:'',lastSync:now()});syncSelection()
    }catch(error){
      if(disposed||issued!==pull||request.signal.aborted)return
      if(unauthorized(error))retention.clear()
      const errorText=unauthorized(error)?'登录已失效，请刷新页面重新登录。':'暂时无法同步电脑。输入草稿由原版会话保留，请检查网络后重试。'
      publish({loading:false,error:errorText})
    }
  }
  async function open(id){
    const attempt=++nav
    publish({loading:true,error:''})
    try{
      const target=await api.target(id)
      if(disposed||attempt!==nav)return
      // Validate the current Bot/Room identity before retaining. Session rollover,
      // deletion, and authentication checks stay authoritative on every visit.
      retention.visit(target)
      workspace.openSession(target.sessionId)
      if(state.page!=='chat')history.pushState({...history.state,dsMobilePage:'chat'},'')
      publish({active:target,page:'chat',loading:false})
    }catch(error){
      if(disposed||attempt!==nav)return
      if(unauthorized(error))retention.clear()
      else retention.discard(id)
      publish({loading:false,error:unauthorized(error)?'登录已失效，请刷新页面重新登录。':'无法打开会话，请刷新列表后重试。'})
    }
  }
  async function restore(){
    if(disposed||restoring)return restoring
    restoring=(async()=>{await sessions.refresh();await refresh()})().catch(()=>publish({error:'会话恢复尚未完成，请检查电脑连接。'})).finally(()=>{restoring=undefined})
    return restoring
  }
  return {
    snapshot:()=>state,
    subscribe:callback=>{listeners.add(callback);return()=>listeners.delete(callback)},
    refresh,open,restore,
    setCacheEnabled:enabled=>retention.setEnabled(enabled),
    search:query=>publish({query}),
    selectTab(tab){if(!['chats','team','connection'].includes(tab))return;nav++;publish({page:'home',tab,query:'',loading:false})},
    home(){nav++;publish({page:'home',loading:false});if(history.state?.dsMobilePage==='chat')history.back()},
    pop(event){nav++;publish({page:event.state?.dsMobilePage==='chat'?'chat':'home',loading:false});syncSelection()},
    reconnect(){connection.reconnect()},
    close(){if(disposed)return;disposed=true;nav++;pull++;controller?.abort();retention.close();offSessions();offConnection();listeners.clear()},
  }
}
