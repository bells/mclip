// React 前端入口：同一份前端代码会被 main 窗口和 preview 窗口复用。
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

// createRoot 接收真实 DOM 节点，后面的 `as HTMLElement` 是 TypeScript 类型断言：
// 我们告诉 TS，index.html 里一定存在 id="root" 的元素。
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  // StrictMode 只在开发环境额外检查副作用和过时写法，不会渲染真实 DOM 元素。
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
