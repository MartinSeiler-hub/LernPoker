/* LernPoker: approximate multi-player preflop chip-EV.
 * Exact: committed bets, blinds/antes, call costs, pot/side-pot layers.
 * Model assumptions: opponent ranges, continuation odds, multiway equity,
 * no full postflop game tree or proven Nash/GTO equilibrium.
 */
(function(global){
'use strict';
const M=global.PokerModel;
if(!M)return;
const LIMIT=9;
const clip=(x,a,b)=>Math.max(a,Math.min(b,x));
const round=x=>Math.round(x*10000)/10000;
const blind=pos=>pos==='SB'?0.5:pos==='BB'?1:0;
const kinds=new Set(['fold','call','raise','allin']);
function inspect(data,inputs,scenario){
 const profile=data.profiles[inputs.profile];
 if(!profile)throw Error('Unbekanntes Turnierprofil.');
 const level=profile.levels.find(l=>l.level===Number(inputs.level));
 if(!level)throw Error('Blindlevel nicht vorhanden.');
 const playerCount=Number(inputs.players||profile.tablesize),positions=M.POSITIONS[playerCount];
 if(!positions||playerCount<2||playerCount>LIMIT)throw Error('Spielerzahl 2–9 eingeben.');
 const hero=inputs.position;
 if(!positions.includes(hero))throw Error('Eigene Position ist nicht am Tisch.');
 const stage=scenario?.mode==='after'?'after':'before',index=positions.indexOf(hero);
 const affected=stage==='after'?positions.slice(index+1):positions.slice(0,index);
 const events=scenario?.actions||[];
 if(!Array.isArray(events))throw Error('Aktionen fehlen.');
 const aBB=level.ante/level.bb;
 const heroStack=Number(scenario.heroStackBB);
 if(!Number.isFinite(heroStack)||heroStack<2||heroStack>1000)throw Error('Eigener Stack muss mindestens 2 BB betragen.');
 const heroCap=heroStack-aBB;
 const heroAlready=stage==='after'?Number(scenario.ownRaiseBB):blind(hero);
 if(!Number.isFinite(heroAlready)||heroAlready<blind(hero)||heroAlready>heroCap)throw Error('Eigener Einsatz ungültig.');
 const state=new Map();
 for(const pos of positions){
  state.set(pos,{pos,bet:blind(pos),stack:heroStack,action:stage==='after'?'fold':positions.indexOf(pos)>index?'pending':'fold'});
 }
 const used=new Set();
 let top=stage==='after'?heroAlready:1;
 let lastRaise=top===1?1:Math.max(1,top-1);
 for(const e of events){
  if(!e||!affected.includes(e.position))throw Error('Aktion von einer ungültigen Position.');
  if(used.has(e.position))throw Error('Position doppelt eingegeben.');
  used.add(e.position);
  if(!kinds.has(e.action))throw Error('Ungültige Aktion.');
  const seat=state.get(e.position);
  seat.action=e.action;
  if(e.action==='fold')continue;
  seat.stack=Number(e.stackBB);
  if(!Number.isFinite(seat.stack)||seat.stack<1||seat.stack>1000)throw Error('Gegnerstack ungültig.');
  const maximum=Math.max(blind(seat.pos),seat.stack-aBB);
  seat.bet=e.action==='allin'?maximum:Number(e.betBB);
  if(!Number.isFinite(seat.bet)||seat.bet<blind(seat.pos)-1e-6||seat.bet>maximum+1e-5)throw Error(e.position+': Einsatz größer als verfügbarer Stack.');
  // A short all-in raise is possible; it does not automatically reopen betting.
  if(e.action==='raise' && seat.bet<=top+1e-6)throw Error(e.position+': Raise muss höher als der bisherige Einsatz sein.');
  if(e.action==='call' && Math.abs(seat.bet-top)>.11 && seat.bet+1e-6<maximum)
   throw Error(e.position+': Call muss den bisherigen Einsatz ausgleichen.');
  if(e.action==='raise'){lastRaise=Math.max(1,seat.bet-top);top=seat.bet;}
  if(e.action==='allin'&&seat.bet>top){lastRaise=Math.max(1,seat.bet-top);top=seat.bet;}
 }
 const active=positions.filter(pos=>state.get(pos).action!=='fold'&&state.get(pos).action!=='pending');
 const needs=stage==='after'&&top<=heroAlready+1e-6;
 if(active.length===0&&stage==='after')throw Error('Alle folden nach deinem Raise – keine weitere Entscheidung.');
 if(active.length===0&&hero==='BB'&&stage==='before')throw Error('Alle folden zum Big Blind – kein weiterer Zug.');
 if(stage==='after'&&needs)throw Error('Nach deinem Raise liegt keine Erhöhung vor – keine neue Entscheidung.');
 if(active.length===0)throw Error('Keine aktive gegnerische Aktion.');
 if(heroCap<Math.min(top,heroCap)-1e-7)throw Error('Einsatz über maximalem Stack.');
 const pot=positions.reduce((sum,pos)=>{
  const seat=state.get(pos);
  return sum+aBB+seat.bet;
 },aBB+heroAlready-(aBB+state.get(hero).bet));
 // Pot: each seat contributes ante and existing voluntary bet;
 // Hero's existing bet was overwritten by own raise, not double-counted.
 const all=positions.map(pos=>({...state.get(pos)}));
 const pending=positions.filter(pos=>state.get(pos).action==='pending');
 const opponentStyle=inputs.opponentStyle||'normal';
 return {data,inputs,scenario,profile,level,hero,stage,playerCount,positions,
  aBB,heroStack,heroCap,heroAlready,top,lastRaise,pot,active,pending,opponentStyle,all};
}
function villainRange(Mctx,seat,followedRaise){
 const {playerCount,heroStack,aBB,opponentStyle}=Mctx;
 const stack=Math.min(heroStack,seat.stack);
 const style=opponentStyle==='tight'?.77:opponentStyle==='loose'?1.24:1;
 const base=M.baseOpenTarget(playerCount,seat.pos,stack,playerCount*aBB);
 const x=seat.action;
 let r=x==='raise'?Math.max(.045,base*.87):x==='allin'?Math.max(.042,base*(seat.stack<12?1.05:.34)):
    x==='call'?clip(base*1.9,.12,.65):clip(base*1.35,.08,.50);
 if(followedRaise)r*=x==='raise'?.6:x==='allin'?.86:.7;
 return clip(r*style,.018,.9);
}
function continueProb(ctx,seat,target,aggressive){
 if(seat.action==='allin' || seat.bet>=seat.stack-ctx.aBB-.001)return 1;
 if(!aggressive)return seat.action==='pending'?
    clip((seat.pos==='BB'?.36:seat.pos==='SB'?.21:.12)*(ctx.opponentStyle==='loose'?1.3:ctx.opponentStyle==='tight'?.7:1),.03,.68):1;
 const ratio=target/Math.max(1,seat.bet);
 let p=seat.action==='raise'?.64:seat.action==='call'?.47:seat.action==='pending'?
    seat.pos==='BB'?.35:seat.pos==='SB'?.23:.15:.5;
 const extra=Math.max(0,Math.min(target,seat.stack-ctx.aBB)-seat.bet);
 const price=extra/Math.max(.01,ctx.pot+extra);
 const stackFactor=clip((seat.stack-ctx.aBB-seat.bet)/Math.max(.5,seat.stack),.06,1);
 p*=clip(1.12-.21*Math.log2(Math.max(1,ratio)),.22,1.12);
 p*=ctx.opponentStyle==='loose'?1.28:ctx.opponentStyle==='tight'?.73:1;
 p*=clip(.65+.4*stackFactor,.55,1.1);
 // A player who has already committed almost all their chips generally
 // cannot be assumed to fold to a tiny additional raise.
 if(price<.10)p=Math.max(p,.99);
 else if(price<.18)p=Math.max(p,.91);
 else if(price<.25)p=Math.max(p,.78);
 return clip(p,.015,1);
}
function layers(contrib,live){
 const amounts=Array.from(new Set(contrib.map(v=>v.amount))).filter(v=>v>0).sort((a,b)=>a-b);
 const pots=[];let prev=0;
 for(const upper of amounts){
  const count=contrib.filter(v=>v.amount>=upper-1e-8).length;
  const amount=(upper-prev)*count;
  const eligible=live.filter(pos=>contrib.some(x=>x.pos===pos&&x.amount>=upper-1e-8));
  if(amount>1e-8 && eligible.length)pots.push({amount,eligible,upper});
  prev=upper;
 }
 return pots;
}
function possibleActions(ctx){
 const {heroCap,heroAlready,hero,stage,top,lastRaise,active}=ctx;
 const need=Math.max(0,Math.min(heroCap,top)-heroAlready);
 const options=[{key:need<=1e-6?'CHECK':'CALL',bet:Math.max(heroAlready,Math.min(heroCap,top)),aggressive:false}];
 if(need>1e-6)options.unshift({key:'FOLD',bet:heroAlready,aggressive:false});
 const size=stage==='after'
    ?Math.max(top+lastRaise,top*2.15)
    :top<1.5?Math.max(3.2,3+0.85*Math.max(0,active.length-1))
    :Math.max(top+lastRaise,top*(hero==='SB'||hero==='BB'?3.35:3.05)+.48*Math.max(0,active.length-1));
 const target=Math.min(heroCap,size);
 if(target>top+.25 && target<heroCap-.75)
  options.push({key:stage==='after'?'4BET':top<1.5?'RAISE':'3BET',bet:target,aggressive:true});
 if(heroCap>top+.001 && heroCap<=30.5)
  options.push({key:'JAM',bet:heroCap,aggressive:true});
 return options;
}
function actionDistribution(ctx,option){
 const seats=ctx.all.filter(x=>x.pos!==ctx.hero&&(x.action==='pending'||x.action!=='fold'));
 const tests=seats.map(s=>({s,prob:continueProb(ctx,s,option.bet,option.aggressive)}));
 // Enumerate all independent response patterns (max 2^8 for 9-max).
 // This captures the pot contribution per selected branch, including sidepot caps.
 const result=[];
 const count=Math.pow(2,tests.length);
 for(let mask=0;mask<count;mask++){
  let probability=1;
  const statuses=new Map();
  for(let k=0;k<tests.length;k++){
   const {s,prob}=tests[k],keep=Boolean(mask&(1<<k));
   probability*=keep?prob:1-prob;
   statuses.set(s.pos,keep);
  }
  if(probability<1e-8)continue;
  const contrib=ctx.all.map(s=>{
   const keep=s.pos===ctx.hero || statuses.get(s.pos);
   const bet=s.pos===ctx.hero ? option.bet :
      !keep?s.bet :
        option.aggressive?Math.max(s.bet,Math.min(option.bet,s.stack-ctx.aBB)):
          s.action==='pending'?Math.max(s.bet,Math.min(ctx.top,s.stack-ctx.aBB)):s.bet;
   return {pos:s.pos,amount:ctx.aBB+Math.max(0,bet)};
  });
  // Existing contributions of folded players stay in the pot, as dead money.
  const participants=[ctx.hero,...ctx.all.filter(s=>s.pos!==ctx.hero&&statuses.get(s.pos)).map(s=>s.pos)];
  result.push({probability,participants,pots:layers(contrib,participants)});
 }
 return result;
}
function calcHand(ctx,option,hand,rank,branches){
 let ev=0,payout=0,meanEq=0,showdownWeight=0;
 const aggressive=option.aggressive;
 const added=Math.max(0,option.bet-ctx.heroAlready);
 const opponentData=new Map(ctx.all.filter(x=>x.pos!==ctx.hero).map(seat=>{
  const range=villainRange(ctx,seat,aggressive);
  return [seat.pos,{range,eq:M.equityAgainst(ctx.data.equities,hand,range)}];
 }));
 for(const branch of branches){
  let amount=0,canWin=0;
  for(const pot of branch.pots){
   if(!pot.eligible.includes(ctx.hero))continue;
   const villains=pot.eligible.filter(pos=>pos!==ctx.hero);
   let equity=1;
   for(const v of villains)equity*=opponentData.get(v).eq;
   if(!aggressive){
    const multi= Math.max(0,villains.length-1);
    const posFactor=ctx.hero==='BTN'?.9:ctx.hero==='CO'?.86:ctx.hero==='BB'?.76:.78;
    const realization=clip(posFactor-.07*multi+(ctx.heroStack<16?.06:0),.50,.99);
    equity*=realization;
   }
   amount+=pot.amount*equity;
   canWin+=pot.amount;
  }
  payout+=branch.probability*amount;
  meanEq+=branch.probability*(canWin>0?amount/canWin:0);
  showdownWeight+=branch.probability;
  ev+=branch.probability*(amount-added);
 }
 return {ev,payout,estimatedEquity:meanEq/Math.max(1e-8,showdownWeight),expectedRisk:added};
}
function computeMatrix(data,inputs,scenario){
 const ctx=inspect(data,inputs,scenario);
 const choices=possibleActions(ctx);
 const summary={};
 for(const choice of choices)summary[choice.key]=actionDistribution(ctx,choice);
 const allKeys=M.handKeys();
 const order=M.strengthOrder(data.equities,ctx.heroStack);
 const hands={},comboCounts={FOLD:0,CHECK:0,CALL:0,RAISE:0,'3BET':0,'4BET':0,JAM:0,LIMP:0};
 const unopened=ctx.active.length===0;
 for(const key of allKeys){
  const alternatives={FOLD:0};
  let best={action:'FOLD',ev:0,estimatedEquity:0},eq=0;
  const strength=order[key];
  for(const choice of choices){
   if(choice.key==='FOLD')continue;
   const result=calcHand(ctx,choice,key,strength,summary[choice.key]);
   if(!eq || choice.key==='CALL'||choice.key==='CHECK')eq=result.estimatedEquity;
   let value=result.ev;
   // Calibrated constraints against erroneous deep-stack jams / ultra-wide 3-bets.
   const info=M.handInfo(key);
   const topRange=clip(.045+.15/(1+Math.max(0,ctx.active.length-1)),.07,.195);
   if(['RAISE','3BET','4BET'].includes(choice.key) && strength.percentile>topRange)
    value=-1e6;
   if(choice.key==='JAM' && ctx.heroStack>18 && strength.percentile>.065)
    value=-1e6;
   if(choice.key==='JAM' && ctx.heroStack>12 && ctx.top<1.6 && strength.percentile>.24)
    value=-1e6;
   if(choice.key==='4BET' && !['AA','KK','QQ','JJ','AKs','AKo','AQs','A5s'].includes(key))
    value=-1e6;
   alternatives[choice.key]=value;
   if(value>best.ev+1e-7){best={action:choice.key,ev:value,estimatedEquity:result.estimatedEquity};}
  }
  const fallback=Object.entries(alternatives).filter(([k,v])=>v>-1e5&&k!==best.action).sort((a,b)=>b[1]-a[1])[0]?.[0]||'FOLD';
  const referencePct=ctx.active.length?ctx.active.reduce((s,pos)=>{
    const p=ctx.all.find(x=>x.pos===pos);return s+villainRange(ctx,p,false);
   },0)/ctx.active.length:0;
  hands[key]={key,action:best.action,ev:best.ev,alternatives,backup:fallback,
   weight:M.handWeight(key),power:strength.score,percentile:strength.percentile,
   referencePct,showdownEq:eq,potBefore:ctx.pot,callCost:Math.max(0,ctx.top-ctx.heroAlready),
   notes:['Berechnete Chip-Einsätze/Sidepot-Stufen; gegnerische Ranges und Multiway-Equity geschätzt',
      'Equity gegen mehrere Gegner als Produkt bedingter Heads-up-Equities angenähert',
      'Gegnerreaktionen unabhängig; Postflop-Spielbaum und ICM nicht vollständig gelöst']};
  comboCounts[best.action]+=M.handWeight(key);
 }
 const frequencies={};for(const [action,count] of Object.entries(comboCounts))frequencies[action]=100*count/1326;
 const base=M.getContext(data,inputs);
 const context={...base,multiway:true,stackBB:ctx.heroStack,heroStackBB:ctx.heroStack,
   anteBB:ctx.aBB,players:ctx.playerCount,position:ctx.hero,potBB:ctx.pot,
   callCostBB:Math.max(0,Math.min(ctx.heroCap,ctx.top)-ctx.heroAlready),
   opponents:ctx.active.length,spotLabel:ctx.stage==='after'?'nach eigener Eröffnung':'vor eigener Aktion',
   activeActors:ctx.all.filter(x=>ctx.active.includes(x.pos)).map(x=>({position:x.pos,action:x.action,betBB:x.bet,stackBB:x.stack})),
   notes:'Multiway Chip-EV Näherungsmodell, nicht GTO'};
 return {context,spot:'MULTI',hands,frequencies,comboCounts,handOrder:allKeys};
}
const api={inspect,possibleActions,actionDistribution,computeMatrix,layers};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else global.LernPokerMultiway=api;
})(globalThis);
