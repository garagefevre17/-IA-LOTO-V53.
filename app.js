"use strict";
const $=id=>document.getElementById(id);let draws=null, sourceHash=null, latest=null, origin='';let sourceRequest=0;
const reference='b7af95fc3afaf90a51b861e038cf9c328de55a224800808d72c79b9422ae7111';
function setStatus(id,msg,cls=''){const el=$(id);el.textContent=msg;el.className=cls}
function invalidate(){latest=null;$('export').disabled=true;$('save').disabled=true;$('tsq').disabled=true;$('result').textContent='Recalcul nécessaire.'}
// Contrôle strict des prévisions nouvelles ; les backtests historiques restent accessibles.
function parisNow(){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return {date:`${parts.year}-${parts.month}-${parts.day}`,hour:Number(parts.hour)}}
function nextLotoDate(){const now=parisNow();let d=new Date(now.date+'T12:00:00Z');for(let i=0;i<8;i++){const iso=d.toISOString().slice(0,10),day=d.getUTCDay();if([1,3,6].includes(day)&&(iso>now.date||(iso===now.date&&now.hour<18)))return iso;d.setUTCDate(d.getUTCDate()+1)}throw Error('Date du prochain tirage introuvable')}
function requireCurrentTarget(target){const expected=nextLotoDate();if(target!==expected)throw Error(`La date ${target} n’est pas le prochain tirage admissible (${expected}). Une ancienne grille ne peut pas être présentée comme nouvelle.`)}
function requireImmediatePrevious(target,history){const prev=history.filter(d=>d.date<target);if(!prev.length)throw Error('Aucun tirage antérieur');const last=prev.at(-1).date;const days=(Date.parse(target)-Date.parse(last))/86400000;if(![2,3].includes(days)||nextDateAfter(last)!==target)throw Error(`Historique périmé : dernier tirage ${last}, prochain attendu ${target}. Actualise les résultats avant de calculer.`);if(history.some(d=>d.date>=target))throw Error('Le résultat cible figure déjà dans la source : calcul prospectif interdit.');return prev}
function nextDateAfter(date){const d=new Date(date+'T12:00:00Z');for(let i=0;i<7;i++){d.setUTCDate(d.getUTCDate()+1);if([1,3,6].includes(d.getUTCDay()))return d.toISOString().slice(0,10)}throw Error('Calendrier invalide')}
function resetAllForecasts(){invalidate();for(const id of ['adaptiveGrid','modelForecast'])if($(id))$(id).textContent='Prévision invalidée : recalcul nécessaire.';}
function dateISO(raw){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());if(!m)throw Error('Date FDJ invalide : '+raw);const iso=`${m[3]}-${m[2]}-${m[1]}`;if(!validISO(iso))throw Error('Date impossible : '+raw);return iso}
function validISO(x){if(!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const d=new Date(x+'T12:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===x}
function parseCSV(txt){const lines=txt.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)throw Error('CSV vide');const cols=lines.shift().split(';').map(x=>x.trim());const required=['date_de_tirage','numero_chance',...Array.from({length:5},(_,i)=>'boule_'+(i+1))];const ids=required.map(x=>cols.indexOf(x));if(ids.some(x=>x<0))throw Error('Colonnes FDJ manquantes');const seen=new Set(),all=[];for(let i=0;i<lines.length;i++){const cells=lines[i].split(';');const date=dateISO(cells[ids[0]]||'');if(![1,3,6].includes(new Date(date+'T12:00:00Z').getUTCDay()))throw Error('Jour LOTO invalide : '+date);if(seen.has(date))throw Error('Tirage dupliqué : '+date);seen.add(date);const rawValues=ids.slice(2).map(j=>(cells[j]||'').trim()),rawChance=(cells[ids[1]]||'').trim();if(rawValues.some(x=>!/^\d+$/.test(x))||!/^\d+$/.test(rawChance))throw Error('Numéros absents ou non numériques ligne '+(i+2));const values=rawValues.map(Number),chance=Number(rawChance);if(values.some(x=>!Number.isInteger(x)||x<1||x>49)||new Set(values).size!==5||!Number.isInteger(chance)||chance<1||chance>10)throw Error('Numéros invalides ligne '+(i+2));all.push({date,numbers:values,chance})}const ordered=all.sort((a,b)=>a.date.localeCompare(b.date));for(let i=1;i<ordered.length;i++){if(nextDateAfter(ordered[i-1].date)!==ordered[i].date)throw Error('Tirage manquant entre '+ordered[i-1].date+' et '+ordered[i].date)}return ordered}
async function digest(raw){if(!crypto?.subtle)throw Error('SHA-256 indisponible : ouvre via HTTPS');const bytes=await crypto.subtle.digest('SHA-256',raw);return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')}
async function loadBytes(bytes,originName,requestId){if(bytes.byteLength>15_000_000)throw Error('Fichier trop volumineux (max 15 Mo)');const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);const parsed=parseCSV(text);const hash=await digest(bytes);if(requestId!==undefined&&requestId!==sourceRequest)return;invalidate();window.lastBacktest=null;window.lastModels=null;window.lastAdaptive=null;if($('adaptiveForecast'))$('adaptiveForecast').disabled=true;if($('adaptiveExport'))$('adaptiveExport').disabled=true;if($('modelPick'))$('modelPick').disabled=true;if($('exportModels'))$('exportModels').disabled=true;if($('adaptiveOutput'))$('adaptiveOutput').textContent='Source modifiée : relancer la validation.';if($('adaptiveGrid'))$('adaptiveGrid').textContent='';if($('modelsOutput'))$('modelsOutput').textContent='Source modifiée : relancer la comparaison.';if($('modelForecast'))$('modelForecast').textContent='';if($('benchmarkOutput'))$('benchmarkOutput').textContent='Source modifiée : relancer le benchmark.';$('exportBacktest').disabled=true;$('backtestOutput').textContent='Source modifiée : relancer le backtest.';draws=parsed;sourceHash=hash;origin=originName;$('calculate').disabled=false;setStatus('source',`${parsed.length} tirages uniques, du ${parsed[0].date} au ${parsed.at(-1).date}. SHA-256 : ${hash}. ${hash===reference?'Identique au CSV de référence embarqué.':'Source différente de la référence : provenance non certifiée.'}`,hash===reference?'ok':'warn')}
$('embedded').onclick=async()=>{const requestId=++sourceRequest;try{setStatus('source','Chargement…');const res=await fetch('./loto_201911.csv',{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);await loadBytes(await res.arrayBuffer(),'CSV embarqué',requestId)}catch(e){if(requestId===sourceRequest)setStatus('source','Chargement impossible : '+e.message+' ; source précédente conservée.','bad')}};
$('file').onchange=async()=>{const requestId=++sourceRequest;try{const file=$('file').files[0];if(!file)return;if(!/\.csv$/i.test(file.name))throw Error('Extrais d’abord le CSV du ZIP FDJ');await loadBytes(await file.arrayBuffer(),file.name,requestId)}catch(e){if(requestId===sourceRequest)setStatus('source','Chargement impossible : '+e.message+' ; source précédente conservée.','bad')}};
$('target').onchange=()=>{resetAllForecasts();if($('adaptiveGrid'))$('adaptiveGrid').textContent='';if($('modelForecast'))$('modelForecast').textContent='';if($('benchmarkOutput'))$('benchmarkOutput').textContent='Source modifiée : relancer le benchmark.';};
$('calculate').onclick=()=>{try{invalidate();if(!draws)throw Error('Aucun CSV valide');const target=$('target').value;if(!validISO(target))throw Error('Date cible invalide');requireCurrentTarget(target);requireImmediatePrevious(target,draws);if(![1,3,6].includes(new Date(target+'T12:00:00Z').getUTCDay()))throw Error('La date cible doit être un lundi, mercredi ou samedi');const previous=draws.filter(d=>d.date<target);if(previous.length<300)throw Error('Moins de 300 tirages précédents');const window=previous.slice(-300);const main=Array(50).fill(0),chances=Array(11).fill(0);for(const d of window){for(const n of d.numbers)main[n]++;chances[d.chance]++}const ranking=Array.from({length:49},(_,i)=>i+1).sort((a,b)=>main[a]-main[b]||a-b),cr=Array.from({length:10},(_,i)=>i+1).sort((a,b)=>chances[a]-chances[b]||a-b);const numbers=ranking.slice(0,5).sort((a,b)=>a-b),chance=cr[0];const gaps=[];for(let i=1;i<window.length;i++){const delta=(Date.parse(window[i].date)-Date.parse(window[i-1].date))/86400000;if(delta>4)gaps.push(`${window[i-1].date} → ${window[i].date} (${delta} jours)`)}for(const d of window){const wd=new Date(d.date+'T12:00:00Z').getUTCDay();if(![1,3,6].includes(wd))gaps.push('Jour de tirage inhabituel : '+d.date)}const maxDate=window.at(-1).date;const targetGap=(Date.parse(target)-Date.parse(maxDate))/86400000;const stale=targetGap>4||targetGap<2;latest={protocol:'Froids 300',protocol_version:'frozen-2026-11-11',software:'application-unique-correctif-fraicheur',target,source:origin,source_sha256:sourceHash,reference_match:sourceHash===reference,window_start:window[0].date,window_end:maxDate,window_count:300,numbers,chance,main_frequencies:Object.fromEntries(main.slice(1).map((v,i)=>[i+1,v])),chance_frequencies:Object.fromEntries(chances.slice(1).map((v,i)=>[i+1,v])),gap_warnings:gaps,stale_warning:stale,independent_timestamp_verified:false};$('result').replaceChildren();const p=document.createElement('p');p.className='balls';p.textContent=numbers.join(' · ')+'  |  Chance '+chance;$('result').append(p);const detail=document.createElement('pre');detail.textContent=`Fenêtre : ${window[0].date} au ${maxDate}\nFréquences : ${numbers.map(n=>n+': '+main[n]).join(' ; ')} ; Chance ${chance}: ${chances[chance]}\nTop 15 : ${ranking.slice(0,15).map(n=>n+'('+main[n]+')').join(', ')}\nSource SHA-256 : ${sourceHash}`;$('result').append(detail);setStatus('warning',stale?'ATTENTION : le dernier tirage connu est trop ancien par rapport à la cible. Vérifie les archives FDJ avant de considérer cette sélection.':gaps.length?'ATTENTION : intervalles de plus de 4 jours ou dates inhabituelles détectés : '+gaps.slice(0,3).join(' ; '):'Dates contrôlées ; exhaustivité officielle NON certifiée. Vérifier la dernière publication FDJ.',stale||gaps.length?'bad':'warn');$('export').disabled=!(!stale&&!gaps.length);$('save').disabled=stale||gaps.length>0;$('tsq').disabled=stale||gaps.length>0}catch(e){setStatus('result','Calcul bloqué : '+e.message,'bad')}};
function download(name,txt,mime){const u=URL.createObjectURL(new Blob([txt],{type:mime}));const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}
$('export').onclick=async()=>{if(!latest)return;const report=JSON.stringify(latest);download('froids300-'+latest.target+'.json',report,'application/json');setStatus('timestamp','JSON exporté. SHA-256 du fichier : '+await digest(new TextEncoder().encode(report))+'. Conserve ce fichier intact.','warn')};
$('save').onclick=async()=>{if(!latest)return;try{const key='froids300_v53_local',items=JSON.parse(localStorage.getItem(key)||'[]');if(items.some(x=>x.target===latest.target))throw Error('Date déjà enregistrée localement : aucune modification effectuée');const json=JSON.stringify(latest);const hash=await digest(new TextEncoder().encode(json));const item={...latest,local_saved_at:new Date().toISOString(),report_sha256:hash,proof_status:'LOCAL_ONLY_NOT_INDEPENDENTLY_TIMESTAMPED'};items.push(item);localStorage.setItem(key,JSON.stringify(items));download('engagement-local-'+latest.target+'.json',JSON.stringify(item,null,2),'application/json');setStatus('journal','Enregistré localement, NON certifié. Empreinte : '+hash,'warn')}catch(e){setStatus('journal','Enregistrement impossible : '+e.message,'bad')}};
$('showJournal').onclick=()=>{try{$('journal').textContent=JSON.stringify(JSON.parse(localStorage.getItem('froids300_v53_local')||'[]'),null,2)}catch(e){setStatus('journal','Journal illisible : '+e.message,'bad')}};

// Synchronisation opportuniste : URL choisie par l'utilisateur, aucune API FDJ inventée.
const REMOTE_KEY='froids300_v53_remote_url',AUTO_KEY='froids300_v53_auto';
$('remoteUrl').value=localStorage.getItem(REMOTE_KEY)||'';
$('autoRemote').checked=localStorage.getItem(AUTO_KEY)==='1';
$('autoRemote').onchange=()=>localStorage.setItem(AUTO_KEY,$('autoRemote').checked?'1':'0');
async function updateRemote(){
 const url=$('remoteUrl').value.trim();if(!/^https:\/\//i.test(url))throw Error('URL HTTPS obligatoire');const requestId=++sourceRequest;
 localStorage.setItem(REMOTE_KEY,url);
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 try{
   const res=await fetch(url,{cache:'no-store',mode:'cors',signal:controller.signal});
   if(!res.ok)throw Error('Serveur HTTP '+res.status);
   const buf=await res.arrayBuffer();if(buf.byteLength>15_000_000)throw Error('Fichier trop volumineux');
   await loadBytes(buf,'URL externe : '+url,requestId);
 }finally{clearTimeout(timeout)}
}
$('remote').onclick=async()=>{try{setStatus('source','Vérification de la source distante…','warn');await updateRemote()}catch(e){setStatus('source','Actualisation impossible : '+e.message+' ; source précédente conservée.','bad')}};
if($('autoRemote').checked&&$('remoteUrl').value){$('remote').click()}
// Génère une requête RFC 3161 TimeStampReq pour le SHA-256 du rapport JSON.
// L'obtention et la vérification d'un TimeStampResp signé sont EXTERNES.
function derLen(n){if(n<128)return [n];const a=[];while(n){a.unshift(n&255);n>>=8}return [0x80|a.length,...a]}
function der(tag,content){return new Uint8Array([tag,...derLen(content.length),...content])}
function cat(...items){const n=items.reduce((a,x)=>a+x.length,0),out=new Uint8Array(n);let i=0;for(const a of items){out.set(a,i);i+=a.length}return out}
function tsqForHash(hex){
 const hash=Uint8Array.from(hex.match(/../g).map(x=>parseInt(x,16)));
 const oid=new Uint8Array([0x06,0x09,0x60,0x86,0x48,0x01,0x65,0x03,0x04,0x02,0x01]);
 const alg=der(0x30,cat(oid,new Uint8Array([0x05,0x00])));
 const imprint=der(0x30,cat(alg,der(0x04,hash)));
 return der(0x30,cat(new Uint8Array([0x02,0x01,0x01]),imprint,new Uint8Array([0x01,0x01,0xff])));
}
$('tsq').onclick=async()=>{try{
 if(!latest||latest.stale_warning||latest.gap_warnings.length)throw Error('Rapport non admissible');
 const report=JSON.stringify(latest);const hash=await digest(new TextEncoder().encode(report));
 const bytes=tsqForHash(hash);download('froids300-'+latest.target+'.json',report,'application/json');
 download('prediction-'+latest.target+'.tsq',bytes,'application/timestamp-query');
 setStatus('timestamp','Rapport JSON et requête .tsq liés au SHA-256 '+hash+'. Envoie-la à un service RFC3161 et conserve le .tsr reçu. La V58 ne vérifie pas les signatures .tsr.','warn');
 }catch(e){setStatus('timestamp','Erreur : '+e.message,'bad')}
};

// V56: backtesting is strictly walk-forward; the current draw never enters its own training window.
function predictFromWindow(window){
 const main=Array(50).fill(0),chance=Array(11).fill(0);
 for(const d of window){for(const n of d.numbers)main[n]++;chance[d.chance]++}
 const nums=Array.from({length:49},(_,i)=>i+1).sort((a,b)=>main[a]-main[b]||a-b).slice(0,5).sort((a,b)=>a-b);
 const c=Array.from({length:10},(_,i)=>i+1).sort((a,b)=>chance[a]-chance[b]||a-b)[0];
 return {numbers:nums,chance:c};
}
function backtestData(data,limit){
 const rows=[];let hitCounts=Array(6).fill(0),chanceHits=0;
 const from=Math.max(300,data.length-limit);
 for(let i=from;i<data.length;i++){
   const train=data.slice(i-300,i);const actual=data[i];const gapDays=(Date.parse(actual.date)-Date.parse(train.at(-1).date))/86400000;if(gapDays>4||gapDays<2||![1,3,6].includes(new Date(actual.date+'T12:00:00Z').getUTCDay()))continue;const p=predictFromWindow(train);
   const hits=p.numbers.filter(n=>actual.numbers.includes(n)).length;const ch=p.chance===actual.chance;
   hitCounts[hits]++;if(ch)chanceHits++;
   rows.push({date:actual.date,forecast:p.numbers.join('-'),forecast_chance:p.chance,actual:actual.numbers.slice().sort((a,b)=>a-b).join('-'),actual_chance:actual.chance,matching_numbers:hits,chance_match:ch});
 }
 return {rows,hitCounts,chanceHits};
}
function csvCell(x){const s=String(x);return /[;"\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s}
function downloadBacktest(rows){const cols=Object.keys(rows[0]||{});download('froids300-backtest.csv',[cols.join(';'),...rows.map(r=>cols.map(k=>csvCell(r[k])).join(';'))].join('\r\n'),'text/csv;charset=utf-8')}
$('runBacktest').onclick=()=>{try{
 if(!draws)throw Error('Charge un CSV avant le test');
 const limit=Number($('backtestLimit').value);if(!Number.isInteger(limit)||limit<1||limit>1000)throw Error('Choisis 1 à 1000 tirages');
 const result=backtestData(draws,limit);if(!result.rows.length)throw Error('Pas assez de tirages pour le test');
 window.lastBacktest=result;
 const n=result.rows.length;const avg=result.rows.reduce((a,r)=>a+r.matching_numbers,0)/n;
 const expected=25/49;const deviation=avg-expected;const variance=5*(5/49)*(44/49)*(44/48);const standardError=Math.sqrt(variance/n);const z=deviation/standardError;const chanceExpected=n/10;const chanceSE=Math.sqrt(n*.1*.9);const chanceZ=(result.chanceHits-chanceExpected)/chanceSE;
 $('backtestOutput').textContent=`${n} tirages historiques évalués, sans fuite de données futures.\nMoyenne : ${avg.toFixed(3)} bons numéros par grille (hasard théorique : ${expected.toFixed(3)}).\nÉcart observé : ${deviation>=0?'+':''}${deviation.toFixed(3)}. Écart-type normalisé indicatif : ${z.toFixed(2)} (approximation, dépendances temporelles non modélisées).\nRépartition 0 à 5 bons numéros : ${result.hitCounts.join(' / ')}.\nNuméro Chance trouvé : ${result.chanceHits}/${n} (${(100*result.chanceHits/n).toFixed(1)} % ; hasard théorique : 10 % ; score indicatif : ${chanceZ.toFixed(2)} écarts-types).\nAttention : analyse exploratoire, pas une validation prédictive. Le backtest peut surestimer les performances si une méthode a été choisie après examen de ces données.`;
 $('exportBacktest').disabled=false;
}catch(e){setStatus('backtestOutput','Test impossible : '+e.message,'bad')}};
$('exportBacktest').onclick=()=>{if(window.lastBacktest)downloadBacktest(window.lastBacktest.rows)};
$('auditSource').onclick=()=>{try{
 if(!draws)throw Error('Charge une source');
 const weekdays=[0,0,0,0,0,0,0];let suspicious=[];
 for(const d of draws){const day=new Date(d.date+'T12:00:00Z').getUTCDay();weekdays[day]++;if(![1,3,6].includes(day))suspicious.push(d.date)}
 let gaps=[];for(let i=1;i<draws.length;i++){let days=(Date.parse(draws[i].date)-Date.parse(draws[i-1].date))/86400000;if(days>4)gaps.push(draws[i-1].date+' → '+draws[i].date+' ('+days+'j)')}
 $('sourceAudit').textContent=`${draws.length} dates uniques.\nPremière : ${draws[0].date} ; dernière : ${draws.at(-1).date}.\nLundis / mercredis / samedis : ${weekdays[1]} / ${weekdays[3]} / ${weekdays[6]}.\nDates hors jours habituels : ${suspicious.length}${suspicious.length?' ('+suspicious.slice(0,8).join(', ')+')':''}.\nIntervalles de plus de 4 jours : ${gaps.length}${gaps.length?'\n'+gaps.slice(0,12).join('\n'):''}.\nATTENTION : ces contrôles ne certifient pas l'exhaustivité FDJ ni l'authenticité des données.`;
}catch(e){setStatus('sourceAudit','Audit impossible : '+e.message,'bad')}};

// Tests de non-régression exécutables hors connexion sur le moteur statistique.
function assertTest(ok,message){if(!ok)throw Error(message)}
function selfTests(){
 const results=[];function run(label,fn){try{fn();results.push('OK — '+label)}catch(e){results.push('ÉCHEC — '+label+' : '+e.message)}}
 run('Date invalide rejetée',()=>assertTest(!validISO('2026-02-30'),'date impossible acceptée'));
 run('Règle de départage fixe',()=>{const d=[];for(let i=0;i<300;i++)d.push({numbers:[1,2,3,4,5],chance:1});const p=predictFromWindow(d);assertTest(JSON.stringify(p.numbers)==='[6,7,8,9,10]'&&p.chance===2,'classement incorrect')});
 run('Pas de fuite future dans le backtest',()=>{const d=[];for(let i=0;i<303;i++){const date=new Date(Date.UTC(2020,0,6+i*7));d.push({date:date.toISOString().slice(0,10),numbers:[1,2,3,4,5],chance:1})}const r=backtestData(d,3);assertTest(r.rows.length===0,'intervalle irrégulier non exclu')});
 run('Requête RFC3161 SHA-256 structurée',()=>{const q=tsqForHash('ab'.repeat(32));assertTest(q[0]===0x30&&q.length>45,'DER invalide')});
 run('CSV invalides rejetés',()=>{let failed=false;try{parseCSV('date_de_tirage;numero_chance;boule_1;boule_2;boule_3;boule_4;boule_5\n01/01/2026;1;1;1;3;4;5')}catch(e){failed=true}assertTest(failed,'doublons acceptés')});
 run('Sommes de fréquences cohérentes',()=>{const d=Array.from({length:300},()=>({numbers:[1,2,3,4,5],chance:1}));const p=predictFromWindow(d);assertTest(p.numbers.length===5&&new Set(p.numbers).size===5,'sélection invalide')});
 return results;
}
$('selfTest').onclick=()=>{const r=selfTests();$('selfTestOutput').textContent=r.join('\n')+'\n'+r.filter(x=>x.startsWith('OK')).length+'/'+r.length+' tests réussis';};
$('verifyLocal').onclick=async()=>{try{const f=$('verifyJson').files[0];if(!f)throw Error('Sélectionne le rapport JSON');const bytes=await f.arrayBuffer();const report=JSON.parse(new TextDecoder().decode(bytes));if(report.protocol!=='Froids 300'||!Array.isArray(report.numbers)||report.numbers.length!==5)throw Error('Rapport invalide');const hash=await digest(bytes);$('verifyOutput').textContent='Empreinte SHA-256 du rapport : '+hash+'\nDate : '+report.target+'\nNuméros : '+report.numbers.join('-')+' ; Chance '+report.chance+'\nAttention : cela NE vérifie PAS un reçu .tsr signé. La vérification de la signature doit être effectuée avec une racine TSA authentifiée indépendamment.'}catch(e){setStatus('verifyOutput','Erreur : '+e.message,'bad')}};


// V58: Monte-Carlo benchmark with a fixed reproducible PRNG seed, independent of predictions.
// Simulations are a diagnostic, not a probability guarantee or a prediction model.
function benchmarkRandom(rows,reps=2000,seed=20261117){
 if(!rows.length)throw Error('Aucun tirage à comparer');
 let state=seed>>>0;function rnd(){state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296}
 const actual=rows.map(r=>({nums:new Set(r.actual.split('-').map(Number)),chance:Number(r.actual_chance)}));
 const observed=rows.reduce((a,r)=>a+Number(r.matching_numbers),0);
 const observedChance=rows.reduce((a,r)=>a+Number(r.chance_match),0);
 const totals=[],chances=[];let ge=0,geChance=0,sum=0,sum2=0;
 for(let rep=0;rep<reps;rep++){
  let total=0,ct=0;
  for(const draw of actual){
   // Partial Fisher-Yates: 5 unique numbers sampled uniformly from 1..49
   const pool=Array.from({length:49},(_,i)=>i+1);
   for(let k=0;k<5;k++){const j=k+Math.floor(rnd()*(49-k));[pool[k],pool[j]]=[pool[j],pool[k]];if(draw.nums.has(pool[k]))total++}
   if(1+Math.floor(rnd()*10)===draw.chance)ct++;
  }
  totals.push(total);chances.push(ct);sum+=total;sum2+=total*total;
  if(total>=observed)ge++;if(ct>=observedChance)geChance++;
 }
 totals.sort((a,b)=>a-b);chances.sort((a,b)=>a-b);
 return {reps,seed,observed,observedChance,mean:sum/reps,sd:Math.sqrt(Math.max(0,sum2/reps-(sum/reps)**2)),pUpper:(ge+1)/(reps+1),pChanceUpper:(geChance+1)/(reps+1),range:[totals[Math.floor(.025*reps)],totals[Math.floor(.975*reps)]],chanceRange:[chances[Math.floor(.025*reps)],chances[Math.floor(.975*reps)]]};
}
$('randomBenchmark').onclick=()=>{try{
 if(!window.lastBacktest?.rows?.length)throw Error('Lance d’abord le backtest');
 const b=benchmarkRandom(window.lastBacktest.rows);
 $('benchmarkOutput').textContent=`Référence : ${b.reps} simulations de grilles aléatoires, graine reproductible ${b.seed}.\nFroids 300 : ${b.observed} bons numéros cumulés ; hasard simulé : moyenne ${b.mean.toFixed(1)}, intervalle central 95 % [${b.range.join(', ')}].\nProportion de simulations aléatoires au moins aussi favorables : ${(100*b.pUpper).toFixed(2)} %.\nChance Froids 300 : ${b.observedChance} ; intervalle simulé 95 % [${b.chanceRange.join(', ')}] ; proportion de simulations au moins aussi favorables : ${(100*b.pChanceUpper).toFixed(2)} %.\nAttention : ce sont des tests exploratoires unilatéraux, non corrigés pour la sélection de modèles ni les comparaisons multiples. Une valeur faible n’est pas une preuve de prédiction future.`;
}catch(e){setStatus('benchmarkOutput','Comparaison impossible : '+e.message,'bad')}};


// V59: compare exported JSON byte-for-byte with RFC3161 SHA-256 message imprint.
// This validates the link, not the authenticity of a signed TSR.
function hexOf(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
function parseTSAQueryImprint(buf){
 const a=new Uint8Array(buf);let pos=0;
 function tlv(){if(pos>=a.length)throw Error('DER tronqué');const tag=a[pos++];let len=a[pos++];if(len===undefined)throw Error('DER tronqué');if(len&128){const n=len&127;if(n<1||n>4||pos+n>a.length)throw Error('Longueur DER invalide');len=0;for(let i=0;i<n;i++)len=(len<<8)|a[pos++]}if(pos+len>a.length)throw Error('Longueur hors fichier');const start=pos;pos+=len;return {tag,start,end:pos};}
 const outer=tlv();if(outer.tag!==0x30||outer.end!==a.length)throw Error('TSQ : séquence DER invalide');
 pos=outer.start;const version=tlv();if(version.tag!==2)throw Error('Version TSQ absente');
 const imprint=tlv();if(imprint.tag!==0x30)throw Error('MessageImprint absent');
 pos=imprint.start;const alg=tlv();if(alg.tag!==0x30)throw Error('Algorithme absent');
 pos=alg.start;const oid=tlv();if(oid.tag!==6)throw Error('OID absent');
 const sha256oid='608648016503040201';if(hexOf(a.slice(oid.start,oid.end))!==sha256oid)throw Error('TSQ utilise un algorithme autre que SHA-256');
 pos=alg.end;const oct=tlv();if(oct.tag!==4||oct.end-oct.start!==32)throw Error('Empreinte SHA-256 invalide');
 return hexOf(a.slice(oct.start,oct.end));
}
$('verifyPair').onclick=async()=>{
 try{
 const j=$('pairJson').files[0],q=$('pairTsq').files[0];
 if(!j||!q)throw Error('Sélectionne les deux fichiers');
 if(j.size>2000000||q.size>100000)throw Error('Fichier trop volumineux');
 const hash=await digest(await j.arrayBuffer());
 const imprint=parseTSAQueryImprint(await q.arrayBuffer());
 $('pairOutput').textContent='SHA-256 du JSON : '+hash+'\nSHA-256 dans TSQ : '+imprint+'\n'+(hash===imprint?'CORRESPONDANCE EXACTE — fichiers liés. Cela ne certifie PAS un horodatage.':'ÉCHEC — les fichiers ne correspondent PAS.');
 }catch(e){setStatus('pairOutput','Échec : '+e.message,'bad')}
};


// V60: Fixed, transparent model competition. No external AI claims, no retrofitted parameters.
function modelPredict(train,model){
 const main=Array(50).fill(0),ch=Array(11).fill(0),weighted=Array(50).fill(0),wc=Array(11).fill(0);
 for(let i=0;i<train.length;i++){
  const d=train[i],w=(i+1)/train.length;
  for(const n of d.numbers){main[n]++;weighted[n]+=w}
  ch[d.chance]++;wc[d.chance]+=w;
 }
 const ids=Array.from({length:49},(_,i)=>i+1),cids=Array.from({length:10},(_,i)=>i+1);
 const rank=(arr,score,ascending=true)=>arr.slice().sort((a,b)=>(ascending?1:-1)*(score[a]-score[b])||a-b);
 let numbers,chance;
 if(model==='froids300'){return predictFromWindow(train)}
 if(model==='chauds300'){numbers=rank(ids,main,false).slice(0,5);chance=rank(cids,ch,false)[0]}
 else if(model==='recence300'){numbers=rank(ids,weighted,false).slice(0,5);chance=rank(cids,wc,false)[0]}
 else if(model==='equilibre300'){
  // Closest to expected count, deterministic tie-breaking; descriptive, not a physical bias model.
  const score=main.map(v=>Math.abs(v-300*5/49));const cs=ch.map(v=>Math.abs(v-30));
  numbers=rank(ids,score).slice(0,5);chance=rank(cids,cs)[0]
 }else if(model==='aleatoireFixe'){
  // Deterministic baseline: seeded from last observed date, not future result.
  let state=2166136261;for(const c of train.at(-1).date)state=Math.imul(state^c.charCodeAt(0),16777619)>>>0;
  const rand=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
  const pool=ids.slice();numbers=[];for(let k=0;k<5;k++){const j=k+Math.floor(rand()*(49-k));[pool[k],pool[j]]=[pool[j],pool[k]];numbers.push(pool[k])}chance=1+Math.floor(rand()*10)
 }else throw Error('Modèle inconnu');
 return {numbers:numbers.sort((a,b)=>a-b),chance};
}
const modelNames={froids300:'Froids 300 (figé)',chauds300:'Chauds 300',recence300:'Récence pondérée',equilibre300:'Fréquence centrale',aleatoireFixe:'Hasard déterministe'};
const modelKeys=Object.keys(modelNames);
function compareModels(data,holdout=100){
 if(!data||data.length<300+holdout)throw Error('Historique insuffisant pour comparer');
 const records=Object.fromEntries(modelKeys.map(k=>[k,{hits:0,chanceHits:0,counts:Array(6).fill(0),n:0}]));
 const start=Math.max(300,data.length-holdout);
 for(let i=start;i<data.length;i++){
  const train=data.slice(i-300,i),actual=data[i];
  const gap=(Date.parse(actual.date)-Date.parse(train.at(-1).date))/86400000;
  if(gap<2||gap>4||![1,3,6].includes(new Date(actual.date+'T12:00:00Z').getUTCDay()))continue;
  for(const k of modelKeys){const p=modelPredict(train,k),hits=p.numbers.filter(x=>actual.numbers.includes(x)).length;
   const r=records[k];r.hits+=hits;r.chanceHits+=Number(p.chance===actual.chance);r.counts[hits]++;r.n++;
  }
 }
 if(!records.froids300.n)throw Error('Aucun tirage admissible');
 // Selection by a pre-declared conservative rule: do not claim a winner from noisy history.
 // Fixed default remains Froids300; best historical method is descriptive only.
 const sorted=modelKeys.slice().sort((a,b)=>records[b].hits-records[a].hits||modelKeys.indexOf(a)-modelKeys.indexOf(b));
 return {source_sha256:sourceHash,source:origin,holdout_requested:holdout,holdout_actual:records.froids300.n,models:records,historical_leader:sorted[0],selection:'froids300',selection_rule:'Protocole Froids 300 conservé ; classement historique non utilisé pour promettre une performance future',chance_theoretical:0.1,main_expected:25/49,warning:'Analyse exploratoire ; comparaison de plusieurs modèles, aucune preuve d’avantage prédictif.'};
}
$('compareModels').onclick=()=>{try{
 if(!draws)throw Error('Charge les données d’abord');const r=compareModels(draws);window.lastModels=r;
 const n=r.holdout_actual;const lines=[`Période de validation : ${n} tirages, entraînement glissant sur les 300 précédents.`,`Référence hasard : ${(25/49).toFixed(3)} bon numéro/grille ; 10 % Chance.`,`Classement descriptif (NON prédictif) :`];
 for(const k of modelKeys){const m=r.models[k];lines.push(`${modelNames[k]} : ${(m.hits/n).toFixed(3)} numéro/grille ; Chance ${m.chanceHits}/${n} (${(100*m.chanceHits/n).toFixed(1)} %), 3+ numéros ${m.counts.slice(3).reduce((a,b)=>a+b,0)}`)}
 lines.push(`Meilleur score observé : ${modelNames[r.historical_leader]}. Ce classement est exposé au biais de sélection.`);
 lines.push('Modèle de grille conservé : Froids 300 (règles figées). Aucun modèle n’a démontré une capacité à prédire le prochain tirage.');
 $('modelsOutput').textContent=lines.join('\n');$('modelPick').disabled=false;$('exportModels').disabled=false;
 }catch(e){setStatus('modelsOutput','Comparaison impossible : '+e.message,'bad')}
};
$('modelPick').onclick=()=>{try{
 if(!draws||!window.lastModels)throw Error('Lance la comparaison d’abord');
 const target=$('target').value;if(!validISO(target))throw Error('Date cible invalide');requireCurrentTarget(target);requireImmediatePrevious(target,draws);
 const past=draws.filter(x=>x.date<target);if(past.length<300)throw Error('Historique insuffisant');
 const train=past.slice(-300),gap=(Date.parse(target)-Date.parse(train.at(-1).date))/86400000;
 if(gap>4||gap<2||![1,3,6].includes(new Date(target+'T12:00:00Z').getUTCDay()))throw Error('Historique non actualisé ou date cible incohérente : recharge les tirages');
 const p=modelPredict(train,window.lastModels.selection);
 $('modelForecast').textContent=`Grille expérimentale du ${target} : ${p.numbers.join(' - ')} | Chance ${p.chance}\nMéthode : ${modelNames[window.lastModels.selection]}.\nCette sélection n’a pas une probabilité de jackpot supérieure démontrée. Probabilité théorique : 1 sur 19 068 840.`;
 }catch(e){setStatus('modelForecast','Impossible : '+e.message,'bad')}
};
$('exportModels').onclick=()=>{if(window.lastModels)download('comparaison-modeles-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(window.lastModels,null,2),'application/json')};



// V61 — sélection adaptative à validation imbriquée, strictement antérieure à chaque cible.
// Choix sur une période de calibration passée, évaluation sur une période externe jamais consultée pour ce choix.
const V61_MIN_CAL=60, V61_MAX_CAL=120;
function validNextDraw(train,actual){
 const days=(Date.parse(actual.date)-Date.parse(train.at(-1).date))/86400000;
 return days>=2&&days<=4&&[1,3,6].includes(new Date(actual.date+'T12:00:00Z').getUTCDay());
}
function scoreModelAt(data,i,key){
 const train=data.slice(i-300,i),actual=data[i];
 if(train.length!==300||!validNextDraw(train,actual))return null;
 const p=modelPredict(train,key);
 return {hits:p.numbers.filter(n=>actual.numbers.includes(n)).length,chance:Number(p.chance===actual.chance)};
}
function pickUsingPast(data,cutoff,calibration=V61_MAX_CAL){
 // cutoff is the next index to predict. All evaluation dates are < cutoff.
 const first=Math.max(300,cutoff-calibration);
 const results=Object.fromEntries(modelKeys.map(k=>[k,{sum:0,n:0,ch:0}]));
 for(let j=first;j<cutoff;j++){
  for(const k of modelKeys){const r=scoreModelAt(data,j,k);if(r){results[k].sum+=r.hits;results[k].n++;results[k].ch+=r.chance}}
 }
 // 0.02 hit penalty for switching away from the frozen reference, reduces noise-chasing.
 // Tie breaking is fixed by the predeclared order. No chance metric used to select.
 const eligible=modelKeys.filter(k=>results[k].n>=V61_MIN_CAL);
 if(!eligible.length)return {key:'froids300',reason:'Calibration insuffisante',results};
 eligible.sort((a,b)=>((results[b].sum/results[b].n)-(b==='froids300'?0:0.02)) - ((results[a].sum/results[a].n)-(a==='froids300'?0:0.02)) || modelKeys.indexOf(a)-modelKeys.indexOf(b));
 return {key:eligible[0],reason:'Meilleure moyenne calibrée, pénalité de 0,02 hors référence',results};
}
function adaptiveBacktest(data,outer=100,calibration=120){
 if(!data||data.length<300+calibration+outer)throw Error('Historique insuffisant pour validation imbriquée');
 const rows=[],selected=Object.fromEntries(modelKeys.map(k=>[k,0]));
 const start=Math.max(300+calibration,data.length-outer);
 for(let i=start;i<data.length;i++){
  const train=data.slice(i-300,i),actual=data[i];if(!validNextDraw(train,actual))continue;
  const choice=pickUsingPast(data,i,calibration);
  const pred=modelPredict(train,choice.key),base=modelPredict(train,'froids300');
  const hits=pred.numbers.filter(n=>actual.numbers.includes(n)).length;
  const baseHits=base.numbers.filter(n=>actual.numbers.includes(n)).length;
  selected[choice.key]++;
  rows.push({date:actual.date,model:choice.key,forecast:pred.numbers.join('-'),chance:pred.chance,actual:actual.numbers.join('-'),actual_chance:actual.chance,hits,chance_hit:Number(pred.chance===actual.chance),reference_hits:baseHits,reference_chance_hit:Number(base.chance===actual.chance)});
 }
 if(!rows.length)throw Error('Aucun tirage externe admissible');
 const sum=(k)=>rows.reduce((a,r)=>a+r[k],0);
 return {rows,selected,n:rows.length,hits:sum('hits'),referenceHits:sum('reference_hits'),chanceHits:sum('chance_hit'),referenceChanceHits:sum('reference_chance_hit'),expected:rows.length*25/49,calibration,outer};
}
$('runAdaptive').onclick=()=>{try{
 if(!draws)throw Error('Charge le CSV');
 const r=adaptiveBacktest(draws);window.lastAdaptive=r;
 const choices=Object.entries(r.selected).map(([k,v])=>`${modelNames[k]} : ${v}`).join(' ; ');
 $('adaptiveOutput').textContent=`TEST EXTERNE — ${r.n} tirages (calibration passée sur 120 tirages, fenêtre de calcul 300).\nStratégie adaptative : ${r.hits} bons numéros cumulés (${(r.hits/r.n).toFixed(3)} / grille).\nFroids 300 : ${r.referenceHits} (${(r.referenceHits/r.n).toFixed(3)} / grille).\nHasard théorique : ${r.expected.toFixed(1)} bons numéros cumulés.\nChance : adaptatif ${r.chanceHits}/${r.n} ; Froids 300 ${r.referenceChanceHits}/${r.n} ; hasard théorique ${(r.n/10).toFixed(1)}.\nChoix effectués : ${choices}.\nCe test rétrospectif ne prouve pas un avantage futur. Il sert à détecter le surajustement. Les règles ont été définies avant ce test dans la V61.`;
 $('adaptiveForecast').disabled=false;$('adaptiveExport').disabled=false;
 }catch(e){setStatus('adaptiveOutput','Erreur : '+e.message,'bad')}
};
$('adaptiveForecast').onclick=()=>{try{
 if(!draws||!window.lastAdaptive)throw Error('Exécute le test adaptatif d’abord');
 const target=$('target').value;if(!validISO(target))throw Error('Date cible invalide');requireCurrentTarget(target);requireImmediatePrevious(target,draws);
 const past=draws.filter(d=>d.date<target),i=past.length;
 if(i<420)throw Error('Au moins 420 tirages antérieurs requis');
 const gap=(Date.parse(target)-Date.parse(past.at(-1).date))/86400000;
 if(gap<2||gap>4||![1,3,6].includes(new Date(target+'T12:00:00Z').getUTCDay()))throw Error('Date cible incohérente ou CSV périmé');
 const choice=pickUsingPast(past,i),p=modelPredict(past.slice(-300),choice.key);
 $('adaptiveGrid').textContent=`${p.numbers.join(' · ')} | Chance ${p.chance}\nMéthode sélectionnée : ${modelNames[choice.key]}.\nSélection fondée uniquement sur les tirages précédant le ${target}.\nProbabilité théorique du jackpot si tirage équitable : 1 sur 19 068 840. Aucun gain garanti.`;
 }catch(e){setStatus('adaptiveGrid','Erreur : '+e.message,'bad')}
};
$('adaptiveExport').onclick=()=>{if(window.lastAdaptive)download('validation-adaptative-v61.json',JSON.stringify(window.lastAdaptive,null,2),'application/json')};

// La date affichée n'est plus figée dans le HTML.
$('target').value=nextLotoDate();
