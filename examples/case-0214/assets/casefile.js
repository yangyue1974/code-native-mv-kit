/* casefile.js — "CASE FILE 0214", a second 30-second film cut from the same plates as NIGHT+,
 * to the final chorus of "2AM in Your Car" (song 152.9 → 182.9).
 *
 * Noir case file: the plates are evidence. Prints drop onto a desk on the beat; CCTV; an
 * "enhance" on her eyes; a statement stamped UNVERIFIED over a polygraph drawn from the song's
 * own loudness; an 8-frame flurry; the city turns blue; an evidence board; a contact sheet;
 * last seen on the roof; the sunrise bleeds back into colour; case unsolved.
 *
 *   base canvas  the desk, prints, typed cards, polygraph, full-frame footage   (2D)
 *   coating      silver print: B&W with one kept colour (red → blue → full colour at the end),
 *                gate weave, silver grain, dust + scratches, toner speckle, burned edges, flashbulb
 *   over canvas  the investigator's hand: grease-pencil circles + route lines drawn in real time,
 *                red string, CCTV OSD, stamps                                  (2D, after the coating)
 * render(v) is a pure function of film time v (0..30).
 */
import * as THREE from "three";

export const SONG_OFFSET = 152.9, DURATION = 30;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  out: (t) => 1 - Math.pow(1 - clamp(t), 3),
  inout: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  expo: (t) => (clamp(t) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t))),
  back: (t) => { t = clamp(t); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const PAPER = "#e9e3d3", INKT = "#1a1814", RED = "#e2231a";
const F = {
  type: (s, b) => `${b ? 700 : 400} ${s}px 'Courier Prime'`,
  hand: (s) => `400 ${s}px 'Permanent Marker'`,
  osd: (s) => `400 ${s}px VT323`,
  stamp: (s) => `800 ${s}px 'Big Shoulders Display'`,
};

// ── the cut: segments, each draws its own world ──────────────────────────
const SEG = [
  { t0: 0.0, id: "cctv1" }, { t0: 0.66, id: "cctv2" },
  { t0: 1.67, id: "deskA" },
  { t0: 4.18, id: "cctvHer" }, { t0: 5.32, id: "enhance" },
  { t0: 6.74, id: "deskLie" },
  { t0: 9.86, id: "flurry" },
  { t0: 11.46, id: "dawn" },
  { t0: 13.54, id: "board" },
  { t0: 16.02, id: "sheet" }, { t0: 18.67, id: "sheetZoom" },
  { t0: 19.78, id: "roof" },
  { t0: 24.1, id: "sunrise" },
  { t0: 29.1, id: "end" },
];
SEG.forEach((s, i) => (s.t1 = i + 1 < SEG.length ? SEG[i + 1].t0 : DURATION));
const segAt = (v) => { let s = SEG[0]; for (const x of SEG) if (v >= x.t0) s = x; return s; };

// ── coating ──────────────────────────────────────────────────────────────
const VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const COAT = /* glsl */ `
  uniform sampler2D tBase, tOver; uniform vec2 uRes; uniform float uFrame, uKeep, uBlueWide, uColor, uFlash, uCctv, uFade, uHit;
  varying vec2 vUv;
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main(){
    float fr = uFrame;
    // gate weave: the print never sits perfectly still
    vec2 weave = vec2(h21(vec2(fr, 1.0)) - 0.5, h21(vec2(fr, 2.0)) - 0.5) * vec2(1.2, 1.8) / uRes;
    vec2 uv = vUv + weave;
    vec3 c = texture2D(tBase, uv).rgb;
    float L = dot(c, vec3(0.3, 0.59, 0.11));
    // silver print curve: deep blacks, creamy highlights
    float s = smoothstep(0.03, 0.9, L); s = pow(s, 1.18);
    vec3 bw = mix(vec3(0.012, 0.012, 0.016), vec3(0.95, 0.92, 0.84), s);
    // one kept colour: red (night) → blue (dawn); everything else stays silver
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / (mx + 1e-4);
    // hue in degrees; red keeps only true reds (taillights, lips, marker), not the sodium amber
    float hue = 0.0; float dd = mx - mn + 1e-4;
    if (mx == c.r) hue = mod((c.g - c.b) / dd, 6.0); else if (mx == c.g) hue = (c.b - c.r) / dd + 2.0; else hue = (c.r - c.g) / dd + 4.0;
    hue *= 60.0;
    float red = smoothstep(0.45, 0.7, sat) * (1.0 - smoothstep(12.0, 22.0, min(hue, 360.0 - hue))) * smoothstep(0.15, 0.35, mx);
    float blue = smoothstep(mix(0.5, 0.12, uBlueWide), mix(0.75, 0.35, uBlueWide), sat) * (1.0 - smoothstep(mix(18.0, 40.0, uBlueWide), mix(34.0, 70.0, uBlueWide), abs(hue - 222.0))) * smoothstep(mix(0.22, 0.05, uBlueWide), mix(0.45, 0.2, uBlueWide), mx);
    float keep = mix(red, blue, uKeep);
    vec3 kc = mix(vec3(dot(c, vec3(0.3, 0.59, 0.11))), c, 1.6) * 1.2;
    vec3 col = mix(bw, kc, keep);
    col = mix(col, c * 1.08, uColor);                                  // the sunrise bleeds back into colour
    // CCTV: scanlines, a cool cast, crushed resolution feel
    float sl = 0.82 + 0.18 * sin(uv.y * uRes.y * 3.14159);
    col = mix(col, col * sl * vec3(0.92, 1.0, 0.96), uCctv);
    // silver grain (two scales) + toner speckle in the blacks
    vec2 px = vUv * uRes;
    float g1 = h21(floor(px / 2.0) + fr * 17.3) - 0.5, g2 = h21(floor(px) + fr * 7.1) - 0.5;
    col += (g1 * 0.09 + g2 * 0.05) * (1.15 - s);
    col -= step(0.9965, h21(floor(px / 2.0) + fr * 3.3)) * 0.35 * (1.0 - s);
    // dust (bright specks) and the odd scratch
    col += step(0.99955, h21(floor(px / 3.0) + floor(fr / 2.0) * 9.1)) * 0.6;
    float sx = h21(vec2(floor(fr / 3.0), 5.0));
    col += (1.0 - smoothstep(0.0, 1.2, abs(px.x - sx * uRes.x))) * step(0.72, h21(vec2(floor(fr / 3.0), 6.0))) * 0.25;
    // burned edges + vignette
    vec2 q = vUv - 0.5;
    col *= mix(1.0, 0.45, smoothstep(0.38, 0.95, length(q * vec2(1.2, 1.0))));
    // flashbulb
    col = mix(col, vec3(1.0, 0.98, 0.93), uFlash);
    col += vec3(1.0, 0.95, 0.85) * uFlash * 0.4;
    // the investigator's hand on top, untouched by the silver
    vec4 o = texture2D(tOver, vUv);
    col = col * (1.0 - o.a) + o.rgb;
    gl_FragColor = vec4(col * uFade, 1.0);
  }`;

// ── build ────────────────────────────────────────────────────────────────
export async function createCaseFile({ canvas, song, base = "./assets", width = 1920, height = 1080 }) {
  const SONG = song, W = width, H = height;
  const V = (s) => s - SONG_OFFSET;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bcv = document.createElement("canvas"); bcv.width = W; bcv.height = H; const b = bcv.getContext("2d");
  const ocv = document.createElement("canvas"); ocv.width = W; ocv.height = H; const o = ocv.getContext("2d");
  const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  const tB = tex(bcv), tO = tex(ocv); tO.premultiplyAlpha = true;
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: COAT, uniforms: {
    tBase: { value: tB }, tOver: { value: tO }, uRes: { value: new THREE.Vector2(W, H) }, uFrame: { value: 0 }, uKeep: { value: 0 }, uBlueWide: { value: 0 }, uColor: { value: 0 },
    uFlash: { value: 0 }, uCctv: { value: 0 }, uFade: { value: 1 }, uHit: { value: 0 } } });
  const scene = new THREE.Scene(); scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  // images
  const img = async (src) => { const im = new Image(); im.src = src; await im.decode(); return im; };
  const P = {};
  await Promise.all(Array.from({ length: 16 }, (_, i) => "P" + String(i + 1).padStart(2, "0")).map(async (n) => (P[n] = await img(`${base}/src/${n}.png`))));
  const FR = {};                                                   // clip frames, loaded on demand list below
  const frameList = { V01: [], V02: [], V03: [], V04: [], V05: [] };
  const clipFrame = (clip, sec) => Math.max(1, Math.min(150, Math.floor(sec * 30) + 1));
  // the clip ranges the cut uses (seconds within each clip)
  const RANGES = { V01: [0.9, 1.7], V02: [0.2, 1.4], V03: [0.3, 3.8], V04: [0.4, 4.9], V05: [0.2, 5.0] };
  for (const [c, [a, z]] of Object.entries(RANGES)) for (let s = a; s <= z + 0.04; s += 1 / 30) frameList[c].push(clipFrame(c, s));
  await Promise.all(Object.entries(frameList).flatMap(([c, fs]) => [...new Set(fs)].map(async (f) => (FR[`${c}/${f}`] = await img(`${base}/frames/${c}/${String(f).padStart(3, "0")}.jpg`)))));
  const frame = (c, sec) => FR[`${c}/${clipFrame(c, sec)}`] || FR[`${c}/${frameList[c][0]}`];

  // the desk: dark worn surface, built once
  const desk = document.createElement("canvas"); desk.width = 2600; desk.height = 1600;
  { const d = desk.getContext("2d"); d.fillStyle = "#26231f"; d.fillRect(0, 0, 2600, 1600);
    for (let i = 0; i < 9000; i++) { const r = hash(i, 1), r2 = hash(i, 2); d.fillStyle = `rgba(${r > 0.5 ? 255 : 0},${r > 0.5 ? 245 : 0},${r > 0.5 ? 230 : 0},${0.02 + 0.03 * hash(i, 3)})`; d.fillRect(r * 2600, r2 * 1600, 1 + hash(i, 4) * 60, 1 + hash(i, 5) * 3); }
    const vg = d.createRadialGradient(1300, 800, 200, 1300, 800, 1500); vg.addColorStop(0, "rgba(255,240,210,0.12)"); vg.addColorStop(1, "rgba(0,0,0,0.5)"); d.fillStyle = vg; d.fillRect(0, 0, 2600, 1600); }

  // beats / kicks / lyrics in film time
  const beats = SONG.beats.map(V).filter((x) => x > -1 && x < DURATION + 1);
  const kicks = SONG.events.filter((e) => e.d === "k").map((e) => V(e.t)).filter((x) => x > -1 && x < DURATION + 1);
  const lines = SONG.lyrics.filter((l) => l.start >= SONG_OFFSET - 0.5 && l.start < SONG_OFFSET + DURATION).map((l) => ({ text: l.text, t0: V(l.start), t1: V(l.end), words: l.words.map((w) => ({ w: w.text, t: V(w.start) })) }));
  const rmsAt = (v) => SONG.rms[Math.max(0, Math.min(SONG.rms.length - 1, Math.floor((v + SONG_OFFSET) * 30)))] || 0;
  const prog = (v, a, d) => clamp((v - a) / d);

  // ── drawing helpers ────────────────────────────────────────────────────
  function cover(ctx, im, z = 1, px = 0, py = 0, pixel = 0) {
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const sw = iw / z, sh = ih / z, sx = clamp((iw - sw) / 2 + px * iw, 0, iw - sw), sy = clamp((ih - sh) / 2 + py * ih, 0, ih - sh);
    if (pixel > 1) {                                               // "enhance": blocky, then sharp
      const tw = Math.max(8, Math.round(W / pixel)), th = Math.max(5, Math.round(H / pixel));
      const t = cover._tmp || (cover._tmp = document.createElement("canvas")); t.width = tw; t.height = th;
      t.getContext("2d").drawImage(im, sx, sy, sw, sh, 0, 0, tw, th);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(t, 0, 0, W, H); ctx.restore();
    } else ctx.drawImage(im, sx, sy, sw, sh, 0, 0, W, H);
  }
  // desk camera: world px → screen; the same transform is applied to the over canvas for the marker
  function deskCam(ctx, c) { ctx.setTransform(c.z, 0, 0, c.z, W / 2 - c.x * c.z, H / 2 - c.y * c.z); if (c.r) { ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.translate(-c.x, -c.y); } }
  // every beat thumps the desk: a small push + jolt, so the still prints still hit the music
  function kickCam(c, v) {
    let p = 0, bt = 0; for (const t of beats) if (v >= t) { p = Math.exp(-(v - t) * 9); bt = t; }
    return { ...c, z: c.z * (1 + 0.025 * p), x: c.x + (hash(bt, 1) - 0.5) * 14 * p, y: c.y + (hash(bt, 2) - 0.5) * 14 * p, r: c.r + (hash(bt, 3) - 0.5) * 0.008 * p };
  }
  function drawDesk(ctx) { ctx.drawImage(desk, -300, -260); }
  // a print dropped on the desk: lands with a bounce on its beat, casts a shadow
  function print(ctx, im, cx, cy, w, rot, t0, v, crop = null, label = null) {
    if (v < t0) return;
    const k = E.back(prog(v, t0, 0.22)), a = clamp((v - t0) / 0.06);
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const [sx, sy, sw, sh] = crop || [0, 0, iw, ih];
    const h = (w * sh) / sw, bw = w * 0.035;
    const s = 1.25 - 0.25 * k;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.rotate(rot + (1 - k) * 0.06); ctx.scale(s, s);
    ctx.shadowColor = "rgba(0,0,0,0.65)"; ctx.shadowBlur = 18 + 30 * (1 - k); ctx.shadowOffsetX = 8 + 20 * (1 - k); ctx.shadowOffsetY = 12 + 26 * (1 - k);
    ctx.fillStyle = PAPER; ctx.fillRect(-w / 2 - bw, -h / 2 - bw, w + 2 * bw, h + 2 * bw + (label ? bw * 2.2 : 0));
    ctx.shadowColor = "transparent";
    ctx.drawImage(im, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    if (label) { ctx.fillStyle = INKT; ctx.font = F.type(Math.round(w * 0.035)); ctx.fillText(label, -w / 2, h / 2 + bw * 2.2); }
    ctx.restore();
  }
  function card(ctx, x, y, w, h, rot, t0, v, lines, typeFrom, typeDur) {
    if (v < t0) return;
    const k = E.back(prog(v, t0, 0.2));
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1.15 - 0.15 * k, 1.15 - 0.15 * k); ctx.globalAlpha = clamp((v - t0) / 0.06);
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 20; ctx.shadowOffsetX = 10; ctx.shadowOffsetY = 14;
    ctx.fillStyle = "#efe9da"; ctx.fillRect(0, 0, w, h); ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(200,60,50,0.45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 62); ctx.lineTo(w, 62); ctx.stroke();
    ctx.strokeStyle = "rgba(90,120,180,0.25)"; ctx.lineWidth = 1; for (let yy = 104; yy < h; yy += 40) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    // typed text: characters appear over [typeFrom, typeFrom+typeDur]
    const all = lines.join("\n"), n = Math.floor(all.length * clamp((v - typeFrom) / typeDur));
    let shown = all.slice(0, n).split("\n");
    ctx.fillStyle = INKT;
    shown.forEach((ln, i) => { ctx.font = F.type(i === 0 ? 26 : 30, i === 0); ctx.fillText(ln, 30, i === 0 ? 44 : 96 + (i - 1) * 40); });
    ctx.restore();
  }
  function stamp(ctx, textStr, x, y, rot, size, t0, v, color = RED) {
    if (v < t0) return;
    const k = E.back(prog(v, t0, 0.16)), s = 1 + 0.9 * (1 - k);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.globalAlpha = clamp((v - t0) / 0.04) * 0.92;
    ctx.font = F.stamp(size); const tw = ctx.measureText(textStr).width;
    ctx.strokeStyle = color; ctx.lineWidth = size * 0.07; ctx.strokeRect(-tw / 2 - size * 0.3, -size * 0.85, tw + size * 0.6, size * 1.1);
    ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(textStr, 0, 0);
    // worn ink: knock holes out of the stamp
    ctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(0,0,0,${0.3 + 0.5 * hash(i, 9)})`; ctx.fillRect((hash(i, 1) - 0.5) * (tw + size), (hash(i, 2) - 0.8) * size, 1 + hash(i, 3) * 6, 1 + hash(i, 4) * 3); }
    ctx.restore();
  }
  // grease pencil: a wobbly hand loop / line, drawn in real time
  function loop(ctx, cx, cy, rx, ry, seed, p, width = 6) {
    if (p <= 0) return;
    const pts = [], N = 70, turns = 1.12;
    for (let i = 0; i <= N; i++) { const a = -0.6 + (i / N) * Math.PI * 2 * turns, j = 1 + (hash(seed, i) - 0.5) * 0.08 + 0.05 * Math.sin(i * 0.3 + seed); pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]); }
    stroke(ctx, pts, p, width);
  }
  function stroke(ctx, pts, p, width = 6, color = RED) {
    const n = Math.max(2, Math.floor(pts.length * E.out(p)));
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = 0.92;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.restore();
  }
  function hand(ctx, str, x, y, size, rot, p, color = RED) {
    if (p <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.font = F.hand(size); ctx.fillStyle = color; ctx.globalAlpha = 0.95;
    const n = Math.ceil(str.length * E.out(p)); ctx.fillText(str.slice(0, n), 0, 0); ctx.restore();
  }
  function osd(ctx, v, cam, place) {
    ctx.save(); ctx.font = F.osd(40); ctx.fillStyle = "rgba(235,240,235,0.92)";
    ctx.fillText(`${cam}  ${place}`, 90, 100);
    const secs = 14 * 60 + 7 + Math.floor(v * 3.1);
    ctx.fillText(`2026-09-29  02:${String(Math.floor(secs / 60) % 60).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`, 90, H - 80);
    if (Math.floor(v * 2) % 2 === 0) { ctx.fillStyle = "#ff2a1a"; ctx.beginPath(); ctx.arc(W - 170, 88, 10, 0, 7); ctx.fill(); }
    ctx.fillStyle = "rgba(235,240,235,0.92)"; ctx.fillText("REC", W - 150, 100);
    ctx.restore();
  }
  // the lyric as the case transcript: a typed subtitle strip, word by word
  function transcript(ctx, v) {
    for (const ln of lines) {
      const nx = lines[lines.indexOf(ln) + 1], end = nx ? nx.t0 - 0.02 : ln.t1 + 1;
      if (v < ln.t0 - 0.05 || v > end) continue;
      const words = ln.words.filter((w) => v >= w.t - 0.02).map((w) => w.w).join(" ");
      if (!words) continue;
      ctx.save(); ctx.font = F.type(34, true);
      const tw = ctx.measureText(`"${words}"`).width;
      ctx.fillStyle = "rgba(233,227,211,0.94)"; ctx.fillRect(90, H - 176, tw + 190, 58);
      ctx.fillStyle = INKT; ctx.fillText("S-07:", 108, H - 136); ctx.fillText(`"${words}"`, 220, H - 136);
      ctx.restore();
    }
  }

  // ── segments ───────────────────────────────────────────────────────────
  const DRAW = {
    cctv1(v, s) {
      cover(b, frame("V01", 0.9 + (v - s.t0)), 1.15 + 0.1 * prog(v, 0, 0.66)); osd(o, v, "CAM 02", "LEVEL B2 · PARKING");
      const t1 = "CASE FILE", t2 = "0214", n = Math.floor(13 * prog(v, 0.05, 0.42));
      o.save(); o.textAlign = "center"; o.font = F.type(150, true); o.fillStyle = "#f2ede0";
      o.fillText(t1.slice(0, Math.min(9, n)), W / 2, H / 2 - 10);
      o.font = F.stamp(240); o.fillStyle = RED; if (n > 9) o.fillText(t2.slice(0, n - 9), W / 2, H / 2 + 220);
      o.restore();
      return { cctv: 1 };
    },
    cctv2(v, s) {
      cover(b, P.P06, 1.12 + 0.06 * prog(v, s.t0, 1)); osd(o, v, "CAM 03", "TUNNEL · NORTHBOUND");
      loop(o, W * 0.5, H * 0.53, 330, 170, 3, prog(v, 0.9, 0.45), 7);
      hand(o, "BLACK COUPE — NO PLATES", W * 0.5 + 180, H * 0.53 - 210, 44, -0.05, prog(v, 1.2, 0.35));
      return { cctv: 1 };
    },
    deskA(v, s) {
      const u = prog(v, s.t0, s.t1 - s.t0), c = kickCam({ x: lerp(1080, 1240, E.inout(u)), y: lerp(720, 680, E.inout(u)), z: lerp(0.98, 1.12, E.inout(u)), r: -0.02 }, v);
      deskCam(b, c); drawDesk(b);
      print(b, P.P02, 1000, 680, 900, -0.05, 1.67, v, null, "EXHIBIT 03 — ROUTE, 02:16");
      print(b, P.P13, 1640, 470, 520, 0.08, 2.28, v, null, "EXHIBIT 04");
      print(b, P.P14, 1600, 1010, 560, -0.1, 2.88, v, null, "EXHIBIT 05");
      card(b, 430, 900, 620, 300, 0.05, 2.0, v, ["STATEMENT 1   02:16 AM", "\"like we still got", "all night\""], 2.05, 1.3);
      deskCam(o, c);
      // the route traced on the aerial print
      const route = []; for (let i = 0; i <= 40; i++) { const t = i / 40; route.push([1000 - 380 + t * 520 + Math.sin(t * 5) * 20, 680 + 260 - t * 330 + hash(i, 7) * 6]); }
      stroke(o, route, prog(v, 2.3, 1.2), 7);
      loop(o, 1690, 440, 120, 115, 11, prog(v, 3.2, 0.4), 6);
      o.setTransform(1, 0, 0, 1, 0, 0);
      return {};
    },
    cctvHer(v, s) { cover(b, frame("V02", 0.2 + (v - s.t0)), 1.18); osd(o, v, "CAM 05", "IN-CAR · DRIVER"); hand(o, "SUBJECT 07", W * 0.62, H * 0.22, 56, -0.06, prog(v, 4.5, 0.4)); loop(o, W * 0.64, H * 0.36, 170, 190, 17, prog(v, 4.42, 0.4), 6); return { cctv: 1 }; },
    enhance(v, s) {
      // three beats: blocks → finer → sharp, zooming into her eye
      const step = v < 5.95 ? 0 : v < 6.55 ? 1 : 2;
      const z = [1.3, 1.9, 2.7][step], pix = [34, 12, 0][step];
      cover(b, P.P10, z + 0.04 * prog(v, [5.32, 5.95, 6.55][step], 0.6), -0.122, -0.111, pix);
      o.save(); o.font = F.osd(46); o.fillStyle = "rgba(235,240,235,0.95)"; o.fillText(`ENHANCE  ×${[2, 4, 8][step]}`, 90, 100); o.restore();
      o.save(); o.strokeStyle = "rgba(235,240,235,0.8)"; o.lineWidth = 2; const bw = [760, 560, 420][step], bh = bw * 0.55; o.strokeRect(W / 2 - bw / 2, H / 2 - bh / 2, bw, bh); o.beginPath(); o.moveTo(W / 2 - 30, H / 2); o.lineTo(W / 2 + 30, H / 2); o.moveTo(W / 2, H / 2 - 30); o.lineTo(W / 2, H / 2 + 30); o.stroke(); o.restore();
      if (step === 2) hand(o, "IT'S HER.", W * 0.5 + 250, H * 0.5 - 150, 72, -0.07, prog(v, 6.58, 0.2));
      return { cctv: 0.6, flash: [5.32, 5.95, 6.55].some((t) => v >= t && v < t + 0.05) ? 0.6 : 0 };
    },
    deskLie(v, s) {
      const u = prog(v, s.t0, s.t1 - s.t0), c = kickCam({ x: lerp(1180, 1120, E.inout(u)), y: lerp(700, 760, u), z: lerp(0.98, 1.12, E.inout(u)), r: 0.015 }, v);
      deskCam(b, c); drawDesk(b);
      print(b, P.P05, 820, 560, 640, -0.07, 6.74, v, null, "EXHIBIT 09 — 02:19");
      print(b, P.P04, 1500, 520, 600, 0.06, 7.18, v, null, "EXHIBIT 10");
      card(b, 560, 900, 700, 250, -0.03, 7.18, v, ["STATEMENT 4   02:19 AM", "\"even if it's a lie\""], 7.2, 1.1);
      // polygraph strip: the song's own loudness, the needle spiking on "lie"
      if (v > 7.3) {
        const x0 = 1290, y0 = 860, w = 840, h = 200, k = E.out(prog(v, 7.3, 0.25));
        b.save(); b.translate(x0 + (1 - k) * 500, y0); b.rotate(0.04);
        b.shadowColor = "rgba(0,0,0,0.6)"; b.shadowBlur = 16; b.shadowOffsetY = 10; b.fillStyle = "#f1ecde"; b.fillRect(0, 0, w, h); b.shadowColor = "transparent";
        b.strokeStyle = "rgba(0,0,0,0.12)"; b.lineWidth = 1; for (let gx = 0; gx < w; gx += 24) { b.beginPath(); b.moveTo(gx, 0); b.lineTo(gx, h); b.stroke(); } for (let gy = 0; gy < h; gy += 24) { b.beginPath(); b.moveTo(0, gy); b.lineTo(w, gy); b.stroke(); }
        b.strokeStyle = RED; b.lineWidth = 3; b.beginPath();
        for (let i = 0; i <= 160; i++) {
          const tt = v - 2.2 + (i / 160) * 2.2, lieSpike = Math.exp(-Math.pow((tt - 8.26) * 7, 2)) * 70;
          const yy = h / 2 - (rmsAt(tt) - 0.25) * 150 - lieSpike * Math.sin(tt * 60) - Math.sin(tt * 23 + i) * 4;
          const xx = (i / 160) * w; i ? b.lineTo(xx, yy) : b.moveTo(xx, yy);
        }
        b.stroke(); b.restore();
      }
      stamp(b, "UNVERIFIED", 820, 990, -0.16, 110, 8.26, v);
      // redaction bars sweep the rest
      if (v > 9.0) { const k = E.expo(prog(v, 9.0, 0.3)); b.fillStyle = "#070707"; b.save(); b.translate(820, 560); b.rotate(-0.07); b.fillRect(-60, 205, 290 * k, 34); b.restore(); b.save(); b.translate(1500, 520); b.rotate(0.06); b.fillRect(-300, 190, 380 * k, 30); b.restore(); }
      deskCam(o, c);
      loop(o, 1500, 470, 230, 250, 23, prog(v, 7.6, 0.4), 6);
      hand(o, "WHO WAS SHE WRITING TO?", 1280, 190, 46, -0.04, prog(v, 7.9, 0.5));
      o.setTransform(1, 0, 0, 1, 0, 0);
      return {};
    },
    flurry(v, s) {
      // eight frames on the half-beats, a shutter snap between each
      const list = [["V03", 0.6], ["P06"], ["P01"], ["V03", 2.4], ["P14"], ["P07"], ["P03"], ["P16"]];
      const i = Math.min(7, Math.floor((v - s.t0) / ((s.t1 - s.t0) / 8))), it = list[i];
      const im = it[0].startsWith("V") ? frame(it[0], it[1] + (v - s.t0) * 0.3) : P[it[0]];
      cover(b, im, 1.2 + 0.25 * hash(i, 3), (hash(i, 4) - 0.5) * 0.1, (hash(i, 5) - 0.5) * 0.08);
      o.save(); o.font = F.osd(40); o.fillStyle = "rgba(235,240,235,0.95)"; o.fillText(`FRAME ${String(31 + i).padStart(3, "0")} / 214`, 90, 100); o.restore();
      const local = (v - s.t0) % ((s.t1 - s.t0) / 8);
      return { flash: local < 0.035 ? 0.9 : 0, cctv: 0.4 };
    },
    dawn(v, s) {
      cover(b, frame("V04", 0.4 + (v - s.t0) * 1.9), 1.1 + 0.05 * prog(v, s.t0, 2));
      osd(o, v + 200, "CAM 11", "RING ROAD · EAST");
      hand(o, "05:47 — SUNRISE", W * 0.58, H * 0.32, 58, -0.05, prog(v, 12.82, 0.4), "#2f6bff");
      return { cctv: 0.5 };
    },
    board(v, s) {
      const u = prog(v, s.t0, s.t1 - s.t0), c = kickCam({ x: lerp(1000, 1800, E.inout(u)), y: lerp(640, 720, u), z: 0.86, r: 0 }, v);
      deskCam(b, c); b.fillStyle = "#2c2721"; b.fillRect(-400, -300, 3400, 2000); drawDesk(b);
      const pins = [[P.P08, 620, 520, 520, -0.05, "EX 11"], [P.P15, 1180, 360, 470, 0.06, "EX 12"], [P.P16, 1180, 860, 470, -0.04, "EX 13"], [P.P04, 1720, 560, 420, 0.07, "EX 10"], [P.P11, 2200, 420, 560, -0.06, "EX 14"], [P.P09, 2200, 960, 460, 0.05, "EX 15"]];
      pins.forEach(([im, x, y, w, r, l], i) => print(b, im, x, y, w, r, s.t0 - 1, v, null, l));
      deskCam(o, c);
      // red string between exhibits, pulled taut on the beats
      const links = [[0, 1, 13.82], [1, 2, 14.45], [2, 3, 15.05], [3, 4, 15.65], [4, 5, 15.65]];
      links.forEach(([a, z, t]) => { const p = prog(v, t, 0.25); if (p <= 0) return; const A = pins[a], Z = pins[z]; const pts = []; for (let k = 0; k <= 30; k++) { const q = k / 30; pts.push([lerp(A[1], Z[1], q), lerp(A[2] - 120, Z[2] - 120, q) + Math.sin(q * Math.PI) * 40]); } stroke(o, pts, p, 4); });
      pins.forEach(([im, x, y]) => { o.fillStyle = RED; o.beginPath(); o.arc(x, y - 120, 9, 0, 7); o.fill(); });
      hand(o, "NOTHING NEW.", 1420, 1280, 64, -0.03, prog(v, 15.3, 0.4));
      o.setTransform(1, 0, 0, 1, 0, 0);
      return {};
    },
    sheet(v, s) {
      // a contact sheet: 16 frames of her; the grease pencil circles "more of you"
      const u = prog(v, s.t0, s.t1 - s.t0), c = kickCam({ x: lerp(1080, 1500, E.inout(u)), y: lerp(560, 940, E.inout(u)), z: lerp(1.0, 1.12, E.inout(u)), r: -0.01 }, v);
      deskCam(b, c); drawDesk(b);
      b.save(); b.shadowColor = "rgba(0,0,0,0.6)"; b.shadowBlur = 30; b.shadowOffsetY = 16; b.fillStyle = "#101010"; b.fillRect(430, 150, 1740, 1300); b.restore();
      const srcs = [P.P03, P.P10, P.P16, P.P12, frame("V02", 0.4), P.P05, P.P08, frame("V02", 1.1), P.P10, P.P03, P.P16, frame("V05", 2.0), P.P03, P.P10, frame("V02", 0.8), P.P12];
      srcs.forEach((im, i) => {
        const col = i % 4, row = Math.floor(i / 4), x = 480 + col * 425, y = 200 + row * 310;
        const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, zz = 1.3 + hash(i, 8) * 0.8;
        b.drawImage(im, (iw - iw / zz) * hash(i, 9), (ih - ih / zz) * hash(i, 10), iw / zz, ih / zz, x, y, 400, 225);
        b.fillStyle = "#d8d2c2"; b.font = F.type(18, true); b.fillText(`${14 + i}A`, x, y + 252);
      });
      deskCam(o, c);
      [[0, 16.26], [5, 16.86], [9, 17.47], [14, 18.07]].forEach(([i, t], k) => { const col = i % 4, row = Math.floor(i / 4); loop(o, 680 + col * 425, 312 + row * 310, 235, 150, 31 + k, prog(v, t, 0.3), 7); });
      hand(o, "MORE OF YOU", 1700, 1340, 84, -0.04, prog(v, 17.94, 0.4));
      o.setTransform(1, 0, 0, 1, 0, 0);
      return {};
    },
    sheetZoom(v, s) { cover(b, P.P10, 1.5 + 0.8 * E.expo(prog(v, s.t0, 0.5)), -0.122, -0.111); loop(o, W * 0.5, H * 0.5, 360, 220, 41, 1, 8); return { flash: v < s.t0 + 0.05 ? 0.7 : 0 }; },
    roof(v, s) {
      const u = prog(v, s.t0, s.t1 - s.t0), c = kickCam({ x: lerp(1220, 1120, E.inout(u)), y: lerp(760, 700, E.inout(u)), z: lerp(0.84, 1.12, E.inout(u)), r: 0.01 }, v);
      deskCam(b, c); drawDesk(b);
      print(b, P.P11, 1150, 650, 1150, -0.03, s.t0, v, null, "EXHIBIT 14 — LAST KNOWN LOCATION");
      card(b, 1330, 890, 600, 240, 0.05, 20.6, v, ["LAST SEEN", "ROOFTOP, LEVEL 9", "05:46 AM"], 20.7, 1.4);
      deskCam(o, c);
      loop(o, 1150 - 575 + 0.35 * 1150, 650 - 323 + 0.73 * 646, 130, 70, 51, prog(v, 21.2, 0.5), 6);
      hand(o, "HER CAR.", 1150 - 575 + 0.35 * 1150 - 60, 650 - 323 + 0.73 * 646 + 130, 50, -0.04, prog(v, 21.8, 0.5));
      o.setTransform(1, 0, 0, 1, 0, 0);
      return {};
    },
    sunrise(v, s) {
      cover(b, frame("V05", 0.2 + (v - s.t0)), 1.08 + 0.06 * prog(v, s.t0, 5));
      stamp(o, "CASE 0214 — UNSOLVED", W * 0.5, H * 0.46, -0.08, 110, 27.8, v);
      return { color: E.inout(prog(v, 24.3, 2.8)) };
    },
    end(v, s) {
      b.fillStyle = "#070707"; b.fillRect(0, 0, W, H);
      b.save(); b.fillStyle = "#e4dece"; b.font = F.type(92, true); b.textAlign = "center";
      const txt = "END OF FILE 0214", n = Math.floor(txt.length * prog(v, s.t0 + 0.02, 0.45));
      b.fillText(txt.slice(0, n), W / 2, H / 2 - 10);
      b.font = F.type(34); const t2 = "SUBJECT 07 · WHEREABOUTS UNKNOWN", n2 = Math.floor(t2.length * prog(v, s.t0 + 0.4, 0.4));
      b.fillText(t2.slice(0, n2), W / 2, H / 2 + 70); b.restore();
      return { color: 0 };
    },
  };

  // ── render ─────────────────────────────────────────────────────────────
  const hitAt = (v) => { let h = 0; for (const k of kicks) if (v >= k) h = Math.max(h, Math.exp(-(v - k) * 8)); return h; };
  function render(v) {
    v = clamp(v, 0, DURATION - 1e-4);
    const s = segAt(v);
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H);
    o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, W, H);
    const r = DRAW[s.id](v, s) || {};
    b.setTransform(1, 0, 0, 1, 0, 0); o.setTransform(1, 0, 0, 1, 0, 0);
    if (!["end", "deskA", "deskLie", "cctv1", "roof"].includes(s.id)) transcript(b, v);
    tB.needsUpdate = true; tO.needsUpdate = true;
    const U = mat.uniforms;
    U.uFrame.value = Math.floor(v * 24);                           // silver clock ticks at 24: film, not video
    U.uKeep.value = clamp((v - 12.82) / 0.3);
    U.uBlueWide.value = s.id === "dawn" ? E.out(prog(v, 12.82, 0.35)) : 0;
    U.uColor.value = r.color || 0;
    U.uCctv.value = r.cctv || 0;
    const cutFlash = v - s.t0 < 0.06 && s.t0 > 0 ? 0.55 * (1 - (v - s.t0) / 0.06) : 0;
    U.uFlash.value = Math.max(r.flash || 0, cutFlash, v < 0.08 ? 1 - v / 0.08 : 0);
    U.uHit.value = hitAt(v);
    U.uFade.value = Math.min(1, (DURATION - v) / 0.3);
    renderer.setRenderTarget(null); renderer.render(scene, cam);
    return { seg: s.id };
  }
  return { render, DURATION, SONG_OFFSET };
}
