IA LOTO — Audit renforcé (application unique, aucun changement de protocole Froids 300)

TESTS LOCAUX :
- python -m unittest discover -s automation -p 'test_*.py' -v
- node --check app.js && node --check euromillions.js && node --check prospectif.js
- node automation/test_browser.js
- python automation/benchmark.py --holdout 300 --output audit_backtest.json

CORRECTIONS :
- EuroMillions : vérification de l'intervalle exact mardi->vendredi / vendredi->mardi, y compris dans les backtests.
- EuroMillions : import transactionnel : l'ancien historique est conservé si le calcul d'empreinte échoue.
- Ajout d'un benchmark historique chronologique reproductible avec comparaison à un échantillon aléatoire à graine fixe.
- Six nouveaux tests Python : données corrompues, horodatage de génération incohérent, numéro Chance modifié, reproductibilité et limites du benchmark.

IMPORTANT : les tests de code ne certifient pas la source FDJ, les reçus TSA ni le déploiement GitHub Actions. La comparaison à une seule séquence aléatoire ne prouve pas un avantage statistique. Les tirages historiques ne sont pas des prévisions futures.

CONFIGURATION RESTANTE : FDJ_CSV_URL, FDJ_ALLOWED_HOST, TSA_URL, TSA_CA_PEM_B64 dans les secrets GitHub ; validation de leur authenticité, puis vérification d'une exécution réelle. Ne pas publier comme certifié avant cela.
