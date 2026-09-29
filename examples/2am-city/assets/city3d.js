/* city3d.js — "2AM in Your Car", 3D edition.
 *
 * The car drives a street grid all night; every beat raises one building on
 * the nearest empty lot, so the city grows along the night's route. Each
 * building draws itself as a blueprint wireframe, is poured solid bottom-up
 * (a sodium-hot fill line), then its windows light with the drums
 * (kick = a whole floor, snare = a scatter, hi-hat = one window).
 * The camera cuts on the music: verses every 2 bars, choruses every bar or
 * every 2 beats, the bridge one long take while the city goes dark.
 *
 * renderAt(t) is a pure function of t: all randomness is seeded at build time,
 * all motion is computed from t (GPU-side for buildings/windows).
 */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// ── helpers ───────────────────────────────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t < t1) {
      const f = smooth((t - t0) / (t1 - t0));
      if (typeof v0 === "number") return lerp(v0, v1, f);
      return v0.clone().lerp(v1, f);
    }
  }
  return keys[keys.length - 1][1];
}
const C = (h) => new THREE.Color(h);
const colKeys = (arr) => arr.map(([t, h]) => [t, C(h)]);
function bsearch(arr, t) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) lo = m + 1; else hi = m; } return lo; }

// ── song timing ──────────────────────────────────────────────────────────
export const BR0 = 141.5, BR1 = 152.92, BUILD_END = 172.7;
const SPEED = [
  [0, 22], [2.7, 44], [43.1, 44], [47, 34], [52.6, 34], [53.3, 118], [81.5, 110], [84, 48],
  [103.5, 48], [108, 36], [113.7, 36], [114.3, 124], [141.3, 118], [146, 0], [152.5, 0],
  [153.1, 138], [172.5, 124], [180, 0], [400, 0],
];
const UNITS_PER_PX = 1 / 60;

// palette over the night
const ZENITH = colKeys([[0, "#03040a"], [150, "#04050c"], [168, "#0a1733"], [182, "#24497e"], [194, "#5b86bd"]]);
const HORIZON = colKeys([[0, "#1a100b"], [141, "#1f130c"], [145, "#0a0706"], [152.9, "#1f130c"], [168, "#2a2436"], [182, "#4f73a6"], [194, "#9fbbe0"]]);
const WALL = colKeys([[0, "#0d1526"], [165, "#0d1526"], [194, "#22395f"]]);
const FOG = [[0, 0.034], [150, 0.03], [172, 0.02], [186, 0.009], [194, 0.006]];
const BLOOM = [[0, 0.38], [52.9, 0.48], [82.5, 0.38], [114, 0.5], [141.5, 0.45], [145, 0.35], [152.9, 0.6], [175, 0.45], [194, 0.3]];

const PALETTES = {
  sodium: { win: ["#ffb04a", "#ffd892", "#ff8f36"], hot: "#ffb04a", lamp: "#ffa040", pool: "#ff9a3c" },
  blueprint: { win: ["#8fb0e6", "#b4c9ee", "#7496d0"], hot: "#b9cff5", lamp: "#9cb8ea", pool: "#4f73b5" },
};

// ── shaders ──────────────────────────────────────────────────────────────
const BUILDING_VS = /* glsl */ `
  attribute vec4 aBox;   // cx, cz, w, d
  attribute vec4 aTime;  // tb, h, off, on
  attribute vec3 aDur;   // grow, pourStart, pourEnd (seconds after tb)
  attribute float aIdx;
  uniform float uTime;
  varying vec3 vLocal; varying vec3 vNormalW; varying float vH; varying float vDepth;
  varying vec4 vBox; varying vec4 vTime; varying float vIdx; varying vec3 vDur;
  float easeOutBack(float x){ float c1=1.3; float c3=c1+1.0; return 1.0 + c3*pow(x-1.0,3.0) + c1*pow(x-1.0,2.0); }
  void main(){
    float age = uTime - aTime.x;
    float g = age <= 0.0 ? 0.0 : easeOutBack(clamp(age/aDur.x, 0.0, 1.0));
    vDur = aDur;
    float h = aTime.y * g;
    vec3 p = vec3(aBox.x + position.x*aBox.z, position.y*h, aBox.y + position.z*aBox.w);
    vLocal = position; vNormalW = normal; vH = h; vBox = aBox; vTime = aTime; vIdx = aIdx;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const BUILDING_FS = /* glsl */ `
  uniform float uTime; uniform sampler2D uWin; uniform sampler2D uFloor; uniform float uN;
  uniform vec3 uWall; uniform vec3 uFog; uniform float uFogD; uniform vec2 uSurv;
  uniform vec3 uBlue; uniform vec3 uHot; uniform vec3 uSod0; uniform vec3 uSod1; uniform vec3 uSod2;
  uniform float uBR0; uniform float uDawnMix;
  varying vec3 vLocal; varying vec3 vNormalW; varying float vH; varying float vDepth;
  varying vec4 vBox; varying vec4 vTime; varying float vIdx; varying vec3 vDur;
  const float FLOOR_H = 0.22; const float COL_W = 0.2;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
  float lineAA(float d){ float w = fwidth(d)*1.3 + 1e-5; return 1.0 - smoothstep(0.0, w, d); }
  void main(){
    if (vH < 0.002) discard;
    float age = uTime - vTime.x, H = vTime.y;
    vec3 n = normalize(vNormalW);
    float y = vLocal.y * vH;
    float fill = smoothstep(vDur.y, vDur.z, age);
    fill = fill*fill*(3.0-2.0*fill);
    float fillY = fill * H;
    bool roof = n.y > 0.5;
    float u, faceLen, face;
    if (roof) { u = (vLocal.x+0.5)*vBox.z; faceLen = vBox.z; face = 4.0; }
    else if (abs(n.x) > 0.5) { u = (vLocal.z+0.5)*vBox.w; faceLen = vBox.w; face = n.x > 0.0 ? 0.0 : 1.0; }
    else { u = (vLocal.x+0.5)*vBox.z; faceLen = vBox.z; face = n.z > 0.0 ? 2.0 : 3.0; }
    float ex = min(u, faceLen-u);
    float ey = roof ? min((vLocal.z+0.5)*vBox.w, (0.5-vLocal.z)*vBox.w) : min(y, vH-y);
    float edge = lineAA(min(ex, ey));
    float dy = abs(fract(y/FLOOR_H + 0.5) - 0.5) * FLOOR_H;
    float floorLine = roof ? 0.0 : lineAA(dy);
    bool solid = roof ? fill > 0.999 : y <= fillY;
    vec3 col;
    if (!solid) {
      float a = max(edge, floorLine * 0.28);
      if (a < 0.04) discard;
      col = uBlue * a * 1.6;
    } else {
      float shade = roof ? 1.25 : (face == 0.0 ? 1.0 : face == 2.0 ? 0.8 : face == 1.0 ? 0.6 : 0.7);
      col = uWall * shade * (0.75 + 0.5 * (y / max(H, 0.01)));
      col += uFog * 0.35 * (y / max(H, 0.01));          // sky reflected high on the facade
      if (roof) {
        float rx = abs(fract((vLocal.x+0.5)*vBox.z/0.3 + 0.5) - 0.5) * 0.3;
        float rz = abs(fract((vLocal.z+0.5)*vBox.w/0.3 + 0.5) - 0.5) * 0.3;
        col += uBlue * max(lineAA(rx), lineAA(rz)) * 0.08;  // plan grid on the roof
      }
      if (!roof) {
        float nC = floor(faceLen / COL_W);
        float u2 = u - (faceLen - nC*COL_W) * 0.5;
        float ci = floor(u2 / COL_W), fx = fract(u2 / COL_W);
        float fi = floor(y / FLOOR_H), fy = fract(y / FLOOR_H);
        bool inWin = ci >= 0.0 && ci < nC && fx > 0.2 && fx < 0.8 && fy > 0.26 && fy < 0.8 && fi >= 1.0 && y < H - 0.06;
        if (inWin) {
          float hs = hash(vec3(vIdx, face*97.0 + ci, fi));
          float slot = floor(hs * 255.99);
          float lt = texture2D(uWin, vec2((slot+0.5)/256.0, (vIdx+0.5)/uN)).r;
          float ft = texture2D(uFloor, vec2((min(fi,63.0)+0.5)/64.0, (vIdx+0.5)/uN)).r;
          bool fromFloor = ft < lt;
          lt = min(lt, ft);
          float lvl = 0.0;
          if (uTime >= lt) {
            float on = lt;
            bool surv = !fromFloor && abs(vIdx - uSurv.x) < 0.5 && abs(slot - uSurv.y) < 0.5;
            if (lt < uBR0 && !surv) {
              if (uTime >= vTime.z && uTime < vTime.w) on = -1.0;
              else if (uTime >= vTime.w) on = vTime.w;
            }
            if (on >= 0.0) {
              lvl = 1.0 + 1.1 * exp(-(uTime - on) * 6.0);
              float h2 = hash(vec3(vIdx*1.7, slot, 3.1));
              float dawnT = h2 < 0.1 ? 1e6 : 176.0 + h2 * 14.0;
              lvl *= 1.0 - clamp((uTime - dawnT) / 1.5, 0.0, 1.0);
              if (surv && uTime > uBR0) lvl *= 1.6;
            }
          }
          float tone = hash(vec3(vIdx, slot, 9.0));
          vec3 wc = tone < 0.7 ? uSod0 : tone < 0.88 ? uSod1 : uSod2;
          vec3 glass = uWall * 0.55 + vec3(0.004, 0.006, 0.012);
          col = lvl > 0.0 ? wc * (0.3 + 0.45 * lvl) : glass;
        }
      }
      // the pour: a hot line rising up the facade
      float hot = (1.0 - smoothstep(0.0, 0.07, abs(fillY - y))) * (1.0 - step(0.999, fill)) * (roof ? 0.0 : 1.0);
      col += uHot * hot * 1.6;
      col += uBlue * (edge * 0.75 + floorLine * 0.06) * (1.0 - 0.6 * uDawnMix);
    }
    float f = 1.0 - exp(-uFogD*uFogD*vDepth*vDepth);
    gl_FragColor = vec4(mix(col, uFog, f), 1.0);
  }`;

const GROUND_VS = /* glsl */ `
  varying vec3 vW; varying float vDepth;
  void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;

const GROUND_FS = /* glsl */ `
  uniform float uP; uniform float uSW; uniform vec3 uCar; uniform vec2 uDir; uniform float uGridR; uniform vec2 uStart;
  uniform float uLamp; uniform float uPoolR; uniform vec3 uFog; uniform float uFogD; uniform vec3 uBlue; uniform vec3 uSod; uniform float uTime;
  varying vec3 vW; varying float vDepth;
  float lineAA(float d){ float w = fwidth(d)*1.2 + 1e-5; return 1.0 - smoothstep(0.0, w, d); }
  void main(){
    vec2 p = vW.xz;
    float dx = abs(fract(p.x/uP) - 0.5) * uP;   // distance to the nearest N–S street centre
    float dz = abs(fract(p.y/uP) - 0.5) * uP;   // … E–W street
    float hw = uSW * 0.5;
    bool street = dx < hw || dz < hw;
    vec3 col = street ? vec3(0.010, 0.011, 0.015) : vec3(0.016, 0.018, 0.024);
    float reveal = smoothstep(uGridR, uGridR - 5.0, length(p - uStart));
    // blueprint curbs
    float curb = max(lineAA(abs(dx - hw)), lineAA(abs(dz - hw)));
    col += uBlue * curb * 0.22;
    // lane dashes
    float dashX = step(0.5, fract(p.y * 0.9)) * lineAA(dx) * (dz > hw ? 1.0 : 0.0);
    float dashZ = step(0.5, fract(p.x * 0.9)) * lineAA(dz) * (dx > hw ? 1.0 : 0.0);
    col += uSod * (dashX + dashZ) * 0.35;
    // sodium pools: intersections and mid-block lamps
    float r1 = dx*dx + dz*dz;
    float r2 = min(dx*dx + (uP*0.5 - dz)*(uP*0.5 - dz), dz*dz + (uP*0.5 - dx)*(uP*0.5 - dx));
    float lit = smoothstep(uPoolR + 1.5, uPoolR - 1.5, length(p - uStart));
    col += uSod * (exp(-r1 * 1.6) * 0.55 + exp(-r2 * 1.8) * 0.35) * uLamp * lit;
    col *= reveal;
    // headlights
    vec2 rel = p - uCar.xz;
    float along = dot(rel, uDir), side = rel.x*uDir.y - rel.y*uDir.x;
    col += vec3(1.0, 0.78, 0.22) * exp(-dot(rel, rel) * 5.0) * 0.18;
    float f = 1.0 - exp(-uFogD*uFogD*vDepth*vDepth);
    gl_FragColor = vec4(mix(col, uFog, f), 1.0);
  }`;

const SKY_VS = /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SKY_FS = /* glsl */ `uniform vec3 uZen; uniform vec3 uHor; varying vec3 vDir;
  void main(){ float k = pow(clamp(vDir.y, 0.0, 1.0), 0.45); gl_FragColor = vec4(mix(uHor, uZen, k), 1.0); }`;

const LAMP_VS = /* glsl */ `
  uniform float uGridR; uniform vec2 uStart; uniform vec3 uCar; uniform float uDim; uniform float uScale;
  uniform float uTime;
  attribute float aSeed; attribute float aOn; varying float vA;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float age = uTime - aOn;
    float on = age < 0.0 ? 0.0 : 1.0 + 3.0 * exp(-age * 5.0);
    float keep = mix(uDim, 1.0, smoothstep(6.0, 2.0, length(position.xz - uCar.xz)));
    vA = on * keep * (0.75 + 0.25 * aSeed);
    gl_PointSize = min(uScale * 0.35 / max(-mv.z, 0.1), 24.0);
    gl_Position = projectionMatrix * mv;
  }`;
const LAMP_FS = /* glsl */ `uniform vec3 uSod; varying float vA;
  void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c,c); if (d > 0.25) discard; gl_FragColor = vec4(uSod * vA * 1.3 * exp(-d*14.0), 1.0); }`;

const PELLET_VS = /* glsl */ `
  attribute float aS; attribute float aPow;
  uniform float uDist; uniform float uTime; uniform float uScale;
  varying float vPow;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vPow = aPow;
    float size = aPow > 0.5 ? 0.13 * (1.0 + 0.3 * sin(uTime * 9.0)) : 0.05;
    gl_PointSize = aS <= uDist ? 0.0 : min(uScale * size / max(-mv.z, 0.1), 48.0);
    gl_Position = projectionMatrix * mv;
  }`;
const PELLET_FS = /* glsl */ `varying float vPow;
  void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c,c); if (d > 0.25) discard;
    vec3 col = vPow > 0.5 ? vec3(0.95, 0.7, 0.15) : vec3(0.45, 0.55, 0.75);
    gl_FragColor = vec4(col * (1.0 - d * 2.5), 1.0); }`;

// ── build ────────────────────────────────────────────────────────────────
export function createCity3D({ canvas, song, width = 1920, height = 1080, palette = "blueprint" }) {
  const PAL = PALETTES[palette] || PALETTES.sodium;
  const SONG = song;
  const DUR = SONG.duration;

  // car distance along the route
  const HZ = 120, n = Math.ceil((DUR + 2) * HZ) + 2, distTab = new Float64Array(n);
  for (let i = 1; i < n; i++) distTab[i] = distTab[i - 1] + keyed(SPEED, (i - 0.5) / HZ) * UNITS_PER_PX / HZ;
  const carDist = (t) => { if (t <= 0) return 0; const f = t * HZ, i0 = Math.min(n - 2, Math.floor(f)); return lerp(distTab[i0], distTab[i0 + 1], f - i0); };

  // ── street grid + route ──
  const P = 5, SW = 1.25, GRID = 6; // blocks i,j in [-GRID, GRID-1]
  const rng = mulberry32(20260928);
  const route = [];
  let ci = 0, cj = 0, dir = [1, 0]; // intersections at ((i+.5)P, (j+.5)P)
  route.push(new THREE.Vector3((ci + 0.5) * P, 0, (cj + 0.5) * P));
  const need = carDist(DUR) + 30;
  let len = 0, prevTurn = 0;
  while (len < need) {
    const opts = [];
    const cand = [[dir, 0.46], [[-dir[1], dir[0]], 0.27], [[dir[1], -dir[0]], 0.27]];
    for (const [d, w] of cand) {
      const ni = ci + d[0], nj = cj + d[1];
      if (ni < -GRID + 1 || ni > GRID - 2 || nj < -GRID + 1 || nj > GRID - 2) continue;
      const centre = Math.hypot(ni, nj) > 3.5 ? (Math.hypot(ni, nj) < Math.hypot(ci, cj) ? 1.6 : 0.5) : 1;
      opts.push([d, w * centre]);
    }
    if (!opts.length) opts.push([[-dir[0], -dir[1]], 1]);
    let r = rng() * opts.reduce((a, o) => a + o[1], 0), pick = opts[0][0];
    for (const [d, w] of opts) { if ((r -= w) <= 0) { pick = d; break; } }
    dir = pick; ci += dir[0]; cj += dir[1];
    const pt = new THREE.Vector3((ci + 0.5) * P, 0, (cj + 0.5) * P);
    // rounded corners: a mid-point keeps the spline straight along the block
    const last = route[route.length - 1];
    route.push(last.clone().lerp(pt, 0.5));
    route.push(pt);
    len += P;
    prevTurn++;
  }
  const curve = new THREE.CatmullRomCurve3(route, false, "catmullrom", 0.2);
  curve.arcLengthDivisions = route.length * 20;
  const routeLen = curve.getLength();
  const carAt = (t) => { const u = clamp(carDist(t) / routeLen, 0, 1); return { p: curve.getPointAt(u), d: curve.getTangentAt(u) }; };
  const pathAt = (s) => curve.getPointAt(clamp(s / routeLen, 0, 1));
  const startXZ = new THREE.Vector2(route[0].x, route[0].z);

  // ── lots + buildings (one per beat) ──
  const lots = [];
  for (let i = -GRID; i < GRID; i++) for (let j = -GRID; j < GRID; j++) for (const ox of [-1, 1]) for (const oz of [-1, 1]) {
    lots.push({ x: i * P + ox * 0.95, z: j * P + oz * 0.95, used: false });
  }
  const groups = [[0, 4], [4, 10], [10, 16]];
  const gStats = groups.map((g) => {
    const v = SONG.beatBands.map((b) => { let s = 0; for (let k = g[0]; k < g[1]; k++) s += b[k]; return s / (g[1] - g[0]); });
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length) || 1;
    return { v, m, sd };
  });
  const B = [];
  const sectionAt = (t) => { let id = "outro"; for (const sc of SONG.sections) if (t >= sc.start && t < sc.end) id = sc.id; return id; };
  const RATE = { intro: 2, verse1: 2, pre1: 4, chorus1: 1, verse2: 2, pre2: 4, chorus2: 1, final: 1 };
  const DURS = { 2: [0.9, 0.85, 2.4], 4: [1.3, 1.2, 3.4], 1: [0.45, 0.4, 1.2] };
  let lastSec = null, secBeat = 0;
  SONG.beats.forEach((tb, bi) => {
    if (tb >= BR0 - 0.05 && tb < BR1 - 0.05) return;
    if (tb >= BUILD_END) return;
    const sec = sectionAt(tb);
    if (sec !== lastSec) { lastSec = sec; secBeat = 0; }
    const rate = RATE[sec] || 1;
    if (secBeat++ % rate !== 0) return;
    const z = groups.map((_, g) => (gStats[g].v[bi] - gStats[g].m) / gStats[g].sd);
    const g = z[0] >= z[1] && z[0] >= z[2] ? 0 : z[1] >= z[2] ? 1 : 2;
    const score = clamp(0.5 + z[g] / 2.6);
    const car = carAt(tb).p;
    let best = null, bd = 1e9;
    for (const L of lots) { if (L.used) continue; const d = Math.hypot(L.x - car.x, L.z - car.z) + rng() * 0.8; if (d < bd) { bd = d; best = L; } }
    best.used = true;
    const [wr, hr] = g === 0 ? [[1.3, 1.7], [0.7, 2.4]] : g === 1 ? [[1.0, 1.45], [1.8, 5.0]] : [[0.7, 1.05], [3.5, 9.5]];
    const w = lerp(wr[0], wr[1], rng()), d = lerp(wr[0], wr[1], rng());
    const h = lerp(hr[0], hr[1], Math.pow(score, 0.9)) * (0.9 + 0.2 * rng());
    B.push({
      idx: B.length, tb, kind: g, score, h, w, d,
      x: best.x + (rng() - 0.5) * (1.8 - w), z: best.z + (rng() - 0.5) * (1.8 - d),
      floors: Math.floor(h / 0.22), dur: DURS[rate],
    });
  });
  const N = B.length;
  const byTime = B.map((b) => b.tb);

  // window light schedule → float textures (row per building)
  const INF = 1e6;
  const winT = new Float32Array(256 * N).fill(INF), floorT = new Float32Array(64 * N).fill(INF);
  const setWin = (b, s, t) => { const k = b.idx * 256 + s; if (winT[k] === INF) winT[k] = t; };
  B.forEach((b) => {
    const r = mulberry32(9000 + b.idx);
    const base = 4 + Math.floor(r() * 6); // an inhabited building from the moment it's poured
    for (let q = 0; q < base; q++) setWin(b, Math.floor(r() * 256), b.tb + b.dur[2] + r() * 2.2);
  });
  SONG.events.forEach((ev, ei) => {
    const te = ev.t;
    if (te >= BR0 - 0.1 && te < BR1) return;
    const hi = bsearch(byTime, te - 2.4); let lo = hi;
    while (lo > 0 && byTime[lo - 1] > te - 10) lo--;
    if (hi <= lo) return;
    const r = mulberry32(777 + ei * 13);
    const pickB = () => B[lo + Math.floor(r() * (hi - lo))];
    if (ev.d === "k") {
      const b = pickB(), f = 1 + Math.floor(r() * Math.max(1, Math.min(63, b.floors - 1)));
      const k = b.idx * 64 + f; if (floorT[k] === INF) floorT[k] = te;
    } else {
      const cnt = ev.d === "s" ? 3 + Math.round(ev.e * 3) : ev.d === "h" ? 1 : 1 + Math.round(ev.e);
      for (let q = 0; q < cnt; q++) setWin(pickB(), Math.floor(r() * 256), te + q * 0.012);
    }
  });
  // bridge off-wave (far first, the car's block last) and final relight (near first)
  const carBR = carAt(BR0).p;
  let surv = [0, 0], survT = -1;
  B.forEach((b) => {
    const dist = Math.hypot(b.x - carBR.x, b.z - carBR.z);
    b.off = BR0 + 0.2 + 3.4 * (1 - clamp(dist / 28));
    b.on = BR1 + 2.2 * clamp(dist / 28);
    if (dist < 4 && b.kind !== 0) for (let s = 0; s < 256; s++) { const lt = winT[b.idx * 256 + s]; if (lt < BR0 && lt > survT) { survT = lt; surv = [b.idx, s]; } }
    const r = mulberry32(5150 + b.idx);
    for (let s = 0; s < 256; s++) if (winT[b.idx * 256 + s] === INF && r() < 0.1) winT[b.idx * 256 + s] = b.on + r() * 0.6;
  });
  const survB = B[surv[0]];

  const texWin = new THREE.DataTexture(winT, 256, N, THREE.RedFormat, THREE.FloatType);
  const texFloor = new THREE.DataTexture(floorT, 64, N, THREE.RedFormat, THREE.FloatType);
  for (const tx of [texWin, texFloor]) { tx.minFilter = tx.magFilter = THREE.NearestFilter; tx.needsUpdate = true; }

  // lights-on counter for the HUD
  const deltas = [];
  for (let i = 0; i < winT.length; i++) {
    const lt = winT[i]; if (lt === INF) continue;
    const b = B[(i / 256) | 0], isS = b.idx === surv[0] && i % 256 === surv[1];
    deltas.push([lt, 1]);
    if (lt < BR0 && !isS) { deltas.push([b.off, -1]); deltas.push([b.on, 1]); }
    const h2 = mulberry32(i)(); if (h2 > 0.1) deltas.push([176 + h2 * 14 + 0.75, -1]);
  }
  deltas.sort((a, b) => a[0] - b[0]);
  const dT = new Float64Array(deltas.length), dC = new Int32Array(deltas.length);
  let acc = 0; deltas.forEach((d, i) => { acc += d[1]; dT[i] = d[0]; dC[i] = acc; });
  const lightsOn = (t) => { const i = bsearch(dT, t); return i ? dC[i - 1] * 3 : 0; };

  // ── three.js scene ──
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.03, 600);

  const U = {
    uTime: { value: 0 }, uFog: { value: new THREE.Color() }, uFogD: { value: 0.03 },
    uBlue: { value: C("#7fa8ff") }, uHot: { value: C(PAL.hot) },
    uSod0: { value: C(PAL.win[0]) }, uSod1: { value: C(PAL.win[1]) }, uSod2: { value: C(PAL.win[2]) },
  };

  // sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
    uniforms: { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } },
  }));
  scene.add(sky);

  // ground
  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VS, fragmentShader: GROUND_FS,
    uniforms: {
      ...U, uP: { value: P }, uSW: { value: SW }, uCar: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector2(1, 0) },
      uGridR: { value: 0 }, uStart: { value: startXZ }, uLamp: { value: 1 }, uPoolR: { value: 0 }, uSod: { value: C(PAL.pool) },
    },
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GRID * P * 2 + 40, GRID * P * 2 + 40), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // buildings (one instanced draw)
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = box.index; geo.setAttribute("position", box.attributes.position); geo.setAttribute("normal", box.attributes.normal);
  const aBox = new Float32Array(N * 4), aTime = new Float32Array(N * 4), aDur = new Float32Array(N * 3), aIdx = new Float32Array(N);
  B.forEach((b, i) => { aBox.set([b.x, b.z, b.w, b.d], i * 4); aTime.set([b.tb, b.h, b.off, b.on], i * 4); aDur.set(b.dur, i * 3); aIdx[i] = i; });
  geo.setAttribute("aBox", new THREE.InstancedBufferAttribute(aBox, 4));
  geo.setAttribute("aTime", new THREE.InstancedBufferAttribute(aTime, 4));
  geo.setAttribute("aDur", new THREE.InstancedBufferAttribute(aDur, 3));
  geo.setAttribute("aIdx", new THREE.InstancedBufferAttribute(aIdx, 1));
  geo.instanceCount = N;
  const bMat = new THREE.ShaderMaterial({
    vertexShader: BUILDING_VS, fragmentShader: BUILDING_FS,
    uniforms: {
      ...U, uWin: { value: texWin }, uFloor: { value: texFloor }, uN: { value: N },
      uWall: { value: new THREE.Color() }, uSurv: { value: new THREE.Vector2(surv[0], surv[1]) },
      uBR0: { value: BR0 }, uDawnMix: { value: 0 },
    },
  });
  const bMesh = new THREE.Mesh(geo, bMat); bMesh.frustumCulled = false;
  scene.add(bMesh);

  // streetlights: intersections + mid-block
  const lampPos = [], lampSeed = [];
  const lr = mulberry32(31);
  for (let i = -GRID; i < GRID; i++) for (let j = -GRID; j < GRID; j++) {
    const x = (i + 0.5) * P, z = (j + 0.5) * P;
    lampPos.push(x + 0.5, 0.75, z + 0.5, x + P * 0.5, 0.75, z + 0.62, x + 0.62, 0.75, z + P * 0.5);
    lampSeed.push(lr(), lr(), lr());
  }
  // each lamp switches on at a hi-hat / perc hit, nearest-to-the-car first (with jitter)
  const lampOn = new Float32Array(lampSeed.length).fill(1e6);
  {
    const hits = SONG.events.filter((e) => (e.d === "h" || e.d === "p") && e.t > 0.4).map((e) => e.t);
    const order = [];
    for (let k = 0; k < lampSeed.length; k++) order.push(k);
    const keyOf = (k) => {
      const x = lampPos[k * 3], z = lampPos[k * 3 + 2];
      // lamps near the route come on first; the rest of the grid fills in later
      const c = carAt(0).p;
      return Math.hypot(x - c.x, z - c.z) * (0.6 + 0.8 * lampSeed[k]);
    };
    order.sort((a, b) => keyOf(a) - keyOf(b));
    let h = 0;
    for (let q = 0; q < order.length && h < hits.length; q++) {
      const k = order[q];
      lampOn[k] = hits[h];
      h += q < 40 ? 1 : 1 + Math.floor(lampSeed[k] * 2); // irregular: sometimes 2-3 at once, sometimes a gap
    }
  }
  const lampGeo = new THREE.BufferGeometry();
  lampGeo.setAttribute("position", new THREE.Float32BufferAttribute(lampPos, 3));
  lampGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(lampSeed, 1));
  lampGeo.setAttribute("aOn", new THREE.Float32BufferAttribute(lampOn, 1));
  // lit radius over time (ground pools follow the lamps)
  const poolKeys = [];
  {
    const arr = [];
    for (let k = 0; k < lampOn.length; k++) if (lampOn[k] < 1e5) arr.push([lampOn[k], Math.hypot(lampPos[k * 3] - startXZ.x, lampPos[k * 3 + 2] - startXZ.y)]);
    arr.sort((a, b) => a[0] - b[0]);
    const lit = [];
    arr.forEach(([t, d]) => { lit.push(d); lit.sort((a, b) => a - b); poolKeys.push([t, lit[Math.floor(lit.length * 0.8)]]); });
  }
  const poolR = (t) => { const i = bsearch(poolKeys.map((k) => k[0]), t); return i ? poolKeys[i - 1][1] : 0; };
  const lampMat = new THREE.ShaderMaterial({
    vertexShader: LAMP_VS, fragmentShader: LAMP_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.uTime, uGridR: groundMat.uniforms.uGridR, uStart: { value: startXZ }, uCar: groundMat.uniforms.uCar, uDim: { value: 1 }, uScale: { value: height }, uSod: { value: C(PAL.lamp) } },
  });
  const lamps = new THREE.Points(lampGeo, lampMat); lamps.frustumCulled = false;
  scene.add(lamps);

  // the car: head/tail lights + a light-trail ribbon
  const carGeo = new THREE.BufferGeometry();
  carGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  carGeo.setAttribute("color", new THREE.Float32BufferAttribute([3, 2.6, 2, 3, 2.6, 2, 3, 0.2, 0.1, 3, 0.2, 0.1], 3));
  const car = new THREE.Points(carGeo, new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  car.frustumCulled = false; car.visible = false; scene.add(car);

  // ── the runner: a chomping light that eats one pellet per beat ──
  const PAC_R = 0.16;
  const pacMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.44, 0.05), side: THREE.DoubleSide });
  const capMat = new THREE.MeshBasicMaterial({ color: 0x05070d, side: THREE.DoubleSide });
  const pac = new THREE.Group();
  const jaw = (upper) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(PAC_R, 40, 20, 0, Math.PI * 2, upper ? 0 : Math.PI / 2, Math.PI / 2), pacMat));
    const cap = new THREE.Mesh(new THREE.CircleGeometry(PAC_R * 0.995, 40), capMat);
    cap.rotation.x = -Math.PI / 2; g.add(cap);
    return g;
  };
  const upperJaw = jaw(true), lowerJaw = jaw(false);
  pac.add(upperJaw, lowerJaw);
  scene.add(pac);

  // pellets: one per beat along the route, eaten exactly on the beat; power pellets on every "Just drive"
  const powerTimes = SONG.lyrics.filter((l) => /^just drive$/i.test(l.text)).map((l) => l.start);
  const pelPos = [], pelS = [], pelPow = [];
  const addPellet = (t, pow) => { const sd = carDist(t); const p = pathAt(sd); pelPos.push(p.x, 0.2, p.z); pelS.push(sd - 0.001); pelPow.push(pow); };
  SONG.beats.forEach((tb) => {
    if (tb >= BUILD_END || (tb >= BR0 - 0.3 && tb < BR1 - 0.05)) return;
    if (powerTimes.some((pt) => Math.abs(pt - tb) < 0.3)) return;
    addPellet(tb, 0);
  });
  powerTimes.forEach((pt) => addPellet(pt, 1));
  const pelGeo = new THREE.BufferGeometry();
  pelGeo.setAttribute("position", new THREE.Float32BufferAttribute(pelPos, 3));
  pelGeo.setAttribute("aS", new THREE.Float32BufferAttribute(pelS, 1));
  pelGeo.setAttribute("aPow", new THREE.Float32BufferAttribute(pelPow, 1));
  const pelMat = new THREE.ShaderMaterial({
    vertexShader: PELLET_VS, fragmentShader: PELLET_FS, depthWrite: true,
    uniforms: { uDist: { value: 0 }, uTime: U.uTime, uScale: { value: height } },
  });
  const pellets = new THREE.Points(pelGeo, pelMat); pellets.frustumCulled = false;
  scene.add(pellets);
  const pelSorted = pelS.slice().sort((a, b) => a - b);
  const powerAt = (t) => { let e = 0; for (const pt of powerTimes) if (t >= pt) e = Math.max(e, Math.exp(-(t - pt) / 1.6)); return e; };
  const TRAIL = 160;
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 2 * 3), 3));
  trailGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(TRAIL * 2 * 3), 3));
  const tIdx = []; for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; tIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  trailGeo.setIndex(tIdx);
  const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  trail.frustumCulled = false; scene.add(trail);

  // post
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1); composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.4, 0.4, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ── shot plan: cut density follows the song's energy ──
  // verses are one continuous take (poses glide into each other over GLIDE s);
  // choruses hard-cut on every "Just drive"; the final chorus every 2 bars;
  // bridge and outro are single takes. cut:false = glide from the previous pose.
  const BAR = (60 / SONG.bpm) * 4, GLIDE = 4.5;
  const ly = (re, n = 0) => SONG.lyrics.filter((l) => re.test(l.text))[n].start;
  const PLAN = [
    [0, "intro", true],
    // verse 1 — the city is born (one take)
    [5.085, "worm", true],
    [9.97, "crane", false],
    [14.86, "iso", false],
    [24.64, "drone", false],
    [34.44, "pan", false],
    // pre-chorus — hold the breath
    [ly(/^I know tomorrow/, 0), "pushin", true],
    // chorus 1 — a cut on every "Just drive", then "Tonight"
    [ly(/^Just drive$/, 0), "street", true],
    [ly(/^Just drive$/, 1), "flyover", true],
    [ly(/^Tonight$/, 0), "spin", true],
    // verse 2 — windows glow (one take)
    [83.31, "closeup", true],
    [93.07, "crane", false],
    // pre-chorus 2
    [ly(/^I know tomorrow/, 1), "pushin", true],
    // chorus 2
    [ly(/^Just drive$/, 2), "drone", true],
    [ly(/^Just drive$/, 3), "top", true],
    [ly(/^Tonight$/, 2), "iso", true],
    // bridge — one take, the city goes dark
    [BR0, "bridge", true],
    // final chorus — relight, then every 2 bars
    [BR1, "relight", true],
    [BR1 + BAR * 2, "street", true],
    [ly(/^Just drive$/, 5), "spin", true],
    [ly(/^Just drive$/, 5) + BAR * 2, "flyover", true],
    // outro — one take up into the dawn
    [ly(/^Tonight$/, 4), "crane", true],
    [ly(/^Tonight$/, 5), "orbitWide", false],
    [ly(/^Tonight$/, 6), "reveal", false],
  ];
  const sr = mulberry32(1234);
  const shots = PLAN.map(([t0, type, cut]) => ({ t0, type, cut, seed: sr() }));
  shots.forEach((s, i) => { s.t1 = i + 1 < shots.length ? shots[i + 1].t0 : DUR + 1; });
  // a "take" = a hard cut plus every shot that glides out of it
  let take = -1;
  shots.forEach((s) => { if (s.cut) take++; s.take = take; });
  const takes = [];
  shots.forEach((s) => { const k = s.take; if (!takes[k]) takes[k] = { t0: s.t0, t1: s.t1 }; takes[k].t1 = s.t1; });
  const shotStarts = shots.map((s) => s.t0);

  // focus building for a shot: the one that rises soonest after the cut
  function risingAfter(t0) {
    const i = bsearch(byTime, t0 + 0.15);
    return B[Math.min(N - 1, i)] || B[N - 1];
  }
  function tallestNear(p, t) {
    let best = B[0], bh = -1;
    for (const b of B) { if (b.tb > t) continue; const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < 9 && b.h > bh) { bh = b.h; best = b; } }
    return best;
  }
  const cityCentre = B.reduce((a, b) => a.add(new THREE.Vector3(b.x, 0, b.z)), new THREE.Vector3()).multiplyScalar(1 / N);

  const tmpUp = new THREE.Vector3(0, 1, 0);
  // the camera operator's eye: a lagging, weighted average of where the runner has been,
  // so corners become gentle turns and the runner can briefly leave frame
  function smoothPac(t, tau = 1.6, n = 12) {
    const o = new THREE.Vector3(); let ws = 0;
    for (let k = 0; k < n; k++) { const w = n - k; o.addScaledVector(carAt(t - (tau * k) / (n - 1)).p, w); ws += w; }
    return o.multiplyScalar(1 / ws);
  }
  // the time at which the runner was D units further back along the route
  function tBack(t, D) {
    const target = carDist(t) - D;
    if (target <= 0) return 0;
    let lo = 0, hi = t;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (carDist(m) < target) lo = m; else hi = m; }
    return lo;
  }
  function smoothDir(t) { const d = smoothPac(t).sub(smoothPac(t - 0.6)); d.y = 0; return d.lengthSq() > 1e-6 ? d.normalize() : carAt(t).d.clone(); }
  // camera rails: the route with its corners rounded off
  function sPath(sv, w = 2.2, n = 9) {
    const o = new THREE.Vector3();
    for (let k = 0; k < n; k++) o.add(pathAt(sv + w * (k / (n - 1) - 0.5)));
    return o.multiplyScalar(1 / n);
  }

  function poseOf(sh, t) {
    const u = clamp((t - sh.t0) / (sh.t1 - sh.t0));
    const cp = smoothPac(t), cd = smoothDir(t);
    const s = carDist(t);
    const az0 = sh.seed * Math.PI * 2;
    const pos = new THREE.Vector3(), look = new THREE.Vector3(), up = tmpUp.clone();
    let fov = 45;
    const orbit = (c, az, el, r) => pos.set(c.x + r * Math.cos(el) * Math.sin(az), c.y + r * Math.sin(el), c.z + r * Math.cos(el) * Math.cos(az));
    const topDown = (c, h, a) => { pos.set(c.x + 0.01, h, c.z + 0.01); look.copy(c); up.set(Math.sin(a), 0, Math.cos(a)); };
    switch (sh.type) {
      case "intro": topDown(cp, lerp(46, 13, ease(t / 5.2)), 0.3 + t * 0.08); fov = 42; break;
      case "top": topDown(cp, lerp(20, 14, ease(u)), az0 + u * 0.5); fov = 40; break;
      case "relight": topDown(carBR, lerp(34, 48, ease(u)), az0 + u * 0.3); fov = 50; break;
      case "iso": {
        const e0 = 0.5 + sh.seed * 0.7, e1 = 0.55 + ((sh.seed * 7.31) % 1) * 0.7;
        look.copy(cp).setY(0.4);
        orbit(look, az0 + u * (0.5 + sh.seed), lerp(e0, e1, ease(u)), lerp(15, 10, u)); fov = 40; break;
      }
      case "spin": {
        look.copy(cp).setY(0.35);
        orbit(look, az0 + (sh.seed < 0.5 ? 1 : -1) * ease(u) * 2.6, lerp(0.85, 1.1, sh.seed), lerp(11, 9, u)); fov = 46; break;
      }
      case "drone": {
        // weaving in behind the runner between the towers
        const a = smoothPac(tBack(t, lerp(2.6, 1.8, u)), 1.2), ad = smoothDir(tBack(t, 2));
        const weave = Math.sin(u * Math.PI * 1.2 + sh.seed * 6) * 0.35;
        pos.set(a.x - ad.z * weave, lerp(2.6, 1.3, ease(u)) + 0.5 * sh.seed, a.z + ad.x * weave);
        look.copy(cp).addScaledVector(cd, 1.2).setY(0.25); fov = 64; break;
      }
      case "pan": {
        const side = new THREE.Vector3(-cd.z, 0, cd.x).multiplyScalar(sh.seed < 0.5 ? 1 : -1);
        const along = lerp(-4, 4, u), r = 7 + sh.seed * 3, y = 6 + sh.seed * 3;
        pos.copy(cp).addScaledVector(side, r).addScaledVector(cd, along).setY(y);
        look.copy(cp).setY(0.3); fov = 40; break;
      }
      case "street":
      case "closeup": {
        // chase cam: low, right behind the runner
        const close = sh.type === "closeup";
        const side = new THREE.Vector3(-cd.z, 0, cd.x).multiplyScalar(sh.seed < 0.5 ? 0.2 : -0.2);
        pos.copy(smoothPac(tBack(t, close ? 1.3 : 1.9), 1.2)).add(side).setY(close ? 0.6 : 0.85);
        look.copy(cp).addScaledVector(cd, 1.6).setY(0.25); fov = 56; break;
      }
      case "flyover": {
        pos.copy(smoothPac(tBack(t, 3.2), 1.2)).setY(lerp(5.5, 4.2, u));
        look.copy(cp).addScaledVector(cd, 1.5).setY(0.25); fov = 55; break;
      }
      case "worm": {
        // a spectator at a corner ahead: the runner comes at us and passes overhead-left
        const sMeet = carDist(sh.t0 + (sh.t1 - sh.t0) * 0.62);
        const a = sPath(sMeet), a2 = sPath(sMeet + 0.3);
        const tx = a2.x - a.x, tz = a2.z - a.z, tl = Math.hypot(tx, tz) || 1, sd = sh.seed < 0.5 ? 1 : -1;
        pos.set(a.x - tz / tl * 0.45 * sd, 0.12, a.z + tx / tl * 0.45 * sd);
        const from = pathAt(sMeet - 3.5);
        look.copy(from).setY(lerp(0.35, 2.2, ease(u))); fov = 72; break;
      }
      case "crane": {
        const base = sPath(carDist(sh.t0) + 2.5);
        const side = new THREE.Vector3(-cd.z, 0, cd.x).multiplyScalar(sh.seed < 0.5 ? 0.35 : -0.35);
        pos.copy(base).add(side).setY(lerp(0.3, 9, ease(u)));
        look.copy(cp).setY(0.3); fov = 52; break;
      }
      case "profile": {
        const r = 34, lat = lerp(-3, 3, u);
        look.copy(cp).setY(1.2);
        pos.set(cp.x + Math.sin(az0) * r + Math.cos(az0) * lat, 1.3, cp.z + Math.cos(az0) * r - Math.sin(az0) * lat); fov = 17; break;
      }
      case "pushin": {
        // descend down the street ahead of the runner, facing it: the street keeps the sightline clear
        const e = ease(u);
        pos.copy(sPath(s + lerp(9, 3.2, e))).setY(lerp(12, 1.1, e));
        look.copy(cp).setY(0.3); fov = 42; break;
      }
      case "bridge": {
        // the runner has stopped; the city goes dark around it
        const e = ease(u), sBR = carDist(BR0);
        pos.copy(sPath(sBR + lerp(12, 3.5, e))).setY(lerp(16, 1.3, e));
        look.copy(carBR).setY(0.3); fov = 40; break;
      }
      case "orbitWide": {
        look.copy(cityCentre).setY(1.5);
        orbit(look, az0 + u * 0.8, 0.3, 30); fov = 42; break;
      }
      case "reveal": {
        look.copy(cityCentre);
        orbit(look, az0 + u * 0.7, lerp(0.45, 1.3, ease(u)), lerp(32, 62, ease(u))); fov = 42; break;
      }
    }
    return { pos, look, fov, up };
  }

  function basePose(t) {
    const si = Math.max(0, bsearch(shotStarts, t) - 1), sh = shots[si];
    let pose = poseOf(sh, t);
    if (sh.glide === undefined && !sh.cut && si > 0) {
      // the further the two framings are apart, the slower the glide
      const tt = sh.t0 + 2, a = poseOf(shots[si - 1], tt), b = poseOf(sh, tt);
      const da = a.look.clone().sub(a.pos).normalize(), db = b.look.clone().sub(b.pos).normalize();
      const deg = Math.acos(clamp(da.dot(db), -1, 1)) * 180 / Math.PI;
      sh.glide = Math.min(sh.t1 - sh.t0 - 0.5, lerp(GLIDE, 8, smooth((deg - 45) / 90)));
    }
    if (!sh.cut && si > 0 && t < sh.t0 + sh.glide) {
      const prev = poseOf(shots[si - 1], t), w = ease((t - sh.t0) / sh.glide);
      pose = { pos: prev.pos.lerp(pose.pos, w), look: prev.look.lerp(pose.look, w), fov: lerp(prev.fov, pose.fov, w), up: prev.up.lerp(pose.up, w).normalize() };
    }
    pose.sh = sh; pose.si = si;
    return pose;
  }
  // how far the camera must rise at time t to clear any building it would sit inside
  function liftNeeded(t, pose) {
    let need = 0;
    for (let i = 0; i < N; i++) {
      const b = B[i];
      if (b.tb > t + 0.8) continue; // about-to-rise buildings count, so the camera clears them early
      if (Math.abs(pose.pos.x - b.x) < b.w / 2 + 0.3 && Math.abs(pose.pos.z - b.z) < b.d / 2 + 0.3) need = Math.max(need, b.h + 0.6 - pose.pos.y);
    }
    return need;
  }
  // collision lift, smoothed in time so it never jerks:
  // raw lift is sampled on an absolute 0.1s grid (cached), dilated ±0.8s so the camera clears
  // a roof before reaching it, averaged ±1.2s, then Catmull-Rom interpolated (C1-continuous).
  // Samples are clamped inside the current shot, so a cut never leaks into the next shot.
  const LG = 0.1, DIL = 8, AVG = 12;
  const rawCache = new Map();
  function liftRaw(si, j) {
    const tk0 = takes[shots[si].take], key = shots[si].take * 100000 + j;
    let v = rawCache.get(key);
    if (v === undefined) {
      const tk = clamp(j * LG, tk0.t0, tk0.t1 - 1e-4);
      v = liftNeeded(tk, basePose(tk));
      if (rawCache.size > 20000) rawCache.clear();
      rawCache.set(key, v);
    }
    return v;
  }
  function liftGrid(si, j) {
    let acc = 0;
    for (let a = -AVG; a <= AVG; a++) {
      let m = 0;
      for (let d = -DIL; d <= DIL; d++) m = Math.max(m, liftRaw(si, j + a + d));
      acc += m;
    }
    return acc / (2 * AVG + 1);
  }
  function poseAt(t) {
    const pose = basePose(t);
    const x = t / LG, j = Math.floor(x), f = x - j;
    const p0 = liftGrid(pose.si, j - 1), p1 = liftGrid(pose.si, j), p2 = liftGrid(pose.si, j + 1), p3 = liftGrid(pose.si, j + 2);
    const lift = 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
    pose.pos.y += Math.max(0, lift);
    return pose;
  }
  function applyPose(cam, pose) {
    cam.fov = pose.fov; cam.updateProjectionMatrix();
    cam.up.copy(pose.up); cam.position.copy(pose.pos); cam.lookAt(pose.look);
    cam.updateMatrixWorld();
  }
  const probe = new THREE.PerspectiveCamera(45, width / height, 0.03, 600);
  function seen(cam, t) {
    const c = carAt(t).p, v = new THREE.Vector3(c.x, 0.2, c.z).project(cam);
    return v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95;
  }
  function placeCamera(t) {
    const pose = poseAt(t);
    applyPose(camera, pose);
    let track = "track";
    if (!seen(camera, t)) track = "lost";
    else { applyPose(probe, poseAt(Math.max(0, t - 0.7))); if (!seen(probe, t - 0.7)) track = "acquire"; }
    return { sh: pose.sh, track };
  }

  // ── per-frame ──
  const pos4 = carGeo.attributes.position.array;
  // opts.pose overrides the camera (stills/covers); opts.fullTrail draws the whole night's route
  function renderAt(t, opts = {}) {
    t = clamp(t, 0, DUR);
    U.uTime.value = t;
    const hor = keyed(HORIZON, t), zen = keyed(ZENITH, t);
    sky.material.uniforms.uHor.value.copy(hor); sky.material.uniforms.uZen.value.copy(zen);
    U.uFog.value.copy(hor); U.uFogD.value = keyed(FOG, t);
    bMat.uniforms.uWall.value.copy(keyed(WALL, t));
    bMat.uniforms.uDawnMix.value = smooth((t - 170) / 20);
    const { p: cp, d: cd } = carAt(t);
    groundMat.uniforms.uCar.value.copy(cp);
    groundMat.uniforms.uDir.value.set(cd.x, cd.z).normalize();
    groundMat.uniforms.uGridR.value = lerp(0, 90, smooth(t / 6));
    const dim = 1 - 0.9 * smooth((t - BR0 - 0.3) / 2.5) * (1 - smooth((t - BR1) / 0.8));
    groundMat.uniforms.uLamp.value = dim * (1 - 0.7 * smooth((t - 178) / 12));
    lampMat.uniforms.uDim.value = groundMat.uniforms.uLamp.value;
    groundMat.uniforms.uPoolR.value = poolR(t);
    // car lights
    const side = new THREE.Vector3(-cd.z, 0, cd.x);
    const put = (i, v) => { pos4[i * 3] = v.x; pos4[i * 3 + 1] = 0.1; pos4[i * 3 + 2] = v.z; };
    put(0, cp.clone().addScaledVector(cd, 0.22).addScaledVector(side, 0.09));
    put(1, cp.clone().addScaledVector(cd, 0.22).addScaledVector(side, -0.09));
    put(2, cp.clone().addScaledVector(cd, -0.22).addScaledVector(side, 0.09));
    put(3, cp.clone().addScaledVector(cd, -0.22).addScaledVector(side, -0.09));
    carGeo.attributes.position.needsUpdate = true;
    // trail: the last stretch of road, or the whole night's route at the end
    const s = carDist(t), full = opts.fullTrail ? opts.fullTrail : smooth((t - 183) / 4);
    const L = lerp(Math.min(s, 9), s, full);
    const tp = trailGeo.attributes.position.array, tc = trailGeo.attributes.color.array;
    const wdt = lerp(0.035, 0.22, full);
    for (let i = 0; i < TRAIL; i++) {
      const f = i / (TRAIL - 1), si = s - L + L * f;
      const p = pathAt(Math.max(0, si)), p2 = pathAt(Math.max(0, si) + 0.05);
      const dx = p2.x - p.x, dz = p2.z - p.z, dl = Math.hypot(dx, dz) || 1;
      const nx = -dz / dl * wdt, nz = dx / dl * wdt;
      tp.set([p.x + nx, 0.03, p.z + nz, p.x - nx, 0.03, p.z - nz], i * 6);
      const a = lerp(Math.pow(f, 2.2), 0.8, full) * (s > 0.05 ? 1 : 0);
      const cr = lerp(0.75, 1.1, full), cg = lerp(0.5, 0.75, full), cb = lerp(0.08, 0.16, full);
      tc.set([cr * a, cg * a, cb * a, cr * a, cg * a, cb * a], i * 6);
    }
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
    // the runner
    const pw = powerAt(t), stopped = keyed(SPEED, t) < 1;
    pac.position.set(cp.x, 0.2, cp.z);
    pac.rotation.set(0, Math.atan2(-cd.z, cd.x), 0);
    pac.scale.setScalar(1 + 0.35 * pw);
    const BT = SONG.beats, bi = bsearch(BT, t) - 1;
    const ph = bi >= 0 ? clamp((t - BT[bi]) / ((BT[bi + 1] || BT[bi] + 0.6) - BT[bi])) : 0;
    const mouth = stopped ? 0.1 : 0.06 + 0.72 * Math.sin(Math.PI * ph);
    upperJaw.rotation.z = mouth / 2; lowerJaw.rotation.z = -mouth / 2;
    pacMat.color.setRGB(0.62 + 0.35 * pw, 0.44 + 0.25 * pw, 0.05 + 0.05 * pw);
    pelMat.uniforms.uDist.value = s;
    bloom.strength = keyed(BLOOM, t) + 0.12 * pw;
    const { sh, track } = placeCamera(t);
    if (opts.pose) applyPose(camera, opts.pose);
    composer.render();
    // where the runner is on screen, for the tracking reticle
    const sp = new THREE.Vector3(cp.x, 0.2, cp.z).project(camera);
    const edge = new THREE.Vector3(cp.x, 0.2 + PAC_R * pac.scale.x, cp.z).project(camera);
    const eaten = bsearch(pelSorted, s);
    return {
      shot: sh.type, built: bsearch(byTime, t), total: N, lightsOn: lightsOn(t), track,
      pac: { x: (sp.x * 0.5 + 0.5) * width, y: (1 - (sp.y * 0.5 + 0.5)) * height, r: Math.abs(edge.y - sp.y) * 0.5 * height, on: sp.z < 1 && Math.abs(sp.x) < 1.1 && Math.abs(sp.y) < 1.1 },
      score: eaten * 10 + powerTimes.filter((pt) => t >= pt).length * 40, power: pw,
    };
  }

  return { renderAt, buildings: N, shots, poseAt, carAt, cityCentre, THREE };
}
