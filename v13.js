/* IA LOTO V13 — audit et sélection expérimentale. Conserve la méthode originale sans mutation. */
(() => { 'use strict';
  const q=id=>document.getElementById(id);
  const HISTORICAL_SHA256='1e70b5195b548a01e2749517e2a57c755bcaf469e95d0fdb7103b7d0b8d9b358';
  const COUNT=2833, END='2026-11-11';
  let lastReport='';
  const fs=()=>{
    if(draws.length<300) throw Error('Il faut au moins 300 tirages.');
    const x=choose('froids',draws);
    const h=draws.slice(-300), n=new Int32Array(50), c=new Int32Array(11);
    for(const r of h){for(let i=1;i<=5;i++)n[r[i]]++;c[r[6]]++;}
    return {x,h,n,c};
  };
  function analyze(){
    try {
      const {x,h,n,c}=fs(); const target=currentTarget(), stale=target.stale;
      const badge= stale ? 'Historique en retard : aucune prévision future enregistrable sans synchronisation.' : 'Historique à vérifier avant toute mise.';
      q('v13Pick').className='status '+(stale?'warn':'good');
      q('v13Pick').innerHTML='<strong>5 numéros + Chance — méthode Froids 300</strong>'+balls(x)+
        '<p>Dernier tirage connu : '+esc(x.cutoff)+' · 300 derniers tirages : '+esc(h[0][0])+' au '+esc(h.at(-1)[0])+'</p>'+
        '<p>Date théorique du tirage suivant dans la base : '+esc(target.date)+'</p>'+
        '<small>'+esc(badge)+' Numéros expérimentaux, non prédictifs.</small>';
      const top=Array.from({length:49},(_,i)=>i+1).sort((a,b)=>n[a]-n[b]||a-b).slice(0,10);
      const chance=Array.from({length:10},(_,i)=>i+1).sort((a,b)=>c[a]-c[b]||a-b);
      q('v13Frequencies').innerHTML='<strong>10 numéros principaux les moins fréquents</strong><p>'+top.map(k=>k+' : '+n[k]).join(' · ')+'</p><strong>Chance, du moins fréquent au plus fréquent</strong><p>'+chance.map(k=>k+' : '+c[k]).join(' · ')+'</p><small>Comptages exacts sur les 300 derniers tirages présents en mémoire.</small>';
      lastReport='IA LOTO V13 — Sélection exploratoire Froids 300\nDate calcul : '+new Date().toISOString()+' (horloge du terminal, non certifiée)\nDonnées connues jusqu’au : '+x.cutoff+'\nFenêtre : '+h[0][0]+' — '+h.at(-1)[0]+'\nTirage suivant selon la base : '+target.date+'\nNuméros : '+x.numbers.join(', ')+'\nChance : '+x.chance+'\nHistorique en retard : '+stale+'\nMéthode sans avantage prédictif démontré.\n';
    }catch(e){q('v13Pick').className='status bad';q('v13Pick').textContent=e.message;}
  }
  async function verify(){
    const el=q('v13VerifyResult');
    try {
      if(!globalThis.crypto?.subtle)throw Error('SHA-256 nécessite HTTPS et un navigateur compatible.');
      if(!Array.isArray(BASE)||BASE.length!==COUNT||BASE.at(-1)[0]!==END)throw Error('Base embarquée différente de celle auditée.');
      const data=BASE.map(r=>r.join(',')).join('\n');
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data)))).map(x=>x.toString(16).padStart(2,'0')).join('');
      if(digest!==HISTORICAL_SHA256)throw Error('Empreinte différente : archive modifiée ou corrompue.');
      let different=0;const map=new Map(draws.map(r=>[r[0],r]));
      for(const b of BASE){const r=map.get(b[0]);if(!r||JSON.stringify(r)!==JSON.stringify(b))different++;}
      el.className='status good';el.innerHTML='<strong>✓ Empreinte SHA-256 conforme</strong><p>2 833 lignes de référence, du 06/10/2008 au 11/11/2026.</p><p>Correspondance avec la base active : '+(COUNT-different)+' / '+COUNT+'.</p><small>SHA-256 : '+digest+'</small>';
    }catch(e){el.className='status bad';el.textContent='Contrôle non validé : '+e.message;}
  }
  q('v13Calc').addEventListener('click',analyze);
  q('v13Verify').addEventListener('click',verify);
  q('v13GoSave').addEventListener('click',()=>{switchPage('predict');q('predictMethod').value='froids';calcPredict();});
  q('v13Export').addEventListener('click',()=>{if(!lastReport)analyze();if(lastReport)exportFile('IA_LOTO_V13_selection_experimentale.txt',lastReport,'text/plain;charset=utf-8');});
})();
