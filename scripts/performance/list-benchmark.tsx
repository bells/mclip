import { Profiler } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { mockIPC } from "@tauri-apps/api/mocks";
import { HistoryList } from "../../src/components/HistoryList";
import { enTranslations } from "../../src/i18n/en";
import { filterHistoryItems, getVisibleHistoryItems } from "../../src/utils/history";
import type { HistoryEntry, HistoryListItem } from "../../src/types";
import "../../src/styles.css";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XqTzAAAAAElFTkSuQmCC";
mockIPC((command) => {
  if (command === "get_image_base64") return png;
  if (command === "is_performance_mode_enabled") return false;
  throw new Error(`Unexpected benchmark command: ${command}`);
});
const root = createRoot(document.getElementById("root")!);
let events: {id: string; source: string; anchor?: number}[] = [];
let durations: number[] = [];
const select = (id: string) => events.push({id, source:"copy"});
const preview = (item: HistoryListItem, anchor: number, _target: string, source: string) => events.push({id:item.id,source,anchor});
const close = () => events.push({id:"",source:"leave"});

function fixture(count: number): HistoryEntry[] {
  return Array.from({length:count},(_,index) => {
    const common = {id:`fixture-${index}`,displayText:`Fixture ${index}`,copyCount:1,firstCopiedAt:1,lastCopiedAt:count-index,sourceApp:null,isPinned:index<5,pinnedAt:index<5?10:null};
    if (index%5===1) return {...common,kind:"files",filePaths:[`/synthetic/long-file-name-${index}-report.txt`]};
    if (index%5===2) return {...common,kind:"image",imagePath:`fixture-${index%10}`,width:1,height:1,byteSize:72,contentHash:`fixture-image-${index%10}`};
    return {...common,kind:"text",text:"Synthetic ordinary text 世界 ".repeat(2048),secretType:null,secretDetectorVersion:null};
  });
}
let items: HistoryListItem[] = [];
function render(selectedItemId: string) {
  flushSync(()=>root.render(<Profiler id="list" onRender={(_id,_phase,duration)=>durations.push(duration)}>
    <HistoryList hasHistory items={items} isKeyboardNavigating selectedItemId={selectedItemId} showItemNumbers translations={enTranslations.history} onSelectItem={select} onOpenItemPreview={preview} onScheduleClosePreview={close}/>
  </Profiler>));
}
function summarize(values:number[]) {
  const sorted=values.toSorted((a,b)=>a-b);
  return {medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.ceil(sorted.length*.95)-1],samples:values};
}
async function benchmark(count:number) {
  const history=fixture(count);
  items=getVisibleHistoryItems(filterHistoryItems(history,""),count);
  render("fixture-0");
  await new Promise(resolve=>setTimeout(resolve,100));
  durations=[];
  const wall:number[]=[];
  for(let index=0;index<30;index++) {
    const start=performance.now();
    render(`fixture-${index%count}`);
    document.getElementById("root")!.getBoundingClientRect();
    wall.push(performance.now()-start);
  }
  const search:number[]=[];
  for(let i=0;i<30;i++) {
    const start=performance.now();
    filterHistoryItems(history,i%2?"absent":"synthetic");
    search.push(performance.now()-start);
  }
  return {count,domNodes:document.querySelectorAll("#root *").length,buttons:document.querySelectorAll("#root button").length,scrollHeight:document.getElementById("root")!.scrollHeight,react:summarize(durations),selection:summarize(wall),search:summarize(search)};
}
Object.assign(window,{mclipListBenchmark:{benchmark,events:()=>events,resetEvents:()=>{events=[];}}});
