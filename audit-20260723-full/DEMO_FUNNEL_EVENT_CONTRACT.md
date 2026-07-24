# Demo Funnel Event Contract

This block does **not** unify the 3 pre-existing analytics systems (that unification is explicitly the next block, ANALYTICS FUNNEL AND LAUNCH MEASUREMENT CLOSURE). It documents the mapping between the master prompt's requested canonical event names and what already exists, and adds only the 3 new events this block's own feature needs.

## Identifiers (exact names, as they exist in code — none invented)
| Concept | Actual identifier | Where |
|---|---|---|
| Server-trusted anonymous session | `cs_analytics_session` (HttpOnly signed cookie, 30-day TTL) | `src/lib/founder-access/signed-cookie.ts` |
| Client-side session id (generated, but ignored server-side) | `cs_anon_sid` (sessionStorage, 2 separate un-shared implementations) | `PresencePing.tsx`, `ReservationForm.tsx` |
| Conversion-attribution session (BLOC3) | `cs_conversion_session` (HttpOnly signed cookie, 7-day TTL) | `src/lib/clonestore/conversion/session.ts` |
| `visitor_id` (long-lived) | **Does not exist.** No cross-session persistent identity anywhere. | — |
| `demo_run_id` / `page_view_id` | **Do not exist as typed identifiers.** Occurrences are events timestamped against a session id, not their own entity. | — |
| `internal_traffic` / `test_traffic` flag | **Does not exist anywhere** (confirmed by exhaustive grep across founder-access and conversion tables/code). | — |

## Mapping — master-prompt-requested name → existing canonical event (no duplicate created)
| Requested (master prompt) | Existing canonical equivalent | Status |
|---|---|---|
| `homepage_viewed` | `site_viewed` (founder-access, already fired via `<PresencePing event="site_viewed" />` on `page.tsx`) | Mapped, no new event |
| `homepage_demo_prompt_seen` | **New** — added this block | Created |
| `homepage_demo_prompt_clicked` | **New** — added this block | Created |
| `homepage_demo_prompt_dismissed` | **New** — added this block (master prompt's list didn't explicitly name this one, but Phase 7's own "seen, clicked, dismissed dédupliqué" requirement does) | Created |
| `homepage_scrolled_to_proof` / `homepage_scrolled_to_footer` | Not implemented — would require new IntersectionObserver wiring on homepage sections; out of this block's narrow scope, no proven need found | Not implemented, documented gap |
| `demo_viewed` / `demo_started` / `demo_completed` | Already exist verbatim in `CLIENT_ANALYTICS_EVENTS` (founder-access) and in BLOC3's `EVENT_TYPES` | Already canonical, unchanged |
| `demo_first_proof_seen` / `demo_interaction_started` / `demo_value_input_changed` / `demo_chapter_completed` | Not implemented as named events — the demo's own `DEMO_EVENTS` (local, non-persisted) and BLOC3's `demo_step_viewed` cover overlapping ground under different names | Mapped conceptually, not renamed (renaming live, canonical event names is a bigger, riskier change than this block's scope) |
| `demo_pierre_cta_seen` / `demo_pierre_cta_clicked` | `DEMO_EVENTS.pierreCtaSeen`/`pierreCtaClicked` (local) already exist | Already canonical, unchanged |
| `pierre_demo_viewed` / `pierre_demo_started` / `pierre_demo_completed` | Already exist verbatim in `CLIENT_ANALYTICS_EVENTS` | Already canonical, unchanged |
| `pierre_demo_commercial_cta_seen` / `_clicked` | `data-conversion-cta="purchase"` delegated click handler already exists (`DemoEventTracker.tsx`), firing `purchase_cta_clicked` (BLOC3) + `founder_cta_clicked` (founder-access) | Mapped, not renamed |
| `reservation_started` / `reservation_submitted` | Exist as founder-access server-truth events (`founder_reservation_created`, etc.) under different names | Mapped, not renamed |
| `checkout_started` / `checkout_redirected` / `payment_confirmed` | Already canonical from Payment Path Closure — **explicitly not touched**, per this block's instruction not to modify Payment Path's event names | Untouched |

## New events added by this block (closed enum, `src/lib/founder-access/types.ts::CLIENT_ANALYTICS_EVENTS`)
```
"homepage_demo_prompt_seen",
"homepage_demo_prompt_clicked",
"homepage_demo_prompt_dismissed",
```
Emitted via the existing `emitFounderEvent()` (real, server-persisted path — `sendBeacon` to `/api/founder-access/funnel`), never via the non-persisted BLOC3 layer (which this block's audit found to be a silent no-op for organic traffic in production — see `DEMO_REMAINING_RISKS.md`).

## Deduplication rules (for the 3 new events)
- `homepage_demo_prompt_seen`: fires once per mount, guarded by a `useRef` boolean flipped to `true` on first fire — verified by code review (`src/components/home/DemoContextualPrompt.tsx`); not re-triggerable by a StrictMode remount within the same component instance's lifetime, matching this codebase's established `emitDemoEvent({once:true})` convention in spirit.
- `homepage_demo_prompt_clicked` / `_dismissed`: fire only inside a real `onClick` handler, never on mount, never on scroll.
- No PII: `FounderEventMeta` for these 3 events carries only `{landingPath: pathname}` — a fixed pathname string, never user input, never free text.

## What remains explicitly unresolved (next block's scope)
Triple-firing for the same conceptual demo action (3 independent systems), BLOC3's dead persistence for organic traffic, absent internal/test-traffic filter, `cs_anon_sid` being generated but ignored server-side — all documented in `DEMO_REMAINING_RISKS.md`, none fixed here, all explicitly deferred to ANALYTICS, FUNNEL AND LAUNCH MEASUREMENT CLOSURE.
