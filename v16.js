/* IA LOTO V16 — véritable distribution jointe des combinaisons et test chronologique gelé.
   Ne modifie aucun algorithme historique ni journal de prévisions. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const logC=(n,k)=>{let x=0;for(let i=1;i<=k;i++)x+=Math.log(n-k+i)-Math.log(i);return x};
const LOG_UNIFORM=logC(49,5)+Math.log(10);
const TYPES=['cold300','hot300','recent100','decay'];
const LABELS={cold300:'Anti-fréquence 300',hot300:'Fréquences 300',recent100:'Fréquences 100',decay:'Pondération récente'};
const BETAS=[0.04,0.10,0.20];
const CANDIDATES=TYPES.flatMap(type=>BETAS.map(beta=>({type,beta,key:`${type}_${beta}`})));
function draws(){if(!window.Loto15||typeof window.Loto15.hist!=='function')throw Error('Historique V15 indisponible');return window.Loto15.hist()}
function make(history,type,beta){
 const n=type==='recent100'?100:300;
 const subset=history.slice(-n);
 if(subset.length<n)throw Error('Historique insuffisant');
 const count=new Float64Array(50),ch=new Float64Array(11);let total=0,totalSq=0;
 for(let j=0;j<n;j++){
  const age=n-1-j,weight=type==='decay'?Math.exp(-age/80):1;total+=weight;totalSq+=weight*weight;
  const r=subset[j];for(let k=1;k<=5;k++)count[r[k]]+=weight;ch[r[6]]+=weight;
 }
 const eff=total*total/totalSq;
 const pm=5/49,pc=.1;
 const mainSd=Math.sqrt(eff*pm*(1-pm)),chanceSd=Math.sqrt(eff*pc*(1-pc));
 const w=new Float64Array(50),v=new Float64Array(11);
 for(let i=1;i<=49;i++){
  let z=((count[i]/total)*eff-eff*pm)/mainSd;
  if(type==='cold300')z=-z;
  w[i]=Math.exp(Math.max(-1.5,Math.min(1.5,beta*z)));
 }
 let vtotal=0;
 for(let i=1;i<=10;i++){
  let z=((ch[i]/total)*eff-eff*pc)/chanceSd;
  if(type==='cold300')z=-z;
  v[i]=Math.exp(Math.max(-1.5,Math.min(1.5,beta*z)));vtotal+=v[i];
 }
 // E5 = somme sur toutes les combinaisons non ordonnées de 5 numéros, sans remise.
 const E=new Float64Array(6);E[0]=1;
 for(let i=1;i<=49;i++)for(let k=Math.min(i,5);k>=1;k--)E[k]+=w[i]*E[k-1];
 return {w,v,vtotal,e5:E[5],type,beta};
}
function logProb(m,r){let t=-Math.log(m.e5)-Math.log(m.vtotal)+Math.log(m.v[r[6]]);for(let j=1;j<=5;j++)t+=Math.log(m.w[r[j]]);return t}
function choose(m){
 const nums=Array.from({length:49},(_,i)=>i+1).sort((a,b)=>m.w[b]-m.w[a]||a-b).slice(0,5).sort((a,b)=>a-b);
 const chance=Array.from({length:10},(_,i)=>i+1).sort((a,b)=>m.v[b]-m.v[a]||a-b)[0];
 const probability=Math.exp(logProb(m,['',...nums,chance]));
 return {nums,chance,probability,ratio:probability*Math.exp(LOG_UNIFORM)};
}
// Chaque évaluation n'utilise que les 300 précédents tirages; les choix de paramètres
// sont effectués sur la fenêtre de développement, avant le contrôle final.
function evaluatePeriod(rows,from,to){
 const vals=CANDIDATES.map(()=>[]);
 for(let i=from;i<to;i++){
  const history=rows.slice(i-300,i),r=rows[i];
  CANDIDATES.forEach((cfg,j)=>vals[j].push(-logProb(make(history,cfg.type,cfg.beta),r)-LOG_UNIFORM));
 }
 return vals;
}
const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
// Bootstrap par blocs pour respecter des dépendances temporelles locales.
function ciBlock(values,reps=1200){
 const block=20,n=values.length,blocks=[];
 for(let i=0;i<n;i+=block)blocks.push(values.slice(i,Math.min(n,i+block)));
 let seed=184729;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const sims=[];
 for(let r=0;r<reps;r++){
  let sum=0,count=0;
  while(count<n){const b=blocks[Math.floor(rand()*blocks.length)];const take=Math.min(b.length,n-count);for(let j=0;j<take;j++)sum+=b[j];count+=take;}
  sims.push(sum/n);
 }
 sims.sort((a,b)=>a-b);
 return [sims[Math.floor(reps*.025)],sims[Math.floor(reps*.975)]];
}
let lastResult=null;let lastPick=null;
function evaluate(){
 const root=$('v16Result');root.textContent='Calcul de la distribution jointe et validation chronologique…';
 // Laisser l'interface mettre à jour son affichage avant le calcul coûteux.
 setTimeout(()=>{
 try{
  const rows=draws(),H=Number($('v16H').value),D=Number($('v16D').value),end=rows.length;
  if(end-D-H<300)throw Error('Pas assez de tirages');
  const dev=evaluatePeriod(rows,end-H-D,end-H),idx=dev.map((v,i)=>({i,m:mean(v)})).sort((a,b)=>a.m-b.m)[0].i;
  const test=evaluatePeriod(rows,end-H,end)[idx];const d=mean(dev[idx]),t=mean(test),CI=ciBlock(test);
  const cfg=CANDIDATES[idx];const sumLoss=LOG_UNIFORM+t;
  const holdDate=[rows[end-H][0],rows[end-1][0]],devDate=[rows[end-H-D][0],rows[end-H-1][0]];
  let verdict=CI[1]<0?'Écart favorable sur cet historique, mais à confirmer prospectivement.':CI[0]>0?'Le modèle sélectionné fait moins bien que le hasard sur la période de contrôle.':'Aucune amélioration statistiquement démontrée sur la période de contrôle.';
  root.innerHTML=`<p><b>Réglage :</b> ${D} tirages (${devDate.join(' au ')}).<br><b>Contrôle gelé :</b> ${H} tirages (${holdDate.join(' au ')}).</p>
  <p><b>Modèle choisi avant le contrôle :</b> ${LABELS[cfg.type]} ; intensité ${cfg.beta}.</p>
  <table class="tbl"><tbody><tr><td>Perte uniforme (référence)</td><td>${LOG_UNIFORM.toFixed(5)}</td></tr><tr><td>Perte du modèle sur contrôle</td><td>${sumLoss.toFixed(5)}</td></tr><tr><td>Écart modèle − hasard (↓ meilleur)</td><td>${t>=0?'+':''}${t.toFixed(5)}</td></tr><tr><td>Intervalle bootstrap 95 % de l'écart</td><td>[${CI[0].toFixed(5)} ; ${CI[1].toFixed(5)}]</td></tr></tbody></table>
  <p class="${CI[1]<0?'status good':'warn'}"><b>${verdict}</b></p><p class="note">Les 12 variantes ne sont choisies qu'avec la période de réglage. L'intervalle utilise un bootstrap en blocs de 20 tirages (1 200 réplications). Comme cet historique a été étudié lors des versions précédentes, il ne constitue pas une validation prospective indépendante ; l'intervalle est descriptif, non une preuve définitive.</p>`;
  lastResult={cfg,development:d,holdout:t,ci:CI,devDate,holdDate,rows:end};
  window.Loto16.last=lastResult;
 }catch(e){root.textContent='Erreur : '+e.message}
 },20);
}
function select(){
 try{
  const rows=draws();if(rows.length<300)throw Error('Historique insuffisant');
  // Sans validation prospective, pas de promotion d'un modèle sur la seule période de contrôle.
  const kind=$('v16Kind').value;
  const cfg=kind==='baseline'?null:CANDIDATES.find(x=>x.key===kind);
  if(!cfg&&kind!=='baseline')throw Error('Modèle inconnu');
  const cutoff=rows.at(-1)[0],root=$('v16Pick');lastPick=null;$('v16Save').disabled=true;
  if(kind==='baseline'){
   root.innerHTML='<b>Modèle uniforme :</b> aucune grille n’est plus probable qu’une autre. Il n’existe donc pas de sélection optimale par ce modèle.';
   return;
  }
  const m=make(rows.slice(-300),cfg.type,cfg.beta),p=choose(m);lastPick={numbers:p.nums,chance:p.chance,cutoff,method:'v16_'+cfg.key};$('v16Save').disabled=false;
  root.innerHTML=`<div class="balls">${p.nums.map(n=>`<span class="ball">${n}</span>`).join('')}<span class="ball c">${p.chance}</span></div><p><b>Modèle expérimental :</b> ${LABELS[cfg.type]}, intensité ${cfg.beta}. Base arrêtée au ${cutoff}.</p><p>La probabilité réelle de jackpot reste de <b>1 sur 19 068 840 dans un tirage équitable</b>. Le modèle classe les combinaisons, mais son classement n’a pas démontré d’avantage.</p><p class="warn">Aucune preuve d'un avantage sur le LOTO réel. Pas d'enregistrement automatique ; ne pas remplacer les prévisions déjà sauvegardées. Base potentiellement périmée.</p>`;
 }catch(e){$('v16Pick').textContent='Erreur : '+e.message}
}
function checks(){
 try{
  const rows=draws(),out=[],sample=rows.slice(-300);
  const u=make(sample,'hot300',0),r=rows.at(-1);
  out.push(['Référence uniforme exacte 5+Chance',Math.abs(logProb(u,r)+LOG_UNIFORM)<1e-9]);
  const m=make(sample,'cold300',0.1),s=choose(m);
  out.push(['Normalisation E5 et probabilités positives',m.e5>0&&Number.isFinite(logProb(m,r))&&s.probability>0&&s.probability<1]);
  out.push(['Combinaison sans remise : 5 numéros distincts',new Set(s.nums).size===5]);
  out.push(['Chance séparé : 1 à 10',s.chance>=1&&s.chance<=10]);
  const probs=[];let total=0;
  for(let i=1;i<=10;i++){probs.push(m.v[i]/m.vtotal);total+=probs.at(-1)}
  out.push(['Chance normalisé à 100 %',Math.abs(total-1)<1e-12]);
  $('v16Checks').innerHTML=out.map(([name,ok])=>`${ok?'✅':'❌'} ${name}`).join('<br>');
 }catch(e){$('v16Checks').textContent='Erreur : '+e.message}
}
$('v16Save')?.addEventListener('click',()=>{try{if(!lastPick)throw Error('Calcule d’abord une sélection V16');window.prepareV16Selection(lastPick)}catch(e){$('v16Pick').className='status bad';$('v16Pick').textContent=e.message}});$('v16Run')?.addEventListener('click',evaluate);$('v16Select')?.addEventListener('click',select);$('v16Check')?.addEventListener('click',checks);
window.Loto16={draws,make,logProb,choose,evaluatePeriod,ciBlock,checks,LOG_UNIFORM,CANDIDATES,last:lastResult};
})();
