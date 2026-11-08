(function(){
'use strict';
const $=id=>document.getElementById(id);
const RANKS='AKQJT98765432', FORMAT_KEY='LernPokerTournament_v2';
const SUITS=[{symbol:'♠',name:'Pik'},{symbol:'♥',name:'Herz'},{symbol:'♦',name:'Karo'},{symbol:'♣',name:'Kreuz'}];
let mode='before', activeCard=1, cardRanks=['A','K'], cardSuits=['♠','♠'], currentStatus='';
const states=new Map(),seatStacks=new Map();
const el=(tag,cls,html)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(html!==undefined)x.innerHTML=html;return x;};
const decimal=n=>Number(n).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});
const digits=v=>String(v||'').replace(/\D/g,'').slice(0,5);
const tenth=v=>{const s=digits(v);return s?Number(s)/10:NaN;};
const mask=n=>String(Math.round(Number(n)*10));
function init(){
 const form=document.querySelector('.form-panel'),picker=$('quick-picker'),nav=document.querySelector('.nav-mobile');
 if(!form||!picker||!nav||!window.PokerModel)return;
 const edit=el('button','', '⚙ Turnierformat ändern');edit.type='button';edit.id='change-tournament';document.querySelector('header').appendChild(edit);
 const welcome=el('section','', '<div class="setup-card"><h2>♠ Turnierformat auswählen</h2><p>Einmal wählen – danach bleibt die Schnell-Eingabe für Zugfahrten im Vordergrund.</p><div class="setup-choices"><button data-profile="A"><b>8 Spieler · 100 BB</b><span>10.000 Chips · 8 Minuten</span></button><button data-profile="B"><b>6 Spieler · 100 BB</b><span>10.000 Chips · 5 Minuten</span></button><button data-profile="C"><b>8 Spieler · 80 BB</b><span>8.000 Chips · 5 Minuten · 2-$-MTT</span></button></div></div>');
 welcome.id='format-setup';welcome.hidden=true;welcome.setAttribute('role','dialog');welcome.setAttribute('aria-modal','true');document.body.appendChild(welcome);
 const mobilePick=picker.querySelector('.mobile-pick');
 const stackBox=el('div','quick-stack','<label for="quick-bb">Mein Stack · BB</label><div class="quick-stack-line"><input id="quick-bb" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="5" aria-describedby="bb-caption bb-example" value="800"><strong id="bb-caption">80,0 BB</strong></div><small id="bb-example">Nur Ziffern: 154 ergibt 15,4 BB; 80 ergibt 8,0 BB.</small>');
 mobilePick.before(stackBox);
 const heroPos=$('heroPos');heroPos.closest('.group').hidden=true;
 const positionBox=el('section','quick-section','<h3>Meine Position</h3><div id="quick-position-buttons" class="quick-position-buttons" role="group" aria-label="Meine Position"></div>');
 stackBox.after(positionBox);
 const stackPanel=el('section','quick-section quick-all-stacks',
   '<div class="quick-stack-header"><h3>Stacks der übrigen Spieler</h3><button type="button" id="quick-stack-reset">Alle = mein Stack</button></div><div id="quick-stack-grid" class="quick-stack-grid"></div>');
 positionBox.after(stackPanel);
 mobilePick.hidden=true;
 const cards=el('section','quick-section','<h3>Meine Karten</h3><div id="quick-card-display" class="quick-card-display"><button id="card-one" class="quick-current" type="button">Karte 1 · A♠</button><button id="card-two" type="button">Karte 2 · K♠</button></div><div id="quick-ranks" class="quick-rank-buttons" role="group" aria-label="Kartenwert für ausgewählte Karte wählen"></div><div class="quick-suit-buttons" id="quick-suits" role="group" aria-label="Farbe für ausgewählte Karte wählen"></div>');
 mobilePick.before(cards);
 const action=el('section','quick-section',
  '<div class="quick-action-header"><h3>Aktionen der Gegner</h3><button id="quick-all-fold" type="button" class="quick-reset-fold">Alle folden</button></div>'+
  '<div class="quick-mode-buttons" role="group" aria-label="Aktionsfolge"><button type="button" data-mode="before">Vor meiner Entscheidung</button><button type="button" data-mode="after">Nach meinem Raise</button></div>'+
  '<div id="quick-own-raise" hidden><label for="quick-own-bet">Mein Raise auf (BB)</label><input id="quick-own-bet" type="text" inputmode="numeric" pattern="[0-9]*" value="22"><span class="quick-digits-value" id="quick-own-value">2,2 BB</span></div>'+
  '<div id="quick-seats" class="quick-seat-list"></div><div id="quick-case-status" role="status" class="quick-case-status"></div>');
 $('q-selected').after(action);
 const advanced=el('details','', '<summary>Weitere Angaben · Blindlevel und Tischgröße</summary>');advanced.id='quick-advanced';advanced.append(form.querySelector('.controls'),$('kpis'),$('model-warning'));picker.append(advanced);
 const icmControl=$('useICM');
 if(icmControl){icmControl.checked=false;icmControl.closest('.group').hidden=true;}
 const icmNav=nav.querySelector('button[data-tab="icm"]');
 if(icmNav)icmNav.remove();
 for(const id of ['profile','spot','heroChips','villainChips','villainPos','openBB','threebetBB','heroPos']){$(id).closest('.group').hidden=true;}
 advanced.append(el('details','quick-methodology','<summary>Methodik und Nutzung</summary><p>Das Rechenmodell verwendet geschätzte Chip-EV-Strategien und ist keine vollständig gelöste GTO-Strategie. Mehrere aktive Gegner und komplexe Action-Trees werden noch nicht vollständig unterstützt. Nur zum Lernen und zur Nachanalyse außerhalb laufender Online-Partien.</p></details>'));
 const accent=document.querySelector('.panel.accent');
 const block=el('div','quick-limit','');block.id='quick-range-limit';accent.querySelector('h2').after(block);
 const seats=()=>PokerModel.POSITIONS[Number($('players').value)]||[];
 const ownBB=()=>{const p=D.profiles[$('profile').value],l=p.levels.find(x=>x.level===Number($('level').value))||p.levels[0];return l.bb;};
 const heroBB=()=>tenth($('quick-bb').value);

 const getStack=pos=>{
  if(pos===heroPos.value)return heroBB();
  if(!seatStacks.has(pos))seatStacks.set(pos,{stack:Math.round(Math.max(2,heroBB()||20)*10),custom:false});
  return seatStacks.get(pos).stack/10;
 };
 function setStack(pos,value,custom=true){
  if(!seats().includes(pos)||pos===heroPos.value||!Number.isFinite(value)||value<.1||value>1000)return false;
  const st=Math.round(value*10);
  seatStacks.set(pos,{stack:st,custom});
  for(const side of ['before','after']){
   const x=states.get(side+':'+pos);
   if(x){x.stack=st;if(x.action==='allin')x.bet=st;}
  }
  return true;
 }
 function renderStacks(){
  const box=$('quick-stack-grid');box.innerHTML='';
  for(const pos of seats()){
   if(pos===heroPos.value)continue;
   const wrap=el('label','quick-other-stack','');
   const heading=el('strong','',pos);
   const input=el('input','');input.type='text';input.inputMode='numeric';input.pattern='[0-9]*';
   input.maxLength=5;input.value=mask(getStack(pos));input.setAttribute('aria-label',pos+' Stack; letzte Ziffer Zehntel-BB');
   const display=el('span','quick-digits-value',decimal(getStack(pos))+' BB');
   input.addEventListener('input',()=>{
    input.value=digits(input.value);
    const n=tenth(input.value);
    display.textContent=Number.isFinite(n)?decimal(n)+' BB':'– BB';
    if(Number.isFinite(n)&&n>=.1){setStack(pos,n,true);syncScenario();}
   });
   input.addEventListener('blur',()=>{
    const n=tenth(input.value);
    if(!Number.isFinite(n)||n<.1){input.value=mask(getStack(pos));display.textContent=decimal(getStack(pos))+' BB';}
   });
   wrap.append(heading,input,display);box.append(wrap);
  }
 }
 $('quick-stack-reset').addEventListener('click',()=>{
  for(const pos of seats())if(pos!==heroPos.value)setStack(pos,heroBB(),false);
  renderStacks();renderSeatRows();syncScenario();
 });

 const seatId=(side,pos)=>side+':'+pos;
 const getState=(side,pos)=>{
  const id=seatId(side,pos);
  if(!states.has(id))states.set(id,{action:'fold',bet:side==='after'?75:22,stack:Math.round(Math.max(.1,getStack(pos))*10),customStack:false});
  return states.get(id);
 };
 function showSetup(){welcome.hidden=false;document.body.style.overflow='hidden';welcome.querySelector('button').focus();}
 function hideSetup(){welcome.hidden=true;document.body.style.overflow='';}
 function setProfile(key){
  if(!D.profiles[key])return;
  $('profile').value=key;$('level').value='1';setupProfile(false);
  states.clear();seatStacks.clear();mode='before';
  $('quick-bb').value=mask(D.profiles[key].startstack/ownBB());
  cardRanks=['A','K'];cardSuits=['♠','♠'];activeCard=1;updateCards();
  renderPositions();renderStacks();renderSeatRows();syncScenario();
  try{localStorage.setItem(FORMAT_KEY,key)}catch(_){}
  hideSetup();form.hidden=true;
 }
 welcome.querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click',()=>setProfile(b.dataset.profile)));
 edit.addEventListener('click',showSetup);
 function renderPositions(){
  const box=$('quick-position-buttons');box.innerHTML='';
  for(const pos of seats()){
   const b=el('button','quick-position-choice',pos);
   b.type='button';b.setAttribute('aria-pressed',String(heroPos.value===pos));b.classList.toggle('active',heroPos.value===pos);
   b.addEventListener('click',()=>{
    heroPos.value=pos;refreshVillain();
    renderPositions();renderStacks();renderSeatRows();syncScenario();
   });
   box.append(b);
  }
 }

 function avoidDuplicate(changedIndex){
  if(cardRanks[0]===cardRanks[1]&&cardSuits[0]===cardSuits[1]){
   const other=1-changedIndex;
   cardSuits[changedIndex]=SUITS.find(s=>s.symbol!==cardSuits[other]).symbol;
  }
 }
 function updateCards(){
  avoidDuplicate(activeCard-1);
  $('q-r1').value=cardRanks[0];$('q-r2').value=cardRanks[1];
  $('q-s').value=cardRanks[0]!==cardRanks[1]&&cardSuits[0]===cardSuits[1]?'s':'o';
  // Die bestehende 169-Hand-Auswertung nutzt weiterhin Rank + suited/offsuit intern.
  $('q-s').dispatchEvent(new Event('change',{bubbles:true}));
  for(let i=0;i<2;i++){
   const b=$(i===0?'card-one':'card-two');
   b.textContent='Karte '+(i+1)+' · '+cardRanks[i]+cardSuits[i];
   b.classList.toggle('quick-current',activeCard===i+1);
   b.classList.toggle('quick-red-suit',cardSuits[i]==='♥'||cardSuits[i]==='♦');
   b.setAttribute('aria-pressed',String(activeCard===i+1));
  }
  for(const b of $('quick-suits').querySelectorAll('button')){
   const symbol=b.dataset.suit;
   b.setAttribute('aria-label',SUITS.find(s=>s.symbol===symbol).name+' für Karte '+activeCard);
   const samePhysicalCard=cardRanks[0]===cardRanks[1] && symbol===cardSuits[2-activeCard];
   const chosen=cardSuits[activeCard-1]===symbol;
   b.disabled=samePhysicalCard;
   b.classList.toggle('active',chosen);
   b.setAttribute('aria-pressed',String(chosen));
  }
  $('q-selected').textContent=cardRanks[0]+cardSuits[0]+'   '+cardRanks[1]+cardSuits[1]+'   ·   '+selectedHand;
 }
 for(const r of RANKS){
  const b=el('button','',r);b.type='button';b.addEventListener('click',()=>{
   const index=activeCard-1;
   cardRanks[index]=r;avoidDuplicate(index);updateCards();
  });$('quick-ranks').append(b);
 }
 for(const suit of SUITS){
  const b=el('button','quick-suit-choice',suit.symbol);
  b.type='button';b.dataset.suit=suit.symbol;
  b.classList.toggle('quick-red-suit',suit.symbol==='♥'||suit.symbol==='♦');
  b.title=suit.name;
  b.setAttribute('aria-label',suit.name+' für Karte '+activeCard);
  b.addEventListener('click',()=>{
   const i=activeCard-1;
   if(cardRanks[0]===cardRanks[1] && cardSuits[1-i]===suit.symbol)return;
   cardSuits[i]=suit.symbol;
   if(activeCard===1)activeCard=2;
   updateCards();
  });
  $('quick-suits').append(b);
 }
 $('card-one').addEventListener('click',()=>{activeCard=1;updateCards()});
 $('card-two').addEventListener('click',()=>{activeCard=2;updateCards()});
 // Klick in die 169-Hand-Matrix stellt auch die physischen Kartensymbole ein.
 $('matrix').addEventListener('click',e=>{
  const cell=e.target.closest('.cell');if(!cell)return;
  const h=(cell.textContent||'').trim();
  if(!/^[AKQJT98765432]{2}[so]?$/.test(h))return;
  cardRanks=[h[0],h[1]];
  cardSuits=h.endsWith('s')?['♠','♠']:['♠','♥'];
  activeCard=1;updateCards();
 });
 function updateBb(){
  const input=$('quick-bb');
  input.value=digits(input.value);
  const v=tenth(input.value);
  $('bb-caption').textContent=Number.isFinite(v)?decimal(v)+' BB':'– BB';
  for(const s of states.values())if(!s.customStack){s.stack=Math.round(Math.max(0.1,v||20)*10);if(s.action==='allin')s.bet=s.stack;}
  renderSeatRows();syncScenario();
 }
 $('quick-bb').addEventListener('input',updateBb);
 $('quick-bb').addEventListener('blur',()=>{if(!Number.isFinite(heroBB())||heroBB()<=0){$('quick-bb').value='200';updateBb()}});
 function modeSide(){return mode==='after'?'after':'before';}
 function applicableSeats(){
  const i=seats().indexOf(heroPos.value);
  if(i<0)return[];
  return mode==='after'?seats().slice(i+1):seats().slice(0,i);
 }
 function markMode(){
  action.querySelectorAll('[data-mode]').forEach(b=>{
   b.classList.toggle('active',b.dataset.mode===mode);
   b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  });
  $('quick-own-raise').hidden=mode!=='after';
 }
 function renderSeatRows(){
  markMode();
  const box=$('quick-seats');box.innerHTML='';
  const side=modeSide(),positions=applicableSeats();
  if(positions.length===0){
   box.append(el('p','quick-seat-empty',mode==='after'?'Nach deiner Position sitzt niemand mehr.':'Du bist als Erster an der Reihe.'));
   return;
  }
  for(const pos of positions){
   const s=getState(side,pos);
   const card=el('div','quick-seat quick-seat-inline','');card.dataset.seat=pos;
   const row=el('div','quick-seat-line','');
   const position=el('strong','quick-seat-position',pos);
   const choices=el('div','quick-seat-choices','');
   for(const [kind,label] of [['fold','Fold'],['call','Call'],['raise',side==='after'?'3-Bet':'Raise'],['allin','All-in']]){
    const b=el('button','',label);b.type='button';
    b.classList.toggle('active',s.action===kind);
    b.setAttribute('aria-pressed',String(s.action===kind));
    b.setAttribute('aria-label',pos+': '+label);
    b.addEventListener('click',()=>{
     s.action=kind;
     if(kind==='allin')s.bet=s.stack;
     if(kind==='call'){
      const previous=positions.slice(0,positions.indexOf(pos));
      s.bet=previous.reduce((highest,p)=>{
       const v=getState(side,p);
       return v.action==='raise'||v.action==='allin'?Math.max(highest,v.action==='allin'?v.stack:v.bet):highest;
      },side==='after'?Math.max(10,Number($('quick-own-bet').value)||22):10);
     }
     if(kind==='raise'&&s.bet<(side==='after'?35:20))s.bet=side==='after'?75:22;
     renderSeatRows();syncScenario();
    });
    choices.append(b);
   }
   row.append(position,choices);card.append(row);
   if(s.action!=='fold'){
    const fields=el('div','quick-seat-numbers','');
    if(s.action!=='allin'){
     const betGroup=el('label','','Gesamteinsatz (BB)');
     const bet=el('input','');bet.type='text';bet.inputMode='numeric';bet.pattern='[0-9]*';bet.maxLength=5;
     bet.value=String(s.bet);bet.setAttribute('aria-label',pos+' Gesamteinsatz in Zehntel-BB');
     const betValue=el('span','quick-digits-value',decimal(s.bet/10)+' BB');
     bet.addEventListener('input',()=>{
      bet.value=digits(bet.value);s.bet=Number(bet.value);
      betValue.textContent=decimal(s.bet/10)+' BB';syncScenario();
     });
     betGroup.append(bet,betValue);fields.append(betGroup);
    }
    const stackGroup=el('label','','Stack (BB)');
    const stack=el('input','');stack.type='text';stack.inputMode='numeric';stack.pattern='[0-9]*';stack.maxLength=5;stack.value=String(s.stack);
    stack.setAttribute('aria-label',pos+' Stack in Zehntel-BB');
    const stackValue=el('span','quick-digits-value',decimal(s.stack/10)+' BB');
    stack.addEventListener('input',()=>{
     stack.value=digits(stack.value);s.stack=Number(stack.value);s.customStack=true;
     if(s.action==='allin')s.bet=s.stack;
     stackValue.textContent=decimal(s.stack/10)+' BB';syncScenario();
    });
    stackGroup.append(stack,stackValue);fields.append(stackGroup);
    card.append(fields);
   }
   box.append(card);
  }
 }
 action.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
  mode=b.dataset.mode;renderSeatRows();syncScenario();
 }));
 $('quick-all-fold').addEventListener('click',()=>{
  mode='before';
  for(const seat of seats())for(const side of ['before','after'])getState(side,seat).action='fold';
  renderSeatRows();syncScenario();
 });
 $('quick-own-bet').addEventListener('input',()=>{
  $('quick-own-bet').value=digits($('quick-own-bet').value);
  $('quick-own-value').textContent=decimal(tenth($('quick-own-bet').value)||0)+' BB';
  syncScenario();
 });
 function blocked(message){
  currentStatus=message;accent.classList.toggle('quick-blocked',Boolean(message));
  $('quick-range-limit').textContent=message||'';
  const quiz=nav.querySelector('[data-tab="quiz"]');if(quiz)quiz.disabled=Boolean(message);
 }
 function syncScenario(){
  const hero=heroPos.value,stack=heroBB();
  const summary=$('quick-case-status'),lvl=ownBB();
  if(!Number.isFinite(stack)||stack<=0||stack>1000){
   window.LernPokerScenario=null;summary.textContent='Stack prüfen.';
   blocked('Ungültiger eigener Stack.');return;
  }
  $('heroChips').value=String(Math.max(1,Math.round(stack*lvl)));
  const before=mode==='before',side=modeSide();
  const positions=applicableSeats();
  const involved=positions.map(pos=>({pos,...getState(side,pos)})).filter(s=>s.action!=='fold');
  const ownRaise=tenth($('quick-own-bet').value)||2.2;
  const prior=involved.filter(s=>s.action==='raise'||s.action==='allin');
  let problem='',next='RFI',vPos='',vStack=stack,vBet=2.2;
  if(stack<2)problem='Unter 2 BB ist keine reguläre Preflop-Empfehlung verfügbar.';
  if(before&&hero==='BB'&&involved.length===0)problem='Alle folden zum Big Blind – keine weitere Entscheidung.';
  if(!before&&!positions.length)problem='Nach deiner Position sitzt niemand mehr.';
  if(!before&&!prior.length)problem='Keine erneute Erhöhung – es ist keine zweite Entscheidung erforderlich.';
  if(before&&involved.length===0){next='RFI';}
  else if(involved.length){
   // Repräsentative Position für die Anzeige der vorhandenen Felder; die neue
   // Engine nutzt alle Eingaben in der vollständigen Action History.
   const dominant=[...involved].sort((a,b)=>{
    const bet=x=>x.action==='allin'?x.stack:x.bet;
    return bet(b)-bet(a);
   })[0];
   vPos=dominant.pos;vStack=dominant.stack/10;
   vBet=dominant.action==='allin'?dominant.stack/10:dominant.bet/10;
   next=before?(dominant.action==='allin'?'JAM':'OPEN'):'3BET';
  }
  const spot=$('spot');
  if(spot.value!==next){spot.value=next;refreshSeats(false);}
  if([...heroPos.options].some(o=>o.value===hero))heroPos.value=hero;
  refreshVillain();
  if(vPos&&[...$('villainPos').options].some(o=>o.value===vPos))$('villainPos').value=vPos;
  $('villainChips').value=String(Math.max(1,Math.round(vStack*lvl)));
  $('openBB').value=String(Math.max(1.5,before?vBet:ownRaise));
  $('threebetBB').value=String(Math.max(3.5,vBet));
  const scenario=involved.length?{
   mode:before?'before':'after',
   heroStackBB:stack,
   ownRaiseBB:before?0:ownRaise,
   actions:involved.map(x=>({
    position:x.pos,action:x.action,
    betBB:x.bet/10,stackBB:x.stack/10
   }))
  }:null;
  window.LernPokerScenario=null;
  if(!problem&&scenario){
   try{
    if(!window.LernPokerMultiway)throw Error('Mehrspieler-Rechenmodul ist nicht geladen.');
    window.LernPokerMultiway.inspect(D,selectedInputs(),scenario);
    window.LernPokerScenario=scenario;
   }catch(e){problem=e.message||'Aktion prüfen.';}
  }
  if(!problem)render();
  else {render();blocked(problem);}
  if(!problem)blocked('');
  summary.textContent=involved.length?
    involved.map(v=>v.pos+': '+({call:'Call/Limp',raise:before?'Raise':'3-Bet',allin:'All-in'}[v.action])+
    ' '+decimal((v.action==='allin'?v.stack:v.bet)/10)+' BB · Stack '+decimal(v.stack/10)+' BB').join(' | '):
    'Alle vor dir folden · '+hero+' · '+decimal(stack)+' BB.';
 }
 // Profilwahl und Einstellungswechsel synchron halten.
 $('level').addEventListener('change',syncScenario);
 $('players').addEventListener('change',()=>{renderPositions();renderSeatRows();syncScenario()});
 $('heroChips').addEventListener('change',()=>{$('quick-bb').value=mask(Number($('heroChips').value)/ownBB());updateBb()});
 $('profile').addEventListener('change',()=>{$('quick-bb').value=mask(D.profiles[$('profile').value].startstack/ownBB());states.clear();renderPositions();renderSeatRows();syncScenario()});
 // Die Oberfläche bleibt kompakt; die ursprünglichen Felder sind in "Weitere Angaben".
 new MutationObserver(()=>{if(!form.hidden)form.hidden=true}).observe(form,{attributes:true,attributeFilter:['hidden']});
 nav.addEventListener('click',()=>setTimeout(()=>{form.hidden=true},0));
 form.hidden=true;
 const stored=(()=>{try{return localStorage.getItem(FORMAT_KEY)}catch(_){return null}})();
 if(stored&&D.profiles[stored])setProfile(stored);
 else {renderPositions();renderSeatRows();updateCards();syncScenario();showSetup();}
}
window.addEventListener('DOMContentLoaded',init);
})();