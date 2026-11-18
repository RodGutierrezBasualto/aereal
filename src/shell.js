// ---------- host: one device + one canvas shared by every world, portals between them, world switching
// WORLDS[i] = async (host, i) => controller (defined by the build from src/sky, src/sea, src/glow)
(async () => {
  const Q = new URLSearchParams(location.search), cv = document.getElementById('c'), hud = document.getElementById('h'), fx = document.getElementById('fx'), sn = document.getElementById('sn'), snx = sn.getContext('2d');
  const BENCH = Q.has('bench'), CAP = Q.has('cap'), NW = WORLDS.length, WN = ['sky', 'sea', 'glow'];
  const H = { Q, cv, cur: Math.max(0, WN.indexOf(Q.get('world'))), T: new Float64Array(1), PU: WORLDS.map(() => new Float32Array(64)), snapView: null, snapFor: 0 };
  H.first = H.cur;
  const msg = WORLDS.map(() => '');
  const show = () => { const locked = document.pointerLockElement === cv, c = C[H.cur], s = msg[H.cur] || (locked || !c ? '' : c.help + (c.bench ? '' : '\nHeadphones on for 3D sound  ·  M mute')); hud.textContent = s; hud.style.opacity = s ? 1 : 0 };
  H.say = (s, i) => { msg[i] = s; if (i === H.cur) show() };
  if (!navigator.gpu) return H.say('This scene needs WebGPU.', H.cur);
  const ad = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }); if (!ad) return H.say('No WebGPU adapter found.', H.cur);
  H.TS = (BENCH || CAP || Q.has('ts')) && ad.features.has('timestamp-query');
  const dev = await ad.requestDevice({ requiredFeatures: H.TS ? ['timestamp-query'] : [] });
  dev.addEventListener('uncapturederror', e => console.error('GPU: ' + e.error.message));
  const ctx = cv.getContext('webgpu'), FMT = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device: dev, format: FMT, alphaMode: 'opaque' });
  Object.assign(H, { ad, dev, ctx, FMT });

  // ---- portals. Each sits in world w, leads to world `to` and comes out of portal `pair` there. Centre, radius, facing yaw.
  // world space conventions match in every world: forward(yaw) = (sin yaw, 0, -cos yaw), reversed-Z depth, MSAA x4 rgba16float
  // n = forward(yaw): the portal's front faces its world's start; you come out of it on that side, facing n. sig/fogc/expo/lift describe the host world's haze and grade.
  const SKYF = { sig: [.00045, .00045, .00045], fogc: [.6, .38, .14], expo: .57, lift: .014 };
  const PT = [
    { w: 0, to: 1, pair: 1, c: [-560, 218, 836], R: 46, yaw: -2.13, rim: [.35, 1.6, 1.9], deep: [.01, .16, .3], ...SKYF },
    { w: 1, to: 0, pair: 0, c: [3, -27, -10], R: 3.6, yaw: 3.1, rim: [2.6, 1.5, .55], deep: [.5, .35, .7], sig: [.05, .031, .024], fogc: [.004, .09, .22], expo: .55, lift: 0 },
    { w: 0, to: 2, pair: 3, c: [-905, 245, 690], R: 40, yaw: -2.6, rim: [1.4, .55, 2.2], deep: [.12, .04, .25], ...SKYF },
    { w: 2, to: 0, pair: 2, c: [-140, 19, 210], R: 8, yaw: -2.388, rim: [2.4, 1.5, .5], deep: [.5, .35, .7], sig: [.0016, .0016, .0016], fogc: [.007, .013, .03], expo: .95, lift: 0 }
  ];
  // where each world starts: far enough that its portal reads as a destination, facing it
  const START = [[-1189, 200, 1233, .9, 0], [16, -31, 27, -.36, .08], [-215, 30, 290, .753, -.1]];
  H.PT = PT; const AU = makeAudio(H);
  for (const p of PT) { p.n = [Math.sin(p.yaw), 0, -Math.cos(p.yaw)]; p.exit = [p.c[0] + p.n[0] * p.R * .9, p.c[1], p.c[2] + p.n[2] * p.R * .9] }
  // shader: a disc framed by a glowing ring; the disc shows a snapshot of the destination, sampled by view direction
  const PS = `
struct P{vp:mat4x4f,cam:vec4f,c:vec4f,t1:vec4f,t2:vec4f,n:vec4f,s:vec4f,sig:vec4f,fc:vec4f,rim:vec4f,deep:vec4f}
@group(0)@binding(0)var<uniform>u:P;
@group(0)@binding(1)var pk:texture_2d<f32>;
@group(0)@binding(2)var sm:sampler;
struct O{@builtin(position)p:vec4f,@location(0)q:vec2f,@location(1)wp:vec3f}
@vertex fn vs(@builtin(vertex_index)i:u32)->O{
 let q=(vec2f(f32(i&1u),f32(i>>1u))*2.-1.)*1.5;var o:O;
 o.wp=u.c.xyz+(u.t1.xyz*q.x+u.t2.xyz*q.y)*u.c.w;o.p=u.vp*vec4f(o.wp,1.);o.q=q;return o;}
fn itm(v:vec3f)->vec3f{
 let y=min(pow(max(v,vec3f(0.)),vec3f(2.2)),vec3f(.97));let a=2.43*y-2.51;let b=.59*y-.03;let c=.14*y;
 return (-b-sqrt(b*b-4.*a*c))/(2.*a);}
@fragment fn fs(i:O)->@location(0)vec4f{
 let t=u.cam.w;let r=length(i.q);if(r>1.5){discard;}
 let a=atan2(i.q.y,i.q.x);
 let v=i.wp-u.cam.xyz;let dist=length(v);let d=v/dist;
 let F=select(-u.n.xyz,u.n.xyz,dot(u.cam.xyz-u.c.xyz,u.n.xyz)<0.);
 let R=normalize(cross(F,vec3f(0.,1.,0.)));
 let wob=pow(r,3.)*.05*vec2f(sin(a*5.+t*1.7+r*9.),cos(a*4.-t*1.3+r*7.));
 let z=max(dot(d,F),.05);let uv=vec2f(.5+.5*dot(d,R)/(z*u.s.x),.5-.5*d.y/(z*u.s.y))+wob;
 let sw=sin(a*3.+log(max(r,.02))*7.-t*1.6)*.5+.5;
 var inner=mix(u.deep.rgb,u.rim.rgb*.35,sw*smoothstep(.2,1.,r));
 if(u.n.w>.5){let e=smoothstep(.0,.06,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
  let img=itm(textureSampleLevel(pk,sm,clamp(uv,vec2f(0.),vec2f(1.)),0.).rgb)/u.s.z+u.s.w;
  inner=mix(inner,img,e*(1.-smoothstep(.75,1.,r)*.6));}
 inner+=u.rim.rgb*pow(smoothstep(.55,1.,r),3.)*.7;
 let flow=.75+.25*sin(a*7.-t*2.3)+.15*sin(a*13.+t*3.1);
 let rw=max(.035,dist*.003/u.c.w); // keep the ring a couple of pixels wide when seen from far away
 let ring=exp(-pow((r-1.)/rw,2.))*flow*1.8*sqrt(.035/rw)+exp(-abs(r-1.)*9.)*.35*flow;
 let open=u.t1.w;
 let T=exp(-u.sig.rgb*dist);let Tr=exp(-u.sig.rgb*dist*.35); // the ring's light carries further than the haze/water would allow
 let al=(1.-smoothstep(.97,1.,r));
 let col=inner*al*T+u.rim.rgb*ring*(1.+open*3.)*Tr+u.fc.rgb*(1.-T)*al;
 return vec4f(col,al);}`;
  const pm = dev.createShaderModule({ code: PS });
  const PBL = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
  const pPipe = dev.createRenderPipeline({ layout: 'auto', vertex: { module: pm, entryPoint: 'vs' }, fragment: { module: pm, entryPoint: 'fs', targets: [{ format: 'rgba16float', blend: PBL }] }, primitive: { topology: 'triangle-strip' }, depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater' }, multisample: { count: 4 } });
  const pSm = dev.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const PB = PT.map(() => dev.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })), PUK = PT.map(() => new Float32Array(64));
  const blank = dev.createTexture({ size: [1, 1], format: FMT, usage: GPUTextureUsage.TEXTURE_BINDING });
  const PK = PT.map(() => null), PG = PT.map(() => null);
  const pbg = k => PG[k] = dev.createBindGroup({ layout: pPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: PB[k] } }, { binding: 1, resource: (PK[k] || blank).createView() }, { binding: 2, resource: pSm }] });
  PT.forEach((p, k) => { // static part of each portal's uniform; slots 0-19 (vp, cam, time) are copied from its world every frame
    const U = PUK[k], t1 = [-p.n[2], 0, p.n[0]];
    U.set([...p.c, p.R], 20); U.set([...t1, 0], 24); U.set([0, 1, 0, 0], 28); U.set([...p.n, 0], 32); U.set([1, 1, p.expo, p.lift], 36);
    U.set([...p.sig, 0], 40); U.set([...p.fogc, 0], 44); U.set([...p.rim, 0], 48); U.set([...p.deep, 0], 52); pbg(k);
  });
  // snapshot target for portal k (its destination, seen from the exit of its pair)
  H.peek = (k, w, h) => {
    if (!PK[k] || PK[k].width !== w || PK[k].height !== h) { if (PK[k]) PK[k].destroy(); PK[k] = dev.createTexture({ size: [w, h], format: FMT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING }); pbg(k) }
    const U = PUK[k]; U[35] = 1; U[36] = C[PT[k].to].tanY * w / h; U[37] = C[PT[k].to].tanY;
    return PK[k].createView();
  };
  const PQ = new Float64Array(16), PD = new Float64Array(PT.length); // PQ: [0] strongest portal glow, [9 + k] glow of portal k, [3..5] last camera position, [6] its time, [7] camera speed, [8] glow overlay level; PD: last signed distance per portal
  H.portal = (p, i) => { const W = H.PU[i]; for (let k = 0; k < PT.length; k++) { if (PT[k].w !== i) continue; const U = PUK[k]; for (let j = 0; j < 20; j++)U[j] = W[j]; U[27] = PQ[9 + k]; dev.queue.writeBuffer(PB[k], 0, U); p.setPipeline(pPipe); p.setBindGroup(0, PG[k]); p.draw(4) } };

  // ---- worlds
  const C = WORLDS.map(() => null), LD = WORLDS.map(() => null);
  const snap = k => { const d = PT[k].to, q = PT[PT[k].pair]; C[d].place(q.exit[0], q.exit[1], q.exit[2], q.yaw, 0); H.snapFor = k; C[d].snap() };
  const load = i => LD[i] || (LD[i] = WORLDS[i](H, i).then(c => { C[i] = c; if (c && c.audio && !c.bench) AU.add(i, c.audio); if (!c || !c.bench) msg[i] = ''; if (!c && i === H.cur) show(); if (c) PT.forEach((p, k) => { if (p.to === i && i !== H.cur) snap(k) }); return c }));
  const first = await load(H.cur);
  if (!first) { if (CAP && !BENCH) (async () => { for (let i = 0; i < NW; i++) if (i !== H.cur) await load(i) })(); return } // capture mode: the page is driven through window.__cap
  if (!first.bench && !Q.has('fly')) { const s = START[H.cur]; first.place(s[0], s[1], s[2], s[3], 0, s[4]) }
  show();

  // ---- input (worlds only read keys/mouse while active; held keys carry over through a portal)
  const HK = new Set();
  cv.addEventListener('click', () => { if (!first.bench) { cv.requestPointerLock(); AU.start() } });
  document.addEventListener('pointerlockchange', show);
  addEventListener('keydown', e => { if (first.bench) return; HK.add(e.code); AU.start(); if (e.code == 'KeyP' && !e.repeat) jump(); if (e.code == 'KeyM' && !e.repeat) AU.toggle() });
  addEventListener('keyup', e => HK.delete(e.code)); addEventListener('blur', () => HK.clear());

  // ---- crossing. Flying through a ring is one continuous move: on the frame before you would cross the disc (which by then fills the view
  // with the destination) the worlds swap in the same task, your pose is carried through the portal (offset in the ring, look direction,
  // speed rescaled to the other world) and the captured frame dissolves into the live view while you keep moving. P jumps to the next world.
  let busy = 0, cool = 0;
  const css = (el, tr, st) => { el.style.transition = tr; Object.assign(el.style, st) };
  function swap(to, b, A) { // to: destination world, b: exit portal there, A: the entry portal when flying through one (null for P)
    const B = PT[b], from = H.cur, U = H.PU[from], through = !!A;
    if (sn.width !== cv.width || sn.height !== cv.height) { sn.width = cv.width; sn.height = cv.height } snx.drawImage(cv, 0, 0); // same task as the submit: the frame is still readable
    css(sn, 'none', { opacity: 1, transform: 'none', filter: 'none' }); hud.style.opacity = 0;
    const fB = B.n, rB = [-fB[2], 0, fB[0]], s = through ? B.R / A.R : 1; let x, y, z, yaw, pit;
    if (through) { // express the camera in the entry portal's frame and rebuild it in the exit portal's frame
      const d = [U[16] - A.c[0], U[17] - A.c[1], U[18] - A.c[2]], sd = d[0] * A.n[0] + d[2] * A.n[2] < 0 ? 1 : -1, fA = [A.n[0] * sd, 0, A.n[2] * sd], rA = [-fA[2], 0, fA[0]];
      const px = d[0] * rA[0] + d[2] * rA[2], py = d[1], pz = Math.max(0, d[0] * fA[0] + d[2] * fA[2]) + A.R * .03;
      x = B.c[0] + (rB[0] * px + fB[0] * pz) * s; y = B.c[1] + py * s; z = B.c[2] + (rB[2] * px + fB[2] * pz) * s;
      const lx = U[56] * rA[0] + U[58] * rA[2], lz = U[56] * fA[0] + U[58] * fA[2], wx = rB[0] * lx + fB[0] * lz, wz = rB[2] * lx + fB[2] * lz;
      yaw = Math.atan2(wx, -wz); pit = Math.asin(Math.max(-1, Math.min(1, U[57])));
    } else { x = B.exit[0]; y = B.exit[1]; z = B.exit[2]; yaw = B.yaw; pit = 0 }
    const v = through ? Math.min(PQ[7] * C[to].speed / C[from].speed, C[to].speed * 6) : C[to].speed * 1.4;
    C[from].leave(); H.cur = to; C[to].place(x, y, z, yaw, v, pit); C[to].hold(HK); C[to].enter(); AU.world(to); AU.transition(to);
    PD.fill(0); PQ[6] = 0; PQ[0] = 0; cool = H.T[0] + 1500;
    void sn.offsetWidth; // commit the opaque frame, then dissolve it
    css(sn, 'opacity .6s ease-out, transform .7s cubic-bezier(.2,.6,.3,1), filter .6s ease-out', { opacity: 0, transform: 'scale(1.12)', filter: 'blur(3px)' });
    css(fx, 'opacity .9s ease-out', { opacity: 0 }); PQ[8] = 0;
    busy = 1; setTimeout(() => { busy = 0; show() }, 950);
  }
  let pend = -1, pendTo = 0; // P: a quick glow, then the same swap at the next world's portal exit
  async function jump() {
    if (busy || pend >= 0) return; const to = (H.cur + 1) % NW; busy = 1;
    fx.className = 'w' + to; css(fx, 'opacity .35s ease-in', { opacity: .7 }); PQ[0] = 1;
    await new Promise(r => setTimeout(r, 350)); if (!C[to]) { css(fx, 'opacity .3s', { opacity: 1 }); await load(to) }
    const b = PT.findIndex(p => p.w === to && p.to === H.cur); pend = b >= 0 ? b : PT.findIndex(p => p.w === to); pendTo = to; // arrive at the destination's ring that leads back here, else its first ring
  }
  function portal() { // portal glow builds as you approach; returns the portal index when the next step would carry you through its disc
    const i = H.cur, U = H.PU[i], t = H.T[0];
    if (PQ[6] > 0 && t > PQ[6]) { const sp = Math.hypot(U[16] - PQ[3], U[17] - PQ[4], U[18] - PQ[5]) / ((t - PQ[6]) / 1000); if (sp < C[i].speed * 8) PQ[7] += (sp - PQ[7]) * .5 } // faster than any flight: a teleport, not speed
    PQ[3] = U[16]; PQ[4] = U[17]; PQ[5] = U[18]; PQ[6] = t;
    let hit = -1, gm = 0;
    for (let k = 0; k < PT.length; k++) {
      const p = PT[k]; PQ[9 + k] = 0; if (p.w !== i) continue;
      const dx = U[16] - p.c[0], dy = U[17] - p.c[1], dz = U[18] - p.c[2], s = dx * p.n[0] + dz * p.n[2], rx = dx * p.n[2] - dz * p.n[0], r2 = rx * rx + dy * dy, prev = PD[k]; PD[k] = s;
      if (busy || U[63] || t <= cool || !C[p.to]) continue;
      const as = Math.abs(s), step = Math.abs(prev) - as, inRing = r2 < p.R * p.R * .85;
      const g = inRing && step > 0 ? 1 - Math.min(as / (p.R * 2.5), 1) : 0; PQ[9 + k] = g; if (g > gm) { gm = g; if (g > 0) fx.className = 'w' + p.to }
      if (inRing && as < p.R * .6 && (prev * s > 0 && step > 0 && as <= step * 1.25 + p.R * .08 || prev * s < 0)) hit = k; // swap while the disc still fills the view, well outside the camera's near plane
    }
    if (!busy) { PQ[0] = gm; const o = .45 * gm * gm; if (Math.abs(o - PQ[8]) > .01) { PQ[8] = o; fx.style.transition = 'none'; fx.style.opacity = o } }
    return hit;
  }
  function tick(now) {
    H.T[0] = now; C[H.cur].tick();
    if (pend >= 0) { const b = pend; pend = -1; swap(pendTo, b, null) }
    else { const k = portal(); if (k >= 0) swap(PT[k].to, PT[k].pair, PT[k]) }
    AU.tick(); requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  if (!first.bench) (async () => { for (let i = 1; i < NW; i++) { await new Promise(r => setTimeout(r, 1500)); await load((H.cur + i) % NW) } })(); // grow the other worlds in the background
  window.__aereal = { go: jump, C, PT, H, AU };
})();
