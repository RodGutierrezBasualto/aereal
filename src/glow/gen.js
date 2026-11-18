// ---------- Glowcap Hollow: procedural generation (CPU). Units are metres; water level is y = 0.
const fr = x => x - Math.floor(x), cl = (x, a, b) => x < a ? a : x > b ? b : x, ss = (a, b, x) => { x = cl((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x) }, mix = (a, b, t) => a + (b - a) * t;
const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
const hs = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296 };
function vn(x, y) { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return mix(mix(hs(i, j), hs(i + 1, j), su), mix(hs(i, j + 1), hs(i + 1, j + 1), su), sv) }
function fbm(x, y, o) { let s = 0, a = .5, n = 0; for (let i = 0; i < o; i++) { s += a * vn(x, y); n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= .5 } return s / n }
const nz = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }, crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const f16 = (() => { const f = new Float32Array(1), u = new Uint32Array(f.buffer); return v => { f[0] = v; const x = u[0], s = x >> 16 & 0x8000, e = (x >> 23 & 0xff) - 112, m = x & 0x7fffff; return e <= 0 ? s : e >= 31 ? s | 0x7c00 : s | e << 10 | m >> 13 } })();

// ---- terrain: a bowl valley with a meandering stream and a lake
const EXT = 650, GN = 241, GS = EXT * 2 / (GN - 1), LK = [-70, 110, 95];
const sx = z => 110 * Math.sin(z * .0055) + 55 * Math.sin(z * .013 + 1.3) - 30, sdx = z => .605 * Math.cos(z * .0055) + .715 * Math.cos(z * .013 + 1.3);
const dStream = (x, z) => Math.abs(x - sx(z)) / Math.sqrt(1 + sdx(z) ** 2), dLake = (x, z) => Math.hypot((x - LK[0]) / LK[2], (z - LK[1]) / (LK[2] * .75));
function H0(x, z) {
  const r = Math.hypot(x * .95, z * 1.05), n = fbm(x * .006 + 3, z * .006 + 7, 5), m = fbm(x * .02, z * .02, 3);
  let h = 3 + 9 * n + 2.5 * m;
  h += 95 * Math.pow(ss(300, 640, r + 60 * (n - .5)), 1.5) * (.7 + .6 * fbm(x * .004, z * .004 + 40, 3));
  h = mix(h, -3.5, Math.exp(-((dStream(x, z) / 11) ** 2)) * ss(560, 420, r));
  const dl = dLake(x, z); h = mix(h, -7 + 4 * dl, ss(1.25, .7, dl));
  return h;
}
function genGlow(MS) {
  const R = rng(20261118), G = { hm: new Float32Array(GN * GN) };
  for (let j = 0; j < GN; j++)for (let i = 0; i < GN; i++)G.hm[j * GN + i] = H0(-EXT + i * GS, -EXT + j * GS);
  const H = G.H = (x, z) => { const u = cl((x + EXT) / GS, 0, GN - 1.001), v = cl((z + EXT) / GS, 0, GN - 1.001), i = u | 0, j = v | 0, a = u - i, b = v - j, o = j * GN + i, M = G.hm; return mix(mix(M[o], M[o + 1], a), mix(M[o + GN], M[o + GN + 1], a), b) };
  const nrm = (x, z) => nz([H(x - 2, z) - H(x + 2, z), 4, H(x, z - 2) - H(x, z + 2)]);
  { // terrain mesh: pos, normal, (ao, wet)
    const v = new Float32Array(GN * GN * 8), ix = new Uint32Array((GN - 1) * (GN - 1) * 6); let k = 0;
    for (let j = 0; j < GN; j++)for (let i = 0; i < GN; i++) {
      const x = -EXT + i * GS, z = -EXT + j * GS, y = G.hm[j * GN + i], n = nrm(x, z);
      let av = 0; for (const [a, b] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, 2], [-2, 2], [2, -2]]) av += H(x + a * GS, z + b * GS); av /= 8;
      v.set([x, y, z, n[0], n[1], n[2], cl(1 - (av - y) * .06, .35, 1), ss(2.5, -.5, y)], (j * GN + i) * 8);
    }
    for (let j = 0; j < GN - 1; j++)for (let i = 0; i < GN - 1; i++) { const a = j * GN + i, b = a + 1, c = a + GN, d = c + 1; ix.set([a, c, b, b, c, d], k); k += 6 }
    G.terrain = { v, i: ix };
  }
  // ---- giant mushrooms (groves), small glowing clusters, ferns, rocks
  // one cohesive palette: teal / cyan dominates, violet in some regions, amber and magenta are rare accents
  const PAL = [[.12, .95, .8], [.15, .7, 1], [.5, .38, 1], [1, .58, .16], [1, .28, .65]];
  const hue = (x, z) => { const a = fbm(x * .0035 + 11, z * .0035, 3), r = R(); return r < .05 ? PAL[3] : a < .47 ? PAL[r < .65 ? 0 : 1] : a < .58 ? PAL[r < .5 ? 1 : 2] : r < .75 ? PAL[2] : r < .9 ? PAL[4] : PAL[0] };
  const ok = (x, z, minH, maxR) => { const y = H(x, z), n = nrm(x, z); return y > minH && n[1] > .82 && Math.hypot(x, z) < maxR };
  const GI = [[], [], [], []], GP = [], LIGHT = [];
  const giant = (x, z, s, vt) => { const y = H(x, z) - .3 - s * .004, c = hue(x, z), ph = R() * 6.28, yw = R() * 6.28, tx = (R() - .5) * .12, tz = (R() - .5) * .12;
    GI[vt].push(x, y, z, s, yw, tx, tz, ph, c[0], c[1], c[2], vt, .75 + .35 * R(), 0, 0, 0); GP.push([x, y, z, s, vt, yw, tx, tz, c]); LIGHT.push([x, z, c, .8, CAPR[vt] * s * 1.7 + 5]) };
  for (const [ax, az] of [[-20, 260], [-205, 30], [125, 70], [70, -190], [-240, -210], [255, 235], [-340, 160]]) { // colossal landmarks
    for (let k = 0; k < 400; k++) { const x = ax + (R() - .5) * 70, z = az + (R() - .5) * 70; if (ok(x, z, 2, 520) && GP.every(g => (g[0] - x) ** 2 + (g[2] - z) ** 2 > 130 * 130)) { giant(x, z, 92 + 40 * R(), R() < .6 ? 0 : 3); break } } }
  for (let k = 0, n = 0; k < 30000 && n < 230; k++) {
    const x = (R() - .5) * 1100, z = (R() - .5) * 1100; if (!ok(x, z, 1.2, 540)) continue;
    const grove = fbm(x * .006 + 70, z * .006, 3); if (grove < .45 && R() > .2) continue;
    let near = false; for (const g of GP) if ((g[0] - x) ** 2 + (g[2] - z) ** 2 < (g[3] * .42 + 7) ** 2) { near = true; break } if (near) continue;
    giant(x, z, 9 + 44 * Math.pow(R(), 2.4) + (grove > .6 ? 16 * R() : 0), R() * 4 | 0); n++;
  }
  const CL = [], FE = [], RO = [];
  for (let k = 0, n = 0; k < 60000 && n < 3600; k++) {
    const g = GP[R() * GP.length | 0], near = R() < .75, a = R() * 6.28, d = near ? g[3] * (.15 + .5 * R()) : 0;
    const x = near ? g[0] + Math.cos(a) * d : (R() - .5) * 1100, z = near ? g[2] + Math.sin(a) * d : (R() - .5) * 1100; if (!ok(x, z, .3, 560)) continue;
    const c = hue(x + 40 * R(), z), s = .6 + 1.8 * R() * R();
    CL.push(x, H(x, z) - .05, z, s, R() * 6.28, (R() - .5) * .2, (R() - .5) * .2, R() * 6.28, c[0], c[1], c[2], 4, .7 + .6 * R(), 0, 0, 0); n++;
    if (n % 4 == 0) LIGHT.push([x, z, c, .16 + .1 * s, 7]);
  }
  for (let k = 0, n = 0; k < 90000 && n < 9000; k++) {
    const x = (R() - .5) * 1150, z = (R() - .5) * 1150, y = H(x, z); if (y < .2 || y > 60 || nrm(x, z)[1] < .78 || Math.hypot(x, z) > 600 || fbm(x * .015, z * .015 + 5, 3) < .42) continue;
    const c = hue(x, z + 30 * R()); FE.push(x, y - .05, z, .8 + 1.4 * R(), R() * 6.28, 0, 0, R() * 6.28, c[0], c[1], c[2], 0, .35, 0, 0, 0); n++;
  }
  for (let k = 0, n = 0; k < 20000 && n < 260; k++) {
    const x = (R() - .5) * 1150, z = (R() - .5) * 1150, y = H(x, z); if (y < -1 || Math.hypot(x, z) > 600) continue;
    const c = hue(x, z); RO.push(x, y - .4, z, 1.2 + 5 * R() * R(), R() * 6.28, (R() - .5) * .5, (R() - .5) * .5, R() * 6.28, c[0], c[1], c[2], 0, 0, 0, 0, 0); n++;
  }
  G.inst = { giant: GI, cluster: CL, fern: FE, rock: RO }; G.giants = GP;
  // ---- glow light map (256^2): every mushroom pools coloured light under its cap; between the pools the forest stays dark
  { const N = 256, L = new Float32Array(N * N * 3), cs = EXT * 2 / N;
    for (const [x, z, c, I, r] of LIGHT) { const i0 = Math.max(0, (x - r * 1.6 + EXT) / cs | 0), i1 = Math.min(N - 1, (x + r * 1.6 + EXT) / cs | 0), j0 = Math.max(0, (z - r * 1.6 + EXT) / cs | 0), j1 = Math.min(N - 1, (z + r * 1.6 + EXT) / cs | 0);
      for (let j = j0; j <= j1; j++)for (let i = i0; i <= i1; i++) { const d2 = ((-EXT + (i + .5) * cs - x) ** 2 + (-EXT + (j + .5) * cs - z) ** 2) / (r * r), w = I * Math.exp(-d2 * 2.6); if (w < .004) continue; const o = (j * N + i) * 3; L[o] += c[0] * w; L[o + 1] += c[1] * w; L[o + 2] += c[2] * w } }
    const T = new Uint16Array(N * N * 4); for (let k = 0; k < N * N; k++) { const q = 1 / (1 + (L[k * 3] * .3 + L[k * 3 + 1] * .5 + L[k * 3 + 2] * .2) * .9); T[k * 4] = f16(L[k * 3] * q); T[k * 4 + 1] = f16(L[k * 3 + 1] * q); T[k * 4 + 2] = f16(L[k * 3 + 2] * q); T[k * 4 + 3] = f16(1) } G.lm = T; }
  // ---- cap map (256^2): the glowing undersides seen from below (colour, cap height in alpha) for the water's reflections; light cones under the big caps
  { const N = 256, C = new Float32Array(N * N * 5), cs = EXT * 2 / N; G.cones = [];
    for (const g of GP) { const k = g[4], P = MS.capc[k], cy = Math.cos(g[5]), sy = Math.sin(g[5]), ly = P[1] * g[3], cx = g[0] + (P[0] * cy - P[2] * sy) * g[3] + g[6] * ly, cz = g[2] + (P[0] * sy + P[2] * cy) * g[3] + g[7] * ly, r = CAPR[k] * g[3], c = g[8];
      if (g[3] > 17) G.cones.push(cx, g[1] + ly, cz, r, H(cx, cz) - .5, R() * 6.28, 0, 0, c[0], c[1], c[2], .05 + .03 * Math.min(g[3] / 60, 1.4));
      const i0 = Math.max(0, (cx - r + EXT) / cs | 0), i1 = Math.min(N - 1, (cx + r + EXT) / cs | 0), j0 = Math.max(0, (cz - r + EXT) / cs | 0), j1 = Math.min(N - 1, (cz + r + EXT) / cs | 0);
      for (let j = j0; j <= j1; j++)for (let i = i0; i <= i1; i++) { const d = Math.hypot(-EXT + (i + .5) * cs - cx, -EXT + (j + .5) * cs - cz) / r, w = ss(1, .8, d) * (.45 + .55 * d * d), o = (j * N + i) * 5; if (w > C[o + 4]) { C[o] = c[0] * w; C[o + 1] = c[1] * w; C[o + 2] = c[2] * w; C[o + 3] = g[1] + ly; C[o + 4] = w } } }
    const T = new Uint16Array(N * N * 4); for (let k = 0; k < N * N; k++)for (let q = 0; q < 4; q++)T[k * 4 + q] = f16(C[k * 5 + q]); G.cm = T; }
  // ---- particles: fireflies (swarms that flash together), rising spores, moths (kept around the camera in the shader)
  const PA = [[], [], []];
  for (let s = 0; s < 34; s++) { let x, z, k = 0; do { x = (R() - .5) * 900; z = (R() - .5) * 900; k++ } while (k < 200 && (H(x, z) > 25 || H(x, z) < -2 || Math.hypot(x, z) > 520)); const n = 90 + R() * 80 | 0, ph = R() * 6.28;
    for (let i = 0; i < n; i++) { const a = R() * 6.28, d = 6 + 22 * Math.sqrt(R()), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; PA[0].push(px, Math.max(H(px, pz), 0) + .6 + 5 * R(), pz, .05 + .04 * R(), ph + R() * .5, R(), R(), d) } }
  for (let i = 0; i < 2600; i++) { const g = GP[R() * GP.length | 0], a = R() * 6.28, d = g[3] * .25 * R(); PA[1].push(g[0] + Math.cos(a) * d, g[1] + g[3] * .55, g[2] + Math.sin(a) * d, .04 + .05 * R(), R(), R(), R(), g[3]) }
  for (let i = 0; i < 46; i++)PA[2].push(R(), R(), R(), .035 + .025 * R(), R() * 6.28, 3 + 6 * R(), R(), R());
  G.pa = PA;
  // ---- fauna (instance = 4 vec4, see FAUNA in wgsl.js): deer herds (glowing antlers), owls on cap rims, frogs by the water, one sleeping lantern beast
  const FA = [[], [], [], []], open = (x, z, d) => GP.every(g => (g[0] - x) ** 2 + (g[2] - z) ** 2 > (g[3] * .45 + d) ** 2);
  const spot = (minH, maxH, d, rr) => { for (let k = 0; k < 6000; k++) { const x = (R() - .5) * 2 * rr, z = (R() - .5) * 2 * rr, y = H(x, z); if (y > minH && y < maxH && nrm(x, z)[1] > .85 && open(x, z, d)) return [x, z] } return [0, 0] };
  for (let h = 0; h < 4; h++) { const [x, z] = spot(1, 18, 22, 430), n = 4 + (R() * 3 | 0), Rr = 14 + 10 * R(), sp = .9 + .4 * R(), ph = R() * 6.28, sd = R() * 99, c = PAL[h % 3 ? 0 : 4];
    for (let i = 0; i < n; i++)FA[0].push(x + (R() - .5) * 10, 0, z + (R() - .5) * 10, 1.7 + .4 * R(), ph - i * .25, sp, 0, Rr, c[0], c[1], c[2], 0, sd + i * .013, 0, 0, 0) }
  for (let k = 0, n = 0; k < 400 && n < 22; k++) { // owls stand on the cap's top surface: local point on the cap -> the mushroom's yaw + tilt (same maths as the shader)
    const g = GP[R() * GP.length | 0]; if (g[3] < 26) continue; const a = R() * 6.28, t = .55, C = MS.capc[g[4]], lx = C[0] + Math.cos(a) * CAPR[g[4]] * t, ly = C[1] + capTop(g[4], t), lz = C[2] + Math.sin(a) * CAPR[g[4]] * t;
    const cy = Math.cos(g[5]), sy = Math.sin(g[5]), rx = (lx * cy - lz * sy) * g[3], ry = ly * g[3], rz = (lx * sy + lz * cy) * g[3];
    FA[1].push(g[0] + rx + g[6] * ry, g[1] + ry, g[2] + rz + g[7] * ry, .55 + .2 * R(), R() * 6.28, 0, 1, 0, 1, .62, .15, 0, R() * 99, 0, 0, 0); n++ }
  for (let k = 0, n = 0; k < 20000 && n < 44; k++) { const x = (R() - .5) * 1000, z = (R() - .5) * 1000, y = H(x, z); if (y < .15 || y > 1.4 || Math.hypot(x, z) > 520) continue; const c = PAL[R() < .5 ? 4 : 0];
    FA[2].push(x, y, z, .28 + .1 * R(), R() * 6.28, 3 + 4 * R(), 2, 0, c[0], c[1], c[2], 0, R() * 99, R(), 0, 0); n++ }
  { const a = 2.3, x = Math.cos(a) * 470, z = Math.sin(a) * 470; FA[3].push(x, H(x, z) - .3, z, 6.5, a + 2.2, 0, 3, 0, 1, .7, .35, 0, 7, 0, 0, 0) } // in a hollow under the valley wall, behind a grove
  G.fa = FA; G.beast = FA[3].slice(0, 3);
  // ---- audio spots: crickets in the grass, water drips along the stream
  G.crick = []; for (let k = 0; k < 4000 && G.crick.length < 480; k++) { const x = (R() - .5) * 1000, z = (R() - .5) * 1000, y = H(x, z); if (y > .5 && y < 40 && Math.hypot(x, z) < 540) G.crick.push(x, y + .3, z) }
  G.drip = []; for (let z = -480; z <= 480; z += 22) { const x = sx(z); if (H(x, z) < -1) G.drip.push(x, 0, z) }
  for (let a = 0; a < 6.28; a += .35) G.drip.push(LK[0] + Math.cos(a) * LK[2] * .78, 0, LK[1] + Math.sin(a) * LK[2] * .58);
  return G;
}
// cap height / radius per giant mushroom variant (fraction of the instance scale), used to put owls on the rims
const CAPY = [.86, .8, .9, .84], CAPR = [.42, .55, .3, .4];
