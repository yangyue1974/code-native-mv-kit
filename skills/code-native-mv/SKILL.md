---
name: code-native-mv
description: >
  Make a full-length, code-generated music video (MV) from a song file + lyrics with HyperFrames and
  Three.js — a generative world that the music itself builds (beats raise buildings, drums switch on
  lights), a protagonist the camera follows, a continuously re-angling long-take camera, frame-exact
  word-synced lyrics, rendered to 1080p MP4, plus a matching cover image. Use this whenever someone
  wants a music video / MV / lyric video / visualizer for a song and wants it to look cool and unlike
  AI-generated video ("不要像AI视频", "用代码做MV", "给这首歌做个MV", "做个歌词视频", "很酷的MV"),
  even if they don't say "HyperFrames" — and when they ask for a cover/thumbnail matching such an MV.
  Not for editing existing footage.
---

# Code-native MV

Distilled from making "2AM in Your Car" (3:14, six iterations, one day). The method, the engine and
the checks here are what survived the user's feedback; the references explain why.

This skill sits on top of the HyperFrames skills: use `/hyperframes` for the intent layer and
`/hyperframes-core`, `/hyperframes-cli` for the composition contract and CLI. This skill supplies the
MV-specific method. Talk to the user in their language.

## What you have

| Resource | Use it for |
| --- | --- |
| `references/concept-playbook.md` | Read at intake: what makes a code MV worth watching, pitching, the look that landed |
| `references/camera-grammar.md` | Read before writing any camera code: cut density, glides, following, collision |
| `references/pitfalls-and-integration.md` | Read before audio work and again before rendering |
| `scripts/align_lyrics.py` | Lyric sheet → word timestamps (edit its section windows / estimates per song) |
| `scripts/build_song_data.py` | Pack beats, per-beat spectrum, drum events, sections, lyrics → `assets/song-data.js` (edit SECTIONS) |
| `scripts/fetch_fonts.py` | Download Google Fonts woff2 locally for deterministic renders |
| `scripts/serve_nocache.py` | Preview server that never serves stale ES modules |
| `scripts/camera_check.js` | Frame-by-frame camera smoothness audit, run inside the preview page |
| `assets/template/` | The working engine: `city3d.js` (3D city, protagonist, camera), `overlay.js` (lyrics + HUD), `preview.html` (playable review page), `index.html` (HyperFrames composition), `cover.html` (3:4 poster) |

## Workflow

1. **Intake** (playbook). Scaffold with `npx hyperframes init videos/<name> --non-interactive --example=blank --skill=general-video`,
   write `BRIEF.md` first, and keep every decision in it. First-timers delegate — decide with receipts,
   and show things rather than describe them.

2. **Audio analysis.** In a Python 3.12 venv (see pitfalls):
   `analyze-beatgrid.py track.mp3 -o assets/audiomap.json --print` (from the music-to-video skill) and
   `extract-audio-data.py track.mp3 --fps 30 --bands 16 -o assets/audio-data.json` (hyperframes-creative).
   Read the energy phases to name the sections (verse / pre / chorus / bridge / final / outro).

3. **Lyrics.** Parakeet over the whole track → whisper medium.en on the gaps → `align_lyrics.py` with
   per-section windows. Report estimated lines to the user.

4. **Pack data.** Edit SECTIONS in `build_song_data.py`, run it → `assets/song-data.js` (`window.SONG`).

5. **Playable prototype.** Copy `assets/template/*` into the project (`assets/city3d.js`,
   `assets/overlay.js`, `.hyperframes/preview.html`), fetch fonts, serve with `serve_nocache.py`,
   open the preview in the browser pane. Before it runs on a new song, re-derive the song-specific
   constants in `city3d.js`: `BR0` / `BR1` / `BUILD_END` (bridge start, relight, last build), the
   `SPEED` keys (car speed per section), `RATE` (build rate per section), and the `PLAN` shot list
   (it finds hook lines by lyric text, e.g. `/^Just drive$/` — change to this song's hook). If the
   concept is not a growing city, keep the architecture (pure `renderAt(t)`, seeded randomness, pose
   functions + glide + smoothed lift) and replace the world.

6. **Review loop.** Show, get one line of feedback, fix, repeat. Before every hand-off: a contact sheet
   of 6–12 key times (look), and `camera_check.js` (motion). Known tastes to start from: long take
   over fast cuts, cuts only on hook lines, a protagonist, nothing glaring, no forced camera snaps.

7. **Composition + render** (pitfalls → Rendering). `lint` → `check` → `snapshot` a few times →
   `render -q delivery -f 30` once the user is happy. Verify from the MP4 (contact sheet, duration,
   loudness), then send the file.

8. **Cover.** `cover.html` as a single-frame composition, framed by hand, exported with `snapshot`.

9. **Close.** Offer a retrospective; update `BRIEF.md` with the final decisions.

## Principles (why the method looks like this)

- The music should **build** the world, not shake it — persistent structure reads as meaning, bouncing
  reads as a visualizer.
- A viewer needs **someone to follow**; the camera's job is to follow it, and cuts are motivated by
  losing and finding it — reported honestly, never faked with a whip.
- **Cut density is a function of energy**, rising across the song. Inside a section, glide.
- **Everything is a pure function of time.** It is what lets HyperFrames render any frame in any order,
  lets you screenshot any moment, and lets you measure the camera numerically.
- **Measure motion, look at stills.** Users feel jitter the eye can't see in a frame grab.
