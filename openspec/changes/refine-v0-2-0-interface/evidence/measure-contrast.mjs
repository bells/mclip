import {readFile,writeFile} from 'node:fs/promises';
const css=await readFile('src/styles.css','utf8');
const over=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])).concat(1);
const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
function parse(value){if(value.startsWith('#'))return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)).concat(1);if(value.startsWith('rgba('))return value.match(/[\d.]+/g).map(Number);}
const result=[];
for(const [theme,selector] of [['dark',':root'],['light',':root[data-app-theme="light"]']]){
 const block=css.slice(css.indexOf(selector)+selector.length).split('}')[0];
 const tokens=Object.fromEntries([...block.matchAll(/--mclip-([\w-]+):\s*([^;]+);/g)].map(([,k,v])=>[k,parse(v)]));
 const minima=new Map();
 const record=(role,a,b,min,context)=>{const value=ratio(a,b);if(!minima.has(role)||value<minima.get(role).ratio)minima.set(role,{role,ratio:value,minimum:min,context});};
 for(const backdrop of [[0,0,0,1],[255,255,255,1]])for(const surface of ['surface-translucent','surface-raised','panel','base']){
  const bg=over(tokens[surface],backdrop);
  for(const state of ['default','control-bg','control-bg-hover','selection']){
   const fill=state==='default'?bg:over(tokens[state],bg);
   for(const token of ['ink','ink-soft','ink-dim'])record(token,tokens[token],fill,4.5,`${surface}/${state}/${backdrop[0]}`);
   for(const token of ['focus','line-strong'])record(token,tokens[token],fill,3,`${surface}/${state}/${backdrop[0]}`);
   if(state!=='selection')for(const token of ['accent-cool','meta','danger'])record(token,tokens[token],fill,4.5,`${surface}/${state}/${backdrop[0]}`);
  }
  record('error text',tokens.danger,over([...tokens.danger.slice(0,3),.1],bg),4.5,`${surface}/error/${backdrop[0]}`);
 }
 for(const [foreground,background] of [['on-control-active','control-active'],['on-danger-action','danger']])record(foreground,tokens[foreground],tokens[background],4.5,background);
 result.push({theme,minima:[...minima.values()].map(r=>({...r,ratio:Number(r.ratio.toFixed(2)),pass:r.ratio>=r.minimum}))});
}
await writeFile(new URL('./contrast.json',import.meta.url),JSON.stringify({method:'CSS token alpha composition over white/black; states use actual semantic roles. Decorative separators and disabled controls are excluded from WCAG thresholds. Native wallpaper sampling remains pending.',result},null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(result.some(r=>r.minima.some(m=>!m.pass)))process.exitCode=1;
