const {chromium}=require('playwright');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await browser.newPage();
    await page.goto('file:///'+path.resolve('index.html').replaceAll('\\','/'));
    await page.evaluate(()=>{Pokemon.open();document.querySelector('[data-poke="types"]').click();});
    for(const [width,height] of [[960,540],[1280,720],[1920,1080],[2560,1440],[3840,2160]]) {
      await page.setViewportSize({width,height});
      await page.waitForTimeout(50);
      let smallest=Infinity, largest=0;
      for(let i=0;i<18;i++) {
        await page.locator(`[data-poke="matchup-type"][data-value="${i}"]`).click();
        const report=await page.evaluate(()=>{
          const root=document.getElementById('pokemonContent'),bounds=root.getBoundingClientRect(),errors=[],sizes=[];
          if(root.scrollHeight>root.clientHeight+1)errors.push('page requires scrolling');
          for(const icon of root.querySelectorAll('.poke-card-type')) {
            const b=icon.getBoundingClientRect();
            if(b.left<bounds.left-1||b.top<bounds.top-1||b.right>bounds.right+1||b.bottom>bounds.bottom+1)errors.push('icon outside page');
            const group=icon.closest('.poke-multiplier-group');
            if(group){const r=group.getBoundingClientRect();sizes.push(b.width);if(b.left<r.left-1||b.right>r.right+1||b.top<r.top-1||b.bottom>r.bottom+1)errors.push('icon outside multiplier group');}
          }
          const preferred=Math.floor(Math.min(innerWidth*.06,innerHeight*.11));
          for(const group of root.querySelectorAll('.poke-single-matchups .poke-multiplier-group > div')) {
            const icons=group.querySelectorAll('.poke-card-type');if(!icons.length)continue;
            const size=icons[0].getBoundingClientRect().width;
            if(size<preferred){const gap=parseFloat(getComputedStyle(group).gap)||0,next=size+1,columns=Math.max(1,Math.floor((group.clientWidth+gap)/(next+gap))),rows=Math.ceil(icons.length/columns);if(next<=group.clientWidth&&rows*next+(rows-1)*gap<=group.clientHeight)errors.push('icons unnecessarily reduced');}
          }
          return {errors,sizes};
        });
        assert.deepEqual(report.errors,[],`${width}x${height}, type ${i+1}`);
        smallest=Math.min(smallest,...report.sizes);largest=Math.max(largest,...report.sizes);
      }
      console.log(`PASS: all 18 types fit ${width}x${height}; matchup icons ${smallest}–${largest}px`);
      if(width===1280){await page.locator('[data-poke="matchup-type"][data-value="8"]').click();if(process.env.TYPE_ICON_PREVIEW)await page.screenshot({path:process.env.TYPE_ICON_PREVIEW});await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-poke="matchup-type"][aria-pressed="true"]').getAttribute('data-value'),'9');}
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
