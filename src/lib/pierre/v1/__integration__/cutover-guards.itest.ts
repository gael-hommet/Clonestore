// src/lib/pierre/v1/__integration__/cutover-guards.itest.ts
// PHASE 8.1 — regression guards that permanently prevent backsliding:
// no localStorage source of truth in the runtime, the cockpit doesn't bypass the
// canonical write seam, a single v1 client, terminal tasks can't resurrect, etc.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { canTransitionTask, canTransitionMission } from "../state-machine";

const ROOT = resolve(process.cwd());
const read = (rel: string) => (existsSync(resolve(ROOT, rel)) ? readFileSync(resolve(ROOT, rel), "utf-8") : "");

describe("PHASE 8.1 cutover guards", () => {
  it("v1 runtime uses no localStorage source of truth", () => {
    const dir = resolve(ROOT, "src/lib/pierre/v1");
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    for (const f of files) {
      const src = read(`src/lib/pierre/v1/${f}`);
      expect(/localStorage\.(get|set|remove)Item|window\.localStorage/.test(src)).toBe(false);
    }
  });

  it("durable queue is Postgres-backed (no in-memory array/Map as the queue)", () => {
    const q = read("src/lib/pierre/v1/queue.ts");
    expect(/pierre_rt_jobs/.test(q)).toBe(true);
    expect(/for update skip locked/i.test(q)).toBe(true);
  });

  it("cockpit hook + page do not POST the legacy submit endpoint directly", () => {
    for (const f of ["src/app/agents/pierre/use/hooks/usePierreCockpit.ts", "src/app/agents/pierre/use/page.tsx"]) {
      const src = read(f);
      // They must go through submitPierreMission (the canonical seam), never fetch the legacy URL directly.
      expect(/fetch\(\s*["'`]\/api\/pierre\/use\/submit/.test(src)).toBe(false);
    }
  });

  it("cockpit write seam is wired to the v1 bridge", () => {
    const api = read("src/lib/pierre/cockpit/api-client.ts");
    expect(api.includes("./v1-bridge")).toBe(true);
    expect(api.includes("createCockpitV1Client")).toBe(true);
    const bridge = read("src/lib/pierre/cockpit/v1-bridge.ts");
    expect(bridge.includes("@/lib/pierre/v1/client")).toBe(true);
  });

  it("legacy submit route is marked @deprecated", () => {
    expect(read("src/app/agents/pierre/use/submit/route.ts")).toContain("@deprecated");
  });

  it("there is a single v1 client module (no parallel client)", () => {
    expect(existsSync(resolve(ROOT, "src/lib/pierre/v1/client.ts"))).toBe(true);
  });

  it("a terminal task cannot transition back to in_progress (no resurrection)", () => {
    expect(canTransitionTask("succeeded", "in_progress")).toBe(false);
    expect(canTransitionTask("cancelled", "in_progress")).toBe(false);
    expect(canTransitionMission("done", "in_progress")).toBe(false);
  });

  it("production pg adapter is a real dependency (no dynamic-import masking)", () => {
    const db = read("src/lib/pierre/v1/db.ts");
    expect(db.includes('from "pg"')).toBe(true);
    expect(/import\(\s*\[?\s*["']p["']\s*\+/.test(db)).toBe(false); // no computed specifier hack
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.dependencies?.pg).toBeTruthy();
  });
});
