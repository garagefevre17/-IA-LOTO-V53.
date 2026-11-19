/* IA LOTO V16.6 — laboratoire prospectif. Protocole fixé au 14/11/2026.
 * Propose une sauvegarde locale non certifiée, trois références avant tirage.
 * Aucun accès aux résultats du tirage cible lors de la préparation.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id), M=window.Loto16;
const KEY='ia_loto_v166_prospectif_v1', VERSION='16.6', CONFIG={prior:0.95,eta:0.3,lookback:300,history:300};
const NAMES={cold:'Froids 300 figé',adaptive:'Adaptatif V16.5 figé',uniform:'Témoin uniforme'};
const LUN=M?.LOG_UNIFORM ?? Math.log(19068840);
const pos=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>x.toFixed(6).replace('.',',');
function asRows(){if(!M)throw Error('Moteur V16 indisponible');return M.draws()}
function valid(r){return !!r&&/^(20\d\d)-\d\d-\d\d$/.test(r.target)&&Array.isArray(r.methods)&&r.methods.length===3&&r.methods.every(x=>x&&['cold','adaptive','uniform'].includes(x.key)&&Array.isArray(x.numbers)&&x.numbers.length===5&&x.numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=49)&&new Set(x.numbers).size===5&&Number.isInteger(x.chance)&&x.chance>=1&&x.chance<=10)&&r.methods.map(x=>x.key).sort().join(',')==='adaptive,cold,uniform'&&typeof r.cutoff==='string'&&r.cutoff<r.target&&r.version===VERSION&&Array.isArray(r.weights)&&r.weights.length===13&&r.weights.every(w=>typeof w==='number'&&w>=0&&w<=1)}
function read(){try{const r=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(r)?r.filter(valid):[]}catch{return []}}
function write(rows){localStorage.setItem(KEY,JSON.stringify(rows));if(read().length!==rows.length)throw Error('Sauvegarde locale non vérifiée')}
const parisDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const hourParis=()=>+new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',hourCycle:'h23'}).format(new Date());
function nextDay(d){let t=new Date(d+'T12:00:00Z');do{t.setUTCDate(t.getUTCDate()+1)}while(![1,3,6].includes(t.getUTCDay()));return t.toISOString().slice(0,10)}
function targetInfo(){const rows=asRows(),cutoff=rows.at(-1)[0],target=nextDay(cutoff),today=parisDate();return {cutoff,target,today,ready:target>=today&&(target!==today||hourParis()<18)}}
function normalize(logs){const max=Math.max(...logs);const a=logs.map(v=>Math.exp(v-max)),sum=a.reduce((s,v)=>s+v,0);return a.map(v=>v/sum)}
function weightsAtCutoff(rows){const n=M.CANDIDATES.length,logw=[Math.log(CONFIG.prior),...Array(n).fill(Math.log((1-CONFIG.prior)/n))];
  // Seuls les tirages antérieurs à la date cible entrent dans le calcul.
  const start=Math.max(300,rows.length-CONFIG.history);
  for(let i=start;i<rows.length;i++){
    const previous=rows.slice(i-300,i),result=rows[i];
    for(let j=0;j<n;j++){
      const model=M.make(previous,M.CANDIDATES[j].type,M.CANDIDATES[j].beta);
      logw[j]-=CONFIG.eta*(-M.logProb(model,result)-LUN);
    }
    const z=Math.max(...logw);for(let j=0;j<logw.length;j++)logw[j]-=z;
  }
  return normalize(logw);
}
function inclusion(model,i){let e=[1,0,0,0,0],k;for(let j=1;j<=49;j++){if(i===j)continue;for(k=4;k>=1;k--)e[k]+=model.w[j]*e[k-1]}return model.w[i]*e[4]/model.e5}
function adaptivePick(rows,weights){const score=Array(50).fill(0),chance=Array(11).fill(0);
  for(let i=1;i<=49;i++)score[i]+=weights[0]*5/49;
  for(let i=1;i<=10;i++)chance[i]+=weights[0]/10;
  for(let k=0;k<M.CANDIDATES.length;k++){
    if(weights[k+1]<1e-12)continue;
    const cfg=M.CANDIDATES[k],m=M.make(rows.slice(-300),cfg.type,cfg.beta);
    for(let i=1;i<=49;i++)score[i]+=weights[k+1]*inclusion(m,i);
    for(let i=1;i<=10;i++)chance[i]+=weights[k+1]*m.v[i]/m.vtotal;
  }
  const numbers=Array.from({length:49},(_,i)=>i+1).sort((a,b)=>score[b]-score[a]||a-b).slice(0,5).sort((a,b)=>a-b);
  const ch=Array.from({length:10},(_,i)=>i+1).sort((a,b)=>chance[b]-chance[a]||a-b)[0];
  return {key:'adaptive',numbers,chance:ch};
}
function fairPick(){if(!crypto?.getRandomValues)throw Error('Générateur cryptographique requis');const rng=(limit)=>{
    const max=4294967296,cut=max-(max%limit);let v;do{v=new Uint32Array(1);crypto.getRandomValues(v);v=v[0]}while(v>=cut);return v%limit;
  };const a=Array.from({length:49},(_,i)=>i+1);for(let i=0;i<5;i++){const j=i+rng(49-i);[a[i],a[j]]=[a[j],a[i]]}
  return {key:'uniform',numbers:a.slice(0,5).sort((a,b)=>a-b),chance:1+rng(10)};
}
function coldPick(rows){const freq=Array(50).fill(0),ch=Array(11).fill(0);for(const r of rows.slice(-300)){for(let i=1;i<=5;i++)freq[r[i]]++;ch[r[6]]++}
  return {key:'cold',numbers:Array.from({length:49},(_,i)=>i+1).sort((a,b)=>freq[a]-freq[b]||a-b).slice(0,5).sort((a,b)=>a-b),chance:Array.from({length:10},(_,i)=>i+1).sort((a,b)=>ch[a]-ch[b]||a-b)[0]};
}
async function sha(s){const b=new TextEncoder().encode(s),out=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(out)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function display(){const t=targetInfo(),all=read(),n=all.filter(x=>x.target===t.target).length;
  const el=$('v166State');el.className='status '+(t.ready?'good':'warn');el.textContent=`Historique : ${t.cutoff} · prochain tirage selon les données : ${t.target}. ${t.ready?'Préparation autorisée localement.':'Préparation BLOQUÉE : historique périmé ou tirage déjà commencé.'} ${n?'Date déjà enregistrée : impossible de la remplacer.':''}`;
  $('v166Prepare').disabled=!t.ready||n>0;
  report();
}
function balls(r){return r.numbers.map(n=>`<span class="ball">${n}</span>`).join('')+`<span class="ball c">${r.chance}</span>`}
async function prepare(){const b=$('v166Prepare');b.disabled=true;$('v166Prepared').textContent='Calcul, empreinte et sauvegarde en cours…';
 try{const t=targetInfo(),rows=asRows(),all=read();if(!t.ready||all.some(x=>x.target===t.target))throw Error('Tirage passé, données obsolètes ou prévision déjà enregistrée');
  const weights=weightsAtCutoff(rows);const methods=[coldPick(rows),adaptivePick(rows,weights),fairPick()];
  const archived=rows.map(r=>r.slice(0,7));const cutoffHash=await sha(JSON.stringify(archived));
  const entry={version:VERSION,protocol:'V166-v1-20261114',target:t.target,cutoff:t.cutoff,created:new Date().toISOString(),cutoffHash,config:CONFIG,weights,methods};
  entry.recordHash=await sha(JSON.stringify(entry));
  // Contrôle après calcul : aucune sortie postérieure et même tirage à préparer.
  const now=targetInfo();if(!now.ready||now.target!==t.target||now.cutoff!==t.cutoff)throw Error('Situation changée durant la préparation');
  if(!valid(entry))throw Error('Journal invalide');
  write([...all,entry]);
  $('v166Prepared').className='status good';$('v166Prepared').innerHTML='<strong>Trois méthodes figées pour le '+pos(entry.target)+'</strong>'+entry.methods.map(m=>'<p><b>'+pos(NAMES[m.key])+'</b></p><div class="balls">'+balls(m)+'</div>').join('')+'<small>Empreinte SHA-256 du journal : '+entry.recordHash+'. Exporter immédiatement le JSON et publier l’empreinte ailleurs avant le tirage pour une preuve indépendante.</small>';
  display();
 }catch(e){$('v166Prepared').className='status bad';$('v166Prepared').textContent='Sauvegarde impossible : '+e.message;display()}finally{b.disabled=false;const t=targetInfo();b.disabled=!t.ready||read().some(x=>x.target===t.target)}
}
function score(record,actual){const idx=asRows().findIndex(r=>r[0]===record.cutoff),rows=asRows().slice(0,idx+1);if(idx<300)return null;
  const losses=[-LUN];for(const cfg of M.CANDIDATES){const m=M.make(rows.slice(-300),cfg.type,cfg.beta);losses.push(M.logProb(m,actual))}
  const terms=record.weights.map((w,i)=>w*Math.exp(losses[i]+LUN)),mix=terms.reduce((a,b)=>a+b,0);
  return mix>0 ? -Math.log(mix):null; // écart de perte modèle - uniforme (négatif meilleur)
}
function evaluate(){let all=read(),available=new Map(asRows().map(r=>[r[0],r]));return all.map(r=>{
    const actual=available.get(r.target);let status='En attente du résultat officiel';if(actual&&actual[0]>r.cutoff)status='Résultat présent dans la base locale (source à vérifier FDJ)';
    const meth=actual?r.methods.map(m=>({key:m.key,hits:m.numbers.filter(n=>actual.slice(1,6).includes(n)).length,chance:+(m.chance===actual[6])})):[];
    return {r,status,meth,delta:actual?score(r,actual):null};
  });
}
function report(){const ev=evaluate(),ready=ev.filter(x=>x.meth.length),n=ready.length;
  const all=ev.map(x=>`<div class="method"><b>${pos(x.r.target)} · ${pos(x.r.cutoff)} → ${pos(x.status)}</b>`+
      (x.meth.length?x.meth.map(m=>`<p>${pos(NAMES[m.key])} : ${m.hits}/5 · Chance ${m.chance?'correct':'incorrect'}</p>`).join('')+`<p>Écart de log-perte adaptatif − hasard : ${x.delta===null?'non disponible':num(x.delta)}</p>`:'')+'</div>').join('');
  $('v166Report').innerHTML=`<b>${ev.length} date(s) enregistrée(s), ${n} avec résultat local, ${ev.length-n} en attente.</b>`+all+'<small>Ne pas interpréter un ou deux tirages comme preuve de supériorité. Tirages potentiellement issus d’une synchronisation non officielle.</small>';
}
function download(name,contents,type){const b=new Blob([contents],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},3000)}
function exportJson(){download('IA_LOTO_V16_6_protocole_prospectif.json',JSON.stringify({format:'ia-loto-v166-prospective-v1',exported:new Date().toISOString(),records:read()},null,2),'application/json')}
function csv(){const rows=[['date','methode','n1','n2','n3','n4','n5','chance','bons','chance_correct','delta_log_loss_adaptatif','statut']];for(const x of evaluate())for(const m of x.r.methods){const result=x.meth.find(t=>t.key===m.key);rows.push([x.r.target,m.key,...m.numbers,m.chance,result?.hits??'',result?.chance??'',m.key==='adaptive'?(x.delta??''):'',x.status])}
 const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';download('IA_LOTO_V16_6_resultats.csv','\ufeff'+rows.map(r=>r.map(quote).join(';')).join('\r\n'),'text/csv;charset=utf-8')}
async function restore(e){const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());if(data.format!=='ia-loto-v166-prospective-v1'||!Array.isArray(data.records)||!data.records.every(valid))throw Error('Format ou prévisions invalides');
  for(const r of data.records){if(!r.recordHash||await sha(JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k])=>k!=='recordHash'))))!==r.recordHash)throw Error('Empreinte de sauvegarde incohérente')}
  const current=read(),seen=new Map(current.map(r=>[r.target,r]));for(const r of data.records){const before=seen.get(r.target);if(before&&before.recordHash!==r.recordHash)throw Error('Conflit : date existante différente '+r.target);seen.set(r.target,r)}write([...seen.values()]);$('v166Prepared').className='status good';$('v166Prepared').textContent='Sauvegarde fusionnée sans modifier les prévisions existantes.';display();
 }catch(err){$('v166Prepared').className='status bad';$('v166Prepared').textContent='Import refusé : '+err.message}finally{e.target.value=''}}
$('v166Prepare')?.addEventListener('click',prepare);$('v166Refresh')?.addEventListener('click',display);$('v166Export')?.addEventListener('click',exportJson);$('v166Csv')?.addEventListener('click',csv);$('v166Import')?.addEventListener('change',restore);
try{display()}catch(e){$('v166State').textContent='Erreur : '+e.message}
window.Loto166={targetInfo,weightsAtCutoff,adaptivePick,coldPick,score,evaluate,display};
})();
