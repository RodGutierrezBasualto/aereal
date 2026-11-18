// ---------- WGSL (the build strips whitespace/comments inside w`...` literals)
const w = String.raw, LODS = 17, KMIN = .07, NLEAF = 176, SHK = .4;
const UD = w`
struct U_{vp:mat4x4f,sh:array<mat4x4f,3>,cam:vec4f,sun:vec4f,res:vec4f,split:vec4f,cr:vec4f,cu:vec4f,cf:vec4f,misc:vec4f,tex:vec4f}
struct ST_{isl:array<vec4f,24>,th:array<vec4f,4>}
@group(0)@binding(0)var<uniform>U:U_;
@group(0)@binding(2)var<uniform>ST:ST_;
const SUNC=vec3f(1.,.68,.36)*5.6;
const RV=1500.;
const SWAY=6.;
const CLH=1900.;
const FB=.00040;
const FH=.00055;
fn fI(k:f32,t:f32)->f32{let x=max(k*t,-12.);if(abs(x)<1e-3){return t;}return t*(1.-exp(-x))/x;}
fn fogD(y:f32)->f32{return(FB*exp(-y/2600.)+FH*exp(-(y+640.)/260.))*U.misc.y;}
fn fogTau(o:vec3f,d:vec3f,t:f32)->f32{return(FB*exp(-o.y/2600.)*fI(d.y/2600.,t)+FH*exp(-(o.y+640.)/260.)*fI(d.y/260.,t))*U.misc.y;}
fn sunPh(c:f32)->f32{let m=max(c,0.);return .028+.2*pow(m,3.)+.13*pow(m,24.);}
fn fogC(t:f32)->vec3f{return mix(vec3f(1.,.58,.16)*.78,vec3f(.03,.04,.2),1.-exp(-t/1150.));}
fn fogP(wp:vec3f)->vec4f{
 let o=U.cam.xyz;let v=wp-o;let t=length(v);let d=v/t;
 let T=exp(-fogTau(o,d,t));let Tv=exp(-fogTau(o,d,min(t,RV)));let m=max(dot(d,U.sun.xyz),0.);
 return vec4f(fogC(t)*(1.-T)+vec3f(1.,.45,.22)*(pow(m,5.)*.9+pow(m,40.)*1.6)*(Tv-T),T);}
fn fog(c:vec3f,wp:vec3f)->vec3f{let f=fogP(wp);return c*f.a+f.rgb;}
fn wind(p:vec3f,t:f32)->vec3f{
 let a=sin(dot(p.xz,vec2f(.011,.007))+t*.6);let b=sin(dot(p.xz,vec2f(-.006,.013))+t*.97+p.y*.01);let c=sin(t*.23+p.x*.003);
 return vec3f(.8*a+.3*b+.5*c,.2*b,.5*a-.5*b+.3*c);}
`;
const GD = w`
struct Gr{p:vec4f,d:vec4f,s:vec4f}
@group(0)@binding(1)var<uniform>GR:array<Gr,256>;
fn gA(i:u32)->f32{let g=GR[i];return g.p.w*sin(U.cam.w*g.s.y*.05+g.d.w)+g.s.x*U.cam.w;}
fn gT(p:vec3f,i:u32)->vec3f{
 let g=GR[i];let t=U.cam.w*g.s.y;let a=gA(i);let c=cos(a);let s=sin(a);let q=p-g.p.xyz;
 return g.p.xyz+vec3f(c*q.x+s*q.z,q.y,c*q.z-s*q.x)+g.d.xyz*vec3f(sin(t*.031+g.d.w),sin(t*.07+g.d.w*2.3),cos(t*.027+g.d.w*1.3));}
`;
// cloud shadow + high cloud coverage (needs N2,SR)
const CS = w`
fn cloudCov(q:vec2f)->f32{
 let t=U.cam.w;let a=textureSampleLevel(N2,SR,q*.00011+vec2f(t*.0019,t*.0006),0.).r;let b=textureSampleLevel(N2,SR,q*.00037+vec2f(t*.0034,-t*.0011),0.).r;
 return smoothstep(.47,.68,a*.72+b*.28);}
fn cloudCovD(q:vec2f)->f32{
 let t=U.cam.w;let a=textureSampleLevel(N2,SR,q*.00011+vec2f(t*.0019,t*.0006),0.).r;let b=textureSampleLevel(N2,SR,q*.00037+vec2f(t*.0034,-t*.0011),0.).r;let c=textureSampleLevel(N2,SR,q*.0013+vec2f(t*.0052,t*.0017),0.).r;let d=textureSampleLevel(N2,SR,q*.0041+vec2f(t*.006,-t*.004),0.).r;
 return smoothstep(.44,.68,a*.66+b*.24+c*.13+d*.03-.03);}
fn cloudSh(wp:vec3f)->f32{return 1.-.8*cloudCov(wp.xz+U.sun.xz*((CLH-wp.y)/U.sun.y));}
`;
const TX = w`
@group(1)@binding(0)var N2:texture_2d<f32>;
@group(1)@binding(1)var N3:texture_3d<f32>;
@group(1)@binding(2)var SR:sampler;
@group(1)@binding(3)var SM:texture_depth_2d_array;
@group(1)@binding(4)var SC:sampler_comparison;
@group(1)@binding(5)var CT:texture_2d<f32>;
@group(1)@binding(6)var CD:texture_2d<f32>;
@group(1)@binding(7)var SL:sampler;
`;
const SH = w`
fn shC(wp:vec3f,ci:i32,tw:f32)->f32{
 let p=U.sh[ci]*vec4f(wp,1.);let uv=p.xy*vec2f(.5,-.5)+.5;let z=p.z-(.35+tw*1.6)/6000.;var s=0.;
 for(var j=-1;j<2;j++){for(var i=-1;i<2;i++){s+=textureSampleCompareLevel(SM,SC,uv+vec2f(f32(i),f32(j))/2048.,ci,z);}}
 return s/9.;}
fn shV(wp:vec3f,vd:f32)->f32{
 var ci=0;if(vd>U.split.x){ci=1;}if(vd>U.split.y){ci=2;}if(vd>U.split.z){return 1.;}
 let p=U.sh[ci]*vec4f(wp,1.);return textureSampleCompareLevel(SM,SC,p.xy*vec2f(.5,-.5)+.5,ci,p.z-(.35+U.tex[ci]*1.3)/6000.);}
fn shadow(wp:vec3f,n:vec3f,vd:f32)->f32{
 var ci=0;if(vd>U.split.x){ci=1;}if(vd>U.split.y){ci=2;}
 let tw=U.tex[ci];var s=shC(wp+n*tw*1.5,ci,tw);
 let e=U.split[ci];let f=saturate((vd-e*.86)/(e*.14));
 if(f>0.){if(ci<2){let t2=U.tex[ci+1];s=mix(s,shC(wp+n*t2*1.5,ci+1,t2),f);}else{s=mix(s,1.,f);}}
 return s;}
`;
const LT = w`
fn cloudOcc(c:vec3f,fc:vec2f,t:f32)->vec3f{
 let uv=fc*U.res.zw;let cl=textureSampleLevel(CT,SL,uv,0.);if(cl.a<.003){return c;}
 let cd=textureSampleLevel(CD,SL,uv,0.).r/cl.a;return mix(c,cl.rgb/cl.a,cl.a*smoothstep(0.,40.+cd*.05,t-cd));}
fn amb(n:vec3f)->vec3f{return mix(vec3f(.62,.48,.5)*.85,vec3f(.18,.24,.58),n.y*.5+.5)+vec3f(.6,.32,.1)*.3*saturate(dot(n.xz,normalize(U.sun.xz))*.5+.5);}
fn fin(c:vec3f,wp:vec3f,fc:vec2f)->vec4f{return vec4f(cloudOcc(fog(c,wp),fc,length(wp-U.cam.xyz)),1.);}
`;
const MAIN = UD + GD + TX + CS + SH + LT;
// ---- solids
const SOLV = w`
struct SI{@location(0)p:vec3f,@location(1)n:vec4f,@location(2)a:vec4u}
fn sPos(v:SI)->vec3f{
 var p=v.p+wind(v.p,U.cam.w)*(max(v.n.w,0.)*SWAY);
 if(v.a.x==2u||v.a.x==4u||v.a.x==5u){p+=v.n.xyz*max(0.,length(p-U.cam.xyz)*U.misc.z*.6-f32(v.a.w)/20.);}
 return gT(p,v.a.z);}
`;
const SOL = MAIN + SOLV + w`
struct SO{@builtin(position)pos:vec4f,@location(0)wp:vec3f,@location(1)n:vec3f,@location(2)lp:vec3f,@location(3)@interpolate(flat)m:u32,@location(4)@interpolate(flat)rt:vec2f,@location(5)ae:vec2f}
@vertex fn vs(v:SI)->SO{
 var o:SO;o.wp=sPos(v);o.pos=U.vp*vec4f(o.wp,1.);o.n=v.n.xyz;o.lp=v.p;o.m=v.a.x;let a=gA(v.a.z);o.rt=vec2f(cos(a),sin(a));o.ae=vec2f(f32(v.a.y),f32(v.a.w))/255.;return o;}
var<private> gW:f32;
fn triN(p:vec3f,n:vec3f)->vec4f{
 let w=pow(abs(n),vec3f(4.));let b=w/(w.x+w.y+w.z);
 let x=textureSample(N2,SR,p.zy+p.yz*vec2f(.31,-.31));let y=textureSample(N2,SR,p.xz+p.zx*vec2f(.37,-.37));let z=textureSample(N2,SR,p.xy+p.yx*vec2f(.29,-.29));gW=x.a*b.x+y.a*b.y+z.a*b.z;
 return vec4f(vec3f(0.,x.b-.5,x.g-.5)*b.x+vec3f(y.g-.5,0.,y.b-.5)*b.y+vec3f(z.g-.5,z.b-.5,0.)*b.z,x.r*b.x+y.r*b.y+z.r*b.z);}
@fragment fn fs(i:SO,@builtin(front_facing)ff:bool)->@location(0)vec4f{
 var n0=normalize(i.n);if(!ff){n0=-n0;}
 let m=i.m;let p=i.lp;let e=i.ae.y;
 let B=triN(p*.031,n0);let wB=gW;let A=triN((p+(B.w-.5)*46.)*.0043,n0);let wA=gW;let C=triN(p*.27,n0);
 let D=triN(p*.092,n0);let wD=gW;let nk=saturate(1.-length(i.wp-U.cam.xyz)/170.);
 let h=A.w*.28+B.w*.42+C.w*.22+.04;
 var g=A.xyz*1.3+B.xyz*1.7+D.xyz*1.5+C.xyz*(.5+1.4*nk);
 var alb:vec3f;var spc=0.;let up=n0.y;let cv=saturate(e*2.3);
 let s=triN(p*vec3f(.3,.014,.3)+B.w*.6,n0);
 let ph=p.x*.0041+p.z*.0029;
 let st=.5+.22*sin(p.y*.019+ph+A.w*1.5)+.16*sin(p.y*.047+ph*1.7+A.w*2.5)+.1*sin(p.y*.11+A.w*3.);
 let u1=p.y*.021+.9*sin(p.y*.0047+ph)+A.w*.25+ph;let fw=fwidth(u1)+.003;let fv=textureSample(N2,SR,p.xz*.0031).r;let sk=textureSample(N2,SR,vec2f(p.z*.017+p.x*.017,p.y*.0022)).r;
 let moss=mix(vec3f(.03,.16,.065),vec3f(.085,.27,.09),C.w);
 if(m<2u||m==3u){
  alb=mix(vec3f(.10,.085,.11),vec3f(.50,.37,.27),saturate(h*1.9-.6+(st-.5)*1.2));
  alb=mix(alb,vec3f(.66,.42,.25),smoothstep(.56,.68,st)*.6)*mix(.8+.4*C.w,.55+.9*C.w,nk)*(.72+.56*D.w)*mix(.84,1.08,smoothstep(.3,.7,A.w));
  let sl=abs(fract(u1)-.5);let sm=smoothstep(.8,.4,up);let lw=.015+.05*fract(floor(u1+.5)*.371);
  let crk=max((1.-smoothstep(.015,.06,wA))*.5*smoothstep(.47,.6,A.w),(1.-smoothstep(.03,.12,wB))*.32*smoothstep(.55,.75,fract(u1*.37)))*smoothstep(.9,.5,up);
  alb*=(1.-.22*(1.-smoothstep(lw-fw,lw+fw,sl))*sm)*(1.-crk)*mix(.9,1.06,smoothstep(.1,.5,wA))*(1.-.38*(1.-smoothstep(.02,.09,wD))*smoothstep(.45,.6,B.w));
  g+=vec3f(0.,(smoothstep(lw,lw+.06,sl)-.5)*(1.-smoothstep(lw+.06,lw+.14,sl))*1.4,0.)*sm;
  let gs=smoothstep(.6,.8,up+(B.w-.5)*.5);
  var mead=mix(vec3f(.36,.18,.03),vec3f(.74,.48,.10),saturate(B.w*.8+C.w*.7-.25))*mix(.7,1.1,A.w);
  mead=mix(mead,vec3f(.55,.20,.04),smoothstep(.55,.64,fv)*.75);mead=mix(mead,vec3f(.70,.60,.32),smoothstep(.45,.36,fv)*.6);
  mead+=vec3f(.8,.5,.12)*(smoothstep(.7,.78,C.w)*.45);mead=mix(mead,alb*1.1,smoothstep(.6,.68,A.w*.45+B.w*.55)*.7);
  let fl=mix(mix(vec3f(.05,.17,.05),moss,B.w),vec3f(.5,.3,.06),smoothstep(.5,.62,D.w)*.6);
  alb=mix(alb,mix(fl,mead,saturate(e*2.-1.)),gs*saturate(e*2.));
  alb=mix(alb,moss,gs*(1.-saturate(e*2.))*.75*smoothstep(.42,.6,A.w));
 }
 if(m==3u){
  var ca=vec3f(.60,.50,.40)*(.66+.55*h);
  ca=mix(ca,moss,smoothstep(.45,.9,up)*.55*smoothstep(.5,.62,A.w*.5+B.w*.5));
  alb=mix(alb,ca*mix(1.,.5,smoothstep(.5,.72,sk)*.75),cv*.8);
  let gd=smoothstep(.75,.9,e);
  let mw=smoothstep(.5,.56,e)*(1.-gd);let sd=step(abs(up),.5);
  let bu=mix((p.x-p.z)*.176,p.y*.33,sd);let bv=(p.x+p.z)*.14+floor(bu)*.5;
  let jl=min(abs(fract(bu)-.5),abs(fract(bv)-.5));let hb=fract(sin(floor(bu)*12.99+floor(bv)*78.23)*43758.5);
  alb*=1.-mw*(.5*smoothstep(.44,.49,jl)+.22*(hb-.5));
  alb=mix(alb,vec3f(1.,.6,.14),gd);spc=gd*6.;g*=1.-.5*cv-gd*.3;
 }else if(m==2u){
  let rg=1.-abs(2.*s.w-1.);g=g*.8+s.xyz*vec3f(3.,.3,3.);
  alb=mix(vec3f(.05,.035,.03),vec3f(.34,.235,.15),smoothstep(.35,.95,rg))*(.7+.6*C.w)*mix(.75,1.1,A.w);
  alb=mix(alb,moss,smoothstep(.3,.8,up)*smoothstep(.42,.58,B.w)*.85);
  alb=mix(alb,vec3f(.75,.5,.12),smoothstep(.66,.74,A.w*.5+B.w*.5)*.35);
 }else if(m==4u){alb=mix(vec3f(.10,.065,.045),vec3f(.33,.22,.13),B.w)*(.7+.6*C.w);
 }else if(m==5u){let vd=smoothstep(.55,.7,B.w);alb=mix(vec3f(.72,.42,.11),vec3f(.10,.36,.30),vd);spc=2.5*(1.-vd);
 }else if(m==6u){alb=vec3f(.60,.52,.38)*(.55+.7*B.w);}
 let nl=normalize(n0-(g-n0*dot(g,n0))*2.4);
 let n=vec3f(i.rt.x*nl.x+i.rt.y*nl.z,nl.y,i.rt.x*nl.z-i.rt.y*nl.x);
 let ng=vec3f(i.rt.x*n0.x+i.rt.y*n0.z,n0.y,i.rt.x*n0.z-i.rt.y*n0.x);
 let L=U.sun.xyz;let V=normalize(U.cam.xyz-i.wp);let vd=dot(i.wp-U.cam.xyz,U.cf.xyz);
 let sh=shadow(i.wp,ng,vd)*cloudSh(i.wp)*smoothstep(-.1,.15,dot(ng,L));
 let ndl=saturate(dot(n,L));
 var c=alb*(SUNC*ndl*sh+amb(n)*i.ae.x);
 c+=SUNC*sh*spc*alb*pow(saturate(dot(n,normalize(L+V))),48.);
 if(m==6u){c+=alb*SUNC*sh*.4*saturate(-dot(n,L));}
 return fin(c,i.wp,i.pos.xy);}
`;
// ---- leaf clusters: sprig cards (procedural compound leaves, alpha-to-coverage), lit per card in the vertex stage
const LEAFV = w`
struct LI{@builtin(vertex_index)vi:u32,@location(0)a0:vec4f,@location(1)a1:vec4f,@location(2)i0:vec4f,@location(3)i1:vec4f}
struct LV{wp:vec3f,lc:vec3f,C:vec3f,keep:f32,px:f32,dist:f32}
fn leaf(v:LI,km:f32)->LV{
 let t=U.cam.w;let R=v.i0.w;let rnd=abs(v.a1.w);
 let C=gT(v.i0.xyz+wind(v.i0.xyz,t)*(v.i1.w*SWAY),u32(v.i1.z));
 let dist=length(C-U.cam.xyz);let keep=clamp(${LODS}.*R/dist,${KMIN},1.)*km;
 let sc=saturate((keep-v.a0.w)*10.)*min(inverseSqrt(keep),3.2)*select(1.,smoothstep(1100.,800.,dist),v.i1.x<0.);
 let f=sin(t*(1.3+rnd*1.7)+rnd*40.+v.i1.y*44.)*.14;
 let ph=v.i1.y*6.283;let cs=cos(ph);let sn=sin(ph);
 var o:LV;
 o.lc=vec3f(cs*v.a1.x+sn*v.a1.z,v.a1.y,cs*v.a1.z-sn*v.a1.x);
 var ofs=vec3f(cs*v.a0.x+sn*v.a0.z,v.a0.y,cs*v.a0.z-sn*v.a0.x);
 ofs+=cross(normalize(o.lc+vec3f(.01,.02,.03)),ofs)*f;
 o.C=C+o.lc*(R*(1.+.025*sin(t*.8+ph*5.+o.lc.y*4.)));
 o.wp=o.C+ofs*(sc*R);o.keep=keep;o.dist=dist;o.px=R*.33*sc/(dist*U.misc.z);
 return o;}
`;
const LEAF = MAIN + LEAFV + w`
struct LO{@builtin(position)pos:vec4f,@location(0)uv:vec2f,@location(1)@interpolate(flat)lit:vec3f,@location(2)@interpolate(flat)fg:vec4f,@location(3)@interpolate(flat)cl:vec4f,@location(4)@interpolate(flat)k:vec4f,@location(5)@interpolate(flat)al:vec3f}
@vertex fn vs(v:LI)->LO{
 let l=leaf(v,1.);var o:LO;o.pos=U.vp*vec4f(l.wp,1.);let t=U.cam.w;
 o.uv=vec2f(f32(((v.vi+1u)>>1u)&1u),f32((v.vi>>1u)&1u));
 let wc=l.C;let L=U.sun.xyz;let V=normalize(U.cam.xyz-wc);let vd=dot(wc-U.cam.xyz,U.cf.xyz);
 let inner=v.a1.w<0.;let rnd=abs(v.a1.w);let ph=v.i1.y;let R=v.i0.w;
 let fe=v.i1.x<0.;let ns=normalize(select(l.lc*vec3f(1.,1.5,1.)+vec3f(0.,.001,0.),l.lc*vec3f(1.,.2,1.)+vec3f(0.,.7,0.),fe));
 let cs=cloudSh(wc);let s0=shV(wc+ns*(1.5+U.tex.x*2.),vd);let sh=mix(s0,max(s0,.62),smoothstep(.75,.2,l.keep))*cs;
 let bl=pow(saturate(dot(-V,L)),2.);
 let far=smoothstep(.55,.15,l.keep);let ao=select(mix(select(mix(.5,1.,smoothstep(.5,1.,length(v.a1.xyz))),.42,inner),1.,far),1.3,v.i1.x<0.);
 o.lit=SUNC*.66*(sh*(saturate(dot(ns,L)*.6+.4)+bl*.45)+bl*.12*cs)+amb(ns)*ao;
 let r=fract(rnd*5.+ph);let hu=fract(v.i1.x*7.);
 o.al=mix(mix(vec3f(.0,.12,.06),vec3f(.045,.33,.13),r)*mix(vec3f(.85,1.,1.),vec3f(1.35,1.,.55),hu),mix(vec3f(.42,.12,.012),vec3f(.70,.43,.07),r*.6+hu*.4),smoothstep(.45,.6,v.i1.x))*select(1.,.8,inner)*(1.+.3*far*smoothstep(.45,.6,v.i1.x));
 if(fe){o.al=mix(vec3f(.008,.14,.10),vec3f(.07,.50,.30),r);}
 o.fg=fogP(wc);
 o.cl=vec4f(0.);
 if(wc.y<-150.||dot(wc.xz,wc.xz)>6.2e6||U.cam.y<-350.||dot(U.cam.xz,U.cam.xz)>6.2e6){
  let pc=U.vp*vec4f(wc,1.);let su=pc.xy/pc.w*vec2f(.5,-.5)+.5;let cl=textureSampleLevel(CT,SL,su,0.);
  let cd=textureSampleLevel(CD,SL,su,0.).r/max(cl.a,1e-3);
  o.cl=vec4f(cl.rgb/max(cl.a,1e-3),cl.a*smoothstep(0.,40.+cd*.05,length(wc-U.cam.xyz)-cd));}
 let tw=pow(.5+.5*sin(t*(.6+2.2*fract(rnd*7.3+ph*3.))+rnd*90.+ph*31.),mix(48.,12.,far));
 o.k=vec4f(tw*smoothstep(.5,.7,v.i1.x)*saturate(l.px*.2-.5)*saturate(2.-l.px*.012),select(clamp(floor(R*select(.36,.56,inner)/1.7+.5),2.,6.),6.,fe),rnd,0.);
 return o;}
fn sprig(uv:vec2f,n:f32)->vec4f{
 let p=vec2f(uv.x,abs(uv.y-.5));var b=vec4f(1.,0.,0.,-1.);let cw=.8/n;let c0=floor(p.x/cw);
 for(var k=0.;k<2.;k+=1.){
  let c=c0-k;if(c<0.||c>=n){continue;}
  let d=p-vec2f((c+.12)*cw,0.);let a=d.x*.6+d.y*.8;let q=d.y*.6-d.x*.8;
  let L=min(.56,cw*2.1)*(1.-.22*c/n);let t=a/L;let wd=L*.27*sqrt(saturate(t*(1.-t))*4.)*(1.15-.5*t);let sd=abs(q)-wd;
  if(t>0.&&t<1.&&sd<b.x){b=vec4f(sd,t,q/max(wd,1e-4),c);}
 }
 let t=(uv.x-.76)/.24;let wd=.085*sqrt(saturate(t*(1.-t))*4.);let sd=abs(uv.y-.5)-wd;
 if(t>0.&&t<1.&&sd<b.x){b=vec4f(sd,t,(uv.y-.5)/max(wd,1e-4),n);}
 let ss=p.y-.014;if(uv.x<.8&&ss<b.x){b=vec4f(ss,.4,0.,-1.);}
 return b;}
struct FO{@location(0)c:vec4f,@builtin(sample_mask)m:u32}
@fragment fn fs(i:LO)->FO{
 let s=sprig(i.uv,i.k.y);let aa=max(length(fwidth(i.uv))*.7,1e-4);
 let ov=saturate((aa-.05)*9.);let ec=(i.uv-vec2f(.45,.5))*vec2f(1.85,2.1);let a=max(saturate(.5-s.x/aa),ov*(1.-smoothstep(.6,1.,dot(ec,ec))));
 var c=i.al*i.lit*(mix(.7,1.2,s.y)*(1.-.25*exp(-s.z*s.z*10.)));
 c+=SUNC*i.al*(i.k.x*mix(4.5*(1.-saturate(abs(s.w-floor(i.k.z*(i.k.y+1.)))-.5))*smoothstep(.9,.4,abs(s.z)),1.5,ov));
 c=mix(c*i.fg.a+i.fg.rgb,i.cl.rgb,i.cl.a);
 let n=u32(a*4.+.5);if(n==0u){discard;}
 var r:FO;r.c=vec4f(c,1.);r.m=(1u<<n)-1u;return r;}
`;
// ---- ferns / tufts
const PLANT = MAIN + w`
struct PO{@builtin(position)pos:vec4f,@location(0)wp:vec3f,@location(1)n:vec3f,@location(2)c:vec2f}
@vertex fn vs(@location(0)a0:vec4f,@location(1)a1:vec4f,@location(2)i0:vec4f,@location(3)i1:vec4f)->PO{
 let t=U.cam.w;let kind=floor(i1.w);let sw=fract(i1.w)*2.;
 let C=gT(i0.xyz+wind(i0.xyz,t)*(sw*SWAY),u32(i1.z));
 let dist=length(C-U.cam.xyz);let fd=mix(1100.,1000.,kind);
 let s=i0.w*smoothstep(fd,fd*.7,dist);
 let cs=cos(i1.x);let sn=sin(i1.x);
 var p=vec3f(cs*a0.x+sn*a0.z,a0.y,cs*a0.z-sn*a0.x)*s;
 let wv=wind(C*3.,t*1.7+i1.y*6.);
 p+=vec3f(wv.x,0.,wv.z)*(a0.w*s*mix(.1,.2,kind));
 var o:PO;o.wp=C+p;o.pos=U.vp*vec4f(o.wp,1.);
 o.n=vec3f(cs*a1.x+sn*a1.z,a1.y,cs*a1.z-sn*a1.x);o.c=vec2f(a1.w,kind);return o;}
@fragment fn fs(i:PO)->@location(0)vec4f{
 let L=U.sun.xyz;let V=normalize(U.cam.xyz-i.wp);let vd=dot(i.wp-U.cam.xyz,U.cf.xyz);
 let n=normalize(i.n);let sh=shadow(i.wp,vec3f(0.,1.,0.),vd)*cloudSh(i.wp);
 var alb=mix(vec3f(.008,.13,.085),vec3f(.09,.55,.28),i.c.x);
 if(i.c.y>.5){let pv=textureSampleLevel(N2,SR,i.wp.xz*.0031,0.).r;alb=mix(vec3f(.34,.18,.03),mix(mix(vec3f(.80,.55,.14),vec3f(.62,.24,.05),smoothstep(.55,.64,pv)),vec3f(.78,.68,.38),smoothstep(.45,.36,pv)),saturate(i.c.x));if(i.c.x>1.2){alb=mix(vec3f(1.,.7,.22),vec3f(1.,.45,.2),smoothstep(.55,.64,pv));}}
 let c=alb*(SUNC*sh*(saturate(dot(n,L)*.5+.5)+pow(saturate(dot(-V,L)),2.)*.8)+amb(n)*mix(.55,1.,saturate(i.c.x)));
 return fin(c,i.wp,i.pos.xy);}
`;
// ---- bioluminescent vines (camera-facing ribbons: sinuous, tapered, with glowing bulbs)
const VINE = MAIN + w`
struct VO{@builtin(position)pos:vec4f,@location(0)wp:vec3f,@location(1)uv:vec2f,@location(2)@interpolate(flat)k:vec4f}
fn vpt(p0:vec3f,p1:vec3f,sag:f32,fr:f32,s:f32,ph:f32)->vec3f{
 var p=mix(p0,p1,s);p.y-=sag*4.*s*(1.-s);let len=length(p1-p0);
 let wv=wind(p0*2.+ph*50.,U.cam.w*1.3+ph*6.);let e=mix(sin(3.1416*s),s,fr);
 return p+vec3f(sin(s*7.+ph*30.),0.,cos(s*5.3+ph*17.))*(len*.04*e)+vec3f(wv.x,0.,wv.z)*(mix(sin(3.1416*s),s*s,fr)*len*.08);}
fn bead(s:f32,ph:f32)->f32{return pow(.5+.5*cos(s*.45+ph*30.),16.);}
fn stp(i0:vec4f,i1:vec4f,ph:f32,h:f32)->vec3f{let r=i1.x*(.3+1.1*h);let th=ph*40.+h*i1.z*6.283+U.cam.w*.25;return i0.xyz+vec3f(cos(th)*r,h*i1.y,sin(th)*r);}
@vertex fn vs(@builtin(vertex_index)vi:u32,@location(0)i0:vec4f,@location(1)i1:vec4f,@location(2)i2:vec4f)->VO{
 let s=f32(vi>>1u)/24.;let sd=f32(vi&1u)*2.-1.;let g=u32(i2.y);
 if(i2.z>1.5){
  let u=fract(U.cam.w*.03*(.7+.6*i2.w)+i2.x);let h=u+(s-.5)*.11;let a=stp(i0,i1,i2.x,h);let b=stp(i0,i1,i2.x,h+.004);
  let dist=length(a-U.cam.xyz);let px=dist*U.misc.z;let wd=(1.+1.8*i2.w)*sin(3.1416*s);let ww=max(wd,px*1.5);
  var o:VO;o.wp=a+normalize(cross(b-a,a-U.cam.xyz))*(sd*ww*.5);o.pos=U.vp*vec4f(o.wp,1.);o.uv=vec2f(s,sd);
  o.k=vec4f(px,i2.x,2.,min(wd/ww,1.)*sin(3.1416*s)*smoothstep(0.,.15,u)*smoothstep(1.,.75,u)*smoothstep(3200.,1800.,dist)*smoothstep(8.,40.,dist));return o;}
 let sw=wind(i0.xyz,U.cam.w)*(i0.w*SWAY);let len=length(i1.xyz-i0.xyz)+i1.w;
 let a=gT(vpt(i0.xyz,i1.xyz,i1.w,i2.z,s,i2.x)+sw,g);let b=gT(vpt(i0.xyz,i1.xyz,i1.w,i2.z,s+.02,i2.x)+sw,g);
 let dist=length(a-U.cam.xyz);let px=dist*U.misc.z;
 let wd=(.36+.34*i2.w)*(1.-.7*s*i2.z)*(1.+3.2*bead(s*len,i2.x)*saturate(1.5-px*.6));let ww=max(wd,px*1.7);
 var o:VO;o.wp=a+normalize(cross(b-a,a-U.cam.xyz))*(sd*ww*.5);o.pos=U.vp*vec4f(o.wp,1.);o.uv=vec2f(s*len,sd);
 o.k=vec4f(px,i2.x,i2.w,max(wd/ww,.5)*smoothstep(2600.,1300.,dist)*smoothstep(5.,24.,dist));return o;}
@fragment fn fs(i:VO)->@location(0)vec4f{
 let t=U.cam.w;let s=i.uv.x;
 if(i.k.z>1.5){let w=1.-i.uv.y*i.uv.y;let a=i.k.w*w*w*.2;let c=mix(vec3f(1.,.55,.2),vec3f(1.,.82,.5),w*w)*(1.1*cloudSh(i.wp)+.45);
  return vec4f(cloudOcc(fog(c,i.wp),i.pos.xy,length(i.wp-U.cam.xyz))*a,a);}
 let bd=mix(bead(s,i.k.y),.14,saturate(i.k.x*2.-.2));let pulse=pow(.5+.5*sin(s*.09-t*1.2+i.k.y*40.),4.);
 let gc=mix(vec3f(.04,1.,.7),vec3f(.3,.45,1.),smoothstep(.62,.9,i.k.z));
 let vd=dot(i.wp-U.cam.xyz,U.cf.xyz);let sh=shadow(i.wp,vec3f(0.,1.,0.),vd)*cloudSh(i.wp);
 let cy=sqrt(saturate(1.-i.uv.y*i.uv.y));
 let c=vec3f(.035,.13,.06)*(SUNC*sh*.6+amb(vec3f(0.,1.,0.)))*(.35+.65*cy)+gc*(.3+.3*pulse+bd*(1.5+5.*pulse));
 let a=i.k.w*(1.-smoothstep(.75,1.,abs(i.uv.y)));
 return vec4f(cloudOcc(fog(c,i.wp),i.pos.xy,length(i.wp-U.cam.xyz))*a,a);}
`;
// ---- birds & sky rays (smooth-shaded)
const CREA = MAIN + w`
struct KO{@builtin(position)pos:vec4f,@location(0)wp:vec3f,@location(1)n:vec3f,@location(2)c:vec2f}
fn cpath(c:vec4f,a:f32,ph:f32,va:f32)->vec3f{return c.xyz+vec3f(cos(a)*c.w*(1.+.25*sin(a*2.+ph)),sin(a*1.3+ph)*va,sin(a)*c.w*(1.+.25*cos(a*3.+ph)));}
@vertex fn vs(@location(0)a0:vec4f,@location(1)a1:vec4f,@location(2)i0:vec4f,@location(3)i1:vec4f,@location(4)i2:vec4f)->KO{
 let t=U.cam.w;let sz=i1.w;let a=t*i1.y/i0.w+i1.x;let fp=i0.x*.013+i0.z*.007;
 let p0=cpath(i0,a,fp,i2.w);let f=normalize(cpath(i0,a+.02,fp,i2.w)-p0);
 var r=normalize(cross(f,vec3f(0.,1.,0.)));var u=cross(r,f);r=normalize(r-u*.32);u=cross(r,f);
 var q=a0.xyz;var n=a1.yzw;let wt=a0.w;
 if(i1.z<.5){let gate=smoothstep(-.3,.5,sin(t*.21+i2.z*3.));let an=sin(t*(2.5+fract(i2.z)*.8)+i2.z-wt*1.1)*(.12+.5*gate);q.y+=sin(an)*wt*.9;q.x*=mix(1.,cos(an),wt*.8);n.x-=sign(q.x)*sin(an)*wt*.8;}
 else{let an=t*1.7+i2.z-wt*2.4+q.z*1.5;q.y+=sin(an)*.3*pow(wt,1.4);n.x+=sign(q.x)*cos(an)*.7*wt;let tl=max(-q.z-.45,0.);q.x+=sin(t*1.9+i2.z+q.z*2.5)*.12*tl;q.y+=cos(t*1.5+i2.z+q.z*2.)*.08*tl;}
 var o:KO;o.wp=p0+r*(q.x*sz+i2.x)+u*(q.y*sz+i2.y)+f*(q.z*sz);o.pos=U.vp*vec4f(o.wp,1.);o.n=r*n.x+u*n.y+f*n.z;o.c=vec2f(a1.x,i1.z);return o;}
@fragment fn fs(i:KO,@builtin(front_facing)ff:bool)->@location(0)vec4f{
 let V=normalize(U.cam.xyz-i.wp);var n=normalize(i.n);let top=dot(n,V)>0.;if(!top){n=-n;}
 let L=U.sun.xyz;var alb:vec3f;var em=vec3f(0.);
 if(i.c.y<.5){alb=mix(vec3f(.56,.5,.42),vec3f(.62,.36,.09),smoothstep(.35,.85,i.c.x));alb=mix(alb,vec3f(.13,.085,.06),smoothstep(.95,1.08,i.c.x));if(!top){alb=mix(alb,vec3f(.85,.8,.72),.6);}}
 else{alb=select(mix(vec3f(.16,.25,.3),vec3f(.03,.09,.14),smoothstep(.2,.9,i.c.x)),mix(vec3f(.012,.06,.12),vec3f(.03,.22,.32),i.c.x),top);em=vec3f(.06,1.,.8)*((smoothstep(.72,1.,i.c.x)*1.6+select(.9*smoothstep(.35,.3,i.c.x),0.,top))*(.6+.4*sin(U.cam.w*2.+i.wp.x*.05)));}
 let rim=pow(1.-saturate(dot(n,V)),3.);
 return fin(alb*(SUNC*cloudSh(i.wp)*(saturate(dot(n,L)*.75+.25)+rim*.4*saturate(dot(-V,L)+.3))+amb(n))+em,i.wp,i.pos.xy);}
`;
// ---- pollen + thermal motes
const PART = UD + w`
struct QO{@builtin(position)pos:vec4f,@location(0)uv:vec2f,@location(1)@interpolate(flat)c:vec4f}
@vertex fn vs(@builtin(vertex_index)vi:u32,@location(0)i0:vec4f,@location(1)i1:vec4f)->QO{
 let t=U.cam.w;let cn=vec2f(f32(vi&1u),f32(vi>>1u))*2.-1.;var p:vec3f;var a=1.;var col=vec3f(1.,.5,.1)*1.3;let o=U.cam.xyz;
 if(i1.y<.5){
  let dr=vec3f(t*1.6,sin(t*.13+i1.x*40.)*3.-t*.25,t*.9)+vec3f(sin(t*.31+i1.z*20.),cos(t*.27+i1.w*20.),sin(t*.23+i1.x*9.))*2.5;
  p=o+(fract((i0.xyz+dr-o)/180.+.5)-.5)*180.;let d=length(p-o);
  a=smoothstep(75.,45.,d)*smoothstep(20.,34.,d)*max(0.,.35+.65*sin(t*(1.+i1.z*2.)+i1.w*30.));
 }else{
  let u=fract(t*.018*i1.z+i1.x);let an=i1.x*80.+u*18.+t*.25*i1.z;let rr=i1.w*(.35+u*.8);
  p=vec3f(i0.x+cos(an)*rr,i0.y+u*1500.,i0.z+sin(an)*rr);
  a=smoothstep(0.,.1,u)*smoothstep(1.,.7,u)*smoothstep(1700.,700.,length(p-o))*smoothstep(15.,50.,length(p-o))*(.6+.4*sin(t*3.*i1.z+i1.x*90.));col=mix(vec3f(1.,.5,.12),vec3f(1.,.72,.3),fract(i1.x*13.))*.55;
 }
 let v=p-o;let d=length(v);let sz=max(i0.w,d*U.misc.z*1.4);a*=(i0.w/sz)*(i0.w/sz)*exp(-fogTau(o,v/d,d));
 var q:QO;q.pos=U.vp*vec4f(p+normalize(U.cr.xyz)*(cn.x*sz)+normalize(U.cu.xyz)*(cn.y*sz),1.);q.uv=cn;q.c=vec4f(col*a,0.);return q;}
@fragment fn fs(i:QO)->@location(0)vec4f{return vec4f(i.c.rgb*exp(-dot(i.uv,i.uv)*3.5),0.);}
`;
// ---- sky (also composites the cloud-sea layer behind everything)
const SKY = MAIN + w`
@vertex fn vs(@builtin(vertex_index)i:u32)->@builtin(position)vec4f{return vec4f(f32(i&1u)*4.-1.,f32(i>>1u)*4.-1.,0.,1.);}
@fragment fn fs(@builtin(position)fc:vec4f)->@location(0)vec4f{
 let ndc=fc.xy*U.res.zw*2.-1.;let d=normalize(U.cf.xyz+U.cr.xyz*ndc.x-U.cu.xyz*ndc.y);let o=U.cam.xyz;let L=U.sun.xyz;
 let cs=max(dot(d,L),0.);
 var c=mix(vec3f(.30,.28,.80),vec3f(.05,.13,.55),pow(saturate(d.y),.6))+SUNC*(smoothstep(.9996,.99995,cs)*14.+pow(cs,3000.)*10.+pow(cs,600.)*3.+pow(cs,120.)*.3);
 c=fog(c,o+d*60000.);
 if(d.y>.004){
  let t=(CLH-o.y)/d.y;let q=o.xz+d.xz*t;let cv=cloudCovD(q);
  if(cv>0.){let lit=saturate(.45+(cv-cloudCovD(q+L.xz*190.))*1.5);
   let cc=mix(vec3f(.16,.15,.40),vec3f(2.6,1.45,.8),lit)+SUNC*.6*pow(cs,10.)*(1.-cv*.8);
   c=mix(c,fog(cc,o+d*t),cv*.9*smoothstep(.02,.17,d.y));}
 }
 let cl=textureSampleLevel(CT,SL,fc.xy*U.res.zw,0.);
 return vec4f(c*(1.-cl.a)+cl.rgb,1.);}
`;
// ---- shadow variants
const CI = w`struct CI_{i:u32} @group(1)@binding(0)var<uniform>CI:CI_;`;
const SOLS = UD + GD + CI + SOLV + w`@vertex fn vs(v:SI)->@builtin(position)vec4f{return U.sh[CI.i]*vec4f(sPos(v),1.);}`;
const LEAFS = UD + GD + CI + LEAFV + w`@vertex fn vs(v:LI)->@builtin(position)vec4f{let l=leaf(v,${SHK});return U.sh[CI.i]*vec4f(mix(l.C,l.wp,.8),1.);}`;
// ---- post
const FSV = w`@vertex fn vs(@builtin(vertex_index)i:u32)->@builtin(position)vec4f{return vec4f(f32(i&1u)*4.-1.,f32(i>>1u)*4.-1.,0.,1.);}`;
const PN = w`
@group(0)@binding(3)var N2:texture_2d<f32>;
@group(0)@binding(4)var N3:texture_3d<f32>;
@group(0)@binding(5)var SR:sampler;
fn ign(p:vec2f)->f32{return fract(52.9829189*fract(dot(p,vec2f(.06711056,.00583715))));}
`;
const RESO = UD + FSV + w`
@group(0)@binding(3)var MC:texture_multisampled_2d<f32>;
@group(0)@binding(4)var MD:texture_depth_multisampled_2d;
struct RO{@location(0)c:vec4f,@location(1)d:vec4f}
@fragment fn fs(@builtin(position)fc:vec4f)->RO{
 let p=vec2i(fc.xy);var s=vec4f(0.);
 for(var i=0;i<4;i++){let c=textureLoad(MC,p,i).rgb;let w=1./(1.+max(c.r,max(c.g,c.b)));s+=vec4f(c*w,w);}
 var o:RO;o.c=vec4f(s.rgb/s.a,1.);o.d=vec4f(min(U.misc.x/max(textureLoad(MD,p,0),1e-9),60000.));return o;}
`;
// cloud sea: sphere-traced heightfield with a volumetric shell, half resolution
const CLOUD = UD + FSV + PN + CS + w`
fn thb(q:vec2f)->f32{var s=0.;for(var k=0;k<4;k++){let e=smoothstep(0.,1.,1.-length(q-ST.th[k].xy)/330.);s+=e;}return s*170.;}
fn ctl(q:vec2f)->f32{
 let t=U.cam.w;let a=textureSampleLevel(N2,SR,q*.00008+vec2f(t*.0005,t*.00017),0.).r;let b=textureSampleLevel(N2,SR,q*.00037-vec2f(t*.0011,-t*.0004),0.).r;
 return -700.+(a-.5)*440.+(b-.5)*150.+thb(q)+smoothstep(2900.,4400.,length(q))*(900.+1000.*a);}
fn ctop(q:vec2f)->f32{
 let t=U.cam.w;let a=textureSampleLevel(N2,SR,q*.00008+vec2f(t*.0005,t*.00017),0.).r;let b=textureSampleLevel(N2,SR,q*.00037-vec2f(t*.0011,-t*.0004),0.).r;
 let c=textureSampleLevel(N3,SR,vec3f(q*.00027-vec2f(t*.0008,-t*.0003),.37+t*.002),0.).a;
 return -700.+(a-.5)*440.+(b-.5)*150.+(c-.55)*110.+thb(q)+smoothstep(2900.,4400.,length(q))*(900.+1000.*a);}
struct CO{@location(0)c:vec4f,@location(1)d:vec4f}
@fragment fn fs(@builtin(position)fc:vec4f)->CO{
 let ndc=fc.xy*U.res.zw*4.-1.;let rd=normalize(U.cf.xyz+U.cr.xyz*ndc.x-U.cu.xyz*ndc.y);let o=U.cam.xyz;let L=U.sun.xyz;let tm=U.cam.w;
 var t=0.;var tl=0.;var ins=true;
 if(o.y>-400.&&rd.y<0.){let tp=(-400.-o.y)/rd.y;let pp=o.xz+rd.xz*tp;if(dot(pp,pp)<8.4e6){t=tp;}}
 var A=0.;var C=vec3f(0.);var D=0.;var vis=-1.;let cs=max(dot(rd,L),0.);
 for(var i=0;i<64;i++){
  let p=o+rd*t;let tp=ctop(p.xz);let h=tp-p.y;
  if(h<0.){if(rd.y>0.&&p.y>2100.){break;}ins=false;tl=t;t+=max(-h*.42,9.+t*.018);}
  else if(!ins){ins=true;var b=t;for(var k=0;k<5;k++){let m=(tl+b)*.5;let pm=o+rd*m;if(ctop(pm.xz)<pm.y){tl=m;}else{b=m;}}t=b;}
  else{
   let e=textureSampleLevel(N3,SR,p*.0029+vec3f(tm*.004,-tm*.0015,tm*.0022),0.);
   let wl=smoothstep(2500.,3900.,length(p.xz));let dn=saturate(h/(70.+330.*wl)-e.r*.7-e.g*.45+.1);
   let st=10.+t*.016;
   if(dn>0.){
    if(vis<0.){vis=cloudSh(p);for(var k=0;k<18;k++){let c=ST.isl[k];let v=c.xyz-p;let tt=dot(v,L);if(tt>0.){vis*=mix(1.,smoothstep(c.w*.5,c.w*1.1,length(v-L*tt)),.85);}}}
    let a=(1.-exp(-dn*st*.05))*(1.-A);
    let hs=ctl(p.xz+L.xz*130.)-(p.y+L.y*130.);
    let lit=smoothstep(60.,-40.,hs)*exp(-h/90.)*vis*(.55+.45*e.g);
    var col=mix(vec3f(.12,.14,.42)*(.45+.55*exp(-h/160.)),vec3f(1.,.68,.42)*5.2,lit);
    col+=SUNC*(.09*pow(cs,6.)*exp(-h/40.)*vis);
    let sm=textureSampleLevel(N3,SR,p*.0052+vec3f(tm*.02,tm*.008,-tm*.014),0.).a;
    let s2=textureSampleLevel(N3,SR,p*.0083-vec3f(tm*.014,tm*.024,tm*.009),0.).g;
    col+=mix(vec3f(1.,.8,.75),vec3f(.75,1.,.95),e.b)*(pow(saturate(sm*s2*2.4),4.)*lit*exp(-h/30.)*4.);
    C+=fog(col,p)*a;D+=t*a;A+=a;if(A>.97){break;}
   }
   t+=st;
  }
  if(t>16000.){break;}
 }
 var r:CO;r.c=vec4f(C,A);r.d=vec4f(D);return r;}
`;
// near-range volumetric sun inscatter (god rays) with shadow maps, half resolution
const RAYS = UD + FSV + PN + CS + w`
@group(0)@binding(6)var SM:texture_depth_2d_array;
@group(0)@binding(7)var SC:sampler_comparison;
@group(0)@binding(8)var LD:texture_2d<f32>;
@fragment fn fs(@builtin(position)fc:vec4f)->@location(0)vec4f{
 let px=vec2i(fc.xy)*2;let zv=textureLoad(LD,px,0).r;
 let ndc=(vec2f(px)+.5)*U.res.zw*2.-1.;let rv=U.cf.xyz+U.cr.xyz*ndc.x-U.cu.xyz*ndc.y;let rl=length(rv);let rd=rv/rl;let o=U.cam.xyz;
 let te=min(zv*rl,RV);let jt=ign(fc.xy);let tm=U.cam.w;
 let sc=vec3f(5.6,3.3,1.35)*sunPh(dot(rd,U.sun.xyz));var acc=vec3f(0.);var cs=1.;
 for(var i=0;i<24;i++){
  let a=(f32(i)+jt)/24.;let t=te*a*a;let dt=te*2.*a/24.;let p=o+rd*t;let vd=t/rl;
  if((i&3)==0){let b=(f32(i)+2.)/24.;cs=cloudSh(o+rd*(te*b*b));}
  var ci=0;if(vd>U.split.x){ci=1;}if(vd>U.split.y){ci=2;}
  var vis=cs;if(vd<U.split.z){let q=U.sh[ci]*vec4f(p,1.);vis*=textureSampleCompareLevel(SM,SC,q.xy*vec2f(.5,-.5)+.5,ci,q.z-.0001);}
  let w=textureSampleLevel(N3,SR,p*.0036+vec3f(tm*.011,-tm*.003,tm*.007),0.).b;
  var ms=1.+(.3+3.2*smoothstep(.42,.7,w))*smoothstep(-150.,0.,p.y)*smoothstep(620.,300.,p.y);
  var th=0.;for(var k=0;k<4;k++){let c=ST.th[k];let r=c.z*(1.+max(p.y+600.,0.)*.0011);th+=smoothstep(r,r*.2,length(p.xz-c.xy));}
  var ta=0.;if(th>0.){ta=th*smoothstep(.15,.85,textureSampleLevel(N3,SR,vec3f(p.x*.004,p.y*.0016-tm*.03,p.z*.004),0.).r)*smoothstep(1000.,400.,p.y);ms+=4.*ta;}
  acc+=(sc*vis+vec3f(1.,.6,.2)*(ms-1.)*.07*(.4+.6*vis)+vec3f(1.,.8,.55)*ta*1.1)*(ms*fogD(p.y)*exp(-fogTau(o,rd,t))*dt);
 }
 return vec4f(acc,1.);}
`;
const RAYB = FSV + w`
@group(0)@binding(0)var RY:texture_2d<f32>;
@group(0)@binding(1)var LD:texture_2d<f32>;
@fragment fn fs(@builtin(position)fc:vec4f)->@location(0)vec4f{
 let p=vec2i(fc.xy);let hm=vec2i(textureDimensions(RY))-1;let z=textureLoad(LD,p*2,0).r;var s=vec3f(0.);var ws=0.;
 for(var j=-1;j<2;j++){for(var i=-1;i<2;i++){let q=clamp(p+vec2i(i,j),vec2i(0),hm);let zq=textureLoad(LD,q*2,0).r;let w=1./(.02+abs(z-zq)/min(z,zq));s+=textureLoad(RY,q,0).rgb*w;ws+=w;}}
 return vec4f(s/ws,1.);}
`;
const BLD = FSV + w`
@group(0)@binding(0)var T:texture_2d<f32>;
@group(0)@binding(1)var S:sampler;
@fragment fn fs(@builtin(position)fc:vec4f)->@location(0)vec4f{
 let ts=1./vec2f(textureDimensions(T));let uv=fc.xy*2.*ts;var s=vec4f(0.);
 for(var i=0;i<5;i++){let o=vec2f(f32(i&1)*2.-1.,f32((i>>1)&1)*2.-1.)*select(1.,0.,i==4);let c=min(textureSampleLevel(T,S,uv+o*ts,0.).rgb,vec3f(64.));let w=select(1.,4.,i==4)/(1.+max(c.r,max(c.g,c.b))*KW);s+=vec4f(c*w,w);}
 return vec4f(s.rgb/s.a,1.);}
`;
const BLU = FSV + w`
@group(0)@binding(0)var T:texture_2d<f32>;
@group(0)@binding(1)var S:sampler;
@fragment fn fs(@builtin(position)fc:vec4f)->@location(0)vec4f{
 let ts=1./vec2f(textureDimensions(T));let uv=fc.xy*.5*ts;var s=vec3f(0.);
 s+=textureSampleLevel(T,S,uv+vec2f(-ts.x,0.),0.).rgb+textureSampleLevel(T,S,uv+vec2f(ts.x,0.),0.).rgb+textureSampleLevel(T,S,uv+vec2f(0.,-ts.y),0.).rgb+textureSampleLevel(T,S,uv+vec2f(0.,ts.y),0.).rgb;
 s+=(textureSampleLevel(T,S,uv+ts*vec2f(-.5,-.5),0.).rgb+textureSampleLevel(T,S,uv+ts*vec2f(.5,-.5),0.).rgb+textureSampleLevel(T,S,uv+ts*vec2f(-.5,.5),0.).rgb+textureSampleLevel(T,S,uv+ts*vec2f(.5,.5),0.).rgb)*2.;
 return vec4f(s/12.*.92,1.);}
`;
const FINAL = UD + FSV + w`
@group(0)@binding(3)var HD:texture_2d<f32>;
@group(0)@binding(4)var RY:texture_2d<f32>;
@group(0)@binding(5)var LD:texture_2d<f32>;
@group(0)@binding(6)var BL:texture_2d<f32>;
@group(0)@binding(7)var SL:sampler;
@fragment fn fs(@builtin(position)fc:vec4f)->@location(0)vec4f{
 let px=vec2i(fc.xy);let uv=fc.xy*U.res.zw;var c=textureLoad(HD,px,0).rgb;
 let z=textureLoad(LD,px,0).r;let hp=fc.xy*.5-.5;let b=floor(hp);let f=hp-b;let hm=vec2i(textureDimensions(RY))-1;
 var s=vec3f(0.);var ws=0.;
 for(var k=0;k<4;k++){let ij=vec2i(k&1,k>>1);let q=clamp(vec2i(b)+ij,vec2i(0),hm);let zq=textureLoad(LD,q*2,0).r;
  let w=mix(1.-f.x,f.x,f32(ij.x))*mix(1.-f.y,f.y,f32(ij.y))/(.02+abs(z-zq)/min(z,zq))+1e-5;s+=textureLoad(RY,q,0).rgb*w;ws+=w;}
 c+=s/ws;
 c=mix(c,textureSampleLevel(BL,SL,uv,0.).rgb,.07);
 c=max(c-.014,vec3f(0.))*.57*(1.-.3*dot(uv-.5,uv-.5)*2.);
 c=saturate(c*(2.51*c+.03)/(c*(2.43*c+.59)+.14));
 c=mix(c,c*c*(3.-2.*c),.62);let l=dot(c,vec3f(.2126,.7152,.0722));c=mix(vec3f(l),c,1.15);
 c=pow(max(c,vec3f(0.)),vec3f(1./2.2));
 let n=fract(sin(dot(fc.xy,vec2f(12.9898,78.233)))*43758.5453)+fract(sin(dot(fc.xy,vec2f(39.346,11.135)))*24634.6345)-1.;
 return vec4f(c+n/255.,1.);}
`;
