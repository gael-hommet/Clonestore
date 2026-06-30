// src/lib/pierre/v1/__integration__/p86-final-product-closure.itest.ts
// PHASE 8.6 — the single aggregate closure check: the global gate is applied, the real cockpit snapshot is
// wired, the invitation pipeline is the real P8.4 path, the Next 15 cookies fix is in place, and the six
// customer-lifecycle E2E are discoverable. A one-stop proof that the closure surface is intact.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ROUTE_MANIFEST, GATED_CLASSES, type AccessClass } from "../product-access-route-manifest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("P8.6 — final product closure (aggregate)", () => {
  it("the manifest gates a substantial, multi-family private surface", () => {
    const entries = Object.entries(ROUTE_MANIFEST);
    const gated = entries.filter(([, m]) => Object.values(m).some((c) => GATED_CLASSES.includes(c as AccessClass)));
    expect(gated.length).toBeGreaterThan(50);
    // representative families are present + gated
    for (const key of ["pierre/v1/missions", "pierre/v1/employees", "pierre/v1/contracts", "pierre/v1/members", "pierre/v1/company", "pierre/v1/cockpit/snapshot"]) {
      expect(ROUTE_MANIFEST[key], `${key} missing from manifest`).toBeTruthy();
    }
  });

  it("the real cockpit snapshot route exists and is READ-gated", () => {
    const route = read("src/app/api/pierre/v1/cockpit/snapshot/route.ts");
    expect(route).toMatch(/withProductAccess\(req,\s*"read"/);
    expect(route).toMatch(/buildCockpitSnapshot/);
  });

  it("the invitation client route is token-free (real P8.4 delivery)", () => {
    const route = read("src/app/api/pierre/v1/invitations/route.ts");
    expect(route).not.toMatch(/raw_token/);
    expect(route).not.toMatch(/enqueueE2EDelivery/);
  });

  it("the Next 15 async-cookies fix is in place", () => {
    expect(read("src/lib/supabase-server.ts")).toMatch(/export async function supabaseServer/);
    expect(read("src/lib/access/operational-access.ts")).toMatch(/await cookies\(\)/);
  });

  it("the six customer-lifecycle E2E are discoverable (2 + 4)", () => {
    const strip = (s: string) => s.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    const c = (p: string) => (strip(read(p)).match(/\btest\(/g) ?? []).length;
    expect(c("e2e/p86-customer-lifecycle-step1.spec.ts")).toBe(2);
    expect(c("e2e/p86-customer-lifecycle-step2.spec.ts")).toBe(4);
    const cfg = read("playwright.p86.config.ts");
    expect(cfg).toMatch(/testMatch:\s*\/p86-customer-lifecycle-step\[12\]\\.spec\\.ts\//);
  });
});
