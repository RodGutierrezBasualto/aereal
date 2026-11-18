// ---------- Glowcap Hollow meshes. Vertex = pos3 nrm3 uv4 (uv.w material: 0 stem, 1 cap top, 2 gills, 3 fern blade, 4 rock)
function GM() { this.v = []; this.i = [] }
GM.prototype.vx = function (p, u, v, a, m) { this.v.push(p[0], p[1], p[2], 0, 1, 0, u, v, a, m); return this.v.length / 10 - 1 };
GM.prototype.quad = function (a, b, c, d) { this.i.push(a, b, c, a, c, d) };
GM.prototype.nrm = function () { // smooth normals from winding
  const v = this.v, ix = this.i; for (let k = 0; k < v.length; k += 10) v[k + 3] = v[k + 4] = v[k + 5] = 0;
  for (let k = 0; k < ix.length; k += 3) { const a = ix[k] * 10, b = ix[k + 1] * 10, c = ix[k + 2] * 10, n = crs([v[b] - v[a], v[b + 1] - v[a + 1], v[b + 2] - v[a + 2]], [v[c] - v[a], v[c + 1] - v[a + 1], v[c + 2] - v[a + 2]]); for (const q of [a, b, c]) { v[q + 3] += n[0]; v[q + 4] += n[1]; v[q + 5] += n[2] } }
  for (let k = 0; k < v.length; k += 10) { const l = Math.hypot(v[k + 3], v[k + 4], v[k + 5]); if (l < 1e-9) { v[k + 3] = 0; v[k + 4] = 1; v[k + 5] = 0 } else { v[k + 3] /= l; v[k + 4] /= l; v[k + 5] /= l } } // seam vertices at a lathe's pole only touch degenerate triangles
  return this;
};
// surface of revolution around a centre point; ring j has radius P[j][0] (times rf(a, j)) at height P[j][1]; uvf(a, j) -> [u, v, a, m]
GM.prototype.lathe = function (C, P, sides, rf, uvf) {
  const v0 = this.v.length / 10;
  for (let j = 0; j < P.length; j++)for (let s = 0; s <= sides; s++) { const a = s / sides * 6.2832, r = P[j][0] * rf(a, j), u = uvf(a, j); this.vx([C[0] + Math.cos(a) * r, C[1] + P[j][1], C[2] + Math.sin(a) * r], u[0], u[1], u[2], u[3]) }
  for (let j = 0; j + 1 < P.length; j++)for (let s = 0; s < sides; s++) { const a = v0 + j * (sides + 1) + s, b = a + sides + 1; this.quad(a, a + 1, b + 1, b) }
};
GM.prototype.tube = function (P, R, sides, uvf) { // along polyline P with radii R; uvf(k, s) -> [u, v, a, m]
  const v0 = this.v.length / 10; let N = null;
  for (let k = 0; k < P.length; k++) {
    const a = P[Math.max(k - 1, 0)], b = P[Math.min(k + 1, P.length - 1)], T = nz([b[0] - a[0], b[1] - a[1], b[2] - a[2]]); if (!N) N = Math.abs(T[1]) > .9 ? [1, 0, 0] : [0, 1, 0];
    const d = N[0] * T[0] + N[1] * T[1] + N[2] * T[2]; N = nz([N[0] - T[0] * d, N[1] - T[1] * d, N[2] - T[2] * d]); const B = crs(T, N);
    for (let s = 0; s <= sides; s++) { const t = s / sides * 6.2832, c = Math.cos(t), sn = Math.sin(t), u = uvf(k, s); this.vx([P[k][0] + (N[0] * c + B[0] * sn) * R[k], P[k][1] + (N[1] * c + B[1] * sn) * R[k], P[k][2] + (N[2] * c + B[2] * sn) * R[k]], u[0], u[1], u[2], u[3]) }
  }
  for (let k = 0; k + 1 < P.length; k++)for (let s = 0; s < sides; s++) { const a = v0 + k * (sides + 1) + s, b = a + sides + 1; this.quad(a, b, b + 1, a + 1) }
};
// one mushroom of height 1 at C: curved stem, cap (top: m1, gills underneath: m2), a skirt on the stem and tendrils hanging from the rim (m5).
// kind: 0 dome, 1 parasol, 2 bell, 3 upturned. S = sides (40 for the giants, 10 for the little clusters, which also skip the trimmings)
function shroom(m, C, kind, r, S = 40) {
  const big = S > 20, cy = CAPY[kind], cr = CAPR[kind], sb = .02 + .03 * r(), bend = (r() - .5) * .12, P = [], RR = [], NS = big ? 12 : 6, SS = big ? 16 : 8;
  for (let k = 0; k <= NS; k++) { const t = k / NS, y = t * cy; P.push([C[0] + bend * Math.sin(t * 2.4), C[1] + y, C[2] + bend * .5 * Math.sin(t * 1.7)]); RR.push((.042 + sb * Math.exp(-t * 9) + .009 * Math.sin(t * 9) + .012 * Math.pow(t, 6)) * (kind == 2 ? .8 : 1)) }
  m.tube(P, RR, SS, (k, s) => [s / SS, k / NS, 0, 0]);
  const T = P[NS], Tc = [T[0], T[1] - .01, T[2]], ph = r() * 6.28, NP = big ? 10 : 6, prof = [], und = [];
  for (let j = 0; j <= NP; j++) { const t = j / NP; prof.push([cr * t, capTop(kind, t)]) }
  const uy = kind == 3 ? .05 : kind == 2 ? -.02 : 0; for (let j = 0; j <= 4; j++) { const t = j / 4; und.push([cr * (1 - t) + .05 * t, uy * (1 - t) + .04 * t]) }
  const wav = (a, t) => 1 + (.045 * Math.sin(a * 7 + ph) + .02 * Math.sin(a * 13 + ph * 2)) * Math.pow(t, 3);
  m.lathe(Tc, prof, S, (a, j) => wav(a, j / NP), (a, j) => [a, j / NP, 0, 1]);
  m.lathe(Tc, und, S, (a, j) => wav(a, 1 - j / 4), (a, j) => [a, 1 - j / 4, 0, 2]);
  if (big) {
    const q = P[NS - 3]; m.lathe([q[0], q[1], q[2]], [[.04, .012], [.06, .004], [.074, -.02], [.076, -.04]], 24, a => 1 + .06 * Math.sin(a * 9 + ph), (a, j) => [a, .05 + j * .08, 0, 2]); // small skirt
    for (let k = 0; k < 20; k++) { const a = k / 20 * 6.2832 + r() * .25, L = .05 + .24 * r() * r(), rr = cr * (.72 + .26 * r()) * wav(a, 1), ca = Math.cos(a), sa = Math.sin(a), b = m.v.length / 10, w = .0035;
      for (let j = 0; j <= 6; j++) { const t = j / 6, o = rr + .01 * Math.sin(t * 5 + k), y = uy * rr / cr - L * t; for (const e of [-1, 1]) m.vx([Tc[0] + ca * o - sa * w * e, Tc[1] + y, Tc[2] + sa * o + ca * w * e], a, t, 0, 5); if (j) { const v = b + j * 2; m.quad(v - 2, v - 1, v + 1, v) } } }
  }
  return Tc;
}
// height of a cap's top surface above its centre ring at fraction t of the radius
const capTop = (kind, t) => kind == 3 ? .14 * (1 - t * t) + .05 * Math.pow(t, 6) : kind == 2 ? .2 * (1 - Math.pow(t, 1.4)) - .02 * t : kind == 1 ? .06 * (1 - t * t * t) : .14 * (1 - t * t);
function glowMeshes() {
  const r = rng(77), M = {};
  M.capc = []; M.giant = [0, 1, 2, 3].map(k => { const m = new GM(); M.capc[k] = shroom(m, [0, 0, 0], k, r); return m.nrm() });
  { const m = new GM(); for (let k = 0; k < 5; k++) { const a = k * 2.4, d = k ? .25 + .25 * r() : 0, s = k ? .35 + .4 * r() : 1, n = new GM(); shroom(n, [0, 0, 0], r() * 4 | 0, r, 10); const b = m.v.length / 10; for (let q = 0; q < n.v.length; q += 10) m.v.push(Math.cos(a) * d + n.v[q] * s, n.v[q + 1] * s, Math.sin(a) * d + n.v[q + 2] * s, 0, 1, 0, n.v[q + 6], n.v[q + 7], n.v[q + 8], n.v[q + 9]); for (const i of n.i) m.i.push(b + i) } M.cluster = m.nrm() }
  { const m = new GM(); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832 + r() * .4, L = .7 + .4 * r(), lift = .9 + .5 * r(), b = m.v.length / 10, d = [Math.cos(a), 0, Math.sin(a)], sd = [-d[2], 0, d[0]];
    for (let s = 0; s <= 6; s++) { const t = s / 6, w = .09 * Math.sin(Math.PI * (.08 + .92 * t)) * L, p = [d[0] * L * t * .8, L * (lift * t - .9 * t * t), d[2] * L * t * .8]; for (const e of [-1, 0, 1]) m.vx([p[0] + sd[0] * w * e, p[1] + Math.abs(e) * w * .3, p[2] + sd[2] * w * e], e, t, 0, 3) }
    for (let s = 0; s < 6; s++) { const q = b + s * 3; m.quad(q, q + 3, q + 4, q + 1); m.quad(q + 1, q + 4, q + 5, q + 2) } } M.fern = m.nrm() }
  { const m = new GM(), t = (1 + Math.sqrt(5)) / 2; let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nz);
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let s = 0; s < 2; s++) { const C = {}, F2 = [], mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (C[k] === undefined) { C[k] = V.length; V.push(nz([V[a][0] + V[b][0], V[a][1] + V[b][1], V[a][2] + V[b][2]])) } return C[k] }; for (const f of F) { const a = mid(f[0], f[1]), b = mid(f[1], f[2]), c = mid(f[2], f[0]); F2.push([f[0], a, c], [f[1], b, a], [f[2], c, b], [a, b, c]) } F = F2 }
    for (const p of V) { const d = .75 + .35 * fbm(p[0] * 2 + 5, p[2] * 2 + p[1] * 3, 3); m.vx([p[0] * d, Math.max(p[1] * d * .7, -.25), p[2] * d], 0, 0, 0, 4) } for (const f of F) m.i.push(f[0], f[1], f[2]); M.rock = m.nrm() }
  // fauna: triangle lists, 8 floats/vertex = pos, w (0 body, 1-4 legs + depth, 5 head + along, 6 tail), colour key c, normal
  const FV = () => { const o = { v: [] }; o.pt = (p, n, W) => o.v.push(p[0], p[1], p[2], W[0], W[1], n[0], n[1], n[2]);
    o.blob = (C, rr, wc, nu = 10, nv = 7) => { const P = (i, j) => { const th = i / nu * 6.2832, ph = j / nv * Math.PI, d = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]; return [[C[0] + d[0] * rr[0], C[1] + d[1] * rr[1], C[2] + d[2] * rr[2]], nz([d[0] / rr[0], d[1] / rr[1], d[2] / rr[2]])] }; for (let j = 0; j < nv; j++)for (let i = 0; i < nu; i++) { const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1); for (const q of [a, c, b, a, d, c]) o.pt(q[0], q[1], typeof wc == 'function' ? wc(q[0]) : wc) } };
    o.limb = (P, R, wc) => { for (let k = 0; k + 1 < P.length; k++) { const a = P[k], b = P[k + 1], T = nz([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), N = nz(crs(T, Math.abs(T[1]) > .9 ? [1, 0, 0] : [0, 1, 0])), B = crs(T, N); for (let s = 0; s < 5; s++) { const r0 = s / 5 * 6.2832, r1 = (s + 1) / 5 * 6.2832, q = (p, rr, t) => { const n = [N[0] * Math.cos(t) + B[0] * Math.sin(t), N[1] * Math.cos(t) + B[1] * Math.sin(t), N[2] * Math.cos(t) + B[2] * Math.sin(t)]; return [[p[0] + n[0] * rr, p[1] + n[1] * rr, p[2] + n[2] * rr], n] }, A0 = q(a, R[k], r0), A1 = q(a, R[k], r1), B0 = q(b, R[k + 1], r0), B1 = q(b, R[k + 1], r1); for (const [x, W] of [[A0, wc(k)], [B0, wc(k + 1)], [B1, wc(k + 1)], [A0, wc(k)], [B1, wc(k + 1)], [A1, wc(k)]]) o.pt(x[0], x[1], W) } } };
    return o };
  { const o = FV(), H = .95, Lg = .9, bl = .55, bw = .2; // deer: colour keys 0 coat, .3 pale, .6 dark, .9 glowing antlers
    o.blob([0, H, 0], [bw, .22, bl], p => [0, p[1] < H - .12 ? .3 : 0]);
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz], k) => { const x = sx * bw * .6, z = sz * bl * .68; o.limb([[x, H - .02, z], [x, H - Lg * .5, z + (sz < 0 ? -.07 : .02)], [x, H - Lg * .93, z], [x, H - Lg, z + .02]], [.065, .045, .03, .028], i => [k + 1 + .99 * i / 3, i == 3 ? .6 : 0]) });
    const hd = [0, H + .5, bl + .24]; o.limb([[0, H + .06, bl * .78], [0, H + .3, bl + .1], hd], [.1, .08, .07], i => [5 + .45 * i, 0]); o.blob([0, hd[1] + .02, hd[2] + .09], [.085, .09, .18], p => [5.99, p[2] > hd[2] + .24 ? .6 : 0]);
    for (const s of [-1, 1]) { const b = [s * .04, hd[1] + .12, hd[2]]; o.limb([b, [s * .12, hd[1] + .38, hd[2] - .06], [s * .2, hd[1] + .58, hd[2] + .03], [s * .16, hd[1] + .72, hd[2] + .1]], [.02, .016, .012, .006], () => [5.99, .9]); o.limb([[s * .11, hd[1] + .33, hd[2] - .05], [s * .2, hd[1] + .44, hd[2] - .12]], [.012, .006], () => [5.99, .9]); o.limb([[s * .17, hd[1] + .52, hd[2]], [s * .26, hd[1] + .6, hd[2] - .02]], [.01, .005], () => [5.99, .9]) }
    o.blob([0, H + .08, -bl - .03], [.05, .07, .06], [6.5, .3]); M.deer = new Float32Array(o.v) }
  { const o = FV(); o.blob([0, .35, 0], [.17, .25, .15], p => [0, p[2] > .08 && p[1] < .45 ? .3 : 0]); o.blob([0, .66, 0], [.15, .13, .13], [5.5, 0]); // owl: head (w 5) turns, eyes c .9 glow
    for (const s of [-1, 1]) { o.blob([s * .06, .68, .115], [.04, .04, .025], [5.6, .9], 8, 5); o.limb([[s * .09, .74, .02], [s * .12, .85, 0]], [.025, .004], () => [5.6, 0]); o.limb([[s * .05, .12, .05], [s * .05, .04, .1]], [.02, .012], () => [0, .6]) }
    o.limb([[0, .66, .12], [0, .62, .17]], [.02, .003], () => [5.6, .6]); o.blob([0, .14, -.12], [.08, .03, .1], [6.5, 0]); M.owl = new Float32Array(o.v) }
  { const o = FV(); o.blob([0, .1, 0], [.12, .08, .16], [0, 0]); o.blob([0, .12, .14], [.1, .07, .08], [5.2, 0]); o.blob([0, .06, .16], [.07, .045, .06], [5.9, .9]); // frog: throat sac (w 5.9, c .9) glows and swells
    for (const s of [-1, 1]) { o.blob([s * .06, .18, .15], [.032, .032, .032], [5.2, .6], 8, 5); o.blob([s * .12, .05, -.07], [.05, .04, .11], [3.5, 0]); o.blob([s * .09, .03, .1], [.03, .03, .03], [1.5, 0], 6, 4) } M.frog = new Float32Array(o.v) }
  { const o = FV(); o.blob([0, .5, 0], [.9, .52, 1.25], p => [0, .3], 16, 10); o.blob([.15, .32, 1.2], [.36, .3, .48], [5.5, .3], 12, 8); // lantern beast, curled asleep: c .3 = marked skin (markings glow as you approach)
    for (const s of [-1, 1]) { o.limb([[s * .25, .55, 1.25], [s * .38, .78, 1.15], [s * .42, .9, 1.02]], [.08, .05, .02], () => [5.5, .6]); o.blob([s * .65, .14, .7], [.25, .14, .4], [1.5, .3]); o.blob([s * .7, .16, -.75], [.3, .16, .45], [3.5, .3]) }
    { const P = [], R = []; for (let k = 0; k <= 10; k++) { const t = k / 10, a = -1.6 + t * 3.4; P.push([Math.cos(a) * (1.25 + .1 * t) - .2, .18 + .1 * Math.sin(t * 3), Math.sin(a) * 1.1 - .1]); R.push(.22 * (1 - t) + .05) } o.limb(P, R, k => [6.5, .3]) }
    M.beast = new Float32Array(o.v) }
  return M;
}
