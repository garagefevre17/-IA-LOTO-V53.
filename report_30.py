"""Audit the first 30 *consecutive scheduled draws*, not the first 30 successes.

The report command re-verifies every result against its timestamp and current draw
before computing a summary. ``build_summary`` alone only validates record format.
"""
import datetime as dt
import json
from pathlib import Path
from forecast import next_draw


def build_summary(folder, today=None, predictions_folder=None):
    files = sorted(folder.glob('loto-????-??-??.json')) if folder.exists() else []
    by_date = {}
    for file in files:
        row = json.loads(file.read_text(encoding='utf-8'))
        target = row.get('target')
        try:
            date = dt.date.fromisoformat(target)
        except (ValueError, TypeError):
            raise ValueError(f'Invalid date: {file}') from None
        if (file.name != f'loto-{target}.json' or date.weekday() not in (0, 2, 5)
                or row.get('game') != 'LOTO'
                or row.get('verified_tsa_on_this_run') is not True
                or type(row.get('main_hits')) is not int or not 0 <= row['main_hits'] <= 5
                or type(row.get('chance_hit')) is not bool
                or date in by_date):
            raise ValueError(f'Invalid evaluated result: {file}')
        for key in ('forecast_sha256', 'timestamp_receipt_sha256'):
            value = row.get(key)
            if not isinstance(value, str) or len(value) != 64 or any(c not in '0123456789abcdef' for c in value):
                raise ValueError(f'Missing or malformed evidence hash in {file}')
        by_date[date] = row
    if today is None:
        today = dt.date.today()
    rows = []
    missing = []
    pending = []
    window = []
    if predictions_folder is not None:
        predictions = sorted(predictions_folder.glob('loto-????-??-??.json')) if predictions_folder.exists() else []
        starts = []
        for prediction in predictions:
            value = json.loads(prediction.read_text(encoding='utf-8'))
            target = value.get('target')
            if prediction.name != f'loto-{target}.json' or value.get('protocol') != 'Froids 300 — frozen':
                raise ValueError(f'Unrecognized prediction: {prediction}')
            d = dt.date.fromisoformat(target)
            if d.weekday() not in (0, 2, 5):
                raise ValueError(f'Invalid forecast target: {prediction}')
            starts.append(d)
        # Never move the first-30 window forward to omit a failed assessment.
        start = min(starts) if starts else (min(by_date) if by_date else None)
    else:
        start = min(by_date) if by_date else None
    if start is not None:
        date = start
        for _ in range(30):
            window.append(date.isoformat())
            if date in by_date:
                rows.append(by_date[date])
            elif date <= today:
                missing.append(date.isoformat())
            else:
                pending.append(date.isoformat())
            date = next_draw(date)
        # Later evaluations must not replace missing events in the first 30.
    return {
        'protocol': 'Froids 300 — frozen',
        'window_start': window[0] if window else None,
        'window_end': window[-1] if window else None,
        'evaluated_results': len(rows),
        'certified_results': len(rows),  # Compatibility with existing dashboard.
        'target_results': 30,
        'missing_draws': missing,
        'pending_draws': pending,
        'complete': len(rows) == 30 and not missing and not pending,
        'main_hits_total': sum(row['main_hits'] for row in rows),
        'chance_hits_total': sum(row['chance_hit'] for row in rows),
        'expected_main_hits_random': len(rows) * 25 / 49,
        'expected_chance_hits_random': len(rows) / 10,
        'notes': ('Report uses the first 30 scheduled draws starting with the first recorded prediction when available. '
                  'Missing draws cannot be substituted by later wins. Independently verify '
                  'source and RFC3161 receipts before trusting this report. Theoretical '
                  'expectations do not demonstrate any predictive edge.'),
        'results': [{'date': row['target'], 'main_hits': row['main_hits'], 'chance_hit': row['chance_hit']} for row in rows]
    }


def main():
    # Re-verify cryptographic proofs, prediction values, and official-like CSV before reporting.
    from evaluate import main as validate_evaluations
    from zoneinfo import ZoneInfo
    validate_evaluations()
    today = dt.datetime.now(ZoneInfo('Europe/Paris')).date()
    summary = build_summary(Path('prospective/results'), today=today, predictions_folder=Path('prospective'))
    out = Path('prospective/bilan_30.json')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Validated assessments {summary["evaluated_results"]}/30; missing={len(summary["missing_draws"])}')


if __name__ == '__main__':
    main()
