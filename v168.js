/* IA LOTO V16.8 — Audit non destructif du journal prospectif.
 * Verify recordHash, cutoffHash, duplicates, chronology and score known results.
 * No prediction changes. All timestamps local/untrusted.
 */
(()=>{'use strict';
 const $=id=>document.getElementById(id), M=window.Loto16, KEY='ia_loto_v166_prospectif_v1';
 const fmt=n=>Number(n).toLocaleString('fr-FR',{maximumFractionDigits:6});
 const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function rows(){if(!M?.draws)throw Error('Historique indisponible');return M.draws()}
 async function sha(value){if(!crypto?.subtle)throw Error('SHA-256 exige une connexion HTTPS');const arr=new TextEncoder().encode(value);const sum=await crypto.subtle.digest('SHA-256',arr);return Array.from(new Uint8Array(sum),b=>b.toString(16).padStart(2,'0')).join('')}
 const canonicalWithoutHash=r=>JSON.stringify(Object.fromEntries(Object.entries(r).filter(([key])=>key!=='recordHash')));
 function rawEntries(){let contents=localStorage.getItem(KEY);if(!contents)return [];let v=JSON.parse(contents);if(!Array.isArray(v))throw Error('Le journal ne contient pas une liste');return v}
 function shape(r){return !!r&&typeof r==='object'&&!Array.isArray(r)&&r.version==='16.6'&&/^20\d\d-\d\d-\d\d$/.test(r.target||'')&&/^20\d\d-\d\d-\d\d$/.test(r.cutoff||'')&&r.cutoff<r.target&&typeof r.recordHash==='string'&&/^[0-9a-f]{64}$/.test(r.recordHash)&&Array.isArray(r.methods)&&r.methods.length===3&&Array.isArray(r.weights)&&r.weights.length===13&&r.weights.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1)&&Math.abs(r.weights.reduce((a,b)=>a+b,0)-1)<1e-6&&r.methods.map(x=>x?.key).sort().join('|')==='adaptive|cold|uniform'&&r.methods.every(m=>Array.isArray(m.numbers)&&m.numbers.length===5&&new Set(m.numbers).size===5&&m.numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=49)&&Number.isInteger(m.chance)&&m.chance>=1&&m.chance<=10)}
 function rowInfo(r,all){const cut=all.findIndex(x=>x[0]===r.cutoff);return {cut,pre:cut>=0?all.slice(0,cut+1):[],outcome:all.find(x=>x[0]===r.target)} }
 async function audit(){const all=rows(),items=rawEntries(),used=new Set(),results=[];
 for(let i=0;i<items.length;i++){
  const r=items[i],error=[],info=shape(r)?rowInfo(r,all):{pre:[],outcome:null};
  if(!shape(r)){error.push('Structure invalide');results.push({index:i+1,target:r?.target??'?',ok:false,error,methods:[]});continue}
  if(used.has(r.target))error.push('Doublon de date');used.add(r.target);
  const computed=await sha(canonicalWithoutHash(r));if(computed!==r.recordHash)error.push('Empreinte de la prévision incorrecte');
  if(info.pre.length===0)error.push('Date de référence absente des données');
  else {const cutoffHash=await sha(JSON.stringify(info.pre.map(x=>x.slice(0,7))));if(cutoffHash!==r.cutoffHash)error.push('Historique de référence différent');}
  if(r.created){const time=Date.parse(r.created);if(!Number.isFinite(time))error.push('Horodatage illisible');else if(new Date(time).toISOString().slice(0,10)>r.target)error.push('Horodatage postérieur à la date cible')}else error.push('Horodatage absent');
  const actual=info.outcome,methods=actual?r.methods.map(m=>({name:m.key,nums:m.numbers,chance:m.chance,hits:m.numbers.filter(n=>actual.slice(1,6).includes(n)).length,chanceHit:Number(m.chance===actual[6])})):[];
  results.push({index:i+1,target:r.target,cutoff:r.cutoff,created:r.created,ok:error.length===0,error,recordHash:r.recordHash,actual:actual?actual.slice(1,7):null,methods});
 }
 return {checkedAt:new Date().toISOString(),records:results,draws:all.length,latest:all.at(-1)?.[0]||'',note:'Empreintes locales, non horodatées par un tiers. Résultats de l’historique local (provenance à vérifier).'};
 }
 function render(a){const box=$('v168Results'),items=a.records,errors=items.filter(x=>!x.ok),assessed=items.filter(x=>x.ok&&x.actual),pending=items.filter(x=>x.ok&&!x.actual);
 let html=`<b>${items.length} prévision(s) prospectives · ${items.length-errors.length} intégrité(s) cohérente(s) · ${errors.length} anomalie(s)</b><p>${assessed.length} évaluable(s) · ${pending.length} en attente.</p>`;
 if(!items.length)html+='<p>Aucune prévision V16.6. Utilise l’onglet V16.6 et exporte immédiatement sa sauvegarde JSON.</p>';
 for(const x of items){html+=`<div class="method"><b>${esc(x.target)} : ${x.ok?'✓ cohérent':'⚠ problème détecté'}</b>`;
 if(x.error?.length)html+='<p>'+x.error.map(esc).join(' ; ')+'</p>';
 if(x.ok&&x.actual){html+=`<p>Résultat local : ${x.actual.slice(0,5).join(' – ')} ; Chance ${x.actual[5]}</p>`+x.methods.map(m=>`<p>${esc(m.name)} : ${m.hits}/5 · Chance ${m.chanceHit?'oui':'non'}</p>`).join('')}
 else if(x.ok)html+='<p>En attente du résultat dans la base.</p>';
 html+='</div>'}
 const totals={};for(const x of assessed)for(const m of x.methods){const z=totals[m.name]??={n:0,hits:0,ch:0};z.n++;z.hits+=m.hits;z.ch+=m.chanceHit}
 if(Object.keys(totals).length){html+='<h3>Bilan sur dates effectivement évaluables</h3><table class="tbl"><tr><th>Méthode</th><th>Bons numéros</th><th>Chance</th></tr>';
 for(const [k,v] of Object.entries(totals))html+=`<tr><td>${esc(k)}</td><td>${v.hits} / ${fmt(v.n*25/49)} attendus</td><td>${v.ch}/${v.n}</td></tr>`;html+='</table>'}
 html+='<p class="note">Les signatures SHA-256 ne prouvent pas l’heure de création ; une copie locale peut être recréée. Les tirages présents localement doivent être rapprochés des archives FDJ. Aucun avantage prédictif démontré.</p>';
 box.className='status '+(errors.length?'warn':'good');box.innerHTML=html;
 }
 let last;
 async function run(){let b=$('v168Run');b.disabled=true;$('v168Results').textContent='Vérification des empreintes en cours…';try{last=await audit();render(last)}catch(e){$('v168Results').className='status bad';$('v168Results').textContent='Contrôle impossible : '+e.message}finally{b.disabled=false}}
 function download(name,contents,type){const u=URL.createObjectURL(new Blob([contents],{type})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},3000)}
 async function exportAudit(){try{const result=last||await audit();download('IA_LOTO_V16_8_AUDIT_PROSPECTIF.json',JSON.stringify(result,null,2),'application/json')}catch(e){$('v168Results').textContent='Export impossible : '+e.message}}
 $('v168Run')?.addEventListener('click',run);$('v168Export')?.addEventListener('click',exportAudit);
 window.Loto168={audit,shape,canonicalWithoutHash,sha};
})();
