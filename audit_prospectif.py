#!/usr/bin/env python3
"""Contrôle en lecture seule des historiques et des preuves prospectives."""
import argparse
from datetime import date, datetime
import json

import pipeline


def index_draws(game, rows):
    cfg = pipeline.CONFIG[game]
    indexed = {}
    for row in rows:
        key = row['date']
        day = date.fromisoformat(key)
        if day.isoformat() != key or day.weekday() not in cfg['weekdays']:
            raise ValueError('Date de tirage invalide : ' + key)
        if key in indexed:
            raise ValueError('Date en double : ' + key)
        extra_count = 1 if game == 'loto' else 2
        for values, count, maximum in (
            (row['nums'], 5, cfg['limit']), (row['extras'], extra_count, cfg['extra'])
        ):
            if (not isinstance(values, list) or len(values) != count or
                    any(type(n) is not int or not 1 <= n <= maximum for n in values) or
                    len(set(values)) != count):
                raise ValueError('Combinaison invalide : ' + key)
        indexed[key] = (tuple(sorted(row['nums'])), tuple(sorted(row['extras'])))
    if not indexed:
        raise ValueError('Historique vide')
    if list(indexed) != sorted(indexed):
        raise ValueError('Dates non triées')
    return indexed


def audit_forecasts(game, official):
    report = {'certified': [], 'without_proof': [], 'rejected': [], 'pending': []}
    for path in sorted(pipeline.JOURNAL.glob(game + '-*.json')):
        key = path.stem[len(game)+1:]
        try:
            entry = pipeline.validate_prior_forecast(path, key)
            forecast = entry['forecast']
            sample_end = forecast['sample_end']
            if forecast['game'] != game or date.fromisoformat(sample_end) >= date.fromisoformat(key):
                raise ValueError('Le jeu ou la date de fin des données est incompatible.')
            if key not in official:
                report['pending'].append(key)
            elif pipeline.is_verified_prospectively(path):
                nums, extras = official[key]
                report['certified'].append({'date': key, 'comparisons': pipeline.evaluate(
                    forecast, {'nums': nums, 'extras': extras})})
            else:
                report['without_proof'].append(key)
        except (KeyError, TypeError, ValueError, RuntimeError, OSError) as exc:
            report['rejected'].append({'date': key, 'reason': str(exc)})
    report['conclusion'] = ('Aucun avantage prédictif démontré par cet audit.'
                            if report['certified'] else 'Aucune comparaison prospective certifiée.')
    return report


def inspect_game(game, now, offline):
    path = pipeline.DATA_DIR / (game + '.json')
    local = index_draws(game, json.loads(path.read_text(encoding='utf-8'))['draws'])
    first, last = next(iter(local)), next(reversed(local))
    report = {
        'local_count': len(local), 'first': first, 'last': last,
        'ordinary_dates_absent': [
            key for key in pipeline.expected_dates(game, date.fromisoformat(first), date.fromisoformat(last))
            if key not in local
        ],
    }
    if offline:
        report['fdj'] = {'status': 'not_checked'}
        return report
    try:
        rows, archives = pipeline.fetch_history(game, now=now)
        official = index_draws(game, rows)
        shared = local.keys() & official.keys()
        conflicts = sorted(key for key in shared if local[key] != official[key])
        missing = sorted(official.keys() - local.keys())
        unconfirmed = sorted(local.keys() - official.keys())
        report['fdj'] = {
            'status': 'matched' if not (conflicts or missing or unconfirmed) else 'differences',
            'last': next(reversed(official)), 'matching': len(shared) - len(conflicts),
            'conflicting_dates': conflicts, 'missing_locally': missing,
            'unconfirmed_locally': unconfirmed, 'archives': archives,
        }
        report['prospective'] = audit_forecasts(game, official)
    except (KeyError, TypeError, ValueError, RuntimeError, OSError) as exc:
        report['fdj'] = {'status': 'unavailable', 'reason': str(exc)}
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true', help='Contrôler uniquement les fichiers locaux')
    args = parser.parse_args()
    now = datetime.now(pipeline.PARIS)
    report = {}
    ok = True
    for game in pipeline.CONFIG:
        try:
            result = inspect_game(game, now, args.offline)
            report[game] = result
            ok &= (not result['ordinary_dates_absent'] and
                   result['fdj']['status'] == ('not_checked' if args.offline else 'matched') and
                   not result.get('prospective', {}).get('rejected'))
        except (KeyError, TypeError, ValueError, OSError) as exc:
            report[game] = {'local_error': str(exc)}
            ok = False
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
