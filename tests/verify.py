"""Independent arithmetic checks against NLMA Chapters 2, 3 and 4 (2026-10-02)."""
import json, math, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
cases=[]
# Each set deliberately spans all spectrum and ductility breakpoints.
for mode in ['general','basin','near']:
 for soil in [1,2,3]:
  for period in [.01,.1,.2,.3,.5,.6,1,1.3,2,4]:
   cases.append(dict(mode=mode,soil=soil,zone=1.3,raw=[.6,.3,.8,.45],height=80,I=1.25,ay=1.5,tx=period,ty=period,ctx=.07,cty=.05,rx=4,ry=3,tv=period,rv=3,floors=[dict(h=20,w=500),dict(h=40,w=500),dict(h=60,w=500),dict(h=80,w=450)],fumBasis='code',irregular='no',mixed='no',special='no'))
fault=dict(name='Synthetic interpolation fixture',distance=4,values=[[1,.9,.8,.7,.6,.6,.6,.6],[.6,.5,.4,.35,.3,.3,.3,.3],[1.2,1.1,1,.9,.8,.8,.8,.8],[.8,.7,.6,.5,.45,.45,.45,.45]])
script="const E=require('./engine.js'),C=require('./component-engine.js');let s='';process.stdin.on('data',x=>s+=x).on('end',()=>{const a=JSON.parse(s);console.log(JSON.stringify({main:a.cases.map(p=>E.calculate(p,p.mode==='near'?[a.fault]:[])),types:C.types,components:a.cp.map(p=>C.calculate(p)),spec:[0,.1,.5,1.25,2].map(t=>E.spectrum(t,.6,.3)),elastic:E.spectrum(2,.6,.3,false)}))});"
cp=[]
for mode in ['general','basin','near']:
 for ap,rp in [(1,1.25),(1,2.5),(2.5,2.5),(1,3.5),(2.5,1)]:
  for hx in [0,8,16]:
   cp.append(dict(mode=mode,sds=.6,I=1.25,ip=1,ap=ap,rp=rp,w=2,hn=16,hx=hx))
a=json.loads(subprocess.check_output(['node','-e',script],cwd=root,input=json.dumps(dict(cases=cases,fault=fault,cp=cp)).encode()))
count=0
worst=0
def eq(actual,expected):
 global count,worst
 count+=1; worst=max(worst,abs(actual-expected));assert math.isclose(actual,expected,rel_tol=1e-10,abs_tol=1e-10),(actual,expected)
def amp(raw,soil):
 # Table 2-4, independent linear interpolation.
 fa=[[1]*5,[1.1,1.1,1,1,1],[1.2,1.2,1.1,1,1]][soil-1]
 fv=[[1]*5,[1.5,1.4,1.3,1.2,1.1],[1.8,1.7,1.6,1.5,1.4]][soil-1]
 def interp(v,x,y):
  if v<=x[0]:return y[0]
  if v>=x[-1]:return y[-1]
  i=next(i for i in range(1,len(x)) if v<=x[i]);return y[i-1]+(v-x[i-1])/(x[i]-x[i-1])*(y[i]-y[i-1])
 return [v*interp(v,[.5,.6,.7,.8,.9] if i%2==0 else [.3,.35,.4,.45,.5],fa if i%2==0 else fv) for i,v in enumerate(raw)]
def sa(t,s,u,static=True):
 ratio=t/(u/s)
 if ratio<=.2:return s*(.4+3*ratio)
 if ratio<=1:return s
 return max(u/t,.4*s if static else 0)
def fu(t,r,t0):
 q=math.sqrt(2*r-1);u=t/t0
 if u<=.2:return 1+(q-1)*u/.2
 if u<=.6:return q
 if u<=1:return q+(r-q)*(u-.6)/.4
 return r
def mod(q,v,near):
 lo,hi,b=(.2,.53,.096) if v and near else ((.15,.4,.072) if v else (.3,.8,.144))
 return q if q<=lo else (.7*q if q>=hi else .52*q+b)
for p,r in zip(cases,a['main']):
 near=p['mode']=='near';basin=p['mode']=='basin'
 base=[.6,.78,.8,1.04] if basin else amp(p['raw'],p['soil'])
 site=amp([.85,.45,1.05,.65],p['soil']) if near else base
 for x,y in zip(r['site']['values'],site):eq(x,y)
 for axis in ['x','y','z']:
  v=axis=='z';T=p['tv'] if v else p['t'+axis];t=T if v else min(T,1.4*p['ct'+axis]*80**.75)
  R=p['rv'] if v else p['r'+axis];ra=1+(R-1)/(2 if basin else 1.5);k=(2/3 if near else .5) if v else 1
  fd=fu(t,ra,site[1]/site[0]);fm=fu(t,R,site[1]/site[0]);fs=fu(t,ra,base[1]/base[0]);d=r[axis]
  cd=p['I']/1.4/p['ay']*mod(k*sa(t,*site[:2])/fd,v,near)
  cm=p['I']/1.4/p['ay']*mod(k*sa(t,*site[2:])/fm,v,near)
  cs=p['I']*fs/(3.5 if basin else 4.2)/p['ay']*mod(k*sa(t,*base[:2])/fs,v,near)
  for key,value in dict(t=t,fd=fd,fm=fm,cd=cd,cs=cs,cm=cm,C=max(cd,cs,cm),V=max(cd,cs,cm)*1950).items():eq(d[key],value)
 for axis in ['x','y']:
  d=r[axis];dist=r['d'+axis];ft=0 if d['t']<=.7 else min(.07*d['t'],.25)*d['V']
  eq(dist['ft'],ft);eq(sum(f['force'] for f in dist['rows']),d['V']);eq(dist['rows'][0]['shear'],d['V'])
  fd=fu(p['t'+axis],d['ra'],site[1]/site[0]);eq(d['driftC'],fd*mod(sa(p['t'+axis],*site[:2],False)/fd,False,False)/4.2)
for p,r in zip(cp,a['components']):
 ip=1.25;rpa=1+(p['rp']-1)/(2 if p['mode']=='basin' else 1.5)
 coef=max(.3*.6*ip,min(1.6*.6*ip,.4*.6*ip*p['ap']/rpa*(1+2*p['hx']/16)))
 eq(r['coefficient'],coef);eq(r['fh'],2*coef);eq(r['fv'],2*coef*(2/3 if p['mode']=='near' else .5))
for x,y in zip(a['spec'],[.24,.6,.6,.24,.24]):eq(x,y)
eq(a['elastic'],.15)
# Manually transcribed ap/Rp pairs from official Tables 4-1 and 4-2.
pairs=[(1,1.25),(1,2.5),(2.5,2.5),(2.5,2.5),(1,2.5),(1,2.5),(1,2.5),(1,2.5),(1,2.5),(1.25,1),(1,2.5),(1,1.25),(2.5,3.5),(1,2.5),(1,2.5),(1,2.5),(1,1.25),(2.5,2.5),(2.5,2.5),(1,3.5),(1,2.5),(1,1.25),(1,3.5),(2.5,2.5),(2.5,1.25),(1,2.5),(2.5,2.5),(2.5,2.5),(2.5,2.5),(1,2.5),(1,2.5),(2.5,2.5),(1,3.5),(1,2.5),(1,1.25),(2.5,2.5),(1,2.5),(1,2.5),(1,2.5),(1,2.5),(1,2.5),(2.5,2.5),(1,3.5),(1,2.5),(1,1.25)]
assert len(a['types'])==len(pairs)==45
for t,pair in zip(a['types'],pairs):
 for actual,expected in zip(t[2:],pair):eq(actual,expected)
print(json.dumps(dict(main_cases=len(cases),component_cases=len(cp),preset_pairs=len(pairs),numeric_assertions=count,max_absolute_error=worst,status='PASS'),indent=2))
