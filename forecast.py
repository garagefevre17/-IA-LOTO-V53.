"""Frozen Froids 300 forecast. Fails closed on missing or stale source data."""
import csv
import datetime as dt
import hashlib
import json
import os
import sys
from collections import Counter
from pathlib import Path
from zoneinfo import ZoneInfo

PARIS = ZoneInfo('Europe/Paris')
DAYS = (0, 2, 5)
CSV_PATH = Path('loto_201911.csv')


def fail(message):
    raise ValueError(message)


def load_draws(path, today):
    raw = path.read_bytes()
    lines = raw.decode('utf-8-sig').splitlines()
    reader = csv.DictReader(lines, delimiter=';')
    required = {'date_de_tirage', 'numero_chance', *(f'boule_{i}' for i in range(1, 6))}
    if not reader.fieldnames or not required.issubset(reader.fieldnames):
        fail('Missing required CSV columns')
    seen = {}
    for row_number, row in enumerate(reader, 2):
        if None in row or any(value is None for value in row.values()):
            fail(f'CSV row {row_number}: unexpected columns or missing fields')
        try:
            date = dt.datetime.strptime(row['date_de_tirage'], '%d/%m/%Y').date()
            nums = tuple(int(row[f'boule_{i}']) for i in range(1, 6))
            chance = int(row['numero_chance'])
        except (TypeError, ValueError, KeyError) as exc:
            fail(f'CSV row {row_number} invalid: {exc}')
        if date.weekday() not in DAYS or date > today:
            fail(f'CSV row {row_number}: invalid draw date {date}')
        if len(set(nums)) != 5 or not all(1 <= n <= 49 for n in nums) or not 1 <= chance <= 10:
            fail(f'CSV row {row_number}: invalid numbers')
        value = (tuple(sorted(nums)), chance)
        if date in seen:
            fail(f'Duplicate date {date}, including identical records')
        seen[date] = value
    if len(seen) < 300:
        fail('Fewer than 300 draws')
    dates = sorted(seen)
    for earlier, later in zip(dates, dates[1:]):
        if next_draw(earlier) != later:
            fail(f'Missing or unexpected draw between {earlier} and {later}')
    return seen, dates, hashlib.sha256(raw).hexdigest()


def next_draw(after):
    target = after + dt.timedelta(days=1)
    while target.weekday() not in DAYS:
        target += dt.timedelta(days=1)
    return target


def make_forecast(now, path=CSV_PATH):
    if now.tzinfo is None:
        fail('Timezone-aware clock required')
    local = now.astimezone(PARIS)
    today = local.date()
    if today.weekday() not in DAYS:
        fail('Forecasts only permitted on draw days')
    # Conservative operational cutoff, not a claim about FDJ ticket sales.
    if local.time() >= dt.time(18, 0):
        fail('Operational cutoff 18:00 Europe/Paris exceeded')
    draws, dates, digest = load_draws(path, today)
    last = dates[-1]
    if last >= today:
        fail('Today draw already present: refuse retrospective prediction')
    if (today - last).days > 3 or next_draw(last) != today:
        fail(f'Latest draw {last} does not immediately precede target {today}')
    training = dates[-300:]
    freq = Counter(n for d in training for n in draws[d][0])
    chance_freq = Counter(draws[d][1] for d in training)
    numbers = sorted(sorted(range(1, 50), key=lambda n: (freq[n], n))[:5])
    chance = min(range(1, 11), key=lambda n: (chance_freq[n], n))
    return {
        'protocol': 'Froids 300 — frozen', 'game': 'LOTO', 'target': today.isoformat(),
        'numbers': numbers, 'chance': chance,
        'training_first': training[0].isoformat(), 'training_last': training[-1].isoformat(),
        'training_count': 300, 'csv_sha256': digest,
        'generated_utc': now.astimezone(dt.timezone.utc).isoformat(),
        'source_authenticity': 'not independently certified',
        'operational_cutoff': '18:00 Europe/Paris (conservative, not FDJ deadline)'
    }


def main():
    now = dt.datetime.now(dt.timezone.utc)
    result = make_forecast(now)
    output = Path('prospective') / f"loto-{result['target']}.json"
    output.parent.mkdir(exist_ok=True)
    with output.open('x', encoding='utf-8') as file:
        json.dump(result, file, ensure_ascii=False, indent=2)
        file.write('\n')
    # A fixed output path is passed to the workflow; no ambiguous `find`.
    with Path(os.environ.get('GITHUB_OUTPUT', '/dev/null')).open('a') as github_output:
        github_output.write(f'forecast_file={output}\nforecast_stem={output.stem}\n')
    print(f'Forecast created: {output}')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, FileExistsError, OSError) as error:
        sys.exit(f'FAIL CLOSED: {error}')
