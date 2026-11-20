# IA LOTO V53.4 — autonomie prudente

Le moteur produit des sélections statistiques ; il ne garantit aucun gain. Les résultats prospectifs ne sont publiés comme certifiés que si la prévision correspond à un horodatage RFC 3161 vérifié avant 18 h (heure de Paris), avec une autorité racine FreeTSA épinglée via `FREETSA_CA_SHA256`.

Ce projet utilise des archives FDJ (réseau nécessaire), OpenSSL et Python 3.11. Les collectes manquantes et les preuves non vérifiées bloquent la certification. Les archives de plusieurs périodes sont fusionnées uniquement si elles sont compatibles ; l'historique doit être complet.

Tests : `python -m unittest discover -s tests -p 'test*.py' -v`

Exécution : `python automation/pipeline.py` puis `python automation/timestamp.py` ; en production, préférer le workflow `.github/workflows/ia-loto-autonome.yml` et contrôler ses logs. Le résultat produit est consultable via `automatisation/index.html` et les JSON sous `automatisation/`.

**Ne fusionne jamais un ancien résultat non certifié avec le bilan prospectif.** Voir `RAPPORT_AUDIT_V53_4.md` et `INSTALLATION_IPHONE.md`.

## Déploiement sans activation accidentelle (correctif du 20 novembre 2026)

Le workflow propose trois voies : `pull_request` (tests seuls), `workflow_dispatch` en mode `validation` (appels réseau, aucun push, artefacts de diagnostic), et `production` (publication). Le mode production **ne démarre que si** la variable GitHub `IA_LOTO_PRODUCTION_ENABLED` vaut exactement `true`. En l'absence de cette variable, les événements `schedule` déclenchent un workflow dont le job de production est ignoré. Une fois la variable activée, les horaires planifiés sont également actifs ; surveiller le premier cycle. Voir `INSTALLATION_IPHONE.md`.
