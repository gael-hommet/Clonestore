# Pierre Backend Status — 2026-05-09

Audit complet des routes API, sécurité, contrats runtime et flux validés.
Dernière mise à jour : session 2 du 2026-05-09.

---

## 1. Catalogue des routes Pierre

### Routes actives — front (appelées par des hooks React)

| Route | Hook / Appelant | Auth | Statut |
|---|---|---|---|
| `POST /api/pierre/use/submit` | `usePierreMissionCenter` | Bearer (user) | ✓ Protégé |
| `GET /api/pierre/use/mission/[missionId]` | `usePierreMissionCenter` | Bearer (user) + ownership | ✓ Protégé |
| `POST /api/pierre/use/task/[taskId]/run` | `usePierreMissionCenter` | Bearer (user) + hasPierreAccess | ✓ Protégé |
| `POST /api/pierre/use/task/[taskId]/approve` | `usePierreMissionCenter` | Bearer (user) + hasPierreAccess | ✓ Protégé |
| `POST /api/pierre/use/task/[taskId]/cancel` | `usePierreMissionCenter` | Bearer (user) + hasPierreAccess | ✓ Protégé |
| `POST /api/pierre/use/task/[taskId]/reschedule` | `usePierreMissionCenter` | Bearer (user) + hasPierreAccess | ✓ Protégé |
| `POST /api/pierre/doc/generate` | `usePierreMissionCenter` | Bearer (user) — 401 obligatoire | ✓ Protégé |
| `POST /api/pierre/doc/rewrite` | `usePierreMissionCenter` | Bearer (user) + hasPierreAccess | ✓ Protégé |
| `POST /api/pierre/email/draft` | `usePierreMissionCenter` | Bearer (user) — 401 obligatoire | ✓ Protégé |
| `POST /api/pierre/email/send` | `usePierreMissionCenter` | Bearer (user) — 401 obligatoire | ✓ Protégé |
| `POST /api/pierre/pdf/generate` | `usePierreMissionCenter` | Bearer (user) — 401 obligatoire | ✓ Protégé |
| `GET /api/pierre/history/list` | `usePierreHistory` | Bearer (user) optionnel | ⚠ Graceful (retourne [] si anonyme) |
| `GET/POST /api/pierre/action` | Make webhook bridge | Bearer (user) + hasPierreAccess | ✓ Protégé |

### Routes actives — queue / worker

| Route | Appelant | Auth | Statut |
|---|---|---|---|
| `POST /api/pierre/queue/run-next` | Worker, `/use/task/*/run`, smoke test | Worker-secret OU user Bearer | ✓ Protégé |
| `POST /api/pierre/queue/process-next` | Worker (alias) | Forward complet de run-next (worker-secret + Bearer + cookie) | ✓ Corrigé session 2 |
| `POST /api/pierre/queue/process-task` | Worker direct | Worker-secret | ✓ Protégé |
| `POST /api/pierre/queue/release-stuck` | Worker cron | Worker-secret | ✓ Protégé |

### Routes actives — cron

| Route | Appelant | Auth | Statut |
|---|---|---|---|
| `GET /api/cron/pierre` | Vercel Cron | CRON_SECRET (Bearer ou query param) | ✓ Protégé |
| `GET /api/pierre/tick` | cron/pierre | CRON_SECRET query param | ✓ Protégé |

### Routes legacy (HMAC)

| Route | Auth | Risque résiduel | Statut |
|---|---|---|---|
| `POST /api/pierre/run` | HMAC obligatoire + ROUTER_HMAC_SECRET | Aucun ajout de risque | ✓ Inchangé — secure |
| `POST /api/pierre/generate` | Worker-secret OU user session | `user_id: null` si worker call (acceptable) | ✓ Corrigé session 2 — gate auth ajouté |
| `POST /api/pierre/execute` | HMAC obligatoire | Aucun | ✓ Inchangé — secure |
| `POST /api/pierre/brain` | Worker-secret | Aucun | ✓ Protégé (session 1) |
| `GET /api/pierre/history` | Aucune (stub lecture seule) | Retourne info statique, pas de données | Acceptable |

---

## 2. Résumé de la sécurité

### Mécanismes d'auth en place

| Mécanisme | Variables | Routes concernées |
|---|---|---|
| **User Bearer token** | Supabase JWT (Authorization: Bearer) | Toutes routes front actives |
| **Worker secret** | `PIERRE_QUEUE_WORKER_SECRET` header `x-pierre-worker-secret` | run-next, process-next (forward), process-task, release-stuck, brain, generate |
| **CRON secret** | `CRON_SECRET` header Bearer ou `?secret=` | cron/pierre (entrant), tick (entrant) |
| **HMAC** | `ROUTER_HMAC_SECRET` header `x-pierre-hmac` | run → generate → execute (pipeline legacy) |

### Correction session 2 — process-next

**Avant** : proxy HTTP qui ne forwardait aucun header auth → 401 systématique si `PIERRE_QUEUE_WORKER_SECRET` configuré.

**Après** : forward complet de `x-pierre-worker-secret`, `Authorization`, et `cookie`. Le corps est aussi forwardé (`onlyUserId`, `workerId`, `lockMinutes` passent correctement).

### Correction session 2 — generate (legacy)

**Avant** : OpenAI appelable sans aucune auth, `user_id: null` possible librement.

**Après** : gate `checkWorkerAuth || user session` ajouté avant l'appel OpenAI.
- Si `PIERRE_QUEUE_WORKER_SECRET` non configuré → comportement inchangé (open by convention).
- Si configuré → requiert worker-secret OU session user valide.
- `run` → `generate` : `run` forwarde maintenant le worker-secret si configuré.
- `test-pierre` page (browser) → continue de fonctionner via cookies session user.
- `user_id: null` reste possible pour les appels worker sans user context — risque documenté, acceptable en l'état.

---

## 3. Flux validé : mission → artifact → history

```
[Front]
  usePierreMissionCenter
    → POST /api/pierre/use/submit
        → INSERT pierre_missions (status: active)
        → INSERT pierre_tasks[] (status: ready, payload_json avec artifact_request)

[Worker / cron ou appel front direct]
  POST /api/pierre/queue/run-next  (ou process-next → run-next)
    → SELECT pierre_tasks WHERE status IN (ready, retry) ORDER BY priority
    → UPDATE task status = "running", locked_by
    → executePierreTask(task)
        doc.generate / pdf.generate  → artifact_request extrait du payload
                                       → insertArtifact → pierre_documents
        email.draft / email.send     → artifact_request extrait du payload
                                       → insertArtifact → pierre_outbound_emails
    → UPDATE task status = "done", finished_at
    → INSERT pierre_task_logs (task_execution_completed)

[Front]
  usePierreHistory
    → GET /api/pierre/history/list
        → SELECT pierre_missions JOIN pierre_tasks JOIN pierre_documents
```

---

## 4. Statuts pierre_tasks

```
ready → running → done        (chemin nominal)
ready → running → error       (max retries atteint)
ready → running → retry       (échec récupérable, release-stuck, ou retry_count < max)
retry → running → done        (retry réussi)
ready → cancelled             (annulation front)
ready → awaiting_approval     (approval_required = true)
awaiting_approval → ready     (approve front)
running → blocked             (executor: awaiting_info ou blocked)
```

Statuts terminaux (ne pas retraiter) : `done`, `error`, `cancelled`, `blocked`

---

## 5. Variables d'environnement requises

| Variable | Usage | Requis |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client | Oui |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin Supabase (workers) | Oui |
| `OPENAI_API_KEY` | Génération documents/emails | Oui |
| `PIERRE_QUEUE_WORKER_SECRET` | Auth worker → routes queue + generate | Fortement recommandé |
| `CRON_SECRET` | Auth Vercel Cron → cron/pierre + tick | Oui (sinon 500) |
| `ROUTER_HMAC_SECRET` | Auth pipeline legacy run/generate/execute | Oui si pipeline legacy actif |
| `PIERRE_BRAIN_MODEL` | Modèle brain (défaut: gpt-4.1) | Optionnel |
| `PIERRE_DEFAULT_SENDER_NAME` | Nom expéditeur email fallback | Optionnel |
| `PIERRE_DEFAULT_SENDER_EMAIL` | Email expéditeur fallback | Optionnel |
| `NEXT_PUBLIC_APP_URL` | URL app pour smoke test | Optionnel |

---

## 6. Tables Supabase utilisées

| Table | Usage |
|---|---|
| `pierre_missions` | Missions créées par l'utilisateur |
| `pierre_tasks` | Tâches de la mission (une par artifact) |
| `pierre_documents` | Artifacts document/pdf générés |
| `pierre_outbound_emails` | Artifacts email draft/send générés |
| `pierre_task_logs` | Logs d'exécution horodatés |
| `pierre_company_memory` | Mémoire entreprise (contexte génération) |
| `pierre_queue` | Ancienne queue (tick/execute legacy — `pierre_queue` table) |
| `audit_log` | Audit HMAC pipeline legacy (run/execute) |
| `agent_configs` | Config agents par client_id (pipeline legacy) |

---

## 7. Changements effectués (sessions 1 + 2 du 2026-05-09)

| Fichier | Session | Changement |
|---|---|---|
| `src/app/api/pierre/brain/route.ts` | 1 | Ajout `checkWorkerAuth` (worker-secret) |
| `src/app/api/cron/pierre/route.ts` | 1 | Ajout `checkCronAuth` (CRON_SECRET entrant) |
| `src/app/api/pierre/queue/release-stuck/route.ts` | 1 | Ajout `checkWorkerAuth` (worker-secret) |
| `src/app/api/pierre/queue/process-task/route.ts` | 1 | Fix status `"done"`, `finished_at`, terminal check étendu |
| `scripts/pierre-queue-runtime-test.mjs` | 1 | Nouveau — smoke test runtime opt-in |
| `docs/PIERRE_BACKEND_STATUS_2026-05-09.md` | 1+2 | Documentation status backend |
| `src/app/api/pierre/queue/process-next/route.ts` | **2** | **Réécriture — proxy avec forward auth complet** |
| `src/app/api/pierre/generate/route.ts` | **2** | **Ajout gate auth (worker-secret OU user session)** |
| `src/app/api/pierre/run/route.ts` | **2** | **Forward worker-secret vers generate/execute** |

---

## 8. Risques restants

| Priorité | Risque | Statut |
|---|---|---|
| Moyenne | `generate` legacy : `user_id: null` possible pour appels worker | Documenté — acceptable si worker-secret protège l'accès |
| Basse | `history/list` retourne `[]` sans 401 pour anonymous | Acceptable (pas de PII exposé) |
| Info | Pipeline HMAC legacy (run/generate/execute) parallèle à run-next | Planifier dépréciation propre |

---

## 9. Smoke test

```bash
# Lancer l'app en local d'abord
npm run dev

# Dans un autre terminal
PIERRE_RUNTIME_TEST_ENABLED=true \
  node --env-file=.env.local scripts/pierre-queue-runtime-test.mjs

# Avec nettoyage des données de test
PIERRE_RUNTIME_TEST_ENABLED=true \
  PIERRE_RUNTIME_TEST_CLEANUP=true \
  node --env-file=.env.local scripts/pierre-queue-runtime-test.mjs
```

---

## 10. Prochains blocs recommandés

**Priorité 1** — Dépreciation pipeline legacy : `run`, `generate`, `execute`, `brain`, `tick` → documenter migration vers `run-next` + `process-task` + `cron/pierre`.

**Priorité 2** — Smoke test en staging : exécuter `pierre-queue-runtime-test.mjs` sur Supabase staging avec app déployée, vérifier les 5 checks.

**Priorité 3** — `history/list` : ajouter 401 optionnel si aucun user (plutôt que `[]` silencieux).
