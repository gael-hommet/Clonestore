# Raw finding — Cookies, storage, analytics & CMP inventory

Source: read-only Explore agent, repo-wide grep + targeted reads.

## Server-set cookies (all first-party, HMAC-signed where custom-built)

| Cookie | Flags | TTL | Purpose | Evidence |
|---|---|---|---|---|
| `cs_conversion_session` | HttpOnly; Secure(prod); SameSite=Lax | 7 days | Marketing/partner-campaign attribution (LeadForge) | `src/lib/clonestore/conversion/session.ts:10,28-37`; issued `src/app/p/[token]/route.ts:61,69,96` |
| `cs_owner_gate` | HttpOnly; Secure(prod); SameSite=Strict | 12h | Founder Command Center owner-gate auth | `src/lib/founder-access/signed-cookie.ts:118,125-131,134-137` |
| `cs_founder_reservation` | HttpOnly; Secure(prod); SameSite=Lax | 2h | Proof-of-possession, founder reservation step 2 | `signed-cookie.ts:54,62-68` |
| `cs_analytics_session` | HttpOnly; Secure(prod); SameSite=Lax | 30 days | Server-issued anonymous analytics session (no PII) | `signed-cookie.ts:83,92-101`; `analytics-session.ts:13-18` |
| `cs_pp_ref` | HttpOnly; Secure(prod); SameSite=Lax | 90 days | Partner-program referral attribution | `src/lib/partner-program/server/referral-cookie.ts:7-21` |
| `pierre_e2e_session` | httpOnly; secure:false; SameSite=Lax | 1h | **Test-only**, gated by `guardE2E()`/`PIERRE_E2E_TEST_MODE`, forbidden in prod | `src/lib/pierre/v1/e2e-test-identity.ts:10` |
| Supabase auth cookie(s) (`sb-<ref>-auth-token`) | Library-controlled | JWT/refresh lifetime | Login/session for `/cockpit`, `/mon-clonestore` | `src/middleware.ts:56-67`, `src/lib/supabase-server.ts:16-33`, `src/lib/clonestory/founding-partners/server/auth-onboarding-supabase.ts:42-48` |

`document.cookie` direct client access: **zero matches** anywhere in `src/`.

## localStorage / sessionStorage keys (all first-party UI-state or product-analytics, no third-party trackers)

`cs_anon_sid`, `cs_landing` (sessionStorage, PresencePing/ReservationForm), `cs.pwa.*` (localStorage, PWA install heuristics), `cs.pwa.counted` (sessionStorage dedupe), `cs_b3_diag_session_marker`/`cs_b3_diagnostic_draft_v2` (diagnostic form), `csy.registration.statusToken.v1` (founding-partners join), `cs_b3_emit:<scope>` (conversion event dedupe), `clonestore.clonechat.thread.v1`, `clonestore:appearance`/`clonestore.appearance-settings.v1`, `clonestore.cloneos.commandHistory.v1`, `clonestory.foundingPartners.introSeen.v1`, `clonestore:pierre:cockpit:b31:v1`, `clonestore.runtimeMissionDrafts.local.v1` (+lastPreview), `clonestore.runtimeControlledMissions.local.v1` (+lastPreview), `clonestore.globalOnboarding.draft.v1`, `clonestore.enterpriseFootprint.snapshot.v1`.

## Third-party analytics/marketing/A-B/session-replay — ALL CONFIRMED ABSENT
Grepped case-insensitively for: posthog, mixpanel, gtag, google-analytics, segment, plausible, clarity, hotjar, fullstory, LinkedIn insight tag, fbq/Meta pixel, TikTok pixel, growthbook/optimizely/launchdarkly/split.io/statsig, logrocket/smartlook — **zero matches for every one.** Root layout only injects `application/ld+json` Organization schema, no tracking `<script>`.

## Stripe.js
**Not loaded client-side anywhere** — no `@stripe/stripe-js` dependency, no `loadStripe()` call. Checkout uses the server-side redirect flow (`stripe.checkout.sessions.create` → `session.url` → browser redirect to Stripe's own hosted page). Any `__stripe_mid`/`__stripe_sid` cookies would be set by Stripe on Stripe's own domain, not this app.

## Cookie-consent / CMP — CONFIRMED ZERO
Searched `src/components` and `src/app` for consent/CMP/cookie-banner/cookiebot/onetrust patterns — **no matching component exists.** The legal copy itself (`mentions/page.tsx:129-139`) already flags this gap as unresolved ("une bannière de consentement peut être requise selon la réglementation applicable").

## Demo telemetry & founder-access event system
- `src/lib/demo/presentation/analytics.ts` — confirmed zero network calls (in-browser only, `window.__cloneDemoAnalytics` array + CustomEvent).
- Founder-access events: backed by both `cs_analytics_session` (server-trusted cookie) AND a separate `sessionStorage cs_anon_sid` (client heartbeat) — a known duplication, unchanged. IPs are SHA-256-hashed with salt, never stored raw (`request-utils.ts:7-12`).

## Overall conclusion
No third-party analytics, ad-tech, A/B-testing, or session-replay vendor integrated anywhere. Every cookie/storage key is first-party and either strictly necessary (auth, security, fraud/rate-limiting, billing attribution) or first-party UX-state. **The compliance gap is not a hidden tracker — it is the complete absence of a consent/CMP layer**, despite the 7-day/30-day/90-day attribution/analytics cookies being set pre-consent, and the legal pages already acknowledging this as unresolved.
