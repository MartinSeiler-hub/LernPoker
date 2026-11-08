/* LernPoker: pot-fraction sizing for a training hand.
   Fractions refer to the pot after matching the current bet.
   Estimated EV uses the simplified multiway response model; not GTO. */
(function(g){
'use strict';
const fractions=[.33,.50,.75,1.0];
const roundBB=x=>Math.round(x*10)/10;
function inspectSizing(data,inputs,training){
 if(!g.LernPokerMultiway||!training)return null;
 const st=training.scenario||{mode:'before',heroStackBB:training.heroStackBB,seatStacks:training.seatStacks||{},actions:[]};
 const ctx=g.LernPokerMultiway.inspect(data,inputs,st);
 if(ctx.heroCap<=ctx.top || ctx.hero==='BB'&&ctx.active.length===0)return {ctx,options:[],best:null};
 const need=Math.max(0,ctx.top-ctx.heroAlready);
 const afterCall=ctx.pot+Math.min(need,ctx.heroCap-ctx.heroAlready);
 const minFull=ctx.top+ctx.lastRaise;
 const maxBB=ctx.heroCap;
 const actionName=ctx.stage==='after'?'4BET':ctx.top>1.01?'3BET':'RAISE';
 return {ctx,afterCall,minFull,maxBB,actionName,st};
}
function analyze(data,inputs,training,handKey){
 let d;
 try{d=inspectSizing(data,inputs,training)}catch(e){return {error:String(e.message||e),options:[]};}
 if(!d)return {options:[],best:null};
 const result={potBeforeBB:d.ctx.pot,potAfterCallBB:d.afterCall,minFullRaiseBB:d.minFull,
  action:d.actionName,options:[],best:null};
 if(!d.afterCall||!d.maxBB)return result;
 for(const fraction of fractions){
  const to=roundBB(d.ctx.top+fraction*d.afterCall);
  const item={fraction,percent:Math.round(fraction*100),toBB:to,legal:false,ev:null};
  if(to < d.minFull-1e-6){item.reason='Unter dem Mindest-Raise';result.options.push(item);continue;}
  if(to>=d.maxBB-.01){item.reason='Nur als All-in möglich';result.options.push(item);continue;}
  if(result.options.some(x=>x.legal&&Math.abs(x.toBB-to)<.025)){item.reason='Bereits enthalten';result.options.push(item);continue;}
  const choice={key:d.actionName,bet:to,aggressive:true};
  const scenarios=g.LernPokerMultiway.actionDistribution(d.ctx,choice);
  const ev=g.LernPokerMultiway.calcHand(d.ctx,choice,handKey,null,scenarios).ev;
  item.legal=true;item.ev=ev;
  result.options.push(item);
  if(!result.best||ev>result.best.ev)result.best={...item};
 }
 return result;
}
const api={analyze,inspectSizing,fractions};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else g.LernPokerSizing=api;
})(globalThis);