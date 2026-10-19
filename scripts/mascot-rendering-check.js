// Run in the owned mock-bench with its default Chief / Research / Writer roster.
async page=>{
  if(new URL(page.url()).origin!=='http://127.0.0.1:3298')throw Error('Use only the owned loopback mock-bench');
  const back=page.getByRole('button',{name:'返回会话列表',exact:true});
  if(await back.isVisible())await back.click();
  await page.locator('.dsm-theme-toggle').waitFor({state:'visible'});
  const initialMode=await page.evaluate(()=>localStorage.getItem('ds-bot:surface'));
  const results=[];
  for(const scheme of ['light','dark']){
    if(await page.evaluate(()=>document.documentElement.dataset.dsThemeSource)!==scheme){await page.locator('.dsm-theme-toggle').click();await page.waitForTimeout(400);}
    const value=await page.evaluate(()=>{
      const mark=document.querySelector('.dsm-avatar .bt-mark');
      const svg=mark.querySelector('svg');
      const painted=[...svg.querySelectorAll('[fill]')].find(el=>el.getAttribute('fill').includes('--bt-ink-'));
      const row=mark.closest('.dsm-row').getBoundingClientRect(),star=mark.querySelector('.bt-badge-main'),starBox=star.getBoundingClientRect();
      const cluster=document.querySelector('.dsm-avatar .bt-cluster'),bounds=cluster.getBoundingClientRect();
      const clusterFits=[...cluster.children].every(el=>{const box=el.getBoundingClientRect();return box.left>=bounds.left-.5&&box.top>=bounds.top-.5&&box.right<=bounds.right+.5&&box.bottom<=bounds.bottom+.5});
      return{fill:getComputedStyle(painted).fill,mask:svg.querySelectorAll('mask').length,highlights:svg.querySelectorAll('[fill-opacity]').length,
        starFill:getComputedStyle(star.querySelector('path')).fill,starPosition:getComputedStyle(star).position,starWidth:starBox.width,starFits:starBox.top>=row.top&&starBox.bottom<=row.bottom,
        clusterPosition:getComputedStyle(cluster).position,clusterFits,mode:localStorage.getItem('ds-bot:surface'),upstreamShellMounted:Boolean(document.querySelector('style[data-dsh-bot=shell]'))};
    });
    // These are the canonical INKS.deepseek light/dark values in the pinned upstream.
    const expected=scheme==='dark'?'rgb(106, 132, 255)':'rgb(77, 107, 254)';
    if(value.fill!==expected||value.mask<1||value.highlights<1||value.starFill!=='rgb(255, 152, 0)'||value.starPosition!=='absolute'||value.starWidth<14||!value.starFits||value.clusterPosition!=='relative'||!value.clusterFits||value.mode!==initialMode)throw Error(JSON.stringify({scheme,value}));
    results.push({scheme,...value});
  }
  return{mascotChecks:results};
}
