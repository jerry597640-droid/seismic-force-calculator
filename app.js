'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=(n,d=4)=>Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
let openSteps=new Set(['01']);
let floors=[{h:4,w:500},{h:8,w:500},{h:12,w:500},{h:16,w:450}],faults=[],current=null,params=null;
// VS30_MODEL_START — §2.5, equation (2-5a); only the surface-to-30 m profile.
const Vs30Model = Object.freeze({
  classify(v) {
    if (!Number.isFinite(v) || v <= 0) throw Error('Vs30 必須是正有限數值。');
    const atLeast = limit => v >= limit || Math.abs(v-limit) <= 8*Number.EPSILON*limit;
    return atLeast(270) ? 1 : atLeast(180) ? 2 : 3;
  },
  calculate(layers) {
    if (!layers.length) throw Error('請至少輸入一層資料。');
    let depth=0, travel=0;
    const rows=layers.map((r,i)=>{
      const d=String(r.d).trim()===''?NaN:Number(r.d), vs=String(r.vs).trim()===''?NaN:Number(r.vs);
      if (!Number.isFinite(d)||d<=0||!Number.isFinite(vs)||vs<=0) throw Error(`第 ${i+1} 層：厚度與 Vs 均須填入大於 0 的有限數值。`);
      const top=depth, used=Math.max(0,Math.min(d,30-top)); depth+=d;
      if (!Number.isFinite(depth)) throw Error('總厚度超出可計算範圍。');
      const time=used/vs; travel+=time;
      return {top,bottom:depth,d,vs,used,time,source:String(r.source||'')};
    });
    if (depth < 30-1e-9) throw Error(`資料僅 ${depth.toFixed(3)} m，尚缺 ${(30-depth).toFixed(3)} m；請補齊地表下 30 m，不自動外推。`);
    const value=30/travel;
    if (!Number.isFinite(value)||value<=0) throw Error('波速或厚度超出可計算範圍。');
    return {value,soil:this.classify(value),depth,travel,rows};
  }
});
// VS30_MODEL_END

function vs30Layers(){return [...$('vsRows').children].map(row=>({d:row.querySelector('[data-vs-d]').value,vs:row.querySelector('[data-vs-v]').value,source:row.querySelector('[data-vs-source]').value}));}
function vs30Draw(layers){
  $('vsRows').innerHTML=layers.map((r,i)=>`<div class="vs-layer"><div class="vs-layer-title"><b>第 ${i+1} 層</b><button type="button" data-vs-remove="${i}" ${layers.length===1?'disabled':''} aria-label="移除第 ${i+1} 層">移除</button></div><div class="grid2"><label>厚度 d（m）<input data-vs-d type="number" inputmode="decimal" step="any" min="0" aria-label="第 ${i+1} 層厚度（m）" value="${esc(r.d)}" placeholder="例如 5"></label><label>剪力波速 Vs（m/s）<input data-vs-v type="number" inputmode="decimal" step="any" min="0" aria-label="第 ${i+1} 層 Vs（m/s）" value="${esc(r.vs)}" placeholder="例如 150"></label></div><label>資料來源（選填）<input data-vs-source type="text" aria-label="第 ${i+1} 層資料來源" value="${esc(r.source||'')}" placeholder="報告／孔號／頁次／試驗方法"></label><small data-vs-depth></small></div>`).join('');
}
function vs30Sync(){
  const basin=$('mode').value==='basin',auto=$('soilMethod').value==='layers';
  $('soilMethod').disabled=basin; $('soil').disabled=auto&&!basin;
  $('vsBasinNote').hidden=!basin;
  let result=null,error=null;
  try {result=Vs30Model.calculate(vs30Layers());} catch(e){error=e;}
  const names=['','第一類・堅實地盤','第二類・普通地盤','第三類・軟弱地盤'];
  const nodes=[...$('vsRows').children];
  nodes.forEach((node,i)=>{const r=result?.rows[i];node.querySelector('[data-vs-depth]').textContent=r?`地表下 ${fmt(r.top,3)}–${fmt(r.bottom,3)} m；採用 ${fmt(r.used,3)} m${r.used===0?'（30 m 以下，不計入）':r.used<r.d?'（跨越 30 m，截取計算）':''}`:'';});
  $('vsResult').className='note'+(error&&auto&&!basin?' vs-error':'');
  $('vsResult').textContent=result?`Vs30 = ${fmt(result.value,6)} m/s；${names[result.soil]}。${basin?'僅供參考，臺北盆地仍採微分區。':auto?'已自動帶入地盤分類並重算地震力。':'僅供預覽；目前仍採手動地盤分類。'}${result.depth>30?' 僅採地表下前 30 m。':''}`:error.message+(auto&&!basin?' 已暫停地震力計算。':' 尚未套用分層資料。');
  if(auto&&!basin){if(error)throw error;$('soil').value=String(result.soil);}
  return {auto: auto&&!basin,basin,result};
}
function vs30Report(state){
  if(state.basin)return '<p>臺北盆地依 §2.7 微分區規定，不以 Vs30 三類分類取代。</p>';
  if(!state.auto)return `<p>地盤分類：${esc($('soil').selectedOptions[0].text)}（手動選擇；未採用分層自動判定）。</p>`;
  const r=state.result;
  return r.rows.map((x,i)=>`<div class="formula">第 ${i+1} 層：採用 d = max(0, min(${fmt(x.d,6)}, 30−${fmt(x.top,6)})) = ${fmt(x.used,6)} m<br>d/Vs = ${fmt(x.used,6)} / ${fmt(x.vs,6)} = ${fmt(x.time,8)} s</div>`).join('') + `<div class="formula">Σ(d/Vs) = ${r.rows.map(x=>`${fmt(x.used,6)}/${fmt(x.vs,6)}`).join(' + ')} = ${fmt(r.travel,8)} s<br>Σd = ${r.rows.map(x=>fmt(x.used,6)).join(' + ')} = 30 m<br>Vs30 = 30 / ${fmt(r.travel,8)} = ${fmt(r.value,6)} m/s<br>分類比較：${r.soil===1?'Vs30 ≥270':r.soil===2?'180≤Vs30&lt;270':'Vs30&lt;180'} → 第 ${r.soil} 類</div>` + '<p>採用地表下 0–30 m；第 '+r.soil+' 類地盤。分類使用未四捨五入值。</p>'+table(['層','深度範圍（m）','原厚度（m）','採用 d（m）','Vs（m/s）','d/Vs（s）','資料來源'],r.rows.map((x,i)=>[i+1,`${fmt(x.top,3)}–${fmt(x.bottom,3)}`,fmt(x.d,3),fmt(x.used,3),fmt(x.vs,3),fmt(x.time,8),esc(x.source||'未填')]))+`<div class="formula">Σd = 30 m；Σ(d/Vs) = ${fmt(r.travel,8)} s<br>Vs30 = 30 / Σ(d/Vs) = ${fmt(r.value,6)} m/s</div><p>依 §2.5 式 (2-5a)：≥270 為第一類；180≤Vs30&lt;270 為第二類；&lt;180 為第三類。波速採地勘實測值或由專業人員依規範確認的換算值。</p>`;
}
function vs30Init(){
  vs30Draw([{d:'',vs:'',source:''}]);
  $('vsRows').addEventListener('input',update);
  $('vsRows').addEventListener('click',e=>{const b=e.target.closest('[data-vs-remove]');if(!b)return;const rows=vs30Layers();if(rows.length<=1)return;rows.splice(Number(b.dataset.vsRemove),1);vs30Draw(rows);update();});
  $('vsAdd').onclick=()=>{vs30Draw([...vs30Layers(),{d:'',vs:'',source:''}]);update();$('vsRows').lastElementChild.querySelector('input').focus();};
  $('vsExample').onclick=()=>{vs30Draw([{d:5,vs:150,source:'教學假設，非實際工址'},{d:10,vs:200,source:'教學假設，非實際工址'},{d:15,vs:300,source:'教學假設，非實際工址'}]);$('soilMethod').value='layers';$('vsDetails').open=true;update();};
  $('soilMethod').addEventListener('change',()=>{if($('soilMethod').value==='layers')$('vsDetails').open=true;});
}

const opts=arr=>arr.map((x,i)=>`<option value="${i}">${esc(x)}</option>`).join('');
$('directionInputs').innerHTML=['x','y'].map(a=>`<h3>${a.toUpperCase()} 向</h3><label>經驗週期類別<select id="ct${a}"><option value="0.07">RC／SRC 剛構架、鋼偏心斜撐 · 0.070</option><option value="0.085">鋼剛構架（無剛性牆／加勁）· 0.085</option><option value="0.05">其他／含剪力牆或加勁 · 0.050</option></select></label><div class="grid2"><label>分析週期 T${a}（s）<input id="t${a}" type="number" value="0.56" min="0.001" step="0.01"></label><label>韌性容量 R${a}<input id="r${a}" type="number" value="4" min="1" max="5" step="0.1"></label></div>`).join('')+'<p class="hint">R 預設 4 為示範；須由表 1-3 依實際結構系統選定。經驗週期係數與 R 分別確認。</p>';
function floorUI(){ $('floorInputs').innerHTML=floors.map((f,i)=>`<tr><td>${i+1}F${i===floors.length-1?' / 屋頂':''}</td><td><input aria-label="${i+1}樓標高" data-floor="${i}" data-key="h" type="number" min="0.01" step="0.1" value="${f.h}"></td><td><input aria-label="${i+1}樓重量" data-floor="${i}" data-key="w" type="number" min="0.01" step="10" value="${f.w}"></td><td><button data-remove-floor="${i}" ${floors.length===1?'disabled':''}>移除</button></td></tr>`).join('');}
function faultUI(){ $('faultRows').innerHTML=faults.map((f,i)=>`<div class="fault"><label>斷層／表列行政區組別<select data-fault="${i}" data-key="index">${DATA.faults.map((d,j)=>`<option value="${j}" ${j===f.index?'selected':''}>${esc(d.name)} · 第 ${j+1} 組</option>`).join('')}</select></label><p class="hint">${esc(DATA.faults[f.index].area)}</p><label>最短水平距離（km）<input data-fault="${i}" data-key="distance" type="number" min="0" step="0.1" value="${f.distance}"></label><button data-remove-fault="${i}">移除此斷層</button></div>`).join('');}
const locations=[...DATA.general.map(r=>({city:r[0],district:r[1],village:r[2]||'全區／表列範圍',raw:r.slice(3,7),near:r[7],mode:r[7]?'near':'general'})),...DATA.basin.map(r=>({city:r[0],district:r[1],village:r[2],zone:r[6],mode:'basin'}))];
function choices(id,items){$(id).innerHTML=items.map(x=>`<option>${esc(x)}</option>`).join('');}
function eligibleLocations(){const mode=$('mode').value;return locations.filter(l=>l.mode===mode&&(mode!=='general'||l.city!=='臺北市')&&(mode!=='basin'||['臺北市','新北市'].includes(l.city)));}
function refreshLocations(){const previous=$('city').value,available=[...new Set(eligibleLocations().map(l=>l.city))];choices('city',available);if(available.includes(previous))$('city').value=previous;else if($('mode').value==='basin'&&available.includes('臺北市'))$('city').value='臺北市';cityChange();}
function cityChange(){const previous=$('district').value,available=[...new Set(eligibleLocations().filter(l=>l.city===$('city').value).map(l=>l.district))];choices('district',available);if(available.includes(previous))$('district').value=previous;districtChange();}
function districtChange(){const previous=$('village').value,rows=eligibleLocations().filter(l=>l.city===$('city').value&&l.district===$('district').value);$('village').innerHTML=rows.map(r=>`<option value="${locations.indexOf(r)}">${esc(r.village)} · ${r.mode==='basin'?'盆地':r.mode==='near'?'近斷層':'一般'}</option>`).join('');if(rows.some(r=>String(locations.indexOf(r))===previous))$('village').value=previous;$('applyLocation').disabled=!rows.length;}
refreshLocations();if([...$('city').options].some(o=>o.value==='桃園市'))$('city').value='桃園市';cityChange();
$('city').addEventListener('change',cityChange);$('district').addEventListener('change',districtChange);
$('applyLocation').onclick=()=>{let r=locations[Number($('village').value)];if(!r||!eligibleLocations().includes(r)||$('village').value==='')return;if(r.mode==='basin')$('zone').value=r.zone;else r.raw.forEach((v,i)=>$('s'+i).value=v);$('locationNote').textContent=[r.city,r.district,r.village].join(' ')+(r.near?'｜鄰近：'+r.near+'；請加入所有適用斷層並量測距離。':'')+(r.city==='臺北市'||r.city==='新北市'?'｜113 年修正表':'｜附件震區表');modeUI();update();};
function modeUI(){let mode=$('mode').value;$('generalInputs').hidden=mode==='basin';$('basinInputs').hidden=mode!=='basin';$('nearInputs').hidden=mode!=='near';}
$('mode').addEventListener('change',()=>{$('locationNote').textContent='已手動切換工址類型，請重新確認基地與參數。';refreshLocations();modeUI();});
function read(){const vs30=vs30Sync();const n=id=>$(id).value.trim()===''?NaN:Number($(id).value);return {vs30,mode:$('mode').value,fumBasis:$('fumBasis').value,zone:n('zone'),soil:n('soil'),raw:[0,1,2,3].map(i=>n('s'+i)),height:n('height'),I:n('I'),ay:n('ay'),tx:n('tx'),ty:n('ty'),ctx:n('ctx'),cty:n('cty'),rx:n('rx'),ry:n('ry'),tv:n('tv'),rv:n('rv'),depth:n('depth'),bw:n('bw'),floors,irregular:$('irregular').value,mixed:$('mixed').value,special:$('special').value};}
const table=(heads,rows)=>`<div class="tablewrap"><table><thead><tr>${heads.map(s=>`<th>${s}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
function metric(label,d){return `<div class="metric"><div class="eyebrow">${label}</div><strong>${fmt(d.V,2)}<small>tf</small></strong><p class="coef">C = V/W = ${fmt(d.C)}</p><p>${d.control}<br>T = ${fmt(d.t,3)} s</p></div>`;}
function update(){document.querySelectorAll('#steps details').forEach(el=>{if(el.open)openSteps.add(el.dataset.step);else openSteps.delete(el.dataset.step);});try{let p=read();if(!Number.isFinite(p.depth)||p.depth<0||!Number.isFinite(p.bw)||p.bw<=0)throw Error('地下室深度須 ≥0，該層重量須 >0。');if(p.rv>3)throw Error('本工具垂直韌性 Rv 限 1–3；其他取值須專案評估。');if(p.rx>5||p.ry>5)throw Error('R 超出本工具支援範圍 1–5，請確認表 1-3。');const r=Engine.calculate(p,faults.map(f=>({...DATA.faults[f.index],distance:f.distance})));params=p;current=r;$('calcState').textContent='已更新';$('calcState').className='ready';
$('status').className='status'+(r.dynamic?' warn':'');$('status').textContent=r.dynamic?'須另作動力／專案分析｜下列為地震力需求與靜力基準，不能以本頁取代 §3.1 動力分析。':'靜力法初步篩選：高度與樓層數未達動力門檻。仍須確認結構系統、規則性與地盤條件。';
$('results').innerHTML='<div class="metrics">'+metric('X 向設計總橫力',r.x)+metric('Y 向設計總橫力',r.y)+`<div class="metric"><div class="eyebrow">地上總重量 W</div><strong>${fmt(r.W,0)}<small>tf</small></strong><p class="coef">${p.floors.length} 層 · Hn ${fmt(p.height,1)} m</p><p>X：${fmt(r.x.V*9.80665,1)} kN<br>Y：${fmt(r.y.V*9.80665,1)} kN</p></div></div>`;
$('siteTable').innerHTML=table(['工址參數','SDS','SD1','SMS','SM1'],[['放大係數 Fa / Fv',...r.site.factors.map(n=>fmt(n,3))],['工址譜係數',...r.site.values.map(n=>fmt(n,4))]])+`<p class="hint">T₀D = SD1 / SDS = ${fmt(r.t0)} s　｜　T₀M = SM1 / SMS = ${fmt(r.tm)} s</p>`;
renderChart();renderFloors();renderSteps();$('print').disabled=false;document.dispatchEvent(new Event('seismic-updated'));
}catch(e){current=null;params=null;$('calcState').textContent='待修正';$('calcState').className='invalid';$('status').className='status error';$('status').textContent=e.message;$('results').innerHTML='<div class="note">參數尚未完整，暫停顯示計算結果。修正後將自動重新計算。</div>';['chart','siteTable','floorResults','steps'].forEach(id=>$(id).innerHTML='');$('print').disabled=true;document.dispatchEvent(new Event('seismic-updated'));}}
function renderChart(){if(!current)return;const r=current,limit=Math.max(4,Math.ceil(Math.max(r.t0,r.tm)*2.8),Math.ceil(Math.max(r.x.t,r.y.t))),maxY=Math.max(r.s,r.m)*1.15,staticMode=$('chartType').value==='static',x=t=>56+t/limit*690,y=v=>285-v/maxY*235;let svg='<svg viewBox="0 0 790 330" role="img" aria-label="設計地震與最大考量地震反應譜"><rect x="56" y="35" width="690" height="250" fill="#fafcfe"/>';
for(let i=0;i<=5;i++){let v=maxY*i/5;svg+=`<line x1="56" x2="746" y1="${y(v)}" y2="${y(v)}" stroke="#e2eaf2"/><text x="45" y="${y(v)+4}" text-anchor="end" font-size="12" fill="#70849a">${fmt(v,2)}</text>`;}
for(let i=0;i<=limit;i++){svg+=`<text x="${x(i)}" y="308" text-anchor="middle" font-size="12" fill="#70849a">${i}</text>`;}
svg+='<text x="56" y="20" fill="#536d84" font-size="13">Sa（g/g）</text><text x="746" y="328" text-anchor="end" fill="#536d84" font-size="13">週期 T（s）</text>';
[[r.s,r.s1,'#2678c5'],[r.m,r.m1,'#169993']].forEach(([s,s1,c])=>{const ts=[...new Set([...Array.from({length:301},(_,i)=>i*limit/300),.2*s1/s,s1/s,2.5*s1/s])].filter(t=>t<=limit).sort((a,b)=>a-b);let path=ts.map((t,i)=>`${i?'L':'M'}${x(t).toFixed(2)},${y(Engine.spectrum(t,s,s1,staticMode)).toFixed(2)}`).join(' ');svg+=`<path d="${path}" fill="none" stroke="${c}" stroke-width="3"/>`;});
[r.x,r.y].forEach((d,i)=>{svg+=`<line x1="${x(d.t)}" x2="${x(d.t)}" y1="35" y2="285" stroke="${i?'#5f7b87':'#132942'}" stroke-dasharray="5 5"/><text x="${x(d.t)+7}" y="${48+i*18}" font-size="12" fill="#18324a">${i?'Y':'X'} ${fmt(d.t,3)}s</text>`;});$('chart').innerHTML=svg+'</svg>';}
function renderFloors(){const r=current;let rows=r.dx.rows.map((f,i)=>[`${i+1}F`,fmt(f.force,2),fmt(r.dy.rows[i].force,2),fmt(f.shear,2),fmt(r.dy.rows[i].shear,2)]);$('floorResults').innerHTML=`<h3>豎向分配結果</h3><p class="hint">Fᵢ = (V − Ft) Wᵢhᵢ / ΣWⱼhⱼ；屋頂再加 Ft。T ≤0.7 s 時，本工具取 Ft = 0。</p>`+table(['樓層','Fx（tf）','Fy（tf）','Qx（tf）','Qy（tf）'],rows)+`<div class="note">ΣFx = ${fmt(r.dx.sumForce,3)} tf　／　ΣFy = ${fmt(r.dy.sumForce,3)} tf<br>頂層集中力 Ftx = ${fmt(r.dx.ft,3)} tf、Fty = ${fmt(r.dy.ft,3)} tf<br>基面力矩 ΣFh（未折減、含 Ft）：X ${fmt(r.dx.moment,2)}、Y ${fmt(r.dy.moment,2)} tf·m</div>`;}
function renderSteps(){
 const p=params,r=current,N=(x)=>fmt(x,6),F=(s)=>`<div class="formula">${s}</div>`,step=(id,title,body)=>`<details class="step" ${openSteps.has(id)?'open':''} data-step="${id}"><summary><span>${id}</span> ${title}</summary><div class="step-content">${body}</div></details>`;
 const names=['SSᴰ','S1ᴰ','SSᴹ','S1ᴹ'],out=['SDS','SD1','SMS','SM1'];
 function interp(x,xs,ys){if(x<=xs[0])return `${N(x)} ≤ ${N(xs[0])}，取首欄 ${N(ys[0])}`;if(x>=xs.at(-1))return `${N(x)} ≥ ${N(xs.at(-1))}，取末欄 ${N(ys.at(-1))}`;let i=xs.findIndex(v=>v>=x);return `${N(ys[i-1])} + (${N(ys[i])} − ${N(ys[i-1])}) × (${N(x)} − ${N(xs[i-1])}) / (${N(xs[i])} − ${N(xs[i-1])}) = ${N(Engine.lerp(x,xs,ys))}`;}
 function amp(a,title){const fa=[[1,1,1,1,1],[1.1,1.1,1,1,1],[1.2,1.2,1.1,1,1]][p.soil-1],fv=[[1,1,1,1,1],[1.5,1.4,1.3,1.2,1.1],[1.8,1.7,1.6,1.5,1.4]][p.soil-1];return `<h3>${title}</h3><p>第 ${p.soil} 類地盤；表 2-4(a)／2-4(b)。F = F₁ + (F₂−F₁)(S−S₁)/(S₂−S₁)，表外取端點。</p>`+a.raw.map((v,i)=>F(`${names[i]} = ${N(v)}<br>${i%2?'Fv':'Fa'} = ${interp(v,i%2?[.3,.35,.4,.45,.5]:[.5,.6,.7,.8,.9],i%2?fv:fa)}<br>${out[i]} = ${i%2?'Fv':'Fa'} × ${names[i]} = ${N(a.factors[i])} × ${N(v)} = ${N(a.values[i])}`)).join('');}
 function fuTrace(label,t,R,t0){const q=Math.sqrt(2*R-1),a=.2*t0,b=.6*t0;let branch,expr;if(t<=a){branch='T ≤ 0.2T₀';expr=`1 + (${N(q)}−1) × ${N(t)} / ${N(a)}`;}else if(t<=b){branch='0.2T₀ < T ≤ 0.6T₀';expr=N(q);}else if(t<=t0){branch='0.6T₀ < T ≤ T₀';expr=`${N(q)} + (${N(R)}−${N(q)}) × (${N(t)}−${N(b)}) / (${N(.4*t0)})`;}else{branch='T > T₀';expr=N(R);}return F(`${label}：T = ${N(t)} s；T₀ = ${N(t0)} s；折減參數 = ${N(R)}<br>q = √(2 × ${N(R)} − 1) = ${N(q)}<br>0.2T₀ = ${N(a)} s；0.6T₀ = ${N(b)} s<br>適用分段：${branch.replaceAll('<','&lt;')}<br>${label} = ${expr} = ${N(Engine.fu(t,R,t0))}`);}
 function saTrace(label,t,s,s1,vertical=1,floor=true){const t0=s1/s;let branch,expr;if(t<=.2*t0){branch='T ≤ 0.2T₀';expr=`${N(s)} × (0.4 + 3 × ${N(t)} / ${N(t0)})`;}else if(t<=t0){branch='0.2T₀ < T ≤ T₀';expr=N(s);}else{branch=floor?'T > T₀，含 0.4S 下限':'T > T₀，不設 0.4S 下限';expr=floor?`max(${N(s1)} / ${N(t)}, 0.4 × ${N(s)})`:`${N(s1)} / ${N(t)}`;}return F(`${label}：S = ${N(s)}；S₁ = ${N(s1)}；T₀ = ${N(t0)} s；T = ${N(t)} s<br>適用分段：${branch.replaceAll('<','&lt;')}<br>Sa = ${expr} = ${N(Engine.spectrum(t,s,s1,floor))}${vertical!==1?`<br>垂直譜 = ${N(vertical)} × ${N(Engine.spectrum(t,s,s1,floor))} = ${N(vertical*Engine.spectrum(t,s,s1,floor))}`:''}`);}
 function modTrace(label,sa,fu,vertical=false){let q=sa/fu,a=vertical?(p.mode==='near'?.2:.15):.3,b=vertical?(p.mode==='near'?.53:.4):.8,c=vertical?(p.mode==='near'?.096:.072):.144;let expr=q<=a?`${N(q)}（q ≤ ${a}）`:q<b?`0.52 × ${N(q)} + ${c}（${a} &lt; q &lt; ${b}）`:`0.7 × ${N(q)}（q ≥ ${b}）`;return F(`${label}：q = Sa/Fu = ${N(sa)} / ${N(fu)} = ${N(q)}<br>m(q) = ${expr} = ${N(Engine.modify(q,vertical,p.mode==='near'))}`);}
 function coeff(d,label,vertical=false){return `<h3>${label}</h3>`+modTrace('設計地震',d.sd,d.fd,vertical)+modTrace('中小度地震',d.ss,d.fs,vertical)+modTrace('最大考量地震',d.sm,d.fm,vertical)+F(`Cd = I × m(SaD/Fu)/(1.4αy)<br>= ${N(p.I)} × ${N(d.md)} / (1.4 × ${N(p.ay)}) = ${N(d.cd)}<br>C* = I × Fu* × m(SaD*/Fu*)/(${r.div}αy)<br>= ${N(p.I)} × ${N(d.fs)} × ${N(d.ms)} / (${r.div} × ${N(p.ay)}) = ${N(d.cs)}<br>CM = I × m(SaM/FuM)/(1.4αy)<br>= ${N(p.I)} × ${N(d.mm)} / (1.4 × ${N(p.ay)}) = ${N(d.cm)}<br>${vertical?'Kz':'C'} = max(${N(d.cd)}, ${N(d.cs)}, ${N(d.cm)}) = ${N(d.C)}<br>控制工況：${d.control}${vertical?'':`<br>V = C × W = ${N(d.C)} × ${N(r.W)} = ${N(d.V)} tf = ${N(d.V*9.80665)} kN`}`);}
 const denom=p.mode==='basin'?2:1.5,kv=p.mode==='near'?2/3:.5,small=r.base.values,smallT=small[1]/small[0],fumT=p.fumBasis==='source'?r.tm:r.t0;
 let h=step('01','輸入與重量彙整',`<p>${esc($('locationNote').textContent)}<br>工址：${esc($('mode').selectedOptions[0].text)}；I=${p.I}；αy=${p.ay}；Hn=${p.height} m。數值顯示至小數 6 位，內部計算使用完整精度，末位可能因顯示四捨五入略有差異。</p>`+table(['樓層','標高 h（m）','重量 W（tf）','W × h（tf·m）'],p.floors.map((f,i)=>[i+1,N(f.h),N(f.w),N(f.w*f.h)]))+F(`W = ΣWi = ${p.floors.map(f=>N(f.w)).join(' + ')} = ${N(r.W)} tf<br>ΣWihi = ${p.floors.map(f=>`${N(f.w)} × ${N(f.h)}`).join(' + ')} = ${N(p.floors.reduce((s,f)=>s+f.w*f.h,0))} tf·m`));
 h+=step('01a','Vs30 與地盤分類 · §2.5',vs30Report(p.vs30));
 if(r.nearRows.length)h+=step('02','近斷層逐項內插與包絡 · §2.4',r.nearRows.map(f=>`<h3>${esc(f.name)} · ${N(f.distance)} km</h3>`+f.values.map((ys,i)=>F(`${names[i]} = ${interp(f.distance,[1,3,5,7,9,11,13,14],ys)}`)).join('')).join('')+names.map((name,i)=>F(`${name}包絡 = max(一般區域 ${N(p.raw[i])}, ${r.nearRows.map(f=>N(f.computed[i])).join(', ')}) = ${N(r.site.raw[i])}`)).join('')+'<p>四個震區參數各自取最大值，再計算 Fa、Fv；中小度地震另採未含近斷層效應的區域係數。</p>');
 h+=step('03','工址放大係數與轉換週期 · §2.5–2.7',(p.mode==='basin'?F(`臺北盆地採表 2-6(c)，不再乘一般地盤 Fa、Fv。<br>T₀ = ${N(p.zone)} s<br>SDS = 0.6；SD1 = 0.6 × ${N(p.zone)} = ${N(r.s1)}<br>SMS = 0.8；SM1 = 0.8 × ${N(p.zone)} = ${N(r.m1)}`):amp(r.site,'採用工址譜係數')+(p.mode==='near'?amp(r.base,'中小度地震：不含近斷層效應'):''))+F(`T₀D = SD1/SDS = ${N(r.s1)}/${N(r.s)} = ${N(r.t0)} s<br>T₀M = SM1/SMS = ${N(r.m1)}/${N(r.m)} = ${N(r.tm)} s`));
 h+=step('04','X／Y 週期限制與韌性折減 · §2.6、2.9',`<p>FuM 分界依據：${p.fumBasis==='source'?'附件比對模式，採 T₀M':'規範 §2.10.2 代入式 (2-12)，採 T₀D'}。</p>`+[['X',r.x,p.ctx],['Y',r.y,p.cty]].map(([name,d,ct])=>`<h3>${name} 向</h3>`+F(`Tc = Ct × Hn^0.75 = ${ct} × ${p.height}^0.75 = ${N(d.Tc)} s<br>1.4Tc = ${N(1.4*d.Tc)} s<br>T = min(T分析, 1.4Tc) = min(${N(d.T)}, ${N(1.4*d.Tc)}) = ${N(d.t)} s<br>Ra = 1 + (R−1)/${denom} = 1 + (${d.R}−1)/${denom} = ${N(d.ra)}`)+fuTrace('Fu',d.t,d.ra,r.t0)+fuTrace('FuM（以 R 取代 Ra）',d.t,d.R,fumT)+fuTrace('Fu*（中小度地震）',d.t,d.ra,smallT)).join(''));
 h+=step('05','X／Y 反應譜逐段代入', [['X',r.x],['Y',r.y]].map(([name,d])=>`<h3>${name} 向</h3>`+saTrace('SaD',d.t,r.s,r.s1)+saTrace('SaM',d.t,r.m,r.m1)+saTrace('SaD*（中小度）',d.t,small[0],small[1])).join(''));
 h+=step('06','水平係數、三工況包絡與總橫力 · §2.2、2.10',coeff(r.x,'X 向')+coeff(r.y,'Y 向'));
 h+=step('07','垂直譜、折減與係數 · §2.18',F(`Tv = ${N(p.tv)} s（直接採輸入垂直週期）<br>Rv = ${p.rv}；Rav = 1 + (${p.rv}−1)/${denom} = ${N(r.z.ra)}<br>垂直／水平譜倍率 kv = ${p.mode==='near'?'2/3':'1/2'} = ${N(kv)}`)+fuTrace('Fu,v',p.tv,r.z.ra,r.t0)+fuTrace('FuM,v',p.tv,p.rv,fumT)+fuTrace('Fu*,v',p.tv,r.z.ra,smallT)+saTrace('SaD,v',p.tv,r.s,r.s1,kv)+saTrace('SaM,v',p.tv,r.m,r.m1,kv)+saTrace('SaD*,v',p.tv,small[0],small[1],kv)+coeff(r.z,'梁與樓板 Kz',true)+F(`梁與樓板垂直載重 = ±${N(r.z.C)} × 對應靜載重<br>柱牆自重垂直係數 = 0.4 × kv × SDS × I / αy<br>= 0.4 × ${N(kv)} × ${N(r.s)} × ${p.I} / ${p.ay} = ±${N(r.columnC)}<br>柱牆垂直載重 = ±${N(r.columnC)} × 對應自重`));
 h+=step('08','層間位移用地震力 · §2.16.1',[['X',r.x],['Y',r.y]].map(([name,d])=>{const fd=Engine.fu(d.T,d.ra,r.t0),sa=Engine.spectrum(d.T,r.s,r.s1,false),m=Engine.modify(sa/fd);return `<h3>${name} 向</h3><p>採原分析週期，I=1，不套用 1.4Tc 限制或 0.4SDS 下限。</p>`+fuTrace('Fu,位移',d.T,d.ra,r.t0)+saTrace('SaD,位移',d.T,r.s,r.s1,1,false)+modTrace('位移用修正',sa,fd)+F(`VD/W = Fu × m(SaD/Fu)/4.2<br>= ${N(fd)} × ${N(m)} / 4.2 = ${N(d.driftC)}<br>VD = ${N(d.driftC)} × ${N(r.W)} = ${N(d.driftV)} tf<br>VD/V = ${N(d.driftV)} / ${N(d.V)} = ${N(d.driftV/d.V)}`);}).join('')+'<p>本頁只計算位移分析所施加的地震力；實際側移仍需結構模型分析。</p>');
 const depthFactor=Math.max(1-p.depth/40,.5),kb=.1*depthFactor*p.I,kd=kb*r.s,ks=kd/r.div,km=kb*r.m;
 h+=step('09','地下室逐項代入 · §2.12',F(`H = ${p.depth} m；該層靜載重 Wb = ${p.bw} tf<br>深度因子 = max(1−H/40, 0.5) = max(1−${p.depth}/40, 0.5) = ${N(depthFactor)}<br>KD = 0.1 × ${N(depthFactor)} × ${N(r.s)} × ${p.I} = ${N(kd)}<br>K* = KD/${r.div} = ${N(kd)}/${r.div} = ${N(ks)}<br>KM = 0.1 × ${N(depthFactor)} × ${N(r.m)} × ${p.I} = ${N(km)}<br>設計地震力 = KD × Wb = ${N(kd)} × ${p.bw} = ${N(kd*p.bw)} tf<br>中小度地震力 = K* × Wb = ${N(ks)} × ${p.bw} = ${N(ks*p.bw)} tf<br>最大考量地震力 = KM × Wb = ${N(km)} × ${p.bw} = ${N(km*p.bw)} tf`)+ '<p>三個工況分別使用，不合併成單一樓層載重。</p>');
 const wh=p.floors.reduce((s,f)=>s+f.w*f.h,0);
 h+=step('10','樓層分配、層剪力與基面力矩',[['X',r.x,r.dx],['Y',r.y,r.dy]].map(([name,d,dist])=>`<h3>${name} 向</h3>`+F(`Ft = ${d.t<=.7?`0（T = ${N(d.t)} s ≤ 0.7 s）`:`min(0.07T, 0.25) × V = min(0.07 × ${N(d.t)}, 0.25) × ${N(d.V)} = ${N(dist.ft)} tf`}<br>Fi = (V−Ft)Wi hi/ΣWj hj，屋頂另加 Ft<br>ΣWj hj = ${N(wh)} tf·m`)+dist.rows.map((f,i)=>F(`${i+1}F：F${i+1} = (${N(d.V)}−${N(dist.ft)}) × ${N(f.w)} × ${N(f.h)} / ${N(wh)}${i===dist.rows.length-1?` + ${N(dist.ft)}`:''} = ${N(f.force)} tf<br>Q${i+1} = ${dist.rows.slice(i).map(x=>N(x.force)).join(' + ')} = ${N(f.shear)} tf`)).join('')+F(`ΣFi = ${dist.rows.map(f=>N(f.force)).join(' + ')} = ${N(dist.sumForce)} tf<br>平衡誤差 ΣFi−V = ${N(dist.sumForce-d.V)} tf<br>基面力矩 ΣFi hi = ${dist.rows.map(f=>`${N(f.force)} × ${N(f.h)}`).join(' + ')} = ${N(dist.moment)} tf·m（未折減）`)).join(''));
 $('steps').innerHTML=h;
}

$('addFloor').onclick=()=>{const h=(floors.at(-1)?.h||0)+4;floors.push({h,w:500});$('height').value=h;floorUI();update();};
$('floorInputs').addEventListener('input',e=>{const i=e.target.dataset.floor;if(i===undefined)return;floors[+i][e.target.dataset.key]=e.target.value===''?NaN:+e.target.value;if(e.target.dataset.key==='h'&&+i===floors.length-1)$('height').value=e.target.value;update();});
$('floorInputs').addEventListener('click',e=>{const i=e.target.dataset.removeFloor;if(i===undefined||floors.length===1)return;floors.splice(+i,1);$('height').value=floors.at(-1).h;floorUI();update();});
$('addFault').onclick=()=>{faults.push({index:0,distance:5});faultUI();update();};
$('faultRows').addEventListener('change',e=>{const i=e.target.dataset.fault;if(i===undefined)return;faults[+i][e.target.dataset.key]=e.target.value===''?NaN:+e.target.value;if(e.target.dataset.key==='index')faultUI();update();});
$('faultRows').addEventListener('input',e=>{if(e.target.dataset.key!=='distance')return;faults[+e.target.dataset.fault].distance=e.target.value===''?NaN:+e.target.value;update();});
$('faultRows').addEventListener('click',e=>{const i=e.target.dataset.removeFault;if(i===undefined)return;faults.splice(+i,1);faultUI();update();});
$('height').addEventListener('input',()=>{const h=Number($('height').value);if(h>0&&Number.isFinite(h)){let old=floors.at(-1).h;if(old>0)floors=floors.map(f=>({...f,h:Math.round(f.h*h/old*1000)/1000}));floorUI();}});
vs30Init();
document.querySelectorAll('aside input,aside select').forEach(el=>{if(el.closest('#vsRows')||['city','district','village'].includes(el.id))return;el.addEventListener('input',update);el.addEventListener('change',update);});
function resultTab(b){document.querySelectorAll('[data-tab]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-selected',String(x===b));x.tabIndex=x===b?0:-1;});document.querySelectorAll('.tab').forEach(s=>s.hidden=s.id!==b.dataset.tab);}
document.querySelectorAll('[data-tab]').forEach(b=>{b.id='result-tab-'+b.dataset.tab;b.setAttribute('role','tab');b.setAttribute('aria-controls',b.dataset.tab);b.setAttribute('aria-selected',String(b.classList.contains('active')));b.tabIndex=b.classList.contains('active')?0:-1;$(b.dataset.tab).setAttribute('role','tabpanel');$(b.dataset.tab).setAttribute('aria-labelledby',b.id);b.onclick=()=>resultTab(b);});
function inputTab(b){document.querySelectorAll('[data-input-tab]').forEach(x=>{let active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-selected',String(active));x.tabIndex=active?0:-1;$('input-'+x.dataset.inputTab).hidden=!active;});document.querySelector('.input-scroll').scrollTop=0;}
document.querySelectorAll('[data-input-tab]').forEach(b=>b.onclick=()=>inputTab(b));
document.querySelectorAll('[role=tablist]').forEach(list=>list.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const buttons=[...list.querySelectorAll('[role=tab]')],i=buttons.indexOf(document.activeElement);if(i<0)return;e.preventDefault();const j=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[j].click();buttons[j].focus();}));
$('editWeights').onclick=()=>{resultTab(document.querySelector('[data-tab=floors]'));$('resultPanel').scrollIntoView({behavior:'smooth',block:'start'});};
$('expandSteps').onclick=()=>{const all=[...document.querySelectorAll('#steps details')],expand=!all.every(el=>el.open);all.forEach(el=>{el.open=expand;if(expand)openSteps.add(el.dataset.step);else openSteps.delete(el.dataset.step);});$('expandSteps').textContent=expand?'收合全部':'展開全部';$('expandSteps').setAttribute('aria-expanded',String(expand));};
let printOpen=[];window.addEventListener('beforeprint',()=>{printOpen=[...document.querySelectorAll('#steps details')].map(el=>el.open);document.querySelectorAll('#steps details').forEach(el=>el.open=true);});window.addEventListener('afterprint',()=>document.querySelectorAll('#steps details').forEach((el,i)=>el.open=printOpen[i]??false));

$('chartType').onchange=renderChart;$('print').onclick=()=>{if(current)window.print();};floorUI();faultUI();modeUI();update();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_seismic_calculation',description:'讀取本頁目前地震力參數與計算結果；不代表結構安全檢核。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||Object.keys(input).length)throw Error('不接受額外參數');if(!current)throw Error('輸入未完成');return {parameters:params,W:current.W,x:current.x,y:current.y,z:current.z,dynamicRequired:current.dynamic};}})).catch(()=>{});}catch(e){}}


