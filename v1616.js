/* IA LOTO V16.16 — audit probabiliste chronologique des tirages nouvellement importés.
   Aucun accès aux tirages futurs pour former la prévision; aucun changement des journaux.
   L'origine d'un fichier CSV fourni par l'utilisateur ne peut être certifiée par ce module.
*/
(()=>{'use strict';
const $=id=>document.getElementById(id);
const M=()=>window.Loto16;
const LOGU=Math.log(19068840);
const fmt=x=>Number(x).toFixed(6).replace('.',',');
const lastState={report:null};
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function nextDate(s){const t=new Date(s+'T12:00:00Z');do{t.setUTCDate(t.getUTCDate()+1)}while(![1,3,6].includes(t.getUTCDay()));return t.toISOString().slice(0,10)}
function validSequence(local,newer){if(!local?.length||local.length<300)throw Error('Historique insuffisant.');if(!newer?.length)throw Error('Aucun nouveau tirage à évaluer.');
 if(newer.length>60)throw Error('Limiter à 60 nouveaux tirages pour ce contrôle sur iPhone.');
 const data=[...newer].sort((a,b)=>a[0].localeCompare(b[0]));let preceding=local.at(-1)[0];
 for(const d of data){const expected=nextDate(preceding);if(d[0]!==expected)throw Error(`Série incomplète ou date inhabituelle : attendu ${expected}, reçu ${d[0]}. Ne pas inventer de résultats manquants.`);preceding=d[0];}
 return data;
}
function logMix(rows,weights,actual){
 const engine=M();if(weights.length!==engine.CANDIDATES.length+1)throw Error('Poids du mélange incohérents');
 const terms=[Math.log(Math.max(1e-300,weights[0]))-LOGU];
 for(let j=0;j<engine.CANDIDATES.length;j++){
  if(weights[j+1]<=0)continue;
  const cfg=engine.CANDIDATES[j];
  const m=engine.make(rows.slice(-300),cfg.type,cfg.beta);
  terms.push(Math.log(weights[j+1])+engine.logProb(m,actual));
 }
 const top=Math.max(...terms);
 return top+Math.log(terms.reduce((s,x)=>s+Math.exp(x-top),0));
}
function calculate(local,newer){
 if(!window.Loto166?.weightsAtCutoff||!window.Loto1614?.cold)throw Error('Moteurs historiques indisponibles');
 const data=validSequence(local,newer),history=local.slice(),list=[];
 for(const actual of data){
  const cutoff=history.at(-1)[0],cold=window.Loto1614.cold(history);
  const weights=window.Loto166.weightsAtCutoff(history),adaptive=window.Loto166.adaptivePick(history,weights);
  const probabilityLog=logMix(history,weights,actual);
  const main=a=>a.numbers.filter(n=>actual.slice(1,6).includes(n)).length;
  list.push({date:actual[0],cutoff,correct:{cold:{main:main(cold),chance:+(cold.chance===actual[6])},adaptive:{main:main(adaptive),chance:+(adaptive.chance===actual[6])}},logLossGap:-probabilityLog-LOGU,uniformWeight:weights[0]});
  history.push(actual);
 }
 const total=(key,field)=>list.reduce((s,r)=>s+r.correct[key][field],0);
 const loss=list.map(r=>r.logLossGap),mean=loss.reduce((s,n)=>s+n,0)/loss.length;
 return {version:'16.16',start:local.at(-1)[0],end:history.at(-1)[0],draws:list.length,verifiedSource:false,records:list,totals:{cold:{main:total('cold','main'),chance:total('cold','chance')},adaptive:{main:total('adaptive','main'),chance:total('adaptive','chance')}},theory:{main:list.length*25/49,chance:list.length/10,logLoss:LOGU},averageLossGap:mean,cumulativeLogLikelihoodRatio:-loss.reduce((s,x)=>s+x,0),interpretation:mean<0?'Score historiquement favorable, non validé comme avantage prospectif indépendant.':'Aucun avantage en score probabiliste face au hasard uniforme sur cette période.',warning:'CSV non authentifié cryptographiquement ; les archives peuvent avoir déjà servi au développement. Un score favorable sur des tirages déjà connus ne prouve pas une capacité prédictive.'};
}
function fromCSV(text,source){
 const base=M().draws(),parsed=window.Loto1611.parseFDJ(text);
 const verified=window.Loto1614.verifyDraws(parsed,base);
 const result=calculate(base,verified.newer);
 return {...result,sourceFile:source,matched:verified.matched,imported:parsed.rows.length};
}
function draw(report){
 const status=$('v1616Status'),output=$('v1616Results');
 status.className='status good';status.textContent=`${report.matched} dates concordantes ; ${report.draws} nouveaux tirages évalués dans l'ordre. Historique ${report.start} → ${report.end}.`;
 output.innerHTML=`<h3>Bilan calculé avant chaque résultat</h3><table class="tbl"><tr><th>Méthode</th><th>Bons numéros</th><th>Chance</th></tr><tr><td>Froids 300</td><td>${report.totals.cold.main}</td><td>${report.totals.cold.chance}</td></tr><tr><td>Adaptatif</td><td>${report.totals.adaptive.main}</td><td>${report.totals.adaptive.chance}</td></tr><tr><td>Hasard (moyenne attendue)</td><td>${fmt(report.theory.main)}</td><td>${fmt(report.theory.chance)}</td></tr></table><p><b>Perte logarithmique du modèle adaptatif − hasard :</b> ${fmt(report.averageLossGap)} par tirage (négatif = meilleur).</p><p><b>Log-rapport de vraisemblance cumulé adaptatif / hasard :</b> ${fmt(report.cumulativeLogLikelihoodRatio)}</p><p class="note">${safe(report.interpretation)}</p><p class="note">${safe(report.warning)}</p>`;
 $('v1616Export').disabled=false;
}
function download(payload){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='IA_LOTO_V16_16_BILAN_PROBABILISTE.json';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},1500)}
$('v1616Run')?.addEventListener('click',async()=>{const btn=$('v1616Run'),file=$('v1616File')?.files?.[0];btn.disabled=true;$('v1616Status').textContent='Calcul en cours…';
 try{if(!file)throw Error('Sélectionne un CSV FDJ.');if(file.size>15*1024*1024)throw Error('CSV supérieur à 15 Mo.');if(!$('v1616Confirm').checked)throw Error('Confirme que tu as vérifié la provenance du CSV.');
 await new Promise(resolve=>setTimeout(resolve,20));lastState.report=fromCSV(await file.text(),file.name);draw(lastState.report);
 }catch(e){lastState.report=null;$('v1616Status').className='status bad';$('v1616Status').textContent='Analyse interrompue : '+e.message;$('v1616Results').textContent='Aucune performance comptabilisée.';$('v1616Export').disabled=true;}finally{btn.disabled=false;}
});
$('v1616Export')?.addEventListener('click',()=>{if(lastState.report)download(lastState.report)});
window.Loto1616={nextDate,validSequence,logMix,calculate,fromCSV};
})();
