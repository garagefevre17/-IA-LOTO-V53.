/* V16.3 : mélange bayésien adaptatif de vraisemblances 5+Chance.
   Strictement séquentiel: mise à jour après observation, pas avant. */
(()=>{'use strict';
const el=id=>document.getElementById(id),M=window.Loto16,KEY='ia_loto_expert_v1_log';
const clean=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number(x).toFixed(6).replace('.',',');
function softmax(logw){let m=Math.max(...logw),a=logw.map(x=>Math.exp(x-m)),s=a.reduce((u,v)=>u+v,0);return a.map(x=>x/s)}
function train(N){
 if(!M)throw Error('Le moteur V16 est indisponible');
 const rows=M.draws(),end=rows.length,start=end-N;
 if(start<300)throw Error('Pas assez de données');
 const configs=M.CANDIDATES;
 let logw=[Math.log(.8),...configs.map(()=>Math.log(.2/configs.length))],errors=[],weights=[];
 for(let i=start;i<end;i++){
  const hist=rows.slice(i-300,i),r=rows[i],w=softmax(logw);
  const lp=[-M.LOG_UNIFORM,...configs.map(cfg=>M.logProb(M.make(hist,cfg.type,cfg.beta),r))];
  // Log-sum-exp exact pour le mélange de distributions conjointes normalisées.
  const shifted=lp.map((x,j)=>Math.log(w[j])+x),mx=Math.max(...shifted);
  const mix=mx+Math.log(shifted.reduce((s,x)=>s+Math.exp(x-mx),0));
  errors.push(-mix-M.LOG_UNIFORM);
  // Bayes : probabilité postérieure de chaque expert après le résultat observé.
  logw=logw.map((a,j)=>a+lp[j]);
  const m=Math.max(...logw);logw=logw.map(x=>x-m);
  weights.push(w[0]);
 }
 const mean=errors.reduce((a,b)=>a+b,0)/N,after=softmax(logw);
 // blocs descriptifs par quart, sans fausse p-value.
 const parts=[0,1,2,3].map(j=>{const z=errors.slice(Math.floor(j*N/4),Math.floor((j+1)*N/4));return z.reduce((a,b)=>a+b,0)/z.length});
 return {n:N,from:rows[start][0],to:rows[end-1][0],mean,uniformWeight:after[0],quarters:parts,weights:after,errors};
}
let last=null;
function run(){const out=el('v163Out');out.textContent='Calcul chronologique en cours…';setTimeout(()=>{
 try{last=train(Number(el('v163N').value));const d=last.mean;
 out.className='status '+(d<0?'warn':'good');out.innerHTML=`<b>${last.n} tirages (${last.from} au ${last.to})</b><p>Perte de la référence équitable : <b>${fmt(M.LOG_UNIFORM)}</b><br>Perte du mélange adaptatif : <b>${fmt(M.LOG_UNIFORM+d)}</b><br>Écart mélange − hasard (négatif = mieux) : <b>${d>=0?'+':''}${fmt(d)}</b></p><p>Poids final du modèle équitable : <b>${(last.uniformWeight*100).toFixed(2)} %</b></p><p>Écarts par quart : ${last.quarters.map(fmt).join(' ; ')}</p><p><b>${d<0?'Écart historique favorable, non validé prospectivement.':'Aucune amélioration historique du score face au hasard.'}</b></p><small>La pondération change après chaque résultat. Le score ne garantit pas les prochains numéros.</small>`;
 }catch(e){out.className='status bad';out.textContent='Erreur : '+e.message}
},20)}
function journal(){const rows=M.draws(),mp=new Map(rows.map(r=>[r[0],r]));let records=[];
 try{records=JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){throw Error('Journal local invalide')}
 if(!Array.isArray(records))throw Error('Journal invalide');
 let known=[],waiting=0,invalid=0;
 for(const r of records){const actual=mp.get(r.target);if(!actual){waiting++;continue}
  if(!Array.isArray(r.numbers)||r.numbers.length!==5||!r.numbers.every(x=>Number.isInteger(x)&&x>=1&&x<=49)||!Number.isInteger(r.chance)||!r.cutoff||r.cutoff>=r.target){invalid++;continue}
  const hits=r.numbers.filter(n=>actual.slice(1,6).includes(n)).length;
  known.push({date:r.target,method:r.method||'?',hits,chance:+(r.chance===actual[6]),cutoff:r.cutoff})
 }
 const total=known.reduce((s,r)=>s+r.hits,0),c=known.reduce((s,r)=>s+r.chance,0);
 const report={known,waiting,invalid,total,c,count:records.length};
 const output=el('v163JournalOut');output.className='status';
 output.innerHTML=`<b>${records.length} prévision(s) enregistrée(s)</b><p>${known.length} évaluable(s) ; ${waiting} en attente ; ${invalid} non évaluable(s).</p><p>${known.length?`${total} numéros principaux trouvés (référence moyenne : ${(known.length*25/49).toFixed(2)}) ; ${c} Chance correct(s) (référence : ${(known.length/10).toFixed(2)}).`:'Aucun tirage encore évaluable. Aucun score de réussite n’est calculé.'}</p><small>Horodatage local non certifié ; prévisions corrélées et sélection de modèles après exploration historique. Résultat descriptif uniquement.</small>`;
 return report;
}
function exportCsv(){try{let r=journal();const lines=['date;methode;historique_limite;bons_principaux;chance_correct',...r.known.map(x=>[x.date,x.method,x.cutoff,x.hits,x.chance].join(';'))];const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='IA_LOTO_V16_3_journal_evalue.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}catch(e){el('v163JournalOut').textContent='Erreur : '+e.message}}
el('v163Run')?.addEventListener('click',run);el('v163Journal')?.addEventListener('click',()=>{try{journal()}catch(e){el('v163JournalOut').textContent='Erreur : '+e.message}});el('v163Export')?.addEventListener('click',exportCsv);
window.Loto163={train,journal};
})();
