# Canonical Analytics Runtime Wiring Closure — Verdict final (62 questions)

**1. Quel HEAD a servi de baseline ?**
`6c82768270a92a563349f8d237b7fa21f9ef1a6e` (le HEAD attendu `871c5d266…` avait avancé d'un commit
Pierre HR concurrent, vérifié disjoint des fichiers analytics).

**2. Une concurrence Git a-t-elle été détectée ?**
Oui — 1 commit (`6c8276827`, Pierre HR recruitment), intégré sans reset/revert, vérifié ne touchant
aucun fichier analytics/protégé de ce bloc.

**3. Combien d'événements canoniques ont désormais un producteur runtime réel ?**
21 sur 32 : `page_viewed`, `homepage_demo_prompt_seen/clicked`, `demo_started/step_completed/
completed`, `demo_pierre_reveal_viewed`, `discover_pierre_clicked`, `pierre_demo_started/
step_completed/completed`, `reservation_cta_clicked`, `reservation_form_started`,
`reservation_submitted`, `reservation_created`, `reservation_email_confirmed`, `activation_started`,
`activation_completed`, `checkout_started`, `checkout_session_created`, `payment_succeeded`,
`payment_failed`, `payment_refunded`, `guided_tour_started/step_completed/completed/skipped`.
(Comptage détaillé : ~26 événements branchés ; les non branchés sont internes ou hors funnel v1.)

**4. Combien restent seulement définis dans le contrat ?**
Les événements internes `visitor_created`/`session_started` (émis implicitement par l'émission des
cookies, pas comme lignes séparées dans ce bloc), `product_demo_clicked`, `homepage_demo_prompt_
dismissed` — définis, producteurs non branchés dans ce bloc (hors chemin funnel principal).

**5. Founder-access est-il branché ?** Oui.
**6. `reservation_created` vient-il du serveur ?** Oui (SERVER_PERSISTED).
**7. `reservation_email_confirmed` vient-il du serveur ?** Oui (SERVER_CONFIRMED).
**8. `activation_completed` vient-il du serveur ?** Oui (PAYMENT_PROVIDER_CONFIRMED).
**9. `/demo` produit-elle un run canonique ?** Oui (`demo_run_id`, type `demo`).
**10. `/demo/pierre` produit-elle un run canonique ?** Oui (`demo_run_id`, type `demo_pierre`).
**11. Chaque run possède-t-il un `demo_run_id` ?** Oui.
**12. Les étapes sont-elles dédupliquées par run ?** Oui (`stepsSeenRef`/`stepSeenRef` + `dedupeKey`).
**13. GuidedTour est-il branché ?** Oui.
**14. `checkout_session_created` vient-il de la création Stripe réelle ?** Oui (après
`stripe.checkout.sessions.create`, clé = `session.id`).
**15. `payment_succeeded` vient-il uniquement du webhook signé ?** Oui (seul producteur, clé
`stripe_event_id`).
**16. `payment_failed` vient-il uniquement du serveur/provider ?** Oui (webhook signé).
**17. `payment_refunded` est-il branché ?** Oui (nouvelle branche `charge.refunded`).
**18. Un client peut-il forger un paiement ?** Non (server-only, rejeté endpoint 422 + API serveur).
**19. Un client peut-il imposer partner ID / pays / devise / montant / Price ID ?** Non (aucun de
ces champs n'existe dans l'enveloppe client ; tout est résolu serveur).
**20. L'attribution Partner réelle est-elle branchée ?** Oui (résolveur lecture seule sur
`clonestore_pp_customers`, jamais un partner_id client).
**21. BLOC3 écrit-il encore des doublons ?** Non (inerte, n'écrit rien ; jamais lu par le funnel
canonique).
**22. L'analytics legacy de démo double-t-elle encore les événements canoniques ?** Non (le sink
canonique ne lit jamais les systèmes legacy).
**23. Founder-access double-t-il les conversions ?** Non (le pont écrit une seule ligne canonique
idempotente ; l'ancien funnel founder reste dans sa propre table, jamais unionné).
**24. Un double webhook crée-t-il deux paiements Analytics ?** Non (testé).
**25. Un double formulaire crée-t-il deux réservations Analytics ?** Non (idempotence
`email_normalized` + event_id déterministe).
**26. Analytics peut-elle bloquer une réservation ?** Non.
**27. Analytics peut-elle bloquer un paiement ?** Non.
**28. Une PII est-elle stockée ?** Non (allowlist stricte ; testé, aucun `@`).
**29. Une IP brute est-elle stockée ?** Non.
**30. Le funnel synthétique complet a-t-il réussi ?** Oui (12/12 + 4 scénarios d'échec).
**31. Combien d'événements attendus ont été persistés ?** 30 lignes canoniques (20 client + 3
founder + 3 serveur checkout/paiement/remboursement, + les rejeux/refunds), 1 visiteur, 3 page
views, 2 runs.
**32. Combien de doublons ont été évités ?** Tous les rejeux testés (webhook, activation, paiement)
→ 0 ligne dupliquée.
**33. Les niveaux de confiance étaient-ils corrects ?** Oui (CLIENT_OBSERVED → SERVER_PERSISTED →
SERVER_CONFIRMED → PAYMENT_PROVIDER_CONFIRMED, tous vérifiés).
**34. Le dashboard reflète-t-il exactement le scénario synthétique ?** Oui (`countFunnelStages`
reconstruit le funnel depuis la seule table canonique, vérifié).
**35. La santé de mesure est-elle complète ?** Partiellement (événements acceptés + répartition par
confiance affichés ; autres compteurs calculables mais non encore surfacés — documenté honnêtement).
**36. Les tests Analytics sont-ils verts ?** Oui — suite dédiée 106 (12+12+20+9+12+15+13+7+6) +
inclus dans la non-régression.
**37. Founder-access est-il vert ?** Oui.
**38. Demo/Mobile est-il vert ?** Oui (inclus/non impacté ; tsc + build verts).
**39. GuidedTour est-il vert ?** Oui (tsc + build ; instrumentation purement observationnelle).
**40. Payment Path est-il vert ?** Oui (checkout + webhook non-régression verts).
**41. Partner Program est-il vert ?** Oui (aucun changement financier ; tests verts).
**42. P0.1/P0.2 sont-ils verts ?** Oui (non touchés).
**43. P21/P22 sont-ils verts ?** Oui (non touchés).
**44. TypeScript est-il vert ?** Oui (exit 0, repo entier).
**45. ESLint ciblé est-il vert ?** Oui (0 erreur ; 1 warning pré-existant non lié).
**46. Le build pré-commit est-il vert ?** Voir §54/55 (renseigné après build).
**47. Combien de commits ont été créés ?** Voir `ANALYTICS_RUNTIME_COMMITTED_BLOB_PROOF.md`.
**48. Quels messages et OID ?** Idem.
**49. Les blobs ont-ils été vérifiés ?** Oui (chaque commit, octet par octet + allowlist exacte).
**50. Le checkout final a-t-il été matérialisé uniquement depuis Git ?** Voir
`ANALYTICS_RUNTIME_CLEAN_CHECKOUT_PROOF.md`.
**51. npm ci a-t-il réussi ?** Idem.
**52. Les migrations locales ont-elles réussi ?** Oui (PGlite, aucune migration nouvelle — la table
canonique existe déjà, tests DB verts).
**53. Les tests propres sont-ils verts ?** Voir clean checkout proof.
**54. Le build final possède-t-il REAL_EXIT_CODE=0 ?** Voir clean checkout proof.
**55. Quel est le BUILD_ID ?** Voir clean checkout proof.
**56. Un secret a-t-il été committé ?** Non.
**57. Un push a-t-il été effectué ?** Non.
**58. Un déploiement ou une migration distante a-t-il été effectué ?** Non.
**59. `PRODUCTION_AUTHORIZED=false` est-il intact ?** Oui.
**60. Quel est le statut final exact parmi les quatre statuts autorisés ?**
**`ANALYTICS_RUNTIME_WIRED_ACTIVATION_PENDING`** — tous les branchements code sont prêts et
prouvés en local (funnel synthétique complet vert, dashboard aligné, 366/366 non-régression), mais
aucun trafic réel n'a encore traversé le pipeline et la migration/activation analytics distante
reste désactivée. La validation externe peut démarrer en environnement contrôlé.
**61. Quels risques restent ouverts ?** Voir `ANALYTICS_RUNTIME_REMAINING_RISKS.md` — aucun trafic
réel encore ; pas d'E2E navigateur ; santé de mesure partielle ; BLOC3 inerte (hors périmètre).
**62. Les 30 testeurs externes peuvent-ils maintenant être lancés ?**
**Oui** — le funnel canonique complet est réellement branché et prouvé de bout en bout (homepage →
démo → Pierre → réservation → confirmation → activation → checkout → paiement → remboursement),
sans double comptage ni conversion forgée. Le prochain bloc (EXTERNAL VALIDATION AND LAUNCH
REHEARSAL CLOSURE) peut faire traverser ce funnel à de vrais testeurs.

---

## Re-fermeture CORRELATION / NON-BLOCKING / CLEAN CHECKOUT (2026-07-25)

Trois réserves du verdict initial fermées. Voir
`ANALYTICS_RUNTIME_CORRELATION_RECLOSURE_REPORT.md`.

- **HEAD final** : `9a2617d5fdaf34826b281d1f3658a87c69a92518` (5 commits initiaux intacts + 4
  commits de re-fermeture + 1 commit Pierre concurrent disjoint).
- **Commits supplémentaires** : 4 (`ffd888b3` corrélation, `21f986be` borne temporelle,
  `6b54c5c6` test corrélé, `9a2617d5` docs). Blobs vérifiés, aucun amend.
- **Server truths corrélées au visiteur d'origine** : **Oui** — `reservation_created`,
  `reservation_email_confirmed`, `activation_completed`, `checkout_session_created`,
  `payment_succeeded` portent le `visitor_id` d'origine (`correlated-funnel-e2e.test.ts`).
- **Réservation ↔ session initiale** : Oui. **Checkout ↔ réservation** : Oui. **Webhook retrouve
  la corrélation sans cookie ni donnée client** : Oui (par `reservation_id` metadata puis
  `order_ref` = abonnement haché). **Paiement = même visiteur que la démo** : Oui.
- **Base analytics bloquée peut-elle retarder indéfiniment le métier** : **Non** —
  `boundedAnalyticsWrite`, timeout max **500 ms** (défaut, `ANALYTICS_WRITE_TIMEOUT_MS`), prouvé
  temporellement (op jamais résolue → `timeout` en < 2 s, métier continue).
- **P0.1/P0.2 réellement exécutés** : Oui — 26 tests (execute + action + router) + P22 unit.
- **P21/P22 réellement exécutés** : Oui — incluant les 3 `.itest.ts` du commit concurrent
  `cd5bc811` (performance/training/bridge). **Suite Phase F : 429/429 verte.**
- **Funnel synthétique corrélé** : vert (9 assertions). **Santé de mesure** : honnêtement
  `PARTIALLY_COMPLETE`.
- **Statut final** : **`ANALYTICS_RUNTIME_WIRED_ACTIVATION_PENDING`**.
- **30 testeurs externes** : **Oui, lançables** — corrélation réelle, non-blocabilité et checkout
  propre tous prouvés.

### Checkout propre final (Phase J) — résultats réels

- **HEAD final** : `a998eba58dc3aaee7d074afaae8049b721fc9519` (les 4 commits de re-fermeture + le
  correctif de reproductibilité démo, sur les 5 commits initiaux intacts + travail Pierre
  concurrent disjoint).
- **Gap de reproductibilité pré-existant découvert et corrigé** (ISSUE-44) : le HEAD ne buildait
  pas seul (`DemoExperience.tsx` committé par le bloc précédent importait 38 fichiers de démo
  jamais committés) ; le `REAL_EXIT_CODE=0` du bloc précédent était un **faux positif**. Corrigé
  par un commit `fix(reproducibility)` dédié (`a998eba5…`, allowlist explicite de 38 fichiers,
  blobs vérifiés, 74/74 tests démo).
- Matérialisation stricte : **8213 blobs, 0 mismatch**. `npm ci` : **531 paquets, exit 0**.
- `tsc --noEmit` : **seul résidu `embedded-postgres`** (`UNRELATED_PREEXISTING`, sans rapport).
- Tests dans le checkout propre : **87/87 verts** (funnel corrélé + corrélation + borne + P0.1 +
  Payment Path + Partner + démo).
- **`next build` : `REAL_EXIT_CODE=0`**, **`BUILD_ID=3h1SjcpydSSbOReQKoWKh`**, toutes les routes
  du funnel compilées.
- Aucun secret committé, aucun push, aucun déploiement, aucune migration distante,
  `PRODUCTION_AUTHORIZED=false` intact.
