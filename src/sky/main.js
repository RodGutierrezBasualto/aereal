// ---------- renderer + runtime (H = shared host: device, canvas, portal; ID = this world's index)
const main = async (H, ID) => {
  const Q = H.Q, cv = H.cv, ad = H.ad, dev = H.dev, q = dev.queue, ctx = H.ctx, FMT = H.FMT, on = () => H.cur === ID, PU = H.PU[ID];
  const hud = { set textContent(s) { H.say(s, ID) }, style: {} };
  const BENCH = Q.has('bench') && H.first === ID, CAP = Q.has('cap') && H.first === ID, TSQ = (BENCH || Q.has('ts')) && H.TS;
  await new Promise(r => setTimeout(r));
  const tg = performance.now(), W = genWorld(), N2M = genN2(512), N3D = genN3(64);
  console.log('gen ms ' + (performance.now() - tg | 0) + ' verts ' + W.M.nv + ' tris ' + W.M.ni / 3 + ' clusters ' + W.cl.d.length / 8 + ' ferns ' + W.pl.d.length / 8 + ' tufts ' + W.tu.d.length / 8 + ' vines ' + W.vi.d.length / 12);

  const BU = GPUBufferUsage, TU = GPUTextureUsage, VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, FR = GPUShaderStage.FRAGMENT;
  const mkbuf = (d, u) => { const b = dev.createBuffer({ size: (d.byteLength + 3) & ~3, usage: u | BU.COPY_DST }); q.writeBuffer(b, 0, d.buffer || d, d.byteOffset || 0, d.byteLength); return b };
  const split = it => { const n = it.length / 8, f = new Float32Array(n * 4), i = new Int32Array(n * 4); for (let k = 0; k < n; k++) { f.set(it.subarray(k * 8, k * 8 + 4), k * 4); i[k * 4] = it[k * 8 + 4]; i[k * 4 + 1] = it[k * 8 + 5]; i[k * 4 + 2] = it[k * 8 + 6] } return [f, i, n] };
  // geometry
  const B = { vb: mkbuf(W.vb, BU.VERTEX), ib: mkbuf(W.ib, BU.INDEX), cmv: mkbuf(W.cm.v, BU.VERTEX), cmi: mkbuf(W.cm.i, BU.INDEX), cli: mkbuf(W.cl.d, BU.VERTEX), fern: mkbuf(W.fern, BU.VERTEX), tuft: mkbuf(W.tuft, BU.VERTEX), pli: mkbuf(W.pl.d, BU.VERTEX), tui: mkbuf(W.tu.d, BU.VERTEX), vii: mkbuf(W.vi.d, BU.VERTEX), bird: mkbuf(W.bird, BU.VERTEX), ray: mkbuf(W.ray, BU.VERTEX), bfly: mkbuf(W.bfly, BU.VERTEX), fai: mkbuf(W.fa.d, BU.VERTEX), cri: mkbuf(W.cr, BU.VERTEX), pai: mkbuf(W.pa, BU.VERTEX) };
  const [solF, solI, nSol] = split(W.items), [clF, clI, nCl] = split(W.cl.it), [plF, plI, nPl] = split(W.pl.it), [tuF, tuI, nTu] = split(W.tu.it), [viF, viI, nVi] = split(W.vi.it);
  const CORE = W.cm.core, NFERN = W.fern.length / 32 * 6, NTUFT = W.tuft.length / 8, NBIRD = W.bird.length / 8, NRAY = W.ray.length / 8, NB = W.nb, NR = W.nr, NF = W.cr.length / 12 - NB - NR, NBF = W.bfly.length / 8, NPA = W.pa.length / 8;
  // uniforms
  const UB = new Float32Array(100), ubuf = dev.createBuffer({ size: 400, usage: BU.UNIFORM | BU.COPY_DST }), gbuf = mkbuf(W.grp, BU.UNIFORM), stbuf = mkbuf(W.st, BU.UNIFORM);
  // textures & samplers
  const n2 = dev.createTexture({ size: [512, 512], format: 'rgba8unorm', mipLevelCount: N2M.length, usage: TU.TEXTURE_BINDING | TU.COPY_DST });
  N2M.forEach((m, i) => q.writeTexture({ texture: n2, mipLevel: i }, m, { bytesPerRow: (512 >> i) * 4 }, [512 >> i, 512 >> i]));
  const n3 = dev.createTexture({ size: [64, 64, 64], dimension: '3d', format: 'rgba8unorm', usage: TU.TEXTURE_BINDING | TU.COPY_DST });
  q.writeTexture({ texture: n3 }, N3D, { bytesPerRow: 256, rowsPerImage: 64 }, [64, 64, 64]);
  const SMR = 2048, sm = dev.createTexture({ size: [SMR, SMR, 3], format: 'depth32float', usage: TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING });
  const n2v = n2.createView(), n3v = n3.createView(), smv = sm.createView({ dimension: '2d-array' });
  const SR = dev.createSampler({ addressModeU: 'repeat', addressModeV: 'repeat', addressModeW: 'repeat', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 8 });
  const SL = dev.createSampler({ magFilter: 'linear', minFilter: 'linear' }), SC = dev.createSampler({ compare: 'less-equal', magFilter: 'linear', minFilter: 'linear' });
  // layouts & pipelines
  const L0 = dev.createBindGroupLayout({ entries: [0, 1, 2].map(b => ({ binding: b, visibility: VF, buffer: {} })) });
  const FMB = W.fa.g.map(([k]) => k == 'bird' ? B.bird : mkbuf(W.fm[k], BU.VERTEX)), FG = new Int32Array(W.fa.g.flatMap(([k, f, n]) => [(k == 'bird' ? W.bird : W.fm[k]).length / 8, n, f])), NFG = W.fa.g.length; // fauna: per group vertex count, instances, first
  const hm = dev.createTexture({ size: [256, 256], format: 'r32float', usage: TU.TEXTURE_BINDING | TU.COPY_DST }); q.writeTexture({ texture: hm }, W.hm, { bytesPerRow: 1024 }, [256, 256]); const hmv = hm.createView();
  const L1 = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: VF, texture: {} }, { binding: 1, visibility: VF, texture: { viewDimension: '3d' } }, { binding: 2, visibility: VF, sampler: {} }, { binding: 3, visibility: VF, texture: { sampleType: 'depth', viewDimension: '2d-array' } }, { binding: 4, visibility: VF, sampler: { type: 'comparison' } }, { binding: 5, visibility: VF, texture: {} }, { binding: 6, visibility: VF, texture: {} }, { binding: 7, visibility: VF, sampler: {} }, { binding: 8, visibility: VF, texture: { sampleType: 'unfilterable-float' } }] });
  const L1s = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }] });
  const PLm = dev.createPipelineLayout({ bindGroupLayouts: [L0, L1] }), PLs = dev.createPipelineLayout({ bindGroupLayouts: [L0, L1s] });
  const mod = code => dev.createShaderModule({ code });
  const va = (arrayStride, stepMode, l0, n) => ({ arrayStride, stepMode, attributes: Array.from({ length: n }, (_, i) => ({ shaderLocation: l0 + i, offset: i * 16, format: 'float32x4' })) });
  const VSO = [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'snorm16x4' }, { shaderLocation: 2, offset: 20, format: 'uint8x4' }] }];
  const VMI = [va(32, 'vertex', 0, 2), va(32, 'instance', 2, 2)], VCR = [va(32, 'vertex', 0, 2), va(48, 'instance', 2, 3)], VVI = [va(48, 'instance', 0, 3)], VPA = [va(32, 'instance', 0, 2)], VFA = [va(32, 'vertex', 0, 2), va(64, 'instance', 2, 4)];
  const DS = { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' }, DSN = { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater' };
  const mainP = (code, buffers, o = {}) => { const m = mod(code); return dev.createRenderPipeline({ layout: PLm, vertex: { module: m, buffers }, fragment: { module: m, targets: [{ format: 'rgba16float', blend: o.blend }] }, primitive: { topology: o.strip ? 'triangle-strip' : 'triangle-list', cullMode: 'none' }, depthStencil: o.ds || DS, multisample: { count: 4, alphaToCoverageEnabled: !!o.a2c } }) };
  const shP = (code, buffers) => dev.createRenderPipeline({ layout: PLs, vertex: { module: mod(code), buffers }, primitive: { cullMode: 'none' }, depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBiasSlopeScale: 2 } });
  const postP = (code, fm, blend) => { const m = mod(code); return dev.createRenderPipeline({ layout: 'auto', vertex: { module: m }, fragment: { module: m, targets: fm.map(format => ({ format, blend })) } }) };
  const ADD = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } }, PMA = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
  const P = {
    sky: mainP(SKY, [], { ds: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'always' } }), sol: mainP(SOL, VSO), leaf: mainP(LEAF, VMI), plant: mainP(PLANT, VMI), crea: mainP(CREA, VCR), fauna: mainP(FAUNA, VFA),
    vine: mainP(VINE, VVI, { strip: 1, blend: PMA, ds: DSN }), part: mainP(PART, VPA, { strip: 1, blend: ADD, ds: DSN }),
    solS: shP(SOLS, VSO), leafS: shP(LEAFS, VMI),
    res: postP(RESO, ['rgba16float', 'r16float']), cloud: postP(CLOUD, ['rgba16float', 'r16float']), rays: postP(RAYS, ['rgba16float']), rayb: postP(RAYB, ['rgba16float']),
    bd0: postP(BLD.replace('KW', '1.'), ['rgba16float']), bd: postP(BLD.replace('KW', '0.'), ['rgba16float']), bu: postP(BLU, ['rgba16float'], ADD), fin: postP(FINAL, [FMT])
  };
  const bg = (layout, e) => dev.createBindGroup({ layout, entries: e.map(([binding, r]) => ({ binding, resource: r.size ? { buffer: r } : r })) });
  const BG0 = bg(L0, [[0, ubuf], [1, gbuf], [2, stbuf]]);
  const BGC = [0, 1, 2].map(c => bg(L1s, [[0, mkbuf(new Uint32Array([c, 0, 0, 0]), BU.UNIFORM)]]));
  const BGcl = bg(P.cloud.getBindGroupLayout(0), [[0, ubuf], [2, stbuf], [3, n2v], [4, n3v], [5, SR]]);
  // passes (descriptors are reused every frame)
  const col = () => ({ view: null, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] });
  const PD = {
    sh: [0, 1, 2].map(c => ({ colorAttachments: [], depthStencilAttachment: { view: sm.createView({ dimension: '2d', baseArrayLayer: c, arrayLayerCount: 1 }), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } })),
    cloud: { colorAttachments: [col(), col()] }, main: { colorAttachments: [col()], depthStencilAttachment: { view: null, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' } },
    res: { colorAttachments: [col(), col()] }, rays: { colorAttachments: [col()] }, rayb: { colorAttachments: [col()] }, fin: { colorAttachments: [col()] }, bl: []
  };
  const NBL = 6; let WD = 0, HT = 0, BGm, BGres, BGrays, BGrayb, BGfin; const T = {}, BGb = [];
  function resize() {
    const hw = (WD + 1) >> 1, hh = (HT + 1) >> 1, RT = TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING;
    for (const k in T) T[k].destroy();
    const tx = (k, w, h, format, sampleCount = 1, mipLevelCount = 1) => T[k] = dev.createTexture({ size: [w, h], format, sampleCount, mipLevelCount, usage: RT });
    const mc = tx('mc', WD, HT, 'rgba16float', 4).createView(), md = tx('md', WD, HT, 'depth32float', 4).createView(), hd = tx('hd', WD, HT, 'rgba16float').createView(), ld = tx('ld', WD, HT, 'r16float').createView();
    const ct = tx('ct', hw, hh, 'rgba16float').createView(), cd = tx('cd', hw, hh, 'r16float').createView(), ry = tx('ry', hw, hh, 'rgba16float').createView(), r2 = tx('r2', hw, hh, 'rgba16float').createView();
    tx('bl', hw, hh, 'rgba16float', 1, NBL); const bv = Array.from({ length: NBL }, (_, i) => T.bl.createView({ baseMipLevel: i, mipLevelCount: 1 }));
    PD.cloud.colorAttachments[0].view = ct; PD.cloud.colorAttachments[1].view = cd; PD.main.colorAttachments[0].view = mc; PD.main.depthStencilAttachment.view = md;
    PD.res.colorAttachments[0].view = hd; PD.res.colorAttachments[1].view = ld; PD.rays.colorAttachments[0].view = ry; PD.rayb.colorAttachments[0].view = r2; BGrayb = bg(P.rayb.getBindGroupLayout(0), [[0, ry], [1, ld]]);
    BGm = bg(L1, [[0, n2v], [1, n3v], [2, SR], [3, smv], [4, SC], [5, ct], [6, cd], [7, SL], [8, hmv]]);
    BGres = bg(P.res.getBindGroupLayout(0), [[0, ubuf], [3, mc], [4, md]]);
    BGrays = bg(P.rays.getBindGroupLayout(0), [[0, ubuf], [2, stbuf], [3, n2v], [4, n3v], [5, SR], [6, smv], [7, SC], [8, ld]]);
    BGfin = bg(P.fin.getBindGroupLayout(0), [[0, ubuf], [3, hd], [4, r2], [5, ld], [6, bv[0]], [7, SL]]);
    PD.bl.length = 0; BGb.length = 0;
    for (let i = 0; i < NBL; i++) { const p = i ? P.bd : P.bd0; PD.bl.push({ colorAttachments: [{ view: bv[i], loadOp: 'clear', storeOp: 'store' }] }); BGb.push(bg(p.getBindGroupLayout(0), [[0, i ? bv[i - 1] : hd], [1, SL]])) }
    for (let i = NBL - 2; i >= 0; i--) { PD.bl.push({ colorAttachments: [{ view: bv[i], loadOp: 'load', storeOp: 'store' }] }); BGb.push(bg(P.bu.getBindGroupLayout(0), [[0, bv[i + 1]], [1, SL]])) }
  }
  const fit = () => { const w = +Q.get('w') || max(1, round(cv.clientWidth * devicePixelRatio)), h = +Q.get('h') || max(1, round(cv.clientHeight * devicePixelRatio)), same = w === WD && h === HT && T.mc; WD = w; HT = h; if (on() && (cv.width !== WD || cv.height !== HT)) { cv.width = WD; cv.height = HT } if (!same) resize() }; // targets are only rebuilt when the size really changed
  fit(); if (!Q.get('w')) addEventListener('resize', () => { if (on()) fit() });

  // ---------- per-frame state: everything numeric lives in typed arrays (no allocation while running)
  const S = new Float64Array(64), IM = new Int32Array(8), K = new Uint8Array(256), QS = [null];
  const NEAR = .5, FOGK = Q.has('fog') ? +Q.get('fog') : 1, SPL = new Float64Array([150, 560, 2100]), ZE = 3000;
  const sun = nrm([-.45, .47, -.76]), lx = nrm(crs([0, 1, 0], sun)), ly = crs(sun, lx), LB = new Float64Array([...lx, ...ly, ...sun]);
  const POSES = new Float64Array([
    -820, 170, 1000, 0.6747, 0.1480, 8,
    160, 80, 180, -0.0303, 0.8286, 20,
    400, 470, 150, -0.7589, -0.0417, 30,
    760, 250, -420, 1.3171, 0.0000, 40,
    -500, 860, 1500, 0.5880, -0.5315, 50,
    1140, 200, 575, 2.1503, -0.0614, 56]);
  const CP = new Float64Array([
    -800, 280, 1170, 0, 380, 0,
    -620, 205, 990, 40, 380, -60,
    -400, 150, 780, 60, 360, -100,
    -140, 105, 560, 70, 420, -110,
    30, 95, 340, 160, 440, -60,
    150, 100, 170, 235, 460, -24,
    300, 100, 60, 235, 460, -24,
    500, 130, -10, 330, 380, -200,
    680, 265, -170, 640, 330, -460,
    700, 300, -330, 900, 290, -560,
    800, 260, -440, 1300, 250, -560,
    900, 300, -300, 1350, 220, -250,
    980, 330, 0, 1350, 150, 250,
    840, 320, 190, 1350, 140, 450,
    740, 290, 400, 1350, 120, 700,
    700, 250, 570, 1550, 130, 850,
    760, 200, 740, 1700, 150, 950,
    1080, 170, 800, 1650, 80, 1150,
    1150, 60, 980, 1330, -30, 1740,
    1030, -70, 1010, 1000, -200, 1650,
    800, -160, 820, 300, -300, 1450,
    540, -250, 760, -300, -200, 1050,
    300, -310, 930, -180, -80, 900,
    60, -320, 1040, -180, 20, 900,
    -180, -280, 1150, -180, 150, 900,
    -400, -200, 1250, -180, 260, 880,
    -600, -60, 1330, -250, 300, 500,
    -800, 90, 1400, -100, 330, 300,
    -1000, 260, 1470, -50, 340, 150,
    -1150, 400, 1520, 0, 340, 0]);
  const QF = new Float64Array([1.25, 1.2, 1.1, 0.9, 0.75, 0.6, 0.6, 0.6, 0.55, 0.55, 0.6, 0.9, 1.1, 0.8, 0.7, 0.7, 0.7, 0.3, 0.8, 1, 1.05, 1.05, 1, 0.95, 0.9, 0.9, 1, 1.05, 1.05, 1]);
  S.set(POSES.subarray(0, 5)); S[10] = Math.tan(.5236);
  function camBasis() { const cy = cos(S[3]), sy = sin(S[3]), cp = cos(S[4]), sp = sin(S[4]); S[16] = sy * cp; S[17] = sp; S[18] = -cy * cp; S[19] = cy; S[20] = 0; S[21] = sy; S[22] = -sy * sp; S[23] = cp; S[24] = cy * sp }
  function move() {
    const dt = S[12]; S[3] += S[13] * .0022; S[4] = clamp(S[4] - S[14] * .0022, -1.55, 1.55); S[13] = S[14] = 0; camBasis();
    const sp = K[16] ? 280 : 50, f = K[87] - K[83], r = K[68] - K[65], u = K[69] - K[81], k = 1 - exp(-dt * 5);
    S[6] += ((S[16] * f + S[19] * r) * sp - S[6]) * k; S[7] += ((S[17] * f + u) * sp - S[7]) * k; S[8] += ((S[18] * f + S[21] * r) * sp - S[8]) * k;
    S[0] += S[6] * dt; S[1] = clamp(S[1] + S[7] * dt, -780, 1550); S[2] += S[8] * dt;
    const rr = sqrt(S[0] * S[0] + S[2] * S[2]); if (rr > 3200) { S[0] *= 3200 / rr; S[2] *= 3200 / rr }
  }
  // scripted tour: Catmull-Rom through CP, re-timed by arc length with a per-knot speed factor (QF) so speed is continuous
  const NK = CP.length / 6, TT = new Float64Array(1025);
  function spl() { // parameter in S[60] (doubles are never passed as arguments in per-frame code)
    const u = S[60], i = u >= NK - 1 ? NK - 2 : u | 0, f = u - i, a = (i > 0 ? i - 1 : 0) * 6, b = i * 6, c = b + 6, d = (i + 2 < NK ? i + 2 : NK - 1) * 6;
    for (let k = 0; k < 6; k++) { const p0 = CP[a + k], p1 = CP[b + k], p2 = CP[c + k], p3 = CP[d + k]; S[54 + k] = .5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f) }
  }
  for (let k = 0, x = 0, y = 0, z = 0; k <= 1024; k++) { const u = k / 1024 * (NK - 1), i = min(NK - 2, u | 0); S[60] = u; spl(); if (k) TT[k] = TT[k - 1] + sqrt((S[54] - x) ** 2 + (S[55] - y) ** 2 + (S[56] - z) ** 2) / mix(QF[i], QF[i + 1], u - i); x = S[54]; y = S[55]; z = S[56] }
  function flyCam() {
    const q = S[15] / 60, tau = (q < 0 ? 0 : q > 1 ? 1 : q) * TT[1024]; let lo = 0, hi = 1024;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TT[m] <= tau) lo = m; else hi = m }
    S[60] = (lo + (tau - TT[lo]) / (TT[hi] - TT[lo] + 1e-9)) / 1024 * (NK - 1); spl();
    const dx = S[57] - S[54], dy = S[58] - S[55], dz = S[59] - S[56];
    S[0] = S[54]; S[1] = S[55]; S[2] = S[56]; S[3] = atan2(dx, -dz); S[4] = atan2(dy, sqrt(dx * dx + dz * dz));
  }
  function uniforms() {
    camBasis(); S[9] = S[10] * WD / HT;
    const tx = S[9], ty = S[10], px = S[0], py = S[1], pz = S[2], Fx = S[16], Fy = S[17], Fz = S[18], Rx = S[19] / tx, Ry = S[20] / tx, Rz = S[21] / tx, Ux = S[22] / ty, Uy = S[23] / ty, Uz = S[24] / ty;
    const r0 = -(Rx * px + Ry * py + Rz * pz), r1 = -(Ux * px + Uy * py + Uz * pz), r3 = -(Fx * px + Fy * py + Fz * pz);
    UB[0] = Rx; UB[1] = Ux; UB[2] = 0; UB[3] = Fx; UB[4] = Ry; UB[5] = Uy; UB[6] = 0; UB[7] = Fy; UB[8] = Rz; UB[9] = Uz; UB[10] = 0; UB[11] = Fz; UB[12] = r0; UB[13] = r1; UB[14] = NEAR; UB[15] = r3;
    S[25] = Fx + Rx; S[26] = Fy + Ry; S[27] = Fz + Rz; S[28] = r3 + r0; S[29] = Fx - Rx; S[30] = Fy - Ry; S[31] = Fz - Rz; S[32] = r3 - r0;
    S[33] = Fx + Ux; S[34] = Fy + Uy; S[35] = Fz + Uz; S[36] = r3 + r1; S[37] = Fx - Ux; S[38] = Fy - Uy; S[39] = Fz - Uz; S[40] = r3 - r1; S[41] = Fx; S[42] = Fy; S[43] = Fz; S[44] = r3 - NEAR;
    for (let i = 25; i < 45; i += 4) { const l = 1 / sqrt(S[i] * S[i] + S[i + 1] * S[i + 1] + S[i + 2] * S[i + 2]); S[i] *= l; S[i + 1] *= l; S[i + 2] *= l; S[i + 3] *= l }
    const k2 = tx * tx + ty * ty;
    for (let c = 0; c < 3; c++) {
      const n = c ? SPL[c - 1] * .86 : NEAR, f = SPL[c], m = min(f, .5 * (n + f) * (1 + k2)), r = ceil(sqrt(max((f - m) * (f - m) + f * f * k2, (m - n) * (m - n) + n * n * k2))), te = 2 * r / SMR;
      const cx = px + Fx * m, cy = py + Fy * m, cz = pz + Fz * m, X = floor((cx * LB[0] + cy * LB[1] + cz * LB[2]) / te) * te, Y = floor((cx * LB[3] + cy * LB[4] + cz * LB[5]) / te) * te, Z = cx * LB[6] + cy * LB[7] + cz * LB[8], o = 16 + c * 16;
      S[45 + c * 3] = X; S[46 + c * 3] = Y; S[47 + c * 3] = r;
      UB[o] = LB[0] / r; UB[o + 1] = LB[3] / r; UB[o + 2] = -LB[6] / (2 * ZE); UB[o + 3] = 0; UB[o + 4] = LB[1] / r; UB[o + 5] = LB[4] / r; UB[o + 6] = -LB[7] / (2 * ZE); UB[o + 7] = 0;
      UB[o + 8] = LB[2] / r; UB[o + 9] = LB[5] / r; UB[o + 10] = -LB[8] / (2 * ZE); UB[o + 11] = 0; UB[o + 12] = -X / r; UB[o + 13] = -Y / r; UB[o + 14] = .5 + Z / (2 * ZE); UB[o + 15] = 1;
      UB[76 + c] = SPL[c]; UB[96 + c] = te;
    }
    UB[64] = px; UB[65] = py; UB[66] = pz; UB[67] = S[5]; UB[68] = LB[6]; UB[69] = LB[7]; UB[70] = LB[8]; UB[72] = WD; UB[73] = HT; UB[74] = 1 / WD; UB[75] = 1 / HT;
    UB[80] = S[19] * tx; UB[81] = S[20] * tx; UB[82] = S[21] * tx; UB[84] = S[22] * ty; UB[85] = S[23] * ty; UB[86] = S[24] * ty; UB[88] = Fx; UB[89] = Fy; UB[90] = Fz; UB[92] = NEAR; UB[93] = FOGK; UB[94] = 2 * ty / HT;
    for (let i = 0; i < 16; i++) PU[i] = UB[i];
    PU[16] = px; PU[17] = py; PU[18] = pz; PU[19] = S[5]; PU[63] = IM[0]; PU[56] = Fx; PU[57] = Fy; PU[58] = Fz;
  }
  function inFr(A, o) { const x = A[o], y = A[o + 1], z = A[o + 2], r = A[o + 3]; for (let i = 25; i < 45; i += 4)if (S[i] * x + S[i + 1] * y + S[i + 2] * z + S[i + 3] < -r) return false; return true }
  function inCs(A, o, c) { const x = A[o], y = A[o + 1], z = A[o + 2], k = 45 + c * 3, R = S[k + 2] + A[o + 3]; return abs(x * LB[0] + y * LB[1] + z * LB[2] - S[k]) < R && abs(x * LB[3] + y * LB[4] + z * LB[5] - S[k + 1]) < R }
  function leafCount(o, km) { const dx = clF[o] - S[0], dy = clF[o + 1] - S[1], dz = clF[o + 2] - S[2], d = sqrt(dx * dx + dy * dy + dz * dz) - clF[o + 3]; return CORE + 6 * min(NLEAF, (min(1, max(KMIN, LODS * clI[o + 2] / max(d, 1))) * km * NLEAF + 1) | 0) }
  function near(A, o, lim) { const dx = A[o] - S[0], dy = A[o + 1] - S[1], dz = A[o + 2] - S[2], r = lim + A[o + 3]; return dx * dx + dy * dy + dz * dz < r * r }
  // GPU timing (bench only)
  let qs, qr, qm, qfree, G, ng = 0;
  if (TSQ) { qs = dev.createQuerySet({ type: 'timestamp', count: 2 }); qr = dev.createBuffer({ size: 16, usage: BU.QUERY_RESOLVE | BU.COPY_SRC }); qfree = Array.from({ length: 6 }, () => dev.createBuffer({ size: 16, usage: BU.MAP_READ | BU.COPY_DST })); G = new Float32Array(40000); PD.sh[0].timestampWrites = { querySet: qs, beginningOfPassWriteIndex: 0 }; PD.fin.timestampWrites = { querySet: qs, endOfPassWriteIndex: 1 } }

  function frame() {
    uniforms(); q.writeBuffer(ubuf, 0, UB);
    const e = dev.createCommandEncoder(); let p;
    for (let c = 0; c < 3; c++) {
      p = e.beginRenderPass(PD.sh[c]); p.setBindGroup(0, BG0); p.setBindGroup(1, BGC[c]);
      p.setPipeline(P.solS); p.setVertexBuffer(0, B.vb); p.setIndexBuffer(B.ib, 'uint32');
      if (!(IM[4] & 32)) for (let k = 0; k < nSol; k++)if (inCs(solF, k * 4, c) && !(c == 2 && solI[k * 4 + 2])) p.drawIndexed(solI[k * 4 + 1], 1, solI[k * 4], 0, 0);
      p.setPipeline(P.leafS); p.setVertexBuffer(0, B.cmv); p.setVertexBuffer(1, B.cli); p.setIndexBuffer(B.cmi, 'uint16');
      if (!(IM[4] & 1)) for (let k = 0; k < nCl; k++)if (inCs(clF, k * 4, c)) p.drawIndexed(leafCount(k * 4, SHK), clI[k * 4 + 1], 0, 0, clI[k * 4]);
      p.end();
    }
    p = e.beginRenderPass(PD.cloud); p.setPipeline(P.cloud); p.setBindGroup(0, BGcl); if (!(IM[4] & 4)) p.draw(3); p.end();
    p = e.beginRenderPass(PD.main); p.setBindGroup(0, BG0); p.setBindGroup(1, BGm);
    p.setPipeline(P.sky); p.draw(3);
    p.setPipeline(P.sol); p.setVertexBuffer(0, B.vb); p.setIndexBuffer(B.ib, 'uint32');
    if (!(IM[4] & 64)) for (let k = 0; k < nSol; k++)if (inFr(solF, k * 4)) p.drawIndexed(solI[k * 4 + 1], 1, solI[k * 4], 0, 0);
    p.setPipeline(P.leaf); p.setVertexBuffer(0, B.cmv); p.setVertexBuffer(1, B.cli); p.setIndexBuffer(B.cmi, 'uint16');
    if (!(IM[4] & 2)) for (let k = 0; k < nCl; k++)if (inFr(clF, k * 4)) p.drawIndexed(leafCount(k * 4, 1), clI[k * 4 + 1], 0, 0, clI[k * 4]);
    p.setVertexBuffer(0, B.fern); p.setVertexBuffer(1, B.pli);
    if (!(IM[4] & 16)) for (let k = 0; k < nPl; k++)if (inFr(plF, k * 4) && near(plF, k * 4, 1100)) p.drawIndexed(NFERN, plI[k * 4 + 1], 0, 0, plI[k * 4]);
    p.setPipeline(P.plant); p.setVertexBuffer(0, B.tuft); p.setVertexBuffer(1, B.tui);
    if (!(IM[4] & 16)) for (let k = 0; k < nTu; k++)if (inFr(tuF, k * 4) && near(tuF, k * 4, 1000)) p.draw(NTUFT, tuI[k * 4 + 1], 0, tuI[k * 4]);
    p.setPipeline(P.crea); p.setVertexBuffer(1, B.cri); p.setVertexBuffer(0, B.bird); p.draw(NBIRD, NB, 0, 0); p.setVertexBuffer(0, B.ray); p.draw(NRAY, NR, 0, NB); p.setVertexBuffer(0, B.bfly); p.draw(NBF, NF, 0, NB + NR);
    p.setPipeline(P.fauna); p.setVertexBuffer(1, B.fai); for (let k = 0; k < NFG; k++) { const o = k * 3; if (FG[o + 1]) { p.setVertexBuffer(0, FMB[k]); p.draw(FG[o], FG[o + 1], 0, FG[o + 2]) } }
    p.setPipeline(P.vine); p.setVertexBuffer(0, B.vii);
    for (let k = 0; k < nVi; k++)if (inFr(viF, k * 4) && near(viF, k * 4, 2800)) p.draw(50, viI[k * 4 + 1], 0, viI[k * 4]);
    p.setPipeline(P.part); p.setVertexBuffer(0, B.pai); p.draw(4, NPA);
    H.portal(p, ID);
    p.end();
    p = e.beginRenderPass(PD.res); p.setPipeline(P.res); p.setBindGroup(0, BGres); p.draw(3); p.end();
    p = e.beginRenderPass(PD.rays); p.setPipeline(P.rays); p.setBindGroup(0, BGrays); if (!(IM[4] & 8)) p.draw(3); p.end();
    p = e.beginRenderPass(PD.rayb); p.setPipeline(P.rayb); p.setBindGroup(0, BGrayb); p.draw(3); p.end();
    for (let i = 0; i < 2 * NBL - 1; i++) { p = e.beginRenderPass(PD.bl[i]); p.setPipeline(i == 0 ? P.bd0 : i < NBL ? P.bd : P.bu); p.setBindGroup(0, BGb[i]); p.draw(3); p.end() }
    PD.fin.colorAttachments[0].view = H.snapView || ctx.getCurrentTexture().createView();
    p = e.beginRenderPass(PD.fin); p.setPipeline(P.fin); p.setBindGroup(0, BGfin); p.draw(3); p.end();
    if (TSQ) {
      e.resolveQuerySet(qs, 0, 2, qr, 0); const b = qfree.pop(); if (b) e.copyBufferToBuffer(qr, 0, b, 0, 16);
      QS[0] = e.finish(); q.submit(QS);
      if (b) { const rec = IM[2]; b.mapAsync(1).then(() => { const t = new BigInt64Array(b.getMappedRange()), ms = Number(t[1] - t[0]) / 1e6; b.unmap(); qfree.push(b); S[63] = ms; if (rec && ms > 0 && ms < 1e4) G[ng++] = ms }) }
    } else { QS[0] = e.finish(); q.submit(QS) }
  }

  // ---------- modes
  const HELP = 'Click to fly  ·  WASD move  ·  mouse look  ·  Q / E down / up  ·  Shift boost  ·  F guided tour  ·  P next world\nFly into a ring to travel: teal to the sea, violet to Glowcap Hollow';
  if (CAP) {
    const st = () => [S[0], S[1], S[2], S[3], S[4], S[5]].map(v => +v.toFixed(2));
    window.__cap = { set(x, y, z, yaw, pit, t) { S[0] = x; S[1] = y; S[2] = z; S[3] = yaw; S[4] = pit; S[5] = t; frame(); return st() }, pose(i) { S.set(POSES.subarray(i * 6, i * 6 + 6)); frame(); return st() }, fly(t) { S[15] = S[5] = t; flyCam(); frame(); return st() }, png: () => cv.toDataURL(), async gpu(mask) { IM[4] = mask; let a = 0; for (let i = 0; i < 6; i++) { frame(); await q.onSubmittedWorkDone(); await new Promise(r => setTimeout(r, 30)); if (i > 1) a += S[63] } IM[4] = 0; return +(a / 4).toFixed(1) }, jpg: j => cv.toDataURL('image/jpeg', j), gs: W.gs, W, S };
    hud.textContent = ''; return;
  }
  const FT = BENCH ? new Float32Array(40000) : null; let nf = 0;
  if (BENCH) { IM[0] = 1; S[15] = -3; hud.textContent = 'Benchmark: 60 s scripted fly-through…' }
  addEventListener('mousemove', e => { if (on() && document.pointerLockElement) { K[16] = e.shiftKey ? 1 : 0; S[13] += e.movementX; S[14] += e.movementY } });
  addEventListener('keydown', e => { if (!on()) return; K[e.keyCode & 255] = 1; K[16] = e.shiftKey ? 1 : 0; if (e.keyCode == 70 && !BENCH) { IM[0] ^= 1; S[6] = S[7] = S[8] = 0 } });
  addEventListener('keyup', e => { K[e.keyCode & 255] = 0; K[16] = e.shiftKey ? 1 : 0 });
  const stat = a => { const s = Float32Array.from(a).sort(), n = s.length; let m = 0, o = 0; for (const v of s) { m += v; if (v > 16.7) o++ } return n ? { n, avg: +(m / n).toFixed(2), p50: +s[n >> 1].toFixed(2), p99: +s[min(n - 1, floor(n * .99))].toFixed(2), max: +s[n - 1].toFixed(2), over16_7: o } : null };
  function step() { // all per-frame double math lives here (JIT-warmed below) so the rAF callback itself never boxes a number
    const ms = S[62] - S[61]; S[61] = S[62]; S[12] = ms > 100 ? .1 : ms > 0 ? ms / 1000 : 0;
    if (IM[0]) {
      S[15] += S[12];
      if (BENCH) { IM[2] = S[15] > 0 && S[15] < 60 ? 1 : 0; if (IM[2]) FT[nf++] = ms; if (S[15] > 60.5 && !IM[3]) { IM[3] = 1; const r = window.__bench = { resolution: WD + 'x' + HT, adapter: ad.info ? ad.info.vendor + ' ' + ad.info.architecture + ' ' + ad.info.description : '', gpuMs: TSQ ? stat(G.subarray(1, ng)) : 'timestamp-query unavailable', frameMs: stat(FT.subarray(1, nf)) }; hud.textContent = 'Benchmark ' + r.resolution + '\n' + JSON.stringify(r.gpuMs) + '\n' + JSON.stringify(r.frameMs); hud.style.display = '' } }
      else if (S[15] > 60) S[15] -= 60;
      S[5] = S[15] > 0 ? S[15] : 0; flyCam();
    } else { S[5] += S[12]; move() }
  }
  if (!BENCH) { for (let i = 0; i < 4000; i++) { S[62] = i * 16.7; IM[0] = i & 1; step(); uniforms(); for (let k = 0; k < nCl; k += 97) { inFr(clF, k * 4); inCs(clF, k * 4, i % 3); leafCount(k * 4, 1); near(clF, k * 4, 500) } } S.fill(0, 5, 9); S.fill(0, 12, 16); S.set(POSES.subarray(0, 5)); IM[0] = Q.has('fly') && H.first === ID ? 1 : 0 } // JIT warm-up
  S[61] = S[62] = performance.now();
  // ---------- audio emitters (types in audio.js: 0 flock, 1 nest, 2 deer herd, 3 fox, 4 rabbits, 5 glider, 6 lizard); positions mirror the shaders
  const AE = [], FG2 = {}, FD = W.fa.d; W.fa.g.forEach(([k, f, n]) => FG2[k] = [f, n]);
  { const c = W.cr; for (let i = 0; i < c.length / 12; i++) if (!c[i * 12 + 6] && (!i || c[i * 12] != c[i * 12 - 12] || c[i * 12 + 2] != c[i * 12 - 10])) AE.push(0, i) }
  for (let i = 0; i < FG2.nest[1]; i++) AE.push(1, i);
  { const [f, n] = FG2.deer; for (let i = 0; i < n; i++) if (!i || abs(FD[(f + i) * 16 + 12] - FD[(f + i - 1) * 16 + 12]) > .02) AE.push(2, f + i) }
  for (let i = 0; i < FG2.fox[1]; i++) AE.push(3, FG2.fox[0] + i);
  for (let i = 0; i < FG2.rabbit[1]; i += 3) AE.push(4, FG2.rabbit[0] + i);
  for (let i = 0; i < FG2.glider[1]; i++) AE.push(5, FG2.glider[0] + i);
  for (let i = 0; i < FG2.lizard[1]; i++) AE.push(6, FG2.lizard[0] + i);
  const NE = AE.length / 2, ET = new Uint8Array(NE), EI = new Int32Array(NE), EP = new Float64Array(NE * 3), EA = new Float32Array(NE);
  for (let e = 0; e < NE; e++) { ET[e] = AE[e * 2]; EI[e] = AE[e * 2 + 1] }
  const sst = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x) };
  const ghJ = (x, z) => { const M = W.hm, u = clamp((x + 850) * 255 / 1700, 0, 254.99), v = clamp((z + 850) * 255 / 1700, 0, 254.99), i = u | 0, j = v | 0, fx = u - i, fz = v - j, o = j * 256 + i; return (M[o] + (M[o + 1] - M[o]) * fx) * (1 - fz) + (M[o + 256] + (M[o + 257] - M[o + 256]) * fx) * fz };
  function atick(t, cx, cy, cz) {
    for (let e = 0; e < NE; e++) {
      const ty = ET[e], o = EI[e]; let x = 0, y = 0, z = 0, a = 0;
      if (ty == 0) { const c = W.cr, b = o * 12, R = c[b + 3], an = t * c[b + 5] / R + c[b + 4], ph = c[b] * .013 + c[b + 2] * .007; x = c[b] + cos(an) * R * (1 + .25 * sin(an * 2 + ph)); y = c[b + 1] + sin(an * 1.3 + ph) * c[b + 11]; z = c[b + 2] + sin(an) * R * (1 + .25 * cos(an * 3 + ph)); a = 1 - sst(c[b + 7] * 3, c[b + 7] * 14, sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2)) }
      else if (ty == 1) { const b = (FG2.nest[0] + o) * 16, q = (FG2.bird[0] + o) * 16; x = FD[b]; y = FD[b + 1]; z = FD[b + 2]; a = ((t / FD[q + 5] + FD[q + 4]) % 1 + 1) % 1 > .3 ? 1 : 0 }
      else if (ty <= 4) {
        const b = o * 16, sd = FD[b + 12], om = .11 + .05 * (sd * .618 % 1), sp = FD[b + 5], u = sp * t + .95 * sp / om * sin(t * om + sd * 6), R = FD[b + 7], an = u / R + FD[b + 4], fr = ty == 4 ? 90 : 170;
        x = FD[b] + R * cos(an) * (1 + .3 * sin(2 * an + sd)); z = FD[b + 2] + R * sin(an) * (1 + .3 * cos(3 * an + sd));
        const dx = x - cx, dz = z - cz, dl = max(sqrt(dx * dx + dz * dz), 1e-3); a = (1 - sst(fr * .25, fr, dl)) * (1 - sst(fr * .5, fr * .9, cy - ghJ(x, z)));
        x += dx / dl * a * fr * .4; z += dz / dl * a * fr * .4; const rl = sqrt(x * x + z * z); if (rl > 470) { x *= 470 / rl; z *= 470 / rl } y = ghJ(x, z) + 3;
      }
      else if (ty == 5) { const b = o * 16, pr = ((t / FD[b + 5] + FD[b + 4]) % 1 + 1) % 1; let s = 0; if (pr >= .42 && pr < .5) { s = (pr - .42) / .08; a = 1 } else if (pr >= .5 && pr < .92) s = 1; else if (pr >= .92) { s = 1 - (pr - .92) / .08; a = 1 } x = FD[b] + (FD[b + 8] - FD[b]) * s; y = FD[b + 1] + (FD[b + 9] - FD[b + 1]) * s - FD[b + 7] * sin(PI * s); z = FD[b + 2] + (FD[b + 10] - FD[b + 2]) * s }
      else { const b = o * 16; x = FD[b]; y = FD[b + 1]; z = FD[b + 2]; a = ((t / FD[b + 5] + FD[b + 12]) % 1) * FD[b + 5] < .7 ? 1 : 0 }
      EP[e * 3] = x; EP[e * 3 + 1] = y; EP[e * 3 + 2] = z; EA[e] = a;
    }
  }
  return {
    audio: { n: NE, T: ET, P: EP, A: EA, tick: atick, ref: 45 },
    name: 'Aereal', help: HELP, tanY: S[10], bench: BENCH,
    tick() { S[62] = H.T[0]; step(); frame() }, // host loop writes rAF time into H.T[0]
    place(x, y, z, yaw, v, pit = 0) { S[0] = x; S[1] = y; S[2] = z; S[3] = yaw; S[4] = pit; IM[0] = 0; camBasis(); S[6] = S[16] * v; S[7] = S[17] * v; S[8] = S[18] * v },
    speed: 50, hold(codes) { for (const c of codes) { const k = c.startsWith('Key') ? c.charCodeAt(3) : c.startsWith('Shift') ? 16 : 0; if (k && k != 70 && k != 80) K[k] = 1 } }, enter() { if (!Q.get('w')) fit(); else { cv.width = WD; cv.height = HT } S[61] = performance.now() }, leave() { K.fill(0) },
    snap() { H.snapView = H.peek(H.snapFor, WD, HT); frame(); H.snapView = null }
  };
};
