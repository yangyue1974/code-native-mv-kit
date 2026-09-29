# 踩过的坑

## HyperFrames 合成

- 根节点：`data-composition-id="main" data-duration="30" data-width="1920" data-height="1080"`。
- 即使画面全由 three 驱动，lint 也要求有 `window.__timelines["main"] = gsap.timeline({ paused: true })`。
- 画布直接挂在根节点下，作为 clip：`<canvas id="gl" class="clip" data-start="0" data-duration="30" data-track-index="1">`。
- 音频：`<audio src="assets/audio/track.mp3" data-start="0" data-media-start="<歌曲起点>" data-duration="30">`。
  **换段落时，这里和引擎里的 `SONG_OFFSET` 要一起改**，预览页的偏移量从引擎里读。
- 就绪信号：`window.__hf.buildReady["key"] = (async () => { await 字体; await 建引擎; draw(0) })()`，
  然后 `addEventListener("hf-seek", e => draw(e.detail.time))`。
- import map 的路径必须以 `./` 开头，否则 3D 层会静默变成空白。
- 屏幕外的字体预热 div 需要加 `data-layout-allow-overflow`。每个用到的字重都要预热，并且 `document.fonts.load`。
- 依赖库放在本地（`assets/vendor`），字体也放本地，渲染才可复现、能离线。
- 渲染命令：`npx --yes hyperframes@0.8.82 render -o "renders/名字.mp4" -q delivery -f 30 --workers 4`。
  30 秒大约 50 到 60 秒，原片 300 到 400MB。

## 预览

- 用 `serve_nocache.py`。`python -m http.server` 会让浏览器缓存 ES 模块，导致你看的是旧代码。
- 一个项目一个端口，比如 NIGHT+ 用 8725、案卷用 8726。起服务时加 `nohup ... &`。
- 浏览器面板：导航后的第一张截图经常是黑的，再截一次；页面刷新后要**等所有帧加载完**（视频帧有几百张，
  大约 10 秒），`window.N` 存在之后才能拼联系表。面板隐藏时，长时间运行的脚本会超时，要拆成几次调用。
- 拼联系表时要在 `render()` 之后立刻把 WebGL 画布画进 2D 画布，因为缓冲区不保留。
- 开过太多标签页会占满 GPU，旧的要关掉。

## 素材

- WebGL 里无法可靠地逐帧采样 `<video>`，所以一律抽帧成 JPG，只预载用到的帧，再换进纹理。
- 抽出来的帧数不一定正好 150，可能是 151 或 152。以 `manifest.json` 为准。
- 这个 ffmpeg 版本没有 `drawtext`，联系表上不能直接写字。需要标注时，在浏览器的联系表里写。
- Python 需要 3.12 的虚拟环境（`~/.venvs/hf-audio`），3.14 没有 librosa 依赖的预编译包。

## 沟通

- 用户对英文非常敏感（“中文中文”“你说着 sorry 还在写英文”）。回复只用中文，英文只留歌词和专名，
  代码里的注释不受这个限制。
- 长时间干活时隔一会儿报一句进度。
- 交付时先发压缩预览版，原片只报路径。
