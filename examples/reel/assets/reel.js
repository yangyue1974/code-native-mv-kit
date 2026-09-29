/* reel.js — the opener (10 s) and the bridge (2 s) for a two-film sample reel:
 *   opener → NIGHT+ (song 52.9–82.9) → bridge → CASE FILE 0214 (song 152.9–182.9)
 * The opener plays song 42.9–52.9 (the pre-chorus, ending on the breath before "Just drive"),
 * so it runs straight into NIGHT+; the bridge plays 150.9–152.9, the last bar before the final
 * chorus, so it runs straight into CASE FILE. Pictures come from the raw plates and from the two
 * finished films themselves. Canvas2D only; render(v) is a pure function of time.
 */
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  out: (t) => 1 - Math.pow(1 - clamp(t), 3),
  expo: (t) => (clamp(t) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t))),
  inout: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  back: (t) => { t = clamp(t); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const MAG = "#ff2d87", RED = "#e2231a", WHITE = "#f4f2ff", PAPER = "#e9e3d3";
const F = {
  zh: (s, w = 900) => `${w} ${s}px 'Noto Sans SC'`,
  num: (s) => `800 ${s}px 'Big Shoulders Display'`,
  mono: (s, w = 500) => `${w} ${s}px 'IBM Plex Mono'`,
  logo: (s) => `400 ${s}px Michroma`,
  type: (s) => `700 ${s}px 'Courier Prime'`,
};

export const MODES = {
  intro: { SONG_OFFSET: 42.9, DURATION: 10 },
  bridge: { SONG_OFFSET: 150.9, DURATION: 2 },
};

export async function createReel({ canvas, song, base = "./assets", mode = "intro" }) {
  const { SONG_OFFSET, DURATION } = MODES[mode];
  const W = canvas.width, H = canvas.height, c = canvas.getContext("2d");
  const img = async (src) => { const im = new Image(); im.src = src; await im.decode(); return im; };
  const tryImg = async (src) => { try { return await img(src); } catch { return null; } };

  // raw plates + raw clip frames (opener grid), and frames lifted from the two finished films
  const P = {};
  const FR = { NP: {}, CF: {} }, VF = {};
  if (mode === "intro") {
    await Promise.all(Array.from({ length: 16 }, (_, i) => "P" + String(i + 1).padStart(2, "0")).map(async (n) => (P[n] = await img(`${base}/src/${n}.png`))));
    await Promise.all(["V01", "V02", "V03", "V04", "V05"].flatMap((v) => Array.from({ length: 31 }, (_, k) => 31 + k).map(async (f) => (VF[`${v}/${f}`] = await img(`${base}/frames/${v}/${String(f).padStart(3, "0")}.jpg`)))));
  }
  const want = mode === "intro"
    ? { NP: [[3.5, 7.0], [9.1, 9.44], [12.3, 12.64], [14.3, 14.64], [16.9, 17.24]], CF: [[4.1, 7.6], [0.25, 0.6], [9.0, 9.34], [13.0, 13.34], [17.4, 17.74]] }
    : { NP: [[4.5, 5.0]], CF: [[4.5, 5.0]] };
  for (const [tag, ranges] of Object.entries(want)) {
    const idx = new Set(); for (const [a, b] of ranges) for (let f = Math.round(a * 30); f <= Math.round(b * 30); f++) idx.add(f);
    await Promise.all([...idx].map(async (f) => { const im = await tryImg(`${base}/frames/${tag}/${String(f).padStart(4, "0")}.jpg`); if (im) FR[tag][f] = im; }));
  }
  const film = (tag, t) => { const f = Math.round(t * 30); for (let d = 0; d < 4; d++) { if (FR[tag][f - d]) return FR[tag][f - d]; if (FR[tag][f + d]) return FR[tag][f + d]; } return null; };

  // grain: a few seeded noise tiles laid over everything, stepping at 24 fps
  const grain = Array.from({ length: 6 }, (_, k) => {
    const g = document.createElement("canvas"); g.width = g.height = 256; const x = g.getContext("2d"), d = x.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) { const n = hash(i * 0.37 + k * 91.7, k) * 255; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = n; d.data[i * 4 + 3] = 255; }
    x.putImageData(d, 0, 0); return c.createPattern(g, "repeat");
  });

  const SONG = song, V = (s) => s - SONG_OFFSET;
  const beats = SONG.beats.map(V).filter((x) => x > -0.5 && x < DURATION + 0.5);
  const prog = (v, a, d) => clamp((v - a) / d);
  const beatPulse = (v) => { let p = 0; for (const t of beats) if (v >= t) p = Math.exp(-(v - t) * 10); return p; };

  // ── helpers ────────────────────────────────────────────────────────────
  function cover(im, z = 1, ox = 0, oy = 0, alpha = 1) {
    if (!im) return;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, s = Math.max(W / iw, H / ih) * z;
    c.save(); c.globalAlpha = alpha; c.drawImage(im, W / 2 - (iw * s) / 2 + ox, H / 2 - (ih * s) / 2 + oy, iw * s, ih * s); c.restore();
  }
  function block(text, font, x, y, { color = WHITE, bg = "rgba(0,0,0,0.82)", pad = 18, align = "left", scale = 1, alpha = 1, track = 0 } = {}) {
    c.save(); c.globalAlpha = alpha; c.font = font; if (track) c.letterSpacing = track + "px";
    const m = c.measureText(text), tw = m.width, asc = m.actualBoundingBoxAscent, dsc = m.actualBoundingBoxDescent;
    const x0 = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x;
    c.translate(x0 + tw / 2, y - asc / 2); c.scale(scale, scale); c.translate(-(x0 + tw / 2), -(y - asc / 2));
    if (bg) { c.fillStyle = bg; c.fillRect(x0 - pad, y - asc - pad, tw + pad * 2, asc + dsc + pad * 2); }
    c.fillStyle = color; c.fillText(text, x0, y); c.restore();
    return tw;
  }
  function slam(v, t0) { return v < t0 ? 0 : 1 + 0.18 * (1 - E.expo(prog(v, t0, 0.18))); }
  function loop(cx, cy, rx, ry, seed, p, width = 9) {
    if (p <= 0) return;
    const pts = [], N = 70; for (let i = 0; i <= N; i++) { const a = -0.6 + (i / N) * Math.PI * 2.24, j = 1 + (hash(seed, i) - 0.5) * 0.08; pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]); }
    const n = Math.max(2, Math.floor(pts.length * E.out(p)));
    c.save(); c.strokeStyle = RED; c.lineWidth = width; c.lineCap = c.lineJoin = "round"; c.beginPath(); c.moveTo(...pts[0]); for (let i = 1; i < n; i++) c.lineTo(...pts[i]); c.stroke(); c.restore();
  }
  function stampText(text, x, y, size, rot, t0, v) {
    if (v < t0) return;
    const k = E.back(prog(v, t0, 0.14)), s = 1 + 0.9 * (1 - k);
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.font = F.num(size); c.textAlign = "center"; c.fillStyle = RED; c.fillText(text, 0, size * 0.35);
    c.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(0,0,0,${0.35 + 0.5 * hash(i, 9)})`; c.fillRect((hash(i, 1) - 0.5) * size * 1.3, (hash(i, 2) - 0.6) * size, 2 + hash(i, 3) * 8, 1 + hash(i, 4) * 4); }
    c.restore();
  }
  function finish(v, flash = 0) {
    // grain + vignette + flash, the same skin over plates and films alike
    const k = Math.floor(v * 24);
    c.save(); c.globalCompositeOperation = "overlay"; c.globalAlpha = 0.16; c.fillStyle = grain[k % grain.length];
    c.translate(-hash(k, 1) * 256, -hash(k, 2) * 256); c.fillRect(0, 0, W + 256, H + 256); c.restore();
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.55)");
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    if (flash > 0) { c.fillStyle = `rgba(255,252,246,${clamp(flash)})`; c.fillRect(0, 0, W, H); }
  }

  // ── the opener ─────────────────────────────────────────────────────────
  const ORDER = Array.from({ length: 16 }, (_, i) => i).sort((a, b) => hash(a, 7) - hash(b, 7));   // tiles pop in shuffled
  const VIDTILES = { 1: "V01", 6: "V04", 8: "V03", 11: "V05", 13: "V02" };                             // grid slot → clip (from 1.33)
  const HER = 2;                                                                                       // P03 sits in slot 2: the zoom target
  const SPLIT0 = 2.57, SPLIT_BEATS = [2.57, 3.17, 3.77, 4.38, 5.0, 5.61];
  const DIV = [[0.5, 0.0], [0.5, 0.18], [0.36, -0.12], [0.64, 0.14], [0.3, 0.1], [0.7, -0.16]];         // divider (x at mid-height, lean)
  const NPM = [9.12, 12.3, 14.3, 16.9], CFM = [0.3, 9.0, 13.0, 17.4];

  function grid(v) {
    // zoom into the tile of her on "changes"
    const tw = W / 4, th = H / 4, hx = (HER % 4) * tw, hy = Math.floor(HER / 4) * th;
    const e = E.expo(prog(v, 2.3, 0.2)), z = lerp(1, 4, e), rx = lerp(hx, 0, e), ry = lerp(hy, 0, e);
    c.save(); c.translate(rx - hx * z, ry - hy * z); c.scale(z, z);
    for (let k = 0; k < 16; k++) {
      const slot = ORDER[k], t0 = 0.1 + k * 0.072; if (v < t0) continue;
      const x = (slot % 4) * tw, y = Math.floor(slot / 4) * th, s = 1.1 - 0.1 * E.out(prog(v, t0, 0.12));
      let im = P["P" + String(slot + 1).padStart(2, "0")];
      if (VIDTILES[slot] && v >= 1.33) im = VF[`${VIDTILES[slot]}/${31 + Math.min(30, Math.floor((v - 1.33) * 30))}`] || im;
      c.save(); c.translate(x + tw / 2, y + th / 2); c.scale(s, s);
      c.drawImage(im, -tw / 2, -th / 2, tw, th);
      if (v - t0 < 0.05) { c.fillStyle = "rgba(255,255,255,0.7)"; c.fillRect(-tw / 2, -th / 2, tw, th); }
      c.strokeStyle = "rgba(0,0,0,0.9)"; c.lineWidth = 3; c.strokeRect(-tw / 2, -th / 2, tw, th);
      c.font = F.mono(15); c.fillStyle = "rgba(0,0,0,0.7)"; c.fillRect(-tw / 2 + 8, -th / 2 + 8, VIDTILES[slot] && v >= 1.33 ? 92 : 44, 24);
      c.fillStyle = WHITE; c.fillText(VIDTILES[slot] && v >= 1.33 ? `${VIDTILES[slot]} ▶5s` : "P" + String(slot + 1).padStart(2, "0"), -tw / 2 + 14, -th / 2 + 26);
      c.restore();
    }
    c.restore();
    if (v >= 2.3) return;
    // the tally, stacking on the beats
    const rows = [[0.71, "16", "张生成图"], [1.33, "5", "段短视频"], [1.94, "1", "首歌"]];
    rows.forEach(([t, n, zh], i) => {
      if (v < t) return;
      const y = 470 + i * 150, sc = slam(v, t);
      c.save(); c.translate(150, y - 50); c.scale(sc, sc); c.translate(-150, -(y - 50));
      c.font = F.num(150); const nw = c.measureText(n).width; c.font = F.zh(92); const zw = c.measureText(zh).width;
      c.fillStyle = "rgba(0,0,0,0.86)"; c.fillRect(120, y - 128, nw + zw + 90, 158);
      c.fillStyle = i === 0 ? MAG : i === 1 ? WHITE : RED; c.font = F.num(150); c.fillText(n, 146, y + 10);
      c.fillStyle = WHITE; c.font = F.zh(92); c.fillText(zh, 146 + nw + 26, y - 2);
      c.restore();
    });
    // "1 song": the whole track's loudness, drawn across the frame
    if (v >= 1.94) {
      const p = E.out(prog(v, 1.94, 0.3)), y0 = 1000;
      c.save(); c.fillStyle = "rgba(0,0,0,0.75)"; c.fillRect(0, y0 - 70, W, 110); c.strokeStyle = RED; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i <= 480 * p; i++) { const t = (i / 480) * SONG.duration, r = SONG.rms[Math.floor(t * 30)] || 0, x = (i / 480) * W; c.moveTo(x, y0 - r * 110); c.lineTo(x, y0 + r * 40); }
      c.stroke(); c.restore();
    }
    const lw = block("原始素材 · 未处理", F.zh(28, 400), 60, 76, { pad: 12 }); block("RAW PLATES, UNTOUCHED", F.mono(20), 60 + lw + 36, 73, { pad: 12, color: "rgba(244,242,255,0.7)" });
  }

  function split(v) {
    // which divider: the last split beat passed, eased in over 0.12 s
    let i = 0; for (let k = 0; k < SPLIT_BEATS.length; k++) if (v >= SPLIT_BEATS[k]) i = k;
    const e = i === 0 ? E.expo(prog(v, SPLIT0, 0.16)) : E.expo(prog(v, SPLIT_BEATS[i], 0.12));
    const from = i === 0 ? [1.08, 0.0] : DIV[i - 1], to = DIV[i];
    const mx = lerp(from[0], to[0], e) * W, lean = lerp(from[1], to[1], e) * H;
    const top = mx + lean, bot = mx - lean;
    const tNP = 3.55 + (v - SPLIT0), tCF = 4.18 + (v - SPLIT0);
    cover(film("NP", tNP), 1.02);
    c.save(); c.beginPath(); c.moveTo(top, 0); c.lineTo(W, 0); c.lineTo(W, H); c.lineTo(bot, H); c.closePath(); c.clip(); cover(film("CF", tCF), 1.02); c.restore();
    c.save(); c.strokeStyle = WHITE; c.lineWidth = 7; c.shadowColor = "rgba(255,255,255,0.9)"; c.shadowBlur = 24; c.beginPath(); c.moveTo(top, -10); c.lineTo(bot, H + 10); c.stroke(); c.restore();
    // labels hug each side
    const lx = Math.min(top, bot);
    block("01  NIGHT+", F.logo(30), Math.max(60, Math.min(lx - 340, 60)), 80, { color: WHITE, bg: "rgba(10,12,40,0.8)", pad: 14 });
    c.fillStyle = MAG; c.fillRect(46, 104, 250, 5);
    block("02  案卷 0214", F.zh(34), W - 60, 82, { align: "right", color: RED, bg: "rgba(233,227,211,0.92)", pad: 14 });
    // the claim
    const a = v >= 3.42;
    block("同一批素材", F.zh(a ? 56 : 120), W / 2, a ? 760 : 860, { align: "center", scale: slam(v, a ? 3.42 : SPLIT0), pad: a ? 14 : 24 });
    if (a) block("剪成两部完全不同的片子", F.zh(104), W / 2, 900, { align: "center", scale: slam(v, 3.42), pad: 22 });
  }

  function montage(v, tag, starts, t0, dur) {
    const k = Math.min(3, Math.floor((v - t0) / (dur / 4))), local = v - t0 - k * (dur / 4);
    cover(film(tag, starts[k] + local), 1.04 + 0.03 * local);
    return local < 0.04 ? 0.35 : 0;
  }
  function cardNP(v, t0) {
    const p = E.expo(prog(v, t0, 0.2)), x = lerp(-700, 0, p);
    c.save(); c.translate(x, 0);
    const g = c.createLinearGradient(0, 0, 1100, 0); g.addColorStop(0, "rgba(6,10,30,0.92)"); g.addColorStop(1, "rgba(6,10,30,0)"); c.fillStyle = g; c.fillRect(0, 560, 1300, 420);
    c.font = F.num(230); c.fillStyle = MAG; c.fillText("01", 90, 840);
    c.font = F.logo(84); c.fillStyle = WHITE; c.fillText("NIGHT+", 330, 730);
    c.font = F.zh(66); c.fillText("黑夜续费服务", 334, 826);
    c.font = F.zh(36, 400); c.fillStyle = "rgba(244,242,255,0.8)"; c.fillText("一支讽刺广告", 338, 900);
    c.fillStyle = MAG; c.fillRect(334, 856, 250 * E.out(prog(v, t0 + 0.12, 0.3)), 4);
    c.restore();
  }
  function cardCF(v, t0) {
    const k = E.back(prog(v, t0, 0.18)), s = 1.12 - 0.12 * k;
    c.save(); c.translate(W - 700, 880); c.rotate(-0.035); c.scale(s, s);
    c.shadowColor = "rgba(0,0,0,0.7)"; c.shadowBlur = 30; c.shadowOffsetY = 16; c.fillStyle = PAPER; c.fillRect(-60, -210, 700, 330); c.shadowColor = "transparent";
    c.font = F.num(200); c.fillStyle = RED; c.fillText("02", -20, 20);
    c.fillStyle = "#1a1814"; c.font = F.zh(70); c.fillText("案卷 0214", 190, -70);
    c.font = F.zh(40, 400); c.fillText("一桩悬案", 194, 0);
    c.font = F.type(24); c.fillText("SUBJECT 07 · STATUS: OPEN", 194, 64);
    c.restore();
    loop(W - 700 + 40, 860, 150, 120, 5, prog(v, t0 + 0.15, 0.35), 8);
  }

  function hook(v) {
    c.fillStyle = "#040406"; c.fillRect(0, 0, W, H);
    // the two films, barely there, breathing on the beat
    const a = 0.1 + 0.12 * beatPulse(v);
    cover(film("NP", 6.8), 1.06, -W * 0.25, 0, a * 0.8); cover(film("CF", 7.4), 1.06, W * 0.25, 0, a * 0.8);
    const line = "全程代码渲染 · 每一刀都卡在拍子上", n = Math.floor(line.length * prog(v, 8.07, 0.45));
    if (n) block(line.slice(0, n), F.zh(40, 400), W / 2, 380, { align: "center", bg: null, color: "rgba(244,242,255,0.85)" });
    if (v >= 8.7) {
      const sc = slam(v, 8.7), jx = (hash(Math.floor(v * 30), 3) - 0.5) * 10 * Math.exp(-(v - 8.7) * 6);
      c.save(); c.translate(W / 2 + jx, 600); c.scale(sc, sc); c.font = F.zh(230); c.textAlign = "center";
      c.fillStyle = "rgba(255,45,135,0.85)"; c.fillText("看到最后", -6, 0); c.fillStyle = "rgba(226,35,26,0.85)"; c.fillText("看到最后", 6, 0);
      c.fillStyle = WHITE; c.fillText("看到最后", 0, 0); c.restore();
    }
    if (v >= 9.32) {
      c.save(); c.globalAlpha = E.out(prog(v, 9.32, 0.2)); c.textAlign = "center";
      c.font = F.logo(34); c.fillStyle = WHITE; c.fillText("01  NIGHT+", W / 2 - 250, 790);
      c.font = F.mono(34); c.fillStyle = "rgba(244,242,255,0.6)"; c.fillText("→", W / 2, 790);
      c.font = F.zh(38); c.fillStyle = RED; c.fillText("02  案卷 0214", W / 2 + 250, 792);
      c.restore();
    }
  }

  function intro(v) {
    let flash = 0;
    if (v < 2.57) { c.fillStyle = "#000"; c.fillRect(0, 0, W, H); grid(v); if (v >= 2.3) flash = 0; }
    else if (v < 5.74) { split(v); if (v - SPLIT0 < 0.08) flash = 0.8 * (1 - (v - SPLIT0) / 0.08); }
    else if (v < 6.84) { flash = montage(v, "NP", NPM, 5.74, 1.1); cardNP(v, 5.74); }
    else if (v < 7.9) { flash = montage(v, "CF", CFM, 6.84, 1.06); cardCF(v, 6.84); }
    else hook(v);
    flash = Math.max(flash, v < 0.1 ? 0 : 0, 0.9 * clamp((v - 9.8) / 0.2));
    finish(v, flash);
  }

  // ── the bridge ─────────────────────────────────────────────────────────
  function bridge(v) {
    c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
    if (v >= 0.15) {
      const t = 4.55 + Math.min(Math.max(v - 0.15, 0), 0.6) * 0.5, a = E.out(prog(v, 0.15, 0.1)), dim = v >= 0.73 ? 1 - 0.62 * E.out(prog(v, 0.73, 0.12)) : 1;
      cover(film("NP", t), 1.04 + 0.04 * v, 0, 0, a * dim);
      // a copier light sweeps across: behind it, the same shot from the other film
      const bx = lerp(-60, W + 60, E.inout(prog(v, 0.3, 0.43)));
      c.save(); c.globalAlpha = dim; c.beginPath(); c.rect(0, 0, bx, H); c.clip(); cover(film("CF", t), 1.04 + 0.04 * v); c.restore();
      if (v > 0.3 && v < 0.76) { const g = c.createLinearGradient(bx - 120, 0, bx + 40, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.75, "rgba(255,250,235,0.9)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(bx - 120, 0, 160, H); }
    }
    stampText("02", 640, 560, 460, -0.06, 0.73, v);
    loop(640, 540, 300, 250, 13, prog(v, 0.82, 0.45), 11);
    const say = "下一部", n1 = Math.floor(say.length * prog(v, 0.8, 0.2));
    if (n1) block(say.slice(0, n1), F.zh(44, 400), 1000, 380, { bg: null, color: "rgba(244,242,255,0.85)" });
    if (v >= 0.9) block("案卷 0214", F.zh(130), 1000, 560, { bg: null, color: WHITE, scale: slam(v, 0.9) });
    if (v >= 1.31) block("同一批素材，另一个故事", F.zh(44, 400), 1004, 660, { bg: null, color: "rgba(244,242,255,0.8)", alpha: E.out(prog(v, 1.31, 0.2)) });
    finish(v, Math.max(v >= 0.15 && v < 0.2 ? 0.5 : 0, clamp((v - 1.7) / 0.3) * 0.95));
  }

  function render(v) {
    v = clamp(v, 0, DURATION - 1e-4);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    (mode === "intro" ? intro : bridge)(v);
  }
  return { render, DURATION, SONG_OFFSET };
}
