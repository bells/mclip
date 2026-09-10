async (page) => {
 await page.goto('http://127.0.0.1:1474/?window=main');
 await page.setViewportSize({width:320,height:650});
 const search=page.getByRole('textbox');await search.waitFor();
 await page.getByRole('button',{name:'1. Synthetic history 3',exact:true}).waitFor();
 if(await page.getByRole('img',{name:'已置顶',exact:true}).count()!==3)throw Error('pin markers');
 await search.fill('history 1');await page.keyboard.press('1');
 if(await search.inputValue()!=='history 11')throw Error('editing guard');
 await search.fill('');await page.keyboard.press('ArrowDown');await page.keyboard.press('1');
 await page.waitForFunction(()=>window.__pinFixture.calls.some(c=>c.cmd==='copy_history_item'));
 const calls=await page.evaluate(()=>window.__pinFixture.calls.filter(c=>c.cmd==='copy_history_item'));
 if(calls[0].args.id!=='fixture-3')throw Error('numeric target '+JSON.stringify(calls));
 await page.evaluate(()=>{document.body.dataset.fixtureHidden='false';window.__pinFixture.notice();});
 const toast=page.locator('[data-sonner-toast]');await toast.waitFor();
 const box=await toast.boundingBox();if(box.x<0||box.x+box.width>321)throw Error('toast overflow '+JSON.stringify(box));
 await page.screenshot({path:'/tmp/mclip-pin-main-light.png'});
 const focusBefore=await page.evaluate(()=>document.activeElement.outerHTML);
 await page.evaluate(()=>window.__pinFixture.notice({code:'pinnedHistoryLimitReached',current:20,max:20}));
 await page.waitForFunction(()=>document.querySelector('[data-sonner-toast]')?.textContent.includes('(20/20)'));
 if(await toast.count()!==1)throw Error('toast stacked');
 if((await toast.textContent()).includes('提高'))throw Error('max cap advice');
 if(await page.evaluate(()=>document.activeElement.outerHTML)!==focusBefore)throw Error('toast focus');
 await page.evaluate(()=>window.__pinFixture.setSettings({showHistoryItemNumbers:false,appearanceTheme:'dark'}));
 await page.getByRole('button',{name:'Synthetic history 3',exact:true}).waitFor();
 if(await page.getByRole('img',{name:'已置顶',exact:true}).count()!==3)throw Error('hidden pin markers');
 await page.screenshot({path:'/tmp/mclip-pin-main-dark.png'});
 console.log('PASS: editing guard, digit copies fixture-3, pin markers, numbers off, max=20, single Toast, width/focus, light/dark');
 await page.goto('http://127.0.0.1:1474/?window=preferences');
}
