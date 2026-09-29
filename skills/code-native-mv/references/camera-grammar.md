# Camera grammar — the rules the user signed off on

The user's own summary of what finally worked: "本质上它就是一个不断变换角度的长镜头" — a long take
that keeps changing angle. Random fast cutting was called "乱、毫无章法" (chaotic, no logic).

## Cut density follows the song's energy

| Section | Camera | Why |
| --- | --- | --- |
| intro | top-down over the empty grid, lights switching on with hi-hats | set the place |
| verse | ONE take: poses glide into each other (worm → crane → orbit → drone → high pan) | the world is being born; let each build be seen |
| pre-chorus | one slow move (descend the street ahead of the protagonist, it runs at you) | held breath |
| chorus | hard cut on each hook line ("Just drive"), ~10 s per shot | the cut *is* the lyric accent |
| bridge | one take, the city goes dark around the stopped protagonist | stillness |
| final chorus | relight from high above, then cut every 2 bars | the only dense cutting — climax |
| outro | one take rising into the dawn aerial | resolve |

Result: 23 shots for 3:14 (down from 65). Cuts get denser as the song goes on, so the viewer feels
escalation, not noise. Cut only on phrase starts or lyric accents.

## Glides, not cuts, inside a take

Blend the previous pose into the next one (position, look target, fov, up — lerp + ease). Duration
adapts to how different the framings are: 4.5 s baseline, up to 8 s for a 135° change. A 3 s glide
between very different framings measured ~4°/frame — too fast.

Never glide out of a straight top-down into ground level: the up vector flips and the camera rolls.
Hard-cut there instead (and put that cut on a musical event — here the first beat, when the first
building rises).

## Following a protagonist without jerking

- The look target is a **lagging weighted average** of where the protagonist has been (~1.5 s window).
  Corners become gentle turns. Never lock `lookAt` to the raw position.
- Chase cameras ride the **same smoothed trail**, at a fixed *distance* behind (`tBack(t, D)`), not a
  fixed time — at chorus speed a time lag leaves the subject a dot on the horizon.
- The protagonist may leave frame briefly. Forced "whip-pan to show we lost it" moves were rejected.
  Let the HUD report truthfully instead: on screen → TRACKING, off → SIGNAL LOST, back → REACQUIRING.
- A spectator shot (low at a corner) looks where the subject will come from and only tilts; the
  subject enters, passes, leaves. Don't pan to follow a close pass — that measured 4°/frame.
- Orbits low among buildings get occluded; keep elevation ≥ ~0.5 rad or approach down the street axis
  (the street keeps the sightline clear).

## Collision — the source of every vertical jitter

Distance-ramped "lift when near a building" made cameras in the street bounce as they passed tall
towers (184 sign-flips). What works:

1. Lift only when the camera would be **inside** a footprint (+0.3 margin), including buildings about
   to rise (t + 0.8 s).
2. Sample that raw lift on an **absolute 0.1 s grid** (cache it), **dilate** ±0.8 s (max), **average**
   ±1.2 s, then **Catmull-Rom** between grid points. Sampling on a grid that moves with `t` produced
   sawtooth steps.
3. Clamp samples to the current **take** (cut → next cut), not the shot, so glides don't break it.

After: 1 vertical flip, max vertical accel 26, max pitch accel 0.46°. Check with `scripts/camera_check.js`
every iteration, not only when the user complains.

## Shot types in the template

`intro, top, relight, iso (random elevation/sweep per shot), spin (whip-orbit), drone (weaving behind),
pan (high lateral truck), street/closeup (chase), flyover, worm (spectator at a corner), crane,
profile (telephoto), pushin (descend the street ahead), bridge, orbitWide, reveal`.
