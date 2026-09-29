---
workflow: general-video
flow: companion
storyboard: yes
message: "The city is built from the song itself — every window lit by a beat, the night turning blue exactly as the last chorus ends"
destination: youtube
aspect: 1920x1080
language: en
length: 194s
angle: audio-reactive generative city
---

## Intent

Full-length music video for "2AM in Your Car" (3:14). Chosen pitch ④「用这首歌盖一座城」:
the skyline on the horizon IS the song's spectrum — each building's height is a frequency
band; every onset lights a window ("I watch the windows glow"); across 3:14 the sky shifts
with exact precision from sodium-streetlight orange to the blue of "Till the city turns
blue", reaching dawn on the last "Tonight".

User, in their words: 重点是要酷，让人看了会说一声 wow，跟自己看过的各种 AI 视频都大不一样。
Lean into what only code can do — frame-exact timing, data as image, perfect typography,
accumulated state, 3-minute consistency. Never imitate photoreal AI video.

## Assets

- ../../2AM in Your Car.mp3 — the master track (194s, 48kHz, 320kbps); staged to assets/audio/track.mp3.
- ../../2AM in Your Car.docx — full lyrics with section tags; staged to assets/lyrics.txt.

## Customizations

- Concept refinement (2026-09-28, avoids the equalizer-bar cliché flagged in audio-reactive.md): buildings never bounce. One building rises per beat at the playhead, its height fixed by that beat's spectrum; the camera drives the street; the skyline is the song's timeline. Outro pulls back so the full skyline = the whole song, laid out by time (the bridge leaves a literal gap), with a section axis underneath.
- Drum → architecture: kick lights a whole floor, snare a scatter, hi-hat one window. Bridge switches the city off except one window; final chorus relights it brighter; dawn turns it off as the sky turns blue.
- Clock HUD runs 02:00 → 05:47 AM across the song.
- Mood prototypes: `.hyperframes/mood.html` (A 钠灯 / B 蓝图 ★ / C 点阵), engine `assets/city-engine.js`.

- Lyrics word-aligned: each word appears on the exact frame it is sung (transcription + alignment to the supplied lyric sheet).
- WebGL shader atmosphere: window glow bloom, haze, sodium-lamp halos (challenger, accepted — costs render time).
- Design: design-picker mood boards after audio analysis, with a marked recommendation; user picks by eye.
- Opening title card with song title; close on dawn at the final "Tonight".

## Notes

- 2026-09-28 pivot (user feedback on the 2D mood board: first 56s too monotonous, viewers quit within 5s): moved to a 3D city (`assets/city3d.js`, prototype `.hyperframes/city3d.html`). Look = blueprint × sodium ("规划3D效果图"): buildings draw as blueprint wireframes, pour solid with a sodium fill line, windows/streetlights switch on irregularly with the drums. Camera cuts on the music with constantly changing angles — top-down, drone fly-through, worm's-eye, fast spin, lateral pan, crane, close-up, profile; verses cut every 2 bars, choruses every bar / 2 beats, bridge one long take. Ending: dawn aerial of the whole city with the night's full route lit.

- 2026-09-28 protagonist (user idea): the ground trail becomes a Pac-Man-style chomping runner — the story's through-line. It eats one pellet per beat (pellets = the beat grid laid along the route), power pellet on every "Just drive"; every camera tracks it; hard cuts are motivated as "lost → searching → reacquired" (whip-pan away, new angle settles onto it, HUD reticle TRACKING / SIGNAL LOST / REACQUIRING). Arcade SCORE in the HUD. Final aerial reads as an arcade maze with the gold route. Homage styling only — no official Pac-Man name/branding/character art in the video.
- Palette: FINAL = pure blueprint (user, 2026-09-28). Sodium mix kept only as a preview option.
- Final composition: `index.html` (three adapter via hf-seek; three.js r181 + GSAP vendored under assets/vendor for offline, deterministic renders). Camera smoothness verified numerically over all 5821 frames (vertical sign-flips 184→1).
- Shot grammar (user-approved): one continuously re-angling long take in verses; chorus cuts on each "Just drive"; final chorus every 2 bars; bridge + outro single takes. Build rate follows energy (verse ½ beat, pre-chorus 1/bar, chorus every beat).
- User is new to this medium and delegated creative control ("你来把握吧"); review happens at the storyboard sheet and the final preview.
- Integration risk: one continuous city for 3 minutes goes stale — the city must transform per section (street-level drift in verses, held breath in pre-chorus, aerial rise + full ignition in choruses, total blackout except one window in the bridge, full relight + blue sky in the final chorus, dawn outro).
- Skill freshness: `hyperframes skills update` failed (GitHub clone hung) on 2026-09-28; running from locally installed skills.
