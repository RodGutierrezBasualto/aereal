// ---------- host: one device + one canvas shared by both worlds, portals between them, world switching
// WORLDS[i] = async (host, i) => controller (defined by the build from src/sky and src/sea)
(async () => {
  const Q = new URLSearchParams(location.search), cv = document.getElementById('c'), hud = document.getElementById('h'), ttl = document.getElementById('t'), fx = document.getElementById('fx');
  const BENCH = Q.has('bench'), CAP = Q.has('cap');
  const H = { Q, cv, cur: Q.get('world') == 'sea' ? 1 : 0, T: new Float64Array(1), PU: [new Float32Array(64), new Float32Array(64)], snapView: null };
  H.first = H.cur;
  let msg = ['', ''];
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

  // ---- portals. Per world: centre, radius, facing yaw (normal points to the side you approach from)
  // world space conventions match in both worlds: forward(yaw) = (sin yaw, 0, -cos yaw), reversed-Z depth, MSAA x4 rgba16float
  // n = forward(yaw): the portal's front faces the world's spawn; you come out of it on that side, facing n
  const PT = [
    { c: [-560, 218, 836], R: 46, yaw: -2.13, rim: [.35, 1.6, 1.9], deep: [.01, .16, .3], sig: [.00045, .00045, .00045], fogc: [.6, .38, .14], expo: .57, lift: .014 },
    { c: [3, -27, -10], R: 3.6, yaw: 3.1, rim: [2.6, 1.5, .55], deep: [.5, .35, .7], sig: [.05, .031, .024], fogc: [.004, .09, .22], expo: .55, lift: 0 }
  ];
  // where each world starts: far enough that the portal reads as a destination, facing it
  const START = [[-1189, 200, 1233, .9, 0], [16, -31, 27, -.36, .08]];
  H.PT = PT; const AU = makeAudio(H);
  for (const p of PT) { p.n = [Math.sin(p.yaw), 0, -Math.cos(p.yaw)]; p.exit = [p.c[0] + p.n[0] * p.R * .9, p.c[1], p.c[2] + p.n[2] * p.R * .9] }
  // shader: a disc framed by a glowing ring; the disc shows the other world's last snapshot, sampled by view direction
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
  const PB = PT.map(() => dev.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
  const blank = dev.createTexture({ size: [1, 1], format: FMT, usage: GPUTextureUsage.TEXTURE_BINDING });
  const PK = [null, null], PG = [null, null];
  const pbg = i => PG[i] = dev.createBindGroup({ layout: pPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: PB[i] } }, { binding: 1, resource: (PK[1 - i] || blank).createView() }, { binding: 2, resource: pSm }] });
  PT.forEach((p, i) => { // static part of each world's portal uniform; slots 0-19 (vp, cam, time) and 63 (touring) are written by the world each frame
    const U = H.PU[i], t1 = [-p.n[2], 0, p.n[0]];
    U.set([...p.c, p.R], 20); U.set([...t1, 0], 24); U.set([0, 1, 0, 0], 28); U.set([...p.n, 0], 32); U.set([1, 1, p.expo, p.lift], 36);
    U.set([...p.sig, 0], 40); U.set([...p.fogc, 0], 44); U.set([...p.rim, 0], 48); U.set([...p.deep, 0], 52); pbg(i);
  });
  // snapshot target for world i (seen through the other world's portal)
  H.peek = (i, w, h) => {
    if (!PK[i] || PK[i].width !== w || PK[i].height !== h) { if (PK[i]) PK[i].destroy(); PK[i] = dev.createTexture({ size: [w, h], format: FMT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING }); pbg(1 - i) }
    const U = H.PU[1 - i]; U[35] = 1; U[36] = C[i].tanY * w / h; U[37] = C[i].tanY;
    return PK[i].createView();
  };
  const PQ = new Float64Array(8); // per-frame host doubles: [0] transition glow, [1..2] last signed portal distance per world
  H.portal = (p, i) => { const U = H.PU[i]; U[27] = PQ[0]; dev.queue.writeBuffer(PB[i], 0, U); p.setPipeline(pPipe); p.setBindGroup(0, PG[i]); p.draw(4) };

  // ---- worlds
  const C = [null, null], LD = [null, null];
  const load = i => LD[i] || (LD[i] = WORLDS[i](H, i).then(c => { C[i] = c; if (c && c.audio && !c.bench) AU.add(i, c.audio); if (!c || !c.bench) msg[i] = ''; if (!c && i === H.cur) show(); if (c && i !== H.cur) snap(i); return c }));
  const snap = i => { const p = PT[i]; C[i].place(p.exit[0], p.exit[1], p.exit[2], p.yaw, 0); C[i].snap() };
  const first = await load(H.cur);
  if (!first) { if (CAP && !BENCH) load(1 - H.cur); return } // capture mode: the page is driven through window.__cap
  if (!first.bench && !Q.has('fly')) { const s = START[H.cur]; first.place(s[0], s[1], s[2], s[3], 0, s[4]) }
  show();

  // ---- input (worlds only read keys/mouse while active)
  cv.addEventListener('click', () => { if (!first.bench) { cv.requestPointerLock(); AU.start() } });
  document.addEventListener('pointerlockchange', show);
  let busy = 0, cool = 0;
  async function go() { // fade out, swap worlds at the other side's portal, fade in
    if (busy || first.bench) return; busy = 1;
    const to = 1 - H.cur, from = H.cur;
    fx.className = to ? 'sea' : 'sky'; fx.style.opacity = 1; PQ[0] = 1; AU.transition(to);
    await new Promise(r => setTimeout(r, 480));
    if (!C[to]) { H.say(to ? 'Diving into the sea…' : 'Rising into the sky…', from); await load(to); msg[from] = '' }
    C[from].leave(); snap(from);
    const p = PT[to]; C[to].place(p.exit[0], p.exit[1], p.exit[2], p.yaw, C[to].speed * 1.4);
    H.cur = to; C[to].enter(); AU.world(to); show(); PQ[1] = PQ[2] = 0; cool = performance.now() + 1500;
    ttl.textContent = C[to].name; ttl.style.opacity = 1; setTimeout(() => ttl.style.opacity = 0, 2600);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    fx.style.opacity = 0; PQ[0] = 0; busy = 0;
  }
  addEventListener('keydown', e => { if (first.bench) return; AU.start(); if (e.code == 'KeyP' && !e.repeat) go(); if (e.code == 'KeyM' && !e.repeat) AU.toggle() });

  // ---- frame loop: only the active world renders; crossing its portal disc triggers the switch
  function cross() { // flying into the disc (within .35 R of its plane, getting closer, inside the ring) starts the switch
    const i = H.cur, U = H.PU[i], p = PT[i], dx = U[16] - p.c[0], dy = U[17] - p.c[1], dz = U[18] - p.c[2];
    const s = Math.abs(dx * p.n[0] + dz * p.n[2]), rx = dx * p.n[2] - dz * p.n[0], prev = PQ[1 + i]; PQ[1 + i] = s;
    return !busy && !U[63] && H.T[0] > cool && s < p.R * .35 && s < prev && rx * rx + dy * dy < p.R * p.R * .9;
  }
  function tick(now) { H.T[0] = now; C[H.cur].tick(); if (cross()) go(); AU.tick(); requestAnimationFrame(tick) }
  requestAnimationFrame(tick);
  if (!first.bench) setTimeout(() => load(1 - H.cur), 1500); // grow the other world in the background
  window.__aereal = { go, C, PT, H, AU };
})();
