async (page) => {
 await page.goto('http://127.0.0.1:1474/?window=preferences');
 await page.getByRole('button',{name:'历史',exact:true}).click();
 const input=page.getByRole('spinbutton',{name:'置顶数量上限',exact:true});
 const saved=()=>page.evaluate(()=>window.__pinFixture.calls.filter(c=>c.cmd==='save_settings').map(c=>c.args.settings.maxPinnedItems));
 if(await input.inputValue()!=='10'||await input.getAttribute('min')!=='5'||await input.getAttribute('max')!=='20')throw Error('defaults');
 await input.fill('5');await page.waitForFunction(()=>window.__pinFixture.calls.some(c=>c.cmd==='save_settings'&&c.args.settings.maxPinnedItems===5));
 await input.fill('20');await page.waitForFunction(()=>window.__pinFixture.calls.some(c=>c.cmd==='save_settings'&&c.args.settings.maxPinnedItems===20));
 const count=(await saved()).length;
 for(const value of ['', '5.5']){await input.fill(value);await input.blur();if(await input.inputValue()!=='20')throw Error('invalid rollback '+value);}
 if((await saved()).length!==count)throw Error('invalid submitted');
 await input.fill('4');await input.blur();if(await input.inputValue()!=='5')throw Error('min clamp');
 await input.fill('21');await input.blur();if(await input.inputValue()!=='20')throw Error('max clamp');
 await page.screenshot({path:'/tmp/mclip-pin-preferences.png'});
 await page.goto('http://127.0.0.1:1474/?window=preferences&save=fail');
 await page.getByRole('button',{name:'历史',exact:true}).click();
 await page.getByRole('spinbutton',{name:'置顶数量上限',exact:true}).fill('5');
 await page.waitForFunction(()=>document.querySelector('input[aria-label="置顶数量上限"]')?.value==='10');
 await page.getByText('保存失败，请重试。',{exact:true}).waitFor();
 console.log('PASS preferences');
 await page.goto('http://127.0.0.1:1474/?window=preview');
}
