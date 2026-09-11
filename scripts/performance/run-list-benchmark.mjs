import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const playwright = process.env.MCLIP_PLAYWRIGHT_MODULE;
const {chromium} = await import(playwright ? pathToFileURL(path.resolve(playwright)).href : "playwright");
const root=path.resolve("src-tauri/target/list-benchmark");
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,"http://localhost");
    const file=path.resolve(root,"."+decodeURIComponent(url.pathname));
    if(!file.startsWith(root+path.sep)) throw new Error("Invalid path");
    const bytes=await readFile(file);
    res.setHeader("Content-Type",file.endsWith(".js")?"text/javascript":file.endsWith(".css")?"text/css":"text/html");
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
let browser;
try {
  browser=await chromium.launch({headless:true, executablePath:process.env.MCLIP_BROWSER_EXECUTABLE});
  const page=await browser.newPage({viewport:{width:640,height:800},deviceScaleFactor:2});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/list-benchmark.html`);
  await page.waitForFunction(()=>Boolean(window.mclipListBenchmark));
  const samples=[];
  for(const count of [10,50,500]) samples.push(await page.evaluate(count=>window.mclipListBenchmark.benchmark(count),count));
  assert.ok(samples.every(x=>x.react.samples.length===30));
  assert.ok(samples.every(x=>x.buttons===x.count));
  const first=page.locator("#root button").first();
  await page.evaluate(()=>window.mclipListBenchmark.resetEvents());
  await first.hover();
  await first.focus();
  await first.press("Enter");
  const events=await page.evaluate(()=>window.mclipListBenchmark.events());
  for(const source of ["pointer","focus","copy"]) assert.ok(events.some(x=>x.id==="fixture-0"&&x.source===source));
  assert.ok(events.filter(x=>x.anchor!==undefined).every(x=>Number.isFinite(x.anchor)));
  assert.deepEqual(errors,[]);
  await page.goto(`http://127.0.0.1:${server.address().port}/icon-comparison.html`);
  await page.locator("img").first().waitFor();
  await page.waitForFunction(()=>Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0));
  await page.screenshot({path:path.resolve("src-tauri/target/list-benchmark-icons-2x.png")});
  console.log(JSON.stringify({browser:browser.version(),mode:"production React profiling, synthetic mixed history, mocked image IPC",samples,interactionChecks:["pointer","focus","keyboard-copy","finite-anchor"],errors},null,2));
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
