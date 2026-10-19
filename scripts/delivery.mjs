import assert from 'node:assert/strict'
import {spawn,spawnSync} from 'node:child_process'
import {mkdir,mkdtemp,readFile,writeFile,chmod,access} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createServer} from 'node:net'
import {once} from 'node:events'
import {resolve,join} from 'node:path'
import {WEB_LAUNCH_IMAGES} from '../mobile-web-prototype/plugin/web-launch.mjs'

const root=resolve(import.meta.dirname,'..'),area=join(root,'scripts','.dsh-test-delivery')
await mkdir(area,{recursive:true,mode:0o700})
const fixtureHome=await mkdtemp(join(area,'run-'));await chmod(fixtureHome,0o700)
const profile=join(fixtureHome,'profiles','web');await mkdir(profile,{recursive:true})
const manifest=JSON.parse(await readFile(join(root,'mobile-web-prototype/plugin/package.json'),'utf8'))
const archive=resolve(process.argv[2]??join(root,'artifacts',`${manifest.name}-${manifest.version}.tgz`))
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const hashes=new Map(await Promise.all(['package.json',...manifest.files].map(async path=>[path,digest(await readFile(join(root,'mobile-web-prototype/plugin',path)))])))
const env={PATH:process.env.PATH,DSH_HOME:fixtureHome,TMPDIR:process.env.TMPDIR??'/tmp',LANG:'en_US.UTF-8',npm_config_registry:'https://registry.npmjs.org',npm_config_cache:join(area,'npm-cache')}
const children=[],delay=ms=>new Promise(done=>setTimeout(done,ms))
let host,base,cookie,passed=0
const pass=label=>{passed++;console.log('PASS '+label)}
function command(cmd,args,cwd){
  const result=spawnSync(cmd,args,{cwd,env,encoding:'utf8',timeout:600000,maxBuffer:8*1024*1024})
  if(result.status!==0)throw Object.assign(Error('Isolated package command failed'),{privateOutput:result.stdout+result.stderr})
  return result.stdout
}
async function until(run,ms=60000){
  const end=Date.now()+ms
  while(Date.now()<end){try{return await run()}catch{await delay(100)}}
  throw Error('Isolated delivery condition timed out')
}
async function port(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const value=server.address().port;await new Promise(done=>server.close(done));return value}
function start(label,args,extra={}){
  const child=spawn(process.execPath,args,{cwd:profile,env:{...env,...extra},stdio:['ignore','pipe','pipe']})
  const item={child,label,output:''};children.push(item)
  child.stdout.on('data',bytes=>{item.output+=bytes});child.stderr.on('data',bytes=>{item.output+=bytes});return item
}
async function stop(item){
  if(!item||item.child.exitCode!==null||item.child.signalCode!==null)return
  const done=once(item.child,'exit');item.child.kill('SIGTERM');const timer=setTimeout(()=>item.child.kill('SIGKILL'),5000)
  await done;clearTimeout(timer)
}
async function manager(operation,extra={}){
  const response=await fetch(base+'/api/mobile-web-delivery',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({operation,...extra}),signal:AbortSignal.timeout(45000)})
  assert.equal(response.status,200,'Official manager operation was refused')
  const result=await response.json();assert.equal(result.ok,true);return result.value
}
async function boot(mockPort,webPort){
  host=start('public-dsh',[join(profile,'node_modules/@deepseek-ai/dsh/lib/bin.js'),'--profile','web','--no-open','--port',String(webPort)],{DEEPSEEK_BASE_URL:`http://127.0.0.1:${mockPort}/v1`,DEEPSEEK_API_KEY:'mock-key'})
  const launch=await until(()=>{assert.equal(host.child.exitCode,null);const found=host.output.match(/dsh web: (http:\/\/[^\s]+\?token=[^\s]+)/);assert.ok(found);return found[1]})
  base=new URL(launch).origin
  const response=await fetch(launch,{redirect:'manual'});assert.ok([302,303].includes(response.status))
  cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join(';');assert.ok(cookie)
  await until(()=>manager('list'))
}
async function apply(result,mockPort,webPort){
  assert.ok(['applied','restart-required'].includes(result.application))
  if(result.application==='restart-required'){await stop(host);await boot(mockPort,webPort)}
}
async function exactPackage(){for(const [path,hash]of hashes)assert.equal(digest(await readFile(join(profile,'node_modules',manifest.name,path))),hash,'Installed package differs from the exact reviewed archive')}
async function phoneStatus(authenticated=true){return fetch(base+'/api/dsh-mobile-layout/phone-access',{method:'POST',headers:{...(authenticated?{cookie}:{}),origin:base,'content-type':'application/json'},body:'{"action":"status"}'})}
async function roster(){
  const response=await fetch(base+'/api/bot',{method:'POST',headers:{cookie,'content-type':'application/json'},body:'{"endpoint":"state","payload":{}}'})
  assert.equal(response.status,200);const value=await response.json();assert.equal(value.ok,true)
  return value.value.bots.map(bot=>({id:bot.id,sessionId:bot.sessionId})).sort((a,b)=>a.id.localeCompare(b.id))
}
try{
  await access(archive)
  const botRoot=join(root,'ds-bot-upstream/ds-bot')
  const [botPack]=JSON.parse(command('npm',['pack',botRoot,'--ignore-scripts','--json','--pack-destination',fixtureHome],root))
  command('npm',['install','--prefix',join(fixtureHome,'tools'),'--ignore-scripts','--no-audit','--no-fund','--registry=https://registry.npmjs.org','pnpm@10.12.1'],fixtureHome)
  env.PATH=join(fixtureHome,'tools/node_modules/.bin')+':'+env.PATH
  await writeFile(join(profile,'.npmrc'),`node-linker=hoisted\nregistry=https://registry.npmjs.org\nstore-dir=${join(area,'pnpm-store')}\n`)
  await writeFile(join(profile,'package.json'),JSON.stringify({name:'isolated-mobile-web-delivery',private:true,packageManager:'pnpm@10.12.1',dependencies:{'@deepseek-ai/dsh':'0.2.1-rc.2','ds-bot':`file:${join(fixtureHome,botPack.filename)}`},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app','ds-bot']}}}))
  await writeFile(join(profile,'cordis.patch.yml'),`- insert:\n    - id: mobile-web-delivery-manager\n      name: ${JSON.stringify(join(root,'scripts/delivery-manager.mjs'))}\n      config:\n        archive: ${JSON.stringify(archive)}\n`)
  console.log('Preparing a fresh public DSH profile and packed DS Bot with a mock model')
  command('pnpm',['install','--ignore-scripts','--registry=https://registry.npmjs.org'],profile)
  assert.equal(JSON.parse(await readFile(join(profile,'node_modules/@deepseek-ai/dsh/package.json'),'utf8')).version,'0.2.1-rc.2')
  const mockPort=await port(),webPort=await port()
  start('mock',[join(botRoot,'dev/mock-llm.mjs')],{MOCK_PORT:String(mockPort),MOCK_LOG:join(fixtureHome,'mock.jsonl'),MOCK_DELAY_MS:'100'})
  await boot(mockPort,webPort)
  const before=await until(async()=>{const bots=await roster();assert.ok(bots.length>0);return bots})
  assert.ok(!(await manager('list')).some(row=>row.name===manifest.name))
  const unauthorized=await fetch(base+'/api/mobile-web-delivery',{method:'POST',headers:{'content-type':'application/json'},body:'{"operation":"list"}'})
  assert.equal(unauthorized.status,401);pass('real Connection refuses unauthenticated management')
  try{await apply(await manager('install'),mockPort,webPort)}catch(error){
    if(!(error instanceof TypeError&&error.message==='fetch failed')&&error.name!=='TimeoutError')throw error
    await stop(host);await exactPackage();await boot(mockPort,webPort)
    console.log('INFO interrupted install response verified from exact persisted files after a controlled restart')
  }
  await exactPackage()
  assert.ok((await manager('list')).some(row=>row.name===manifest.name&&row.version===manifest.version&&row.enabled===false))
  pass('official manager installs the exact release archive without enabling it')
  assert.equal((await phoneStatus()).status,404)
  await apply(await manager('select',{enabled:true}),mockPort,webPort)
  assert.ok((await manager('plugins')).some(row=>row.moduleName===manifest.name))
  assert.equal((await phoneStatus()).status,200);assert.equal((await phoneStatus(false)).status,401)
  pass('standard bundle enable exposes only the authenticated phone-access route')
  const launch=await fetch(base+WEB_LAUNCH_IMAGES[0].path)
  assert.equal(launch.status,200);assert.equal(launch.headers.get('content-type'),'image/png')
  assert.match(launch.headers.get('cache-control'),/public.*immutable/)
  assert.deepEqual(Buffer.from(await launch.arrayBuffer()).subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]))
  const document=await fetch(base+'/',{headers:{cookie}});const html=await document.text()
  assert.match(html,/<body\b[^>]*><div id="dsm-boot"/i)
  assert.ok(html.includes('rel="apple-touch-startup-image"'))
  assert.ok(html.indexOf('id="dsm-boot"')<html.indexOf('id="root"'))
  pass('packed startup layer and public launch images are served by the real host')
  assert.deepEqual(await roster(),before);pass('enabling preserves the canonical Bot and Session identities')
  await apply(await manager('select',{enabled:false}),mockPort,webPort)
  assert.equal((await phoneStatus()).status,404);assert.deepEqual(await roster(),before)
  assert.equal((await fetch(base+WEB_LAUNCH_IMAGES[0].path)).status,404)
  pass('disabling removes the route and preserves the original team')
  await apply(await manager('select',{enabled:true}),mockPort,webPort)
  assert.equal((await phoneStatus()).status,200);await exactPackage()
  pass('re-enabling restores the same packed plugin')
  await apply(await manager('select',{enabled:false}),mockPort,webPort)
  try{await apply(await manager('remove'),mockPort,webPort)}catch(error){
    if(!(error instanceof TypeError&&error.message==='fetch failed')&&error.name!=='TimeoutError')throw error
    await stop(host)
    const remaining=JSON.parse(await readFile(join(profile,'package.json'),'utf8'));assert.ok(!Object.hasOwn(remaining.dependencies??{},manifest.name))
    await assert.rejects(access(join(profile,'node_modules',manifest.name,'package.json')),cause=>cause.code==='ENOENT')
    await boot(mockPort,webPort)
    console.log('INFO interrupted removal response verified from persisted package removal after a controlled restart')
  }
  assert.ok(!(await manager('list')).some(row=>row.name===manifest.name));assert.equal((await phoneStatus()).status,404);assert.deepEqual(await roster(),before)
  pass('official manager removes only Mobile Web and preserves the original team')
  for(const [path,hash]of hashes)assert.equal(digest(await readFile(join(root,'mobile-web-prototype/plugin',path))),hash,'Source changed during lifecycle validation')
  console.log(`${passed} packed Mobile Web lifecycle assertions passed`)
}catch(error){
  await writeFile(join(fixtureHome,'failure.log'),`${error.stack}\n${error.privateOutput??''}\n${children.map(item=>item.label+'\n'+item.output).join('\n')}`,{mode:0o600})
  throw Error('Mobile Web delivery failed; private diagnostics are retained only in the ignored test area')
}finally{for(const item of [...children].reverse())await stop(item);console.log(`CLEANUP all ${children.length} delivery child services stopped`)}
