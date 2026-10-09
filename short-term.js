(()=>{
'use strict';
const $=id=>document.getElementById(id),E=ShortTermEngine;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,d=4)=>Number(v).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
const fields={duration:'stDuration',unit:'stUnit',checkReturn:'stCheckReturn',site:'stSite',durationSource:'stDurationSource',hazardSource:'stHazardSource',designSource:'stDesignSource',w:'stW',ch:'stCh',cv:'stCv',capH:'stCapH',capV:'stCapV',capacitySource:'stCapacitySource'};
let snapshot=null,isExample=false;
const read=()=>({...Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,$(id).value])),forceEnabled:$('stForceEnabled').checked,confirmed:$('stConfirmed').checked,isExample});
const unitText={year:'年',month:'月',day:'日'};
function steps(p,r){
 return [
 {title:'將使用期間換算成年',formula:'t = 月數 ÷ 12；或日數 ÷ 365.25',substitution:`${p.duration} ${unitText[p.unit]} → ${n(r.years,8)} 年`,result:r.years,unit:'年',source:p.durationSource||'尚未提供施工計畫依據；目前為換算試算'},
 {title:'求目標回歸期',formula:'P = 1 − exp(−t/R)；R = −t / ln(1 − P)',substitution:`P = 0.10；R = −${n(r.years,8)} / ln(0.90)`,result:r.returnPeriod,unit:'年',source:'台灣規範 §11.2 解說的期間內 10%；Poisson 機率轉換',condition:'時間獨立、定常年超越率假設；不是地震發生日期預報。'},
 {title:'檢核指定回歸期',formula:'Pcheck = 1 − exp(−t / Rcheck)',substitution:`1 − exp(−${n(r.years,8)} / ${n(r.checkReturn,8)}) = ${n(r.probability*100,8)}%`,result:r.probability*100,unit:'%',condition:r.covered?'期間內超越機率不超過 10%；僅為機率條件滿足。':'超過 10%；指定回歸期不足以涵蓋本次期間。'},
 {title:'反算同一機率下的最長使用期間',formula:'t10 = −Rcheck × ln(0.90)',substitution:`−${n(r.checkReturn,8)} × ln(0.90) = ${n(r.maxLife,8)} 年`,result:r.maxLife,unit:'年',condition:'延期須重新計算；此換算不是施工許可年限。'}
 ];
}
function comparison(ratio){return ratio===null?'未檢核（未填承載力）':`D/C = ${n(ratio)}，${ratio<=1?'輸入地震需求未超過承載力':'輸入地震需求超過承載力'}`;}
function report(p,r){
 const list=steps(p,r),f=r.force;
 if(f){list.push({title:'水平地震力需求',formula:'Fh = Ch × W',substitution:`${f.ch} × ${f.w}`,result:f.fh,unit:'tf',source:p.designSource});if(f.fv!==null)list.push({title:'垂直地震力需求',formula:'Fv = ±Cv × W',substitution:`±${f.cv} × ${f.w}`,result:`±${n(f.fv,8)}`,unit:'tf',source:p.designSource});if(f.dh!==null)list.push({title:'水平需求／承載力比',formula:'D/C = Fh / CapH',substitution:`${f.fh} / ${f.capH}`,result:f.dh,condition:comparison(f.dh),source:p.capacitySource});if(f.dv!==null)list.push({title:'垂直需求／承載力比',formula:'D/C = |Fv| / CapV',substitution:`${f.fv} / ${f.capV}`,result:f.dv,condition:comparison(f.dv),source:p.capacitySource});}
 if(f){list.push({title:'力的單位換算',formula:'1 tf = 9.80665 kN',substitution:`Fh = ${f.fh} × 9.80665；Fv 同樣換算`,result:`Fh = ${n(f.fhKN,8)} kN；Fv = ${f.fvKN===null?'未計算':'±'+n(f.fvKN,8)+' kN'}`});}
 const labels={duration:'使用期間',unit:'期間單位',checkReturn:'指定回歸期（年）',site:'工址／施工階段',durationSource:'期間依據',hazardSource:'地震危害資料',designSource:'設計係數推導依據',w:'階段重量（tf）',ch:'水平係數 Ch',cv:'垂直係數 Cv',capH:'水平承載力（tf）',capV:'垂直承載力（tf）',capacitySource:'承載力依據'};
 return {title:'短期地震力與回歸期檢核',valid:true,summary:`v2026-10-09；台灣規範 §11.2 解說。${p.isExample?'教學假設案例，Ch、Cv 不是規範表值。':'使用者專案輸入，未自動判定地震危害。'} 回歸期換算不等於地震力折減。`,inputs:Object.entries(fields).filter(([k])=>p.forceEnabled||!['hazardSource','designSource','w','ch','cv','capH','capV','capacitySource'].includes(k)).map(([k])=>({label:labels[k],value:k==='unit'?unitText[p.unit]:p[k]||'未填',unit:k==='unit'?'':'—'})),steps:list,conclusions:[`目標 R = ${n(r.returnPeriod,8)} 年；Rcheck = ${r.checkReturn} 年；期間內超越機率 ${n(r.probability*100,8)}%。`,r.covered?'機率條件不超過 10%；不代表結構安全通過。':'指定回歸期之超越機率超過 10%。',f?`Fh=${n(f.fh)} tf；Fv=${f.fv===null?'未計算':'±'+n(f.fv)+' tf'}。${comparison(f.dh)}；垂直：${comparison(f.dv)}。`:'地震力未計算：'+(r.forceErrors.join('；')||'未啟用專案資料'), '地震危害依據：'+(p.forceEnabled?p.hazardSource||'未填':'未啟用'), '承載力比較僅針對輸入地震需求；尚未完成重力等載重組合、接頭、錨定、穩定、位移及震後彈性限度檢核。','官方來源：https://www.nlma.gov.tw/uploads/files/040e5f9b6b72d27a8fef6c52c6175e1a.pdf 第 11-19 頁；Poisson 換算參考 USGS Earthquake Hazards 201 Technical Q&A。'],tables:[{title:'使用期間與回歸期對照（期間內 10%）',headers:['使用年數','回歸期（年）'],rows:E.examples.map(e=>[String(e.years),n(e.returnPeriod,8)])}]};
}
function update(){
 const p=read();$('stForceInputs').disabled=!p.forceEnabled;$('stExampleBanner').hidden=!isExample;$('stExportStatus').textContent='';
 try{
  const r=E.calculate(p);snapshot={p,r};$('stError').hidden=true;$('stExport').disabled=false;$('stPrint').disabled=false;
  $('stResult').innerHTML=`<div class="st-card"><small>使用 ${esc(p.duration)} ${unitText[p.unit]} · 期間內超越機率 10%</small><span class="st-number">${n(r.returnPeriod)} <small>年</small></span><p>目標回歸期 R = −t / ln(0.90)</p></div><div class="st-dual"><div class="st-card st-muted"><small>指定 ${n(r.checkReturn,2)} 年回歸期</small><span class="st-number">${n(r.probability*100,3)}%</span><small>本次使用期間內超越機率</small></div><div class="st-card st-muted"><small>同為 10% 可對應的期間</small><span class="st-number">${n(r.maxLife,3)} 年</span><small>${n(r.maxLife*12,2)} 個月</small></div></div><div class="st-note ${r.covered?'':'st-warn'}">${r.covered?'機率條件：不超過 10%。仍須取得對應工址地震危害與完成結構檢核。':'機率條件：超過 10%。請提高指定回歸期，並重新確認專案地震需求。'}</div>`;
  $('stSteps').innerHTML=steps(p,r).map((s,i)=>`<div class="step"><h3>${i+1}. ${esc(s.title)}</h3><div class="formula">${esc(s.formula)}\n${esc(s.substitution)}\n結果：${n(s.result,8)} ${esc(s.unit)}</div></div>`).join('')+`<p class="hint">年超越率 λ＝1/R＝${n(r.annualRate,8)} 次／年；一年內超越機率為 1−exp(−1/R)＝${n(r.annualProbability*100,5)}%。λ 是率，尤其回歸期很短時不能直接當作機率。</p>`;
  const f=r.force;
  $('stForceResult').innerHTML=!p.forceEnabled?'<p class="st-note">目前僅換算回歸期；地震力尚未計算。需要工址危害資料與施工階段設計係數。</p>':r.forceErrors.length?`<p class="st-error">地震力暫停計算：${esc(r.forceErrors.join('；'))}</p>`:`<div class="st-dual"><div class="st-card"><small>水平設計力係數 Ch = ${n(f.ch)}</small><span class="st-number">${n(f.fh,3)} tf</span><small>${n(f.fhKN,3)} kN</small></div><div class="st-card"><small>垂直設計力係數 Cv = ${f.cv===null?'未填':'±'+n(f.cv)}</small><span class="st-number">${f.fv===null?'未計算':'±'+n(f.fv,3)+' tf'}</span><small>${f.fv===null?'須另提供垂直設計依據':'±'+n(f.fvKN,3)+' kN'}</small></div></div><div class="formula">Fh = Ch × W = ${f.ch} × ${f.w} = ${n(f.fh,8)} tf\n${f.fv===null?'Fv：未計算':`Fv = ±Cv × W = ±${f.cv} × ${f.w} = ±${n(f.fv,8)} tf`}\n水平：${comparison(f.dh)}\n垂直：${comparison(f.dv)}</div>`;
 }catch(e){snapshot=null;$('stError').hidden=false;$('stError').textContent=e.message;$('stResult').innerHTML='';$('stSteps').innerHTML='';$('stForceResult').textContent='回歸期輸入待修正，暫停地震力計算。';$('stExport').disabled=true;$('stPrint').disabled=true;}
}
$('shortterm').querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('input',()=>{if(['stDuration','stUnit','stCheckReturn','stSite','stDurationSource','stHazardSource','stDesignSource','stCh','stCv'].includes(el.id))$('stConfirmed').checked=false;update();}));
document.querySelectorAll('[data-st-months]').forEach(b=>b.addEventListener('click',()=>{$('stDuration').value=b.dataset.stMonths;$('stUnit').value='month';update();}));
$('stLoadExample').onclick=()=>{const sample={duration:6,unit:'month',checkReturn:5,site:'教學假設工址／臨時支撐階段（非實際基地）',durationSource:'教學：含設置至拆除共 6 個月',hazardSource:'教學假設：5 年回歸期。未提供真實工址危害報告，不可供設計。',designSource:'教學假設最終 Ch=0.12、Cv=0.06，非規範表列係數。',w:100,ch:.12,cv:.06,capH:15,capV:8,capacitySource:'教學假設：與需求同基準的系統承載力 15／8 tf，非實際試驗。'};Object.entries(sample).forEach(([k,v])=>$(fields[k]).value=v);isExample=true;$('stForceEnabled').checked=true;$('stConfirmed').checked=true;update();};
$('stClearForce').onclick=()=>{['site','durationSource','hazardSource','designSource','w','ch','cv','capH','capV','capacitySource'].forEach(k=>$(fields[k]).value='');isExample=false;$('stForceEnabled').checked=false;$('stConfirmed').checked=false;update();};
$('stExampleTable').innerHTML=E.examples.map(x=>`<tr><td>${x.years<1?x.years*12+' 個月':x.years+' 年'}</td><td>${x.years}</td><td>${n(x.returnPeriod)}</td></tr>`).join('');
$('stPrint').onclick=()=>{if(snapshot)window.print();};
$('stExport').onclick=async()=>{if(!snapshot)return;const frozen=structuredClone(snapshot);$('stExport').disabled=true;try{await CalculationDocx.download(report(frozen.p,frozen.r),'短期地震力_回歸期檢核.docx');$('stExportStatus').textContent='已匯出本次回歸期、來源與可計算的地震需求。';}catch(e){$('stExportStatus').textContent='匯出失敗：'+e.message;}finally{$('stExport').disabled=!snapshot;}};
let printDetails=[];window.addEventListener('beforeprint',()=>{if(!document.body.classList.contains('shortterm-active'))return;printDetails=[...$('shortterm').querySelectorAll('details')].map(el=>({el,open:el.open}));printDetails.forEach(x=>x.el.open=true);});window.addEventListener('afterprint',()=>{printDetails.forEach(x=>x.el.open=x.open);printDetails=[];});
update();if(location.hash==='#shortterm')$('moduleShortTerm').click();
})();
