# PHASE 4.3 — Runtime Mission Draft Creation Contract / No-Execution Mission Draft

## Objectif

Créer le contrat de **brouillon de mission runtime**, sans exécution. Transformer
un `RuntimeIntegrationReadResult` (P4.1/P4.2) en brouillon de mission structuré
**local / in-memory** : title, objective, summary, steps, validations, risks,
blocked reasons, context requirements — en conservant CloneGuard, CloneTrace,
idempotency, queue, cost, tenant hints.

PHASE 4.3 = **contract + in-memory draft preview only**. Aucune mission créée en
base. Aucun appel Pierre. Aucune exécution.

---

## État P4.2

Phase 4.2 a exposé la simulation runtime via `/api/clonestore/runtime/simulate`
(GET capabilities + POST simulation-only) et un Command Center Preview dans
`/profile/messages`. Validée 88/88.

---

## Pourquoi un mission draft contract

Avant toute persistance ou exécution (Phase 4.4+), il faut une représentation
stable de ce que serait une mission Pierre issue d'un plan runtime : ses étapes,
ses validations, ses risques, son idempotency, sa queue future, son coût anticipé,
sa trace obligatoire. Ce brouillon répond à « à quoi ressemblerait la mission ? »
**sans la créer**.

---

## Différence entre brouillon local et mission réelle

| | Brouillon local (P4.3) | Mission réelle (futur, gouverné) |
|---|---|---|
| Stockage | in-memory uniquement | persistance gouvernée (futur) |
| DB write | **aucun** | contrôlé/flaggé (futur) |
| Appel Pierre | **aucun** | runtime gouverné (futur) |
| Exécution | **aucune** | gouvernée + CloneGuard (futur) |

Le brouillon est **local / in-memory**, jamais créé en base.

---

## RuntimeMissionDraft types

`runtime-mission-draft-types.ts` : `RuntimeMissionDraft`, `RuntimeMissionDraftStep`,
`RuntimeMissionDraftValidationRequirement`, `RuntimeMissionDraftGuardSnapshot`,
`RuntimeMissionDraftTraceSnapshot`, `RuntimeMissionDraftScaleSnapshot`,
`RuntimeMissionDraftQueueSnapshot`, `RuntimeMissionDraftCostSnapshot`,
`RuntimeMissionDraftIdempotencySnapshot`. Tous les flags de sécurité sont
**littéralement false** : `execution_enabled`, `db_write_enabled`,
`api_execution_enabled`, `pierre_engine_called`, `ai_call_performed`, `email_sent`,
`message_sent`, `document_generated`, `clonevoice_active`,
`public_launch_external_validated`.

---

## Builder depuis RuntimeIntegrationReadResult

`runtime-mission-draft-builder.ts` :
`buildRuntimeMissionDraftFromIntegrationResult(result, options?)` + builders de
title/objective/summary/steps/validations/snapshots. Jamais de fetch, jamais de
Supabase, jamais d'appel Pierre.

---

## Statuses

`draft` · `ready_for_review` · `awaiting_validation` · `blocked` · `simulated_only`.

## Kind pierre / unsupported / blocked

- Route Pierre → `pierre_mission_draft`.
- Aucun employé actif → `unsupported_domain_draft`.
- CloneGuard block → `blocked_draft` + status `blocked`.
- Validation humaine requise → status `awaiting_validation`.

---

## Validation / sanitization

`runtime-mission-draft-validation.ts` : `validateRuntimeMissionDraft`,
`assertRuntimeMissionDraftNoExecution`, `assertRuntimeMissionDraftNoSecrets`,
`sanitizeRuntimeMissionDraft`. Vérifie draft_id/command_id/plan_id, CloneGuard +
CloneTrace + idempotency obligatoires, blocked_reasons si blocked,
validation_requirements si awaiting_validation, et bloque tout motif secret
(`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).

---

## CloneGuard snapshot

Recopie la décision CloneGuard (allow_plan_only / require_human_validation /
block), `cloneguard_required: true`, `bypass_allowed: false`, raisons et sujets
sensibles.

## CloneTrace snapshot

`clonetrace_required: true`, `server_write_enabled: false`, données personnelles,
événement final **execution_not_started**.

---

## Idempotency

`idempotency.required: true`, clé dérivée de `command_id + company_id +
normalized_text_hash`. Protège la future création gouvernée contre les doublons.

## Queue / cost hints

Queue : `clonestore_runtime_missions`, priorité, retry, dead-letter. Cost :
orchestration `cheap_or_standard`, premium évité pour le routing récurrent.

---

## Preview local dans /profile/messages

Bouton **"Préparer un brouillon local"** dans le Command Center Preview (P4.2),
**au clic uniquement**, après une simulation réussie. Affiche badges, cards,
sections (objectif/étapes/validations/risques/CloneGuard/CloneTrace/scale/sécurité).
Aucune sauvegarde, aucun fetch supplémentaire. Reset au lancement d'une nouvelle
simulation.

---

## Badges / microcopy

"Brouillon local" · "No-execution" · "Lecture seule" · "Aucune mission créée en
base" · "Aucun appel Pierre" · "Aucun appel IA" · "Aucun email envoyé" · "Aucun
document généré" · "CloneGuard requis" · "CloneTrace requis" · "Scale 80k non prouvé".

---

## No-execution invariant

Le brouillon est strictement read-only / plan-only. Tous les flags d'exécution
sont false. **Aucun write DB. Aucun moteur Pierre. Aucun appel IA. Aucune
exécution CloneOS.**

---

## 80k non prouvé

`scale_80k_not_proven` est conservé dans le snapshot scale. Le scale 80k est une
architecture cible (`scale-ready foundation` / préparation scale), **non prouvé**.

---

## Ce qui est activé maintenant

✅ Mission draft types · builder depuis runtime result · validation/sanitization.
✅ Snapshot/local preview · QA module (30 étapes).
✅ Bouton "Préparer un brouillon local" dans `/profile/messages` (au clic).
✅ CloneGuard / CloneTrace / idempotency / queue / cost préservés · exports.

---

## Ce qui reste non activé

- Persistance du brouillon (in-memory uniquement).
- Création de mission réelle / exécution / worker / queue production.
- Appel IA · moteur Pierre · CloneVoice.
- **Lancement public externe : toujours non validé.**

---

## Ce qui n'a PAS été fait en PHASE 4.3

- Aucune mission créée en base · aucun write DB · aucune route d'exécution.
- Aucun appel Pierre moteur / API Pierre · aucune exécution CloneOS.
- Aucun appel Supabase / OpenAI / Anthropic / Stripe.
- Aucun email/message/document envoyé · aucune génération PDF.
- Aucune activation CloneVoice · aucun SQL · aucun `.env.local`.
- Aucune modification de `go-live-proofs.local.json`.

---

## Prochain bloc recommandé

**PHASE 4.4 — Runtime Mission Draft Safe Persistence Design**

Concevoir la persistance gouvernée du brouillon (SQL draft, RLS, flag, safe apply,
manual activation QA) — toujours sans exécution, sur le modèle des phases serveur P3.

Alternative :
- PHASE 4.4 — Pierre Mission Runtime Hardening Preview.
