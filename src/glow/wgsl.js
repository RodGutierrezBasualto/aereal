// ---------- Glowcap Hollow WGSL. Uniform G: vp, cam (xyz, time), moon (dir), res, cr/cu/cf (camera basis, .w = tanX / tanY / near), misc (exposure)
const G_U = /*wgsl*/`
struct G{vp:mat4x4f,cam:vec4f,moon:vec4f,res:vec4f,cr:vec4f,cu:vec4f,cf:vec4f,misc:vec4f}
@group(0)@binding(0)var<uniform>g:G;
fn h21(p:vec2f)->f32{var q=fract(vec3f(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
fn h31(p:vec3f)->f32{var q=fract(p*.1031);q+=dot(q,q.zyx+31.32);return fract((q.x+q.y)*q.z);}
fn n2(p:vec2f)->f32{let i=floor(p);let f=fract(p);let u=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2f(1.,0.)),u.x),mix(h21(i+vec2f(0.,1.)),h21(i+vec2f(1.,1.)),u.x),u.y);}
struct FS{@builtin(position)p:vec4f,@location(0)uv:vec2f}
@vertex fn vf(@builtin(vertex_index)i:u32)->FS{var o:FS;let q=vec2f(f32((i<<1u)&2u),f32(i&2u));o.p=vec4f(q*2.-1.,0.,1.);o.uv=vec2f(q.x,1.-q.y);return o;}
`;
// scene helpers: light map (coloured light pooled under the mushrooms), cap map (glowing undersides, for reflections), ground height, sky, mist, lighting
const G_C = G_U + /*wgsl*/`
@group(0)@binding(1)var LM:texture_2d<f32>;
@group(0)@binding(2)var LS:sampler;
@group(0)@binding(3)var HMT:texture_2d<f32>;
@group(0)@binding(4)var CM:texture_2d<f32>;
fn glowAt(p:vec3f)->vec3f{return textureSampleLevel(LM,LS,(p.xz+650.)/1300.,0.).rgb;}
fn gh(x:f32,z:f32)->f32{
 let u=clamp((vec2f(x,z)+650.)*(240./1300.),vec2f(0.),vec2f(239.99));let i=vec2i(u);let f=fract(u);
 return mix(mix(textureLoad(HMT,i,0).r,textureLoad(HMT,i+vec2i(1,0),0).r,f.x),mix(textureLoad(HMT,i+vec2i(0,1),0).r,textureLoad(HMT,i+vec2i(1,1),0).r,f.x),f.y);}
const MOONC=vec3f(.42,.58,1.)*.3;
const AMB=vec3f(.005,.008,.017);
fn fb2(p:vec2f)->f32{return (n2(p)*.5+n2(p*2.03+7.1)*.25+n2(p*4.1+3.3)*.125+n2(p*8.3+1.7)*.0625)/.9375;}
fn pulse(p:vec3f,ph:f32)->f32{return .72+.28*sin(g.cam.w*.8-length(p.xz-vec2f(-70.,110.))*.035+ph);}
fn skyCol(d:vec3f)->vec3f{
 let y=max(d.y,0.);
 var c=mix(vec3f(.011,.022,.042),vec3f(.0015,.003,.012),pow(y,.5));
 let band=exp(-pow(dot(d,normalize(vec3f(.3,.55,-.78))),2.)*12.)*(.5+.5*fb2(d.xz*5.+d.y*3.));
 c+=vec3f(.028,.026,.05)*band*smoothstep(0.,.25,y);
 for(var k=0;k<2;k+=1){let sc=mix(190.,420.,f32(k));let q=d*sc;let cl=floor(q);let h=h31(cl);let sp=fract(q)-.5-(vec3f(h31(cl+3.1),h31(cl+7.7),h31(cl+1.3))-.5)*.6;
  c+=mix(vec3f(.75,.85,1.),vec3f(1.,.86,.7),h31(cl+9.9))*step(mix(.972,.955,f32(k)),h)*exp(-dot(sp,sp)*mix(45.,80.,f32(k)))*(1.1+.9*sin(g.cam.w*(1.5+h*3.)+h*40.))*mix(2.2,.9,f32(k))*smoothstep(0.,.12,y);}
 let md=max(dot(d,g.moon.xyz),0.);
 c+=vec3f(1.,.95,.85)*(smoothstep(.99895,.9992,md)*5.5+pow(md,500.)*.45+pow(md,26.)*.06);
 let cl=smoothstep(.48,.86,fb2(d.xz/(y+.24)*1.25+vec2f(g.cam.w*.004,1.7)));
 c=mix(c,vec3f(.022,.034,.06)+vec3f(.3,.33,.38)*pow(md,5.),cl*.62*smoothstep(.02,.3,y));
 return c;}
fn fogF(c:vec3f,wp:vec3f)->vec3f{
 let o=g.cam.xyz;let v=wp-o;let d=length(v);
 let ym=max(mix(o.y,wp.y,.5),-4.);let den=.0019*exp(-ym/13.)+.00028;let tr=exp(-den*d);
 let mid=mix(o,wp,.35);let gl=glowAt(mid)*exp(-max(mid.y-gh(mid.x,mid.z),0.)/26.);
 return c*tr+(vec3f(.007,.013,.03)+gl*.26)*(1.-tr);}
fn shade(alb:vec3f,n:vec3f,wp:vec3f,ao:f32)->vec3f{
 let gl=glowAt(wp)*exp(-max(wp.y-gh(wp.x,wp.z),0.)/16.);
 return alb*(MOONC*max(dot(n,g.moon.xyz),0.)*ao+AMB*ao*(.6+.4*n.y)+gl*1.9*(.4+.6*max(n.y,0.)));}
`;
const G_TER = G_C + /*wgsl*/`
struct TI{@location(0)p:vec3f,@location(1)n:vec3f,@location(2)a:vec2f}
struct TO{@builtin(position)cp:vec4f,@location(0)wp:vec3f,@location(1)n:vec3f,@location(2)a:vec2f}
@vertex fn vs(i:TI)->TO{var o:TO;o.cp=g.vp*vec4f(i.p,1.);o.wp=i.p;o.n=i.n;o.a=i.a;return o;}
@fragment fn fs(i:TO)->@location(0)vec4f{
 let p=i.wp;let d1=fb2(p.xz*.05);let d2=n2(p.xz*.9);let d3=n2(p.xz*4.3);
 let bx=n2(p.xz*1.7+3.)-n2(p.xz*1.7+vec2f(3.6,0.));let bz=n2(p.xz*1.7+3.)-n2(p.xz*1.7+vec2f(3.,.6));
 let n=normalize(i.n+vec3f(bx,0.,bz)*.9);
 var alb=mix(vec3f(.03,.024,.02),vec3f(.014,.036,.022),smoothstep(.7,.92,i.n.y)*smoothstep(.3,.55,d1));
 alb=mix(alb,vec3f(.04,.04,.047),smoothstep(.78,.5,i.n.y))*(.5+.55*d2+.45*d3);
 alb=mix(alb,vec3f(.007,.011,.015),i.a.y);
 var c=shade(alb,n,p,i.a.x);
 let gl=glowAt(p);let fl=smoothstep(.72,.9,i.n.y)*(1.-i.a.y);
 let w=vec2f(n2(p.xz*.11),n2(p.xz*.11+31.))*5.;
 let v1=1.-smoothstep(0.,.035,abs(n2(p.xz*.16+w)-.5));let v2=1.-smoothstep(0.,.05,abs(n2(p.xz*.5-w)-.5));
 let flow=.55+.45*sin(g.cam.w*1.2-length(p.xz)*.15+d1*9.);
 c+=gl*(v1*.55+v2*.16)*flow*fl;
 let cl=floor(p.xz*1.7);let h=h21(cl);let f=fract(p.xz*1.7)-.5-(vec2f(h21(cl+5.3),h21(cl+9.1))-.5)*.6;
 c+=(gl*1.6+vec3f(.02,.07,.05))*step(.9,h)*exp(-dot(f,f)*110.)*fl*(.5+.5*sin(g.cam.w*2.+h*30.));
 return vec4f(fogF(c,p),1.);}
`;
// instanced scenery. KIND 0 mushrooms (giant + clusters), 1 ferns (sway), 2 rocks. instance: ip pos+scale, iq yaw/tiltX/tiltZ/phase, ic colour, ie.x glow strength
// materials (uv.w): 0 stem (uv.x around 0..1, uv.y up), 1 cap top (uv.x angle, uv.y centre->rim), 2 gills / skirt, 3 fern, 4 rock, 5 hanging tendril (uv.y down)
const G_INST = G_C + /*wgsl*/`
override KIND:u32=0u;
struct VI{@location(0)p:vec3f,@location(1)n:vec3f,@location(2)uv:vec4f,@location(3)ip:vec4f,@location(4)iq:vec4f,@location(5)ic:vec4f,@location(6)ie:vec4f}
struct VO{@builtin(position)cp:vec4f,@location(0)wp:vec3f,@location(1)n:vec3f,@location(2)uv:vec4f,@location(3)@interpolate(flat)c:vec4f,@location(4)lp:vec3f,@location(5)@interpolate(flat)e:vec4f}
fn rot(v:vec3f,q:vec4f)->vec3f{let cy=cos(q.x);let sy=sin(q.x);let r=vec3f(v.x*cy-v.z*sy,v.y,v.x*sy+v.z*cy);return vec3f(r.x+q.y*r.y,r.y,r.z+q.z*r.y);}
fn spots(q:vec2f,sd:f32)->f32{
 let s=q*4.6+sd;let c=floor(s);var m=0.;
 for(var j=-1;j<=1;j+=1){for(var k=-1;k<=1;k+=1){let o=c+vec2f(f32(k),f32(j));let h=vec2f(h21(o),h21(o+17.3));let r=.14+.22*h21(o+5.1);
  m=max(m,(1.-smoothstep(r*.45,r,length(s-(o+.2+.6*h))))*step(.42,h.x*.6+h.y*.4+.2));}}
 return m;}
@vertex fn vs(i:VI)->VO{
 var l=i.p;let t=g.cam.w;
 if(KIND==1u){let w=i.uv.y*i.uv.y;l.x+=sin(t*1.3+i.iq.w+i.ip.x*.1)*.08*w;l.z+=cos(t*1.1+i.iq.w)*.08*w;}
 if(KIND==0u){l.x+=sin(t*.35+i.iq.w)*.01*smoothstep(.3,1.,l.y);
  if(i.uv.w>4.5){let w=i.uv.y*i.uv.y;l.x+=sin(t*1.1+i.iq.w+i.uv.x*3.)*.018*w;l.z+=cos(t*.9+i.uv.x*5.)*.018*w;}}
 let wp=i.ip.xyz+rot(l*i.ip.w,i.iq);
 var o:VO;o.cp=g.vp*vec4f(wp,1.);o.wp=wp;o.n=rot(i.n,i.iq);o.uv=i.uv;o.c=i.ic;o.lp=l;o.e=vec4f(i.ie.x,i.iq.w,i.ip.w,0.);return o;}
@fragment fn fs(i:VO)->@location(0)vec4f{
 let v=normalize(g.cam.xyz-i.wp);var n=normalize(i.n);if(dot(n,v)<0.){n=-n;}
 let m=u32(i.uv.w+.5);let col=i.c.rgb;let pu=pulse(i.wp,i.e.y)*i.e.x;let fres=pow(1.-max(dot(n,v),0.),3.);let t=g.cam.w;var alb:vec3f;var em=vec3f(0.);
 if(m==0u){
  let up=max(i.uv.y,0.);let fib=.5+.5*sin(i.uv.x*106.8+sin(up*9.+i.e.y)*2.);
  alb=vec3f(.06,.06,.075)*(.45+.6*fib);
  let vn=pow(.5+.5*sin(i.uv.x*37.7+sin(up*5.+i.e.y*3.)*1.2),12.);let wave=smoothstep(.7,1.,sin(up*9.-t*1.4+i.e.y));
  em=col*(pow(up,3.5)*.5*(.55+.45*fib)+vn*(.05+.4*wave)*smoothstep(.02,.3,up)+fres*.04)*pu;
 }else if(m==1u){
  let r=max(i.uv.y,0.);let q=vec2f(cos(i.uv.x),sin(i.uv.x))*r;let sp=spots(q,i.e.y*3.);
  let rim=smoothstep(.9,.99,r);let thin=pow(smoothstep(.3,1.,r),2.5);let vein=pow(.5+.5*sin(i.uv.x*36.+n2(q*6.)*4.),6.)*smoothstep(.15,.9,r);
  alb=col*.03+vec3f(.011,.013,.019);
  em=col*(sp*(1.+.45*sin(t*1.7+i.e.y*9.+q.x*20.))+rim*1.25+thin*.34+vein*.08+fres*.14+.05)*pu;
 }else if(m==2u){
  let rid=pow(.5+.5*sin(i.uv.x*110.),2.);alb=col*.06;em=col*(.22+.95*rid)*(.3+.7*max(i.uv.y,0.))*pu*.85;
 }else if(m==3u){alb=vec3f(.012,.034,.02);em=col*(pow(max(i.uv.y,0.),5.)*1.1+(1.-smoothstep(0.,.15,abs(i.uv.x)))*.1*i.uv.y)*pulse(i.wp,i.e.y);
 }else if(m==5u){alb=vec3f(.01);em=col*(.12+1.7*pow(.5+.5*sin(i.uv.y*24.-t*1.6+i.uv.x*7.),8.))*pu;
 }else{alb=vec3f(.03,.03,.036)*(.5+.9*n2(i.lp.xz*3.+i.lp.y*2.));em=col*smoothstep(.62,.7,n2(i.lp.xz*6.+i.lp.yy*4.+i.e.y))*smoothstep(-.1,.4,n.y)*.8*pulse(i.wp,i.e.y);}
 return vec4f(fogF(shade(alb,n,i.wp,1.)+em,i.wp),1.);}
`;
const G_ENV = G_C + /*wgsl*/`
struct WO{@builtin(position)cp:vec4f,@location(0)wp:vec3f}
@vertex fn vw(@builtin(vertex_index)i:u32)->WO{let q=vec2f(f32(i&1u),f32((i>>1u)&1u))*2.-1.;var o:WO;o.wp=vec3f(g.cam.x+q.x*900.,0.,g.cam.z+q.y*900.);o.cp=g.vp*vec4f(o.wp,1.);return o;}
fn capRef(p:vec2f,R:vec3f)->vec3f{
 let k=R.xz/max(R.y,.06);let a=textureSampleLevel(CM,LS,(p+k*30.+650.)/1300.,0.);let h=select(30.,a.a,a.a>1.);
 return textureSampleLevel(CM,LS,(p+k*h+650.)/1300.,0.).rgb;}
@fragment fn fw(i:WO)->@location(0)vec4f{
 let v=i.wp-g.cam.xyz;let I=v/length(v);let t=g.cam.w;
 let r=vec2f(n2(i.wp.xz*.35+vec2f(t*.3,t*.2))+.5*n2(i.wp.xz*1.3-vec2f(t*.4,t*.3)),n2(i.wp.xz*.5-vec2f(t*.25,-t*.31))+.5*n2(i.wp.xz*1.1+vec2f(t*.33,t*.5)))-.75;
 let n=normalize(vec3f(r.x*.13,1.,r.y*.13));let R=reflect(I,n);let fr=.04+.96*pow(1.-max(-dot(I,n),0.),5.);
 var c=skyCol(R)*fr*.8+vec3f(.001,.003,.006);
 c+=capRef(i.wp.xz,R)*(.25+.75*fr)*1.3;
 c+=glowAt(i.wp)*.05;
 c+=vec3f(1.,.95,.85)*pow(max(dot(R,g.moon.xyz),0.),260.)*1.6;
 return vec4f(fogF(c,i.wp),1.);}
fn vdir(uv:vec2f)->vec3f{return normalize(g.cf.xyz+g.cr.xyz*(uv.x*2.-1.)*g.cr.w+g.cu.xyz*(1.-uv.y*2.)*g.cu.w);}
@fragment fn fb(i:FS)->@location(0)vec4f{let d=vdir(i.uv);return vec4f(mix(skyCol(d),vec3f(.007,.013,.03),exp(-max(d.y,0.)*16.)*.8),1.);}
struct CO{@builtin(position)cp:vec4f,@location(0)wp:vec3f,@location(1)n:vec3f,@location(2)h:f32,@location(3)@interpolate(flat)c:vec4f}
@vertex fn vc(@builtin(vertex_index)vi:u32,@location(0)a:vec4f,@location(1)b:vec4f,@location(2)c:vec4f)->CO{
 let q=vi/6u;let k=vi%6u;let so=f32(u32(k==1u||k==2u||k==4u));let top=f32(u32(k==2u||k==4u||k==5u));
 let an=(f32(q)+so)/24.*6.2832;let dir=vec3f(cos(an),0.,sin(an));
 var o:CO;o.wp=vec3f(a.x,mix(b.x,a.y,top),a.z)+dir*a.w*mix(1.5,.93,top);o.cp=g.vp*vec4f(o.wp,1.);o.n=normalize(vec3f(dir.x,.3,dir.z));o.h=top;o.c=c;return o;}
@fragment fn fc(i:CO)->@location(0)vec4f{
 let v=g.cam.xyz-i.wp;let d=length(v);let th=pow(abs(dot(normalize(i.n),v/d)),1.7);
 let dust=.55+.45*n2(i.wp.xz*.3+vec2f(g.cam.w*.06,i.wp.y*.25-g.cam.w*.12));
 return vec4f(i.c.rgb*th*pow(max(i.h,0.),1.6)*dust*i.c.a*.6*pulse(i.wp,0.)*smoothstep(2.,18.,d)*exp(-.0015*d),0.);}
`;
// sprites: 0 fireflies (swarms flash in travelling waves), 1 spores rising from the caps, 2 moths that stay around the camera
const G_PT = G_C + /*wgsl*/`
override PK:u32=0u;
struct PO{@builtin(position)cp:vec4f,@location(0)q:vec2f,@location(1)c:vec3f}
@vertex fn vp(@builtin(vertex_index)vi:u32,@location(0)a:vec4f,@location(1)b:vec4f)->PO{
 let q=vec2f(f32(vi&1u),f32((vi>>1u)&1u))*2.-1.;let t=g.cam.w;var p=a.xyz;var sz=a.w;var col=vec3f(.85,1.,.35);var al=1.;
 if(PK==0u){p+=vec3f(sin(t*.4+b.y*20.),sin(t*.7+b.z*13.)*.35,cos(t*.5+b.y*9.))*1.6;al=.04+1.4*pow(max(0.,sin(t*1.6-b.w*.13+b.x)),14.);}
 else if(PK==1u){let u=fract(t*.015*(.5+b.y)+b.x);p+=vec3f(sin(t*.3+b.z*20.)*2.,u*b.w*1.4,cos(t*.27+b.x*17.)*2.);al=smoothstep(0.,.1,u)*smoothstep(1.,.6,u)*1.2;col=mix(vec3f(.45,.9,1.),vec3f(.8,.6,1.),b.z);}
 else{let r=b.y;p=g.cam.xyz+vec3f(cos(t*.5*(.6+a.x)+b.x)*r,sin(t*.9+b.x*3.)*1.2-.4,sin(t*.45*(.6+a.y)+b.x)*r)+vec3f(sin(t*7.+b.x),cos(t*9.+b.x),sin(t*8.)*.5)*.08;al=.28+.1*sin(t*17.+b.x*9.);col=vec3f(1.,.88,.62);}
 let d=distance(p,g.cam.xyz);let mn=d*g.cu.w*2.*g.res.w*1.5;let s2=max(sz,mn);al*=(sz/s2)*(sz/s2)*exp(-.0025*d);
 var o:PO;o.cp=g.vp*vec4f(p+(g.cr.xyz*q.x+g.cu.xyz*q.y)*s2,1.);o.q=q;o.c=col*al;return o;}
@fragment fn fp(i:PO)->@location(0)vec4f{let r2=dot(i.q,i.q);if(r2>1.){discard;}return vec4f(i.c*exp(-r2*4.)*2.,0.);}
`;
// fauna. instance i0 = pos + size, i1 = (yaw/phase, speed/period, kind, wander radius), i2 = colour, i3.x = seed. kinds: 0 deer, 1 owl, 2 frog, 3 lantern beast
const G_FA = G_C + /*wgsl*/`
fn wpath(c:vec2f,R:f32,a:f32,sd:f32)->vec2f{return c+R*vec2f(cos(a)*(1.+.3*sin(2.*a+sd)),sin(a)*(1.+.3*cos(3.*a+sd)));}
struct FO{@builtin(position)pos:vec4f,@location(0)wp:vec3f,@location(1)n:vec3f,@location(2)@interpolate(flat)k:vec4f,@location(3)c:f32}
@vertex fn vs(@location(0)a0:vec4f,@location(1)a1:vec4f,@location(2)i0:vec4f,@location(3)i1:vec4f,@location(4)i2:vec4f,@location(5)i3:vec4f)->FO{
 let t=g.cam.w;let K=i1.z;let sz=i0.w;let sd=i3.x;var q=a0.xyz;var n=a1.yzw;let id=floor(a0.w);let fw=fract(a0.w);var P=i0.xyz;var F=vec3f(0.,0.,1.);var ex=0.;
 if(K<.5){
  let om=.11+.05*fract(sd*.618);let sp=i1.y;let u=sp*t+.95*sp/om*sin(t*om+sd*6.);let mv=.5+.475*cos(t*om+sd*6.);
  let a=u/i1.w+i1.x;let p0=wpath(i0.xz,i1.w,a,sd);var hd=normalize(wpath(i0.xz,i1.w,a+.02,sd)-p0+vec2f(1e-5,0.));
  let dc=p0-g.cam.xz;let dl=length(dc);let st=(1.-smoothstep(8.,32.,dl))*(1.-smoothstep(10.,22.,g.cam.y-gh(p0.x,p0.y)));
  let aw=dc/max(dl,1e-3);var xz=p0+aw*st*14.;let rl=length(xz);if(rl>540.){xz*=540./rl;}
  hd=normalize(mix(hd,aw,smoothstep(0.,.3,st)));F=vec3f(hd.x,0.,hd.y);P=vec3f(xz.x,gh(xz.x,xz.y),xz.y);
  let gp=u/sz*4.+t*st*12.;let am=max(mv,st);
  if(id>.5&&id<4.5){let o=select(0.,3.1416,id==2.||id==3.);q.z+=sin(gp+o)*.3*fw*am;q.y+=max(0.,-cos(gp+o))*.1*fw*am;}
  if(id==5.){let gr=smoothstep(.5,.1,mv)*(1.-st);q.y-=gr*fw*.75;q.z+=gr*fw*.2;}
 }else if(K<1.5){
  F=vec3f(sin(i1.x),0.,cos(i1.x));
  if(id==5.){let dc=g.cam.xyz-P;let tgt=atan2(dc.x,dc.z);var dy=tgt-i1.x;dy=dy-6.2832*floor((dy+3.1416)/6.2832);let tu=clamp(dy,-1.5,1.5)*(1.-smoothstep(25.,45.,length(dc)))+.25*sin(t*.3+sd);
   let c=cos(tu);let s=sin(tu);let hp=q-vec3f(0.,.6,0.);q=vec3f(hp.x*c+hp.z*s,hp.y,hp.z*c-hp.x*s)+vec3f(0.,.6,0.);n=vec3f(n.x*c+n.z*s,n.y,n.z*c-n.x*s);
   if(a1.x>.8){let bl=step(.96,fract(t*.21+sd));q.y=mix(q.y,.68,bl*.9);}}
 }else if(K<2.5){
  F=vec3f(sin(i1.x),0.,cos(i1.x));let pr=fract(t/i1.y+sd*.1);ex=smoothstep(0.,.06,pr)*smoothstep(.3,.12,pr);
  if(a1.x>.8){q=vec3f(0.,.06,.16)+(q-vec3f(0.,.06,.16))*(1.+1.4*ex);}
 }else{
  F=vec3f(sin(i1.x),0.,cos(i1.x));let br=sin(t*.45+sd);if(id<4.){q.y*=1.+.035*br;q.x*=1.+.02*br;}if(id==5.){q.y+=.02*br;}
  ex=1.-smoothstep(10.,42.,distance(g.cam.xyz,P));
 }
 let Rt=normalize(cross(F,vec3f(0.,1.,0.)));let Uu=cross(Rt,F);
 var o:FO;o.wp=P+(Rt*q.x+Uu*q.y+F*q.z)*sz;o.pos=g.vp*vec4f(o.wp,1.);o.n=Rt*n.x+Uu*n.y+F*n.z;o.k=vec4f(K,ex,i2.x,0.);o.c=a1.x;return o;}
@fragment fn fs(i:FO,@builtin(front_facing)ff:bool)->@location(0)vec4f{
 let v=normalize(g.cam.xyz-i.wp);var n=normalize(i.n);if(dot(n,v)<0.){n=-n;}
 let K=i.k.x;let c=i.c;let nz=n2(i.wp.xz*7.+i.wp.y*3.);var alb:vec3f;var em=vec3f(0.);let pu=pulse(i.wp,0.);
 if(K<.5){alb=select(select(vec3f(.03),vec3f(.3,.3,.33),c<.45),vec3f(.1,.1,.13)*(.8+.4*nz),c<.15);if(c>.75){alb=vec3f(.05);em=vec3f(.25,.95,1.)*2.4*pu;}}
 else if(K<1.5){alb=select(vec3f(.13,.1,.075)*(.7+.6*nz),vec3f(.3,.26,.2),c>.2&&c<.45);if(c>.75){alb=vec3f(0.);em=vec3f(1.,.62,.15)*3.;}if(c>.5&&c<.75){alb=vec3f(.04);}}
 else if(K<2.5){alb=vec3f(.04,.12,.06)*(.7+.6*nz);if(c>.5&&c<.75){alb=vec3f(.01);}if(c>.75){alb=vec3f(.05,.1,.06);em=vec3f(.4,1.,.6)*(.25+3.2*i.k.y);}}
 else{alb=vec3f(.05,.05,.07)*(.7+.6*nz);if(c>.5){alb=vec3f(.02);}let mk=smoothstep(.62,.7,n2(i.wp.xz*.9+i.wp.y*.7))+smoothstep(.75,.8,n2(i.wp.xz*3.1+i.wp.y*2.))*.6;em=vec3f(1.,.6,.25)*mk*(.03+1.1*i.k.y)*(.8+.2*sin(g.cam.w*.45+7.));}
 return vec4f(fogF(shade(alb,n,i.wp,1.)+em,i.wp),1.);}
`;
// bloom (down / up) and the final grade
const G_POST = G_U + /*wgsl*/`
@group(1)@binding(0)var T0:texture_2d<f32>;
@group(1)@binding(1)var SM:sampler;
fn tap(uv:vec2f,o:vec2f)->vec3f{return min(textureSampleLevel(T0,SM,uv+o/vec2f(textureDimensions(T0)),0.).rgb,vec3f(12.));}
@fragment fn down(i:FS)->@location(0)vec4f{let u=i.uv;
 let c=tap(u,vec2f(0.))*.125+(tap(u,vec2f(-2.,-2.))+tap(u,vec2f(2.,-2.))+tap(u,vec2f(-2.,2.))+tap(u,vec2f(2.,2.)))*.03125
 +(tap(u,vec2f(0.,-2.))+tap(u,vec2f(-2.,0.))+tap(u,vec2f(2.,0.))+tap(u,vec2f(0.,2.)))*.0625+(tap(u,vec2f(-1.,-1.))+tap(u,vec2f(1.,-1.))+tap(u,vec2f(-1.,1.))+tap(u,vec2f(1.,1.)))*.125;
 return vec4f(c,1.);}
@fragment fn up(i:FS)->@location(0)vec4f{let u=i.uv;
 let c=tap(u,vec2f(0.))*4.+(tap(u,vec2f(-1.,0.))+tap(u,vec2f(1.,0.))+tap(u,vec2f(0.,-1.))+tap(u,vec2f(0.,1.)))*2.+tap(u,vec2f(-1.,-1.))+tap(u,vec2f(1.,-1.))+tap(u,vec2f(-1.,1.))+tap(u,vec2f(1.,1.));
 return vec4f(c/16.,1.);}
`;
const G_FIN = G_U + /*wgsl*/`
@group(1)@binding(0)var HD:texture_2d<f32>;
@group(1)@binding(1)var BL:texture_2d<f32>;
@group(1)@binding(2)var SM:sampler;
@fragment fn fin(i:FS)->@location(0)vec4f{
 var c=textureSampleLevel(HD,SM,i.uv,0.).rgb+textureSampleLevel(BL,SM,i.uv,0.).rgb*.5;c*=g.misc.x;
 let q=i.uv-.5;c*=1.-1.1*dot(q,q);
 c=clamp(c*(2.51*c+.03)/(c*(2.43*c+.59)+.14),vec3f(0.),vec3f(1.));
 let l=dot(c,vec3f(.25,.6,.15));c=max(mix(vec3f(l),c,1.22),vec3f(0.));
 c=pow(c,vec3f(1./2.2))+(h21(i.p.xy)+h21(i.p.xy+71.)-1.)/255.;return vec4f(c,1.);}
`;
