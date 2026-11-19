/* IA LOTO V16.15 - Validation chronologique de nouveaux résultats importés.
   Ne change ni les archives embarquées ni les anciens journaux.
   Les résultats d'un CSV transmis ne sont pas authentifiés par cryptographie FDJ.
*/
(()=>{'use strict';
const $=id=>document.getElementById(id);
const baseEngine=()=>window.Loto16;
const pad=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let lastReport=null;
function nextRegular(d){const t=new Date(d+'T12:00:00Z');do{t.setUTCDate(t.getUTCDate()+1)}while(![1,3,6].includes(t.getUTCDay()));return t.toISOString().slice(0,10)}
function gaps(start,dates){const all=new Set(dates);if(!dates.length)return [];const missing=[];let p=start;let safe=0;while((p=nextRegular(p))<=dates.at(-1) && safe++<5000){if(!all.has(p))missing.push(p)}return missing;}
function hits(pick,result){return {main:pick.numbers.filter(n=>result.slice(1,6).includes(n)).length,chance:Number(pick.chance===result[6])};}
function runRows(local,newer,opts={}){
 if(!local?.length || local.length<300)throw Error('Historique de départ insuffisant');
 if(!newer?.length)throw Error('Aucun nouveau tirage à évaluer.');
 const limit=opts.maxDraws||60;
 if(newer.length>limit)throw Error(`Trop de dates nouvelles (${newer.length}). Maximum ${limit} pour un contrôle sur iPhone. Importer d’abord une archive récente plus courte.`);
 const ordered=[...newer].sort((a,b)=>a[0].localeCompare(b[0]));
 const missing=gaps(local.at(-1)[0],ordered.map(r=>r[0]));
 if(missing.length)throw Error(`Série incomplète : ${missing.length} date(s) ordinaires manquantes entre la base et les nouveaux résultats. Première date : ${missing[0]}. Vérifier les tirages spéciaux et compléter l’archive avant le test.`);
 let history=local.slice(),records=[];
 for(const actual of ordered){
   if(actual[0]<=history.at(-1)[0])throw Error('Dates non strictement croissantes');
   const cold=window.Loto1614.cold(history);
   const weights=window.Loto166.weightsAtCutoff(history);
   const adaptive=window.Loto166.adaptivePick(history,weights);
   const predictions={cold:{numbers:cold.numbers,chance:cold.chance},adaptive:{numbers:adaptive.numbers,chance:adaptive.chance}};
   // Calculer AVANT d'intégrer actual dans l'historique
   records.push({date:actual[0],cutoff:history.at(-1)[0],results:{cold:hits(predictions.cold,actual),adaptive:hits(predictions.adaptive,actual)},predictions,uniformMainExpected:25/49,uniformChanceExpected:0.1,uniformJackpotProbability:1/19068840});
   history.push(actual);
 }
 const totals={};for(const key of ['cold','adaptive']){const x=records.map(r=>r.results[key]);totals[key]={draws:x.length,main:x.reduce((s,r)=>s+r.main,0),chance:x.reduce((s,r)=>s+r.chance,0),jackpots:x.filter(r=>r.main===5&&r.chance===1).length};}
 return {rows:records,totals,reference:{main:records.length*25/49,chance:records.length/10,jackpots:records.length/19068840},baseUntil:local.at(-1)[0],latest:ordered.at(-1)[0],warning:'Analyse chronologique, historique déjà potentiellement étudié. Aucune supériorité démontrée. Les références théoriques sont des espérances, pas des prédictions.'};
}
function inspectCSV(text,source){
 const local=baseEngine().draws();
 const parsed=window.Loto1611.parseFDJ(text);
 const checked=window.Loto1614.verifyDraws(parsed,local);
 if(!checked.newer.length)throw Error('Ce CSV ne contient aucun tirage nouveau après '+local.at(-1)[0]);
 const result=runRows(local,checked.newer);
 return {...result,source,verifiedOverlap:checked.matched,newCount:checked.newer.length,sourceStatus:'CSV fourni par utilisateur ; provenance non certifiée cryptographiquement'};
}
function render(report){
 $('v1615Status').className='status good';
 $('v1615Status').textContent=`${report.verifiedOverlap} concordances avec la base, ${report.newCount} nouveaux tirages contrôlés. Évaluation chronologique : ${report.baseUntil} → ${report.latest}.`;
 const fmt=n=>n.toFixed(2).replace('.',',');
 $('v1615Result').innerHTML=`<h3>Comparaison sur ${report.rows.length} tirages nouveaux</h3><table class="tbl"><tr><th>Méthode</th><th>Principaux</th><th>Chance</th></tr><tr><td>Froids 300</td><td>${report.totals.cold.main}</td><td>${report.totals.cold.chance}</td></tr><tr><td>Adaptatif</td><td>${report.totals.adaptive.main}</td><td>${report.totals.adaptive.chance}</td></tr><tr><td>Hasard (espérance)</td><td>${fmt(report.reference.main)}</td><td>${fmt(report.reference.chance)}</td></tr></table><p><b>Dernier tirage évalué :</b> ${pad(report.latest)}</p><p class="note">Les sélections ont été recalculées avant l'ajout de chaque résultat. Ce test est chronologique, mais n'atteste pas que les prévisions ont été enregistrées avant les tirages. Ces écarts ne démontrent pas une capacité de prédiction.</p>`;
 $('v1615Export').disabled=false;
}
function save(name,body,type){const blob=new Blob([body],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},1500);}
$('v1615Run')?.addEventListener('click',async()=>{
 const file=$('v1615File')?.files?.[0];$('v1615Run').disabled=true;$('v1615Status').textContent='Calcul chronologique en cours…';
 try{if(!file)throw Error('Sélectionne un CSV FDJ');if(file.size>15*1024*1024)throw Error('CSV trop volumineux');if(!$('v1615Confirm').checked)throw Error('Confirme la provenance du fichier');lastReport=inspectCSV(await file.text(),file.name);render(lastReport)}
 catch(e){lastReport=null;$('v1615Status').className='status bad';$('v1615Status').textContent='Contrôle interrompu : '+e.message;$('v1615Result').textContent='Aucun résultat comptabilisé.';$('v1615Export').disabled=true}finally{$('v1615Run').disabled=false}
});
$('v1615Export')?.addEventListener('click',()=>{if(lastReport)save('IA_LOTO_V16_15_BILAN_CHRONOLOGIQUE.json',JSON.stringify(lastReport,null,2),'application/json')});
window.Loto1615={nextRegular,gaps,hits,runRows,inspectCSV};
})();
