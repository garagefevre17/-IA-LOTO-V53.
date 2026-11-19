"""Obtain and verify RFC3161 receipt before any forecast is committed."""
import base64
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit


def main(forecast):
    path = Path(forecast)
    if not path.is_file() or path.parent != Path('prospective'):
        raise ValueError('Invalid forecast path')
    url = os.environ.get('TSA_URL', '').strip()
    parts = urlsplit(url)
    if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password:
        raise ValueError('Trusted TSA HTTPS URL required')
    encoded = os.environ.get('TSA_CA_PEM_B64', '')
    if not encoded:
        raise ValueError('Trusted TSA CA bundle missing')
    trust = base64.b64decode(encoded, validate=True)
    if b'BEGIN CERTIFICATE' not in trust:
        raise ValueError('CA bundle is not PEM')
    receipt = Path('prospective/proofs') / f'{path.stem}.tsr'
    if receipt.exists():
        raise ValueError('Timestamp receipt already exists; no replacement')
    receipt.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        request = temp / 'query.tsq'
        response = temp / 'response.tsr'
        trust_path = temp / 'tsa-ca.pem'
        trust_path.write_bytes(trust)
        subprocess.run(['openssl', 'ts', '-query', '-data', str(path), '-sha256', '-cert', '-out', str(request)], check=True)
        payload = request.read_bytes()
        opener = urllib.request.build_opener(_NoRedirect)
        with opener.open(urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/timestamp-query', 'Accept': 'application/timestamp-reply'}, method='POST'), timeout=30) as reply:
            if reply.status != 200:
                raise ValueError(f'TSA returned HTTP {reply.status}')
            body = reply.read(1_000_001)
        if not body or len(body) > 1_000_000:
            raise ValueError('Invalid TSA response size')
        response.write_bytes(body)
        subprocess.run(['openssl', 'ts', '-verify', '-data', str(path), '-in', str(response), '-CAfile', str(trust_path)], check=True)
        subprocess.run([sys.executable, 'verify_timestamp.py', str(path), str(response)], check=True)
        # Atomically write only a fully verified receipt.
        with receipt.open('xb') as output:
            output.write(body)
        print(f'Verified RFC3161 receipt: {receipt}')


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('TSA redirect refused')


if __name__ == '__main__':
    try:
        if len(sys.argv) != 2:
            raise ValueError('Usage: stamp_forecast.py prospective/loto-YYYY-MM-DD.json')
        main(sys.argv[1])
    except Exception as error:
        sys.exit(f'TIMESTAMP REFUSED: {error}')
