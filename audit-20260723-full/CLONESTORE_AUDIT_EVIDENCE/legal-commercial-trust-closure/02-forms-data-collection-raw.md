# Raw finding — Forms and data collection inventory

Source: read-only Explore agent.

| Flow | Page/API | Fields | Destination | Sensitive |
|---|---|---|---|---|
| Signup | `src/app/signup/page.tsx` → `supabase.auth.signUp()` direct (no custom route) | fullName, companyName, email, password | Supabase Auth `auth.users` | No |
| Login | `src/app/login/page.tsx` → Supabase Auth direct | email+password or magic link | Supabase Auth session | No |
| Contact form | Does not exist as a dedicated form | — | — | N/A |
| Demo request | `/demo/pierre` is 100% static/illustrative, explicitly "aucune donnée n'est enregistrée"; all CTAs route to `/reserver/pierre` | — | — | N/A |
| Founder reservation | `src/app/reserver/pierre/ReservationForm.tsx` → `POST /api/founder-access/reservations` (+ optional PATCH qualification) | email, company_name, company_size, honeypot, UTM/tracking, server-derived ip_hash/UA; step 2: full_name, role, **primary_hr_need (free text)**, sector, website, phone | Real Postgres `clonestore_founder_reservations` + funnel/email-job tables (production) | Low by design; `primary_hr_need` free text could contain volunteered sensitive info |
| Partner signup/onboarding | `src/app/partenaires/page.tsx` → `POST /api/partners/apply`; financial onboarding `POST /api/partners/connect/onboard` | cabinetName, names, email, country, cabinetType, phone, website, clientsCountBucket, services, message, consentContact, consentPrivacy, honeypot | Real Postgres `clonestore_pp_applications` → `clonestore_pp_partners`; bank/KYC via Stripe Connect's own hosted onboarding (not stored in CloneStore DB) | `message` free text only |
| Newsletter | **Not a real feature** — zero hits in code or privacy policy; no policy/reality mismatch | — | — | N/A |
| Pierre onboarding wizard | `src/app/profile/onboarding/page.tsx` + `/api/pierre/v1/onboarding/**` | company_name, industry, size, humans, documents, rules | **Mostly localStorage only** — server sync gated behind `NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED` / enterprise-footprint flag, **both default false** | Only if flags flipped on |
| Real HR record store | `src/lib/pierre/v1/employees.ts` (`EmployeeRepo`) | full employee record incl. contract/absence/termination dates, `sensitivity` tag, `retention_until`/`legal_hold`/`anonymized_at` (GDPR fields already built-in) | Real Postgres `pierre_rt_employees` + contracts/absences/documents/events/employments | **Yes — this is the live production HR system** |
| Free-text Pierre mission channel | Any HR mission/chat prompt → `cloneguard.ts`, `cognitive-analyzer.ts`, `sensitive-floor.ts` | Free-text HR requests | Mission/analysis records | **Yes — explicit detection** of medical/protected-characteristic/disciplinary/harassment/whistleblower keywords; this is the largest Art.9-adjacent surface, and it is unbounded free text, not a constrained field |
| Checkout | `POST /api/checkout` (Bearer-authenticated) | user_id (from token only), agent_slug, optional founder_reservation_id/referral touch_key | Stripe session; CloneStore DB stores only Stripe IDs/status | No — billing name/address/VAT fully offloaded to Stripe's own hosted Checkout (`billing_address_collection:"required"`, `customer_update:{address:"auto",name:"auto"}`) |
| Support | `src/app/questions/page.tsx` (static FAQ) + CloneChat assistant | Free-text chat | Chat/mission history | Same free-text risk as above |

## Key takeaways
1. No dedicated contact form, no newsletter — privacy policy makes no claim of either, so no policy/reality mismatch there.
2. Signup/login bypass the app's own backend entirely (straight to Supabase Auth).
3. Founder reservation + partner application are the two real, always-server-side lead-capture forms, with IP hashing/honeypot/rate-limiting already in place.
4. `/profile/onboarding` is a false flag by default — localStorage-only unless flags are explicitly flipped.
5. **The real sensitive-data surface is `pierre_rt_employees` + the free-text Pierre mission channel**, not any marketing form. Detection logic for GDPR Art. 9 categories and disciplinary/whistleblower content already exists (see file 05).
6. Checkout billing PII is fully offloaded to Stripe — favorable data-minimization posture, confirmed unchanged by this block's checkout fix (only acceptance metadata was added, not new PII fields).
