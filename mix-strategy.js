/* LernPoker 6-max training mixture (model weights, NOT solver/GTO frequencies).
 * Compares actions in a common simplified chip-EV approximation, then applies
 * bounded EV-weighted sampling with an explicit shared sizing prior.
 */
(function(global){
'use strict';
const M=global.PokerModel,MM=global.LernPokerMultiway,Size=global.LernPokerSizing;
if(!M||!MM||!Size)return;
const AGGR=new Set(['RAISE','3BET','4BET','JAM']);
const WHEEL=new Set(['A2s','A3s','A4s','A5s']);
const KING=new Set(['K4s','K5s','K6s','K7s','K8s']);
const clip=(x,a,b)=>Math.min(b,Math.max(a,x));
const round=x=>Math.round(x*10000)/10000;
const sizePrior={33:.29,50:.31,75:.25,100:.15};
function bluffCandidate(hand,ctx){
 const open=ctx.active.some(pos=>{
  const seat=ctx.all.find(x=>x.pos===pos);
  return seat&&(seat.action==='raise'||seat.action==='allin');
 });
 if(!open||ctx.heroStack<14||ctx.heroStack>65)return false;
 const late=['HJ','CO','BTN','SB','BB'].includes(ctx.hero);
 return late&&(WHEEL.has(hand) || (['BTN','SB','BB'].includes(ctx.hero)&&KING.has(hand)));
}
function scenarioFor(training){
 if(training?.scenario)return training.scenario;
 const heroStack=Number(training?.heroStackBB);
 return {mode:'before',heroStackBB:heroStack,seatStacks:training?.seatStacks||{},actions:[]};
}
function calculate(data,inputs,training,hand,baseHand){
 if(Number(inputs.players)!==6)return {enabled:false,reason:'Mischstrategie derzeit nur am 6-Max-Tisch'};
 if(!M.handKeys().includes(hand))return {enabled:false,reason:'Unbekannte Handklasse'};
 const scenario=scenarioFor(training);
 let ctx;
 try{ctx=MM.inspect(data,inputs,scenario);}catch(e){return{enabled:false,reason:String(e?.message||e)};}
 const active=ctx.active.length>0, bluff=bluffCandidate(hand,ctx);
 const toCall=Math.max(0,Math.min(ctx.top,ctx.heroCap)-ctx.heroAlready);
 const candidates=[];
 function add(action,toBB,ev,prior,origin,bluffFlag=false){
  if(!Number.isFinite(ev)||ev<=-1e5||prior<=0)return;
  const id=action+(Number.isFinite(toBB)?':'+Math.round(toBB*10):'');
  if(candidates.some(x=>x.id===id))return;
  candidates.push({id,action,toBB:Number.isFinite(toBB)?round(toBB):null,ev:round(ev),
   prior,bluff:Boolean(bluffFlag&&AGGR.has(action)),origin});
 }
 if(toCall>1e-6)add('FOLD',null,0,1.0,'fundamental');
 const raw=MM.possibleActions(ctx);
 const passive=raw.find(x=>x.key==='CALL'||x.key==='CHECK');
 if(passive){
  const baseAct=passive.key==='CHECK'?'CHECK':ctx.top<=1.01&&!active?'LIMP':'CALL';
  // Do not turn unopened 72o into a voluntary limp from UTG/HJ/CO/BTN.
  // The simplified model overvalues free flops; SB limps remain available.
  if(baseAct!=='LIMP'||ctx.hero==='SB'){
   const d=MM.actionDistribution(ctx,passive);
   const ev=MM.calcHand(ctx,passive,hand,null,d).ev;
   add(baseAct,passive.bet,ev,baseAct==='LIMP'?.32:1.0,'model');
  }
 }
 const alt=baseHand?.alternatives||{};
 const isUnopened=!active&&ctx.stage==='before';
 const strength=M.strengthOrder(data.equities,ctx.heroStack)[hand];
 const openLimit=M.baseOpenTarget(6,ctx.hero,ctx.heroStack,6*ctx.aBB);
 const openAllowed=isUnopened && ctx.hero!=='BB' && strength.percentile<=openLimit && !baseHand?.limitedByOpenRange;
 const raiseLabel=ctx.stage==='after'?'4BET':ctx.top>1.01?'3BET':'RAISE';
 const supported=Object.hasOwn(alt,raiseLabel)&&Number(alt[raiseLabel])>-1e5;
 const capByStage=ctx.stage==='after'?bluff&&WHEEL.has(hand):bluff;
 const canRaise=isUnopened?openAllowed:(supported||capByStage);
 let sizes={options:[]};
 if(canRaise){
  sizes=Size.analyze(data,inputs,{...training,heroStackBB:ctx.heroStack,scenario},hand);
  for(const x of sizes.options||[]){
   if(x.legal&&Number.isFinite(x.ev)){
    const prior=sizePrior[x.percent]||.1;
    add(raiseLabel,x.toBB,x.ev,prior*(bluff?.95:1.15),'pot-fraction',bluff);
   }
  }
 }
 const jam=raw.find(x=>x.key==='JAM');
 const jamAllowed=jam && Number(alt.JAM)>-1e5 && (ctx.heroStack<=13 || strength.percentile<=.09 || bluff&&ctx.heroStack<=20);
 if(jamAllowed){
  const result=MM.calcHand(ctx,jam,hand,null,MM.actionDistribution(ctx,jam));
  add('JAM',jam.bet,result.ev,ctx.heroStack<=12?.9:.40,'model',bluff);
 }
 if(!candidates.length){
  return {enabled:false,reason:'Keine gültige Aktion für diese Spielsituation',hand,context:{hero:ctx.hero}};
 }
 const maxEv=Math.max(...candidates.map(c=>c.ev));
 // EV gap tolerance reflects systematic uncertainty in the simplified opponent model.
 // This is entropy-regularized decision-making, NOT a Nash equilibrium calculation.
 const temperature=clip(ctx.pot*.20,.35,1.9);
 let total=0;
 for(const c of candidates){
  c.weight=c.prior*Math.exp(clip((c.ev-maxEv)/temperature,-14,0));
  total+=c.weight;
 }
 const options=candidates.map(c=>({...c,p:c.weight/total,percentage:100*c.weight/total}))
   .filter(c=>c.percentage>.02)
   .sort((a,b)=>b.p-a.p||b.ev-a.ev||a.id.localeCompare(b.id));
 const normalized=options.reduce((s,o)=>s+o.p,0);
 for(const o of options){o.p/=normalized;o.percentage=100*o.p;}
 return {enabled:true,hand,model:'ev-weighted-heuristic',bluffCandidate:bluff,options,
  dominant:options[0],temperature:round(temperature),potBB:ctx.pot,
  note:'EV-gewichteter Trainingsmix, keine solverbestätigten GTO-Frequenzen'};
}
function sample(strategy,unit){
 if(!strategy?.enabled||!strategy.options?.length)return null;
 const bounded=clip(Number(unit),0,1-Number.EPSILON);
 let running=0;
 for(const entry of strategy.options){running+=entry.p;if(bounded<running)return entry;}
 return strategy.options.at(-1);
}
function hash(s){
 let x=2166136261>>>0;
 for(let i=0;i<s.length;i++){x=Math.imul(x^s.charCodeAt(i),16777619)>>>0;}
 return x;
}
function u01(signature,salt=0){
 // Deterministic in (0,1), stable between UI renders until the draw index changes.
 let x=hash(String(signature)) ^ (Number(salt)>>>0);
 x+=0x6D2B79F5;x=Math.imul(x^(x>>>15),x|1);
 x^=x+Math.imul(x^(x>>>7),x|61);
 return ((x^(x>>>14))>>>0)/4294967296;
}
const api={calculate,sample,hash,u01,bluffCandidate,scenarioFor};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else global.LernPokerMix=api;
})(globalThis);
