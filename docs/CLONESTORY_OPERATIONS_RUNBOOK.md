# CloneStory — Runbook d'exploitation

> **ÉTAT (2026-06-26) : DÉPLOYÉ EN PRODUCTION** sur `https://clonestore.pro` — migrations
> `_01→_08` appliquées, code CS-FINAL 1→4 actif, 3 crons Supabase actifs (`*/5`, derniers
> runs `succeeded`), Vault renseigné, `/health` vert, **flags commerciaux fermés**
> (`CLONESTORY_FF_COMMERCIAL_BRIDGE=off`, `CLONESTORY_FF_AUTO_VERIFICATION=off`), délai de
> validation 7 j, **inscriptions fermées**, données smoke intactes. Smoke commercial Stripe
> complet **non exécuté** (réservé au 1er client contrôlé). Lien partenaire canonique :
> `/founding-partners/r/<code>` ; alias court `/r/<code>` (307) prêt, déploiement opérateur requis.

Opérations quotidiennes/hebdomadaires. Toutes les actions admin exigent une session
propriétaire (allowlist) + une raison ; chaque action est auditée (append-only).

## Santé (à surveiller)
- `GET /api/internal/clonestory/health` (session admin OU `Authorization: Bearer <CRON_SECRET>`).
  Renvoie `{ health, alerts }`. Alertes à traiter : `*_dead > 0`, `stripe_failed`, `stripe_pending > 5`,
  `conflicts_open`, `migration_*_absent`.

## Crons (Supabase Cron — pg_cron + pg_net, secrets en Vault)
- `clonestory-outbox-every-5-minutes` → `/api/cron/clonestory-outbox` (emails de vérification).
- `clonestory-commercial-outbox-every-5-minutes` → `/api/cron/clonestory-commercial-outbox`.
- **Nouveau** : installer `clonestory-notifications` → `/api/cron/clonestory-notifications` (emails
  transactionnels : confirmation d'introduction, bienvenue, etc.) si l'envoi inline ne suffit pas.
  Modèle SQL : dupliquer `supabase/sql/clonestory_commercial_outbox_supabase_cron.sql` en changeant
  le nom de job, l'URL Vault (`clonestory_notifications_url`) et le secret (`…_cron_secret`).
- Contrôle : `select jobname, schedule, active from cron.job;` + `cron.job_run_details` + `net._http_response` (codes HTTP, sans secret).

## Tâches récurrentes
- **Réconciliation commerciale** : action admin `reconcile_commercial` (ou automatique au cron) — vérifie
  les `validation_pending` échus. Idempotente.
- **Reprise des emails morts** : action admin `replay_emails` (re-arme `dead`/`failed_retryable` des 3 outboxes).
- **Rétention** : `retentionSweep()` (anonymise les introductions refusées anciennes) — à câbler à un cron
  hebdomadaire ou déclencher manuellement (voir `CLONESTORY_DATA_RETENTION.md`).

## Activation production contrôlée (séquence — arrêt à chaque action externe)
1. **Snapshot logique** de la base (opérateur).
2. Compteurs pré-activation : `node scripts/check-clonestory-cs4-preflight.mjs --pg` (DATABASE_URL).
3. `MIGRATIONS_FILTER=clonestory_fp DATABASE_URL=… npm run db:migrate:pg` → applique `_05→_06→_07→_08`.
4. Vérifier : ré-exécuter le préflight (`_05.._08 = appliquées`, RLS OK).
5. Preuve RLS : `node scripts/check-clonestory-rls.mjs --pg`.
6. **Déployer le code** (Vercel) — APRÈS les migrations (le code requiert `_08`).
7. Vérifier les routes (200/401/503 attendus) ; inscriptions toujours `503` (fermées).
8. Installer/valider les crons (Vault + SQL) → `curl` 200 → exécution auto `succeeded`.
9. Tester les outboxes (un enqueue → worker → `sent`).
10. Smoke E2E Stripe **test** (voir `CLONESTORY_PRODUCTION_SMOKE.md`).
11. Inscriptions : **rester fermées** (décision séparée).
12. Observation 24-48 h via `/health`. Rollback si anomalie (voir incident runbook).

## Interrupteurs d'incident (sans redéploiement)
`CLONESTORY_FF_COMMERCIAL_BRIDGE=off` · `…_AUTO_VERIFICATION=off` · `…_NOTIFICATIONS=off` ·
`…_ATTRIBUTION_CAPTURE=off` · `…_ADMIN_MUTATIONS=off`. Le checkout CloneStore n'est jamais affecté.
