/* IA LOTO V53.4 — lecture commune non destructive des historiques et journaux.
   Aucun résultat de source secondaire n'est certifié FDJ, aucun horodatage n'est attesté. */
(() => {
  'use strict';
  const APP_KEY = 'ia_loto_expert_v1_draws';
  const JOURNALS = [
    ['IA LOTO principal', 'ia_loto_expert_v1_log'],
    ['V18', 'ia_loto_v18_prospective_v1'],
    ['V24', 'ia_loto_v24_prospectif_fixe_v1'],
    ['X-BIAS V25', 'ia_loto_v25_xbias_journal_v1']
  ];
  const dateParis = (now = new Date()) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', hourCycle:'h23'
    }).formatToParts(now).map(x => [x.type, x.value]));
    return {day:`${p.year}-${p.month}-${p.day}`, hour:Number(p.hour)};
  };
  function nextOrdinary(last) {
    const d = new Date(last + 'T12:00:00Z');
    if (!Number.isFinite(+d) || d.toISOString().slice(0,10) !== last) throw Error('Date historique invalide');
    do { d.setUTCDate(d.getUTCDate() + 1); } while (![1,3,6].includes(d.getUTCDay()));
    return d.toISOString().slice(0,10);
  }
  function canonical(raw) {
    if (!Array.isArray(raw) || raw.length !== 7 || typeof raw[0] !== 'string') throw Error('Tirage invalide dans le stockage local');
    const r = [raw[0], ...raw.slice(1,6).sort((a,b) => a-b), raw[6]];
    if (!window.Loto18?.valid?.(r)) throw Error('Tirage non conforme : ' + r[0]);
    return r;
  }
  function readArray(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    let data;
    try { data = JSON.parse(raw); } catch { throw Error('Stockage corrompu (' + key + ') : aucune donnée effacée'); }
    if (!Array.isArray(data) || data.length > 12000) throw Error('Format invalide (' + key + ')');
    return data;
  }
  function allRows() {
    if (!window.Loto18?.allRows) throw Error('Historique V18 indisponible');
    const trusted = window.Loto18.allRows().map(canonical);
    if (!trusted.length) throw Error('Historique V18 vide');
    const byDate = new Map(trusted.map(r => [r[0], r]));
    if (byDate.size !== trusted.length) throw Error('Doublons dans V18');
    const extra = new Map();
    for (const row of readArray(APP_KEY)) {
      const r = canonical(row), prior = byDate.get(r[0]);
      if (prior) {
        if (JSON.stringify(prior) !== JSON.stringify(r)) throw Error('Contradiction entre les historiques pour ' + r[0]);
      } else {
        if (r[0] <= trusted.at(-1)[0]) throw Error('Date historique ancienne manquante : ' + r[0]);
        const old = extra.get(r[0]);
        if (old && JSON.stringify(old) !== JSON.stringify(r)) throw Error('Résultats contradictoires pour ' + r[0]);
        extra.set(r[0], r);
      }
    }
    let last = trusted.at(-1)[0];
    const today = dateParis().day;
    const newer = [...extra.values()].sort((a,b) => a[0].localeCompare(b[0]));
    for (const r of newer) {
      const expected = nextOrdinary(last);
      if (r[0] !== expected) throw Error('Historique discontinu : ' + expected + ' attendu, ' + r[0] + ' trouvé. Actualiser et vérifier avec FDJ.');
      if (r[0] > today) throw Error('Tirage futur refusé : ' + r[0]);
      last = r[0];
    }
    return [...trusted, ...newer];
  }
  function info(now = new Date()) {
    const rows = allRows();
    const last = rows.at(-1)[0], next = nextOrdinary(last), paris = dateParis(now);
    const outdated = next < paris.day || (next === paris.day && paris.hour >= 18);
    return {count:rows.length, lastKnown:last, nextDraw:next,
      outdated, dateParis:paris.day, extraLocalRows:rows.length - window.Loto18.allRows().length,
      fdjCertified:false, tsaCertified:false};
  }
  function journalIndex() {
    return JOURNALS.map(([name, key]) => {
      const arr = readArray(key);
      const dates = new Set();
      for (const entry of arr) {
        if (!entry || typeof entry !== 'object' || !/^20\d\d-\d\d-\d\d$/.test(entry.target || '')) {
          throw Error('Journal invalide : ' + name);
        }
        dates.add(entry.target);
      }
      return {name, entries:arr.length, dates:dates.size,
        verifiedByThirdParty:false, hashAudit:'non exécuté'};
    });
  }
  function show() {
    const host = document.getElementById('p-home');
    if (!host) return;
    let box = document.getElementById('loto534SharedReport');
    if (!box) {
      box = document.createElement('div');
      box.id = 'loto534SharedReport'; box.className = 'card';
      const h = document.createElement('h2'); h.textContent = 'V53.4 — cohérence des données et journaux';
      const p = document.createElement('p'); p.id = 'loto534SharedText';
      const q = document.createElement('p'); q.id = 'loto534JournalText';
      const small = document.createElement('small');
      small.textContent = 'Lecture seule des stockages existants. Aucun import automatique dans V18, aucune preuve FDJ ou RFC 3161. Les historiques divergents bloquent les moteurs au lieu de masquer les erreurs.';
      const b = document.createElement('button'); b.type='button'; b.className='btn alt full';
      b.textContent='Actualiser le contrôle V53.4'; b.addEventListener('click', show);
      box.append(h,p,q,small,b); host.append(box);
    }
    const out = document.getElementById('loto534SharedText');
    const journals = document.getElementById('loto534JournalText');
    try {
      const s = info();
      out.textContent = `${s.count} tirages communs, dernier ${s.lastKnown}, prochain ${s.nextDraw}. ` +
        (s.outdated ? 'Historique ou heure limite dépassé(e) : ne pas enregistrer.' : 'Date cible cohérente avec le calendrier.') +
        ` ${s.extraLocalRows} tirage(s) issu(s) du stockage principal, non certifiés FDJ.`;
      out.className = 'status ' + (s.outdated ? 'warn':'good');
    } catch (e) {
      out.textContent = 'Synchronisation des moteurs bloquée : ' + e.message;
      out.className = 'status bad';
    }
    try {
      const indices = journalIndex();
      journals.textContent = 'Journaux locaux (vue commune, sans fusion ni écrasement) : ' +
        indices.map(j => `${j.name} : ${j.entries} entrée(s)`).join(' ; ') +
        '. Empreintes et antériorité non vérifiées dans ce tableau.';
      journals.className='status warn';
    } catch (e) {
      journals.className='status bad'; journals.textContent=e.message;
    }
  }
  window.Loto534Shared = {allRows, nextOrdinary, info, journalIndex, show};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
