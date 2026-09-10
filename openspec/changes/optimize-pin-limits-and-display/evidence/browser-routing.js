async (page) => {
 const main=await page.context().newPage();
 await main.setViewportSize({width:320,height:650});
 await main.goto('http://127.0.0.1:1474/?window=main');
 await main.getByRole('button',{name:'1. Synthetic history 3',exact:true}).waitFor();
 await page.getByRole('button',{name:'置顶这条历史',exact:true}).click();
 await main.waitForFunction(()=>document.querySelector('[data-sonner-toast]')?.dataset.mounted==='true');
 await main.waitForFunction(()=>{const t=document.querySelector('[data-sonner-toast]');return t&&getComputedStyle(t).opacity==='1'&&t.getBoundingClientRect().bottom<=innerHeight;});
 await main.screenshot({path:'/tmp/mclip-pin-toast-light.png'});
 const text=await main.locator('[data-sonner-toast]').textContent();if(!text.includes('(10/10)'))throw Error('route failed');
 if(await page.locator('[data-sonner-toast]').count()!==0)throw Error('preview host');
 const events=await page.evaluate(()=>window.__pinFixture.calls.filter(c=>c.cmd==='plugin:event|emit_to'&&c.args.event==='pin-failure'));
 if(events.length!==1||events[0].args.target.label!=='main')throw Error('target count '+JSON.stringify(events));
 await page.goto('http://127.0.0.1:1474/?window=preview-detail');
 await page.getByRole('button',{name:'置顶这条历史',exact:true}).click();
 await page.waitForFunction(()=>window.__pinFixture.calls.some(c=>c.args.event==='pin-failure'));
 const details=await page.evaluate(()=>window.__pinFixture.calls.filter(c=>c.args.event==='pin-failure'));
 if(details.length!==1||details[0].args.target.label!=='main')throw Error('detail target');
 await main.evaluate(()=>window.__pinFixture.setSettings({appearanceTheme:'dark'}));
 await main.screenshot({path:'/tmp/mclip-pin-toast-dark.png'});
 await page.goto('http://127.0.0.1:1474/?window=image-viewer');
 await page.getByRole('button',{name:'置顶这条历史',exact:true}).click();
 await page.locator('[data-sonner-toast]').waitFor();
 const viewer=await page.evaluate(()=>window.__pinFixture.calls.filter(c=>c.args.event==='pin-failure'));
 if(viewer.length!==1||viewer[0].args.target.label!=='image-viewer')throw Error('viewer target');
 await main.close();
 console.log('PASS preview/detail/viewer routing');
}
