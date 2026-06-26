# PHASE 4.5 — Runtime Mission Draft Safe Apply / LocalStorage First

## Objectif

Implémenter le safe apply **localStorage-first** des `RuntimeMissionDraft` :
sauvegarder un brouillon côté navigateur (enveloppe versionnée, restaurable),
ajouter un restore local, et préparer un safe apply serveur best-effort via une
route API **feature-flaggée** qui retourne **423** si le flag est false.

PHASE 4.5 = **persistence safe apply for draft only, no execution**.

---

## État P4.4

Phase 4.4 a créé le SQL draft `clonestore_runtime_mission_drafts` (non appliqué),
le persistence design (record/write-plan), le feature flag default false, et un
localStorage-design **design-only sans write**. Validée 98/98.

---

## localStorage runtime

`runtime-mission-draft-localstorage.ts` — **seul endroit autorisé à écrire
localStorage** pour les drafts. Enveloppe versionnée `v1` :
`saved_at`, `updated_at`, `draft_id`, `command_id`, `plan_id`, `source`,
`persisted_local: true`, `persisted_server: false`, `server_sync_status`,
`safety_flags` (tous false), `payload`. Save/load/latest/remove/clear,
`typeof window` guard, validation préalable du draft (refuse tout draft non-safe).

---

## Safe apply types

`runtime-mission-draft-safe-apply-types.ts` — statuts `local_saved` /
`local_saved_server_disabled` / `local_saved_server_synced` /
`local_saved_server_failed` / `local_failed` / `validation_failed` /
`auth_required` / `server_unavailable` / `server_blocked` / `restored_local` /
`restored_server` / `restored_none`. Result avec flags `mission_created: false`,
`execution_started: false`, etc.

---

## API contract

`runtime-mission-draft-server-api-contract.ts` — endpoint
`/api/clonestore/runtime/mission-drafts`. Capabilities : `supports_save: true`,
`supports_execution: false`, `supports_mission_creation: false`,
`supports_ai_call: false`, `scale_80k_not_proven: true`.

---

## Route GET / POST

`src/app/api/clonestore/runtime/mission-drafts/route.ts` :
- **GET** → capabilities ; si flag false → status `disabled`, aucune lecture DB ;
  si flag true → auth + lecture read-only des propres brouillons.
- **POST** → sauvegarde de brouillon uniquement.

### POST 423 quand flag false

Le POST est **feature-flaggé** (`NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED`,
default false). En état normal il retourne **423 Locked** :
`status: "disabled"`, `db_write_performed: false`, `mission_created: false`,
`execution_started: false`. Si flag true : auth obligatoire (supabaseServer,
RLS anon key, jamais service role), record validé (safety flags), upsert dans
`clonestore_runtime_mission_drafts` — **jamais de mission réelle, jamais
d'exécution, jamais d'appel Pierre/IA**.

---

## Safe apply localStorage-first

`runtime-mission-draft-safe-apply.ts` :
`persistRuntimeMissionDraftWithFallback` :
1. valide + sanitize le draft ;
2. **localStorage save TOUJOURS en premier** ;
3. local échoue → `local_failed` ;
4. flag false / force_local_only → `local_saved_server_disabled` ;
5. flag true → POST via API client ; 423 → `local_saved_server_disabled` ;
   succès → `local_saved_server_synced` ; erreur → `local_saved_server_failed` ;
6. copie locale toujours préservée ; jamais de throw brut.

Appel serveur **uniquement** via `runtime-mission-draft-api-client`. Pas de fetch
direct, pas de Supabase direct, pas d'auto-persist à l'import.

---

## Restore flow

`restoreRuntimeMissionDraftWithFallback` : lit le dernier brouillon local
(`loadLatestRuntimeMissionDraftFromLocalStorage`). Flag off / force_local_only →
`restored_local` / `restored_none`. Fallback local toujours garanti. Aucune
exécution.

---

## UI status model

`runtime-mission-draft-safe-apply-ui.ts` — snapshot + badges/cards/timeline
(draft_validated → local_saved → server_skipped/attempted/synced/failed).

---

## Intégration /profile/messages

Boutons **"Sauvegarder le brouillon localement"** et **"Restaurer le dernier
brouillon local"** dans le Command Center Preview, **au clic uniquement**.
Affiche badges + cards safe apply. Reset au lancement d'une nouvelle simulation.
Aucune auto-save au mount. Aucun fetch direct dans la page.

---

## Badges / microcopy

"localStorage-first" · "Brouillon sauvegardé localement" · "Serveur désactivé si
flag false" · "Aucune mission créée" · "No-execution" · "Aucun appel Pierre" ·
"Aucun appel IA" · "CloneVoice non actif" · "Scale 80k non prouvé". Microcopy :
"La sauvegarde concerne uniquement le brouillon, pas une mission réelle.",
"Aucune exécution n'est déclenchée.", "Le serveur reste optionnel et feature-flaggé."

---

## No-execution invariant

Tous les flags d'exécution restent false. **Aucune mission réelle créée. Aucune
exécution. Aucun moteur Pierre. Aucun appel IA. Aucun email/message/document.**

---

## Feature flag

`NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED` — default false,
jamais activé par le code, `.env.local` jamais modifié.

---

## Server persistence still optional / manual

La route serveur existe mais le flag est false par défaut → POST 423. La
persistance serveur nécessite encore : SQL appliqué manuellement + flag activé en
test (PHASE 4.6 manual activation QA).

---

## Ce qui est activé maintenant

✅ Sauvegarde localStorage active (au clic) · restore local · enveloppe versionnée.
✅ Route serveur GET/POST feature-flaggée (POST 423 default) · API client.
✅ Safe apply runtime localStorage-first · UI status model · QA (26 étapes).
✅ Boutons save/restore dans `/profile/messages` · doc · evidence · exports.

---

## Ce qui reste non activé

- Persistance serveur active (flag false par défaut → POST 423).
- SQL non appliqué · flag non activé.
- Exécution / mission réelle / worker / queue prod · appel IA · moteur Pierre · CloneVoice.
- **Lancement public externe : toujours non validé.**

---

## Ce qui n'a PAS été fait en PHASE 4.5

- Aucun SQL appliqué automatiquement · aucun `.env.local` modifié · aucun flag activé.
- Aucune mission réelle créée · aucune exécution.
- Aucun appel Pierre moteur / API Pierre · aucune exécution CloneOS.
- Aucun appel OpenAI / Anthropic / Stripe · aucun email/message/document/PDF.
- Aucune activation CloneVoice · aucune modification de `go-live-proofs.local.json`.

---

## Prochain bloc recommandé

**PHASE 4.6 — Runtime Mission Draft Manual Activation QA**

Checklist manuelle d'activation de la persistance serveur des brouillons (sur le
modèle P3.15/P3.19) : appliquer le SQL, vérifier table/RLS, activer le flag en
test, valider le POST serveur, evidence template.

Alternative :
- PHASE 4.6 — Runtime Mission Draft Server Restore UI Polish.
