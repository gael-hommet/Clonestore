# PIERRE DEMO — CONVERSION ANALYTICS

How the `/demo/pierre` experience measures conversion **without adding a new
analytics tool** and **without ever capturing personal data**.

---

## 1. Principle: reuse the first-party funnel

The demo does not introduce a tracker. It maps its own event vocabulary onto the
existing first-party conversion funnel:

```
demo-analytics.ts ──dispatch──▶ CustomEvent("clonestore:b3:demo-step" | "demo-completed")
                                        │
                                        ▼
            DemoEventTracker (layout.tsx) ──▶ emitConversionEvent() ──▶ /api/conversion/events
                                                                        (server allowlist + idempotency)
```

`emitConversionEvent` POSTs to `/api/conversion/events`, which enforces the
contract allowlist (`CLIENT_ALLOWED_EVENT_TYPES`) and metadata rules
(`EVENT_METADATA_ALLOWED` / `EVENT_METADATA_FORBIDDEN`). The demo never bypasses
that boundary.

---

## 2. Demo event vocabulary (`PIERRE_DEMO_EVENTS`)

| Demo event | Fired when | Funnel effect |
|------------|-----------|---------------|
| `pierre_demo_viewed` | page mount | `landing_viewed` (by the tracker) |
| `pierre_demo_started` | journey starts | `demo_started` (by the tracker) |
| `pierre_demo_scenario_selected` | scenario switched | demo step |
| `pierre_demo_mission_submitted` | mission confided | demo step |
| `pierre_demo_plan_revealed` | understanding shown | demo step |
| `pierre_demo_wow_moment_reached` | mission centre reached | demo step |
| `pierre_demo_document_opened` | a document opened | demo step |
| `pierre_demo_message_opened` | messaging reached | demo step |
| `pierre_demo_approval_clicked` | validate / request change | demo step |
| `pierre_demo_technology_opened` | technologies shown | demo step |
| `pierre_demo_completed` | result reached | `demo_completed` |
| `pierre_demo_cta_clicked` | CTA click | `purchase_cta_clicked` / `assistance_cta_clicked` (delegated) |
| `pierre_demo_abandoned` | local only | none (no network) |

Step-like events dispatch `clonestore:b3:demo-step`; the proven tracker
accumulates distinct steps and fires `demo_completed` past its threshold.
CTAs carry `data-conversion-cta` + `data-cta-name`; the tracker delegates clicks.

---

## 3. Allowed properties (no personal data)

`DEMO_PROPERTY_ALLOWED` — the only keys that may leave the browser:

```
scenario_id · step_id · step_index · elapsed_ms · device_family
cta_position · cta_kind · completion_percentage · missions_count
```

`sanitizeDemoProps()` strips everything else, drops keys mirrored from
`EVENT_METADATA_FORBIDDEN` (email, name, salary, candidate, employee, token, …),
keeps only finite numbers / short strings, and caps string length at 40 chars to
prevent free-text leakage. **Never recorded:** free text, email, name, document
content, sensitive values.

Covered by `pierre-demo-analytics.test.ts` (privacy + dispatch) and asserted again
in `pierre-demo-conversion.test.ts` (only documented event names; no personal keys
in tracked metadata).

---

## 4. Experimentation (config-driven, no fake A/B)

Variants are driven by configuration, not scattered code:

- `hero_copy`, `default_scenario`, `mid_demo_cta`, `final_cta_copy`,
  `guided_speed` are natural seams (scenario id, step dwell, CTA copy).

No fake A/B test is launched without real infrastructure; the existing
LeadForge/conversion variant system (`VariantHero` in `layout.tsx`) remains the
source of attributed-traffic variation.

---

## 5. What is intentionally NOT emitted

- No event when SSR/headless (`typeof window === "undefined"`).
- No network call for `pierre_demo_abandoned` (local signal only).
- No raw request text, no document body, no recipient — ever.

---

## 6. Verifying

```
npx vitest run src/lib/pierre/demo/__tests__/pierre-demo-analytics.test.ts
npm run test:pierre-demo-final
```
