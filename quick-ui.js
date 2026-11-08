(function(){
'use strict';
const $=id=>document.getElementById(id);
const RANKS='AKQJT98765432', FORMAT_KEY='LernPokerTournament_v2';
const SUITS=[{symbol:'♠',name:'Pik'},{symbol:'♥',name:'Herz'},{symbol:'♦',name:'Karo'},{symbol:'♣',name:'Kreuz'}];
let mode='rfi', activeCard=1, cardRanks=['A','K'], cardSuits=['♠','♠'], editingSeat='', currentStatus='';
const states=new Map();
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
 mobilePick.hidden=true;
 const cards=el('section','quick-section','<h3>Meine Karten</h3><div id="quick-card-display" class="quick-card-display"><button id="card-one" class="quick-current" type="button">Karte 1 · A♠</button><button id="card-two" type="button">Karte 2 · K♠</button></div><div id="quick-ranks" class="quick-rank-buttons" role="group" aria-label="Kartenwert für ausgewählte Karte wählen"></div><div class="quick-suit-buttons" id="quick-suits" role="group" aria-label="Farbe für ausgewählte Karte wählen"></div>');
 mobilePick.before(cards);
 const action=el('section','quick-section','<h3>Aktionen in dieser Hand</h3><div class="quick-mode-buttons" role="group" aria-label="Situation"><button type="button" data-mode="rfi">Alle folden</button><button type="button" data-mode="before">Aktionen vor mir</button><button type="button" data-mode="after">Nach meinem Raise</button></div><div id="quick-action-instructions" class="quick-note"></div><div id="quick-own-raise" hidden><label for="quick-own-bet">Meine Eröffnung · Gesamtbetrag in BB</label><input id="quick-own-bet" type="text" inputmode="numeric" pattern="[0-9]*" value="22"><span class="quick-digits-value" id="quick-own-value">2,2 BB</span></div><div id="quick-seats" class="quick-seat-list"></div><div id="quick-case-status" role="status" class="quick-case-status"></div>');
 $('q-selected').after(action);
 const advanced=el('details','', '<summary>Weitere Angaben · Level, Tischgröße, ICM</summary>');advanced.id='quick-advanced';advanced.append(form.querySelector('.controls'),$('kpis'),$('model-warning'));picker.append(advanced);
 for(const id of ['profile','spot','heroChips','villainChips','villainPos','openBB','threebetBB','heroPos']){$(id).closest('.group').hidden=true;}
 advanced.append(el('details','quick-methodology','<summary>Methodik und Nutzung</summary><p>Das Rechenmodell verwendet geschätzte Chip-EV-Strategien und ist keine vollständig gelöste GTO-Strategie. Mehrere aktive Gegner und komplexe Action-Trees werden noch nicht vollständig unterstützt. Nur zum Lernen und zur Nachanalyse außerhalb laufender Online-Partien.</p></details>'));
 const accent=document.querySelector('.panel.accent');
 const block=el('div','quick-limit','');block.id='quick-range-limit';accent.querySelector('h2').after(block);
 const seats=()=>PokerModel.POSITIONS[Number($('players').value)]||[];
 const ownBB=()=>{const p=D.profiles[$('profile').value],l=p.levels.find(x=>x.level===Number($('level').value))||p.levels[0];return l.bb;};
 const heroBB=()=>tenth($('quick-bb').value);
 const seatId=(side,pos)=>side+':'+pos;
 const getState=(side,pos)=>{
  const id=seatId(side,pos);
  if(!states.has(id))states.set(id,{action:'fold',bet:side==='after'?75:22,stack:Math.round(Math.max(2,heroBB()||20)*10),customStack:false});
  return states.get(id);
 };
 function showSetup(){welcome.hidden=false;document.body.style.overflow='hidden';welcome.querySelector('button').focus();}
 function hideSetup(){welcome.hidden=true;document.body.style.overflow='';}
 function setProfile(key){
  if(!D.profiles[key])return;
  $('profile').value=key;$('level').value='1';setupProfile(false);
  states.clear();mode='rfi';editingSeat='';
  $('quick-bb').value=mask(D.profiles[key].startstack/ownBB());
  cardRanks=['A','K'];cardSuits=['♠','♠'];activeCard=1;updateCards();
  renderPositions();renderSeatRows();syncScenario();
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
    renderPositions();renderSeatRows();syncScenario();
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
  action.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode))});
  $('quick-own-raise').hidden=mode!=='after';
  $('quick-action-instructions').textContent=mode==='rfi'?'Alle Spieler vor dir folden; im Big Blind gewinnst du bei SB-Fold den Pot.':mode==='before'?'Tippe eine Position an und wähle Fold, Call/Limp, Raise oder All-in. Einsatz und Stack in BB als Ziffern (z. B. 225 = 22,5 BB).':'Du hast zuerst eröffnet. Gib deine Raisegröße ein und danach die Reaktion einer Position hinter dir.';
 }
 function renderSeatRows(){
  markMode();
  const box=$('quick-seats');box.innerHTML='';
  if(mode==='rfi')return;
  const side=modeSide();
  for(const pos of applicableSeats()){
   const id=seatId(side,pos),s=getState(side,pos);
   const card=el('div','quick-seat','');card.dataset.seat=pos;
   const head=el('button','quick-seat-head','');head.type='button';head.textContent=pos+' · '+({fold:'Fold',call:'Call / Limp',raise:side==='after'?'3-Bet':'Raise',allin:'All-in'}[s.action])+(s.action!=='fold'?' · '+decimal((s.action==='allin'?s.stack:s.bet)/10)+' BB':'')+' ▾';
   head.setAttribute('aria-expanded',String(editingSeat===id));
   head.addEventListener('click',()=>{editingSeat=editingSeat===id?'':id;renderSeatRows()});
   card.append(head);
   if(editingSeat===id){
    const details=el('div','quick-seat-details','');
    const choices=el('div','quick-seat-choices','');
    for(const [kind,label] of [['fold','Fold'],['call','Call / Limp'],['raise',side==='after'?'3-Bet':'Raise'],['allin','All-in']]){
     const b=el('button','',label);b.type='button';b.classList.toggle('active',s.action===kind);
     b.addEventListener('click',()=>{
      s.action=kind;
      if(kind==='allin')s.bet=s.stack;
      if(kind==='call'&&s.bet<10)s.bet=10;
      if(kind==='raise'&&s.bet<(side==='after'?35:20))s.bet=side==='after'?75:22;
      renderSeatRows();syncScenario();
     });choices.append(b);
    }
    details.append(choices);
    if(s.action!=='fold'){
     const numberFields=el('div','quick-seat-numbers','');
     if(s.action!=='allin'){
      const betGroup=el('label','', 'Gesamt-Einsatz (BB)');const bet=el('input','');
      bet.type='text';bet.inputMode='numeric';bet.pattern='[0-9]*';bet.maxLength=5;bet.value=String(s.bet);
      const betValue=el('span','quick-digits-value',decimal(s.bet/10)+' BB');
      bet.addEventListener('input',()=>{bet.value=digits(bet.value);s.bet=Number(bet.value);betValue.textContent=decimal(s.bet/10)+' BB';head.textContent=pos+' · '+(s.action==='raise'?(side==='after'?'3-Bet':'Raise'):'Call / Limp')+' · '+decimal(s.bet/10)+' BB ▾';syncScenario()});
      betGroup.append(bet,betValue);numberFields.append(betGroup);
     }
     const stackGroup=el('label','', 'Stack vor der Hand (BB)');const st=el('input','');
     st.type='text';st.inputMode='numeric';st.pattern='[0-9]*';st.maxLength=5;st.value=String(s.stack);
     const stackValue=el('span','quick-digits-value',decimal(s.stack/10)+' BB');
     st.addEventListener('input',()=>{st.value=digits(st.value);s.stack=Number(st.value);s.customStack=true;if(s.action==='allin')s.bet=s.stack;stackValue.textContent=decimal(s.stack/10)+' BB';head.textContent=pos+' · '+(s.action==='allin'?'All-in':'Einsatz')+' · '+decimal((s.action==='allin'?s.stack:s.bet)/10)+' BB ▾';syncScenario()});
     stackGroup.append(st,stackValue);numberFields.append(stackGroup);
     if(s.action==='allin')numberFields.append(el('p','quick-note','All-in-Einsatz = Spielerstack.'));
     details.append(numberFields);
    }
    card.append(details);
   }
   box.append(card);
  }
 }
 action.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;editingSeat='';renderSeatRows();syncScenario()}));
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
  const hero=heroPos.value, stack=heroBB();
  const summary=$('quick-case-status'),lvl=ownBB();
  if(!Number.isFinite(stack)||stack<=0||stack>1000){
   summary.textContent='Ungültiger eigener Stack: 1 bis 10.000 als Ziffern eingeben (letzte Ziffer ist Zehntel-BB).';
   blocked('Bitte gültigen Stack eingeben.');return;
  }
  $('heroChips').value=String(Math.max(1,Math.round(stack*lvl)));
  const before=mode!=='after',side=modeSide(),involved=mode==='rfi'?[]:applicableSeats().map(pos=>({pos,...getState(side,pos)})).filter(s=>s.action!=='fold');
  let next='RFI',vPos='',vBet=22,vStack=stack,ownRaise=tenth($('quick-own-bet').value)||2.2,problem='';
  if(stack<2)problem='Unter 2 BB ist das vorhandene Preflop-Modell nicht anwendbar.';
  if(mode==='rfi'&&hero==='BB')problem='Alle Spieler einschließlich Small Blind folden: Als Big Blind gewinnst du den Pot ohne Entscheidung.';
  if(mode!=='rfi'){
    if(!applicableSeats().length)problem='Vor bzw. hinter dieser Position gibt es keine entsprechenden Akteure.';
    if(involved.some(s=>s.stack<1||s.stack>10000||s.bet<=0||s.bet>s.stack))problem='Mindestens ein Spieler hat einen ungültigen Stack oder Einsatz (Einsatz darf Stack nicht überschreiten).';
    if(involved.length>1)problem='Für mehrere aktive Gegner ist hier noch keine Empfehlung verfügbar.';
    if(involved.length===1){
      const v=involved[0];vPos=v.pos;vBet=v.action==='allin'?v.stack/10:v.bet/10;vStack=v.stack/10;
      if(Math.min(stack,vStack)<2)problem='Effektiver Stack unter 2 BB: die vorhandene Engine kann diesen Fall nicht zuverlässig abbilden.';
      if(before){
        if(v.action==='raise'){next='OPEN';if(vBet<1.5)problem='Ein Raise muss mindestens auf 1,5 BB gehen.';}
        else if(v.action==='allin'){next='JAM';}
        else problem='Für Limp-/Call-Pots ist noch keine Empfehlung verfügbar.';
      }else{
        if(v.action==='raise'){next='3BET';if(vBet<=ownRaise||vBet<3.5)problem='Die 3-Bet muss höher als deine Eröffnung sein und mindestens 3,5 BB betragen (Modellgrenze).';}
        else problem='Für diese Folgeaktion ist noch keine Empfehlung verfügbar.';
      }
    }else if(involved.length===0){
      if(mode==='after')problem='Nach deinem Raise folden alle: Es besteht keine weitere Preflop-Entscheidung.';
      else next='RFI';
    }
  }
  if(mode==='after'&&(ownRaise<1.5||ownRaise>=stack))problem='Dein Open-Raise muss mindestens 1,5 BB betragen und kleiner als dein Stack sein.';
  const spot=$('spot');if(spot.value!==next){spot.value=next;refreshSeats(false);}
  if([...heroPos.options].some(o=>o.value===hero)){heroPos.value=hero;}refreshVillain();
  if(vPos&&[...$('villainPos').options].some(o=>o.value===vPos))$('villainPos').value=vPos;
  $('villainChips').value=String(Math.max(1,Math.round(vStack*lvl)));
  $('openBB').value=String(mode==='after'?ownRaise:Math.max(1.5,vBet));
  $('threebetBB').value=String(Math.max(3.5,vBet));
  if(!problem)render();
  else {render();blocked(problem);}
  if(!problem)blocked('');
  if(mode==='rfi')summary.textContent='Alle folden · '+hero+' · '+decimal(stack)+' BB eigener Stack.';
  else summary.textContent=involved.length?involved.map(v=>v.pos+': '+({call:'Call/Limp',raise:mode==='after'?'3-Bet':'Raise',allin:'All-in'}[v.action])+' '+decimal((v.action==='allin'?v.stack:v.bet)/10)+' BB · Stack '+decimal(v.stack/10)+' BB').join(' | '):'Alle gewählten Positionen folden.';
  // Die Meldung erscheint nur am Ergebnisfeld; nicht doppelt in der Aktionsübersicht.
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