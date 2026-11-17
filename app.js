"use strict";
const $=id=>document.getElementById(id);let draws=null, sourceHash=null, latest=null, origin='';
const reference='b7af95fc3afaf90a51b861e038cf9c328de55a224800808d72c79b9422ae7111';
function setStatus(id,msg,cls=''){const el=$(id);el.textContent=msg;el.className=cls}
function invalidate(){latest=null;$('export').disabled=true;$('save').disabled=true;$('tsq').disabled=true;$('result').textContent='Recalcul nécessaire.'}
function dateISO(raw){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());if(!m)throw Error('Date FDJ invalide : '+raw);const iso=`${m[3]}-${m[2]}-${m[1]}`;if(!validISO(iso))throw Error('Date impossible : '+raw);return iso}
function validISO(x){if(!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const d=new Date(x+'T12:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===x}
function parseCSV(txt){const lines=txt.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)throw Error('CSV vide');const cols=lines.shift().split(';').map(x=>x.trim());const required=['date_de_tirage','numero_chance',...Array.from({length:5},(_,i)=>'boule_'+(i+1))];const ids=required.map(x=>cols.indexOf(x));if(ids.some(x=>x<0))throw Error('Colonnes FDJ manquantes');const seen=new Set(),all=[];for(let i=0;i<lines.length;i++){const cells=lines[i].split(';');const date=dateISO(cells[ids[0]]||'');if(seen.has(date))throw Error('Tirage dupliqué : '+date);seen.add(date);const values=ids.slice(2).map(j=>Number(cells[j])),chance=Number(cells[ids[1]]);if(values.some(x=>!Number.isInteger(x)||x<1||x>49)||new Set(values).size!==5||!Number.isInteger(chance)||chance<1||chance>10)throw Error('Numéros invalides ligne '+(i+2));all.push({date,numbers:values,chance})}return all.sort((a,b)=>a.date.localeCompare(b.date))}
async function digest(raw){if(!crypto?.subtle)throw Error('SHA-256 indisponible : ouvre via HTTPS');const bytes=await crypto.subtle.digest('SHA-256',raw);return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')}
async function loadBytes(bytes,originName){invalidate();draws=null;$('calculate').disabled=true;const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);const parsed=parseCSV(text);const hash=await digest(bytes);draws=parsed;sourceHash=hash;origin=originName;$('calculate').disabled=false;setStatus('source',`${parsed.length} tirages uniques, du ${parsed[0].date} au ${parsed.at(-1).date}. SHA-256 : ${hash}. ${hash===reference?'Identique au CSV de référence embarqué.':'Source différente de la référence : provenance non certifiée.'}`,hash===reference?'ok':'warn')}
$('embedded').onclick=async()=>{try{setStatus('source','Chargement…');const res=await fetch('./loto_201911.csv',{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);await loadBytes(await res.arrayBuffer(),'CSV embarqué')}catch(e){draws=null;invalidate();$('calculate').disabled=true;setStatus('source','Erreur : '+e.message,'bad')}};
$('file').onchange=async()=>{try{const file=$('file').files[0];if(!file)return;if(!/\.csv$/i.test(file.name))throw Error('Extrais d’abord le CSV du ZIP FDJ');await loadBytes(await file.arrayBuffer(),file.name)}catch(e){draws=null;invalidate();$('calculate').disabled=true;setStatus('source','Erreur : '+e.message,'bad')}};
$('target').onchange=invalidate;
$('calculate').onclick=()=>{try{invalidate();if(!draws)throw Error('Aucun CSV valide');const target=$('target').value;if(!validISO(target))throw Error('Date cible invalide');const previous=draws.filter(d=>d.date<target);if(previous.length<300)throw Error('Moins de 300 tirages précédents');const window=previous.slice(-300);const main=Array(50).fill(0),chances=Array(11).fill(0);for(const d of window){for(const n of d.numbers)main[n]++;chances[d.chance]++}const ranking=Array.from({length:49},(_,i)=>i+1).sort((a,b)=>main[a]-main[b]||a-b),cr=Array.from({length:10},(_,i)=>i+1).sort((a,b)=>chances[a]-chances[b]||a-b);const numbers=ranking.slice(0,5).sort((a,b)=>a-b),chance=cr[0];const gaps=[];for(let i=1;i<window.length;i++){const delta=(Date.parse(window[i].date)-Date.parse(window[i-1].date))/86400000;if(delta>7)gaps.push(`${window[i-1].date} → ${window[i].date} (${delta} jours)`)}const maxDate=window.at(-1).date;const stale=(Date.parse(target)-Date.parse(maxDate))/86400000>4;latest={protocol:'Froids 300',protocol_version:'frozen-2026-11-11',software:'V53',target,source:origin,source_sha256:sourceHash,reference_match:sourceHash===reference,window_start:window[0].date,window_end:maxDate,window_count:300,numbers,chance,main_frequencies:Object.fromEntries(main.slice(1).map((v,i)=>[i+1,v])),chance_frequencies:Object.fromEntries(chances.slice(1).map((v,i)=>[i+1,v])),gap_warnings:gaps,stale_warning:stale,independent_timestamp_verified:false};$('result').replaceChildren();const p=document.createElement('p');p.className='balls';p.textContent=numbers.join(' · ')+'  |  Chance '+chance;$('result').append(p);const detail=document.createElement('pre');detail.textContent=`Fenêtre : ${window[0].date} au ${maxDate}\nFréquences : ${numbers.map(n=>n+': '+main[n]).join(' ; ')} ; Chance ${chance}: ${chances[chance]}\nTop 15 : ${ranking.slice(0,15).map(n=>n+'('+main[n]+')').join(', ')}\nSource SHA-256 : ${sourceHash}`;$('result').append(detail);setStatus('warning',stale?'ATTENTION : le dernier tirage connu est trop ancien par rapport à la cible. Vérifie les archives FDJ avant de considérer cette sélection.':gaps.length?'ATTENTION : intervalles de plus de 7 jours détectés : '+gaps.slice(0,3).join(' ; '):'Dates contrôlées ; exhaustivité officielle NON certifiée. Vérifier la dernière publication FDJ.',stale||gaps.length?'bad':'warn');$('export').disabled=!(!stale&&!gaps.length);$('save').disabled=stale||gaps.length>0;$('tsq').disabled=stale||gaps.length>0}catch(e){setStatus('result','Calcul bloqué : '+e.message,'bad')}};
function download(name,txt,mime){const u=URL.createObjectURL(new Blob([txt],{type:mime}));const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}
$('export').onclick=()=>{if(latest)download('froids300-'+latest.target+'.json',JSON.stringify(latest,null,2),'application/json')};
$('save').onclick=async()=>{if(!latest)return;try{const key='froids300_v53_local',items=JSON.parse(localStorage.getItem(key)||'[]');if(items.some(x=>x.target===latest.target))throw Error('Date déjà enregistrée localement : aucune modification effectuée');const json=JSON.stringify(latest);const hash=await digest(new TextEncoder().encode(json));const item={...latest,local_saved_at:new Date().toISOString(),report_sha256:hash,proof_status:'LOCAL_ONLY_NOT_INDEPENDENTLY_TIMESTAMPED'};items.push(item);localStorage.setItem(key,JSON.stringify(items));download('engagement-local-'+latest.target+'.json',JSON.stringify(item,null,2),'application/json');setStatus('journal','Enregistré localement, NON certifié. Empreinte : '+hash,'warn')}catch(e){setStatus('journal','Enregistrement impossible : '+e.message,'bad')}};
$('showJournal').onclick=()=>{try{$('journal').textContent=JSON.stringify(JSON.parse(localStorage.getItem('froids300_v53_local')||'[]'),null,2)}catch(e){setStatus('journal','Journal illisible : '+e.message,'bad')}};

// Synchronisation opportuniste : URL choisie par l'utilisateur, aucune API FDJ inventée.
const REMOTE_KEY='froids300_v53_remote_url',AUTO_KEY='froids300_v53_auto';
$('remoteUrl').value=localStorage.getItem(REMOTE_KEY)||'';
$('autoRemote').checked=localStorage.getItem(AUTO_KEY)==='1';
$('autoRemote').onchange=()=>localStorage.setItem(AUTO_KEY,$('autoRemote').checked?'1':'0');
async function updateRemote(){
 const url=$('remoteUrl').value.trim();
 if(!/^https:\/\//i.test(url))throw Error('URL HTTPS obligatoire');
 localStorage.setItem(REMOTE_KEY,url);
 invalidate();draws=null;$('calculate').disabled=true;
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 try{
   const res=await fetch(url,{cache:'no-store',mode:'cors',signal:controller.signal});
   if(!res.ok)throw Error('Serveur HTTP '+res.status);
   const buf=await res.arrayBuffer();if(buf.byteLength>15_000_000)throw Error('Fichier trop volumineux');
   await loadBytes(buf,'URL externe : '+url);
 }finally{clearTimeout(timeout)}
}
$('remote').onclick=async()=>{try{setStatus('source','Vérification de la source distante…','warn');await updateRemote()}catch(e){draws=null;invalidate();$('calculate').disabled=true;setStatus('source','Actualisation impossible : '+e.message+' ; importe le CSV officiel manuellement.','bad')}};
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
 const bytes=tsqForHash(hash);download('prediction-'+latest.target+'.json',report,'application/json');
 download('prediction-'+latest.target+'.tsq',bytes,'application/timestamp-query');
 setStatus('timestamp','Requête .tsq générée pour le SHA-256 '+hash+'. Envoie-la à un service RFC3161 et conserve le .tsr reçu. La V53 ne vérifie pas les signatures .tsr.','warn');
 }catch(e){setStatus('timestamp','Erreur : '+e.message,'bad')}
};
