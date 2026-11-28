(function(){
 'use strict';
 function summarize(entries, errors, draws){
  const bad=new Set(errors);
  const dates=new Map();
  for(const entry of entries){
   if(entry?.target)dates.set(entry.target,(dates.get(entry.target)??0)+1);
  }
  const stats={evaluated:0,pending:0,rejected:0,hits:0};
  entries.forEach((entry,index)=>{
   if(bad.has(index+1)||dates.get(entry?.target)!==1||
      typeof entry.lastKnown!=='string'||entry.lastKnown>=entry.target||
      !Number.isFinite(Date.parse(entry.createdAt))){
    stats.rejected++;
    return;
   }
   const {year,month,day,hour}=parisParts(new Date(entry.createdAt));
   const created=year+'-'+month+'-'+day;
   if(created<entry.lastKnown||created>entry.target||(created===entry.target&&Number(hour)>=18)){
    stats.rejected++;
    return;
   }
   const row=draws.get(entry.target);
   if(!row){stats.pending++;return;}
   stats.evaluated++;
   stats.hits+=intersections(entry.numbers,row.slice(1,6));
  });
  return stats;
 }

 async function refresh(){
  const output=document.getElementById('prospectiveDashboard');
  const button=document.getElementById('prospectiveDashboardRefresh');
  if(button.disabled)return;
  button.disabled=true;
  try{
   const draws=new Map(window.LotoHistory.rows().map(row=>[row[0],row]));
   const modules=[['V24',window.Loto24],['X-BIAS V25',window.XBIAS25]];
   const lines=await Promise.all(modules.map(async ([label,module])=>{
    const line=document.createElement('p');
    try{
     const result=await module.audit();
     const stats=summarize(result.a,result.problems??result.bad,draws);
     const expected=(stats.evaluated*25/49).toLocaleString('fr-FR',{maximumFractionDigits:2});
     line.textContent=label+' · '+stats.hits+' bons numéros / '+expected+' attendus au hasard · '+
      stats.evaluated+' évaluée(s), '+stats.pending+' en attente, '+stats.rejected+' exclue(s).';
    }catch(error){
     line.textContent=label+' · Journal indisponible. '+error.message;
    }
    return line;
   }));
   output.replaceChildren(...lines);
  }catch(error){
   output.textContent='Bilan indisponible. '+error.message;
  }finally{
   button.disabled=false;
  }
 }

 document.getElementById('prospectiveDashboardRefresh').addEventListener('click',refresh);
 refresh();
})();
