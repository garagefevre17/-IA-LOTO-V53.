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


EUROMILLIONS_FEATURE = r'''
  // Mémoire locale durable: ne publie rien et ne certifie pas l'origine des données.
  const DB_NAME='IA_LOTO_EUROMILLIONS_HISTORY_V1';
  function openHistoryDB(){return new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(Error('IndexedDB indisponible'));return;}
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('history'))req.result.createObjectStore('history')};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Base locale inaccessible'));
  });}
  async function getSavedHistory(){const db=await openHistoryDB();try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('history','readonly'),q=tx.objectStore('history').get('latest');
    q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error);
  });}finally{db.close();}}
  async function saveHistory(text,name){const db=await openHistoryDB();try{await new Promise((resolve,reject)=>{
    const tx=db.transaction('history','readwrite');tx.objectStore('history').put({text,name,stored_at:new Date().toISOString()},'latest');
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}}
  async function applyHistory(text,name){
    if(text.length>8000000)throw Error('Historique EuroMillions trop volumineux');
    const parsed=parse(text);if(!parsed.length)throw Error('Aucun tirage EuroMillions valide');
    let hash=null;if(crypto?.subtle){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
      hash=Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,'0')).join('');}
    rows=parsed;file=name;digest=hash;clear();
    $('importState').textContent=rows.length+' tirages conservés : '+rows[0].date+' à '+rows.at(-1).date+
      '. Source non certifiée FDJ. SHA-256 : '+(hash||'indisponible');
    return parsed;
  }
  // IMPORTANT: remplacer le gestionnaire asynchrone d'origine.
  // L'ancien code appelait une fonction async sans attendre son travail réel,
  // ce qui pouvait empêcher toute sauvegarde sur iPhone.
  $('csv').onchange=async()=>{
    const serial=++importSerial;clear();rows=[];file='';digest=null;
    $('importState').textContent='Validation de l’archive en cours…';
    try{
      const f=$('csv').files?.[0];
      if(!f){$('importState').textContent='Aucun historique chargé.';return;}
      if(f.size>8000000)throw Error('Fichier trop volumineux');
      const text=await f.text();
      if(serial!==importSerial)return;
      await applyHistory(text,f.name);
      if(serial!==importSerial)return;
      try{
        await saveHistory(text,f.name);
        if(serial===importSerial)$('importState').textContent+=' · Sauvegardé sur cet appareil.';
      }catch(e){
        if(serial===importSerial)$('importState').textContent+=' · Attention : sauvegarde impossible ('+e.message+'). Exporte une copie.';
      }
    }catch(e){
      if(serial!==importSerial)return;
      clear();rows=[];file='';digest=null;
      $('importState').textContent='Import refusé : '+e.message;
    }
  };
  (async()=>{
    const serial=importSerial;
    try{
      // Priorité à une archive publiée plus récente SI elle est cohérente avec la sauvegarde.
      let saved=null, published=null;
      try{saved=await getSavedHistory();}catch(e){
        $('importState').textContent='Mémoire locale indisponible : '+e.message+'. Import CSV possible.';
      }
      try{
        const response=await fetch('./euromillions-history.csv',{cache:'no-store'});
        if(response.ok){
          const text=await response.text();
          if(text.length>8000000)throw Error('Archive publiée trop volumineuse');
          published={text,name:'euromillions-history.csv (publié, non certifié)',parsed:parse(text)};
        }
      }catch(e){
        if(!saved && serial===importSerial)$('importState').textContent='Archive publiée indisponible : '+e.message+'. Import CSV possible.';
      }
      if(serial!==importSerial)return;
      if(saved && published){
        const local=parse(saved.text);
        const known=new Map(local.map(r=>[r.date,r]));
        for(const r of published.parsed){
          const prior=known.get(r.date);
          if(prior && JSON.stringify(prior)!==JSON.stringify(r))
            throw Error('Contradiction entre l’archive locale et l’archive publiée : '+r.date);
        }
        const newestLocal=local.at(-1)?.date||'',newestPublished=published.parsed.at(-1)?.date||'';
        if(newestPublished>newestLocal){
          await applyHistory(published.text,published.name);
          try{await saveHistory(published.text,published.name);}catch{}
          return;
        }
        await applyHistory(saved.text,saved.name);return;
      }
      if(saved){await applyHistory(saved.text,saved.name);return;}
      if(published){await applyHistory(published.text,published.name);
        try{await saveHistory(published.text,published.name);}catch{}
      }
    }catch(e){
      if(serial===importSerial){clear();rows=[];file='';digest=null;
        $('importState').textContent='Historique non chargé : '+e.message+'. Import CSV contrôlé nécessaire.';}
    }
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
    if name == 'euromillions-chauds_VERIFIE.html':
        anchor = "$('target').value=d;\n})();"
        replacement = "$('target').value=d;\n" + EUROMILLIONS_FEATURE + "\n})();"
        return replace_once(source, anchor, replacement, name)
    raise RuntimeError('Fichier interdit : ' + name)


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(['git', *args], capture_output=True, text=True)


def main() -> int:
    root = Path.cwd()
    branch = git('branch', '--show-current')
    if branch.returncode != 0 or branch.stdout.strip() != BRANCH:
        raise RuntimeError(f'Installation autorisée UNIQUEMENT sur {BRANCH} ; branche actuelle : {branch.stdout.strip() or "inconnue"}')
    files = ('index.html','v22.js','v23.js','v24.js','xbias25.js','sw.js','euromillions-chauds_VERIFIE.html')
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
    # Vérification syntaxique sur copies avant d'écrire, afin de préserver
    # intégralement le dépôt en cas d'échec, même au milieu de l'installation.
    import tempfile
    with tempfile.TemporaryDirectory(prefix='ia-loto-v535-check-') as td:
        test_dir=Path(td)
        for path, content in changed.items():
            if path.suffix == '.js':
                test=(test_dir/path.name)
                test.write_text(content, encoding='utf-8')
                result=subprocess.run(['node','--check',str(test)],capture_output=True,text=True)
                if result.returncode: raise RuntimeError(f'Syntaxe invalide {path.name}: {result.stderr}')
            if path.name == 'euromillions-chauds_VERIFIE.html':
                import re
                scripts=re.findall(r'<script[^>]*>(.*?)</script>',content,re.S|re.I)
                test=test_dir/'euromillions-embedded.js'
                test.write_text('\n'.join(scripts),encoding='utf-8')
                result=subprocess.run(['node','--check',str(test)],capture_output=True,text=True)
                if result.returncode: raise RuntimeError('Syntaxe EuroMillions invalide : '+result.stderr)
    # Toutes les vérifications ont réussi : l'écriture peut commencer.
    originals={path:(path.read_bytes() if path.exists() else None) for path in changed}
    try:
        for path, content in changed.items(): path.write_text(content,encoding='utf-8')
    except BaseException:
        for path, content in originals.items():
            try:
                if content is None: path.unlink(missing_ok=True)
                else: path.write_bytes(content)
            except OSError: pass
        raise
    errors=[]
    for file in ('v22.js','v23.js','v24.js','xbias25.js','sw.js','loto_v534_shared.js'):
        p = subprocess.run(['node','--check',file],capture_output=True,text=True)
        if p.returncode: errors.append(file+' : '+p.stderr)
    page=(root/'euromillions-chauds_VERIFIE.html').read_text(encoding='utf-8')
    import re, tempfile
    scripts=re.findall(r'<script[^>]*>(.*?)</script>',page,re.S|re.I)
    with tempfile.NamedTemporaryFile(mode='w',suffix='.js',encoding='utf-8',delete=False) as tmp:
        tmp.write('\n'.join(scripts)); tmp_path=Path(tmp.name)
    try:
        p=subprocess.run(['node','--check',str(tmp_path)],capture_output=True,text=True)
        if p.returncode: errors.append('EuroMillions JavaScript : '+p.stderr)
    finally:tmp_path.unlink(missing_ok=True)
    if errors:
        for e in errors: print(e, file=sys.stderr)
        raise RuntimeError('Une vérification de syntaxe a échoué (ne pas valider)')
    print('CORRECTION APPLIQUÉE UNIQUEMENT EN LOCAL sur', BRANCH)
    for path in changed: print('  ',path.name)
    print('Syntaxe JavaScript + EuroMillions : OK. AUCUN commit, push, merge ou déploiement effectué.')
    print('EuroMillions : import CSV conservé en IndexedDB, chargement depuis euromillions-history.csv si publié. Source FDJ NON certifiée.')
    print('Avant publication : tester les boutons et les journaux dans la prévisualisation, puis contrôler git diff.')
    return 0


if __name__ == '__main__':
    try: sys.exit(main())
    except Exception as err:
        print('INSTALLATION REFUSÉE SANS ECRASER LES FICHIERS :', err, file=sys.stderr)
        sys.exit(1)
