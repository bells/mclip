async (page) => {
 const locales=[['zhCn','置顶数量上限','置顶已达上限'],['en','Maximum Pins','Pin limit reached'],['ja','ピン留めの上限','ピン留めの上限に達しました']];
 for(const [lang,label,title] of locales){
  await page.setViewportSize({width:860,height:720});
  await page.goto('http://127.0.0.1:1474/?window=preferences&theme=dark&lang='+lang);
  await page.getByRole('searchbox').fill(label);
  await page.getByRole('button',{name:new RegExp('^'+label)}).click();
  const input=page.getByRole('spinbutton',{name:label,exact:true});await input.waitFor();
  if(await input.inputValue()!=='10')throw Error('localized preference');
  await page.goto('http://127.0.0.1:1474/?window=main&theme=dark&lang='+lang);
  await page.setViewportSize({width:320,height:650});await page.getByRole('button',{name:'1. Synthetic history 3',exact:true}).waitFor();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>window.__pinFixture.notice({code:'pinnedHistoryLimitReached',current:20,max:20}));
  await page.waitForFunction(()=>{const t=document.querySelector('[data-sonner-toast]');return t&&getComputedStyle(t).opacity==='1'&&t.getBoundingClientRect().bottom<=innerHeight;});
  const toast=page.locator('[data-sonner-toast]');
  if(!(await toast.textContent()).includes(title))throw Error('localized toast');
  if(await page.locator('[aria-live="polite"]').count()<1)throw Error('no live region');
  await page.screenshot({path:'/tmp/mclip-pin-'+lang+'-dark.png'});
  await page.evaluate(()=>window.__pinFixture.notice({code:'unexpected',message:'DO_NOT_RENDER_PRIVATE_DETAIL'}));
  await page.waitForFunction(()=>!document.querySelector('[data-sonner-toast]')?.textContent.includes('(20/20)'));
  if((await toast.textContent()).includes('DO_NOT_RENDER_PRIVATE_DETAIL'))throw Error('unsafe fallback');
 }
 await page.goto('http://127.0.0.1:1474/?window=main&pins=20');
 await page.setViewportSize({width:320,height:450});
 await page.getByRole('button',{name:'1. Synthetic history 20',exact:true}).waitFor();
 const scroll=await page.evaluate(()=>Array.from(document.querySelectorAll('*')).filter(e=>getComputedStyle(e).overflowY==='auto'&&e.scrollHeight>e.clientHeight).map(e=>({tag:e.tagName,height:e.clientHeight,scrollHeight:e.scrollHeight})));
 if(!scroll.length)throw Error('no scroll region');
 await page.getByRole('button',{name:'1. Synthetic history 20',exact:true}).scrollIntoViewIfNeeded();
 const row=await page.getByRole('button',{name:'1. Synthetic history 20',exact:true}).boundingBox();
 if(row.y<0||row.y+row.height>450)throw Error('ordinary row inaccessible');
 await page.screenshot({path:'/tmp/mclip-pin-small-screen.png'});
 console.log('PASS locale search/toasts/fallback/live region and 20 pin scroll');
}
