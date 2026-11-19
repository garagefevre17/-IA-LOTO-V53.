# IA LOTO — UN SEUL LOGICIEL (V53)

LANCEMENT SUR iPHONE
- Ce ZIP est le seul paquet à conserver. Il contient UNE application web, dont l'entrée unique est `index.html`.
- Pour l'utiliser en ligne : publier le CONTENU du ZIP à la racine du dépôt GitHub et activer GitHub Pages, ou déployer ce même contenu sur un hébergement HTTPS.
- Ne pas ouvrir le ZIP directement dans l'aperçu iOS pour tester JavaScript : utiliser une URL HTTPS dans Safari.
- Les fichiers .js sont des composants internes indispensables de cette même application : ne pas les supprimer.

AUTOMATISATION (intégrée au même projet, NON activée par ce ZIP)
- `.github/workflows/prospective.yml` : prévision LOTO Froids 300 avant tirage.
- `.github/workflows/results.yml` : contrôle après tirage et bilan 30 tirages.
- `.github/workflows/quality.yml` : tests.
- Il faut configurer le flux FDJ vérifié, le certificat TSA et les autorisations GitHub Actions.
- Ne jamais affirmer qu'une prévision est certifiée sans reçu RFC3161 valide et antérieur au tirage.
- Les exécutions programmées GitHub Actions peuvent être retardées ou ne pas se produire.
- EuroMillions figure dans l'interface, mais l'automatisation serveur concerne uniquement LOTO.

DÉPLOIEMENT DEPUIS iPHONE
1. Décompresser le ZIP dans l'app Fichiers.
2. Dans GitHub, transférer le contenu à la racine de ton dépôt (pas le ZIP lui-même). Les sous-dossiers `.github/workflows/` doivent garder leur chemin exact.
3. Vérifier Settings > Pages et Actions. Ne pas supprimer les archives de preuves déjà présentes sur GitHub.
4. Contrôler un vrai tirage prévision -> horodatage -> résultat -> bilan avant de qualifier l'automatisation d'opérationnelle.

LIMITES
- La connexion FDJ et le reçu RFC3161 ne sont pas validés ici en production.
- La méthode Froids 300 ne garantit pas de gain et n'est pas démontrée supérieure au hasard.
- Une interface unique ne signifie pas qu'un seul fichier HTML peut remplacer le backend GitHub Actions.

CORRECTIFS DE L'AUDIT DU 19 NOVEMBRE 2026
- Le workflow des résultats utilise `git add -A -- loto_201911.csv prospective/` : il n'échoue plus parce que `prospective/results/` n'existe pas encore.
- Le contrôle après tirage refuse les évaluations orphelines (résultat sans prévision correspondante).
- 56 tests Python et 10 contrôles JavaScript réalisés localement. Cela ne valide ni le flux FDJ réel ni la preuve RFC3161 en production.


## Améliorations V53.1 (audit du 19 novembre 2026)

- Le titre public indique V53 au lieu de V25 (les modules historiques gardent leur identité).
- Un statut de bilan prospectif publié dans GitHub Pages est affiché sur la page principale. Le panneau n’affirme jamais vérifier lui-même les signatures RFC3161, l’authenticité FDJ ou la performance prédictive.
- Le cache du service worker est renouvelé afin de ne pas conserver des ressources V25 après mise à jour.
- Trois tests JavaScript supplémentaires couvrent le statut disponible, manquant et invalide.

**Limite majeure :** les tâches GitHub ne sont pas déployées depuis cet environnement. Avant de parler de chaîne autonome, il faut configurer des URL FDJ/TSA auditées, activer les workflows et observer une exécution complète réelle.
