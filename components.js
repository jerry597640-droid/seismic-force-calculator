'use strict';
(()=>{
const n=id=>$(id).value.trim()===''?NaN:Number($(id).value);
let capacityRuns={};
function typeOptions(){const group=$('cpGroup').value,custom=group==='custom';$('cpCustomLabel').hidden=!custom;$('cpTypeLabel').hidden=custom;$('cpAp').readOnly=!custom;$('cpRp').readOnly=!custom;if(!custom){$('cpType').innerHTML=ComponentEngine.types.map((t,i)=>t[0]===group?`<option value="${i}">${esc(t[1])}</option>`:'').join('');applyType();}else render();}
function applyType(){const t=ComponentEngine.types[Number($('cpType').value)];if(t){$('cpAp').value=t[2];$('cpRp').value=t[3];}render();}
function capacity(id,demand){const text=$(id).value.trim();if(!text){capacityRuns[id]={provided:false,demand};return ['未輸入','—','未檢核'];}let c=Number(text);if(!Number.isFinite(c)||c<=0)throw Error('選填的設計承載力須為正數，或清空以略過比較。');let q=demand/c;capacityRuns[id]={provided:true,demand,capacity:c,ratio:q,ok:q<=1};return [fmt(c,3),fmt(q,3),q<=1?'需求 ≤ 輸入承載力':'需求 > 輸入承載力'];}
function render(){globalThis.SeismicComponentRun=null;capacityRuns={};try{
if(!current||!params)throw Error('請先修正主建築輸入參數，才能取得有效的 SDS、I 與 hn。');
const selection=$('cpFloor').value;if(selection==='roof')$('cpHx').value=params.height;else if(selection==='base')$('cpHx').value=0;else if(selection.startsWith('floor:')){let f=params.floors[Number(selection.slice(6))];if(!f){$('cpFloor').value='roof';$('cpHx').value=params.height;}else $('cpHx').value=f.h;}
$('cpHx').readOnly=$('cpFloor').value!=='manual';
let p={mode:params.mode,sds:current.s,I:params.I,hn:params.height,hx:n('cpHx'),w:n('cpW'),ip:n('cpIp'),ap:n('cpAp'),rp:n('cpRp')};
const custom=$('cpGroup').value==='custom';if(custom&&!$('cpCustom').value.trim())throw Error('請填入自訂 ap、Rp 的依據。');const r=ComponentEngine.calculate(p),hcap=capacity('cpCapH',r.fh),vcap=capacity('cpCapV',r.fv),type=custom?'自訂：'+$('cpCustom').value:ComponentEngine.types[Number($('cpType').value)][1];
globalThis.SeismicComponentRun={p,r,type,group:$('cpGroup').value,typeIndex:Number($('cpType').value),capacities:JSON.parse(JSON.stringify(capacityRuns))};
$('componentContext').textContent=`連動工址：${$('mode').selectedOptions[0].text} ｜ SDS = ${fmt(p.sds)} ｜ 建築物 I = ${fmt(p.I,2)} ｜ hn = ${fmt(p.hn,2)} m`;
$('cpError').hidden=true;$('cpResults').innerHTML=`<div class="cp-cards cp-coefficients"><div><span>設計水平地震力係數</span><strong>${fmt(r.coefficient,4)}</strong><p>Fph / Wp · 無因次 · ${r.control}</p></div><div><span>設計垂直地震力係數</span><strong>±${fmt(r.fv/p.w,4)}</strong><p>±Fpv / Wp · 無因次 · ${p.mode==='near'?'2/3':'1/2'} × 水平係數</p></div></div><div class="cp-cards"><div><span>設計水平地震力 Fph</span><strong>${fmt(r.fh,3)} <small>tf</small></strong><p>${fmt(r.fh*9.80665,3)} kN · ${r.control}</p></div><div><span>設計垂直地震力 ±Fpv</span><strong>±${fmt(r.fv,3)} <small>tf</small></strong><p>±${fmt(r.fv*9.80665,3)} kN · ${p.mode==='near'?'2/3':'1/2'} Fph</p></div></div>
<div class="note">採用 Ip = ${fmt(r.ip,2)}${r.ip>p.ip?'（由建築物 I 提高）':''}；係數採用上下限檢核後的設計地震力除以 Wp。<br>以下為設計地震力需求，並非構材與錨定系統整體合格判定。</div>
<h3>上下限檢核</h3>${table(['項目','設計力（tf）'],[['基本式 Fph,raw',fmt(r.raw,4)],['下限 0.3 SDS Ip Wp',fmt(r.min,4)],['上限 1.6 SDS Ip Wp',fmt(r.max,4)],['採用 Fph',fmt(r.fh,4)]])}
<h3>詳細計算 · §4.2</h3><p class="hint">${esc(type)}${custom?'':'｜表 '+esc($('cpGroup').value)}</p><div class="formula">
Ip = max(設備用途係數, 建築物 I) = max(${fmt(p.ip,2)}, ${fmt(p.I,2)}) = ${fmt(r.ip,2)}<br>
Rpa = 1 + (Rp − 1) / ${p.mode==='basin'?'2.0':'1.5'}<br>　= 1 + (${p.rp} − 1) / ${p.mode==='basin'?'2.0':'1.5'} = ${fmt(r.rpa)}<br>
高度放大 = 1 + 2hx/hn<br>　= 1 + 2 × ${fmt(p.hx,2)} / ${fmt(p.hn,2)} = ${fmt(r.height)}<br>
Fph,raw = 0.4 × SDS × Ip × (ap/Rpa) × (1+2hx/hn) × Wp<br>　= 0.4 × ${fmt(p.sds)} × ${fmt(r.ip,2)} × (${p.ap}/${fmt(r.rpa)}) × ${fmt(r.height)} × ${fmt(p.w,3)}<br>　= ${fmt(r.raw,4)} tf　〔式 4-1a〕<br>
Fph,min = 0.3 × ${fmt(p.sds)} × ${fmt(r.ip,2)} × ${fmt(p.w,3)} = ${fmt(r.min,4)} tf　〔式 4-1c〕<br>
Fph,max = 1.6 × ${fmt(p.sds)} × ${fmt(r.ip,2)} × ${fmt(p.w,3)} = ${fmt(r.max,4)} tf　〔式 4-1b〕<br>
Fph = min(Fph,max, max(Fph,min, Fph,raw))<br>　= min(${fmt(r.max,6)}, max(${fmt(r.min,6)}, ${fmt(r.raw,6)})) = ${fmt(r.fh,6)} tf<br>控制判斷：${r.control}<br>
Fpv = ${p.mode==='near'?'2/3':'1/2'} × ${fmt(r.fh,4)} = ±${fmt(r.fv,4)} tf　〔式 ${p.mode==='near'?'4-3b':'4-3a'}〕<br>
設計水平地震力係數 = Fph / Wp = ${fmt(r.fh,4)} / ${fmt(p.w,3)} = ${fmt(r.coefficient,4)}<br>
設計垂直地震力係數 = ±Fpv / Wp = ±${fmt(r.fv,4)} / ${fmt(p.w,3)} = ±${fmt(r.fv/p.w,4)}　（無因次）<br>水平力換算：${fmt(r.fh,6)} tf × 9.80665 = ${fmt(r.fh*9.80665,6)} kN<br>垂直力換算：±${fmt(r.fv,6)} tf × 9.80665 = ±${fmt(r.fv*9.80665,6)} kN</div>
<h3>輸入承載力比較</h3><div class="formula">${$('cpCapH').value.trim()?`水平需求／承載力 = ${fmt(r.fh,6)} / ${fmt(n('cpCapH'),6)} = ${fmt(r.fh/n('cpCapH'),6)}`:'水平承載力未輸入，不作比較'}<br>${$('cpCapV').value.trim()?`垂直需求／承載力 = ${fmt(r.fv,6)} / ${fmt(n('cpCapV'),6)} = ${fmt(r.fv/n('cpCapV'),6)}`:'垂直承載力未輸入，不作比較'}</div>${table(['方向','承載力（tf）','需求／承載力','比較結果'],[['水平',...hcap],['垂直',...vcap]])}<p class="hint">承載力比較僅針對本次地震力分量，未包含其他載重效應與組合；垂直地震力須考慮正負方向。</p>${p.w<=.2?'<p class="note">Wp ≤ 0.2 tf：請另核對 §4.1 小型設備附件豁免條件，本工具仍顯示計算需求。</p>':''}`;
}catch(e){$('componentContext').textContent=current?`SDS = ${fmt(current.s)}；請完成本模組輸入。`:'工址結果尚未有效，暫停計算。';$('cpError').hidden=false;$('cpError').className='status error';$('cpError').textContent=e.message;$('cpResults').innerHTML='';}document.dispatchEvent(new Event('component-updated'));}
function syncFloors(){const previous=$('cpFloor').value;$('cpFloor').innerHTML='<option value="roof">屋頂（自動連動 hn）</option><option value="base">基面（hx = 0）</option>'+floors.map((f,i)=>`<option value="floor:${i}">${i+1}F · h = ${esc(f.h)} m</option>`).join('')+'<option value="manual">自行輸入 hx</option>';if([...$('cpFloor').options].some(o=>o.value===previous))$('cpFloor').value=previous;render();}
$('cpGroup').onchange=typeOptions;$('cpType').onchange=applyType;['cpAp','cpRp','cpW','cpHx','cpIp','cpCustom','cpCapH','cpCapV'].forEach(id=>$(id).addEventListener('input',render));$('cpFloor').onchange=render;document.addEventListener('seismic-updated',syncFloors);typeOptions();syncFloors();
})();

