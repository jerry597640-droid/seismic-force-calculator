'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const data=vm.runInNewContext(read('data.js')+';JSON.stringify(DATA)'),actual=JSON.parse(data),official=JSON.parse(read('tests/official-data-snapshot.json'));
assert.deepEqual(actual,official,'All location, classification and fault rows must match official snapshot');
assert.equal(actual.general.length,459);assert.equal(actual.basin.length,883);assert.equal(actual.faults.length,36);
for(const key of ['general','basin'])assert.equal(new Set(actual[key].map(r=>JSON.stringify(r.slice(0,3)))).size,actual[key].length,'Duplicate location key');
const E=require(path.join(root,'engine.js')),C=require(path.join(root,'component-engine.js'));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
// Official table 2-3-4, Shitan fault, Wufeng / Miaoli / Taian group, 9/11/13 km.
const shitan=actual.faults.find(f=>f.name==='獅潭斷層'&&f.area.includes('五峰鄉'));
assert.deepEqual(shitan.values[3],[.78,.74,.69,.64,.60,.55,.50,.50]);
for(const [km,v] of [[9,.60],[10,.575],[11,.55],[12,.525],[13,.50]])close(E.lerp(km,[1,3,5,7,9,11,13,14],shitan.values[3]),v);
// Official Fa/Fv nodes, table 2-4, all 30 values.
const fa=[[1,1,1,1,1],[1.1,1.1,1,1,1],[1.2,1.2,1.1,1,1]],fv=[[1,1,1,1,1],[1.5,1.4,1.3,1.2,1.1],[1.8,1.7,1.6,1.5,1.4]];
for(let soil=1;soil<=3;soil++)for(let i=0;i<5;i++){
 const r=E.amplify([[.5,.6,.7,.8,.9][i],[.3,.35,.4,.45,.5][i],.8,.45],soil);
 close(r.factors[0],fa[soil-1][i]);close(r.factors[1],fv[soil-1][i]);
}
const p={mode:'general',soil:2,zone:1.3,raw:[.6,.3,.8,.45],height:16,I:1,ay:1,tx:.56,ty:.56,tv:.1,ctx:.07,cty:.07,rx:4,ry:4,rv:3,depth:4.6,bw:500,floors:[{h:4,w:500},{h:8,w:500},{h:12,w:500},{h:16,w:450}],fumBasis:'code'};
const r=E.calculate(p);assert.equal(r.x.V.toFixed(2),'345.76');close(r.s,.66);
const component=C.calculate({mode:'general',sds:r.s,I:1,ip:1,ap:1,rp:2.5,w:1,hn:16,hx:16});close(component.fh,.396);close(component.fv,.198);
for(const mode of ['general','near','basin']){
 const faults=mode==='near'?[{...shitan,distance:11}]:[];
 const a=E.calculate({...p,mode},faults),b=E.calculate({...p,mode,fumBasis:'source'},faults);
 assert.deepEqual(a,b,'Legacy source mode cannot alter code-based calculations');
 for(const dir of ['x','y','z']){assert.equal(a[dir].trace.fumBasis,'T0D');close(a[dir].fm,E.fu(a[dir].t,a[dir].R,a.t0));}
}
const offline=read('offline.html');
for(const f of ['data.js','engine.js','app.js','component-engine.js','components.js','tutorial.js','tutorial-data.js'])assert.ok(offline.includes(read(f).trim()),`Offline mismatch: ${f}`);
for(const f of ['index.html','offline.html']){
 assert.ok(read(f).includes('id="fumBasis" disabled'));assert.ok(!read(f).includes('<option value="source">'));
 assert.ok(read(f).includes('id="officialDataAudit"'));
}
console.log('PASS: 459 general rows, 883 basin rows, 1,152 fault values, 30 Fa/Fv nodes; Shitan interpolation, strict FuM, tutorial example, offline parity.');
