# Pitfalls and HyperFrames integration

## Audio + lyrics

- Python 3.14 has no wheels for librosa's deps. Use a 3.12 venv:
  `uv venv --python 3.12 ~/.venvs/hf-audio && VIRTUAL_ENV=~/.venvs/hf-audio uv pip install librosa numpy soundfile`
  and `uv venv --python 3.12 ~/.venvs/parakeet && VIRTUAL_ENV=~/.venvs/parakeet uv pip install parakeet-mlx`.
- Parakeet on the full mix misses quiet verses entirely. Re-transcribe gaps with whisper medium.en
  (`npx hyperframes transcribe seg.wav -e whisper -m medium.en`), offsets added back.
- Sung lyrics repeat lines the sheet shows once ("Tonight, tonight"). Insert the sung repeats.
- Global text alignment matches repeated choruses to the wrong pass. Align **per section time window**.
- Some lines no engine hears. Estimate from the parallel section's spacing, mark `estimated`, and tell
  the user which timestamps to eyeball.
- ASR emits `end < start` sometimes; clamp, and force word times monotonic.

## Preview + measurement

- `python3 -m http.server` lets Chrome heuristically cache ES modules: one whole measurement round ran
  on stale code. Serve with `scripts/serve_nocache.py`; after switching, `fetch(url, {cache:'reload'})`
  each module once. A suspiciously fast `msPerPose` is the tell.
- Stills (contact sheets of 6–12 times) are for look/framing; numbers (`camera_check.js`) are for motion.

## Rendering with HyperFrames

- Vendor Three.js (r181: `build/three.module.js`, `build/three.core.js`, and the used
  `examples/jsm/postprocessing/*` + `shaders/*`) and GSAP into `assets/vendor/` — renders stay offline
  and deterministic.
- Import-map values must start with `./`, `../` or `/`. `"assets/..."` is silently invalid → a blank 3D
  layer (the cover's first export was text on black).
- Lint wants `window.__timelines["<root id>"]` even when the three adapter drives the picture: register
  an empty paused GSAP timeline; root `data-duration` sets the length.
- Put canvases directly under the root as clips (a wrapper with nested canvases warns).
- Hold readiness on the CPU work: `window.__hf.buildReady["city"] = (async () => { await fonts; build; draw })()`,
  then `addEventListener("hf-seek", e => draw(e.detail.time))`.
- Off-canvas font warmers need `data-layout-allow-overflow`.
- `npx hyperframes snapshot --at ... --no-end --describe false` proves the real pipeline draws the WebGL.
- `render -q delivery -f 30`: 5822 frames in 1m48s on an M-series GPU, 477 MB. The mix came out ~2 dB
  quieter than the source (peak 0 → -1.4 dBFS) — check with `ffmpeg -af volumedetect`; remux the
  original audio if loudness matters.
- Verify from the MP4 itself: `ffmpeg -vf "select=...,tile=3x3"` a contact sheet, `ffprobe` frames/duration.

## Cover (3:4)

Same engine, `renderAt(t, { pose, fullTrail })` with a hand-framed pose; a separate single-frame
composition (`data-width=1500 data-height=2000`) with the title in DOM; export with `snapshot`. Frame
the protagonist low-centre on the route and check it isn't occluded (render 6 azimuths side by side);
add a top and bottom dark falloff behind the type.
