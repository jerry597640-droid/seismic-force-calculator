const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=fs.existsSync(path.join(__dirname,'app.js'))?__dirname:path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),Engine=require(path.join(root,'engine.js'));
const app=read('app.js'),render=app.slice(app.indexOf('function renderSteps(){'),app.indexOf("$('addFloor').onclick"));
const vsReport=app.slice(app.indexOf('function vs30Report('),app.indexOf('function vs30Init('));
const fmt=(n,d=4)=>Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const esc=x=>String(x).replaceAll('<','&lt;').replaceAll('>','&gt;');
const table=(heads,rows)=>JSON.stringify({heads,rows});
const model=app.split('// VS30_MODEL_START')[1].split('// VS30_MODEL_END')[0];
const Vs30=vm.runInNewContext('// '+model+'\nVs30Model;');
let count=0;
for(const mode of ['general','near','basin'])for(const soil of [1,2,3])for(const t of [.01,.12,.3,.56,1.2,3])for(const basis of ['code','source']){
 const p={mode,soil,raw:[.6,.3,.8,.45],zone:1.3,fumBasis:basis,height:16,I:1,ay:1,tx:t,ty:t*1.2,tv:.1,ctx:.07,cty:.07,rx:4,ry:4,rv:3,depth:4.6,bw:500,floors:[{h:4,w:500},{h:8,w:500},{h:12,w:500},{h:16,w:450}],irregular:'no',mixed:'no',special:'no',vs30:{basin:mode==='basin',auto:false}};
 const faults=mode==='near'?[{name:'synthetic test',distance:4,values:[[1,.95,.9,.85,.8,.75,.7,.6],[.5,.48,.46,.44,.42,.4,.35,.3],[1.2,1.15,1.1,1.05,1,.95,.9,.8],[.7,.68,.66,.64,.62,.6,.5,.45]]}]:[];
 const current=Engine.calculate(p,faults),nodes={steps:{innerHTML:''},locationNote:{textContent:'test'},mode:{selectedOptions:[{text:mode}]},soil:{selectedOptions:[{text:'soil '+soil}]}};
 const ctx={DATA:{meta:{name:"建築物耐震設計規範及解說",revision:"113 年 3 月 1 日",checkedAt:"2026-10-08"}},params:p,current,Engine,fmt,esc,table,openSteps:new Set(['01']),$:id=>nodes[id]};vm.runInNewContext(vsReport+'\n'+render+'\nrenderSteps();',ctx);
 const html=nodes.steps.innerHTML;
 assert.ok(!/NaN|undefined|Infinity/.test(html));
 for(const value of [current.x.V,current.y.V,current.z.C,current.columnC,current.dx.sumForce,current.dx.moment,current.x.driftV])assert.ok(html.includes(fmt(value,6)),`missing ${value}`);
 for(const id of ['01','01a','03','04','05','06','07','08','09','10'])assert.ok(html.includes(`data-step="${id}"`));
 count++;
}
const vs=Vs30.calculate([{d:5,vs:150},{d:10,vs:200},{d:20,vs:300}]);
const detail=vm.runInNewContext(vsReport+'\nvs30Report({auto:true,basin:false,result:result});',{fmt,table,esc,result:vs});
assert.ok(detail.includes('225.000000'));assert.ok(detail.includes('30−15.000000'));assert.ok(detail.includes('15.000000/300.000000'));
const offline=read('offline.html');assert.ok(offline.includes(app.trim()));assert.ok(offline.includes(read('components.js').trim()));
console.log(`${count} report scenarios passed; Vs30 clipping substitutions and offline parity passed.`);
