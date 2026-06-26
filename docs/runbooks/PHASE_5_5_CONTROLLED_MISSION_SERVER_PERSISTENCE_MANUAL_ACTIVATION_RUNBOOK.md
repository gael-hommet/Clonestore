# Runbook — PHASE 5.5 Controlled Mission Server Persistence Manual Activation (Still No Execution)

> **QA manuelle uniquement · Aucune activation.**
> Cette phase vérifie la préparation, elle n'active pas la persistance serveur.
> **Ne pas appliquer le SQL dans cette phase. Aucune donnée n'est envoyée au serveur.**

---

## 1. Prérequis

- PHASE 5.4 (design serveur) validée.
- SQL draft présent et **NON appliqué** :
  `supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql`.
- Flag serveur `NEXT_PUBLIC_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED` **default false**.
- `.env.local` **non modifié**.
- Aucune route serveur `controlled-missions` créée.

## 2. Vérifier le SQL manuellement (sans l'appliquer)

- Ouvrir le SQL draft et confirmer les marqueurs :
  **DESIGN DRAFT ONLY**, **DO NOT APPLY**, **STILL NO EXECUTION**,
  **SERVER PERSISTENCE FLAG MUST REMAIN OFF**.
- Confirmer : table `clonestore_controlled_missions`, `enable row level security`,
  policies `select` / `insert` / `update` own, **absence de DELETE**, CHECK
  `chk_controlled_missions_no_execution` (tous les `*_enabled = false`,
  `runtime_status = 'disabled'`, `local_origin = true`), index, trigger `updated_at`.
- **NE PAS exécuter le SQL.** Aucune application en P5.5.

## 3. Vérifier que le flag est toujours false

- Confirmer `default_enabled` false dans le contrat de flag.
- Confirmer qu'aucune modification de `.env.local` n'a été faite.
- Confirmer que `flag=true` ne crée **aucune** route en P5.5.

## 4. Vérifier qu'aucune route n'existe

- Confirmer l'absence de `src/app/api/clonestore/runtime/controlled-missions/route.ts`.
- Confirmer l'absence de route `…/execute`.
- Confirmer que l'API contract est `disabled_design_only` (`route_file_created` false).

## 5. Vérifier que rien n'est exécuté

- `server_write_performed` / `runtime_execution_performed` false.
- `real_mission_created` / `pierre_engine_called` / `ai_call_performed` false.
- `email_sent` / `document_generated` / `clonevoice_active` false.

## 6. Checklist evidence

- Remplir le template d'evidence P5.5
  (`docs/templates/PHASE_5_5_CONTROLLED_MISSION_SERVER_PERSISTENCE_MANUAL_ACTIVATION_EVIDENCE.md`).
- Joindre : capture flag off, absence de route, SQL non appliqué.
- Lancer `npm run check:controlled-mission-server-persistence-manual-activation` (read-only).

## 7. Décision

- **PASS** — préparation manuelle vérifiée, **rien appliqué**.
- **FAIL** — SQL appliqué, flag activé, route créée, write serveur, mission serveur réelle, ou exécution détectée.
- **NEEDS REVIEW** — points non bloquants à revoir.

## 8. Rappel

- **Ne pas appliquer le SQL dans cette phase (P5.5).**
- Ne pas activer le flag serveur. Ne pas créer de route serveur.
- Persistance serveur ≠ exécution.
- scale 80k non prouvé · lancement public externe non validé.

---

> Prochaine phase recommandée : **PHASE 5.6 — Controlled Mission Server Restore UI
> Polish / Still No Execution.**
