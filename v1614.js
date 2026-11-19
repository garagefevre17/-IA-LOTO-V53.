/* IA LOTO V16.14 — moteur utilisant les tirages nouveaux admis d'un CSV comparé à la base. 
   Aucune écriture dans la base existante, les modèles gelés ou les journaux historiques.
   La confirmation humaine du CSV ne certifie pas son authenticité FDJ.
*/
(()=>{'use strict';
const $=id=>document.getElementById(id), M=window.Loto16;
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current=null;
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function nextDraw(d){let t=new Date(d+'T12:00:00Z');do{t.setUTCDate(t.getUTCDate()+1)}while(![1,3,6].includes(t.getUTCDay()));return t.toISOString().slice(0,10)}
function verifyDraws(data,local){
 if(!data || !Array.isArray(data.rows)||!local?.length)throw Error('Données insuffisantes');
 const report=window.Loto1611.compare(data,local);
 if(data.errors?.length || report.conflicts.length)throw Error(`CSV refusé : ${data.errors.length} ligne(s) invalide(s), ${report.conflicts.length} contradiction(s) avec la base.`);
 const last=local.at(-1)[0],newer=report.missingLocally.filter(r=>r[0]>last),prior=report.missingLocally.filter(r=>r[0]<=last);
 if(prior.length)throw Error(`${prior.length} date(s) anciennes absentes de la base : vérification manuelle nécessaire.`);
 // Vérifier que les dates nouvelles correspondent exactement au calendrier LOTO
 // (lundi/mercredi/samedi). Autres jeux, tirages exceptionnels : revue séparée.
 for(const r of newer){if(![1,3,6].includes(new Date(r[0]+'T12:00:00Z').getUTCDay()))throw Error(`Date inhabituelle ${r[0]} : tirage spécial à traiter séparément.`)}
 const merged=[...local,...newer].sort((a,b)=>a[0].localeCompare(b[0]));
 const unique=new Set(merged.map(r=>r[0]));if(unique.size!==merged.length)throw Error('Dates dupliquées après fusion');
 return {rows:merged,newer,matched:report.matched.length,duplicates:data.duplicates.length};
}
function cold(rows){if(rows.length<300)throw Error('Moins de 300 tirages.');const a=Array(50).fill(0),c=Array(11).fill(0);
 for(const r of rows.slice(-300)){for(const n of r.slice(1,6))a[n]++;c[r[6]]++}
 const numbers=Array.from({length:49},(_,i)=>i+1).sort((x,y)=>a[x]-a[y]||x-y).slice(0,5).sort((x,y)=>x-y);
 const chance=Array.from({length:10},(_,i)=>i+1).sort((x,y)=>c[x]-c[y]||x-y)[0];
 return {numbers,chance,frequencies:numbers.map(n=>a[n]),chanceCount:c[chance]};
}
function adaptive(rows){if(!window.Loto166?.weightsAtCutoff||!window.Loto166?.adaptivePick)throw Error('Moteur V16.6 indisponible');
 const w=window.Loto166.weightsAtCutoff(rows);return {pick:window.Loto166.adaptivePick(rows,w),uniformWeight:w[0]};}
function download(name,contents){const blob=new Blob([contents],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},1500)}
async function digest(rows){const data=new TextEncoder().encode(JSON.stringify(rows));const b=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,'0')).join('')}
async function calculate(text,sourceName){
 if(!window.Loto1611?.parseFDJ||!M?.draws)throw Error('Dépendances V16 ou V16.11 absentes');
 const data=window.Loto1611.parseFDJ(text),local=M.draws(),verified=verifyDraws(data,local),rows=verified.rows;
 const latest=rows.at(-1)[0],target=nextDraw(latest),today=localDate();
 const a=cold(rows),b=adaptive(rows),hash=await digest(rows);
 return {version:'16.14',sourceName,sourceStatement:'CSV choisi par utilisateur, origine non authentifiée cryptographiquement',baseUntil:local.at(-1)[0],latest,proposedTarget:target,localToday:today,outdated:target<today,matched:verified.matched,newResults:verified.newer.length,duplicates:verified.duplicates,rowsCount:rows.length,hash,cold:a,adaptive:b,warning:'Sélections expérimentales seulement. Aucune preuve de supériorité au hasard. Cette prévisualisation n’est pas un journal horodaté indépendant.'};
}
function show(r){const status=$('v1614Status'),out=$('v1614Results');status.className='status '+(r.outdated?'warn':'good');
 status.textContent=`${r.matched} dates du CSV concordantes avec la base, ${r.newResults} nouvelle(s) date(s) admise(s). Base : ${r.baseUntil} → historique utilisé : ${r.latest} (${r.rowsCount} tirages). ${r.outdated?'ATTENTION : historique toujours périmé ; ne pas enregistrer pour un tirage futur.':'Historique à contrôler avant tout enregistrement.'}`;
 out.innerHTML=`<h3>Prévisualisation calculée sur les données jusqu’au ${esc(r.latest)}</h3><p>Prochaine date théorique d’après l’historique : <b>${esc(r.proposedTarget)}</b></p><p><b>Froids 300 (règles inchangées)</b> : ${r.cold.numbers.join(' · ')} — Chance ${r.cold.chance}</p><p><b>Adaptatif V16.6</b> : ${r.adaptive.pick.numbers.join(' · ')} — Chance ${r.adaptive.pick.chance}</p><p>Poids du modèle équitable dans l'adaptatif : ${(100*r.adaptive.uniformWeight).toFixed(2)} %</p><p class="note">Empreinte SHA-256 de l’historique fusionné : <code>${esc(r.hash)}</code></p><p class="note">Pas de garantie de numéros gagnants. Aucune écriture dans les archives ou journaux ; export JSON facultatif.</p>`;
 $('v1614Export').disabled=false;
}
$('v1614Run')?.addEventListener('click',async()=>{const button=$('v1614Run'),file=$('v1614File')?.files?.[0];button.disabled=true;$('v1614Status').textContent='Comparaison et recalcul…';
 try{if(!file)throw Error('Sélectionne un CSV FDJ');if(file.size>15*1024*1024)throw Error('Fichier supérieur à 15 Mo');if(!$('v1614Confirm')?.checked)throw Error('Confirme avoir vérifié la source du CSV');current=await calculate(await file.text(),file.name);show(current)}
 catch(e){current=null;$('v1614Status').className='status bad';$('v1614Status').textContent=e.message;$('v1614Results').textContent='Aucune sélection calculée.';$('v1614Export').disabled=true}finally{button.disabled=false}});
$('v1614Export')?.addEventListener('click',()=>{if(current)download('IA_LOTO_V16_14_SELECTION_EXPERIMENTALE.json',JSON.stringify(current,null,2))});
window.Loto1614={verifyDraws,cold,calculate,nextDraw};
})();
