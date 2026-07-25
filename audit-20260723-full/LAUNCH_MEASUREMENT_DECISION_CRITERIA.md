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
| Checkout et paiement réconciliés | ✅ **branché (2026-07-25, RUNTIME WIRING CLOSURE)** : `checkout_session_created` (serveur) + `payment_succeeded/failed/refunded` (webhook signé), prouvés au funnel synthétique |
| Dashboard propriétaire protégé | ✅ prouvé (`dashboard-guard.test.ts`) |
| Persistance vérifiée | ✅ prouvé (PGlite réel) |
| Build propre vert | ✅ (bloc RUNTIME WIRING : voir `ANALYTICS_RUNTIME_CLEAN_CHECKOUT_PROOF.md`) |

**Mise à jour 2026-07-25 (RUNTIME WIRING CLOSURE)** : le gate A de fiabilité de mesure est
désormais **complet** — la dernière ligne `⚠️` (réconciliation checkout/paiement) est branchée et
prouvée. Le blocage restant vers un GO n'est plus la mesure elle-même mais l'absence de trafic
réel + les gates produit/commerciaux B (`OWNER_APPROVAL_REQUIRED`) + la validation externe.

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
