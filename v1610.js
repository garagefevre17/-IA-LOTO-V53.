/* V16.10 : audit prospectif et rapport de vraisemblance séquentiel.
   Calculs faits UNIQUEMENT sur les enregistrements locaux dont l'empreinte est cohérente.
   Attention: la date de création n'est PAS attestée par un tiers. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const safe=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=x=>Number(x).toLocaleString('fr-FR',{maximumFractionDigits:5});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const days=(a,b)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);
function snapshot(){
 if(!window.Loto16?.draws||!window.Loto168?.audit||!window.Loto166?.score)throw Error('Dépendances V16, V16.6 ou V16.8 indisponibles');
 const d=window.Loto16.draws();if(!Array.isArray(d)||!d.length)throw Error('Historique absent');
 const dates=d.map(r=>r[0]);let duplicates=dates.length-new Set(dates).size;
 const latest=dates[dates.length-1];return {latest,count:d.length,ageDays:days(today(),latest),duplicates};
}
async function compute(){
 const base=snapshot();const audit=await window.Loto168.audit();
 const records=audit.records||[];let ok=records.filter(r=>r.ok),bad=records.filter(r=>!r.ok);
 const evaluated=ok.filter(r=>r.actual).sort((a,b)=>a.target.localeCompare(b.target));
 const pending=ok.filter(r=>!r.actual);
 let sumLossDiff=0,maxE=1,steps=[],issues=[];
 for(const r of evaluated){
   // score() uses frozen weights and cutoff, and returns logloss(model)-logloss(uniform).
   // Only a sequential log likelihood ratio, never an assertion of independent timestamp.
   const sourceRecord=(JSON.parse(localStorage.getItem('ia_loto_v166_prospectif_v1')||'[]')).find(x=>x.target===r.target);
   const actual=window.Loto16.draws().find(x=>x[0]===r.target);
   if(!sourceRecord||!actual){issues.push('Enregistrement manquant '+r.target);continue}
   const delta=window.Loto166.score(sourceRecord,actual);
   if(!Number.isFinite(delta)){issues.push('Score indisponible '+r.target);continue}
   sumLossDiff+=delta;
   const e=Math.exp(Math.min(700,-sumLossDiff));maxE=Math.max(maxE,e);
   steps.push({date:r.target,delta,logE:-sumLossDiff,eValue:e,cumulativeScore:sumLossDiff});
 }
 return {checkedAt:new Date().toISOString(),...base,entries:records.length,verified:ok.length,rejected:bad.length,pending:pending.length,evaluable:evaluated.length,scored:steps.length,issues,steps,finalE:steps.length?steps[steps.length-1].eValue:1,maxE,provenance:'Historique local; archives déjà concordantes jusqu’au 11/11/2026 selon le contrôle antérieur, mais nouvelles lignes non authentifiées automatiquement. Horodatage non certifié.',limitations:'Les méthodes, paramètres et données historiques ont été explorés précédemment. Même un e-value élevé exigerait des prévisions vraiment antérieures aux tirages et une procédure figée indépendante.'};
}
function display(r){
 const stale=r.ageDays>4;let html=`<b>Base : ${r.count} tirages · dernier : ${safe(r.latest)}</b><p>${stale?'⚠ Historique ancien':'Date récente de l’historique'} : ${r.ageDays} jour(s) d'écart avec aujourd’hui (Paris). ${r.duplicates?'⚠ '+r.duplicates+' doublon(s)':'Aucun doublon' }.</p>`;
 html+=`<p>Journal prospectif : ${r.entries} entrée(s) · ${r.verified} empreinte(s) cohérente(s) · ${r.rejected} rejetée(s) · ${r.pending} en attente · ${r.evaluable} avec résultat local.</p>`;
 if(!r.scored)html+='<p><b>Aucune performance prospective mesurable.</b> Aucun chiffre ne doit être présenté comme une amélioration prédictive.</p>';
 else {html+=`<p><b>${r.scored} tirage(s) évalué(s).</b> Rapport cumulatif moteur / hasard : <strong>${fmt(r.finalE)}</strong>. Maximum observé : ${fmt(r.maxE)}.</p><p>${r.finalE>1?'Le score cumulatif favorise le modèle sur cet échantillon, sans preuve indépendante.':'Le score cumulatif ne favorise pas le modèle.'}</p>`;
 html+='<table class="tbl"><tr><th>Date</th><th>Δ perte</th><th>Rapport cumulé</th></tr>'+r.steps.slice(-15).map(s=>`<tr><td>${safe(s.date)}</td><td>${fmt(s.delta)}</td><td>${fmt(s.eValue)}</td></tr>`).join('')+'</table>'}
 if(r.rejected||r.issues.length)html+='<p>⚠ Anomalies : '+r.rejected+' enregistrement(s) rejeté(s); '+safe(r.issues.join('; '))+'</p>';
 html+='<p class="note">Le serveur FDJ n’est pas interrogé par ce contrôle. Un résultat local doit être vérifié contre FDJ. Aucune méthode gagnante démontrée. Ne pas augmenter les mises.</p>';
 $('v1610Output').className='status '+(stale||r.rejected?'warn':'good');$('v1610Output').innerHTML=html;
}
let last=null;
async function run(){let b=$('v1610Run');if(!b)return;b.disabled=true;$('v1610Output').textContent='Contrôle en cours…';try{last=await compute();display(last)}catch(e){$('v1610Output').className='status bad';$('v1610Output').textContent='Erreur : '+e.message}finally{b.disabled=false}}
function download(name,s,mime){let u=URL.createObjectURL(new Blob([s],{type:mime})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},2000)}
function exportJson(){if(!last){$('v1610Output').textContent='Lance le diagnostic avant de télécharger.';return}download('IA_LOTO_V16_10_CONTROLE.json',JSON.stringify(last,null,2),'application/json')}
function exportCsv(){if(!last){$('v1610Output').textContent='Lance le diagnostic avant de télécharger.';return}const lines=[['date','delta_logloss','log_rapport','rapport_cumulatif'],...last.steps.map(x=>[x.date,x.delta,x.logE,x.eValue])];download('IA_LOTO_V16_10_CONTROLE.csv','﻿'+lines.map(r=>r.join(';')).join('\r\n'),'text/csv;charset=utf-8')}
$('v1610Run')?.addEventListener('click',run);$('v1610Export')?.addEventListener('click',exportJson);$('v1610Csv')?.addEventListener('click',exportCsv);
window.Loto1610={snapshot,compute};
})();