# PHASE 4.2 — Runtime API Simulation Endpoint / Command Center Preview

## Objectif

Exposer la fondation runtime P4.1 dans le produit via : une route API de simulation
read-only, un client API, un modèle de preview UI, et un panneau **Command Center
Preview** dans `/profile/messages`. Le tout **sans exécution réelle**.

Permet de saisir une commande CloneOS et de voir : la commande normalisée,
l'intention, le routage vers Pierre (ou le blocage), le plan plan-only, CloneGuard,
CloneTrace, et les hints scale/idempotency/queue/cost — en montrant clairement
qu'aucune mission n'est créée, aucun message/email/document envoyé, aucun appel IA,
et que le scale 80k est **préparé mais non prouvé**.

---

## État P4.1

Phase 4.1 a posé les contrats runtime purs : command → intent → route → plan →
guard → trace + scale readiness. `simulateCloneOSToPierreRuntimePlan` est
disponible. Validée 87/87.

---

## API contract

`runtime-integration-api-contract.ts` (module pur) : request/response/error/
capabilities/examples + builders. Endpoint :
`/api/clonestore/runtime/simulate`. La réponse porte les invariants :
`read_only`, `simulation_only`, `execution_enabled: false`, `db_write_performed: false`,
`ai_call_performed: false`, `email_sent: false`, `document_generated: false`,
`clonevoice_active: false`, `public_launch_external_validated: false`.

---

## GET capabilities

`GET /api/clonestore/runtime/simulate` retourne capabilities + examples, **sans
aucune simulation, sans lecture DB, sans write**. `supports_execution: false`,
`supports_db_write: false`, `supports_ai_call: false`, `scale_80k_not_proven: true`.

---

## POST simulation-only

`POST /api/clonestore/runtime/simulate` accepte `{ raw_text, ... }`,
valide/sanitize, appelle `simulateCloneOSToPierreRuntimePlan`, retourne la réponse
structurée. `raw_text` absent → 400 structuré.

### Pourquoi POST ne fait aucun write

Le POST est autorisé **uniquement** parce que c'est une **simulation pure sans
effet de bord** : il analyse le texte fourni et retourne un plan plan-only. Aucune
DB, aucune mission créée, aucun appel Supabase/IA, aucun moteur Pierre. Ne pas
utiliser ce POST pour une action métier.

---

## Client wrapper

`runtime-integration-api-client.ts` : `fetchRuntimeIntegrationSimulationCapabilities`,
`postRuntimeIntegrationSimulation`, `normalizeRuntimeIntegrationSimulationApiError`,
`isRuntimeIntegrationSimulationApiResponse`. **Seul endroit autorisé à fetch**, et
uniquement vers l'endpoint de simulation. Aucun auto-call à l'import. Aucun
enterprise-footprint POST, aucune route Pierre, aucun Supabase.

---

## Preview model

`runtime-integration-preview-model.ts` : `buildRuntimeIntegrationPreviewSnapshot`,
badges, cards, sections (intent / route / CloneGuard / plan / CloneTrace / scale),
timeline, actions. Module pur, read-only.

---

## Intégration /profile/messages

Panneau **"Command Center Preview"** / "Prévisualisation Runtime CloneOS" près du
panneau Contexte système (P3.17). Saisie + 4 exemples (dont
"Exécuter le licenciement d'un salarié" marqué *sera bloqué par CloneGuard*).
Simulation **au clic uniquement** (`postRuntimeIntegrationSimulation`), jamais au
montage. Affiche badges, cards, sections. Empty state si aucune simulation.

---

## Badges / microcopy

"Simulation uniquement", "Lecture seule", "Aucune mission créée",
"Aucun message envoyé", "Aucun email envoyé", "Aucun document généré",
"Aucun appel IA", "CloneVoice non actif", "Scale 80k non prouvé".

---

## CloneGuard visible

La section CloneGuard affiche la décision (allow_plan_only / require_human_validation
/ block), `cloneguard_required: true`, `bypass_allowed: false`, et les raisons.
L'exemple licenciement démontre le **block**.

---

## CloneTrace visible

La section CloneTrace affiche `clonetrace_required: true`,
`server_write_enabled: false`, la détection de données personnelles et
l'événement final **execution_not_started**.

---

## Scale readiness visible

La section Scale affiche idempotency (clé), queue (nom/priorité/retry), cost
(tier/premium évité), rate limit, load test, et **scale_80k_not_proven**.

---

## 80k non prouvé

Le scale 80k est une **architecture cible**, pas une preuve. `scale_80k_not_proven`
est exposé partout. Préparation scale (`scale-ready foundation`), pas de preuve.

---

## Ce qui est activé maintenant

✅ API contract · route simulate (GET capabilities + POST simulation-only).
✅ Client wrapper · preview model · preview QA (21 étapes).
✅ Panneau Command Center Preview dans `/profile/messages` (simulation au clic).
✅ CloneGuard / CloneTrace / scale readiness visibles · badges/microcopy · exports.

---

## Ce qui reste non activé

- Exécution réelle / création de mission / worker / queue production.
- Appel IA · moteur Pierre / API Pierre.
- Persistance serveur runtime · CloneVoice.
- **Lancement public externe : toujours non validé.**

---

## Ce qui n'a PAS été fait en PHASE 4.2

- Aucun write DB · aucune mission créée.
- Aucun email/message/document envoyé · aucune génération PDF.
- Aucun appel IA · aucun moteur Pierre appelé · aucune exécution CloneOS.
- Aucun appel Supabase / OpenAI / Anthropic / Stripe.
- Aucune activation CloneVoice · aucun SQL · aucun `.env.local`.
- Aucune modification de `go-live-proofs.local.json`.

---

## Prochain bloc recommandé

**PHASE 4.3 — Runtime Mission Draft Creation Contract / No-Execution Mission Draft**

Définir le contrat de création d'un brouillon de mission (sans exécution),
préparant la persistance future gouvernée.

Alternative :
- PHASE 4.3 — Pierre Mission Runtime Hardening Preview.
