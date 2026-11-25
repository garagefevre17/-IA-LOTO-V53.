// V9 : calculs conditionnels uniquement ; aucune espérance de gain garantie.
(()=>{'use strict';
const $=id=>document.getElementById(id); const fmt=(v,d=2)=>Number(v).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});
const choose=(n,k)=>{if(k<0||k>n)return 0;let r=1;for(let j=1;j<=k;j++)r=r*(n-j+1)/j;return r;};
const total=choose(49,5)*10; const ranks=[{rank:2,k:5,c:0,share:.0128},{rank:3,k:4,c:1,share:.0077},{rank:4,k:4,c:0,share:.0348},{rank:5,k:3,c:1,share:.0131},{rank:6,k:3,c:0,share:.0596},{rank:7,k:2,c:1,share:.1123},{rank:8,k:2,c:0,share:.5105},{rank:9,k:-1,c:1,share:.2492}];
const pRank=r=>r.rank===9?(choose(5,1)*choose(44,4)+choose(5,0)*choose(44,5))/total:choose(5,r.k)*choose(44,5-r.k)*(r.c?1:9)/total;
const p1=1/total;
const recip=(n,p)=>p===0?1:-Math.expm1((n+1)*Math.log1p(-p))/((n+1)*p);
const calc=(J,N,cost,base)=>{const noJackpot=Math.exp(N*Math.log1p(-p1)); const rows=ranks.map(r=>{const p=pRank(r);const bonus=p*noJackpot*J*r.share*recip(N,p/(1-p1));return {...r,p,bonus};});const add=rows.reduce((a,r)=>a+r.bonus,0);const jack=p1*J*recip(N,p1);const threshold=cost-add-jack;return {noJackpot,rows,add,jack,threshold,net:base===null?null:base+add+jack-cost};};
function run(){const J=Number($('evJackpot').value),N=Number($('evOthers').value),cost=Number($('evPrice').value),bt=$('evBase').value.trim();const base=bt===''?null:Number(bt);const out=$('evOutput');if(!Number.isFinite(J)||J<=0||!Number.isSafeInteger(N)||N<0||N>100000000||!Number.isFinite(cost)||cost<=0||(base!==null&&(!Number.isFinite(base)||base<0))){out.className='status bad';out.textContent='Valeurs invalides : vérifier jackpot, participation, prix et gains ordinaires.';return;}const x=calc(J,N,cost,base);let h='<b>Scénario HYPOTHÉTIQUE — jamais une prévision FDJ</b><p>Probabilité estimée de ne trouver aucun gagnant du jackpot parmi les autres combinaisons : <b>'+fmt(100*x.noJackpot,3)+' %</b></p>';h+='<table class="evtable"><tr><th>Rang</th><th>Supplément attendu / grille</th></tr>'+x.rows.map(r=>'<tr><td>'+r.rank+'</td><td>'+fmt(r.bonus,4)+' €</td></tr>').join('')+'</table>';h+='<p>Espérance supplémentaire de redistribution : <b>'+fmt(x.add,4)+' €</b><br>Espérance de la part du jackpot (si tu gagnes le 1er rang) : <b>'+fmt(x.jack,4)+' €</b></p>';
h+='<p>Pour couvrir un prix de <b>'+fmt(cost)+' €</b>, il faudrait des gains ordinaires et Code attendus d’au moins <b>'+fmt(Math.max(0,x.threshold),4)+' €</b> par grille, dans ce modèle.</p>';
if(base===null){h+='<p><b>Rentabilité : indéterminable.</b> Les gains ordinaires attendus sont inconnus. Ne remplace pas cette inconnue par le taux de retour moyen : le jackpot et les redistributions y sont déjà inclus à l’échelle du jeu.</p>';}else{h+='<p><b>Résultat net modélisé : '+fmt(x.net,4)+' € / grille</b>. Ce résultat est entièrement conditionné à ton hypothèse de gains ordinaires, qui n’est pas vérifiée par l’application.</p>';}
const low=calc(J,Math.round(N*.5),cost,null), high=calc(J,Math.round(N*1.5),cost,null);h+='<p class="muted">Sensibilité à la participation (redistribution seule) : '+fmt(low.add,4)+' € si moitié moins de grilles ; '+fmt(high.add,4)+' € si 50 % de grilles en plus.</p><small>Hypothèses : choix des autres joueurs uniformes, indépendants, nombre de combinaisons connu, jackpot fixe, traitement théorique des parts. Les choix réels ne sont pas uniformes, les mises peuvent se concentrer sur certains numéros, les règles changent et les volumes sont inconnus. Des écarts de partage peuvent modifier considérablement le résultat. Les gains ordinaires, les codes et les frais sont exclus sauf saisie manuelle.</small>';
out.className='status good';out.innerHTML=h;}
function compareJackpot(event){
 event.preventDefault();
 const jackpotInput=$('scenarioJackpot'), budgetInput=$('scenarioBudget');
 const jackpot=jackpotInput.valueAsNumber, budget=budgetInput.valueAsNumber;
 const cost=$('scenarioCost').valueAsNumber;
 const secondaryInput=$('scenarioSecondary');
 const omitted=secondaryInput.value==='';
 const secondary=omitted?0:secondaryInput.valueAsNumber;
 const combinations=$('scenarioGame').value==='loto'?total:139838160;
 const output=$('scenarioOutput');
 const hasJackpot=jackpotInput.value!=='', hasBudget=budgetInput.value!=='';
 const costCents=Math.round(cost*100), budgetCents=Math.round(budget*100);
 if(!hasJackpot&&!hasBudget){
  output.textContent='Saisis un budget, un jackpot ou les deux.';
  return;
 }
 if(!Number.isSafeInteger(costCents)||costCents<=0||
    (hasBudget&&(!Number.isSafeInteger(budgetCents)||budgetCents<0))||
    (hasJackpot&&(!Number.isFinite(jackpot)||jackpot<=0))||!Number.isFinite(secondary)||secondary<0||
    !Number.isFinite(3*combinations*Math.abs(cost-secondary))){
  output.textContent='Vérifie les montants saisis.';
  return;
 }
 const euros=new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'});
 const children=[];
 if(hasBudget){
  const count=Math.min(combinations,Math.floor(budgetCents/costCents));
  const integer=new Intl.NumberFormat('fr-FR');
  const percent=new Intl.NumberFormat('fr-FR',{style:'percent',maximumFractionDigits:10});
  const coverage=document.createElement('p');
  coverage.textContent='Couverture sur un même tirage : '+integer.format(count)+' / '+integer.format(combinations)+
   ' ('+percent.format(count/combinations)+'). Coût théorique : '+euros.format(count*costCents/100)+'.';
  children.push(coverage);
 }
 if(!hasJackpot){
  output.replaceChildren(...children);
  return;
 }
 const intro=document.createElement('p');
 intro.textContent=omitted?'Hypothèse : 0 € de gains secondaires moyens par grille.':
  'Gains secondaires moyens supposés : '+euros.format(secondary)+' par grille.';
 const scenarios=document.createElement('ul');
 for(const winners of [1,2,3]){
  const net=jackpot/combinations/winners+secondary-cost;
  const threshold=Math.max(0,combinations*(cost-secondary)*winners);
  const item=document.createElement('li');
  item.textContent=winners+(winners===1?' gagnant':' gagnants')+' au total · seuil '+euros.format(threshold)+
   ' · gain net moyen '+euros.format(net)+' par grille.';
  scenarios.append(item);
 }
 output.replaceChildren(...children,intro,scenarios);
}
$('jackpotScenarios')?.addEventListener('submit',compareJackpot);
function selfcheck(){let sum=ranks.reduce((a,r)=>a+r.share,0);if(Math.abs(sum-1)>1e-12||Math.abs(total-19068840)>1e-6||Math.abs(ranks.reduce((a,r)=>a+pRank(r),p1)-(.1669))>.01)throw Error('Erreur de contrôle des probabilités');return true;}
try{selfcheck();$('evBtn').addEventListener('click',run)}catch(e){$('evOutput').textContent='Module indisponible : '+e.message;console.error(e)}
})();
// Scenario simulation for ordinary LOTO grids, independent of the generation engine.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('recoveryForm');
  if (!form) return;
  const output = $('recoveryOutput');
  const second = $('recoverySecond');
  const main = $('recoveryMainPayouts');
  const extra = $('recoverySecondPayouts');
  const mainRanks = [[5,true],[5,false],[4,true],[4,false],[3,true],[3,false],[2,true],[2,false],[0,true]];
  const secondRanks = [5,4,3,2];
  function payoutInput(parent, id, description) {
    const label = document.createElement('label');
    label.className = 'label';
    label.htmlFor = id;
    label.textContent = description + ' (€)';
    const input = document.createElement('input');
    input.id = id;
    input.type = 'number';
    input.inputMode = 'decimal';
    input.min = '0';
    input.step = '0.01';
    parent.append(label, input);
  }
  for (const [hits, chance] of mainRanks) {
    const label = hits === 0 ? 'Chance avec 0 ou 1 bon numéro' : hits + ' bons numéros, ' + (chance ? 'avec' : 'sans') + ' Chance';
    payoutInput(main, 'recoveryPayout' + hits + Number(chance), label);
  }
  for (const hits of secondRanks) payoutInput(extra, 'recoverySecondPayout' + hits, hits + ' bons numéros');

  function cents(input) {
    const value = input.value === '' ? 0 : Math.round(input.valueAsNumber * 100);
    if (!Number.isSafeInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / 40) {
      throw new Error('Vérifie les montants saisis.');
    }
    return value;
  }

  function readGrids(value) {
    const rows = value.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!rows.length || rows.length > 20) throw new Error('Saisis entre 1 et 20 grilles.');
    return rows.map((line, i) => {
      const fields = line.split(/[\s,;]+/);
      const values = fields.map(Number);
      const numbers = values.slice(0, 5);
      if (fields.length !== 6 || fields.some(x => !/^\d{1,2}$/.test(x)) ||
          new Set(numbers).size !== 5 || numbers.some(n => n < 1 || n > 49) ||
          values[5] < 1 || values[5] > 10) throw new Error('Grille ' + (i + 1) + ' invalide.');
      return {numbers, chance: values[5]};
    });
  }

  function draw(marked) {
    marked.fill(0);
    for (let i = 0; i < 5; i++) {
      let n;
      do { n = 1 + Math.floor(Math.random() * 49); } while (marked[n]);
      marked[n] = 1;
    }
  }

  function estimate(grids, stake, mainPayouts, extraPayouts, samples) {
    const primary = new Uint8Array(50), secondary = new Uint8Array(50);
    let recovered = 0;
    for (let round = 0; round < samples; round++) {
      draw(primary);
      if (extraPayouts) draw(secondary);
      const chance = 1 + Math.floor(Math.random() * 10);
      let paid = 0;
      for (const grid of grids) {
        let mainHits = 0, secondHits = 0;
        for (const n of grid.numbers) {
          mainHits += primary[n];
          if (extraPayouts) secondHits += secondary[n];
        }
        const hasChance = Number(grid.chance === chance);
        paid += mainPayouts[(mainHits < 2 ? 0 : mainHits) * 2 + hasChance];
        if (extraPayouts) paid += extraPayouts[secondHits];
      }
      if (paid >= stake) recovered++;
    }
    return recovered;
  }

  const initial = output.textContent;
  const draftKey = 'ia_loto_recovery_draft_v1';
  const draftFields = [...form.querySelectorAll('input[id], textarea[id]')];
  function syncSecond() {
    extra.hidden = extra.disabled = !second.checked;
  }
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) ?? '{}');
    for (const field of draftFields) {
      const value = draft?.[field.id];
      if (field.type === 'checkbox' && typeof value === 'boolean') field.checked = value;
      else if (field.type !== 'checkbox' && typeof value === 'string') field.value = value;
    }
  } catch {}
  syncSecond();
  form.addEventListener('input', () => {
    syncSecond();
    output.textContent = initial;
    try {
      const draft = Object.fromEntries(draftFields.map(field =>
        [field.id, field.type === 'checkbox' ? field.checked : field.value]));
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {}
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const grids = readGrids($('recoveryGrids').value);
      const stake = cents($('recoveryStake'));
      if (stake <= 0) throw new Error('La mise doit être supérieure à 0 €.');
      const mainPayouts = new Array(12).fill(0);
      for (const [hits, chance] of mainRanks) {
        mainPayouts[hits * 2 + Number(chance)] = cents($('recoveryPayout' + hits + Number(chance)));
      }
      const extraPayouts = second.checked ? new Array(6).fill(0) : null;
      if (extraPayouts) {
        for (const hits of secondRanks) extraPayouts[hits] = cents($('recoverySecondPayout' + hits));
      }
      if (![...mainPayouts, ...(extraPayouts ?? [])].some(Boolean)) {
        throw new Error('Saisis au moins un montant de lot dans ton scénario.');
      }
      const samples = 30000;
      const recovered = estimate(grids, stake, mainPayouts, extraPayouts, samples);
      const p = recovered / samples;
      const z = 1.96;
      const scale = 1 + z*z/samples;
      const center = (p + z*z/(2*samples))/scale;
      const error = z*Math.sqrt(p*(1-p)/samples + z*z/(4*samples*samples))/scale;
      const percent = new Intl.NumberFormat('fr-FR', {style:'percent', maximumFractionDigits:2});
      const money = new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'});
      output.textContent = recovered + ' simulations sur ' + samples + ' atteignent ' + money.format(stake/100) +
        ' (' + percent.format(p) + '). Intervalle de simulation à 95 % : ' +
        percent.format(Math.max(0,center-error)) + ' à ' + percent.format(Math.min(1,center+error)) +
        '. Cet intervalle mesure l’incertitude de la simulation sous les montants saisis.';
    } catch (error) {
      output.textContent = error.message;
    }
  });
})();
