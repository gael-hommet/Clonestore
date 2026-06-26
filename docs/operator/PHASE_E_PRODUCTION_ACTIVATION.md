# Phase E — Activation Production (Founder Access)

Runbook **opérateur** pour activer Founder Access (réservations → Stripe → activation →
emails → analytics → command center) en production/staging. Exécutable, copier-coller.

> Le **code** est complet et validé localement. Ce qui reste est **externe** :
> fournir les secrets réels (Stripe, Resend), créer le rôle webhook dédié, appliquer les
> migrations sur la base réelle, puis exécuter les smokes. Tant que ces éléments ne sont
> pas fournis, la porte de readiness reste `BLOCKED` (ce n'est **pas** un défaut de code).

---

## 0. Verdicts de readiness

`npm run check:phase-e-production-readiness` agrège tout et renvoie :

| Sortie | Code | Signification |
|---|---|---|
| `ready` | exit **0** | Code local OK **et** secrets/services externes configurés et vérifiés. |
| `blocked` (externe) | exit **1** | Code local OK ; il manque uniquement des secrets/services externes. **Pas un bug.** |
| `blocked` (code) | exit **2** | Défaut de code local (schéma/rôle) — à corriger avant tout. |

Le détail liste chaque composant (`local-schema`, `webhook-role`, `stripe-env`,
`email-env`, `analytics-env`, `owner-gate-env`, `production-db`) et les blockers.

---

## 1. Variables d'environnement

Aucune valeur de secret n'est jamais loggée ni affichée (la page readiness et les checks
ne montrent que présence/conformité).

### Stripe (activation)
| Variable | Rôle |
|---|---|
| `STRIPE_SECRET_KEY` | Clé API Stripe (test `sk_test_…` / live `sk_live_…`). |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature du webhook (`whsec_…`). |
| `STRIPE_PRICE_PIERRE` | Price ID de l'offre fondateur (preuve commerciale : 44900 / EUR / month). |
| `STRIPE_PRODUCT_PIERRE` | (Optionnel) Product ID — sinon prouvé implicitement par le Price ID. |
| `CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL` | **Connexion DÉDIÉE** du writer webhook (voir §3). |

### Email (Resend)
| Variable | Rôle |
|---|---|
| `RESEND_API_KEY` | Clé API Resend (`re_…`). Aucun envoi réel sans elle. |
| `CLONESTORE_FOUNDER_EMAIL_FROM` | Expéditeur vérifié, ex. `CloneStore <founders@domaine>`. |
| `CLONESTORE_FOUNDER_EMAIL_TOKEN_SECRET` | Secret HMAC des tokens de vérification (≥ 24 car. fort). |
| `CLONESTORE_FOUNDER_EMAIL_LINK_SECRET` | Secret HMAC des liens (unsubscribe) (≥ 24 car. fort). |
| `CLONESTORE_PUBLIC_APP_URL` | Base des liens absolus. |
| `CRON_SECRET` | Bearer attendu par `GET /api/cron/founder-email` (déclencheur Supabase Cron, §6.1). |
| `CLONESTORE_FOUNDER_EMAIL_CRON_SECRET` | Secret relayé en interne vers `email-tick` (`x-cron-secret`). Inchangé. |

### Analytics
| Variable | Rôle |
|---|---|
| `CLONESTORE_FOUNDER_ANALYTICS_SESSION_SECRET` | Secret de signature du cookie de session analytics (≥ 24 car. fort). |

### Owner Gate / Command Center
| Variable | Rôle |
|---|---|
| `CLONESTORE_OWNER_COCKPIT_SLUG` | Segment d'URL secret du cockpit (`/internal/<slug>/command-center`). |
| `CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH` | Hash du mot de passe de la porte propriétaire. |
| `CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET` | Secret de signature du cookie de déverrouillage. |
| `CLONESTORE_OWNER_ADMIN_EMAILS` / `CLONESTORE_FOUNDER_ACCESS_ADMIN_EMAILS` | Allowlist d'emails admin (session Supabase). |

### Base / Supabase
| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Base Postgres (migrations + vérification). |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Activation des `orders` (webhook). |

> **Important** : les défauts de développement (`clonestore-dev-token-secret`,
> `clonestore-dev-analytics-session-secret`) sont **refusés** en production par les checks.

---

## 2. Ordre de configuration

1. **Secrets** : renseigner les variables ci-dessus dans l'environnement réel (jamais commit).
2. **Base** : appliquer les migrations (§4).
3. **Rôle webhook dédié** : créer le rôle + connexion (§3).
4. **Stripe** : configurer produit/prix/webhook (§5).
5. **Resend** : domaine vérifié + expéditeur (§6).
6. **Analytics / Owner Gate** : secrets (§7, §8).
7. **Vérifier** : `npm run check:phase-e-production-readiness` → viser `ready`.
8. **Smokes** : §5/§6/§7/§8 ci-dessous.

À chaque étape : `npm run check:founder-environment` pour voir ce qui manque encore.

---

## 3. Rôle webhook dédié (FAIL-CLOSED)

Le journal Stripe (`clonestore_founder_stripe_events`) n'est écrit que par la fonction
contrôlée `clonestore_record_founder_stripe_event(jsonb)`, réservée au rôle
`clonestore_stripe_webhook_writer`. Le rôle applicatif général `pierre_rt_app` **ne peut
pas** écrire (ni EXECUTE, ni INSERT brut). En production, sans connexion dédiée, le webhook
renvoie **503** (Stripe retentera) — **jamais** de fallback privilégié.

```sql
-- 1) Rôle de connexion dédié (login) membre du writer.
create role clonestore_stripe_webhook_login login password '<motdepasse-fort>';
grant clonestore_stripe_webhook_writer to clonestore_stripe_webhook_login;
```

```bash
# 2) URL dédiée pointant sur ce rôle (séparée de DATABASE_URL applicative) :
export CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL='postgres://clonestore_stripe_webhook_login:<mdp>@<host>:5432/<db>'
```

Vérifier le rôle (comportement réel, SET ROLE) :
```bash
npm run check:phase-e-stripe-webhook-role   # writer EXECUTE ✓, pierre_rt_app refusé ✓
```

---

## 4. Migrations sur la base réelle

```bash
# Application (idempotente, chaque migration en transaction ; refuse localhost en --production)
DATABASE_URL='postgres://…' npm run db:apply-founder-production -- --production

# Vérification structurelle (tables, colonnes, fonction journal, append-only, grants de
# moindre privilège). Sortie non-zéro en cas d'écart.
DATABASE_URL='postgres://…' npm run db:verify-founder-production
```

> La vérification d'append-only est **robuste quelle que soit la connexion** : elle tente
> la mutation (refus via REVOKE pour un rôle restreint, ou via trigger sur lignes réelles)
> et, à défaut d'erreur (ex. propriétaire sur table vide), confirme que le trigger
> anti-mutation `clonestore_forbid_mutation` est bien attaché. Connecter de préférence avec
> un rôle restreint (non-propriétaire) pour exercer aussi les REVOKE.

---

## 5. Stripe — configuration + smoke (test-mode)

1. Produit + prix récurrent **44900 EUR / month** → `STRIPE_PRICE_PIERRE` (et `STRIPE_PRODUCT_PIERRE`).
2. Endpoint webhook `POST /api/webhooks/stripe` → `STRIPE_WEBHOOK_SECRET`.
3. Smoke **sans paiement réel** (lecture du Price, vérifie montant/devise/intervalle) :

```bash
npm run check:founder-stripe-environment   # présence/cohérence test|live
npm run smoke:founder-stripe               # BLOCKED_EXTERNAL si clés absentes ; sinon vérifie le Price
```

Le smoke n'émet **aucun paiement live**. Preuve locale (ignorée par Git) :
`founder-stripe-smoke-proof.local.json`.

---

## 6. Resend — configuration + smoke

1. Domaine vérifié chez Resend, expéditeur → `CLONESTORE_FOUNDER_EMAIL_FROM`.
2. Smoke (envoi **à soi-même**, jamais à une liste client) :

```bash
npm run check:founder-email-environment
FOUNDER_EMAIL_SMOKE_RECIPIENT='vous@domaine' npm run smoke:founder-email
```

Idempotence fournisseur via `idempotencyKey`. Le smoke n'envoie **jamais** à des emails clients.

### 6.1 Planification du worker email — Supabase Cron (pg_cron + pg_net)

Le projet est déployé sur **Vercel Hobby**, qui refuse tout cron « plusieurs fois par
jour ». L'entrée `/api/cron/founder-email` `*/10 * * * *` a donc été **retirée de
`vercel.json`** ; le déclenchement est porté par **Supabase Pro**.

Script opérateur : [`supabase/sql/founder_email_supabase_cron.sql`](../../supabase/sql/founder_email_supabase_cron.sql)
(hors `supabase/migrations/` → jamais auto-appliqué ; à exécuter dans le SQL Editor).
Il active `pg_cron` + `pg_net`, lit **URL et secret depuis Supabase Vault**
(`founder_email_cron_url`, `founder_email_cron_secret` = valeur de `CRON_SECRET`), et
crée **un seul** job `founder-email-every-10-minutes` (`*/10 * * * *`, idempotent :
`cron.unschedule` par nom avant `cron.schedule`). À chaque tick, `net.http_get` appelle
`https://clonestore.pro/api/cron/founder-email` avec `Authorization: Bearer <secret>` —
le secret est lu depuis Vault à l'exécution, jamais figé dans `cron.job.command`.

La route et le relais interne (`email-tick`, `CLONESTORE_FOUNDER_EMAIL_CRON_SECRET`) sont
**inchangés**. Auth fail-closed : sans secret → 401 ; secret valide → 200. Contrôle des
exécutions : `cron.job`, `cron.job_run_details`, `net._http_response`, et la présence des
secrets Vault par leur nom (sans déchiffrer).

> Activation : créer les secrets Vault → exécuter le script → appel manuel
> `curl -fsS "https://clonestore.pro/api/cron/founder-email" -H "Authorization: Bearer $CRON_SECRET"`
> → 200 → vérifier une exécution `succeeded` dans `cron.job_run_details`.

---

## 7. Analytics — smoke

```bash
npm run check:founder-analytics-environment
npm run smoke:founder-analytics -- --url='https://<app>'   # cookie de session émis/réutilisé, UUID du body ignoré
```

Preuve locale (ignorée par Git) : `founder-analytics-smoke-proof.local.json`.

---

## 8. Owner Gate / Command Center — smoke

```bash
npm run smoke:founder-command-center -- --url='https://<app>'   # mauvais slug → 404, API interne refusée
```

Page de readiness interne (mêmes protections que le cockpit) :
`/internal/<slug>/command-center/readiness`.

---

## 9. Rollback

- **Désactivation d'urgence** : retirer/rendre invalide `CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL`.
  Le webhook bascule en **503** (fail-closed) → Stripe retient les events (aucune perte) ;
  aucune activation tant que la connexion n'est pas rétablie.
- **Couper les emails** : retirer `RESEND_API_KEY` → aucun envoi réel (jobs en attente).
- **Couper le cockpit** : retirer `CLONESTORE_OWNER_COCKPIT_SLUG`/hash → porte 404 (fail-closed).
- Les migrations sont **append-only** : pas de rollback destructif de schéma requis.

---

## 10. Rotation des secrets

1. Générer le nouveau secret, le placer en variable d'environnement.
2. Pour `STRIPE_WEBHOOK_SECRET` : ajouter le nouvel endpoint/secret Stripe, déployer, retirer l'ancien.
3. Pour les secrets HMAC email : `verification_token_version` permet d'invalider les anciens tokens.
4. Re-exécuter `npm run check:phase-e-production-readiness` après rotation.

---

## 11. Nettoyage des données de test

- Réservations de test : repérables par email de domaine de test ; supprimer côté base **après**
  vérification (les events funnel/audit/stripe sont **append-only** et ne se suppriment pas).
- Ne jamais supprimer de données de production réelles dans le cadre d'un smoke.

---

## 12. Dépannage

| Symptôme | Cause probable | Action |
|---|---|---|
| Webhook 503 `webhook_database_not_ready` | Connexion dédiée absente/non prête | §3 ; `check:phase-e-stripe-webhook-role`. |
| Readiness exit 1 | Secrets externes manquants | Normal tant que non configuré ; voir blockers. |
| Readiness exit 2 | Défaut de code (schéma/rôle) | Corriger avant activation ; `check:phase-e-schema-subset`. |
| Activation absente après paiement | Preuve commerciale invalide (prix/montant/devise/intervalle) | Vérifier `STRIPE_PRICE_PIERRE` = 44900/EUR/month. |
| Emails non envoyés | `RESEND_API_KEY`/`FROM` absents ou domaine non vérifié | §6. |
| Cockpit 404 | Owner Gate mal configurée (fail-closed) | §1 (slug/hash/cookie secret). |

---

## 13. Checklist copier-coller

```bash
# 1. Voir ce qui manque
npm run check:founder-environment

# 2. Base réelle
DATABASE_URL='postgres://…' npm run db:apply-founder-production -- --production
DATABASE_URL='postgres://…' npm run db:verify-founder-production

# 3. Rôle webhook dédié
npm run check:phase-e-stripe-webhook-role

# 4. Smokes externes (aucune action réelle destructive)
npm run smoke:founder-stripe
FOUNDER_EMAIL_SMOKE_RECIPIENT='vous@domaine' npm run smoke:founder-email
npm run smoke:founder-analytics -- --url='https://<app>'
npm run smoke:founder-command-center -- --url='https://<app>'

# 5. Porte de readiness (viser exit 0 = ready)
npm run check:phase-e-production-readiness
```
