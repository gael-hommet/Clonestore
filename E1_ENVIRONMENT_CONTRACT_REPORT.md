# E1 — Environment Contract Report

**Source of truth:** [`e1-environment-contract.ts`](src/lib/clonestore/external-enablement/e1/e1-environment-contract.ts). Machine copy: [.e1-proofs/external-enablement/environment-contract.json](.e1-proofs/external-enablement/environment-contract.json) + [secret-boundary.json](.e1-proofs/external-enablement/secret-boundary.json).

The contract enumerates **28 variables** across the required categories, with server/public separation, required stages, validation rule (**shape only**), safe default, failure behavior and the associated feature. Presence is computed by **shape** (`envShape`) — **secret values are never read, returned or logged**.

## Categories covered
`app_url` · `supabase` · `auth` · `openai` · `anthropic` · `stripe_test` · `stripe_live` · `stripe_webhook` · `email_provider` · `email_domain` · `signature` · `voice` · `monitoring` · `deployment` · `rate_limit_budget` · `kill_switch` · `production_authorization`.

## Hard rules (enforced by `evaluateSecretBoundary()` + tests B7–B11)
- A server **secret** is never exposed through `NEXT_PUBLIC_*`. (`secretsAreServerOnly=true`, `noPublicSecret=true`, `violations=[]`.)
- Secret **values** are never read/printed/returned — only presence + coarse shape (`absent|placeholder|test|live|webhook_secret|url|value`).
- Unknown/missing **production** secrets fail closed (`missingRequiredForProduction` is non‑empty locally → `requiredSecretsPresentByShape=false`).
- Malformed boolean flags fail closed (downstream `flagOn` treats anything ≠ true/1/on/enabled as false).
- **Production authorization is never inferred from `NODE_ENV`** — it is the `PRODUCTION_AUTHORIZED` code const (P10). No env var lifts it.
- **Payment live is never inferred from Stripe key shape** — `resolvePaymentMode` returns `disabled` for live keys while the P10 floor is false.
- **Provider readiness requires independent proof** — a name in this registry is not configuration.

## Secret vs public

| Server‑only **secrets** (never `NEXT_PUBLIC_`) | Public (safe client) |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY`, `PIERRE_INTERNAL_DIAGNOSTICS_SECRET`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |

Price ids (`STRIPE_PRICE_PIERRE_*`) and flags are server‑only but not secret.

## Required in production (fail‑closed if missing)
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PIERRE_INTERNAL_DIAGNOSTICS_SECRET`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PIERRE_EUR_MONTHLY`, `STRIPE_PRICE_PIERRE_CHF_MONTHLY`, `STRIPE_COUNTRY_PRICING_ENABLED`, `STRIPE_COUNTRY_RECONCILIATION_ENABLED`, `AI_COST_SHIELD_MODE`, `PIERRE_OBSERVABILITY_ENABLED`.

## The production‑authorization boundary
There is **no environment variable that authorizes production.** `CLONESTORE_OWNER_GOLIVE_APPROVED` and related flags feed the go‑live gates but can never lift the P10 hard floor by themselves — that requires a deliberate code change to `PRODUCTION_AUTHORIZED = false as const`.

## Machine‑readable readiness registry
`evaluateEnvironmentContract(env)` returns `{ totalVars, serverOnlyCount, publicCount, secretCount, requiredInProductionCount, presentByShape, missingRequiredForProduction, secretBoundary, contractReady, presence }`. `contractReady=true` (the contract is complete and the secret boundary holds) — it does **not** claim the secrets are configured.

---

# Mise à jour E1.1 — audit d'environnement re-mesuré (11/07/2026)

Sonde : `node scripts/e1-1-environment-precheck.mjs` →
`.e1-1-proofs/repository-reconciliation/environment-precheck.json`
**Présence et forme uniquement. Aucune valeur lue, affichée ou journalisée.** Le script **refuse
d'émettre** si une valeur de secret apparaissait dans sa propre sortie.

## Présence / forme (jamais la valeur)

| Variable | Présente | Forme | Note |
|---|:--:|:--:|---|
| `DATABASE_URL` | ✅ | ✅ | **classée `managed_supabase_remote`** — production non exclue |
| `CLONECHAT_DB_URL` | ❌ | — | résolution : `CLONECHAT_DB_URL \|\| DATABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | serveur uniquement |
| `OPENAI_API_KEY` | ✅ | ✅ | serveur uniquement |
| `STRIPE_SECRET_KEY` | ✅ | ✅ | **forme `sk_test_` — jamais `sk_live_`** |
| `RESEND_API_KEY` | ✅ | ✅ | e-mail |
| `YOUSIGN_API_KEY` / `TWILIO_AUTH_TOKEN` / `ELEVENLABS_API_KEY` | ❌ | — | providers **absents ⇒ bloqués** (conforme) |
| `SENTRY_DSN` | ❌ | — | **supervision non configurée** |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` | ❌ | — | **URL de production non déclarée** |
| `CLONECHAT_ENABLED` | ❌ (non défini) | — | ⇒ **CloneChat ACTIF** (défaut C1.2) ; `false` = arrêt d'urgence |
| `PRODUCTION_AUTHORIZED` (env) | ❌ | — | **sans effet** : le plancher est une constante de code |

## Invariants re-vérifiés dans le CODE

| Invariant | Résultat |
|---|:--:|
| `PRODUCTION_AUTHORIZED` est une **constante `false`** | ✅ |
| La production **n'est pas déduite de `NODE_ENV`** | ✅ |
| Le paiement live **n'est pas déduit de la forme d'une clé** | ✅ |
| CloneChat **actif par défaut** + **arrêt d'urgence** explicite | ✅ |

> Le compilateur défend lui-même le plancher : comparer `PRODUCTION_AUTHORIZED` à `true` est une
> **erreur de type** (TS2367) — constatée et corrigée pendant E1.1. Garantie structurelle, pas convention.

## Frontière des secrets

| Contrôle | Résultat |
|---|---|
| Secret serveur exposé en `NEXT_PUBLIC_*` | **aucun** |
| Valeur de secret **recopiée** dans une variable publique | **aucune** |
| Secret dans un fichier de preuve (**57 fichiers** balayés contre **34 valeurs réelles** + motifs `sk-…`, `postgres://…`, JWT, `sk_live/test`) | **aucun** |
| Appel provider externe **pendant le build** | **aucun** |

## États externes NON résolus (inchangés — ce ne sont pas des défauts)

- **Supervision** : aucun DSN ⇒ pas de supervision de production.
- **Domaine / URL de rappel d'authentification** : non déclarés.
- **Signature / voix / téléphonie** : providers absents ⇒ **bloqués** (conforme).
- **Stripe** : clé de **test** ⇒ **aucun paiement réel possible** (`paymentMode = disabled`).
- **Base distante** : **non modifiée** ; état de la migration P9.4.1 = **INCONNU** tant qu'un
  opérateur autorisé n'a pas lancé le prévol **en lecture seule**
  (`scripts/e1-1-clonechat-remote-preflight.mjs --connect`).
