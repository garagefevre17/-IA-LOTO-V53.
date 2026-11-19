# IA LOTO V26 — installation et limites

Cette archive contient le site existant, le moteur Froids 300, quatre tests unitaires et un workflow GitHub Actions. **Elle n'est pas activée sur vos comptes.**

## Fonctionnement

- Froids 300 : sur les 300 derniers tirages *antérieurs* au tirage visé, choisir les cinq numéros les moins fréquents (égalité : plus petit numéro) et le Chance le moins fréquent (même règle).
- En cas de source manquante, périmée, non auditée ou incohérente, le moteur refuse de produire une nouvelle grille.
- Les prévisions sont consignées dans `v26-state.json` et les résultats officiels comparés dès qu'ils figurent dans la source.
- **Les tests ne sont pas déclarés prospectifs automatiquement.** Il faut contrôler la publication indépendante du commit avant l'heure du tirage, ainsi que l'absence de fuite dans les données. Le compteur de validations reste à zéro tant que ce contrôle n'a pas été effectué.
- Aucune méthode ne garantit les numéros gagnants.

## Déploiement

1. Créer un dépôt GitHub contenant **tout le contenu décompressé**, y compris `.github/workflows/loto.yml` (dossier caché). Ne pas importer le ZIP tel quel comme un fichier unique.
2. Dans GitHub > Settings > Secrets and variables > Actions : renseigner `FDJ_OFFICIAL_FEED_URL` (source HTTPS de résultats dont la provenance FDJ et le format JSON/CSV ont été vérifiés), puis `FDJ_FEED_AUDITED=yes` **seulement après audit réel**. Aucune URL FDJ officielle utilisable n'est fournie ici : ne pas inventer cette connexion.
3. Dans Netlify, créer un jeton d'accès personnel et relever le Site ID. Les enregistrer dans GitHub Secrets sous `NETLIFY_AUTH_TOKEN` et `NETLIFY_SITE_ID`. Ne jamais publier ces valeurs dans le site ni les envoyer dans une conversation.
4. GitHub > Actions > IA LOTO V26 > Run workflow. Vérifier les journaux, l'état `v26-state.json`, le commit et le déploiement Netlify.
5. Consulter `https://votre-site.netlify.app/v26.html`. L'URL publique n'est pas activée par cette archive.

## Vigilance

GitHub Actions ne garantit pas l'exécution à la minute. Pour jouer, la grille doit être publiée suffisamment tôt avant la clôture FDJ. La grille est une proposition statistique, pas une prévision fiable des résultats. Un dépôt manuel Netlify n'active pas les tâches GitHub. Le stockage dans GitHub peut être modifié : la preuve d'antériorité doit être contrôlée de façon indépendante avant toute validation scientifique.
