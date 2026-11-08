/* LernPoker optional German voice dictation. SpeechRecognition requires browser support,
   a secure context, mic permission, and potentially online connectivity. */
(function(g){
'use strict';
const $=id=>document.getElementById(id);
const ranks=[
 ['A',/(?:\bass\b|\bas\b|\bace\b)/i],['K',/(?:könig|koenig|\bking\b)/i],
 ['Q',/(?:dame|\bqueen\b)/i],['J',/(?:bube|\bjack\b)/i],
 ['T',/(?:\b10\b|\bzehn\b)/i],['9',/(?:\b9\b|\bneun\b)/i],
 ['8',/(?:\b8\b|\bacht\b)/i],['7',/(?:\b7\b|\bsieben\b)/i],
 ['6',/(?:\b6\b|\bsechs\b)/i],['5',/(?:\b5\b|\bfünf\b|\bfuenf\b)/i],
 ['4',/(?:\b4\b|\bvier\b)/i],['3',/(?:\b3\b|\bdrei\b)/i],
 ['2',/(?:\b2\b|\bzwei\b)/i]
];
const suits=[['♠',/(?:pik|spade|spades)/i],['♥',/(?:herz|heart|hearts)/i],
 ['♦',/(?:karo|diamond|diamonds)/i],['♣',/(?:kreuz|club|clubs)/i]];
const posRx=[
 ['UTG+1',/\butg\s*(?:plus|[+]|\s)1\b|unter\s+der\s+gun\s+plus\s+eins/i],
 ['UTG',/\butg\b|under\s+the\s+gun/i],
 ['MP1',/\bmp\s*1\b/i],['MP',/\bmp\b|\bmittelposition\b/i],
 ['LJ',/\blj\b|\blojack\b|\blowjack\b/i],
 ['HJ',/\bhj\b|\bhijack\b|\bhighjack\b/i],
 ['CO',/\bco\b|\bcut[\s-]?off\b|\bcutoff\b/i],
 ['BTN',/\bbtn\b|\bbutton\b|\bdealer\b/i],
 ['SB',/\bsb\b|\bsmall\s+blind\b/i],
 ['BB',/\bbb\b|\bbig\s+blind\b/i]
];
const number=(v)=>Number(String(v||'').replace(',','.'));
function prep(s){return String(s||'').toLowerCase().replace(/(\d+)\s+komma\s+(\d+)/g,'$1.$2')
 .replace(/(\d+)\s+punkt\s+(\d+)/g,'$1.$2').replace(/(\d),(\d)/g,'$1.$2')
 .replace(/\s+/g,' ').trim();}
function findPos(s){return posRx.find(([p,rx])=>rx.test(s))?.[0]||null;}
function findCards(raw){
 const s=prep(raw),words=s.split(/[\s,;:]+/).filter(Boolean);
 const found=[];
 for(let i=0;i<words.length-1;i++){
  const r=ranks.find(([k,rx])=>rx.test(words[i]));
  const suit=suits.find(([k,rx])=>rx.test(words[i+1]));
  if(r&&suit){found.push({rank:r[0],suit:suit[0]});i++;}
 }
 return found.slice(0,2);
}
function parse(text){
 const s=prep(text),draft={transcript:text,actions:[],seatStacks:{},cards:findCards(s)};
 const heroMatch=s.match(/(?:ich\s+bin|ich\s+sitze|meine\s+position|position)\s+(?:am\s+|auf\s+|ist\s+)?([\w+ \-]{2,28}?)(?=,|;|\.| mit | stack | habe | und |$)/i);
 if(heroMatch)draft.position=findPos(heroMatch[1]);
 const stackMatch=s.match(/(?:mein\s+stack|ich\s+habe)\s*(?:ist|beträgt|von)?\s*(\d+(?:\.\d+)?)(?:\s*(?:bb|big\s+blinds?))?/i)
   ||s.match(/(?:ich\s+bin\s+\w+.*?\b)?stack\s+(\d+(?:\.\d+)?)/i);
 if(stackMatch)draft.stackBB=number(stackMatch[1]);
 if(/nach\s+meinem\s+raise|nach\s+meiner\s+erhöhung/.test(s))draft.mode='after';
 const own=s.match(/(?:mein\s+raise|ich\s+erhöhe|ich\s+raise)\s*(?:auf\s*)?(\d+(?:\.\d+)?)/);
 if(own)draft.ownRaiseBB=number(own[1]);
 // Split at unambiguous position tokens; collect the clause after each position.
 const tokens=[];
 for(const [pos,rx] of posRx){
  const flags=rx.flags.includes('g')?rx.flags:rx.flags+'g';const gRx=new RegExp(rx.source,flags);
  for(const match of s.matchAll(gRx)){
   // "20 BB" describes a stack, not the Big Blind seat.
   if(pos==='BB' && /\d+(?:\.\d+)?\s*$/.test(s.slice(0,match.index)))continue;
   tokens.push({pos,start:match.index,end:match.index+match[0].length,word:match[0]});
  }
 }
 tokens.sort((a,b)=>a.start-b.start || b.end-a.end);
 const uniq=tokens.filter((t,i)=>!tokens.some((v,j)=>j!==i&&v.start<=t.start&&v.end>=t.end&&(v.end-v.start>t.end-t.start)));
 for(let i=0;i<uniq.length;i++){
  const pos=uniq[i].pos,context=s.slice(uniq[i].end,i+1<uniq.length?uniq[i+1].start:s.length);
  if(pos===draft.position)continue;
  const stack=context.match(/(?:stack|hat|chips)\s*(?:von|ist)?\s*(\d+(?:\.\d+)?)/);
  if(stack)draft.seatStacks[pos]=number(stack[1]);
  const action=/\b(all[\s-]?in|push|pusht|schiebt)\b/.test(context)?'allin':
   /\b(raise|raist|erhöht|erhoeht|3[\s-]?bet|4[\s-]?bet)\b/.test(context)?'raise':
   /\b(call|callt|limp|limpt|bezahlt|mitgeht)\b/.test(context)?'call':
   /\b(fold|foldet|passt)\b/.test(context)?'fold':null;
  if(!action)continue;
  const after=context.match(/(?:auf|bet|raise)\s*(?:auf\s*)?(\d+(?:\.\d+)?)/) ||
     context.match(/(?:all[\s-]?in)\s*(\d+(?:\.\d+)?)/);
  const bet=after?number(after[1]):null;
  draft.actions.push({position:pos,action,betBB:bet,stackBB:draft.seatStacks[pos]??null});
 }
 return draft;
}
function summarize(d){
 const out=[];
 if(d.position)out.push('Position: '+d.position);
 if(d.stackBB)out.push('Mein Stack: '+d.stackBB.toLocaleString('de-DE')+' BB');
 if(d.cards?.length)out.push('Karten: '+d.cards.map(x=>x.rank+x.suit).join(' '));
 for(const a of d.actions||[])out.push(a.position+': '+a.action+
   (a.betBB!=null?' auf '+a.betBB.toLocaleString('de-DE')+' BB':'')+
   (a.stackBB!=null?', Stack '+a.stackBB.toLocaleString('de-DE')+' BB':''));
 for(const [p,bb] of Object.entries(d.seatStacks||{})){
  if(!d.actions.some(a=>a.position===p))out.push(p+' Stack: '+bb.toLocaleString('de-DE')+' BB');
 }
 if(!out.length)out.push('Keine unterstützte Angabe erkannt.');
 return out.join(' · ');
}
function init(){
 const picker=$('quick-picker');
 if(!picker)return;
 const area=document.createElement('section');area.id='voice-training';area.className='quick-section voice-training';
 area.innerHTML='<div class="voice-trigger"><button id="voice-start" type="button">🎤 Spracheingabe</button><span id="voice-state" role="status"></span></div>'+
 '<div id="voice-review" hidden><label for="voice-text">Erkannter Text</label>'+
 '<textarea id="voice-text" rows="2" placeholder="Zum Beispiel: Position Button, mein Stack 15 Komma 4, Ass Pik König Herz, HJ Raise auf 2 Komma 2, Stack 30"></textarea>'+
 '<div id="voice-preview"></div><div class="voice-buttons"><button type="button" id="voice-parse">Prüfen</button>'+
 '<button type="button" id="voice-accept">Übernehmen</button><button type="button" id="voice-cancel">Abbrechen</button></div></div>';
 picker.querySelector('.quick-stack')?.before(area);
 const Speech=g.SpeechRecognition||g.webkitSpeechRecognition;
 const button=$('voice-start'),info=$('voice-state'),review=$('voice-review'),txt=$('voice-text'),preview=$('voice-preview');
 let recognition=null,draft=null;
 const updateDraft=()=>{draft=parse(txt.value);preview.textContent=summarize(draft)};
 function close(){review.hidden=true;draft=null;info.textContent=''}
 button.addEventListener('click',()=>{
  if(!Speech){review.hidden=false;info.textContent='Mikrofon-Spracherkennung im Browser nicht verfügbar. Text kann manuell eingegeben werden.';txt.focus();return;}
  if(recognition){recognition.stop();return;}
  try{
   recognition=new Speech();recognition.lang='de-DE';recognition.continuous=false;recognition.interimResults=false;
   recognition.onresult=(event)=>{
    const text=Array.from(event.results||[]).map(x=>x[0]?.transcript||'').join(' ');
    txt.value=text;review.hidden=false;updateDraft();info.textContent='Bitte Angaben prüfen und übernehmen.';
   };
   recognition.onerror=(event)=>{info.textContent='Spracherkennung: '+(event.error||'nicht verfügbar')+'. Alternativ eintippen.';review.hidden=false;};
   recognition.onend=()=>{recognition=null;button.textContent='🎤 Spracheingabe'};
   recognition.start();button.textContent='■ Aufnahme beenden';info.textContent='Sprich Position, Karten und Aktionen.';
  }catch(e){recognition=null;review.hidden=false;info.textContent='Mikrofon nicht verfügbar – bitte eintippen.';}
 });
 $('voice-parse').addEventListener('click',updateDraft);
 txt.addEventListener('input',updateDraft);
 $('voice-accept').addEventListener('click',()=>{
  updateDraft();
  if(!draft||!g.LernPokerUI?.applyVoiceDraft){info.textContent='Eingabe noch nicht bereit.';return;}
  const report=g.LernPokerUI.applyVoiceDraft(draft);
  if(report?.ok){info.textContent='Angaben übernommen.';review.hidden=true;}
  else {info.textContent=report?.message||'Eingaben prüfen.';}
 });
 $('voice-cancel').addEventListener('click',close);
}
g.LernPokerVoice={parse,summarize};
g.addEventListener('DOMContentLoaded',init);
})(globalThis);