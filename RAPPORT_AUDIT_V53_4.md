# Rapport d'audit approfondi — IA LOTO V53.4 (20 novembre 2026)

## Périmètre

Source analysée : `IA_LOTO_V53_AUTONOMIE_AUDITEE_CORRIGEE_V53_3(1).zip` (8 fichiers). L'audit porte sur **le module d'automatisation contenu dans le ZIP**, pas sur une certification exhaustive de l'interface LOTO V53 publiée sur GitHub.

## Constats majeurs et corrections

| Gravité | V53.3 | Correction V53.4 |
|---|---|---|
| **Critique** | La comparaison d'un tirage pouvait être publiée même sans preuve indépendante vérifiée de la prévision. | Une comparaison **certifiée prospective** n'est publiée que si le jeton RFC 3161 de cette prévision est revérifié cryptographiquement, avec l'heure signée antérieure à 18 h Paris. Sans preuve, la comparaison n'est pas publiée et le statut explicite indique `uncertified_no_result_published`. |
| **Critique** | Des certificats et une autorité racine arbitraires placés dans le dépôt pouvaient être acceptés, si leur chaîne était auto-cohérente. | Épinglage obligatoire de l'empreinte SHA-256 du certificat racine FreeTSA : variable GitHub `FREETSA_CA_SHA256`, à approuver séparément. Si absente ou incorrecte, aucune preuve n'est déclarée valide. **La première installation exige ce réglage.** |
| **Élevée** | Le programme ne revérifiait pas, à la création de preuve, le jeton signé contre le contenu du fichier de prévision (`-data`), seulement contre la requête TSQ. | Vérification supplémentaire OpenSSL du jeton TSR contre les octets immuables de la prévision. |
| **Élevée** | Une prévision modifiée pouvait être traitée lors de la comparaison d'un résultat sans contrôle systématique du `content_sha256`. | Contrôle de l'empreinte du contenu et de la concordance entre nom de fichier et date cible avant comparaison. |
| **Élevée** | Prise en compte de tous les ZIP historiques sans limite de nécessité : les archives très anciennes peuvent avoir d'autres formats de colonnes/règles. | Analyse progressive des liens FDJ, contrôle du recouvrement, arrêt uniquement quand l'historique nécessaire est complet et proche du tirage courant, rejet des contradictions. |
| **Moyenne** | Un rapport JSON pouvait être partiellement écrit si le processus était interrompu. | Écriture atomique temporaire + `fsync` + remplacement. |
| **Moyenne** | L'interface colorait en « bon » un calcul qui n'était pas forcément certifié. | Distinction visuelle entre état des calculs et état des preuves, et affichage des comparaisons non certifiées. |
| **Moyenne** | Le workflow ne lançait que `test_automation.py` et l'essai sur une branche n'était pas isolé. | Les `tests/test*.py` sont exécutés ; une pull request ne lance **que les tests et le contrôle JavaScript**, sans collecter ni publier. La chaîne réelle s'active après validation sur `main`. |
| **Moyenne** | Un seul hash ZIP pouvait être associé à un résultat issu d'un ensemble de plusieurs archives. | Métadonnées de tous les ZIP collectés, sans prétendre que le premier contenait le résultat. |

## Vérifications réalisées

- **28 tests Python réussis**, dont 18 tests de régression hérités et 10 contrôles supplémentaires ou renforcés.
- Compilation de tous les fichiers Python réussie.
- Syntaxe JavaScript du tableau de bord vérifiée par Node.js (`node --check`). Une accolade surnuméraire, révélée par cette vérification, a été supprimée.
- Structure du ZIP vérifiée ; ses chemins de fichiers sont conservés.
- Tests de sécurité : preuve absente, manifeste incohérent, prévision modifiée, absence de certificat racine approuvé, tirages futurs, archives mal ordonnées, résultats dupliqués contradictoires, non-écrasement.

## Limites et risques résiduels

1. **Aucun test réseau FDJ en direct** : les sites peuvent modifier liens, format CSV, calendrier ou disponibilité. Les archives officielles FDJ existent, mais leur téléchargement effectif par GitHub Actions n'est pas démontré ici. Le code doit refuser toute prévision lorsque l'historique n'est pas intégralement validé.
2. **Aucun jeton réel FreeTSA créé ni revérifié** pendant cet audit hors réseau. L'épinglage de l'autorité racine demande une validation initiale de son empreinte. Si FreeTSA change son certificat racine, l'utilisateur doit examiner et actualiser cette valeur, sans accepter aveuglément la nouvelle.
3. **Aucune action GitHub réellement exécutée** : permissions `contents: write`, politique de branche et horaire de GitHub Actions à confirmer. Le connecteur utilisé dans ce chat ne permet pas l'écriture dans ce dépôt (HTTP 403).
4. **Calendrier LOTO exceptionnel** : le pipeline bloque les dates incohérentes et ne mélange pas silencieusement Grand/Super LOTO avec le protocole ordinaire. Un événement exceptionnel peut retarder les calculs jusqu'à une règle explicite documentée.
5. **Autonomie non garantie à l'heure exacte** : les déclenchements `schedule` de GitHub Actions peuvent être retardés ou omis. Un événement qui arrive après la limite de 18 h ne doit pas être rétrodaté.
6. **28 tests simulés ≠ preuve de prédiction** : dans un tirage équitable, les grilles « froides » ou « chaudes » n'ont pas de meilleure probabilité de gain établie.
7. Les résultats déjà créés par un ancien pipeline (sans les nouveaux champs de certification) ne doivent **jamais** être automatiquement requalifiés de « certifiés ». Les contrôler manuellement avant migration.

## Verdict

**Prêt pour un essai sur une branche de test, pas encore pour une certification de production.** Il faut installer le paquet dans les chemins indiqués, définir l'empreinte CA approuvée et vérifier un cycle réel complet : archives officielles → calcul avant tirage → timestamp FreeTSA vérifié → publication → récupération du résultat → bilan certifié.

## Addendum — Correctif de procédure de déploiement du 20 novembre 2026

- L'ancienne procédure contenait une contradiction : elle exigeait une fusion sur `main` pour découvrir `workflow_dispatch`, puis indiquait de ne pas fusionner avant un cycle réel. Elle est remplacée par une **fusion de code inactif** suivie d'une validation réseau sans écriture.
- La version corrigée de `.github/workflows/ia-loto-autonome.yml` sépare : tests de PR (lecture seule, hors réseau), `validation` manuelle (réseau réel mais pas de push), `production` (push sous permission `contents: write` et seulement avec `IA_LOTO_PRODUCTION_ENABLED=true`).
- Par défaut, l'absence de variable désactive toute publication programmée. Une fois `true`, les horaires programmés sont actifs : aucun bouton « production manuelle seulement » n'est prévu.
- Les fichiers `euromillions-chauds_VERIFIE.html`, `index.html`, `app.js`, `data.js`, `xbias25.js` ne sont pas inclus ou remplacés.
- Limite : cette modification n'a pas été déployée ni testée sur des serveurs GitHub réels ; une première validation réseau sans publication et un essai contrôlé de publication restent nécessaires.
