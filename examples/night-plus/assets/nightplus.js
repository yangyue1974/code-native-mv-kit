/* nightplus.js — "NIGHT+ · Night Subscription", a 30-second spot cut to
 * "2AM in Your Car" (song 52.9 → 82.9).
 *
 * Generated plates are the base; everything else is rendered on top, on the beat:
 *   shots      ~30 shots, each a move over a still or a stretch of a clip (frame-exact)
 *   transitions hard cut, flash, whip (motion-blurred pan), slice, crash-zoom
 *   coating    the "NIGHT+ print proof": grade → CMY halftone → plate misregistration that
 *              jumps on the kicks → ink edges → halation → grain. It covers plates, clips and
 *              (lightly) the graphics, so the whole spot reads as one printed, rendered object.
 *   graphics   the ad system: supers, feature cards, toggles, meters, phone UI, price cards,
 *              sunrise slider, pop-ups, renew CTA, payment declined, legal, end card.
 * render(v) is a pure function of spot time v (0..30).
 */
import * as THREE from "three";

// ── time + easing ────────────────────────────────────────────────────────
export const SONG_OFFSET = 52.9, DURATION = 30;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: (t) => clamp(t),
  out: (t) => 1 - Math.pow(1 - clamp(t), 3),
  in: (t) => Math.pow(clamp(t), 3),
  inout: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  expo: (t) => (clamp(t) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t))),
  back: (t) => { t = clamp(t); const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

// ── palette + type ───────────────────────────────────────────────────────
const MAG = "#ff2d87", WHITE = "#f4f2ff", INK = "rgba(6,10,30,0.74)", COBALT = "#3d7bff", AMBER = "#ffb547", RED = "#ff3b3b";
const F = {
  logo: (s) => `400 ${s}px Michroma`,
  serif: (s) => `italic 300 ${s}px Newsreader`,
  serifB: (s) => `italic 500 ${s}px Newsreader`,
  mono: (s) => `300 ${s}px 'IBM Plex Mono'`,
  monoB: (s) => `500 ${s}px 'IBM Plex Mono'`,
  num: (s) => `800 ${s}px 'Big Shoulders Display'`,
};

// ── the cut ──────────────────────────────────────────────────────────────
// plate coordinates are image UVs (0..1, y down). move: zoom z, pan x/y (image UV), roll r (rad).
const mv = (z0, z1, x0 = 0, x1 = 0, y0 = 0, y1 = 0, ease = "inout", r0 = 0, r1 = 0) => ({ z0, z1, x0, x1, y0, y1, ease, r0, r1 });
const SHOTS = [
  // "Just drive" — ignition, the car, the logo
  { t0: 0.0, src: "V01", from: 2.05, rate: 1.25, m: mv(1.28, 1.42, 0.02, 0.04, 0, 0, "out"), tr: "flash" },
  { t0: 0.53, src: "P06", m: mv(1.75, 1.12, 0, 0, 0.03, 0, "expo"), tr: "flash", flash: MAG },
  { t0: 1.11, src: "P01", m: mv(1.02, 1.1, -0.03, 0.02, 0, 0, "out") },
  // "Like we still got all night" — unlimited night
  { t0: 1.74, src: "P02", m: mv(1.22, 1.1, 0, 0, -0.06, 0.04, "inout"), tr: "whipUp" },
  { t0: 2.94, src: "P13", m: mv(1.0, 1.55, 0.1, 0.17, -0.02, -0.06, "expo"), tr: "zoom" },
  // "Like you still might be mine" — maybe mode
  { t0: 3.55, src: "V02", from: 0.35, rate: 1.0, m: mv(1.12, 1.2, 0.02, 0.05, 0, 0, "lin"), tr: "slice" },
  { t0: 5.38, src: "P10", m: mv(1.55, 1.6, -0.05, -0.05, 0.02, 0.02, "lin") },
  { t0: 5.68, src: "P10", m: mv(2.3, 2.35, 0.1, 0.11, -0.02, -0.02, "lin") },
  { t0: 5.98, src: "P16", m: mv(1.35, 1.5, 0.08, 0.1, -0.06, -0.06, "out") },
  // "Like this isn't goodbye" — the goodbye blocker
  { t0: 6.55, src: "P05", m: mv(1.12, 1.24, 0.03, 0.06, 0, -0.02, "inout"), tr: "whipLeft" },
  { t0: 7.82, src: "P04", m: mv(1.5, 1.32, 0.03, 0.03, -0.02, -0.03, "expo"), tr: "flash", flash: RED },
  { t0: 9.05, src: "P14", m: mv(1.15, 1.35, -0.05, 0.05, 0, 0, "in"), tr: "whipLeft" },
  // "Just drive" — the plans slam in
  { t0: 9.9, src: "V03", from: 0.3, rate: 1.6, m: mv(1.2, 1.35, 0, 0, 0, 0, "in"), tr: "flash", flash: WHITE },
  { t0: 10.46, src: "V03", from: 2.2, rate: 2.2, m: mv(1.45, 1.6, 0, 0, 0, 0, "in"), tr: "zoom" },
  { t0: 10.88, src: "P06", m: mv(2.1, 1.25, 0, 0, 0.02, 0.02, "expo"), tr: "flash", flash: MAG },
  // "Till the city turns blue" — sunrise delay (the time-lapse runs backwards)
  { t0: 11.51, src: "V04", from: 4.95, rate: -1.45, m: mv(1.08, 1.18, 0, 0.02, 0, 0, "lin"), tr: "slice" },
  // "I don't need something new" — pop-ups, swiped away
  { t0: 13.95, src: "P08", m: mv(1.2, 1.3, 0.1, 0.12, 0.03, 0.03, "inout"), tr: "whipLeft" },
  { t0: 15.16, src: "P15", m: mv(1.35, 1.45, 0, 0, 0.06, 0.06, "out"), tr: "flash", flash: WHITE },
  // "I just need more of you" — the bottle, then +MORE on every half beat
  { t0: 16.14, src: "P09", m: mv(1.06, 1.16, -0.02, 0, 0, 0, "inout"), tr: "zoom" },
  { t0: 17.62, src: "P03", m: mv(1.5, 1.55, 0.1, 0.1, -0.08, -0.08, "lin"), tr: "cut" },
  { t0: 17.92, src: "P10", m: mv(1.9, 1.95, 0.02, 0.02, 0.01, 0.01, "lin") },
  { t0: 18.22, src: "P16", m: mv(1.6, 1.65, 0.1, 0.1, -0.06, -0.06, "lin") },
  { t0: 18.53, src: "P09", m: mv(1.9, 1.95, -0.19, -0.19, 0, 0, "lin") },
  { t0: 18.83, src: "P03", m: mv(2.2, 2.25, 0.14, 0.14, -0.13, -0.13, "lin") },
  { t0: 19.14, src: "P10", m: mv(2.6, 2.65, 0.08, 0.08, -0.02, -0.02, "lin") },
  { t0: 19.45, src: "P09", m: mv(1.3, 1.18, -0.08, -0.06, 0, 0, "expo"), tr: "flash", flash: MAG },
  // "Tonight" (held) — renew?
  { t0: 19.9, src: "P11", m: mv(1.35, 1.12, 0.02, 0, 0.05, 0.03, "out"), tr: "slice" },
  { t0: 22.49, src: "V02", from: 3.0, rate: 0.7, m: mv(1.28, 1.36, 0.06, 0.08, -0.04, -0.04, "lin"), tr: "dissolve" },
  // "Tonight" — declined; the sun rises anyway
  { t0: 25.09, src: "P11", m: mv(1.2, 1.26, 0, 0, 0.02, 0.02, "lin"), tr: "slice", glitch: 1 },
  { t0: 25.54, src: "V05", from: 0.2, rate: 1.0, m: mv(1.1, 1.2, 0, 0, 0.02, 0, "lin"), tr: "flash", flash: WHITE },
  { t0: 28.58, src: "END", m: mv(1, 1), tr: "dissolve" },
];
SHOTS.forEach((s, i) => { s.i = i; s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : DURATION; });
const shotAt = (v) => { let s = SHOTS[0]; for (const sh of SHOTS) if (v >= sh.t0) s = sh; return s; };

// ── shaders ──────────────────────────────────────────────────────────────
const VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const PLATE_FS = /* glsl */ `
  uniform sampler2D tex; uniform float uZoom, uRot, uAspect, uBlur, uRadial, uExp;
  uniform vec2 uPan, uVel;
  varying vec2 vUv;
  vec2 plateUV(vec2 s){                           // screen UV (y down) → plate UV (y down)
    vec2 p = s - 0.5; p.x *= uAspect;
    float c = cos(-uRot), sn = sin(-uRot); p = vec2(c * p.x - sn * p.y, sn * p.x + c * p.y);
    p.x /= uAspect; p /= uZoom; return p + 0.5 + uPan;
  }
  vec3 tap(vec2 s){ vec2 u = clamp(plateUV(s), 0.001, 0.999); return texture2D(tex, vec2(u.x, 1.0 - u.y)).rgb; }
  void main(){
    vec2 s = vec2(vUv.x, 1.0 - vUv.y);
    vec3 c = vec3(0.0); float w = 0.0;
    for (int i = 0; i < 14; i++) {                // motion blur along the pan and outward from the zoom
      float k = float(i) / 13.0 - 0.5;
      vec2 o = uVel * k * uBlur + (s - 0.5) * uRadial * k;
      c += tap(s + o); w += 1.0;
    }
    gl_FragColor = vec4(c / w * uExp, 1.0);
  }`;
const MIX_FS = /* glsl */ `
  uniform sampler2D tA, tB; uniform float uMode, uP, uSeed; varying vec2 vUv;
  float h(float n){ return fract(sin(n * 91.3 + uSeed) * 43758.5); }
  void main(){
    vec3 a = texture2D(tA, vUv).rgb, b = texture2D(tB, vUv).rgb;
    if (uMode < 0.5) { gl_FragColor = vec4(a, 1.0); return; }
    if (uMode < 1.5) { gl_FragColor = vec4(mix(a, b, smoothstep(0.0, 1.0, uP)), 1.0); return; }   // dissolve
    // slice: horizontal bands flip to B at their own moment, each shoved sideways as it goes
    float band = floor((1.0 - vUv.y) * 22.0);
    float at = h(band);
    float on = step(at, uP * 1.25 - 0.1);
    float shove = (1.0 - smoothstep(0.0, 0.25, uP * 1.25 - 0.1 - at)) * (h(band + 7.0) - 0.5) * 0.25;
    vec3 bb = texture2D(tB, vUv + vec2(shove * on, 0.0)).rgb, aa = texture2D(tA, vUv + vec2(shove * (1.0 - on), 0.0)).rgb;
    gl_FragColor = vec4(mix(aa, bb, on), 1.0);
  }`;
const COAT_FS = /* glsl */ `
  uniform sampler2D tBase, tGfx; uniform vec2 uRes; uniform float uFrame, uHit, uHalf, uMis, uInk, uGrain, uMorning, uFlash, uGfxMis, uCell;
  uniform vec3 uFlashCol; uniform float uFade;
  varying vec2 vUv;
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  vec3 base(vec2 uv){ return texture2D(tBase, uv).rgb; }
  float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
  // one CMY plate as a rotated dot screen: coverage of that ink at this pixel
  float screen(vec2 px, float ang, int ch){
    float c = cos(ang), s = sin(ang);
    vec2 r = mat2(c, -s, s, c) * px;
    vec2 cell = floor(r / uCell) + 0.5, f = fract(r / uCell) - 0.5;
    vec2 centre = mat2(c, s, -s, c) * (cell * uCell);
    vec3 src = base(clamp(centre / uRes, 0.0, 1.0));
    float ink = 1.0 - (ch == 0 ? src.r : ch == 1 ? src.g : src.b);
    float rad = sqrt(clamp(ink, 0.0, 1.0)) * 0.62;
    return 1.0 - smoothstep(rad - 0.08, rad + 0.08, length(f));
  }
  void main(){
    vec2 uv = vUv, px = uv * uRes;
    // plate misregistration: cyan and magenta plates slip, and jump on the kicks
    vec2 dir = normalize(vec2(1.0, 0.35));
    vec2 off = dir * uMis / uRes;
    vec3 col = vec3(base(uv + off).r, base(uv).g, base(uv - off).b);
    // grade: ink-navy blacks, warm highlights, cobalt + amber pushed
    float L = lum(col);
    col = mix(vec3(L), col, 1.28);
    col = pow(max(col, 0.0), vec3(0.95, 0.97, 0.9));
    col = mix(vec3(0.02, 0.03, 0.09), col, smoothstep(-0.05, 0.55, L) * 0.9 + 0.1);
    col += vec3(0.05, 0.02, -0.02) * smoothstep(0.55, 1.0, L);
    // morning: the sun wins — lift and cool the whole spot
    col = mix(col, col * vec3(0.95, 1.05, 1.18) + vec3(0.04, 0.06, 0.1), uMorning);
    // CMY halftone, mixed in; strongest in the mid-tones and lights (the "print" surface)
    vec3 dots = vec3(1.0) - vec3(screen(px, 0.2618, 0), screen(px, 1.309, 1), screen(px, 0.0, 2));
    float mid = smoothstep(0.04, 0.35, L);
    col = mix(col, col * 0.35 + dots * col * 1.1, uHalf * mid);
    // ink edges: a fine drawn contour
    vec2 e = vec2(1.0) / uRes;
    float gx = lum(base(uv + vec2(e.x, 0.0))) - lum(base(uv - vec2(e.x, 0.0)));
    float gy = lum(base(uv + vec2(0.0, e.y))) - lum(base(uv - vec2(0.0, e.y)));
    col *= 1.0 - uInk * smoothstep(0.06, 0.22, length(vec2(gx, gy)));
    // halation: a red glow bleeding from the brightest lights
    vec3 hal = vec3(0.0);
    for (int i = 0; i < 8; i++) { float a = float(i) * 0.785; vec2 o = vec2(cos(a), sin(a)) * 7.0 / uRes; hal += max(base(uv + o) - 0.72, 0.0); }
    col += hal / 8.0 * vec3(1.4, 0.45, 0.3) * 1.6;
    // grain + vignette
    col += (h21(floor(px / 1.5) + uFrame * 13.1) - 0.5) * uGrain * (1.1 - L);
    col *= mix(1.0, 0.68, smoothstep(0.45, 1.05, length((uv - 0.5) * vec2(1.25, 1.0))));
    // graphics on top: crisp, with a whisper of the same misregistration
    vec2 go = dir * uGfxMis / uRes;
    vec4 g = texture2D(tGfx, vec2(uv.x, uv.y));
    vec4 gr = texture2D(tGfx, vec2(uv.x, uv.y) + go);
    g.rgb = vec3(gr.r, g.g, g.b);
    col = col * (1.0 - g.a) + g.rgb;
    col = mix(col, uFlashCol, uFlash);
    gl_FragColor = vec4(col * uFade, 1.0);
  }`;

// ── build ────────────────────────────────────────────────────────────────
export async function createNightPlus({ canvas, song, base = "./assets", width = 1920, height = 1080 }) {
  const SONG = song;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: false });
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;          // we grade by hand; keep sRGB values as they are
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const scene = new THREE.Scene(); scene.add(quad);
  const rt = () => new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const rtA = rt(), rtB = rt(), rtM = rt();
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(scene, cam); };

  // plates
  const loader = new THREE.TextureLoader();
  const plates = {};
  for (let i = 1; i <= 16; i++) {
    const n = "P" + String(i).padStart(2, "0");
    const t = await loader.loadAsync(`${base}/src/${n}.png`); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    plates[n] = t;
  }
  // clips: preload exactly the frames the cut uses, then swap them into one texture per clip
  const clips = {};
  const frameOf = (sh, v) => Math.max(1, Math.min(150, Math.floor((sh.from + (v - sh.t0) * sh.rate) * 30) + 1));
  const need = {};
  for (const sh of SHOTS) if (sh.src.startsWith("V")) {
    need[sh.src] = need[sh.src] || new Set();
    for (let v = sh.t0; v < sh.t1 + 0.5; v += 1 / 60) need[sh.src].add(frameOf(sh, Math.min(v, sh.t1)));
  }
  for (const [clip, set] of Object.entries(need)) {
    const imgs = {};
    await Promise.all([...set].map(async (f) => { const im = new Image(); im.src = `${base}/frames/${clip}/${String(f).padStart(3, "0")}.jpg`; await im.decode(); imgs[f] = im; }));
    const tex = new THREE.Texture(imgs[[...set][0]]); tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
    clips[clip] = { imgs, tex, cur: -1 };
  }

  const plateMat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: PLATE_FS, uniforms: {
    tex: { value: null }, uZoom: { value: 1 }, uRot: { value: 0 }, uAspect: { value: width / height }, uBlur: { value: 0 }, uRadial: { value: 0 }, uExp: { value: 1 },
    uPan: { value: new THREE.Vector2() }, uVel: { value: new THREE.Vector2() } } });
  const mixMat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: MIX_FS, uniforms: { tA: { value: rtA.texture }, tB: { value: rtB.texture }, uMode: { value: 0 }, uP: { value: 0 }, uSeed: { value: 0 } } });
  // graphics canvas
  const gcv = document.createElement("canvas"); gcv.width = width; gcv.height = height;
  const g = gcv.getContext("2d");
  const gTex = new THREE.CanvasTexture(gcv); gTex.colorSpace = THREE.NoColorSpace; gTex.premultiplyAlpha = true; gTex.minFilter = THREE.LinearFilter; gTex.generateMipmaps = false;
  const coatMat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: COAT_FS, uniforms: {
    tBase: { value: rtM.texture }, tGfx: { value: gTex }, uRes: { value: new THREE.Vector2(width, height) }, uFrame: { value: 0 }, uHit: { value: 0 },
    uHalf: { value: 0.3 }, uMis: { value: 2 }, uInk: { value: 0.35 }, uGrain: { value: 0.07 }, uMorning: { value: 0 }, uFlash: { value: 0 }, uGfxMis: { value: 0 },
    uCell: { value: 6 }, uFlashCol: { value: new THREE.Color(1, 1, 1) }, uFade: { value: 1 } } });

  // beats + hits (song time → spot time)
  const V = (s) => s - SONG_OFFSET;
  const beats = SONG.beats.map(V).filter((b) => b > -1 && b < DURATION + 1);
  const kicks = SONG.events.filter((e) => e.d === "k").map((e) => V(e.t)).filter((b) => b > -1 && b < DURATION + 1);
  const hitAt = (v) => { let h = 0; for (const k of kicks) if (v >= k) h = Math.max(h, Math.exp(-(v - k) * 7)); for (const s of SHOTS) if (v >= s.t0) h = Math.max(h, 0.6 * Math.exp(-(v - s.t0) * 9)); return h; };
  const lines = SONG.lyrics.filter((l) => l.start >= SONG_OFFSET - 0.5 && l.start < SONG_OFFSET + DURATION).map((l) => ({ text: l.text, t0: V(l.start), t1: V(l.end), words: l.words.map((w) => ({ w: w.text, t: V(w.start), e: V(w.end) })) }));

  // ── shot motion (with transition modifiers) ──
  const WHIP = 0.14, ZOOMIN = 0.22;
  function moveAt(sh, v) {
    const u = clamp((v - sh.t0) / (sh.t1 - sh.t0)), e = E[sh.m.ease](u);
    let z = lerp(sh.m.z0, sh.m.z1, e), x = lerp(sh.m.x0, sh.m.x1, e), y = lerp(sh.m.y0, sh.m.y1, e), r = lerp(sh.m.r0, sh.m.r1, e);
    // incoming modifiers
    const din = v - sh.t0;
    if ((sh.tr === "whipLeft" || sh.tr === "whipUp") && din < WHIP) { const k = 1 - E.out(din / WHIP); if (sh.tr === "whipLeft") x += 0.55 * k; else y -= 0.55 * k; }
    if (sh.tr === "zoom" && din < ZOOMIN) z *= 1 + 0.9 * (1 - E.out(din / ZOOMIN));
    // outgoing modifiers: the next shot's whip starts in this one
    const nx = SHOTS[sh.i + 1];
    if (nx && (nx.tr === "whipLeft" || nx.tr === "whipUp")) { const dout = sh.t1 - v; if (dout < WHIP) { const k = E.in(1 - dout / WHIP); if (nx.tr === "whipLeft") x -= 0.55 * k; else y += 0.55 * k; } }
    // a breath of handheld on the stills
    x += 0.0025 * Math.sin(v * 1.7 + sh.i); y += 0.002 * Math.sin(v * 1.3 + sh.i * 2);
    return { z, x, y, r };
  }
  function renderShot(sh, v, target) {
    if (sh.src === "END") { renderer.setRenderTarget(target); renderer.setClearColor(0x05081a, 1); renderer.clear(); return; }
    let tex;
    if (sh.src.startsWith("V")) {
      const c = clips[sh.src], f = frameOf(sh, v);
      const im = c.imgs[f] || c.imgs[Object.keys(c.imgs)[0]];
      if (c.cur !== f) { c.tex.image = im; c.tex.needsUpdate = true; c.cur = f; }
      tex = c.tex;
    } else tex = plates[sh.src];
    const a = moveAt(sh, v), b = moveAt(sh, v + 1 / 30);
    plateMat.uniforms.tex.value = tex;
    plateMat.uniforms.uZoom.value = a.z; plateMat.uniforms.uRot.value = a.r;
    plateMat.uniforms.uPan.value.set(a.x, a.y);
    // velocity → blur: pan velocity in screen UV, zoom velocity → radial
    plateMat.uniforms.uVel.value.set(-(b.x - a.x) * a.z, -(b.y - a.y) * a.z);
    plateMat.uniforms.uBlur.value = 2.2;
    plateMat.uniforms.uRadial.value = Math.max(0, Math.abs(b.z - a.z) / a.z * 2.5);
    plateMat.uniforms.uExp.value = 1.0;
    pass(plateMat, target);
  }
  // plate UV → screen px, for graphics that stick to things in the picture
  function toScreen(sh, v, px, py) {
    const a = moveAt(sh, v), asp = width / height;
    let x = (px - 0.5 - a.x) * a.z, y = (py - 0.5 - a.y) * a.z;
    x *= asp; const c = Math.cos(a.r), s = Math.sin(a.r); const X = c * x - s * y, Y = s * x + c * y;
    return [(X / asp + 0.5) * width, (Y + 0.5) * height, a.z];
  }

  // ── graphics ───────────────────────────────────────────────────────────
  const W = width, H = height;
  const inW = (v, a, b) => v >= a && v < b;
  const prog = (v, a, d) => clamp((v - a) / d);
  const nightClock = (v) => {
    // the spot's own clock: 02:14 → running; rewinds during the sunrise delay; declined → 06:02
    let mins = 134 + v * 2.4;
    if (v > 11.51) mins -= Math.min(v - 11.51, 2.44) * 9;
    if (v > 25.2) mins = 362 + (v - 25.2) * 0.3;
    const hh = Math.floor(mins / 60), mm = Math.floor(mins % 60), ss = Math.floor((mins * 60) % 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };
  function text(str, x, y, font, color, align = "left", alpha = 1, track = 0) {
    g.save(); g.globalAlpha *= alpha; g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic";
    if (track) g.letterSpacing = track + "px";
    g.fillText(str, x, y); g.restore();
  }
  function panel(x, y, w, h, alpha = 1, border = "rgba(255,255,255,0.22)") {
    g.save(); g.globalAlpha *= alpha; g.fillStyle = INK; g.fillRect(x, y, w, h); g.strokeStyle = border; g.lineWidth = 1.5; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); g.restore();
  }
  function wipeIn(x, y, w, h, p, draw) {        // reveal a block left → right
    if (p <= 0) return; g.save(); g.beginPath(); g.rect(x - 4, y - 80, (w + 8) * E.expo(p), h + 160); g.clip(); draw(); g.restore();
  }
  function hud(v) {
    g.save(); g.globalAlpha = 0.55; g.strokeStyle = "rgba(255,255,255,0.28)"; g.lineWidth = 1;
    g.strokeRect(44.5, 44.5, W - 89, H - 89);
    g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1.5;
    for (const [cx, cy, sx, sy] of [[44, 44, 1, 1], [W - 44, 44, -1, 1], [44, H - 44, 1, -1], [W - 44, H - 44, -1, -1]]) { g.beginPath(); g.moveTo(cx - sx * 20, cy); g.lineTo(cx - sx * 4, cy); g.moveTo(cx, cy - sy * 20); g.lineTo(cx, cy - sy * 4); g.stroke(); }
    g.restore();
    text("NIGHT+", 70, 84, F.logo(15), WHITE, "left", 0.8, 3);
    text("SUBSCRIPTION SERVICES  /  SPOT 030", 190, 84, F.mono(13), WHITE, "left", 0.5, 1);
    text("LOCAL " + nightClock(v), W - 70, 84, F.mono(14), WHITE, "right", 0.75, 1);
    const bi = beats.filter((b) => b <= v).length;
    text(`BAR ${String(Math.floor(bi / 4) + 1).padStart(2, "0")}  ·  BEAT ${(bi % 4) + 1}`, W - 70, H - 64, F.mono(13), WHITE, "right", 0.5, 1);
  }
  function supers(v) {
    // the lyric is the ad's copy: set in a luxury italic, word on its beat, the live word underlined
    for (const ln of lines) {
      const nx = lines[lines.indexOf(ln) + 1];
      const end = nx ? nx.t0 - 0.02 : ln.t1 + 1.5;
      if (v < ln.t0 - 0.05 || v > end) continue;
      const hook = /^just drive$/i.test(ln.text);
      if (hook) continue;                                            // hooks are set as full-frame type elsewhere
      const tonight = /^tonight$/i.test(ln.text);
      const fs = tonight ? 96 : 60, y = tonight ? H - 150 : H - 120;
      g.font = F.serif(fs);
      let x = 110;
      for (const wd of ln.words) {
        const p = prog(v, wd.t - 0.03, 0.18);
        const w = g.measureText(wd.w + " ").width;
        if (p > 0) {
          text(wd.w, x, y + (1 - E.out(p)) * 18, F.serif(fs), WHITE, "left", E.out(p) * clamp((end - v) / 0.12));
          if (v >= wd.t && v < (wd.e || wd.t + 0.4) + 0.1) { g.save(); g.fillStyle = MAG; g.fillRect(x, y + 12, g.measureText(wd.w).width * E.out(prog(v, wd.t, 0.15)), 4); g.restore(); }
        }
        x += w;
      }
    }
  }
  function featureCard(v, t0, t1, num, title, sub) {
    if (!inW(v, t0, t1 + 0.15)) return;
    const p = prog(v, t0, 0.3), out = clamp((t1 + 0.15 - v) / 0.15);
    const x = 110, y = 128, w = 560, h = 132;
    wipeIn(x, y, w, h, p, () => {
      g.save(); g.globalAlpha = out;
      panel(x, y, w, h);
      g.fillStyle = MAG; g.fillRect(x, y, 6, h);
      text(`FEATURE ${num}`, x + 30, y + 36, F.monoB(14), MAG, "left", 1, 3);
      text(title, x + 30, y + 82, F.logo(30), WHITE, "left", 1, 2);
      text(sub, x + 30, y + 116, F.serif(26), WHITE, "left", 0.8);
      g.restore();
    });
  }
  function callout(sx, sy, lx, ly, label, sub, p, align = "left") {
    if (p <= 0) return;
    const k = E.out(p);
    g.save(); g.strokeStyle = WHITE; g.lineWidth = 1.5; g.globalAlpha = 0.9;
    g.beginPath(); g.arc(sx, sy, 7, 0, Math.PI * 2); g.stroke();
    g.fillStyle = MAG; g.beginPath(); g.arc(sx, sy, 3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(lerp(sx, lx, k), lerp(sy, ly, k)); g.stroke();
    g.restore();
    if (k > 0.8) { text(label, lx + (align === "left" ? 12 : -12), ly - 6, F.monoB(16), WHITE, align, (k - 0.8) * 5, 2); if (sub) text(sub, lx + (align === "left" ? 12 : -12), ly + 20, F.mono(14), WHITE, align, (k - 0.8) * 4, 1); }
  }
  const quadOn = (sh, v, rect) => rect.map(([px, py]) => toScreen(sh, v, px, py));
  function clipQuad(q) { g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (const p of q.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.clip(); }

  function drawGraphics(v) {
    g.clearRect(0, 0, W, H);
    const sh = shotAt(v);
    hud(v);

    // ── "Just drive" #1: the logo ──
    if (inW(v, 0.04, 1.74)) {
      const p = prog(v, 0.06, 0.12), s = 1 + 0.35 * (1 - E.out(p));
      g.save(); g.translate(W * 0.5, H * 0.5); g.scale(s, s);
      text("NIGHT+", 0, 40, F.logo(v < 1.11 ? 150 : 120), WHITE, "center", E.out(p) * (v < 1.11 ? 1 : 0.95), 18);
      g.restore();
      if (v > 0.62) text("JUST  DRIVE.", W * 0.5, H * 0.5 + 120, F.logo(28), MAG, "center", E.out(prog(v, 0.62, 0.15)), 14);
      if (v > 1.11) text("Tonight, extended.", W * 0.5, H * 0.5 + 180, F.serif(44), WHITE, "center", E.out(prog(v, 1.11, 0.3)));
    }
    // ── 01 unlimited night ──
    featureCard(v, 1.74, 3.52, "01", "UNLIMITED NIGHT™", "Hours remaining: ∞");
    if (inW(v, 1.74, 2.94)) {
      const n = Math.floor(lerp(8, 99, E.in(prog(v, 1.9, 1.0))));
      text(v < 2.8 ? `${n}h` : "∞", W - 150, 360, F.num(v < 2.8 ? 190 : 260), WHITE, "right", 0.95);
      text("OF NIGHT LEFT", W - 150, 400, F.monoB(16), MAG, "right", 1, 4);
    }
    if (sh.src === "P13" && inW(v, 2.94, 3.55)) {
      const [mx, my] = toScreen(sh, v, 0.67, 0.44);
      callout(mx - 60, my + 40, mx - 420, my + 180, "MOON™", "INCLUDED WITH EVERY PLAN", prog(v, 3.05, 0.3), "right");
    }
    // ── 02 maybe mode ──
    featureCard(v, 3.55, 6.5, "02", "MAYBE MODE", "Keeps the question open.");
    if (inW(v, 3.86, 5.38)) {
      const on = prog(v, 4.3, 0.18), x = 110, y = 300;
      panel(x, y, 330, 76, E.out(prog(v, 3.9, 0.2)));
      text("MAYBE", x + 24, y + 48, F.logo(22), WHITE, "left", 1, 3);
      g.save(); g.fillStyle = on > 0.5 ? MAG : "rgba(255,255,255,0.18)"; g.beginPath(); g.roundRect(x + 196, y + 20, 110, 38, 19); g.fill();
      g.fillStyle = WHITE; g.beginPath(); g.arc(x + 216 + 70 * E.back(on), y + 39, 14, 0, Math.PI * 2); g.fill(); g.restore();
    }
    if (inW(v, 5.38, 6.55)) {
      // stutter on her eyes: the odds climb on each cut
      const pct = v < 5.68 ? 37 : v < 5.98 ? 52 : Math.round(lerp(52, 61, prog(v, 5.98, 0.3)));
      text(`${pct}%`, W - 130, H * 0.5, F.num(240), WHITE, "right", 1);
      text("STILL MIGHT BE MINE", W - 134, H * 0.5 + 44, F.monoB(18), MAG, "right", 1, 4);
      g.save(); g.fillStyle = "rgba(255,255,255,0.2)"; g.fillRect(W - 610, H * 0.5 + 70, 480, 6); g.fillStyle = MAG; g.fillRect(W - 610, H * 0.5 + 70, 4.8 * pct, 6); g.restore();
      if (v > 5.98) text("*Results not guaranteed. You might not be theirs.", W - 130, H * 0.5 + 118, F.mono(15), WHITE, "right", 0.7);
    }
    // ── 03 goodbye blocker ──
    featureCard(v, 6.55, 9.9, "03", "GOODBYE BLOCKER™", "Some words shouldn't be sent.");
    if (sh.src === "P05") {
      const q = quadOn(sh, v, [[0.565, 0.2], [0.69, 0.2], [0.69, 0.46], [0.565, 0.46]]);
      g.save(); clipQuad(q);
      const [x0, y0, z] = q[0], w = q[1][0] - x0;
      g.fillStyle = "rgba(10,14,40,0.92)"; g.fillRect(x0 - 5, y0 - 5, w + 10, q[2][1] - y0 + 10);
      const typed = "goodbye".slice(0, Math.floor(clamp((v - 6.9) / 0.9) * 7));
      g.fillStyle = "rgba(255,255,255,0.12)"; g.beginPath(); g.roundRect(x0 + w * 0.08, y0 + w * 0.9, w * 0.84, w * 0.28, w * 0.08); g.fill();
      text(typed + (Math.floor(v * 4) % 2 ? "|" : ""), x0 + w * 0.14, y0 + w * 1.09, F.serif(Math.round(w * 0.16)), WHITE);
      text("TO: YOU", x0 + w * 0.1, y0 + w * 0.25, F.monoB(Math.round(w * 0.07)), WHITE, "left", 0.7, 2);
      g.restore();
    }
    if (sh.src === "P04") {
      const q = quadOn(sh, v, [[0.455, 0.19], [0.615, 0.19], [0.615, 0.75], [0.455, 0.75]]);
      g.save(); clipQuad(q);
      const [x0, y0] = q[0], w = q[1][0] - x0, h = q[2][1] - y0;
      g.fillStyle = "rgba(10,14,40,0.95)"; g.fillRect(x0 - 5, y0 - 5, w + 10, h + 10);
      text("TO: YOU", x0 + w * 0.08, y0 + h * 0.08, F.monoB(Math.round(w * 0.06)), WHITE, "left", 0.7, 2);
      g.fillStyle = COBALT; g.beginPath(); g.roundRect(x0 + w * 0.3, y0 + h * 0.36, w * 0.62, h * 0.12, w * 0.06); g.fill();
      text("goodbye", x0 + w * 0.36, y0 + h * 0.44, F.serif(Math.round(w * 0.15)), WHITE);
      const sp = prog(v, 7.82, 0.2);
      g.fillStyle = RED; g.fillRect(x0 + w * 0.34, y0 + h * 0.415, w * 0.54 * E.out(sp), Math.max(3, w * 0.02));
      if (v > 8.0) {
        const s = 1 + 0.6 * (1 - E.back(prog(v, 8.0, 0.2)));
        g.translate(x0 + w * 0.5, y0 + h * 0.66); g.rotate(-0.12); g.scale(s, s);
        g.strokeStyle = RED; g.lineWidth = Math.max(3, w * 0.02); g.strokeRect(-w * 0.4, -h * 0.07, w * 0.8, h * 0.14);
        text("BLOCKED", 0, h * 0.03, F.logo(Math.round(w * 0.1)), RED, "center", 1, 3);
      }
      g.restore();
    }
    if (inW(v, 8.2, 9.9)) {
      const n = 1283 + (v > 9.05 ? 1 : 0) + (v > 9.5 ? 1 : 0);
      text(n.toLocaleString("en-US"), W - 130, 330, F.num(170), WHITE, "right", E.out(prog(v, 8.2, 0.2)));
      text("GOODBYES BLOCKED TONIGHT", W - 134, 372, F.monoB(16), MAG, "right", 1, 3);
    }
    // ── "Just drive" #2: the plans ──
    if (inW(v, 9.9, 11.51)) {
      text("JUST", 110, 250, F.logo(v < 10.46 ? 110 : 80), WHITE, "left", 1, 16);
      if (v > 10.46) text("DRIVE.", 110, 350, F.logo(110), MAG, "left", 1, 16);
      const cards = [["NIGHT", "FREE", "until sunrise", 9.9], ["NIGHT+", "$4.99", "per extra hour · most popular", 10.46], ["FOREVER NIGHT", "—", "contact sales", 10.88]];
      cards.forEach(([name, price, note, at], i) => {
        if (v < at) return;
        const p = prog(v, at, 0.14), s = 1 + 0.25 * (1 - E.out(p));
        const x = W - 170 - (2 - i) * 330 - 300, y = 470, w = 300, h = 360;
        g.save(); g.translate(x + w / 2, y + h / 2); g.scale(s, s); g.translate(-(x + w / 2), -(y + h / 2)); g.globalAlpha = E.out(p);
        panel(x, y, w, h, 1, i === 1 ? MAG : "rgba(255,255,255,0.3)");
        if (i === 1) { g.fillStyle = MAG; g.fillRect(x, y, w, 40); text("MOST POPULAR", x + w / 2, y + 27, F.monoB(14), WHITE, "center", 1, 3); }
        text(name, x + 26, y + 96, F.logo(22), WHITE, "left", 1, 2);
        text(price, x + 26, y + 230, F.num(price.length > 3 ? 110 : 130), i === 1 ? WHITE : WHITE, "left", 1);
        text(note, x + 26, y + 290, F.serif(24), WHITE, "left", 0.8);
        g.restore();
      });
    }
    // ── 04 sunrise delay ──
    featureCard(v, 11.51, 13.95, "04", "SUNRISE DELAY™", "Drag the morning back.");
    if (inW(v, 11.7, 13.95)) {
      const p = E.inout(prog(v, 11.9, 1.7));
      const x = 560, y = H - 250, w = 800;
      text("SUNRISE", x, y - 30, F.monoB(16), WHITE, "left", 0.8, 4);
      g.save(); g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(x, y, w, 4);
      for (let i = 0; i <= 10; i++) g.fillRect(x + (w * i) / 10, y - 8, 1.5, 20);
      g.fillStyle = MAG; g.fillRect(x, y, w * lerp(0.15, 0.92, p), 4);
      g.beginPath(); g.arc(x + w * lerp(0.15, 0.92, p), y + 2, 16, 0, Math.PI * 2); g.fill(); g.restore();
      const mins = lerp(5 * 60 + 47, 7 * 60 + 30, p);
      text(`${Math.floor(mins / 60)}:${String(Math.floor(mins % 60)).padStart(2, "0")}`, x + w, y - 30, F.num(84), WHITE, "right");
      text("05:47", x, y + 44, F.mono(14), WHITE, "left", 0.6); text("07:30 · DELAYED", x + w, y + 44, F.monoB(14), MAG, "right", 1, 2);
    }
    // ── "I don't need something new": pop-ups over the touchscreen, swiped away ──
    if (sh.src === "P08") {
      const pops = [["UPGRADE AVAILABLE", "Try something new.", 13.95, 14.86], ["NEW YOU 2.0", "Now shipping.", 14.25, 15.16], ["WHY NOT SOMEONE NEW?", "Sponsored", 14.55, 15.16]];
      pops.forEach(([a, b, t0, tOut], i) => {
        if (v < t0) return;
        const [sx, sy] = toScreen(sh, v, 0.66 + i * 0.03, 0.41 + i * 0.05);
        const pin = E.back(prog(v, t0, 0.18)), sw = E.in(prog(v, tOut - 0.12, 0.12));
        const x = sx - sw * 900, y = sy, w = 420, h = 110;
        g.save(); g.globalAlpha = pin * (1 - sw * 0.6); g.translate(x + w / 2, y + h / 2); g.scale(0.85 + 0.15 * pin, 0.85 + 0.15 * pin); g.translate(-(x + w / 2), -(y + h / 2));
        g.fillStyle = "rgba(244,242,255,0.95)"; g.beginPath(); g.roundRect(x, y, w, h, 14); g.fill();
        g.fillStyle = MAG; g.beginPath(); g.roundRect(x + 18, y + 22, 64, 64, 12); g.fill();
        text("NEW", x + 50, y + 62, F.monoB(16), WHITE, "center", 1, 1);
        text(a, x + 100, y + 48, F.monoB(17), "#12163a", "left", 1, 1.5);
        text(b, x + 100, y + 82, F.serif(26), "#12163a");
        g.restore();
      });
    }
    if (sh.src === "P15") {
      const q = quadOn(sh, v, [[0.3, 0.5], [0.68, 0.5], [0.68, 0.66], [0.3, 0.66]]);
      const [x0, y0] = q[0], w = q[1][0] - x0, h = q[2][1] - y0;
      text("NEW?  NO THANKS.", x0 + w / 2, y0 + h * 0.42, F.logo(Math.round(w * 0.055)), WHITE, "center", E.out(prog(v, 15.2, 0.15)), 4);
      const rem = Math.max(0, 3 * 3600 + 12 * 60 + 8 - (v - 15.16) * 3600 / 9);
      const hh = Math.floor(rem / 3600), mm = Math.floor((rem % 3600) / 60), ss = Math.floor(rem % 60);
      text(`TONIGHT REMAINING  0${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`, x0 + w / 2, y0 + h * 0.78, F.monoB(Math.round(w * 0.028)), MAG, "center", E.out(prog(v, 15.5, 0.2)), 2);
    }
    // ── "I just need more of you": the product, then +MORE ──
    if (inW(v, 16.14, 17.62)) {
      text("MORE.", W - 150, 440, F.logo(120), WHITE, "right", E.out(prog(v, 16.3, 0.4)), 14);
      text("of you. Refillable.", W - 150, 510, F.serif(46), WHITE, "right", E.out(prog(v, 16.8, 0.4)));
      const [bx, by] = toScreen(sh, v, 0.31, 0.5);
      callout(bx + 120, by - 80, bx + 330, by - 250, "CONTAINS: 1 NIGHT", "BATCH 02:14 AM", prog(v, 16.5, 0.35));
      callout(bx + 110, by + 150, bx + 330, by + 250, "+MORE", "REFILLS AVAILABLE", prog(v, 16.9, 0.35));
    }
    if (inW(v, 17.62, 19.9)) {
      const n = beats.filter((b) => b >= 17.55 && b <= v).length * 2 + (shotAt(v).t0 > beats.filter((b) => b <= v).slice(-1)[0] ? 1 : 0);
      const cut = SHOTS.filter((s) => s.t0 >= 17.62 && s.t0 <= v).length;
      const p = prog(v, shotAt(v).t0, 0.12), s = 1 + 0.2 * (1 - E.out(p));
      g.save(); g.translate(W - 130, H * 0.5); g.scale(s, s);
      text(`+ MORE ×${cut}`, 0, 0, F.num(170), WHITE, "right", 1);
      g.restore();
      g.save(); g.fillStyle = MAG; g.beginPath(); g.roundRect(W - 470, H * 0.5 + 40, 340, 70, 35); g.fill(); g.restore();
      text("ADD MORE", W - 300, H * 0.5 + 86, F.logo(22), WHITE, "center", 1, 4);
    }
    // ── "Tonight" (held): renew? ──
    if (inW(v, 20.4, 25.24)) {
      const a = E.out(prog(v, 20.59, 0.5)) * clamp((25.24 - v) / 0.06);
      const cx = W * 0.5, cy = H * 0.36;
      text("RENEW TONIGHT?", cx, cy, F.logo(66), WHITE, "center", a, 10);
      text("Your night ends at sunrise. Continue for $4.99/hr.", cx, cy + 60, F.serif(32), WHITE, "center", a * 0.85);
      const yes = [cx - 330, cy + 110, 300, 84], no = [cx + 30, cy + 110, 300, 84];
      const pressed = v > 25.09 && v < 25.3;
      g.save(); g.globalAlpha = a;
      g.fillStyle = MAG; g.beginPath(); g.roundRect(yes[0] + (pressed ? 6 : 0), yes[1] + (pressed ? 4 : 0), yes[2] - (pressed ? 12 : 0), yes[3] - (pressed ? 8 : 0), 42); g.fill();
      g.strokeStyle = WHITE; g.lineWidth = 2; g.beginPath(); g.roundRect(no[0], no[1], no[2], no[3], 42); g.stroke();
      g.restore();
      text("YES, RENEW", yes[0] + yes[2] / 2, yes[1] + 53, F.logo(22), WHITE, "center", a, 4);
      text("NOT YET", no[0] + no[2] / 2, no[1] + 53, F.logo(22), WHITE, "center", a, 4);
      // the cursor drifts in and settles on YES, hovering through the held note, clicking on the second "Tonight"
      const cp = E.inout(prog(v, 21.3, 3.2));
      const px = lerp(W * 0.84, yes[0] + yes[2] * 0.55, cp) + Math.sin(v * 2.1) * 6 * (1 - cp), py = lerp(H * 0.9, yes[1] + 52, cp) + Math.cos(v * 1.7) * 5 * (1 - cp);
      g.save(); g.globalAlpha = a; g.translate(px, py); if (pressed) g.scale(0.85, 0.85);
      g.fillStyle = WHITE; g.strokeStyle = "#0a0e28"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 38); g.lineTo(10, 29); g.lineTo(18, 46); g.lineTo(25, 43); g.lineTo(17, 26); g.lineTo(30, 26); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    // ── declined ──
    if (inW(v, 25.2, 28.58)) {
      const p = prog(v, 25.2, 0.16), s = 1 + 0.7 * (1 - E.back(p));
      const fade = v > 25.54 ? clamp(1 - (v - 26.6) / 0.5) : 1;
      g.save(); g.globalAlpha = fade; g.translate(W * 0.5, H * 0.42); g.rotate(-0.07); g.scale(s, s);
      g.strokeStyle = RED; g.lineWidth = 7; g.strokeRect(-600, -95, 1200, 190);
      text("PAYMENT DECLINED", 0, 22, F.logo(58), RED, "center", 1, 6);
      text("ERR_SUNRISE_UNAVOIDABLE", 0, 72, F.monoB(18), RED, "center", 1, 3);
      g.restore();
      if (v > 26.3) {
        text("Your night has expired.", W * 0.5, H * 0.3, F.serif(84), WHITE, "center", E.out(prog(v, 26.4, 0.6)));
      }
      // the legal read, far too fast
      if (v > 25.6) {
        const legal = "NIGHT+ IS A FICTIONAL SUBSCRIPTION. NIGHTS END. SUNRISE MAY OCCUR AT ANY TIME WITHOUT NOTICE. MAYBE MODE DOES NOT CONSTITUTE A PROMISE. GOODBYE BLOCKER DOES NOT PREVENT GOODBYES, ONLY DELAYS THEM. +MORE SUBJECT TO AVAILABILITY OF YOU. ";
        g.save(); g.beginPath(); g.rect(110, H - 118, W - 220, 40); g.clip();
        text(legal + legal, 110 - (v - 25.6) * 520, H - 90, F.mono(15), WHITE, "left", 0.75, 1);
        g.restore();
      }
    }
    // ── end card ──
    if (v >= 28.58) {
      const a = E.out(prog(v, 28.62, 0.35));
      text("NIGHT+", W * 0.5, H * 0.5, F.logo(130), WHITE, "center", a, 22);
      text("Nights end. We're working on it.", W * 0.5, H * 0.5 + 80, F.serif(42), WHITE, "center", a * 0.9);
      text("TONIGHT, EXTENDED.", W * 0.5, H * 0.5 + 140, F.monoB(16), MAG, "center", a, 6);
    }
    if (v < 28.58) supers(v);                                        // the end card stays clean
    gTex.needsUpdate = true;
  }

  // ── transitions ──────────────────────────────────────────────────────
  const SLICE = 0.2, DISSOLVE = 0.45;
  function render(v) {
    v = clamp(v, 0, DURATION - 1e-4);
    const sh = shotAt(v), prev = SHOTS[sh.i - 1];
    let mode = 0, p = 0;
    if (prev && sh.tr === "slice" && v < sh.t0 + SLICE) { mode = 2; p = (v - sh.t0) / SLICE; }
    if (prev && sh.tr === "dissolve" && v < sh.t0 + DISSOLVE) { mode = 1; p = (v - sh.t0) / DISSOLVE; }
    if (mode) { renderShot(prev, Math.min(v, prev.t1 - 1e-3), rtA); renderShot(sh, v, rtB); }
    else renderShot(sh, v, rtA);
    mixMat.uniforms.uMode.value = mode; mixMat.uniforms.uP.value = p; mixMat.uniforms.uSeed.value = sh.i * 3.7;
    pass(mixMat, rtM);

    drawGraphics(v);
    const hit = hitAt(v);
    const U = coatMat.uniforms;
    U.uFrame.value = Math.floor(v * 30);
    U.uHit.value = hit;
    U.uHalf.value = sh.src === "END" ? 0 : 0.26 + 0.34 * hit + (sh.glitch ? 0.4 : 0);
    U.uCell.value = 5.5 + 3 * hit;
    U.uMis.value = 1.6 + 10 * hit + (sh.glitch ? 26 * Math.exp(-(v - sh.t0) * 5) : 0);
    U.uGfxMis.value = 0.6 + 4 * hit;
    U.uInk.value = 0.32;
    U.uGrain.value = 0.075;
    U.uMorning.value = clamp((v - 25.6) / 2.4) * (v < 28.58 ? 1 : 0);
    // flashes: 2–3 frames of colour on the cut
    const fl = sh.flash || (sh.tr === "flash" ? WHITE : null), dt = v - sh.t0;
    U.uFlash.value = fl && dt < 0.1 ? (1 - dt / 0.1) * 0.85 : 0;
    if (fl) U.uFlashCol.value.set(fl);
    U.uFade.value = Math.min(1, v / 0.05, (DURATION - v) / 0.35);
    pass(coatMat, null);
    return { shot: sh.i, src: sh.src };
  }
  return { render, SHOTS, DURATION, SONG_OFFSET };
}
