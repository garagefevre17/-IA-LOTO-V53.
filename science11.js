/* IA LOTO V11 – experimental joint probability scoring. No prediction guarantee. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const LOG_BASE = Math.log(19068840); // log(C(49,5) * 10)
const fm=n=>Number(n).toLocaleString('fr-FR',{minimumFractionDigits:5,maximumFractionDigits:5});
// 49 weights sum to exactly 49; chance weights are probabilities.
function makeModel(kind,hist){
 const last=hist.slice(-300), cn=new Float64Array(50),cc=new Float64Array(11);
 let denom=0;
 if(kind==='v11_decay'){
   for(let i=0;i<last.length;i++){
      const wt=Math.exp(-(last.length-1-i)/75);denom+=wt;
      for(let j=1;j<=5;j++)cn[last[i][j]]+=wt;
      cc[last[i][6]]+=wt;
   }
 }else{
   denom=last.length;
   for(let i=0;i<last.length;i++){
      for(let j=1;j<=5;j++)cn[last[i][j]]++;
      cc[last[i][6]]++;
   }
 }
 const w=new Float64Array(50),pC=new Float64Array(11),prior=300;
 for(let i=1;i<=49;i++){
  const obs=(cn[i]+prior*5/49)/(denom+prior);
  const ratio=obs/(5/49);
  if(kind==='v11_cold')w[i]=Math.max(.2,Math.min(5,Math.pow(ratio,-.45)));
  else w[i]=Math.max(.2,Math.min(5,Math.pow(ratio,.65)));
 }
 for(let i=1;i<=10;i++){
  const obs=(cc[i]+prior/10)/(denom+prior);
  const ratio=obs/.1;
  if(kind==='v11_cold')pC[i]=Math.max(1e-8,Math.pow(ratio,-.45));
  else pC[i]=Math.max(1e-8,Math.pow(ratio,.65));
 }
 const sum=w.reduce((a,b)=>a+b,0)/49;
 for(let i=1;i<=49;i++)w[i]/=sum;
 const sumC=pC.reduce((a,b)=>a+b,0);for(let i=1;i<=10;i++)pC[i]/=sumC;
 return {w,pC};
}
// Probability of unordered five-element set under sequential weighted sampling without replacement.
function jointMain(w,nums){
 const total=49; // normalized weights
 const dp=new Float64Array(32);dp[0]=1;
 const subSums=new Float64Array(32);
 for(let mask=1;mask<32;mask++){let bit=mask&-mask,i=31-Math.clz32(bit);subSums[mask]=subSums[mask^bit]+w[nums[i]];}
 for(let mask=0;mask<31;mask++){
  const denom=total-subSums[mask];
  for(let i=0;i<5;i++) if(!(mask&(1<<i)))dp[mask|1<<i]+=dp[mask]*w[nums[i]]/denom;
 }
 return dp[31];
}
function predict(kind,hist){
 if(kind==='uniform'){let rng=window.crypto?.getRandomValues?window.crypto.getRandomValues(new Uint32Array(1))[0]:Math.floor(Math.random()*2**32);let a=Array.from({length:49},(_,i)=>i+1);for(let i=0;i<5;i++){rng=(Math.imul(1664525,rng)+1013904223)>>>0;let j=i+(rng%(49-i));[a[i],a[j]]=[a[j],a[i]];}return {numbers:a.slice(0,5).sort((a,b)=>a-b),chance:1+(rng%10)};}
 const {w,pC}=makeModel(kind,hist);
 const nums=Array.from({length:49},(_,i)=>i+1).sort((a,b)=>w[b]-w[a]||a-b).slice(0,5).sort((a,b)=>a-b);
 const chance=Array.from({length:10},(_,i)=>i+1).sort((a,b)=>pC[b]-pC[a]||a-b)[0];
 return {numbers:nums,chance};
}
// A probability score, not a prediction: log loss for the actual full lottery draw.
function score(kind,history,row){
 if(kind==='uniform')return LOG_BASE;
 const m=makeModel(kind,history);
 const p=jointMain(m.w,row.slice(1,6))*m.pC[row[6]];
 if(!(p>0))throw Error('Probabilité nulle non valide');
 return -Math.log(p);
}
// Fast rolling statistics for backtest; only last 300 draws, never current draw.
function initRolling(kind,rows,start){
 const cn=new Float64Array(50),cc=new Float64Array(11);let denom=0;
 for(let k=start-300;k<start;k++){
   let weight=kind==='v11_decay'?Math.exp(-(start-1-k)/75):1;
   denom+=weight;
   for(let j=1;j<=5;j++)cn[rows[k][j]]+=weight;
   cc[rows[k][6]]+=weight;
 }
 return {cn,cc,denom};
}
function modelFromRolling(kind,r){
 const {cn,cc,denom}=r, prior=300;
 const w=new Float64Array(50),pC=new Float64Array(11);
 for(let i=1;i<=49;i++){
  const ratio=((cn[i]+prior*5/49)/(denom+prior))/(5/49);
  w[i]=Math.max(.2,Math.min(5,Math.pow(ratio,kind==='v11_cold'?-.45:.65)));
 }
 let wSum=0;for(let i=1;i<=49;i++)wSum+=w[i];for(let i=1;i<=49;i++)w[i]*=49/wSum;
 let cSum=0;for(let i=1;i<=10;i++){
  const ratio=((cc[i]+prior/10)/(denom+prior))/.1;
  pC[i]=Math.max(1e-8,Math.pow(ratio,kind==='v11_cold'?-.45:.65));cSum+=pC[i];
 }for(let i=1;i<=10;i++)pC[i]/=cSum;
 return {w,pC};
}
function roll(kind,r,oldRow,newRow){
 if(kind==='v11_decay'){
  const d=Math.exp(-1/75),rem=Math.exp(-299/75);
  for(let i=1;i<=49;i++)r.cn[i]*=d;
  for(let i=1;i<=10;i++)r.cc[i]*=d;
  for(let j=1;j<=5;j++){r.cn[oldRow[j]]-=rem*d;r.cn[newRow[j]]+=1;}
  r.cc[oldRow[6]]-=rem*d;r.cc[newRow[6]]+=1;
  r.denom=r.denom*d-rem*d+1;
 }else{
  for(let j=1;j<=5;j++){r.cn[oldRow[j]]--;r.cn[newRow[j]]++;}
  r.cc[oldRow[6]]--;r.cc[newRow[6]]++;
 }
}
const KINDS=['uniform','v11_shrink','v11_decay','v11_cold'];
const LABELS={uniform:'Hasard uniforme',v11_shrink:'Bayésien 300',v11_decay:'Décroissance temporelle',v11_cold:'Anti-fréquence'};
let csv='';
function run(){const out=$('labResult'),btn=$('labRun');let n=Number($('labN').value);out.textContent='Calcul en cours…';btn.disabled=true;
 setTimeout(()=>{try{
  const start=draws.length-n;
  if(start<300)throw Error('Historique insuffisant');
  const rolling=new Map(KINDS.filter(x=>x!=='uniform').map(k=>[k,initRolling(k,draws,start)]));
  const stats=Object.fromEntries(KINDS.map(k=>[k,{sum:0,quart:[0,0,0,0],better:0}]));
  const lines=[['date','modele','perte_log','ecart_vs_uniforme']];
  for(let i=start;i<draws.length;i++){
    const row=draws[i],quart=Math.min(3,Math.floor((i-start)*4/n));
    for(const kind of KINDS){
      let loss=LOG_BASE;
      if(kind!=='uniform'){
        let m=modelFromRolling(kind,rolling.get(kind));
        loss=-Math.log(jointMain(m.w,row.slice(1,6))*m.pC[row[6]]);
      }
      let delta=loss-LOG_BASE;
      stats[kind].sum+=delta;stats[kind].quart[quart]+=delta;
      if(delta<0)stats[kind].better++;
      lines.push([row[0],LABELS[kind],loss.toFixed(9),delta.toFixed(9)]);
    }
    for(const kind of rolling.keys())roll(kind,rolling.get(kind),draws[i-300],row);
  }
  csv=lines.map(row=>row.join(',')).join('\n');$('labCsv').disabled=false;
  out.className='status good';
  let rows=KINDS.map(k=>({k,value:stats[k].sum/n})).sort((a,b)=>a.value-b.value);
  out.innerHTML='<b>'+n+' tirages chronologiques · probabilité jointe exacte</b><table class="tbl"><tr><th>Modèle</th><th>Δ log-perte / tirage</th></tr>'+rows.map(r=>'<tr><td>'+LABELS[r.k]+'</td><td>'+fm(r.value)+'</td></tr>').join('')+'</table><p>Référence équitable = 0. <b>Un écart négatif</b> est une amélioration historique du score, <b>positif</b> une dégradation. Aucun résultat ne garantit le prochain tirage.</p><table class="tbl"><tr><th>Quart de période</th>'+KINDS.filter(k=>k!=='uniform').map(k=>'<th>'+LABELS[k].split(' ')[0]+'</th>').join('')+'</tr>'+[0,1,2,3].map(q=>'<tr><td>'+(q+1)+'/4</td>'+KINDS.filter(k=>k!=='uniform').map(k=>'<td>'+fm(stats[k].quart[q]/(Math.floor((q+1)*n/4)-Math.floor(q*n/4)))+'</td>').join('')+'</tr>').join('')+'</table><small>Aucun p-valeur ni intervalle de confiance n’est calculé ici ; ne pas interpréter un faible écart comme une découverte. Les réglages ont été définis après plusieurs analyses des mêmes archives. Confirmation prospective indispensable.</small>';
 }catch(e){out.className='status bad';out.textContent='Échec du test : '+e.message}finally{btn.disabled=false}},20);
}
function selfcheck(){
 const w=new Float64Array(50);w.fill(1);
 let p=jointMain(w,[1,2,3,4,5]),expected=1/1906884;
 if(Math.abs(p/expected-1)>1e-9)throw Error('Uniforme sans remise incorrect: '+p);
 const hist=draws.slice(-300);
 for(const kind of KINDS.filter(k=>k!=='uniform')){
  const m=makeModel(kind,hist);
  const sumMain=m.w.reduce((a,b)=>a+b,0),sumChance=m.pC.reduce((a,b)=>a+b,0);
  if(Math.abs(sumMain-49)>1e-9||Math.abs(sumChance-1)>1e-9)throw Error('Normalisation : '+kind);
  let r=initRolling(kind,draws,draws.length),mr=modelFromRolling(kind,r);
  const diff=Math.max(...Array.from({length:49},(_,i)=>Math.abs(m.w[i+1]-mr.w[i+1])));
  if(diff>1e-7)throw Error('Rolling non concordant : '+kind+' / '+diff);
 }
 return p;
}
window.Loto11={pick:predict,makeModel,jointMain,selfcheck,score};
try{
 $('labRun').addEventListener('click',run);
 $('labCsv').addEventListener('click',()=>{if(csv)exportFile('IA_LOTO_V11_score_joint.csv',csv,'text/csv')});
 $('labCheck').addEventListener('click',()=>{
   let o=$('labCheckResult');try{let p=selfcheck();o.className='status good';o.textContent='✓ Uniforme exact : P(5 numéros)=1/1 906 884 ; avec Chance=1/19 068 840. ✓ Modèles normalisés. ✓ Fenêtres glissantes concordantes avec calcul direct.'}
   catch(e){o.className='status bad';o.textContent='Échec du contrôle : '+e.message}
 });
}catch(e){console.error(e)}
})();
