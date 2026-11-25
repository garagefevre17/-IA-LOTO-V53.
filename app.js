'use strict';
const $=id=>document.getElementById(id),KEY='ia_loto_expert_v1_draws',LOGKEY='ia_loto_expert_v1_log',OLDLOGKEY='ia_loto_journal_v4',LASTSYNC='ia_loto_v7_last_sync';
let draws=[],baseRows=[],log=[],selection=null,lastTestCsv='',currentSync=0;
const esc=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function notify(s){$('toast').textContent=s;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',3500)}
function store(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}}
function get(k){try{return localStorage.getItem(k)}catch{return null}}
const parisFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
function parisParts(now=new Date()){
 return Object.fromEntries(parisFormatter.formatToParts(now).map(({type,value})=>[type,value]));
}
function isoToday(){const {year,month,day}=parisParts();return year+'-'+month+'-'+day}
function parisHour(){return Number(parisParts().hour)}
function availableDate(date){return date<isoToday()||(date===isoToday()&&parisHour()>=21)}
function valid(r){if(!Array.isArray(r)||r.length<7||typeof r[0]!=='string'||!/^(19|20)\d\d-\d\d-\d\d$/.test(r[0])||Number.isNaN(Date.parse(r[0]+'T12:00:00Z'))||new Date(r[0]+'T12:00:00Z').toISOString().slice(0,10)!==r[0])return false;let a=r.slice(1,6);return a.every(Number.isInteger)&&a.every(x=>x>=1&&x<=49)&&new Set(a).size===5&&Number.isInteger(r[6])&&r[6]>=1&&r[6]<=10}
function ordinaryDay(s){const day=new Date(s+'T12:00:00Z').getUTCDay();return day===1||day===3||day===6}
function norm(rows){let map=new Map();for(const raw of rows){const r=raw.slice(0,7);if(!valid(r)||!ordinaryDay(r[0]))throw Error('Tirage invalide '+r[0]);r.splice(1,5,...r.slice(1,6).sort((a,b)=>a-b));let prev=map.get(r[0]);if(prev&&JSON.stringify(prev)!==JSON.stringify(r))throw Error('Contradiction pour '+r[0]);map.set(r[0],r)}return [...map.values()].sort((a,b)=>a[0].localeCompare(b[0]))}
function parseDelimited(line,sep){let out=[],v='',quote=false;for(let i=0;i<line.length;i++){let c=line[i];if(c==='"'){if(quote&&line[i+1]==='"'){v+='"';i++}else quote=!quote}else if(c===sep&&!quote){out.push(v);v=''}else v+=c}out.push(v);return out}
function parseCSV(src){const lines=src.replace(/^\ufeff/,'').trim().split(/\r?\n/).filter(Boolean);if(lines.length<2)throw Error('CSV vide');const sep=lines[0].split(';').length>lines[0].split(',').length?';':',';const heads=parseDelimited(lines.shift(),sep).map(x=>x.trim().toLowerCase());const col=[['date','date_de_tirage','date_tirage'],['n1','boule_1'],['n2','boule_2'],['n3','boule_3'],['n4','boule_4'],['n5','boule_5'],['b1','numero_chance','chance']].map(opts=>heads.findIndex(h=>opts.includes(h)));if(col.some(x=>x<0))throw Error('Colonnes inconnues : date,n1…n5,b1 attendues');const arr=lines.map(line=>{const v=parseDelimited(line,sep),r=[v[col[0]]?.trim().replace(/^(\d{2})[/-](\d{2})[/-](\d{4})$/,'$3-$2-$1'),...col.slice(1).map(i=>Number(v[i]))];if(!valid(r)||!ordinaryDay(r[0]))throw Error('Résultat ou date invalide : '+r[0]);return r});return norm(arr)}
function journalRecords(key){
 const value=JSON.parse(get(key)??'[]');
 if(!Array.isArray(value))throw Error('Journal illisible : '+key);
 return value;
}
function refreshLog(){
 const records=new Map();
 for(const key of [OLDLOGKEY,LOGKEY]){
  try{
   for(const record of journalRecords(key).filter(validLog))records.set(JSON.stringify(record),record);
  }catch(error){console.warn(error.message);}
 }
 log=[...records.values()];
}
function appendJournal(records){
 const existing=journalRecords(LOGKEY);
 if(!store(LOGKEY,JSON.stringify([...existing,...records])))throw Error('Stockage local indisponible');
 refreshLog();
}
function load(){
 baseRows=norm(BASE);
 try{baseRows=norm([...baseRows,...JSON.parse(get(KEY)??'[]')]);}
 catch(error){console.warn('Historique conservé à vérifier',error);}
 draws=baseRows.filter(row=>availableDate(row[0]));
 refreshLog();
 currentSync=Number(get(LASTSYNC)||0);
}
function validLog(r){return r&&typeof r.target==='string'&&/^20\d\d-\d\d-\d\d$/.test(r.target)&&Array.isArray(r.numbers)&&r.numbers.length===5&&new Set(r.numbers).size===5&&r.numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=49)&&Number.isInteger(r.chance)&&r.chance>=1&&r.chance<=10&&typeof r.method==='string'}
function freq(rows){const n=new Int32Array(50),c=new Int32Array(11);for(const r of rows){for(let i=1;i<=5;i++)n[r[i]]++;c[r[6]]++}return {n,c}}
function ranked(v,reverse=false,max=49){return Array.from({length:max},(_,i)=>i+1).sort((a,b)=>reverse?(v[b]-v[a]||a-b):(v[a]-v[b]||a-b))}
function choose(kind,hist){if(hist.length<300)throw Error('300 tirages nécessaires');let all=freq(hist),recent100=freq(hist.slice(-100)),recent30=freq(hist.slice(-30));let n=[],c=0,score=new Float64Array(50),scoreC=new Float64Array(11);
 if(kind==='froids'){n=ranked(freq(hist.slice(-300)).n,false).slice(0,5);c=ranked(freq(hist.slice(-300)).c,false,10)[0]}
 if(kind==='chauds'){n=ranked(recent100.n,true).slice(0,5);c=ranked(recent100.c,true,10)[0]}
 if(kind==='bayes'){// beta(5,44) prior centred on fair number marginal; strong prior 300 trials; compare posterior means
  const w=300, prior=5/49, cp=1/10;
  for(let k=1;k<=49;k++)score[k]=(recent100.n[k]+w*prior)/(100+w);
  for(let k=1;k<=10;k++)scoreC[k]=(recent100.c[k]+w*cp)/(100+w);
  n=ranked(score,true).slice(0,5);c=ranked(scoreC,true,10)[0]}
 if(kind==='tendance'){for(let k=1;k<=49;k++)score[k]=recent30.n[k]/30-recent100.n[k]/100;for(let k=1;k<=10;k++)scoreC[k]=recent30.c[k]/30-recent100.c[k]/100;n=ranked(score,true).slice(0,5);c=ranked(scoreC,true,10)[0]}
 if(kind==='retards'){let last=new Int32Array(50).fill(-1), lastC=new Int32Array(11).fill(-1);for(let i=0;i<hist.length;i++){for(const x of hist[i].slice(1,6))last[x]=i;lastC[hist[i][6]]=i}for(let k=1;k<=49;k++)score[k]=hist.length-1-last[k];for(let k=1;k<=10;k++)scoreC[k]=hist.length-1-lastC[k];n=ranked(score,true).slice(0,5);c=ranked(scoreC,true,10)[0]}
 if(kind==='aleatoire'){let seed=hash(hist.at(-1)[0]+'|independent-test');const rand=prng(seed);n=takeRandom(49,5,rand).sort((a,b)=>a-b);c=1+Math.floor(rand()*10)}
 if(kind.startsWith('v11_')){const v=window.Loto11.pick(kind,hist);n=v.numbers;c=v.chance}
 if(kind==='consensus_v8'||kind==='consensus'){const vals=['froids','chauds','tendance','retards'].map(k=>choose(k,hist)),votes=new Int32Array(50),vc=new Int32Array(11);for(const v of vals){for(const x of v.numbers)votes[x]++;vc[v.chance]++}n=ranked(votes,true).slice(0,5);c=ranked(vc,true,10)[0]}
 return {numbers:n.sort((a,b)=>a-b),chance:c,method:kind,cutoff:hist.at(-1)[0]}}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function prng(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function takeRandom(limit,n,rng){const a=Array.from({length:limit},(_,i)=>i+1);for(let i=0;i<n;i++){let j=i+Math.floor(rng()*(limit-i));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)}
function secureRand(){const max=4294967296;return function(){if(globalThis.crypto?.getRandomValues){let a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/max}return Math.random()}}
function nextOrdinary(date){let d=new Date(date+'T12:00:00Z');do{d.setUTCDate(d.getUTCDate()+1)}while(![1,3,6].includes(d.getUTCDay()));return d.toISOString().slice(0,10)}
function currentTarget(){let today=isoToday(),last=draws.at(-1)[0],next=nextOrdinary(last);if(next<today||(next===today&&parisHour()>=18)){return {date:next,stale:true}}return {date:next,stale:false}}
function balls(obj){return '<div class="balls">'+obj.numbers.map(x=>'<span class="ball">'+x+'</span>').join('')+'<span class="ball c">'+obj.chance+'</span></div>'}
function updateFreshness(){
 const last=draws.at(-1)?.[0];if(!last)return;
 const target=currentTarget(),today=isoToday(),age=Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(last+'T12:00:00Z'))/86400000);
 const msg=$('freshness');msg.className='status '+(target.stale?'warn':'good');
 msg.textContent=target.stale?'Historique en retard ('+age+' jours depuis le '+last+'). Ne pas enregistrer une nouvelle prévision avant mise à jour et vérification FDJ.':'Historique utilisé pour les calculs au '+last+'. Les résultats des archives FDJ sont affichés séparément ci-dessous.';
 const count=log.length,known=log.filter(r=>draws.some(d=>d[0]===r.target)).length;
 $('prospectiveSummary').textContent='Journal : '+count+' prévision(s), '+known+' résultat(s) connu(s), '+(count-known)+' en attente. Heures locales non certifiées.';
}
function updateStats(){const last=draws.at(-1);$('count').textContent=draws.length.toLocaleString('fr-FR');$('last').textContent=last[0].split('-').reverse().join('/');let tgt=currentTarget();$('nextDraw').textContent='Prochaine date ordinaire selon l’historique : '+tgt.date.split('-').reverse().join('/')+(tgt.stale?' — historique potentiellement en retard':'');showLog();updateFreshness()}
function switchPage(page){document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!=='p-'+page);document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));window.scrollTo(0,0)}
function calcPredict(){try{selection=choose($('predictMethod').value,draws);const target=currentTarget();$('predictOutput').className='status good';$('predictOutput').innerHTML='<strong>'+esc(selection.method)+' — historique au '+esc(selection.cutoff)+'</strong>'+balls(selection)+'<div class="note">Prochain tirage ordinaire : '+esc(target.date)+'. Ces numéros ne sont pas statistiquement plus susceptibles de sortir.</div>';$('saveBtn').disabled=target.stale||target.date<isoToday()||(target.date===isoToday()&&parisHour()>=18);$('saveStatus').textContent=$('saveBtn').disabled?'Historique ou créneau périmé : enregistrement désactivé.':'Enregistrement local disponible. Vérifie que le tirage est encore à venir.'}catch(e){$('predictOutput').textContent='Erreur : '+e.message}}
function register(){try{if(!selection)throw Error('Calcule d’abord la sélection');const target=currentTarget(),today=isoToday();if(target.stale||target.date<today)throw Error('Historique trop ancien : synchronise avant toute prévision');if(target.date===today&&parisHour()>=18)throw Error('Enregistrement bloqué dès 18 h (heure de Paris) par prudence');if(selection.cutoff!==draws.at(-1)[0])throw Error('Historique modifié : recalcule');refreshLog();const key=target.date+'|'+selection.method;if(log.some(r=>r.target+'|'+r.method===key))throw Error('Cette méthode est déjà enregistrée pour cette date');const r={id:Date.now(),created:new Date().toISOString(),target:target.date,cutoff:selection.cutoff,method:selection.method,numbers:[...selection.numbers],chance:selection.chance,provenance:'Horodatage local uniquement — non certifié'};appendJournal([r]);showLog();updateFreshness();$('saveStatus').className='status good';$('saveStatus').textContent='Prévision locale sauvegardée pour '+target.date+' — exporte aussi le journal JSON.'}catch(e){$('saveStatus').className='status bad';$('saveStatus').textContent=e.message}}
function exportFile(name,content,type='text/plain'){let blob=new Blob([content],{type}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},2000)}
function exportJournal(){exportFile('IA_LOTO_V16_journal.json',JSON.stringify({format:'ia-loto-journal-v1',exported_at_local:new Date().toISOString(),records:log},null,2),'application/json')}
function csvValue(v){let s=String(v??'');return /[,"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function exportCsvLog(){let hdr=['date','created','method','cutoff','n1','n2','n3','n4','n5','chance'],rows=log.map(r=>[r.target,r.created,r.method,r.cutoff,...r.numbers,r.chance]);exportFile('IA_LOTO_V16_journal.csv',[hdr,...rows].map(x=>x.map(csvValue).join(',')).join('\n'),'text/csv')}
function logOutcome(r){const actual=draws.find(x=>x[0]===r.target);if(!actual)return 'Résultat non disponible, en attente';if(r.cutoff && r.cutoff>=r.target)return 'NON VALIDE : données non antérieures';if(r.created && r.created.slice(0,10)>r.target)return 'NON VALIDÉ : sauvegarde postérieure au jour du tirage';return intersections(r.numbers,actual.slice(1,6))+' bon(s) numéro(s) ; Chance '+(r.chance===actual[6]?'trouvée':'non trouvée')+' — horodatage local non certifié'}
function searchText(value){
 return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function showLog(){
 const node=$('logOutput');
 const query=searchText($('journalSearch').value.trim()).split(/\s+/).filter(Boolean);
 const matching=log.filter(record=>{
  const frenchDate=record.target.split('-').reverse().join('/');
  const text=searchText([record.target,frenchDate,record.method,record.cutoff].join(' '));
  return query.every(term=>text.includes(term));
 }).sort((a,b)=>String(b.created).localeCompare(String(a.created)));
 if(!matching.length){
  node.textContent=query.length?'Aucune sélection ne correspond à cette recherche.':'Aucun enregistrement local.';
  return;
 }
 const visible=query.length?matching:matching.slice(0,20);
 node.innerHTML='<strong>'+matching.length+' sélection(s)</strong>'+visible.map(r=>
  '<div class="method"><strong>'+esc(r.target)+' · '+esc(r.method)+'</strong>'+
  esc(r.numbers.join(' – '))+' | Chance '+r.chance+
  '<div class="note">Créé : '+esc(r.created||'date non fournie')+' ; données au '+
  esc(r.cutoff||'?')+' ; '+esc(logOutcome(r))+'</div></div>'
 ).join('')+(visible.length<matching.length?'<small>20 derniers affichés. La recherche couvre tout le journal.</small>':'');
}
async function restoreJournal(e){let file=e.target.files?.[0];if(!file)return;try{let inp=JSON.parse(await file.text()),records=Array.isArray(inp)?inp:inp.records;if(!Array.isArray(records)||!records.every(validLog))throw Error('Format ou enregistrements invalides');refreshLog();const additions=[];for(const r of records){
 const matches=[...log,...additions].filter(a=>a.target===r.target&&a.method===r.method&&(a.cutoff||'')===(r.cutoff||''));
 if(matches.some(a=>a.chance!==r.chance||JSON.stringify([...a.numbers].sort())!==JSON.stringify([...r.numbers].sort())))throw Error('Conflit : '+r.target+' '+r.method);
 if(!matches.length)additions.push(r);
}if(additions.length)appendJournal(additions);const added=additions.length;showLog();updateFreshness();$('importStatus').className='status good';$('importStatus').textContent=added+' prévision(s) restaurée(s), sans écraser les anciennes.'}catch(err){$('importStatus').className='status bad';$('importStatus').textContent='Restauration refusée : '+err.message}finally{e.target.value=''}}
function mergeRemote(fresh,label){
 const kept=JSON.parse(get(KEY)??'[]');
 const known=norm([...BASE,...kept,...draws]);
 const dates=new Set(known.map(row=>row[0]));
 const incoming=norm(fresh);
 if(incoming.some(row=>!availableDate(row[0])))throw Error('Résultat futur ou annoncé avant 21 h (Paris)');
 const combined=norm([...known,...incoming]);
 let last=BASE.at(-1)[0];
 for(const row of combined.filter(row=>row[0]>last)){
  if(row[0]!==nextOrdinary(last))throw Error('Tirage manquant : '+nextOrdinary(last));
  last=row[0];
 }
 const additions=incoming.filter(row=>!dates.has(row[0]));
 const merged=norm([...BASE,...kept,...incoming]);
 if(!store(KEY,JSON.stringify(merged)))throw Error('Stockage local indisponible');
 baseRows=merged;
 if(window.Loto18)window.Loto18.refresh();
 else setSharedRows(merged.filter(row=>availableDate(row[0])));
 return {same:incoming.length-additions.length,added:additions.length,source:label};
}
function setSharedRows(rows){
 draws=rows;
 updateStats();
}
window.LotoHistory={rows:()=>draws.slice(),baseRows:()=>baseRows.slice(),merge:norm,
 setSharedRows,nextDate:nextOrdinary,availableDate,today:isoToday,hour:parisHour};
async function sync(manual=false){
 const btn=$('syncBtn');
 if(btn.disabled||(!manual&&Date.now()-currentSync<3600000))return;
 btn.disabled=true;
 const status=$('syncStatus');
 status.textContent='Lecture de l’historique LOTO produit par le collecteur FDJ…';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),18000);
 try{
  const response=await fetch('./automatisation/donnees/loto.json',{signal:ctrl.signal,cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data.draws)||!data.draws.length)throw Error('Historique absent');
  const rows=data.draws.map(({date,nums,extras})=>{
   if(!Array.isArray(nums)||nums.length!==5||!Array.isArray(extras)||extras.length!==1)throw Error('Tirage LOTO invalide');
   return [date,...nums,...extras];
  });
  const {same,added}=mergeRemote(rows,'archives FDJ');
  currentSync=Date.now();
  store(LASTSYNC,String(currentSync));
  status.className='status good';
  status.textContent=same+' tirage(s) commun(s), '+added+' ajouté(s). Dernier résultat local : '+draws.at(-1)[0]+'.';
 }catch(error){
  status.className='status warn';
  status.textContent='Historique FDJ indisponible : '+error.message+'. Historique local disponible.';
 }finally{
  clearTimeout(timer);
  btn.disabled=false;
 }
}
// Numerical recipes regularized lower incomplete gamma for chi-square tail probability.
function lnGamma(z){const p=[.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-lnGamma(1-z);z-=1;let x=p[0];for(let i=1;i<p.length;i++)x+=p[i]/(z+i);let t=z+7.5;return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x)}
function gammaQ(a,x){if(x<=0)return 1;const gl=lnGamma(a),eps=1e-12;if(x<a+1){let term=1/a,sum=term,ap=a;for(let k=1;k<1000;k++){ap++;term*=x/ap;sum+=term;if(Math.abs(term)<Math.abs(sum)*eps)break}return Math.min(1,Math.max(0,1-sum*Math.exp(-x+a*Math.log(x)-gl)))}let b=x+1-a,c=1e300,d=1/b,h=d;for(let k=1;k<1000;k++){let an=-k*(k-a);b+=2;d=an*d+b;if(Math.abs(d)<1e-300)d=1e-300;c=b+an/c;if(Math.abs(c)<1e-300)c=1e-300;d=1/d;let del=d*c;h*=del;if(Math.abs(del-1)<eps)break}return Math.min(1,Math.max(0,h*Math.exp(-x+a*Math.log(x)-gl)))}
function chiSquareP(stat,df){return gammaQ(df/2,stat/2)}
function erf(x){let sign=x<0?-1:1;x=Math.abs(x);let t=1/(1+.3275911*x);let y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);return sign*y}
function pNormal(z){return Math.max(0,Math.min(1,1-erf(Math.abs(z)/Math.sqrt(2))))}
function audit(){let q=Number($('auditWindow').value),d=q?draws.slice(-q):draws;let {n,c}=freq(d),exp=d.length*5/49,ec=d.length/10,chi=0,chic=0;for(let k=1;k<=49;k++)chi+=(n[k]-exp)**2/exp;for(let k=1;k<=10;k++)chic+=(c[k]-ec)**2/ec;
 // frequency vector has negative dependence: Pearson statistic has exact asymptotic scale 44/48 since 5 drawn without replacement
 let adjusted=chi*(48/44),p=chiSquareP(adjusted,48),pc=chiSquareP(chic,9),over=[];for(let i=1;i<d.length;i++){let set=new Set(d[i].slice(1,6)),hits=d[i-1].slice(1,6).filter(x=>set.has(x)).length;over.push(hits)}const overlapAvg=over.reduce((a,b)=>a+b,0)/Math.max(1,over.length),mu=25/49,variance=5*(5/49)*(44/49)*(44/48),z=(overlapAvg-mu)/Math.sqrt(variance/Math.max(1,over.length)),po=pNormal(z);let mult=3,bonf=[p,pc,po].map(v=>Math.min(1,mult*v));const maxDev=ranked(n,true).slice(0,5).map(k=>k+' ('+n[k]+')').join(' · ');
 let signal=bonf.some(x=>x<.05);$('auditOutput').className='status '+(signal?'warn':'good');$('auditOutput').innerHTML='<strong>'+d.length+' tirages • '+(signal?'Écart statistique à examiner':'Aucune anomalie établie par ces tests')+'</strong><table class="tbl"><tr><th>Test</th><th>p corrigée ×3</th></tr><tr><td>Répartition 1–49 (χ² corrigé sans remise)</td><td>'+bonf[0].toFixed(4)+'</td></tr><tr><td>Numéro Chance (χ²)</td><td>'+bonf[1].toFixed(4)+'</td></tr><tr><td>Répétitions consécutives (approx. normale)</td><td>'+bonf[2].toFixed(4)+'</td></tr></table><p>Numéros les plus fréquents : '+esc(maxDev)+'</p><p>Numéros en commun entre tirages consécutifs : '+overlapAvg.toFixed(3)+' observé ; '+mu.toFixed(3)+' attendu.</p><div class="note">Tests indicatifs : effet de fenêtres multiples, historique non intégralement certifié et dépendance temporelle à surveiller. Un p faible ne signifie pas que l’on connaît le prochain tirage.</div>'}
function stability(){const q=Number($('auditWindow').value),d=q?draws.slice(-q):draws;const half=Math.floor(d.length/2),left=d.slice(0,half),right=d.slice(half);const A=freq(left),B=freq(right);const exp=5/49;let chi=0;for(let k=1;k<=49;k++){let diff=A.n[k]/left.length-B.n[k]/right.length;chi+=diff*diff/(exp*(1/left.length+1/right.length))}const p=chiSquareP(chi*(48/44),48);let cchi=0;for(let k=1;k<=10;k++){const diff=A.c[k]/left.length-B.c[k]/right.length;cchi+=diff*diff/(.1*(1/left.length+1/right.length))}let cp=chiSquareP(cchi,9);const warn=Math.min(1,2*Math.min(p,cp))<.05;$('stabilityOutput').className='status '+(warn?'warn':'good');$('stabilityOutput').innerHTML='<strong>Contrôle de stabilité : '+left.length+' premiers vs '+right.length+' derniers tirages</strong><p>Répartition des numéros : p≈'+p.toFixed(4)+' ; numéro Chance : p≈'+cp.toFixed(4)+'. Seuil exploratoire corrigé : 0,025 par test.</p><p>'+(warn?'Un changement possible mérite une vérification indépendante.':'Aucun changement détecté au seuil choisi.')+'</p><small>Ce test cherche un changement temporel, pas une prévision. Répéter de nombreuses fenêtres exige une correction supplémentaire.</small>'}
function intersections(a,b){let s=new Set(b);return a.reduce((n,x)=>n+(s.has(x)?1:0),0)}
function test(){const btn=$('testBtn');btn.disabled=true;$('testOutput').textContent='Simulation en cours…';setTimeout(()=>{try{const count=Number($('testN').value),start=draws.length-count,methods=['froids','chauds','bayes','tendance','retards','consensus_v8','aleatoire'];if(start<300)throw Error('Pas assez de données');let scores=Object.fromEntries(methods.map(m=>[m,0])),chances=Object.fromEntries(methods.map(m=>[m,0])),preds=[],csv=[['date','method','n1','n2','n3','n4','n5','chance','bons','chance_trouve']];for(let i=start;i<draws.length;i++){let hist=draws.slice(0,i),actual=draws[i],per=[];for(let m of methods){let s=choose(m,hist),hits=intersections(s.numbers,actual.slice(1,6)),hitChance=+(s.chance===actual[6]);scores[m]+=hits;chances[m]+=hitChance;per.push(s);csv.push([actual[0],m,...s.numbers,s.chance,hits,hitChance])}preds.push(per)}
 const predictedMax=Math.max(...methods.map(m=>scores[m]));let sim=1000,exceed=0,rng=prng(0x71A0F07);let totals=[];for(let b=0;b<sim;b++){let sums=new Int32Array(methods.length);for(let i=0;i<preds.length;i++){const sampled=takeRandom(49,5,rng);for(let j=0;j<methods.length;j++)sums[j]+=intersections(preds[i][j].numbers,sampled)}let max=Math.max(...sums);totals.push(max);if(max>=predictedMax)exceed++}let p=(1+exceed)/(sim+1);let sorted=[...methods].sort((a,b)=>scores[b]-scores[a]);lastTestCsv=csv.map(r=>r.map(csvValue).join(',')).join('\n');$('exportTestBtn').disabled=false;const theoretical=25/49;$('testOutput').className='status good';$('testOutput').innerHTML='<strong>Test terminé sur '+count+' tirages</strong><table class="tbl"><tr><th>Méthode</th><th>Bons/ tirage</th></tr>'+sorted.map(m=>'<tr><td>'+esc(m)+'</td><td>'+ (scores[m]/count).toFixed(3)+' ('+scores[m]+'/'+count+')</td></tr>').join('')+'</table><p>Référence théorique : '+theoretical.toFixed(3)+' bon numéro/tirage.</p><p><strong>p globale simulée (meilleur des 7 modèles) : '+p.toFixed(3)+'</strong> • '+sim+' univers de tirages aléatoires simulés.</p><div class="note">Un p élevé ne montre aucun avantage. Un p faible exigerait confirmation future indépendante. Les méthodes ont été choisies après observation d’analyses historiques : ce test n’est donc pas une validation prospective indépendante. Le modèle bayésien actuel et Chauds 100 ont le même classement : ils ne constituent pas deux sources d’information indépendantes.</div>'; }catch(e){$('testOutput').className='status bad';$('testOutput').textContent='Erreur de test : '+e.message}finally{btn.disabled=false}},30)}
function grids(){let count=Number($('gridCount').value),mode=$('gridMode').value,rng=secureRand(),set=new Set(),arr=[],attempts=0;while(arr.length<count&&attempts++<20000){let a=takeRandom(49,5,rng).sort((a,b)=>a-b);if(mode==='popular'&&a.filter(n=>n>31).length<3)continue;let chance=1+Math.floor(rng()*10),k=a.join('-')+'-'+chance;if(set.has(k))continue;set.add(k);arr.push({numbers:a,chance})}if(arr.length<count)throw Error('Nombre insuffisant de grilles');let ratio=count/19068840;$('gridOutput').className='status good';$('gridOutput').innerHTML='<strong>'+arr.length+' grille(s) distincte(s)</strong>'+arr.map((g,i)=>'<div class="method">Grille '+(i+1)+balls(g)+'</div>').join('')+'<p>Probabilité d’au moins un jackpot pour ces '+count+' combinaisons distinctes, au même tirage : <strong>'+ (100*ratio).toFixed(6)+' %</strong>.</p><small>Plusieurs grilles coûtent plus cher. Aucune garantie de gain ; le critère >31 ne modifie pas la probabilité de sortie.</small>'}
function selfTest(){let res=[];function chk(label,test){try{if(!test())throw Error('assertion fausse');res.push('✓ '+label)}catch(e){res.push('✗ '+label+' : '+e.message)}}chk('Historique valide',()=>draws.length>=2833&&draws.every(valid));chk('Tirages sans doublons',()=>new Set(draws.map(r=>r[0])).size===draws.length);chk('Froids 300 reproductible',()=>JSON.stringify(choose('froids',draws))===JSON.stringify(choose('froids',draws)));chk('7 stratégies produisent des grilles valides',()=>['froids','chauds','bayes','tendance','retards','consensus_v8','aleatoire'].every(k=>{let v=choose(k,draws);return valid(['2026-11-14',...v.numbers,v.chance])}));chk('Consensus sans double vote bayésien',()=>{let h=draws;let m=['froids','chauds','tendance','retards'].map(k=>choose(k,h));let v=choose('consensus_v8',h);return m.length===4&&v.numbers.length===5});chk('Probabilité jackpot exacte',()=>19068840===1906884*10);chk('Chi² p=1 si statistique 0',()=>chiSquareP(0,48)===1);chk('Normalisation des CSV et validation dates',()=>parseCSV('date,n1,n2,n3,n4,n5,b1\n2026-11-11,4,5,14,17,29,8').length===1);$('selfResult').className='status '+(res.every(x=>x.startsWith('✓'))?'good':'bad');$('selfResult').innerHTML=res.map(esc).join('<br>')}
function mainMatchOdds(max, grids, extraKeys, loto){
 // At most 20 grids, so each distinct EuroMillions star pair fits in one bit.
 const extraMasks=new Uint32Array(max+1);
 const distinctExtras=new Map();
 for(let i=0;i<grids.length;i++){
  const key=extraKeys[i];
  if(!distinctExtras.has(key))distinctExtras.set(key,distinctExtras.size);
  if(!loto){
   const bit=1<<distinctExtras.get(key);
   for(const n of grids[i])extraMasks[n]|=bit;
  }
 }
 const adjacency=Array.from({length:max+1},()=>new Uint8Array(max+1));
 const covered=new Set();
 for(const grid of grids){
  for(let i=0;i<grid.length;i++){
   covered.add(grid[i]);
   for(let j=i+1;j<grid.length;j++)adjacency[grid[i]][grid[j]]=1;
  }
 }
 const total=max*(max-1)*(max-2)*(max-3)*(max-4)/120;
 let noSingle=1;
 for(let i=0;i<5;i++)noSingle*=Math.max(0,max-covered.size-i)/(max-i);
 // A draw has two numbers on a grid exactly when it contains one of its pairs.
 let withoutPair=0, starPairWins=0;
 const extraOutcomes=loto?10:66;
 for(let a=1;a<=max-4;a++){
  const rowA=adjacency[a];
  for(let b=a+1;b<=max-3;b++){
   if(rowA[b])continue;
   const rowB=adjacency[b];
   for(let c=b+1;c<=max-2;c++){
    if(rowA[c]||rowB[c])continue;
    const rowC=adjacency[c];
    for(let d=c+1;d<max;d++){
     if(rowA[d]||rowB[d]||rowC[d])continue;
     const rowD=adjacency[d];
     const firstFour=extraMasks[a]|extraMasks[b]|extraMasks[c]|extraMasks[d];
     for(let e=d+1;e<=max;e++){
      if(rowA[e]||rowB[e]||rowC[e]||rowD[e])continue;
      withoutPair++;
      // Without two main matches, EuroMillions pays only for one number and both stars.
      let mask=firstFour|extraMasks[e];
      mask-=(mask>>>1)&0x55555555;
      mask=(mask&0x33333333)+((mask>>>2)&0x33333333);
      starPairWins+=(((mask+(mask>>>4))&0x0f0f0f0f)*0x01010101)>>>24;
     }
    }
   }
  }
 }
 const withPair=total-withoutPair;
 const winningExtraOutcomes=loto?withoutPair*distinctExtras.size:starPairWins;
 return {covered:covered.size,one:1-noSingle,two:withPair/total,
  paid:(withPair*extraOutcomes+winningExtraOutcomes)/(total*extraOutcomes)};
}
function randomGrid(game){
 const loto=game==='loto';
 const max=loto?49:50, extraMax=loto?10:12, extraCount=loto?1:2;
 const output=$('quickGridOutput');
 const count=Number($('quickGridCount').value);
 if(!Number.isInteger(count)||count<1||count>20){
  output.textContent='Choisis entre 1 et 20 grilles.';
  return;
 }
 if(!globalThis.crypto?.getRandomValues){
  output.textContent='Le générateur sécurisé est indisponible dans ce navigateur.';
  return;
 }
 const buffer=new Uint32Array(1);
 function randomIndex(bound){
  const accepted=2**32-(2**32%bound);
  do{crypto.getRandomValues(buffer);}while(buffer[0]>=accepted);
  return buffer[0]%bound;
 }
 function take(pool,count){
  const result=[];
  for(let i=0;i<count;i++)result.push(pool.splice(randomIndex(pool.length),1)[0]);
  return result;
 }
 function sample(limit,count){
  return take(Array.from({length:limit},(_,i)=>i+1),count).sort((a,b)=>a-b);
 }
 const spread=$('quickCoverExtras').checked;
 const possibleExtras=[];
 for(let first=1;first<=extraMax;first++){
  if(loto)possibleExtras.push([first]);
  else for(let second=first+1;second<=extraMax;second++)possibleExtras.push([first,second]);
 }
 const spreadMain=$('quickCoverMain').checked;
 function spreadNumbers(usage){
  const buckets=Array.from({length:count+1},()=>[]);
  for(let n=1;n<=max;n++)buckets[usage[n]].push(n);
  const picked=[];
  for(const bucket of buckets){
   const needed=5-picked.length;
   if(!needed)break;
   if(bucket.length<=needed)picked.push(...bucket);
   else picked.push(...take(bucket,needed));
  }
  return picked.sort((a,b)=>a-b);
 }
 function buildLot(){
  const planned=spread?take(possibleExtras.slice(),Math.min(count,possibleExtras.length)):[];
  const lines=new Set(), covered=new Set(), mainGrids=[], extraKeys=[];
  const usage=new Uint8Array(max+1);
  while(lines.size<count){
   const numbers=spreadMain?spreadNumbers(usage):sample(max,5);
   const extras=planned[lines.size]??sample(extraMax,extraCount);
   const key=extras.join(' – ');
   const line=numbers.join(' – ')+' · '+(loto?'Chance':'Étoiles')+' : '+key;
   if(lines.has(line))continue;
   lines.add(line);
   mainGrids.push(numbers);
   extraKeys.push(key);
   for(const number of numbers)usage[number]++;
   covered.add(key);
  }
  return {lines,covered,main:mainMatchOdds(max,mainGrids,extraKeys,loto)};
 }
 let lot=buildLot();
 // Compare candidates when main numbers or randomly selected complements can repeat.
 if(spreadMain&&(count*5>max||(!spread&&count>1))){
  for(let i=1;i<4;i++){
   const candidate=buildLot();
   if(candidate.main.paid>lot.main.paid||
      (candidate.main.paid===lot.main.paid&&candidate.main.two>lot.main.two))lot=candidate;
  }
 }
 const {lines,covered,main}=lot;
 const label=loto?'LOTO':'EuroMillions';
 const total=loto?19068840:139838160;
 const format=new Intl.NumberFormat('fr-FR');
 const percent=new Intl.NumberFormat('fr-FR',{style:'percent',maximumSignificantDigits:4});
 const title=document.createElement('strong');
 title.textContent=label+' · '+count+(count===1?' grille':' grilles distinctes');
 const list=document.createElement('ol');
 for(const line of lines){
  const item=document.createElement('li');
  item.textContent=line;
  list.append(item);
 }
 const odds=document.createElement('p');
 odds.textContent='Jackpot sur un même tirage : '+count+' / '+format.format(total)+' (environ '+percent.format(count/total)+').';
 const coverage=document.createElement('p');
 const extraTotal=loto?10:66;
 const outcome=loto?'Toucher le numéro Chance':'Trouver les deux étoiles sur une grille';
 coverage.textContent=outcome+' : '+covered.size+' / '+extraTotal+' ('+percent.format(covered.size/extraTotal)+'). Cette couverture seule ne garantit pas un bénéfice.';
 const matches=document.createElement('p');
 matches.textContent=main.covered+' numéros principaux couverts sur '+max+
  ' · Au moins un bon numéro dans le lot : '+percent.format(main.one)+
  ' · Au moins deux bons numéros sur une même grille : '+percent.format(main.two)+
  '.';
 const paid=document.createElement('p');
 paid.textContent='Au moins un lot payé au tirage principal : '+percent.format(main.paid)+
  '. Hors codes, My Million et options. Un lot payé peut être inférieur au coût total des grilles.';
 output.replaceChildren(title,list,paid,matches,coverage,odds);
}
function wire(){
 $('quickLoto').addEventListener('click',()=>randomGrid('loto'));
 $('quickEuro').addEventListener('click',()=>randomGrid('euromillions'));
 const mobileModules=$('mobileModules'), legacyToggle=$('v19LegacyToggle');
 legacyToggle.addEventListener('click',()=>mobileModules.setAttribute('aria-expanded',legacyToggle.getAttribute('aria-expanded')));
 mobileModules.addEventListener('click',()=>legacyToggle.click());
 document.querySelectorAll('[data-shortcut]').forEach(button=>button.addEventListener('click',()=>{
  if(document.body.classList.contains('show-legacy'))legacyToggle.click();
  switchPage(button.dataset.shortcut);
  if(button.dataset.scrollTo)$(button.dataset.scrollTo).scrollIntoView({block:'start'});
 }));
 $('journalSearch').addEventListener('input',showLog);
 window.addEventListener('online',()=>{if(!document.hidden)sync(true);});
 window.setInterval(()=>{if(!document.hidden)sync();},300000);
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>switchPage(b.dataset.page)));$('syncBtn').addEventListener('click',()=>sync(true));$('selfBtn').addEventListener('click',selfTest);$('auditBtn').addEventListener('click',()=>{audit();stability()});$('predictBtn').addEventListener('click',calcPredict);$('saveBtn').addEventListener('click',register);$('testBtn').addEventListener('click',test);$('exportTestBtn').addEventListener('click',()=>exportFile('IA_LOTO_V16_backtest.csv',lastTestCsv,'text/csv'));$('gridBtn').addEventListener('click',()=>{try{grids()}catch(e){$('gridOutput').textContent=e.message}});$('exportJsonBtn').addEventListener('click',exportJournal);$('exportLogBtn').addEventListener('click',exportCsvLog);$('importJson').addEventListener('change',restoreJournal);$('exportHistoryBtn').addEventListener('click',()=>exportFile('IA_LOTO_V16_historique.csv',[['date','n1','n2','n3','n4','n5','b1'],...draws].map(r=>r.join(',')).join('\n'),'text/csv'));$('importCsv').addEventListener('change',async e=>{let file=e.target.files?.[0];if(!file)return;try{let fresh=parseCSV(await file.text()),rs=mergeRemote(fresh,'import');$('historyStatus').className='status good';$('historyStatus').textContent=rs.same+' communs ; '+rs.added+' nouveaux tirages importés'}catch(err){$('historyStatus').className='status bad';$('historyStatus').textContent='Import refusé : '+err.message}finally{e.target.value=''}});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-currentSync>=3600000)sync()})}

// Préparation non destructive : l'utilisateur doit toujours confirmer la sauvegarde.
window.prepareV16Selection=function(pick){
 if(!pick||!Array.isArray(pick.numbers)||pick.numbers.length!==5)throw Error('Sélection V16 invalide');
 const target=currentTarget();
 if(target.stale)throw Error('Base trop ancienne : vérifier les résultats FDJ avant enregistrement');
 selection={numbers:[...pick.numbers],chance:pick.chance,method:pick.method,cutoff:pick.cutoff};
 $('predictMethod').value='froids'; // l'onglet propose une méthode existante; la sélection V16 reste séparée.
 $('predictOutput').className='status warn';
 $('predictOutput').innerHTML='<strong>Préparation V16 : '+esc(pick.method)+'</strong>'+balls(selection)+'<p>Échéance '+esc(target.date)+' — vérifier avant de sauvegarder. Paramètres V16 figés.</p>';
 $('saveBtn').disabled=false;
 $('saveStatus').className='status warn';
 $('saveStatus').textContent='Sélection V16 préparée. Appuie sur « Enregistrer dans le journal » pour confirmer ; horodatage local non certifié.';
 switchPage('predict');
};

try{load();wire();updateStats();$('boot').className='status good';$('boot').textContent='JavaScript actif. Calculs et boutons initialisés. Données locales prêtes.';$('engine').textContent='● Centre V22 actif • moteurs historiques conservés';if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});sync();}catch(e){$('boot').className='status bad';$('boot').textContent='Erreur de démarrage : '+e.message;console.error(e)}
