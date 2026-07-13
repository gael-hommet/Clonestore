# E1 — Email & Domain Authentication Setup Plan

**Nature:** prepare the email architecture locally; do **not** alter DNS and do **not** send a real email. Sources: `src/lib/cloneos/channels/email-production/**`, `providers/resend.ts`, `.env.example` (B37/B39). Machine copies: [email-local-readiness.json](.e1-proofs/external-enablement/email-local-readiness.json), [email-domain-status.json](.e1-proofs/external-enablement/email-domain-status.json).

## Prepared locally (green)
- **Provider‑neutral email contract** — types + runtime with mode `mock|dry_run|sandbox|live`; **mock is the default** (no provider call).
- **Sender identity validation** — from‑address must be on an allow‑listed verified domain (`RESEND_ALLOWED_FROM_DOMAINS`).
- **Template rendering** + transactional classification.
- **Retry / idempotency** + **rate limits** (per company/user, in‑memory) + **recipient policy** (allow/block lists, max recipients).
- **Bounce/complaint handling contract** (interface) + **provider‑failure fallback** (degrade to mock, never silent success).
- **No recipient enumeration, no tenant leakage** — audit events never store the body by default (`EMAIL_LOG_BODY=false`).
- **No email marked sent without provider evidence** — a mock/dry‑run result is never presented as delivered.
- **No secret client‑side** — `RESEND_API_KEY` is a server‑only secret.

## Owner / provider actions
1. **Resend account** — create it; generate `RESEND_API_KEY` (`re_…`, server‑only, never committed).
2. **Sender / from address** — set `RESEND_DEFAULT_FROM` (e.g. `Pierre <noreply@yourdomain>`) and `RESEND_ALLOWED_FROM_DOMAINS`.
3. **Production sending domain** — add it in Resend.
4. **DNS records at the registrar** (do these; E1 does not):
   - **SPF** — TXT `v=spf1 include:… ~all`.
   - **DKIM** — the CNAME/TXT records Resend provides.
   - **DMARC** — TXT `v=DMARC1; p=quarantine; rua=mailto:…`.
   - **Return‑path** — the record Resend provides.
5. **Domain verification** — confirm Resend shows the domain **verified**.
6. **Sandbox recipient rules** — set `EMAIL_SANDBOX_TO` for staging; sends redirect there.
7. **Bounce/complaint webhook** — register it if used.
8. **Final live test authorization** — only with `EMAIL_RUNTIME_MODE` moving to `sandbox`→`live`, `EMAIL_SEND_LIVE=true`, a real key, and a paid customer. Rehearse in sandbox first.

## Validation (without leaking)
- `emailProviderConfigured` flips to a by‑shape signal when `RESEND_API_KEY` is present + `EMAIL_PROVIDER=resend` — this does **not** verify the domain.
- `emailDomainVerified` requires the Resend dashboard + an external DNS lookup — **code can never infer DNS**.
- Capture: Resend delivery id + `dig TXT` output; never print the API key.

## Forbidden claims
Draft ≠ sent. DNS instructions ≠ DNS verified. Do not mark an email sent without provider evidence.
