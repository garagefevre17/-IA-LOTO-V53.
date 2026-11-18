"""Check RFC3161 genTime against forecast target and conservative Paris cutoff.
Cryptographic verification MUST have succeeded in the preceding openssl ts -verify step.
"""
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

forecast = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
result = subprocess.run(['openssl', 'ts', '-reply', '-in', sys.argv[2], '-text'], capture_output=True, text=True, check=True)
match = re.search(r'^Time stamp:\s*(.+)$', result.stdout, re.MULTILINE)
if not match:
    sys.exit('No timestamp genTime in TSA response')
# OpenSSL typically prints "Nov 18 14:15:00 2026 GMT".
raw = match.group(1).strip()
try:
    gen_time = dt.datetime.strptime(raw, '%b %d %H:%M:%S %Y GMT').replace(tzinfo=dt.timezone.utc)
except ValueError as exc:
    sys.exit(f'Unrecognized TSA time: {raw}: {exc}')
target = dt.date.fromisoformat(forecast['target'])
local = gen_time.astimezone(ZoneInfo('Europe/Paris'))
if local.date() != target or local.time() >= dt.time(18, 0):
    sys.exit(f'Timestamp {local.isoformat()} not before target-day operational cutoff')
created = dt.datetime.fromisoformat(forecast['generated_utc'])
if created.tzinfo is None:
    sys.exit('Forecast generation time has no timezone')
if gen_time < created - dt.timedelta(minutes=5):
    sys.exit('Timestamp unexpectedly precedes forecast generation')
if gen_time > created + dt.timedelta(minutes=15):
    sys.exit('Timestamp arrived too late after forecast generation')
if created.astimezone(ZoneInfo('Europe/Paris')).date() != target:
    sys.exit('Forecast generation date differs from target date')
print(f'RFC3161 timestamp time accepted: {gen_time.isoformat()}')
