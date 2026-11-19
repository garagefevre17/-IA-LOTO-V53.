"""Download a pre-audited, direct CSV source; never replace history on failure.
An allowed HTTPS host and URL are configuration, not proof of FDJ authorship.
"""
import datetime as dt
import os
import sys
import tempfile
import io
import zipfile
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit
from forecast import load_draws, PARIS

LIMIT = 15_000_000
MAX_UNCOMPRESSED = 15_000_000
DEST = Path('loto_201911.csv')


def validate_url(url, host):
    p = urlsplit(url)
    if (p.scheme != 'https' or p.hostname != host or p.username or p.password
            or p.port not in (None, 443) or not p.path):
        raise ValueError('FDJ CSV URL not allowed (host, credentials, or protocol)')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise ValueError('Redirect forbidden: audit the final source URL first')


def extract_csv(data):
    """Accept official FDJ ZIP archives or CSV, rejecting ambiguous or oversized files."""
    if not data.startswith(b'PK\x03\x04'):
        return data
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = [i for i in archive.infolist() if not i.is_dir() and i.filename.lower().endswith('.csv')]
        if len(names) != 1:
            raise ValueError(f'FDJ ZIP must contain exactly one CSV; found {len(names)}')
        entry = names[0]
        if entry.file_size > MAX_UNCOMPRESSED or entry.flag_bits & 0x1:
            raise ValueError('CSV ZIP entry oversized or encrypted')
        with archive.open(entry) as stream:
            body = stream.read(MAX_UNCOMPRESSED + 1)
        if len(body) > MAX_UNCOMPRESSED:
            raise ValueError('Expanded CSV too large')
        return body


def main():
    url = os.environ.get('FDJ_CSV_URL', '').strip()
    host = os.environ.get('FDJ_ALLOWED_HOST', '').strip().lower()
    if not host or any(x in host for x in '/:@?#') or os.environ.get('FDJ_FEED_AUDITED') != 'yes':
        raise ValueError('FDJ source host not configured and explicitly audited')
    validate_url(url, host)
    opener = urllib.request.build_opener(NoRedirect)
    with opener.open(urllib.request.Request(url, headers={'User-Agent': 'IA-LOTO-V53-audit/1.0'}), timeout=30) as reply:
        if reply.status != 200:
            raise ValueError(f'Unexpected HTTP status: {reply.status}')
        data = reply.read(LIMIT + 1)
    if len(data) > LIMIT or len(data) < 100:
        raise ValueError('Unexpected CSV size')
    fd, name = tempfile.mkstemp(prefix='fdj-candidate-', suffix='.csv', dir='.')
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(extract_csv(data))
        candidate = Path(name)
        draws, dates, digest = load_draws(candidate, dt.datetime.now(PARIS).date())
        if DEST.exists():
            old_draws, old_dates, _ = load_draws(DEST, dt.datetime.now(PARIS).date())
            if dates[-1] < old_dates[-1]:
                raise ValueError('CSV source goes backward')
            for date, result in old_draws.items():
                if date not in draws or draws[date] != result:
                    raise ValueError(f'Historical draw changed or disappeared: {date}')
        candidate.replace(DEST)
        print(f'Validated {len(draws)} CSV draws; latest {dates[-1]}; SHA256 {digest}')
        print('Source ownership remains conditional on independent URL audit')
    finally:
        Path(name).unlink(missing_ok=True)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, UnicodeError, urllib.error.URLError) as exc:
        sys.exit(f'FDJ SYNC REFUSED: {exc}')
