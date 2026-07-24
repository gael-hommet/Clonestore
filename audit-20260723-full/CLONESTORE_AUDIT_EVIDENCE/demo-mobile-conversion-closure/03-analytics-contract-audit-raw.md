# Raw finding — Analytics and conversion contract audit

Source: read-only Explore agent, direct Grep/Read across `src/lib/demo/presentation/analytics.ts`, `src/lib/founder-access/**`, `src/lib/clonestore/conversion/**`.

## Three independent, non-unified systems

1. **`demo/presentation/analytics.ts`** — confirmed zero network calls (local array + CustomEvent only). 21 event names (`DEMO_EVENTS`). Dedup: module-level `Set`, opt-in per call (`{once:true}`) — every current call site uses it, so no StrictMode double-fire in practice.
2. **`founder-access`** — the REAL, server-persisted system. `CLIENT_ANALYTICS_EVENTS` (23 names incl. `demo_completed`, `pierre_demo_completed` verbatim) vs `SERVER_FUNNEL_EVENTS` (server-truth only, client-submitted attempts rejected 422). Tables: `clonestore_web_sessions`, `clonestore_web_events`, `clonestore_founder_funnel_events` — **none have an internal/test-traffic flag column.**
3. **`clonestore/conversion` (BLOC3/LeadForge)** — canonical `EVENT_TYPES` contract + real client dedup (`cs_b3_emit:<scope>` sessionStorage key, exactly as documented) + server-side idempotency-key dedup. **Critical finding: the persistence backend is a dev-only in-memory stub — no `runtime_pg` backend is implemented anywhere.** In production, absent a test-injected backend, every `emitConversionEvent()` call from the demo funnel is a live network POST the server silently drops (`204`, no persistence). Additionally, `cs_conversion_session` is only ever issued on `/p/[token]` (LeadForge attribution links), never on `/demo`/`/demo/pierre` — so for an ordinary organic visitor, this whole layer is inert today.

## Identifiers (exact names, no invented terminology)
`cs_anon_sid` (client sessionStorage, generated in 2 separate un-shared implementations, sent to the server but **explicitly ignored** — server always uses its own signed cookie instead) · `cs_analytics_session` (server HttpOnly signed cookie, 30-day TTL — the REAL persisted `anonymous_session_id`) · `cs_conversion_session` (server HttpOnly signed cookie, 7-day TTL, BLOC3-only) · `cs_landing` (client sessionStorage, raw landing path). No cross-session persistent `visitor_id` exists anywhere — everything expires in 7-30 days unless a `reservation_id`/`user_id` later attaches.

## No internal/test/staff traffic filter exists anywhere
Confirmed by exhaustive grep (`internal_traffic`, `is_test`, `is_staff`, etc. — zero matches in either analytics system). Genuine, pre-existing gap; not something this block's contract consolidation attempts to retrofit (would require new DB columns/migration, out of this block's scope — documented as a remaining risk).

## Confirmed triple-fire for the same conceptual action
`DemoExperience.tsx`'s `markDemoCompleted()` (and equivalently `landing_viewed`/`demo_started`) fires through **all three systems simultaneously** for one user action: `emitDemoEvent` (local-only), `emitConversionEvent` (network POST, currently a no-op in prod per above), `emitFounderEvent` (the one durably persisted). This is real triplication, not a false alarm — but reducing it is a larger architectural change than this block's scope; documented as a finding/recommendation (consolidate around `emitFounderEvent` as the single source of truth for anything that must be durably measured), not executed as a rewrite in this block.

## PII risk (with active defenses)
Founder-access has a dedicated `PII_RE` filter (`privacy.ts`) applied centrally to every ingestion route. BLOC3 has its own defense-in-depth (`EVENT_METADATA_FORBIDDEN`, `cleanEventMetadata()` regex rejecting `@`/long-digit-strings even on allowlisted keys). One structural risk flagged: `DemoEventTracker.tsx`'s cockpit step-tracker captures raw button `textContent` (truncated to 60 chars) as metadata when no `data-step-id` exists — free text, not a closed enum, though currently only developer-authored UI copy (low practical risk today, worth tightening before reuse elsewhere).

## Visibility ("seen") tracking already exists — reused for the new prompt
`useSceneView.ts` wraps Framer Motion's `useInView({once:true, amount:0.4})` — the established "seen once" primitive across `/demo`'s acts. **This block's new `DemoContextualPrompt` deliberately does NOT reuse `useSceneView`** (its trigger is a scroll-depth ratio matching `DemoExperience.tsx`'s own `depth()` idiom, since the prompt lives on the homepage, not inside a `/demo` "scene" — `useSceneView` is demo-route-specific tooling) but the "seen fires once, real signal, not on mount" discipline is followed identically.
