const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),E=require('../short-term-engine.js');let count=0;
function close(a,b,tol=1e-10){count++;assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`)}
const base={duration:6,unit:'month',checkReturn:5};
// Independent fixtures computed from the Poisson survival equation, not rounded display values.
for(const [years,expected] of [[.25,2.372805395257475],[.5,4.74561079051495],[1,9.4912215810299],[2,18.9824431620598],[5,47.4561079051495],[50,474.561079051495]]){
 const r=E.calculate({duration:years,unit:'year',checkReturn:expected});close(r.returnPeriod,expected);close(r.probability,.10);assert.equal(r.covered,true);count++;
}
assert.throws(()=>E.calculate({...base,duration:1e308,unit:'year'}));count++;
const r=E.calculate(base);close(r.probability,.09516258196404043);close(r.maxLife,.5268025782891315);close(r.maxLife*12,6.321630939469578);close(E.calculate({...base,duration:182.625,unit:'day'}).returnPeriod,r.returnPeriod);
// Tiny durations need stable expm1/log1p; a rate >1 is allowed, a probability cannot exceed 1.
const tiny=E.calculate({...base,duration:10,unit:'day'});assert.ok(tiny.annualRate>1&&tiny.annualProbability<1);count++;
for(const duration of ['',0,-1,NaN,Infinity,'text']){assert.throws(()=>E.calculate({...base,duration}));count++;}
for(const checkReturn of ['',0,-1,NaN,Infinity]){assert.throws(()=>E.calculate({...base,checkReturn}));count++;}
assert.throws(()=>E.calculate({...base,unit:'hour'}));count++;
const project={...base,forceEnabled:true,confirmed:true,site:'Test',durationSource:'schedule',hazardSource:'report',designSource:'analysis',w:100,ch:.12,cv:.06,capH:15,capV:8,capacitySource:'capacity'};
const f=E.calculate(project).force;assert.ok(f);close(f.fh,12);close(f.fv,6);close(f.fhKN,117.6798);close(f.fvKN,58.8399);close(f.dh,.8);close(f.dv,.75);
// Extending duration beyond selected return-period basis must block force results.
const extended=E.calculate({...project,duration:12});close(extended.probability,.18126924692201815);assert.equal(extended.covered,false);assert.equal(extended.force,null);count+=2;
// No implicit force scaling with duration or return-period ratios.
for(const duration of [1,3,6])for(const checkReturn of [5,50,475]){const x=E.calculate({...project,duration,checkReturn});close(x.force.fh,12);close(x.force.fv,6);}
for(const key of ['site','durationSource','hazardSource','designSource','capacitySource','ch','w']){assert.equal(E.calculate({...project,[key]:''}).force,null);count++;}
assert.equal(E.calculate({...project,confirmed:false}).force,null);count++;
const optional=E.calculate({...project,cv:'',capH:'',capV:'',capacitySource:''}).force;assert.ok(optional);assert.equal(optional.fv,null);assert.equal(optional.dh,null);assert.equal(optional.dv,null);count+=4;
assert.equal(E.calculate({...project,cv:''}).force,null);assert.equal(E.calculate({...project,capH:0}).force,null);count+=2;
assert.ok(E.calculate({...project,capH:10}).force.dh>1);count++;
const offline=fs.readFileSync(path.join(root,'offline.html'),'utf8');for(const file of ['short-term-engine.js','short-term.js','short-term.css','workbench.js']){assert.ok(offline.includes(fs.readFileSync(path.join(root,file),'utf8').trim()));count++;}
for(const file of ['index.html','offline.html']){const s=fs.readFileSync(path.join(root,file),'utf8');assert.ok(s.includes('id="moduleShortTerm"'));assert.ok(s.includes('id="shortterm"'));assert.ok(s.includes('shortterm-guide'));count+=3;}
console.log(`PASS: ${count} short-term assertions: 10% return period, reverse probability, extension block, source gates, force and capacity, no duration scaling, offline parity.`);
