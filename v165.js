/* IA LOTO V16.5 — comparaison honnête des poids réinitialisés ou transmis.
   Les dates du contrôle restent exclues de la sélection des hyperparamètres.
   Calcul expérimental : aucune capacité de prédiction du jackpot démontrée. */
(()=>{'use strict';
 const $=id=>document.getElementById(id), M=window.Loto16;
 const C=[{name:'Hasard uniforme',prior:1,eta:0}];
 for(const prior of [.5,.8,.95]) for(const eta of [.1,.3,1]) C.push({name:`Mélange ${Math.round(prior*100)} % équitable, vitesse ${eta}`,prior,eta});
 const F=x=>(x>=0?'+':'')+x.toFixed(6).replace('.',',');
 const mean=x=>x.reduce((a,b)=>a+b,0)/x.length;
 function normalize(logw){let mx=Math.max(...logw),a=logw.map(x=>Math.exp(x-mx)),s=a.reduce((x,y)=>x+y,0);return a.map(x=>x/s)}
 function init(c){const q=M.CANDIDATES.length;return c.eta===0?[0,...Array(q).fill(-Infinity)]:[Math.log(c.prior),...Array(q).fill(Math.log((1-c.prior)/q))]}
 // Périmètre strict : la ligne i est inconnue jusqu'à sa prédiction.
 function observations(rows,start,end){let out=[];for(let i=start;i<end;i++){
   const h=rows.slice(i-300,i),r=rows[i];
   out.push([0,...M.CANDIDATES.map(c=>-M.logProb(M.make(h,c.type,c.beta),r)-M.LOG_UNIFORM)]);
 }return out}
 function evolve(obs,c,startWeights){if(c.eta===0)return {gaps:obs.map(()=>0),logw:init(c),weight:1};
   let l=startWeights?startWeights.slice():init(c),gaps=[];
   for(const loss of obs){
     const w=normalize(l),terms=w.map((p,j)=>Math.log(p)-loss[j]),mx=Math.max(...terms);
     gaps.push(-(mx+Math.log(terms.reduce((s,x)=>s+Math.exp(x-mx),0))));
     l=l.map((x,j)=>x-c.eta*loss[j]);const m=Math.max(...l);l=l.map(x=>x-m);
   }return {gaps,logw:l,weight:normalize(l)[0]};
 }
 function calculate(devN=400,holdN=400){if(!M)throw Error('Moteur V16 absent');
   const rows=M.draws(),end=rows.length,start=end-devN-holdN;
   if(start<300)throw Error('Historique trop court pour la période choisie');
   const training=observations(rows,start,end-holdN),test=observations(rows,end-holdN,end);
   const ranking=C.map((cfg,id)=>({id,avg:mean(evolve(training,cfg).gaps)})).sort((a,b)=>a.avg-b.avg || a.id-b.id);
   // N'accepter une configuration non uniforme que si son score dépasse la référence sur le développement.
   const experimental=ranking.find(item=>item.id!==0);const chosen=C[experimental.id];const safeReference=experimental.avg>=-1e-9;
   const trained=evolve(training,chosen);
   const reset=evolve(test,chosen),continuous=evolve(test,chosen,trained.logw);
   const paired=continuous.gaps.map((v,i)=>v-reset.gaps[i]);
   const ciReset=M.ciBlock(reset.gaps,600),ciCont=M.ciBlock(continuous.gaps,600),ciPaired=M.ciBlock(paired,600);
   return {chosen,safeReference,rankings:ranking,development:mean(trained.gaps),reset:mean(reset.gaps),continuous:mean(continuous.gaps),difference:mean(paired),ciReset,ciCont,ciPaired,weights:{dev:trained.weight,reset:reset.weight,continuous:continuous.weight},dates:{devStart:rows[start][0],devEnd:rows[end-holdN-1][0],holdStart:rows[end-holdN][0],holdEnd:rows[end-1][0]},devN,holdN,holdGapsReset:reset.gaps,holdGapsCont:continuous.gaps,sourceN:rows.length};
 }
 let last=null;
 function show(){const o=$('v165Out');o.className='status';o.textContent='Évaluation chronologique en cours…';setTimeout(()=>{
   try{last=calculate(+$('v165Dev').value,+$('v165Hold').value);const r=last;
   const fmtCI=a=>`[${F(a[0])} ; ${F(a[1])}]`;
   o.className='status '+(r.continuous<0?'warn':'good');
   o.innerHTML=`<b>${r.sourceN} tirages disponibles, dernières archives : ${r.dates.holdEnd}</b><p><b>Développement :</b> ${r.devN} tirages (${r.dates.devStart} → ${r.dates.devEnd}). 10 configurations évaluées.<br><b>Meilleure configuration expérimentale (sans voir le contrôle) :</b> ${r.chosen.name}.<br><b>Décision de référence :</b> ${r.safeReference?"Hasard uniforme (aucun modèle expérimental meilleur sur le développement)":"Candidat expérimental à vérifier, non validé prospectivement"}.<br>Écart sur le développement : ${F(r.development)}.</p>
   <p><b>Contrôle :</b> ${r.holdN} tirages (${r.dates.holdStart} → ${r.dates.holdEnd}).</p>
   <table class="tbl"><tbody><tr><td>Référence uniforme</td><td>0,000000</td></tr><tr><td>Réinitialisation des poids</td><td>${F(r.reset)}</td></tr><tr><td>Continuation des poids</td><td>${F(r.continuous)}</td></tr><tr><td>Continuation − réinitialisation</td><td>${F(r.difference)}</td></tr></tbody></table>
   <p><b>Bootstrap en blocs à 95 % :</b><br>Réinitialisation ${fmtCI(r.ciReset)}<br>Continuation ${fmtCI(r.ciCont)}<br>Différence appariée ${fmtCI(r.ciPaired)}</p>
   <p><b>Poids final du modèle équitable :</b> ${(100*r.weights.reset).toFixed(2)} % (réinitialisé), ${(100*r.weights.continuous).toFixed(2)} % (continu).</p>
   <p><b>${r.continuous<0?'Score historique de continuation inférieur à celui du hasard : à confirmer sur de nouveaux tirages.':'La continuation n’a pas battu la référence équitable sur ce contrôle historique.'}</b></p>
   <small>La configuration expérimentale est comparée même si elle ne bat pas la référence sur le développement ; cela ne constitue pas une recommandation de jeu. Les poids et paramètres sont choisis uniquement avant le contrôle. La continuation utilise les poids issus du développement sans utiliser ses résultats futurs. Les archives ont déjà été explorées dans les versions antérieures : ceci n'est pas une validation prospective indépendante. Les intervalles sont descriptifs, sans correction pour la recherche antérieure.</small>`;
   }catch(e){o.className='status bad';o.textContent='Erreur : '+e.message}
 },30)}
 function save(){if(!last){$('v165Out').textContent='Lance le contrôle avant l’export.';return}
  const r=last,lines=['champ;valeur',`modele;${r.chosen.name}`,`reference_recommandee;${r.safeReference?"hasard_uniforme":"experience_non_validee"}`,`developpement;${r.devN}`,`controle;${r.holdN}`,`date_debut_controle;${r.dates.holdStart}`,`date_fin_controle;${r.dates.holdEnd}`,`ecart_developpement;${r.development}`,`ecart_reset;${r.reset}`,`ecart_continu;${r.continuous}`,`difference_appariee;${r.difference}`,`IC_reset_bas;${r.ciReset[0]}`,`IC_reset_haut;${r.ciReset[1]}`,`IC_cont_bas;${r.ciCont[0]}`,`IC_cont_haut;${r.ciCont[1]}`,`IC_diff_bas;${r.ciPaired[0]}`,`IC_diff_haut;${r.ciPaired[1]}`,`poids_uniforme_reset;${r.weights.reset}`,`poids_uniforme_continu;${r.weights.continuous}`];
  const b=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='IA_LOTO_V16_5_comparaison_apprentissage.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
 }
 function checks(){let results=[];try{
  const rows=M.draws();const obs=observations(rows,rows.length-4,rows.length);const u=C[0];
  results.push(['Référence uniforme = écart nul',evolve(obs,u).gaps.every(v=>v===0)]);
  for(const c of [C[1],C[4],C[9]]){
   const all=evolve(obs,c);const first=evolve(obs.slice(0,2),c),next=evolve(obs.slice(2),c,first.logw);
   results.push([`Continuation séquentielle pour ${c.name}`,Math.abs(mean(all.gaps.slice(2))-mean(next.gaps))<1e-11]);
   results.push(['Poids normalisés',Math.abs(normalize(all.logw).reduce((a,b)=>a+b,0)-1)<1e-10]);
  }
  const out=$('v165Checks');out.className='status '+(results.every(x=>x[1])?'good':'bad');out.innerHTML=results.map(x=>(x[1]?'✅ ':'❌ ')+x[0]).join('<br>');
 }catch(e){$('v165Checks').textContent='Erreur : '+e.message}}
 $('v165Run')?.addEventListener('click',show);$('v165Export')?.addEventListener('click',save);$('v165Check')?.addEventListener('click',checks);
 window.Loto165={calculate,evolve,observations,choices:C,checks};
})();
