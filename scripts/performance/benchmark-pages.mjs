import {execFile} from "node:child_process";
import {mkdtemp, readFile, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {promisify} from "node:util";
import {createPerformanceFixture} from "./create-fixture.mjs";
import {spawnPerformanceApp, stopPerformanceApp} from "./launch-app.mjs";

const exec = promisify(execFile);
const options = {count:1000, runs:20, warmups:5};
for (let i=2; i<process.argv.length; i+=2) {
  const key=process.argv[i].replace(/^--/, "");
  if (!["binary","count","runs","warmups","output","actions","resource-seconds"].includes(key)) throw new Error("Unknown benchmark option");
  options[key]=["count","runs","warmups"].includes(key)?Number(process.argv[i+1]):process.argv[i+1];
}
if (!options.binary?.includes(".app/Contents/MacOS/") || !path.isAbsolute(options.binary)) throw new Error("An absolute macOS app binary is required");
if (![options.count, options.runs, options.warmups].every(Number.isInteger) || options.runs<1 || options.warmups<0) throw new Error("Invalid sample counts");
try { await exec("pgrep", ["-x","mclip"]); throw new Error("Existing mclip instance; do not run benchmark"); }
catch (error) { if (error.code !== 1) throw error; }
const root=await mkdtemp(path.join(tmpdir(),"mclip-page-benchmark-"));
const fixture=await createPerformanceFixture({count:options.count,outputDir:path.join(root,"fixture")});
fixture.settings.language="en";
await writeFile(path.join(fixture.fixtureRoot,"settings.json"),JSON.stringify(fixture.settings));
const tracePath=path.join(root,"trace.jsonl");
const environment={MCLIP_PERF_CONFIG_DIR:fixture.fixtureRoot,MCLIP_PERF_FIXTURE_SIZE:String(options.count),MCLIP_PERF_MODE:"1",MCLIP_PERF_TRACE_PATH:tracePath};
const allowedActions=["about","preferences","preferences-general","preferences-appearance","preferences-save","preferences-history","preferences-privacy","preferences-text-actions","preferences-cli","preferences-search","quick-action"];
const actions=options.actions ? options.actions.split(",") : allowedActions;
if (!actions.length || actions.some(action=>!allowedActions.includes(action)) || new Set(actions).size!==actions.length) throw new Error("Invalid page actions");
const samples=Object.fromEntries(actions.map(action=>[action,[]]));
const firstUse={};
async function records() {
  try { return (await readFile(tracePath,"utf8")).trim().split("\n").filter(Boolean).map(line=>JSON.parse(line)); }
  catch(error) { if(error.code==="ENOENT") return []; throw error; }
}
async function until(predicate, name) {
  const deadline=performance.now()+12000;
  while(performance.now()<deadline) {
    const value=predicate(await records());
    if(value) return value;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error(`page benchmark timed out: ${name}`);
}
function summarize(values) {
  const sorted=values.toSorted((a,b)=>a-b);
  return {medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.ceil(sorted.length*.95)-1],values};
}
const resourceSeconds=Number(options["resource-seconds"]??0);
if (!Number.isInteger(resourceSeconds) || resourceSeconds<0 || resourceSeconds>300) throw new Error("Invalid resource interval");
const resources={scope:"mclip host process only; WebKit helpers are not attributed; fixture disables clipboard watcher",intervalSeconds:resourceSeconds};
async function hostResource() {
  const {stdout:pid}=await exec("pgrep",["-x","mclip"]);
  if (!/^\d+$/.test(pid.trim())) throw new Error("Resource sampling requires one mclip process");
  const {stdout}=await exec("ps",["-p",pid.trim(),"-o","time=,rss="]);
  const [time,rss]=stdout.trim().split(/\s+/);
  const cpuSeconds=time.split(":").reduce((total,part)=>total*60+Number(part),0);
  return {wallMs:performance.now(),cpuSeconds,rssKiB:Number(rss)};
}
async function idleResource() {
  const start=await hostResource();
  await new Promise(resolve=>setTimeout(resolve,resourceSeconds*1000));
  const end=await hostResource();
  return {startRssKiB:start.rssKiB,endRssKiB:end.rssKiB,cpuPercent:(end.cpuSeconds-start.cpuSeconds)/(end.wallMs-start.wallMs)*100000,elapsedMs:end.wallMs-start.wallMs};
}
const child=spawnPerformanceApp(options.binary,environment);
try {
  await until(rows=>rows.some(r=>r.clock==="rust"&&r.milestone==="trayReady"),"trayReady");
  if(resourceSeconds) {
    await until(rows=>rows.some(r=>r.clock==="rust"&&r.milestone==="pageProbeReady"&&r.windowLabel==="main"),"mainProbeReady");
    resources.initialHiddenIdle=await idleResource();
  }
  const activeStart=resourceSeconds?await hostResource():null;
  for(let round=0;round<1+options.warmups+options.runs;round++) {
    for(const action of actions) {
      const start=(await records()).length;
      await exec(options.binary,[`--mclip-performance-page=${action}`],{env:{...process.env,...environment},timeout:5000});
      const metric=await until(rows=>{
        const request=rows.slice(start).find(r=>r.clock==="rust"&&r.milestone==="pageRequest");
        if(!request) return null;
        const completion=rows.find(r=>r.clock==="rust"&&r.milestone==="pagePainted"&&r.interactionId===request.interactionId);
        if(!completion) return null;
        if(completion.outcome!=="success" || completion.windowLabel!==request.windowLabel) throw new Error(`page probe failed: ${action}`);
        const dispatch=rows.find(r=>r.clock==="rust"&&r.milestone==="pageDispatchReady"&&r.interactionId===request.interactionId);
        return {responseMs:completion.elapsedMs-request.elapsedMs,dispatchMs:dispatch.elapsedMs-request.elapsedMs,snapshotReads:rows.slice(start).filter(r=>r.clock==="rust"&&r.milestone==="historySnapshotRead").length};
      },action);
      if(round===0) firstUse[action]=metric;
      else if(round>options.warmups) samples[action].push(metric);
    }
    process.stderr.write(`page round ${round+1}/${1+options.warmups+options.runs}\n`);
  }
  if(activeStart) {
    const end=await hostResource();
    resources.pageSequence={startRssKiB:activeStart.rssKiB,endRssKiB:end.rssKiB,cpuPercent:(end.cpuSeconds-activeStart.cpuSeconds)/(end.wallMs-activeStart.wallMs)*100000,elapsedMs:end.wallMs-activeStart.wallMs};
    resources.finalPageVisibleIdle=await idleResource();
  }
  const report={resources,platform:`${process.platform}-${process.arch}`,fixtureSize:options.count,runs:options.runs,warmups:options.warmups,
    evidence:"native release WebKit, actual React controls, synthetic fixture; request to visible-window double-rAF receipt; system clipboard watcher disabled; no copy/replace/install operations",
    firstUse,metrics:Object.fromEntries(actions.map(action=>[action,{response:summarize(samples[action].map(r=>r.responseMs)),dispatch:summarize(samples[action].map(r=>r.dispatchMs)),snapshotReads:samples[action].map(r=>r.snapshotReads)}]))};
  await writeFile(options.output??path.join(root,"pages.json"),JSON.stringify(report,null,2)+"\n");
  process.stdout.write(JSON.stringify({firstUse,medians:Object.fromEntries(actions.map(a=>[a,report.metrics[a].response.medianMs]))},null,2)+"\n");
} finally { await stopPerformanceApp(options.binary,child); }
