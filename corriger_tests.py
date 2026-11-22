#!/usr/bin/env python3
"""Correction ciblée de deux tests FDJ historiques pour IA LOTO V53.4.

Ne modifie que test_automation.py du dossier courant. Ne fait aucun commit/push.
"""
from pathlib import Path
import sys

path = Path('test_automation.py')
if not path.is_file():
    sys.exit('ERREUR : placer ce script à la racine du dépôt (test_automation.py introuvable).')
text = path.read_text(encoding='utf-8')
fixes = (
    ("        with patch.object(pipeline,'get',side_effect=fake_get):\n            actual,sources=pipeline.fetch_history('euromillions')",
     "        with patch.object(pipeline,'get',side_effect=fake_get):\n            actual,sources=pipeline.fetch_history('euromillions', as_of=target)"),
    ("        with patch.object(pipeline,'get',side_effect=fake):\n            rows, sources=pipeline.fetch_history('euromillions')",
     "        with patch.object(pipeline,'get',side_effect=fake):\n            rows, sources=pipeline.fetch_history('euromillions', as_of=target)"),
)
updated = text
for before, after in fixes:
    if updated.count(after) == 1:
        print('Déjà corrigé :', after.strip().splitlines()[-1])
        continue
    if updated.count(before) != 1:
        sys.exit('ERREUR : structure de tests différente; aucun fichier modifié.')
    updated = updated.replace(before, after, 1)
if updated == text:
    print('Aucune modification nécessaire : les deux tests sont déjà corrigés.')
else:
    path.write_text(updated, encoding='utf-8')
    print('Correction appliquée : deux tests historiques utilisent as_of=target.')
print('Vérifier avec : python -m unittest discover -s . -p "test_*.py" -v')
