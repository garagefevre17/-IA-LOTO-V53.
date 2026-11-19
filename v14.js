/* V14: évaluation chronologique des numéros, loi hypergéométrique exacte et journal. */
(() => { 'use strict';
 const el=id=>document.getElementById(id), N=19068840;
 let csv='';
 function comb(n,k){if(k<0||k>n)return 0;let x=1;for(let i=1;i<=k;i++)x=x*(n-i+1)/i;return x}
 const denom=comb(49,5);
 function pct(p,d=3){return (p*100).toFixed(d).replace('.',',')+' %'}
 function exact(){
   const rows=[];
   for(let k=0;k<=5;k++){
     const p=comb(5,k)*comb(44,5-k)/denom;
     rows.push('<tr><td>'+k+' bon'+(k>1?'s':'')+'</td><td>'+pct(p,k===5?6:3)+'</td></tr>');
   }
   el('v14Exact').innerHTML='<strong>Distribution théorique pour 5 numéros</strong><table class="tbl"><tr><th>Correspondances</th><th>Probabilité</th></tr>'+rows.join('')+'</table><p>Chance correct : 10 %. Jackpot (5 + Chance) : <b>1 sur '+N.toLocaleString('fr-FR')+'</b>, soit '+pct(1/N,8)+'.</p><small>Ces probabilités valent pour toutes les grilles simples dans un tirage équitable.</small>';
 }
 function evaluate(){
   const out=el('v14Results'), b=el('v14Check');b.disabled=true;
   out.className='status';out.textContent='Calcul chronologique en cours…';
   setTimeout(()=>{
     try{
       const n=Math.min(1000,draws.length-300), start=draws.length-n;
       if(n<100)throw Error('Historique insuffisant.');
       const hits=Array(6).fill(0), chance=Array(2).fill(0), rows=[['date','prediction_1','prediction_2','prediction_3','prediction_4','prediction_5','chance','bons_principaux','chance_correct']];
       let mainTotal=0;
       for(let i=start;i<draws.length;i++){
         const pred=choose('froids',draws.slice(0,i)), actual=draws[i], a=new Set(actual.slice(1,6));
         const h=pred.numbers.filter(v=>a.has(v)).length, c=Number(pred.chance===actual[6]);
         hits[h]++;chance[c]++;mainTotal+=h;
         rows.push([actual[0],...pred.numbers,pred.chance,h,c]);
       }
       const expectation=n*25/49, varPer=5*(5/49)*(44/49)*(44/48), z=(mainTotal-expectation)/Math.sqrt(n*varPer);
       const anyFull=hits[5];
       const chanceExpected=n/10;
       const pJack=1/N, expectedJack=n*pJack;
       out.className='status good';
       out.innerHTML='<strong>'+n+' tirages évalués chronologiquement</strong><p>Froids 300 : <b>'+mainTotal+'</b> numéros corrects sur '+n+' grilles ; référence équitable : '+expectation.toFixed(1)+'. Écart standardisé indicatif : '+z.toFixed(2)+'.</p><p>Chance : <b>'+chance[1]+'</b> résultats corrects ; référence : '+chanceExpected.toFixed(0)+'.</p><table class="tbl"><tr><th>Bons numéros</th><th>Tirages observés</th><th>Attendus (hasard)</th></tr>'+hits.map((v,k)=>'<tr><td>'+k+'</td><td>'+v+'</td><td>'+(n*comb(5,k)*comb(44,5-k)/denom).toFixed(2)+'</td></tr>').join('')+'</table><p>5 numéros exacts observés : '+anyFull+'. Nombre moyen de jackpots attendus sur '+n+' grilles : '+expectedJack.toFixed(7)+'.</p><div class="note"><b>Verdict : aucun avantage prospectif prouvé.</b> Les stratégies ont déjà été examinées sur ces données historiques : l’écart brut ne peut pas être interprété comme la preuve d’une méthode gagnante. Le nombre de jackpots est trop rare pour évaluer une méthode sur 1 000 tirages.</div>';
       csv=rows.map(r=>r.join(',')).join('\n');el('v14ExportState').textContent='Rapport prêt : '+n+' lignes de prévisions historiques, sans fuite du tirage courant.';
     }catch(e){out.className='status bad';out.textContent='Test impossible : '+e.message}
     finally{b.disabled=false}
   },30);
 }
 function journal(){
   const out=el('v14JournalOut');
   try{
     const results=new Map(draws.map(r=>[r[0],r]));let pending=0,known=0,invalid=0,exactFive=0,exactJack=0;
     const table=[];
     for(const p of log){
       const a=results.get(p.target);
       if(!a){pending++;table.push('<tr><td>'+esc(p.target)+'</td><td>'+esc(p.method)+'</td><td>En attente</td></tr>');continue}
       known++;const set=new Set(a.slice(1,6));const h=p.numbers.filter(n=>set.has(n)).length;const c=p.chance===a[6];if(h===5)exactFive++;if(h===5&&c)exactJack++;
       table.push('<tr><td>'+esc(p.target)+'</td><td>'+esc(p.method)+'</td><td>'+h+' + Chance '+(c?'oui':'non')+'</td></tr>');
     }
     out.className='status good';out.innerHTML='<strong>'+log.length+' prévisions locales</strong><p>Évaluables : '+known+' ; en attente : '+pending+'. 5 numéros trouvés : '+exactFive+' ; jackpots : '+exactJack+'.</p>'+ (table.length?'<table class="tbl"><tr><th>Date</th><th>Méthode</th><th>État</th></tr>'+table.map(x=>x).join('')+'</table>':'<p>Journal vide.</p>')+'<small>Évaluation à partir de la base active uniquement. La validation prospective externe n’est pas certifiée.</small>';
   }catch(e){out.className='status bad';out.textContent=e.message}
 }
 el('v14Check').addEventListener('click',evaluate);
 el('v14Journal').addEventListener('click',journal);
 el('v14Csv').addEventListener('click',()=>{if(!csv){el('v14ExportState').textContent='Lance d’abord le test.';return}exportFile('IA_LOTO_V14_validation_chronologique.csv',csv,'text/csv;charset=utf-8')});
 exact();
})();
