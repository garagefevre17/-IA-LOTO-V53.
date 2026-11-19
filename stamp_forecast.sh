#!/usr/bin/env bash
set -euo pipefail
: "${TSA_URL:?Configurer le secret TSA_URL}"
: "${TSA_CA_PEM_B64:?Configurer le secret TSA_CA_PEM_B64}"
: "${FORECAST_FILE:?Fichier de prediction manquant}"
: "${FORECAST_STEM:?Nom de prediction manquant}"
python - "$TSA_URL" <<'PY'
import sys
from urllib.parse import urlsplit
p=urlsplit(sys.argv[1])
if p.scheme!='https' or not p.hostname or p.username or p.password or p.fragment:
    raise SystemExit('TSA URL must be an HTTPS endpoint without credentials')
PY
OUT="prospective/proofs/$FORECAST_STEM"
mkdir -p prospective/proofs
TRUST=$(mktemp)
trap 'rm -f "$TRUST"' EXIT
printf '%s' "$TSA_CA_PEM_B64" | base64 --decode > "$TRUST"
[ -s "$TRUST" ] || { echo 'Missing trust certificate'; exit 1; }
openssl ts -query -data "$FORECAST_FILE" -sha256 -cert -out "$OUT.tsq"
curl --fail --silent --show-error --max-time 35 --proto '=https' \
  -H 'Content-Type: application/timestamp-query' -H 'Accept: application/timestamp-reply' \
  --data-binary "@$OUT.tsq" "$TSA_URL" -o "$OUT.tsr"
openssl ts -verify -data "$FORECAST_FILE" -in "$OUT.tsr" -CAfile "$TRUST"
python verify_timestamp.py "$FORECAST_FILE" "$OUT.tsr"
