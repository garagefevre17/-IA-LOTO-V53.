IA LOTO V64 — audit correctif de la V63 (18/11/2026)
Fichiers: index.html, app.js, euromillions.js, loto_201911.csv, README.txt.
Corrections supplémentaires : date cible LOTO limitée aux lundi/mercredi/samedi; date cible et historique cohérents; invalidation des exports EuroMillions quand cible ou fenêtre change; rejet d’une saisie EuroMillions datée dans le futur; purge des anciens benchmarks lors d’un nouvel import.
Conservé : Froids 300 figé, backtests, modèle adaptatif, comparaisons, exports, JSON/TSQ, moteur EuroMillions indépendant.
Limites : archives FDJ non certifiées; pas de mise à jour FDJ automatique garantie; signature TSR non vérifiée par le navigateur; tests Safari interactifs non réalisés; aucune supériorité prédictive démontrée.

V65 : ajoute un bilan des prévisions enregistrées localement confrontées à un CSV fourni par l'utilisateur. Ce bilan n'est PAS une certification prospective. Les synchronisations FDJ et les reçus RFC3161 nécessitent des services externes non intégrés.
