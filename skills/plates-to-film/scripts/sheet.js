// 在预览页的控制台/javascript_tool 里执行：把任意时刻的画面拼成一张联系表，覆盖在页面上，再截图看。
// 前提：预览页把引擎挂在 window.N 上（示例 preview.html 已经这样做）。
// 注意：浏览器面板刚打开时第一张截图常是黑的，再截一次；面板隐藏时长任务可能超时，分批调用。
window.sheetAt = (times, cols = 2) => {
  const gl = document.getElementById("gl"), w = 1920 / cols, h = w * 9 / 16, rows = Math.ceil(times.length / cols);
  let s = document.getElementById("sheet");
  if (!s) { s = document.createElement("canvas"); s.id = "sheet"; s.style.cssText = "position:fixed;inset:0;z-index:99;background:#000;width:100vw"; document.body.appendChild(s); }
  s.width = w * cols; s.height = h * rows; const x = s.getContext("2d"); x.font = "28px monospace";
  times.forEach((t, i) => {
    window.scrubV = t; N.render(t);                       // 画完立刻拷走（WebGL 缓冲不保留）
    x.drawImage(gl, (i % cols) * w, Math.floor(i / cols) * h, w, h);
    x.fillStyle = "#0f0"; x.fillText(t.toFixed(2), (i % cols) * w + 6, Math.floor(i / cols) * h + 28);
  });
  return "ok";
};
// 例：sheetAt([0.3, 1.2, 2.1, 3.0, 4.8, 6.2, 9.5, 12.0, 16.5, 19.0, 24.0, 29.5], 2)
// 看细节（涂层网点、颗粒）：N.render(t) 后用截图工具的 zoom 放大某个区域
