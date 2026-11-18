// ---------- procedural world generation (runs once at load; allocations are fine here)
const { sin, cos, sqrt, floor, abs, min, max, PI, pow, exp, atan2, ceil, imul, round } = Math, TAU = PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x, mix = (a, b, t) => a + (b - a) * t;
const sst = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x) };
function RNG(s) { return () => { s = s + 0x6D2B79F5 | 0; let t = imul(s ^ s >>> 15, 1 | s); t = t + imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const h3 = (x, y, z) => { let h = imul(x, 374761393) + imul(y, 668265263) + imul(z, 1440662683) | 0; h = imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296 };
function vn(x, y, z) {
  const X = floor(x), Y = floor(y), Z = floor(z); let u = x - X, v = y - Y, w = z - Z;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); w = w * w * (3 - 2 * w);
  const a = h3(X, Y, Z), b = h3(X + 1, Y, Z), c = h3(X, Y + 1, Z), d = h3(X + 1, Y + 1, Z), e = h3(X, Y, Z + 1), f = h3(X + 1, Y, Z + 1), g = h3(X, Y + 1, Z + 1), h = h3(X + 1, Y + 1, Z + 1);
  return mix(mix(mix(a, b, u), mix(c, d, u), v), mix(mix(e, f, u), mix(g, h, u), v), w);
}
function fbm(x, y, z, o) { let s = 0, a = .5; for (let i = 0; i < o; i++) { s += a * vn(x, y, z); x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; z = z * 2.03 + 9.2; a *= .5 } return s / (1 - a * 2) }
const nrm = v => { const l = sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; return v };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ---------- noise textures
function genN2(S) { // RGBA8: fbm, d/dx, d/dy, worley
  const h = new Float32Array(S * S), o = new Uint8Array(S * S * 4);
  const gr = (xi, yi, s, dx, dy) => { const a = h3(xi, yi, s) * TAU; return cos(a) * dx + sin(a) * dy };
  const q = (x, y, P, s) => { const X = floor(x), Y = floor(y), fx = x - X, fy = y - Y, u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10), x0 = X % P, x1 = (x0 + 1) % P, y0 = Y % P, y1 = (y0 + 1) % P; return mix(mix(gr(x0, y0, s, fx, fy), gr(x1, y0, s, fx - 1, fy), u), mix(gr(x0, y1, s, fx, fy - 1), gr(x1, y1, s, fx - 1, fy - 1), u), v) };
  let m1 = 0, m2 = 0, ga = 0;
  for (let y = 0; y < S; y++)for (let x = 0; x < S; x++) { let f = 0, a = .5, P = 4; for (let k = 0; k < 5; k++) { f += a * q(x / S * P, y / S * P, P, k * 17 + 3); a *= .55; P *= 2 } h[y * S + x] = f; m1 += f; m2 += f * f }
  m1 /= S * S; m2 = sqrt(m2 / (S * S) - m1 * m1); for (let i = 0; i < S * S; i++)h[i] = .512 + (h[i] - m1) / m2 * .118;
  for (let y = 0; y < S; y++)for (let x = 0; x < S; x++)ga += abs(h[y * S + (x + 1) % S] - h[y * S + (x + S - 1) % S]) * .5;
  const KG = 9.5 / (ga / (S * S));
  const C = 16, fx = new Float32Array(C * C * 2); for (let i = 0; i < C * C; i++) { fx[i * 2] = h3(i, 5, 1); fx[i * 2 + 1] = h3(i, 9, 2) }
  for (let y = 0; y < S; y++)for (let x = 0; x < S; x++) {
    const i = y * S + x, gx = (h[y * S + (x + 1) % S] - h[y * S + (x + S - 1) % S]) * .5, gy = (h[((y + 1) % S) * S + x] - h[((y + S - 1) % S) * S + x]) * .5;
    const px = x / S * C, py = y / S * C, cx = floor(px), cy = floor(py); let d = 9, d2 = 9;
    for (let b = -1; b < 2; b++)for (let a = -1; a < 2; a++) { const k = ((cy + b + C) % C) * C + (cx + a + C) % C, ex = cx + a + fx[k * 2] - px, ey = cy + b + fx[k * 2 + 1] - py, q = ex * ex + ey * ey; if (q < d) { d2 = d; d = q } else if (q < d2) d2 = q }
    o[i * 4] = clamp(h[i] * 255, 0, 255); o[i * 4 + 1] = clamp(128 + gx * KG, 0, 255); o[i * 4 + 2] = clamp(128 + gy * KG, 0, 255); o[i * 4 + 3] = clamp((sqrt(d2) - sqrt(d)) * 1.7 * 255, 0, 255);
  }
  const mips = [o]; let s = S, p = o;
  while (s > 1) { const n = s >> 1, m = new Uint8Array(n * n * 4); for (let y = 0; y < n; y++)for (let x = 0; x < n; x++)for (let c = 0; c < 4; c++) { const i = (y * 2 * s + x * 2) * 4 + c; m[(y * n + x) * 4 + c] = (p[i] + p[i + 4] + p[i + s * 4] + p[i + s * 4 + 4] + 2) >> 2 } mips.push(m); p = m; s = n }
  return mips;
}
function genN3(S) { // RGBA8 tileable: billow, erosion worley, fbm, fine worley
  const o = new Uint8Array(S * S * S * 4);
  const lat = P => { const a = new Float32Array(P * P * P); for (let i = 0; i < a.length; i++)a[i] = h3(i, P, 7); return a }, L4 = lat(4), L8 = lat(8), L16 = lat(16), L32 = lat(32);
  const v = (L, P, x, y, z) => { const X = floor(x), Y = floor(y), Z = floor(z); let u = x - X, w = y - Y, t = z - Z; u = u * u * (3 - 2 * u); w = w * w * (3 - 2 * w); t = t * t * (3 - 2 * t); const x0 = X % P, x1 = (x0 + 1) % P, y0 = (Y % P) * P, y1 = ((Y + 1) % P) * P, z0 = (Z % P) * P * P, z1 = ((Z + 1) % P) * P * P; return mix(mix(mix(L[z0 + y0 + x0], L[z0 + y0 + x1], u), mix(L[z0 + y1 + x0], L[z0 + y1 + x1], u), w), mix(mix(L[z1 + y0 + x0], L[z1 + y0 + x1], u), mix(L[z1 + y1 + x0], L[z1 + y1 + x1], u), w), t) };
  const fp = P => { const a = new Float32Array(P * P * P * 3); for (let i = 0; i < a.length; i++)a[i] = h3(i, P, 31); return a }, F4 = fp(4), F8 = fp(8), F16 = fp(16);
  const wl = (F, P, x, y, z) => { const X = floor(x), Y = floor(y), Z = floor(z); let d = 9; for (let c = -1; c < 2; c++)for (let b = -1; b < 2; b++)for (let a = -1; a < 2; a++) { const k = (((Z + c + P) % P) * P + (Y + b + P) % P) * P + (X + a + P) % P, ex = X + a + F[k * 3] - x, ey = Y + b + F[k * 3 + 1] - y, ez = Z + c + F[k * 3 + 2] - z; d = min(d, ex * ex + ey * ey + ez * ez) } return min(1, sqrt(d)) };
  let i = 0;
  for (let z = 0; z < S; z++)for (let y = 0; y < S; y++)for (let x = 0; x < S; x++) {
    const a = x / S, b = y / S, c = z / S;
    const f = (v(L4, 4, a * 4, b * 4, c * 4) * .5 + v(L8, 8, a * 8, b * 8, c * 8) * .27 + v(L16, 16, a * 16, b * 16, c * 16) * .15 + v(L32, 32, a * 32, b * 32, c * 32) * .08);
    const w4 = wl(F4, 4, a * 4, b * 4, c * 4), w8 = wl(F8, 8, a * 8, b * 8, c * 8), w16 = wl(F16, 16, a * 16, b * 16, c * 16);
    o[i++] = clamp((f * .65 + (1 - w4) * .5 - .1) * 255, 0, 255);
    o[i++] = clamp(((1 - w8) * .65 + (1 - w16) * .35) * 255, 0, 255);
    o[i++] = clamp((v(L8, 8, a * 8, b * 8, c * 8) * .55 + v(L16, 16, a * 16, b * 16, c * 16) * .3 + v(L32, 32, a * 32, b * 32, c * 32) * .15) * 255, 0, 255);
    o[i++] = clamp((1 - w16) * 255, 0, 255);
  }
  return o;
}

// ---------- mesh builder: pos f32x3 | normal+sway snorm16x4 | (mat, ao, group, ext) u8x4
function Mesh() { this.cv = 1 << 19; this.ci = 1 << 21; this.p = new Float32Array(this.cv * 3); this.n = new Float32Array(this.cv * 4); this.a = new Uint8Array(this.cv * 4); this.i = new Uint32Array(this.ci); this.nv = 0; this.ni = 0; this.items = [] }
Mesh.prototype.v = function (x, y, z, sw, m, ao, g, e) {
  if (this.nv >= this.cv) { this.cv *= 2; const p = new Float32Array(this.cv * 3), n = new Float32Array(this.cv * 4), a = new Uint8Array(this.cv * 4); p.set(this.p); n.set(this.n); a.set(this.a); this.p = p; this.n = n; this.a = a }
  const k = this.nv; this.p[k * 3] = x; this.p[k * 3 + 1] = y; this.p[k * 3 + 2] = z; this.n[k * 4 + 3] = sw; this.a[k * 4] = m; this.a[k * 4 + 1] = ao; this.a[k * 4 + 2] = g; this.a[k * 4 + 3] = e; return this.nv++;
};
Mesh.prototype.t = function (a, b, c) { if (this.ni + 3 > this.ci) { this.ci *= 2; const i = new Uint32Array(this.ci); i.set(this.i); this.i = i } this.i[this.ni++] = a; this.i[this.ni++] = b; this.i[this.ni++] = c };
Mesh.prototype.norm = function (v0, i0) { // smooth normals from winding for verts >= v0
  const p = this.p, n = this.n, ix = this.i;
  for (let k = i0; k < this.ni; k += 3) {
    const a = ix[k] * 3, b = ix[k + 1] * 3, c = ix[k + 2] * 3, ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    for (const q of [ix[k], ix[k + 1], ix[k + 2]]) { n[q * 4] += x; n[q * 4 + 1] += y; n[q * 4 + 2] += z }
  }
  for (let k = v0; k < this.nv; k++) { const l = sqrt(n[k * 4] ** 2 + n[k * 4 + 1] ** 2 + n[k * 4 + 2] ** 2) || 1; n[k * 4] /= l; n[k * 4 + 1] /= l; n[k * 4 + 2] /= l }
};
Mesh.prototype.item = function (i0, pad, fl) { // draw item with bounding sphere
  const p = this.p; let a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9];
  for (let k = i0; k < this.ni; k++) { const q = this.i[k] * 3; for (let c = 0; c < 3; c++) { a[c] = min(a[c], p[q + c]); b[c] = max(b[c], p[q + c]) } }
  const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; let r = 0;
  for (let k = i0; k < this.ni; k++) { const q = this.i[k] * 3; r = max(r, (p[q] - c[0]) ** 2 + (p[q + 1] - c[1]) ** 2 + (p[q + 2] - c[2]) ** 2) }
  this.items.push(c[0], c[1], c[2], sqrt(r) + (pad || 0), i0, this.ni - i0, fl || 0, 0);
};
Mesh.prototype.pack = function () {
  const buf = new ArrayBuffer(this.nv * 24), f = new Float32Array(buf), s = new Int16Array(buf), u = new Uint8Array(buf);
  for (let k = 0; k < this.nv; k++) { f[k * 6] = this.p[k * 3]; f[k * 6 + 1] = this.p[k * 3 + 1]; f[k * 6 + 2] = this.p[k * 3 + 2]; for (let c = 0; c < 4; c++) { s[k * 12 + 6 + c] = round(clamp(this.n[k * 4 + c], -1, 1) * 32767); u[k * 24 + 20 + c] = this.a[k * 4 + c] } }
  return buf;
};
// generalized cylinder along P = [x,y,z,r,sway]*; cap: 1 end, 2 start, 3 both
function tube(M, P, rs, m, ao, g, radF, cap) {
  const n = P.length / 5, base = M.nv; let N = null;
  for (let i = 0; i < n; i++) {
    const a = max(i - 1, 0) * 5, b = min(i + 1, n - 1) * 5, o = i * 5, T = nrm([P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]]);
    if (!N) N = abs(T[1]) > .9 ? [1, 0, 0] : [0, 1, 0];
    const d = N[0] * T[0] + N[1] * T[1] + N[2] * T[2]; N = nrm([N[0] - T[0] * d, N[1] - T[1] * d, N[2] - T[2] * d]); const B = crs(T, N);
    for (let j = 0; j < rs; j++) { const th = j / rs * TAU, c = cos(th), s = sin(th), rr = P[o + 3] * (radF ? radF(th, i / (n - 1)) : 1); M.v(P[o] + (N[0] * c + B[0] * s) * rr, P[o + 1] + (N[1] * c + B[1] * s) * rr, P[o + 2] + (N[2] * c + B[2] * s) * rr, P[o + 4], m, ao, g, clamp(P[o + 3] * 20, 0, 255)) }
    if (i == n - 1 && cap & 1) M.v(P[o] + T[0] * P[o + 3] * .7, P[o + 1] + T[1] * P[o + 3] * .7, P[o + 2] + T[2] * P[o + 3] * .7, P[o + 4], m, ao, g, 0);
    if (i == 0 && cap & 2) M.v(P[o] - T[0] * P[o + 3] * .7, P[o + 1] - T[1] * P[o + 3] * .7, P[o + 2] - T[2] * P[o + 3] * .7, P[o + 4], m, ao, g, 0);
  }
  const off = cap & 2 ? 1 : 0, R = i => base + i * rs + (i > 0 ? off : 0);
  for (let i = 0; i < n - 1; i++)for (let j = 0; j < rs; j++) { const a = R(i) + j, b = R(i) + (j + 1) % rs, c = R(i + 1) + j, d = R(i + 1) + (j + 1) % rs; M.t(a, b, c); M.t(b, d, c) }
  if (cap & 1) { const tp = R(n - 1) + rs; for (let j = 0; j < rs; j++)M.t(R(n - 1) + j, R(n - 1) + (j + 1) % rs, tp) }
  if (cap & 2) { const tp = base + rs; for (let j = 0; j < rs; j++)M.t(base + (j + 1) % rs, base + j, tp) }
}
// instance buckets -> packed instances + draw items (cx,cy,cz,r,first,count,_,_)
function Bk(st) { this.m = new Map; this.s = st }
Bk.prototype.add = function (k, a) { let b = this.m.get(k); if (!b) this.m.set(k, b = []); for (let i = 0; i < a.length; i++)b.push(a[i]) };
Bk.prototype.build = function (pad) {
  let n = 0; for (const b of this.m.values()) n += b.length; const d = new Float32Array(n), it = []; let o = 0;
  for (const b of this.m.values()) {
    d.set(b, o); const s = this.s; let a = [1e9, 1e9, 1e9], c = [-1e9, -1e9, -1e9], e = 0;
    for (let k = 0; k < b.length; k += s)for (let q = 0; q < 3; q++) { a[q] = min(a[q], b[k + q]); c[q] = max(c[q], b[k + q]) }
    const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
    for (let k = 0; k < b.length; k += s)e = max(e, sqrt((b[k] - m[0]) ** 2 + (b[k + 1] - m[1]) ** 2 + (b[k + 2] - m[2]) ** 2) + pad(b, k));
    let mr = 0; for (let k = 0; k < b.length; k += s)mr = max(mr, b[k + 3]);
    it.push(m[0], m[1], m[2], e, o / s, b.length / s, ceil(mr), 0); o += b.length;
  }
  return { d, it: new Float32Array(it) };
};

// ---------- islands
const rimR = (I, th) => I.R * (.8 + .42 * fbm(cos(th) * 1.3 + I.seed, sin(th) * 1.3, I.seed * .7, 3) + .07 * (fbm(cos(th) * 8 + I.seed, sin(th) * 8, 3.1, 3) - .5));
const isR = (I, x, z) => { const dx = x - I.cx, dz = z - I.cz; return sqrt(dx * dx + dz * dz) / rimR(I, atan2(dz, dx)) };
const topY = (I, x, z, rn) => { const f = 2.4 / I.R; return I.cy + I.Ht * (fbm(x * f + I.seed, 1.7, z * f, 4) * 1.9 - .75) * sst(1, .55, rn) - 7 * pow(rn, 6) + 38 * max(0, fbm(x * .028, I.seed, z * .028, 3) - .4) * sst(.8, .94, rn) * sst(1, .985, rn) };
const botY = (I, x, z, rn) => { const f = 3.4 / I.R, n = fbm(x * f + I.seed, 7.1, z * f, 3), sp = pow(max(0, fbm(x * f * 1.7, I.seed + 9, z * f * 1.7, 3) - .45) * 2.2, 1.6); return I.cy - 7 * pow(rn, 6) - I.D * pow(max(0, 1 - rn * rn), .42) * (.5 + .95 * n) - sp * I.D * .55 * (1 - rn) };
const disc = (u, v) => { if (!u && !v) return [0, 0]; let r, p; if (abs(u) > abs(v)) { r = u; p = PI / 4 * v / u } else { r = v; p = PI / 2 - PI / 4 * u / v } return [r * cos(p), r * sin(p)] };
function island(M, I) {
  const n = clamp(round(I.R / 4.6), 44, 150), i0 = M.ni;
  for (let s = 0; s < 2; s++) {
    const v0 = M.nv, j0 = M.ni;
    for (let j = 0; j <= n; j++)for (let i = 0; i <= n; i++) {
      const d = disc(i / n * 2 - 1, j / n * 2 - 1), r0 = min(1, sqrt(d[0] * d[0] + d[1] * d[1])), th = atan2(d[1], d[0]), rn = s ? 1 - pow(1 - r0, 1.7) : r0, rr = rimR(I, th) * rn * (s ? 1 + .2 * (fbm(cos(th) * 7 + I.seed, rn * 8, sin(th) * 7, 3) - .42) * sst(.45, .85, rn) * sst(1, .95, rn) : 1);
      const x = I.cx + cos(th) * rr, z = I.cz + sin(th) * rr;
      if (s) M.v(x, botY(I, x, z, rn), z, 0, 0, mix(150, 235, rn * rn), I.g, 0); else M.v(x, topY(I, x, z, rn), z, 0, 1, 255, I.g, 255 * sst(1, .9, rn) * (.5 + .5 * sst(.56, .47, I.ff(x, z))));
    }
    for (let j = 0; j < n; j++)for (let i = 0; i < n; i++) { const a = v0 + j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; if (s) { M.t(a, b, c); M.t(b, d, c) } else { M.t(a, c, b); M.t(b, c, d) } }
    M.norm(v0, j0);
  }
  M.item(i0, I.pad);
}
const sq = (q, n) => { const s = floor(q) & 3, f = (q - floor(q)) * 2 - 1, a = s == 0 ? 1 : s == 1 ? -f : s == 2 ? -1 : f, b = s == 0 ? f : s == 1 ? 1 : s == 2 ? -f : -1, k = pow(pow(abs(a), n) + pow(abs(b), n), 1 / n); return [a / k, b / k] };
// rock column rising from the cloud sea; sqn>0 makes a squarish mesa; mk(x,y,z) masks noise (for the carved face)
function column(M, cx, cz, Rx, Rz, yTop, seed, sqn, mk) {
  const rs = sqn ? 120 : 64, rg = sqn ? 90 : 96, yB = -1000, v0 = M.nv, i0 = M.ni;
  const lnx = sqn ? 0 : sin(seed * 3.1) * Rx * .9, lnz = sqn ? 0 : cos(seed * 2.3) * Rx * .9;
  for (let ii = 0; ii <= rg + 4; ii++)for (let j = 0; j < rs; j++) {
    const i = ii > rg ? ii - 1 : ii, t = min(1, i / rg), y = mix(yB, yTop, t), th = j / rs * TAU, d = sqn ? sq(j / rs * 4, sqn) : [cos(th), sin(th)];
    const n1 = fbm(d[0] * 1.8 + seed, y * .0035, d[1] * 1.8, 4) - .5, n2 = fbm(d[0] * 5 + seed, y * .013, d[1] * 5 + 3, 3) - .5, st = vn(y * .028 + seed, seed, d[0] + d[1]) - .5;
    let k = 1 + .32 * (1 - t) * (1 - t) + .1 * sin(t * 9 + seed), r;
    if (sqn) { const m = mk(cx + Rx * d[0], y, cz + Rz * d[1]); r = mix(k, 1, m[0]) * (1 + (n1 * .5 + n2 * .16 + st * .09) * (1 - m[1]) + m[2] / Rx) } else r = k * (1 + n1 * 1.1 + n2 * .3 + st * .22);
    const cp = i > rg ? 1 - (i - rg) / 3 : 1, top = ii > rg;
    const lf = 1 - t * t; M.v(cx - lnx * lf + Rx * d[0] * r * cp, y + (top ? (1 - cp) * (9 + n2 * 10 + 34 * (fbm((cx + Rx * d[0] * r * cp) * .011 + seed, 4.4, (cz + Rz * d[1] * r * cp) * .011, 3) - .4)) : 0), cz - lnz * lf + Rz * d[1] * r * cp, 0, top ? 1 : 0, 255 * mix(.55, 1, sst(-700, -200, y)), 0, top ? 135 + 120 * sst(.45, .6, fbm((cx + Rx * d[0] * r * cp) * .02 + seed, 2.2, (cz + Rz * d[1] * r * cp) * .02, 3)) : 0);
  }
  for (let i = 0; i < rg + 4; i++)if (i != rg) for (let j = 0; j < rs; j++) { const a = v0 + i * rs + j, b = v0 + i * rs + (j + 1) % rs, c = a + rs, d = b + rs; M.t(a, c, b); M.t(b, c, d) }
  M.norm(v0, i0); M.item(i0, 0);
}
function rock(M, x, y, z, r, g, seed) {
  const v0 = M.nv, i0 = M.ni, A = 16, B = 11;
  for (let j = 0; j <= B; j++)for (let i = 0; i < A; i++) { const ph = j / B * PI, th = i / A * TAU, d = [sin(ph) * cos(th), cos(ph), sin(ph) * sin(th)], k = r * (.6 + .8 * fbm(d[0] * 1.3 + seed, d[1] * 1.3, d[2] * 1.3 + seed, 3)); M.v(x + d[0] * k, y + d[1] * k * (d[1] < 0 ? 1.7 : .8), z + d[2] * k, 0, d[1] > .6 ? 1 : 0, 245, g, d[1] > .6 ? 105 : 0) }
  for (let j = 0; j < B; j++)for (let i = 0; i < A; i++) { const a = v0 + j * A + i, b = v0 + j * A + (i + 1) % A, c = a + A, d = b + A; M.t(a, b, c); M.t(b, d, c) }
  M.norm(v0, i0);
}
function bridge(W, A, B, w, rise, na, gap) {
  (W.br = W.br || []).push([A, B, w, rise, gap]);
  const M = W.M, i0 = M.ni, v0 = M.nv, n = na * 16 + 1, dx = B[0] - A[0], dz = B[2] - A[2], L = sqrt(dx * dx + dz * dz), T = [dx / L, 0, dz / L], S = [-T[2], 0, T[0]];
  const ring = (s, jag) => {
    const c = [mix(A[0], B[0], s), mix(A[1], B[1], s) + rise * 4 * s * (1 - s), mix(A[2], B[2], s)], hp = (round(s * (n - 1)) & 3) < 2 ? 3.6 : 2, un = 7, pw = .82;
    const q = [-w, hp, -w + 2, hp, -w + 2, 0, w - 2, 0, w - 2, hp, w, hp, w, -2.4, w * pw, -un, -w * pw, -un, -w, -2.4], b = M.nv;
    for (let e = 0; e < 10; e++)for (let k = 0; k < 2; k++) { const j = (e + k) % 10, nz = (fbm(c[0] * .2 + j, c[1] * .2, c[2] * .2, 2) - .5) * .9; const jg = jag * (1 + 11 * h3(j, round(s * 97), 5)); M.v(c[0] + S[0] * (q[j * 2] + nz) + T[0] * jg, c[1] + q[j * 2 + 1] + nz * .5 - abs(jg) * .15, c[2] + S[2] * (q[j * 2] + nz) + T[2] * jg, 0, 3, e > 5 ? 190 : 255, 0, 150) }
    if (jag) { const k = M.v(c[0] + T[0] * jag * 5, c[1] - un * .4, c[2] + T[2] * jag * 5, 0, 3, 170, 0, 150); for (let e = 0; e < 10; e++)M.t(b + e * 2, b + e * 2 + 1, k) }
    return b;
  };
  let pb = -1;
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1), ig = t => gap && t > gap[0] && t < gap[1]; if (ig(s)) { pb = -1; continue }
    const b = ring(s, ig((i + 1) / (n - 1)) ? 1 : ig((i - 1) / (n - 1)) ? -1 : 0); if (pb >= 0) for (let e = 0; e < 10; e++) { const a = pb + e * 2, c = b + e * 2; M.t(a, a + 1, c); M.t(a + 1, c + 1, c) } pb = b;
    if (h3(i, 7, 1) < .4) { const sd = h3(i, 3, 2) < .5 ? -1 : 1, c = [mix(A[0], B[0], s) + S[0] * w * sd * .8, mix(A[1], B[1], s) + rise * 4 * s * (1 - s) - 3, mix(A[2], B[2], s) + S[2] * w * sd * .8]; W.vine('b', c, [c[0] + 8 * h3(i, 5, 5) - 4, c[1] - 15 - 50 * h3(i, 1, 3), c[2] + 8 * h3(i, 6, 6) - 4], 0, 0, 1, 0) }
    if (h3(i, 9, 4) < .2) W.plant('b', [mix(A[0], B[0], s), mix(A[1], B[1], s) + rise * 4 * s * (1 - s) - 4 - 3 * h3(i, 2, 2), mix(A[2], B[2], s)], 8 + 6 * h3(i, 4, 4), 0, 0, 0);
  }
  { // arch rib + spandrel columns
    const H0 = min(100, L * .22), wa = w * .8, dy = s => mix(A[1], B[1], s) + rise * 4 * s * (1 - s), ay = s => dy(s) - 9 - H0 * (2 * s - 1) ** 2, ig = t => gap && t > gap[0] - .01 && t < gap[1] + .01; let pb = -1;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1); if (ig(s)) { pb = -1; continue } const c = [mix(A[0], B[0], s), ay(s), mix(A[2], B[2], s)], b = M.nv, q = [-wa, 4, wa, 4, wa, -5, -wa, -5];
      for (let e = 0; e < 4; e++)for (let k = 0; k < 2; k++) { const j = (e + k) % 4; M.v(c[0] + S[0] * q[j * 2], c[1] + q[j * 2 + 1], c[2] + S[2] * q[j * 2], 0, 3, e == 2 ? 170 : 235, 0, 150) }
      if (pb >= 0) for (let e = 0; e < 4; e++) { const a = pb + e * 2, d = b + e * 2; M.t(a, a + 1, d); M.t(a + 1, d + 1, d) } pb = b;
      if (i % 5 == 2 && dy(s) - ay(s) > 20) for (const sd of [-1, 1]) tube(M, [c[0] + S[0] * wa * .7 * sd, c[1] + 2, c[2] + S[2] * wa * .7 * sd, 3.4, 0, c[0] + S[0] * wa * .7 * sd, dy(s) - 6, c[2] + S[2] * wa * .7 * sd, 3.4, 0], 6, 3, 215, 0, null, 0);
    }
  }
  if (gap) for (let k = -1; k < 2; k++) { const P = s => [mix(A[0], B[0], s) + S[0] * k * w * .7, mix(A[1], B[1], s) + rise * 4 * s * (1 - s) - 2, mix(A[2], B[2], s) + S[2] * k * w * .7]; W.vine('b', P(gap[0] - .02), P(gap[1] + .02), L * (gap[1] - gap[0]) * (.2 + .12 * (k + 1)), 0, 0, 0) }
  M.norm(v0, i0); M.item(i0, 0);
  for (let i = 0; i < 12; i++) { const s = i / 11; W.cap.push(mix(A[0], B[0], s), mix(A[1], B[1], s) + rise * 4 * s * (1 - s) - 3, mix(A[2], B[2], s), mix(A[0], B[0], s + .09), mix(A[1], B[1], s + .09) + rise * 4 * s * (1 - s) - 3, mix(A[2], B[2], s + .09), w) }
}
// carved wing relief heightfield (metres) + gold inlay mask
function wingRelief(nu, nv, Wd, Hh, ox, oy) {
  const h = new Float32Array(nu * nv), gd = new Uint8Array(nu * nv), ao = new Float32Array(nu * nv), du = Wd / (nu - 1), dv = Hh / (nv - 1);
  const C = s => [ox + 30 + 250 * s, oy + 135 + 130 * sin(2.2 * s)];
  const rows = [[30, 1, 9.5, 2, 4.6, 1], [34, .5, 7.5, 6.2, 3.6, 0], [40, .26, 6, 9.6, 3, 0]];
  for (const [n, lf, wd0, bh, dome, gold] of rows) for (let f = 0; f < n; f++) {
    const s = (f + .5) / n, c = C(s), ph = (-82 + 87 * pow(s, 1.5)) * PI / 180, len = 120 * (.72 + .55 * pow(s, 1.3)) * lf, wd = wd0 * (1 + .3 * s), ax = cos(ph), ay = sin(ph);
    const x0 = min(c[0], c[0] + ax * len) - wd, x1 = max(c[0], c[0] + ax * len) + wd, y0 = min(c[1], c[1] + ay * len) - wd, y1 = max(c[1], c[1] + ay * len) + wd;
    for (let j = max(0, floor(y0 / dv)); j <= min(nv - 1, ceil(y1 / dv)); j++)for (let i = max(0, floor(x0 / du)); i <= min(nu - 1, ceil(x1 / du)); i++) {
      const px = i * du - c[0], py = j * dv - c[1], a = px * ax + py * ay, b = -px * ay + py * ax; if (a < 0 || a > len) continue;
      const x = a / len, wm = wd * sqrt(max(0, 1 - pow(abs(2 * x - 1), 3.2))) * mix(.8, 1, x); if (abs(b) >= wm) continue;
      const q = b / wm, hh = bh + dome * sqrt(1 - q * q) + q * 1.7 + 1.3 * exp(-b * b / 1.3) - .55 * (.5 + .5 * cos((a - abs(b) * .9) * 1.7)) * (1 - exp(-b * b / 2));
      if (hh > h[j * nu + i]) { h[j * nu + i] = hh; gd[j * nu + i] = gold && abs(b) < .9 ? 255 : 110 }
    }
  }
  for (let j = 0; j < nv; j++)for (let i = 0; i < nu; i++) { // arm ridge
    const x = i * du, y = j * dv; let d = 1e9; for (let k = 0; k <= 40; k++) { const c = C(k / 40); d = min(d, (x - c[0]) ** 2 + (y - c[1]) ** 2) } d = sqrt(d);
    if (d < 12) { const a = 13 + 4.5 * sqrt(1 - d * d / 144); if (a > h[j * nu + i]) { h[j * nu + i] = a; gd[j * nu + i] = d < 1.6 ? 255 : 110 } }
  }
  // carved alcove around the wing: blurred coverage mask
  let m = new Float32Array(nu * nv), t = new Float32Array(nu * nv); for (let k = 0; k < m.length; k++)m[k] = gd[k] ? 1 : 0;
  for (let p = 0; p < 2; p++) {
    const R = 11; for (let j = 0; j < nv; j++) { let a = 0; for (let i = -R; i < nu; i++) { if (i + R < nu) a += m[j * nu + i + R]; if (i - R - 1 >= 0) a -= m[j * nu + i - R - 1]; if (i >= 0) t[j * nu + i] = a / (2 * R + 1) } }
    for (let i = 0; i < nu; i++) { let a = 0; for (let j = -R; j < nv; j++) { if (j + R < nv) a += t[(j + R) * nu + i]; if (j - R - 1 >= 0) a -= t[(j - R - 1) * nu + i]; if (j >= 0) m[j * nu + i] = a / (2 * R + 1) } }
  }
  for (let j = 0; j < nv; j++)for (let i = 0; i < nu; i++) {
    const k = j * nu + i, x = i * du, y = j * dv, al = sst(0, .3, m[k]); let hh = h[k];
    if (gd[k]) hh = hh * (1 - .4 * sst(.56, .8, fbm(x * .03, y * .03, 4.4, 3))) + (fbm(x * .09, y * .09, 1.1, 3) - .5) * 1.4;
    else hh = -8 * al + (fbm(x * .02, y * .02, 7.7, 4) - .5) * mix(6, 2, al);
    ao[k] = mix(1, clamp(.28 + (hh + 8) * .042, .22, 1), al);
    h[k] = hh;
  }
  return { h, gd, ao };
}

// ---------- foliage / creature meshes: 8 floats per vertex
function clusterMesh(N, rng) {
  const v = [], ix = [], NI = N * .18 | 0;
  for (let i = 0; i < N; i++) {
    const inner = i < NI, d = nrm([rng() * 2 - 1, rng() * 1.6 - .7, rng() * 2 - 1]), r = inner ? .15 + .35 * rng() : mix(.5, 1, pow(rng(), .8)), c = [d[0] * r, d[1] * r * .62, d[2] * r];
    const n = nrm([d[0] + (rng() - .5) * .9, d[1] + (rng() - .5) * .9 + .2, d[2] + (rng() - .5) * .9]);
    let t = nrm(crs(n, nrm([rng() - .5, rng() - .5, rng() - .5]))); if (t[1] > .25) t = [-t[0], -t[1], -t[2]];
    const b = crs(n, t), sz = (inner ? .56 : .36) * (.75 + .5 * rng()), b0 = v.length / 8, tw = (rng() - .5) * .5, rd = inner ? -rng() - .001 : rng();
    for (const [u, w] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const x = (u - .3) * sz * 1.25, y = (w - .5) * sz, z = sz * (tw * (u - .5) * (w - .5) * 2 - .12 * u * u); v.push(t[0] * x + b[0] * y + n[0] * z, t[1] * x + b[1] * y + n[1] * z, t[2] * x + b[2] * y + n[2] * z, (i + .5) / N, c[0], c[1], c[2], rd) }
    ix.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
  }
  return { v: new Float32Array(v), i: new Uint16Array(ix), core: 0 };
}
function fernMesh(rng) { // hanging rosette of drooping fronds, each frond a chain of sprig cards (same layout as cluster cards)
  const v = [], NF = 9, NC = 3, cs = [];
  for (let f = 0; f < NF; f++) {
    const az = f / NF * TAU + rng() * .5, o = [cos(az), 0, sin(az)], sd = [-sin(az), 0, cos(az)], sp = .5 + .35 * rng(), dr = .8 + .5 * rng();
    const S = s => [o[0] * sp * sin(s * 1.9), -dr * s * s - .05 * s, o[2] * sp * sin(s * 1.9)];
    for (let c = 0; c < NC; c++) { const a = S(c / NC * .93), b = S(min(1, (c + 1.2) / NC)), t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = sqrt(t[0] * t[0] + t[1] * t[1] + t[2] * t[2]); nrm(t); cs.push([c, a, t, sd, len]) }
  }
  cs.sort((p, q) => p[0] - q[0]);
  cs.forEach(([c, a, t, sd, len], i) => {
    const sz = len / 1.25, ce = [a[0] + t[0] * len * .3, a[1] + t[1] * len * .3, a[2] + t[2] * len * .3], rd = rng();
    for (const [u, w] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const x = (u - .3) * sz * 1.25, y = (w - .5) * sz * (1.5 - .3 * c); v.push(t[0] * x + sd[0] * y, t[1] * x + sd[1] * y, t[2] * x + sd[2] * y, (i + .5) / cs.length, ce[0], ce[1], ce[2], rd) }
  });
  return new Float32Array(v);
}
function tuftMesh(rng) {
  const v = [], tri = (a, b, c, n) => { for (const p of [a, b, c]) v.push(p[0], p[1], p[2], p[1] * p[1], n[0], n[1], n[2], p[3]) };
  for (let b = 0; b < 9; b++) {
    const az = b / 9 * TAU + rng(), o = [cos(az), 0, sin(az)], sd = [-sin(az), 0, cos(az)], ln = .2 + .55 * rng(), h = .65 + .5 * rng(), n = nrm([o[0] * .35, 1, o[2] * .35]);
    const C = t => [o[0] * ln * t * t * h, t * h, o[2] * ln * t * t * h], wd = t => .055 * (1 - t * .85), ts = [0, .4, .75, 1]; let pl, pr;
    for (let k = 0; k < 4; k++) { const c = C(ts[k]), w = wd(ts[k]), l = [c[0] - sd[0] * w, c[1], c[2] - sd[2] * w, ts[k]], r = [c[0] + sd[0] * w, c[1], c[2] + sd[2] * w, ts[k]]; if (k) { tri(pl, pr, l, n); tri(pr, r, l, n) } pl = l; pr = r }
    if (b % 2 == 0) { const c = C(1), u = .16, w = .05; tri([c[0] - sd[0] * w, c[1] + u * .4, c[2] - sd[2] * w, 1.6], [c[0] + sd[0] * w, c[1] + u * .4, c[2] + sd[2] * w, 1.6], [c[0], c[1] + u, c[2], 1.6], n); tri([c[0] - sd[0] * w, c[1] + u * .4, c[2] - sd[2] * w, 1.6], [c[0], c[1] - u * .2, c[2], 1.6], [c[0] + sd[0] * w, c[1] + u * .4, c[2] + sd[2] * w, 1.6], n) }
  }
  return new Float32Array(v);
}
function birdMesh() { // forward +z, half-span 1; a0 = pos + wing weight, a1 = colour + normal
  const v = [], P = (x, y, z, w, c, n) => v.push(x, y, z, w, c, n[0], n[1], n[2]), Q = (a, b, c, d) => { P(...a); P(...b); P(...c); P(...a); P(...c); P(...d) };
  const pr = [[-.5, 0], [-.36, .07], [-.12, .13], [.14, .125], [.3, .08], [.42, .05], [.52, .062], [.6, .05], [.72, 0]], RS = 8;
  for (let i = 0; i < 8; i++)for (let j = 0; j < RS; j++) {
    const a = j / RS * TAU, b = (j + 1) / RS * TAU, p = pr[i], q = pr[i + 1], c = i > 5 ? .5 : 0, V = (an, k) => [cos(an) * k[1], sin(an) * k[1] * .85, k[0], 0, c, nrm([cos(an), sin(an), (p[1] - q[1]) * 1.5])];
    Q(V(a, p), V(b, p), V(b, q), V(a, q));
  }
  const xs = [.05, .2, .38, .56, .72, .86], le = [.26, .29, .25, .16, .05, -.08], te = [-.26, -.22, -.18, -.19, -.24, -.3];
  for (const s of [-1, 1]) {
    const W = (k, z, c) => [s * xs[k], .03 + .03 * sin(xs[k] * 3), z, xs[k], c, nrm([s * .12, 1, z * .5])];
    for (let k = 0; k < 5; k++)Q(W(k, le[k], xs[k] * .7), W(k + 1, le[k + 1], xs[k + 1] * .7), W(k + 1, te[k + 1], xs[k + 1] * .9 + .1), W(k, te[k], xs[k] * .9 + .1));
    for (let f = 0; f < 4; f++) { const z0 = mix(le[5], te[5], f / 4), z1 = mix(le[5], te[5], (f + .8) / 4), tz = (z0 + z1) / 2 - .1 - f * .04, n = nrm([s * .12, 1, 0]); P(s * xs[5], .04, z0, xs[5], .75, n); P(s * xs[5], .04, z1, xs[5], .75, n); P(s * (1 - f * .04), .03, tz, 1, 1.05, n) }
  }
  for (const s of [-1, 0, 1]) { const n = [0, 1, 0]; P(-.06 + s * .05, .02, -.4, 0, .2, n); P(.06 + s * .05, .02, -.4, 0, .2, n); P(s * .2, .02, -.9, 0, .95, n) }
  return new Float32Array(v);
}
function butterflyMesh() { // forward +z, half-span 1; a0 = pos + |x|, a1 = (0 body .. 1 wing edge) + normal
  const v = [], up = [0, 1, 0], P = (x, y, z, c, n) => v.push(x, y, z, abs(x), c, n[0], n[1], n[2]);
  const fan = (s, r, O) => { for (let k = 0; k + 1 < O.length; k++) { P(s * r[0], 0, r[1], .12, up); P(s * O[k][0], 0, O[k][1], 1, up); P(s * O[k + 1][0], 0, O[k + 1][1], 1, up) } };
  for (const s of [-1, 1]) {
    fan(s, [.04, .12], [[.04, .3], [.2, .44], [.55, .64], [.92, .56], [1, .32], [.8, .12], [.45, .02], [.04, -.02]]);
    fan(s, [.04, -.04], [[.04, -.02], [.4, -.02], [.7, -.18], [.72, -.45], [.5, -.7], [.25, -.62], [.06, -.3]]);
  }
  for (const [a, b] of [[[0, .04], [0, -.04]], [[.035, 0], [-.035, 0]]]) { const n = a[0] ? up : [1, 0, 0]; P(a[0], a[1], .4, 0, n); P(b[0], b[1], .4, 0, n); P(a[0], a[1], -.45, 0, n); P(b[0], b[1], .4, 0, n); P(b[0], b[1], -.45, 0, n); P(a[0], a[1], -.45, 0, n) }
  return new Float32Array(v);
}
// ---------- fauna meshes: triangle lists, 8 floats/vertex = pos, w (animation part: 0 body, 1-4 legs + depth, 5 neck/head + along, 6 tail + along), c (colour key), normal
function FM() { this.v = [] }
FM.prototype.pt = function (p, n, W) { this.v.push(p[0], p[1], p[2], W[0], W[1], n[0], n[1], n[2]) };
FM.prototype.blob = function (C, r, wc, nu = 10, nv = 7) { // ellipsoid; wc: [w, c] or p => [w, c]
  const P = (i, j) => { const th = i / nu * TAU, ph = j / nv * PI, d = [sin(ph) * cos(th), cos(ph), sin(ph) * sin(th)]; return [[C[0] + d[0] * r[0], C[1] + d[1] * r[1], C[2] + d[2] * r[2]], nrm([d[0] / r[0], d[1] / r[1], d[2] / r[2]])] };
  for (let j = 0; j < nv; j++)for (let i = 0; i < nu; i++) { const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1); for (const q of [a, c, b, a, d, c]) this.pt(q[0], q[1], typeof wc == 'function' ? wc(q[0]) : wc) }
};
FM.prototype.tube = function (P, R, wc, sd = 5) { // wc(k) per ring
  const rg = []; let N = null;
  for (let k = 0; k < P.length; k++) {
    const a = P[max(k - 1, 0)], b = P[min(k + 1, P.length - 1)], T = nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]); if (!N) N = abs(T[1]) > .9 ? [1, 0, 0] : [0, 1, 0];
    const d = N[0] * T[0] + N[1] * T[1] + N[2] * T[2]; N = nrm([N[0] - T[0] * d, N[1] - T[1] * d, N[2] - T[2] * d]); const B = crs(T, N), r = [];
    for (let s = 0; s <= sd; s++) { const th = s / sd * TAU, n = [N[0] * cos(th) + B[0] * sin(th), N[1] * cos(th) + B[1] * sin(th), N[2] * cos(th) + B[2] * sin(th)]; r.push([[P[k][0] + n[0] * R[k], P[k][1] + n[1] * R[k], P[k][2] + n[2] * R[k]], n]) }
    rg.push(r);
  }
  for (let k = 0; k + 1 < P.length; k++) { const w0 = wc(k), w1 = wc(k + 1); for (let s = 0; s < sd; s++) { const a = rg[k][s], b = rg[k][s + 1], c = rg[k + 1][s + 1], d = rg[k + 1][s]; for (const [q, W] of [[a, w0], [b, w0], [c, w1], [a, w0], [c, w1], [d, w1]]) this.pt(q[0], q[1], W) } }
};
FM.prototype.tri = function (a, b, c, W) { const n = nrm(crs([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]])); for (const p of [a, b, c]) this.pt(p, n, typeof W[0] == 'object' ? W[[a, b, c].indexOf(p)] : W) };
function faunaMeshes() {
  const quad = fx => { // deer (fx 0) / fox (fx 1). colour keys: 0 coat, .3 white, .6 dark, .9 antler
    const m = new FM(), H = fx ? .3 : .72, Lg = fx ? .27 : .62, bl = fx ? .3 : .42, bw = fx ? .1 : .15;
    m.blob([0, H, 0], [bw, fx ? .1 : .16, bl], p => [0, p[1] < H - (fx ? .05 : .09) ? .3 : 0]);
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz], k) => { const x = sx * bw * .62, z = sz * bl * .68, P = [[x, H - .02, z], [x, H - Lg * .5, z + (sz < 0 ? -.06 : .02)], [x, H - Lg * .92, z], [x, H - Lg, z + .015]], R = fx ? [.035, .026, .02, .02] : [.05, .034, .024, .022]; m.tube(P, R, i => [k + 1 + .99 * i / 3, i == 3 ? .6 : fx && i > 0 ? .6 : 0]) });
    const nb = [0, H + .04, bl * .78], hd = fx ? [0, H + .12, bl + .16] : [0, H + .38, bl + .18];
    m.tube([nb, [0, (nb[1] + hd[1]) / 2, (nb[2] + hd[2]) / 2 + .02], hd], fx ? [.07, .06, .055] : [.08, .065, .055], i => [5 + .45 * i, 0]);
    m.blob([hd[0], hd[1] + .02, hd[2] + (fx ? .06 : .07)], fx ? [.06, .055, .12] : [.065, .07, .14], p => [5.99, p[2] > hd[2] + (fx ? .16 : .19) ? .6 : 0]);
    for (const s of [-1, 1]) {
      m.tri([s * .035, hd[1] + .07, hd[2]], [s * (fx ? .07 : .1), hd[1] + (fx ? .17 : .13), hd[2] - .02], [s * .05, hd[1] + .06, hd[2] - .05], [5.99, fx ? .6 : 0]);
      if (!fx) { const b = [s * .03, hd[1] + .09, hd[2] - .01]; m.tube([b, [s * .08, hd[1] + .25, hd[2] - .04], [s * .14, hd[1] + .38, hd[2] + .02]], [.014, .011, .006], () => [5.99, .9], 4); m.tube([[s * .075, hd[1] + .22, hd[2] - .03], [s * .05, hd[1] + .33, hd[2] + .06]], [.009, .005], () => [5.99, .9], 4) }
    }
    if (fx) { m.blob([0, H + .02, -bl - .16], [.07, .07, .2], p => [6.5, p[2] < -bl - .3 ? .3 : 0]) } else m.blob([0, H + .06, -bl - .02], [.04, .05, .05], [6.5, .3]);
    return new Float32Array(m.v);
  };
  const rabbit = () => { const m = new FM(); m.blob([0, .17, 0], [.11, .12, .17], p => [0, p[1] < .09 ? .3 : 0]); m.blob([0, .29, .15], [.075, .075, .085], [5.5, 0]);
    for (const s of [-1, 1]) { m.blob([s * .03, .43, .12], [.017, .1, .035], p => [5.99, abs(p[0]) < .03 && p[2] > .12 ? .6 : 0]); m.blob([s * .08, .08, -.06], [.04, .07, .11], [3.5, 0]); m.blob([s * .05, .05, .12], [.025, .05, .03], [1.5, 0]) }
    m.blob([0, .2, -.18], [.04, .04, .04], [6.5, .3]); return new Float32Array(m.v) };
  const snail = () => { const m = new FM(); m.blob([0, .36, -.06], [.24, .27, .27], p => [0, .5 + .49 * ((atan2(p[2] + .06, p[1] - .36) / TAU + .5 + sqrt((p[2] + .06) ** 2 + (p[1] - .36) ** 2) * 2.5) % 1)], 14, 10);
    m.blob([0, .06, .08], [.11, .06, .42], [1, .2]); for (const s of [-1, 1]) { m.tube([[s * .035, .1, .42], [s * .05, .2, .47], [s * .06, .3, .5]], [.016, .013, .011], i => [5 + .45 * i, .1], 4); m.blob([s * .06, .31, .5], [.022, .022, .022], [5.99, .1], 6, 4) } return new Float32Array(m.v) };
  const lizard = () => { const m = new FM(); m.blob([0, .05, 0], [.09, .045, .28], [0, 0]); m.blob([0, .05, .34], [.065, .04, .1], [5.5, 0]);
    m.tube([[0, .045, -.24], [0, .035, -.5], [0, .025, -.75], [0, .015, -.95]], [.05, .035, .02, .006], i => [6 + .33 * i, 0]);
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz], k) => m.tube([[sx * .07, .04, sz * .16], [sx * .17, .03, sz * .2], [sx * .2, .005, sz * .27]], [.022, .016, .012], i => [k + 1 + .49 * i, 0], 4)); return new Float32Array(m.v) };
  const glider = () => { const m = new FM(); m.blob([0, 0, 0], [.11, .08, .26], [0, 0]); m.blob([0, .02, .3], [.075, .065, .09], [5.5, 0]); m.blob([0, 0, -.45], [.08, .025, .22], [6.5, .3]);
    for (const s of [-1, 1]) { m.blob([s * .045, .08, .33], [.02, .03, .015], [5.99, 0], 6, 4); const I = (z) => [s * .09, 0, z], O = (z) => [s * .4, -.01, z], wi = [0, .5], wo = [1, .5]; m.tri(I(.18), O(.2), O(0), [wi, wo, wo]); m.tri(I(.18), O(0), I(-.18), [wi, wo, wi]); m.tri(I(-.18), O(0), O(-.2), [wi, wo, wo]) }
    return new Float32Array(m.v) };
  const nest = () => { const m = new FM(); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, b = (i + 1.3) / 9 * TAU; m.tube([[cos(a) * .42, .12, sin(a) * .42], [cos((a + b) / 2) * .5, .2, sin((a + b) / 2) * .5], [cos(b) * .42, .14, sin(b) * .42]], [.09, .12, .09], () => [0, 0], 6) } m.blob([0, .02, 0], [.44, .1, .44], [0, 0]); return new Float32Array(m.v) };
  const chick = () => { const m = new FM(); m.blob([0, .1, 0], [.09, .09, .09], [0, .3]); m.blob([0, .21, .03], [.065, .065, .065], [5.5, .3]);
    m.tri([-.025, .22, .08], [.025, .22, .08], [0, .225, .16], [5.99, .9]); m.tri([.022, .2, .08], [-.022, .2, .08], [0, .165, .14], [5.99, .9]); return new Float32Array(m.v) };
  return { deer: quad(0), fox: quad(1), rabbit: rabbit(), snail: snail(), lizard: lizard(), glider: glider(), nest: nest(), chick: chick() };
}
function rayMesh() {
  const v = [], P = (x, y, z, w, c) => v.push(x, y, z, w, c, x * .3, 1, 0), T = (a, b, c) => { P(...a); P(...b); P(...c) };
  const xs = [0, .12, .3, .55, .8, 1], le = [.44, .43, .34, .14, -.12, -.34], te = [-.42, -.38, -.31, -.27, -.3, -.38], dr = x => -.16 * x * x;
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const m = j => [s * xs[j], .1 * pow(1 - xs[j], 1.6) + dr(xs[j]), (le[j] + te[j]) / 2 + .06, xs[j], .25], l = j => [s * xs[j], dr(xs[j]), le[j], xs[j], .55 + .45 * xs[j]], t = j => [s * xs[j], dr(xs[j]), te[j], xs[j], .7 + .3 * xs[j]];
      T(l(k), l(k + 1), m(k + 1)); T(l(k), m(k + 1), m(k)); T(m(k), m(k + 1), t(k + 1)); T(m(k), t(k + 1), t(k));
    }
    T([s * .05, .02, .44, 0, .4], [s * .13, .01, .42, 0, .4], [s * .1, -.03, .62, 0, .9]);
  }
  T([-.03, .02, -.4, 0, .5], [.03, .02, -.4, 0, .5], [0, 0, -1.9, 0, 1]);
  return new Float32Array(v);
}

// ---------- the world
function genWorld() {
  const rng = RNG(20261117), M = new Mesh, IS = [], MO = [];
  const W = { M, IS, MO, cap: [], sph: [], grp: new Float32Array(256 * 12), st: new Float32Array(112), ng: 1 };
  W.grp[9] = 1;
  const CL = new Bk(8), PL = new Bk(8), TU = new Bk(8), VI = new Bk(12), CR = [], PA = [];
  W.vine = (k, a, b, sag, sw, free, g) => VI.add(k, [a[0], a[1], a[2], sw, b[0], b[1], b[2], sag, rng(), g, free, rng()]);
  W.plant = (k, p, s, sw, kind, g) => kind ? TU.add(k, [p[0], p[1], p[2], s, rng() * TAU, rng(), g, kind + sw * .5]) : PL.add(k, [p[0], p[1], p[2], s, -1, rng(), g, sw]);
  const GC = [], TB = [], LB = [], LZ = [], FR = RNG(4242); // home island: golden canopy clusters, trunk bases, big-limb samples, trunk-bark spots; FR = fauna-only random stream
  const cluster = (k, x, y, z, r, kind, sw, g) => { CL.add(k, [x, y, z, r, kind, rng(), g, sw]); W.sph.push(x, y, z, r); if (kind > .7 && /^g[0-6]$/.test(k)) GC.push(x, y, z, r) };
  const grp = (I, yaw, ax, ay, az, spin, rate) => { const o = W.ng * 12; W.grp.set([I[0], I[1], I[2], yaw, ax, ay, az, rng() * 9, spin, rate, 0, 0], o); return W.ng++ };
  const hole = (x, z) => sst(170, 110, sqrt(x * x + (z - 400) ** 2));
  const isl = (cx, cy, cz, R, Ht, D, drift) => { const ii = IS.length, I = { cx, cy, cz, R, Ht, D, g: 0, pad: 0, seed: ii * 7.31 + 1.7, ff: (x, z) => fbm(x * .0052 + 31, 5.5, z * .0052, 3) - (ii ? 0 : hole(x, z)) }; if (drift) { I.g = grp([cx, cy, cz], .03, 22 + rng() * 22, 8 + rng() * 10, 22 + rng() * 22, 0, 2.6); I.pad = 60 } IS.push(I); return I };
  const home = isl(0, 0, 0, 640, 58, 430), east = isl(1090, 45, 400, 330, 38, 270), far = isl(1820, 130, 1020, 270, 34, 230);
  const DR = [[-1350, 230, -760, 300], [-520, 400, -1560, 250], [760, 310, -1480, 230], [-1720, -70, 640, 290], [330, -130, 1560, 300], [-930, 160, 1760, 210], [2300, 270, 60, 240], [2400, -30, -1500, 300], [-2350, 110, -330, 260], [1050, 430, 2050, 220], [-330, 520, 2400, 200], [-2050, 340, 1850, 260], [60, 260, -2550, 280], [-1150, -160, -2200, 230], [1330, -30, 1740, 230]];
  for (const d of DR) isl(d[0], d[1], d[2], d[3], 24 + rng() * 26, d[3] * (.7 + rng() * .4), 1);
  for (const I of IS) island(M, I);
  // wing mesa + monument
  const MX = 1540, MZ = -540, MRX = 220, MRZ = 370, MT = 410, BW = 470, BH = 310, BY = 62, BZ = MZ - BW / 2;
  W.mesa = [MX, MZ, MRX, MRZ, MT];
  // the whole carved face is one high-resolution heightfield that follows the mesa's rounded-square outline; the coarse body is recessed behind it
  column(M, MX, MZ, MRX, MRZ, MT, 3.3, 5, (x, y, z) => { const f = x > MX - MRX * .5 ? 0 : sst(.97, .9, abs(z - MZ) / MRZ); return [f, f * .97, -12 * f] });
  {
    const du = .9, nu = round(BW / du) + 1, nv = round(BH / du) + 1, { h, gd, ao } = wingRelief(nu, nv, BW, BH, 0, 0), v0 = M.nv, i0 = M.ni;
    const axis = (lo, b0, n, hi) => { const a = [], l = []; let x = b0, st = du; while (x - lo > st * 1.6) { st = min(st * 1.17, 14); x -= st; l.push(x) } l.push(lo); l.reverse(); for (const v of l) a.push(v); const k0 = a.length; for (let i = 0; i < n; i++)a.push(b0 + i * du); x = b0 + (n - 1) * du; st = du; while (hi - x > st * 1.6) { st = min(st * 1.17, 14); x += st; a.push(x) } a.push(hi); return [a, k0] };
    const [us, iu0] = axis(MZ - MRZ * .992, BZ, nu, MZ + MRZ * .992), [vs, iv0] = axis(-640, BY, nv, MT + 2), NU = us.length, NV = vs.length + 4;
    for (let j = 0; j < NV; j++)for (let i = 0; i < NU; i++) {
      const lid = max(0, j - vs.length + 1), z = us[i], y = vs[min(j, vs.length - 1)] + lid * .6, fi = i - iu0, fj = j - iv0, bb = abs(z - MZ) / MRZ, xn = MX - MRX * pow(max(0, 1 - pow(bb, 5)), .2) - 2; let hh, e = 0, a = 1;
      if (fi >= 0 && fi < nu && fj >= 0 && fj < nv) { const k = fj * nu + fi; hh = h[k]; e = gd[k]; a = ao[k] } else hh = (fbm((z - BZ) * .02, (y - BY) * .02, 7.7, 4) - .5) * 6;
      M.v(xn - hh + 30 * sst(.955, .995, bb) + lid * 4.5, y, z, 0, 3, 255 * a, 0, e);
    }
    for (let j = 0; j < NV - 1; j++)for (let i = 0; i < NU - 1; i++) { const a = v0 + j * NU + i; M.t(a, a + 1, a + NU); M.t(a + 1, a + NU + 1, a + NU) }
    M.norm(v0, i0); M.item(i0, 0);
    for (let i = 0; i < 0; i++) { const u = 40 + rng() * 390, c = [MX - MRX - 12, BY + 150 + 120 * sin(2.2 * (u - 30) / 250) * (u < 280 ? 1 : .9) - rng() * 40, BZ + u]; W.vine('w', c, [c[0] - 1, c[1] - 25 - rng() * 60, c[2] + 2], 0, 0, 1, 0) }
  }
  // monoliths
  const MD = [[2700, 900, 120, 520], [-2600, -1400, 130, 640], [2150, 2350, 110, 440], [-1750, 2650, 120, 540], [900, -3000, 135, 720], [-3000, 900, 115, 380], [3050, -700, 125, 580], [-650, 3050, 105, 470], [-790, 560, 74, 150], [-420, -1080, 95, 540], [520, -980, 62, 300], [-1180, 240, 85, 430], [1000, -260, 55, 180], [640, 1080, 80, 260], [1580, 1500, 70, 280], [1634, -2200, 114, 494], [-1227, -2722, 129, 196], [-391, -2867, 104, 204], [97, -1912, 105, 381], [-60, 1500, 90, 380], [-1363, 1166, 113, 91], [2403, -567, 103, 428], [-2172, -1713, 75, 185], [123, -1472, 128, 394]];
  for (const m of MD) { column(M, m[0], m[1], m[2], m[2], m[3], MO.length * 3.7 + 1, 0); MO.push(m) }
  // drifting rocks
  for (let c = 0; c < 26; c++) {
    const I = IS[c % IS.length], a = rng() * TAU, d = I.R * (1.12 + rng() * .5), bx = I.cx + cos(a) * d, by = I.cy - 60 - rng() * 160, bz = I.cz + sin(a) * d, i0 = M.ni;
    for (let k = 0; k < 6; k++) { const r = 5 + rng() * rng() * 34, x = bx + (rng() - .5) * 160, y = by + (rng() - .5) * 120, z = bz + (rng() - .5) * 160; rock(M, x, y, z, r, grp([x, y, z], 0, 10 + rng() * 18, 7 + rng() * 12, 10 + rng() * 18, (rng() - .5) * .3, 2.5 + rng() * 3), rng() * 99) }
    M.item(i0, 30);
  }
  // bridges
  const rimP = (I, th, rn) => { const r = rimR(I, th) * rn, x = I.cx + cos(th) * r, z = I.cz + sin(th) * r; return [x, topY(I, x, z, rn) - 1, z] };
  let a = atan2(east.cz, east.cx); bridge(W, rimP(home, a, .9), rimP(east, a + PI, .9), 13, 26, 6);
  a = atan2(far.cz - east.cz, far.cx - east.cx); bridge(W, rimP(east, a, .9), rimP(far, a + PI, .9), 12, 34, 7);
  a = atan2(MD[0][1], MD[0][0]); { const A = rimP(home, a, .92), B = [MD[0][0], MD[0][3] + 3, MD[0][1]], i0 = M.ni; bridge(W, A, B, 12, 22, 5, [.52, .7]); const j0 = M.ni; for (let k = 0; k < 11; k++) { const t = .5 + rng() * .22, x = mix(A[0], B[0], t) + rng() * 30 - 15, y = mix(A[1], B[1], t) + 12 - rng() * rng() * 110, z = mix(A[2], B[2], t) + rng() * 30 - 15; rock(M, x, y, z, 1.5 + rng() * 5, grp([x, y, z], 0, 3 + rng() * 5, 3 + rng() * 6, 3 + rng() * 5, (rng() - .5) * .2, 2 + rng() * 3), rng() * 99) } M.item(j0, 20) }
  // giant trees
  const SH = [165, 432, 86, .95, -.2, .22, 210, 27]; // airship: offset xyz from T0 base, yaw, pitch, roll, L, Rm
  const giant = (I, bx, bz, H, ti, ship) => {
    const g = I.g, by = I.fy ?? topY(I, bx, bz, isR(I, bx, bz)), R0 = H * .06, i0 = M.ni, v0 = M.nv, tl = H * (.46 + .1 * rng()), key = 'g' + ti, P = [];
    const lx = (rng() - .5) * .5, lz = (rng() - .5) * .5, K = 4 + (rng() * 3 | 0), ph = rng() * TAU, spread = .85 + .5 * rng(), wob = R0 * (.6 + rng());
    const tp = t => [bx + lx * tl * t * t + sin(t * 4 + ph) * wob * t, by + tl * t, bz + lz * tl * t * t + cos(t * 3.3 + ph) * wob * t];
    for (let i = 0; i <= 16; i++) { const t = i / 16, c = tp(t); P.push(c[0], c[1] - R0 * 1.2 * (1 - t), c[2], R0 * (1 + 2.1 * exp(-7 * t)) * (1 - .3 * t), 0) }
    const tv0 = M.nv; tube(M, P, 28, 2, 255, g, (th, t) => 1 + .6 * exp(-5 * t) * pow(.5 + .5 * cos(th * K + ph + t * 2), 2) + .1 * cos(th * K + ph + t * 7) + .2 * (vn(cos(th) * 3 + bx, t * 9, sin(th) * 3) - .5), 0); const tv1 = M.nv;
    for (let k = 0; k < 8; k++) { const a0 = k / 8 * TAU + rng() * .6, l = R0 * (2.2 + 2.6 * rng()), bend = (rng() - .5) * 2.2, wv = rng() * 9, Q = []; for (let j = 0; j <= 9; j++) { const t = j / 9, a = a0 + bend * t * t, d = R0 * .8 + l * t, w = sin(t * 5 + wv) * R0 * .35 * t; Q.push(bx + cos(a) * d - sin(a) * w, by + R0 * 2.4 * pow(1 - t, 2.6) - R0 * .6 * t, bz + sin(a) * d + cos(a) * w, R0 * mix(.62, .07, pow(t, .7)), 0) } tube(M, Q, 9, 2, 235, g, null, 1) }
    W.cap.push(bx, by, bz, ...tp(1), R0 * 1.5);
    const sa = ship && [cos(SH[4]) * sin(SH[3]), sin(SH[4]), -cos(SH[4]) * cos(SH[3])], sc = ship && [bx + SH[0], by + SH[1], bz + SH[2]];
    const limb = (p, d, len, rad, lvl, sw, bare) => {
      const ns = lvl == 1 ? 10 : lvl == 2 ? 6 : 4, Q = [], sl = len / ns, cu = lvl == 1 ? .26 : .3, lift = lvl == 1 ? .11 : lvl == 2 ? .03 : -.04; let [x, y, z] = p, [dx, dy, dz] = d;
      for (let i = 0; i <= ns; i++) {
        const t = i / ns; Q.push(x, y, z, rad * (1 - (lvl == 3 || bare ? .82 : lvl == 1 ? .66 : .55) * t), sw + (lvl == 1 ? .25 : .36) * t * t);
        dx += (rng() - .5) * 2 * cu; dy += (rng() - .5) * cu + lift; dz += (rng() - .5) * 2 * cu; const l = sqrt(dx * dx + dy * dy + dz * dz); dx /= l; dy /= l; dz /= l; x += dx * sl; y += dy * sl; z += dz * sl;
      }
      tube(M, Q, lvl == 1 ? 14 : lvl == 2 ? 8 : 5, 2, lvl == 1 ? 235 : 200, g, null, lvl == 3 || bare ? 1 : 0);
      if (lvl < 3) for (let i = 0; i < ns; i++) { const o = i * 5; W.cap.push(Q[o], Q[o + 1], Q[o + 2], Q[o + 5], Q[o + 6], Q[o + 7], Q[o + 3]) }
      if (bare) return;
      const at = t => { const i = min(ns - 1, floor(t * ns)), o = i * 5; return [[Q[o], Q[o + 1], Q[o + 2]], nrm([Q[o + 5] - Q[o], Q[o + 6] - Q[o + 1], Q[o + 7] - Q[o + 2]]), Q[o + 3], Q[o + 4]] };
      if (lvl == 1 && ti < 7) for (const t of [.3, .45]) { const [q, tg, r] = at(t); LB.push([ti, q[0], q[1], q[2], r, tg[0], tg[1], tg[2]]) }
      if (lvl < 3) {
        const nc = 3;
        for (let c = 0; c <= nc; c++) {
          const tip = c == nc, t = tip ? .999 : (lvl == 1 ? .46 : .3) + .5 * (c + rng() * .7) / nc, [q, tg, r, s] = at(t), sd = nrm(crs(tg, [0, 1, 0])), e = (c % 2 ? 1 : -1) * (.6 + rng() * .5), u = .1 + rng() * .35;
          const cd = tip ? tg : nrm([tg[0] * .6 + sd[0] * e, tg[1] * .6 + u, tg[2] * .6 + sd[2] * e]);
          limb(q, cd, len * (lvl == 1 ? .46 : .52) * (tip ? .8 : 1.1 - .4 * t), r * (tip ? .95 : .8), lvl + 1, s);
        }
        const nh = lvl == 1 ? 8 : 3;
        for (let k = 0; k < nh; k++) { const [q, , r, s] = at(.2 + rng() * .8); if (rng() < .6) W.vine(key, [q[0], q[1] - r, q[2]], [q[0] + (rng() - .5) * H * .05, q[1] - r - 18 - rng() * rng() * H * .32, q[2] + (rng() - .5) * H * .05], 0, s, 1, g); else W.plant(key, [q[0], q[1] - r * .9, q[2]], 9 + rng() * 11, s, 0, g) }
      } else for (const t of [.55, .8, 1]) {
        const [q, , , s] = at(min(t, .999)), r = (7 + H * .025) * (.8 + .65 * rng()), c = [q[0] + (rng() - .5) * r, q[1] + (rng() - .3) * r * .6, q[2] + (rng() - .5) * r];
        if (ship) { const e = [c[0] - sc[0], c[1] - sc[1], c[2] - sc[2]], al = clamp(e[0] * sa[0] + e[1] * sa[1] + e[2] * sa[2], -SH[6] / 2, SH[6] / 2); if ((e[0] - sa[0] * al) ** 2 + (e[1] - sa[1] * al) ** 2 + (e[2] - sa[2] * al) ** 2 < (SH[7] + r + 34) ** 2) continue }
        cluster(key, c[0], c[1], c[2], r, .72 + rng() * .28, s, g);
      }
    };
    const nl = 5 + (rng() * 3 | 0), hero = rng() * nl | 0;
    for (let k = 0; k < nl; k++) { const f = k / (nl - 1), az = k * 2.39996 + rng() * .7 + ph, el = mix(-.02, .5, f) + rng() * .18, t = mix(.5, .97, f) + (rng() - .5) * .06; limb(tp(t), [cos(az) * cos(el), sin(el), sin(az) * cos(el)], H * mix(.36, .24, f) * spread * (k == hero ? 1.3 : .8 + .35 * rng()), R0 * (1 - .3 * t) * mix(.55, .42, f), 1, 0) }
    limb(tp(1), nrm([lx * .5, 1, lz * .5]), H * .26, R0 * .7 * .7, 1, 0);
    M.norm(v0, i0); M.item(i0, I.pad);
    if (ti < 7) for (let k = 0, n = 0; k < 600 && n < 4; k++) { const v = tv0 + (FR() * (tv1 - tv0) | 0), y = M.p[v * 3 + 1], ny = M.n[v * 4 + 1]; if (y < by + 15 || y > by + 150 || abs(ny) > .3) continue; LZ.push([M.p[v * 3], y, M.p[v * 3 + 2], M.n[v * 4], ny, M.n[v * 4 + 2]]); n++ }
    return by;
  };
  const GT = [[home, 70, -110, 680], [home, -310, -220, 550], [home, 330, 160, 510], [home, -270, 250, 490], [home, 360, -310, 460], [home, -440, 30, 430], [home, 30, -430, 470], [east, 60 + 1090, 400 - 70, 400], [east, 1090 - 120, 400 + 110, 350], [far, 1820, 1020, 360]];
  GT.push([{ g: 0, pad: 0, fy: MT + 6 }, MX + 30, MZ + 40, 340]);
  for (let i = 3; i < IS.length; i++)GT.push([IS[i], IS[i].cx + (rng() - .5) * 60, IS[i].cz + (rng() - .5) * 60, 240 + rng() * 150]);
  let gy0 = 0; GT.forEach((t, i) => { const y = giant(t[0], t[1], t[2], t[3], i, i == 0); if (!i) gy0 = y; if (i < 7) TB.push([t[1], y, t[2]]) });
  // airship skeleton in T0
  {
    const [ox, oy, oz, yaw, pit, rol, L, Rm] = SH, C = [GT[0][1] + ox, gy0 + oy, GT[0][2] + oz], A = [cos(pit) * sin(yaw), sin(pit), -cos(pit) * cos(yaw)]; let S = [cos(yaw), 0, sin(yaw)], U = crs(S, A);
    const cr = cos(rol), sr = sin(rol), S2 = [S[0] * cr + U[0] * sr, S[1] * cr + U[1] * sr, S[2] * cr + U[2] * sr], U2 = [U[0] * cr - S[0] * sr, U[1] * cr - S[1] * sr, U[2] * cr - S[2] * sr];
    const X = (a, s, u) => [C[0] + A[0] * a + S2[0] * s + U2[0] * u, C[1] + A[1] * a + S2[1] * s + U2[1] * u, C[2] + A[2] * a + S2[2] * s + U2[2] * u], hr = a => Rm * pow(max(0, 1 - (a / (L / 2)) ** 2), .55);
    const i0 = M.ni, v0 = M.nv, nr = 24, ra = k => -L * .46 + L * .92 * k / (nr - 1), hp = (a, th, e) => X(a, cos(th) * (hr(a) + (e || 0)), sin(th) * (hr(a) + (e || 0)) * .92);
    W.ship = { C, A, L, Rm };
    for (let k = 0; k < nr; k++) {
      const a = ra(k), big = k % 4 == 0, brk = !big && rng() < .4, a0 = brk ? rng() * TAU : 0, sw = brk ? TAU * (.4 + .45 * rng()) : TAU, n = ceil(30 * sw / TAU), P = [];
      for (let j = 0; j <= n; j++)P.push(...hp(a, a0 + sw * j / n), big ? 1.3 : .8, 0);
      tube(M, P, 7, big ? 5 : 4, 235, 0, null, brk ? 3 : 0);
    }
    for (let s = 0; s < 12; s++) { const th = s / 12 * TAU, keel = s == 9; let a = -L * .47; while (a < L * .47) { const b = min(L * .47, a + L * (.12 + .3 * rng())); if (keel || rng() < .7) { const n = ceil((b - a) / 5), P = []; for (let j = 0; j <= n; j++)P.push(...hp(mix(a, b, j / n), th, .3), keel ? 1.8 : .6, 0); tube(M, P, 6, 4, 235, 0, null, 3) } a = b + (keel ? 0 : rng() * 9) } }
    for (let f = 0; f < 4; f++) { const th = f / 4 * TAU + PI / 4, a0 = -L * .36, P = []; for (const [da, dr] of [[0, 0], [-16, 17], [-26, 15], [-24, 0], [0, 0], [-26, 15]]) P.push(...hp(a0 + da, th, dr + (da ? 0 : .5)), .5, 0); tube(M, P, 5, 5, 235, 0, null, 3) }
    for (let k = 0; k < 7; k++) { const a = -L * .02 + k * 5.5 - 16, w = 5.2 * sin((k + .6) / 7.2 * PI), P = []; for (let j = 0; j <= 8; j++) { const t = j / 8 * PI; P.push(...X(a, -cos(t) * w, -Rm - 15 + 2 - sin(t) * 7), .35, 0) } tube(M, P, 5, 4, 235, 0, null, 3) }
    for (const s of [-1, 0, 1]) { const P = []; for (let k = 0; k <= 8; k++) { const a = -L * .02 + k * 4.6 - 18, w = 5.2 * sin((k * 4.6 / 5.5 + .1) / 7.2 * PI); P.push(...X(a, s * w, -Rm - 13 - (s ? 0 : 7)), .4, 0) } tube(M, P, 5, 5, 235, 0, null, 3) }
    for (let k = 0; k < 6; k++) { const a = -L * .02 - 14 + k * 6, s = k % 2 ? 3.5 : -3.5; tube(M, [...X(a, s, -Rm - 13), .22, 0, ...hp(a + 2, 1.5 * PI + s * .04), .22, 0], 4, 4, 235, 0, null, 0) }
    for (let k = 0; k < nr - 1; k++)for (let s = 0; s < 12; s++) { // cloth tatters above, planking remnants below
      const sn = sin((s + .5) / 12 * TAU), wood = sn < -.45; if (rng() > (wood ? .62 : sn > 0 ? .3 : .08)) continue;
      const b = M.nv, G = 4; for (let j = 0; j <= G; j++)for (let i = 0; i <= G; i++) { const a = mix(ra(k), ra(k + 1), i / G), th = (s + j / G) / 12 * TAU, sg = wood ? .5 : -1.6 * sin(i / G * PI) * sin(j / G * PI) - .4; M.v(...hp(a, th, sg), 0, wood ? 4 : 6, wood ? 200 : 235, 0, 255) }
      const gp = [0, 1, 2, 3].map(() => rng() < .3);
      for (let j = 0; j < G; j++)for (let i = 0; i < G; i++) if (!wood || !gp[j]) { const a = b + j * (G + 1) + i; M.t(a, a + 1, a + G + 1); M.t(a + 1, a + G + 2, a + G + 1) }
    }
    for (let h = 0; h < 4; h++) { // boughs growing up through the hull
      const a = -L * .3 + h * L * .2, p0 = [GT[0][1] + (rng() - .5) * 30, gy0 + GT[0][3] * (.3 + .05 * h), GT[0][2] + (rng() - .5) * 30], p1 = X(a, (rng() - .5) * 12, -Rm * .3), p2 = X(a + 14 * (rng() - .5), (rng() - .5) * 24, Rm + 4 + rng() * 8), P = [];
      for (let j = 0; j <= 14; j++) { const t = j / 14, u = 1 - t; P.push(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0] + sin(t * 7 + h) * 3, u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1], u * u * p0[2] + 2 * u * t * p1[2] + t * t * p2[2] + cos(t * 6 + h) * 3, mix(7, 2.6, t), .12 * t) }
      tube(M, P, 9, 2, 220, 0, null, 1); for (let c = 0; c < 3; c++)cluster('g0', p2[0] + (rng() - .5) * 34, p2[1] + 4 + rng() * 10, p2[2] + (rng() - .5) * 34, 13 + rng() * 8, .8, .3, 0);
    }
    for (let h = 0; h < 3; h++) { const P = [], th0 = rng() * TAU, dir = h % 2 ? 1 : -1; for (let j = 0; j <= 26; j++) { const a = mix(-L * .32, L * .36, j / 26); P.push(...hp(a, th0 + a * .075 * dir, 1.4), mix(2, .6, j / 26), .1) } tube(M, P, 7, 2, 220, 0, null, 1); for (const j of [26]) cluster('g0', P[j * 5], P[j * 5 + 1] + 6, P[j * 5 + 2], 11 + rng() * 5, .8, .2, 0) }
    M.norm(v0, i0); M.item(i0, 0);
    for (let k = 0; k < 70; k++) { const r = rng() * (nr - 3) | 0, th = rng() * TAU, p0 = hp(ra(r), th, .5); if (k < 42) { const p1 = hp(ra(r + 1 + (rng() * 2 | 0)), th + (rng() - .5) * 2.2, .5), d = sqrt((p0[0] - p1[0]) ** 2 + (p0[1] - p1[1]) ** 2 + (p0[2] - p1[2]) ** 2); W.vine('s', p0, p1, d * (.15 + rng() * .4), 0, 0, 0) } else { const q = hp(ra(r), PI + rng() * PI, .5); W.vine('s', q, [q[0] + rng() * 4, q[1] - 14 - rng() * 60, q[2] + rng() * 4], 0, 0, 1, 0) } }
    for (let k = 0; k < 14; k++) { const q = hp(ra(rng() * (nr - 1) | 0), PI + rng() * PI, 0); W.plant('s', q, 7 + rng() * 6, 0, 0, 0) }
    for (let k = 0; k < 9; k++) { const a = -L * .45 + k * L * .9 / 8, p = X(a, 0, 0), q = X(a + L * .9 / 8, 0, 0); W.cap.push(...p, ...q, hr(a) + 2) }
  }
  // understory canopy, golden tufts, rim vines & ferns
  IS.forEach((I, ii) => {
    const g = I.g, R = I.R * 1.25;
    for (let z = I.cz - R; z < I.cz + R; z += 23)for (let x = I.cx - R; x < I.cx + R; x += 23) {
      const px = x + rng() * 23, pz = z + rng() * 23, rn = isR(I, px, pz); if (rn > .96) continue;
      const f = I.ff(px, pz); if (f < .5) continue;
      let ok = 1; for (const t of GT) if (t[0] == I && (px - t[1]) ** 2 + (pz - t[2]) ** 2 < (t[3] * .08) ** 2) ok = 0; if (!ok) continue;
      const y = topY(I, px, pz, rn), h = 13 + rng() * rng() * 42, r = .9 + rng() * .7, tx = px + (rng() - .5) * 5, tz = pz + (rng() - .5) * 5, key = 'u' + ii + '_' + floor(px / 220) + '_' + floor(pz / 220);
      (I.tr = I.tr || []).push([px, y - 2, pz, r * 1.6, 0, (px + tx) / 2, y + h * .5, (pz + tz) / 2, r, .04, tx, y + h, tz, r * .6, .1]);
      const nc = 4 + (rng() * 3 | 0); for (let c = 0; c < nc; c++)cluster(key, tx + (rng() - .5) * h, y + h * (.42 + .62 * c / nc + .1 * rng()), tz + (rng() - .5) * h, h * (.42 + .24 * rng()) * (1.15 - .4 * c / nc), rng() * .3, .1 + rng() * .06, g);
    }
    if (I.tr) { const i0 = M.ni, v0 = M.nv; for (const P of I.tr) { tube(M, P, 5, 2, 215, g, null, 0); W.cap.push(P[0], P[1], P[2], P[10], P[11], P[12], 2) } M.norm(v0, i0); M.item(i0, I.pad, 1) }
    for (let z = I.cz - R; z < I.cz + R; z += 6)for (let x = I.cx - R; x < I.cx + R; x += 6) {
      const px = x + rng() * 6, pz = z + rng() * 6, rn = isR(I, px, pz); if (rn > .95) continue;
      const f = I.ff(px, pz); if (f > .52 || rng() < .25) continue;
      W.plant('t' + ii + '_' + floor(px / 160) + '_' + floor(pz / 160), [px, topY(I, px, pz, rn) - .2, pz], 3 + rng() * 3.5, 0, 1, g);
    }
    const nv = I.R * .22 | 0;
    for (let k = 0; k < nv; k++) { const th = rng() * TAU, rn = .7 + rng() * .28, r = rimR(I, th) * rn, x = I.cx + cos(th) * r, z = I.cz + sin(th) * r, y = botY(I, x, z, rn) + 2; if (k % 3) W.vine('i' + ii, [x, y, z], [x + rng() * 24 - 12, y - 30 - rng() * rng() * 150, z + rng() * 24 - 12], 0, 0, 1, g); else W.plant('i' + ii, [x, y, z], 10 + rng() * 12, 0, 0, g) }
    for (let k = 0; k < I.R * .4; k++) { const th = rng() * TAU, rn = .975 + rng() * .02, r = rimR(I, th) * rn, x = I.cx + cos(th) * r, z = I.cz + sin(th) * r, y = topY(I, x, z, rn) - 2; if (k % 2) W.vine('i' + ii, [x, y, z], [x + cos(th) * 6 + rng() * 14 - 7, y - 25 - rng() * 90, z + sin(th) * 6 + rng() * 14 - 7], 0, 0, 1, g); else W.plant('i' + ii, [x + cos(th) * 3, y - 2, z + sin(th) * 3], 9 + rng() * 10, 0, 0, g) }
    { const j0 = M.ni; for (let k = 0; k < I.R * .07; k++) { const th = rng() * TAU, rn = k % 3 ? .88 + rng() * .11 : rng() * .8, r = rimR(I, th) * rn, x = I.cx + cos(th) * r, z = I.cz + sin(th) * r, rr = 5 + rng() * rng() * 22; rock(M, x, topY(I, x, z, rn) + rr * .15, z, rr, g, rng() * 99) } M.item(j0, I.pad) }
    W.st.set([I.cx, I.cy - I.D * .35, I.cz, I.R * .92], ii * 4);
  });
  W.st.set([MX, 0, MZ, 330], IS.length * 4);
  { const j0 = M.ni; for (let k = 0; k < 16; k++) { const d = sq(rng() * rng() * 4, 5), q = .7 + .28 * rng(), rr = 5 + rng() * rng() * 30; rock(M, MX + MRX * d[0] * q, MT + 2 + rr * .1, MZ + MRZ * d[1] * q, rr, 0, rng() * 99) } M.item(j0, 0) }
  { const i0 = M.ni, v0 = M.nv; for (let j = 0; j < 150; j++) { const a = rng() * 2 - 1, b = rng() * 2 - 1; if (pow(abs(a), 5) + pow(abs(b), 5) > .55) continue; const x = MX + a * MRX, z = MZ + b * MRZ, y = MT + 5; if (j % 3 == 0 || (x - MX - 30) ** 2 + (z - MZ - 40) ** 2 < 2500) { W.plant('tw' + (j & 3), [x, y, z], 3 + rng() * 3.5, 0, 1, 0); continue } const h = 13 + rng() * 26; for (let c = 0; c < 4; c++)cluster('w' + (j & 1), x + (rng() - .5) * h, y + h * (.42 + .16 * c + .1 * rng()), z + (rng() - .5) * h, h * (.42 + .24 * rng()) * (1.15 - .1 * c), rng() * .3, .1, 0); tube(M, [x, y - 4, z, 1.6, 0, x, y + h * .5, z, 1.2, .03, x, y + h, z, .7, .08], 5, 2, 215, 0, null, 0) } M.norm(v0, i0); M.item(i0, 0, 1) }
  // monolith tops
  MO.forEach((m, k) => { for (let j = 0; j < 14; j++) { const a = rng() * TAU, r = rng() * m[2] * .5, x = m[0] + cos(a) * r, z = m[1] + sin(a) * r; if (j < 6) { const h = 13 + rng() * 22; for (let c = 0; c < 4; c++)cluster('m' + k, x + (rng() - .5) * h, m[3] + h * (.42 + .16 * c + .1 * rng()), z + (rng() - .5) * h, h * (.42 + .24 * rng()) * (1.15 - .1 * c), rng() * .3, .1, 0); (m.tr = m.tr || []).push([x, m[3] - 4, z, 1.6, 0, x, m[3] + h * .5, z, 1.2, .03, x, m[3] + h, z, .7, .08]) } else W.plant('tm' + k, [x, m[3] + 3, z], 2.5 + rng() * 2.5, 0, 1, 0) } for (let j = 0; j < 22; j++) { const a = rng() * TAU, r = m[2] * (.7 + .15 * rng()), p = [m[0] + cos(a) * r, m[3] - 4 - rng() * 30, m[1] + sin(a) * r]; if (j % 2) W.vine('m' + k, p, [p[0] + rng() * 16 - 8, p[1] - 30 - rng() * 110, p[2] + rng() * 16 - 8], 0, 0, 1, 0); else W.plant('m' + k, p, 9 + rng() * 9, 0, 0, 0) }
    const i0 = M.ni, v0 = M.nv; for (const P of m.tr) tube(M, P, 5, 2, 215, 0, null, 0); M.norm(v0, i0); for (let j = 0; j < 7; j++) { const a = rng() * TAU, r = m[2] * (.7 + .3 * rng()), rr = 4 + rng() * 9; rock(M, m[0] + cos(a) * r, m[3] + 2, m[1] + sin(a) * r, rr, 0, rng() * 99) } M.item(i0, 0, 1) });
  // thermals (x,z,radius,phase), creatures, particles
  const TH = [[-180, 900, 62, 1], [690, -760, 60, 2], [1480, 330, 75, 3], [-1560, -260, 80, 4]];
  TH.forEach((t, i) => W.st.set(t, 96 + i * 4));
  const flock = (c, R, n, kind, size, spd, va, fp) => { const ph = rng() * TAU; for (let i = 0; i < n; i++) { const row = (i + 1) >> 1, sd = i & 1 ? 1 : -1; CR.push(c[0], c[1], c[2], R, ph - (kind ? rng() * 1.4 : row * size * (1 + 1.4 * rng()) / R), spd, kind, size * (.7 + .6 * rng()), kind ? (rng() - .5) * R * .7 : sd * row * size * (.7 + 1.3 * rng()), kind ? (rng() - .5) * 50 : (rng() - .5) * size * 1.6 - row * 1.5, rng() * TAU, va) } };
  flock([120, 420, -150], 620, 21, 0, 11, 34, 60); flock([-300, 300, 500], 900, 17, 0, 12, 38, 90); flock([1300, 380, -300], 520, 15, 0, 10, 30, 50); flock([-180, 330, 900], 170, 13, 0, 9, 22, 180); flock([-1300, 520, -900], 700, 19, 0, 11, 36, 70); flock([600, 560, 1500], 800, 15, 0, 12, 40, 80); flock([70, 640, -110], 430, 7, 0, 26, 34, 50); flock([1560, 600, -520], 420, 5, 0, 22, 28, 40);
  flock([-180, -190, 900], 140, 34, 1, 7, 14, 110); flock([690, 120, -760], 95, 30, 1, 6.5, 13, 220); flock([1480, 0, 330], 120, 30, 1, 7, 15, 240); flock([300, -260, 760], 420, 36, 1, 8, 18, 60);
  for (let i = 0; i < 5000; i++)PA.push(rng() * 180, rng() * 180, rng() * 180, .06 + rng() * .07, rng(), 0, rng(), rng());
  TH.forEach((t, k) => { for (let i = 0; i < 1500; i++)PA.push(t[0], -620, t[1], .7 + rng() * 1.1, rng(), 1, .5 + rng(), sqrt(rng()) * t[2] * .8) });
  // butterflies (creature kind 2 + hue) over the home island meadows, around the trunks and on the rim facing the spawn
  const gH = (x, z) => topY(home, x, z, isR(home, x, z)), bfly = (x, z, R, n) => { const y = gH(x, z) + 30 + FR() * 30; for (let i = 0; i < n; i++)CR.push(x, y, z, R * (.6 + .6 * FR()), FR() * TAU, 6 + 5 * FR(), 2 + min(FR(), .999), 2.2 + FR(), (FR() - .5) * R * .6, (FR() - .5) * 16, FR() * TAU, 10 + FR() * 14) };
  const open = (x, z) => isR(home, x, z) < .82 && TB.every(b => (x - b[0]) ** 2 + (z - b[2]) ** 2 > 230 * 230); // meadow clear of the giant trunks and roots
  for (let j = 0, k = 0; j < 22 && k < 4000; k++) { const near = j < 6, a = near ? 2.26 + (FR() - .5) * .9 : FR() * TAU, r = 640 * (near ? .5 + .3 * FR() : sqrt(FR()) * .82), x = cos(a) * r, z = sin(a) * r; if (!open(x, z)) continue; bfly(x, z, 30 + FR() * 20, 6 + (FR() * 4 | 0)); j++ }
  // golden moth swarms circling the canopies (particle mode 2: centre, size | orbit radius, mode, speed, seed)
  for (let s = 0; s < 90; s++) { const k = (FR() * GC.length / 4 | 0) * 4, r = GC[k + 3]; for (let i = 0; i < 32; i++)PA.push(GC[k], GC[k + 1], GC[k + 2], .45 + FR() * .35, r * (1.25 + .7 * FR()), 2, FR(), FR()) }
  // ground & tree fauna (FAUNA pipeline; instance = 4 vec4: see the shader). groups: deer, fox, rabbit, snail, bird, lizard, glider, nest, chick
  const FA = [[], [], [], [], [], [], [], [], []], fa = (k, a) => { for (const v of a) FA[k].push(v) };
  const spotO = d => { for (let k = 0; k < 4000; k++) { const a = FR() * TAU, r = 640 * sqrt(FR()) * .78, x = cos(a) * r, z = sin(a) * r; if (isR(home, x, z) < .8 && TB.every(b => (x - b[0]) ** 2 + (z - b[2]) ** 2 > d * d)) return [x, z] } return [0, 0] };
  for (let h = 0; h < 4; h++) { const [x, z] = spotO(280), n = 5 + (FR() * 3 | 0), R = 30 + FR() * 25, sp = 1.6 + FR() * .8, ph = FR() * TAU, sd = FR() * 99; for (let i = 0; i < n; i++)fa(0, [x + (FR() - .5) * 30, 0, z + (FR() - .5) * 30, 8 + FR() * 2.5, ph - i * (.18 + .1 * FR()), sp, 0, R * (.8 + .4 * FR()), 0, 0, 0, 0, sd + i * .013, 0, 0, 0]) }
  for (let i = 0; i < 4; i++) { const [x, z] = spotO(230); fa(1, [x, 0, z, 6.5 + FR(), FR() * TAU, 3 + FR(), 0, 40 + FR() * 40, 0, 0, 0, 0, FR() * 99, 0, 0, 1]) }
  for (let g = 0; g < 8; g++) { const [x, z] = spotO(200); for (let i = 0; i < 3; i++)fa(2, [x + (FR() - .5) * 20, 0, z + (FR() - .5) * 20, 3.5 + FR(), FR() * TAU, 2 + FR(), 1, 10 + FR() * 12, 0, 0, 0, 0, FR() * 99, 0, 0, 0]) }
  for (const [A, B, w, rise, gap] of W.br) for (let i = 0, k = 0; i < 3 && k < 50; k++) { const s0 = .12 + .76 * FR(); if (gap && s0 > gap[0] - .06 && s0 < gap[1] + .06) continue; const a = 6 + FR() * 6, b = 2 + FR() * (w - 6); fa(3, [A[0], A[1], A[2], 3.5, s0, .35 / ((a + b) / 2), 2, b, B[0], B[1], B[2], rise, FR() * 99, FR() * TAU, a, 0]); i++ }
  for (let ti = 0; ti < 7; ti++) { // two nests per home tree on near-level big limbs, a parent bird that flies loops from each, chicks
    const C = LB.filter(l => l[0] == ti && abs(l[6]) < .45); for (let k = 0; k < 2 && C.length; k++) {
      const l = C.splice(FR() * C.length | 0, 1)[0], N = [l[1], l[2] + l[4] / sqrt(1 - l[6] * l[6]) * .85, l[3]], b = TB[ti], o = nrm([N[0] - b[0], 0, N[2] - b[2]]);
      fa(7, [N[0], N[1], N[2], 5.5, FR() * TAU, 0, 6, 0, 0, 0, 0, 0, FR() * 99, 0, 0, 0]);
      for (let c = 0; c < 3; c++) { const a = c * 2.1 + FR(), r = .9 + .4 * FR(); fa(8, [N[0] + cos(a) * r, N[1] + .3, N[2] + sin(a) * r, 5, a + PI + (FR() - .5), 0, 7, 0, 0, 0, 0, 0, FR() * 99, 0, 0, 0]) }
      fa(4, [N[0], N[1], N[2], 2.4, FR(), 30 + FR() * 25, 3, 28 + FR() * 20, o[0], o[2], 14 + FR() * 10, 0, FR() * 99, 0, 0, 0]);
    }
  }
  for (const z of LZ) fa(5, [z[0] + z[3] * .15, z[1] + z[4] * .15, z[2] + z[5] * .15, 4.5, 0, 8 + FR() * 8, 4, 0, z[3], z[4], z[5], 0, FR() * 99, 0, 0, 0]);
  for (let g = 0, k = 0; g < 10 && k < 500; k++) { // gliders: cling under a big limb, glide to a limb on a neighbouring tree and back
    const a = LB[FR() * LB.length | 0], C = LB.filter(b => b[0] != a[0] && abs(b[6]) < .5 && abs(b[2] - a[2]) < 90 && (b[1] - a[1]) ** 2 + (b[3] - a[3]) ** 2 > 90 * 90 && (b[1] - a[1]) ** 2 + (b[3] - a[3]) ** 2 < 320 * 320); if (abs(a[6]) > .5 || !C.length) continue;
    const b = C[FR() * C.length | 0], d = sqrt((b[1] - a[1]) ** 2 + (b[3] - a[3]) ** 2), ub = l => l[2] - l[4] / sqrt(1 - l[6] * l[6]) - .1; // underside of a tilted limb
    fa(6, [a[1], ub(a), a[3], 3.2, FR(), 26 + FR() * 20, 5, d * .22, b[1], ub(b), b[3], 0, FR() * 99, 0, 0, 0]); g++;
  }
  const FK = ['deer', 'fox', 'rabbit', 'snail', 'bird', 'lizard', 'glider', 'nest', 'chick']; let fo = 0;
  W.fa = { d: new Float32Array(FA.flat()), g: FA.map((a, k) => { const r = [FK[k], fo, a.length / 16]; fo += a.length / 16; return r }) };
  W.hm = new Float32Array(256 * 256); for (let j = 0; j < 256; j++)for (let i = 0; i < 256; i++) { const x = -850 + i / 255 * 1700, z = -850 + j / 255 * 1700; W.hm[j * 256 + i] = topY(home, x, z, min(isR(home, x, z), 1)) } // home-island ground height for walkers
  W.th = TH;
  // pack
  W.cl = CL.build((b, k) => b[k + 3] * 1.4 + 50); W.pl = PL.build((b, k) => b[k + 3] + 50); W.tu = TU.build((b, k) => b[k + 3] + 50); W.vi = VI.build((b, k) => b[k + 10] > 1.5 ? 1500 : 200);
  W.cr = new Float32Array(CR); W.nb = CR.filter((v, i) => i % 12 == 6 && !v).length; W.nr = CR.filter((v, i) => i % 12 == 6 && v == 1).length; W.pa = new Float32Array(PA);
  W.vb = M.pack(); W.ib = M.i.subarray(0, M.ni); W.items = new Float32Array(M.items);
  W.cap = new Float32Array(W.cap); W.sph = new Float32Array(W.sph);
  W.cm = clusterMesh(NLEAF, rng); W.fern = fernMesh(rng); W.tuft = tuftMesh(rng); W.bird = birdMesh(); W.ray = rayMesh(); W.bfly = butterflyMesh(); W.fm = faunaMeshes();
  // clearance to the nearest solid (dev tool for validating camera paths)
  W.gs = (x, y, z) => {
    let d = 1e9;
    for (const I of IS) { const rn = isR(I, x, z); if (rn < 1) { const t = topY(I, x, z, rn), b = botY(I, x, z, rn); d = min(d, y > t ? y - t : y < b ? b - y : -1) } else d = min(d, sqrt(((rn - 1) * I.R) ** 2 + (y - I.cy + 7) ** 2)) }
    for (const m of MO) if (y < m[3] + 10) d = min(d, sqrt((x - m[0]) ** 2 + (z - m[1]) ** 2) - m[2] * 2.3);
    if (y < MT + 10) d = min(d, max(abs(x - MX) - MRX * 1.1, abs(z - MZ) - MRZ * 1.1));
    const s = W.sph, c = W.cap; for (let i = 0; i < s.length; i += 4)d = min(d, sqrt((x - s[i]) ** 2 + (y - s[i + 1]) ** 2 + (z - s[i + 2]) ** 2) - s[i + 3]);
    for (let i = 0; i < c.length; i += 7) { const ax = c[i + 3] - c[i], ay = c[i + 4] - c[i + 1], az = c[i + 5] - c[i + 2], t = clamp(((x - c[i]) * ax + (y - c[i + 1]) * ay + (z - c[i + 2]) * az) / (ax * ax + ay * ay + az * az || 1), 0, 1); d = min(d, sqrt((x - c[i] - ax * t) ** 2 + (y - c[i + 1] - ay * t) ** 2 + (z - c[i + 2] - az * t) ** 2) - c[i + 6]) }
    return d;
  };
  return W;
}
