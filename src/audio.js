// ---------- 3D audio. Every sound is synthesised with Web Audio (no files). The listener is the camera; HRTF panners follow sound emitters
// whose positions each world computes with the same maths as its shaders (controller.audio: n, T types, P xyz, A activity, tick(t, cx, cy, cz), ref).
function makeAudio(H) {
  let ac = null, master, mute = 0, k = 0, NZ, BRN, CLK;
  const R = Math.random, NW = H.PU.length, BV = [.6, 1, .8], BUS = [], // BV: per-world level (the sky sits quieter than the sea)
    BED = [], POR = [], WA = H.PU.map(() => null), pend = [];
  const sst = (a, b, x) => { x = Math.min(Math.max((x - a) / (b - a), 0), 1); return x * x * (3 - 2 * x) };
  // emitter types (sky 0-8, sea 10-15): r audible range in world units, ev random call every iv seconds, rise fired when activity goes up (hold: repeat while it stays up),
  // c continuous patch on n voices, vol voice gain
  const TY = [];
  TY[0] = { r: 650, ev: 'chirp', iv: [2, 6], rise: 'flap', vol: 1.3 };      // bird flock; startled flurry when you fly through it
  TY[1] = { r: 260, ev: 'peep', iv: [.8, 3], rise: 'call' };              // nest: chicks begging, parent calls as it takes off
  TY[2] = { r: 420, rise: 'gallop', hold: 1.2 };                // deer herd bolting
  TY[3] = { r: 300, ev: 'yip', iv: [10, 28], rise: 'gallop', hold: 1.2 }; // fox
  TY[4] = { r: 160, rise: 'thump', hold: .7 };                            // rabbits
  TY[5] = { r: 280, rise: 'whoosh' };                                     // glider takes off
  TY[6] = { r: 80, rise: 'scuttle' };                                     // lizard darts
  TY[10] = { r: 40, ev: 'bubbles', iv: [.5, 2.5] };                       // bubble vent
  TY[11] = { r: 80, ev: 'creak', iv: [2.5, 7] };                          // wreck
  TY[12] = { r: 32, ev: 'chime', iv: [2.5, 8] };                          // jellyfish
  TY[13] = { r: 180, ev: 'song', iv: [8, 16], vol: 6 };                   // whale shark
  TY[14] = { r: 30, c: 'school', n: 2, rise: 'swish' };                   // fish school (swish as it parts around you)
  TY[15] = { r: 14, ev: 'clicks', iv: [1.2, 4] };                         // crab
  TY[20] = { r: 38, ev: 'cricket', iv: [.3, 1.4] };                       // crickets in the grass
  TY[21] = { r: 45, rise: 'croak', vol: 1.4 };                            // frog: croaks when its throat glows (activity from the shader's timing)
  TY[22] = { r: 160, ev: 'hoot', iv: [7, 18], vol: 3 };                   // owl
  TY[23] = { r: 120, rise: 'gallop', hold: 1.2 };                         // deer herd bolting
  TY[24] = { r: 28, ev: 'drip', iv: [.35, 1.6] };                         // water drips along the stream and lake
  TY[25] = { r: 45, ev: 'chime', iv: [5, 13] };                           // glowing mushrooms
  TY[26] = { r: 55, c: 'breath', n: 1 };                                  // the sleeping lantern beast

  const filt = (type, f, q) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b };
  const gain = v => { const g = ac.createGain(); g.gain.value = v; return g };
  const loop = (b, rate) => { const s = ac.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = rate || 1; s.start(0, R() * b.duration * .9); return s };
  const osc = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o };
  const lfo = (f, depth, param) => { const g = gain(depth); osc('sine', f).connect(g); g.connect(param) };
  const ch = (...n) => { for (let i = 0; i + 1 < n.length; i++) n[i].connect(n[i + 1]); return n[n.length - 1] };
  const pan = ref => { const p = ac.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.maxDistance = 1e6; p.rolloffFactor = 1; return p };
  const pos = (p, x, y, z, tc) => {
    if (!p.positionX) return p.setPosition(x, y, z); const t = ac.currentTime;
    if (tc) { p.positionX.setTargetAtTime(x, t, tc); p.positionY.setTargetAtTime(y, t, tc); p.positionZ.setTargetAtTime(z, t, tc) } else { p.positionX.setValueAtTime(x, t); p.positionY.setValueAtTime(y, t); p.positionZ.setValueAtTime(z, t) }
  };
  const buf = (sec, fill) => { const b = ac.createBuffer(2, sec * ac.sampleRate | 0, ac.sampleRate); for (let c = 0; c < 2; c++) fill(b.getChannelData(c), c); return b };

  // ---- one-shots
  const env = (g, t, a, pk, d) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + a); g.gain.exponentialRampToValueAtTime(1e-4, t + a + d) };
  const tone = (out, t, type, f0, f1, d, pk, a = .006, fl) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + a + d); env(g, t, a, pk, d); if (fl) ch(o, fl, g); else o.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + .05) };
  const hiss = (out, t, type, f0, f1, q, d, pk, a = .003) => { const s = ac.createBufferSource(), b = filt(type, f0, q), g = ac.createGain(); s.buffer = NZ; b.frequency.setValueAtTime(f0, t); b.frequency.exponentialRampToValueAtTime(f1, t + a + d); env(g, t, a, pk, d); ch(s, b, g, out); s.start(t, R() * 1.5); s.stop(t + a + d + .05) };
  const EV = { // (out, t, emitter) -> duration
    chirp: (o, t, e) => { const n = 2 + (R() * 4 | 0), b = 2300 + (e % 5) * 450, up = e % 2; for (let i = 0; i < n; i++) { const f = b * (.9 + .25 * R()); tone(o, t + i * (.1 + .06 * R()), 'sine', up ? f : f * 1.4, up ? f * 1.45 : f, .07 + .04 * R(), .3) } return n * .17 },
    flap: (o, t) => { const n = 9 + (R() * 5 | 0); for (let i = 0; i < n; i++) hiss(o, t + i * .045 + R() * .015, 'bandpass', 700 + R() * 600, 400, 1.3, .05, .9 * (1 - i / n)); return n * .05 },
    peep: (o, t) => { const n = 4 + (R() * 4 | 0); for (let i = 0; i < n; i++) tone(o, t + i * (.075 + .02 * R()), 'sine', 3900 + R() * 400, 3300, .045, .22); return n * .09 },
    call: (o, t) => { tone(o, t, 'sine', 1900, 2500, .16, .35); tone(o, t + .22, 'sine', 2500, 1700, .24, .3); return .5 },
    gallop: (o, t) => { for (let b = 0; b < 4; b++) for (const h of [0, .07, .16]) { const u = t + b * .31 + h + R() * .01; tone(o, u, 'sine', 110, 45, .09, .45); hiss(o, u, 'lowpass', 900, 300, .7, .04, .25) } return 1.25 },
    thump: (o, t) => { tone(o, t, 'sine', 85, 38, .13, .9); hiss(o, t, 'lowpass', 600, 200, .7, .05, .3); return .2 },
    yip: (o, t) => { for (let i = 0; i < 2; i++) tone(o, t + i * .19, 'sawtooth', 620, 1050, .09, .18, .01, filt('bandpass', 1300, 3)); return .4 },
    whoosh: (o, t) => { hiss(o, t, 'bandpass', 350, 1500, 1.4, 1.4, .55, .45); return 1.9 },
    scuttle: (o, t) => { const n = 9 + (R() * 6 | 0); for (let i = 0; i < n; i++) hiss(o, t + i * .035 + R() * .01, 'highpass', 3500, 5000, .7, .012, .35); return n * .04 },
    bubbles: (o, t) => { const n = 4 + (R() * 8 | 0); let u = t; for (let i = 0; i < n; i++) { const f = 350 + R() * 650; tone(o, u, 'sine', f, f * 1.8, .05 + R() * .03, .3); u += .03 + R() * .15 } return u - t + .1 },
    creak: (o, t) => { const f = 70 + R() * 45, d = 1.1 + R() * 1.4, s = ac.createOscillator(), b = filt('bandpass', 420, 9), g = ac.createGain(); s.type = 'sawtooth'; s.frequency.setValueAtTime(f, t); s.frequency.linearRampToValueAtTime(f * (.8 + .5 * R()), t + d); b.frequency.setValueAtTime(380, t); b.frequency.linearRampToValueAtTime(700 + R() * 500, t + d); env(g, t, .35, .45, d); ch(s, b, g, o); s.start(t); s.stop(t + d + .5); return d + .5 },
    chime: (o, t) => { const f = [523, 587, 659, 784, 880, 1047][R() * 6 | 0]; for (const [m, a, d] of [[1, .16, 2.6], [2.76, .06, 1.4], [5.4, .025, .7]]) tone(o, t, 'sine', f * m, f * m * .998, d, a, .01); return 2.8 },
    song: (o, t) => { const f = 120 + R() * 70, d = 3 + R() * 2.5;
      for (const [m, a] of [[1, .7], [1.5, .25], [2.01, .12]]) { const s = ac.createOscillator(), vo = ac.createOscillator(), v = gain(f * m * .012), b = filt('bandpass', 380, 2.5), g = ac.createGain(); s.type = 'triangle'; s.frequency.setValueAtTime(f * m, t); s.frequency.exponentialRampToValueAtTime(f * m * (.65 + .8 * R()), t + d); vo.frequency.value = 4.5 + R(); ch(vo, v, s.frequency); b.frequency.setValueAtTime(300, t); b.frequency.linearRampToValueAtTime(700, t + d * .5); b.frequency.linearRampToValueAtTime(280, t + d); env(g, t, 1, a, d); ch(s, b, g, o); for (const x of [s, vo]) { x.start(t); x.stop(t + d + 1.2) } }
      return d + 1.2 },
    clicks: (o, t) => { const n = 3 + (R() * 4 | 0); let u = t; for (let i = 0; i < n; i++) { hiss(o, u, 'highpass', 4500, 6000, .7, .006, .5); u += .04 + R() * .09 } return u - t + .05 },
    swish: (o, t) => { hiss(o, t, 'bandpass', 600, 2400, 1.2, .5, .5, .12); return .7 },
    cricket: (o, t) => { const f = 4200 + R() * 700, n = 2 + (R() * 3 | 0); let u = t; for (let k = 0; k < n; k++) { for (let i = 0; i < 4; i++)tone(o, u + i * .028, 'sine', f, f * .985, .014, .15, .003); u += .16 + R() * .06 } return u - t + .05 },
    croak: (o, t) => { for (let i = 0; i < 2; i++) tone(o, t + i * .13, 'sawtooth', 210 + R() * 40, 150, .09, .6, .01, filt('bandpass', 700, 4)); return .35 },
    hoot: (o, t) => { const f = 360 + R() * 40; tone(o, t, 'sine', f, f * .96, .32, .35, .05); tone(o, t + .55, 'sine', f * 1.02, f * .9, .7, .32, .06); return 1.4 },
    drip: (o, t) => { const f = 900 + R() * 900; tone(o, t, 'sine', f, f * 2.2, .03, .25, .002); tone(o, t + .03, 'sine', f * .6, f * .5, .2, .05, .01); return .3 }
  };
  // ---- continuous patches (output gain starts at 0; the tick fades it with distance)
  const CONT = {
    school: () => { const o = gain(0), r = ch(loop(NZ), filt('bandpass', 1100, 1.4), gain(.3)); lfo(2.3, .2, r.gain); lfo(3.7, .1, r.gain); r.connect(o); return o },
    breath: () => { const o = gain(0), b = ch(loop(BRN), filt('lowpass', 260), gain(0)); lfo(.072, .9, b.gain); b.connect(o); const s = ch(osc('sine', 52), gain(0)); lfo(.072, .5, s.gain); s.connect(o); return o },
    portal: i => { const o = gain(0), f = [110, 146.8, 196][i]; for (const [m, a, ty] of [[1, .22, 'sine'], [1.503, .12, 'sine'], [2.004, .06, 'triangle'], [3.01, .03, 'sine']]) { const g = gain(a); osc(ty, f * m).connect(g); lfo(.3 + m * .17, a * .5, g.gain); g.connect(o) } const n = ch(loop(NZ), filt('bandpass', [1200, 600, 900][i], 5), gain(.15)); lfo(.5, .1, n.gain); n.connect(o); return o }
  };
  const slot = (i, out, ref) => { const lp = filt('lowpass', 18000), p = pan(ref); ch(out, lp, p, BUS[i].inp); return { o: out, lp, p, e: -1, t: -1 } };

  function start() {
    if (ac) { if (ac.state != 'running') ac.resume(); return }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); master = gain(mute ? 0 : .9); const comp = ac.createDynamicsCompressor(); ch(master, comp, ac.destination);
    NZ = buf(2, d => { for (let i = 0; i < d.length; i++)d[i] = R() * 2 - 1 });
    BRN = buf(4, d => { let v = 0; for (let i = 0; i < d.length; i++) { v = (v + .02 * (R() * 2 - 1)) / 1.02; d[i] = v * 3.5 } });
    CLK = buf(3, d => { for (let n = 0; n < 150; n++) { const p = R() * (d.length - 200) | 0, a = R() * R() * .8; for (let j = 0; j < 60; j++)d[p + j] += (R() * 2 - 1) * a * Math.exp(-j / 7) } }); // snapping-shrimp crackle
    for (let i = 0; i < NW; i++) { // per-world bus: (sea: muffled) dry + reverb (sky: long and bright; sea: dense and dark)
      const inp = gain(1), out = gain(i === H.cur ? BV[i] : 0), cv = ac.createConvolver(), wet = gain(i ? .4 : .25), pre = i ? ch(inp, filt('lowpass', 3000)) : inp;
      cv.buffer = buf(i ? 2.2 : 3.2, d => { let lp = 0; for (let j = 0; j < d.length; j++) { const n = R() * 2 - 1; lp += (n - lp) * (i ? .08 : .6); d[j] = (i ? lp * 2.2 : n) * Math.pow(1 - j / d.length, i ? 3 : 4) * Math.min(1, j / 400) } });
      pre.connect(out); ch(pre, cv, wet, out); out.connect(master); BUS[i] = { inp, out };
    }
    { const s = ch(loop(BRN), filt('lowpass', 320), gain(.16)); lfo(.06, .06, s.gain); s.connect(BUS[1].inp); ch(loop(CLK), filt('highpass', 2500), gain(.3), BUS[1].out); const w = gain(0); ch(loop(NZ, .8), filt('lowpass', 650), w, BUS[1].inp); BED[1] = { w } } // sea hum, reef crackle, surface waves
    for (const p of H.PT) { const s = slot(p.w, CONT.portal(p.to), p.R * 1.5); pos(s.p, p.c[0], p.c[1], p.c[2]); s.o.gain.value = .45; POR.push(s) } // a hum per ring, pitched by where it leads
    for (const [i, s] of pend) add(i, s); pend.length = 0;
  }
  function add(i, src) {
    if (!ac) return pend.push([i, src]); const n = src.n, V = [], S = [];
    for (let v = 0; v < 10; v++) { const g = gain(1), lp = filt('lowpass', 18000), p = pan(src.ref); ch(g, lp, p, BUS[i].inp); V.push({ g, lp, p, e: -1, until: 0 }) }
    for (const t of new Set(src.T)) if (TY[t].c) for (let j = 0; j < TY[t].n; j++) { const s = slot(i, CONT[TY[t].c](), src.ref); s.t = t; S.push(s) }
    WA[i] = { src, V, S, D: new Float64Array(n), NX: new Float64Array(n), PA: new Float32Array(n), TK: new Uint8Array(n) };
  }
  function fire(w, e, name, d, r, now) {
    let v = null; for (let j = 0; j < w.V.length; j++) if (w.V[j].until < now) { v = w.V[j]; break } if (!v) return;
    const P = w.src.P; v.e = e; pos(v.p, P[e * 3], P[e * 3 + 1], P[e * 3 + 2]); v.lp.frequency.setValueAtTime(Math.max(700, 18000 * Math.exp(-2.2 * d / r)), now);
    v.g.gain.setValueAtTime(TY[w.src.T[e]].vol || 1, now); v.until = now + .32 + EV[name](v.g, now + .02, e);
  }
  function tick() {
    if (!ac || ac.state != 'running' || (++k) % 3) return;
    const i = H.cur, U = H.PU[i], now = ac.currentTime, cx = U[16], cy = U[17], cz = U[18], fx = U[56], fy = U[57], fz = U[58], L = ac.listener;
    const ul = Math.sqrt(Math.max(1e-6, 1 - fy * fy)), ux = -fx * fy / ul, uy = (1 - fy * fy) / ul, uz = -fz * fy / ul;
    if (L.positionX) { L.positionX.setTargetAtTime(cx, now, .03); L.positionY.setTargetAtTime(cy, now, .03); L.positionZ.setTargetAtTime(cz, now, .03); L.forwardX.setTargetAtTime(fx, now, .03); L.forwardY.setTargetAtTime(fy, now, .03); L.forwardZ.setTargetAtTime(fz, now, .03); L.upX.setTargetAtTime(ux, now, .03); L.upY.setTargetAtTime(uy, now, .03); L.upZ.setTargetAtTime(uz, now, .03) }
    else { L.setPosition(cx, cy, cz); L.setOrientation(fx, fy, fz, ux, uy, uz) }
    if (i == 1) BED[1].w.gain.setTargetAtTime(sst(16, 2, -cy) * (.25 + .2 * Math.sin(now * .7)), now, .2);
    const w = WA[i]; if (!w) return;
    const src = w.src, P = src.P, A = src.A, T = src.T, n = src.n; src.tick(U[19], cx, cy, cz);
    for (let e = 0; e < n; e++) {
      const ty = TY[T[e]], dx = P[e * 3] - cx, dy = P[e * 3 + 1] - cy, dz = P[e * 3 + 2] - cz, d = Math.sqrt(dx * dx + dy * dy + dz * dz); w.D[e] = d;
      if (ty.c && !ty.rise) continue;
      const a = A[e], pa = w.PA[e]; w.PA[e] = a;
      if (d > ty.r) { if (ty.iv && w.NX[e] < now) w.NX[e] = now + R() * ty.iv[1]; continue }
      if (ty.rise && a > .3 && (pa <= .3 || ty.hold && now > w.NX[e])) { fire(w, e, ty.rise, d, ty.r, now); if (ty.hold) w.NX[e] = now + ty.hold }
      else if (ty.ev && now > w.NX[e]) { fire(w, e, ty.ev, d, ty.r, now); w.NX[e] = now + ty.iv[0] + R() * (ty.iv[1] - ty.iv[0]) }
    }
    for (let j = 0; j < w.V.length; j++) { const v = w.V[j]; if (v.until > now) pos(v.p, P[v.e * 3], P[v.e * 3 + 1], P[v.e * 3 + 2], .05) }
    w.TK.fill(0);
    for (let j = 0; j < w.S.length; j++) {
      const s = w.S[j], ty = TY[s.t]; let b = -1, bd = ty.r; for (let e = 0; e < n; e++) if (T[e] == s.t && !w.TK[e] && w.D[e] < bd) { bd = w.D[e]; b = e }
      if (b < 0) { s.o.gain.setTargetAtTime(0, now, .3); continue }
      w.TK[b] = 1; pos(s.p, P[b * 3], P[b * 3 + 1], P[b * 3 + 2], b == s.e ? .06 : 0); s.e = b;
      s.lp.frequency.setTargetAtTime(Math.max(700, 18000 * Math.exp(-2.2 * bd / ty.r)), now, .2); s.o.gain.setTargetAtTime(sst(ty.r, ty.r * .75, bd) * (s.t == 14 ? .6 + A[b] : 1), now, .25);
    }
  }
  function world(to) { if (!ac) return; const now = ac.currentTime; for (let i = 0; i < NW; i++) BUS[i].out.gain.setTargetAtTime(i === to ? BV[i] : 0, now, i === to ? .15 : .12) }
  function transition(to) { // splash into the sea / airy rising whoosh into the sky (not spatial)
    if (!ac || ac.state != 'running') return; const t = ac.currentTime + .02;
    if (to == 1) { hiss(master, t, 'lowpass', 4000, 300, .8, .8, .55, .015); tone(master, t, 'sine', 90, 35, .4, .6); EV.bubbles(master, t + .25); EV.bubbles(master, t + .45) }
    else if (to == 2) { for (const [f, d] of [[330, 0], [415, .08], [494, .16], [659, .26]]) tone(master, t + d, 'sine', f, f * 1.003, 1.8, .07, .2); for (let i = 0; i < 9; i++) { const f = 2000 + R() * 2500; tone(master, t + .2 + i * .09 + R() * .05, 'sine', f, f * 1.2, .08, .05) } }
    else { hiss(master, t, 'highpass', 600, 3500, .7, .9, .45, .05); for (const f of [660, 990, 1320]) tone(master, t + .1, 'sine', f, f, 1.4, .05, .25) }
  }
  function toggle() { mute ^= 1; if (ac) master.gain.setTargetAtTime(mute ? 0 : .9, ac.currentTime, .05); return mute }
  return { start, add, tick, world, transition, toggle };
}
