# Launch Measurement Decision Criteria

## A. Gates de fiabilité de mesure — stricts, vérifiés dans ce bloc

| Gate | Statut à la fermeture de ce bloc |
|---|---|
| Aucun événement canonique inconnu accepté | ✅ prouvé (`schema.test.ts`) |
| Zéro double conversion serveur dans les tests | ✅ prouvé (`store.test.ts`, `founder-access-adapter.test.ts`) |
| Zéro paiement client-forgé | ✅ prouvé (`payment_succeeded` etc. server-only, rejeté du client) |
| Zéro PII | ✅ prouvé structurellement (allowlist stricte, aucune IP/UA brute) |
| Trafic interne exclu par défaut | ✅ prouvé (`countFunnelStages` filtre `traffic_class='external'`) |
| Page view non doublée | ✅ garanti par construction (garde Strict Mode + `page_view_id` unique par navigation) — pas de test E2E navigateur réel dans ce bloc |
| Event ID idempotent | ✅ prouvé (contrainte DB unique + tests) |
| Checkout et paiement réconciliés | ⚠️ contrat prêt (event_id déterministe), câblage réel différé (voir migration matrix) |
| Dashboard propriétaire protégé | ✅ prouvé (`dashboard-guard.test.ts`) |
| Persistance vérifiée | ✅ prouvé (23 tests PGlite réels) |
| Build propre vert | à confirmer en Phase 29 de ce même bloc |

**Ce gate A n'est pas encore GO à 100%** — 1 ligne `⚠️` (réconciliation checkout/paiement
dépend d'un câblage différé documenté). Le reste est vert.

## B. Gates produit/commerciaux — aucun seuil fabriqué

Aucun objectif de taux de conversion validé n'a été trouvé documenté ailleurs dans le dépôt pour
ce funnel spécifique. Seuils provisoires ci-dessous, marqués `OWNER_APPROVAL_REQUIRED` — jamais
présentés comme une vérité validée :

| Étape | Seuil provisoire | Statut |
|---|---|---|
| demo_started → demo_completed | ≥ 15% | `OWNER_APPROVAL_REQUIRED` |
| pierre_demo_started → pierre_demo_completed | ≥ 5% | `OWNER_APPROVAL_REQUIRED` |
| reservation_submitted → reservation_created | ≥ 60% | `OWNER_APPROVAL_REQUIRED` |
| checkout_started → payment_succeeded | ≥ 30% | `OWNER_APPROVAL_REQUIRED` |

Les volumes bruts restent **toujours affichés** au dashboard indépendamment de ces seuils — un GO
n'est jamais déclaré sur la seule base d'un pourcentage sans effectif visible.

## Statuts de décision

`GO` · `GO_WITH_MONITORING` · `HOLD_FOR_MEASUREMENT` · `HOLD_FOR_PRODUCT` · `NO_GO`.

## Statut retenu à la fermeture de ce bloc

**`HOLD_FOR_MEASUREMENT`** — le socle de mesure est solide (gate A quasi complet) mais :
(1) aucun trafic réel n'a encore traversé le nouveau système (0 événement canonique produit en
dehors des tests), (2) le protocole de validation externe est écrit mais `NOT_EXECUTED`
(0/30 testeurs réels), (3) les gates commerciaux (B) n'ont aucune approbation propriétaire. Une
décision GO/NO-GO sur le lancement du 12 août 2026 ne peut pas s'appuyer sur ce bloc seul — elle
dépend du bloc suivant (EXTERNAL VALIDATION AND LAUNCH REHEARSAL CLOSURE).
