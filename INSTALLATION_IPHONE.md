# Installation de l'application unique IA LOTO V53 depuis un iPhone

## 1 — Déploiement

- Décompresser ce ZIP dans Fichiers (iPhone).
- Sur GitHub, déposer **le contenu extrait** à la racine du dépôt, sans enveloppe de dossier supplémentaire.
- Préserver les dossiers cachés `.github/workflows/` et toutes les archives de prévisions et preuves déjà présentes.
- `Settings → Pages → Deploy from a branch → main / root` pour l'interface web.
- `Actions` : autoriser les workflows, et dans les réglages Actions donner l'autorisation de lecture/écriture au `GITHUB_TOKEN` si nécessaire.

## 2 — Configuration indispensable du backend

Dans `Settings → Secrets and variables → Actions` :

**Secrets**
- `FDJ_CSV_URL` : lien HTTPS direct d'une archive ZIP ou CSV officielle FDJ dont la provenance a été auditée (pas la page HTML d'historique). Vérifier périodiquement qu'il est toujours à jour.
- `TSA_URL` : URL HTTPS du serveur RFC3161 vérifié, par exemple `https://freetsa.org/tsr` après contrôle de sa politique.
- `TSA_CA_PEM_B64` : certificat racine TSA de confiance encodé en base64, obtenu depuis la source officielle et vérifié indépendamment, sans jamais coller un certificat arbitraire.

**Variables**
- `FDJ_ALLOWED_HOST` : nom d'hôte exact du téléchargement (sans https://) ; le domaine officiel des archives peut être `www.sto.api.fdj.fr`.
- `FDJ_FEED_AUDITED` : `yes`, **seulement après audit réel du lien** ; cette valeur est une déclaration humaine et pas une authentification automatique.

## 3 — Validation réelle

1. Ouvrir `Actions → IA LOTO - Controle qualite` : attendre des tests verts.
2. Un **jour de tirage avant 18 h heure de Paris**, lancer `LOTO - Prevision horodatee` (manuellement ou par planification).
3. Confirmer l'existence simultanée de `prospective/loto-AAAA-MM-JJ.json` et `prospective/proofs/loto-AAAA-MM-JJ.tsr` dans l'historique GitHub.
4. Le lendemain de la publication FDJ, lancer `LOTO - Controle des resultats`, puis vérifier `prospective/results` et `prospective/bilan_30.json`.
5. Si un seul maillon échoue, la chaîne n'est **pas** certifiée opérationnelle. Les tâches planifiées GitHub peuvent être retardées ou omises ; surveiller les exécutions.

**Attention :** l'automatisation serveur ne concerne que LOTO. EuroMillions est dans l'interface mais pas automatisé par ces workflows. Les numéros restent des sélections statistiques, sans gain démontré sur le hasard.
