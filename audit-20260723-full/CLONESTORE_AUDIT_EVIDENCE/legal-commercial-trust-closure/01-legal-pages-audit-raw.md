# Raw finding — Legal pages full content audit

Source: read-only Explore agent, full reads of all 5 `/legal/*` pages + shared components + footer + checkout/signup/founding-partners/reservation/partner acceptance flows.

## `/legal/mentions`
- `mentions/page.tsx:2` — `// DRAFT — À faire valider par un conseil juridique avant usage contractuel.`
- `LegalValidationBanner version="Draft 1.0"` at L33 and L187; `LegalHero` "Draft — validation juridique requise" pill.
- Placeholders (all wrapped in amber boxes, none filled): éditeur (L39, L44-48 — no company name/legal form/capital/address/SIREN/SIRET/RCS/VAT anywhere), directeur de publication (L53, 55-58), hébergement (L63, 66-70 — only hints at Vercel/Supabase/Stripe as examples, not confirmed), contact (L78-82), cookies (L131, 136-140 — explicitly notes a consent banner "peut être requise"), droit applicable et médiation (L145, 149-153), signalement DSA (L177-182).
- Substantive/present: §5 IP (85-103), §6 GDPR rights summary (107-127) deferring to Privacy/DPA, §9 liability limitation incl. explicit "Pierre n'est pas un avocat, un expert-comptable, ni un logiciel de paie certifié" (156-173).
- **No SIREN/SIRET/TVA/RCS/address/contact anywhere in the file.**

## `/legal/cgv`
- DRAFT marker L2, banners L34/L222.
- Placeholders: TVA et taxes (99-102, deferred to legal/fiscal counsel), remboursement (119-123, deferred + statutory withdrawal-right question unresolved), limitation de responsabilité (182-186, capped at 3 months of fees — deferred to validation), droit applicable (205-209, deferred to "juridiction de l'éditeur" — itself unresolved since editor identity is blank).
- Concrete/present: 449€/mois HT monthly auto-renew via Stripe (27, 40-47, 57-61); founder pricing note (64-68); free demo clause — not production access, no real data, no 7-day trial, interruptible (71-86); billing/invoices in client space, HT + applicable VAT (88-103); renewal/cancellation, no prorata refund by default (105-115); scope included vs. **§8 explicit exclusions**: legal/accounting advice, official payroll software, DSN filing, guarantee of legal compliance, replacement of HR/legal/accounting professional (133-166); price-change 30-day notice (168-177); force majeure (195-201).

## `/legal/cgu`
- DRAFT marker L2, banners L34/L210.
- Only one placeholder block: droit applicable et juridiction (188-197) — deferred, least placeholder-heavy of the 5 pages.
- Substantive: product description explicitly denies being a law firm/official payroll software/accountant/regulatory advisor (38-54); §4 "Limites de l'IA et responsabilité humaine" — never autonomously terminates/sanctions, never issues official payslips/DSN, drafts require human validation, no compliance guarantee, no autonomous email send (81-97); sensitive HR data handling triggers mandatory human validation (99-113); prohibited uses (115-126); availability disclaimer (130-143); suspension/termination (145-154); modification clause (177-184).

## `/legal/confidentialite` — structural outlier
- Does **not** import `../_shared/legal-components` at all (own local components) — confirmed by full read, lines 1-551, before this block's fix.
- **No `LegalValidationBanner`, no draft pill, no `LegalNavBar`** — the only one of the 5 legal pages with zero draft/review marker despite depending on the same unresolved identity (§1, 283-296, defers data-controller identity to `mentions`, which has none).
- Content present but generic: data categories (298-315), purposes (341-355), legal bases (357-368), AI functioning/limits (370-383), sub-processors — only generic language, no named list unlike DPA (387-414), retention — no concrete duration (436-448), cookies — generic categories, no names/durations/consent mechanism (450-465), GDPR rights list (467-488).
- **Fixed in this block**: `LegalNavBar` + `LegalValidationBanner version="Draft 1.0"` (top and bottom) added, importing the same shared components as the other 4 pages, without touching substantive content.

## `/legal/dpa`
- DRAFT marker L2, banners L34/L248.
- Placeholders: §7 sous-traitants ultérieurs (147-151) labeled "to complete" **but the list is actually filled in** (152-159): Supabase Inc. (DB/auth, USA), Stripe Inc. (payments, USA), Anthropic PBC (AI processing for Pierre, USA), Resend Inc. (email, USA), Vercel Inc. (hosting, USA) — internally inconsistent (named vendors under a "placeholder" label). §8 transferts internationaux (169-175, unvalidated SCC language, all vendors US-based). §9 mesures de sécurité (191-194, "annex must be attached and validated"). §13 contact DPO (235-243, no DPO identity anywhere).
- Substantive: parties/roles (38-53), sensitive data categories only if explicitly transmitted by client, client bears sole responsibility for legal basis (78-99), retention (112-125), processor obligations (127-141), concrete security measures (178-189: TLS, RLS via Supabase, audit trail, per-client `company_id` isolation, Supabase Auth, periodic review), breach notification (197-209), audit cooperation (224-231).

## Shared components (`legal-components.tsx`)
- `LegalValidationBanner({version})`: "Version {version} — à faire valider par un conseil juridique... CloneStore n'est pas un cabinet juridique. Ce contenu n'est pas un avis juridique."
- `LegalHero`: fixed "Draft — validation juridique requise" pill.
- `LegalNavBar`: cross-links to all 5 legal pages.

## Footer (before this block's fix)
- `site-footer.tsx` only linked `/legal/confidentialite` + `/questions` — **CGV/CGU/DPA/mentions were unreachable from the global footer.** Fixed in this block (see file 10).

## Checkout / signup / onboarding acceptance (before this block's fix)
- `/checkout`: passive text link to CGV/confidentialité, **no checkbox**, not gating the purchase button; server (`api/checkout/route.ts`) recorded no acceptance version/date anywhere. **Fixed in this block** (see file 10).
- `/signup`: **zero legal reference at all** — plain email/password/company form via `supabase.auth.signUp()`. **Fixed in this block.**
- `/founding-partners/join`: real required unchecked checkbox linking to its own `/founding-partners/conditions` page; server rejects (422) if unchecked, but **acceptance itself is not persisted** (no `accept_terms`/version/timestamp column written) — separate CloneStory workstream, left as a documented remaining risk, not fixed in this block (out of the strict Pierre-checkout scope this block targets).
- `/reserver/pierre`: passive privacy link only, no checkbox — informational, not a purchase gate (no payment created at reservation time) — left as-is, lower priority than checkout itself.
- `/partenaires` contract acceptance: the **one flow that already does this correctly** — `contract_accepted_at` + `contract_version` (`CONTRACT_VERSION = "cf-2026-07"`) persisted server-side, idempotent, plus confirmation email. Used as the reference pattern for the checkout fix in this block.
