/* V16.13 — évaluation des tirages nouveaux à partir d'un CSV FDJ fourni.
 * Jamais d'écriture sur les résultats locaux ou les journaux.
 * Refuse les fichiers contradictoires ou invalides pour éviter les faux bilans.
 * Un CSV fourni n'est pas authentifié cryptographiquement comme provenant de FDJ. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='ia_loto_v166_prospectif_v1';let last=null;
function csvLine(rows){const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';return '\ufeff'+rows.map(x=>x.map(quote).join(';')).join('\r\n')}
function save(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},2000)}
function canonicalName(p){return p?.name||p?.key||''}
function numbers(p){return p?.nums||p?.numbers}
function score(rec,result){const out=[];for(const p of rec.methods||[]){const name=canonicalName(p),nums=numbers(p);if(!['cold','adaptive','uniform'].includes(name)||!Array.isArray(nums)||nums.length!==5||!nums.every(Number.isInteger)||!Number.isInteger(p.chance))continue;out.push({method:name,numbers:nums,chance:p.chance,hits:nums.filter(n=>result.slice(1,6).includes(n)).length,chanceHit:Number(p.chance===result[6])})}return out.length===3&&new Set(out.map(x=>x.method)).size===3?out:null}
async function evaluate(csvText,fileName,admission){
 if(!window.Loto1611?.parseFDJ||!window.Loto168?.audit||!window.Loto16?.draws)throw Error('Modules V16, V16.8 ou V16.11 manquants');
 const official=window.Loto1611.parseFDJ(csvText), local=window.Loto16.draws();
 const match=window.Loto1611.compare(official,local), audit=await window.Loto168.audit();
 const issues=[...official.errors.map(e=>'Ligne '+e.ligne+': '+e.raison),...match.conflicts.map(e=>'Contradiction '+e.date)];
 if(issues.length)throw Error('Évaluation BLOQUÉE : '+issues.length+' anomalie(s) : '+issues.slice(0,3).join(' ; '));
 const byDate=new Map(official.rows.map(x=>[x[0],x]));const lastKnown=local.at(-1)?.[0]||'';
 const eligible=[],pending=[],excluded=[];
 for(const r of audit.records){
  if(!r.ok){excluded.push({date:r.target,issues:r.error||['Échec empreinte']});continue}
  const outcome=byDate.get(r.target);if(!outcome){pending.push({date:r.target,reason:'Date absente du fichier'});continue}
  const results=score(r,outcome);if(!results){excluded.push({date:r.target,issues:['Sélections manquantes ou invalides']});continue}
  const isNew=r.target>lastKnown;
  // Le fichier est seulement une source apportée par l'utilisateur : demande d'admission explicite.
  if(isNew&&!admission){pending.push({date:r.target,reason:'Nouveau résultat présent dans CSV, non admis pour calcul avant confirmation de la provenance'});continue}
  eligible.push({date:r.target,result:outcome.slice(1),fromNewCsv:isNew,results});
 }
 const totals={};for(const r of eligible)for(const x of r.results){const t=totals[x.method]??={n:0,main:0,chance:0};t.n++;t.main+=x.hits;t.chance+=x.chanceHit}
 return {version:'16.13',checkedAt:new Date().toISOString(),filename:fileName,source:'CSV sélectionné par utilisateur ; provenance non authentifiée',localLatest:lastKnown,officialCount:official.rows.length,matched:match.matched.length,newResults:match.missingLocally.filter(x=>x[0]>lastKnown).length,olderMissing:match.missingLocally.filter(x=>x[0]<=lastKnown).length,duplicates:official.duplicates.length,issues,admissionNewResults:!!admission,evaluated:eligible,pending,excluded,totals,warning:'Les hashes et dates locaux ne prouvent pas l’existence d’une prévision avant le tirage. Les nouveaux résultats CSV ne sont pas enregistrés dans la base.'};
}
function render(r){
 const box=$('v1613Status');box.className='status good';
 box.innerHTML=`<b>${r.officialCount} résultats dans le CSV · ${r.matched} identiques à la base · ${r.newResults} nouveaux tirages ultérieurs</b><p>Base locale arrêtée au ${esc(r.localLatest)}. ${r.olderMissing} autre(s) date(s) du CSV absente(s) de la base. ${r.duplicates} doublon(s) identique(s).</p><p><b>${r.evaluated.length} prévision(s) évaluée(s)</b> · ${r.pending.length} en attente · ${r.excluded.length} exclue(s) pour anomalie.</p>`;
 let html='';if(r.evaluated.length){html='<table class="tbl"><tr><th>Méthode</th><th>Bons numéros</th><th>Chance</th></tr>';for(const [name,t] of Object.entries(r.totals))html+=`<tr><td>${esc(name)} (${t.n})</td><td>${t.main} / ${(t.n*25/49).toFixed(2)} attendus</td><td>${t.chance} / ${(t.n/10).toFixed(2)} attendus</td></tr>`;html+='</table>';html+='<p>Dates évaluées : '+r.evaluated.map(x=>esc(x.date)+(x.fromNewCsv?' (nouveau CSV)':'')).join(', ')+'</p>'}else html='<p>Aucune prévision évaluable. Cela ne signifie pas zéro bon numéro : il n’y a pas encore de résultat vérifié pour ces prévisions.</p>';
 html+='<p class="note">Évaluation en lecture seule. Le fichier fourni n’est pas une preuve d’authenticité FDJ. Un hash créé localement ne certifie pas la date d’une prévision.</p>';$('v1613Results').innerHTML=html;
 $('v1613Export').disabled=false;$('v1613CSV').disabled=false;
}
$('v1613Run')?.addEventListener('click',async()=>{const file=$('v1613File')?.files?.[0];const button=$('v1613Run');button.disabled=true;$('v1613Status').textContent='Contrôle du CSV et des prévisions…';try{if(!file)throw Error('Choisis un fichier CSV FDJ');if(file.size>15*1024*1024)throw Error('CSV supérieur à 15 Mo');last=await evaluate(await file.text(),file.name,$('v1613Confirm')?.checked);render(last)}catch(e){last=null;$('v1613Status').className='status bad';$('v1613Status').textContent=String(e.message||e);$('v1613Results').textContent='Bilan non calculé.';$('v1613Export').disabled=true;$('v1613CSV').disabled=true;}finally{button.disabled=false}});
$('v1613Export')?.addEventListener('click',()=>{if(last)save('IA_LOTO_V16_13_BILAN.json',JSON.stringify(last,null,2),'application/json')});
$('v1613CSV')?.addEventListener('click',()=>{if(!last)return;const out=[['date','nouveau_csv','methode','bons_principaux','chance_correcte']];for(const d of last.evaluated)for(const m of d.results)out.push([d.date,d.fromNewCsv,m.method,m.hits,m.chanceHit]);save('IA_LOTO_V16_13_RESULTATS.csv',csvLine(out),'text/csv;charset=utf-8')});
window.Loto1613={evaluate,score};
})();
