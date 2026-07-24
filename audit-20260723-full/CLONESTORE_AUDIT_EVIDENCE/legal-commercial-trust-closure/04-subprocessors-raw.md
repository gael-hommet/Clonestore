# Raw finding — Subprocessors / third-party providers inventory

Source: read-only Explore agent, package.json + code-call-site verification. No secret values printed.

| # | Provider | Status | Purpose | Data category | Region (from code) |
|---|---|---|---|---|---|
| 1 | **Supabase** | Confirmed, active (multi-service) | Auth + Postgres DB + Storage | Account data (`auth.users`), HR/tenant data via Pierre (employees, contracts, missions), uploaded documents | Not discoverable from code — operator-configured at deploy time (`.env.example` only has placeholder URL) |
| 2 | **Stripe** | Confirmed, active | Checkout, subscriptions, webhooks, Connect payouts | Billing metadata, customer/address, partner Connect Express accounts. **Stripe Tax NOT configured** — `p11-stripe-country-reconciliation.ts:117` explicitly flags this as `external_pending` ("à décider avec l'avocat/comptable"); zero `automatic_tax`/`tax_behavior` calls anywhere in `src/` | Not in code |
| 3 | **OpenAI** | Confirmed, sole AI/LLM provider (CloneChat + Pierre) | Chat/drafting assistance | Chat messages, attachments, a bounded tenant-scoped account-context snapshot (employee name/role, mission titles, capped at 6/category, tenant-isolated), doc-drafting instructions/company_name | Not in code |
| 4 | **Resend** | Confirmed, sole email provider | Transactional email only (founder-access, launch-sequence, CloneOS channel email) | Recipient email + subject/body | Not in code |
| 5 | **Vercel** | Confirmed hosting | App hosting + 1 cron (`partner-payouts`, monthly) | Infrastructure only | Not in code |
| 6 | Sentry/Datadog/Logtail/Axiom/@vercel/analytics | **Absent** | — | — | — |
| 7 | Separate CDN | **Absent** (Vercel/Next static serving only; `sharp` is in-process, not a CDN) | — | — | — |
| 8 | **Make.com** | **Dead/neutralized** — `/api/router` now always returns 410 Gone, no network call, URL removed from code (P0.2 closure) | historically an automation webhook | — | — |
| 9 | PDF/DOCX generation | **No external service** — hand-written renderers, no puppeteer/react-pdf/pdfkit/jspdf anywhere (`src/lib/pierre/v1/renderers.ts:1-4`); `mammoth`/`pdf-parse`/`xlsx` are in-process file-parsing libs only | Document rendering | N/A |
| 10 | Twilio/SMS | **Absent** — CloneCall is a marketing/catalog entry only, no live telephony code | — | — |

## Note on DPA's already-named list
`src/app/legal/dpa/page.tsx:152-159` already names Supabase Inc., Stripe Inc., Anthropic PBC, Resend Inc., Vercel Inc. as sub-processors (with "clauses contractuelles types applicables") under a section still marked "Placeholder — à compléter" — internally inconsistent (see file 01). Cross-check against this agent's independent code-verification: **Supabase, Stripe, OpenAI (not Anthropic per current code — see discrepancy note below), Resend, Vercel are all confirmed live subprocessors; Anthropic is NOT currently called anywhere in the runtime code for Pierre/CloneChat inference (OpenAI is the sole confirmed LLM provider)** — this is a factual discrepancy between the DPA's named list and the current code that must be corrected or reconciled with the owner before the DPA can be considered accurate (see `SUBPROCESSOR_REGISTER.md` and `LEGAL_REMAINING_RISKS.md`).

## Region/hosting data-residency
Cannot be confirmed from code for ANY of the 5 confirmed providers — all are environment-configured at deploy time. This must come from each provider's actual account/dashboard settings, not the codebase, before the DPA's international-transfer section can be finalized.
