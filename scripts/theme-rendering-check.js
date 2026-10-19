// Run only in the owned mock-bench profile with a synthetic transcript.
async page=>{
  if(new URL(page.url()).origin!=='http://127.0.0.1:3298')throw Error('Use only the owned loopback mock-bench');
  const results=[];
  const ratio=(a,b)=>{
    const luminance=value=>value.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    const first=luminance(a),second=luminance(b);return (Math.max(first,second)+.05)/(Math.min(first,second)+.05);
  };
  const sample=async selectors=>page.evaluate(selectors=>Object.fromEntries(Object.entries(selectors).map(([name,selector])=>{const node=document.querySelector(selector);if(!node)throw Error('Missing '+name);const style=getComputedStyle(node);return[name,{color:style.color,background:style.backgroundColor}]})),selectors);
  const assertPair=(name,foreground,background)=>{const contrast=ratio(foreground,background);if(contrast<4.5)throw Error(name+' contrast '+contrast);return{name,foreground,background,contrast:Number(contrast.toFixed(2))};};
  const back=page.getByRole('button',{name:'返回会话列表',exact:true});
  if(await back.isVisible())await back.click();
  await page.locator('.dsm-theme-toggle').waitFor({state:'visible'});
  for(const scheme of ['dark','light']){
    if(await page.evaluate(()=>document.documentElement.dataset.dsThemeSource)!==scheme){await page.locator('.dsm-theme-toggle').click();await page.waitForTimeout(400);}
    const home=await sample({surface:'.dsm-home',main:'.dsm-row-copy strong',secondary:'.dsm-row-copy small',icon:'.dsm-theme-toggle',search:'.dsm-search input',searchSurface:'.dsm-search'});
    const checks=['main','secondary','icon','search'].map(name=>assertPair(scheme+' '+name,home[name].color,name==='icon'?home.icon.background:name==='search'?home.searchSurface.background:home.surface.background));
    await page.locator('.dsm-row').first().click();await back.waitFor({state:'visible'});await page.locator('[data-composer-input]').waitFor({state:'visible'});await page.locator('.bt-ubody').first().waitFor({state:'visible'});
    const conversation=await sample({bubble:'.bt-bubble',user:'.bt-ubody',input:'[data-composer-input]',inputCard:'[data-composer-card]',back:'.dsm-bar>button'});
    checks.push(assertPair(scheme+' assistant',conversation.bubble.color,conversation.bubble.background),assertPair(scheme+' user',conversation.user.color,conversation.user.background),assertPair(scheme+' composer',conversation.input.color,conversation.inputCard.background),assertPair(scheme+' back',conversation.back.color,conversation.back.background));
    results.push({scheme,checks});await back.click();await page.locator('.dsm-theme-toggle').waitFor({state:'visible'});
  }
  return{renderedContrastChecks:results.flatMap(result=>result.checks).length,results};
}
