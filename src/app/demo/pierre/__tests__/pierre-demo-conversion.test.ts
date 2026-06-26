// PIERRE FINAL INTERACTIVE DEMO — conversion + journey tests.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  GUIDED_STEPS, isLastStep, nextStepIndex, getDefaultScenario, DEMO_SCENARIOS,
  PIERRE_DEMO_EVENTS,
} from "@/lib/pierre/demo";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const experience = read("src/components/pierre/demo/PierreDemoExperience.tsx");
const finalCta = read("src/components/pierre/demo/DemoFinalCTA.tsx");
const midCta = read("src/components/pierre/demo/ConversionMoment.tsx");

describe("pierre-demo conversion — guided journey", () => {
  it("the guided journey always terminates on the result step", () => {
    let i = 0;
    for (let guard = 0; guard < 50 && !isLastStep(i); guard++) i = nextStepIndex(i);
    expect(GUIDED_STEPS[i].id).toBe("result");
  });

  it("the recommended scenario is the default and unique", () => {
    expect(getDefaultScenario().recommended).toBe(true);
    expect(DEMO_SCENARIOS.filter((s) => s.recommended).length).toBe(1);
  });

  it("offers exactly three scenarios", () => {
    expect(DEMO_SCENARIOS.length).toBe(3);
  });
});

describe("pierre-demo conversion — CTAs", () => {
  it("final CTA exposes a purchase + a discover conversion CTA to real routes", () => {
    expect(finalCta).toMatch(/data-conversion-cta="purchase"/);
    expect(finalCta).toMatch(/data-conversion-cta="assistance"/);
    expect(finalCta).toContain("DEMO_CTA_DESTINATIONS.reserve");
    expect(finalCta).toContain("DEMO_CTA_DESTINATIONS.discover");
  });

  it("mid-demo CTA is dismissible and does not auto-interrupt", () => {
    expect(midCta).toMatch(/onContinue/);
    expect(midCta).toMatch(/data-conversion-cta="purchase"/);
  });

  it("the experience renders both the mid CTA and the final CTA", () => {
    expect(experience).toContain("ConversionMoment");
    expect(experience).toContain("DemoFinalCTA");
  });
});

describe("pierre-demo conversion — analytics wiring", () => {
  it("the experience tracks demo lifecycle events", () => {
    for (const ev of ["pierre_demo_started", "pierre_demo_mission_submitted", "pierre_demo_wow_moment_reached", "pierre_demo_completed"]) {
      expect(experience).toContain(ev);
    }
  });

  it("only documented event names are emitted from the experience", () => {
    const emitted = [...experience.matchAll(/trackDemoEvent\(\s*["'`](pierre_demo_[a-z_]+)["'`]/g)].map((m) => m[1]);
    expect(emitted.length).toBeGreaterThan(0);
    for (const e of emitted) expect(PIERRE_DEMO_EVENTS).toContain(e as never);
  });

  it("tracked metadata never includes personal keys", () => {
    expect(experience).not.toMatch(/trackDemoEvent\([^)]*\b(email|name|salary|candidate|employee)\b/);
  });
});
