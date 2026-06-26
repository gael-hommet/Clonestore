# PHASE 4.1 — CloneOS / Pierre Runtime Operational Integration Foundation

## Objectif

Créer la **fondation** d'intégration runtime entre CloneOS et Pierre, sans
exécution dangereuse. Ce bloc pose les contrats : comprendre une commande comme
une intention, la router vers un employee_key (Pierre pour le RH), produire un
plan d'exécution gouverné **non exécuté**, passer par CloneGuard, tracer via
CloneTrace, et préparer la scalabilité multi-tenant.

PHASE 4.1 = **contracts + planning + governance foundation**. Simulation
uniquement. Aucune exécution réelle.

---

## État Phase 3 closed

Phase 3 (P3.1 → P3.22) est **CLOSED / GO** : contexte, mémoire, feeds, registries,
safe apply, QA manuelles, gate final. Invariants conservés : moteur Pierre intact,
CloneVoice non actif, aucun SQL auto, localStorage fallback, lancement public
externe non validé.

---

## Pourquoi Phase 4 commence par les contrats runtime

Avant de brancher un vrai endpoint ou un cockpit runtime (Phase 4.2+), il faut
des contrats stables : command → intent → route → plan → guard → trace, avec des
hints de scalabilité (idempotency, queue, cost, tenant). Phase 4.1 produit ces
contrats purs et une simulation, sans risque.

---

## Command contract

`runtime-integration-command-contract.ts` :
`buildRuntimeIntegrationCommand`, `normalizeRuntimeIntegrationCommandText`,
`validateRuntimeIntegrationCommand`, `sanitizeRuntimeIntegrationCommand`,
`generateRuntimeIntegrationCommandId` (non-crypto). Détection anti-secrets
(`sk_live_`, `OPENAI_API_KEY`, etc.). `raw_text` requis. plan_only.

---

## Intent router

`runtime-integration-intent-router.ts` : `buildRuntimeIntegrationIntent`,
`routeRuntimeIntegrationIntent`. Infère le domaine ; une demande RH (salarié,
absence, contrat, onboarding, paie, congé, document RH...) est routée vers
**pierre** uniquement s'il est actif (`active_for_company: true`). Les
placeholders futurs ne sont **jamais** routés actifs. Réutilise le Global
Employee Context Registry (P3.20). plan_only.

---

## Pierre route plan-only

La route vers Pierre est strictement plan-only : aucune mission réelle, aucun
appel au moteur Pierre, aucun appel CloneOS runtime. Si aucun employé actif ne
couvre le domaine → `blocked` / `simulated_only` avec `missing_context`.

---

## Plan builder

`runtime-integration-plan-builder.ts` : steps gouvernés —
1. analyser la demande ; 2. vérifier le contexte Enterprise Footprint / CloneADN ;
3. préparer la mission Pierre (plan-only) ; 4. appliquer CloneGuard ;
5. validation humaine si nécessaire ; 6. tracer via CloneTrace ;
7. prêt pour future exécution contrôlée. `execution_enabled: false`, `read_only: true`.

Statuts : draft · planned · awaiting_validation · ready_to_execute_later ·
blocked · simulated_only.

---

## CloneGuard contract

`runtime-integration-guardrails.ts` : CloneGuard est **obligatoire**, aucun
bypass. Sujets sensibles RH (licenciement, sanction, contrat, avenant, paie,
données personnelles, arrêt maladie, conflit, harcèlement, disciplinaire) →
`human_validation_required`. Action juridique / disciplinaire finale, signature
de contrat, paie officielle → **block**.

---

## CloneTrace contract

`runtime-integration-trace-contract.ts` : trace **obligatoire**, read_only,
`server_write_enabled: false` en P4.1. Événements : command_received,
intent_built, route_selected, plan_created, guard_evaluated, validation_required,
**execution_not_started**. Détecte les données personnelles.

---

## Scale readiness

`runtime-integration-scale-readiness.ts` — préparation scale (architecture cible
multi-tenant) : stateless requis, tenant scoping, idempotency, queue, retry,
dead-letter, rate limit, cost budget, model routing, observability, load test.

---

## Tenant isolation

Isolation **stricte** par `user_id` + `company_id`. `cross_user_leak_forbidden`,
`service_role_client_forbidden`. Aucun accès cross-user.

---

## Idempotency

`idempotency_key` dérivée de `command_id + company_id + normalized_text_hash`,
`required: true`. Permet retries/queue sans double exécution future.

---

## Queue hints

`queue_name: clonestore_runtime_missions`, contrôle de concurrence requis,
priorité normal/high selon le risque, retry recommandé, dead-letter on failure.

---

## Cost / model routing hints

`orchestration_model_tier: cheap_or_standard`,
`premium_model_only_for: high_value_deliverables`,
`avoid_premium_model_for: recurring_status_or_routing`, `token_budget_required`.
Objectif : coût IA contrôlé à grande échelle.

---

## 80k Pierre : cible, non prouvée

L'architecture cible est : 1 moteur Pierre partagé · N configurations entreprise ·
N Empreintes / CloneADN · N historiques / traces · workers mutualisés · queue /
idempotency / retries · coût IA contrôlé · multi-tenant strict.

**80k Pierre actifs n'est PAS prouvé par Phase 4.1.** Le flag
`scale_80k_not_proven: true` est explicite. Phase 4.1 prépare les contrats
nécessaires (`scale-ready foundation` / préparation scale), pas une preuve.

---

## Ce qui est activé maintenant

✅ Types runtime · command contract · intent router · plan builder.
✅ Guardrails (CloneGuard) · trace (CloneTrace) contracts.
✅ Scale readiness (idempotency, queue, cost, tenant isolation).
✅ Orchestrator simulation (`simulateCloneOSToPierreRuntimePlan`).
✅ QA module (24 étapes) · doc · exports.

---

## Ce qui reste non activé

- Exécution mission réelle / worker / queue production.
- Appel IA (OpenAI / Anthropic).
- Appel au moteur Pierre / API Pierre.
- CloneVoice (non actif production).
- Persistance serveur du runtime.
- **Lancement public externe : toujours non validé.**

---

## Ce qui n'a PAS été fait en PHASE 4.1

- Aucune exécution réelle · aucun worker · aucune queue production.
- Aucun appel Pierre moteur · aucune mission DB réelle · aucun DB write.
- Aucun appel Supabase / OpenAI / Anthropic / Stripe.
- Aucun envoi email / document / message · aucune génération PDF.
- Aucune activation CloneVoice · aucune application SQL · aucun `.env.local`.
- Aucune modification de `go-live-proofs.local.json`.

---

## Prochain bloc recommandé

**PHASE 4.2 — Runtime API Simulation Endpoint / Command Center Preview**

Exposer la simulation via un endpoint read-only / un preview cockpit runtime
(toujours sans exécution réelle), après ce GO P4.1.

Alternative :
- Pierre Mission Runtime Hardening (durcissement du runtime mission).
