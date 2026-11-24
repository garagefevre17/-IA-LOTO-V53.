/* IA LOTO V17 — Centre d'évaluation scientifique, données FDJ importées, journal local.
   Aucun avantage prédictif revendiqué. Aucune modification des modules historiques. */
(()=>{'use strict';
const $=id=>document.getElementById(id), KEY='ia_loto_v17_journal_v1', LOGU=Math.log(19068840);
let admitted=[], sourceInfo=null, prepared=null, latestReport=null, lastBack=null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const {today:dateParis,hour:hourParis,nextDate,availableDate}=window.LotoHistory;
const base=()=>window.Loto16.draws();
const hashString=async text=>{if(!crypto?.subtle)throw Error('HTTPS requis pour SHA-256');const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')};
const digest=rows=>hashString(JSON.stringify(rows));
function arr(){return window.LotoHistory.merge([...base(),...admitted]);}
function checkRow(r){return Array.isArray(r)&&r.length===7&&/^\d{4}-\d\d-\d\d$/.test(r[0])&&r.slice(1,6).every(x=>Number.isInteger(x)&&x>=1&&x<=49)&&new Set(r.slice(1,6)).size===5&&Number.isInteger(r[6])&&r[6]>=1&&r[6]<=10}
function same(a,b){return a.length===b.length&&a.every((x,i)=>x===b[i])}
function validateImported(parsed, existing){
 if(parsed.errors.length)throw Error(`${parsed.errors.length} ligne(s) invalides ou contradictoires : import refusé.`);
 const known=new Map(existing.map(r=>[r[0],r])), newRows=[];let common=0;
 for(const raw of parsed.rows){const r=[raw[0],...raw.slice(1,6).sort((a,b)=>a-b),raw[6]];
  if(!checkRow(r)||!availableDate(r[0]))throw Error('Combinaison invalide à '+r[0]);
  if(known.has(r[0])){if(!same(known.get(r[0]),r))throw Error('Contradiction avec la base intégrée au '+r[0]);common++}
  else {if(r[0]<=existing.at(-1)[0])throw Error(`Résultat ancien absent de la base au ${r[0]} : contrôle manuel requis`);newRows.push(r)}
 }
 newRows.sort((a,b)=>a[0].localeCompare(b[0]));let prev=existing.at(-1)[0];
 for(const r of newRows){const expected=nextDate(prev);if(r[0]!==expected)throw Error(`Chronologie incomplète : attendu ${expected}, reçu ${r[0]}`);prev=r[0]}
 if(newRows.some(r=>r[0]>dateParis()))throw Error('Le fichier contient des tirages datés dans le futur.');
 return {rows:newRows,common,total:parsed.rows.length,duplicates:parsed.duplicates.length};
}
function frequency(rows,size,sortAscending){const f=Array(50).fill(0),c=Array(11).fill(0);for(const row of rows.slice(-size)){for(let i=1;i<=5;i++)f[row[i]]++;c[row[6]]++}
 const numbers=Array.from({length:49},(_,i)=>i+1).sort((a,b)=>sortAscending?f[a]-f[b]||a-b:f[b]-f[a]||a-b).slice(0,5).sort((a,b)=>a-b);
 const chance=Array.from({length:10},(_,i)=>i+1).sort((a,b)=>sortAscending?c[a]-c[b]||a-b:c[b]-c[a]||a-b)[0];return {numbers,chance};}
const cold=rows=>frequency(rows,300,true);
const hot=rows=>frequency(rows,100,false);
function seededPick(seed){let h=2166136261>>>0;for(const ch of String(seed)){h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0};
 const rnd=()=>{h=(h+0x6D2B79F5)>>>0;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296};
 const a=Array.from({length:49},(_,i)=>i+1);for(let i=0;i<5;i++){const j=i+Math.floor(rnd()*(49-i));[a[i],a[j]]=[a[j],a[i]]}return {numbers:a.slice(0,5).sort((a,b)=>a-b),chance:1+Math.floor(rnd()*10)};
}
function securePick(){if(!crypto?.getRandomValues)throw Error('Générateur sécurisé indisponible');const draw=m=>{const upper=4294967296,cut=upper-upper%m;let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0]}while(n>=cut);return n%m};const a=Array.from({length:49},(_,i)=>i+1);for(let i=0;i<5;i++){const j=i+draw(49-i);[a[i],a[j]]=[a[j],a[i]]}return {numbers:a.slice(0,5).sort((a,b)=>a-b),chance:1+draw(10)};}
function score(p,r){return {main:p.numbers.filter(n=>r.slice(1,6).includes(n)).length,chance:Number(p.chance===r[6])}}
function records(){const v=JSON.parse(localStorage.getItem(KEY)??'[]');if(!Array.isArray(v))throw Error('Journal V17 illisible');return v;}
function validEntry(e){return e&&e.protocol==='V17-prospectif-1'&&/^\d{4}-\d\d-\d\d$/.test(e.target||'')&&e.cutoff<e.target&&Array.isArray(e.methods)&&e.methods.length===3&&new Set(e.methods.map(x=>x.key)).size===3&&['cold','adaptive','uniform'].every(k=>e.methods.some(x=>x.key===k))&&e.methods.every(x=>checkRow([e.target,...x.numbers,x.chance]))&&typeof e.recordHash==='string'&&typeof e.cutoffHash==='string'}
async function audited(){const rows=records(),seen=new Set(),out=[];for(const e of rows){let issues=[];if(!validEntry(e)){issues.push('Structure invalide')}else{const {recordHash,...without}=e;const computed=await hashString(JSON.stringify(without));if(computed!==recordHash)issues.push('Empreinte différente');if(seen.has(e.target))issues.push('Date dupliquée');seen.add(e.target)}out.push({entry:e,ok:issues.length===0,issues})}return out}
const styleBalls=p=>'<div class="balls">'+p.numbers.map(n=>`<span class="ball">${n}</span>`).join('')+`<span class="ball c">${p.chance}</span></div>`;
function renderState(message){const all=arr();$('v17Count').textContent=all.length.toLocaleString('fr-FR');$('v17Last').textContent=all.at(-1)[0].split('-').reverse().join('/');$('v17Pred').textContent=records().length;$('v17New').textContent=admitted.length;
 if(message)$('v17State').textContent=message;else $('v17State').textContent=`Base intégrée : ${base().length} ; résultats ajoutés dans cette session : ${admitted.length}. Prochain tirage théorique : ${nextDate(all.at(-1)[0])}.`}
function exportFile(name,text,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},1200)}
async function importCSV(file,confirmed){if(!confirmed)throw Error('Confirme la provenance du CSV après vérification.');if(!file)throw Error('Choisis un fichier CSV');if(file.size>15*1024*1024)throw Error('CSV trop volumineux (>15 Mo)');
 const parsed=window.Loto1611.parseFDJ(await file.text()),report=validateImported(parsed,base());const h=await digest([...base(),...report.rows]);
 admitted=report.rows;sourceInfo={filename:file.name,importedAt:new Date().toISOString(),...report,sha256:h,provenance:'Fichier choisi par utilisateur ; authenticité FDJ non certifiée'};
 prepared=null;$('v17Save').disabled=true;renderState();return sourceInfo;
}
function backtest(rows,N){if(rows.length<300+N)throw Error('Historique insuffisant pour ce test');const begin=rows.length-N;const methods=['cold','hot','uniform'];const totals=Object.fromEntries(methods.map(x=>[x,{main:0,chance:0,distribution:[0,0,0,0,0,0]}]));const periods=[];
 for(let i=begin;i<rows.length;i++){const past=rows.slice(0,i),target=rows[i],preds={cold:cold(past),hot:hot(past),uniform:seededPick(target[0])};const item={date:target[0]};for(const key of methods){const s=score(preds[key],target),v=totals[key];v.main+=s.main;v.chance+=s.chance;v.distribution[s.main]++;item[key]=s}periods.push(item)}
 return {N,totals,periods,expectedMain:N*25/49,expectedChance:N/10,warning:'Backtest historique : déjà exploré pendant le développement ; ne prouve pas une prédiction future.'}}
async function forecast(){const rows=arr(),cutoff=rows.at(-1)[0],target=nextDate(cutoff),today=dateParis();const found=records().some(x=>x?.target===target);const ready=(target>today||(target===today&&hourParis()<18))&&!found;
 const weights=window.Loto166.weightsAtCutoff(rows);const model=window.Loto166.adaptivePick(rows,weights);
 const result={cutoff,target,created:new Date().toISOString(),methods:[{key:'cold',...cold(rows)},{key:'adaptive',numbers:model.numbers,chance:model.chance},{key:'uniform',...securePick()}],adaptive:{numbers:model.numbers,chance:model.chance,uniformWeight:weights[0]},cutoffHash:await digest(rows),canSave:ready,reason:found?'Date déjà enregistrée':target<today?'Historique périmé':target===today&&hourParis()>=18?'Tirage déjà commencé ou heure limite dépassée':'Préparation possible'};
 prepared=result;const o=$('v17ForecastOut');o.className='status '+(ready?'good':'warn');o.innerHTML=`<b>Prochain tirage : ${esc(target)}</b> · données arrêtées au ${esc(cutoff)}<p>${esc(result.reason)}</p>`+result.methods.map(m=>`<p><b>${{cold:'Froids 300',adaptive:'Adaptatif figé',uniform:'Témoin uniforme'}[m.key]}</b>${styleBalls(m)}</p>`).join('')+`<p><small>Le journal V17 fige ces trois références. Le modèle adaptatif est évalué avec les paramètres historiques V16.6.</small></p>`;
 $('v17Save').disabled=!ready;return result;
}
async function save(){if(!prepared)throw Error('Aucune sélection préparée');const now=dateParis();if(prepared.target<now||prepared.target===now&&hourParis()>=18)throw Error('Créneau expiré');const rows=arr();if(rows.at(-1)[0]!==prepared.cutoff||await digest(rows)!==prepared.cutoffHash)throw Error('La base a changé depuis le calcul');const all=records();if(all.some(x=>x.target===prepared.target))throw Error('Prévision déjà enregistrée pour cette date');const data={protocol:'V17-prospectif-1',target:prepared.target,cutoff:prepared.cutoff,created:new Date().toISOString(),cutoffHash:prepared.cutoffHash,methods:prepared.methods,source:sourceInfo?{file:sourceInfo.filename,hash:sourceInfo.sha256}:null};data.recordHash=await hashString(JSON.stringify(data));all.push(data);localStorage.setItem(KEY,JSON.stringify(all));if(records().length!==all.length)throw Error('Stockage non confirmé');prepared=null;$('v17Save').disabled=true;renderState('Prévisions enregistrées localement. Exporte immédiatement le journal JSON pour conserver une copie. Aucun horodatage externe.');return data;
}
async function audit(){const checked=await audited(),byDate=new Map(arr().map(r=>[r[0],r])),valid=checked.filter(x=>x.ok),bad=checked.filter(x=>!x.ok),pending=[],evaluated=[],totals={};
 for(const x of valid){const r=byDate.get(x.entry.target);if(!r){pending.push(x.entry.target);continue}const result={target:x.entry.target,methods:{}};for(const p of x.entry.methods){const s=score(p,r);result.methods[p.key]=s;const t=totals[p.key]||(totals[p.key]={main:0,chance:0,n:0});t.main+=s.main;t.chance+=s.chance;t.n++}evaluated.push(result)}
 latestReport={created:new Date().toISOString(),usedDraws:arr().length,sourceInfo:sourceInfo?{file:sourceInfo.filename,hash:sourceInfo.sha256}:null,stored:checked.length,valid:valid.length,invalid:bad.length,issues:bad.map(x=>({date:x.entry?.target,reasons:x.issues})),pending,evaluated,totals};return latestReport;
}
function auditHTML(r){let table='<table class="tbl"><tr><th>Méthode</th><th>Bons numéros</th><th>Chance</th></tr>';for(const [k,t] of Object.entries(r.totals))table+=`<tr><td>${esc(k)} (${t.n})</td><td>${t.main} / ${(t.n*25/49).toFixed(2)}</td><td>${t.chance} / ${(t.n/10).toFixed(2)}</td></tr>`;return `<b>${r.valid} prévision(s) intacte(s) ; ${r.invalid} incohérente(s) ; ${r.pending.length} en attente ; ${r.evaluated.length} date(s) évaluée(s).</b>`+table+'</table><p class="note">Plusieurs méthodes sur la même date ne sont pas des expériences indépendantes. Le journal local ne prouve pas l\'heure d\'enregistrement.</p>'}
async function restore(file){if(!file||file.size>3*1024*1024)throw Error('JSON absent ou trop volumineux');const v=JSON.parse(await file.text()),incoming=Array.isArray(v)?v:v.records;if(!Array.isArray(incoming))throw Error('Format du journal non reconnu');let existing=records(),keys=new Set(existing.map(x=>x.target)),accepted=0,rejected=0,duplicates=0;
 for(const entry of incoming){if(!validEntry(entry)){rejected++;continue}const {recordHash,...without}=entry;if(await hashString(JSON.stringify(without))!==recordHash){rejected++;continue}if(keys.has(entry.target)){duplicates++;continue}existing.push(entry);keys.add(entry.target);accepted++}if(accepted)localStorage.setItem(KEY,JSON.stringify(existing));renderState();return {accepted,rejected,duplicates};}
async function selfTest(){const b=base(),target=nextDate(b.at(-1)[0]),s=cold(b);let failures=[];
 if(b.length!==2833)failures.push('Nombre intégré différent de 2 833');if(!checkRow(b[0])||!checkRow(b.at(-1)))failures.push('Ligne invalide');if(!same(s.numbers,[11,35,43,46,48])||s.chance!==10)failures.push('Froids 300 de référence modifié');
 if(!/^\d{4}-\d\d-\d\d$/.test(target))failures.push('Calendrier invalide');let fake={rows:[b.at(-1)],errors:[],duplicates:[]};if(validateImported(fake,b).rows.length!==0)failures.push('Import commun incorrect');
 try{validateImported({rows:[[b.at(-1)[0],1,2,3,4,5,10]],errors:[],duplicates:[]},b);failures.push('Contradiction non bloquée')}catch(e){};
 let cand=seededPick('2026-11-14');if(cand.numbers.length!==5||new Set(cand.numbers).size!==5)failures.push('Témoin non valide');
 let obj={protocol:'V17-prospectif-1',target:'2026-11-14',cutoff:'2026-11-11',created:'2026-11-14T09:00:00Z',cutoffHash:'abc',methods:[{key:'cold',...cold(b)},{key:'adaptive',...hot(b)},{key:'uniform',...cand}],source:null};obj.recordHash=await hashString(JSON.stringify(obj));if(!validEntry(obj))failures.push('Structure de journal incorrecte');
 let d=await hashString(JSON.stringify(obj)),e=await hashString(JSON.stringify({...obj,recordHash:'wrong'}));if(d===e)failures.push('Contrôle SHA incorrect');return {ok:failures.length===0,failures,tests:8};}
function bindEvents(){
 // Navigation V21 directement gérée par le bouton HTML, sans dépendance à V17.
 $('v17Import')?.addEventListener('click',async()=>{const o=$('v17ImportOut');o.textContent='Lecture et validation…';try{const r=await importCSV($('v17Csv').files[0],$('v17SourceConfirm').checked);o.className='status good';o.textContent=`${r.total} tirages du CSV ; ${r.common} communs ; ${r.rows.length} nouveaux ; ${r.duplicates} doublons identiques. Empreinte SHA-256 : ${r.sha256}. Source déclarée non authentifiée.`}catch(e){o.className='status bad';o.textContent=e.message}});
 $('v17ClearCsv')?.addEventListener('click',()=>{admitted=[];sourceInfo=null;prepared=null;$('v17Save').disabled=true;$('v17ImportOut').textContent='Importation temporaire annulée.';renderState()});
 $('v17Backtest')?.addEventListener('click',()=>{const o=$('v17BackOut');o.textContent='Calcul historique…';setTimeout(()=>{try{lastBack=backtest(arr(),Number($('v17BackN').value));const r=lastBack;o.className='status good';o.innerHTML=`<b>${r.N} tirages ; référence : ${(r.expectedMain/r.N).toFixed(4)} numéro principal et 10 % Chance par grille.</b><table class="tbl"><tr><th>Méthode</th><th>Bons numéros</th><th>Chance</th></tr>`+Object.entries(r.totals).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v.main}</td><td>${v.chance}</td></tr>`).join('')+'</table><p class="note">${esc(r.warning || "")}</p>';}catch(e){o.className='status bad';o.textContent=e.message}},20)});
 $('v17Forecast')?.addEventListener('click',async()=>{const o=$('v17ForecastOut');o.textContent='Préparation…';try{await forecast()}catch(e){o.className='status bad';o.textContent=e.message}});
 $('v17Save')?.addEventListener('click',async()=>{try{const e=await save();$('v17ForecastOut').textContent='Sauvegarde effectuée pour '+e.target+' ; exporte le journal JSON.'}catch(e){$('v17ForecastOut').textContent='Sauvegarde refusée : '+e.message}});
 $('v17Audit')?.addEventListener('click',async()=>{const o=$('v17AuditOut');o.textContent='Audit…';try{const r=await audit();o.className='status '+(r.invalid?'warn':'good');o.innerHTML=auditHTML(r)}catch(e){o.className='status bad';o.textContent=e.message}});
 $('v17Export')?.addEventListener('click',()=>exportFile('IA_LOTO_V17_Journal.json',JSON.stringify({format:'ia-loto-v17-prospectif',exported:new Date().toISOString(),records:records()},null,2),'application/json'));
 $('v17CsvExport')?.addEventListener('click',async()=>{const r=await audit(),lines=['date;methode;bons_principaux;chance'];for(const v of r.evaluated)for(const [k,s] of Object.entries(v.methods))lines.push([v.target,k,s.main,s.chance].join(';'));exportFile('IA_LOTO_V17_Bilan.csv','\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8')});
 $('v17Restore')?.addEventListener('change',async e=>{try{const r=await restore(e.target.files[0]);$('v17AuditOut').textContent=`Restauration : ${r.accepted} ajoutées ; ${r.duplicates} dates déjà présentes ; ${r.rejected} invalides.`}catch(err){$('v17AuditOut').textContent='Restauration refusée : '+err.message}e.target.value=''});
 $('v17Self')?.addEventListener('click',async()=>{const o=$('v17SelfOut');try{const t=await selfTest();o.className='status '+(t.ok?'good':'bad');o.textContent=t.ok?`${t.tests} contrôles techniques réussis sur la base actuelle. Aucun avantage prédictif démontré.`:t.failures.join(' ; ')}catch(e){o.className='status bad';o.textContent=e.message}});
}
try{bindEvents();renderState();}catch(e){$('v17State').textContent='Erreur V17 : '+e.message}
window.Loto17={nextDate,checkRow,validateImported,cold,hot,seededPick,score,backtest,forecast,audit,selfTest,importCSV,restore,records,hashString,base,arr};
})();
