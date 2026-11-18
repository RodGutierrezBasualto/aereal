// ---------------------------------------------------------------- runtime
const main = async (HO, WI) => { // HO = shared host: device, canvas, portal; WI = this world's index
  const qs = HO.Q, CAP = qs.has('cap') && HO.first === WI, BENCH = qs.has('bench') && HO.first === WI, DBG = qs.has('dbg');
  const cv = HO.cv, ad = HO.ad, dev = HO.dev, ctx = HO.ctx, on = () => HO.cur === WI, PU = HO.PU[WI];
  const say = s => HO.say(s, WI);
  const TS = (BENCH || CAP) && HO.TS;
  const CF = HO.FMT, HF = 'rgba16float';
  const BU = GPUBufferUsage, TU = GPUTextureUsage, RA = TU.RENDER_ATTACHMENT, TB = TU.TEXTURE_BINDING, VS = GPUShaderStage.VERTEX, FSG = GPUShaderStage.FRAGMENT;
  const buf = (d, usage) => { const b = dev.createBuffer({ size: d.byteLength, usage, mappedAtCreation: true }); new d.constructor(b.getMappedRange()).set(d); b.unmap(); return b; };
  const mod = code => dev.createShaderModule({ code });

  // ---- static resources
  const sRep = dev.createSampler({ addressModeU: 'repeat', addressModeV: 'repeat', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 8 });
  const sClamp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const sCmp = dev.createSampler({ compare: 'less-equal', magFilter: 'linear', minFilter: 'linear' });
  const BGL_U = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: VS | FSG, buffer: {} }] });
  const BGL_M = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: VS | FSG, buffer: {} }, { binding: 1, visibility: FSG, texture: { sampleType: 'unfilterable-float' } }, { binding: 2, visibility: FSG, sampler: { type: 'comparison' } }, { binding: 3, visibility: FSG, texture: {} }, { binding: 4, visibility: FSG, sampler: {} }, { binding: 5, visibility: FSG, texture: {} }, { binding: 6, visibility: FSG, texture: {} }] });
  const BGL_D = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: FSG, texture: { sampleType: 'depth', multisampled: true } }] });
  const BGL_T1 = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: FSG, texture: {} }, { binding: 1, visibility: FSG, sampler: {} }] });
  const BGL_T3 = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: FSG, texture: {} }, { binding: 1, visibility: FSG, texture: {} }, { binding: 2, visibility: FSG, texture: {} }, { binding: 3, visibility: FSG, sampler: {} }] });
  const BGL_SD = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: FSG, texture: { sampleType: 'depth' } }] }), BGL_UF = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: FSG, texture: { sampleType: 'unfilterable-float' } }] });
  const pl = (...l) => dev.createPipelineLayout({ bindGroupLayouts: l });
  const PL_U = pl(BGL_U), PL_M = pl(BGL_M), PL_RAY = pl(BGL_M, BGL_D), PL_P1 = pl(BGL_U, BGL_T1), PL_P3 = pl(BGL_U, BGL_T3);
  const UB = dev.createBuffer({ size: 256, usage: BU.UNIFORM | BU.COPY_DST }), UBS = dev.createBuffer({ size: 256, usage: BU.UNIFORM | BU.COPY_DST });
  const shT = dev.createTexture({ size: [SHR, SHR], format: 'depth32float', usage: RA | TB });
  const vA = dev.createTexture({ size: [SHR / 2, SHR / 2], format: 'rg32float', usage: RA | TB }).createView(), vB = dev.createTexture({ size: [SHR / 2, SHR / 2], format: 'rg32float', usage: RA | TB }).createView(), shV = shT.createView();
  const caT = dev.createTexture({ size: [512, 512], format: 'r16float', mipLevelCount: 5, usage: RA | TB });
  const taT = dev.createTexture({ size: [1024, 1024], format: 'rgba8unorm', mipLevelCount: 11, usage: RA | TB });
  const tbT = dev.createTexture({ size: [1024, 1024], format: 'rgba8unorm', mipLevelCount: 11, usage: RA | TB });
  const BG_U = dev.createBindGroup({ layout: BGL_U, entries: [{ binding: 0, resource: { buffer: UB } }] });
  const BG_US = dev.createBindGroup({ layout: BGL_U, entries: [{ binding: 0, resource: { buffer: UBS } }] });
  const BG_M = dev.createBindGroup({ layout: BGL_M, entries: [{ binding: 0, resource: { buffer: UB } }, { binding: 1, resource: vA }, { binding: 2, resource: sCmp }, { binding: 3, resource: caT.createView() }, { binding: 4, resource: sRep }, { binding: 5, resource: taT.createView() }, { binding: 6, resource: tbT.createView() }] });

  // ---- pipelines
  const M_OBJ = mod(W_OBJ), M_ENV = mod(W_ENV), M_PT = mod(W_PT), M_GEN = mod(W_GEN), M_RAY = mod(W_RAY), M_POST = mod(W_POST), M_FIN = mod(W_FIN);
  const VBL = [{ arrayStride: 40, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x4' }] },
  { arrayStride: 64, stepMode: 'instance', attributes: [3, 4, 5, 6].map((l, i) => ({ shaderLocation: l, offset: i * 16, format: 'float32x4' })) }];
  const DSW = { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' }, DSR = { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater-equal' };
  const PP = {}, pend = [];
  const rp = (key, d) => pend.push(dev.createRenderPipelineAsync(d).then(p => PP[key] = p));
  for (const [k, fs, cull] of [[0, 'fs_r', 'back'], [0, 'fs_r', 'none'], [1, 'fs_f', 'none'], [2, 'fs_a', 'none'], [3, 'fs_a', 'none'], [4, 'fs_a', 'none'], [6, 'fs_a', 'none'], [7, 'fs_a', 'none']])
    rp('o' + k + cull, { layout: PL_M, vertex: { module: M_OBJ, entryPoint: 'vs', constants: { KIND: k }, buffers: VBL }, fragment: { module: M_OBJ, entryPoint: fs, targets: [{ format: HF }] }, primitive: { cullMode: cull }, depthStencil: DSW, multisample: { count: 4 } });
  for (const k of [0, 1, 3, 4, 6]) rp('s' + k, { layout: PL_U, vertex: { module: M_OBJ, entryPoint: 'vs_s', constants: { KIND: k }, buffers: VBL }, primitive: { cullMode: 'none' }, depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 2.5 } });
  rp('surf', { layout: PL_M, vertex: { module: M_ENV, entryPoint: 'vw' }, fragment: { module: M_ENV, entryPoint: 'fw', targets: [{ format: HF }] }, primitive: { topology: 'triangle-strip' }, depthStencil: DSW, multisample: { count: 4 } });
  rp('bg', { layout: PL_M, vertex: { module: M_ENV, entryPoint: 'vb' }, fragment: { module: M_ENV, entryPoint: 'fbg', targets: [{ format: HF }] }, depthStencil: DSR, multisample: { count: 4 } });
  const PBL = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } }, ADD = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
  rp('j5', { layout: PL_M, vertex: { module: M_OBJ, entryPoint: 'vs', constants: { KIND: 5 }, buffers: VBL }, fragment: { module: M_OBJ, entryPoint: 'fs_j', targets: [{ format: HF, blend: PBL }] }, primitive: { cullMode: 'none' }, depthStencil: DSR, multisample: { count: 4 } });
  for (const k of [0, 1, 2]) rp('p' + k, { layout: PL_M, vertex: { module: M_PT, entryPoint: 'vp', constants: { PK: k }, buffers: [{ arrayStride: 32, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }, { shaderLocation: 1, offset: 16, format: 'float32x4' }] }] }, fragment: { module: M_PT, entryPoint: 'fp', constants: { PK: k }, targets: [{ format: HF, blend: PBL }] }, primitive: { topology: 'triangle-strip' }, depthStencil: DSR, multisample: { count: 4 } });
  for (const k of [0, 1, 2]) rp('g' + k, { layout: PL_U, vertex: { module: M_GEN, entryPoint: 'vf' }, fragment: { module: M_GEN, entryPoint: 'fg', constants: { GK: k }, targets: [{ format: k < 2 ? 'rgba8unorm' : 'r16float' }] } });
  const post = (key, m, fs, fmt, layout, c, blend) => rp(key, { layout, vertex: { module: m, entryPoint: 'vf' }, fragment: { module: m, entryPoint: fs, constants: c, targets: [{ format: fmt, blend }] } });
  post('ray', M_RAY, 'fr', HF, PL_RAY); post('bh', M_POST, 'blur', HF, PL_P1, { BD: 0 }); post('bv', M_POST, 'blur', HF, PL_P1, { BD: 1 });
  post('dn', M_POST, 'down', HF, PL_P1); post('up', M_POST, 'up', HF, PL_P1, undefined, ADD); post('b8', M_POST, 'blit', 'rgba8unorm', PL_P1); post('b16', M_POST, 'blit', 'r16float', PL_P1);
  post('fin', M_FIN, 'ff', CF, PL_P3);
  rp('vm', { layout: pl(BGL_SD), vertex: { module: mod(W_VM), entryPoint: 'vq' }, fragment: { module: mod(W_VM), entryPoint: 'fm', targets: [{ format: 'rg32float' }] } });
  for (const k of [0, 1]) rp('vb' + k, { layout: pl(BGL_UF), vertex: { module: mod(W_VB), entryPoint: 'vq' }, fragment: { module: mod(W_VB), entryPoint: 'fb', constants: { BD: k }, targets: [{ format: 'rg32float' }] } });
  const tComp = dev.createComputePipelineAsync({ layout: 'auto', compute: { module: mod(W_TER), entryPoint: 'main' } });

  // ---- uniforms / camera state
  const U = new Float32Array(64), SUB = [null];
  // all mutable per-frame numbers live in one Float64Array: closure-captured doubles would be boxed (heap-allocated) on every write
  let W = 0, H = 0; const S = new Float64Array(32);
  const CX = 0, CY = 1, CZ = 2, YAW = 3, PIT = 4, TIME = 5, VX = 6, VY = 7, VZ = 8, FX = 9, FY = 10, FZ = 11, RX = 12, RZ = 13, UX = 14, UY = 15, UZ = 16, LAST = 17, T0 = 18, TOFF = 19, QX = 20, QY = 21, QZ = 22, FT_ = 23, DT = 24;
  const FOVT = Math.tan(62 * Math.PI / 360), NEAR = .15, SR = 100, SFAR = 180, EXPO = +qs.get('ex') || .55;
  const sa = nz([.36, .86, .33]), kq = Math.sqrt(1 - (1 - sa[1] * sa[1]) / 1.777), su = [sa[0] / 1.333, kq, sa[2] / 1.333], lr = nz(crs([0, 0, 1], su)), lu = crs(su, lr);
  function uniforms() {
    const cp = Math.cos(S[PIT]), sp = Math.sin(S[PIT]), cy = Math.cos(S[YAW]), sy = Math.sin(S[YAW]), f = 1 / FOVT, fa = f * H / W;
    S[FX] = cp * sy; S[FY] = sp; S[FZ] = -cp * cy; S[RX] = cy; S[RZ] = sy; S[UX] = -S[RZ] * S[FY]; S[UY] = S[RZ] * S[FX] - S[RX] * S[FZ]; S[UZ] = S[RX] * S[FY];
    U[0] = S[RX] * fa; U[1] = S[UX] * f; U[2] = 0; U[3] = S[FX]; U[4] = 0; U[5] = S[UY] * f; U[6] = 0; U[7] = S[FY]; U[8] = S[RZ] * fa; U[9] = S[UZ] * f; U[10] = 0; U[11] = S[FZ];
    U[12] = -(S[RX] * S[CX] + S[RZ] * S[CZ]) * fa; U[13] = -(S[UX] * S[CX] + S[UY] * S[CY] + S[UZ] * S[CZ]) * f; U[14] = NEAR; U[15] = -(S[FX] * S[CX] + S[FY] * S[CY] + S[FZ] * S[CZ]);
    const hl = Math.sqrt(S[FX] * S[FX] + S[FZ] * S[FZ]) || 1, cx = S[CX] + S[FX] / hl * 52, cz = S[CZ] + S[FZ] / hl * 52, tx = 2 * SR / SHR;
    const sx = Math.round((lr[0] * cx + lr[2] * cz) / tx) * tx, sy2 = Math.round((lu[0] * cx + lu[1] * -25 + lu[2] * cz) / tx) * tx, de = su[0] * cx + su[1] * -25 + su[2] * cz + 90;
    U[16] = lr[0] / SR; U[17] = lu[0] / SR; U[18] = -su[0] / SFAR; U[19] = 0; U[20] = lr[1] / SR; U[21] = lu[1] / SR; U[22] = -su[1] / SFAR; U[23] = 0;
    U[24] = lr[2] / SR; U[25] = lu[2] / SR; U[26] = -su[2] / SFAR; U[27] = 0; U[28] = -sx / SR; U[29] = -sy2 / SR; U[30] = de / SFAR; U[31] = 1;
    U[32] = S[CX]; U[33] = S[CY]; U[34] = S[CZ]; U[35] = S[TIME];
    U[36] = su[0]; U[37] = su[1]; U[38] = su[2]; U[39] = DBG ? 0 : 1;
    U[40] = sa[0]; U[41] = sa[1]; U[42] = sa[2]; U[43] = DBG ? .04 : 1;
    U[44] = W; U[45] = H; U[46] = EXPO; U[47] = 1 / H;
    U[48] = S[RX]; U[49] = 0; U[50] = S[RZ]; U[51] = FOVT * W / H; U[52] = S[UX]; U[53] = S[UY]; U[54] = S[UZ]; U[55] = FOVT; U[56] = S[FX]; U[57] = S[FY]; U[58] = S[FZ]; U[59] = NEAR;
    dev.queue.writeBuffer(UB, 0, U);
    for (let i = 0; i < 16; i++) { PU[i] = U[i]; U[i] = U[16 + i]; }
    PU[16] = S[CX]; PU[17] = S[CY]; PU[18] = S[CZ]; PU[19] = S[TIME]; PU[63] = flying ? 1 : 0; PU[56] = S[FX]; PU[57] = S[FY]; PU[58] = S[FZ];
    dev.queue.writeBuffer(UBS, 0, U);
  }

  // ---- bake noise textures, kick off terrain density
  await Promise.all(pend);
  const view = (t, m) => t.createView({ baseMipLevel: m, mipLevelCount: 1 });
  const cpass = v => ({ colorAttachments: [{ view: v, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
  const bgT = (...r) => dev.createBindGroup({ layout: r.length > 2 ? BGL_T3 : BGL_T1, entries: r.map((x, i) => ({ binding: i, resource: x })) });
  {
    S[TIME] = 0; dev.queue.writeBuffer(UB, 0, U);
    const e = dev.createCommandEncoder();
    for (const [t, k] of [[taT, 'g0'], [tbT, 'g1']]) for (let m = 0; m < 11; m++) {
      const p = e.beginRenderPass(cpass(view(t, m))); p.setBindGroup(0, BG_U);
      if (m) { p.setPipeline(PP.b8); p.setBindGroup(1, bgT(view(t, m - 1), sClamp)); } else p.setPipeline(PP[k]);
      p.draw(3); p.end();
    }
    dev.queue.submit([e.finish()]);
  }
  const PD_CA = [], BG_CA = [];
  for (let m = 0; m < 5; m++) { PD_CA.push(cpass(view(caT, m))); BG_CA.push(m ? bgT(view(caT, m - 1), sClamp) : null); }
  say('Growing the reef…');
  const NT = NX * NY * NZ * 4, dbuf = dev.createBuffer({ size: NT, usage: BU.STORAGE | BU.COPY_SRC }), rbuf = dev.createBuffer({ size: NT, usage: BU.COPY_DST | BU.MAP_READ });
  {
    const cp = await tComp, e = dev.createCommandEncoder(), p = e.beginComputePass();
    p.setPipeline(cp); p.setBindGroup(0, dev.createBindGroup({ layout: cp.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: dbuf } }] }));
    p.dispatchWorkgroups(NX / 4, NY / 4, NZ / 4); p.end(); e.copyBufferToBuffer(dbuf, 0, rbuf, 0, NT); dev.queue.submit([e.finish()]);
  }
  await rbuf.mapAsync(GPUMapMode.READ);
  const TG = { D: new Float32Array(rbuf.getMappedRange().slice(0)), nx: NX, ny: NY, nz: NZ, sxy: NX * NY, ox: OX, oy: OY, oz: OZ, cs: CS };
  rbuf.unmap(); rbuf.destroy(); dbuf.destroy();
  await new Promise(r => setTimeout(r));

  // ---- scripted fly-through: closed Catmull-Rom loop, 60 s. x,y,z, focus x,y,z, focus weight
  const WPT = new Float32Array(FLY), NW = WPT.length / 7, FLT = 60, FA = new Float32Array(7), FB = new Float32Array(7);
  function flyAt(o) { // reads the S[TIME] from S[FT_]
    const u = (S[FT_] / FLT % 1 + 1) % 1 * NW, i = u | 0, f = u - i, f2 = f * f, f3 = f2 * f, a = (i + NW - 1) % NW * 7, b = i * 7, c = (i + 1) % NW * 7, d = (i + 2) % NW * 7;
    for (let k = 0; k < 7; k++) { const A = WPT[a + k], B = WPT[b + k], C = WPT[c + k], D = WPT[d + k]; o[k] = .5 * (2 * B + (C - A) * f + (2 * A - 5 * B + 4 * C - D) * f2 + (3 * B - A - 3 * C + D) * f3); }
  }
  function fly() {
    flyAt(FA); S[FT_] += 1.7; flyAt(FB); S[FT_] -= 1.7; S[CX] = FA[0]; S[CY] = FA[1]; S[CZ] = FA[2];
    const w = Math.min(Math.max(FA[6], 0), 1), dx = FB[0] + (FA[3] - FB[0]) * w - S[CX], dy = FB[1] + (FA[4] - FB[1]) * w - S[CY], dz = FB[2] + (FA[5] - FB[2]) * w - S[CZ];
    S[YAW] = Math.atan2(dx, -dz); S[PIT] = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
  }
  const pose = i => { const o = i * 6; S[CX] = POSES[o]; S[CY] = POSES[o + 1]; S[CZ] = POSES[o + 2]; S[YAW] = POSES[o + 3]; S[PIT] = POSES[o + 4]; S[VX] = S[VY] = S[VZ] = 0; return POSES[o + 5]; };

  const AV = []; for (let t = 0; t < FLT; t += .25) { S[FT_] = t; flyAt(FA); AV.push(FA[0], FA[1], FA[2]); } for (let i = 0; i < POSES.length; i += 6)AV.push(POSES[i], POSES[i + 1], POSES[i + 2]);
  const nearCam = (x, z, r) => { for (let i = 0; i < AV.length; i += 3)if (Math.hypot(x - AV[i], z - AV[i + 2]) < r) return 1; return 0; };

  // ---- world
  const R = rng(20261117), R0 = R, AUD = { SC: [] }; // AUD: arrays the audio emitters need
  const TM = gridMesh(TG, 0, [1.5, 4, 9], (x, y, z) => { const t = ss(-36, -26, y), n = fbm(x * .018, 7.3, z * .018, 3); return ss(.53 - .13 * t, .65 - .1 * t, n); });
  const TV = TM.v, NV = TV.length / 10;
  const gy = (x, z) => { let y = -8; while (y > -62 && gs(TG, x, y, z) < 0) y -= .4; return y; };
  const CYN = [2, -30, -8, -58, 14, -92, 52, -104, 80, -88];
  const dcy = (x, z) => { let d = 1e9; for (let i = 0; i < 8; i += 2) { const ax = CYN[i], az = CYN[i + 1], bx = CYN[i + 2] - ax, bz = CYN[i + 3] - az, t = cl(((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz), 0, 1); d = Math.min(d, Math.hypot(x - ax - bx * t, z - az - bz * t)); } return d; };
  const zone = (x, z) => Math.hypot(x - 84, z + 58) < 25 || Math.hypot(x + 78, z - 52) < 14;
  const NC = 16, CW = 32, cellOf = (x, z) => cl((x + 256) / CW | 0, 0, NC - 1) + NC * cl((z + 256) / CW | 0, 0, NC - 1);
  const LAY = [], ID = [0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0];
  function layer(mesh, inst, pm, ps, md, sd, lt) { // lt: translucent, drawn after the background
    const v = mesh.v instanceof Float32Array ? mesh.v : new Float32Array(mesh.v), ix = mesh.i instanceof Uint32Array ? mesh.i : new Uint32Array(mesh.i);
    let ia = new Float32Array(inst), cs = null; const n = ia.length / 16;
    if (!n) return;
    if (md) {
      const c = new Uint16Array(n), o = new Uint32Array(n), s = new Float32Array(ia.length); cs = new Uint32Array(NC * NC + 1);
      for (let i = 0; i < n; i++) { c[i] = cellOf(ia[i * 16], ia[i * 16 + 2]); o[i] = i; cs[c[i] + 1]++; }
      for (let i = 0; i < NC * NC; i++)cs[i + 1] += cs[i];
      o.sort((a, b) => c[a] - c[b]);
      for (let i = 0; i < n; i++)s.set(ia.subarray(o[i] * 16, o[i] * 16 + 16), i * 16); ia = s;
    }
    LAY.push({ pm: PP[pm], ps: ps ? PP[ps] : null, vb: buf(v, BU.VERTEX), ib: buf(ix, BU.INDEX), ni: ix.length, inst: buf(ia, BU.VERTEX), n, cs, md: md || 0, sd: sd || 0, lt: lt || 0, tris: ix.length / 3 | 0 });
  }
  layer(TM, ID, 'o0back', 's0');
  // set pieces
  const SCP = [-78, gy(-78, 52) - .5, 52], SHP = [84, gy(84, -58) + 4.3, -58], SHQ = qmul(qax(0, 1, 0, 2.5), qmul(qax(0, 0, 1, .27), qax(1, 0, 0, -.06)));
  layer(sculptMesh(), [...SCP, 1, ...qax(0, 1, 0, 2.16), 1, 1, 1, 0, 0, 0, 0, 0], 'o0back', 's0');
  const SM = shipMesh(), SHG = [], SAX = qrot(SHQ, [0, 0, 1]);
  { let k = 0; for (const vi of new Set(SM.i)) { if (SM.v[vi * 10 + 8] || (k++ % 5) || R() > .55) continue; const n = qrot(SHQ, [SM.v[vi * 10 + 3], SM.v[vi * 10 + 4], SM.v[vi * 10 + 5]]); if (n[1] > .55) SHG.push([...add(SHP, qrot(SHQ, SM.p(vi))), n]); } }
  const DK = SHG.filter(p => p[1] > Math.max(...SHG.map(q => q[1])) - 1.2), DKO = DK[DK.length >> 2], DKT = DK.reduce((a, p) => Math.hypot(p[0] - DKO[0], p[2] - DKO[2]) > Math.hypot(a[0] - DKO[0], a[2] - DKO[2]) ? p : a); // top deck spots kept clear: octopus + resting turtle
  const free = p => Math.hypot(p[0] - DKO[0], p[2] - DKO[2]) > 2.2 && Math.hypot(p[0] - DKT[0], p[2] - DKT[2]) > 2;
  const onShip = (x, z) => { const t = cl((x - SHP[0]) * SAX[0] + (z - SHP[2]) * SAX[2], -19, 19); return Math.hypot(x - SHP[0] - SAX[0] * t, z - SHP[2] - SAX[2] * t) < 5; };
  layer(SM, [...SHP, 1, ...SHQ, 1, 1, 1, 0, 0, 0, 0, 0], 'o0none', 's0');
  layer(sailMesh(rng(71)), [...SHP, 1, ...SHQ, 1, 1, 1, 1.3, 0, .22, 900, 0], 'o1none', 's1');
  await new Promise(r => setTimeout(r));
  { // standing stones
    const a = []; for (let i = 0; i < 7; i++) { const t = i / 7 * 6.283 + .4, x = SCP[0] + Math.cos(t) * 15.5, z = SCP[2] + Math.sin(t) * 15.5; a.push(x, gy(x, z) + 1.5, z, 1.1 + .5 * R(), ...qmul(qax(0, 1, 0, R() * 6), qax(1, 0, 0, R() * .24 - .12)), 1, 1, 1, 0, 0, 0, 0, 0); }
    layer(monolith(), a, 'o0none', 's0');
  }
  { // floating boulders
    const B = [[], [], []]; let nb = 0;
    const ab = (x, y, z, s) => { for (let i = 0; i < AV.length; i += 3)if (Math.hypot(x - AV[i], y - AV[i + 1], z - AV[i + 2]) < s * 1.4 + 5) return; B[nb++ % 3].push(x, y, z, s, ...qmul(qax(0, 1, 0, R() * 6.28), qax(1, 0, 0, R() * .9 - .45)), 1, 1, 1, R() * 6.28, .25 + .5 * R(), .14 + .22 * R(), 0, 0); };
    for (let i = 0; i < 11; i++) { const a = i / 11 * 6.283 + R() * .3, r = 19 + 5 * R(); ab(SCP[0] + Math.cos(a) * r, -28 + 7 * Math.sin(a * 2 + 1) + 5 * R(), SCP[2] + Math.sin(a) * r, 1.3 + 2.3 * R()); }
    for (let i = 0; i < 13; i++) { const a = 1.9 + i * .62, r = 15 + i * 2.4; ab(Math.cos(a) * r, -41 + i * 2.5 + R(), Math.sin(a) * r, 1 + 2.6 * R() * (1 - i / 20)); }
    for (let t = 0, n = 0; n < 46 && t < 5000; t++) { const x = (R() - .5) * 400, y = -37 + 27 * R(), z = (R() - .5) * 400; if (gs(TG, x, y, z) > -7 || Math.hypot(x, z) < 12) continue; ab(x, y, z, 1.2 + 4.2 * R() * R()); n++; }
    B.forEach((b, i) => layer(boulder(11 + i * 7, 3, 0, .7 + .12 * i), b, 'o0none', 's0'));
  }
  const PAL = [[1, .42, .28], [1, .28, .52], [.96, .78, .26], [.62, .4, 1], [.25, .88, .78], [1, .55, .78], [.95, .3, .2]];
  const SPK = [], BUB = [], SPOTS = [];
  { // kelp columns + sparkles
    const KH = [40, 26, 13], KI = [[], [], []], occ = new Set(); let nk = 0;
    for (let k = 0; k < 60000 && nk < 620; k++) {
      const o = (R() * NV | 0) * 10, x = TV[o], y = TV[o + 1], z = TV[o + 2];
      if (TV[o + 4] < .82 || y > -10 || zone(x, z) || Math.hypot(x + 78, z - 52) < 27 || Math.hypot(x - 84, z + 58) < 33 || nearCam(x, z, 7) || dcy(x, z) < 5.5 || (fbm(x * .013, 3.1, z * .013, 3) < .5 && R() > (Math.hypot(x, z - 8) < 56 && !(z < 6 && Math.abs(x - 2) < 9) ? .5 : .05))) continue;
      const key = (x / 5 | 0) + ',' + (z / 5 | 0), av = -3 - y, c = av > 33 ? 0 : av > 19 ? 1 : av > 8 ? 2 : -1;
      if (c < 0 || occ.has(key)) continue; occ.add(key); nk++;
      for (let p = 0, np = 3 + (R() * 3 | 0); p < np; p++) {
        const a = R() * 6.28, q = p ? .5 + R() * 1.2 : 0, s = cl(av / KH[c], .7, 1.1) * (.86 + .16 * R()), g = .85 + .3 * R();
        KI[c].push(x + Math.cos(a) * q, y - .3, z + Math.sin(a) * q, s, ...qax(0, 1, 0, R() * 6.28), g * (.9 + .25 * R()), g, g * (.75 + .4 * R()), R() * 6.28, .017, .2, 190, 0);
      }
      for (let i = 0; i < 110; i++) { const a = R() * 6.28, r = .7 + 3 * R(), gold = R() < .55, b = 2.5 + 4 * R(); SPK.push(x + Math.cos(a) * r, y + 1.5 + R() * (av - 2), z + Math.sin(a) * r, .16 + .2 * R() * R(), gold ? b : b * .35, gold ? b * .78 : b, gold ? b * .22 : b * .3, R()); }
    }
    KH.forEach((h, i) => layer(kelpMesh(h, rng(31 + i)), KI[i], 'o1none', 's1', 190, 125));
  }
  await new Promise(r => setTimeout(r));
  { // magenta ground cover: three tufts per covered terrain vertex, plus growth on the wreck
    const T = [], tf = (x, y, z, s) => { const g = .7 + .5 * R(); T.push(x, y, z, s, ...qax(0, 1, 0, R() * 6.28), g, g * (.55 + .6 * R()), g * (.8 + .4 * R()), R() * 6.28, .2, .035, 60, 0); };
    for (let o = 0; o < NV * 10; o += 10) {
      if (TV[o + 4] < .72 || TV[o + 7] < .42) continue;
      for (let k = 0; k < 3; k++) {
        const x = TV[o] + (R() - .5) * 1.5, z = TV[o + 2] + (R() - .5) * 1.5; if (onShip(x, z) || Math.hypot(x + 78, z - 52) < 8.5) continue;
        tf(x, TV[o + 1] - ((x - TV[o]) * TV[o + 3] + (z - TV[o + 2]) * TV[o + 5]) / TV[o + 4] - .04, z, .9 + 1.1 * R());
      }
    }
    for (const p of SHG) for (let k = 0; k < 3; k++) { const n0 = T.length; tf(p[0] + (R() - .5) * .6, p[1] - .03, p[2] + (R() - .5) * .6, .7 + .8 * R()); if (!free(p)) T.length = n0; }
    layer(tuft(rng(41)), T, 'o1none', null, 60);
  }
  { // iridescent foliage, corals, sponges
    const FO = [[], []], CO = [[], [], []], SP = [], FC = [[.55, .18, .95], [1, .25, .68], [.8, .22, .9], [.38, .25, 1], [1, .4, .8]];
    for (let k = 0, n = 0; k < 40000 && n < 2700; k++) {
      const o = (R() * NV | 0) * 10, x = TV[o], y = TV[o + 1], z = TV[o + 2], ny = TV[o + 4];
      if (ny < .2 || y > -6 || zone(x, z) || nearCam(x, z, 5.5) || (fbm(x * .021, 11, z * .021, 3) < .5 && R() > .1)) continue;
      const c = FC[R() * FC.length | 0], q = qmul(qup(nz([TV[o + 3] * .5, ny * .5 + .5, TV[o + 5] * .5])), qax(0, 1, 0, R() * 6.28)), g = .8 + .4 * R();
      FO[R() < .6 ? 0 : 1].push(x, y - .06, z, .6 + 1.1 * R() * R(), ...q, c[0] * g, c[1] * g, c[2] * g, R() * 6.28, .035, .07, 150, 0); n++;
    }
    for (let k = 0, n = 0; k < 300000 && n < 4200; k++) {
      const o = (R() * NV | 0) * 10, x = TV[o], y = TV[o + 1], z = TV[o + 2], ny = TV[o + 4];
      if (ny < .15 || y > -5 || zone(x, z) || (fbm(x * .024, 23, z * .024, 3) < .56 && R() > .03)) continue;
      const c = PAL[R() * PAL.length | 0], q = qmul(qup(nz([TV[o + 3] * .6, ny * .6 + .4, TV[o + 5] * .6])), qax(0, 1, 0, R() * 6.28)), t = R() < .5 ? 0 : R() < .55 ? 1 : 2;
      CO[t].push(x, y - .04, z, (t ? .6 : .9) + 1.5 * R() * R(), ...q, c[0], c[1], c[2], 0, 0, 0, t ? 150 : 95, 0); n++;
    }
    for (let k = 0, n = 0; k < 200000 && n < 800; k++) {
      const o = (R() * NV | 0) * 10, x = TV[o], y = TV[o + 1], z = TV[o + 2];
      if (TV[o + 4] < .7 || y > -8 || zone(x, z) || (fbm(x * .024, 23, z * .024, 3) < .55 && R() > .03)) continue;
      const c = [[.85, .3, .16], [.75, .2, .36], [.9, .5, .15], [.55, .25, .6]][R() * 4 | 0];
      SPOTS.push([x | 0, y | 0, z | 0]); SP.push(x, y - .08, z, .9 + 2 * R() * R(), ...qax(0, 1, 0, R() * 6.28), c[0], c[1], c[2], 0, 0, 0, 0, 0); n++;
      if (R() < .05) for (let i = 0; i < 60; i++)BUB.push(x, y + 1, z, .025 + .05 * R(), R() * 2 - 1, R() * 2 - 1, R(), R());
    }
    for (const p of SHG) {
      const nL = [FO[0].length, FO[1].length, CO[0].length, CO[1].length, CO[2].length, SP.length]; // deck spots stay clear (same random draws either way)
      const u = R(), q = qmul(qup(nz([p[3][0] * .6, p[3][1] * .6 + .4, p[3][2] * .6])), qax(0, 1, 0, R() * 6.28)), c = PAL[R() * PAL.length | 0], f = FC[R() * FC.length | 0];
      if (u < .4) { const t = R() < .5 ? 0 : R() < .5 ? 1 : 2; CO[t].push(p[0], p[1] - .03, p[2], .35 + .5 * R(), ...q, c[0], c[1], c[2], 0, 0, 0, t ? 150 : 95, 0); }
      else if (u < .62) FO[R() < .6 ? 0 : 1].push(p[0], p[1] - .04, p[2], .35 + .4 * R(), ...q, f[0], f[1], f[2], R() * 6.28, .035, .07, 150, 0);
      else if (u < .72) SP.push(p[0], p[1] - .05, p[2], .5 + .5 * R(), ...q, .8, .3, .2, 0, 0, 0, 0, 0);
      if (!free(p)) [FO[0], FO[1], CO[0], CO[1], CO[2], SP].forEach((a, k) => a.length = nL[k]);
    }
    layer(rosette(rng(51)), FO[0], 'o1none', 's1', 150, 70); layer(fan(rng(52)), FO[1], 'o1none', 's1', 150, 70);
    layer(staghorn(rng(61)), CO[0], 'o0none', 's0', 95, 60); layer(tableCoral(rng(62)), CO[1], 'o0none', 's0', 160, 60); layer(brain(rng(63)), CO[2], 'o0none', 's0', 160, 60);
    layer(sponge(rng(64)), SP, 'o0none', 's0', 160, 70);
  }
  { // life: fish schools + mantas, on paths checked against the rock
    const ok = (c, Rx, Ay, Rz, ph, m) => { for (let i = 0; i < 64; i++) { const s = i / 64 * 6.283; if (gs(TG, c[0] + Rx * Math.cos(s), c[1] + Ay * Math.sin(2 * s + ph), c[2] + Rz * Math.sin(s)) > -m) return 0; } return 1; };
    const fit = (ax, az, sp, y0, y1, Rx, Ay, Rz, m, R = R0) => { for (let t = 0; t < 400; t++) { const c = [ax + (R() - .5) * sp, y0 + (y1 - y0) * R(), az + (R() - .5) * sp], ph = R() * 6.28; if (ok(c, Rx, Ay, Rz, ph, m)) return [...c, ph]; } return [ax, -8, az, 0]; };
    const FI = [], gau = () => (R() + R() + R() - 1.5) * .9, FCO = [[.12, .42, .95], [1, .5, .1], [.15, .8, .7], [.95, .22, .42], [.95, .85, .25], [.6, .3, 1]];
    [[10, -8, 30, 5.5, 1.2, 5.5, 650, 9, .42], [30, 20, 60, 22, 3, 15, 520, .5, .2], [-40, -30, 60, 18, 2.5, 24, 480, .5, -.19], [84, -58, 40, 20, 3, 13, 520, .55, .17], [-78, 52, 30, 17, 4, 17, 520, .6, -.2], [-10, 80, 80, 26, 3, 18, 420, .45, .15], [120, 40, 90, 24, 3, 20, 420, .5, -.16], [-120, -40, 90, 22, 3, 22, 420, .5, .17]].forEach((s, si) => {
      const c = fit(s[0], s[1], s[2], -36, -14, s[3] + 3, s[4] + 2, s[5] + 3, 4), col = FCO[si % FCO.length]; AUD.SC.push(FI.length / 16);
      for (let i = 0; i < s[6]; i++) { const g = .7 + .5 * R(); FI.push(c[0], c[1], c[2], .32 + .26 * R(), s[3], s[4], s[5], c[3], col[0] * g, col[1] * g, col[2] * g, (R() - .5) * 2 * s[7], gau() * 2.6, gau() * 1.9, s[8], R() * 6.28); }
    });
    layer(fishMesh(), FI, 'o2none', null); AUD.FI = FI;
    const MA = [];
    [[-78, 52, 0, 21, .085, -21, -21, -4.4], [4, 2, 0, 17, -.09, -17, -17, 2.405], [18, 2, 12, 26, .075, -15, -11], [84, -56, 14, 27, -.07, -27, -20], [-20, -70, 100, 52, .055, -30, -11], [100, 80, 120, 44, .065, -30, -11], [-120, -40, 100, 40, -.06, -30, -11]].forEach(s => {
      const c = fit(s[0], s[1], s[2], s[5], s[6], s[3], 3, s[3], 5.5);
      MA.push(c[0], c[1], c[2], 3.6 + 1.1 * R(), s[3], 3, s[3], c[3], 0, 0, 0, s[7] === undefined ? R() * 6.28 : s[7], .24 * Math.sign(s[4]), 0, s[4], R() * 6.28);
    });
    layer(mantaMesh(), MA, 'o3none', 's3');
    { const R = rng(424242); // new creatures draw from their own stream so the original reef layout is unchanged
    // sea turtles: a few gliding on loops (path kind, flipper strokes) and one resting on the wreck
    const TT = [];
    [[-30, 10, 60, 18, 2.5, 14], [60, -30, 60, 22, 3, 16], [-60, 60, 70, 20, 2, 26], [40, 70, 80, 14, 2, 12], [0, -60, 60, 12, 2, 12], [10, 20, 40, 14, 2, 18]].forEach(s => {
      const c = fit(s[0], s[1], s[2], -32, -12, s[3], s[4], s[5], 4, R), sp = (R() < .5 ? -1 : 1) * 1.3 / Math.max(s[3], s[5]);
      TT.push(c[0], c[1], c[2], 1.1 + .4 * R(), s[3], s[4], s[5], c[3], 0, 0, 0, R() * 6.28, .12 * Math.sign(sp), 1, sp, R() * 6.28);
    });
    { const p = DKT; TT.push(p[0], p[1] + .28, p[2], 1.25, .01, 0, .01, 0, 0, 0, 0, 1.3, 0, .15, 1e-4, 0); }
    layer(turtleMesh(), TT, 'o4none', 's4');
    // whale shark: one giant cruising just under the surface (the mesas reach up to ~-6 m; this is the clear loop), ~3 min per lap
    const WS = [60, -4, 0, 14, 70, .5, 70, 0, 0, 0, 0, 2.2, 0, 0, .033, 0];
    layer(whaleSharkMesh(), WS, 'o6none', 's6'); AUD.WS = WS;
    // jellyfish drifting in the upper water (translucent, drawn late)
    const JE = [], JC = [[.3, .9, 1], [1, .35, .85], [.6, .45, 1], [1, .7, .3], [.35, 1, .6]];
    for (let k = 0, n = 0; k < 5000 && n < 50; k++) {
      const w = n < 32 ? 150 : 320, x = (R() - .5) * w, y = -17 + 11 * R(), z = (R() - .5) * w; if (gs(TG, x, y, z) > -6 || gs(TG, x, y - 3, z) > -3) continue;
      const c = JC[n % JC.length], b = R() * 6.28; JE.push(x, y, z, .55 + .45 * R(), ...qax(Math.cos(b), 0, Math.sin(b), .25 * R()), c[0], c[1], c[2], R() * 6.28, 2 + 3 * R(), .9 + .5 * R(), 0, R() * 6.28); n++;
    }
    layer(jellyMesh(rng(81)), JE, 'j5', null, 0, 0, 1); AUD.JE = JE;
    // eels peeking out of crevices (slide in and out), an octopus on the wreck deck
    const EE = [];
    for (let k = 0, n = 0; k < 300000 && n < 40; k++) {
      const o = (R() * NV | 0) * 10, x = TV[o], y = TV[o + 1], z = TV[o + 2], nx = TV[o + 3], ny = TV[o + 4], nz_ = TV[o + 5];
      if (ny < -.15 || ny > .5 || y > -12 || y < -50 || Math.hypot(x, z) > 140 || zone(x, z) || gs(TG, x + nx * 1.6, y + ny * 1.6, z + nz_ * 1.6) > -1.5) continue;
      const c = [[.45, .5, .16], [.3, .36, .2], [.55, .42, .2]][n % 3];
      EE.push(x - nx * .1, y - ny * .1, z - nz_ * .1, 1.5 + .6 * R(), ...qmul(qup(nz([nx, ny + .25, nz_])), qax(0, 1, 0, R() * 6.28)), c[0], c[1], c[2], R() * 6.28, .16, 1.6 + .6 * R(), 5, .45 + .2 * R()); n++;
    }
    layer(eelMesh(), EE, 'o7none', null, 80);
    { const p = DKO; layer(octopusMesh(), [p[0], p[1] - .02, p[2], .9, ...qmul(qup(p[3]), qax(0, 1, 0, 1)), .8, .28, .14, 0, .1, 1.1, 3, 0], 'o7none', null); }
    // reef life: starfish and crabs on the sand, anemones with little fish darting through them
    const SF = [], AN = [], CF = [], CB = [], SC = [[1, .45, .15], [.85, .15, .2], [.55, .25, .75], [.25, .45, .9], [1, .7, .3]], AC = [[.65, .3, 1], [1, .38, .7], [.35, .95, .6], [1, .55, .25]];
    const spot = (ny, maxR) => { for (let k = 0; k < 4000; k++) { const o = (R() * NV | 0) * 10, x = TV[o], y = TV[o + 1], z = TV[o + 2]; if (TV[o + 4] < ny || TV[o + 7] > .42 || y > -12 || zone(x, z) || Math.hypot(x, z) > maxR || onShip(x, z)) continue; return [x, y, z, qmul(qup([TV[o + 3], TV[o + 4], TV[o + 5]]), qax(0, 1, 0, R() * 6.28))]; } return null; };
    for (let n = 0; n < 260; n++) { const p = spot(.82, 130); if (!p) break; const c = SC[R() * SC.length | 0]; SF.push(p[0], p[1] + .01, p[2], .2 + .2 * R(), ...p[3], c[0], c[1], c[2], 0, 0, 0, 60, 0); }
    for (let n = 0; n < 140; n++) {
      const p = spot(.6, 120); if (!p) break; const c = AC[R() * AC.length | 0], s = .8 + .7 * R();
      AN.push(p[0], p[1] - .03, p[2], s, ...p[3], c[0], c[1], c[2], R() * 6.28, .5, 0, 60, 0);
      if (n % 3 == 0) for (let f = 0, nf = 2 + (R() * 3 | 0); f < nf; f++) { const r = .45 + .3 * R(); CF.push(p[0], p[1] + .5 * s, p[2], .11 + .05 * R(), r, .12, r, R() * 6.28, 1, .42 + .2 * R(), .06, R() * 6.28, 0, 0, (R() < .5 ? -1 : 1) * (1.2 + .8 * R()), R() * 6.28); }
    }
    for (let n = 0; n < 70; n++) { const p = spot(.85, 110); if (!p) break; const c = [[.85, .35, .18], [.75, .5, .3], [.9, .25, .2]][n % 3]; CB.push(p[0], p[1] + .02, p[2], .26 + .14 * R(), ...p[3], c[0], c[1], c[2], R() * 6.28, .12, 7 + 3 * R(), 2, -(.25 + .3 * R())); }
    layer(starfishMesh(), SF, 'o0none', null, 60); layer(anemoneMesh(rng(91)), AN, 'o1none', null, 60); layer(crabMesh(), CB, 'o7none', null, 50); AUD.CB = CB; layer(fishMesh(), CF, 'o2none', null);
    }
  }
  // sprites
  for (const [l, s, c] of [[[0, 1.2, -17.3], -2.2, [1, .5, .16]], [[1.2, -1.6, -5], -1.7, [.9, .42, .14]], [[-.6, -1.2, 8], -1.3, [.8, .4, .14]]]) { const p = add(SHP, qrot(SHQ, l)); SPK.push(p[0], p[1], p[2], s, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, R()); }
  for (let i = 0; i < 90; i++) { const a = R() * 6.28, r = 2 + 9 * R(), b = 1.5 + 2 * R(); SPK.push(SCP[0] + Math.cos(a) * r, SCP[1] + 3 + 20 * R(), SCP[2] + Math.sin(a) * r, .1 + .1 * R(), .25 * b, b, .85 * b, R()); }
  for (let v = 0; v < 22; v++) { const o = (R() * NV | 0) * 10; if (TV[o + 4] < .8 || TV[o + 1] > -30 || Math.hypot(TV[o], TV[o + 2]) > 150) { v--; continue; } for (let i = 0; i < 70; i++)BUB.push(TV[o], TV[o + 1], TV[o + 2], .025 + .06 * R(), R() * 2 - 1, R() * 2 - 1, R(), R()); }
  const SNO = []; for (let i = 0; i < 7000; i++) { const b = .25 + .5 * R(); SNO.push(R() * 44, R() * 44, R() * 44, .012 + .02 * R(), b * .55, b * .85, b, R()); }
  const PTS = [[PP.p1, SNO], [PP.p0, SPK], [PP.p2, BUB]].map(([p, a]) => ({ p, b: buf(new Float32Array(a), BU.VERTEX), n: a.length / 8 }));

  // ---- audio emitters (types in audio.js: 10 bubble vent, 11 wreck, 12 jellyfish, 13 whale shark, 14 fish school, 15 crab); positions mirror the shaders
  const AE = [];
  for (let i = 0; i < BUB.length; i += 8) if (!i || Math.abs(BUB[i] - BUB[i - 8]) + Math.abs(BUB[i + 2] - BUB[i - 6]) > .01) AE.push(10, i);
  AE.push(11, 0); for (let i = 0; i < AUD.JE.length / 16; i++) AE.push(12, i); AE.push(13, 0); for (const s of AUD.SC) AE.push(14, s); for (let i = 0; i < AUD.CB.length / 16; i++) AE.push(15, i);
  const NE = AE.length / 2, ET = new Uint8Array(NE), EI = new Int32Array(NE), EP = new Float64Array(NE * 3), EA = new Float32Array(NE);
  for (let e = 0; e < NE; e++) { ET[e] = AE[e * 2]; EI[e] = AE[e * 2 + 1]; }
  function atick(t, cx, cy, cz) {
    for (let e = 0; e < NE; e++) {
      const ty = ET[e], o = EI[e]; let x, y, z, a = 0;
      if (ty == 10) { x = BUB[o]; y = BUB[o + 1]; z = BUB[o + 2]; }
      else if (ty == 11) { x = SHP[0]; y = SHP[1]; z = SHP[2]; }
      else if (ty == 12) { const J = AUD.JE, b = o * 16; x = J[b] + Math.sin(t * .035 + J[b + 11]) * J[b + 12]; y = J[b + 1] + Math.sin(t * .13 + J[b + 11] * 2) * 1.2; z = J[b + 2] + Math.cos(t * .03 + J[b + 11] * 1.3) * J[b + 12]; }
      else if (ty <= 14) { const F = ty == 13 ? AUD.WS : AUD.FI, b = o * 16, p = F[b + 11] + t * F[b + 14]; x = F[b] + F[b + 4] * Math.cos(p); y = F[b + 1] + F[b + 5] * Math.sin(2 * p + F[b + 7]); z = F[b + 2] + F[b + 6] * Math.sin(p); if (ty == 14) a = 1 - ss(0, 7, Math.hypot(x - cx, y - cy, z - cz)); }
      else { const C = AUD.CB, b = o * 16; x = C[b]; y = C[b + 1]; z = C[b + 2]; }
      EP[e * 3] = x; EP[e * 3 + 1] = y; EP[e * 3 + 2] = z; EA[e] = a;
    }
  }

  // ---- culling grid
  const NCC = NC * NC, cdist = new Float32Array(NCC), cin = new Uint8Array(NCC), ccx = new Float32Array(NCC), ccz = new Float32Array(NCC);
  for (let i = 0; i < NCC; i++) { ccx[i] = (i % NC + .5) * CW - 256; ccz[i] = ((i / NC | 0) + .5) * CW - 256; }
  function cull() {
    const tH = FOVT * W / H, sH = Math.sqrt(1 + tH * tH), sV = Math.sqrt(1 + FOVT * FOVT), r = 37, dy = -28 - S[CY];
    for (let c = 0; c < NCC; c++) {
      const dx = ccx[c] - S[CX], dz = ccz[c] - S[CZ], z = dx * S[FX] + dy * S[FY] + dz * S[FZ];
      cdist[c] = Math.max(0, Math.sqrt(dx * dx + dz * dz) - 23);
      cin[c] = z > -r && Math.abs(dx * S[RX] + dz * S[RZ]) < z * tH + r * sH && Math.abs(dx * S[UX] + dy * S[UY] + dz * S[UZ]) < z * FOVT + r * sV ? 1 : 0;
    }
  }
  let drawn = 0;
  function drawLayers(p, sh, lt) {
    for (let l = 0; l < LAY.length; l++) {
      const L = LAY[l], pp = sh ? L.ps : L.pm; if (!pp || L.lt !== lt) continue;
      p.setPipeline(pp); p.setVertexBuffer(0, L.vb); p.setVertexBuffer(1, L.inst); p.setIndexBuffer(L.ib, 'uint32');
      const cs = L.cs; if (!cs) { p.drawIndexed(L.ni, L.n); drawn = drawn + L.tris * L.n | 0; continue; }
      const md = sh ? L.sd : L.md; let run = -1, cnt = 0;
      for (let c = 0; c < NCC; c++) {
        const n = cs[c + 1] - cs[c]; if (!n) continue;
        if (cdist[c] < md && (sh || cin[c])) { if (run < 0) { run = cs[c]; cnt = 0; } cnt += n; }
        else if (run >= 0) { p.drawIndexed(L.ni, cnt, 0, 0, run); drawn = drawn + L.tris * cnt | 0; run = -1; }
      }
      if (run >= 0) { p.drawIndexed(L.ni, cnt, 0, 0, run); drawn = drawn + L.tris * cnt | 0; }
    }
  }

  // ---- render targets (rebuilt on resize only)
  const RT = [], NB = 5;
  const PD_SH = { colorAttachments: [], depthStencilAttachment: { view: shV, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } };
  const PD_MAIN = { colorAttachments: [{ view: null, resolveTarget: null, clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'discard' }], depthStencilAttachment: { view: null, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' } };
  const PD_VM = cpass(vA), PD_VH = cpass(vB), PD_VV = cpass(vA), BG_VM = dev.createBindGroup({ layout: BGL_SD, entries: [{ binding: 0, resource: shV }] }), BG_VH = dev.createBindGroup({ layout: BGL_UF, entries: [{ binding: 0, resource: vA }] }), BG_VV = dev.createBindGroup({ layout: BGL_UF, entries: [{ binding: 0, resource: vB }] });
  const PD_RAY = cpass(null), PD_BH = cpass(null), PD_BV = cpass(null), PD_FIN = cpass(null), PD_DN = [], PD_UP = [], BG_DN = [], BG_UP = [];
  for (let i = 0; i < NB; i++) { PD_DN.push(cpass(null)); const u = cpass(null); u.colorAttachments[0].loadOp = 'load'; PD_UP.push(u); }
  let BG_D, BG_BH, BG_BV, BG_FIN, QS = null, QR, QB = [], QF, QCB = [];
  function targets() {
    for (const t of RT) t.destroy(); RT.length = 0;
    const tx = (w, h, f, u, sc) => { const t = dev.createTexture({ size: [Math.max(1, w), Math.max(1, h)], format: f, usage: u, sampleCount: sc || 1 }); RT.push(t); return t.createView(); };
    const msc = tx(W, H, HF, RA, 4), msd = tx(W, H, 'depth32float', RA | TB, 4), hdr = tx(W, H, HF, RA | TB), rA = tx(W >> 1, H >> 1, HF, RA | TB), rB = tx(W >> 1, H >> 1, HF, RA | TB);
    PD_MAIN.colorAttachments[0].view = msc; PD_MAIN.colorAttachments[0].resolveTarget = hdr; PD_MAIN.depthStencilAttachment.view = msd;
    BG_D = dev.createBindGroup({ layout: BGL_D, entries: [{ binding: 0, resource: msd }] });
    PD_RAY.colorAttachments[0].view = rA; PD_BH.colorAttachments[0].view = rB; PD_BV.colorAttachments[0].view = rA; BG_BH = bgT(rA, sClamp); BG_BV = bgT(rB, sClamp);
    const bl = []; for (let i = 0; i < NB; i++) { bl.push(tx(W >> (i + 1), H >> (i + 1), HF, RA | TB)); PD_DN[i].colorAttachments[0].view = PD_UP[i].colorAttachments[0].view = bl[i]; BG_DN[i] = bgT(i ? bl[i - 1] : hdr, sClamp); if (i) BG_UP[i - 1] = bgT(bl[i], sClamp); }
    BG_FIN = bgT(hdr, rA, bl[0], sClamp);
  }
  let rw = 0, rh = 0;
  function resize() { const w = Math.min(+qs.get('w') || rw || Math.round(cv.clientWidth * devicePixelRatio), 8192), h = Math.min(+qs.get('h') || rh || Math.round(cv.clientHeight * devicePixelRatio), 8192); if (w !== W || h !== H) { W = w; H = h; targets(); } if (on() && (cv.width !== W || cv.height !== H)) { cv.width = W; cv.height = H; } }
  try { new ResizeObserver(e => { const b = e[0].devicePixelContentBoxSize; if (b) { rw = b[0].inlineSize; rh = b[0].blockSize; } if (on()) resize(); }).observe(cv, { box: 'device-pixel-content-box' }); } catch (e) { addEventListener('resize', () => { if (on()) resize(); }); }
  resize();
  // GPU timestamps (bench / capture only)
  let gpuMs = 0, gN = 0; const GT = new Float32Array(1 << 16), FT = new Float32Array(1 << 16); let fN = 0;
  if (TS) {
    QS = dev.createQuerySet({ type: 'timestamp', count: 2 }); QR = dev.createBuffer({ size: 16, usage: BU.QUERY_RESOLVE | BU.COPY_SRC }); QF = new Uint8Array(8);
    for (let i = 0; i < 8; i++) { const b = dev.createBuffer({ size: 16, usage: BU.COPY_DST | BU.MAP_READ }); QB.push(b); QCB.push(() => { const a = new BigInt64Array(b.getMappedRange()); gpuMs = Number(a[1] - a[0]) / 1e6; if (rec && gN < GT.length) GT[gN++] = gpuMs; b.unmap(); QF[i] = 0; }); }
    PD_CA[0].timestampWrites = { querySet: QS, beginningOfPassWriteIndex: 0 }; PD_FIN.timestampWrites = { querySet: QS, endOfPassWriteIndex: 1 };
  }
  let rec = 0;

  // ---- frame
  function draw() {
    uniforms(); cull(); drawn = 0;
    const e = dev.createCommandEncoder();
    let p = e.beginRenderPass(PD_CA[0]); p.setPipeline(PP.g2); p.setBindGroup(0, BG_U); p.draw(3); p.end();
    for (let m = 1; m < 5; m++) { p = e.beginRenderPass(PD_CA[m]); p.setPipeline(PP.b16); p.setBindGroup(0, BG_U); p.setBindGroup(1, BG_CA[m]); p.draw(3); p.end(); }
    p = e.beginRenderPass(PD_SH); p.setBindGroup(0, BG_US); drawLayers(p, 1, 0); p.end();
    p = e.beginRenderPass(PD_VM); p.setPipeline(PP.vm); p.setBindGroup(0, BG_VM); p.draw(3); p.end();
    p = e.beginRenderPass(PD_VH); p.setPipeline(PP.vb0); p.setBindGroup(0, BG_VH); p.draw(3); p.end();
    p = e.beginRenderPass(PD_VV); p.setPipeline(PP.vb1); p.setBindGroup(0, BG_VV); p.draw(3); p.end();
    p = e.beginRenderPass(PD_MAIN); p.setBindGroup(0, BG_M); drawLayers(p, 0, 0);
    if (!DBG) { p.setPipeline(PP.surf); p.draw(4); }
    p.setPipeline(PP.bg); p.draw(3);
    drawLayers(p, 0, 1);
    for (let i = 0; i < PTS.length; i++) { const s = PTS[i]; p.setPipeline(s.p); p.setVertexBuffer(0, s.b); p.draw(4, s.n); }
    HO.portal(p, WI);
    p.end();
    p = e.beginRenderPass(PD_RAY); p.setPipeline(PP.ray); p.setBindGroup(0, BG_M); p.setBindGroup(1, BG_D); p.draw(3); p.end();
    p = e.beginRenderPass(PD_BH); p.setPipeline(PP.bh); p.setBindGroup(0, BG_U); p.setBindGroup(1, BG_BH); p.draw(3); p.end();
    p = e.beginRenderPass(PD_BV); p.setPipeline(PP.bv); p.setBindGroup(0, BG_U); p.setBindGroup(1, BG_BV); p.draw(3); p.end();
    for (let i = 0; i < NB; i++) { p = e.beginRenderPass(PD_DN[i]); p.setPipeline(PP.dn); p.setBindGroup(0, BG_U); p.setBindGroup(1, BG_DN[i]); p.draw(3); p.end(); }
    for (let i = NB - 2; i >= 0; i--) { p = e.beginRenderPass(PD_UP[i]); p.setPipeline(PP.up); p.setBindGroup(0, BG_U); p.setBindGroup(1, BG_UP[i]); p.draw(3); p.end(); }
    PD_FIN.colorAttachments[0].view = HO.snapView || ctx.getCurrentTexture().createView();
    p = e.beginRenderPass(PD_FIN); p.setPipeline(PP.fin); p.setBindGroup(0, BG_U); p.setBindGroup(1, BG_FIN); p.draw(3); p.end();
    let q = -1;
    if (TS) { for (let i = 0; i < 8; i++)if (!QF[i]) { q = i; break; } if (q >= 0) { e.resolveQuerySet(QS, 0, 2, QR, 0); e.copyBufferToBuffer(QR, 0, QB[q], 0, 16); QF[q] = 1; } }
    SUB[0] = e.finish(); dev.queue.submit(SUB);
    if (q >= 0) QB[q].mapAsync(GPUMapMode.READ).then(QCB[q]);
  }

  // ---- input
  const K = new Uint8Array(8); let flying = BENCH || qs.has('fly') && HO.first === WI;
  const key = (e, d) => {
    if (d && !on()) return;
    switch (e.code) {
      case 'KeyW': K[0] = d; break; case 'KeyS': K[1] = d; break; case 'KeyA': K[2] = d; break; case 'KeyD': K[3] = d; break; case 'KeyQ': K[4] = d; break; case 'KeyE': K[5] = d; break;
      case 'ShiftLeft': case 'ShiftRight': K[6] = d; break;
      case 'KeyF': if (d && !BENCH) { flying = !flying; S[T0] = S[TIME]; } break;
      default: if (d && e.code.startsWith('Digit')) { const n = +e.code[5] - 1; if (n >= 0 && n < POSES.length / 6) { flying = false; pose(n); } }
    }
  };
  addEventListener('keydown', e => { key(e, 1); if (on()) K[6] = e.shiftKey ? 1 : 0; }); addEventListener('keyup', e => { key(e, 0); K[6] = e.shiftKey ? 1 : 0; }); // boost follows the real Shift state
  addEventListener('mousemove', e => { if (on() && document.pointerLockElement === cv) { K[6] = e.shiftKey ? 1 : 0; S[YAW] += e.movementX * .0022; S[PIT] = Math.min(Math.max(S[PIT] - e.movementY * .0022, -1.5), 1.5); } });
  const HELP = 'Click to dive  ·  WASD move  ·  mouse look  ·  Q / E down / up  ·  Shift boost  ·  F fly-through  ·  1–6 viewpoints  ·  P next world\nSwim into the golden ring to rise into the sky';
  function blocked() { // is the point S[QX..QZ] inside (or within ~1 m of) rock? trilinear sample of the density grid, no doubles cross a call boundary
    const x = Math.min(Math.max((S[QX] - OX) / CS, 0), NX - 1.001), y = Math.min(Math.max((S[QY] - OY) / CS, 0), NY - 1.001), z = Math.min(Math.max((S[QZ] - OZ) / CS, 0), NZ - 1.001);
    const ix = x | 0, iy = y | 0, iz = z | 0, tx = x - ix, ty = y - iy, tz = z - iz, D = TG.D, c = ix + iy * NX + iz * NX * NY, s = NX * NY;
    const a = D[c] + (D[c + 1] - D[c]) * tx, b = D[c + NX] + (D[c + NX + 1] - D[c + NX]) * tx, e = D[c + s] + (D[c + s + 1] - D[c + s]) * tx, f = D[c + s + NX] + (D[c + s + NX + 1] - D[c + s + NX]) * tx;
    const p = a + (b - a) * ty, q = e + (f - e) * ty; return p + (q - p) * tz > -1.1;
  }
  function move() {
    const dt = S[DT], sp = K[6] ? 30 : 9, a = K[0] - K[1], b = K[3] - K[2], c = K[5] - K[4], k = 1 - Math.exp(-dt * 5);
    S[VX] += ((S[FX] * a + S[RX] * b) * sp - S[VX]) * k; S[VY] += ((S[FY] * a + c) * sp - S[VY]) * k; S[VZ] += ((S[FZ] * a + S[RZ] * b) * sp - S[VZ]) * k;
    const nx = Math.min(Math.max(S[CX] + S[VX] * dt, -232), 232), ny = Math.min(Math.max(S[CY] + S[VY] * dt, -62), -1.3), nz2 = Math.min(Math.max(S[CZ] + S[VZ] * dt, -232), 232);
    S[QX] = nx; S[QY] = ny; S[QZ] = nz2;
    if (!blocked()) { S[CX] = nx; S[CY] = ny; S[CZ] = nz2; }
    else {
      S[QY] = S[CY]; S[QZ] = S[CZ]; if (blocked()) S[VX] = 0; else S[CX] = nx;
      S[QX] = S[CX]; S[QY] = ny; if (blocked()) S[VY] = 0; else S[CY] = ny;
      S[QY] = S[CY]; S[QZ] = nz2; if (blocked()) S[VZ] = 0; else S[CZ] = nz2;
    }
  }
  let benchDone = 0;
  function frame() {
    const now = HO.T[0], dt = Math.min((now - S[LAST]) / 1000, .1); S[LAST] = now; S[TIME] = now / 1000 + S[TOFF];
    if (flying) {
      const t = S[TIME] - S[T0]; S[FT_] = t; fly();
      if (BENCH && !benchDone) { if (t > 1 && fN < FT.length) FT[fN++] = dt * 1000; if (t >= FLT + 1) { benchDone = 1; report(); } }
    } else { S[DT] = dt; move(); }
    draw();
  }
  function report() {
    rec = 0;
    const st = (a, n) => { const s = Array.from(a.subarray(0, n)).sort((x, y) => x - y); return { n, avg: s.reduce((x, y) => x + y, 0) / n, p50: s[n >> 1], p99: s[Math.min(n - 1, Math.floor(n * .99))], max: s[n - 1] }; };
    const f = (o, u) => o.n ? `avg ${o.avg.toFixed(2)}  p50 ${o.p50.toFixed(2)}  p99 ${o.p99.toFixed(2)}  max ${o.max.toFixed(2)} ${u}  (${o.n} samples)` : 'n/a';
    const r = { res: W + 'x' + H, adapter: ad.info ? ad.info.description || ad.info.vendor : '', gpu: gN ? st(GT, gN) : { n: 0 }, frame: st(FT, fN), over16: Array.from(FT.subarray(0, fN)).filter(x => x > 16.7).length };
    window.__bench = r; console.log('BENCH ' + JSON.stringify(r));
    say(`60 s fly-through @ ${r.res}  —  ${r.adapter}\nGPU frame S[TIME] (timestamp queries): ${f(r.gpu, 'ms')}\nFrame interval (rAF): ${f(r.frame, 'ms')}   frames over 16.7 ms: ${r.over16}`);
  }
  // warm the JIT on the per-frame math before the first visible frame (unoptimised code boxes doubles)
  for (let i = 0; i < 5000; i++) { S[FT_] = i * .012; fly(); uniforms(); cull(); S[DT] = .006; move(); }
  if (BENCH) say('Benchmark: 60 s scripted fly-through…');
  if (CAP) {
    const stat = () => ({ tris: drawn, gpuMs, layers: LAY.length, verts: NV });
    window.__cap = {
      n: POSES.length / 6, stat, gs: (x, y, z) => gs(TG, x, y, z), gy, spots: SPOTS,
      set(x, y, z, yw, pt, t) { S[CX] = x; S[CY] = y; S[CZ] = z; S[YAW] = yw; S[PIT] = pt; S[TIME] = t; draw(); return stat(); },
      pose(i) { S[TIME] = pose(i); draw(); return stat(); }, fly(t) { S[TIME] = t; S[FT_] = t; fly(); draw(); return stat(); },
      path(dt) { const o = []; for (let t = 0; t < FLT; t += dt) { S[FT_] = t; flyAt(FA); o.push([+FA[0].toFixed(1), +FA[1].toFixed(1), +FA[2].toFixed(1), +gs(TG, FA[0], FA[1], FA[2]).toFixed(1)]); } return o; },
      async gpu(k) { let s = 0; for (let i = 0; i < k; i++) { draw(); await dev.queue.onSubmittedWorkDone(); await new Promise(r => setTimeout(r, 4)); s += gpuMs; } return s / k; },
      png: () => cv.toDataURL('image/png'), jpg: q => cv.toDataURL('image/jpeg', q)
    };
    return;
  }
  if (BENCH) rec = 1;
  S[T0] = 0; pose(0); S[LAST] = performance.now(); S[TOFF] = -S[LAST] / 1000;
  return {
    name: 'Kelp Sanctum', help: HELP, audio: { n: NE, T: ET, P: EP, A: EA, tick: atick, ref: 3.5 }, tanY: FOVT, bench: BENCH, speed: 9, tick: frame,
    place(x, y, z, yaw, v, pit = 0) { S[CX] = x; S[CY] = y; S[CZ] = z; S[YAW] = yaw; S[PIT] = pit; flying = false; S[VX] = Math.sin(yaw) * v; S[VY] = 0; S[VZ] = -Math.cos(yaw) * v; },
    hold(codes) { for (const c of codes) if (/^Key[WASDQE]$|^Shift/.test(c)) key({ code: c }, 1); },
    enter() { resize(); S[LAST] = performance.now(); }, leave() { K.fill(0); },
    snap() { HO.snapView = HO.peek(HO.snapFor, W, H); S[TIME] = performance.now() / 1000 + S[TOFF]; draw(); HO.snapView = null; }
  };
};
