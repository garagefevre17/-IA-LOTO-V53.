#!/usr/bin/env python3
"""Correctif local et contrôlé de la branche de test IA LOTO V53.4.
Ne fait AUCUN commit, push, merge, ni écriture sur main.
"""
from __future__ import annotations

from pathlib import Path
import subprocess
import sys

BRANCH = 'test-autonomie-v53-4'
SHARED_JS = r'''/* IA LOTO V53.4 — lecture commune non destructive des historiques et journaux.
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
'''


def replace_once(source: str, old: str, new: str, name: str) -> str:
    if old not in source:
        if new in source:
            return source
        raise RuntimeError(f'Ancrage inattendu dans {name} : refus de modifier')
    if source.count(old) != 1:
        raise RuntimeError(f'Ancrage ambigu dans {name} : refus de modifier')
    return source.replace(old, new, 1)


def patch_content(name: str, source: str) -> str:
    if name in ('v22.js', 'v23.js', 'v24.js'):
        return replace_once(source, 'window.Loto18.allRows()', 'window.Loto534Shared.allRows()', name)
    if name == 'xbias25.js':
        return replace_once(source, 'window.Loto18?.allRows?.()', 'window.Loto534Shared?.allRows?.()', name)
    if name == 'index.html':
        source = replace_once(source,
            '<script src="v22.js?v=25.0"></script>',
            '<script src="v22.js?v=53.4"></script><script src="loto_v534_shared.js?v=53.4"></script>',name)
        for script in ('v23', 'v24', 'xbias25'):
            source = replace_once(source, f'<script src="{script}.js?v=25.0"></script>',
                f'<script src="{script}.js?v=53.4"></script>',name)
        return source
    if name == 'sw.js':
        source = replace_once(source, "const CACHE='ia-loto-v53-unique-1';", "const CACHE='ia-loto-v53-4-shared-1';",name)
        source = replace_once(source,
            '"./xbias25.js", "./manifest.webmanifest"',
            '"./xbias25.js", "./loto_v534_shared.js", "./manifest.webmanifest"',name)
        return source
    raise RuntimeError('Fichier interdit : ' + name)


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(['git', *args], capture_output=True, text=True)


def main() -> int:
    root = Path.cwd()
    branch = git('branch', '--show-current')
    if branch.returncode != 0 or branch.stdout.strip() != BRANCH:
        raise RuntimeError(f'Installation autorisée UNIQUEMENT sur {BRANCH} ; branche actuelle : {branch.stdout.strip() or "inconnue"}')
    files = ('index.html','v22.js','v23.js','v24.js','xbias25.js','sw.js')
    changed: dict[Path, str] = {}
    for name in files:
        path = root/name
        if not path.is_file(): raise RuntimeError(f'Fichier requis absent : {name}')
        tracked = git('ls-files', '--error-unmatch', '--', name)
        if tracked.returncode: raise RuntimeError(f'Fichier non suivi : {name}')
        diff = git('diff', '--quiet', '--', name)
        staged = git('diff', '--cached', '--quiet', '--', name)
        if diff.returncode != 0 or staged.returncode != 0:
            raise RuntimeError(f'{name} contient déjà des changements non intégrés. Aucune modification pour éviter un écrasement.')
        old = path.read_text(encoding='utf-8')
        new = patch_content(name, old)
        if old != new: changed[path] = new
    dst = root/'loto_v534_shared.js'
    if dst.exists() and dst.read_text(encoding='utf-8') != SHARED_JS:
        raise RuntimeError('loto_v534_shared.js existe déjà avec un contenu différent : aucune donnée écrasée')
    if dst.exists() and git('ls-files','--error-unmatch','--',dst.name).returncode == 0:
        if git('diff', '--quiet', '--',dst.name).returncode != 0:
            raise RuntimeError('Module partagé déjà modifié localement : refus d’écrasement')
    if not dst.exists(): changed[dst] = SHARED_JS
    if not changed:
        print('Correction déjà présente, aucun fichier modifié.')
        return 0
    for path, content in changed.items():
        path.write_text(content, encoding='utf-8')
    errors=[]
    for file in ('v22.js','v23.js','v24.js','xbias25.js','sw.js','loto_v534_shared.js'):
        p = subprocess.run(['node','--check',file],capture_output=True,text=True)
        if p.returncode: errors.append(file+' : '+p.stderr)
    if errors:
        for e in errors: print(e, file=sys.stderr)
        raise RuntimeError('Une vérification de syntaxe a échoué (ne pas valider)')
    print('CORRECTION APPLIQUÉE UNIQUEMENT EN LOCAL sur', BRANCH)
    for path in changed: print('  ',path.name)
    print('Syntaxe JavaScript : OK. AUCUN commit, push, merge ou déploiement effectué.')
    print('Avant publication : tester les boutons et les journaux dans la prévisualisation, puis contrôler git diff.')
    return 0


if __name__ == '__main__':
    try: sys.exit(main())
    except Exception as err:
        print('INSTALLATION REFUSÉE SANS ECRASER LES FICHIERS :', err, file=sys.stderr)
        sys.exit(1)
