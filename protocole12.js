/* V12 : Froids 300 figé ; vérification rétrospective et témoin probabiliste exact. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const COMB=19068840, p0=25/49;
let report='';
function nCk(n,k){let x=1;for(let i=1;i<=k;i++)x=x*(n-k+i)/i;return x}
const probs=Array.from({length:6},(_,k)=>nCk(5,k)*nCk(44,5-k)/nCk(49,5));
function pickFroids(rows){const a=new Int32Array(50),c=new Int32Array(11);for(const r of rows.slice(-300)){for(let j=1;j<=5;j++)a[r[j]]++;c[r[6]]++}let ns=Array.from({length:49},(_,i)=>i+1).sort((x,y)=>a[x]-a[y]||x-y).slice(0,5).sort((x,y)=>x-y),ch=Array.from({length:10},(_,i)=>i+1).sort((x,y)=>c[x]-c[y]||x-y)[0];return {numbers:ns,chance:ch}}
function study(){let res=$('p12Result'),btn=$('p12Run');btn.disabled=true;res.textContent='Calcul chronologique…';setTimeout(()=>{try{
 let N=Math.min(1000,draws.length-300);if(N<200)throw Error('Pas assez de tirages');
 let hits=0,chHits=0,rank=new Int32Array(6),quart=[0,0,0,0],csv=['date,n1,n2,n3,n4,n5,chance,bons,chance_correct'];
 let start=draws.length-N;
 for(let i=start;i<draws.length;i++){
 const predicted=pickFroids(draws.slice(i-300,i));const actual=draws[i],got=predicted.numbers.filter(n=>actual.slice(1,6).includes(n)).length,correct=Number(predicted.chance===actual[6]);hits+=got;chHits+=correct;rank[got]++;quart[Math.min(3,Math.floor((i-start)*4/N))]+=got;csv.push([actual[0],...predicted.numbers,predicted.chance,got,correct].join(','));
 }
 // Exact one-draw null variance for a fixed 5-number selection under 5/49 hypergeometric.
 const variance=5*(5/49)*(44/49)*(44/48), mean=N*p0;
 const z=(hits-mean)/Math.sqrt(N*variance);
 // Normal approximation used descriptively, not as valid prospective p value under selection.
 const fmt=n=>Number(n).toLocaleString('fr-FR',{maximumFractionDigits:3});
 const quarttxt=quart.map((x,i)=>'Période '+(i+1)+' : '+x+' / '+(N/4*p0).toFixed(1)).join(' ; ');
 res.className='status good';res.innerHTML='<strong>'+N+' tirages historiques évalués, sans utiliser le tirage cible</strong><table class="tbl"><tr><td>Bons numéros principaux</td><td>'+hits+'</td></tr><tr><td>Espérance théorique</td><td>'+fmt(mean)+'</td></tr><tr><td>Numéros Chance corrects</td><td>'+chHits+' (espérance '+fmt(N/10)+')</td></tr><tr><td>Écart standardisé approximatif</td><td>'+fmt(z)+' écart-type(s)</td></tr></table><p>'+quarttxt+'</p><p>Fréquences des résultats : '+Array.from(rank).map((x,i)=>i+' bon(s) : '+x).join(' ; ')+'</p><p class="note">Le calcul hypergéométrique tient compte du tirage sans remise. <b>La comparaison est rétrospective et exploratoire :</b> la méthode a été retenue après exploration des archives ; les dépendances induites par cette sélection séquentielle et les essais multiples empêchent de présenter cet écart comme une preuve ou une p-valeur prospective.</p>';
 report=['PROTOCOLE IA LOTO V12','Dernière date intégrée : '+draws.at(-1)[0],'Fenêtre fixe : 300 tirages','Méthode : Froids 300, égalité numéro croissant','Tirages évalués : '+N,'Bons principaux : '+hits,'Espérance principaux : '+mean,'Chance correcte : '+chHits,'Espérance Chance : '+N/10,'Quartiles : '+quarttxt,'Probabilité jackpot sous hasard : 1/'+COMB,'Aucune supériorité démontrée.','',csv.join('\n')].join('\n');$('p12Export').disabled=false;
 }catch(e){res.className='status bad';res.textContent='Erreur : '+e.message}finally{btn.disabled=false}},20)}
function showPick(){let out=$('p12PickResult');try{const p=pickFroids(draws),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());out.className='status good';out.innerHTML='<strong>Froids 300 figé, historique au '+draws.at(-1)[0]+'</strong><p>'+p.numbers.join(' – ')+' | Chance '+p.chance+'</p><small>Calcul expérimental sur tirages connus. Vérifier que la base est actuelle avant d’enregistrer la prévision. P(jackpot) = 1/'+COMB+' sous hasard équitable. Date locale : '+today+'.</small>'}catch(e){out.className='status bad';out.textContent=e.message}}
$('p12Run').addEventListener('click',study);$('p12Pick').addEventListener('click',showPick);$('p12Export').addEventListener('click',()=>{if(report)exportFile('IA_LOTO_V12_protocole_et_backtest.txt',report,'text/plain')});
})();