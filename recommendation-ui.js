/* LernPoker recommendation header. For 6-max: sampled EV-weighted training mix.
 * This is NOT a proven GTO solution; the mixed percentages are model assumptions.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const names={FOLD:'Fold',CHECK:'Check',CALL:'Call',RAISE:'Raise','3BET':'3-Bet','4BET':'4-Bet',JAM:'All-in',LIMP:'Limp'};
const num=n=>Number(n).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});
const aggressive=new Set(['RAISE','3BET','4BET','JAM']);
function label(entry){
 let name=names[entry.action]||entry.action;
 if(entry.bluff&&aggressive.has(entry.action))name+='-Bluff';
 if(entry.action==='JAM')return name;
 if(entry.action==='LIMP')return 'Limp';
 if(entry.action==='CALL'&&Number.isFinite(entry.toBB))return name+' · '+num(entry.toBB)+' BB';
 if(aggressive.has(entry.action)&&Number.isFinite(entry.toBB))return name+' auf '+num(entry.toBB)+' BB';
 return name;
}
function percentages(options){
 const floors=options.map(x=>Math.floor(x.p*100));
 let remainder=100-floors.reduce((a,b)=>a+b,0);
 const order=options.map((x,i)=>({i,decimal:x.p*100-floors[i]})).sort((a,b)=>b.decimal-a.decimal);
 for(let j=0;j<remainder;j++)floors[order[j%order.length].i]++;
 return floors;
}
function init(){
 const nav=document.querySelector('.nav-mobile'),picker=$('quick-picker');
 if(!nav||!picker)return;
 const bar=document.createElement('section');bar.id='quick-sticky-recommendation';
 bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');
 bar.innerHTML='<div class="quick-rec-line"><span id="quick-rec-hand">–</span>'+
 '<strong id="quick-rec-action">Eingabe bereit</strong>'+
 '<button id="quick-mix-reroll" type="button" hidden aria-label="Neue Empfehlung gemäß Modellwahrscheinlichkeiten ziehen">Neu ziehen</button></div>'+
 '<div id="quick-rec-detail" class="quick-rec-detail"></div>'+
 '<div id="quick-rec-mix" class="quick-rec-mix" hidden aria-label="Wahrscheinlichkeiten des Trainingsmixes"></div>';
 nav.before(bar);
 const details=document.createElement('div');details.id='quick-sizing-results';details.className='quick-sizing-results';
 const handDetail=document.querySelector('.panel.accent .details');
 if(handDetail)handDetail.after(details);
 let salt=Math.floor(Math.random()*4294967296)>>>0,drawCount=0,signature='',last=null;
 function clearMix(){
  $('quick-mix-reroll').hidden=true;
  $('quick-rec-mix').hidden=true;
  $('quick-rec-mix').replaceChildren();
  last=null;
 }
 function doSixMax(hand,h,source,training){
  const mix=window.LernPokerMix?.calculate(D,source,training,hand,h);
  details.hidden=true;
  if(!mix?.enabled){
   clearMix();
   $('quick-rec-action').textContent=names[h.action]||h.action;
   $('quick-rec-detail').textContent='Modellmix nicht verfügbar · '+(mix?.reason||'Situation prüfen');
   return;
  }
  const newSig=JSON.stringify({hand,inputs:source,training});
  if(newSig!==signature){signature=newSig;drawCount=0;}
  const r=window.LernPokerMix.u01(signature,(salt+Math.imul(drawCount,0x9e3779b9))>>>0);
  const picked=window.LernPokerMix.sample(mix,r);
  last={mix,hand,picked};
  $('quick-rec-action').textContent=label(picked);
  $('quick-rec-detail').textContent=(picked.bluff?'Bluffkandidat · ':'')+
   'Modellmix · '+Math.round(picked.p*100)+' % für diese Aktion · nicht solverbestätigt';
  const box=$('quick-rec-mix');box.hidden=false;box.replaceChildren();
  const pc=percentages(mix.options);
  mix.options.forEach((o,i)=>{
   const x=document.createElement('span');x.className='quick-mix-option';
   if(o.id===picked.id)x.classList.add('chosen');
   x.textContent=label(o)+' '+pc[i]+' %';
   box.append(x);
  });
  $('quick-mix-reroll').hidden=false;
 }
 function update(){
  try{
   const activeTab=nav.querySelector('button.active')?.dataset.tab||'trainer';
   bar.hidden=!['trainer','matrix'].includes(activeTab);
   if(bar.hidden)return;
   const blocked=document.querySelector('.panel.accent')?.classList.contains('quick-blocked');
   const err=$('quick-range-limit')?.textContent||'';
   const hand=typeof selectedHand==='string'?selectedHand:($('hand-name')?.textContent||'–');
   const model=typeof current!=='undefined'?current:null;
   const h=model?.hands?.[hand];
   $('quick-rec-hand').textContent=hand;
   if(blocked||!h){
    clearMix();details.hidden=true;signature='';
    $('quick-rec-action').textContent='Keine Empfehlung';
    $('quick-rec-detail').textContent=blocked?(err||'Bitte Eingaben prüfen.'):'Situation eingeben';
    return;
   }
   const training=window.LernPokerTrainingState;
   const source=typeof selectedInputs==='function'?selectedInputs():null;
   if(Number(source?.players)===6&&training&&window.LernPokerMix){
    doSixMax(hand,h,source,training);return;
   }
   clearMix();signature='';
   details.hidden=true;
   let action=names[h.action]||h.action,meta='';
   if(['RAISE','3BET','4BET'].includes(h.action)&&training&&source&&window.LernPokerSizing){
    const sizing=window.LernPokerSizing.analyze(D,source,{
      ...training,heroStackBB:training.heroStackBB,
      scenario:training.scenario||{mode:'before',heroStackBB:training.heroStackBB,seatStacks:training.seatStacks,actions:[]}
    },hand);
    if(sizing.best){action+=' auf '+num(sizing.best.toBB)+' BB';meta='Modellierte Raisegröße: '+sizing.best.percent+' % Pot';}
    else meta='Keine der vier getesteten Potgrößen ist hier zulässig.';
    if(sizing.options?.length){
     details.hidden=false;
     const title=document.createElement('strong');title.textContent='Raisegrößen · Modellvergleich';
     const list=document.createElement('div');list.className='quick-sizing-list';
     for(const o of sizing.options){
      const cell=document.createElement('div');cell.className='quick-sizing-result';
      if(sizing.best&&o.legal&&o.percent===sizing.best.percent)cell.classList.add('best');
      const b=document.createElement('b');b.textContent=o.percent+' % Pot';
      const n=document.createElement('span');n.textContent=o.legal?'Auf '+num(o.toBB)+' BB':o.reason||'Nicht zulässig';
      const ev=document.createElement('small');ev.textContent=o.legal?'EV ≈ '+num(o.ev)+' BB':'';
      cell.append(b,n,ev);list.append(cell);
     }
     details.replaceChildren(title,list);
    }
   }else if(h.action==='JAM'){
    const value=training?.heroStackBB||model.context?.stackBB;
    if(Number.isFinite(value))action='All-in · '+num(value)+' BB';
   }else if(h.action==='CALL'){
    const cost=Number(model.context?.callCostBB??h.callCost);
    if(Number.isFinite(cost)&&cost>0)action='Call · '+num(cost)+' BB';
   }else if(h.action==='LIMP')action='Limp · 1,0 BB';
   $('quick-rec-action').textContent=action;
   $('quick-rec-detail').textContent=meta;
  }catch(e){
   clearMix();
   $('quick-rec-action').textContent='Eingaben prüfen';
   $('quick-rec-detail').textContent=String(e?.message||e);
   details.hidden=true;
  }
 }
 $('quick-mix-reroll').addEventListener('click',()=>{
  drawCount++;update();
 });
 window.LernPokerRefreshRecommendation=update;
 const handResult=$('hand-action'),name=$('hand-name');
 if(handResult)new MutationObserver(update).observe(handResult,{childList:true,characterData:true,subtree:true});
 if(name)new MutationObserver(update).observe(name,{childList:true,characterData:true,subtree:true});
 const accent=document.querySelector('.panel.accent');
 if(accent)new MutationObserver(update).observe(accent,{attributes:true,attributeFilter:['class']});
 nav.addEventListener('click',()=>setTimeout(update,0));
 picker.addEventListener('change',()=>setTimeout(update,0));
 picker.addEventListener('input',()=>setTimeout(update,0));
 update();
}
window.addEventListener('DOMContentLoaded',init);
})();
