// src/lib/pierre/v1/__integration__/p86-cockpit-error-states.itest.ts
// PHASE 8.6 — the cockpit distinguishes its UX states and NEVER collapses an error into an empty/zero
// view. The overview panel renders distinct loading / error / forbidden states plus the access-decision
// states (onboarding_required / grace / suspended / read_only); the snapshot service throws on a data
// error rather than degrading to zeros (proven functionally in p86-cockpit-real-data).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const panel = readFileSync(resolve(process.cwd(), "src/components/pierre/CockpitGovernedOverview.tsx"), "utf-8");
const snapshot = readFileSync(resolve(process.cwd(), "src/lib/pierre/v1/cockpit-snapshot.ts"), "utf-8");

describe("P8.6 cockpit error/UX states", () => {
  it("the panel renders DISTINCT loading / error / forbidden states", () => {
    expect(panel).toMatch(/kind:\s*"loading"/);
    expect(panel).toMatch(/kind:\s*"error"/);
    expect(panel).toMatch(/kind:\s*"forbidden"/);
    expect(panel).toMatch(/data-cockpit-overview="error"/);
  });
  it("the panel surfaces the access-decision states (onboarding/grace/suspended/read_only)", () => {
    expect(panel).toMatch(/onboarding_required/);
    expect(panel).toMatch(/"grace"/);
    expect(panel).toMatch(/"suspended"/);
    expect(panel).toMatch(/"read_only"/);
  });
  it("a fetch failure becomes an ERROR state, never an empty/zero dashboard", () => {
    // the catch sets an error view; it does NOT setView(ready) with zeros nor swallow into empty.
    expect(panel).toMatch(/catch\s*\{[^}]*setView\(\{\s*kind:\s*"error"/);
    expect(panel).not.toMatch(/catch\s*\{\s*\}/);
  });
  it("the snapshot service does not swallow data errors into zeros/empties", () => {
    // no try/catch around the section queries that returns a degraded value
    expect(snapshot).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*return/);
    expect(snapshot).toMatch(/throw new Error\("active company not found"\)/);
  });
});
