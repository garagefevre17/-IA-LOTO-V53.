/* V16.4 — réglage gelé / contrôle chronologique. Pas de modification du journal. */
(()=>{'use strict';
const $=id=>document.getElementById(id),M=window.Loto16;
const F=x=>Number(x).toFixed(6).replace('.',',');
const softmax=a=>{let m=Math.max(...a),e=a.map(x=>Math.exp(x-m)),z=e.reduce((s,x)=>s+x,0);return e.map(x=>x/z)};
const choices=[{name:'Hasard uniforme',eta:0,prior:1}];
for(const prior of [.5,.8,.95])for(const eta of [.1,.3,1])choices.push({name:`Mélange adaptatif · référence ${Math.round(prior*100)} % · apprentissage ${eta}`,eta,prior});
function losses(rows,from,to){let out=[];for(let i=from;i<to;i++){
 const hist=rows.slice(i-300,i),r=rows[i];
 out.push([0,...M.CANDIDATES.map(c=>-M.logProb(M.make(hist,c.type,c.beta),r)-M.LOG_UNIFORM)]);
 }return out;}
// La pondération de la prédiction précède strictement la mise à jour avec le résultat.
function trial(L,c){if(c.eta===0)return {losses:L.map(()=>0),weights:[1,...M.CANDIDATES.map(()=>0)]};
 const q=M.CANDIDATES.length,init=[c.prior,...Array(q).fill((1-c.prior)/q)],logw=init.map(Math.log),d=[];
 for(const v of L){const w=softmax(logw),terms=w.map((p,j)=>Math.log(p)-v[j]),mx=Math.max(...terms),ell=-(mx+Math.log(terms.reduce((s,x)=>s+Math.exp(x-mx),0)));
 d.push(ell);for(let j=0;j<logw.length;j++)logw[j]-=c.eta*v[j];let m=Math.max(...logw);for(let j=0;j<logw.length;j++)logw[j]-=m;
 }return {losses:d,weights:softmax(logw)};}
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function run(){if(!M)throw Error('Moteur V16 indisponible');const rows=M.draws(),D=+($('v164Dev').value),H=+($('v164Hold').value),end=rows.length;
 if(end-D-H<300)throw Error('Historique insuffisant pour séparer développement et contrôle');
 const dev=losses(rows,end-D-H,end-H),hold=losses(rows,end-H,end),ranking=choices.map((c,i)=>({i,loss:mean(trial(dev,c).losses)})).sort((a,b)=>a.loss-b.loss);
 const chosen=ranking[0].loss < -1e-6 ? choices[ranking[0].i] : choices[0],res=trial(hold,chosen),delta=mean(res.losses),ci=M.ciBlock(res.losses,600);
 return {dev:D,hold:H,chosen,devGap:mean(trial(dev,chosen).losses),holdGap:delta,CI:ci,weight:res.weights[0],dates:[rows[end-D-H][0],rows[end-H-1][0],rows[end-H][0],rows[end-1][0]],tested:choices.length,losses:res.losses};}
let latest=null;
function display(){const out=$('v164Out');out.className='status';out.textContent='Calcul en cours (réglages et contrôle séparés)…';setTimeout(()=>{try{latest=run();let r=latest;
 out.className='status '+(r.holdGap<0?'warn':'good');out.innerHTML=`<b>${r.tested} configurations comparées sur ${r.dev} tirages de développement</b> (${r.dates[0]} → ${r.dates[1]}).<p><b>Choix gelé :</b> ${r.chosen.name}.<br>Écart en développement (modèle − hasard) : ${F(r.devGap)}.</p><p><b>Contrôle distinct :</b> ${r.hold} tirages (${r.dates[2]} → ${r.dates[3]}).<br>Écart en contrôle (négatif = meilleur) : <b>${r.holdGap>=0?'+':''}${F(r.holdGap)}</b><br>Intervalle descriptif bootstrap 95 % : [${F(r.CI[0])} ; ${F(r.CI[1])}]</p><p>Poids final du hasard : ${(r.weight*100).toFixed(2)} %.</p><p><b>${r.holdGap<0?'Score favorable sur cette période historique, non confirmé prospectivement.':'Aucune supériorité constatée face au hasard sur cette période.'}</b></p><small>Le contrôle est distinct du réglage dans cette exécution, mais ces archives ont déjà été explorées dans les versions précédentes. Refaire le test avec d'autres réglages après avoir vu ces résultats invaliderait le caractère gelé du contrôle. Aucune garantie de jackpot.</small>`;
 }catch(e){out.className='status bad';out.textContent='Erreur : '+e.message}},25)}
function exportResults(){if(!latest){$('v164Out').textContent='Lance d’abord le test.';return;}const r=latest;
 const lines=['champ;valeur',`modele;${r.chosen.name}`,`developpement;${r.dev}`,`controle;${r.hold}`,`ecart_developpement;${r.devGap}`,`ecart_controle;${r.holdGap}`,`intervalle_bas;${r.CI[0]}`,`intervalle_haut;${r.CI[1]}`,`poids_hasard_final;${r.weight}`,`date_debut_controle;${r.dates[2]}`,`date_fin_controle;${r.dates[3]}`];let b=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='IA_LOTO_V16_4_validation_separee.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
$('v164Run')?.addEventListener('click',display);$('v164Export')?.addEventListener('click',exportResults);
window.Loto164={run,trial,choices};
})();
