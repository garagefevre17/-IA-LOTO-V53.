/* IA LOTO V16.7 - moteur de sélection par probabilité jointe, expérimental.
 * N'altère ni le protocole Froids 300 ni les journaux V6-V16.6.
 * Une préférence interne au modèle ne démontre PAS un biais du LOTO.
 */
(()=>{'use strict';
const M=window.Loto16, P=window.Loto166, $=id=>document.getElementById(id);
const U=Math.exp(-M.LOG_UNIFORM), C=M.CANDIDATES, LUN=M.LOG_UNIFORM;
const fmt=x=>Number(x).toFixed(7).replace('.',',');
function models(rows,weights){if(rows.length<300)throw Error('Au moins 300 tirages nécessaires');
 const hist=rows.slice(-300);
 return C.map((c,k)=>({m:M.make(hist,c.type,c.beta),a:weights[k+1]}));
}
function probability(nums,ch,ms,weights){
 if(nums.length!==5||new Set(nums).size!==5||nums.some(n=>n<1||n>49)||ch<1||ch>10)throw Error('Grille invalide');
 let p=weights[0]*U;
 for(let k=0;k<ms.length;k++){
  const {m}=ms[k],a=weights[k+1];if(a<1e-15)continue;
  let v=a*m.v[ch]/(m.vtotal*m.e5);
  for(const n of nums)v*=m.w[n];p+=v;
 }
 return p;
}
function bestChance(nums,ms,weights){let best={chance:1,p:0};for(let c=1;c<=10;c++){
 const p=probability(nums,c,ms,weights);if(p>best.p){best={chance:c,p}}
 }return best;}
function optimize(rows,weights){const ms=models(rows,weights),candidates=[];const seen=new Set();
 function add(nums){nums=[...nums].sort((a,b)=>a-b);const key=nums.join(',');if(nums.length===5&&new Set(nums).size===5&&!seen.has(key)){seen.add(key);candidates.push(nums)}}
 // Grille initiale issue de chacune des 12 distributions, puis du mélange des marginales.
 for(const {m} of ms)add(M.choose(m).nums);
 add(P.adaptivePick(rows,weights).numbers);
 const all=[...Array(49)].map((_,i)=>i+1);let winner={p:-1,numbers:[],chance:1};
 // Ascension par échanges d'une boule, toujours évaluée par la probabilité jointe exacte.
 for(const seed of candidates){let nums=seed,b=bestChance(nums,ms,weights);
  for(let round=0;round<5;round++){
   let next=null,top=b.p;
   for(let i=0;i<5;i++)for(const n of all){if(nums.includes(n))continue;
    const trial=nums.map((x,j)=>j===i?n:x).sort((x,y)=>x-y);
    const bc=bestChance(trial,ms,weights);
    if(bc.p>top*(1+1e-13)){top=bc.p;next={nums:trial,b:bc}}
   }
   if(!next)break;nums=next.nums;b=next.b;
  }
  if(b.p>winner.p)winner={numbers:nums,chance:b.chance,p:b.p};
 }
 return {...winner,ratio:winner.p/U,weights,search:'échanges locaux (optimum global non garanti)',candidates:candidates.length};
}
function current(){const rows=M.draws(),w=P.weightsAtCutoff(rows);return {rows,w,...optimize(rows,w)}}
function checks(){const rows=M.draws(),w=P.weightsAtCutoff(rows),ms=models(rows,w);let sum=w.reduce((a,b)=>a+b,0);
 const a=optimize(rows,w),b=optimize(rows,w);
 // Vérification exacte de la formule sur le cas uniforme et un cas dégénéré.
 const only=[1,...Array(12).fill(0)];
 const testUniform=probability([1,2,3,4,5],1,ms,only);
 const valid=sum>0&&Math.abs(sum-1)<1e-9&&Math.abs(testUniform-U)<1e-16&&a.numbers.join(',')===b.numbers.join(',')&&a.chance===b.chance&&a.p>=U*.999999;
 return {valid,sum,uniform:testUniform,selection:a};
}
function out(s,cls='status'){const el=$('v167Out');el.className=cls;el.innerHTML=s}
function run(){const b=$('v167Run');b.disabled=true;out('Calcul du mélange et recherche par échanges…');
 setTimeout(()=>{try{const t=P.targetInfo(),p=current();
 out(`<b>Recherche jointe terminée</b><p>Historique arrêté au ${t.cutoff} (${p.rows.length} tirages).</p><div class="balls">${p.numbers.map(n=>`<span class="ball">${n}</span>`).join('')}<span class="ball c">${p.chance}</span></div>
 <p><b>Rapport modèle / uniforme :</b> ${fmt(p.ratio)} ×. Ce rapport est une hypothèse interne au modèle, <b>pas une augmentation vérifiée des chances</b>.</p><p><b>Poids uniforme appris :</b> ${(p.w[0]*100).toFixed(3).replace('.',',')} %.</p><p><b>Méthode :</b> ${p.search}, ${p.candidates} départs.</p><p>Cette grille V16.7 n'est <b>pas</b> enregistrée et ne remplace aucune prévision V16.6. Éviter toute nouvelle mise justifiée par ce score.</p>`, 'status good');
 }catch(e){out('Erreur : '+e.message,'status bad')}finally{b.disabled=false}},30);
}
// Épreuve chronologique non indépendante (archives déjà exploitées), sans apprentissage sur le résultat cible.
function backtest(){const b=$('v167Test');b.disabled=true;$('v167Back').textContent='Contrôle chronologique en cours…';
 setTimeout(()=>{try{
 const rows=M.draws(),end=rows.length,start=end-Number($('v167N').value);
 if(start<650)throw Error('Historique insuffisant');
 let weights=P.weightsAtCutoff(rows.slice(0,start)),loss=0,lossSq=0,hits=0,chanceHit=0;
 let logw=weights.map(w=>w>0?Math.log(w):-Infinity);
 for(let i=start;i<end;i++){
   const prev=rows.slice(0,i),ms=models(prev,weights),r=rows[i],nums=r.slice(1,6),ch=r[6];
   const pi=probability(nums,ch,ms,weights),d=-Math.log(pi)-LUN;loss+=d;lossSq+=d*d;
   // Grille évaluée AVANT l'apprentissage du résultat, par le critère joint.
   const pick=optimize(prev,weights);hits+=pick.numbers.filter(n=>nums.includes(n)).length;chanceHit+=+(pick.chance===ch);
   for(let k=0;k<C.length;k++)logw[k+1]-=.3*(-M.logProb(ms[k].m,r)-LUN);
   const peak=Math.max(...logw),tmp=logw.map(x=>Math.exp(x-peak)),sum=tmp.reduce((a,b)=>a+b,0);
   weights=tmp.map(x=>x/sum);logw=weights.map(w=>w>0?Math.log(w):-Infinity);
 }
 const n=end-start,avg=loss/n,sd=Math.sqrt(Math.max(0,lossSq/n-avg*avg)/n);
 $('v167Back').innerHTML=`<b>${n} tirages chronologiques :</b> écart moyen modèle − uniforme : <b>${fmt(avg)}</b> (négatif = meilleur).<p>Erreur-type descriptive : ${fmt(sd)} ; intervalle indicatif ±1,96 erreur-type [${fmt(avg-1.96*sd)} ; ${fmt(avg+1.96*sd)}].</p><p>Combinaisons proposées : ${hits} bons numéros au total (référence ${fmt(n*25/49)}) ; ${chanceHit} Chances corrects (référence ${fmt(n/10)}).</p><p class="note">Test rétrospectif sur archives déjà explorées ; ce n'est pas une preuve prospective. Les résultats servent à détecter une éventuelle dégradation, pas à sélectionner un gagnant.</p>`;
 }catch(e){$('v167Back').textContent='Erreur : '+e.message}finally{b.disabled=false}},30);
}
$('v167Run')?.addEventListener('click',run);$('v167Test')?.addEventListener('click',backtest);
$('v167Check')?.addEventListener('click',()=>{try{const x=checks();$('v167Checks').textContent=(x.valid?'✓':'✗')+' Contrôle probabilités, grille reproductible, modèle uniforme : '+(x.valid?'OK':'ÉCHEC')+' · poids='+fmt(x.sum)}catch(e){$('v167Checks').textContent='Erreur : '+e.message}});
window.Loto167={models,probability,bestChance,optimize,current,checks,backtest};
})();
