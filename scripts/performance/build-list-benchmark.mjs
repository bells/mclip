import {build} from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

await build({
  configFile:false,
  plugins:[tailwindcss()],
  root:path.resolve("scripts/performance"),
  resolve:{alias:{"react-dom/client":"react-dom/profiling"}},
  esbuild:{jsx:"automatic"},
  build:{outDir:path.resolve("src-tauri/target/list-benchmark"),emptyOutDir:true,rollupOptions:{input:[path.resolve("scripts/performance/list-benchmark.html"),path.resolve("scripts/performance/icon-comparison.html")]}},
});
