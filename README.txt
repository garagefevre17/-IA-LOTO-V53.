IA LOTO V53 — Contrôles renforcés

Déployer les 4 fichiers à la racine Netlify.

Nouveautés : URL distante HTTPS facultative et vérifiée à chaque ouverture si activée ; échec de synchronisation visible et bloquant ; contrôle des dates ; export bloqué si archive manifestement trop ancienne ; génération d’une demande RFC3161 (.tsq) à partir du SHA-256 du rapport JSON.

IMPORTANT : L’URL distante doit être un CSV compatible avec les colonnes FDJ, accessible via CORS. Une archive ZIP ne peut pas être chargée via cette fonction. Aucun point d’accès FDJ n’est fourni ou garanti. Le .tsq N’EST PAS un horodatage signé : demander un .tsr à un tiers, puis vérifier cryptographiquement la réponse et la chaîne de confiance (ex. OpenSSL). Le journal local n’est pas une preuve. Les tests automatiques ne remplacent pas les essais Safari/Netlify.

La méthode Froids 300 n'améliore pas les probabilités de gain.
