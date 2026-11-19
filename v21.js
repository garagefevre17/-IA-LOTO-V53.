/* IA LOTO V21 — inventaire non destructif et contrôles de cohérence transversaux */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const SOURCES=[
 {key:'ia_loto_expert_v1_log',name:'Journal historique V4–V16',kind:'simple'},
 {key:'ia_loto_journal_v4',name:'Sauvegarde historique alternative',kind:'simple'},
 {key:'ia_loto_v17_journal_v1',name:'Journal V17',kind:'v17'},
 {key:'ia_loto_v18_prospective_v1',name:'Journal centre V18–V21',kind:'v18'}
];
const serial=x=>JSON.stringify(x);
const sha=async x=>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(typeof x==='string'?x:serial(x)));
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
};
function getSources(){return SOURCES.map(source=>{
 const raw=localStorage.getItem(source.key);
 if(raw==null)return {...source,rows:[],status:'absent'};
 try{const rows=JSON.parse(raw);if(!Array.isArray(rows))return {...source,rows:[],status:'format non-tableau'};
 return {...source,rows,status:'présent'};
 }catch{return {...source,rows:[],status:'JSON illisible'}};
 });}
function validSimple(e){return e&&/^\d{4}-\d\d-\d\d$/.test(e.target)&&typeof e.method==='string'&&Array.isArray(e.numbers)&&e.numbers.length===5&&new Set(e.numbers).size===5&&e.numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=49)&&Number.isInteger(e.chance)&&e.chance>=1&&e.chance<=10;}
function describe(r){if(r.kind==='v18')return r.rows.length+' dates, jusqu’à 3 méthodes par date';if(r.kind==='v17')return r.rows.length+' prévisions de groupe';return r.rows.length+' sélections';}
function html(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function read(){const ss=getSources(),error=ss.filter(s=>s.status!=='présent'&&s.status!=='absent');const active=ss.reduce((a,s)=>a+s.rows.length,0);const dates=new Set(ss.flatMap(s=>s.rows.map(r=>r.target).filter(Boolean)));
 let data=[],dataIssue='';try{data=window.Loto18?.allRows?.()||[];}catch(e){dataIssue='\n⚠ Historique central illisible : '+e.message;}const last=data?.at(-1)?.[0]||'non disponible';
 $('v21Counts').className='status '+(error.length?'warn':'good');$('v21Counts').textContent=`${active} enregistrement(s) dans ${ss.filter(s=>s.status==='présent').length} journal(aux) local(aux) • ${dates.size} date(s) distincte(s).\nHistorique central : ${data?.length||'indisponible'} tirages, dernière date ${last}.\nCes journaux se chevauchent : ne pas additionner leurs prévisions comme des essais indépendants.`;
 $('v21Rows').innerHTML=ss.map(s=>`<div class="v21-record"><strong>${html(s.name)}</strong>${html(describe(s))} · ${html(s.status)} · ${html(s.key)}</div>`).join('');return ss;
}
async function verify(){const ss=read(),bad=[],ok=[];for(const s of ss){if(s.status!=='présent'&&s.status!=='absent'){bad.push(`${s.name} : ${s.status}`);continue;}
 const dates=new Set();for(let i=0;i<s.rows.length;i++){const e=s.rows[i],p=`${s.name} entrée ${i+1}`;if(!e||typeof e!=='object'){bad.push(`${p} : objet invalide`);continue;}
 if(s.kind==='simple'&&!validSimple(e)){bad.push(`${p} : sélection invalide`);continue;}
 if(s.kind==='v18'){
 if(!window.Loto18?.structure(e)){bad.push(`${p} : structure invalide`);continue;}
 const {hash,...rest}=e;if(await sha(rest)!==hash){bad.push(`${p} : empreinte différente`);continue;}
 }
 if(s.kind==='v17'){
 if(typeof e.recordHash!=='string'||!Array.isArray(e.methods)){bad.push(`${p} : structure invalide`);continue;}
 const {recordHash,...rest}=e;if(await sha(serial(rest))!==recordHash){bad.push(`${p} : empreinte différente`);continue;}
 }
 if(s.kind!=='simple'){if(dates.has(e.target)){bad.push(`${p} : date dupliquée`);continue;}dates.add(e.target);}
 ok.push(p);
 }}
 const msg=`${ok.length} entrée(s) contrôlée(s), ${bad.length} anomalie(s).\n`+(bad.length?bad.slice(0,20).join('\n'):'Aucune anomalie détectée par les contrôles disponibles.')+'\nLes heures locales ne sont pas certifiées ; les anciens journaux n’ont pas tous une empreinte.';
 $('v21Integrity').className='status '+(bad.length?'bad':'good');$('v21Integrity').textContent=msg;return {ok:ok.length,bad};}
function download(name,obj){const b=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},5000);}
async function exportInventory(){const items=getSources();const payload={format:'ia-loto-v21-inventaire-v1',time_local_not_certified:new Date().toISOString(),origin:location.origin,inventory:items.map(s=>({source:s.name,key:s.key,status:s.status,count:s.rows.length})),journal_backup:Object.fromEntries(items.filter(s=>s.status==='présent').map(s=>[s.key,s.rows])),warning:'Inventaire et sauvegarde de lecture seule, non importables directement avec les outils de restauration par version. Horodatages non certifiés.'};payload.sha256=await sha(payload);download('IA_LOTO_V21_INVENTAIRE_JOURNAUX.json',payload);}
function setup(){if(!$('v21Counts'))return; $('v21Refresh').addEventListener('click',()=>{try{read()}catch(e){$('v21Counts').textContent='Diagnostic bloqué : '+e.message;}});$('v21Verify').addEventListener('click',()=>verify().catch(e=>{$('v21Integrity').textContent='Contrôle interrompu : '+e.message;}));$('v21Export').addEventListener('click',()=>exportInventory().catch(e=>{$('v21Integrity').textContent='Export refusé : '+e.message;}));document.querySelector('nav button[data-page="v18"]')?.addEventListener('click',()=>setTimeout(()=>{try{read()}catch(e){$('v21Counts').textContent=e.message;}},0));read();}
window.Loto21={read,verify,exportInventory,getSources};setup();
})();
