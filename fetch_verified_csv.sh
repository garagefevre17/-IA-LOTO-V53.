#!/usr/bin/env bash
set -euo pipefail
: "${FDJ_CSV_URL:?Configurer le secret FDJ_CSV_URL}"
: "${FDJ_ALLOWED_HOST:?Configurer la variable FDJ_ALLOWED_HOST}"
# Reject redirects outside the allowlisted HTTPS host BEFORE saving the data.
python - "$FDJ_CSV_URL" "$FDJ_ALLOWED_HOST" <<'PY'
import sys
from urllib.parse import urlsplit
u, allowed = sys.argv[1:]
p=urlsplit(u)
if p.scheme!='https' or p.hostname!=allowed or p.username or p.password or p.port not in (None,443):
    raise SystemExit('Source URL rejected: HTTPS exact allowed host required')
PY
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
# curl reports final target; validate before using downloaded bytes.
FINAL=$(curl --fail --silent --show-error --location --max-redirs 3 --max-time 30 --max-filesize 15000000 --proto '=https' --proto-redir '=https' --output "$TMP" --write-out '%{url_effective}' "$FDJ_CSV_URL")
python - "$FINAL" "$FDJ_ALLOWED_HOST" <<'PY'
import sys
from urllib.parse import urlsplit
p=urlsplit(sys.argv[1]); host=sys.argv[2]
if p.scheme!='https' or p.hostname!=host or p.username or p.password or p.port not in (None,443):
    raise SystemExit('Download redirected to untrusted destination')
PY
# Never overwrite the checked-in CSV unless structurally verified.
cp "$TMP" loto_201911.csv.new
trap 'rm -f "$TMP" loto_201911.csv.new' EXIT
python - <<'PYVALIDATE'
import datetime as dt
from pathlib import Path
from forecast import load_draws, PARIS
load_draws(Path("loto_201911.csv.new"), dt.datetime.now(PARIS).date())
PYVALIDATE
mv loto_201911.csv.new loto_201911.csv
python validate_source.py "$FDJ_CSV_URL" "$FINAL"
