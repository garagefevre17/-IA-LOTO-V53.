/* V16.12 — audit consolidé sans écriture des journaux ni de la base locale.
   Une concordance CSV ne certifie pas la provenance officielle du fichier ni l'heure des prévisions. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='ia_loto_v166_prospectif_v1';let current=null;
const toDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function diffDays(a,b){return Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000)}
function csv(what){const q=s=>'"'+String(s??'').replace(/"/g,'""')+'"';return '\ufeff'+what.map(r=>r.map(q).join(';')).join('\r\n')}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},1800)}
function constraints(){if(!window.Loto16?.draws||!window.Loto168?.audit||!window.Loto1611?.parseFDJ)throw Error('Modules V16 / V16.8 / V16.11 manquants');return window.Loto16.draws()}
async function summarize(text,filename){
 const local=constraints(), official=window.Loto1611.parseFDJ(text), comparison=window.Loto1611.compare(official,local), audits=await window.Loto168.audit();
 const byDate=new Map(comparison.matched.map(r=>[r[0],r]));
 const evaluations=[],excluded=[];let pending=0;
 for(const rec of audits.records){
  if(!rec.ok){excluded.push({date:rec.target,reasons:rec.error||['Intégrité non validée']});continue}
  const actual=byDate.get(rec.target);
  if(!actual){pending++;continue}
  const methods=[];
  for(const p of rec.methods||[]){
   if(!Array.isArray(p.nums)||p.nums.length!==5||!['cold','adaptive','uniform'].includes(p.name))continue;
   const hits=p.nums.filter(n=>actual.slice(1,6).includes(n)).length;
   methods.push({name:p.name,main:hits,chance:+(p.chance===actual[6])})
  }
  if(methods.length!==3){excluded.push({date:rec.target,reasons:['Méthodes incomplètes ou absentes du journal']});continue}
  evaluations.push({date:rec.target,methods});
 }
 const totals={};for(const e of evaluations)for(const m of e.methods){const v=totals[m.name]??={n:0,main:0,chance:0};v.n++;v.main+=m.main;v.chance+=m.chance}
 const latest=local.at(-1)?.[0]||'',today=toDate();
 return {checkedAt:new Date().toISOString(),filename,localCount:local.length,localLatest:latest,localDaysOld:diffDays(today,latest),csvUnique:official.rows.length,csvLatest:official.rows.at(-1)?.[0]||'',matches:comparison.matched.length,conflicts:comparison.conflicts,missingLocally:comparison.missingLocally.length,invalid:official.errors,duplicateCsv:official.duplicates.length,records:audits.records.length,integrityOk:audits.records.filter(x=>x.ok).length,rejected:excluded,pending,evaluations,totals,origin:'CSV choisi localement par l’utilisateur, provenance non authentifiée',timestampCaveat:'Hash SHA-256 local sans horodatage par tiers. Les dates de création ne sont pas certifiées.',note:'Aucun gain de probabilité de jackpot démontré.'}
}
function render(r){
 const stale=r.localDaysOld>4, bad=r.invalid.length+r.conflicts.length;
 let html=`<b>Historique local : ${r.localCount} tirages · dernier ${esc(r.localLatest)}</b><p>${stale?'⚠ Base possiblement périmée':'Base récente selon la date locale'} (${r.localDaysOld} jour(s) d’écart). CSV importé : ${r.csvUnique} dates uniques, dernière ${esc(r.csvLatest)}.</p>`;
 html+=`<p><b>${r.matches} concordances</b> · ${r.conflicts.length} contradictions · ${r.missingLocally} dates absentes du logiciel · ${r.invalid.length} lignes invalides · ${r.duplicateCsv} doublons identiques.</p>`;
 html+=`<p>Journal prospectif : ${r.records} enregistrement(s) · ${r.integrityOk} cohérent(s) · ${r.rejected.length} rejeté(s) · ${r.pending} en attente · <b>${r.evaluations.length} évalué(s) sur dates concordantes</b>.</p>`;
 if(r.conflicts.length)html+='<p>⚠ Dates contradictoires (aucune écriture locale) : '+r.conflicts.slice(0,8).map(x=>esc(x.date)).join(', ')+'</p>';
 if(r.invalid.length)html+='<p>⚠ Exemples de lignes CSV invalides : '+r.invalid.slice(0,5).map(x=>esc(x.ligne)).join(', ')+'</p>';
 html+='<p class="note">L’import est en lecture seule. Un CSV téléchargé ou fourni ne possède pas de signature FDJ vérifiée. Une empreinte locale ne certifie pas l’heure d’une prévision.</p>';
 const out=$('v1612Status');out.className='status '+(bad?'warn':'good');out.innerHTML=html;
 let t=`<b>${r.evaluations.length} tirages vérifiables dans ce CSV</b>`;
 if(Object.keys(r.totals).length){t+='<table class="tbl"><tr><th>Méthode</th><th>Bons numéros</th><th>Chance</th></tr>';
 for(const [name,v] of Object.entries(r.totals))t+=`<tr><td>${esc(name)} (${v.n})</td><td>${v.main} / ${(v.n*25/49).toFixed(2)} attendus</td><td>${v.chance} / ${(v.n/10).toFixed(2)} attendus</td></tr>`;
 t+='</table>'}else t+='<p>Aucune prévision valide ne correspond à une date présente ET concordante dans le CSV importé.</p>';
 t+='<p class="note">Les attentes théoriques ne démontrent pas de supériorité prédictive. Les anciennes prédictions V6 ne sont pas mélangées aux protocoles V16.6.</p>';
 $('v1612Performance').innerHTML=t;
 $('v1612Json').disabled=false;$('v1612Csv').disabled=false;
}
async function loadFile(file){if(!file)throw Error('Aucun CSV choisi');if(file.size>15*1024*1024)throw Error('CSV supérieur à 15 Mo');return summarize(await file.text(),file.name)}
$('v1612Import')?.addEventListener('change',async e=>{const f=e.target.files?.[0],button=e.target;button.disabled=true;$('v1612Status').textContent='Analyse des archives et empreintes…';try{current=await loadFile(f);render(current)}catch(err){current=null;$('v1612Status').className='status bad';$('v1612Status').textContent='Contrôle impossible : '+err.message;$('v1612Performance').textContent='Aucun bilan validé.';$('v1612Json').disabled=true;$('v1612Csv').disabled=true}finally{button.disabled=false;button.value=''}});
$('v1612Json')?.addEventListener('click',()=>{if(current)download('IA_LOTO_V16_12_RAPPORT.json',JSON.stringify(current,null,2),'application/json')});
$('v1612Csv')?.addEventListener('click',()=>{if(!current)return;const rows=[['date','methode','bons_principaux','chance_correcte']];for(const e of current.evaluations)for(const m of e.methods)rows.push([e.date,m.name,m.main,m.chance]);download('IA_LOTO_V16_12_EVALUATIONS.csv',csv(rows),'text/csv;charset=utf-8')});
window.Loto1612={summarize,loadFile};
})();