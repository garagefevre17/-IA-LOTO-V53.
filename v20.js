/* IA LOTO V20 — diagnostic transversal read-only et export non destructif. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const KEYS=['ia_loto_v18_additions_v1','ia_loto_v18_prospective_v1','ia_loto_v17_journal_v1','ia_loto_expert_v1_draws','ia_loto_expert_v1_log','ia_loto_journal_v4','ia_loto_v7_last_sync'];
const state=(id,msg,type='')=>{const e=$(id);if(!e)return;e.className='status '+type;e.textContent=msg;};
const sha=async x=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(x))))].map(x=>x.toString(16).padStart(2,'0')).join('');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function load(k){const raw=localStorage.getItem(k);if(raw==null)return [];let v=JSON.parse(raw);if(!Array.isArray(v))throw Error('Format de stockage invalide : '+k);return v;}
async function check(){if(!window.Loto18)throw Error('Moteur V18 non chargé');const d=window.Loto18.allRows(),latest=d.at(-1)[0],added=load(KEYS[0]),j=load(KEYS[1]);const report=await window.Loto18.auditEntries();
 $('v20Total').textContent=d.length.toLocaleString('fr-FR');$('v20Last').textContent=latest.split('-').reverse().join('/');$('v20New').textContent=added.length;$('v20Pending').textContent=report.waiting;
 const past=window.Loto18.nextDate(latest)<today(),parts=[`Base active : ${d.length} tirages (dont ${added.length} ajouts locaux).`,`Dernier tirage : ${latest}.`,past?'Historique en retard : résultats nouveaux à vérifier puis importer.':'Dernier résultat compatible avec le calendrier actuel.',`${j.length} prévisions V18 : ${report.assessed} évaluée(s), ${report.waiting} en attente, ${report.invalid} anomalie(s).`,'Les imports locaux ne sont pas une preuve officielle FDJ.'];
 try{const oldRaw=localStorage.getItem('ia_loto_expert_v1_draws');if(oldRaw){const old=JSON.parse(oldRaw);if(Array.isArray(old)&&old.length){const legacyLast=old.at(-1)?.[0];if(typeof legacyLast==='string'&&legacyLast>latest)parts.push(`⚠ Module historique plus récent (${legacyLast}) que le centre V18/V20 (${latest}). Importer et contrôler les résultats dans V20 : les bases ne sont PAS automatiquement fusionnées.`);}}}catch{parts.push('⚠ Historique du module ancien illisible ; ne pas le fusionner automatiquement.')}
 state('v20Health',parts.join('\n'),report.invalid?'bad':past?'warn':'good');
 return {d,added,j,report,past};}
async function tests(){const passes=[],assert=(name,yes)=>{if(!yes)throw Error('ÉCHEC : '+name);passes.push(name)};
 const {d,added,j,report}=await check();assert('Historique valide',d.every(window.Loto18.valid)&&d.length>=2833);
 assert('Dates uniques',new Set(d.map(r=>r[0])).size===d.length);
 assert('Derniers 300 calculables',d.length>=300&&window.Loto18.pick(d,300,true).numbers.length===5);
 assert('Froids 300 stable',JSON.stringify(window.Loto18.pick(d,300,true))===JSON.stringify(window.Loto18.pick(d,300,true)));
 assert('Jackpot : 19 068 840 combinaisons',((49*48*47*46*45)/(5*4*3*2*1))*10===19068840);
 assert('Calendrier ordinaire lundi-mercredi-samedi',window.Loto18.nextDate('2026-11-11')==='2026-11-14');
 assert('Aucun doublon dans les nouveaux résultats',new Set(added.map(x=>x[0])).size===added.length);
 const no=[...Array(5)].map((_,i)=>i+1);assert('Combinaison valide contrôlée',window.Loto18.valid(['2026-11-14',...no,1]));
 assert('Empreinte SHA-256 stable',(await sha(d))===(await sha(d)));
 const safe={protocol:'V18-1',target:'2026-11-14',cutoff:'2026-11-11',cutoffHash:'a'.repeat(64),created:'2026-11-14T09:00:00Z',methods:[{key:'cold',numbers:[1,2,3,4,5],chance:1},{key:'adaptive',numbers:[2,3,4,5,6],chance:2},{key:'uniform',numbers:[3,4,5,6,7],chance:3}]};safe.hash=await sha(safe);
 assert('Format journal V18 validable',window.Loto18.structure(safe));
 const {hash,...plain}=safe;assert('Modification détectable',(await sha({...plain,cutoff:'2026-11-10'}))!==hash);
 assert('Audit journal sans effacement',report.assessed+report.waiting+report.invalid===j.length);
 let rejection=false;try{window.Loto18.validateAdditions([['2026-11-14',1,2,3,4,4,1]])}catch{rejection=true}assert('Doublon numéro rejeté dans un CSV',rejection);
 const inner=await window.Loto18.tests();assert('Tests historiques V18',inner.length>=8);
 state('v20TestOut',`${passes.length} contrôles réussis.\n`+passes.map((s,i)=>`${i+1}. ${s}`).join('\n')+'\n\nTests techniques seulement : aucune supériorité prédictive démontrée.','good');return passes;
}
function download(filename,obj){const b=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},1500);}
async function backup(){const data={},warnings=[];for(const k of KEYS){const raw=localStorage.getItem(k);if(raw!=null){try{data[k]=JSON.parse(raw)}catch{data[k]={raw_text:raw};warnings.push(k+' non JSON');}}}const payload={format:'IA-LOTO-V20-sauvegarde-lecture-seule',exported:new Date().toISOString(),origin:location.origin,source:'stockage local du navigateur, non authentifié',keys:data,warnings};payload.sha256=await sha(payload);download('IA_LOTO_V20_SAUVEGARDE_GENERALE.json',payload);state('v20TestOut',`Sauvegarde générale téléchargée : ${Object.keys(data).length} clés locales. Export de secours uniquement : restaurer avec les outils de chaque ancien module. Aucune donnée supprimée.`,'good');return payload;}
function wire(){ $('v20Refresh')?.addEventListener('click',()=>check().catch(e=>state('v20Health','Erreur : '+e.message,'bad')));
 $('v20DeepTest')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;state('v20TestOut','Exécution des tests…');try{await tests()}catch(err){state('v20TestOut','Test interrompu : '+err.message,'bad')}finally{b.disabled=false}});
 $('v20Backup')?.addEventListener('click',async()=>{try{await backup()}catch(e){state('v20TestOut','Export impossible : '+e.message,'bad')}});
 document.querySelector('nav button[data-page="v18"]')?.addEventListener('click',()=>check().catch(e=>state('v20Health','Erreur : '+e.message,'bad')));
 window.addEventListener('storage',()=>check().catch(()=>{}));
 setTimeout(()=>check().catch(e=>state('v20Health','Erreur : '+e.message,'bad')),100);
}
window.Loto20={check,tests,backup};wire();
})();
