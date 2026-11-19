# IA LOTO V53 — correctifs techniques du 19 novembre 2026

## Changements réellement livrés

- `fixtures/loto_reference_2026-11-16.csv` : copie figée du fichier historique original, au chemin attendu par les tests.
- `.github/workflows/prospective.yml` : déclenchement lundi, mercredi, samedi à 13:15 UTC ; téléchargement validé, calcul Froids 300, preuve RFC 3161, vérification de la réponse, puis commit si toutes les étapes ont réussi.
- `.github/workflows/results.yml` : contrôle les soirs de tirage et le lendemain matin, vérifie chaque preuve RFC 3161 et compare avec le CSV téléchargé avant d'enregistrer les bilans.
- `scripts/fetch_verified_csv.sh` : URL HTTPS et domaine exact contrôlés, CSV téléchargé avec restrictions, historique vérifié et fraîcheur contrôlée avant utilisation.
- `scripts/stamp_forecast.sh` : création de la demande TSA (`.tsq`), réception de la réponse (`.tsr`), vérification de signature et de l'heure avant publication.
- `evaluate.py` : correction du chemin vers `verify_timestamp.py` (modules installés à la racine).
- `run.py` : correction du chemin du fichier d'état à la racine du projet.
- Dossiers de travail `prospective/proofs`, `prospective/results` ; les fichiers `.gitkeep` sont conservés dans Git.

## Vérifications locales effectuées

- 44 tests Python : OK.
- 10 vérifications JavaScript EuroMillions simulées : OK.
- Compilation Python et vérification syntaxique des fichiers JS : OK.
- Aucune exécution GitHub Actions distante, aucune horodatation TSA réelle et aucune utilisation Safari réelle n'ont été validées ici.

## Configuration obligatoire avant tout fonctionnement autonome

Dans le dépôt GitHub :

1. `Settings > Secrets and variables > Actions > Secrets` : ajouter `FDJ_CSV_URL`, adresse HTTPS directe d'un fichier CSV de tirages **au format du fichier historique de ce dépôt**, fourni par un service fiable ; une URL de simple page web ne convient pas.
2. `Settings > Secrets and variables > Actions > Variables` : ajouter `FDJ_ALLOWED_HOST`, **le nom de domaine exact** de la source autorisée, sans `https://` ni `/`.
3. `Secrets` : ajouter `TSA_URL`, adresse HTTPS de l'autorité d'horodatage RFC 3161 acceptant les requêtes binaires.
4. `Secrets` : ajouter `TSA_CA_PEM_B64`, certificat CA PEM de confiance de l'autorité TSA encodé en base64, vérifié par une source indépendante.
5. `Settings > Actions > General > Workflow permissions` : autoriser `Read and write permissions` si les politiques du dépôt le permettent.
6. Vérifier que `main` est bien la branche par défaut et que les workflows sont actifs. Les exécutions planifiées sur GitHub peuvent être retardées ou désactivées.

**Attention** : la simple comparaison du domaine et de la structure CSV ne prouve pas l'authenticité FDJ. Si aucune source officielle exploitable n'est disponible, les workflows échouent volontairement. Ne jamais publier un résultat comme « certifié FDJ » sur cette seule base.

Les heures du cron sont en UTC : 13:15 UTC = 14:15 en hiver / 15:15 en été à Paris. L'horodatage doit intervenir avant **18:00 heure de Paris** (limite opérationnelle conservatrice, et non heure officielle FDJ). Un retard GitHub après cette limite empêche la publication de la prévision. Le suivi des résultats peut être reporté si le CSV n'a pas encore été mis à jour.

## Ce qui reste non validé

- Aucune authentification indépendante des archives FDJ pour des tirages futurs.
- Aucune opération de production testée sur un compte GitHub configuré.
- Pas de preuve que cette méthode prédise mieux que le hasard.
- EuroMillions reste un module applicatif, non couvert par ces workflows automatisés LOTO.
- Ne pas modifier rétroactivement les prévisions horodatées ; ne pas considérer les résultats historiques comme une preuve prospective.

## iPhone et GitHub

Ce ZIP contient **la racine du dépôt**, avec le dossier caché `.github`. Décompresser puis importer les fichiers à la racine de la branche `main` en conservant exactement les sous-dossiers. **Déposer le ZIP tel quel dans GitHub ne le décompresse pas.** Pour simplifier le transfert complet depuis iPhone, utiliser une application Git capable de pousser l'arborescence, ou l'import depuis un ordinateur si disponible. La présence des fichiers dans un ZIP n'active pas les workflows à distance.
