// ---------------------------------------------------------------- WGSL
const NX = 352, NY = 48, NZ = 352, CS = 1.5, OX = -264, OY = -64, OZ = -264, SHR = 2048;

const W_N = /*wgsl*/`
fn h21(p:vec2f)->f32{var q=fract(vec3f(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
fn h22(p:vec2f)->vec2f{var q=fract(vec3f(p.xyx)*vec3f(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
fn h31(p:vec3f)->f32{var q=fract(p*.1031);q+=dot(q,q.zyx+31.32);return fract((q.x+q.y)*q.z);}
fn n2(p:vec2f)->f32{let i=floor(p);let f=fract(p);let u=f*f*(3.-2.*f);
 return mix(mix(h21(i),h21(i+vec2f(1.,0.)),u.x),mix(h21(i+vec2f(0.,1.)),h21(i+vec2f(1.,1.)),u.x),u.y);}
fn n3(p:vec3f)->f32{let i=floor(p);let f=fract(p);let u=f*f*(3.-2.*f);
 return mix(mix(mix(h31(i),h31(i+vec3f(1.,0.,0.)),u.x),mix(h31(i+vec3f(0.,1.,0.)),h31(i+vec3f(1.,1.,0.)),u.x),u.y),
  mix(mix(h31(i+vec3f(0.,0.,1.)),h31(i+vec3f(1.,0.,1.)),u.x),mix(h31(i+vec3f(0.,1.,1.)),h31(i+vec3f(1.,1.,1.)),u.x),u.y),u.z);}
fn fb2(p:vec2f)->f32{var a=.5;var s=0.;var q=p;for(var i=0;i<4;i++){s+=a*n2(q);q=q*2.03+vec2f(17.3,9.1);a*=.5;}return s/.9375;}
fn fb3(p:vec3f)->f32{var a=.5;var s=0.;var q=p;for(var i=0;i<4;i++){s+=a*n3(q);q=q*2.03+vec3f(17.3,9.1,4.7);a*=.5;}return s/.9375;}
`;

// terrain density (compute). positive = rock
const W_TER = W_N + /*wgsl*/`
@group(0)@binding(0)var<storage,read_write> D:array<f32>;
fn smax(a:f32,b:f32,k:f32)->f32{let h=max(k-abs(a-b),0.)/k;return max(a,b)+h*h*k*.25;}
fn arch(p:vec3f,c:vec3f,R:f32,r:f32,a:f32)->f32{
 let q=p-c;let cs=cos(a);let sn=sin(a);
 let lx=q.x*cs+q.z*sn;let lz=q.z*cs-q.x*sn;
 let rr=r*(.7+.75*n3(p*.13+c.zxy));
 return rr-length(vec2f(length(vec2f(lx,q.y*.82))-R,lz));
}
fn sg(p:vec2f,a:vec2f,b:vec2f)->f32{let pa=p-a;let ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.));}
fn dens(p:vec3f)->f32{
 let w=vec3f(n3(p*.031),n3(p*.031+vec3f(31.7,5.2,11.9)),n3(p*.031+vec3f(71.3,17.1,43.3)))-.5;
 let w2=vec2f(n3(p*.085+vec3f(3.,8.,1.)),n3(p*.085+vec3f(13.,28.,41.)))-.5;
 let led=sin(p.y*1.05+5.*n3(p*.04));
 let q=p.xz+w.xz*26.+w2*7.+vec2f(.8,.6)*led*1.1;
 let cn=fb2(q*.0066+vec2f(3.1,7.7));
 let bas=fb2(q*.0036+vec2f(40.,12.));
 let clr=smoothstep(32.,60.,length(p.xz-vec2f(0.,8.)))*smoothstep(26.,56.,length(p.xz-vec2f(-78.,52.)))*smoothstep(30.,60.,length(p.xz-vec2f(84.,-58.)));
 let reg=smoothstep(.44,.52,bas)*clr;
 var mesa=smoothstep(.07,.17,abs(cn-.5))*reg;
 let pk=smoothstep(.7,.78,n2(q*.021+vec2f(70.,3.)))*(1.-reg)*clr;
 mesa=max(mesa,pk);
 let q2=p.xz+w.xz*9.+w2*4.+vec2f(.8,.6)*led*1.1;
 let dc=min(min(sg(q2,vec2f(2.,-30.),vec2f(-8.,-58.)),sg(q2,vec2f(-8.,-58.),vec2f(14.,-92.))),min(sg(q2,vec2f(14.,-92.),vec2f(52.,-104.)),sg(q2,vec2f(52.,-104.),vec2f(80.,-88.))));
 mesa=max(mesa,(1.-smoothstep(30.,50.,dc))*smoothstep(24.,40.,length(p.xz-vec2f(0.,8.)))*smoothstep(30.,50.,length(p.xz-vec2f(84.,-58.))));
 mesa*=smoothstep(8.5,15.,dc);
 let fl=-46.+9.*fb2(p.xz*.011+vec2f(5.,1.));
 let top=-19.+12.*fb2(p.xz*.016+vec2f(9.,2.))+pk*7.*n2(p.xz*.05)+7.*pow(1.-abs(2.*n2(p.xz*.045+vec2f(3.,9.))-1.),3.);
 var d=mix(fl,top,mesa)-p.y;
 d+=(fb3(p*.07)-.5)*5.;
 let br=smoothstep(.6,.68,n2(p.xz*.012+vec2f(5.,50.)))*reg;
 let slab=min(p.y-(top-13.-5.*w.y),(top-1.5)-p.y);
 d=smax(d,min(slab,br*14.-7.),3.);
 d=smax(d,min(min(p.y+27.+3.*w.y,top-1.5-p.y),(8.+6.*w2.x)-min(length(p.xz-vec2f(2.,-75.)),length(p.xz-vec2f(52.,-104.)))),3.);
 d=smax(d,arch(p,vec3f(42.,-45.,14.),14.,3.6,.5),3.);
 d=smax(d,arch(p,vec3f(-27.,-41.,19.),18.,3.4,1.5708),3.);
 d=smax(d,arch(p,vec3f(-54.,-46.,-26.),20.,4.6,2.2),3.);
 d=smax(d,arch(p,vec3f(20.,-47.,64.),12.,3.1,1.3),3.);
 d=smax(d,arch(p,vec3f(130.,-45.,30.),22.,5.,.2),3.);
 d=smax(d,arch(p,vec3f(-150.,-45.,-70.),24.,5.5,1.),3.);
 d=smax(d,arch(p,vec3f(40.,-45.,150.),20.,5.,2.6),3.);
 d=smax(d,arch(p,vec3f(-40.,-45.,140.),17.,4.2,.9),3.);
 let e=max(abs(p.x),abs(p.z))+.12*min(abs(p.x),abs(p.z))+(fb2(p.xz*.02)-.5)*40.;
 d+=smoothstep(186.,226.,e)*95.;
 return d;
}
@compute @workgroup_size(4,4,4) fn main(@builtin(global_invocation_id) id:vec3u){
 if(id.x>=${NX}u||id.y>=${NY}u||id.z>=${NZ}u){return;}
 D[id.x+id.y*${NX}u+id.z*${NX * NY}u]=dens(vec3f(id)*${CS}+vec3f(${OX}.,${OY}.,${OZ}.));
}`;

const W_G = /*wgsl*/`
struct G{vp:mat4x4f,svp:mat4x4f,cam:vec4f,sun:vec4f,sunA:vec4f,res:vec4f,cr:vec4f,cu:vec4f,cf:vec4f}
@group(0)@binding(0)var<uniform> g:G;
const SIG=vec3f(.05,.031,.024);
const KD=vec3f(.018,.012,.0095);
const SUNC=vec3f(6.2,5.8,5.2);
fn waterCol(d:vec3f)->vec3f{
 let y=min(g.cam.y+d.y*32.,-.5);
 let u=.5+.5*d.y;
 let c=vec3f(.03,.5,.7)*exp(y*vec3f(.08,.052,.03))+vec3f(.003,.012,.045);
 return c*(.4+.8*u*u);
}
fn fog(c:vec3f,wp:vec3f)->vec3f{let v=wp-g.cam.xyz;let d=length(v);let tr=exp(-SIG*d*g.sunA.w);return c*tr+waterCol(v/d)*(1.-tr);}
`;

const W_FS = /*wgsl*/`
struct FS{@builtin(position)p:vec4f,@location(0)uv:vec2f}
@vertex fn vf(@builtin(vertex_index)i:u32)->FS{var o:FS;let q=vec2f(f32((i<<1u)&2u),f32(i&2u));o.p=vec4f(q*2.-1.,0.,1.);o.uv=vec2f(q.x,1.-q.y);return o;}
fn vdir(uv:vec2f)->vec3f{return normalize(g.cf.xyz+g.cr.xyz*(uv.x*2.-1.)*g.cr.w+g.cu.xyz*(1.-uv.y*2.)*g.cu.w);}
`;

// lighting: shadow map, caustics, baked noise textures
const W_L = /*wgsl*/`
@group(0)@binding(1)var st:texture_2d<f32>;
@group(0)@binding(3)var ct:texture_2d<f32>;
@group(0)@binding(4)var ls:sampler;
@group(0)@binding(5)var ta:texture_2d<f32>;
@group(0)@binding(6)var tb:texture_2d<f32>;
fn sunAt(p:vec3f)->vec3f{return SUNC*exp(-KD*(max(-p.y,0.)/g.sun.y));}
fn cheb(m:vec2f,z:f32)->f32{let dz=z-m.x-.0008;let v=max(m.y-m.x*m.x,3e-7);return select(clamp((v/(v+dz*dz)-.25)/.75,0.,1.),1.,dz<=0.);}
fn shadow(p:vec3f)->f32{
 let q=g.svp*vec4f(p,1.);let uv=q.xy*vec2f(.5,-.5)+.5;
 let t=uv*${SHR / 2}.-.5;let i=vec2i(floor(t));let f=t-floor(t);let mx=vec2i(${SHR / 2 - 1});
 let a=textureLoad(st,clamp(i,vec2i(0),mx),0).xy;let b=textureLoad(st,clamp(i+vec2i(1,0),vec2i(0),mx),0).xy;
 let c=textureLoad(st,clamp(i+vec2i(0,1),vec2i(0),mx),0).xy;let d=textureLoad(st,clamp(i+vec2i(1,1),vec2i(0),mx),0).xy;
 let e=abs(uv-.5)*2.;
 return mix(cheb(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),q.z),1.,smoothstep(.9,1.,max(e.x,e.y)));
}
fn caus(p:vec3f)->vec3f{
 let d=max(-p.y,0.);
 let q=p.xz+g.sun.xz*(d/g.sun.y);
 let b=min(d*.02,1.5);
 let u=q/29.;let o=vec2f(.0014+d*.00004,0.);
 let c=vec3f(textureSampleBias(ct,ls,u+o,b).r,textureSampleBias(ct,ls,u,b).r,textureSampleBias(ct,ls,u-o,b).r);
 let l=textureSampleBias(ct,ls,q.yx/67.+.37,b+1.).r;
 return c*(.5+1.5*l);
}
struct M{a:vec3f,n:vec3f,s:vec2f,ao:f32,tr:vec3f,em:vec3f}
fn lit(m:M,p:vec3f,v:vec3f)->vec3f{
 let L=g.sun.xyz;
 let ndl=dot(m.n,L);
 let dl=sunAt(p)*shadow(p+m.n*.3)*(.2+3.3*mix(vec3f(.17),caus(p),smoothstep(.12,.6,ndl)))*(.45+.55*m.ao);
 let wr=clamp((ndl+.4)/1.4,0.,1.);
 var c=m.a*dl*wr;
 c+=m.tr*dl*clamp(.25-ndl*.75,0.,1.);
 let am=vec3f(.33,.62,.76)*exp(p.y*vec3f(.025,.018,.012));
 c+=m.a*am*(.4+.6*(.5+.5*m.n.y))*m.ao;
 let h=normalize(L+v);
 c+=dl*m.s.x*pow(max(dot(m.n,h),0.),m.s.y)*wr;
 return c+m.em;
}
`;

const W_OBJ = /*wgsl*/`diagnostic(off,derivative_uniformity);` + W_N + W_G + W_L + /*wgsl*/`
override KIND:u32=0u;
struct VI{@location(0)pos:vec3f,@location(1)nrm:vec3f,@location(2)uv:vec4f,@location(3)ip:vec4f,@location(4)iq:vec4f,@location(5)ic:vec4f,@location(6)ie:vec4f}
struct VO{@builtin(position)cp:vec4f,@location(0)wp:vec3f,@location(1)n:vec3f,@location(2)uv:vec4f,@location(3)col:vec4f,@location(4)rp:vec3f,@location(5)lp:vec3f}
struct A{p:vec3f,n:vec3f,r:vec3f}
fn qrot(q:vec4f,v:vec3f)->vec3f{return v+2.*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
fn anim(v:VI)->A{
 var o:A;let t=g.cam.w;let s=v.ip.w;
 if(KIND==0u){
  var p=v.ip.xyz+qrot(v.iq,v.pos*s*(1.-smoothstep(v.ie.z*.7,v.ie.z,distance(v.ip.xyz,g.cam.xyz))*step(1.,v.ie.z)));
  o.r=p;
  p.y+=sin(t*v.ie.y+v.ic.w)*v.ie.x;
  o.p=p;o.n=qrot(v.iq,v.nrm);
 }else if(KIND==1u){
  var l=qrot(v.iq,v.pos*s);
  let n=qrot(v.iq,v.nrm);
  let cd=distance(v.ip.xyz,g.cam.xyz);
  l*=1.-smoothstep(v.ie.z*.78,v.ie.z,cd);
  let hh=max(l.y,0.);
  let ph=v.ic.w+dot(v.ip.xz,vec2f(.045,.037));
  let a=pow(hh,1.35)*v.ie.x;
  var off=vec2f(sin(t*.55+ph+hh*.1)+.45*sin(t*1.2+ph*1.7+hh*.27),cos(t*.43+ph*1.3+hh*.085)+.45*sin(t*.97+ph*.6+hh*.21));
  off=(off*.62+vec2f(.75,.3))*a;
  l=vec3f(l.x+off.x,l.y-dot(off,off)/(2.*max(hh,.05)),l.z+off.y);
  l+=n*(sin(t*1.9+hh*1.4+ph*3.+v.uv.x*1.5)*v.uv.z*v.ie.y);
  o.p=v.ip.xyz+l;o.n=n;o.r=o.p;
 }else{
  let sp=v.ie.z;
  let ss=v.ic.w+t*sp;
  let c=cos(ss);let sn=sin(ss);
  var P=v.ip.xyz+vec3f(v.iq.x*c,v.iq.y*sin(2.*ss+v.iq.w),v.iq.z*sn);
  let T=vec3f(-v.iq.x*sn,2.*v.iq.y*cos(2.*ss+v.iq.w),v.iq.z*c)*sign(sp);
  let fw=normalize(T);
  var rt=normalize(cross(vec3f(0.,1.,0.),fw));
  var up=cross(fw,rt);
  var l=v.pos;var n=v.nrm;
  if(KIND==2u){
   P+=rt*(v.ie.x+.5*sin(t*.31+v.ie.w))+vec3f(0.,v.ie.y+.4*sin(t*.23+v.ie.w*1.7),0.);
   let wv=.6-l.z;
   l.x+=sin(t*9.+v.ie.w-l.z*4.5)*.14*wv*wv;
  }else{
   let a=abs(l.x);
   let fl=sin(t*1.45+v.ie.w-a*1.5);
   l.y+=fl*.34*a*a-.05*a;
   let sl=fl*.68*a*sign(l.x);
   n=normalize(vec3f(n.x-sl*n.y,n.y+sl*n.x,n.z));
   let cb=cos(v.ie.x);let sb=sin(v.ie.x);
   let r2=rt*cb+up*sb;up=up*cb-rt*sb;rt=r2;
  }
  o.p=P+(rt*l.x+up*l.y+fw*l.z)*s;
  o.n=rt*n.x+up*n.y+fw*n.z;o.r=v.pos;
 }
 return o;
}
@vertex fn vs(v:VI)->VO{let a=anim(v);var o:VO;o.cp=g.vp*vec4f(a.p,1.);o.wp=a.p;o.n=a.n;o.uv=v.uv;o.col=v.ic;o.rp=a.r;o.lp=v.pos*v.ip.w;return o;}
@vertex fn vs_s(v:VI)->@builtin(position)vec4f{return g.vp*vec4f(anim(v).p,1.);}

fn tp(t:texture_2d<f32>,p:vec3f,w:vec3f)->vec4f{return textureSample(t,ls,p.zy)*w.x+textureSample(t,ls,p.xz)*w.y+textureSample(t,ls,p.xy)*w.z;}
struct NH{n:vec3f,h:f32}
fn tpn(p:vec3f,n:vec3f,w:vec3f,s:f32)->NH{
 let X=textureSample(ta,ls,p.zy);let Y=textureSample(ta,ls,p.xz);let Z=textureSample(ta,ls,p.xy);
 var x=X.xyz*2.-1.;var y=Y.xyz*2.-1.;var z=Z.xyz*2.-1.;
 x=vec3f(x.xy*s+n.zy,abs(x.z)*n.x);y=vec3f(y.xy*s+n.xz,abs(y.z)*n.y);z=vec3f(z.xy*s+n.xy,abs(z.z)*n.z);
 var o:NH;o.n=normalize(x.zyx*w.x+y.xzy*w.y+z.xyz*w.z);o.h=X.a*w.x+Y.a*w.y+Z.a*w.z;return o;
}
// rock, wood, stone, sponge, coral
@fragment fn fs_r(i:VO)->@location(0)vec4f{
 let v=normalize(g.cam.xyz-i.wp);
 var n0=normalize(i.n);if(dot(n0,v)<0.){n0=-n0;}
 let P=i.rp;
 let w0=pow(abs(n0),vec3f(4.));let w=w0/(w0.x+w0.y+w0.z);
 let m1=tp(tb,P*.043,w);let m2=tp(tb,P*.21,w);let m3=tp(tb,P*1.3,w);
 let nrh=tpn(P*.085,n0,w,1.15);let ndh=tpn(P*.39,n0,w,.6);let nfh=tpn(P*1.9,n0,w,.45);let nr=nrh.n;let nd=ndh.n;
 let nb=normalize(nr+nd+nfh.n-2.*n0);
 let mt=u32(i.uv.w+.5);
 var m:M;m.n=nb;m.ao=1.;m.s=vec2f(.06,10.);
 if(mt==0u){
  let sy=P.y*.11+m1.r*2.4+m1.a*1.1;
  let bnd=.5+.5*sin(sy*6.2832);
  var a=mix(vec3f(.15,.13,.17),vec3f(.5,.39,.29),bnd);
  a=mix(a,vec3f(.36,.24,.4),smoothstep(.45,.75,m1.a)*.7);
  a*=.87+.13*sin(sy*17.+m2.r*3.);
  a*=(.6+.6*m2.r)*(.7+.6*m3.r);
  a*=mix(.45,1.,smoothstep(.15,.6,nrh.h))*mix(.72,1.,smoothstep(.2,.55,ndh.h))*mix(.82,1.,smoothstep(.25,.6,nfh.h));
  let bl=(1.-smoothstep(.1,.15,m2.b))*smoothstep(.56,.68,m1.r);
  a=mix(a,mix(vec3f(.55,.13,.27),vec3f(.6,.38,.1),step(.5,m3.a))*(.6+.6*m3.r),bl*.75);
  a=mix(a,vec3f(.12,.3,.24),smoothstep(.55,.8,m1.r)*smoothstep(.2,.8,n0.y)*.5);
  let cv=smoothstep(.44,.56,i.uv.y+(m1.r-.5)*.9+(m2.r-.5)*.6+(m3.r-.5)*.4)*smoothstep(.5,.8,n0.y);
  let sd=smoothstep(.72,.93,n0.y)*(1.-smoothstep(-39.,-33.,P.y))*(1.-cv);
  let ra=dot(P.xz,vec2f(2.3,1.4))+m1.r*16.;
  let gn=textureSample(tb,ls,P.xz*.83);
  a=mix(a,vec3f(.35,.315,.255)*(.62+.3*m1.r+.35*gn.r+.25*gn.a+.12*sin(ra)),sd);
  m.n=normalize(mix(nb,normalize(nd+vec3f(.26,0.,.16)*cos(ra)),sd));
  a=mix(a,mix(mix(vec3f(.07,.015,.09),vec3f(.3,.03,.24),m2.r*m2.r*1.6),vec3f(.04,.13,.1),smoothstep(.5,.7,m1.a)*.6)*(.45+.7*m3.r),cv);
  m.em=vec3f(.6,.05,.4)*cv*.1*pow(1.-max(dot(n0,v),0.),2.);
  m.ao=i.uv.x;m.a=a;
 }else if(mt==1u){
  let row=floor(i.uv.y);let pl=fract(i.uv.y);
  let bx=i.uv.x*.21+h21(vec2f(row,3.))*7.;
  let pid=h21(vec2f(row,floor(bx)));
  let fb=fract(bx);
  var seam=smoothstep(0.,.08,pl)*(1.-smoothstep(.92,1.,pl))*smoothstep(0.,.012,fb)*(1.-smoothstep(.988,1.,fb));
  seam=mix(seam,1.,i.uv.z);
  let gr=textureSample(tb,ls,vec2f(i.uv.x*.06,i.uv.y*.55+pid*9.)).r;
  var a=mix(vec3f(.2,.12,.07),vec3f(.62,.42,.25),gr)*(.65+.7*pid);
  a*=mix(.16,1.,seam)*mix(.5,1.,smoothstep(-6.,-1.5,i.lp.y));
  a=mix(a,vec3f(.62,.6,.5),(1.-smoothstep(.07,.12,m2.b))*smoothstep(.45,.6,m1.a)*.7);
  a=mix(a,vec3f(.1,.27,.2)*(.5+m2.r),smoothstep(.45,.75,m1.r+.2*n0.y)*.55);
  a=mix(a,vec3f(.75,.12,.48)*(.5+.8*m2.b),smoothstep(.5,.62,m1.a)*smoothstep(.2,.8,n0.y)*.85);
  m.a=a;m.n=normalize(n0+(nd-n0)*.6);m.ao=.55+.45*seam;
 }else if(mt==2u){
  var a=vec3f(.6,.64,.62)*(.55+.6*m2.r);
  a=mix(a,vec3f(.34,.47,.5),smoothstep(.4,.7,m1.r)*.6);
  a*=mix(1.,.55,smoothstep(.9,1.,abs(sin(P.y*2.4+m1.a*5.))));
  a=mix(a,vec3f(.16,.32,.24),(1.-smoothstep(.35,.8,i.uv.x))*.75);
  a=mix(a,vec3f(.8,.14,.5)*(.5+.8*m2.b),smoothstep(.55,.66,m1.a)*smoothstep(.4,.85,n0.y)*.8);
  m.a=a;m.ao=i.uv.x;m.n=normalize(nb*.55+n0*.45);m.s=vec2f(.22,26.);
  let rr=length(i.lp.xz);let an=atan2(i.lp.z,i.lp.x);
  let ca=an*7.2;let id=floor(ca);let f=fract(ca);let vv=(i.lp.y-.28)/.85;
  let hs=h22(vec2f(id,4.));
  var dg=abs(f-.3-.4*hs.x);
  dg=min(dg,max(abs(vv-.2-.6*hs.y),abs(f-.5)-.28));
  dg=min(dg,abs(length(vec2f(f-.5,(vv-.5)*.8))-.2-.1*hs.y)+step(.5,hs.x));
  let gl=(1.-smoothstep(.03,.075,dg))*step(.14,f)*step(f,.86)*step(.08,vv)*step(vv,.92)*step(6.6,rr)*step(rr,7.6);
  m.em=vec3f(.12,1.,.8)*gl*(2.2+1.2*sin(g.cam.w*.9+id*1.3));
 }else if(mt==3u){
  var a=i.col.rgb*(.5+.75*m2.r);
  a*=mix(.3,1.,smoothstep(.06,.2,m2.b));
  a=mix(a,a*.18+vec3f(0.,.02,.03),i.uv.z);
  m.a=a;m.n=normalize(nd*.6+n0*.4);m.ao=mix(1.,.5,i.uv.z);
 }else{
  let tip=i.uv.y*i.uv.y;
  var a=mix(i.col.rgb,vec3f(1.,.94,.88),tip*i.uv.y*.5)*(.55+.7*m2.r);
  a*=mix(.55,1.,smoothstep(.05,.15,m2.b));
  let gp=sin((m2.r+m2.a*.6)*120.+P.y*3.);
  a*=mix(1.,.74+.26*smoothstep(-.5,.5,gp),i.uv.z);
  m.a=a;m.n=normalize(nd*.5+n0*.5);m.em=i.col.rgb*tip*tip*.12;m.ao=.6+.4*i.uv.y;
 }
 return vec4f(fog(lit(m,i.wp,v),i.wp),1.);
}
// kelp, iridescent foliage, ground cover
@fragment fn fs_f(i:VO)->@location(0)vec4f{
 let v=normalize(g.cam.xyz-i.wp);
 var n=normalize(i.n);if(dot(n,v)<0.){n=-n;}
 let sdv=dpdx(i.wp)*dpdx(i.uv.x)+dpdy(i.wp)*dpdy(i.uv.x);
 n=normalize(n+sdv/max(length(sdv),1e-6)*i.uv.x*.55);
 let ndv=max(dot(n,v),0.);
 let ns=textureSample(tb,ls,vec2f(i.uv.x*.13+i.col.w,i.uv.y*.7+i.col.w*3.));
 let mt=u32(i.uv.w+.5);
 var m:M;m.n=n;m.ao=1.;m.s=vec2f(.25,36.);
 let rib=smoothstep(0.,.3,abs(i.uv.x));
 if(mt==7u){
  var a=mix(vec3f(.08,.13,.02),vec3f(.42,.4,.07),ns.r*.7+.3*i.uv.y)*(.8+.4*ns.g);
  a*=mix(.55,1.,rib)*(.82+.18*sin(i.uv.x*11.));
  var tr=vec3f(.4,.42,.07)*(.45+.5*ns.a)*(.8+.2*sin(i.uv.x*11.));
  if(i.uv.y<0.){a=vec3f(.17,.15,.05);tr=vec3f(0.);}
  m.a=a*i.col.rgb;m.tr=tr*i.col.rgb;m.ao=.5+.5*clamp(i.uv.y*2.5,0.,1.);
 }else if(mt==10u){
  let a=vec3f(.5,.52,.45)*(.5+.7*ns.r)*(.65+.35*rib);
  m.a=mix(a,vec3f(.1,.28,.2),smoothstep(.4,.75,ns.a)*.65);m.tr=m.a*.6;m.s=vec2f(.05,8.);
 }else if(mt==5u){
  let ph=ndv*1.7+i.uv.y*.9+i.col.w*.2+ns.r*.7;
  let ir=.5+.5*cos(6.2832*(ph+vec3f(0.,.33,.67)));
  let irc=mix(vec3f(1.,.16,.7),vec3f(.25,.3,1.),ir.x)+vec3f(.05,.75,.6)*ir.y*.7+vec3f(1.,.6,.1)*ir.z*ir.z*ir.z*.5;
  var a=mix(i.col.rgb,irc,.62);
  a*=mix(.45,1.,rib)*(.8+.2*cos(i.uv.x*12.566))*(.45+.65*i.uv.y)*(.75+.5*ns.g);
  m.a=a;m.tr=a*.7;m.s=vec2f(1.,30.);
  m.em=irc*pow(1.-ndv,3.)*.4+a*pow(i.uv.y,4.)*.2;
 }else{
  let a=mix(vec3f(.3,.02,.2),vec3f(1.,.3,.72),i.uv.y)*i.col.rgb*(.8+.2*cos(i.uv.x*9.))*(.8+.4*ns.r);
  m.a=a;m.tr=a*.6;m.em=a*i.uv.y*i.uv.y*.12+vec3f(.35,.1,.6)*pow(1.-ndv,3.)*.2;m.ao=.35+.65*i.uv.y;m.s=vec2f(.3,16.);
 }
 return vec4f(fog(lit(m,i.wp,v),i.wp),1.);
}
// fish, manta
@fragment fn fs_a(i:VO)->@location(0)vec4f{
 let v=normalize(g.cam.xyz-i.wp);
 var n=normalize(i.n);if(dot(n,v)<0.){n=-n;}
 let mt=u32(i.uv.w+.5);
 let cl=textureSample(tb,ls,i.rp.xz*.8+.2);
 var m:M;m.n=n;m.ao=1.;
 if(mt==8u){
  let bk=smoothstep(-.03,.05,i.rp.y);
  var a=mix(vec3f(.8,.86,.9),i.col.rgb,bk);
  a=mix(a,vec3f(1.,.82,.25),(1.-smoothstep(0.,.014,abs(i.rp.y-.008)))*.8*step(-.28,i.rp.z));
  a*=1.-.7*(1.-smoothstep(.012,.02,length(i.rp.yz-vec2f(.02,.4))));
  m.a=a;m.s=vec2f(.4,12.);m.em=a*.03;
 }else{
  let top=i.uv.z;let ax=abs(i.rp.x);
  var bel=vec3f(.8,.84,.88);
  bel*=mix(.3,1.,smoothstep(.95,.6,ax)*smoothstep(-.5,-.2,i.rp.z));
  bel*=1.-.7*(1.-smoothstep(.01,.03,abs(fract(i.rp.z*9.)-.5)))*step(ax,.34)*step(.12,ax)*step(.05,i.rp.z)*step(i.rp.z,.42);
  var tc=vec3f(.02,.03,.05)*(.7+.6*cl.r);
  tc=mix(tc,vec3f(.42,.47,.52),1.-smoothstep(.07,.2,length(vec2f(ax-.3,(i.rp.z-.28)*2.))));
  m.a=mix(bel,tc,top);m.s=vec2f(.3,18.);
 }
 return vec4f(fog(lit(m,i.wp,v),i.wp),1.);
}`;

// water surface from below + background water column
const W_ENV = /*wgsl*/`diagnostic(off,derivative_uniformity);` + W_G + W_L + W_FS + /*wgsl*/`
struct SO{@builtin(position)cp:vec4f,@location(0)wp:vec3f}
@vertex fn vw(@builtin(vertex_index)i:u32)->SO{
 let q=vec2f(f32(i&1u),f32((i>>1u)&1u))*2.-1.;
 var o:SO;o.wp=vec3f(g.cam.x+q.x*900.,0.,g.cam.z+q.y*900.);o.cp=g.vp*vec4f(o.wp,1.);return o;
}
fn sky(d:vec3f)->vec3f{
 let sd=max(dot(d,g.sunA.xyz),0.);
 return mix(vec3f(.5,.78,1.)*1.5,vec3f(.14,.4,.9)*1.15,sqrt(max(d.y,0.)))+vec3f(1.,.93,.78)*(pow(sd,700.)*28.+pow(sd,48.)*4.+pow(sd,6.)*1.7);
}
@fragment fn fw(i:SO)->@location(0)vec4f{
 let vv=i.wp-g.cam.xyz;let dist=length(vv);let I=vv/dist;let t=g.cam.w;
 let px=dist*g.cu.w*2.*g.res.w/max(I.y,.06);
 var gr=vec2f(0.);var k=.33;var a=.44;var d=vec2f(.8,.6);
 for(var j=0;j<6;j++){
  let ph=dot(d,i.wp.xz)*k+t*sqrt(9.8*k)*.55+f32(j)*1.7;
  gr+=d*(k*a*cos(ph))*(1.-smoothstep(.3,1.,px*k*.64));
  d=vec2f(d.x*.6-d.y*.8,d.x*.8+d.y*.6);k*=1.72;a*=.54;
 }
 let n1=textureSampleBias(ta,ls,i.wp.xz*.031+t*vec2f(.011,.017),1.5).xy*2.-1.;
 let n2=textureSampleBias(ta,ls,i.wp.zx*.083-t*vec2f(.019,.013),1.5).xy*2.-1.;
 gr+=(n1*.5+n2*.3)*.3;
 let n=normalize(vec3f(gr.x,-1.,gr.y));
 let c=-dot(n,I);let kk=1.-1.777*(1.-c*c);
 let rd=reflect(I,n);
 let rc=mix(waterCol(normalize(vec3f(rd.x,-abs(rd.y)-.03,rd.z))),waterCol(I),.45);
 let ck=sqrt(max(kk,0.));let T=normalize(1.333*I+(1.333*c-ck)*n+vec3f(0.,1e-4,0.));
 let col=mix(rc,sky(T),(.98-.98*pow(1.-ck,5.))*smoothstep(0.,.55,kk));
 return vec4f(fog(col,i.wp),1.);
}
@vertex fn vb(@builtin(vertex_index)i:u32)->FS{var o:FS;let q=vec2f(f32((i<<1u)&2u),f32(i&2u));o.p=vec4f(q*2.-1.,0.,1.);o.uv=vec2f(q.x,1.-q.y);return o;}
@fragment fn fbg(i:FS)->@location(0)vec4f{return vec4f(waterCol(vdir(i.uv)),1.);}
`;

// sprites: 0 sparkle/glow, 1 marine snow, 2 bubbles
const W_PT = W_G + /*wgsl*/`
override PK:u32=0u;
struct PI{@location(0)a:vec4f,@location(1)b:vec4f}
struct PO{@builtin(position)cp:vec4f,@location(0)uv:vec2f,@location(1)c:vec4f}
@vertex fn vp(@builtin(vertex_index)vi:u32,i:PI)->PO{
 let q=vec2f(f32(vi&1u),f32((vi>>1u)&1u))*2.-1.;
 let t=g.cam.w;var p=i.a.xyz;var sz=abs(i.a.w);var col=i.b.rgb;var al=1.;var fl=1.;
 if(PK==0u){
  let ph=i.b.w*6.2832;
  if(i.a.w>0.){
   p+=vec3f(sin(t*.31+ph*3.),sin(t*.23+ph*5.)*.6,cos(t*.27+ph*7.))*.5;
   p+=vec3f(.75,0.,.3)*.011*pow(max(p.y+46.,0.),1.35)*(1.+.5*sin(t*.55+dot(p.xz,vec2f(.045,.037))));
   al=.1+.9*pow(.5+.5*sin(t*(1.1+i.b.w*2.6)+ph*11.),3.);
  }else{al=.75+.25*sin(t*1.3+ph);fl=0.;}
 }else if(PK==1u){
  let L=44.;
  p+=vec3f(.3,-.05,.17)*t+vec3f(sin(t*.2+i.b.w*40.),cos(t*.17+i.b.w*31.),sin(t*.13+i.b.w*17.))*.5;
  var r=p-g.cam.xyz;r=(fract(r/L+.5)-.5)*L;p=g.cam.xyz+r;
  let d=length(r);al=(1.-smoothstep(L*.36,L*.5,d))*smoothstep(.4,2.,d);
  col*=exp(min(p.y,0.)*.022);
  if(p.y>-.3){al=0.;}
 }else{
  let H=-i.a.y-1.5;
  let h=fract(i.b.w+t*2.6*(.7+.6*i.b.z)/H)*H;
  p.y+=h;
  let sp=.2+h*.04;
  p.x+=i.b.x*sp+sin(t*2.3+i.b.w*50.+h*.5)*.12;p.z+=i.b.y*sp+cos(t*1.9+i.b.w*37.+h*.4)*.12;
  sz*=1.+h/H*1.3;
  al=smoothstep(0.,2.,h)*(1.-smoothstep(H-3.,H,h));
  col=vec3f(.55,.85,1.)*1.6*exp(p.y*.012);
 }
 let dist=distance(p,g.cam.xyz);
 let mn=dist*g.cu.w*2.*g.res.w*select(1.3,3.,PK==0u&&fl>.5);
 let s2=max(sz,mn);al*=(sz/s2)*(sz/s2);
 al*=exp(-.034*dist*g.sunA.w);
 let wp=p+(g.cr.xyz*q.x+g.cu.xyz*q.y)*s2;
 var o:PO;o.cp=g.vp*vec4f(wp,1.);o.uv=q;o.c=vec4f(col*al,fl);
 if(PK==2u){o.c.a=al;}
 return o;
}
@fragment fn fp(i:PO)->@location(0)vec4f{
 let r2=dot(i.uv,i.uv);if(r2>1.){discard;}
 let f=1.-r2;
 if(PK==2u){
  let r=sqrt(r2);let rim=smoothstep(.5,.93,r)*(1.-smoothstep(.93,1.,r));
  let q=i.uv-vec2f(-.35,.4);let hl=exp(-dot(q,q)*20.);
  return vec4f(i.c.rgb*(rim*.7+hl*1.8+.04),(rim*.4+hl*.8+.03)*i.c.a);
 }
 if(PK==1u){return vec4f(i.c.rgb*f*f,0.);}
 let ax=abs(i.uv);
 let cr=exp(-ax.x*22.-ax.y*3.)+exp(-ax.y*22.-ax.x*3.);
 let s=mix(f*f,exp(-r2*16.)*1.6+cr*.5,i.c.a)*f;
 return vec4f(i.c.rgb*s,0.);
}`;

// baked tileable textures + per-frame caustics
const W_GEN = W_N + W_G + W_FS + /*wgsl*/`
override GK:u32=0u;
fn wr(i:vec2f,p:f32)->vec2f{return i-p*floor(i/p);}
fn gd(i:vec2f,f:vec2f,per:f32)->f32{let a=6.2832*h21(wr(i,per)+.5);return dot(vec2f(cos(a),sin(a)),f);}
fn nt(p:vec2f,per:f32)->f32{let i=floor(p);let f=fract(p);let u=f*f*f*(f*(f*6.-15.)+10.);
 return .5+.72*mix(mix(gd(i,f,per),gd(i+vec2f(1.,0.),f-vec2f(1.,0.),per),u.x),mix(gd(i+vec2f(0.,1.),f-vec2f(0.,1.),per),gd(i+vec2f(1.,1.),f-vec2f(1.,1.),per),u.x),u.y);}
fn ft(p:vec2f,per:f32)->f32{var a=.5;var s=0.;var q=p;var pr=per;for(var i=0;i<6;i++){s+=a*nt(q,pr);q*=2.;pr*=2.;a*=.5;}return s/.984;}
fn rt(p:vec2f,per:f32)->f32{var a=.5;var s=0.;var q=p;var pr=per;for(var i=0;i<6;i++){s+=a*(1.-abs(2.*nt(q,pr)-1.));q*=2.;pr*=2.;a*=.5;}return s/.984;}
fn wo(p:vec2f,per:f32)->vec2f{let i=floor(p);let f=fract(p);var d=vec2f(9.);
 for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){let c=vec2f(f32(x),f32(y));let r=c+h22(wr(i+c,per))-f;let dd=dot(r,r);
  if(dd<d.x){d.y=d.x;d.x=dd;}else if(dd<d.y){d.y=dd;}}}
 return sqrt(d);}
fn hgt(u:vec2f)->f32{return .5*rt(u*4.,4.)+.3*rt(u*11.+3.3,11.)+.2*rt(u*37.+1.7,37.)+.1*ft(u*90.,90.);}
fn cau(uv:vec2f,t:f32)->f32{
 let p=fract(uv)*6.28318-250.;var i=p;var c=1.;
 for(var n=0;n<5;n++){let tt=t*(1.-3.5/f32(n+1));
  i=p+vec2f(cos(tt-i.x)+sin(tt+i.y),sin(tt-i.y)+cos(tt+i.x));
  c+=1./length(vec2f(p.x/(sin(i.x+tt)/.005),p.y/(cos(i.y+tt)/.005)));}
 c=1.17-pow(c/5.,1.4);return pow(abs(c),8.);
}
@fragment fn fg(i:FS)->@location(0)vec4f{
 if(GK==0u){
  let e=1./1024.;let h=hgt(i.uv);
  let dx=hgt(i.uv+vec2f(e,0.))-hgt(i.uv-vec2f(e,0.));let dy=hgt(i.uv+vec2f(0.,e))-hgt(i.uv-vec2f(0.,e));
  return vec4f(normalize(vec3f(-dx,-dy,.03))*.5+.5,h);
 }
 if(GK==1u){
  let w=wo(i.uv*8.,8.);
  return vec4f(ft(i.uv*5.,5.),clamp((w.y-w.x)*1.4,0.,1.),clamp(w.x,0.,1.),ft(i.uv*4.+7.3,4.));
 }
 let t=g.cam.w*.42+11.;
 return vec4f(min(cau(i.uv,t),3.)*.8+min(cau(i.uv.yx*2.+.31,t*1.13+5.),3.)*.35,0.,0.,1.);
}`;

// volumetric god rays (half res)
const W_RAY = W_G + W_L + W_FS + /*wgsl*/`
@group(1)@binding(0)var dm:texture_depth_multisampled_2d;
@fragment fn fr(i:FS)->@location(0)vec4f{
 let z=textureLoad(dm,vec2i(i.p.xy)*2,0);
 let dir=vdir(i.uv);
 let zl=g.cf.w/max(z,1e-6);
 let tm=min(zl/dot(dir,g.cf.xyz),130.);
 let j=fract(52.9829189*fract(dot(i.p.xy,vec2f(.06711056,.00583715))));
 var acc=vec3f(0.);
 const N=30.;
 for(var k=0.;k<N;k+=1.){
  let u=(k+j)/N;let t=tm*u*u;let dt=tm*2.*u/N;
  let p=g.cam.xyz+dir*t;
  if(p.y>-.05){continue;}
  let q=g.svp*vec4f(p,1.);
  let sh=cheb(textureLoad(st,clamp(vec2i((q.xy*vec2f(.5,-.5)+.5)*${SHR / 2}.),vec2i(0),vec2i(${SHR / 2 - 1})),0).xy,q.z);
  let dp=-p.y/g.sun.y;
  let su=p.xz+g.sun.xz*dp;
  let c1=textureSampleLevel(ct,ls,su/83.+.11,2.5).r;
  let c2=textureSampleLevel(ct,ls,su.yx/31.,1.5).r;
  let sf=smoothstep(.12,.7,c1)*(.25+3.*c2)+.03;
  acc+=exp(-KD*dp-SIG*t*g.sunA.w)*(sh*sf*dt*smoothstep(1.,20.,t));
 }
 let cs=dot(dir,g.sun.xyz);
 let ph=.3+.5*(1.-.36)/pow(1.36-1.2*cs,1.5);
 let rr=acc*SUNC*vec3f(.014,.03,.034)*ph*g.sun.w;
 return vec4f(rr/(1.+1.6*dot(rr,vec3f(.25,.5,.25))),zl);
}`;

const W_POST = W_G + W_FS + /*wgsl*/`
@group(1)@binding(0)var s0:texture_2d<f32>;
@group(1)@binding(1)var sm:sampler;
override BD:u32=0u;
@fragment fn blur(i:FS)->@location(0)vec4f{
 let ts=1./vec2f(textureDimensions(s0));
 let d=select(vec2f(ts.x,0.),vec2f(0.,ts.y),BD==1u);
 let c0=textureSampleLevel(s0,sm,i.uv,0.);
 var a=c0.rgb*.2;var ws=.2;
 for(var k=1;k<=4;k++){
  let o=d*f32(k)*1.4;let wg=.2*exp(-f32(k*k)*.16);
  let ca=textureSampleLevel(s0,sm,i.uv+o,0.);let cb=textureSampleLevel(s0,sm,i.uv-o,0.);
  let wa=wg/(1.+abs(ca.a-c0.a)*8./c0.a);let wb=wg/(1.+abs(cb.a-c0.a)*8./c0.a);
  a+=ca.rgb*wa+cb.rgb*wb;ws+=wa+wb;
 }
 return vec4f(a/ws,c0.a);
}
fn kw(c:vec3f)->f32{return 1./(1.+dot(c,vec3f(.3,.5,.2)));}
@fragment fn down(i:FS)->@location(0)vec4f{
 let o=1./vec2f(textureDimensions(s0));
 let a=textureSampleLevel(s0,sm,i.uv+vec2f(-o.x,-o.y),0.).rgb;let b=textureSampleLevel(s0,sm,i.uv+vec2f(o.x,-o.y),0.).rgb;
 let c=textureSampleLevel(s0,sm,i.uv+vec2f(-o.x,o.y),0.).rgb;let d=textureSampleLevel(s0,sm,i.uv+o,0.).rgb;
 let wa=kw(a);let wb=kw(b);let wc=kw(c);let wd=kw(d);
 return vec4f((a*wa+b*wb+c*wc+d*wd)/(wa+wb+wc+wd),1.);
}
@fragment fn up(i:FS)->@location(0)vec4f{
 let o=.75/vec2f(textureDimensions(s0));
 return vec4f((textureSampleLevel(s0,sm,i.uv+vec2f(-o.x,-o.y),0.).rgb+textureSampleLevel(s0,sm,i.uv+vec2f(o.x,-o.y),0.).rgb
  +textureSampleLevel(s0,sm,i.uv+vec2f(-o.x,o.y),0.).rgb+textureSampleLevel(s0,sm,i.uv+o,0.).rgb)*.25,1.);
}
@fragment fn blit(i:FS)->@location(0)vec4f{return textureSampleLevel(s0,sm,i.uv,0.);}
`;

const W_FIN = W_N + W_G + W_FS + /*wgsl*/`
@group(1)@binding(0)var s0:texture_2d<f32>;
@group(1)@binding(1)var s1:texture_2d<f32>;
@group(1)@binding(2)var s2:texture_2d<f32>;
@group(1)@binding(3)var sm:sampler;
fn tm(x:vec3f)->vec3f{return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),vec3f(0.),vec3f(1.));}
@fragment fn ff(i:FS)->@location(0)vec4f{
 var c=textureSampleLevel(s0,sm,i.uv,0.).rgb+textureSampleLevel(s1,sm,i.uv,0.).rgb;
 let b=textureSampleLevel(s2,sm,i.uv,0.).rgb*.2;
 c=mix(c,b,.16)+b*.05;
 c*=g.res.z;
 let q=i.uv-.5;
 c*=1.-.42*pow(dot(q,q)*2.,1.4);
 c=tm(c);
 let l=dot(c,vec3f(.3,.55,.15));
 c=mix(vec3f(l),c,1.12);
 c=pow(max(c,vec3f(0.)),vec3f(1./2.2));
 c+=(h21(i.p.xy)+h21(i.p.xy+71.7)-1.)/255.;
 return vec4f(c,1.);
}`;

// variance shadow map: depth -> (z, z^2) at half res, then separable blur. Wide soft shadows for 4 texel loads.
const W_VQ = /*wgsl*/`@vertex fn vq(@builtin(vertex_index)i:u32)->@builtin(position)vec4f{return vec4f(f32((i<<1u)&2u)*2.-1.,f32(i&2u)*2.-1.,0.,1.);}`;
const W_VM = W_VQ + /*wgsl*/`
@group(0)@binding(0)var dt:texture_depth_2d;
@fragment fn fm(@builtin(position)p:vec4f)->@location(0)vec4f{
 let c=vec2i(p.xy)*2;var m=vec2f(0.);
 for(var y=0;y<2;y++){for(var x=0;x<2;x++){let z=textureLoad(dt,c+vec2i(x,y),0);m+=vec2f(z,z*z);}}
 return vec4f(m*.25,0.,1.);
}`;
const W_VB = W_VQ + /*wgsl*/`
@group(0)@binding(0)var mt:texture_2d<f32>;
override BD:u32=0u;
@fragment fn fb(@builtin(position)p:vec4f)->@location(0)vec4f{
 let c=vec2i(p.xy);let d=select(vec2i(1,0),vec2i(0,1),BD==1u);let mx=vec2i(${SHR / 2 - 1});
 var m=textureLoad(mt,c,0).xy*.2;var ws=.2;
 for(var k=1;k<=4;k++){let w=.2*exp(-f32(k*k)*.11);
  m+=(textureLoad(mt,clamp(c+d*k,vec2i(0),mx),0).xy+textureLoad(mt,clamp(c-d*k,vec2i(0),mx),0).xy)*w;ws+=2.*w;}
 return vec4f(m/ws,0.,1.);
}`;
