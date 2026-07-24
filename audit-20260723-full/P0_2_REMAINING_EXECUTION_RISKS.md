# P0.2 — Risques d'exécution restants (après fermeture des surfaces sœurs)

## RISQUE-1 — `/api/pierre/action` : blocage potentiel d'une fonctionnalité self-service légitime

Si cette route sert réellement une génération de document synchrone pour un utilisateur authentifié qui demande SON PROPRE document (scénario plausible vu son design — identité résolue, pièces jointes, réponse synchrone avec `pdf_url`), le correctif la bloque désormais **systématiquement** en `REQUIRE_APPROVAL` pour `doc.generate`, car :
- aucun contexte de confiance réel (`company_trust_score`) n'est transmis à `evaluateLegacyExecuteGovernance`, donc CloneTrust retombe sur "supervised" (comme en P0.1) ;
- **aucun mécanisme d'approbation n'existe pour ce chemin** (contrairement au moteur v1/hr qui a un vrai cockpit de validations) — une décision REQUIRE_APPROVAL ici reste donc bloquée indéfiniment.

C'est un compromis délibéré, conforme à l'instruction explicite du bloc P0.2 (Phase 9 : "aucune publication externe automatique" pour les documents), pas un oubli. **Action recommandée** : si un appelant réel de cette route est confirmé dans un futur audit, décider consciemment entre (a) construire un chemin d'approbation dédié pour l'auto-génération de documents personnels, ou (b) fournir un contexte de confiance réel pour ce cas d'usage spécifique (ex. `company_trust_score` basé sur l'ancienneté du compte), plutôt que de laisser la fonctionnalité silencieusement cassée.

## RISQUE-2 — Aucune preuve de l'absence d'appelant externe historique sur `/api/router`

Comme en P0.1 (RISQUE-3), il n'est pas possible de prouver depuis le code seul qu'aucun système externe (scénario Make.com configuré côté SaaS) n'a jamais appelé cette URL. C'est précisément pourquoi la route n'a pas été supprimée mais neutralisée avec une réponse 410 explicite — un éventuel appelant externe recevra désormais un signal clair et actionnable ("Gone") plutôt qu'un silence ou une erreur générique.

## RISQUE-3 — `/api/pierre/action` : aucun appelant frontend confirmé, statut réel incertain

Cartographié comme "appelant non vérifiable" plutôt que "mort" (voir P0_2_CALLER_INVENTORY.md) par précaution, en cohérence avec la consigne du bloc. Cela signifie que la vraie utilisation produit de cette route (utilisée aujourd'hui ? jamais branchée au frontend actuel ? remplacée par `/api/pierre/action`'s successeur non identifié ?) reste une question ouverte, hors périmètre de résolution par ce bloc (qui porte sur la gouvernance, pas sur l'archéologie complète du produit).

## RISQUE-4 — La fragmentation de gouvernance globale (ISSUE-07, non résolue)

Ce bloc ferme deux surfaces supplémentaires en réutilisant le module partagé de P0.1, ce qui RÉDUIT la fragmentation (3 surfaces distinctes convergent maintenant vers le même évaluateur) mais ne résout pas le constat plus large de l'audit initial : 4 implémentations de gouvernance coexistent dans le moteur v1/hr lui-même (`hr/cloneguard+governance`, `v1/autonomy+v1/cloneguard`, `v1/governance/canonical-decision`, `hr/autonomy`). Hors périmètre de P0.1 et P0.2.

## Ce qui N'EST PLUS un risque (vérifié, pour éviter tout doute)

- Aucune des 3 surfaces historiquement capables de contourner CloneGuard (`/api/pierre/execute`, `/api/pierre/action`, `/api/router`) ne peut plus déclencher un appel Make.com/HRIS/email réel — confirmé par 24 tests + sweep de non-régression (5615 tests), et par une recherche exhaustive de `MAKE_`/URL codées en dur sur tout `src/app/api` (2 résultats restants, tous deux gouvernés : `pierre/action`, `pierre/execute`).
- Le secret `MAKE_WEBHOOK_URL` codé en dur dans `/api/router` a été retiré du code source (ISSUE-18 partiellement résolu — le composant "URL codée en dur" est fermé ; le composant plus large "token en clair sur table non migrée" est sans objet puisque toute la logique d'auth associée a été retirée).
- Aucun secret réel n'apparaît dans ce document ni dans les rapports compagnons.
