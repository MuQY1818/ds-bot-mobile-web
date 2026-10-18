// Isolated lifecycle fixture only. The public Connection owns admission; this
// module is excluded from the release package's exact file allowlist.
export const name='mobile-web-delivery-manager'
export const inject=['connection','pluginManager']
export function apply(ctx,config){
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/mobile-web-delivery',methods:['POST'],requestBody:'buffered',async fetch(request){
    const {operation,enabled}=await request.json()
    try{
      let value
      if(operation==='list')value=await ctx.pluginManager.listBundles()
      else if(operation==='plugins')value=await ctx.pluginManager.listPlugins()
      else if(operation==='install')value=await ctx.pluginManager.installBundle(config.archive,{enabled:false,saveExact:true,registry:'https://registry.npmjs.org'})
      else if(operation==='select'&&typeof enabled==='boolean')value=await ctx.pluginManager.setBundleEnabled('ds-bot-mobile-web',enabled)
      else if(operation==='remove')value=await ctx.pluginManager.removeBundle('ds-bot-mobile-web')
      else return Response.json({ok:false},{status:400})
      return Response.json({ok:true,value},{headers:{'cache-control':'no-store'}})
    }catch{return Response.json({ok:false},{status:503})}
  }}))
}
