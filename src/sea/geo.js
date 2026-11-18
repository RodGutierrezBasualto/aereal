// ---------------------------------------------------------------- procedural geometry (init time only)
const fr = x => x - Math.floor(x), cl = (x, a, b) => x < a ? a : x > b ? b : x, ss = (a, b, x) => { x = cl((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function hsh(x, y, z) { let a = fr(x * .1031), b = fr(y * .1031), c = fr(z * .1031); const d = a * (c + 31.32) + b * (b + 31.32) + c * (a + 31.32); a += d; b += d; c += d; return fr((a + b) * c); }
function vn3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hsh(ix, iy, iz), hsh(ix + 1, iy, iz), fx), l(hsh(ix, iy + 1, iz), hsh(ix + 1, iy + 1, iz), fx), fy),
    l(l(hsh(ix, iy, iz + 1), hsh(ix + 1, iy, iz + 1), fx), l(hsh(ix, iy + 1, iz + 1), hsh(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}
function fbm(x, y, z, o) { let a = .5, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vn3(x, y, z); n += a; x = x * 2.03 + 17.3; y = y * 2.03 + 9.1; z = z * 2.03 + 4.7; a *= .5; } return s / n; }

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  nz = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// quaternions [x,y,z,w]
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qax = (x, y, z, a) => { const s = Math.sin(a / 2); return [x * s, y * s, z * s, Math.cos(a / 2)]; };
const qup = n => { const q = [n[2], 0, -n[0], 1 + n[1]], l = Math.hypot(q[0], q[2], q[3]) || 1; return [q[0] / l, 0, q[2] / l, q[3] / l]; };
const qrot = (q, v) => { const c = crs(q, v), d = crs(q, [c[0] + q[3] * v[0], c[1] + q[3] * v[1], c[2] + q[3] * v[2]]); return [v[0] + 2 * d[0], v[1] + 2 * d[1], v[2] + 2 * d[2]]; };

// vertex: pos3 nrm3 uv4  (uv.w = material id)
function Mesh() { this.v = []; this.i = []; }
const MP = Mesh.prototype;
MP.vx = function (x, y, z, nx, ny, nz_, u, v, w, m) { this.v.push(x, y, z, nx, ny, nz_, u, v, w, m); return this.v.length / 10 - 1; };
MP.tri = function (a, b, c) { this.i.push(a, b, c); };
MP.quad = function (a, b, c, d) { this.i.push(a, b, c, a, c, d); };
MP.p = function (i) { const v = this.v; i *= 10; return [v[i], v[i + 1], v[i + 2]]; };
MP.nrm = function (v0, i0) {
  const v = this.v, ix = this.i;
  for (let k = v0 * 10; k < v.length; k += 10) v[k + 3] = v[k + 4] = v[k + 5] = 0;
  for (let k = i0; k < ix.length; k += 3) {
    const a = ix[k] * 10, b = ix[k + 1] * 10, c = ix[k + 2] * 10;
    const e1x = v[b] - v[a], e1y = v[b + 1] - v[a + 1], e1z = v[b + 2] - v[a + 2], e2x = v[c] - v[a], e2y = v[c + 1] - v[a + 1], e2z = v[c + 2] - v[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz_ = e1x * e2y - e1y * e2x;
    for (const q of [a, b, c]) { v[q + 3] += nx; v[q + 4] += ny; v[q + 5] += nz_; }
  }
  for (let k = v0 * 10; k < v.length; k += 10) { const l = Math.hypot(v[k + 3], v[k + 4], v[k + 5]) || 1; v[k + 3] /= l; v[k + 4] /= l; v[k + 5] /= l; }
};

function tube(m, P, R, sides, uvf, cap) {
  const n = P.length, base = m.v.length / 10; let N = null, t;
  for (let k = 0; k < n; k++) {
    t = nz(sub(P[Math.min(k + 1, n - 1)], P[Math.max(k - 1, 0)]));
    N = N ? nz(sub(N, mul(t, dot(N, t)))) : nz(crs(t, Math.abs(t[1]) < .9 ? [0, 1, 0] : [1, 0, 0]));
    const B = crs(t, N), r = typeof R === 'number' ? R : R[k];
    for (let s = 0; s < sides; s++) {
      const a = s / sides * 6.2832, c = Math.cos(a), sn = Math.sin(a), d = [N[0] * c + B[0] * sn, N[1] * c + B[1] * sn, N[2] * c + B[2] * sn], u = uvf(k, s);
      m.vx(P[k][0] + d[0] * r, P[k][1] + d[1] * r, P[k][2] + d[2] * r, d[0], d[1], d[2], u[0], u[1], u[2], u[3]);
    }
    if (k) for (let s = 0; s < sides; s++) { const a = base + (k - 1) * sides + s, b = base + (k - 1) * sides + (s + 1) % sides; m.quad(a, b, b + sides, a + sides); }
  }
  if (cap) { const u = uvf(n - 1, 0), q = add(P[n - 1], mul(t, (typeof R === 'number' ? R : R[n - 1]) * .8)), c = m.vx(q[0], q[1], q[2], t[0], t[1], t[2], u[0], u[1], u[2], u[3]); for (let s = 0; s < sides; s++)m.tri(base + (n - 1) * sides + s, base + (n - 1) * sides + (s + 1) % sides, c); }
}
// hard-edged rectangular beam swept along P
function beam(m, P, w, h, up, mat, v) {
  const n = P.length, C = []; let len = 0; const ln = [];
  for (let k = 0; k < n; k++) {
    if (k) len += Math.hypot(...sub(P[k], P[k - 1])); ln.push(len);
    const t = nz(sub(P[Math.min(k + 1, n - 1)], P[Math.max(k - 1, 0)])), r = nz(crs(t, up)), u = crs(r, t);
    const o = (a, b) => [P[k][0] + r[0] * a * w / 2 + u[0] * b * h / 2, P[k][1] + r[1] * a * w / 2 + u[1] * b * h / 2, P[k][2] + r[2] * a * w / 2 + u[2] * b * h / 2];
    C.push([o(-1, -1), o(1, -1), o(1, 1), o(-1, 1), mul(u, -1), r, u, mul(r, -1)]);
  }
  for (let f = 0; f < 4; f++) {
    const b = m.v.length / 10;
    for (let k = 0; k < n; k++) { const c = C[k], nn = c[4 + f]; for (const q of [c[f], c[(f + 1) % 4]]) m.vx(q[0], q[1], q[2], nn[0], nn[1], nn[2], ln[k], (v || 0) + f * .25 + .5, 1, mat); if (k) { const a = b + (k - 1) * 2; m.quad(a, a + 1, a + 3, a + 2); } }
  }
  for (const k of [0, n - 1]) { const c = C[k], t = nz(sub(P[Math.min(k + 1, n - 1)], P[Math.max(k - 1, 0)])), s = k ? 1 : -1, b = m.v.length / 10; for (let q = 0; q < 4; q++)m.vx(c[q][0], c[q][1], c[q][2], t[0] * s, t[1] * s, t[2] * s, ln[k], .5, 1, mat); m.quad(b, b + 1, b + 2, b + 3); }
}
function lathe(m, prof, sides, rf, uvf) {
  const v0 = m.v.length / 10, np = prof.length;
  for (let j = 0; j < np; j++)for (let s = 0; s < sides; s++) { const a = s / sides * 6.2832, r = prof[j][0] * rf(a, j), u = uvf(a, j); m.vx(Math.cos(a) * r, prof[j][1], Math.sin(a) * r, 0, 1, 0, u[0], u[1], u[2], u[3]); }
  for (let j = 0; j < np - 1; j++)for (let s = 0; s < sides; s++) { const a = v0 + j * sides + s, b = v0 + j * sides + (s + 1) % sides; m.quad(a, b, b + sides, a + sides); }
}
// leaf ribbon: 3 verts across, cupped, ruffled, optionally twisted
function blade(m, b, d, L, W, lift, droop, segs, mat, ph, pw, tw, cup) {
  const s0 = [-d[2], 0, d[0]], v0 = m.v.length / 10; tw = tw || 0; cup = cup === undefined ? .28 : cup;
  for (let k = 0; k <= segs; k++) {
    const s = k / segs, o = L * s * .85, y = L * (lift * s - droop * s * s), ty = lift - 2 * droop * s, tl = Math.hypot(.85, ty);
    const n0 = [-d[0] * ty / tl, .85 / tl, -d[2] * ty / tl], a = tw * s, ca = Math.cos(a), sa = Math.sin(a), lw = Math.sin(s * 4 + ph) * tw * .07 * L * s;
    const sd = [s0[0] * ca + n0[0] * sa, n0[1] * sa, s0[2] * ca + n0[2] * sa], n = [n0[0] * ca - s0[0] * sa, n0[1] * ca, n0[2] * ca - s0[2] * sa];
    const p = [b[0] + d[0] * o + s0[0] * lw, b[1] + y, b[2] + d[2] * o + s0[2] * lw];
    const w = W * Math.pow(Math.sin(Math.PI * (.06 + .94 * s)), pw || .55), r1 = Math.sin(s * 9 + ph) * .22 * w, r2 = Math.sin(s * 11 + ph * 1.7 + 2) * .22 * w, cr = -cup * w;
    m.vx(p[0] - sd[0] * w + n[0] * r1, p[1] - sd[1] * w + n[1] * r1, p[2] - sd[2] * w + n[2] * r1, n[0], n[1], n[2], -1, s, s, mat);
    m.vx(p[0] + n[0] * cr, p[1] + n[1] * cr, p[2] + n[2] * cr, n[0], n[1], n[2], 0, s, s, mat);
    m.vx(p[0] + sd[0] * w + n[0] * r2, p[1] + sd[1] * w + n[1] * r2, p[2] + sd[2] * w + n[2] * r2, n[0], n[1], n[2], 1, s, s, mat);
    if (k) { const a = v0 + (k - 1) * 3; m.quad(a, a + 1, a + 4, a + 3); m.quad(a + 1, a + 2, a + 5, a + 4); }
  }
}
function ico(n) {
  const t = (1 + Math.sqrt(5)) / 2; let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nz);
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < n; s++) {
    const C = {}, F2 = [], mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (C[k] === undefined) { C[k] = V.length; V.push(nz(add(V[a], V[b]))); } return C[k]; };
    for (const f of F) { const a = mid(f[0], f[1]), b = mid(f[1], f[2]), c = mid(f[2], f[0]); F2.push([f[0], a, c], [f[1], b, a], [f[2], c, b], [a, b, c]); } F = F2;
  }
  return { V, F };
}

// ---- flora
function kelpMesh(H, r) {
  const m = new Mesh(), a = r() * 6, b = r() * 6, P = [], R = [];
  const sx = y => .4 * Math.sin(y * .21 + a) * Math.min(1, y / 6), sz = y => .4 * Math.cos(y * .17 + b) * Math.min(1, y / 6);
  for (let y = 0; y <= H + .01; y += 1.3) { P.push([sx(y), y, sz(y)]); R.push(.13 - .07 * y / H); }
  tube(m, P, R, 5, () => [0, -1, 0, 7]);
  const nb = Math.floor(H / .42);
  for (let k = 0; k < nb; k++) {
    const y = .8 + (H - .8) * (k + r() * .7) / nb, ph = k * 2.39996 + r() * .6, f = y / H;
    blade(m, [sx(y), y, sz(y)], [Math.cos(ph), 0, Math.sin(ph)], (2.3 + 1.9 * Math.pow(Math.sin(Math.PI * Math.min(1, f * 1.1)), .7)) * (.8 + .45 * r()), .2 + .12 * r(), .5 + .6 * r(), .75 + .55 * r(), 6, 7, r() * 6, .5, (r() - .5) * 3.2, .14);
  }
  m.nrm(0, 0); return m;
}
function rosette(r) {
  const m = new Mesh(), n = 9;
  for (let k = 0; k < n; k++) { const a = k / n * 6.283 + r() * .5, t = k % 3; blade(m, [Math.cos(a) * .08, 0, Math.sin(a) * .08], [Math.cos(a), 0, Math.sin(a)], 1.5 + .5 * r() + t * .2, .3 + .1 * r(), 1.9 - t * .5 + .3 * r(), .9 + .3 * r(), 6, 5, r() * 6, .8); }
  m.nrm(0, 0); return m;
}
function fan(r) {
  const m = new Mesh(), n = 9;
  for (let k = 0; k < n; k++) { const f = k / (n - 1) - .5, a = f * 2.5, d = [Math.sin(a), 0, .15 * Math.cos(a * 3)], l = Math.hypot(d[0], d[2]); blade(m, [d[0] * .1, 0, 0], [d[0] / l, 0, d[2] / l], 2.1 - Math.abs(f) * 1.1 + .3 * r(), .26, 2.4 - Math.abs(f) * 3.2, .5 + .5 * Math.abs(f), 6, 5, r() * 6, .7); }
  m.nrm(0, 0); return m;
}
function tuft(r) {
  const m = new Mesh();
  for (let k = 0; k < 10; k++) { const a = r() * 6.283, q = r() * .32; blade(m, [Math.cos(a) * q, 0, Math.sin(a) * q], [Math.cos(a + .5), 0, Math.sin(a + .5)], .28 + .34 * r(), .035 + .025 * r(), 1.5 + r(), .7 + .8 * r(), 2, 6, r() * 6, .45, (r() - .5) * 2, .2); }
  m.nrm(0, 0); return m;
}
function sailMesh(r) {
  const m = new Mesh();
  for (let k = 0; k < 7; k++) { const x = -4 + k * 1.33 + (r() - .5) * .4; blade(m, [x, 10.45 - .03 * x, 7.72], [.06 * (r() - .5), 0, .2], 3 + 4 * r(), 2.6 + r(), -1, .12, 6, 10, r() * 6, .22, (r() - .5) * 1.2, .1); }
  for (let k = 0; k < 4; k++) { const x = -3.2 + k * 1.5 + (r() - .5) * .4; blade(m, [x, 8.65 + .14 * x, -13.95], [.06 * (r() - .5), 0, -.2], 2.5 + 3 * r(), 2.4 + r(), -1, .12, 6, 10, r() * 6, .22, (r() - .5) * 1.2, .1); }
  m.nrm(0, 0); return m;
}
// ---- reef
function sponge(r) {
  const m = new Mesh();
  for (const [ox, oz, sc] of [[0, 0, 1], [.78, .3, .62], [-.38, .72, .45]]) {
    const v0 = m.v.length / 10, ph = r() * 6, nr = 7 + (r() * 4 | 0), hs = sc * (.9 + .35 * r());
    lathe(m, [[.2, 0], [.36, .06], [.47, .2], [.54, .42], [.57, .64], [.55, .84], [.5, .97], [.44, 1.02], [.37, 1], [.33, .9], [.31, .6], [.26, .3], [.1, .22], [.01, .2]], 28,
      (a, j) => j < 7 ? 1 + .055 * Math.cos(a * nr + ph) * Math.sin(Math.PI * j / 7) : 1, (a, j) => [a / 6.283, j / 13, j > 7 ? 1 : 0, 3]);
    for (let k = v0 * 10; k < m.v.length; k += 10) { m.v[k] = m.v[k] * sc + ox; m.v[k + 1] *= hs; m.v[k + 2] = m.v[k + 2] * sc + oz; }
  }
  m.nrm(0, 0); return m;
}
function staghorn(r) {
  const m = new Mesh();
  const br = (p, d, len, rad, dep) => {
    const P = [p], R = [rad]; let q = p, dd = d;
    for (let k = 1; k <= 3; k++) { dd = nz([dd[0] + (r() - .5) * .5, dd[1] + .22, dd[2] + (r() - .5) * .5]); q = add(q, mul(dd, len / 3)); P.push(q); R.push(rad * (1 - .42 * k / 3)); }
    tube(m, P, R, 5, k => [0, (4 - dep + k / 3) / 4, 0, 4], dep <= 1);
    if (dep > 1) { const nc = 2 + (r() < .5 ? 1 : 0); for (let i = 0; i < nc; i++) { const a = r() * 6.28, sp = .5 + .5 * r(); br(q, nz([dd[0] + Math.cos(a) * sp, dd[1] + .15, dd[2] + Math.sin(a) * sp]), len * .74, rad * .58, dep - 1); } }
  };
  for (let i = 0; i < 2; i++) { const a = i * 3.1 + r(); br([Math.cos(a) * .08, -.05, Math.sin(a) * .08], nz([Math.cos(a) * .45, 1, Math.sin(a) * .45]), .5, .1, 4); }
  m.nrm(0, 0); return m;
}
function tableCoral(r) {
  const m = new Mesh();
  lathe(m, [[.13, -.05], [.1, .3], [.09, .95]], 8, () => 1, () => [0, .1, 0, 4]);
  for (const [R, h] of [[1, .5], [.72, .78], [.46, 1]]) {
    const ph = r() * 6, v0 = m.v.length / 10, ox = (r() - .5) * .16, oz = (r() - .5) * .16;
    lathe(m, [[.1, h - .2], [.3, h - .07], [.75, h - .02], [1, h + .03], [.97, h + .08], [.6, h + .07], [.02, h + .05]].map(q => [q[0] * R, q[1]]), 30, (a, j) => j > 0 ? 1 + .09 * Math.sin(a * 5 + ph) + .045 * Math.sin(a * 13 + ph * 2) : 1, (a, j) => [0, j > 2 ? .7 : .25, 0, 4]);
    for (let k = v0 * 10; k < m.v.length; k += 10) { m.v[k] += ox; m.v[k + 2] += oz; }
  }
  m.nrm(0, 0); return m;
}
function brain(r) {
  const { V, F } = ico(3), m = new Mesh(), s = r() * 9;
  for (const v of V) { const q = 1 + .28 * (fbm(v[0] * 1.6 + s, v[1] * 1.6, v[2] * 1.6, 2) - .5); m.vx(v[0] * q, Math.max(v[1] * q * .75, -.15), v[2] * q, 0, 1, 0, 0, .35 + .3 * v[1], 1, 4); }
  for (const f of F) m.tri(f[0], f[1], f[2]); m.nrm(0, 0); return m;
}
function boulder(seed, n, mat, sy) {
  const { V, F } = ico(n), m = new Mesh();
  for (const v of V) { const q = 1 + .8 * (fbm(v[0] * 1.2 + seed, v[1] * 1.2, v[2] * 1.2, 3) - .5) + .25 * (fbm(v[0] * 3.9, v[1] * 3.9 + seed, v[2] * 3.9, 2) - .5); m.vx(v[0] * q, v[1] * q * sy, v[2] * q * .88, 0, 1, 0, 1, .9, 0, mat); }
  for (const f of F) m.tri(f[0], f[1], f[2]); m.nrm(0, 0); return m;
}
function monolith() {
  const { V, F } = ico(3), m = new Mesh(), q = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);
  for (const v of V) { const n = 1 + .22 * (fbm(v[0] * 1.7 + 3, v[1] * 1.7, v[2] * 1.7, 3) - .5), y = q(v[1], .5); m.vx(q(v[0], .5) * .85 * n * (1 - .12 * y), y * 2.7 + v[0] * .35 * (y > 0 ? y : 0), q(v[2], .5) * .5 * n * (1 - .12 * y), 0, 1, 0, 1, 0, 0, 2); }
  for (const f of F) m.tri(f[0], f[1], f[2]); m.nrm(0, 0); return m;
}
// ---- fauna
function fishMesh() {
  const m = new Mesh(), P = [], R = [];
  for (let k = 0; k <= 8; k++) { const s = k / 8; P.push([0, 0, -.3 + .8 * s]); R.push(.012 + .125 * Math.pow(Math.sin(Math.PI * (.05 + .93 * s)), .8) * (s > .85 ? 1 - (s - .85) * 3 : 1)); }
  tube(m, P, R, 6, () => [0, 0, 0, 8], true);
  for (let k = 0; k < m.v.length; k += 10) { m.v[k] *= .4; m.v[k + 3] *= 2.5; const l = Math.hypot(m.v[k + 3], m.v[k + 4], m.v[k + 5]); m.v[k + 3] /= l; m.v[k + 4] /= l; m.v[k + 5] /= l; }
  const f = (a, b, c) => { const i = m.v.length / 10; for (const p of [a, b, c]) m.vx(0, p[0], p[1], 1, 0, 0, 0, 0, 0, 8); m.tri(i, i + 1, i + 2); };
  f([0, -.3], [.15, -.52], [0, -.43]); f([0, -.3], [0, -.43], [-.15, -.52]); f([.1, .12], [.2, -.06], [.09, -.14]); f([-.09, .1], [-.16, .0], [-.08, -.05]);
  return m;
}
function mantaMesh() {
  const m = new Mesh(), NU = 26, NC = 9;
  for (const top of [1, 0]) {
    const v0 = m.v.length / 10;
    for (let i = 0; i <= NU; i++)for (let j = 0; j <= NC; j++) {
      const x = i / NU * 2 - 1, u = Math.abs(x), c = j / NC, le = .62 - .56 * Math.pow(u, 1.3) - .06 * u, te = -.56 + .49 * Math.pow(u, .8);
      const th = (.115 * Math.pow(1 - u, 1.6) + .014) * Math.pow(Math.sin(Math.PI * c), .6) * (top ? 1 : .55);
      m.vx(x, (top ? th : -th) - .04 * u * u, le + (te - le) * c - .1 * u * u, 0, 1, 0, x, c, top, 9);
    }
    for (let i = 0; i < NU; i++)for (let j = 0; j < NC; j++) { const a = v0 + i * (NC + 1) + j, b = a + NC + 1; top ? m.quad(a, a + 1, b + 1, b) : m.quad(a, b, b + 1, a + 1); }
  }
  for (const s of [-1, 1]) tube(m, [[s * .15, 0, .56], [s * .17, -.03, .7], [s * .13, -.08, .8]], [.05, .04, .012], 5, () => [0, 0, 1, 9], true);
  tube(m, [[0, 0, -.5], [0, 0, -.9], [0, .01, -1.4], [0, .03, -2]], [.022, .011, .006, .002], 4, () => [0, 0, 1, 9]);
  m.nrm(0, 0); return m;
}

// ---- reef creatures (uv.w material: 11 shell, 12 turtle skin, 13 whale shark, 14 tinted skin, 15 anemone, 16 jelly)
function turtleMesh() { // forward +z; uv.y = flipper weight
  const m = new Mesh(), NA = 20, NR = 6;
  for (const top of [1, 0]) {
    const v0 = m.v.length / 10;
    for (let j = 0; j <= NR; j++)for (let k = 0; k < NA; k++) { const r = j / NR, a = k / NA * 6.2832, e = Math.sqrt(Math.max(0, 1 - r * r)), sn = Math.sin(a); m.vx(Math.cos(a) * r * .36, top ? .2 * Math.pow(e, .7) : -.05 * Math.pow(e, .5), sn * r * .5 * (sn > 0 ? .95 : 1.05), 0, 1, 0, 0, 0, top, 11); }
    for (let j = 0; j < NR; j++)for (let k = 0; k < NA; k++) { const a = v0 + j * NA + k, b = v0 + j * NA + (k + 1) % NA; m.quad(a, a + NA, b + NA, b); }
  }
  tube(m, [[0, .02, .4], [0, .04, .55], [0, .05, .66]], [.075, .08, .06], 7, () => [0, 0, 0, 12], true);
  const fl = (s, P, W, x0, x1) => { const b = m.v.length / 10; P.forEach((p, k) => { const d = nz(sub(P[Math.min(k + 1, P.length - 1)], P[Math.max(k - 1, 0)])), o = [-d[2] * W[k], 0, d[0] * W[k]]; for (const q of [add(p, o), sub(p, o)]) m.vx(s * q[0], q[1], q[2], 0, 1, 0, 0, cl((q[0] - x0) / (x1 - x0), 0, 1), 0, 12); if (k) m.quad(b + k * 2 - 2, b + k * 2 - 1, b + k * 2 + 1, b + k * 2); }); };
  for (const s of [-1, 1]) { fl(s, [[.26, 0, .26], [.6, -.02, .22], [.95, -.04, .04]], [.1, .09, .025], .28, .95); fl(s, [[.22, -.01, -.36], [.36, -.02, -.46], [.48, -.03, -.52]], [.08, .06, .025], .24, .48); }
  m.nrm(0, 0); return m;
}
function jellyMesh(r) { // bell (uv.z 0) + tentacles and oral arms (uv.z 1, uv.y along, uv.x phase)
  const m = new Mesh();
  lathe(m, [[0, .4], [.2, .38], [.34, .32], [.45, .21], [.51, .09], [.53, 0], [.49, -.03]], 24, (a, j) => 1 + (j > 3 ? .05 * Math.cos(a * 8) : 0), a => [a, 0, 0, 16]);
  for (let k = 0; k < 16; k++) { const a = k / 16 * 6.2832 + r() * .2, L = 1.3 + 1.2 * r(), P = []; for (let j = 0; j <= 7; j++) { const t = j / 7; P.push([Math.cos(a) * .47 * (1 - t * .15), -.03 - L * t, Math.sin(a) * .47 * (1 - t * .15)]); } tube(m, P, .012, 3, j => [k * 1.3, j / 7, 1, 16]); }
  for (let k = 0; k < 4; k++) { const a = k / 4 * 6.2832 + .4, L = .9 + .3 * r(), P = [], R = []; for (let j = 0; j <= 8; j++) { const t = j / 8; P.push([Math.cos(a) * .08 * (1 + t) + Math.sin(t * 9 + k) * .04, .05 - L * t, Math.sin(a) * .08 * (1 + t) + Math.cos(t * 9 + k) * .04]); R.push(.05 * (1 - t * .6)); } tube(m, P, R, 4, j => [k * 2.1 + .5, j / 8, 1, 16]); }
  m.nrm(0, 0); return m;
}
function whaleSharkMesh() { // forward +z, ~1 long
  const m = new Mesh(), P = [], R = [];
  for (let k = 0; k <= 12; k++) { const s = k / 12; P.push([0, .015 * Math.sin(s * 3), -.48 + .98 * s]); R.push(.015 + .11 * Math.pow(Math.sin(Math.PI * (.06 + .9 * s)), .7)); }
  tube(m, P, R, 10, () => [0, 0, 0, 13], true);
  for (let k = 0; k < m.v.length; k += 10) { const z = m.v[k + 2]; m.v[k] *= 1.15 + .45 * ss(.1, .5, z); m.v[k + 1] *= .82 - .12 * ss(.2, .5, z); }
  const f = (a, b, c) => { const i = m.v.length / 10; for (const p of [a, b, c]) m.vx(p[0], p[1], p[2], 1, 0, 0, 0, 0, 0, 13); m.tri(i, i + 1, i + 2); };
  f([0, .03, -.45], [0, .26, -.66], [0, .05, -.53]); f([0, 0, -.45], [0, -.15, -.6], [0, -.02, -.54]);
  f([0, .09, .05], [0, .24, -.1], [0, .08, -.17]); f([0, .06, -.28], [0, .12, -.35], [0, .04, -.37]);
  for (const s of [-1, 1]) f([s * .12, -.05, .2], [s * .38, -.12, .02], [s * .12, -.06, .04]);
  m.nrm(0, 0); return m;
}
function eelMesh() { // grows along +y out of the rock (y < 0 stays hidden); uv.z flex
  const m = new Mesh(), P = [], R = [];
  for (let k = 0; k <= 14; k++) { const s = k / 14; P.push([0, -1.2 + 2.2 * s, .02 * Math.sin(s * 9)]); R.push(s > .93 ? .065 : .08 + .025 * Math.sin(s * 3)); }
  tube(m, P, R, 7, k => { const y = -1.2 + 2.2 * k / 14; return [0, k / 14, Math.pow(Math.max(0, (y + .3) / 1.3), 1.4), 14]; }, true);
  for (let k = 0; k < m.v.length; k += 10) if (m.v[k + 1] > .7) m.v[k + 2] *= 1.3;
  m.nrm(0, 0); return m;
}
function octopusMesh() { // mantle + 8 curling arms spread on the ground
  const m = new Mesh(), I = ico(2);
  for (const p of I.V) m.vx(p[0] * .17, .2 + p[1] * .2 + Math.max(p[1], 0) * .06, -.12 + p[2] * .22 - Math.max(p[1], 0) * .12, p[0], p[1], p[2], 0, 0, .04, 14);
  for (const f of I.F) m.tri(f[0], f[1], f[2]);
  for (let k = 0; k < 8; k++) {
    const a0 = k / 8 * 6.2832 + .2, cv = (k & 1 ? 1 : -1) * (.6 + .4 * Math.sin(k * 2.3)), P = [], R = [];
    for (let j = 0; j <= 12; j++) { const t = j / 12, a = a0 + cv * t * t * 1.6, d = .07 + .62 * t - Math.max(0, t - .75) * .4; P.push([Math.cos(a) * d, .06 + .05 * Math.sin(t * 3.14) + Math.max(0, t - .8) * .5, Math.sin(a) * d]); R.push(.055 * (1 - t) + .008); }
    tube(m, P, R, 5, j => [k * 1.7, j / 12, Math.pow(j / 12, 1.2), 14]);
  }
  m.nrm(0, 0); return m;
}
function crabMesh() {
  const m = new Mesh(), I = ico(1);
  for (const p of I.V) m.vx(p[0] * .5, .1 + p[1] * .16, p[2] * .36, p[0], p[1], p[2], 0, 0, 0, 14);
  for (const f of I.F) m.tri(f[0], f[1], f[2]);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) { const z = .2 - k * .14; tube(m, [[s * .4, .08, z], [s * .72, .22, z + .02 * s], [s * .95, -.05, z - .05]], [.045, .035, .015], 4, j => [k * 1.1 + (s > 0 ? 0 : 3.1), j / 2, j / 2, 14]); }
    tube(m, [[s * .3, .1, .3], [s * .45, .14, .52], [s * .32, .12, .7]], [.06, .07, .1], 5, j => [s * 2, j / 2, j * .2, 14], true);
  }
  m.nrm(0, 0); return m;
}
function starfishMesh() { // coral material (uv.y: tip brightening)
  const m = new Mesh(), c = m.vx(0, .12, 0, 0, 1, 0, 1, 0, 0, 4), N = 10, rim = [];
  for (let k = 0; k < N; k++) { const a = k / N * 6.2832, r = k & 1 ? .38 : 1; rim.push(m.vx(Math.cos(a) * r, k & 1 ? .07 : .02, Math.sin(a) * r, 0, 1, 0, 1, r, 0, 4)); }
  for (let k = 0; k < N; k++) m.tri(c, rim[(k + 1) % N], rim[k]);
  const b = m.vx(0, 0, 0, 0, -1, 0, 1, 0, 0, 4); for (let k = 0; k < N; k++) m.tri(b, rim[k], rim[(k + 1) % N]);
  m.nrm(0, 0); return m;
}
function anemoneMesh(r) { // short column + a crown of glowing-tipped tentacles (uv.y: base 0 -> tip 1)
  const m = new Mesh();
  lathe(m, [[0, .14], [.16, .14], [.15, .1], [.13, .02], [.15, 0]], 10, () => 1, () => [0, .1, 0, 15]);
  for (let k = 0; k < 36; k++) { const a = k * 2.39996, rr = .03 + .13 * Math.sqrt((k + .5) / 36), L = .22 + .14 * r(), P = []; for (let j = 0; j <= 5; j++) { const t = j / 5; P.push([Math.cos(a) * (rr + t * L * .55), .13 + t * L * (1 - t * .3), Math.sin(a) * (rr + t * L * .55)]); } tube(m, P, [.02, .019, .017, .014, .01, .006], 3, j => [0, .2 + .8 * j / 5, 0, 15], true); }
  m.nrm(0, 0); return m;
}

// ---- thick plank shell on a grid, with holes
function shell(m, ni, nj, pf, hole, th, uvf, hint) {
  const P = [], N = [], at = (i, j) => P[cl(i, 0, ni - 1) * nj + cl(j, 0, nj - 1)];
  for (let i = 0; i < ni; i++)for (let j = 0; j < nj; j++)P.push(pf(i, j));
  for (let i = 0; i < ni; i++)for (let j = 0; j < nj; j++) { let n = nz(crs(sub(at(i + 1, j), at(i - 1, j)), sub(at(i, j + 1), at(i, j - 1)))); if (dot(n, hint(P[i * nj + j])) < 0) n = mul(n, -1); N.push(n); }
  const v0 = m.v.length / 10;
  for (let k = 0; k < P.length; k++) {
    const p = P[k], n = N[k], u = uvf(k / nj | 0, k % nj, p);
    m.vx(p[0], p[1], p[2], n[0], n[1], n[2], u[0], u[1], 0, 1);
    m.vx(p[0] - n[0] * th, p[1] - n[1] * th, p[2] - n[2] * th, -n[0], -n[1], -n[2], u[0], u[1], 0, 1);
  }
  const ex = (i, j) => i >= 0 && j >= 0 && i < ni - 1 && j < nj - 1 && !hole(i, j);
  for (let i = 0; i < ni - 1; i++)for (let j = 0; j < nj - 1; j++) {
    if (!ex(i, j)) continue;
    const a = v0 + 2 * (i * nj + j), b = v0 + 2 * ((i + 1) * nj + j), c = v0 + 2 * ((i + 1) * nj + j + 1), d = v0 + 2 * (i * nj + j + 1);
    m.quad(a, b, c, d); m.quad(a + 1, d + 1, c + 1, b + 1);
    for (const e of [[a, b, i, j - 1], [b, c, i + 1, j], [c, d, i, j + 1], [d, a, i - 1, j]]) if (!ex(e[2], e[3])) {
      const pa = m.p(e[0]), pb = m.p(e[1]), pc = m.p(e[1] + 1), pd = m.p(e[0] + 1), n = nz(crs(sub(pb, pa), sub(pd, pa))), q = m.v.length / 10;
      for (const p of [pa, pb, pc, pd]) m.vx(p[0], p[1], p[2], n[0], n[1], n[2], p[2] * 1.3, .5, 1, 1);
      m.quad(q, q + 1, q + 2, q + 3);
    }
  }
}
function shipMesh() {
  const m = new Mesh(), L = 38, B = 4.7, Dp = 6.2, NS = 80, NJ = 14, nq = (a, b, c) => fbm(a, b, c, 2) - .5;
  const hb = t => B * Math.pow(Math.sin(Math.PI * Math.min(1, .07 + .93 * t)), .55);
  const yk = t => -Dp + Dp * .86 * Math.pow(t, 7) + .9 * Math.pow(1 - t, 3);
  const ys = t => 1.9 * (1 - ss(.18, .34, t)) + 1.6 * Math.pow(Math.abs(t - .5) / .5, 2.2);
  const HP = (t, v, s, ins) => [s * (hb(t) - ins) * Math.pow(Math.sin(v * Math.PI / 2), .6), yk(t) + ins * .6 + (ys(t) - yk(t) - ins * .6) * Math.pow(v, 1.25), (t - .5) * L];
  const tt = i => i / NS;
  // hull sides: ragged breaches, missing planks, eroded gunwale
  for (const s of [-1, 1]) shell(m, NS + 1, NJ + 1, (i, j) => HP(tt(i), j / NJ, s, 0),
    (i, j) => {
      const t = tt(i), v = j / NJ, n = nq(t * 30, v * 9, s * 3 + 7), a = (t - .34) / .16, b = (v - .5) / .34, c = (t - .74) / .07, d = (v - .7) / .24;
      return (s > 0 && a * a + b * b < 1 + 1.6 * n) || (s < 0 && c * c + d * d < 1 + 1.6 * n) || (v > .22 && hsh((i >> 2) + j * 3, j, s + 5) < .07) || (v > .84 && nq(t * 26, s * 5, 1.7) > .08);
    }, .15, (i, j, p) => [p[2] * 1.3, j * 2, 0, 1], p => [s, -.25, 0]);
  // deck
  const dk = t => ys(t) - 1.05, dv = t => Math.pow((dk(t) - yk(t)) / (ys(t) - yk(t)), .8), dw = t => hb(t) * Math.pow(Math.sin(dv(t) * Math.PI / 2), .6) - .1;
  shell(m, NS - 1, 11, (i, j) => { const t = tt(i + 1); return [(j / 10 * 2 - 1) * dw(t), dk(t), (t - .5) * L]; },
    (i, j) => { const t = tt(i + 1), x = j / 5 - 1, n = nq(t * 28, x * 4, 3), a = (t - .42) / .13, b = x / .62; return a * a + b * b < 1 + 1.5 * n || hsh(i >> 3, j, 12) < .09 || (t > .58 && t < .84 && n > .1); }, .12, (i, j, p) => [p[2] * 1.3, p[0] * 2.4, 0, 1], () => [0, 1, 0]);
  // transom with window holes
  shell(m, 9, 8, (i, j) => { const v = j / 7; return [(i / 8 * 2 - 1) * hb(0) * Math.pow(Math.sin(v * Math.PI / 2), .6), yk(0) + (ys(0) - yk(0)) * Math.pow(v, 1.25), -L / 2]; },
    (i, j) => j === 5 && (i === 1 || i === 3 || i === 4 || i === 6), .15, (i, j, p) => [p[0] * 1.3, j * 2, 0, 1], () => [0, 0, -1]);
  // ribs, deck beams
  for (let i = 4; i < NS - 2; i += 4) { const P = []; for (let k = -10; k <= 10; k++)P.push(HP(tt(i), Math.abs(k) / 10 * .97, Math.sign(k) || 1, .22)); beam(m, P, .2, .26, [0, 0, 1], 1, i * .37); }
  for (let i = 6; i < NS - 4; i += 6) { const t = tt(i), w = dw(t); beam(m, [[-w, dk(t) - .22, (t - .5) * L], [w, dk(t) - .22, (t - .5) * L]], .2, .22, [0, 1, 0], 1, i * .7); }
  // keel + stem, stern post, rudder
  { const P = []; for (let i = 0; i <= NS; i += 2)P.push([0, yk(tt(i)) - .12, (tt(i) - .5) * L + (i === NS ? .15 : 0)]); P.push([0, ys(1) + 1.4, L / 2 + .5]); beam(m, P, .34, .5, [1, 0, 0], 1, 1.3); }
  beam(m, [[0, yk(0) - .2, -L / 2 - .15], [0, ys(0) + .6, -L / 2 - .15]], .3, .36, [1, 0, 0], 1, 2.1);
  beam(m, [[0, yk(0) + .1, -L / 2 - 1.1], [.5, yk(0) + 4.4, -L / 2 - 1.3]], .14, 1.7, [1, 0, 0], 1, 3.3);
  // broken rails
  for (const s of [-1, 1]) {
    let P = []; const flush = () => { if (P.length > 1) beam(m, P, .13, .13, [0, 1, 0], 1, 4); P = []; };
    for (let i = 0; i <= NS - 2; i += 2) { const t = tt(i); if ((s > 0 && t > .26 && t < .46) || (s < 0 && t > .64 && t < .82) || hsh(i, s, 31) < .14) { flush(); continue; } const p = HP(t, 1, s, .05); p[1] += .8; P.push(p); if (i % 4 === 0) beam(m, [[p[0], p[1] - .85, p[2]], p], .1, .1, [0, 0, 1], 1, i); }
    flush();
  }
  // masts (one snapped and fallen overboard), yards, crow's nest, bowsprit
  const mast = (P, r0, r1) => tube(m, P, P.map((_, k) => r0 + (r1 - r0) * k / (P.length - 1)), 8, k => [k * 1.5, .5, 1, 1], true);
  const zf = (.7 - .5) * L, zm = (.46 - .5) * L, zz = (.15 - .5) * L;
  mast([[0, dk(.7), zf], [.1, 8, zf + .1], [.25, 17.5, zf + .3]], .3, .12);
  beam(m, [[-4.6, 10.6, zf + .1], [0, 11, zf + .2], [4.6, 10.2, zf + .1]], .2, .2, [0, 1, 0], 1, 5);
  beam(m, [[-2.8, 15, zf + .25], [2.8, 15.2, zf + .25]], .14, .14, [0, 1, 0], 1, 6);
  tube(m, [[.17, 13.2, zf + .2], [.17, 13.9, zf + .2]], [.75, .85], 9, k => [k, .5, 1, 1]);
  mast([[0, dk(.46), zm], [.15, 3.2, zm], [.5, 6.8, zm - .1]], .36, .3);
  mast([[2.2, dk(.46) + .5, zm - 1.5], [7, .2, zm - 4.5], [13, -3.4, zm - 8.5]], .28, .13);
  mast([[0, dk(.15), zz], [-.6, 7, zz - .5], [-1.5, 12.5, zz - 1.1]], .24, .1);
  beam(m, [[-3.9, 8.2, zz - .6], [2.4, 9.1, zz - .6]], .15, .15, [0, 1, 0], 1, 7);
  mast([[0, ys(1) + .2, L / 2 - 1.2], [0, ys(1) + 1.75, L / 2 + 3], [0, ys(1) + 3.3, L / 2 + 7.2]], .22, .07);
  return m;
}

// ---- voxel grid helpers (terrain + sculpture)
function gs(G, x, y, z) {
  x = cl((x - G.ox) / G.cs, 0, G.nx - 1.001); y = cl((y - G.oy) / G.cs, 0, G.ny - 1.001); z = cl((z - G.oz) / G.cs, 0, G.nz - 1.001);
  const ix = x | 0, iy = y | 0, iz = z | 0, fx = x - ix, fy = y - iy, fz = z - iz, D = G.D, nx = G.nx, c = ix + iy * nx + iz * G.sxy, s = G.sxy;
  const a = D[c] + (D[c + 1] - D[c]) * fx, b = D[c + nx] + (D[c + nx + 1] - D[c + nx]) * fx, e = D[c + s] + (D[c + s + 1] - D[c + s]) * fx, f = D[c + s + nx] + (D[c + s + nx + 1] - D[c + s + nx]) * fx;
  const p = a + (b - a) * fy, q = e + (f - e) * fy; return p + (q - p) * fz;
}
function snets(G) {
  const { D, nx, ny, nz: nzz, sxy, ox, oy, oz, cs } = G, pos = [], idx = [], map = new Int32Array(nx * ny * nzz), g = new Float32Array(8);
  const CO = [0, 1, nx, nx + 1, sxy, sxy + 1, sxy + nx, sxy + nx + 1], E = [0, 1, 0, 2, 0, 4, 1, 3, 1, 5, 2, 3, 2, 6, 3, 7, 4, 5, 4, 6, 5, 7, 6, 7];
  for (let z = 0; z < nzz - 1; z++)for (let y = 0; y < ny - 1; y++)for (let x = 0; x < nx - 1; x++) {
    const c = x + y * nx + z * sxy; let mask = 0;
    for (let i = 0; i < 8; i++) { const v = D[c + CO[i]]; g[i] = v; if (v > 0) mask |= 1 << i; }
    if (mask === 0 || mask === 255) continue;
    let px = 0, py = 0, pz = 0, n = 0;
    for (let e = 0; e < 24; e += 2) {
      const a = E[e], b = E[e + 1]; if (((mask >> a) & 1) === ((mask >> b) & 1)) continue;
      const t = g[a] / (g[a] - g[b]);
      px += (a & 1) + t * ((b & 1) - (a & 1)); py += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1)); pz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1)); n++;
    }
    map[c] = pos.length / 3; pos.push(ox + (x + px / n) * cs, oy + (y + py / n) * cs, oz + (z + pz / n) * cs);
    const s0 = mask & 1;
    if (x > 0 && y > 0 && ((mask >> 4) & 1) !== s0) idx.push(map[c], map[c - 1], map[c - 1 - nx], map[c], map[c - 1 - nx], map[c - nx]);
    if (x > 0 && z > 0 && ((mask >> 2) & 1) !== s0) idx.push(map[c], map[c - 1], map[c - 1 - sxy], map[c], map[c - 1 - sxy], map[c - sxy]);
    if (y > 0 && z > 0 && ((mask >> 1) & 1) !== s0) idx.push(map[c], map[c - nx], map[c - nx - sxy], map[c], map[c - nx - sxy], map[c - sxy]);
  }
  return { pos, idx };
}
// grid -> lit mesh: gradient normals, baked AO, consistent winding. uvf(x,y,z,ny)->[uv.y]
function gridMesh(G, mat, aoR, uvf) {
  const { pos, idx } = snets(G), n = pos.length / 3, v = new Float32Array(n * 10), e = G.cs * .9;
  for (let k = 0; k < n; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
    let gx = gs(G, x - e, y, z) - gs(G, x + e, y, z), gy = gs(G, x, y - e, z) - gs(G, x, y + e, z), gz = gs(G, x, y, z - e) - gs(G, x, y, z + e);
    const gl = Math.hypot(gx, gy, gz) || 1, gm = gl / (2 * e); gx /= gl; gy /= gl; gz /= gl;
    let oc = 0; for (const r of aoR) oc += cl(1 + gs(G, x + gx * r, y + gy * r, z + gz * r) / (gm * r), 0, 1);
    const o = k * 10; v[o] = x; v[o + 1] = y; v[o + 2] = z; v[o + 3] = gx; v[o + 4] = gy; v[o + 5] = gz;
    v[o + 6] = cl(1.08 - 1.1 * oc / aoR.length, .2, 1); v[o + 7] = uvf ? uvf(x, y, z, gy) : 0; v[o + 9] = mat;
  }
  const ix = new Uint32Array(idx);
  for (let k = 0; k < ix.length; k += 3) {
    const a = ix[k] * 10, b = ix[k + 1] * 10, c = ix[k + 2] * 10;
    const e1x = v[b] - v[a], e1y = v[b + 1] - v[a + 1], e1z = v[b + 2] - v[a + 2], e2x = v[c] - v[a], e2y = v[c + 1] - v[a + 1], e2z = v[c + 2] - v[a + 2];
    if ((e1y * e2z - e1z * e2y) * v[a + 3] + (e1z * e2x - e1x * e2z) * v[a + 4] + (e1x * e2y - e1y * e2x) * v[a + 5] < 0) { ix[k + 1] = c / 10; ix[k + 2] = b / 10; }
  }
  return { v, i: ix };
}

// ---- stone whale fluke (SDF -> surface nets)
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; };
function sdRC(px, py, pz, ax, ay, az, bx, by, bz, r1, r2) {
  const bax = bx - ax, bay = by - ay, baz = bz - az, l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - ax, pay = py - ay, paz = pz - az, y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y, x2 = qx * qx + qy * qy + qz * qz, y2 = y * y * l2, z2 = z * z * l2, k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
function flukeSDF(x, y, z) {
  const rxz = Math.hypot(x, z);
  let d = Math.max(rxz - 7.1, Math.abs(y - .6) - .75) - .12;
  d = Math.min(d, Math.max(rxz - 5.1, Math.abs(y - 1.5) - .9) - .14);
  const X = x / .7;
  let p = sdRC(X, y, z, 0, 1.5, -.7, 0, 7, .2, 3, 2.1);
  p = smin(p, sdRC(X, y, z, 0, 7, .2, 0, 12.5, 1.4, 2.1, 1.3), 1.2);
  p = smin(p, sdRC(X, y, z, 0, 12.5, 1.4, 0, 17, 2.2, 1.3, .9), 1);
  d = smin(d, p * .7, 1.4);
  if (y > 13) {
    const ax = Math.abs(x); let f = 1e9;
    for (let k = 0; k <= 10; k++) {
      const s = k / 10, cx = .3 + 9.9 * s, cy = 16.9 + 4.9 * Math.pow(s, 1.3), cz = 2.2 + 1.9 * s * s;
      const tx = 9.9, ty = 6.4 * Math.pow(s + .03, .3), tl = Math.hypot(tx, ty), ux = tx / tl, uy = ty / tl;
      const ch = (3.5 * Math.pow(1 - s, .7) + .3) * .5, th = .6 * Math.pow(1 - s, .7) + .11, al = 1.3;
      const dx = ax - cx, dy = y - cy, dz = z - cz, la = dx * ux + dy * uy, lc = -dx * uy + dy * ux;
      f = smin(f, (Math.hypot(la / al, (lc - ch * .32) / ch, dz / th) - 1) * Math.min(ch, th), .5);
    }
    d = smin(d, f, .9);
    d = Math.max(d, 1.05 - Math.hypot(x * 1.5, y - 20.1, (z - 2.3) * .5));
  }
  return d + .1 * (fbm(x * .9, y * .9, z * .9, 2) - .5);
}
function sculptMesh() {
  const cs = .23, nx = 106, ny = 108, nzz = 78, G = { D: new Float32Array(nx * ny * nzz), nx, ny, nz: nzz, sxy: nx * ny, ox: -12.1, oy: -.6, oz: -8.4, cs };
  for (let z = 0, c = 0; z < nzz; z++)for (let y = 0; y < ny; y++)for (let x = 0; x < nx; x++, c++)G.D[c] = -flukeSDF(G.ox + x * cs, G.oy + y * cs, G.oz + z * cs);
  return gridMesh(G, 2, [.5, 1.2, 2.5]);
}
