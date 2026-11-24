#!/usr/bin/env python3
"""IA LOTO V53 - independent, fail-closed experimental prospective pipeline.

No prediction is guaranteed, and GitHub commit timestamps are NOT RFC3161 attestations.
Requires Python >=3.11. No third-party dependencies.
"""
import argparse
import csv
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import zipfile
from zoneinfo import ZoneInfo

PARIS = ZoneInfo('Europe/Paris')
BASE = Path(__file__).resolve().parent
if BASE.name == 'automation':
    BASE = BASE.parent
STATE = BASE / 'automatisation' / 'etat.json'
DATA_DIR = BASE / 'automatisation' / 'donnees'
JOURNAL = BASE / 'automatisation' / 'journal'
PUBLIC = BASE / 'automatisation' / 'tableau.json'
CONFIG = {
    'loto': {'page': 'https://www.fdj.fr/jeux-de-tirage/loto/historique', 'weekdays': {0, 2, 5}, 'limit': 49, 'extra': 10},
    'euromillions': {'page': 'https://www.fdj.fr/jeux-de-tirage/euromillions-my-million/historique', 'weekdays': {1, 4}, 'limit': 50, 'extra': 12},
}
HEADERS = {'User-Agent': 'IA-LOTO-V53-archives-scientifiques/1.0 (+GitHub Actions; no gameplay)'}


def stamp():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def canonical(obj):
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')


def digest(obj):
    return hashlib.sha256(canonical(obj)).hexdigest()


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(obj, ensure_ascii=False, sort_keys=True, indent=2) + '\n'
    # Atomic replacement prevents a truncated published JSON on interruption.
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=path.parent,
                                     prefix='.' + path.name + '.', delete=False) as f:
        temp = Path(f.name)
        try:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        except BaseException:
            temp.unlink(missing_ok=True)
            raise
    os.replace(temp, path)


def get(url):
    u = urlparse(url)
    if u.scheme != 'https' or u.hostname not in {'www.fdj.fr', 'www.sto.api.fdj.fr', 'sto.api.fdj.fr'}:
        raise ValueError('Domaine FDJ non autorisé: ' + str(u.hostname))
    with urlopen(Request(url, headers=HEADERS), timeout=30) as response:
        final = urlparse(response.geturl())
        if final.scheme != 'https' or final.hostname not in {'www.fdj.fr', 'www.sto.api.fdj.fr', 'sto.api.fdj.fr'}:
            raise ValueError('Redirection vers un site non officiel')
        result = response.read(8_000_001)
        if len(result) > 8_000_000:
            raise ValueError('Archive trop volumineuse')
        return result


class ArchiveLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.current = None
        self.depth = 0
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.current = {'href': dict(attrs).get('href', ''), 'title': ''}
    def handle_data(self, data):
        if self.current is not None:
            self.current['title'] += data
    def handle_endtag(self, tag):
        if tag == 'a' and self.current is not None:
            self.links.append(self.current)
            self.current = None


def official_zip_urls(page):
    """Archive links in publication order; stop before the other LOTO game sections.

    The published FDJ page may keep archives in distinct date ranges. Never
    assume the first archive contains the current year.
    """
    html = get(page).decode('utf-8', errors='replace')
    # On LOTO, Grand/Super/Christmas archives must NOT be counted as regular LOTO.
    if '/loto/' in page:
        boundary = re.search(r'Historique\s+(?:Grand\s+Loto|Super\s+Loto)', html, re.I)
        if boundary:
            html = html[:boundary.start()]
    parser = ArchiveLinks()
    parser.feed(html)
    result = []
    for item in parser.links:
        url = urljoin(page, item['href'])
        u = urlparse(url)
        if (u.scheme == 'https' and u.hostname in ('www.sto.api.fdj.fr', 'sto.api.fdj.fr')
                and ('/documentations/' in u.path or u.path.lower().endswith('.zip'))):
            result.append(url)
    return list(dict.fromkeys(result))


def normalize_date(s):
    s = str(s).strip()
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y'):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError('Date invalide ' + s)


def parse_csv(content, game):
    decoded = None
    for enc in ('utf-8-sig', 'cp1252', 'latin-1'):
        try:
            decoded = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if decoded is None:
        raise ValueError('Encodage CSV inconnu')
    if not decoded.strip():
        raise ValueError('CSV vide')
    first = decoded.splitlines()[0]
    sep = ';' if first.count(';') >= first.count(',') else ','
    records = csv.DictReader(io.StringIO(decoded), delimiter=sep)
    if not records.fieldnames:
        raise ValueError('CSV sans entête')
    import unicodedata
    def norm(x):
        x = unicodedata.normalize('NFKD', x or '').encode('ascii', 'ignore').decode().strip().lower()
        return re.sub(r'[^a-z0-9_]', '', x)
    mapping = {norm(c): c for c in records.fieldnames if c is not None}
    def pick(*names):
        for n in names:
            if n in mapping:
                return mapping[n]
        raise ValueError('Colonne FDJ manquante: ' + '/'.join(names))
    dkey = pick('date_de_tirage', 'date_tirage', 'date')
    keys = [pick(f'boule_{i}', f'n{i}', f'numero_{i}') for i in range(1, 6)]
    extra_keys = ([pick('numero_chance', 'chance', 'b1')] if game == 'loto' else
                  [pick(f'etoile_{i}', f'e{i}') for i in (1, 2)])
    results = []
    seen = {}
    for raw in records:
        if not raw.get(dkey):
            continue
        dt = normalize_date(raw[dkey])
        # Ordinary LOTO only; archives for Super LOTO are separate.
        if dt < ('2008-10-06' if game == 'loto' else '2016-09-27'):
            continue
        try:
            nums = [int(raw[k]) for k in keys]
            extras = [int(raw[k]) for k in extra_keys]
        except (TypeError, ValueError, KeyError) as exc:
            raise ValueError('Numéros invalides ou incomplets pour '+dt) from exc
        if len(set(nums)) != 5 or not all(1 <= n <= CONFIG[game]['limit'] for n in nums):
            raise ValueError('Numéros invalides pour ' + dt)
        if len(set(extras)) != len(extras) or not all(1 <= x <= CONFIG[game]['extra'] for x in extras):
            raise ValueError('Extra invalides pour ' + dt)
        if date.fromisoformat(dt).weekday() not in CONFIG[game]['weekdays']:
            raise ValueError('Jour inattendu pour ' + dt)
        entry = {'date': dt, 'nums': sorted(nums), 'extras': sorted(extras)}
        if dt in seen and seen[dt] != entry:
            raise ValueError('Tirages contradictoires dans le CSV : '+dt)
        if dt not in seen:
            results.append(entry)
        seen[dt] = entry
    return results


def fetch_history(game, as_of=None, now=None):
    """Collect official archive links, without assuming link ordering.

    Only archives that can be parsed under the current game's rules are used.
    We examine overlapping archives before accepting coverage and explicitly
    reject conflicting draw rows. Never infer a missing result from an archive.
    """
    urls = official_zip_urls(CONFIG[game]['page'])
    if not urls:
        raise ValueError('Aucune URL ZIP officielle détectée pour ' + game)
    if len(urls) > 10:
        raise ValueError('Liste FDJ inattendue : trop de liens ZIP')
    rows, archives, rejected = {}, [], []
    today = as_of or (now or datetime.now(PARIS)).astimezone(PARIS).date()
    if isinstance(today, datetime):
        now = today
        today = now.astimezone(PARIS).date()
    cutoff = now or datetime.combine(today, datetime.min.time(), PARIS)
    target = next_draw(game, today, cutoff)
    for url in urls:
        try:
            payload = get(url)
        except (OSError, ValueError) as exc:
            rejected.append({'url': url, 'reason': str(exc)[:160]})
            continue
        if not zipfile.is_zipfile(io.BytesIO(payload)):
            rejected.append({'url': url, 'reason': 'réponse non ZIP'})
            continue
        parsed = []
        try:
            with zipfile.ZipFile(io.BytesIO(payload)) as z:
                names = [i for i in z.infolist() if i.filename.lower().endswith('.csv') and not i.is_dir()]
                if not names:
                    raise ValueError('ZIP sans CSV')
                for inf in names:
                    if inf.file_size < 0 or inf.file_size > 15_000_000 or inf.compress_size > 8_000_000:
                        raise ValueError('CSV trop volumineux')
                    if '..' in Path(inf.filename).parts or inf.filename.startswith('/'):
                        raise ValueError('Chemin ZIP interdit')
                    parsed.extend(parse_csv(z.read(inf), game))
        except (ValueError, zipfile.BadZipFile, RuntimeError) as exc:
            rejected.append({'url':url, 'reason':str(exc)[:160]})
            continue
        parsed = [row for row in parsed if result_available(row['date'], today, now)]
        if not parsed:
            continue
        for item in parsed:
            old = rows.get(item['date'])
            if old is not None and old != item:
                raise ValueError('Dates FDJ contradictoires : ' + item['date'])
            rows[item['date']] = item
        archives.append({'url':url, 'zip_sha256':hashlib.sha256(payload).hexdigest(),
                         'parsed_rows':len(parsed)})
    data = sorted(rows.values(), key=lambda r:r['date'])
    if not data:
        raise ValueError('Aucun historique utilisable : ' + str(rejected[:3]))
    # A final, explicit coverage proof is necessary even when the source has
    # enough rows in total but lacks the most recent drawing(s).
    try:
        build_forecast(game, data, target)
    except ValueError as exc:
        raise ValueError('Archives FDJ insuffisantes ou périmées : ' + str(exc) +
                         '; archives rejetées : ' + str(rejected[:3])) from exc
    return data, archives


def result_available(draw_date, today, now):
    key = today.isoformat()
    return draw_date < key or (draw_date == key and
                               (now is None or now.astimezone(PARIS).hour >= 21))


def save_history(game, data, sources):
    path = DATA_DIR / (game + '.json')
    rows = {}
    previous_sources = []
    if path.exists():
        previous = json.loads(path.read_text(encoding='utf-8'))
        rows = {row['date']: row for row in previous['draws']}
        previous_sources = previous['source']
    for row in data:
        old = rows.get(row['date'])
        if old is not None and old != row:
            raise ValueError('Contradiction avec l’historique conservé : ' + row['date'])
        rows[row['date']] = row
    by_archive = {(src['url'], src['zip_sha256']): src for src in previous_sources + sources}
    write_json(path, {'source': list(by_archive.values()), 'retrieved_at': stamp(),
                      'draws': sorted(rows.values(), key=lambda row: row['date'])})


def next_draw(game, today, now=None):
    # Never propose a new forecast for an already closed draw day.
    local = (now or datetime.now(PARIS)).astimezone(PARIS)
    for i in range(9):
        d = today + timedelta(days=i)
        if d.weekday() not in CONFIG[game]['weekdays']:
            continue
        if d == local.date() and local.hour >= 18:
            continue
        return d
    raise ValueError('Date du prochain tirage introuvable')


def expected_dates(game, first, last):
    days = []
    d = first
    while d <= last:
        if d.weekday() in CONFIG[game]['weekdays']:
            days.append(d.isoformat())
        d += timedelta(days=1)
    return days


def build_forecast(game, data, target):
    key = target.isoformat()
    before = [r for r in data if r['date'] < key]
    if target.weekday() not in CONFIG[game]['weekdays']:
        raise ValueError('Jour cible invalide')
    if game == 'loto':
        if len(before) < 300:
            raise ValueError('Moins de 300 tirages disponibles')
        sample = before[-300:]
        # Catch missing calendar events; fail closed for Super LOTO replacements.
        expect = expected_dates(game, date.fromisoformat(sample[0]['date']), target - timedelta(days=1))
        if [r['date'] for r in sample] != expect:
            raise ValueError('Historique LOTO incomplet (ou tirage exceptionnel): fenêtre non validée')
    else:
        start = target - timedelta(days=365)
        sample = [r for r in before if r['date'] >= start.isoformat()]
        expect = expected_dates(game, start, target - timedelta(days=1))
        if [r['date'] for r in sample] != expect:
            raise ValueError('Historique EuroMillions incomplet sur 365 jours')
    main = [0] * (CONFIG[game]['limit'] + 1)
    extra = [0] * (CONFIG[game]['extra'] + 1)
    for row in sample:
        for n in row['nums']:
            main[n] += 1
        for n in row['extras']:
            extra[n] += 1
    cold = sorted(range(1, len(main)), key=lambda n: (main[n], n))
    hot = sorted(range(1, len(main)), key=lambda n: (-main[n], n))
    cold_extra = sorted(range(1, len(extra)), key=lambda n: (extra[n], n))
    hot_extra = sorted(range(1, len(extra)), key=lambda n: (-extra[n], n))
    if game == 'loto':
        grids = [{'method': 'FROIDS300_FIGE', 'numbers': sorted(cold[:5]), 'extras': cold_extra[:1]}]
    else:
        grids = [{'method': 'CHAUDS365_TOP15_RANGS_'+str(i*5+1)+'_'+str((i+1)*5),
                  'numbers': sorted(hot[5*i:5*i+5]), 'extras': sorted(hot_extra[2*i:2*i+2])} for i in range(3)]
    return {'game': game, 'target': key, 'sample_start': sample[0]['date'], 'sample_end': sample[-1]['date'],
            'count': len(sample), 'method_version': 1, 'grids': grids,
            'main_frequency': {str(i): main[i] for i in range(1, len(main))},
            'extra_frequency': {str(i): extra[i] for i in range(1, len(extra))},
            'advantage_proven': False}


def evaluate(prediction, result):
    return [{'method': g['method'], 'number_hits': len(set(g['numbers']) & set(result['nums'])),
             'extra_hits': len(set(g['extras']) & set(result['extras']))} for g in prediction['grids']]


def validate_prior_forecast(file, target=None):
    """Do not evaluate a modified or uncertified forecast as prospective."""
    entry = json.loads(file.read_text('utf-8'))
    forecast = entry.get('forecast')
    if not isinstance(forecast, dict) or entry.get('content_sha256') != digest(forecast):
        raise ValueError('Prévision modifiée / empreinte incorrecte : ' + file.name)
    if target is not None and forecast.get('target') != target:
        raise ValueError('Nom de prévision et date contradictoires : ' + file.name)
    return entry


def is_verified_prospectively(file):
    """Independent cryptographic recheck, not a boolean from a JSON manifest."""
    from timestamp import check_existing, PROOFS, PARIS as PROOF_PARIS
    entry = validate_prior_forecast(file)
    target = entry['forecast']['target']
    deadline = datetime.fromisoformat(target + 'T18:00:00').replace(tzinfo=PROOF_PARIS)
    dest = PROOFS / file.stem
    manifest = dest.with_suffix('.json')
    if not manifest.is_file():
        return False
    check_existing(file, dest, manifest, deadline)
    return True


def run(today=None, now=None, histories=None):
    now = now or datetime.now(PARIS)
    if now.tzinfo is None:
        raise ValueError('Horodatage sans fuseau horaire')
    today = today or now.astimezone(PARIS).date()
    info = {'updated_utc': stamp(), 'mode': 'scientific_experiment_not_gameplay', 'games': {}, 'not_guaranteed': True}
    success = 0
    for game in CONFIG:
        try:
            if histories is None:
                data, sources = fetch_history(game, as_of=today, now=now)
            else:
                data = histories[game]
                sources = [{'url': 'fixture://test', 'zip_sha256': 'fixture'}]
            data = [row for row in data if result_available(row['date'], today, now)]
            save_history(game, data, sources)
            results_by_date = {row['date']: row for row in data}
            # Evaluation of all forecasts whose results are present, never overwriting old predictions.
            evaluations = []
            for file in sorted(JOURNAL.glob(game + '-*.json')):
                target_from_name = file.name[len(game)+1:-5]
                entry = validate_prior_forecast(file, target_from_name)
                if entry['forecast'].get('game') != game:
                    raise ValueError('Jeu de la prévision contradictoire : ' + file.name)
                hit = results_by_date.get(target_from_name)
                if hit:
                    # Ignore premature rows and refuse to call uncertified predictions
                    # a prospective success. RFC3161 tokens are checked every time.
                    close = datetime.fromisoformat(hit['date']+'T21:00:00').replace(tzinfo=PARIS)
                    if now.astimezone(PARIS) < close:
                        continue
                    try:
                        proof_verified = is_verified_prospectively(file)
                    except Exception as exc:
                        raise ValueError('Preuve cryptographique invalide pour '+file.name+': '+str(exc)) from exc
                    if not proof_verified:
                        evaluations.append({'forecast':file.name,'status':'uncertified_no_result_published'})
                        continue
                    outcome = {'target': hit['date'], 'actual': hit,
                               'comparisons': evaluate(entry['forecast'], hit),
                               'source_archive_sha256s': [src['zip_sha256'] for src in sources],
                               'forecast_sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
                               'prospectively_certified': True}
                    out = JOURNAL / ('resultat-' + game + '-' + hit['date'] + '.json')
                    if out.exists():
                        previous = json.loads(out.read_text('utf-8'))
                        if any(previous.get(k) != outcome[k] for k in
                               ('target','actual','comparisons','forecast_sha256','prospectively_certified')):
                            raise ValueError('Résultat publié contradictoire : '+out.name)
                    else:
                        write_json(out, outcome)
                    evaluations.append({'file':out.name,'status':'certified_prospective_result'})
            target = next_draw(game, today, now)
            out = JOURNAL / f'{game}-{target.isoformat()}.json'
            # During the draw day, publishing new prediction is blocked after 18:00 Paris.
            deadline = datetime(target.year, target.month, target.day, 18, 0, tzinfo=PARIS)
            if out.exists():
                validate_prior_forecast(out, target.isoformat())
                info['games'][game] = {'status': 'already_recorded', 'target': target.isoformat(), 'file': out.name, 'evaluated': evaluations}
            elif now.astimezone(PARIS) >= deadline:
                raise ValueError('Heure limite du tirage dépassée : aucune prévision rétrospective')
            else:
                forecast = build_forecast(game, data, target)
                obj = {'forecast': forecast, 'created_utc': stamp(), 'sources': sources,
                       'content_sha256': digest(forecast), 'timestamp_proof': 'github_commit_only_NOT_RFC3161',
                       'official_archive_link': CONFIG[game]['page'], 'prospective_certified': False}
                write_json(out, obj)
                info['games'][game] = {'status': 'forecast_recorded', 'target': target.isoformat(), 'file': out.name,
                                       'sha256': obj['content_sha256'], 'evaluated': evaluations}
            success += 1
        except Exception as exc:
            info['games'][game] = {'status': 'blocked', 'reason': str(exc), 'prediction_created': False}
    # Don't represent an unsuccessful fetch as success.
    info['status'] = 'completed' if success == len(CONFIG) else 'partial_or_blocked'
    write_json(PUBLIC, info)
    write_json(STATE, {'last_run': info['updated_utc'], 'status': info['status']})
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--date', help='date de simulation (YYYY-MM-DD), test local seulement')
    ap.add_argument('--check', action='store_true', help='Code retour non-zéro en cas de blocage')
    args = ap.parse_args()
    if args.date and os.getenv('GITHUB_ACTIONS'):
        raise SystemExit('Interdit de simuler une date dans GitHub Actions')
    today = date.fromisoformat(args.date) if args.date else None
    info = run(today=today)
    print(json.dumps(info, ensure_ascii=False, indent=2))
    if args.check and info['status'] != 'completed':
        sys.exit(1)


if __name__ == '__main__':
    main()
