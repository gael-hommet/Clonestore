# E1 — External Validation Checklist

**Scope:** the exact proof required **after** each external action, and how to capture it **without leaking a secret**. No item here can be satisfied by code — each requires real external evidence. Record results in a local, git‑ignored proof file (never commit secrets).

| # | Action | Exact proof required | Capture without leaking | Command center flag it flips |
|---|---|---|---|---|
| 1 | Legal entity + counsel | Written lawyer sign‑off; `/legal/mentions` free of "Placeholder"/"À renseigner"/"Draft 1.0" | Screenshot of the page + a hash of the signed opinion (not its contents) | `legalPlaceholdersResolved`, `legalSignoffObtained` |
| 2 | Per‑country legal review | Signed opinion per FR/BE/LU/CH recorded in the legal‑tax artifact registry (source+hash+date, not expired) | Registry entry hash only | (feeds P15 gate D) |
| 3 | Production domain + DNS | External DNS lookup resolves domain→host; valid HTTPS cert | `dig`/`nslookup` output (URL is public) | `productionDomainKnown`, `productionDomainDnsVerified` |
| 4 | Supabase production project | Connect succeeds; project id present in host env by shape | Presence/shape check only; never print the service‑role key | `supabaseProductionProjectConfigured` |
| 5 | Production migrations | Migration replay succeeds; schema diff empty | Migration log tail; no secrets | `productionMigrationsAuthorized` |
| 6 | RLS runtime verify | `scripts/rls-runtime-verify.mjs`: user A cannot read user B's rows | Script PASS/FAIL summary (no row data) | (production RLS — owner attested) |
| 7 | DB backup/restore | A restore test succeeds on the project | Backup config screenshot; restore timestamp | `productionBackupConfigured` |
| 8 | Stripe account | Account verified (business + bank); dashboard shows active | Account status screenshot; never the key | (feeds `stripe.account`) |
| 9 | Live EUR + CHF prices | `p15-verify-stripe-live-readonly.mjs`: amount 44900 eur / 49900 chf, monthly, active, distinct | Script output (secrets masked; no session/payment) | `stripeLiveReady` |
| 10 | Webhook registration | Stripe dashboard shows the endpoint; a signed test event is accepted (200) | Endpoint id + event log entry; `whsec_` never printed | `stripeWebhookExternallyRegistered` |
| 11 | Reconciliation live‑verify | On real live payments, CH/EUR mismatch → review (no paid access) | Order status sample (no PII) | (feeds P15 gate C) |
| 12 | Email provider | Sandbox send to an allow‑listed recipient succeeds | Resend delivery id; `re_` key never printed | `emailProviderConfigured` |
| 13 | Email domain (SPF/DKIM/DMARC) | Resend shows domain verified; DNS lookup shows the records | Verification screenshot + `dig TXT` output | `emailDomainVerified` |
| 14 | Signature live or fallback | Live: owner attestation + non‑sandbox; Fallback: copy shows "prepared, not signed" | Attestation flag presence; UI copy screenshot | `signatureProviderConfigured` |
| 15 | Monitoring vendor + rollback | An alert fires in the vendor; rollback rehearsed | Alert screenshot; rehearsal notes | `monitoringProviderConfigured` |
| 16 | Deployment | App reachable at the domain; health endpoint 200 | HTTP 200 from `/api/health` (no secrets in body) | `deploymentPerformed` |
| 17 | Production smoke | Smoke checklist passes on the deployed URL | Checklist results; no PII | `productionHealthVerified` |
| 18 | Owner production authorization | Signed go‑live packet + a deliberate code change lifting `PRODUCTION_AUTHORIZED` | Signed packet hash + the code diff | `productionAuthorized`, `readyForProductionActivation` |

## Rules
- **Presence/shape ≠ verified.** A key present in the host env only flips a `*_configured` flag to a *by‑shape* signal; the `*Verified`/`*Performed` flags require the external evidence above.
- **Never** paste a secret value into a proof file, a screenshot, a log, or a commit. Use presence/shape + masked prefixes only.
- **A real customer effect** (live payment, real email, live signature) requires production authorization **and** the specific safety flag; do not exercise these during setup — use test/sandbox modes.
- After all 18 rows are proven and production is authorized, re‑run `computeE1CommandCenter()` — only then can `readyForProductionActivation` become true.
