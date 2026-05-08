# Pierre Backend Status — 2026-05-09

Audit complet des routes API, sécurité, contrats runtime et flux validés.

---

## 1. Catalogue des routes Pierre

### Routes actives — front (appelées par des hooks React)

| Route | Hook / Appelant | Auth | Commentaire |
|---|---|---|---|
| `POST /api/pierre/use/submit` | `usePierreMissionCenter` | Bearer (user) | Crée mission + tasks, réponse immédiate |
| `GET /api/pierre/use/mission/[missionId]` | `usePierreMissionCenter` | Bearer (user) + ownership | Lecture mission avec tasks |
| `POST /api/pierre/use/task/[taskId]/run` | `usePierreMissionCenter` | Bearer (user) + hasPierreAccess | Lance run-next pour une task |
| `POST /api/pierre/use/task/[taskId]/approve` | `usePierreMissionCenter` | Bearer (user) + hasPierreAccess | Approuve task bloquée |
| `POST /api/pierre/use/task/[taskId]/cancel` | `usePierreMissionCenter` | Bearer (user) + hasPierreAccess | Annule task |
| `POST /api/pierre/use/task/[taskId]/reschedule` | `usePierreMissionCenter` | Bearer (user) + hasPierreAccess | Replanifie task |
| `POST /api/pierre/doc/generate` | `usePierreMissionCenter` | Bearer (user) — mandatory 401 | Génère document RH |
| `POST /api/pierre/doc/rewrite` | `usePierreMissionCenter` | Bearer (user) + hasPierreAccess | Réécrit document existant |
| `POST /api/pierre/email/draft` | `usePierreMissionCenter` | Bearer (user) — mandatory 401 | Crée brouillon email |
| `POST /api/pierre/email/send` | `usePierreMissionCenter` | Bearer (user) — mandatory 401 | Envoie email (status "sent") |
| `POST /api/pierre/pdf/generate` | `usePierreMissionCenter` | Bearer (user) — mandatory 401 | Génère PDF |
| `GET /api/pierre/history/list` | `usePierreHistory` | Bearer (user) — optionnel | Retourne [] si pas d'user (graceful) |
| `GET/POST /api/pierre/action` | Make webhook bridge | Bearer (user) + hasPierreAccess | Webhook Make → actions Pierre |

### Routes actives — queue / worker (appelées par le worker ou cron)

| Route | Appelant | Auth | Commentaire |
|---|---|---|---|
| `POST /api/pierre/queue/run-next` | Worker, `/use/task/[id]/run`, smoke test | Worker-secret OR user Bearer | Orchestrateur principal, insère artifacts |
| `POST /api/pierre/queue/process-next` | Interne | Aucune (proxy cassé) | Proxy vers run-next SANS forward auth — bug connu |
| `POST /api/pierre/queue/process-task` | Interne | Worker-secret | Exécuteur direct (bypass queue), status corrigé → "done" |
| `POST /api/pierre/queue/release-stuck` | Worker cron | Worker-secret | Libère tasks bloquées en status "running" depuis >15min |

### Routes actives — cron

| Route | Appelant | Auth | Commentaire |
|---|---|---|---|
| `GET /api/cron/pierre` | Vercel Cron | CRON_SECRET (Bearer ou query param) | Relaye vers /api/pierre/tick |
| `GET /api/pierre/tick` | cron/pierre, appels directs | CRON_SECRET query param | Traite pierre_queue (vieux schéma) |

### Routes legacy / stub

| Route | Statut | Commentaire |
|---|---|---|
| `POST /api/pierre/brain` | Legacy routing | Routing OpenAI pur, plus dans le flux principal. Worker-secret ajouté. |
| `POST /api/pierre/run` | Legacy HMAC | Pipeline run→generate→execute. Toujours fonctionnel mais contourné par run-next |
| `POST /api/pierre/generate` | Legacy HMAC | Permet user_id null (inserts anonymes possibles). Appelé par test-pierre + run |
| `POST /api/pierre/execute` | Legacy HMAC | Exécute email.send/doc.generate/hris.sync via Make webhook |
| `GET /api/pierre/history` | Stub découverte | Retourne description des endpoints, pas de données |

---

## 2. Résumé de la sécurité

### Schémas d'auth en place

| Mécanisme | Variables | Routes concernées |
|---|---|---|
| **User Bearer token** | Supabase JWT (Authorization: Bearer) | Toutes routes front actives |
| **Worker secret** | `PIERRE_QUEUE_WORKER_SECRET` header `x-pierre-worker-secret` | run-next, process-task, release-stuck, brain |
| **CRON secret** | `CRON_SECRET` header Bearer ou `?secret=` | cron/pierre (entrant), tick (entrant) |
| **HMAC** | `ROUTER_HMAC_SECRET` header `x-pierre-hmac` | run→generate→execute (pipeline legacy) |
| **Aucune auth** | — | process-next (bug), history stub (lecture seule) |

### Protections manquantes / risques acceptés

- `process-next` : proxy vers run-next sans forward des headers → 401 guaranteed en prod si worker-secret configuré. Non corrigé aujourd'hui (hors scope).
- `generate` (legacy) : `user_id: null` possible si pas de cookie valide. Non corrigé (pipeline HMAC legacy).
- `history/list` : retourne `[]` sans 401 pour anonymous → dégradation gracieuse acceptable.

---

## 3. Flux validé : mission → artifact → history

```
[Front]
  usePierreMissionCenter
    → POST /api/pierre/use/submit
        → INSERT pierre_missions (status: active)
        → INSERT pierre_tasks[] (status: ready, payload_json avec artifact_request)

[Worker / cron ou appel front direct]
  POST /api/pierre/queue/run-next
    → SELECT pierre_tasks WHERE status IN (ready, retry) ORDER BY priority
    → UPDATE task status = "running"
    → executeTask(task)
        doc.generate / pdf.generate  → generateDocumentArtifact()
                                       → INSERT pierre_documents
        email.draft                  → generateEmailArtifact()
                                       → INSERT pierre_outbound_emails
    → UPDATE task status = "done", finished_at
    → INSERT pierre_task_logs (task_execution_completed)

[Front]
  usePierreHistory
    → GET /api/pierre/history/list
        → SELECT pierre_missions JOIN pierre_tasks JOIN pierre_documents
```

---

## 4. Variables d'environnement requises

| Variable | Usage | Requis |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client | Oui |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin Supabase (workers) | Oui |
| `OPENAI_API_KEY` | Génération documents/emails | Oui |
| `PIERRE_QUEUE_WORKER_SECRET` | Auth worker → routes queue | Recommandé |
| `CRON_SECRET` | Auth Vercel Cron → cron/pierre | Oui (sinon 500) |
| `ROUTER_HMAC_SECRET` | Auth pipeline legacy run/generate/execute | Oui si pipeline legacy actif |
| `PIERRE_BRAIN_MODEL` | Modèle brain (défaut: gpt-4.1) | Optionnel |
| `PIERRE_DEFAULT_SENDER_NAME` | Nom expéditeur email fallback | Optionnel |
| `PIERRE_DEFAULT_SENDER_EMAIL` | Email expéditeur fallback | Optionnel |
| `NEXT_PUBLIC_APP_URL` | URL app pour appels internes (smoke test) | Optionnel |

---

## 5. Schéma de statuts pierre_tasks

```
ready → running → done        (chemin nominal)
ready → running → error       (exception non rattrapée)
ready → running → retry       (release-stuck après 15min)
retry → running → done        (retry réussi)
ready → cancelled             (annulation front)
ready → awaiting_approval     (approval_required = true)
awaiting_approval → ready     (approve front)
```

Statuts terminaux (ne pas retraiter) : `done`, `error`, `cancelled`, `blocked`

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
| `pierre_queue` | Ancienne queue (tick/execute legacy) |

---

## 7. Changements effectués ce jour (2026-05-09)

| Fichier | Changement |
|---|---|
| `src/app/api/pierre/brain/route.ts` | Ajout `checkWorkerAuth` (worker-secret) |
| `src/app/api/cron/pierre/route.ts` | Ajout `checkCronAuth` (CRON_SECRET entrant) |
| `src/app/api/pierre/queue/release-stuck/route.ts` | Ajout `checkWorkerAuth` (worker-secret) |
| `src/app/api/pierre/queue/process-task/route.ts` | `status: "completed"` → `"done"`, `completed_at` → `finished_at`, terminal check étendu |
| `scripts/pierre-queue-runtime-test.mjs` | Nouveau — smoke test runtime (opt-in) |

---

## 8. Risques restants

| Priorité | Risque | Recommandation |
|---|---|---|
| Haute | `process-next` proxie run-next sans auth headers | Corriger le proxy ou le supprimer |
| Moyenne | `generate` (legacy) autorise `user_id: null` | Protéger ou déprécier la route |
| Basse | `history/list` retourne `[]` sans 401 pour anonymous | Acceptable (no PII exposed) |
| Info | Pipeline HMAC legacy (run/generate/execute) parallèle au pipeline run-next | Planifier dépréciation propre |

---

## 9. Prochain bloc recommandé

**Priorité 1 — Corriger `process-next`** : forwarder les headers auth vers run-next, ou le remplacer par un appel direct à run-next.

**Priorité 2 — Dépreciation pipeline legacy** : `run`, `generate`, `execute`, `brain`, `tick` → remplacer par `run-next` + `process-task` + `cron/pierre`.

**Priorité 3 — Tests run-next en staging** : exécuter `pierre-queue-runtime-test.mjs` sur un Supabase de staging avec l'app déployée, vérifier les 5 checks.
