#!/usr/bin/env python3
"""Optional RFC3161 timestamping of immutable forecast files via FreeTSA.

A forecast is certified only after openssl's cryptographic verification succeeds.
Errors are reported, not hidden. This needs network & openssl at GitHub Actions runtime.
"""
import hashlib
import os
import json
import re
from datetime import timezone
from datetime import datetime
from pathlib import Path
import subprocess
import tempfile
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
if ROOT.name == 'automation':
    ROOT = ROOT.parent
JOURNAL = ROOT / 'automatisation' / 'journal'
PROOFS = ROOT / 'automatisation' / 'preuves'
PARIS = ZoneInfo('Europe/Paris')
CA_URL = 'https://freetsa.org/files/cacert.pem'
TSA_URL = 'https://freetsa.org/files/tsa.crt'
ENDPOINT = 'https://freetsa.org/tsr'
# Certificate downloads are TLS protected and verified via OpenSSL; record actual hashes.
# Certificate rotation must not silently turn into a fabricated proof.


def trusted_root_hash():
    """Explicit operator-approved CA pin: never trust an arbitrary repo CA."""
    value = os.environ.get('FREETSA_CA_SHA256', '').strip().lower()
    if not re.fullmatch(r'[a-f0-9]{64}', value):
        raise RuntimeError('FREETSA_CA_SHA256 non configuré (empreinte du CA FreeTSA requise)')
    return value


def request(url, data=None, headers=None):
    with urlopen(Request(url, data=data, headers=headers or {'User-Agent':'IA-LOTO-V53-RFC3161/1.0'}), timeout=20) as r:
        if not r.geturl().startswith('https://freetsa.org/'):
            raise RuntimeError('Redirection TSA non autorisée')
        content = r.read(256_001)
        if len(content) > 256_000:
            raise RuntimeError('Réponse TSA trop volumineuse')
        return content


def run_cmd(args):
    cp = subprocess.run(args, capture_output=True, text=True, timeout=20)
    if cp.returncode != 0:
        raise RuntimeError('OpenSSL: ' + (cp.stderr or cp.stdout).strip()[:500])
    return cp.stdout


def extract_signed_time(tsr):
    details = run_cmd(['openssl','ts','-reply','-in',str(tsr),'-text'])
    match = re.search(r'Time stamp:\s+([A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})(?:\.\d+)?\s+(\d{4})\s+GMT',details)
    if not match:
        raise RuntimeError('Heure TSA introuvable dans le jeton signé')
    return datetime.strptime(match.group(1)+' '+match.group(2),'%b %d %H:%M:%S %Y').replace(tzinfo=timezone.utc)


def check_existing(path, dest, manifest, deadline):
    existing = json.loads(manifest.read_text('utf-8'))
    if not existing.get('verified') or existing.get('file_sha256') != hashlib.sha256(path.read_bytes()).hexdigest():
        raise RuntimeError('Manifeste de preuve incohérent')
    tsq, tsr = dest.with_suffix('.tsq'), dest.with_suffix('.tsr')
    if not (tsq.is_file() and tsr.is_file()):
        raise RuntimeError('Preuves TSQ/TSR absentes')
    if existing.get('tsq_sha256') != hashlib.sha256(tsq.read_bytes()).hexdigest() or existing.get('tsr_sha256') != hashlib.sha256(tsr.read_bytes()).hexdigest():
        raise RuntimeError('Empreinte TSQ/TSR incohérente')
    t = datetime.fromisoformat(existing['tsa_time_utc'])
    if t.tzinfo is None:
        raise RuntimeError('Manifeste sans fuseau horaire')
    if t >= deadline.astimezone(timezone.utc):
        raise RuntimeError('Heure de la preuve après le délai')
    # A previous result is NOT enough by itself: re-check its signed message against
    # the unchanged forecast. The TSQ independently fixes the signed digest.
    with tempfile.TemporaryDirectory() as td:
        tmp=Path(td)
        ca=dest.with_suffix('.ca.pem')
        tsa=dest.with_suffix('.tsa.crt')
        if not (ca.is_file() and tsa.is_file()):
            raise RuntimeError('Certificats de vérification historiques absents')
        if (hashlib.sha256(ca.read_bytes()).hexdigest()!=existing.get('ca_sha256') or
            hashlib.sha256(tsa.read_bytes()).hexdigest()!=existing.get('tsa_cert_sha256')):
            raise RuntimeError('Certificats historiques modifiés')
        if hashlib.sha256(ca.read_bytes()).hexdigest() != trusted_root_hash():
            raise RuntimeError('Autorité racine de confiance différente du certificat approuvé')
        run_cmd(['openssl','ts','-verify','-in',str(tsr),'-queryfile',str(tsq),
                 '-CAfile',str(ca),'-untrusted',str(tsa)])
        # Check that the timestamped query actually represents these immutable bytes.
        run_cmd(['openssl','ts','-verify','-in',str(tsr),'-data',str(path),
                 '-CAfile',str(ca),'-untrusted',str(tsa)])
        actual_time=extract_signed_time(tsr)
        if abs((t.astimezone(timezone.utc)-actual_time).total_seconds())>1:
            raise RuntimeError('Heure déclarée différente de celle signée par la TSA')
        if actual_time >= deadline.astimezone(timezone.utc):
            raise RuntimeError('Heure réelle signée après la limite')
    return existing


def stamp_file(path):
    obj = json.loads(path.read_text('utf-8'))
    target = obj['forecast']['target']
    expected_hash = hashlib.sha256(json.dumps(obj['forecast'], sort_keys=True,
        ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()
    if obj.get('content_sha256') != expected_hash:
        raise RuntimeError('Prévision corrompue ou empreinte absente')
    deadline = datetime.fromisoformat(target+'T18:00:00').replace(tzinfo=PARIS)
    PROOFS.mkdir(parents=True, exist_ok=True)
    dest = PROOFS / path.stem
    manifest = dest.with_suffix('.json')
    if manifest.exists():
        return check_existing(path, dest, manifest, deadline)
    if datetime.now(PARIS) >= deadline:
        raise RuntimeError('Horodatage refusé : heure limite dépassée pour ' + target)
    with tempfile.TemporaryDirectory() as td:
        tmp=Path(td)
        ca=request(CA_URL); tsa=request(TSA_URL)
        ca_hash=hashlib.sha256(ca).hexdigest();tsa_hash=hashlib.sha256(tsa).hexdigest()
        if ca_hash != trusted_root_hash():
            raise RuntimeError('Certificat racine FreeTSA non conforme à FREETSA_CA_SHA256')
        (tmp/'ca.pem').write_bytes(ca); (tmp/'tsa.crt').write_bytes(tsa)
        tsq = tmp/'request.tsq'; tsr=tmp/'response.tsr'
        run_cmd(['openssl','ts','-query','-data',str(path),'-sha256','-cert','-out',str(tsq)])
        tsr.write_bytes(request(ENDPOINT, tsq.read_bytes(), {'Content-Type':'application/timestamp-query'}))
        output = run_cmd(['openssl','ts','-verify','-in',str(tsr),'-queryfile',str(tsq),
                          '-CAfile',str(tmp/'ca.pem'),'-untrusted',str(tmp/'tsa.crt')])
        if 'Verification: OK' not in output:
            raise RuntimeError('Vérification TSA non confirmée')
        # Also verify the same signed token against the forecast bytes themselves.
        run_cmd(['openssl','ts','-verify','-in',str(tsr),'-data',str(path),
                 '-CAfile',str(tmp/'ca.pem'),'-untrusted',str(tmp/'tsa.crt')])
        tsa_time = extract_signed_time(tsr)

        if tsa_time >= deadline.astimezone(timezone.utc):
            raise RuntimeError('Horodatage TSA postérieur à 18 h Paris : preuve non admissible')
        if tsa_time > datetime.now(timezone.utc) + __import__('datetime').timedelta(minutes=5):
            raise RuntimeError('Heure TSA anormalement future')
        dest.with_suffix('.ca.pem').write_bytes(ca)
        dest.with_suffix('.tsa.crt').write_bytes(tsa)
        dest.with_suffix('.tsq').write_bytes(tsq.read_bytes())
        dest.with_suffix('.tsr').write_bytes(tsr.read_bytes())
        summary={'verified':True,'authority':'FreeTSA','protocol':'RFC3161',
                 'request':dest.name+'.tsq','response':dest.name+'.tsr',
                 'forecast_file':path.name,'file_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                 'tsq_sha256':hashlib.sha256(tsq.read_bytes()).hexdigest(),
                 'tsr_sha256':hashlib.sha256(tsr.read_bytes()).hexdigest(),
                 'verified_at_utc':datetime.now(timezone.utc).isoformat(),
                 'tsa_time_utc':tsa_time.isoformat(),
                 'ca_sha256':ca_hash,'tsa_cert_sha256':tsa_hash,'trust_anchor_pinned':True,
                 'validation':'openssl ts -verify: Verification: OK',
                 'claim':'signature cryptographiquement valide; vérifier heure TSA avant tirage'}
        manifest.write_text(json.dumps(summary,sort_keys=True,indent=2)+'\n',encoding='utf-8')
        return summary


def main():
    outcomes=[]
    for file in sorted(JOURNAL.glob('*.json')):
        if not file.name.startswith(('loto-','euromillions-')):
            continue
        try:
            outcomes.append({'file':file.name,'proof':stamp_file(file)['verified']})
        except Exception as e:
            outcomes.append({'file':file.name,'proof':False,'reason':str(e)})
    report={'checked_at_utc':datetime.now(ZoneInfo('UTC')).isoformat(),
            'status':'verified' if outcomes and all(x['proof'] for x in outcomes) else 'unverified_or_empty',
            'forecasts':outcomes}
    (ROOT/'automatisation').mkdir(parents=True,exist_ok=True)
    (ROOT/'automatisation'/'horodatage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return report['status']=='verified'

if __name__ == '__main__':
    # We must not mark unverified proofs as certified.
    main()
