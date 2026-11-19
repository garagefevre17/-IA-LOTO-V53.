/* V16.11 — read-only comparison with an explicitly supplied FDJ CSV.
   This module never changes the draw database, stored forecasts or source files.
   It cannot cryptographically attest the provenance of a CSV uploaded by a user.
*/
(()=>{'use strict';
const $=id=>document.getElementById(id), esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const FORECAST_KEY='ia_loto_v166_prospectif_v1';
function parseLine(line,sep){let out=[],v='',quote=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quote&&line[i+1]==='"'){v+='"';i++}else quote=!quote}else if(c===sep&&!quote){out.push(v);v=''}else v+=c;}out.push(v);return out;}
function normDate(s){s=String(s??'').trim();if(/^\d{4}-\d\d-\d\d$/.test(s))return s;const m=s.match(/^(\d\d)[\/.-](\d\d)[\/.-](\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;}
function validDate(s){if(!/^\d{4}-\d\d-\d\d$/.test(s||''))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;}
function validDraw(row){return validDate(row[0])&&row.length===7&&row.slice(1,6).every(n=>Number.isInteger(n)&&n>=1&&n<=49)&&new Set(row.slice(1,6)).size===5&&Number.isInteger(row[6])&&row[6]>=1&&row[6]<=10;}
function parseFDJ(text){
 const lines=String(text).replace(/^\ufeff/,'').split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)throw Error('Fichier CSV vide');
 const sep=(lines[0].match(/;/g)||[]).length>=(lines[0].match(/,/g)||[]).length?';':',';
 const cols=parseLine(lines[0],sep).map(x=>x.trim().toLowerCase().replace(/^\ufeff/,''));
 const get=(...names)=>names.map(n=>cols.indexOf(n)).find(n=>n>=0);
 const at=[get('date_de_tirage','date'),...[1,2,3,4,5].map(i=>get('boule_'+i,'n'+i)),get('numero_chance','b1','chance')];
 if(at.some(x=>x===undefined))throw Error('Colonnes FDJ absentes. Attendu : date_de_tirage, boule_1…boule_5 et numero_chance');
 const rows=new Map(),errors=[],duplicates=[];let parsed=0;
 for(let i=1;i<lines.length;i++){
   const cells=parseLine(lines[i],sep), date=normDate(cells[at[0]]),numbers=at.slice(1).map(j=>Number(String(cells[j]??'').trim()));
   const row=[date,...numbers];if(!validDraw(row)){errors.push({ligne:i+1,raison:'Date ou combinaison invalide'});continue;}
   row.splice(1,5,...row.slice(1,6).sort((a,b)=>a-b));
   parsed++;const before=rows.get(date);if(before){if(before.slice(1).join(',')!==row.slice(1).join(','))errors.push({ligne:i+1,raison:'Dates dupliquées et contradictoires : '+date});else duplicates.push(date);continue;}
   rows.set(date,row);
 }
 if(!rows.size)throw Error('Aucun tirage valide dans le CSV');
 return {rows:[...rows.values()].sort((a,b)=>a[0].localeCompare(b[0])),parsed,errors,duplicates};
}
function compare(official,local){
 const byDate=new Map(local.map(r=>[r[0],[r[0],...r.slice(1,6).sort((a,b)=>a-b),r[6]]]));let agreed=[],conflicts=[],absent=[];
 for(const r of official.rows){const saved=byDate.get(r[0]);if(!saved){absent.push(r);continue;}if(saved.slice(1).join(',')===r.slice(1).join(','))agreed.push(r);else conflicts.push({date:r[0],local:saved,fdj:r});}
 return {matched:agreed,conflicts,missingLocally:absent};
}
function scoreDates(matched,auditRecords){
 const m=new Map(matched.map(r=>[r[0],r]));const totals={},details=[];let rejected=0,waiting=0;
 for(const entry of auditRecords){if(!entry.ok){rejected++;continue;}const actual=m.get(entry.target);if(!actual){waiting++;continue;}
 const results=[];for(const p of entry.methods||[]){const picks=Array.isArray(p.nums)?p.nums:p.numbers;
 if(!Array.isArray(picks)||picks.length!==5||!picks.every(n=>Number.isInteger(n)&&n>=1&&n<=49))continue;
 const name=typeof p.name==='string'?p.name:p.key;
 if(!['cold','adaptive','uniform'].includes(name))continue;
 const hit=picks.filter(n=>actual.slice(1,6).includes(n)).length;const ch=+(p.chance===actual[6]);
 const t=totals[name]??={dates:0,main:0,chance:0};t.dates++;t.main+=hit;t.chance+=ch;results.push({method:name,main:hit,chance:ch})}details.push({date:entry.target,results});
 }
 return {totals,details,rejected,waiting};
}
let last=null;
function report(result){
 const o=$('v1611Output'),s=$('v1611Score'),{official,comparison,score}=result;
 const issues=official.errors.length+comparison.conflicts.length;
 let html=`<b>${official.rows.length} dates uniques lues · ${comparison.matched.length} concordantes avec la base locale</b><p>${comparison.conflicts.length} contradiction(s) · ${comparison.missingLocally.length} date(s) absente(s) du logiciel · ${official.errors.length} ligne(s) invalide(s) · ${official.duplicates.length} doublon(s) identique(s).</p>`;
 if(comparison.conflicts.length)html+='<h3>Contradictions : aucune donnée n’a été écrasée</h3>'+comparison.conflicts.slice(0,15).map(x=>`<p>⚠ ${esc(x.date)} : local [${x.local.slice(1).join(', ')}] ; CSV [${x.fdj.slice(1).join(', ')}]</p>`).join('');
 if(comparison.missingLocally.length)html+=`<p>Dernière date du fichier non présente localement : ${esc(comparison.missingLocally.at(-1)[0])}. Utilise l’import CSV de l’onglet Données après vérification de la provenance.</p>`;
 html+='<p class="note">Ceci est une concordance avec un CSV fourni par l’utilisateur, pas une authentification numérique FDJ. Les autres dates du logiciel ne sont pas certifiées par cet import.</p>';
 o.className='status '+(issues?'warn':'good');o.innerHTML=html;
 const rows=Object.entries(score.totals);let block=`<b>${score.details.length} tirage(s) de prévisions valides avec un résultat concordant dans le CSV choisi.</b><p>${score.waiting} prévision(s) sans date certifiée par ce fichier ; ${score.rejected} rejetée(s) pour intégrité ou structure.</p>`;
 if(rows.length)block+='<table class="tbl"><tr><th>Méthode</th><th>Numéros corrects</th><th>Chance</th></tr>'+rows.map(([k,v])=>`<tr><td>${esc(k)} (${v.dates} tirages)</td><td>${v.main} / ${(v.dates*25/49).toFixed(2)} attendus</td><td>${v.chance} / ${(v.dates/10).toFixed(2)} attendus</td></tr>`).join('')+'</table>';
 else block+='<p>Aucun bilan possible : il manque des prévisions intègres portant sur les dates présentes dans le fichier.</p>';
 block+='<p class="note">Les empreintes locales ne prouvent pas que les prévisions existaient avant les tirages. Les nombres attendus ne sont pas des objectifs de réussite.</p>';
 s.innerHTML=block;
}
async function verifyFile(file){if(!file)throw Error('Aucun fichier sélectionné');if(file.size>15*1024*1024)throw Error('Fichier trop volumineux (> 15 Mo)');
 const official=parseFDJ(await file.text());const local=window.Loto16.draws();const comparison=compare(official,local);
 const aud=window.Loto168?await window.Loto168.audit():{records:[]};const score=scoreDates(comparison.matched,aud.records);
 return {fileName:file.name,checkedAt:new Date().toISOString(),official,comparison,score};}
function download(name,contents,type){const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},1500);}
function exported(){if(!last)return null;const x=last;return {fileName:x.fileName,checkedAt:x.checkedAt,sourceClaim:'CSV fourni par l’utilisateur (non authentifié)',csvCount:x.official.rows.length,matchedCount:x.comparison.matched.length,invalidRows:x.official.errors,identicalDuplicates:x.official.duplicates,conflicts:x.comparison.conflicts,missingLocally:x.comparison.missingLocally,forecastEvaluation:x.score};}
$('v1611File')?.addEventListener('change',async e=>{const b=e.currentTarget;b.disabled=true;$('v1611Output').textContent='Lecture et audit du fichier…';try{last=await verifyFile(b.files?.[0]);report(last);$('v1611Export').disabled=false;$('v1611ExportCsv').disabled=false;}catch(err){last=null;$('v1611Output').className='status bad';$('v1611Output').textContent='Import refusé : '+err.message;$('v1611Score').textContent='Aucun résultat évalué.';$('v1611Export').disabled=true;$('v1611ExportCsv').disabled=true;}finally{b.value='';b.disabled=false;}});
$('v1611Export')?.addEventListener('click',()=>{if(last)download('IA_LOTO_V16_11_RAPPORT.json',JSON.stringify(exported(),null,2),'application/json')});
$('v1611ExportCsv')?.addEventListener('click',()=>{if(!last)return;const head='type;date;details';const entries=[...last.comparison.conflicts.map(c=>['contradiction',c.date,'Local: '+c.local.slice(1).join('-')+' | CSV: '+c.fdj.slice(1).join('-')]),...last.comparison.missingLocally.map(r=>['absent_local',r[0],r.slice(1).join('-')])];download('IA_LOTO_V16_11_ECARTS.csv','\ufeff'+[head,...entries.map(r=>r.map(s=>'"'+String(s).replace(/"/g,'""')+'"').join(';'))].join('\r\n'),'text/csv;charset=utf-8')});
window.Loto1611={parseFDJ,compare,scoreDates,verifyFile};
})();
