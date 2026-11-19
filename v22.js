/* IA LOTO V22 — moteur expérimental avec séparation chronologique et témoin.
   Aucun apprentissage sur la période d'évaluation ; aucune supériorité affirmée. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const METHODS=['froids','chauds','tendance','retards','consensus'];
const NAMES={froids:'Froids 300 (figé)',chauds:'Chauds 100',tendance:'Tendance 30/100',retards:'Retards',consensus:'Consensus 4 stratégies'};
const esc22=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastReport=null;
function source(){if(!window.Loto18?.allRows)throw Error('Moteur de données V18 indisponible');const rows=window.Loto18.allRows();if(rows.length<1200)throw Error('Historique insuffisant');for(let i=1;i<rows.length;i++)if(rows[i-1][0]>=rows[i][0])throw Error('Historique non chronologique ou doublons');return rows;}
function correct(p,r){return {hits:p.numbers.filter(n=>r.slice(1,6).includes(n)).length,chance:+(p.chance===r[6])};}
function compute(rows,start,end,kind){let hits=0,chance=0,per=[];for(let t=start;t<end;t++){const p=choose(kind,rows.slice(0,t));const v=correct(p,rows[t]);hits+=v.hits;chance+=v.chance;per.push(v.hits);}return {hits,chance,per,n:end-start};}
function seeded(seed){let s=seed>>>0;return()=>{s+=0x6d2b79f5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function bootstrap(values){let rand=seeded(0x22abc987),n=values.length,means=[];for(let b=0;b<1500;b++){let total=0;for(let i=0;i<n;i++)total+=values[Math.floor(rand()*n)];means.push(total/n);}means.sort((a,b)=>a-b);return [means[37],means[1462]];}
function balls(p){return '<div class="balls">'+p.numbers.map(n=>'<span class="ball">'+n+'</span>').join('')+'<span class="ball c">'+p.chance+'</span></div>';}
function stale(rows){const last=rows.at(-1)[0],today=isoToday(),next=nextOrdinary(last);return {last,next,late:next<today||next===today&&parisHour()>=18};}
function run(){const out=$('v22Result'),size=Number($('v22Holdout').value),trainSize=500;out.className='status';out.textContent='Calcul chronologique en cours…';try{const rows=source(),end=rows.length,start=end-size,trainStart=start-trainSize;if(trainStart<300)throw Error('Historique insuffisant pour la séparation chronologique');
 // Les modèles sont figés AVANT le début du test. Le test ne choisit pas son gagnant.
 const training=METHODS.map(k=>({...compute(rows,trainStart,start,k),kind:k})).sort((a,b)=>b.hits-a.hits||METHODS.indexOf(a.kind)-METHODS.indexOf(b.kind));const selected=training[0].kind;
 const test=compute(rows,start,end,selected),cold=compute(rows,start,end,'froids'),comparator=compute(rows,start,end,'aleatoire');
 const ci=bootstrap(test.per.map((v,i)=>v-comparator.per[i]));const diff=(test.hits-comparator.hits)/size;
 const h=rows.slice(0,start).at(-1)[0];const temporal=stale(rows);const future=temporal.late?'<strong>Historique ou heure limite dépassé(e) : aucun enregistrement prospectif permis.</strong>':'Prochain tirage indicatif : '+temporal.next+'. Enregistrement prospectif à effectuer uniquement avant le tirage.';
 const pick=choose(selected,rows),fixed=choose('froids',rows);
 const table=(label,s)=>`<tr><td>${esc22(label)}</td><td>${s.hits}/${size}</td><td>${s.chance}/${size}</td></tr>`;
 const trust=ci[0]>0?'Écart positif sur cette fenêtre mais non confirmé prospectivement.':'Aucun avantage statistique clair face au témoin sur cette fenêtre.';
 out.innerHTML=`<strong>Contrôle chronologique — ${size} tirages</strong><p>Entraînement : ${rows[trainStart][0]} au ${h} (${trainSize} tirages). Contrôle : ${rows[start][0]} au ${rows[end-1][0]} (${size} tirages). Aucun résultat du contrôle n’est utilisé pour choisir la méthode.</p><p>Méthode retenue à l'entraînement : <b>${esc22(NAMES[selected])}</b> (${training[0].hits}/${trainSize} numéros trouvés sur l'entraînement).</p><table class="tbl"><thead><tr><th>Méthode</th><th>Bons numéros</th><th>Chance</th></tr></thead><tbody>${table('Méthode retenue',test)}${table('Froids 300 (référence)',cold)}${table('Hasard reproductible',comparator)}</tbody></table><p>Écart au témoin : <b>${diff>=0?'+':''}${diff.toFixed(3)}</b> bon numéro/tirage. Intervalle bootstrap descriptif à 95 % : [${ci[0].toFixed(3)} ; ${ci[1].toFixed(3)}].</p><p><b>${esc22(trust)}</b></p><p class="note">Les méthodes et données historiques ont déjà été étudiées dans les anciennes versions ; cette expérience reste rétrospective, pas une validation prospective indépendante. Le témoin est pseudorandomisé de façon reproductible. Son score peut fluctuer.</p><hr><strong>Sélection exploratoire sur l'historique courant — ${esc22(NAMES[selected])}</strong>${balls(pick)}<strong>Référence Froids 300 (inchangée)</strong>${balls(fixed)}<p class="note">${future} Ni cette sélection ni la référence n’ont une probabilité de jackpot supérieure démontrée à 1/19 068 840.</p>`;
 out.className='status good';lastReport={version:'22.0',generatedAt:new Date().toISOString(),sourceLast:temporal.last,train:{first:rows[trainStart][0],last:h,n:trainSize},test:{first:rows[start][0],last:rows[end-1][0],n:size},selected,training:training.map(s=>({method:s.kind,hits:s.hits,chance:s.chance})),score:{selected:{hits:test.hits,chance:test.chance},cold:{hits:cold.hits,chance:cold.chance},random:{hits:comparator.hits,chance:comparator.chance}},diff,ci,exploratory:true};
 }catch(e){out.className='status bad';out.textContent='Contrôle refusé : '+e.message;lastReport=null;}}
function exportReport(){if(!lastReport){$('v22Result').textContent='Lance le test avant d’exporter.';return;}const b=new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='IA_LOTO_V22_rapport_exploratoire.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000);}
function init(){if(!$('v22Run'))return;$('v22Run').addEventListener('click',run);$('v22Export').addEventListener('click',exportReport);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.Loto22={compute,bootstrap};
})();
