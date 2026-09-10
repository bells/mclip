async (page) => {
 await page.setViewportSize({width:320,height:650});await page.goto('http://127.0.0.1:1474/?window=main&mixed');
 await page.getByRole('button',{name:'1. Synthetic history 3',exact:true}).waitFor();
 const pins=page.getByRole('img',{name:'已置顶',exact:true});if(await pins.count()!==3)throw Error('mixed pin markers');
 const heights=await pins.evaluateAll(es=>es.map(e=>e.closest('button').getBoundingClientRect().height));
 if(heights[0]!==28||heights[1]!==64||heights[2]!==28)throw Error('row heights '+JSON.stringify(heights));
 await page.screenshot({path:'/tmp/mclip-pin-mixed-light.png'});
 await page.evaluate(()=>window.__pinFixture.setSettings({appearanceTheme:'dark',showHistoryItemNumbers:false}));
 await page.getByRole('button',{name:'Synthetic history 3',exact:true}).waitFor();
 if(await pins.count()!==3)throw Error('numbers off markers');
 await page.screenshot({path:'/tmp/mclip-pin-mixed-dark.png'});
 await page.getByRole('textbox').focus();
 const targets=await page.locator('[data-main-keyboard-target]').evaluateAll(es=>es.map(e=>e.getAttribute('data-main-keyboard-target')).filter(v=>!v.includes('search')));
 for(const target of targets){await page.keyboard.press('ArrowDown');const focused=await page.evaluate(()=>document.activeElement.getAttribute('data-main-keyboard-target'));if(focused!==target)throw Error('navigation '+target+' vs '+focused);}
 await page.getByRole('textbox').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__pinFixture.calls.some(c=>c.cmd==='copy_history_item'&&c.args.id==='fixture-0'));
 await page.evaluate(()=>{document.body.dataset.fixtureHidden='false';window.__pinFixture.notice();});
 await page.locator('[data-sonner-toast]').waitFor();
 await page.waitForFunction(()=>document.querySelector('[data-sonner-toast]')?.dataset.mounted==='true');
 await page.waitForTimeout(5500);
 if(await page.locator('[data-sonner-toast]').count()!==1)throw Error('toast too short');
 await page.waitForFunction(()=>!document.querySelector('[data-sonner-toast]'),{timeout:5000});
}
