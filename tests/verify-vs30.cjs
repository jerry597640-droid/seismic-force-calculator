// Run: node tests/verify-vs30.cjs (repository root); no npm dependencies.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=fs.existsSync(path.join(__dirname,'app.js'))?__dirname:path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const model=app.split('// VS30_MODEL_START')[1].split('// VS30_MODEL_END')[0];
const api=vm.runInNewContext('// '+model+'\nVs30Model;');
let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
const calc=rows=>api.calculate(rows.map(([d,vs])=>({d,vs})));
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
for(const [v,soil] of [[100,3],[179.999999,3],[180,2],[180.000001,2],[269.999999,2],[270,1],[270.000001,1],[800,1]])check('boundary '+v,()=>{const r=calc([[30,v]]);near(r.value,v);assert.equal(r.soil,soil);});
check('teaching example',()=>{const r=calc([[5,150],[10,200],[15,300]]);near(r.value,225);near(r.travel,2/15);assert.equal(r.soil,2);});
check('cross 30 m',()=>{const r=calc([[5,150],[10,200],[20,300]]);near(r.value,225);assert.equal(r.rows[2].used,15);});
check('ignore below 30 m',()=>{const r=calc([[30,270],[20,10]]);near(r.value,270);assert.equal(r.rows[1].used,0);});
check('thick first layer',()=>near(calc([[100,200]]).value,200));
check('slow layer dominates travel time',()=>near(calc([[15,100],[15,1000]]).value,2000/11));
check('decimal depths and boundary',()=>{const r=calc(Array.from({length:300},()=>[.1,180]));near(r.value,180);assert.equal(r.soil,2);});
check('layer split invariant',()=>near(calc([[5,150],[5,200],[5,200],[15,300]]).value,225));
for(const rows of [[],[[25,200]],[[0,200]],[[30,0]],[[-1,200]],[[30,-200]],[['',200]],[[30,'']],[[Infinity,200]],[[30,Infinity]],[[NaN,200]],[[30,NaN]],[[30,200],['',200]]])check('reject '+JSON.stringify(rows),()=>assert.throws(()=>calc(rows)));
const offline=fs.readFileSync(path.join(root,'offline.html'),'utf8');
check('offline embeds identical app',()=>assert.ok(offline.includes(app.trim())));
for(const file of ['index.html','offline.html'])check(file+' input and guide wiring',()=>{const text=fs.readFileSync(path.join(root,file),'utf8');for(const id of ['soilMethod','vsRows','vsAdd','vsExample','vsResult'])assert.equal((text.match(new RegExp('id="'+id+'"','g'))||[]).length,1);assert.ok(text.includes('id=&quot;vs30&quot;'));assert.ok(text.includes('engineering-calculator-hub/'));});
console.log(`${count} checks passed`);
