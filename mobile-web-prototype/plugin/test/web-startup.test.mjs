import test from 'node:test'
import assert from 'node:assert/strict'
import {MessageChannel} from 'node:worker_threads'
import vm from 'node:vm'
import {installAssetWorker,renderMobileStartup,applyWebStartup,clearMobileAssetCache,versionedCodeKind,WORKER_PATH} from '../web-startup.mjs'

function fixture({broken=false,failWrites=0,response=()=>new Response('asset',{headers:{'content-type':'text/javascript'}})}={}){
  const events={},stores=new Map(),network=[]
  const cache={async match(request){return stores.get(request.url)?.clone()},async put(request,value){if(failWrites-->0)throw Error('quota');stores.set(request.url,value)},async keys(){return [...stores.keys()].map(url=>new Request(url))},async delete(request){return stores.delete(request.url)}}
  const removed=[];let unregistered=0
  const worker={location:{origin:'https://fixture.invalid'},registration:{async unregister(){unregistered++}},caches:{async open(){if(broken)throw Error('quota');return cache},async keys(){return ['other-app','ds-bot-mobile-web-assets-v0','ds-bot-mobile-web-assets-v1']},async delete(key){removed.push(key);if(key==='ds-bot-mobile-web-assets-v1')stores.clear()}},clients:{async claim(){}},async skipWaiting(){},async fetch(request){network.push(request.url??request.href);return response(request)},addEventListener(type,callback){events[type]=callback}}
  installAssetWorker(worker)
  async function fetchAsset(path,extra={}){
    const request=Object.assign({url:new URL(path,worker.location.origin).href,method:'GET',mode:'cors',cache:'default'},extra)
    const tasks=[];let result
    events.fetch({request,respondWith(value){result=value},waitUntil(value){tasks.push(value)}})
    const value=await result;await Promise.all(tasks);return value
  }
  return {events,network,stores,removed,worker,fetchAsset,unregistered:()=>unregistered}
}

test('a second versioned asset read uses local bytes while a new version still goes to the host',async()=>{
  const f=fixture()
  assert.equal(await (await f.fetchAsset('/assets/index-12345678.js')).text(),'asset')
  assert.equal(await (await f.fetchAsset('/assets/index-12345678.js')).text(),'asset')
  await f.fetchAsset('/assets/index-abcdefgh.js')
  assert.equal(f.network.length,2)
})

test('documents, authentication, API, plugins, external URLs and forced reloads never enter the cache',async()=>{
  const f=fixture()
  for(const [path,extra] of [['/',{mode:'navigate'}],['/?token=private',{}],['/api/sessions',{}],['/plugins/batch.js?rev=12345678',{}],['/assets/index-12345678.js?token=private',{}],['/assets/plain.js',{}],['https://other.invalid/assets/index-12345678.js',{}],['/assets/index-12345678.js',{method:'POST'}],['/assets/index-12345678.js',{cache:'no-store'}],['/assets/index-12345678.js',{cache:'reload'}]])assert.equal(await f.fetchAsset(path,extra),undefined)
  assert.deepEqual(f.network,['https://fixture.invalid/ds-bot-mobile-web-worker.js']);assert.equal(f.stores.size,0)
})

test('storage denial and noncacheable host responses do not prevent successful network delivery',async()=>{
  const denied=fixture({broken:true});assert.equal(await (await denied.fetchAsset('/assets/index-12345678.js')).text(),'asset')
  for(const response of [()=>new Response('auth',{status:401}),()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}}),()=>new Response('asset',{headers:{'content-type':'text/javascript','cache-control':'no-store'}})]){
    const f=fixture({response});await f.fetchAsset('/assets/index-12345678.js');await f.fetchAsset('/assets/index-12345678.js');assert.equal(f.network.length,2);assert.equal(f.stores.size,0)
  }
})

test('a failed quota write leaves network delivery usable and later writes recover',async()=>{
  const f=fixture({failWrites:1})
  for(let i=0;i<3;i++)assert.equal(await(await f.fetchAsset('/assets/index-12345678.js')).text(),'asset')
  assert.equal(f.network.length,2);assert.equal(f.stores.size,1)
})

test('cache eviction is bounded and activation only deletes this plugin old caches',async()=>{
  const f=fixture()
  for(let i=0;i<35;i++)await f.fetchAsset(`/assets/chunk-${String(i).padStart(8,'0')}.js`)
  assert.equal(f.stores.size,16)
  let done;f.events.activate({waitUntil(value){done=value}});await done
  assert.deepEqual(f.removed,['ds-bot-mobile-web-assets-v0'])
})

test('only exact revision-addressed public plugin code joins the persistent cache',async()=>{
  const first='/plugins/??@deepseek-ai/dsh-client-ui-chat/client.js,ds-bot/client.js&rev=012345abcdef'
  const second=first.replace('012345abcdef','fedcba543210')
  const f=fixture({response:()=>new Response('code',{headers:{'content-type':'text/javascript','cache-control':'public, max-age=31536000, immutable'}})})
  for(const path of [first,first,second,second])assert.equal(await(await f.fetchAsset(path)).text(),'code')
  assert.equal(f.network.length,2)
  for(const invalid of [first+'&token=private',first+'&rev=012345abcdef',first.replace('client.js,','client.js.map,'),first.replace('012345abcdef','short'),'/api/plugins?rev=012345abcdef','/plugins/??ds-bot/client.js&token=012345abcdef']){
    assert.equal(versionedCodeKind(invalid,'https://fixture.invalid'),undefined)
    assert.equal(await f.fetchAsset(invalid),undefined)
  }
  assert.equal(versionedCodeKind('/plugins/@scope/plugin/client.lazy-123.js?rev=012345abcdef','https://fixture.invalid'),'plugin')
})

test('a plugin resource without public immutable permission is always read from the host',async()=>{
  for(const policy of ['no-store','private, immutable','public, max-age=31536000','immutable','public, immutable, no-store']){
    const f=fixture({response:()=>new Response('code',{headers:{'content-type':'text/javascript','cache-control':policy}})})
    for(let i=0;i<2;i++)await f.fetchAsset('/plugins/??ds-bot/client.js&rev=012345abcdef')
    assert.equal(f.stores.size,0);assert.equal(f.network.length,2)
  }
})

test('idle warmup rejects arbitrary URLs and stores only safe public versioned files',async()=>{
  const f=fixture();let done
  f.events.message({data:{type:'ds-bot-mobile-web/warm',paths:['/api/session','/?token=private','https://other.invalid/assets/index-12345678.js','/assets/index-12345678.js']},waitUntil(value){done=value}})
  await done;assert.deepEqual(f.network,['https://fixture.invalid/assets/index-12345678.js'])
})

test('removing the server plugin retires its cache on navigation without taking over the document',async()=>{
  const f=fixture({response:request=>new Response('',{status:(request.url??request.href).endsWith(WORKER_PATH)?404:200,headers:{'content-type':'text/javascript'}})})
  await f.fetchAsset('/assets/index-12345678.js');assert.equal(f.stores.size,1)
  assert.equal(await f.fetchAsset('/',{mode:'navigate'}),undefined)
  assert.equal(f.unregistered(),1);assert.equal(f.stores.size,0)
  assert.equal(await f.fetchAsset('/assets/index-12345678.js'),undefined)
})

test('explicit disable preserves another app active or pending worker and only removes this plugin caches',async()=>{
  for(const otherWaiting of [false,true]){
    let unregistered=0;const deleted=[]
    const own={scriptURL:'https://fixture.invalid'+WORKER_PATH},other={scriptURL:'https://fixture.invalid/other.js'}
    await clearMobileAssetCache({location:{origin:'https://fixture.invalid'},navigator:{serviceWorker:{async getRegistration(){return {active:own,waiting:otherWaiting?other:null,async unregister(){unregistered++}}}}},caches:{async keys(){return ['other-app','ds-bot-mobile-web-assets-v1']},async delete(key){deleted.push(key)}}})
    assert.equal(unregistered,otherWaiting?0:1);assert.deepEqual(deleted,['ds-bot-mobile-web-assets-v1'])
  }
})

test('retire acknowledges disabling, cannot refill its cache and preserves a newly waiting owner',async()=>{
  const f=fixture();await f.fetchAsset('/assets/index-12345678.js')
  f.worker.registration.waiting={scriptURL:'https://fixture.invalid/other-worker.js'}
  let done,ack=false
  f.events.message({data:{type:'ds-bot-mobile-web/retire'},ports:[{postMessage(){ack=true}}],waitUntil(value){done=value}})
  await done;assert.equal(ack,true);assert.equal(f.unregistered(),0);assert.equal(f.stores.size,0)
  await f.fetchAsset('/assets/index-12345678.js');assert.equal(f.stores.size,0)
})

test('disable rechecks worker ownership after awaiting the active worker acknowledgement',async()=>{
  let unregistered=0
  const registration={active:{scriptURL:'https://fixture.invalid'+WORKER_PATH,postMessage(_,ports){registration.waiting={scriptURL:'https://fixture.invalid/other.js'};ports[0].postMessage('retired')}},async unregister(){unregistered++}}
  await clearMobileAssetCache({MessageChannel,location:{origin:'https://fixture.invalid'},navigator:{serviceWorker:{async getRegistration(){return registration}}},caches:{async keys(){return []}}})
  assert.equal(unregistered,0)
})

test('the real loading layer is the first body child outside an existing React root',()=>{
  for(const [open,close] of [['<body>','</body>'],['<BODY class="host" data-label="a>b">','</BODY>']]){
    const root='<div id="root"><main>Existing host content</main></div>'
    const input='<HTML><HEAD><script src="plugins.js?token=private"></script><script src="./assets/index-12345678.js"></script></HEAD>'+open+root+close+'</HTML>'
    const result=renderMobileStartup(input)
    assert.ok(result.includes(open+'<div id="dsm-boot" role="status"'))
    assert.ok(result.indexOf('id="dsm-boot"')<result.indexOf(root))
    assert.ok(result.includes(root))
    assert.match(result,/<span class="dsm-boot-spinner" aria-hidden="true"><\/span><p data-dsm-boot-message>正在打开 DS Bot…<\/p>/)
    assert.match(result,/\["\/assets\/index-12345678.js"\]/)
    assert.equal((result.match(/token=private/g)??[]).length,1)
    assert.equal(renderMobileStartup(result),result)
    assert.equal(result.includes('html[data-dsm-boot]::before'),false)
    assert.equal(result.includes('html[data-dsm-boot]::after'),false)
  }
  const existing="<HTML><HEAD></HEAD><BODY><div id='dsm-boot'></div><div id='root'></div></BODY></HTML>"
  assert.equal(renderMobileStartup(existing),existing)
})

function startupFixture({mobile=true,enabled=true,reduced=false}={}){
  const rendered=renderMobileStartup('<html><head></head><body><div id="root"></div></body></html>')
  const script=[...rendered.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(code=>code.includes('function boot'))
  const html={dataset:{}},root={childElementCount:0},label={textContent:'正在打开 DS Bot…'}
  let layer=null,observerCallback,disconnected=false,time=0,id=0,removals=0
  const timers=new Map()
  const context={
    URL,isSecureContext:false,
    document:{documentElement:html,hidden:false,
      getElementById:id=>id==='root'?root:id==='dsm-boot'?layer:null,
      querySelector:()=>layer?label:null,
    },
    localStorage:{getItem:()=>enabled?'true':'false'},
    matchMedia:query=>({matches:query.includes('prefers-reduced-motion')?reduced:mobile}),
    location:{origin:'https://fixture.invalid'},navigator:{},caches:{async keys(){return []}},
    MutationObserver:class{
      constructor(callback){observerCallback=callback}
      observe(){}
      disconnect(){disconnected=true}
    },
    setTimeout(fn,delay){timers.set(++id,{fn,at:time+delay});return id},
    clearTimeout(id){timers.delete(id)},
  }
  context.window=context
  vm.runInNewContext(script,context)
  const advance=milliseconds=>{time+=milliseconds;for(const [id,timer] of [...timers])if(timer.at<=time){timers.delete(id);timer.fn()}}
  return {html,root,label,timers,advance,
    get layer(){return layer},get removals(){return removals},get disconnected(){return disconnected},
    parseBody(){layer={remove(){removals++;layer=null}};observerCallback?.()},
    mountHost(){root.childElementCount=1;observerCallback?.()},
    ready(){html.dataset.dsmReady='true';observerCallback?.()},
  }
}

test('early boot survives React mounting, updates a real status message and removes its own layer after fade',()=>{
  const f=startupFixture()
  assert.equal(f.html.dataset.dsmBoot,'true');assert.equal(f.layer,null)
  f.parseBody();const layer=f.layer
  f.mountHost();assert.equal(f.layer,layer);assert.equal(f.html.dataset.dsmBoot,'true')
  f.advance(10000)
  assert.equal(f.label.textContent,'连接较慢，正在等待电脑…')
  assert.equal(f.html.dataset.dsmBootMessage,f.label.textContent)
  f.ready()
  assert.equal(f.html.dataset.dsmBoot,'leaving');assert.equal(f.layer,layer)
  assert.equal(f.disconnected,true)
  f.advance(179);assert.equal(f.layer,layer)
  f.advance(1);assert.equal(f.layer,null);assert.equal(f.removals,1)
  assert.equal(f.html.dataset.dsmBoot,undefined);assert.equal(f.html.dataset.dsmBootMessage,undefined)
  assert.equal(f.root.childElementCount,1);assert.equal(f.timers.size,0)
})

test('disabled or desktop boot never activates a layer, while reduced motion removes it without a fade',()=>{
  for(const options of [{enabled:false},{mobile:false}]){
    const f=startupFixture(options);f.parseBody();f.mountHost()
    assert.equal(f.html.dataset.dsmBoot,undefined);assert.equal(f.timers.size,0)
  }
  const f=startupFixture({reduced:true});f.parseBody();f.mountHost();f.ready()
  assert.equal(f.layer,null);assert.equal(f.html.dataset.dsmBoot,undefined);assert.equal(f.timers.size,0)
  const rendered=renderMobileStartup('<html><head></head><body><div id="root"></div></body></html>')
  assert.match(rendered,/#dsm-boot\{display:none;/)
  assert.match(rendered,/@media\(max-width:767px\),\(max-width:1024px\) and \(max-height:500px\)\{html\[data-dsm-boot\] #dsm-boot\{display:flex\}\}/)
})

test('the mobile viewport covers safe areas before early boot measurements and remains unique',()=>{
  const viewport='<meta name="viewport" content="width=device-width, initial-scale=1" />'
  const result=renderMobileStartup('<html><head><script src="host.js"></script>'+viewport+'</head><body><div id="root"></div></body></html>')
  const tags=result.match(/<meta\b(?=[^>]*name="viewport")[^>]*>/g)
  assert.equal(tags.length,1)
  assert.match(tags[0],/width=device-width, initial-scale=1, viewport-fit=cover/)
  assert.ok(result.indexOf(tags[0])<result.indexOf('<script>'))
  assert.equal((result.match(/viewport-fit=cover/g)||[]).length,1)
  assert.match(result,/installMobileBrowserAppearance/)
})

test('official route serves an updatable worker and both route and index transform are disposed',()=>{
  const cleanup=[];let route,tap,removed=0
  applyWebStartup({effect(run){cleanup.push(run())},webServer:{tapIndex(fn){tap=fn;return()=>removed++},register(value){route=value;return()=>removed++}}})
  assert.equal(tap,renderMobileStartup);assert.equal(route.path,WORKER_PATH)
  for(const [method,status] of [['GET',200],['HEAD',200],['POST',405]]){
    const response={writeHead(code,headers){this.status=code;this.headers=headers},end(body){this.body=body}}
    route.handler({method},response);assert.equal(response.status,status);assert.equal(response.headers['cache-control'],'no-store')
    if(method==='GET')assert.match(response.body,/installAssetWorker/)
    if(method==='HEAD')assert.equal(response.body,undefined)
  }
  cleanup.forEach(fn=>fn());assert.equal(removed,2)
})
