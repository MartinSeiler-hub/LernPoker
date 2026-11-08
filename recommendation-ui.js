/* LerPoker V7: sticky recommendation, with optional modeled raise sizing.
   Shows only selected hand (not quiz answer). No other nav bar stays sticky. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const actionLabels={FOLD:'Fold',CHECK:'Check',CALL:'Call',RAISE:'Raise','3BET':'3-Bet','4BET':'4-Bet',JAM:'All-in',LIMP:'Limp'};
const num=n=>Number(n).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});
function initialize(){
 const nav=document.querySelector('.nav-mobile'),picker=$('quick-picker');
 if(!nav||!picker)return;
 const bar=document.createElement('div');bar.id='quick-sticky-recommendation';
 bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');
 bar.innerHTML='<div class="quick-rec-line"><span id="quick-rec-hand">–</span><strong id="quick-rec-action">Eingabe bereit</strong></div><div id="quick-rec-detail" class="quick-rec-detail"></div>';
 nav.before(bar);
 const details=document.createElement('div');details.id='quick-sizing-results';
 details.className='quick-sizing-results';
 const handDetail=document.querySelector('.panel.accent .details');
 if(handDetail)handDetail.after(details);
 let lastSignature='';
 function update(){
  try{
   const activeTab=nav.querySelector('button.active')?.dataset.tab||'trainer';
   bar.hidden=!['trainer','matrix'].includes(activeTab);
   if(bar.hidden)return;
   const blocked=document.querySelector('.panel.accent')?.classList.contains('quick-blocked');
   const err=$('quick-range-limit')?.textContent||'';
   const hand=typeof selectedHand==='string'?selectedHand:$('hand-name')?.textContent||'–';
   const model=typeof current!=='undefined'?current:null;
   const h=model?.hands?.[hand];
   $('quick-rec-hand').textContent=hand;
   if(blocked||!h){
    $('quick-rec-action').textContent='Keine Empfehlung';
    $('quick-rec-detail').textContent=blocked?(err||'Bitte Eingaben prüfen.'):'Situation eingeben';
    details.hidden=true;lastSignature='';return;
   }
   details.hidden=true;
   const label=actionLabels[h.action]||h.action;
   let action=label,meta='';
   const training=window.LernPokerTrainingState;
   const source=typeof selectedInputs==='function'?selectedInputs():null;
   if(['RAISE','3BET','4BET'].includes(h.action)&&training&&source&&window.LernPokerSizing){
    const inData={...training,heroStackBB:training.heroStackBB,
      scenario:training.scenario||{mode:'before',heroStackBB:training.heroStackBB,seatStacks:training.seatStacks,actions:[]}};
    const value=window.LernPokerSizing.analyze(D,source,inData,hand);
    if(value.best){
     action=label+' auf '+num(value.best.toBB)+' BB';
     meta='Modellierte Raisegröße: '+value.best.percent+' % Pot';
    }else{
     meta='Keine der vier getesteten Potgrößen ist hier zulässig.';
    }
    const buttons=value.options||[];
    if(buttons.length){
     details.hidden=false;
     const title=document.createElement('strong');title.textContent='Raisegrößen · Modellvergleich';
     const list=document.createElement('div');list.className='quick-sizing-list';
     for(const o of buttons){
      const block=document.createElement('div');block.className='quick-sizing-result';
      if(value.best&&o.legal&&o.percent===value.best.percent)block.classList.add('best');
      const caption=document.createElement('b');caption.textContent=o.percent+' % Pot';
      const number=document.createElement('span');number.textContent=o.legal?'Auf '+num(o.toBB)+' BB':o.reason||'Nicht zulässig';
      const ev=document.createElement('small');ev.textContent=o.legal?'EV ≈ '+num(o.ev)+' BB':'';
      block.append(caption,number,ev);list.append(block);
     }
     details.replaceChildren(title,list);
    }
   }else if(h.action==='JAM'){
     const stackBB=training?.heroStackBB||model.context?.stackBB;
     if(Number.isFinite(stackBB))action='All-in · '+num(stackBB)+' BB';
   }else if(h.action==='CALL'){
     const cost=Number(model.context?.callCostBB??h.callCost);
     if(Number.isFinite(cost)&&cost>0)action='Call · '+num(cost)+' BB';
   }else if(h.action==='LIMP'){action='Limp · 1,0 BB';}
   $('quick-rec-action').textContent=action;
   $('quick-rec-detail').textContent=meta||'';
  }catch(e){
   $('quick-rec-action').textContent='Eingaben prüfen';
   $('quick-rec-detail').textContent=String(e?.message||e);
   details.hidden=true;
  }
 }
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
window.addEventListener('DOMContentLoaded',initialize);
})();