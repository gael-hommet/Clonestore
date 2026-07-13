# E1 — Owner Action Checklist

**Scope:** dashboard / legal / domain / provider actions that **must be performed by the owner or an authorized adult/company representative** — never by Claude. Each item names the exact system, the exact field, the expected value **format** (never the secret value), how the repo reads it, how to validate **without leaking it**, the rollback, whether a real customer effect is possible, and the authorization required before testing.

> **Do not bypass provider age / identity / business / banking / legal requirements.** If an account legally requires an adult, a registered company, an authorized representative, or a verified bank account, it stays **blocked**: the technical side is prepared; the identity is not invented or bypassed.

Ordered by the recommended sequence.

## 1. Legal entity + counsel (LEGAL_ACTION_REQUIRED)
- **System:** company registry (RCS/greffe) + a qualified lawyer.
- **Fields:** dénomination sociale, forme juridique, capital, siège, RCS/SIREN/SIRET, VAT intracommunautaire, directeur de publication, hébergeur details.
- **How the repo reads it:** hard‑coded into `src/app/legal/mentions/page.tsx` (replace the `Placeholder`/`À renseigner` blocks); no env.
- **Validate without leaking:** `/legal/mentions` no longer contains "Placeholder"/"À renseigner"/"Draft 1.0"; lawyer attests in writing.
- **Customer effect:** none (content only). **Rollback:** revert the page to the DRAFT shell.
- **Authorization before testing:** none needed; it is content.

## 2. Production domain + DNS (DOMAIN_DNS_REQUIRED)
- **System:** domain registrar + DNS zone + host.
- **Fields:** `NEXT_PUBLIC_APP_URL=https://<domain>` (public), A/CNAME records to the host.
- **How the repo reads it:** absolute links / checkout return URLs read `NEXT_PUBLIC_APP_URL`.
- **Validate without leaking:** external DNS lookup resolves to the host; HTTPS cert valid. (URL is public, not a secret.)
- **Customer effect:** none until deployed. **Rollback:** point env back to a staging URL.

## 3. Supabase production project (OWNER_ACTION_REQUIRED)
- **System:** Supabase dashboard.
- **Fields (host secret manager, never committed):** `NEXT_PUBLIC_SUPABASE_URL` (public), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public JWT), `SUPABASE_SERVICE_ROLE_KEY` (**secret, server‑only**).
- **Migrations:** authorize + run `supabase/migrations/**` (57 files, ordered) against the project.
- **RLS runtime verify:** create two test accounts (`RLS_TEST_USER_A_*`, `RLS_TEST_USER_B_*`), run `scripts/rls-runtime-verify.mjs`.
- **Validate without leaking:** presence/shape check in the host env (never the value); RLS script shows cross‑user isolation blocked.
- **Customer effect:** migrations mutate the production schema — **authorize explicitly**, take a backup first. **Rollback:** restore from backup / down‑migration.
- **Backup:** enable PITR/backups + rehearse a restore.

## 4. Stripe (OWNER_ACTION_REQUIRED)
- **System:** Stripe dashboard (requires verified business identity + bank account — owner must have the legal authority to create it).
- **Fields (secret, server‑only):** `STRIPE_SECRET_KEY` (`sk_live_…`), `STRIPE_WEBHOOK_SECRET` (`whsec_…`); public: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`).
- **Prices:** create live `STRIPE_PRICE_PIERRE_EUR_MONTHLY` (44900 EUR/month) and `STRIPE_PRICE_PIERRE_CHF_MONTHLY` (49900 CHF/month) — active, distinct, no cross‑currency.
- **Webhook:** register the endpoint `https://<domain>/api/webhooks/stripe`; copy the `whsec_` secret; enable the 5 events.
- **Flags:** `STRIPE_COUNTRY_PRICING_ENABLED=true`, `STRIPE_COUNTRY_RECONCILIATION_ENABLED=true` (then live‑verify + attest).
- **Validate without leaking:** owner‑gated read‑only `node scripts/p15-verify-stripe-live-readonly.mjs` (prices.retrieve only; secrets masked); no session/payment created.
- **Customer effect:** a live checkout **can charge a real customer** — do **not** run a live payment during setup; use test mode. **Rollback:** deactivate the price / disable payment (`CLONESTORE_PAYMENT_MODE=disabled`).
- **Authorization before testing live:** production must be authorized (P10 floor) — which is a separate deliberate code change. Until then, `resolvePaymentMode` stays `disabled` even with live keys.

## 5. Email provider + domain (PROVIDER_ACTION_REQUIRED + DOMAIN_DNS_REQUIRED)
- **System:** Resend dashboard + DNS zone.
- **Fields (secret, server‑only):** `RESEND_API_KEY` (`re_…`); config: `EMAIL_PROVIDER=resend`, `RESEND_DEFAULT_FROM`, `RESEND_ALLOWED_FROM_DOMAINS`.
- **DNS:** SPF TXT, DKIM CNAME/TXT, DMARC TXT, return‑path.
- **Validate without leaking:** Resend shows the domain verified; a sandbox send to an allow‑listed test recipient succeeds. Live send only under `EMAIL_SEND_LIVE=true` + paid customer.
- **Customer effect:** a live send emails a real recipient — keep `EMAIL_RUNTIME_MODE=mock`/`sandbox` during setup. **Rollback:** set mode back to mock.

## 6. Signature (PROVIDER_ACTION_REQUIRED)
- **System:** Yousign (P8.7.4 OPEN) **or** owner approval of the fallback.
- **Fields:** `CLONESTORE_SIGNATURE_LIVE_VERIFIED` (attestation after live verify) **or** `CLONESTORE_SIGNATURE_FALLBACK_APPROVED=true`.
- **Validate without leaking:** live path → owner attestation + non‑sandbox mode; fallback → copy shows "document prepared, signed manually outside CloneStore" only.
- **Customer effect:** live signature sends a real signature request — do not until verified. **Rollback:** unset the flag (fails closed to prepared‑not‑signed).

## 7. Monitoring vendor + rollback (OWNER_ACTION_REQUIRED)
- **System:** the owner‑chosen monitoring vendor + alert channel.
- **Fields:** vendor DSN/keys (secret, server‑only), `CLONESTORE_MONITORING_ROLLBACK_VERIFIED` after a rehearsal.
- **Validate without leaking:** an alert fires in the vendor; owner attests the rollback rehearsal.
- **Customer effect:** none. **Rollback:** documented in the observability runbook.

## 8. Deployment + smoke (DEPLOYMENT_REQUIRED)
- **System:** the host (Vercel or a Node host).
- **Actions:** connect repo + domain, set all env, run `npm run build` + `npm run start`, wire the health route (body in the deployment runbook), run the smoke checklist, then set `CLONESTORE_DEPLOY_PROOF` only after a real deploy + health pass.
- **Validate without leaking:** health endpoint 200 on the deployed URL.
- **Customer effect:** the app goes live to visitors — do not open paid access until production is authorized. **Rollback:** re‑deploy the previous build / disable payment.

## 9. Owner production authorization (PRODUCTION_AUTHORIZATION_REQUIRED)
- **System:** the codebase (deliberate change) + the owner go‑live approval packet.
- **Action:** complete + sign `P15_OWNER_GO_LIVE_APPROVAL_PACKET.md`; then a deliberate code change lifts `PRODUCTION_AUTHORIZED` in `p10-production-gate.ts`. **No env value can do this.**
- **Validate:** `canAuthorizeProduction()` requires all gates + owner sign‑off + the code change.
- **Customer effect:** this is the switch that permits live paid access. Do it **last**, only when every external proof above exists.

See [E1_EXTERNAL_VALIDATION_CHECKLIST.md](E1_EXTERNAL_VALIDATION_CHECKLIST.md) for the exact proof required after each step.
