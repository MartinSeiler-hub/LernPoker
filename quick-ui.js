(function(){
'use strict';
const $=id=>document.getElementById(id),KEY='LernPokerTournament_v2';
function make(tag,html,cl){const x=document.createElement(tag);if(html!==undefined)x.innerHTML=html;if(cl)x.className=cl;return x;}
function nice(n){return Number(n).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});}
function init(){
 const form=document.querySelector('.form-panel'),picker=$('quick-picker'),nav=document.querySelector('.nav-mobile');
 if(!form||!picker||!nav)return;
 const edit=make('button','⚙ Turnierformat ändern');edit.type='button';edit.id='change-tournament';document.querySelector('header').appendChild(edit);
 const welcome=make('section','<div class="setup-card"><h2>♠ Turnierformat auswählen</h2><p>Wähle dein Turnier einmal. Anschließend erscheint nur noch die Lerneingabe. Die Auswahl bleibt auf dem Handy gespeichert.</p><div class="setup-choices"><button data-profile="A"><b>8 Spieler · 100 BB</b><span>10.000 Chips · 8 Min. je Level</span></button><button data-profile="B"><b>6 Spieler · 100 BB</b><span>10.000 Chips · 5 Min. je Level</span></button><button data-profile="C"><b>8 Spieler · 80 BB</b><span>8.000 Chips · 5 Min. je Level · 2-$-MTT</span></button></div><p class="note">Nur zur Trainingsvorbereitung – Modellschätzungen, keine bewiesenen GTO-Ranges.</p></div>');welcome.id='format-setup';welcome.setAttribute('role','dialog');welcome.setAttribute('aria-modal','true');welcome.hidden=true;document.body.appendChild(welcome);
 const fields=make('div','', 'quick-fields');
 const bb=make('div','<label for="quick-bb">Mein Stack in BB</label><input id="quick-bb" type="text" inputmode="decimal" autocomplete="off" value="80,0" placeholder="18,5">','group');
 const pos=$('heroPos').closest('.group');fields.append(bb,pos);picker.querySelector('.mobile-pick').before(fields);
 const err=make('p','','quick-error');fields.after(err);
 const oldSame=$('q-s');oldSame.closest('label').hidden=true;
 for(let i=1;i<=2;i++){const rank=$('q-r'+i);const suit=make('select','<option value="♠">♠ Pik</option><option value="♥">♥ Herz</option><option value="♦">♦ Karo</option><option value="♣">♣ Kreuz</option>');suit.id='quick-suit'+i;suit.setAttribute('aria-label','Farbe Karte '+i);const row=make('span','','quick-card-pair');rank.before(row);row.append(rank,suit);}
 const spot=$('spot').closest('.group');spot.querySelector('label').textContent='Aktion vor mir';const actionBox=make('div','','quick-action');actionBox.append(spot);$('q-selected').after(actionBox);
 const advanced=make('details','<summary>Weitere Angaben: Gegner, Blindlevel, ICM</summary>');advanced.id='quick-advanced';
 advanced.append(form.querySelector('.controls'),$('kpis'),$('model-warning'));picker.append(advanced);
 $('profile').closest('.group').hidden=true;$('heroChips').closest('.group').hidden=true;
 picker.append(make('p','Die Empfehlung berücksichtigt die gewählte Position und Aktion. Ohne weitere Eingaben wird der Gegnerstack gleich deinem Stack angenommen.','quick-note'));
 let customVillain=false;function levelBb(){const p=D.profiles[$('profile').value];const l=p.levels.find(x=>x.level===Number($('level').value))||p.levels[0];return l.bb;}
 function syncBb(){bb.querySelector('input').value=nice(Number($('heroChips').value)/levelBb());err.textContent='';}
 function applyBb(commit){
  const input=$('quick-bb'),raw=input.value.trim().replace(/\s/g,'').replace(',','.');
  if(!/^\d+(\.\d{0,1})?$/.test(raw)||Number(raw)<2||Number(raw)>1000){
    err.textContent='Bitte einen Wert von 2,0 bis 1.000,0 BB mit einer Nachkommastelle eingeben.';return false;
  }
  err.textContent='';
  const chips=Math.round(Number(raw)*levelBb());$('heroChips').value=String(chips);
  if(!customVillain)$('villainChips').value=String(chips);
  $('heroChips').dispatchEvent(new Event('input',{bubbles:true}));
  if(commit)input.value=nice(Number(raw));return true;
 }
 function syncCards(){
  const a=$('q-r1').value,b=$('q-r2').value,s1=$('quick-suit1').value;let s2=$('quick-suit2').value;
  if(a===b&&s1===s2){const suits=['♠','♥','♦','♣'];s2=suits[(suits.indexOf(s1)+1)%4];$('quick-suit2').value=s2;}
  oldSame.value=s1===s2?'s':'o';oldSame.dispatchEvent(new Event('change',{bubbles:true}));
  $('q-selected').textContent=a+s1+'  '+b+s2+'  ·  '+selectedHand;
 }
 for(let i=1;i<=2;i++){$('q-r'+i).addEventListener('change',syncCards);$('quick-suit'+i).addEventListener('change',syncCards);}
 $('quick-bb').addEventListener('input',()=>applyBb(false));
 $('quick-bb').addEventListener('blur',()=>{if(!applyBb(true))syncBb()});
 $('heroChips').addEventListener('change',syncBb);
 $('villainChips').addEventListener('input',()=>{customVillain=true});
 $('level').addEventListener('change',()=>applyBb(false));
 const matrix=document.querySelector('.panel.accent'),matrixTitle=matrix.querySelector('h2');
 function updateTitle(){const active=nav.querySelector('button.active');matrixTitle.textContent=active&&active.dataset.tab==='matrix'?'169 Starthände':'Empfehlung für meine Hand';}
 new MutationObserver(()=>{if(!form.hidden)form.hidden=true}).observe(form,{attributes:true,attributeFilter:['hidden']});
 nav.addEventListener('click',()=>setTimeout(()=>{form.hidden=true;updateTitle()},0));
 function showSetup(){welcome.hidden=false;document.body.style.overflow='hidden';welcome.querySelector('button').focus();}
 function hideSetup(){welcome.hidden=true;document.body.style.overflow='';}
 function selectFormat(key){
  if(!D.profiles[key])return;
  $('level').value='1';$('profile').value=key;$('profile').dispatchEvent(new Event('change',{bubbles:true}));
  customVillain=false;syncBb();syncCards();
  try{localStorage.setItem(KEY,key)}catch(e){}
  hideSetup();form.hidden=true;
 }
 welcome.querySelectorAll('button[data-profile]').forEach(b=>b.addEventListener('click',()=>selectFormat(b.dataset.profile)));
 edit.addEventListener('click',showSetup);
 form.hidden=true;syncCards();syncBb();updateTitle();
 let saved=null;try{saved=localStorage.getItem(KEY)}catch(e){}
 if(saved&&D.profiles[saved])selectFormat(saved);else showSetup();
}
window.addEventListener('DOMContentLoaded',init);
})();