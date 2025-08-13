// PIERRE ZERO-SCROLL DEMO PLAYER — conversion + analytics tests.
// The data-engine invariants are unchanged; the CTA + analytics assertions were
// repointed from the old <PierreDemoExperience/> to the new player tree.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  GUIDED_STEPS, isLastStep, nextStepIndex, getDefaultScenario, DEMO_SCENARIOS,
  PIERRE_DEMO_EVENTS,
} from "@/lib/pierre/demo";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
function playerFiles(): string[] {
  const dir = join(ROOT, "src/components/pierre/demo/player");
  return (readdirSync(dir, { recursive: true }) as unknown as string[])
    .filter((f) => /\.tsx?$/.test(String(f)) && !String(f).includes("__tests__"))
    .map((f) => join("src/components/pierre/demo/player", String(f)));
}
const TREE = [read("src/app/demo/pierre/page.tsx"), ...playerFiles().map(read)].join("\n\n");

describe("pierre-demo conversion — data-engine invariants", () => {
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
  it("the player exposes a purchase CTA and an assistance CTA to real routes", () => {
    expect(TREE).toMatch(/data-conversion-cta="purchase"/);
    expect(TREE).toMatch(/data-conversion-cta="assistance"/);
    expect(TREE).toContain("DEMO_CTA_DESTINATIONS.reserve");
    expect(TREE).toContain("DEMO_CTA_DESTINATIONS.discover");
  });

  it("a permanent reserve CTA sits in the chrome (always reachable, no scroll needed)", () => {
    const chrome = read("src/components/pierre/demo/player/DemoChrome.tsx");
    expect(chrome).toMatch(/data-conversion-cta="purchase"/);
    expect(chrome).toContain("Réserver Pierre");
  });

  it("the close scene carries the dominant reserve CTA + the Explorer entry", () => {
    const close = read("src/components/pierre/demo/player/scenes/Scene6CommercialClose.tsx");
    expect(close).toMatch(/data-conversion-cta="purchase"/);
    expect(close).toContain("Explorer Pierre en détail");
  });
});

describe("pierre-demo conversion — analytics wiring", () => {
  it("the player tracks the natural demo lifecycle events", () => {
    for (const ev of [
      "pierre_demo_started",
      "pierre_demo_mission_submitted",
      "pierre_demo_plan_revealed",
      "pierre_demo_wow_moment_reached",
      "pierre_demo_approval_clicked",
      "pierre_demo_document_opened",
      "pierre_demo_completed",
      "pierre_demo_cta_clicked",
    ]) {
      expect(TREE, ev).toContain(ev);
    }
  });

  it("only documented event names are emitted from the player", () => {
    const emitted = [...TREE.matchAll(/trackDemoEvent\(\s*["'`](pierre_demo_[a-z_]+)["'`]/g)].map((m) => m[1]);
    expect(emitted.length).toBeGreaterThan(0);
    for (const e of emitted) expect(PIERRE_DEMO_EVENTS).toContain(e as never);
  });

  it("no new analytics tracker is introduced by the player", () => {
    // The player must reuse trackDemoEvent — not stand up a second tracker.
    expect(TREE).not.toMatch(/new\s+CustomEvent\(\s*["']clonestore:b3:/);
    expect(TREE).not.toMatch(/window\.gtag|analytics\.track\(/);
  });

  it("tracked metadata never includes personal keys", () => {
    expect(TREE).not.toMatch(/trackDemoEvent\([^)]*\b(email|name|salary|candidate|employee)\b/);
  });
});
