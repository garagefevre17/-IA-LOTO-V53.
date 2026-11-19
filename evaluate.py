"""Evaluate immutable, independently timestamped LOTO forecasts against later draws."""
import datetime as dt
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from zoneinfo import ZoneInfo
from forecast import load_draws, next_draw
from collections import Counter

ROOT = Path('prospective')
PARIS = ZoneInfo('Europe/Paris')


def verify_receipt(prediction, receipt, trust_file):
    subprocess.run(['openssl', 'ts', '-verify', '-data', str(prediction), '-in', str(receipt), '-CAfile', str(trust_file)], check=True, capture_output=True, text=True)
    subprocess.run([sys.executable, str(Path(__file__).resolve().with_name('verify_timestamp.py')), str(prediction), str(receipt)], check=True, capture_output=True, text=True)


def verify_frozen_forecast(info, draws, target, numbers, chance, prediction):
    # Recalculate the frozen method from the 300 draws preceding the target.
    training = sorted(d for d in draws if d < target)[-300:]
    if len(training) != 300 or next_draw(training[-1]) != target:
        raise ValueError(f'Incomplete training history for {prediction}')
    if (info.get('training_count') != 300 or
            info.get('training_first') != training[0].isoformat() or
            info.get('training_last') != training[-1].isoformat()):
        raise ValueError(f'Training metadata mismatch: {prediction}')
    frequencies = Counter(n for d in training for n in draws[d][0])
    chance_frequencies = Counter(draws[d][1] for d in training)
    expected_numbers = sorted(sorted(range(1, 50), key=lambda n: (frequencies[n], n))[:5])
    expected_chance = min(range(1, 11), key=lambda n: (chance_frequencies[n], n))
    if sorted(numbers) != expected_numbers or chance != expected_chance:
        raise ValueError(f'Forecast differs from frozen Froids 300 protocol: {prediction}')
    created = dt.datetime.fromisoformat(info['generated_utc'])
    if created.tzinfo is None or created.astimezone(PARIS).date() != target or created.astimezone(PARIS).time() >= dt.time(18, 0):
        raise ValueError(f'Invalid forecast creation time: {prediction}')


def main():
    trust = os.environ.get('TSA_CA_PEM_B64', '')
    if not trust:
        raise ValueError('TSA trust chain missing: cannot certify assessments')
    import base64
    import tempfile
    try:
        pem = base64.b64decode(trust, validate=True)
    except Exception as exc:
        raise ValueError('Invalid TSA trust chain encoding') from exc
    today = dt.datetime.now(PARIS).date()
    draws, _, digest = load_draws(Path('loto_201911.csv'), today)
    with tempfile.TemporaryDirectory() as directory:
        trust_file = Path(directory) / 'tsa-ca.pem'
        trust_file.write_bytes(pem)
        changed = 0
        for prediction in sorted(ROOT.glob('loto-????-??-??.json')):
            info = json.loads(prediction.read_text(encoding='utf-8'))
            target = dt.date.fromisoformat(info['target'])
            if target > today or target not in draws:
                continue
            if prediction.name != f'loto-{target.isoformat()}.json' or info.get('game') != 'LOTO' or info.get('protocol') != 'Froids 300 — frozen':
                raise ValueError(f'Forecast identity invalid: {prediction}')
            numbers = info['numbers']
            chance = info['chance']
            if not isinstance(numbers, list) or len(numbers) != 5 or len(set(numbers)) != 5 or not all(type(n) is int and 1 <= n <= 49 for n in numbers) or type(chance) is not int or not 1 <= chance <= 10:
                raise ValueError(f'Invalid forecast values: {prediction}')
            verify_frozen_forecast(info, draws, target, numbers, chance, prediction)
            proof = ROOT / 'proofs' / f'{prediction.stem}.tsr'
            if not proof.is_file():
                raise ValueError(f'Missing TSA receipt for {prediction}')
            verify_receipt(prediction, proof, trust_file)
            destination = ROOT / 'results' / prediction.name
            if destination.exists():
                # Never silently trust an existing result: verify that it still
                # matches the immutable prediction, receipt, and current draw.
                existing = json.loads(destination.read_text(encoding='utf-8'))
                winning, winning_chance = draws[target]
                expected = {
                    'forecast_sha256': hashlib.sha256(prediction.read_bytes()).hexdigest(),
                    'timestamp_receipt_sha256': hashlib.sha256(proof.read_bytes()).hexdigest(),
                    'forecast_numbers': sorted(numbers), 'forecast_chance': chance,
                    'draw_numbers': list(winning), 'draw_chance': winning_chance,
                    'main_hits': len(set(numbers) & set(winning)),
                    'chance_hit': chance == winning_chance,
                }
                if any(existing.get(key) != value for key, value in expected.items()):
                    raise ValueError(f'Existing assessment conflicts with verified inputs: {destination}')
                continue
            winning, winning_chance = draws[target]
            result = {
                'game': 'LOTO', 'target': info['target'],
                'forecast_file': prediction.as_posix(),
                'forecast_sha256': hashlib.sha256(prediction.read_bytes()).hexdigest(),
                'timestamp_receipt': proof.as_posix(),
                'timestamp_receipt_sha256': hashlib.sha256(proof.read_bytes()).hexdigest(),
                'forecast_numbers': sorted(numbers), 'forecast_chance': chance,
                'draw_numbers': list(winning), 'draw_chance': winning_chance,
                'main_hits': len(set(numbers) & set(winning)),
                'chance_hit': chance == winning_chance,
                'result_csv_sha256': digest,
                'result_source_authenticity': 'not independently certified',
                'verified_tsa_on_this_run': True,
                'note': 'TSA signature and time verified with configured trust chain; source authenticity not established.'
            }
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open('x', encoding='utf-8') as handle:
                json.dump(result, handle, indent=2, ensure_ascii=False)
                handle.write('\n')
            changed += 1
        print(f'New prospective results: {changed}')

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError, subprocess.CalledProcessError) as exc:
        sys.exit(f'Assessment refused: {exc}')
