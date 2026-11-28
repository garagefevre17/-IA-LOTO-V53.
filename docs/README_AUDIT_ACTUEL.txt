IA LOTO — CORRECTIFS DE CET AUDIT (18/11/2026)

Application unique conservée : LOTO, EuroMillions, Froids 300, interface Safari, suivi local et GitHub Actions.

CORRIGÉ :
- automation/evaluate.py : évaluation possible le jour même lorsque le tirage cible existe déjà dans le CSV, au lieu d’attendre artificiellement le lendemain. Les reçus TSA sont toujours revérifiés.
- automation/forecast.py : rejet explicite des lignes CSV avec colonnes surnuméraires ou champs absents.
- automation/test_pipeline.py : quatre tests de non-régression, dont la prévision historique du 18/11/2026, le refus après heure limite et les dates manquantes.

LIMITES NON RÉSOLUES :
- Aucune authentification indépendante de la provenance FDJ par la seule URL autorisée.
- TSA et GitHub Actions non testés en production ; quatre secrets doivent être configurés.
- Les tests ne prouvent aucune amélioration des chances de gagner.
- Le fichier CSV embarqué s’arrête au 16/11/2026 : une mise à jour vérifiée est indispensable pour une nouvelle prévision.

INSTALLATION : les fichiers de ce ZIP appartiennent au MÊME dépôt GitHub. Conserver l’installation en ligne tant que les tests de déploiement n’ont pas été effectués.
