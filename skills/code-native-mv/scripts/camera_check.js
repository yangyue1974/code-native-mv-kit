// camera_check.js — numeric smoothness audit of a camera track, frame by frame.
//
// Run it inside the preview page (browser tool `javascript_exec`, or paste in devtools)
// after the engine is built and exposed as `window.city` with:
//   city.poseAt(t) -> { pos: Vector3, look: Vector3, sh: { type } }
//   city.shots     -> [{ t0, cut }]   (hard cuts are excluded from the audit)
//
// Why: stills never show jitter. Users notice a 3°/frame whip or a vertical bounce at
// once, and it only shows up when you differentiate the whole timeline.
//
// Pass bar used on "2AM in Your Car" (the user called the result "silky"):
//   worst per-frame turn off a cut   <= ~3.5°   (over3deg only a handful of frames)
//   vertical sign-flips (bounce)     ~0–3 over the whole song
//   max |vertical accel|             <= ~40 units/s²
// If msPerPose is ~0.02 after you added work to poseAt, you are measuring STALE code
// (cached module) — serve with serve_nocache.py and fetch(..., {cache:'reload'}) the module.
(() => {
  const FPS = 30, DUR = window.SONG ? window.SONG.duration : 194;
  const cuts = city.shots.filter((s) => s.cut).map((s) => s.t0);
  const nearCut = (t) => cuts.some((c) => Math.abs(c - t) < 0.1);
  let prev = null, pprev = null; const rows = []; const T0 = performance.now();
  for (let f = 0; f < DUR * FPS; f++) {
    const t = f / FPS, p = city.poseAt(t);
    const d = p.look.clone().sub(p.pos).normalize();
    const cur = { y: p.pos.y, pitch: Math.asin(d.y) * 180 / Math.PI, d, type: p.sh.type };
    if (prev && pprev && !nearCut(t)) rows.push({
      t, type: cur.type,
      ang: Math.acos(Math.min(1, d.dot(prev.d))) * 180 / Math.PI,   // turn this frame
      vy: (cur.y - prev.y) * FPS,
      ay: (cur.y - 2 * prev.y + pprev.y) * FPS * FPS,                 // vertical acceleration
      ap: cur.pitch - 2 * prev.pitch + pprev.pitch,                   // pitch acceleration
    });
    pprev = prev; prev = cur;
  }
  const top = (k, n = 6) => [...rows].sort((a, b) => Math.abs(b[k]) - Math.abs(a[k])).slice(0, n)
    .map((r) => `${r.t.toFixed(2)}s ${r.type} ${k}=${r[k].toFixed(2)}`);
  let flips = 0;
  for (let i = 1; i < rows.length; i++) if (Math.sign(rows[i].vy) !== Math.sign(rows[i - 1].vy) && Math.abs(rows[i].ay) > 20) flips++;
  return JSON.stringify({
    msPerPose: ((performance.now() - T0) / (DUR * FPS)).toFixed(2),
    over2deg: rows.filter((r) => r.ang > 2).length, over3deg: rows.filter((r) => r.ang > 3).length,
    verticalFlips: flips, worstTurn: top("ang"), worstVertAccel: top("ay"), worstPitchAccel: top("ap"),
  }, null, 1);
})();
