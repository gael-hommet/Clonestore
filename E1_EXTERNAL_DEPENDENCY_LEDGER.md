# E1 — External Dependency Ledger

**Nature:** the canonical recovery of every external blocker between **P16C — INTEGRATION LOCALLY VERIFIED / EXTERNAL LIVE CAPABILITIES BLOCKED** and an owner‑authorized production. Recovered from the real repository (P10/P11/P15/P15.1/P16C modules + reports + `.env.example` + config), **not** from the prompt's list. Computed by [`buildE1DependencyLedger()`](src/lib/clonestore/external-enablement/e1/e1-external-dependency-ledger.ts); machine copy: [.e1-proofs/external-enablement/external-dependency-ledger.json](.e1-proofs/external-enablement/external-dependency-ledger.json).

**Doctrine (never collapsed):** LOCAL_READY ≠ TEST_READY ≠ EXTERNALLY_CONFIGURED ≠ PRODUCTION_AUTHORIZED. `externalConfigStatus` is **capped at `PARTIALLY_CONFIGURED_BY_SHAPE`** — presence‑by‑shape of a key can never equal external verification. Every entry's `productionAuthStatus` is `NOT_AUTHORIZED`. Code can never mark an external action complete.

## Rollup (29 dependencies)

| finalStatus | count |
|---|---|
| LOCAL_READY | 3 |
| TEST_READY | 0 |
| OWNER_ACTION_REQUIRED | 8 |
| PROVIDER_ACTION_REQUIRED | 2 |
| LEGAL_ACTION_REQUIRED | 4 |
| CREDENTIAL_REQUIRED | 1 |
| DOMAIN_DNS_REQUIRED | 2 |
| DEPLOYMENT_REQUIRED | 2 |
| PRODUCTION_AUTHORIZATION_REQUIRED | 1 |
| NOT_REQUIRED_FOR_LAUNCH | 6 |
| BLOCKED | 0 |

Launch‑critical: **23** · launch‑optional/later: **6**. Owner actions: **8** · provider: **2** · legal: **4**.

## Ledger

| ID | Name | Canonical source | Local | Sandbox | Ext.config | Prod.auth | Owner | Launch | Final status |
|---|---|---|---|---|---|---|---|---|---|
| legal.company_identity | Legal company identity | `src/app/legal/mentions/page.tsx` (Placeholder), P15_1 legal packet | PARTIAL | n/a | NOT_CONFIGURED | NOT_AUTH | legal | critical | **LEGAL_ACTION_REQUIRED** |
| legal.country_launch | Country legal launch (FR/BE/LU/CH) | P10 legalReadiness (0/4), P13 country‑fit, P8.13 WITHHELD | PARTIAL | n/a | NOT_CONFIGURED | NOT_AUTH | legal | critical | **LEGAL_ACTION_REQUIRED** |
| infra.production_domain | Production domain + DNS | `.env.example` NEXT_PUBLIC_APP_URL | LOCAL_READY | n/a | by‑shape | NOT_AUTH | owner | critical | **DOMAIN_DNS_REQUIRED** |
| infra.production_hosting | Production hosting | `next.config.ts`, `vercel.json`, `package.json` | LOCAL_READY | n/a | NOT_CONFIGURED | NOT_AUTH | owner | critical | **DEPLOYMENT_REQUIRED** |
| infra.production_env_vars | Production secrets | `e1-environment-contract.ts` | LOCAL_READY | n/a | by‑shape | NOT_AUTH | owner | critical | **CREDENTIAL_REQUIRED** |
| supabase.production_project | Supabase production project | `.env.example` (SUPABASE_*) | LOCAL_READY | TEST_READY | by‑shape | NOT_AUTH | owner | critical | **OWNER_ACTION_REQUIRED** |
| supabase.production_migrations | Production migration auth | `supabase/migrations/**` (57 files), `scripts/db/migrate.mjs` | LOCAL_READY | TEST_READY | NOT_CONFIGURED | NOT_AUTH | owner | critical | **OWNER_ACTION_REQUIRED** |
| supabase.rls_tenant_isolation | RLS + tenant isolation | `production-readiness/supabase/**`, Pierre v1 itests | LOCAL_READY | TEST_READY | NOT_CONFIGURED | NOT_AUTH | owner | critical | **OWNER_ACTION_REQUIRED** |
| supabase.backup_recovery | DB backup / recovery | E1_SUPABASE_PRODUCTION_READINESS.md | PARTIAL | n/a | NOT_CONFIGURED | NOT_AUTH | owner | critical | **OWNER_ACTION_REQUIRED** |
| stripe.account | Authorized Stripe account | P15_1 owner checklist, `p15-1-payment-mode.ts` | LOCAL_READY | TEST_READY | NOT_CONFIGURED | NOT_AUTH | owner | critical | **OWNER_ACTION_REQUIRED** |
| stripe.products_prices | Live EUR 44900 / CHF 49900 | `p15-stripe-live-verification.ts`, `country-pricing.ts` | LOCAL_READY | TEST_READY | by‑shape | NOT_AUTH | owner | critical | **OWNER_ACTION_REQUIRED** |
| stripe.checkout | Checkout + country guard | `api/checkout/route.ts`, `checkout-country-guard.ts` | LOCAL_READY | TEST_READY | n/a | NOT_AUTH | eng | critical | **LOCAL_READY** |
| stripe.webhook | Webhook registration + secret | `api/webhooks/stripe/route.ts`, `evaluateWebhookReadiness` | LOCAL_READY | TEST_READY | by‑shape | NOT_AUTH | owner | critical | **OWNER_ACTION_REQUIRED** |
| email.provider | Transactional email (Resend) | `cloneos/channels/email-production/**` | LOCAL_READY | TEST_READY | by‑shape | NOT_AUTH | owner | critical | **PROVIDER_ACTION_REQUIRED** |
| email.sending_domain_dns | SPF/DKIM/DMARC | E1_EMAIL_DOMAIN_SETUP_PLAN.md | PARTIAL | sandbox n/c | NOT_CONFIGURED | NOT_AUTH | owner | critical | **DOMAIN_DNS_REQUIRED** |
| provider.signature_yousign | Yousign live or fallback | `p15-provider-closure.ts`, P8.7.4 OPEN | LOCAL_READY | sandbox n/c | NOT_CONFIGURED | NOT_AUTH | provider | critical | **PROVIDER_ACTION_REQUIRED** |
| provider.calendar | Calendar provider | T1 calendar, p16c calendar adapter | LOCAL_READY | sandbox n/c | NOT_CONFIGURED | NOT_AUTH | provider | optional | **NOT_REQUIRED_FOR_LAUNCH** |
| provider.notification_push | Push provider | T1 notification, T2 clonesignals | LOCAL_READY | sandbox n/c | NOT_CONFIGURED | NOT_AUTH | provider | optional | **NOT_REQUIRED_FOR_LAUNCH** |
| provider.voice | Voice (CloneVoice) | T2 clonevoice (live_disabled) | PARTIAL | BLOCKED | NOT_CONFIGURED | NOT_AUTH | provider | later | **NOT_REQUIRED_FOR_LAUNCH** |
| provider.telephony | Telephony (CloneCall) | T2 clonecall (dual‑blocked) | PARTIAL | BLOCKED | NOT_CONFIGURED | NOT_AUTH | provider | later | **NOT_REQUIRED_FOR_LAUNCH** |
| provider.sirh_payroll | SIRH / payroll connectors | P14 MUST_NOT (full payroll/DSN) | PARTIAL | n/a | NOT_CONFIGURED | NOT_AUTH | provider | later | **NOT_REQUIRED_FOR_LAUNCH** |
| provider.slack_connectors | Slack / connectors | channel identity layer | LOCAL_READY | sandbox n/c | NOT_CONFIGURED | NOT_AUTH | provider | optional | **NOT_REQUIRED_FOR_LAUNCH** |
| observability.monitoring | Error monitoring / alerts | `src/lib/observability/**` | LOCAL_READY | n/a | NOT_CONFIGURED | NOT_AUTH | owner | critical | **OWNER_ACTION_REQUIRED** |
| budget.rate_limits | Rate limits / AI budgets | `.env.example` AI_* caps, B38A/B38C | LOCAL_READY | n/a | n/a | NOT_AUTH | eng | critical | **LOCAL_READY** |
| legal.privacy_documents | CGU/CGV/DPA/privacy/mentions | `src/app/legal/**` (DRAFT) | PARTIAL | n/a | NOT_CONFIGURED | NOT_AUTH | legal | critical | **LEGAL_ACTION_REQUIRED** |
| legal.cookie_privacy_config | Cookie / consent | `legal/mentions/page.tsx` §7 | PARTIAL | n/a | NOT_CONFIGURED | NOT_AUTH | legal | critical | **LEGAL_ACTION_REQUIRED** |
| commercial.country_pricing | FR/BE/LU EUR, CH CHF | `pricing/country-pricing.ts` (canon) | LOCAL_READY | TEST_READY | n/a | NOT_AUTH | eng | critical | **LOCAL_READY** |
| deploy.production_smoke | Production smoke tests | E1_DEPLOYMENT_RUNBOOK.md | LOCAL_READY | n/a | NOT_CONFIGURED | NOT_AUTH | owner | critical | **DEPLOYMENT_REQUIRED** |
| owner.production_authorization | P10 hard floor | `p10-production-gate.ts` (`PRODUCTION_AUTHORIZED=false as const`) | LOCAL_READY | n/a | NOT_CONFIGURED | NOT_AUTH | owner | critical | **PRODUCTION_AUTHORIZATION_REQUIRED** |

## Reading the statuses honestly

- **LOCAL_READY (3):** `stripe.checkout`, `budget.rate_limits`, `commercial.country_pricing` — the logic is coded + tested; their *live effect* still depends on owner‑owned external entries.
- **NOT_REQUIRED_FOR_LAUNCH (6):** calendar/push/voice/telephony/SIRH/Slack — local‑safe fallbacks proven in P16C; live paths are roadmap, not launch blockers.
- Everything else is an **owner / provider / legal / domain / deployment / production‑authorization** action that **no test can satisfy**. Each entry carries its exact `validationMethod`, `safeFallback` and `forbiddenClaim`.

See [E1_OWNER_ACTION_CHECKLIST.md](E1_OWNER_ACTION_CHECKLIST.md), [E1_EXTERNAL_VALIDATION_CHECKLIST.md](E1_EXTERNAL_VALIDATION_CHECKLIST.md), and per‑domain plans.
