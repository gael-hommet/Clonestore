// PIERRE FINAL INTERACTIVE DEMO — analytics privacy tests.
// Runs under the default `node` environment: the dispatch test self-provisions a
// minimal fake `window`/`CustomEvent` (no jsdom dependency required).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PIERRE_DEMO_EVENTS,
  DEMO_PROPERTY_ALLOWED,
  sanitizeDemoProps,
  trackDemoEvent,
  currentDeviceFamily,
} from "../demo-analytics";

describe("pierre-demo analytics — privacy", () => {
  it("event vocabulary is the documented set", () => {
    expect(PIERRE_DEMO_EVENTS).toContain("pierre_demo_started");
    expect(PIERRE_DEMO_EVENTS).toContain("pierre_demo_completed");
    expect(PIERRE_DEMO_EVENTS).toContain("pierre_demo_cta_clicked");
    expect(new Set(PIERRE_DEMO_EVENTS).size).toBe(PIERRE_DEMO_EVENTS.length);
  });

  it("strips forbidden/personal keys and keeps only allow-listed primitives", () => {
    const cleaned = sanitizeDemoProps({
      scenario_id: "semaine_rh",
      completion_percentage: 80,
      // @ts-expect-error — forbidden key must be dropped
      email: "leak@example.com",
      // @ts-expect-error — forbidden key must be dropped
      name: "Jean Dupont",
    });
    expect(cleaned).toHaveProperty("scenario_id", "semaine_rh");
    expect(cleaned).toHaveProperty("completion_percentage", 80);
    expect(cleaned).not.toHaveProperty("email");
    expect(cleaned).not.toHaveProperty("name");
  });

  it("caps long strings (no free-text leakage)", () => {
    const long = "x".repeat(500);
    const cleaned = sanitizeDemoProps({ scenario_id: long });
    expect((cleaned.scenario_id as string).length).toBeLessThanOrEqual(40);
  });

  it("only allow-listed property keys exist", () => {
    const cleaned = sanitizeDemoProps({ scenario_id: "a", step_id: "b", elapsed_ms: 1 });
    for (const k of Object.keys(cleaned)) {
      expect(DEMO_PROPERTY_ALLOWED).toContain(k as never);
    }
  });
});

describe("pierre-demo analytics — dispatch (fake DOM)", () => {
  const events: { type: string; detail: unknown }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  let savedWindow: unknown;
  let savedCustomEvent: unknown;

  beforeEach(() => {
    events.length = 0;
    savedWindow = g.window;
    savedCustomEvent = g.CustomEvent;
    const listeners: Record<string, ((e: unknown) => void)[]> = {};
    g.CustomEvent = class {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
    g.window = {
      innerWidth: 1280,
      addEventListener: (t: string, fn: (e: unknown) => void) => {
        (listeners[t] ||= []).push(fn);
      },
      removeEventListener: () => {},
      dispatchEvent: (e: { type: string }) => {
        (listeners[e.type] || []).forEach((fn) => fn(e));
        events.push({ type: e.type, detail: (e as { detail?: unknown }).detail });
        return true;
      },
    };
  });
  afterEach(() => {
    g.window = savedWindow;
    g.CustomEvent = savedCustomEvent;
  });

  it("step events dispatch a demo-step CustomEvent for the proven tracker", () => {
    trackDemoEvent("pierre_demo_document_opened", { scenario_id: "semaine_rh", step_index: 6 });
    expect(events.some((e) => e.type === "clonestore:b3:demo-step")).toBe(true);
  });

  it("completion dispatches a demo-completed CustomEvent", () => {
    trackDemoEvent("pierre_demo_completed", { completion_percentage: 100 });
    expect(events.some((e) => e.type === "clonestore:b3:demo-completed")).toBe(true);
  });

  it("never throws and reports a device family", () => {
    expect(() => trackDemoEvent("pierre_demo_abandoned")).not.toThrow();
    expect(["mobile", "tablet", "desktop"]).toContain(currentDeviceFamily());
  });
});
