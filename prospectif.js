'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const key='froids300_v53_local';
 function run(){
  const out=$('prospectiveOutput');
  try{
   const journal=JSON.parse(localStorage.getItem(key)||'[]');
   if(!Array.isArray(journal))throw Error('Journal local invalide');
   const input=$('prospectiveCsv').files[0];
   if(!input)throw Error('Importer un CSV de résultats LOTO avant de comparer');
   input.text().then(text=>{
    try{
     const results=parseCSV(text),byDate=new Map(results.map(x=>[x.date,x]));
     const rows=journal.map(p=>{
      const actual=byDate.get(p.target);
      const valid=Array.isArray(p.numbers)&&p.numbers.length===5&&new Set(p.numbers).size===5&&p.numbers.every(x=>Number.isInteger(x)&&x>=1&&x<=49)&&Number.isInteger(p.chance)&&p.chance>=1&&p.chance<=10;
      const hits=actual&&valid?p.numbers.filter(n=>actual.numbers.includes(n)).length:null;
      const saved=p.local_saved_at||null;
      const before=saved&&Number.isFinite(Date.parse(saved))&&Date.parse(saved)<Date.parse(p.target+'T19:00:00Z');
      return {target:p.target,forecast:p.numbers,chance:p.chance,actual:actual?.numbers||null,actual_chance:actual?.chance??null,hits,chance_hit:actual&&valid?Number(p.chance===actual.chance):null,local_saved_at:saved,local_before_draw_claim:!!before,independent_timestamp_verified:false,status:!valid?'INVALID_FORECAST':!actual?'RESULT_MISSING':before?'LOCAL_TIME_ONLY_UNVERIFIED':'NOT_PROVEN_PRE_DRAW'};
     });
     const evaluated=rows.filter(r=>r.hits!==null),n=evaluated.length;
     const total=evaluated.reduce((a,r)=>a+r.hits,0),chance=evaluated.reduce((a,r)=>a+r.chance_hit,0);
     const report={software:'V65',type:'LOCAL_PROSPECTIVE_RECONCILIATION_NOT_CERTIFIED',results_source:'user_supplied_csv_unverified',created_at:new Date().toISOString(),n,main_hits:total,chance_hits:chance,expected_main_hits:n*25/49,expected_chance_hits:n/10,independent_timestamp_verified:false,rows};
     window.prospectiveReport=report;
     $('prospectiveExport').disabled=false;
     out.textContent=`${n} prévision(s) locales avec résultat retrouvé, sur ${rows.length} entrées.\n${total} numéros principaux corrects (hasard théorique : ${(n*25/49).toFixed(2)}), ${chance} Chance (théorique : ${(n/10).toFixed(2)}).\nATTENTION : les dates locales, les résultats CSV et l'antériorité ne sont PAS certifiés. Ce n'est pas un bilan prospectif indépendant.\n`+rows.map(r=>`${r.target} : ${r.status}, ${r.hits===null?'résultat absent':r.hits+' numéro(s)'}`).join('\n');
    }catch(e){out.textContent='Échec : '+e.message}
   }).catch(e=>out.textContent='Lecture impossible : '+e.message);
  }catch(e){out.textContent='Échec : '+e.message}
 }
 $('prospectiveRun').onclick=run;
 $('prospectiveExport').onclick=()=>{
  if(!window.prospectiveReport)return;
  const b=new Blob([JSON.stringify(window.prospectiveReport,null,2)],{type:'application/json'}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='bilan-prospectif-local-non-certifie-v65.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 };
})();
