"""Verify committed code baseline. Not a signature or external attestation."""
import argparse
import hashlib
import json
from pathlib import Path

FILES = ('index.html', 'app.js', 'euromillions.js', 'prospectif.js',
         'automation/forecast.py', 'automation/evaluate.py',
         'automation/validate_source.py', 'automation/verify_timestamp.py',
         'automation/healthcheck.py', 'automation/integrity.py',
         '.github/workflows/prospective.yml', '.github/workflows/results.yml',
         '.github/workflows/quality.yml')


def snapshot(root):
    root = Path(root)
    files = {}
    for name in FILES:
        path = root / name
        if not path.is_file() or path.is_symlink():
            raise ValueError(f'Missing or symlinked code file: {name}')
        files[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return {'schema': 1, 'purpose': 'committed_code_baseline_not_independent_proof', 'sha256': files}


def check(root, manifest):
    try:
        return snapshot(root) == manifest
    except (ValueError, OSError):
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    ap.add_argument('--manifest', default='code_baseline.json')
    ap.add_argument('--update', action='store_true', help='Intentional baseline update after reviewed changes')
    args = ap.parse_args()
    path = Path(args.manifest)
    if args.update:
        path.write_text(json.dumps(snapshot(args.root), indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print('Code baseline updated: review and commit this change')
    elif not path.is_file() or not check(args.root, json.loads(path.read_text(encoding='utf-8'))):
        ap.exit(1, 'CODE BASELINE MISMATCH: review changes; do not auto-regenerate in CI\n')
    else:
        print('Code matches committed baseline (not an independent signature)')


if __name__ == '__main__':
    main()
