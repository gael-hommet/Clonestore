# Cabinets Fondateurs — Runbook de mise en production

Ce runbook regroupe les actions **opérateur** (celles qui ne peuvent pas être faites depuis
l'environnement de développement). Le code, les migrations et l'outillage sont prêts et
prouvés (voir « Preuves » en bas). Aucun secret ne figure ici.

---

## 1. Variables d'environnement Vercel (Production)

| Variable | Scope | Secret | Format / valeur | Consommateur (code) |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | Production | **oui** | `sk_live_…` (JAMAIS `sk_test_` en prod) | `src/lib/stripe.ts`, checkout, webhook, payouts, connect |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Production | non | `pk_live_…` (jamais `sk_*` ici) | front checkout |
| `STRIPE_WEBHOOK_SECRET` | Production | **oui** | `whsec_…` (endpoint Live) | `src/app/api/webhooks/stripe/route.ts` |
| `STRIPE_PRICE_PIERRE` | Production | non | `price_…` EUR mensuel Live (alias EUR) | `src/app/api/checkout/route.ts`, webhook-deps |
| `STRIPE_PRICE_PIERRE_EUR_MONTHLY` | Production | non | `price_…` FR/BE/LU 449 €/mois Live | `pricing/country-pricing.ts` |
| `STRIPE_PRICE_PIERRE_CHF_MONTHLY` | Production | non | `price_…` CH 499 CHF/mois Live | `pricing/country-pricing.ts` |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | non | `https://<projet>.supabase.co` | supabase-server/browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | non | JWT anon | middleware, supabase clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | **oui** | JWT service-role | webhook, checkout, orders |
| `DATABASE_URL` | Production | **oui** | `postgres://…@…pooler.supabase.com:6543/postgres` (pooled) | runtime partenaires (`getRuntimeDb`) |
| `NEXT_PUBLIC_SITE_URL` (ou `SITE_URL`) | Production | non | `https://<domaine>` (HTTPS) | `getBaseUrl` (liens, return_url) |
| `CLONESTORE_PP_COOKIE_SECRET` | Production | **oui** | aléatoire ≥ 32 car. (repli : `CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET`) | cookie d'attribution signé |
| `PARTNER_PROGRAM_ENABLED` | Production | non | `true` | `flags.ts` (candidature/espace/attribution/commissions) |
| `PARTNER_PAYOUTS_ENABLED` | Production | non | `true` | `flags.ts` (job de versement) |
| `PARTNER_PAYOUT_DRY_RUN` | Production | non | `true` (transferts réels seulement après Live Gate) | `flags.ts`, `payouts.ts` |
| `PARTNER_PAYOUT_CRON_SECRET` | Production | **oui** | aléatoire ≥ 32 (repli : `CRON_SECRET`) | `api/cron/partner-payouts` |
| `PARTNER_EMAIL_CRON_SECRET` | Production | **oui** | aléatoire ≥ 32 (repli : `CRON_SECRET`) | `api/cron/partner-emails` |
| `RESEND_API_KEY` | Production | **oui** | `re_…` | provider email (outbox) |
| `CLONESTORE_FOUNDER_EMAIL_FROM` | Production | non | `CloneStore <fondateur@domaine>` | expéditeur emails |
| `CLONESTORE_OWNER_ADMIN_EMAILS` / `CLONESTORE_FOUNDER_ACCESS_ADMIN_EMAILS` | Production | non | emails admin (allowlist) | gate admin `/partenaires/admin` |

**Règles de validation (à contrôler AVANT de déployer)** :
- aucune `sk_test_`/`pk_test_` en Production ; aucune `sk_live_` dans une variable `NEXT_PUBLIC_*` ;
- aucune valeur placeholder ; secrets ≥ 32 caractères ; toutes les URLs en HTTPS ;
- cookies `Secure` en prod (déjà géré par le code quand `NODE_ENV=production`) ;
- flags dangereux OFF sauf la config recommandée : `PARTNER_PROGRAM_ENABLED=true`,
  `PARTNER_PAYOUTS_ENABLED=true`, **`PARTNER_PAYOUT_DRY_RUN=true`** (transferts réels différés).

---

## 2. Migrations Production (Supabase)

Ordre exact : `clonestore_pp_core` → `_finance` → `_emails` → `clonestore_orders_stripe_events`.
Outillage fourni et **validé sur Postgres 16 réel** (préflight GO, apply idempotent ×2, postcheck 38/38) :

```bash
# 1) Préflight LECTURE SEULE (compatibilité, extensions, formes de tables existantes)
DATABASE_URL="postgres://…direct…:5432/postgres" node scripts/partner-program-preflight.mjs

# 2) Application (chaque fichier en transaction, idempotent, s'arrête au 1er échec)
DATABASE_URL="…" node scripts/apply-partner-program-production.mjs --production

# 3) Vérification post-migration (structure + immutabilité + DELETE interdit + isolation RLS)
DATABASE_URL="…" node scripts/partner-program-postcheck.mjs
```

Utiliser l'URL **directe** (port 5432) pour le DDL, pas le pooler 6543. Les migrations ne
détruisent aucune donnée (uniquement `create … if not exists`, `add column if not exists`).

---

## 3. Stripe Live (Dashboard)

**Produit & prix** : vérifier le produit Pierre Live + Price **EUR 449,00 €/mois** et
**CHF 499,00 CHF/mois**, récurrents mensuels, actifs. Ne modifier aucun prix existant sans
vérifier ses usages (les montants attendus par le code sont 44900 EUR / 49900 CHF).

**Billing Portal Live** : activer le portail (Settings → Billing → Customer portal),
autoriser annulation en fin de période, mise à jour du moyen de paiement, historique de
factures. `return_url` = `https://<domaine>/mon-clonestore/facturation`.

**Connect Live** : activer Connect, comptes **Express** (capability `transfers`), onboarding
hébergé, branding minimal, pays partenaires FR/BE/LU/CH. Aucun compte Test en Live.

**Webhook Live** — route canonique `https://<domaine>/api/webhooks/stripe` (PAS
`/api/stripe/webhook`). Événements à sélectionner (les seuls consommés par le code) :
`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`,
`charge.dispute.created`, `charge.dispute.closed`, `account.updated`.
Copier le `whsec_…` dans `STRIPE_WEBHOOK_SECRET` (Vercel Production).

---

## 4. Crons (Supabase pg_cron + pg_net)

Coller `supabase/sql/partner_program_supabase_cron.sql` dans le SQL Editor (secrets via Vault).
- `partner-emails` : `*/5 * * * *` → `/api/cron/partner-emails` (traite l'outbox).
- `partner-payouts` : `0 3 5 * *` → `/api/cron/partner-payouts` (dry-run tant que `PARTNER_PAYOUT_DRY_RUN≠false`).
Les deux routes exigent un secret comparé en temps constant (fail-closed sans secret).

---

## 5. Observabilité & alertes (checklist minimale)

Surveiller et alerter sur :
- **Webhook** : taux de 5xx / 503 sur `/api/webhooks/stripe` (503 = DB webhook non prête → Stripe rejoue).
- **Events non traités** : lignes `clonestore_pp_stripe_events.processing_result='failed'` ; `clonestore_orders_stripe_events.processing_result in ('failed','conflict')`.
- **Conflit de payload** : `processing_result='conflict'` (même id, contenu différent) → investiguer.
- **Jobs** : `clonestore_pp_payout_runs.status='failed'` ; `clonestore_pp_transfers.status='failed'`.
- **Commissions gelées** (litige) : `clonestore_pp_commission_entries.status='frozen'`.
- **Rapprochement** : écart Stripe ↔ ledger (voir §7 du rapport).
- **Emails** : `clonestore_pp_email_outbox.status='dead'`.
- **Risk flags** : `clonestore_pp_risk_flags.status='open'`.

Requêtes de diagnostic (service-role) :
```sql
select processing_result, count(*) from clonestore_pp_stripe_events group by 1;
select status, count(*) from clonestore_pp_commission_entries group by 1;
select status, count(*) from clonestore_pp_email_outbox group by 1;
select * from clonestore_pp_payout_runs order by started_at desc limit 5;
```

---

## 6. Rollback immédiat (avant ouverture publique)

1. `PARTNER_PROGRAM_ENABLED=false` (Vercel) → coupe candidature/attribution/commissions (fail-closed).
2. `PARTNER_PAYOUTS_ENABLED=false` → coupe le job de versement.
3. **Ne jamais** supprimer les tables ni les données financières (ledger conservé).
4. Rollback Vercel vers le déploiement précédent (Deployments → Promote previous).
5. Désactiver l'endpoint webhook Live si nécessaire (Dashboard) — Stripe conserve et rejoue les événements ; à la réactivation, l'idempotence (`stripe_event_id`) évite tout double traitement.
6. Les commissions déjà enregistrées restent liées à leurs factures ; aucune reprise en double.

---

## 7. Live Gate — passage `PARTNER_PAYOUT_DRY_RUN=false`

À ne faire **que** dans une mission séparée, après validation humaine explicite : le code
refuse tout transfert live tant que le plancher production P10 (`productionAuthorized()=false`)
n'est pas levé. Séquence : lever le plancher → observer un cycle de payout dry-run en prod →
approuver → passer le flag.

---

## Preuves (déjà exécutées)
- `node scripts/validate-partner-migration-scripts.mjs` → préflight GO, apply idempotent ×2, **postcheck 38/38** sur Postgres 16 réel.
- Recette e2e `acceptance-e2e.itest.ts` : **20/20** (candidature→commission→remboursement→litige→payout dry-run).
- Gates : `tsc` 0, unit 191, intégration 43, routes Stripe 47, `npm run build` exit 0.
- Scan secrets mission : 0 réel. Endpoint obsolète `/api/stripe/webhook` : absent du runtime.
