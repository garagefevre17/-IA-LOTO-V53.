"""Validate source URL, exact host and all LOTO CSV draw records.
This is NOT independent FDJ origin certification.
"""
import datetime as dt
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit
from forecast import load_draws, PARIS

if len(sys.argv) != 3:
    sys.exit('REJECTED: provide original and final URL')
allowed = os.environ.get('FDJ_ALLOWED_HOST', '').strip().lower()
if not allowed or any(c in allowed for c in '/:@?#'):
    sys.exit('REJECTED: invalid FDJ_ALLOWED_HOST')
for url in sys.argv[1:]:
    parsed = urlsplit(url)
    if (parsed.scheme != 'https' or parsed.hostname != allowed or
            parsed.username or parsed.password or parsed.port not in (None, 443)):
        sys.exit('REJECTED: source or redirect host not allowed')
path = Path('loto_201911.csv')
if not path.is_file() or not 100 <= path.stat().st_size <= 15_000_000:
    sys.exit('REJECTED: missing or unexpected CSV size')
try:
    _, dates, digest = load_draws(path, dt.datetime.now(PARIS).date())
except (ValueError, UnicodeError, OSError) as exc:
    sys.exit(f'REJECTED: invalid or incomplete draw history: {exc}')
print(f'CSV validated: {len(dates)} draws; last {dates[-1]}; SHA256 {digest}')
print('WARNING: source provenance is not independently certified as FDJ')
