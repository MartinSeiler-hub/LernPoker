/* LernPoker LiveTest: private, consensual six-max chip-EV field test without stakes.
 * One immutable weighted sample per locked hand, local records; not GTO verified.
 */
(function(global){
'use strict';
const $=id=>document.getElementById(id);
const KEY='LernPokerLiveTestV1';
const ACTIONS={FOLD:'Fold',CHECK:'Check',CALL:'Call',LIMP:'Limp',RAISE:'Raise','3BET':'3-Bet','4BET':'4-Bet',JAM:'All-in'};
const numeric=n=>Number(n).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});
const isRaise=a=>['RAISE','3BET','4BET','JAM'].includes(a);
const plain=s=>String(s??'').replace(/\s+/g,' ').trim();
let data={active:null,history:[]}, tab='trainer';
const prevDisabled=new WeakMap();
function persist(){
 try{global.localStorage.setItem(KEY,JSON.stringify(data));$('live-storage-warning').textContent='';return true;}
 catch(e){$('live-storage-warning').textContent='Lokale Speicherung nicht verfügbar. Verlauf vor dem Schließen kopieren.';return false;}
}
function load(){
 try{
  const obj=JSON.parse(global.localStorage.getItem(KEY)||'null');
  if(obj&&Array.isArray(obj.history))data={active:obj.active||null,history:obj.history.slice(0,1000)};
 }catch(e){}
}
function showAction(x){
 if(!x)return '–';
 let s=ACTIONS[x.action]||x.action;
 if(x.bluff&&isRaise(x.action))s+='-Bluff';
 if(x.action==='JAM')return s;
 if(isRaise(x.action)&&Number.isFinite(x.toBB))return s+' auf '+numeric(x.toBB)+' BB';
 if(x.action==='CALL'&&Number.isFinite(x.toBB))return s+' · '+numeric(x.toBB)+' BB';
 return s;
}
function showCards(){
 const labels=['card-one','card-two'].map(id=>$(id)?.textContent||'');
 const cards=labels.map(label=>label.match(/([AKQJT98765432][♠♥♦♣])\s*$/)?.[1]).filter(Boolean);
 return cards.length===2?cards.join(' '):(typeof selectedHand==='string'?selectedHand:'–');
}
function draw(){
 if(global.crypto?.getRandomValues){
  const buffer=new Uint32Array(1);global.crypto.getRandomValues(buffer);return buffer[0]/4294967296;
 }
 return Math.random();
}
function selection(){
 if(!global.LernPokerMix||typeof selectedInputs!=='function'||typeof selectedHand!=='string')return {error:'Strategie noch nicht geladen'};
 const inputs=selectedInputs();
 if(Number(inputs.players)!==6)return {error:'LiveTest ist zunächst für sechs Spieler ausgelegt. Wähle das 6-Max-Turnier.'};
 if(document.querySelector('.panel.accent')?.classList.contains('quick-blocked'))return {error:plain($('quick-range-limit')?.textContent||'Eingaben prüfen.')};
 const training=global.LernPokerTrainingState;
 const base=typeof current!=='undefined'?current?.hands?.[selectedHand]:null;
 if(!training||!base)return {error:'Bitte zuerst Hand, Position und Stacks eingeben.'};
 const strategy=global.LernPokerMix.calculate(D,inputs,training,selectedHand,base);
 if(!strategy?.enabled)return {error:'Für diese Hand keine Mischstrategie verfügbar: '+(strategy?.reason||'Eingaben prüfen.')};
 return {inputs,training,hand:selectedHand,strategy};
}
function lock(){
 if(data.active){$('live-message').textContent='Diese Empfehlung ist bereits für die laufende Hand fixiert.';return;}
 const v=selection();
 if(v.error){$('live-message').textContent=v.error;return;}
 const unit=draw();
 const picked=global.LernPokerMix.sample(v.strategy,unit);
 if(!picked){$('live-message').textContent='Keine gültige Empfehlung ermittelt.';return;}
 const now=new Date().toISOString();
 const id=now+'-'+Math.round(unit*1e9).toString(36);
 data.active={
  id,createdAt:now,profile:v.inputs.profile,players:v.inputs.players,
  hand:v.hand,physicalCards:showCards(),heroPosition:v.inputs.position,
  stackBB:v.training.heroStackBB,
  inputs:JSON.parse(JSON.stringify(v.inputs)),training:JSON.parse(JSON.stringify(v.training)),
  picked:{action:picked.action,toBB:picked.toBB,p:picked.p,bluff:picked.bluff,ev:picked.ev},
  mix:v.strategy.options.map(o=>({action:o.action,toBB:o.toBB,prob:o.p,bluff:o.bluff})),
  randomUnit:unit,model:'EV-gewichteter Trainingsmix – nicht solverbestätigt'
 };
 persist();render();$('live-message').textContent='Empfehlung für diese Hand fixiert. Erst nach der Hand dokumentieren.';
}
function freezeInputs(){
 const freeze=tab==='live'&&!!data.active;
 const picker=$('quick-picker');
 if(!picker)return;
 picker.classList.toggle('live-inputs-frozen',freeze);
 // A resumed locked hand must not display newly initialized or edited training inputs.
 picker.hidden=freeze || !['trainer','matrix','live'].includes(tab);
 const controlList=[...picker.querySelectorAll('button,input,select,textarea'),$('change-tournament')].filter(Boolean);
 for(const input of controlList){
  if(freeze){
   if(!prevDisabled.has(input))prevDisabled.set(input,input.disabled);
   input.disabled=true;
  }else if(prevDisabled.has(input)){
   input.disabled=prevDisabled.get(input);prevDisabled.delete(input);
  }
 }
}
function clearEntry(){
 $('live-actual').value='recommended';
 $('live-actual-to').value='';
 $('live-delta').value='';
 $('live-outcome').value='unknown';
 $('live-notes').value='';
 $('live-actual-bet').hidden=true;
}
function updateActual(){
 const selected=$('live-actual').value;
 $('live-actual-bet').hidden=!['RAISE','3BET','4BET','JAM'].includes(selected);
}
function save(status='completed'){
 const active=data.active;
 if(!active){$('live-message').textContent='Es gibt keine fixierte Hand.';return;}
 let actual=null,actualTo=null,outcome='unknown',delta=null,note='';
 if(status==='completed'){
  actual=$('live-actual').value;
  if(actual==='recommended'){actual=active.picked.action;actualTo=active.picked.toBB;}
  else if(isRaise(actual)){
   if(actual==='JAM')actualTo=active.stackBB;
   else{
    const raw=$('live-actual-to').value.trim().replace(',','.');
    if(!raw||!Number.isFinite(Number(raw))||Number(raw)<1){
     $('live-message').textContent='Bitte die tatsächlich gewählte Raisehöhe in BB angeben.';return;
    }
    actualTo=Number(raw);
   }
  }
  outcome=$('live-outcome').value;
  const rawDelta=$('live-delta').value.trim().replace(',','.');
  if(rawDelta!==''){
   if(!/^[+-]?\d+(?:\.\d+)?$/.test(rawDelta)||Math.abs(Number(rawDelta))>1000){
    $('live-message').textContent='Chip-Ergebnis bitte als vorzeichenbehaftete BB-Zahl eingeben.';return;
   }
   delta=Number(rawDelta);
  }
  note=plain($('live-notes').value).slice(0,400);
 }
 const followed=status==='completed' && actual===active.picked.action &&
  (!isRaise(actual)||actual==='JAM'||Math.abs(Number(actualTo)-Number(active.picked.toBB))<=.11);
 data.history.unshift({...active,status,actual,actualToBB:actualTo,followed:status==='completed'?followed:null,
  outcome,deltaBB:delta,note,recordedAt:new Date().toISOString()});
 data.history=data.history.slice(0,1000);
 data.active=null;
 persist();
 clearEntry();render();
 $('live-message').textContent=status==='aborted'?'Abgebrochene Hand im Protokoll vermerkt.':'Hand dokumentiert. Du kannst die nächste vorbereiten.';
}
function csv(){
 const fields=['Zeit','Status','Turnierprofil','Position','Hand','Physische Karten','Stack BB',
  'Empfehlung','Raise auf BB','Modellgewicht %','Bluff','Tatsächliche Aktion',
  'Tatsächlich auf BB','Empfehlung befolgt','Ergebnis','Chip-Delta BB','Notiz'];
 const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const row=rec=>[
  rec.createdAt,rec.status,rec.profile,rec.heroPosition,rec.hand,rec.physicalCards,
  rec.stackBB,rec.picked?.action,rec.picked?.toBB,rec.picked?.p!=null?100*rec.picked.p:null,
  rec.picked?.bluff?'Ja':'Nein',rec.actual,rec.actualToBB,rec.followed===null?'':rec.followed?'Ja':'Nein',
  rec.outcome,rec.deltaBB,rec.note
 ].map(q).join(';');
 return [fields.map(q).join(';'),...data.history.map(row)].join('\n');
}
async function copyHistory(){
 const text=csv();
 try{await navigator.clipboard.writeText(text);$('live-message').textContent='Verlauf als CSV kopiert.';}
 catch(e){
  $('live-export-text').hidden=false;$('live-export-text').value=text;
  $('live-export-text').focus();$('live-export-text').select();
  $('live-message').textContent='CSV zum manuellen Kopieren eingeblendet.';
 }
}
function clearHistory(){
 if(!data.history.length)return;
 if(!global.confirm('Wirklich alle gespeicherten LiveTest-Hände auf diesem Gerät löschen?'))return;
 data.history=[];persist();render();$('live-message').textContent='Lokaler LiveTest-Verlauf geleert.';
}
function renderHistory(){
 const completed=data.history.filter(h=>h.status==='completed');
 const logged=completed.filter(h=>Number.isFinite(h.deltaBB));
 const net=logged.reduce((s,h)=>s+h.deltaBB,0);
 const bluffs=completed.filter(h=>h.picked?.bluff);
 const followed=completed.filter(h=>h.followed).length;
 const n=completed.length;
 $('live-stats').textContent=n+' abgeschlossene Hände · '+followed+' Empfehlung befolgt · '+
  bluffs.length+' Bluffempfehlungen · '+logged.length+' Ergebnisse in BB ('+
  (net>=0?'+':'')+numeric(net)+' BB gesamt)';
 const wrap=$('live-history-list');wrap.replaceChildren();
 for(const h of data.history.slice(0,25)){
  const line=document.createElement('div');line.className='live-history-item';
  const title=document.createElement('strong');title.textContent=h.physicalCards+' · '+h.heroPosition+' · '+showAction(h.picked);
  const text=document.createElement('span');text.textContent=h.status==='aborted'?'Abgebrochen':
   (h.followed?'Befolgt':'Abgewichen')+' · '+(h.outcome||'unbekannt')+
   (Number.isFinite(h.deltaBB)?' · '+(h.deltaBB>=0?'+':'')+numeric(h.deltaBB)+' BB':'');
  line.append(title,text);wrap.append(line);
 }
}
function render(){
 const active=data.active;
 const live=tab==='live';
 $('live-sticky').hidden=!live;
 $('live-test').hidden=!live;
 const unlocked=$('live-prep'),locked=$('live-locked');
 unlocked.hidden=!!active;locked.hidden=!active;
 if(active){
  $('live-sticky-hand').textContent=active.physicalCards+' · '+active.heroPosition;
  $('live-sticky-action').textContent=showAction(active.picked);
  $('live-sticky-meta').textContent='Hand fixiert · Modellmix '+Math.round(active.picked.p*100)+' % · '+
     (active.picked.bluff?'Bluffkandidat · ':'')+'nicht solverbestätigt';
  $('live-locked-hand').textContent='Hand '+active.physicalCards+' · '+active.heroPosition+
    ' · '+numeric(active.stackBB)+' BB';
  $('live-locked-action').textContent=showAction(active.picked);
  const actors=active.training?.scenario?.actions||[];
  const actorText=actors.length?actors.map(a=>
   a.position+' '+(ACTIONS[a.action]||a.action)+
   (a.action!=='fold'?' '+numeric(a.betBB??a.stackBB)+' BB':'')+
   (Number.isFinite(a.stackBB)?' (Stack '+numeric(a.stackBB)+' BB)':'')).join(' · '):
   'Alle vorherigen Positionen folden';
  $('live-locked-situation').textContent=actorText;
  const mix=$('live-locked-mix');mix.replaceChildren();
  for(const entry of active.mix){
   const pill=document.createElement('span');pill.className='live-mix-pill';
   if(entry.action===active.picked.action&&entry.toBB===active.picked.toBB)pill.classList.add('active');
   pill.textContent=showAction(entry)+' '+Math.round(entry.prob*100)+' %';
   mix.appendChild(pill);
  }
 }else{
  $('live-sticky-hand').textContent='LiveTest · 6-Max';
  $('live-sticky-action').textContent='Hand vorbereiten';
  $('live-sticky-meta').textContent='Nach der Eingabe einmal ziehen und fixieren';
 }
 freezeInputs();renderHistory();
}
function init(){
 const nav=document.querySelector('.nav-mobile'),picker=$('quick-picker');
 if(!nav||!picker)return;
 const sticky=document.createElement('div');sticky.id='live-sticky';sticky.hidden=true;
 sticky.innerHTML='<div class="live-sticky-row"><span id="live-sticky-hand">LiveTest</span>'+
  '<strong id="live-sticky-action">Hand vorbereiten</strong></div>'+
  '<div id="live-sticky-meta" class="live-sticky-meta"></div>';
 nav.before(sticky);
 const panel=document.createElement('section');panel.className='panel live-panel';panel.id='live-test';panel.hidden=true;
 panel.innerHTML='<h2>LiveTest · 6-Max</h2>'+
  '<div class="live-caption">Privater Test mit Zustimmung aller Beteiligten · ohne Geld · Ergebnisse nur auf diesem Gerät</div>'+
  '<div id="live-prep"><p>Oben Hand, Position, Stacks und Gegneraktionen einstellen. Anschließend die Empfehlung für genau diese Hand fixieren.</p>'+
  '<button type="button" id="live-lock" class="btn primary">Empfehlung einmal ziehen und fixieren</button></div>'+
  '<div id="live-locked" hidden><div id="live-locked-hand" class="live-locked-hand"></div>'+
  '<div id="live-locked-action" class="live-locked-action"></div><div id="live-locked-situation" class="live-situation"></div>'+
  '<div id="live-locked-mix" class="live-mix-list"></div>'+
  '<div class="live-actual-fields"><label>Tatsächlich gespielt<select id="live-actual">'+
  '<option value="recommended">Genau wie empfohlen</option><option value="FOLD">Fold</option><option value="CHECK">Check</option>'+
  '<option value="CALL">Call</option><option value="LIMP">Limp</option><option value="RAISE">Raise</option>'+
  '<option value="3BET">3-Bet</option><option value="4BET">4-Bet</option><option value="JAM">All-in</option></select></label>'+
  '<label id="live-actual-bet" hidden>Raise auf (BB)<input id="live-actual-to" inputmode="decimal" placeholder="z. B. 5,5"></label>'+
  '<label>Ergebnis<select id="live-outcome"><option value="unknown">Nicht erfasst</option><option value="win">Gewonnen</option>'+
  '<option value="loss">Verloren</option><option value="split">Geteilt</option><option value="other">Sonstiges</option></select></label>'+
  '<label>Chip-Ergebnis (BB, optional)<input id="live-delta" type="text" inputmode="decimal" placeholder="z. B. -4,5 oder +8"></label></div>'+
  '<label class="live-note-label">Notiz (optional)<textarea id="live-notes" rows="2" maxlength="400" placeholder="Beobachtung nach der Hand"></textarea></label>'+
  '<div class="live-save-actions"><button type="button" id="live-save" class="btn primary">Hand abschließen und speichern</button>'+
  '<button type="button" id="live-abort" class="btn">Hand abbrechen (protokollieren)</button></div></div>'+
  '<p id="live-message" role="status" class="live-message"></p>'+
  '<p id="live-storage-warning" class="live-storage-warning"></p>'+
  '<div class="live-summary"><h3>Testprotokoll</h3><p id="live-stats"></p>'+
  '<div class="live-history-actions"><button type="button" id="live-copy" class="btn">CSV kopieren</button>'+
  '<button type="button" id="live-clear" class="btn">Verlauf löschen</button></div>'+
  '<textarea id="live-export-text" hidden readonly></textarea>'+
  '<div id="live-history-list" class="live-history-list"></div></div>';
 picker.after(panel);
 $('live-lock').addEventListener('click',lock);
 $('live-save').addEventListener('click',()=>save('completed'));
 $('live-abort').addEventListener('click',()=>save('aborted'));
 $('live-actual').addEventListener('change',updateActual);
 $('live-copy').addEventListener('click',copyHistory);
 $('live-clear').addEventListener('click',clearHistory);
 load();
 nav.addEventListener('click',()=>setTimeout(()=>{
  tab=nav.querySelector('button.active')?.dataset.tab||'trainer';render();
 },0));
 global.addEventListener('lernpoker:tabchange',e=>{
  tab=e?.detail?.tab||'trainer';render();
 });
 tab=nav.querySelector('button.active')?.dataset.tab||'trainer';
 render();
}
global.LernPokerLiveTest={getSnapshot:()=>data.active,getHistory:()=>data.history.slice(),lock,save,csv};
global.addEventListener('DOMContentLoaded',init);
})(globalThis);
