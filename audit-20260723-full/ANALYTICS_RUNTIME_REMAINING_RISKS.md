# Analytics Runtime Wiring — Remaining Risks

| Risque | Sévérité | Détail |
|---|---|---|
| Aucun trafic réel n'a encore traversé le pipeline branché | Attendu | Le funnel synthétique complet est prouvé, mais aucune donnée de production réelle n'existe encore ; la validation externe (prochain bloc) produira les premières vraies traversées |
| Pas de test E2E navigateur réel | Faible-moyen | Les émissions client (démo/Pierre/GuidedTour/CTA) sont couvertes par lecture de code + tests unitaires du tracker, pas par un vrai Playwright (indisponible) |
| Santé de mesure partielle | Faible | Plusieurs compteurs (doublons évités temps-réel, checkout-sans-paiement, délai moyen) sont calculables mais non encore affichés comme vues dédiées — voir `ANALYTICS_MEASUREMENT_HEALTH_COMPLETION_REPORT.md` |
| Filtres dashboard non interactifs | Faible | Le dashboard v1 affiche le funnel global + santé ; pas de segmentation interactive par cohorte/source |
| BLOC3 toujours inerte (ISSUE-15) | Faible (hors périmètre) | Non réparé ; ne double rien puisqu'il n'écrit rien ; le sink canonique ne lit jamais ses tables |
| Migration distante non appliquée | Attendu | `clonestore_analytics_events_v1` testée localement (PGlite) uniquement ; l'application distante reste une décision d'exploitation ultérieure |
| Attribution Partner dépend d'un `customer` verrouillé | Faible | `resolvePartnerAttributionForUser` renvoie null tant que `lockAttributionOnFirstPayment` n'a pas créé la ligne customer ; un paiement peut donc être enregistré sans attribution si le verrouillage Partner n'a pas encore eu lieu — comportement honnête (null plutôt qu'une attribution douteuse) |
| Rétention production non validée | Attendu (décision propriétaire) | La fonction de purge existe mais aucun cron ne l'appelle |

Aucun de ces risques n'est une régression métier, une fuite de PII, un double comptage, ni une
conversion forgée — tous sont soit attendus (validation externe à venir), soit des extensions non
critiques documentées.
