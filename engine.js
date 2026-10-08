'use strict';
const Engine=(()=>{
const lerp=(x,xs,ys,trace)=>{if(x<=xs[0]){trace?.push({kind:'interp',x,xs:[...xs],ys:[...ys],branch:'lower',lo:0,hi:0,value:ys[0]});return ys[0];}for(let i=1;i<xs.length;i++)if(x<=xs[i]){const value=ys[i-1]+(ys[i]-ys[i-1])*(x-xs[i-1])/(xs[i]-xs[i-1]);trace?.push({kind:'interp',x,xs:[...xs],ys:[...ys],branch:'linear',lo:i-1,hi:i,value});return value;}trace?.push({kind:'interp',x,xs:[...xs],ys:[...ys],branch:'upper',lo:xs.length-1,hi:xs.length-1,value:ys.at(-1)});return ys.at(-1)};
function amplify(raw,soil){const fa=[[1,1,1,1,1],[1.1,1.1,1,1,1],[1.2,1.2,1.1,1,1]][soil-1],fv=[[1,1,1,1,1],[1.5,1.4,1.3,1.2,1.1],[1.8,1.7,1.6,1.5,1.4]][soil-1],trace=[];let factors=raw.map((v,i)=>i%2?lerp(v,[.3,.35,.4,.45,.5],fv,trace):lerp(v,[.5,.6,.7,.8,.9],fa,trace));return {raw,values:raw.map((v,i)=>v*factors[i]),factors,trace:{soil,fa,fv,interpolations:trace}};}
function spectrum(t,s,s1,floor=true,trace){let t0=s1/s;const branch=t<=.2*t0?'rising':t<=t0?'plateau':'long',value=t<=.2*t0?s*(.4+3*t/t0):t<=t0?s:Math.max(s1/t,floor?.4*s:0);trace?.push({kind:'spectrum',t,s,s1,t0,floor,branch,value});return value;}
function fu(t,r,t0,trace){let q=Math.sqrt(2*r-1);const branch=t<=.2*t0?'initial':t<=.6*t0?'sqrt':t<=t0?'transition':'R',value=t<=.2*t0?1+(q-1)*t/(.2*t0):t<=.6*t0?q:t<=t0?q+(r-q)*(t-.6*t0)/(.4*t0):r;trace?.push({kind:'fu',t,r,t0,q,branch,value});return value;}
function modify(q,vertical=false,near=false,trace){let a=vertical?(near?.2:.15):.3,b=vertical?(near?.53:.4):.8,c=vertical?(near?.096:.072):.144;const branch=q<=a?'identity':q<b?'middle':'upper',value=q<=a?q:q<b?.52*q+c:.7*q;trace?.push({kind:'modify',q,vertical,near,a,b,c,branch,value});return value;}
function calculate(p,faults=[]){
// §2.10.2 replaces Ra with R in (2-12); the transition period remains T0D.
p={...p,fumBasis:'code'};
if(!['general','basin','near'].includes(p.mode))throw Error('工址類型無效。');
if(![1,2,3].includes(p.soil))throw Error('地盤類別須為 1–3。');
if(p.mode==='basin'&&![1.6,1.3,1.05].includes(p.zone))throw Error('臺北微分區轉換週期無效。');
for(const k of ['ctx','cty'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('經驗週期係數須為正數。');
for(const k of ['height','I','ay','tx','ty','tv','rx','ry','rv'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('請完整輸入正數參數：'+k);
if(p.rx<1||p.ry<1||p.rv<1)throw Error('韌性容量 R 不可小於 1。');
if(!p.floors.length||p.floors.some((f,i)=>!Number.isFinite(f.h)||!Number.isFinite(f.w)||f.w<=0||f.h<=0||(i&&f.h<=p.floors[i-1].h)))throw Error('楼層重量須大於零，標高須由下而上遞增。');
if(Math.abs(p.floors.at(-1).h-p.height)>.001)throw Error('頂層標高必須與建築高度 Hn 相同。');
if(p.raw.some(v=>!Number.isFinite(v)||v<=0))throw Error('四個震區係數均須為正數。');
const near=p.mode==='near',basin=p.mode==='basin';const base=basin?{values:[.6,.6*p.zone,.8,.8*p.zone],factors:[1,1,1,1],raw:[.6,.6*p.zone,.8,.8*p.zone]}:amplify(p.raw,p.soil);
let raw=[...p.raw],nearRows=[];
if(near){if(!faults.length)throw Error('近斷層工址請加入至少一條適用斷層，並輸入最短水平距離。');for(const f of faults){if(!Number.isFinite(f.distance)||f.distance<0)throw Error('斷層距離不可空白或小於零。');const interpolation=[];let values=f.values.map(v=>lerp(f.distance,[1,3,5,7,9,11,13,14],v,interpolation));const rawBefore=[...raw];raw=raw.map((v,i)=>Math.max(v,values[i]));nearRows.push({...f,computed:values,trace:{interpolation,rawBefore,rawAfter:[...raw]}});}}
const site=near?amplify(raw,p.soil):base;const [s,s1,m,m1]=site.values,t0=s1/s,tm=m1/m,W=p.floors.reduce((a,f)=>a+f.w,0),div=basin?3.5:4.2;
function direction(T,R,ct,vertical=false){const Tc=ct*p.height**.75,t=vertical?T:Math.min(T,1.4*Tc),ra=1+(R-1)/(basin?2:1.5),k=vertical?(near?2/3:.5):1,trace={fd:[],fm:[],sd:[],sm:[],md:[],mm:[],fs:[],ss:[],ms:[],driftFu:[],driftSa:[],driftModify:[]};
let fd=fu(t,ra,t0,trace.fd),fm=fu(t,R,t0,trace.fm),sd=k*spectrum(t,s,s1,true,trace.sd),sm=k*spectrum(t,m,m1,true,trace.sm),md=modify(sd/fd,vertical,near,trace.md),mm=modify(sm/fm,vertical,near,trace.mm);
let smallS=near?base.values:site.values,fs=fu(t,ra,smallS[1]/smallS[0],trace.fs),ss=k*spectrum(t,smallS[0],smallS[1],true,trace.ss),ms=modify(ss/fs,vertical,near,trace.ms);
let cd=p.I/(1.4*p.ay)*md,cs=p.I*fs/(div*p.ay)*ms,cm=p.I/(1.4*p.ay)*mm,C=Math.max(cd,cs,cm),control=C===cd?'設計地震 Vd':C===cs?'中小度地震 V*':'最大考量地震 VM';
let driftFu=fu(T,ra,t0,trace.driftFu),driftSa=spectrum(T,s,s1,false,trace.driftSa),driftC=driftFu*modify(driftSa/driftFu,false,false,trace.driftModify)/4.2;
return {T,Tc,t,R,ra,fd,fm,sd,sm,md,mm,fs,ss,ms,cd,cs,cm,C,V:C*W,control,driftC,driftV:driftC*W,trace:{...trace,k,smallS:[...smallS],vertical,ct,periodUpper:1.4*Tc,fumBasis:'T0D',driftFuValue:driftFu,driftSaValue:driftSa}};}
const x=direction(p.tx,p.rx,p.ctx),y=direction(p.ty,p.ry,p.cty),z=direction(p.tv,p.rv,0,true);
let basement=null;if(Number.isFinite(p.depth)&&Number.isFinite(p.bw)){const depthFactor=Math.max(1-p.depth/40,.5),kb=.1*depthFactor*p.I,kd=kb*s,ks=kd/div,km=kb*m;basement={depthFactor,kb,kd,ks,km,design:kd*p.bw,small:ks*p.bw,maximum:km*p.bw};}
function distribute(d){let ft=d.t<=.7?0:Math.min(.07*d.t,.25)*d.V,sum=p.floors.reduce((a,f)=>a+f.w*f.h,0);let rows=p.floors.map((f,i)=>{const numerator=(d.V-ft)*f.w*f.h,baseForce=numerator/sum,roofExtra=i===p.floors.length-1?ft:0;return {...f,force:baseForce+roofExtra,trace:{weightHeight:f.w*f.h,numerator,baseForce,roofExtra}}});let q=0;for(let i=rows.length-1;i>=0;i--){q+=rows[i].force;rows[i].shear=q;}return {ft,rows,sumForce:q,moment:rows.reduce((a,f)=>a+f.force*f.h,0),trace:{denominator:sum,remaining:d.V-ft,ftCoefficient:d.t<=.7?0:Math.min(.07*d.t,.25)}};}
return {base,site,nearRows,W,s,s1,m,m1,t0,tm,x,y,z,dx:distribute(x),dy:distribute(y),columnC:.4*(near?2/3:.5)*s*p.I/p.ay,div,basement,dynamic:p.height>=50||p.floors.length>=15||p.special==='yes'||((p.height>20||p.floors.length>=5)&&p.irregular==='yes')||((p.height>20||p.floors.length>5)&&p.mixed==='yes'),trace:{input:JSON.parse(JSON.stringify(p)),faults:JSON.parse(JSON.stringify(faults)),rawGoverning:[...raw]}};
}
return {lerp,amplify,spectrum,fu,modify,calculate};})();
if(typeof module!=='undefined')module.exports=Engine;

