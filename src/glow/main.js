// ---------- Glowcap Hollow runtime (HO = shared host, WI = this world's index)
const main = async (HO, WI) => {
  const qs = HO.Q, CAP = qs.has('cap') && HO.first === WI, BENCH = qs.has('bench') && HO.first === WI;
  const cv = HO.cv, dev = HO.dev, ctx = HO.ctx, on = () => HO.cur === WI, PU = HO.PU[WI], CF = HO.FMT, HF = 'rgba16float';
  const say = s => HO.say(s, WI);
  say('Growing the hollow…'); await new Promise(r => setTimeout(r));
  const M = glowMeshes(), G = genGlow(M);
  const BU = GPUBufferUsage, TU = GPUTextureUsage, RA = TU.RENDER_ATTACHMENT, TB = TU.TEXTURE_BINDING, VSF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const buf = (d, usage) => { const b = dev.createBuffer({ size: Math.max(16, d.byteLength + 3 & ~3), usage, mappedAtCreation: true }); new d.constructor(b.getMappedRange(0, d.byteLength + 3 & ~3)).set(d); b.unmap(); return b };
  const mod = code => dev.createShaderModule({ code });

  // ---- resources
  const UB = dev.createBuffer({ size: 256, usage: BU.UNIFORM | BU.COPY_DST }), U = new Float32Array(64);
  const t16 = d => { const t = dev.createTexture({ size: [256, 256], format: 'rgba16float', usage: TB | TU.COPY_DST }); dev.queue.writeTexture({ texture: t }, d, { bytesPerRow: 256 * 8 }, [256, 256]); return t }, lmT = t16(G.lm), cmT = t16(G.cm);
  const hmT = dev.createTexture({ size: [GN, GN], format: 'r32float', usage: TB | TU.COPY_DST }); dev.queue.writeTexture({ texture: hmT }, G.hm, { bytesPerRow: GN * 4 }, [GN, GN]);
  const sLin = dev.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const BGL_M = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: VSF, buffer: {} }, { binding: 1, visibility: VSF, texture: {} }, { binding: 2, visibility: VSF, sampler: {} }, { binding: 3, visibility: VSF, texture: { sampleType: 'unfilterable-float' } }, { binding: 4, visibility: VSF, texture: {} }] });
  const BGL_U = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: VSF, buffer: {} }] });
  const BGL_T1 = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} }] });
  const BGL_T2 = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} }, { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} }] });
  const BG_M = dev.createBindGroup({ layout: BGL_M, entries: [{ binding: 0, resource: { buffer: UB } }, { binding: 1, resource: lmT.createView() }, { binding: 2, resource: sLin }, { binding: 3, resource: hmT.createView() }, { binding: 4, resource: cmT.createView() }] });
  const BG_U = dev.createBindGroup({ layout: BGL_U, entries: [{ binding: 0, resource: { buffer: UB } }] });
  const PL_M = dev.createPipelineLayout({ bindGroupLayouts: [BGL_M] }), PL_P1 = dev.createPipelineLayout({ bindGroupLayouts: [BGL_U, BGL_T1] }), PL_P2 = dev.createPipelineLayout({ bindGroupLayouts: [BGL_U, BGL_T2] });
  const f4 = (l, n, o = 0) => Array.from({ length: n }, (_, i) => ({ shaderLocation: l + i, offset: o + i * 16, format: 'float32x4' }));
  const DSW = { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' }, DSR = { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater-equal' };
  const ADD = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
  const mp = (m, vs, fs, buffers, o = {}) => dev.createRenderPipeline({ layout: PL_M, vertex: { module: m, entryPoint: vs, buffers, constants: o.c }, fragment: { module: m, entryPoint: fs, constants: o.c, targets: [{ format: HF, blend: o.blend }] }, primitive: { topology: o.strip ? 'triangle-strip' : 'triangle-list', cullMode: 'none' }, depthStencil: o.ds || DSW, multisample: { count: 4 } });
  const M_TER = mod(G_TER), M_INST = mod(G_INST), M_ENV = mod(G_ENV), M_PT = mod(G_PT), M_FA = mod(G_FA), M_POST = mod(G_POST), M_FIN = mod(G_FIN);
  const VMESH = { arrayStride: 40, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x4' }] };
  const P = {
    ter: mp(M_TER, 'vs', 'fs', [{ arrayStride: 32, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x2' }] }]),
    inst: [0, 1, 2].map(k => mp(M_INST, 'vs', 'fs', [VMESH, { arrayStride: 64, stepMode: 'instance', attributes: f4(3, 4) }], { c: { KIND: k } })),
    fa: mp(M_FA, 'vs', 'fs', [{ arrayStride: 32, attributes: f4(0, 2) }, { arrayStride: 64, stepMode: 'instance', attributes: f4(2, 4) }]),
    water: mp(M_ENV, 'vw', 'fw', [], { strip: 1 }), sky: mp(M_ENV, 'vf', 'fb', [], { ds: DSR }),
    cone: mp(M_ENV, 'vc', 'fc', [{ arrayStride: 48, stepMode: 'instance', attributes: f4(0, 3) }], { blend: ADD, ds: DSR }),
    pt: [0, 1, 2].map(k => mp(M_PT, 'vp', 'fp', [{ arrayStride: 32, stepMode: 'instance', attributes: f4(0, 2) }], { c: { PK: k }, strip: 1, blend: ADD, ds: DSR })),
    down: dev.createRenderPipeline({ layout: PL_P1, vertex: { module: M_POST, entryPoint: 'vf' }, fragment: { module: M_POST, entryPoint: 'down', targets: [{ format: HF }] } }),
    up: dev.createRenderPipeline({ layout: PL_P1, vertex: { module: M_POST, entryPoint: 'vf' }, fragment: { module: M_POST, entryPoint: 'up', targets: [{ format: HF, blend: ADD }] } }),
    fin: dev.createRenderPipeline({ layout: PL_P2, vertex: { module: M_FIN, entryPoint: 'vf' }, fragment: { module: M_FIN, entryPoint: 'fin', targets: [{ format: CF }] } })
  };
  // ---- geometry: [vertex buffer, index buffer, index count, instance buffer, instances, pipeline]
  const TER = { vb: buf(G.terrain.v, BU.VERTEX), ib: buf(G.terrain.i, BU.INDEX), n: G.terrain.i.length };
  const mesh = m => ({ vb: buf(new Float32Array(m.v), BU.VERTEX), ib: buf(new Uint32Array(m.i), BU.INDEX), n: m.i.length });
  const DRAW = [];
  M.giant.forEach((m, k) => { const a = G.inst.giant[k]; if (a.length) DRAW.push([mesh(m), buf(new Float32Array(a), BU.VERTEX), a.length / 16, P.inst[0]]) });
  for (const [m, a, p] of [[M.cluster, G.inst.cluster, 0], [M.fern, G.inst.fern, 1], [M.rock, G.inst.rock, 2]]) DRAW.push([mesh(m), buf(new Float32Array(a), BU.VERTEX), a.length / 16, P.inst[p]]);
  const FAU = ['deer', 'owl', 'frog', 'beast'].map((k, i) => ({ vb: buf(M[k], BU.VERTEX), nv: M[k].length / 8, ib: buf(new Float32Array(G.fa[i]), BU.VERTEX), n: G.fa[i].length / 16 }));
  const CONE = { b: buf(new Float32Array(G.cones), BU.VERTEX), n: G.cones.length / 12 };
  const PTS = G.pa.map((a, k) => ({ b: buf(new Float32Array(a), BU.VERTEX), n: a.length / 8, p: P.pt[k] }));

  // ---- render targets
  const RT = [], NB = 6, cpass = v => ({ colorAttachments: [{ view: v, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
  const PD_MAIN = { colorAttachments: [{ view: null, resolveTarget: null, clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'discard' }], depthStencilAttachment: { view: null, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'discard' } };
  const PD_DN = [], PD_UP = [], BG_DN = [], BG_UP = [], PD_FIN = cpass(null); let BG_FIN, W = 0, H = 0, rw = 0, rh = 0;
  for (let i = 0; i < NB; i++) { PD_DN.push(cpass(null)); const u = cpass(null); u.colorAttachments[0].loadOp = 'load'; PD_UP.push(u) }
  const bgT = (L, ...r) => dev.createBindGroup({ layout: L, entries: r.map((x, i) => ({ binding: i, resource: x })) });
  function targets() {
    for (const t of RT) t.destroy(); RT.length = 0;
    const tx = (w, h, f, u, sc) => { const t = dev.createTexture({ size: [Math.max(1, w), Math.max(1, h)], format: f, usage: u, sampleCount: sc || 1 }); RT.push(t); return t.createView() };
    const hdr = tx(W, H, HF, RA | TB); PD_MAIN.colorAttachments[0].view = tx(W, H, HF, RA, 4); PD_MAIN.colorAttachments[0].resolveTarget = hdr; PD_MAIN.depthStencilAttachment.view = tx(W, H, 'depth32float', RA, 4);
    const bl = []; for (let i = 0; i < NB; i++) { bl.push(tx(W >> i + 1, H >> i + 1, HF, RA | TB)); PD_DN[i].colorAttachments[0].view = PD_UP[i].colorAttachments[0].view = bl[i]; BG_DN[i] = bgT(BGL_T1, i ? bl[i - 1] : hdr, sLin); if (i) BG_UP[i - 1] = bgT(BGL_T1, bl[i], sLin) }
    BG_FIN = bgT(BGL_T2, hdr, bl[0], sLin);
  }
  function resize() { const w = Math.min(+qs.get('w') || rw || Math.round(cv.clientWidth * devicePixelRatio), 8192), h = Math.min(+qs.get('h') || rh || Math.round(cv.clientHeight * devicePixelRatio), 8192); if (w !== W || h !== H) { W = w; H = h; targets() } if (on() && (cv.width !== W || cv.height !== H)) { cv.width = W; cv.height = H } }
  try { new ResizeObserver(e => { const b = e[0].devicePixelContentBoxSize; if (b) { rw = b[0].inlineSize; rh = b[0].blockSize } if (on()) resize() }).observe(cv, { box: 'device-pixel-content-box' }) } catch (e) { addEventListener('resize', () => { if (on()) resize() }) }
  resize();

  // ---- camera (all per-frame numbers in one Float64Array)
  const S = new Float64Array(32), CX = 0, CY = 1, CZ = 2, YAW = 3, PIT = 4, TIME = 5, VX = 6, VY = 7, VZ = 8, FX = 9, FY = 10, FZ = 11, RX = 12, RZ = 13, UX = 14, UY = 15, UZ = 16, LAST = 17, TOFF = 18, DT = 19, FT = 20, T0 = 21;
  const FOVT = Math.tan(60 * Math.PI / 360), NEAR = .2, EXPO = +qs.get('ex') || .95, moon = nz([-.35, .5, -.79]);
  function uniforms() {
    const cp = Math.cos(S[PIT]), sp = Math.sin(S[PIT]), cy = Math.cos(S[YAW]), sy = Math.sin(S[YAW]), f = 1 / FOVT, fa = f * H / W;
    S[FX] = cp * sy; S[FY] = sp; S[FZ] = -cp * cy; S[RX] = cy; S[RZ] = sy; S[UX] = -S[RZ] * S[FY]; S[UY] = S[RZ] * S[FX] - S[RX] * S[FZ]; S[UZ] = S[RX] * S[FY];
    U[0] = S[RX] * fa; U[1] = S[UX] * f; U[2] = 0; U[3] = S[FX]; U[4] = 0; U[5] = S[UY] * f; U[6] = 0; U[7] = S[FY]; U[8] = S[RZ] * fa; U[9] = S[UZ] * f; U[10] = 0; U[11] = S[FZ];
    U[12] = -(S[RX] * S[CX] + S[RZ] * S[CZ]) * fa; U[13] = -(S[UX] * S[CX] + S[UY] * S[CY] + S[UZ] * S[CZ]) * f; U[14] = NEAR; U[15] = -(S[FX] * S[CX] + S[FY] * S[CY] + S[FZ] * S[CZ]);
    U[16] = S[CX]; U[17] = S[CY]; U[18] = S[CZ]; U[19] = S[TIME]; U[20] = moon[0]; U[21] = moon[1]; U[22] = moon[2]; U[24] = W; U[25] = H; U[26] = 1 / W; U[27] = 1 / H;
    U[28] = S[RX]; U[29] = 0; U[30] = S[RZ]; U[31] = FOVT * W / H; U[32] = S[UX]; U[33] = S[UY]; U[34] = S[UZ]; U[35] = FOVT; U[36] = S[FX]; U[37] = S[FY]; U[38] = S[FZ]; U[39] = NEAR; U[40] = EXPO;
    dev.queue.writeBuffer(UB, 0, U);
    for (let i = 0; i < 20; i++)PU[i] = U[i]; PU[56] = S[FX]; PU[57] = S[FY]; PU[58] = S[FZ]; PU[63] = flying ? 1 : 0;
  }
  // ---- frame
  const SUB = [null];
  function draw() {
    uniforms(); const e = dev.createCommandEncoder();
    let p = e.beginRenderPass(PD_MAIN); p.setBindGroup(0, BG_M);
    p.setPipeline(P.ter); p.setVertexBuffer(0, TER.vb); p.setIndexBuffer(TER.ib, 'uint32'); p.drawIndexed(TER.n);
    for (let k = 0; k < DRAW.length; k++) { const d = DRAW[k]; p.setPipeline(d[3]); p.setVertexBuffer(0, d[0].vb); p.setIndexBuffer(d[0].ib, 'uint32'); p.setVertexBuffer(1, d[1]); p.drawIndexed(d[0].n, d[2]) }
    p.setPipeline(P.fa); for (let k = 0; k < FAU.length; k++) { const f = FAU[k]; if (!f.n) continue; p.setVertexBuffer(0, f.vb); p.setVertexBuffer(1, f.ib); p.draw(f.nv, f.n) }
    p.setPipeline(P.water); p.draw(4); p.setPipeline(P.sky); p.draw(3);
    p.setPipeline(P.cone); p.setVertexBuffer(0, CONE.b); p.draw(144, CONE.n); // soft light cones under the big caps
    for (let k = 0; k < PTS.length; k++) { const s = PTS[k]; p.setPipeline(s.p); p.setVertexBuffer(0, s.b); p.draw(4, s.n) }
    HO.portal(p, WI); p.end();
    for (let i = 0; i < NB; i++) { p = e.beginRenderPass(PD_DN[i]); p.setPipeline(P.down); p.setBindGroup(0, BG_U); p.setBindGroup(1, BG_DN[i]); p.draw(3); p.end() }
    for (let i = NB - 2; i >= 0; i--) { p = e.beginRenderPass(PD_UP[i]); p.setPipeline(P.up); p.setBindGroup(0, BG_U); p.setBindGroup(1, BG_UP[i]); p.draw(3); p.end() }
    PD_FIN.colorAttachments[0].view = HO.snapView || ctx.getCurrentTexture().createView();
    p = e.beginRenderPass(PD_FIN); p.setPipeline(P.fin); p.setBindGroup(0, BG_U); p.setBindGroup(1, BG_FIN); p.draw(3); p.end();
    SUB[0] = e.finish(); dev.queue.submit(SUB);
  }
  // ---- movement: free flight that stays above the ground; F flies a guided loop through the valley
  const K = new Uint8Array(8); let flying = BENCH || qs.has('fly') && HO.first === WI;
  const key = (e, d) => {
    if (d && !on()) return;
    switch (e.code) { case 'KeyW': K[0] = d; break; case 'KeyS': K[1] = d; break; case 'KeyA': K[2] = d; break; case 'KeyD': K[3] = d; break; case 'KeyQ': K[4] = d; break; case 'KeyE': K[5] = d; break; case 'ShiftLeft': case 'ShiftRight': K[6] = d; break; case 'KeyF': if (d && !BENCH) { flying = !flying; S[T0] = S[TIME] } }
  };
  addEventListener('keydown', e => key(e, 1)); addEventListener('keyup', e => key(e, 0));
  addEventListener('mousemove', e => { if (on() && document.pointerLockElement === cv) { S[YAW] += e.movementX * .0022; S[PIT] = Math.min(Math.max(S[PIT] - e.movementY * .0022, -1.5), 1.5) } });
  function move() {
    const dt = S[DT], sp = K[6] ? 40 : 10, a = K[0] - K[1], b = K[3] - K[2], c = K[5] - K[4], k = 1 - Math.exp(-dt * 5);
    S[VX] += ((S[FX] * a + S[RX] * b) * sp - S[VX]) * k; S[VY] += ((S[FY] * a + c) * sp - S[VY]) * k; S[VZ] += ((S[FZ] * a + S[RZ] * b) * sp - S[VZ]) * k;
    S[CX] += S[VX] * dt; S[CY] += S[VY] * dt; S[CZ] += S[VZ] * dt;
    const r = Math.hypot(S[CX], S[CZ]); if (r > 620) { S[CX] *= 620 / r; S[CZ] *= 620 / r }
    const gy = G.H(S[CX], S[CZ]) + 1.2; if (S[CY] < gy) { S[CY] = gy; if (S[VY] < 0) S[VY] = 0 } if (S[CY] < .8) S[CY] = .8; if (S[CY] > 180) S[CY] = 180;
  }
  const TW = [], NTW = 14, FLT = 110; for (let i = 0; i < NTW; i++) { const a = i / NTW * 6.2832 + .4, r = 250 + 90 * Math.sin(a * 2 + 1), x = Math.cos(a) * r - 40, z = Math.sin(a) * r + 30; TW.push(x, Math.max(G.H(x, z), 0) + 12 + 8 * Math.sin(a * 3), z) }
  const FA_ = new Float64Array(3), FB_ = new Float64Array(3);
  function tourAt(o) { const u = (S[FT] / FLT % 1 + 1) % 1 * NTW, i = u | 0, f = u - i, a = (i + NTW - 1) % NTW * 3, b = i * 3, c = (i + 1) % NTW * 3, d = (i + 2) % NTW * 3; for (let k = 0; k < 3; k++) { const A = TW[a + k], B = TW[b + k], C = TW[c + k], D = TW[d + k]; o[k] = .5 * (2 * B + (C - A) * f + (2 * A - 5 * B + 4 * C - D) * f * f + (3 * B - A - 3 * C + D) * f * f * f) } }
  function tour() { tourAt(FA_); S[FT] += .8; tourAt(FB_); S[FT] -= .8; S[CX] = FA_[0]; S[CY] = FA_[1]; S[CZ] = FA_[2]; const dx = FB_[0] - FA_[0], dy = FB_[1] - FA_[1], dz = FB_[2] - FA_[2]; S[YAW] = Math.atan2(dx, -dz); S[PIT] = Math.atan2(dy, Math.hypot(dx, dz)) - .08 }
  function frame() {
    const now = HO.T[0], dt = Math.min(Math.max((now - S[LAST]) / 1000, 0), .1); S[LAST] = now; S[TIME] = now / 1000 + S[TOFF];
    if (flying) { S[FT] = S[TIME] - S[T0]; tour() } else { S[DT] = dt; move() }
    draw();
  }
  const HELP = 'Click to explore  ·  WASD move  ·  mouse look  ·  Q / E down / up  ·  Shift boost  ·  F guided flight  ·  P next world\nFly into the golden ring to return to the floating islands';
  for (let i = 0; i < 5000; i++) { S[FT] = i * .02; tour(); uniforms() } // JIT warm-up of the per-frame math
  S[YAW] = 0; S[PIT] = 0; S[CX] = 0; S[CY] = G.H(0, 0) + 6; S[CZ] = 0; S[VX] = S[VY] = S[VZ] = 0;
  if (CAP) {
    window.__cap = {
      set(x, y, z, yw, pt, t) { S[CX] = x; S[CY] = y; S[CZ] = z; S[YAW] = yw; S[PIT] = pt; S[TIME] = t; draw(); return [x, y, z] }, fly(t) { S[TIME] = t; S[FT] = t; tour(); draw(); return [S[CX], S[CY], S[CZ]] },
      png: () => cv.toDataURL('image/png'), H: G.H, G, async ms(n) { let s = 0; for (let i = 0; i < n; i++) { const t = performance.now(); draw(); await dev.queue.onSubmittedWorkDone(); s += performance.now() - t } return +(s / n).toFixed(1) }
    };
    say(''); return;
  }
  // ---- audio emitters (types in audio.js: 20 cricket, 21 frog (croaks in sync with the glowing throat), 22 owl, 23 deer herd, 24 water drip, 25 mushroom chime, 26 lantern beast)
  const AE = [], FD = G.fa;
  for (let i = 0; i < G.crick.length; i += 3) AE.push(20, i);
  for (let i = 0; i < FD[2].length; i += 16) AE.push(21, i);
  for (let i = 0; i < FD[1].length; i += 16) AE.push(22, i);
  for (let i = 0; i < FD[0].length; i += 16) if (!i || Math.abs(FD[0][i + 12] - FD[0][i - 4]) > .02) AE.push(23, i);
  for (let i = 0; i < G.drip.length; i += 3) AE.push(24, i);
  for (let i = 0; i < G.giants.length; i += 3) AE.push(25, i);
  AE.push(26, 0);
  const NE = AE.length / 2, ET = new Uint8Array(NE), EI = new Int32Array(NE), EP = new Float64Array(NE * 3), EA = new Float32Array(NE);
  for (let e = 0; e < NE; e++) { ET[e] = AE[e * 2]; EI[e] = AE[e * 2 + 1] }
  for (let e = 0; e < NE; e++) { const t = ET[e], o = EI[e], A = t == 20 ? G.crick : t == 21 ? FD[2] : t == 22 ? FD[1] : t == 24 ? G.drip : t == 26 ? FD[3] : null; if (A) { EP[e * 3] = A[o]; EP[e * 3 + 1] = A[o + 1] + (t == 22 ? .7 : 0); EP[e * 3 + 2] = A[o + 2] } if (t == 25) { const g = G.giants[o]; EP[e * 3] = g[0]; EP[e * 3 + 1] = g[1] + g[3] * .7; EP[e * 3 + 2] = g[2] } }
  function atick(t, cx, cy, cz) {
    for (let e = 0; e < NE; e++) {
      const ty = ET[e], o = EI[e];
      if (ty == 21) { const F = FD[2], pr = ((t / F[o + 5] + F[o + 12] * .1) % 1 + 1) % 1; EA[e] = pr < .2 ? 1 : 0 }
      else if (ty == 23) { // deer: the herd's lead animal, with the same flee maths as the shader
        const F = FD[0], sd = F[o + 12], om = .11 + .05 * (sd * .618 % 1), sp = F[o + 5], u = sp * t + .95 * sp / om * Math.sin(t * om + sd * 6), R = F[o + 7], an = u / R + F[o + 4];
        let x = F[o] + R * Math.cos(an) * (1 + .3 * Math.sin(2 * an + sd)), z = F[o + 2] + R * Math.sin(an) * (1 + .3 * Math.cos(3 * an + sd)); const dx = x - cx, dz = z - cz, dl = Math.max(Math.hypot(dx, dz), 1e-3);
        const st = (1 - ss(8, 32, dl)) * (1 - ss(10, 22, cy - G.H(x, z))); x += dx / dl * st * 14; z += dz / dl * st * 14; EP[e * 3] = x; EP[e * 3 + 1] = G.H(x, z) + 1; EP[e * 3 + 2] = z; EA[e] = st;
      }
    }
  }
  S[LAST] = performance.now(); S[TOFF] = -S[LAST] / 1000;
  return {
    name: 'Glowcap Hollow', help: HELP, audio: { n: NE, T: ET, P: EP, A: EA, tick: atick, ref: 4 }, tanY: FOVT, bench: BENCH, speed: 10, tick: frame,
    place(x, y, z, yaw, v, pit = 0) { S[CX] = x; S[CY] = y; S[CZ] = z; S[YAW] = yaw; S[PIT] = pit; flying = false; const c = Math.cos(pit); S[VX] = Math.sin(yaw) * c * v; S[VY] = Math.sin(pit) * v; S[VZ] = -Math.cos(yaw) * c * v },
    hold(codes) { for (const c of codes) if (/^Key[WASDQE]$|^Shift/.test(c)) key({ code: c }, 1) },
    enter() { resize(); S[LAST] = performance.now() }, leave() { K.fill(0) },
    snap() { HO.snapView = HO.peek(HO.snapFor, W, H); S[TIME] = performance.now() / 1000 + S[TOFF]; draw(); HO.snapView = null }
  };
};
