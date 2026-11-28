# IA LOTO V53 · Audit statistique et couverture combinatoire

Application web progressive pour analyser les tirages LOTO et EuroMillions, composer des lots de grilles et évaluer des méthodes expérimentales. [Ouvrir IA LOTO V53](https://garagefevre17.github.io/-IA-LOTO-V53./index.html)

## Principes scientifiques

- Si le tirage est uniforme et indépendant, chaque grille valide a la même probabilité de jackpot, soit **1 sur 19 068 840** au LOTO et **1 sur 139 838 160** à EuroMillions.
- Les tests chronologiques n’utilisent que les résultats disponibles avant le tirage évalué. Ils restent rétrospectifs et la validation prospective nécessite des prévisions figées sur de nouveaux tirages.
- SHA-256 contrôle l’intégrité du contenu. Le bilan local utilise l’heure du navigateur. Le pipeline publie des résultats comme certifiés uniquement lorsqu’une preuve RFC 3161 valide atteste une prévision avant 18 h, heure de Paris.
- Les critères expérimentaux liés aux dates et aux suites départagent les grilles. Leur effet sur le partage d’un jackpot FDJ reste inconnu.

## Fonctions

| Outil | Résultat |
| --- | --- |
| Générateur et système réducteur | Grilles aléatoires ou lot construit à partir de 7 à 16 numéros. Une garantie sur 3 ou 4 bons numéros exige une couverture complète et suppose que les cinq boules tirées figurent dans la sélection. Le logiciel affiche aussi la probabilité sur un tirage ordinaire. |
| Audit CSV LOTO et EuroMillions | Détection du jeu, validation des dates et numéros, fréquences, écarts, scores lissés et khi-deux exploratoire ajusté au tirage sans remise. |
| Bilan local V24 et X-BIAS V25 | Prévisions vérifiées, en attente ou exclues et correspondances observées face à la référence uniforme de 25/49 par tirage LOTO. |
| Calculateur de rentabilité | Seuils de rentabilité et scénarios de gains ou de redistribution selon les hypothèses saisies. |

## Architecture et installation

- [Interface](index.html), [cache hors ligne](sw.js) et [copie locale des journaux](storage-ios.js). IndexedDB peut restaurer les clés manquantes de localStorage. L’export JSON permet de conserver une copie hors du navigateur.
- [Pipeline FDJ](pipeline.py), [horodatage](timestamp.py) et [workflow GitHub Actions](.github/workflows/ia-loto-autonome.yml). La collecte s’arrête si les archives sont incompatibles ou incomplètes dans la fenêtre requise. La vérification FreeTSA utilise une empreinte d’autorité racine épinglée via `FREETSA_CA_SHA256`.
- [Archives de développement](docs/) et [instructions iPhone](INSTALLATION_IPHONE.md).

Sur iPhone, ouvre l’application dans Safari puis choisis **Partager → Sur l’écran d’accueil**.

## Tests et déploiement

Python 3.11 ou version ultérieure, OpenSSL pour les preuves RFC 3161 et accès réseau pour les archives FDJ.

```bash
python -m unittest discover -s . -p 'test_*.py' -v
node test_browser.js
node test_github_status.js
```

Le workflow exécute les tests sur les branches configurées. Le lancement manuel en mode `validation` vérifie la collecte et produit des artefacts sans push. Le job de production est réservé à `main` et exige que `IA_LOTO_PRODUCTION_ENABLED` vaille exactement `true`. Les résultats produits sont consultables sous [automatisation/](automatisation/).
