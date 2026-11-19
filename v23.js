/* IA LOTO V23 — probabilistic feature engine, cautious walk-forward validation.
   This is a real NEW probabilistic model, not simply a selection of old grids.
   Predictive advantage is not assumed. Historical testing is exploratory. */
(()=>{'use strict';
const $=id=>document.getElementById(id), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fair=5/49, cp=0.1;
// Configuration is chosen only on data strictly before the evaluation period.
const CONFIG=[
 {name:'Uniforme',feature:'none',alpha:0},
 {name:'Fréquence courte',feature:'short',alpha:.25},
 {name:'Fréquence longue',feature:'long',alpha:.25},
 {name:'Multi-échelles',feature:'blend',alpha:.25},
 {name:'Multi-échelles renforcé',feature:'blend',alpha:.50},
 {name:'Dynamique récente',feature:'trend',alpha:.25}
];
function rows(){if(!window.Loto18?.allRows)throw Error('Historique partagé inaccessible');let a=window.Loto18.allRows();if(a.length<1200)throw Error('Historique insuffisant');for(let i=1;i<a.length;i++)if(a[i-1][0]>=a[i][0])throw Error('Dates non triées ou dupliquées');return a;}
function counts(a,end,length){let ns=new Float64Array(50),cs=new Float64Array(11),start=Math.max(0,end-length);for(let i=start;i<end;i++){let r=a[i];for(let j=1;j<=5;j++)ns[r[j]]++;cs[r[6]]++;}return {ns,cs,n:end-start};}
function feature(k,kind,short,long,slow,main=true){const prior=main?fair:cp,field=main?'ns':'cs',s=(short[field][k]+120*prior)/(short.n+120),l=(long[field][k]+250*prior)/(long.n+250),o=(slow[field][k]+500*prior)/(slow.n+500);
 if(kind==='short')return s-prior;
 if(kind==='long')return l-prior;
 if(kind==='trend')return (s-l)*.70;
 if(kind==='blend')return .30*(s-prior)+.50*(l-prior)+.20*(o-prior);
 return 0;}
function predict(a,t,cfg){if(t<300)throw Error('300 tirages requis');let s=counts(a,t,60),l=counts(a,t,250),o=counts(a,t,800), pn=new Array(50).fill(0),pc=new Array(11).fill(0);
 for(let k=1;k<=49;k++)pn[k]=Math.max(.02,Math.min(.20,fair+cfg.alpha*feature(k,cfg.feature,s,l,o)));
 for(let k=1;k<=10;k++)pc[k]=Math.max(.04,Math.min(.18,cp+cfg.alpha*feature(k,cfg.feature,s,l,o,false)));
 // Marginal probabilities are normalized to exact expected 5 primary/1 Chance.
 let sum=pn.slice(1).reduce((x,y)=>x+y,0);for(let k=1;k<=49;k++)pn[k]*=5/sum;
 sum=pc.slice(1).reduce((x,y)=>x+y,0);for(let k=1;k<=10;k++)pc[k]/=sum;
 let ns=Array.from({length:49},(_,i)=>i+1).sort((x,y)=>pn[y]-pn[x]||x-y).slice(0,5).sort((x,y)=>x-y);
 let chance=Array.from({length:10},(_,i)=>i+1).sort((x,y)=>pc[y]-pc[x]||x-y)[0];
 // Under the null all probabilities tie: avoid systematic (1,2,3,4,5).
 // Deterministic reference choice, not a predictive signal.
 if(cfg.alpha===0){let seed=2166136261;for(const ch of a[t-1][0]){seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;}const rnd=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};let pool=Array.from({length:49},(_,i)=>i+1);for(let i=0;i<5;i++){let j=i+Math.floor(rnd()*(49-i));[pool[i],pool[j]]=[pool[j],pool[i]];}ns=pool.slice(0,5).sort((x,y)=>x-y);chance=1+Math.floor(rnd()*10);}
 return {pn,pc,numbers:ns,chance};}
function loss(p,r){let s=0;for(let k=1;k<=49;k++){let y=r.slice(1,6).includes(k)?1:0,x=p.pn[k];s-=y*Math.log(x)+(1-y)*Math.log(1-x);}s/=49;s-=Math.log(p.pc[r[6]])/10;return s;}
const uniform={pn:Array(50).fill(fair),pc:Array(11).fill(cp)};
function evaluate(a,start,end,cfg){let scored=0,lossModel=0,lossNull=0,hits=0,chanceHits=0, d=[];for(let i=start;i<end;i++){let p=predict(a,i,cfg),r=a[i],lm=loss(p,r),ln=loss(uniform,r);lossModel+=lm;lossNull+=ln;d.push(ln-lm);hits+=p.numbers.filter(v=>r.slice(1,6).includes(v)).length;chanceHits+=(p.chance===r[6]);scored++;}return {n:scored,hits,chanceHits,lossModel:lossModel/scored,lossNull:lossNull/scored,diff:(lossNull-lossModel)/scored,series:d};}
function uncertainty(vals){let n=vals.length,mean=vals.reduce((a,b)=>a+b,0)/n; // descriptive normal approximation, contiguous draws may be dependent
 let vari=vals.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,n-1),se=Math.sqrt(vari/n);return [mean-1.96*se,mean+1.96*se];}
let report=null;
function run(){let out=$('v23Result');out.textContent='Calcul des probabilités et contrôle chronologique en cours…';try{let a=rows(),n=Number($('v23Window').value),end=a.length,start=end-n,valStart=start-250;if(valStart<800)throw Error('Historique insuffisant pour la période indépendante');let train=CONFIG.map(c=>({cfg:c,res:evaluate(a,valStart,start,c)}));train.sort((x,y)=>x.res.lossModel-y.res.lossModel);let cfg=train[0].cfg,held=evaluate(a,start,end,cfg),ci=uncertainty(held.series),picked=predict(a,a.length,cfg);
 let advantage=(held.diff>0&&ci[0]>0&&cfg.alpha>0),status=cfg.alpha===0?'Le modèle sélectionne la référence uniforme : aucun signal historique exploitable.':advantage?'Écart positif descriptif : données rétrospectives déjà explorées, aucune validation prospective.':'Aucune supériorité démontrée : les écarts restent compatibles avec le hasard.';
 let fmt=x=>x.toFixed(6),ball=(n,c=false)=>`<span class="ball${c?' c':''}">${n}</span>`;
 out.className='status good';out.innerHTML=`<b>V23 — Moteur probabiliste multi-échelles</b><p>Apprentissage du réglage : ${a[valStart][0]} → ${a[start-1][0]} (250 tirages). Contrôle réservé : ${a[start][0]} → ${a[end-1][0]} (${n} tirages). Les probabilités sont recalculées avant chaque tirage.</p><p><b>Réglage choisi avant contrôle :</b> ${esc(cfg.name)} ; force ${cfg.alpha}.</p><table class="tbl"><tr><th>Mesure</th><th>Résultat</th></tr><tr><td>Numéros trouvés</td><td>${held.hits} / ${n}</td></tr><tr><td>Chance correcte</td><td>${held.chanceHits} / ${n}</td></tr><tr><td>Score probabiliste modèle ↓</td><td>${fmt(held.lossModel)}</td></tr><tr><td>Score probabiliste uniforme ↓</td><td>${fmt(held.lossNull)}</td></tr><tr><td>Gain de score (positif = mieux)</td><td>${fmt(held.diff)}</td></tr><tr><td>Intervalle descriptif 95 %</td><td>[${fmt(ci[0])} ; ${fmt(ci[1])}]</td></tr></table><p><b>${esc(status)}</b></p><p><b>Sélection calculée avec toutes les données actuellement disponibles :</b></p><div class="balls">${picked.numbers.map(x=>ball(x)).join('')}${ball(picked.chance,true)}</div><p class="note">Date de coupure : ${esc(a.at(-1)[0])}. Les scores marginaux ne sont pas des probabilités certifiées de combinaisons. Si le LOTO est équitable, cette grille garde une chance de jackpot de 1 sur 19 068 840. Ne pas enregistrer comme prévision antérieure si l’heure limite est dépassée.</p>`;
 report={version:'23.0',createdAt:new Date().toISOString(),lastDraw:a.at(-1)[0],selectedConfig:cfg,trainPeriod:[a[valStart][0],a[start-1][0]],testPeriod:[a[start][0],a[end-1][0]],trainCandidates:train.map(t=>({name:t.cfg.name,loss:t.res.lossModel})),holdout:{n,hits:held.hits,chance:held.chanceHits,meanLogLoss:held.lossModel,uniformLogLoss:held.lossNull,difference:held.diff,ci},selection:picked.numbers,chance:picked.chance,exploratory:true};
 }catch(e){out.className='status bad';out.textContent='Calcul impossible : '+e.message;report=null;}}
function exportData(){if(!report){$('v23Result').textContent='Lance d’abord un contrôle.';return;}let b=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='IA_LOTO_V23_modele_probabiliste.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);}
function init(){if($('v23Run')){$('v23Run').addEventListener('click',run);$('v23Export').addEventListener('click',exportData);}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.Loto23={predict,evaluate,uncertainty,CONFIG};
})();
