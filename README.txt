IA LOTO V54 — CORRECTION DE LA PREUVE CRYPTOGRAPHIQUE
La V53 exportait un rapport JSON indenté mais calculait le SHA-256 de la version compacte pour la requête TSQ. V54 exporte exactement les mêmes octets JSON compacts que ceux hachés dans la TSQ.
Procédure : charger le CSV, calculer, cliquer sur « Créer la demande d'horodatage .tsq » puis conserver ENSEMBLE les fichiers froids300-DATE.json et prediction-DATE.tsq.
Contrôle indépendant sur ordinateur : openssl dgst -sha256 froids300-DATE.json ; openssl ts -query -in prediction-DATE.tsq -text ; comparer les empreintes.
Le .tsq n'est pas une preuve d'antériorité. Faire signer la requête par une TSA et vérifier le .tsr avec la chaîne de certificats de confiance de la TSA.
IMPORTANT : tests interactifs Safari et déploiement GitHub Pages non effectués. Actualisation FDJ toujours dépendante d'une URL CSV CORS ou d'un import manuel. Aucun avantage prédictif démontré.
