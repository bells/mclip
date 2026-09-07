import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url),dir=mkdtempSync(join(tmpdir(),'mclip-icon-comparison-'));
try {
 const old=execFileSync('git',['show','9386d2a:src-tauri/icons/menu-bar-icon-m.svg'],{encoding:'utf8'});
 const current=readFileSync('src-tauri/icons/menu-bar-icon-m.svg','utf8');
 const cells=[];
 for(const [name,source] of [['Before',old],['After',current]]){
  const input=join(dir,name+'.svg'),output=join(dir,name);writeFileSync(input,source);
  execFileSync(process.execPath,[require.resolve('@tauri-apps/cli/tauri.js'),'icon',input,'--output',output,'--png','16','--png','18','--png','22']);
  for(const [sizeIndex,size] of [16,18,22].entries())for(const [row,background] of ['#f8fbfa','#15181b'].entries()){
   const col=sizeIndex*2+(name==='After'?1:0),x=20+col*125,y=72+row*205;
   const url='data:image/png;base64,'+readFileSync(join(output,`${size}x${size}.png`)).toString('base64');
   cells.push(`<g><rect x="${x}" y="${y}" width="116" height="175" rx="8" fill="${background}"/><text x="${x+8}" y="${y+19}" fill="${row?'#eee':'#222'}" font-size="12">${name} ${size}px</text><image href="${url}" x="${x+12}" y="${y+33}" width="${size}" height="${size}" ${row?'filter="url(#white)"':''}/><image href="${url}" x="${x+10}" y="${y+68}" width="96" height="96" image-rendering="pixelated" ${row?'filter="url(#white)"':''}/></g>`);
  }
 }
 writeFileSync(new URL('./icon-comparison.svg',import.meta.url),`<svg xmlns="http://www.w3.org/2000/svg" width="780" height="500" viewBox="0 0 780 500"><defs><filter id="white"><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter></defs><rect width="780" height="500" fill="#dce5e1"/><text x="20" y="28" font-size="18" font-family="system-ui">Notebook m: 1.09 optical scale</text><text x="20" y="50" font-size="12" font-family="system-ui">Actual 16/18/22px + enlarged raster. Dark row simulates Template tint, not native OS evidence.</text>${cells.join('')}</svg>`);
} finally {rmSync(dir,{recursive:true,force:true});}
