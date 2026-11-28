/* V19 — data-safety diagnostics + non-destructive backup and reimport. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const K_DATA='ia_loto_v18_additions_v1',K_JOURNAL='ia_loto_v18_prospective_v1';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state=(id,msg,cl='')=>{const e=$(id);e.className='status '+cl;e.textContent=msg};
function rows(k){const v=localStorage.getItem(k);if(v==null)return [];const arr=JSON.parse(v);if(!Array.isArray(arr))throw Error('Données corrompues dans '+k);return arr;}
function output(name,value){const b=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},1200)}
async function check(){const checks=[];const add=rows(K_DATA),journal=rows(K_JOURNAL);const active=window.Loto18.allRows();checks.push(`✓ ${active.length} tirages disponibles, ${add.length} ajout(s) persistants`);
 const validAdd=window.Loto18.validateAdditions(add);checks.push(`✓ ${validAdd.length} résultats ajoutés valides`);
 const rep=await window.Loto18.auditEntries();checks.push(`✓ ${journal.length} prévision(s), ${rep.invalid} anomalie(s), ${rep.waiting} en attente, ${rep.assessed} évaluée(s)`);
 if(rep.invalid)checks.push('⚠ Les prévisions incohérentes ont été exclues du bilan, sans suppression');
 const internal=await window.Loto18.tests();checks.push(`✓ ${internal.length} contrôles mathématiques et reproductibilité`);
 if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration();checks.push(reg?'✓ Service worker enregistré (cache susceptible de se mettre à jour)':'ℹ Mode en ligne sans service worker actif');}
 checks.push('ℹ Les CSV transmis ne sont pas authentifiés cryptographiquement par FDJ');
 state('v19Status',checks.join('\n'),'good');$('v19Status').style.whiteSpace='pre-line';return checks;}
function exportBackup(){const backup={format:'IA-LOTO-V19-backup-v1',exported:new Date().toISOString(),origin:location.origin,additions:rows(K_DATA),records:rows(K_JOURNAL),note:'Export local; n’atteste ni la source FDJ ni l’heure de création'};output('IA_LOTO_V19_SAUVEGARDE_COMPLETE.json',backup);}
async function restoreBackup(file){if(!file||file.size>10*1024*1024)throw Error('Fichier absent ou trop volumineux');const obj=JSON.parse(await file.text());if(obj.format!=='IA-LOTO-V19-backup-v1'||!Array.isArray(obj.additions)||!Array.isArray(obj.records))throw Error('Archive V19 non reconnue');
 // two-phase verification before writes; avoid partial merges and conflicting dates
 const adds=window.Loto18.validateAdditions(obj.additions),oldAdd=rows(K_DATA),oldJournal=rows(K_JOURNAL);
 if(oldAdd.length>adds.length||oldAdd.some((x,i)=>JSON.stringify(window.Loto18.canonical(x))!==JSON.stringify(window.Loto18.canonical(adds[i]))))throw Error('Conflit historique : aucun remplacement');
 const byDate=new Map(oldJournal.map(x=>[x.target,x])),all=[...oldJournal];
 if(oldJournal.some(x=>!window.Loto18.structure(x)))throw Error('Journal actuel malformé : aucune restauration');
 for(const rec of obj.records){if(!window.Loto18.structure(rec))throw Error('Prévision malformée dans la sauvegarde');
 const saved=byDate.get(rec.target);if(saved){if(JSON.stringify(saved)!==JSON.stringify(rec))throw Error('Conflit journal au '+rec.target);}else{byDate.set(rec.target,rec);all.push(rec);}}
 // verify every imported record without changing persistent state: use SHA-256 identical to V18
 for(const rec of [...oldJournal,...obj.records]){const {hash,...unsigned}=rec;const bytes=new TextEncoder().encode(JSON.stringify(unsigned));const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(actual!==hash)throw Error('Empreinte invalide pour '+rec.target);}
 const beforeData=localStorage.getItem(K_DATA),beforeJournal=localStorage.getItem(K_JOURNAL);
 try{(window.LotoVault||localStorage).setItem(K_DATA,JSON.stringify(adds));(window.LotoVault||localStorage).setItem(K_JOURNAL,JSON.stringify(all));if(rows(K_JOURNAL).length!==all.length||rows(K_DATA).length!==adds.length)throw Error('Persistance incomplète');}
 catch(e){try{if(beforeData==null)(window.LotoVault||localStorage).removeItem(K_DATA);else (window.LotoVault||localStorage).setItem(K_DATA,beforeData);if(beforeJournal==null)(window.LotoVault||localStorage).removeItem(K_JOURNAL);else (window.LotoVault||localStorage).setItem(K_JOURNAL,beforeJournal)}catch{}throw e}
 return `${adds.length} ajouts conservés ; ${all.length} prévisions conservées. Recharge la page pour recalculer les tableaux.`;}
function setup(){// Le bouton Modules avancés gère directement la navigation dans index.html.
 $('v19Check')?.addEventListener('click',async()=>{state('v19Status','Vérifications en cours…');try{await check()}catch(e){state('v19Status','Diagnostic interrompu : '+e.message,'bad')}});
 $('v19Backup')?.addEventListener('click',()=>{try{exportBackup();state('v19RestoreStatus','Sauvegarde complète exportée. Garde ce fichier en lieu sûr.','good')}catch(e){state('v19RestoreStatus','Export impossible : '+e.message,'bad')}});
 $('v19ImportBackup')?.addEventListener('change',async e=>{try{const msg=await restoreBackup(e.target.files?.[0]);state('v19RestoreStatus',msg,'good')}catch(err){state('v19RestoreStatus','Restauration refusée : '+err.message,'bad')}finally{e.target.value=''}});
}
window.Loto19={check,exportBackup,restoreBackup};setup();
})();