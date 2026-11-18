"""Offline operational readiness report; never claims live connectivity."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
from zoneinfo import ZoneInfo
from forecast import load_draws, next_draw

PARIS = ZoneInfo('Europe/Paris')


def diagnose(root, now=None, env=None):
    root = Path(root)
    now = now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        raise ValueError('Aware datetime required')
    env = os.environ if env is None else env
    today = now.astimezone(PARIS).date()
    checks = []

    def add(name, status, detail):
        checks.append({'name': name, 'status': status, 'detail': detail})

    for name in ('index.html', 'app.js', 'euromillions.js', 'prospectif.js',
                 '.github/workflows/prospective.yml', '.github/workflows/results.yml'):
        add(name, 'pass' if (root/name).is_file() else 'fail',
            'File present' if (root/name).is_file() else 'File missing')
    csv = root/'loto_201911.csv'
    if csv.is_file():
        try:
            _, dates, digest = load_draws(csv, today)
            add('historical_csv', 'pass', f'{len(dates)} complete draws; last {dates[-1]}; sha256 {digest}')
            expected = next_draw(dates[-1])
            # On the expected draw day the local CSV is not yet demonstrably up to date.
            # Do not call it fresh until the expected draw is actually present.
            status = 'fail' if expected < today else ('pending' if expected == today else 'pass')
            add('source_freshness', status,
                f'Next expected draw {expected}; current Paris date {today}; pending means result not yet verified')
        except (ValueError, OSError, UnicodeError) as exc:
            add('historical_csv', 'fail', str(exc))
            add('source_freshness', 'unknown', 'CSV invalid')
    else:
        add('historical_csv', 'fail', 'Missing historical CSV')
        add('source_freshness', 'unknown', 'CSV unavailable')
    for name in ('FDJ_CSV_URL', 'FDJ_ALLOWED_HOST', 'TSA_URL', 'TSA_CA_PEM_B64'):
        add(f'configuration_{name}', 'configured' if env.get(name) else 'missing',
            'Present but NOT remotely validated' if env.get(name) else 'Required for automation')
    add('live_fdj_download', 'not_tested', 'No network call in offline diagnostic')
    add('live_tsa_signature', 'not_tested', 'No TSA token requested in offline diagnostic')
    add('github_actions_execution', 'not_tested', 'Cannot prove a hosted workflow ran locally')
    add('iphone_safari_interactions', 'not_tested', 'Requires real device test')
    return {'generated_utc': now.astimezone(dt.timezone.utc).isoformat(),
            'overall': 'not_production_verified', 'checks': checks}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='.')
    parser.add_argument('--output', default='diagnostic_fiabilite.json')
    args = parser.parse_args()
    report = diagnose(args.root)
    output = Path(args.output)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
    print(f'Diagnostic saved: {output}; overall: {report["overall"]}')
    for item in report['checks']:
        print(f'{item["status"]:>12} {item["name"]}: {item["detail"]}')


if __name__ == '__main__':
    main()
