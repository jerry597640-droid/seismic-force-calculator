'use strict';
(()=>{
const mobile=window.matchMedia('(max-width: 800px)');
const body=document.body;
function show(view){body.dataset.mobileView=view;document.querySelectorAll('[data-mobile]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mobile===view)));if(view==='components'||view==='details')document.querySelector(`[data-tab="${view}"]`).click();if(view==='results'&&$('components').hidden===false)document.querySelector('[data-tab="spectrum"]').click();if(mobile.matches)window.scrollTo({top:0,behavior:'instant'});}
document.querySelectorAll('[data-mobile]').forEach(b=>b.onclick=()=>show(b.dataset.mobile));
$('focusInput').onclick=()=>{const collapse=body.classList.toggle('parameters-collapsed');$('focusInput').setAttribute('aria-pressed',String(collapse));$('focusInput').textContent=collapse?'展開參數':'收合參數';};
$('moduleBuilding').onclick=()=>{show('results');document.querySelector('[data-tab="spectrum"]').click();};
$('moduleComponent').onclick=()=>show('components');
$('openVerification').onclick=()=>{show('results');document.querySelector('[data-tab="basis"]').click();};
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{const isComponent=b.dataset.tab==='components';$('activeViewName').textContent=b.textContent;['moduleBuilding','moduleComponent'].forEach((id,i)=>{$(id).classList.toggle('active',i===Number(isComponent));$(id).setAttribute('aria-pressed',String(i===Number(isComponent)));});if(mobile.matches){const view=isComponent?'components':b.dataset.tab==='details'?'details':'results';body.dataset.mobileView=view;document.querySelectorAll('[data-mobile]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.mobile===view)));}}));
$('editWeights').addEventListener('click',()=>{body.dataset.mobileView='results';document.querySelectorAll('[data-mobile]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mobile==='results')));});
document.querySelectorAll('a[href="#resultPanel"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();show('results');}));
function summary(){const valid=!!current;$('appState').textContent=valid?'計算已更新 · '+$('mode').selectedOptions[0].text:'輸入待修正 · 請查看提示';$('appState').classList.toggle('invalid',!valid);$('verticalSummary').innerHTML=valid?`<span>主建築垂直係數</span><b>梁版 Kz = ±${fmt(current.z.C)}</b><span>柱牆 = ±${fmt(current.columnC)}</span><small>各乘對應自重</small>`:'';document.querySelectorAll('input[type="number"]').forEach(el=>el.setAttribute('inputmode','decimal'));}
document.addEventListener('seismic-updated',summary);summary();
})();
// Help is embedded in both online and single-file offline editions.
document.addEventListener('click',event=>{const trigger=event.target.closest('[data-guide]');if(!trigger)return;const dialog=document.getElementById('guideDialog'),frame=document.getElementById('guideFrame');dialog.showModal();const jump=()=>frame.contentDocument?.getElementById(trigger.dataset.guide)?.scrollIntoView({behavior:'instant',block:'start'});if(frame.contentDocument?.readyState==='complete')jump();else frame.addEventListener('load',jump,{once:true});});
