# 第三方组件 / Third-party notices

本仓库自带以下第三方文件，以便渲染可以离线、可复现。各自适用其原始许可证。

This repository vendors the following third-party files so renders are offline and reproducible. Each remains under its own license.

| 组件 / Component | 位置 / Location | 许可证 / License |
|---|---|---|
| three.js r181 | `skills/plates-to-film/assets/vendor/three/` | MIT — `vendor/three/LICENSE` |
| GSAP 3.14.2 | `skills/plates-to-film/assets/vendor/gsap/` | GreenSock Standard License — https://gsap.com/standard-license |
| Big Shoulders Display | `skills/plates-to-film/assets/fonts/` | SIL OFL 1.1 — `fonts/LICENSES/OFL-bigshouldersdisplay.txt` |
| Courier Prime | 同上 / same | SIL OFL 1.1 — `OFL-courierprime.txt` |
| Doto | 同上 | SIL OFL 1.1 — `OFL-doto.txt` |
| IBM Plex Mono | 同上 | SIL OFL 1.1 — `OFL-ibmplexmono.txt` |
| Michroma | 同上 | SIL OFL 1.1 — `OFL-michroma.txt` |
| Newsreader | 同上 | SIL OFL 1.1 — `OFL-newsreader.txt` |
| VT323 | 同上 | SIL OFL 1.1 — `OFL-vt323.txt` |
| Permanent Marker | 同上 | Apache 2.0 — `Apache-2.0-permanentmarker.txt` |
| Noto Sans SC（子集 / subset） | `examples/reel/fonts/` | SIL OFL 1.1 — `examples/reel/fonts/OFL-notosanssc.txt` |

渲染工具 [HyperFrames](https://www.npmjs.com/package/hyperframes) 通过 `npx` 按需下载，不包含在本仓库中。

The renderer, [HyperFrames](https://www.npmjs.com/package/hyperframes), is fetched on demand via `npx` and is not included.
