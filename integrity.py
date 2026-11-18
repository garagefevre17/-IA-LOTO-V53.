"""Deterministic, offline integrity inventory for the shipped application.

This is NOT a signature, an independent timestamp, or proof of FDJ provenance.
"""
import argparse
import hashlib
import json
from pathlib import Path

REQUIRED = (
    'index.html', 'app.js', 'euromillions.js', 'prospectif.js',
    'loto_201911.csv', 'automation/forecast.py',
    'automation/evaluate.py', 'automation/validate_source.py',
    'automation/verify_timestamp.py',
    '.github/workflows/prospective.yml', '.github/workflows/results.yml',
    '.github/workflows/quality.yml',
)


def inventory(root):
    root = Path(root)
    entries = []
    missing = []
    for name in REQUIRED:
        file = root / name
        if not file.is_file() or file.is_symlink():
            missing.append(name)
            continue
        data = file.read_bytes()
        entries.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    return {'schema': 1, 'kind': 'local_file_inventory_not_external_attestation',
            'complete': not missing, 'missing': missing, 'files': entries}


def verify(root, manifest):
    if manifest.get('schema') != 1 or manifest.get('kind') != 'local_file_inventory_not_external_attestation':
        return False
    actual = inventory(root)
    return actual['complete'] and actual == manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='.')
    parser.add_argument('--output', default='integrite_fichiers.json')
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    path = Path(args.output)
    if args.verify:
        if not path.is_file() or not verify(args.root, json.loads(path.read_text(encoding='utf-8'))):
            parser.exit(1, 'INTEGRITY CHECK FAILED\n')
        print('Integrity check OK (local hashes only)')
    else:
        report = inventory(args.root)
        path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        if not report['complete']:
            parser.exit(1, f'Missing files: {report["missing"]}\n')
        print(f'Integrity inventory written: {path} ({len(report["files"])} files)')


if __name__ == '__main__':
    main()
