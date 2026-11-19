/* V16.9 — Évaluation prospective avec vérification d'intégrité AVANT de compter.
 * Les archives déjà utilisées pour développer les modèles ne sont pas de la validation indépendante.
 * Ce module ne modifie ni le journal ni les sélections.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const pretty=n=>Number(n).toLocaleString('fr-FR',{maximumFractionDigits:6});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const CHOOSE=(n,k)=>{if(k<0||k>n)return 0;let r=1;for(let i=1;i<=k;i++)r=r*(n-i+1)/i;return r};
const probs=Array.from({length:6},(_,k)=>CHOOSE(5,k)*CHOOSE(44,5-k)/CHOOSE(49,5));
function convolutionTail(n,observed){
 if(!Number.isSafeInteger(n)||n<0||n>1500||!Number.isSafeInteger(observed)||observed<0||observed>5*n)throw Error('Paramètres invalides');
 let dist=new Float64Array(1);dist[0]=1;
 for(let i=0;i<n;i++){let next=new Float64Array(dist.length+5);for(let j=0;j<dist.length;j++){const v=dist[j];if(!v)continue;for(let k=0;k<=5;k++)next[j+k]+=v*probs[k]}dist=next}
 let sum=0;for(let i=observed;i<dist.length;i++)sum+=dist[i];return Math.min(1,Math.max(0,sum));
}
function chanceTail(n,k){if(n===0)return 1; if(n>1500)throw Error('Trop de tirages');let d=new Float64Array(n+1);d[0]=1;for(let i=0;i<n;i++){for(let j=i+1;j>=0;j--){d[j]=d[j]*.9+(j?d[j-1]*.1:0)}}let t=0;for(let j=k;j<=n;j++)t+=d[j];return Math.min(1,Math.max(0,t))}
async function compute(){
 if(!window.Loto168?.audit)throw Error('Module V16.8 absent');
 const full=await window.Loto168.audit();
 const examined=full.records||[];
 const passing=examined.filter(r=>r.ok&&r.actual&&r.methods?.length===3);
 const waiting=examined.filter(r=>r.ok&&!r.actual).length;
 const rejected=examined.filter(r=>!r.ok).length;
 const summary={cold:{count:0,hits:0,ch:0,complete:0},adaptive:{count:0,hits:0,ch:0,complete:0},uniform:{count:0,hits:0,ch:0,complete:0}};
 for(const row of passing){for(const m of row.methods){if(!(m.name in summary))throw Error('Méthode inconnue');const s=summary[m.name];s.count++;s.hits+=m.hits;s.ch+=m.chanceHit;s.complete+=Number(m.hits===5&&m.chanceHit===1)}}
 for(const val of Object.values(summary)){val.expectedHits=val.count*25/49;val.expectedChance=val.count/10;val.pHits=convolutionTail(val.count,val.hits);val.pChance=chanceTail(val.count,val.ch)}
 return {auditedAt:new Date().toISOString(),total:examined.length,validated:passing.length,waiting,rejected,latest:full.latest,summary,scope:'Résultats uniquement issus de la base locale, authenticité du résultat non vérifiée sur la FDJ. Empreintes locales non horodatées par un tiers.',multipleTests:'6 tests exploratoires (3 méthodes x 2 mesures) ; seuil Bonferroni indicatif 0,05/6 = 0,00833. Aucune preuve de prévision garantie.'};
}
function view(res){let html=`<b>${res.total} date(s) dans le journal</b><p>${res.validated} date(s) évaluables avec empreintes cohérentes · ${res.waiting} en attente · ${res.rejected} rejetée(s) (ne comptent pas).</p>`;
 if(res.validated){html+=`<table class="tbl"><thead><tr><th>Méthode</th><th>Bons n°</th><th>Chance</th><th>p n°</th><th>p Chance</th></tr></thead><tbody>`;
 for(const [k,s] of Object.entries(res.summary))html+=`<tr><td>${esc({cold:'Froids 300',adaptive:'Adaptatif figé',uniform:'Témoin aléatoire'}[k])}</td><td>${s.hits} / ${pretty(s.expectedHits)}</td><td>${s.ch} / ${pretty(s.expectedChance)}</td><td>${pretty(s.pHits)}</td><td>${pretty(s.pChance)}</td></tr>`;
 html+='</tbody></table><p>Jackpots complets observés : '+Object.entries(res.summary).map(([k,s])=>`${esc(k)} ${s.complete}`).join(' · ')+'</p>';
 }else html+='<p>Aucun tirage évaluable. Les zéros ne sont pas des échecs : aucune performance ne peut être calculée pour le moment.</p>';
 html+='<p class="note">p = probabilité d’obtenir au moins autant de bons numéros par hasard dans un jeu équitable, pas probabilité de gagner le jackpot. Tests exploratoires et méthodes corrélées : pas de conclusion prédictive sans validation prospective indépendante. Les résultats locaux ne sont pas certifiés FDJ.</p>';
 $('v169Output').className='status '+(res.rejected?'warn':'good');$('v169Output').innerHTML=html;
}
let last=null;
async function run(){const btn=$('v169Run');btn.disabled=true;$('v169Output').textContent='Vérification des empreintes et calcul des distributions exactes…';try{last=await compute();view(last)}catch(e){$('v169Output').className='status bad';$('v169Output').textContent='Test impossible : '+e.message}finally{btn.disabled=false}}
function exportData(){if(!last){$('v169Output').textContent='Lance d’abord le contrôle.';return}const data=new Blob([JSON.stringify(last,null,2)],{type:'application/json'});const u=URL.createObjectURL(data),a=document.createElement('a');a.href=u;a.download='IA_LOTO_V16_9_BILAN_SCIENTIFIQUE.json';document.body.append(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(u)},1500)}
$('v169Run')?.addEventListener('click',run);$('v169Export')?.addEventListener('click',exportData);
window.Loto169={compute,convolutionTail,chanceTail,probs};
})();
