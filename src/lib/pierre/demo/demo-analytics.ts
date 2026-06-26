// src/lib/pierre/demo/demo-analytics.ts
// PIERRE FINAL INTERACTIVE DEMO — privacy-safe analytics abstraction.
//
// We do NOT introduce a new analytics tool. This layer maps the demo's event
// vocabulary onto the existing first-party conversion funnel: it dispatches the
// CustomEvents the proven DemoEventTracker already listens for
// (`clonestore:b3:demo-step` / `clonestore:b3:demo-completed`), so the server-
// side allowlist and idempotency stay authoritative.
//
// PRIVACY: only enumerable / numeric properties are ever emitted. Free text,
// emails, names, document content and any sensitive value are stripped.

export const PIERRE_DEMO_EVENTS = [
  "pierre_demo_viewed",
  "pierre_demo_started",
  "pierre_demo_scenario_selected",
  "pierre_demo_mission_submitted",
  "pierre_demo_plan_revealed",
  "pierre_demo_wow_moment_reached",
  "pierre_demo_document_opened",
  "pierre_demo_message_opened",
  "pierre_demo_approval_clicked",
  "pierre_demo_technology_opened",
  "pierre_demo_completed",
  "pierre_demo_cta_clicked",
  "pierre_demo_abandoned",
] as const;
export type PierreDemoEvent = (typeof PIERRE_DEMO_EVENTS)[number];

/** Property keys we allow to leave the browser (all non-personal). */
export const DEMO_PROPERTY_ALLOWED = [
  "scenario_id",
  "step_id",
  "step_index",
  "elapsed_ms",
  "device_family",
  "cta_position",
  "cta_kind",
  "completion_percentage",
  "missions_count",
] as const;
export type DemoPropertyKey = (typeof DEMO_PROPERTY_ALLOWED)[number];

/** Mirror of the conversion contract's forbidden metadata — defense in depth. */
const FORBIDDEN_PROPERTY_KEYS = new Set([
  "api_key", "body", "candidate", "card", "cvv", "email", "email_body", "employee",
  "html_body", "iban", "ip", "name", "password", "salary", "secret", "siren",
  "text_body", "token", "user_agent",
]);

export type DemoEventProps = Partial<Record<DemoPropertyKey, string | number>>;

/**
 * Keep only allowlisted, non-forbidden, primitive (string|number) properties.
 * Strings are length-capped to avoid accidental free-text leakage.
 */
export function sanitizeDemoProps(props: DemoEventProps | undefined): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) {
    if (FORBIDDEN_PROPERTY_KEYS.has(k)) continue;
    if (!(DEMO_PROPERTY_ALLOWED as readonly string[]).includes(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 40);
  }
  return out;
}

/** Step-like events that should advance the conversion funnel as a "demo step". */
const STEP_EVENTS: ReadonlySet<PierreDemoEvent> = new Set<PierreDemoEvent>([
  "pierre_demo_scenario_selected",
  "pierre_demo_mission_submitted",
  "pierre_demo_plan_revealed",
  "pierre_demo_wow_moment_reached",
  "pierre_demo_document_opened",
  "pierre_demo_message_opened",
  "pierre_demo_approval_clicked",
  "pierre_demo_technology_opened",
]);

function deviceFamily(width: number): "mobile" | "tablet" | "desktop" {
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export function currentDeviceFamily(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  return deviceFamily(window.innerWidth || 1280);
}

/**
 * Emit a demo event. SSR-safe and never throws. Step-like events are forwarded
 * to the existing tracker via CustomEvent; completion fires the completed event;
 * CTA clicks are already captured by the tracker's [data-conversion-cta]
 * delegation, so we only annotate them locally.
 */
export function trackDemoEvent(event: PierreDemoEvent, props?: DemoEventProps): void {
  if (typeof window === "undefined") return;
  const safe = sanitizeDemoProps(props);
  try {
    if (STEP_EVENTS.has(event)) {
      window.dispatchEvent(
        new CustomEvent("clonestore:b3:demo-step", {
          detail: { demo_step: event.replace(/^pierre_demo_/, ""), step: safe.step_index, ...safe },
        }),
      );
    } else if (event === "pierre_demo_completed") {
      window.dispatchEvent(new CustomEvent("clonestore:b3:demo-completed", { detail: safe }));
    }
    // pierre_demo_viewed / started are emitted by the tracker on mount + first
    // interaction; CTA clicks are delegated by the tracker. Nothing else to send.
  } catch {
    // best-effort, never disrupt the experience
  }
}
