/* §11.2: 10% exceedance over service life. Poisson conversion is not a force reduction. */
(function(root){
'use strict';
const P=.10, LOG=-Math.log1p(-P), G=9.80665;
const positive=(v,label)=>{const n=typeof v==='number'?v:Number(String(v).trim());if(v==null||String(v).trim()===''||!Number.isFinite(n)||n<=0)throw new Error(label+'須為大於 0 的有限數值');return n;};
const optional=(v,label)=>v==null||String(v).trim()===''?null:positive(v,label);
function calculate(input){
 const duration=positive(input.duration,'使用期間');
 const divisor={year:1,month:12,day:365.25}[input.unit];
 if(!divisor)throw new Error('請選擇年、月或日');
 const years=duration/divisor,returnPeriod=years/LOG;
 if(!Number.isFinite(returnPeriod)||returnPeriod<=0||!Number.isFinite(1/returnPeriod))throw new Error('使用期間超出可計算範圍');
 const checkReturn=positive(input.checkReturn,'指定回歸期');
 const probability=-Math.expm1(-years/checkReturn);
 const covered=checkReturn>=returnPeriod*(1-1e-12);
 const r={duration,unit:input.unit,years,targetProbability:P,returnPeriod,checkReturn,probability,covered,maxLife:checkReturn*LOG,annualRate:1/returnPeriod,annualProbability:-Math.expm1(-1/returnPeriod),force:null,forceErrors:[]};
 if(input.forceEnabled){
  try{
   if(!covered)throw new Error('指定回歸期小於本次目標；請重新取得涵蓋使用期間的地震危害與設計係數。');
   for(const [key,label] of [['site','工址與施工階段'],['durationSource','使用期間依據'],['hazardSource','地震危害資料來源'],['designSource','設計係數推導依據']])if(!String(input[key]||'').trim())throw new Error('請填寫'+label);
   if(!input.confirmed)throw new Error('請確認係數對應指定回歸期、工址及本次施工階段。');
   const w=positive(input.w,'階段地震重量 W'),ch=positive(input.ch,'水平設計力係數 Ch'),cv=optional(input.cv,'垂直設計力係數 Cv');
   const capH=optional(input.capH,'水平承載力'),capV=optional(input.capV,'垂直承載力');
   if(capV!==null&&cv===null)throw new Error('已填垂直承載力，請補上垂直係數。');
   if((capH!==null||capV!==null)&&!String(input.capacitySource||'').trim())throw new Error('承載力比較須填同一設計基準的承載力依據。');
   const fh=ch*w,fv=cv===null?null:cv*w;
   if(!Number.isFinite(fh)||!Number.isFinite(fh*G)||(fv!==null&&!Number.isFinite(fv*G)))throw new Error('地震力超出可計算範圍');
   const dh=capH===null?null:fh/capH,dv=capV===null?null:fv/capV;
   if((dh!==null&&!Number.isFinite(dh))||(dv!==null&&!Number.isFinite(dv)))throw new Error('需求承載比超出可計算範圍');
   r.force={w,ch,cv,fh,fv,fhKN:fh*G,fvKN:fv===null?null:fv*G,capH,capV,dh,dv};
  }catch(e){r.forceErrors.push(e.message);}
 }
 return r;
}
const examples=[.25,.5,1,2,3,5,10,50].map(years=>({years,returnPeriod:years/LOG}));
root.ShortTermEngine=Object.freeze({calculate,examples,P,LOG});
if(typeof module!=='undefined'&&module.exports)module.exports=root.ShortTermEngine;
})(typeof globalThis!=='undefined'?globalThis:window);
