# IA LOTO V26 — Installation vérifiable

## Situation réelle
Cette archive est un **projet prêt à configurer**, pas un site déjà autonome. Aucune connexion FDJ ni GitHub/Netlify n’est activée par l’archive. Ne pas déposer ce ZIP seul sur Netlify en pensant activer les tâches programmées.

## Étapes
1. Créer un dépôt GitHub privé et y importer **le contenu décompressé** de cette archive, en conservant `.github/workflows/loto.yml`.
2. Activer les GitHub Actions dans le dépôt. Dans **Settings > Secrets and variables > Actions**, ajouter les secrets `FDJ_OFFICIAL_FEED_URL`, `NETLIFY_AUTH_TOKEN` et `NETLIFY_SITE_ID`. Dans **Variables**, définir `FDJ_FEED_AUDITED=yes` **uniquement après audit effectif de la source**.
3. La source doit être une URL HTTPS autorisée, réellement officielle et fournissant un JSON `[{"date":"YYYY-MM-DD","numbers":[1,2,3,4,5],"chance":1}, ...]` ou un CSV compatible. **Une URL officielle compatible n'est pas fournie ni vérifiée dans cette archive** : si la FDJ ne propose pas de flux conforme, un adaptateur audité sera nécessaire. Ne jamais prétendre que la source est officielle sans preuve.
4. Obtenir un jeton Netlify à droits limités et l’identifiant du site existant, puis les stocker comme secrets GitHub (ne jamais les écrire dans le code ni les partager en conversation).
5. Dans GitHub, lancer **Actions > IA LOTO V26 > Run workflow** et consulter les journaux. Vérifier que `v26-state.json` contient une date et une prévision, puis que le site Netlify affiche cette prévision.
6. Vérifier qu’une exécution programmée fonctionne **sans téléphone**, puis qu’un résultat officiel est rapproché de la prévision précédente. GitHub Actions peut subir des retards et n'est pas une garantie de publication à une heure exacte.

## Critères de réussite
- Aucun calcul avec moins de 300 tirages ni avec des dates manquantes.
- Aucun calcul rétroactif et aucune grille inventée si la source échoue.
- Un commit horodaté antérieur au tirage doit être contrôlé indépendamment pour qualifier un test prospectif ; les comparaisons ne sont pas automatiquement certifiées.
- Le bilan doit rester à 0/30 tests validés tant que l'audit n'est pas fait.
- Ne pas confondre numéros recommandés et numéros gagnants : aucune méthode ne prédit de manière fiable un tirage aléatoire.

## Test local
`python -m unittest discover -s engine -p 'test_*.py'`
