# Analytics, Funnel and Launch Measurement Closure — Verdict final (60 questions)

**1. Combien de systèmes analytics existaient avant ce bloc ?**
Cinq : founder-access (réel), BLOC3 conversion (inerte en prod), analytics de présentation démo
(jamais réseau), GuidedTour (aucun), identité orpheline `cs_anon_sid`.

**2. Quels étaient-ils ?**
Voir Q1 + `ANALYTICS_EXISTING_SYSTEMS_MATRIX.md` pour le détail complet (producteur, endpoint,
stockage, identité, confiance, problème).

**3. Combien d'événements legacy ont été inventoriés ?**
83 identifiants distincts, 4 taxonomies (26 client founder-access, 12 server-only
founder-access, 23 BLOC3, 22 démo présentation).

**4. Combien sont conservés, renommés, adaptés, supprimés ou obsolètes ?**
24 `CANONICAL_KEEP`/`CANONICAL_RENAME`, 8 `DUPLICATE_REMOVE`, 15 `SERVER_TRUTH` conservés hors
funnel v1, 6 `CLIENT_SIGNAL`, 22 `LOCAL_ONLY` (système démo), 7 `OBSOLETE` (héritage LeadForge
jamais émis par CloneStore), 3 `UNKNOWN_REVIEW_REQUIRED`. Détail : `ANALYTICS_LEGACY_EVENT_INVENTORY.md`.

**5. Existe-t-il désormais un contrat canonique unique ?**
Oui.

**6. Quelle est sa version ?**
v1 (`SCHEMA_VERSION = 1`).

**7. `visitor_id` existe-t-il ?**
Oui.

**8. Est-il indépendant de l'IP et du fingerprinting ?**
Oui — généré serveur, UUID v4 aléatoire, aucune dérivation d'IP/UA/fingerprint (testé
structurellement : `resolveVisitorId` n'a qu'un seul paramètre, le cookie).

**9. `session_id` existe-t-il ?**
Oui.

**10. `page_view_id` existe-t-il ?**
Oui.

**11. `demo_run_id` existe-t-il ?**
Oui.

**12. Les pages vues sont-elles dédupliquées ?**
Oui par construction (garde Strict Mode + `page_view_id` généré une fois par navigation réelle,
gestion bfcache) — non prouvé par un test E2E navigateur réel dans ce bloc (voir Q59).

**13. Les événements organiques sont-ils persistants ?**
Le contrat canonique les rend persistants (table append-only réelle, testée). **Le câblage
réel** des producteurs existants (founder-access, démo, BLOC3) vers ce contrat reste différé —
voir Q19.

**14. BLOC3 abandonne-t-il encore silencieusement des événements ?**
Oui — non réparé dans ce bloc (hors périmètre choisi), toujours fail-closed en production comme
avant (ISSUE-15, toujours ouvert).

**15. Founder-access et BLOC3 doublent-ils encore les conversions ?**
Non activement (BLOC3 reste inerte), mais le risque architectural documenté persiste s'ils
étaient un jour tous deux connectés sans réconciliation — non résolu dans ce bloc.

**16. Les conversions importantes sont-elles serveur-authoritative ?**
Dans le contrat : oui (9 événements server-only, testés, rejetés du client). Dans les faits
opérationnels : partiellement — le webhook Stripe réel n'est pas encore branché sur le nouveau
contrat (voir `ANALYTICS_LEGACY_MIGRATION_MATRIX.md`).

**17. Un client peut-il forger `payment_succeeded` ?**
Non.

**18. Un client peut-il imposer `partner_id` ?**
Non.

**19. Un client peut-il imposer prix, pays ou devise ?**
Non — ces champs n'existent même pas dans l'enveloppe client acceptée.

**20. Une IP brute est-elle stockée ?**
Non.

**21. Une PII est-elle stockée dans les événements ?**
Non.

**22. Le trafic interne est-il distingué ?**
Oui (`traffic_class`, 12 tests).

**23. Le trafic de test est-il distingué ?**
Oui.

**24. Les bots sont-ils distingués ?**
Oui (16 patterns fermés, priorité maximale dans la classification).

**25. Le dashboard exclut-il l'interne par défaut ?**
Oui (`countFunnelStages` filtre `traffic_class='external'`, testé).

**26. Les taux affichent-ils toujours leur dénominateur ?**
Oui.

**27. La baseline historique a-t-elle été réconciliée ?**
Partiellement — expliquée structurellement (pourquoi les écarts sont plausibles), mais les
requêtes SQL exactes ayant produit les chiffres originaux n'ont pas pu être obtenues ni
re-exécutées (aucun accès base distante autorisé). Voir `ANALYTICS_BASELINE_RECONCILIATION.md`.

**28. Les anciens nombres 141/177/22/20/1 ont-ils désormais une définition fiable ?**
Non — classés `LEGACY_NON_COMPARABLE`, explication structurelle fournie, pas une re-mesure.

**29. Un backfill historique a-t-il été effectué ?**
Non.

**30. Était-il déterministe et justifié ?**
Non applicable — aucun backfill n'a été tenté (les identités canoniques n'existaient pas au
moment de ces événements historiques).

**31. L'attribution Partner est-elle serveur-authoritative ?**
Par contrat oui (le champ n'accepte qu'une valeur pré-résolue, jamais un input client) ; la
résolution réelle depuis le Partner Program existant n'est pas câblée dans ce bloc (`null`
aujourd'hui).

**32. First-touch et last-touch sont-ils définis ?**
Oui, avec 15 tests couvrant la fenêtre de 30 jours et la règle anti-écrasement par un touch
direct.

**33. La migration DB a-t-elle été testée localement ?**
Oui — PGlite réel (Postgres 16 en process), 23 tests dans `store.test.ts` + 6 dans
`founder-access-adapter.test.ts`, contraintes/triggers/purge tous vérifiés.

**34. Une migration distante a-t-elle été appliquée ?**
Non.

**35. Combien de tests Analytics sont verts ?**
84/84 (suite dédiée), 247/248 en comptant la non-régression + PWA dans le checkout propre final
(le seul échec, `.env.example`, est préexistant et sans rapport).

**36. P0.1/P0.2 sont-ils verts ?**
Oui (P0.1 explicitement re-testé dans les deux passes de non-régression ; P0.2 non modifié,
aucun fichier touché).

**37. Payment Path est-il vert ?**
Oui (`payment-path-country-checkout.test.ts` vert dans le worktree principal ET dans le checkout
propre).

**38. Demo/Mobile est-il vert ?**
Oui (`cine`, `PierreModes`, `value-model`, `capacity-calculator-hydration` verts).

**39. Partner Program est-il intact ?**
Oui (`money`, `live-authorization`, `payout-rules`, `attribution-rules` verts, aucun fichier
Partner Program modifié).

**40. P21/P22 Pierre sont-ils intacts ?**
Oui (4 fichiers de test P21/P22 verts, aucun fichier Pierre modifié par ce bloc).

**41. TypeScript est-il vert ?**
Oui, avec une réserve hors périmètre : `embedded-postgres` (résidu déjà documenté par un bloc
antérieur, non introduit ni aggravé par celui-ci).

**42. ESLint ciblé est-il vert ?**
Oui, après correction de 4 problèmes mineurs (2 échappements regex inutiles, 2 directives
`eslint-disable` inutilisées) trouvés et corrigés dans ce même bloc.

**43. Le build pré-commit est-il vert ?**
Oui — `REAL_EXIT_CODE=0`, `BUILD_ID=XONV7nLn3IK8Ls61N27VD`, 196/196 pages statiques.

**44. Combien de commits ont été créés ?**
5.

**45. Quels sont leurs messages et OID ?**
1. `022749f7...` — `feat(analytics): add canonical event identities and persistence`
2. `00bbee3c...` — `feat(analytics): unify funnel instrumentation and attribution`
3. `9224d425...` — `feat(analytics): add owner funnel and measurement health dashboard`
4. `da935b05...` — `docs(analytics): close funnel measurement contract and launch criteria`
5. `697cfb5e...` — `fix(reproducibility): include missing PWA runtime dependencies required by committed layout` (bug préexistant révélé par la Phase 32, non causé par ce bloc)

**46. Les blobs ont-ils été vérifiés ?**
Oui — chaque fichier de chaque commit relu depuis son blob et comparé octet par octet au disque,
plus une vérification indépendante que seuls les fichiers de l'allowlist ont changé par rapport
au HEAD précédent (comptage exact à chaque commit).

**47. Le checkout final vient-il uniquement de Git ?**
Oui — matérialisation stricte par `isomorphic-git.readTree()`/`readBlob()`, 8133 blobs, 0
mismatch, aucune copie du worktree/`node_modules`/`.env.local`.

**48. `npm ci` a-t-il réussi ?**
Oui — 531 paquets, exit 0.

**49. Les tests finaux propres sont-ils verts ?**
247/248 (voir Q35).

**50. Le build final a-t-il `REAL_EXIT_CODE=0` ?**
Oui.

**51. Quel est le `BUILD_ID` ?**
`TFw9A1Kw0cuEn80tHPZX4`.

**52. Un secret a-t-il été committé ?**
Non — scan effectué avant chacun des 5 commits ; 2 faux positifs identifiés et vérifiés
(négation « aucune sk_live_ », valeur de test `password: "hunter2"`).

**53. Un push a-t-il été effectué ?**
Non.

**54. Un déploiement a-t-il été effectué ?**
Non.

**55. `PRODUCTION_AUTHORIZED=false` est-il intact ?**
Oui — non touché, reconfirmé dans la baseline et jamais modifié.

**56. Les 30 testeurs externes ont-ils réellement participé ?**
Non — protocole écrit (`ANALYTICS_EXTERNAL_VALIDATION_PROTOCOL.md`), statut explicitement
`NOT_EXECUTED`, jamais présenté comme « 30/30 ».

**57. Les critères GO/NO-GO sont-ils définis ?**
Oui (`LAUNCH_MEASUREMENT_DECISION_CRITERIA.md`), gates A (fiabilité de mesure, quasi complets)
et B (produit/commercial, seuils provisoires marqués `OWNER_APPROVAL_REQUIRED`, jamais présentés
comme validés).

**58. Quel est le statut final exact parmi les quatre statuts autorisés ?**
**`ANALYTICS_PARTIALLY_CLOSED`.** Justification : le socle canonique (identités, schéma,
persistance, endpoint, dashboard) est construit, testé (84 tests dédiés + 247/248 en checkout
propre) et prouvé reproductible depuis Git seul — mais le funnel n'est pas encore fiable en
pratique car (a) aucun événement réel ne le traverse encore (adaptateurs et re-instrumentation
délibérément différés, décision documentée), (b) la réconciliation de la baseline historique
reste partielle, (c) 0/30 testeurs externes ont réellement validé le parcours.

**59. Quels risques restent ouverts ?**
Voir `ANALYTICS_REMAINING_RISKS.md` — en résumé : câblage founder-access/démo/GuidedTour/webhook
Stripe non fait (documenté, pas oublié) ; 0 trafic réel mesuré à ce jour ; 3 scénarios de sécurité
à couverture partielle ; aucun test E2E navigateur réel du tracker ; durée de rétention
production en attente d'approbation propriétaire.

**60. CloneStore dispose-t-il désormais de métriques assez fiables pour prendre une décision de
lancement ?**
**Non, pas encore** — le socle de mesure est solide et honnête, mais tant qu'aucun trafic réel
ne traverse le nouveau système et que le protocole de validation externe n'a pas été exécuté, la
décision GO/NO-GO du 12 août 2026 ne peut pas s'appuyer sur ce bloc seul. Statut de décision
retenu (`LAUNCH_MEASUREMENT_DECISION_CRITERIA.md`) : `HOLD_FOR_MEASUREMENT`.

---

Le prochain bloc, EXTERNAL VALIDATION AND LAUNCH REHEARSAL CLOSURE, peut démarrer sur cette base
— le contrat canonique qu'il utilisera pour mesurer les vrais testeurs existe déjà et est prouvé.
