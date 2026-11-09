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
// LiveTest presets use explicit representative stacks; exact BB entry remains available.
const LIVE_STACK_RANGES=[{label:'<10',value:8},{label:'10–20',value:15},{label:'20–30',value:25},{label:'30–50',value:40},{label:'50–80',value:65},{label:'80+',value:100}];
const LIVE_SITUATIONS=[['fold','Alle folden'],['call','Nur Calls'],['raise','Raise'],['reraise','Re-Raise'],['allin','All-in']];
const LIVE_ZONES=[['early','Früh'],['middle','Mittel'],['late','Spät']];
function liveZone(pos,players){
 if((players===8?['UTG','UTG+1']:['UTG']).includes(pos))return 'early';
 if((players===8?['MP','HJ']:['HJ']).includes(pos))return 'middle';
 return 'late';
}
// Input adapter only. Unknown seats are explicit representative assumptions;
// no individual opponent state or strategy module is changed.
function buildLiveSituation(input){
 const {players,hero,stack,ante=0,ownRaise=2.2,kind}=input;
 const after=input.mode==='after',positions=window.PokerModel.POSITIONS[players]||[];
 const heroIndex=positions.indexOf(hero);
 const affected=heroIndex<0?[]:after?positions.slice(heroIndex+1):positions.slice(0,heroIndex);
 const aggressive=['raise','reraise','allin'].includes(kind);
 const secondRaise=kind==='reraise'&&!after;
 const eligible=aggressive?affected.filter((p,i)=>!secondRaise||i>0):[];
 const zones=LIVE_ZONES.map(([key])=>key).filter(key=>eligible.some(p=>liveZone(p,players)===key));
 const zone=zones.includes(input.zone)?input.zone:zones[0]||null;
 const candidates=eligible.filter(p=>liveZone(p,players)===zone);
 const maxCallers=kind==='call'?affected.length:aggressive&&candidates.length?
  affected.length-affected.indexOf(candidates[0])-1:0;
 const minCallers=kind==='call'&&maxCallers>0?1:0;
 const requestedCallers=Math.trunc(Number(input.callers)||0);
 const callers=kind==='fold'?0:kind==='call'&&requestedCallers===0?1:requestedCallers;
 const raiser=candidates.filter(p=>affected.length-affected.indexOf(p)-1>=callers).at(-1)||null;
 const raiserIndex=affected.indexOf(raiser);
 const opener=secondRaise&&raiserIndex>0?affected[raiserIndex-1]:null;
 const callerSeats=kind==='call'?affected.slice(affected.length-callers):
  aggressive&&raiser?affected.slice(raiserIndex+1,raiserIndex+1+callers):[];
 const cap=stack-ante,initialRaise=after?ownRaise:secondRaise?2.5:1;
 const minimumRaise=initialRaise>1?Math.round((2*initialRaise-1)*10)/10:2;
 const raiseTo=Number(input.raiseTo),actions=[];
 const seatStacks=Object.fromEntries(positions.filter(p=>p!==hero).map(p=>[p,stack]));
 const result={kind,zone,callers,maxCallers,minCallers,zones,raiser,opener,callerSeats,affected,cap,minimumRaise,initialRaise,
  scenario:null,summary:'',assumptions:'',error:''};
 const fail=message=>{result.error=message;return result;};
 if(![6,8].includes(players)||heroIndex<0)return fail('Tischgröße oder Position prüfen.');
 if(!LIVE_SITUATIONS.some(([key])=>key===kind))return fail('Situation wählen.');
 if(!Number.isFinite(stack)||stack<2||stack>1000)return fail('Eigenen Stack prüfen: 2–1000 BB.');
 if(after&&(!Number.isFinite(ownRaise)||ownRaise<2||ownRaise>=cap))return fail('Eigenen Raise prüfen: mindestens 2 BB und kleiner als dein verfügbarer Stack.');
 if(!affected.length&&kind!=='fold')return fail(after?'Nach dir sitzt niemand mehr.':'Vor dir hat noch niemand gehandelt.');
 if(callers<minCallers||callers>maxCallers)return fail('Caller-Anzahl anpassen: hier sind '+minCallers+'–'+maxCallers+' möglich.');
 if(aggressive&&!raiser)return fail('Für diese Situation fehlen vorherige Spieler.');
 if(after&&kind==='raise')return fail('Nach deinem Raise bitte Re-Raise oder All-in wählen.');
 if(['raise','reraise'].includes(kind)){
  if(!Number.isFinite(raiseTo)||raiseTo<minimumRaise)return fail('Raise auf mindestens '+decimal(minimumRaise)+' BB wählen.');
  if(raiseTo>=cap-1e-6)return fail('Raise erreicht den angenommenen Stack – All-in wählen.');
 }
 const add=(position,action,betBB)=>actions.push({position,action,betBB,stackBB:stack});
 if(opener)add(opener,'raise',initialRaise);
 if(raiser)add(raiser,kind==='allin'?'allin':'raise',kind==='allin'?stack:raiseTo);
 const callTo=kind==='call'?(after?ownRaise:1):kind==='allin'?cap:raiseTo;
 for(const pos of callerSeats)add(pos,'call',callTo);
 const label=LIVE_SITUATIONS.find(([key])=>key===kind)[1];
 const zoneLabel=LIVE_ZONES.find(([key])=>key===zone)?.[1].toLowerCase();
 result.summary=kind==='fold'?'Alle folden':kind==='call'?callers+' Caller'+(after?' auf deinen Raise':' · kein Raise'):
  label+' '+(kind==='allin'?decimal(stack):decimal(raiseTo))+' BB · '+zoneLabel+' · '+callers+' Caller danach';
 const assumed=[];
 if(opener)assumed.push(opener+' eröffnet auf 2,5 BB');
 if(raiser)assumed.push((kind==='allin'?'All-in':'Raiser')+' '+raiser);
 if(callerSeats.length)assumed.push('Caller '+callerSeats.join(', '));
 result.assumptions=assumed.length?'Angenommen: '+assumed.join(' · ')+'.':'';
 if(secondRaise)result.assumptions+=' Eine 3-Bet, keine weitere Erhöhung.';
 result.scenario={mode:after?'after':'before',heroStackBB:stack,ownRaiseBB:after?ownRaise:0,seatStacks,actions};
 if(after&&['fold','call'].includes(kind))return fail('Keine erneute Erhöhung – keine weitere Entscheidung.');
 if(!after&&hero==='BB'&&kind==='fold')return fail('Alle folden zum Big Blind – keine weitere Entscheidung.');
 return result;
}
window.LernPokerSituation={build:buildLiveSituation};
function init(){
 const form=document.querySelector('.form-panel'),picker=$('quick-picker'),nav=document.querySelector('.nav-mobile');
 if(!form||!picker||!nav||!window.PokerModel)return;
 const edit=el('button','', '⚙ Turnierformat ändern');edit.type='button';edit.id='change-tournament';document.querySelector('header').appendChild(edit);
 const welcome=el('section','', '<div class="setup-card"><h2>♠ Turnierformat auswählen</h2><p>Einmal wählen – danach bleibt die Schnell-Eingabe für Zugfahrten im Vordergrund.</p><div class="setup-choices"><button data-profile="A"><b>8 Spieler · 100 BB</b><span>10.000 Chips · 8 Minuten</span></button><button data-profile="B"><b>6 Spieler · 100 BB</b><span>10.000 Chips · 5 Minuten</span></button><button data-profile="C"><b>8 Spieler · 80 BB</b><span>8.000 Chips · 5 Minuten</span></button></div></div>');
 welcome.id='format-setup';welcome.hidden=true;welcome.setAttribute('role','dialog');welcome.setAttribute('aria-modal','true');document.body.appendChild(welcome);
 const mobilePick=picker.querySelector('.mobile-pick');
 const stackBox=el('div','quick-stack','<label for="quick-bb">Mein Stack · BB</label><div class="quick-stack-line"><input id="quick-bb" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="5" aria-describedby="bb-caption bb-example" value="800"><strong id="bb-caption">80,0 BB</strong></div><small id="bb-example">Nur Ziffern: 154 ergibt 15,4 BB; 80 ergibt 8,0 BB.</small>');
 mobilePick.before(stackBox);
 const liveStacks=el('dialog','live-only live-stacks','<div class="live-stack-title"><h3 id="live-stack-title"></h3><button type="button" id="live-stack-close" aria-label="Stackauswahl schließen">✕</button></div><div id="live-stack-ranges"></div>');
 liveStacks.id='live-stack-dialog';liveStacks.setAttribute('aria-labelledby','live-stack-title');picker.append(liveStacks);
 const heroPos=$('heroPos');heroPos.closest('.group').hidden=true;
 const positionBox=el('section','quick-section quick-position-section','<div class="quick-position-header"><h3>Meine Position</h3></div><div id="quick-position-buttons" class="quick-position-buttons" role="group" aria-label="Meine Position"></div>');
 stackBox.after(positionBox);
 const stackPanel=el('section','quick-section quick-all-stacks',
   '<div class="quick-stack-header"><h3>Stacks der übrigen Spieler</h3><button type="button" id="quick-stack-reset">Alle = mein Stack</button></div><div id="quick-stack-grid" class="quick-stack-grid"></div>');
 positionBox.after(stackPanel);
 mobilePick.hidden=true;
 const cards=el('section','quick-section','<h3>Meine Karten</h3><div id="quick-card-display" class="quick-card-display"><button id="card-one" class="quick-current" type="button">Karte 1 · A♠</button><button id="card-two" type="button">Karte 2 · K♠</button></div><div id="quick-ranks" class="quick-rank-buttons" role="group" aria-label="Kartenwert für ausgewählte Karte wählen"></div><div class="quick-suit-buttons" id="quick-suits" role="group" aria-label="Farbe für ausgewählte Karte wählen"></div>');
 mobilePick.before(cards);
 const liveCards=el('section','live-only live-direct-cards','');
 for(let i=0;i<2;i++){
  const card=el('div','live-direct-card','');
  card.innerHTML='<strong id="live-card-label-'+i+'"></strong><div class="live-card-ranks" role="group" aria-label="Wert Karte '+(i+1)+'"></div>';
  for(const r of RANKS){
   const b=el('button','',r);b.type='button';b.dataset.rank=r;
   b.setAttribute('aria-label','Karte '+(i+1)+': '+r);
   b.addEventListener('click',()=>{cardRanks[i]=r;avoidDuplicate(i);updateCards(i);syncScenario();});
   card.querySelector('.live-card-ranks').append(b);
  }
  liveCards.append(card);
 }
 const suitedChoice=el('div','live-suited-choice','<strong id="live-hand-class"></strong>');
 suitedChoice.setAttribute('role','group');suitedChoice.setAttribute('aria-label','Suited oder offsuit');
 for(const kind of ['s','o']){
  const b=el('button','',kind);b.type='button';b.dataset.kind=kind;b.setAttribute('aria-label',kind==='s'?'s · suited':'o · offsuit');
  b.addEventListener('click',()=>{
   if(cardRanks[0]===cardRanks[1])return;
   cardSuits=kind==='s'?['♠','♠']:['♠','♥'];updateCards();syncScenario();
  });suitedChoice.append(b);
 }
 liveCards.prepend(suitedChoice);
 picker.prepend(liveCards);
 cards.classList.add('quick-original-cards');
 const action=el('section','quick-section',
  '<div class="quick-action-header"><h3><span class="live-hide">Aktionen der Gegner</span><span class="live-only">Situation</span></h3><button id="quick-all-fold" type="button" class="quick-reset-fold live-hide">Alle folden</button></div>'+
  '<div class="quick-mode-buttons" role="group" aria-label="Aktionsfolge"><button type="button" data-mode="before">Vor meiner Entscheidung</button><button type="button" data-mode="after">Nach meinem Raise</button></div>'+
  '<div id="quick-own-raise" hidden><label for="quick-own-bet">Mein Raise auf (BB)</label><input id="quick-own-bet" type="text" inputmode="numeric" pattern="[0-9]*" value="22"><span class="quick-digits-value" id="quick-own-value">2,2 BB</span></div>'+
  '<div id="quick-seats" class="quick-seat-list"></div><div id="quick-case-status" role="status" class="quick-case-status"></div>');
 $('q-selected').after(action);
 const liveOwnStack=el('div','live-only live-own-stack','<div><strong>Mein Stack · BB</strong><small>Gegner = mein Stack · auch All-in</small></div><span id="live-own-stack-choice"></span>');
 action.before(liveOwnStack);
 const liveSituation=el('div','live-only live-situation-input','');liveSituation.id='live-situation-input';
 $('quick-seats').before(liveSituation);
 const liveAssumptions=el('p','live-only live-situation-assumptions','');liveAssumptions.id='live-situation-assumptions';
 liveSituation.after(liveAssumptions);
 const liveError=el('div','live-only live-input-error','');liveError.id='live-input-error';liveError.setAttribute('role','alert');action.append(liveError);
 const advanced=el('details','', '<summary>Weitere Angaben · Blindlevel und Tischgröße</summary>');advanced.id='quick-advanced';advanced.append(form.querySelector('.controls'),$('kpis'),$('model-warning'));picker.append(advanced);
 const icmControl=$('useICM');
 if(icmControl){icmControl.checked=false;icmControl.closest('.group').hidden=true;}
 const icmNav=nav.querySelector('button[data-tab="icm"]');
 if(icmNav)icmNav.remove();
 for(const id of ['profile','spot','heroChips','villainChips','villainPos','openBB','threebetBB','heroPos']){$(id).closest('.group').hidden=true;}
 advanced.append(el('details','quick-methodology','<summary>Methodik und Nutzung</summary><p>Die Empfehlungen nutzen ein vereinfachtes Chip-EV-Modell mit angenommener Gegnertaktik und Multiway-Equity, kein exakter GTO-Solver. Einsatz- und Stackangaben werden verwendet; Preisgelder und ICM bleiben in dieser Lernversion deaktiviert. Nur für Lern- und Nachanalysezwecke außerhalb laufender Online-Partien.</p></details>'));
 const accent=document.querySelector('.panel.accent');
 const block=el('div','quick-limit','');block.id='quick-range-limit';accent.querySelector('h2').after(block);
 const seats=()=>PokerModel.POSITIONS[Number($('players').value)]||[];
 const ownBB=()=>{const p=D.profiles[$('profile').value],l=p.levels.find(x=>x.level===Number($('level').value))||p.levels[0];return l.bb;};
 const heroBB=()=>tenth($('quick-bb').value);
 let liveEqualStacks=false;
 let liveMode='before';
 const newSituation=after=>({kind:after?'reraise':'fold',callers:0,zone:after?'late':'middle',raiseBB:2.5,reraiseBB:7.5});
 const liveSituations={before:newSituation(false),after:newSituation(true)};
 const situationState=()=>liveSituations[liveMode];

 const getStack=pos=>{
  if(pos===heroPos.value||liveEqualStacks)return heroBB();
  if(!seatStacks.has(pos))seatStacks.set(pos,{stack:Math.round(Math.max(2,heroBB()||20)*10),custom:false});
  return seatStacks.get(pos).stack/10;
 };
 function renderLiveStacks(){
  for(const b of picker.querySelectorAll('.live-seat-stack')){
   const pos=b.dataset.position,value=getStack(pos),name=pos===heroPos.value?'Ich':pos;
   b.textContent=value.toLocaleString('de-DE')+' BB ▾';
   b.setAttribute('aria-label',name+' Stack: '+decimal(value)+' BB, Bereich wählen');
  }
 }
 let editingStack=null;
 function openLiveStack(){
   editingStack=heroPos.value;
   const value=heroBB(),name='Ich';
   $('live-stack-title').textContent=name+' · Stack in BB';
   const box=$('live-stack-ranges');box.replaceChildren();
   const row=el('div','live-stack-presets','');
   const exact=el('label','live-stack-exact','Exakt · BB');
   const input=el('input','');input.type='number';input.inputMode='decimal';input.min='2';input.max='1000';input.step='0.1';
   input.value=Number.isFinite(value)?String(value):'';input.required=true;input.setAttribute('aria-label',name+' Stack exakt in BB');
   const apply=value=>{
    $('quick-bb').value=mask(value);updateBb();
    liveStacks.close();
   };
   for(const range of LIVE_STACK_RANGES){
    const b=el('button','',range.label+'<small>'+range.value+' BB</small>');b.type='button';b.dataset.stackValue=String(range.value);
    b.title=range.label+' BB → '+range.value+' BB';
    b.setAttribute('aria-label',name+': '+range.label+' BB, rechnen mit '+range.value+' BB');
    b.setAttribute('aria-pressed',String(value===range.value));
    b.classList.toggle('active',value===range.value);
    b.addEventListener('click',()=>apply(range.value));row.append(b);
   }
   const form=el('form','live-stack-form','');
   const submit=el('button','','Übernehmen');submit.type='submit';
   exact.append(input);form.append(exact,submit);box.append(row,form);
   form.addEventListener('submit',e=>{e.preventDefault();if(input.reportValidity())apply(Number(input.value));});
   liveStacks.showModal();
   (row.querySelector('button.active')||row.querySelector('button')).focus();
 }
 function liveStackButton(){
  const b=el('button','live-only live-seat-stack','');b.type='button';b.dataset.position=heroPos.value;
  b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','live-stack-dialog');
  b.addEventListener('click',openLiveStack);return b;
 }
 $('live-stack-close').addEventListener('click',()=>liveStacks.close());
 liveStacks.addEventListener('close',()=>{
  $('live-stack-ranges').replaceChildren();
  [...picker.querySelectorAll('.live-seat-stack')].find(b=>b.dataset.position===editingStack)?.focus();
  editingStack=null;
 });
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
    if(Number.isFinite(n)&&n>=.1){setStack(pos,n,true);renderSeatRows();syncScenario();}
   });
   input.addEventListener('blur',()=>{
    const n=tenth(input.value);
    if(!Number.isFinite(n)||n<.1){input.value=mask(getStack(pos));display.textContent=decimal(getStack(pos))+' BB';}
   });
   wrap.append(heading,input,display);box.append(wrap);
  }
  renderLiveStacks();
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
  liveMode='before';liveSituations.before=newSituation(false);liveSituations.after=newSituation(true);
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
  const positions=seats();
  for(const pos of liveEqualStacks?[...positions].reverse():positions){
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
 function updateCards(changedIndex=activeCard-1){
  avoidDuplicate(changedIndex);
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
  [...liveCards.querySelectorAll('.live-direct-card')].forEach((card,i)=>{
   $('live-card-label-'+i).textContent='Karte '+(i+1)+' · '+cardRanks[i];
   for(const b of card.querySelectorAll('[data-rank]')){
    const chosen=b.dataset.rank===cardRanks[i];b.classList.toggle('active',chosen);b.setAttribute('aria-pressed',String(chosen));
   }
  });
  const pair=cardRanks[0]===cardRanks[1];
  $('live-hand-class').textContent=selectedHand;
  for(const b of suitedChoice.querySelectorAll('button')){
   const chosen=!pair&&b.dataset.kind===(cardSuits[0]===cardSuits[1]?'s':'o');
   b.disabled=pair;b.classList.toggle('active',chosen);b.setAttribute('aria-pressed',String(chosen));
  }
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
  for(const pos of seats()){
   const old=seatStacks.get(pos);
   if(pos!==heroPos.value&&(!old||!old.custom))setStack(pos,Math.max(.1,v||20),false);
  }
  renderStacks();renderSeatRows();syncScenario();
 }
 $('quick-bb').addEventListener('input',updateBb);
 $('quick-bb').addEventListener('blur',()=>{if(!Number.isFinite(heroBB())||heroBB()<=0){$('quick-bb').value='200';updateBb()}});
 function modeSide(){return liveEqualStacks?liveMode:mode==='after'?'after':'before';}
 function applicableSeats(){
  const i=seats().indexOf(heroPos.value);
  if(i<0)return[];
  return modeSide()==='after'?seats().slice(i+1):seats().slice(0,i);
 }
 function markMode(){
  action.querySelectorAll('[data-mode]').forEach(b=>{
   b.classList.toggle('active',b.dataset.mode===modeSide());
   b.setAttribute('aria-pressed',String(b.dataset.mode===modeSide()));
  });
  $('quick-own-raise').hidden=modeSide()!=='after';
 }
 function currentLiveSituation(){
  const s=situationState(),p=D.profiles[$('profile').value];
  const level=p.levels.find(l=>l.level===Number($('level').value))||p.levels[0];
  return buildLiveSituation({players:Number($('players').value),hero:heroPos.value,mode:liveMode,stack:heroBB(),
   ante:level.ante/level.bb,ownRaise:tenth($('quick-own-bet').value),kind:s.kind,zone:s.zone,callers:s.callers,
   raiseTo:s.kind==='reraise'?s.reraiseBB:s.raiseBB});
 }
 function renderLiveSituation(){
  const s=situationState(),info=currentLiveSituation();
  s.zone=info.zone||s.zone;s.callers=info.callers;
  liveSituation.replaceChildren();
  const choose=()=>{renderLiveSituation();syncScenario();};
  const group=(name,options,selected,onClick,disabled=()=>false)=>{
   const box=el('div','live-situation-buttons','');box.setAttribute('role','group');box.setAttribute('aria-label',name);
   for(const [value,label] of options){
    const b=el('button','',label);b.type='button';b.dataset.choice=String(value);
    b.setAttribute('aria-label',name+': '+label);b.classList.toggle('active',value===selected);
    b.setAttribute('aria-pressed',String(value===selected));b.disabled=disabled(value);
    b.addEventListener('click',()=>{onClick(value);choose();});box.append(b);
   }
   return box;
  };
  const choices=LIVE_SITUATIONS.filter(([key])=>liveMode!=='after'||key!=='raise');
  const situations=group('Situation',choices,s.kind,value=>{s.kind=value;if(value==='call'&&!s.callers)s.callers=1;},
   value=>value!=='fold'&&(info.affected.length===0||(value==='reraise'&&liveMode==='before'&&info.affected.length<2)));
  situations.classList.add('live-situation-kinds');liveSituation.append(situations);
  if(['raise','reraise','allin'].includes(s.kind)){
   const row=el('div','live-situation-row','<strong>'+(s.kind==='allin'?'All-in aus':'Raiser aus')+'</strong>');
   const zones=group('Raiser-Position',LIVE_ZONES,s.zone,value=>{s.zone=value;},value=>!info.zones.includes(value));
   for(const b of zones.children){const key=b.dataset.choice;b.title=seats().filter(p=>liveZone(p,Number($('players').value))===key).join(' · ');}
   row.append(zones);liveSituation.append(row);
  }
  if(s.kind!=='fold'){
   const row=el('div','live-situation-row','<strong>'+(s.kind==='call'?'Caller':'Caller danach')+'</strong>');
   const options=Array.from({length:info.maxCallers-info.minCallers+1},(_,i)=>{const n=i+info.minCallers;return[n,String(n)];});
   row.append(group('Caller-Anzahl',options,s.callers,value=>{s.callers=value;}));liveSituation.append(row);
  }
  if(['raise','reraise'].includes(s.kind)){
   const raised=s.kind==='reraise',field=raised?'reraiseBB':'raiseBB';
   const values=raised?[2,2.5,3,3.5,4,5].map(f=>Math.round(info.initialRaise*f*10)/10):[2,2.2,2.5,3,4,5];
   const row=el('div','live-situation-sizing','<strong>'+(raised?'Re-Raise':'Raise')+' auf · BB</strong>');
   const buttons=group('Raise auf',values.map(v=>[v,v.toLocaleString('de-DE')+' BB']),s[field],value=>{s[field]=value;},
    value=>value<info.minimumRaise||value>=info.cap-1e-6);
   buttons.classList.add('live-situation-raises');
   for(const [i,b] of [...buttons.children].entries())b.dataset.raiseBb=String(values[i]);
   const exact=el('label','live-situation-exact','Exakt · BB');
   const input=el('input','');input.type='number';input.inputMode='decimal';input.step='0.1';input.min=String(info.minimumRaise);
   input.value=Number.isFinite(s[field])?String(s[field]):'';input.setAttribute('aria-label','Gegner-Raise exakt in BB');
   input.addEventListener('input',()=>{s[field]=input.value===''?NaN:Number(input.value);syncScenario();});
   exact.append(input);row.append(buttons,exact);liveSituation.append(row);
  }
 }
 function updateLiveSituationFeedback(info){
  liveAssumptions.textContent=info.assumptions;
  const s=situationState(),amount=s.kind==='reraise'?s.reraiseBB:s.raiseBB;
  for(const b of liveSituation.querySelectorAll('[data-raise-bb]')){
   const selected=Number(b.dataset.raiseBb)===amount;
   b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));
  }
 }
 function renderRaisePresets(){
  if(liveEqualStacks){renderLiveSituation();return;}
  const side=modeSide(),positions=applicableSeats();
  const profile=D.profiles[$('profile').value];
  const level=profile.levels.find(l=>l.level===Number($('level').value))||profile.levels[0];
  const ante=level.ante/level.bb;
  for(const box of $('quick-seats').querySelectorAll('.live-raise-presets')){
   const pos=box.closest('[data-seat]').dataset.seat,s=getState(side,pos);
   let previous=side==='after'?(tenth($('quick-own-bet').value)||2.2):1;
   for(const earlier of positions.slice(0,positions.indexOf(pos))){
    const state=getState(side,earlier);
    if(state.action==='raise')previous=Math.max(previous,state.bet/10);
    if(state.action==='allin')previous=Math.max(previous,getStack(earlier)-ante);
   }
   // Input shortcuts only: the strategy and the manually entered amount stay unchanged.
   const values=previous>1?[2,2.5,3,3.5,4,5].map(factor=>Math.round(previous*factor*10)/10):[2,2.2,2.5,3,4,5];
   box.replaceChildren();
   for(const value of values){
    const label=value.toLocaleString('de-DE');
    const b=el('button','',''+label+' BB');b.type='button';b.dataset.raiseBb=String(value);
    b.setAttribute('aria-label',pos+': Raise auf '+label+' BB');
    const chosen=Number(s.bet)===Math.round(value*10);
    b.classList.toggle('active',chosen);b.setAttribute('aria-pressed',String(chosen));
    b.disabled=!Number.isFinite(value)||value<=previous||value>=getStack(pos)-ante-1e-6;
    b.title=b.disabled?'Nicht als Raise verfügbar – Stack prüfen oder All-in wählen.':'Gesamteinsatz auf '+label+' BB';
    b.addEventListener('click',()=>{s.bet=Math.round(value*10);renderSeatRows();syncScenario();});
    box.append(b);
   }
  }
 }
 function renderSeatRows(){
  markMode();
  $('live-own-stack-choice').replaceChildren(liveStackButton());
  const box=$('quick-seats');box.innerHTML='';
  if(liveEqualStacks){renderLiveStacks();renderLiveSituation();return;}
  const side=modeSide(),positions=applicableSeats();
  if(positions.length===0){
   box.append(el('p','quick-seat-empty',mode==='after'?'Nach deiner Position sitzt niemand mehr.':'Du bist als Erster an der Reihe.'));
  }
  for(const pos of positions){
   const s=getState(side,pos);s.stack=Math.round(getStack(pos)*10);
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
   if(s.action==='raise'){
    const presets=el('div','live-only live-raise-presets','');
    presets.setAttribute('role','group');presets.setAttribute('aria-label',pos+' Raise auf BB');card.append(presets);
   }
   if(s.action!=='fold'){
    const fields=el('div','quick-seat-numbers','');
    if(s.action!=='allin'){
     const betGroup=el('label','','Gesamteinsatz (BB)');
     const bet=el('input','');bet.type='text';bet.inputMode='numeric';bet.pattern='[0-9]*';bet.maxLength=5;
     bet.value=String(s.bet);bet.setAttribute('aria-label',pos+' Gesamteinsatz in Zehntel-BB');
     const betValue=el('span','quick-digits-value',decimal(s.bet/10)+' BB');
     bet.addEventListener('input',()=>{
      bet.value=digits(bet.value);s.bet=Number(bet.value);
      betValue.textContent=decimal(s.bet/10)+' BB';renderRaisePresets();syncScenario();
     });
     betGroup.append(bet,betValue);fields.append(betGroup);
    }
    const stackGroup=el('label','quick-action-stack','Stack (BB)');
    if(s.action==='allin')fields.classList.add('quick-allin-numbers');
    const stack=el('input','');stack.type='text';stack.inputMode='numeric';stack.pattern='[0-9]*';stack.maxLength=5;stack.value=String(s.stack);
    stack.setAttribute('aria-label',pos+' Stack in Zehntel-BB');
    const stackValue=el('span','quick-digits-value',decimal(s.stack/10)+' BB');
    stack.addEventListener('input',()=>{
     stack.value=digits(stack.value);s.stack=Number(stack.value);s.customStack=true;
     const next=tenth(stack.value);if(Number.isFinite(next)&&next>=.1)setStack(pos,next,true);
     if(s.action==='allin')s.bet=s.stack;
     stackValue.textContent=decimal(s.stack/10)+' BB';renderStacks();syncScenario();
    });
    stackGroup.append(stack,stackValue);fields.append(stackGroup);
    card.append(fields);
   }
   box.append(card);
  }
  renderLiveStacks();
  renderRaisePresets();
 }
 action.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
  if(liveEqualStacks)liveMode=b.dataset.mode;else mode=b.dataset.mode;
  renderSeatRows();syncScenario();
 }));
 $('quick-all-fold').addEventListener('click',()=>{
  mode='before';
  for(const seat of seats())for(const side of ['before','after'])getState(side,seat).action='fold';
  renderSeatRows();syncScenario();
 });
 $('quick-own-bet').addEventListener('input',()=>{
  $('quick-own-bet').value=digits($('quick-own-bet').value);
  $('quick-own-value').textContent=decimal(tenth($('quick-own-bet').value)||0)+' BB';
  renderRaisePresets();syncScenario();
 });
 function blocked(message){
  const liveMessage=$('live-message');
  if(liveEqualStacks&&message!==currentStatus&&liveMessage?.textContent===currentStatus)liveMessage.textContent='';
  currentStatus=message;accent.classList.toggle('quick-blocked',Boolean(message));
  $('quick-range-limit').textContent=message||'';
  $('live-input-error').textContent=message||'';
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
  const before=modeSide()==='before',side=modeSide();
  const positions=applicableSeats();
  const simple=liveEqualStacks?currentLiveSituation():null;
  if(simple)updateLiveSituationFeedback(simple);
  const involved=simple?(simple.scenario?.actions||[]).map(x=>({pos:x.position,action:x.action,bet:Math.round(x.betBB*10),stack:mask(x.stackBB)})):
   positions.map(pos=>({pos,...getState(side,pos),stack:mask(getStack(pos))})).filter(s=>s.action!=='fold');
  const ownRaise=tenth($('quick-own-bet').value)||2.2;
  const prior=involved.filter(s=>s.action==='raise'||s.action==='allin');
  let problem=simple?.error||'',next='RFI',vPos='',vStack=stack,vBet=2.2;
  if(stack<2)problem='Unter 2 BB ist keine reguläre Preflop-Empfehlung verfügbar.';
  if(!problem&&before&&hero==='BB'&&involved.length===0)problem='Alle folden zum Big Blind – keine weitere Entscheidung.';
  if(!problem&&!before&&!positions.length)problem='Nach deiner Position sitzt niemand mehr.';
  if(!problem&&!before&&!prior.length)problem='Keine erneute Erhöhung – es ist keine zweite Entscheidung erforderlich.';
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
  const completeStacks=Object.fromEntries(seats().filter(x=>x!==hero).map(pos=>[pos,getStack(pos)]));
  const scenario=involved.length?(simple?.scenario||{
   mode:before?'before':'after',
   heroStackBB:stack,
   ownRaiseBB:before?0:ownRaise,
   seatStacks:completeStacks,
   actions:involved.map(x=>({
    position:x.pos,action:x.action,
    betBB:(liveEqualStacks&&x.action==='allin'?x.stack:x.bet)/10,stackBB:x.stack/10
   }))
  }):null;
  window.LernPokerScenario=null;
  window.LernPokerTrainingState={mode:before?'before':'after',heroStackBB:stack,seatStacks:completeStacks,scenario,
    stackAssumption:liveEqualStacks?'hero':null,
    situation:simple?{kind:simple.kind,zone:simple.zone,callers:simple.callers,summary:simple.summary,assumptions:simple.assumptions}:null,
    cards:[{rank:cardRanks[0],suit:cardSuits[0]},{rank:cardRanks[1],suit:cardSuits[1]}]};
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
 $('level').addEventListener('change',()=>{renderRaisePresets();syncScenario()});
 $('players').addEventListener('change',()=>{renderPositions();renderStacks();renderSeatRows();syncScenario()});
 $('heroChips').addEventListener('change',()=>{$('quick-bb').value=mask(Number($('heroChips').value)/ownBB());updateBb()});
 $('profile').addEventListener('change',()=>{$('quick-bb').value=mask(D.profiles[$('profile').value].startstack/ownBB());states.clear();seatStacks.clear();liveMode='before';liveSituations.before=newSituation(false);liveSituations.after=newSituation(true);renderPositions();renderStacks();renderSeatRows();syncScenario()});
 window.addEventListener('lernpoker:tabchange',e=>{
  const equalStacks=e?.detail?.tab==='live';
  if(equalStacks===liveEqualStacks)return;
  liveEqualStacks=equalStacks;
  renderPositions();renderStacks();renderSeatRows();syncScenario();
 });
 // Die Oberfläche bleibt kompakt; die ursprünglichen Felder sind in "Weitere Angaben".
 new MutationObserver(()=>{if(!form.hidden)form.hidden=true}).observe(form,{attributes:true,attributeFilter:['hidden']});
 nav.addEventListener('click',()=>setTimeout(()=>{form.hidden=true},0));
 form.hidden=true;
 const stored=(()=>{try{return localStorage.getItem(FORMAT_KEY)}catch(_){return null}})();
 if(stored&&D.profiles[stored])setProfile(stored);
 else {renderPositions();renderStacks();renderSeatRows();updateCards();syncScenario();showSetup();}
}
window.addEventListener('DOMContentLoaded',init);
})();
