/* V15 — expérience prédictive préspécifiée, sans promesse d'avantage. */
(()=>{'use strict';
const $=id=>document.getElementById(id), M=49, Q=10, P=5/49;
const fmt=x=>x.toLocaleString('fr-FR',{minimumFractionDigits:5,maximumFractionDigits:5});
const safe=(x)=>Math.max(1e-9,Math.min(1-1e-9,x));
function hist(){
  // Utilise la base et les compléments locaux, sans toucher aux anciens journaux.
  let rows=Array.isArray(BASE)?BASE.slice():[];
  try{const ext=JSON.parse(localStorage.getItem('ia_loto_expert_v1_draws')||'[]');if(Array.isArray(ext))rows=rows.concat(ext)}catch{}
  const map=new Map();
  for(const r of rows){if(!Array.isArray(r)||r.length<7||!/^\d{4}-\d{2}-\d{2}$/.test(r[0]))continue;
    const ns=r.slice(1,6).map(Number),c=Number(r[6]);if(new Set(ns).size!==5||ns.some(n=>!Number.isInteger(n)||n<1||n>49)||!Number.isInteger(c)||c<1||c>10)continue;
    if(!map.has(r[0]))map.set(r[0],[r[0],...ns,c]);
  }
  return [...map.values()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function model(kind,rows){
 const cut=rows.slice(-300), cnt=new Float64Array(50),ch=new Float64Array(11);let denom=0;
 for(let j=0;j<cut.length;j++){
   const age=cut.length-1-j,wt=kind==='decay'?Math.exp(-age/75):1;denom+=wt;
   for(let k=1;k<=5;k++)cnt[cut[j][k]]+=wt;ch[cut[j][6]]+=wt;
 }
 const strength=kind==='decay'?120:300;
 const p=new Float64Array(50), pc=new Float64Array(11);
 for(let i=1;i<=49;i++){
   const est=(cnt[i]+strength*P)/(denom+strength);
   p[i]=kind==='cold'?2*P-est:est;
 }
 for(let i=1;i<=10;i++){
   const est=(ch[i]+strength/10)/(denom+strength);
   pc[i]=kind==='cold'?.2-est:est;
 }
 // Toutes les distributions respectent sum(p_main)=5 et sum(p_chance)=1.
 return {p,pc};
}
function score(pm,pc,result){
 const seen=new Set(result.slice(1,6));let loss=0;
 for(let i=1;i<=49;i++){
   let p=safe(pm[i]);loss-=(seen.has(i)?Math.log(p):Math.log(1-p))/49;
 }
 loss-=Math.log(safe(pc[result[6]]));return loss;
}
const basem=new Float64Array(50).fill(P),basec=new Float64Array(11).fill(.1);
function evaluate(n=400){
 const rows=hist(), minHistory=300, lim=Math.min(n,rows.length-minHistory);
 if(lim<100)throw Error('Historique insuffisant pour cette validation');
 const start=rows.length-lim;
 const kinds=['uniform','bayes','decay','cold'];
 const sum=Object.fromEntries(kinds.map(k=>[k,0]));
 const wins=Object.fromEntries(kinds.slice(1).map(k=>[k,0]));
 const blocks=Object.fromEntries(kinds.map(k=>[k,[0,0,0,0]]));
 for(let i=start;i<rows.length;i++){
   const row=rows[i], history=rows.slice(Math.max(0,i-300),i);
   const baseline=score(basem,basec,row);sum.uniform+=baseline;
   const b=Math.min(3,Math.floor((i-start)*4/lim));blocks.uniform[b]+=baseline;
   for(const kind of kinds.slice(1)){
     const x=model(kind,history),v=score(x.p,x.pc,row);
     sum[kind]+=v;blocks[kind][b]+=v;
     if(v<baseline)wins[kind]++;
   }
 }
 return {n:lim,start:rows[start][0],end:rows.at(-1)[0],mean:Object.fromEntries(kinds.map(k=>[k,sum[k]/lim])),wins,blocks,rows:rows.length};
}
function pick(kind){
 const rows=hist();if(rows.length<300)throw Error('Au moins 300 tirages requis');
 const x=model(kind,rows), nums=Array.from({length:49},(_,i)=>i+1).sort((a,b)=>x.p[b]-x.p[a]||a-b).slice(0,5).sort((a,b)=>a-b);
 const chance=Array.from({length:10},(_,i)=>i+1).sort((a,b)=>x.pc[b]-x.pc[a]||a-b)[0];
 return {nums,chance,cutoff:rows.at(-1)[0],rank:nums.map(v=>({n:v,p:x.p[v]})),pc:x.pc[chance]};
}
function show(){
 const root=$('v15Result');root.textContent='Calcul en cours…';
 try{
   const n=Number($('v15Window').value),v=evaluate(n);
   const labels={uniform:'Hasard uniforme',bayes:'Bayésien régularisé',decay:'Décroissance temporelle',cold:'Anti-fréquence'};
   const ordered=['uniform','bayes','decay','cold'];
   const table=ordered.map(k=>`<tr><td>${labels[k]}</td><td>${fmt(v.mean[k])}</td><td>${k==='uniform'?'Référence':(v.mean[k]-v.mean.uniform>=0?'+':'')+fmt(v.mean[k]-v.mean.uniform)}</td></tr>`).join('');
   const leaders=ordered.slice(1).filter(k=>v.mean[k]<v.mean.uniform);
   root.innerHTML=`<p><b>${v.n} tirages évalués</b> du ${v.start} au ${v.end}, historique antérieur uniquement.</p>
     <table class="tbl"><thead><tr><th>Modèle</th><th>Perte moyenne ↓</th><th>Écart au hasard</th></tr></thead><tbody>${table}</tbody></table>
     <p class="${leaders.length?'warn':'status good'}"><b>${leaders.length?'Écart historique favorable pour : '+leaders.map(k=>labels[k]).join(', '):'Aucun modèle n’améliore la référence uniforme sur ce test.'}</b> ${leaders.length?'Ce classement historique n’est pas une validation prospective et ne démontre aucune capacité à prévoir le jackpot.':'Les résultats ne justifient pas de privilégier une méthode.'}</p>
     <p class="note">Score propre composite : perte logarithmique moyenne de 49 événements binaires + log-perte du Chance. Les modèles sont figés, mais le choix des hypothèses a été influencé par des analyses antérieures : test exploratoire seulement. Quatre périodes successives sont calculées en interne.</p>`;
   window.Loto15.last=v;
 }catch(e){root.textContent='Erreur de calcul : '+e.message}
}
function select(){
 try{
   const k=$('v15Kind').value, v=pick(k),box=$('v15Pick');
   box.innerHTML=`<b>${v.nums.join(' · ')} — Chance ${v.chance}</b><p>Historique arrêté au ${v.cutoff}. Sélection expérimentale ${k}, sans avantage démontré.</p><p class="warn">Ne pas considérer cette sélection comme déposée avant un tirage. Aucun enregistrement automatique ni modification du journal V6–V14.</p>`;
 }catch(e){$('v15Pick').textContent='Erreur : '+e.message}
}
function selftest(){
 const rows=hist(), tests=[];
 tests.push(['2 833 tirages historiques minimum',rows.length>=2833]);
 const t=rows.slice(-300);
 for(const kind of ['bayes','decay','cold']){
   const v=model(kind,t), s=Array.from(v.p).slice(1).reduce((a,b)=>a+b,0),c=Array.from(v.pc).slice(1).reduce((a,b)=>a+b,0);
   tests.push([kind+': somme probabilités 5 et 1',Math.abs(s-5)<1e-7&&Math.abs(c-1)<1e-7]);
   tests.push([kind+': probabilités valides',Array.from(v.p).slice(1).every(p=>p>0&&p<1)&&Array.from(v.pc).slice(1).every(p=>p>0&&p<1)]);
 }
 const z=score(basem,basec,rows.at(-1));
 tests.push(['Référence uniforme cohérente',Number.isFinite(z)]);
 $('v15Tests').innerHTML=tests.map(([name,ok])=>`${ok?'✅':'❌'} ${name}`).join('<br>');
}
$('v15Run')?.addEventListener('click',show);
$('v15Select')?.addEventListener('click',select);
$('v15Check')?.addEventListener('click',selftest);
window.Loto15={evaluate,pick,model,score,hist};
})();
