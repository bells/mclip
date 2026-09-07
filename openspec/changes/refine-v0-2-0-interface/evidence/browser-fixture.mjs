// Synthetic IPC only. Run from repository root with Node 24; never connects to Tauri.
import {createServer} from 'vite';
const script = `
const query=new URLSearchParams(location.search),label=query.get('window')||'preferences',language=query.get('lang')||'zhCn';
let settings={autoPaste:false,enabledHistoryTypes:{files:true,image:true,text:true},language,launchAtLogin:false,maxHistoryCount:200,menuBarIconStyle:'m',mainWindowItemCount:10,historyGroupItemCount:50,showHistoryItemNumbers:true,showMainWindowBrand:true,appearanceTheme:query.get('theme')||'light',maskSensitiveContent:true,ignoredSourceAppIds:[],textQuickActions:{json:true,base64:true,urlComponent:true}};
const callbacks=new Map(),listeners=new Map();let nextId=1,attempts=0,writes=0;
const emit=(event,payload)=>{for(const id of listeners.get(event)||[])callbacks.get(id)?.({event,id,payload});};
const item={id:'synthetic-1',renderId:'synthetic-1',position:1,kind:'text',text:'{\\n  "message": "Synthetic · 合成文本 · サンプル",\\n  "ready": true\\n}',firstCopiedAt:1788656400000,lastCopiedAt:1788660000000,copyCount:3,isPinned:false,pinnedAt:null,sourceApp:null,isSensitive:false,secretTypes:[],sensitiveDetectorVersion:null};
if(query.has('short'))item.text='合成短文本';
item.displayText=item.text;
if(query.has('masked')){item.text='••••••••';if(query.has('short'))item.text='合成短文本';
item.displayText=item.text;item.secretType='jwt';}
if(query.has('off'))settings.textQuickActions={json:false,base64:false,urlComponent:false};
const common=()=>({autoPaste:false,appearanceTheme:settings.appearanceTheme,language:settings.language,historyRevision:1,maskSensitiveContent:true,performanceInteractionId:null,textQuickActions:settings.textQuickActions});
const preview=()=>({...common(),kind:'item',item});
const result=()=>({...common(),action:'jsonPrettify',targetId:item.id,output:query.has('long')?Array(60).fill(item.text).join('\\n'):item.text,inputBytes:90,outputBytes:100});
const media=new EventTarget();media.matches=false;media.media='(prefers-color-scheme: dark)';const nativeMatch=window.matchMedia.bind(window);window.matchMedia=q=>q===media.media?media:nativeMatch(q);
window.__TAURI_INTERNALS__={metadata:{currentWindow:{label},currentWebview:{label}},transformCallback(cb){const id=nextId++;callbacks.set(id,cb);return id},unregisterCallback(id){callbacks.delete(id)},invoke:async(cmd,args={})=>{
 if(cmd==='plugin:event|listen'){listeners.set(args.event,[...(listeners.get(args.event)||[]),args.handler]);return args.handler;}
 if(cmd==='plugin:event|unlisten'){listeners.set(args.event,(listeners.get(args.event)||[]).filter(id=>id!==args.eventId));return;}
 if(cmd==='plugin:event|emit'||cmd==='plugin:event|emit_to'){emit(args.event,args.payload);return;}
 if(cmd==='resize_history_detail_window'){document.body.dataset.measuredHeight=args.previewHeight;return {x:0,y:0,side:'right'};}
 if(cmd==='get_settings')return settings;
 if(cmd==='save_settings'){if(query.get('save')==='fail')throw 'synthetic-save-failure';settings=args.settings;emit('settings-updated',settings);return settings;}
 if(cmd==='get_history_snapshot')return {revision:1,entries:[item]};
 if(cmd==='get_cli_install_status'){const state=query.get('cli')||'current';return {executableName:'mclip-cli',installCommand:'curl -fsSL https://www.mclip.cn/install.sh | sh',installDir:'/synthetic/bin',installPath:'/synthetic/bin/mclip-cli',installedVersion:state==='notInstalled'?null:'0.1.1',isInstalled:state!=='notInstalled',isOnPath:true,platformSupported:true,state,targetVersion:'0.1.1'};}
 if(cmd==='get_auto_paste_permission_status')return {isGranted:true,requiresPermission:true,appPath:'/synthetic/mclip.app',settingsUrl:null};
 if(cmd==='get_source_app_detection_status')return {capability:'available',reasonCode:'synthetic'};
 if(cmd==='get_desktop_capabilities')return null;
 if(cmd==='get_ignored_source_applications')return [];
 if(cmd==='plugin:app|version')return '0.1.1';
 if(cmd==='get_applicable_text_transform_actions'){attempts++;document.body.dataset.discoveryCalls=attempts; if(query.get('state')==='loading')await new Promise(r=>setTimeout(r,30000));if(query.get('state')==='error'&&attempts<=2)throw 'synthetic-failure';return query.get('state')==='empty'?[]:query.has('short')?['base64Encode','urlComponentEncode','urlComponentDecode']:['jsonPrettify','jsonMinify','base64Encode','urlComponentEncode'];}
 if(cmd==='transform_text')return {action:args.action,output:item.text,inputBytes:90,outputBytes:100};
 if(cmd==='plugin:window|is_maximized'||cmd==='toggle_image_viewer_maximize')return true;
 if(cmd==='plugin:window|hide'||cmd==='close_image_viewer'){document.body.dataset.fixtureHidden='true';return;}
 if(cmd==='copy_text_to_clipboard'||cmd==='replace_history_text'){document.body.dataset.writes=++writes;if(query.has('race'))setTimeout(()=>emit('quick-action-updated',{...result(),output:'NEW SYNTHETIC RESULT'}),100);await new Promise(r=>setTimeout(r,1500));if(query.get('write')==='fail')throw 'synthetic-write-failure';return;}
 if(cmd==='get_image_base64')throw 'synthetic-image-unavailable';
 return null;
}};
window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};
setTimeout(()=>{
 emit('quick-action-updated',result());
 emit('history-preview-updated',query.has('group')?{...common(),kind:'group',group:{index:0,label:'11–60',startPosition:11,endPosition:60},items:[item],showHistoryItemNumbers:true}:preview());
 emit('history-preview-detail-updated',preview());
 emit('image-viewer-updated',{...preview(),item:{...item,kind:'image',imagePath:'synthetic-image',width:640,height:480,byteSize:1200},isMaximized:true});
},600);
if(query.has('controls'))document.addEventListener('DOMContentLoaded',()=>{
 const bar=document.createElement('div');bar.style='position:fixed;bottom:0;left:0;z-index:99999;background:white;color:black;font:11px system-ui;';
 const add=(name,action)=>{const b=document.createElement('button');b.textContent=name;b.onclick=action;bar.append(b);};
 for(const scheme of ['light','dark'])add('Fixture OS '+scheme,()=>{media.matches=scheme==='dark';media.dispatchEvent(new Event('change'));});
 for(const theme of ['light','dark','system'])add('Fixture app '+theme,()=>{settings={...settings,appearanceTheme:theme};emit('settings-updated',settings);});
 add('Fixture new result',()=>emit('quick-action-updated',{...result(),output:'NEW SYNTHETIC RESULT'}));
 add('Fixture close preview',()=>emit('sensitive-reveal-reset',null));
 document.body.append(bar);
});
`;
const server=await createServer({configFile:'vite.config.ts',server:{host:'127.0.0.1',port:1473,strictPort:true},plugins:[{name:'synthetic-ipc',transformIndexHtml(){return [{tag:'script',children:script,injectTo:'head-prepend'}]}}]});
await server.listen();console.log('Synthetic browser fixture at http://localhost:1473');
