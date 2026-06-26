// BLOC FINAL §14 — verifyFounderAccessSchema sur une base PGlite réellement migrée.
// Prouve, par comportement, que le schéma + la fonction de journal + les grants de
// moindre privilège sont conformes (réutilisé par le script verify-founder-access-production-db).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { verifyFounderAccessSchema } from "../production-verify";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

describe("§14 — verifyFounderAccessSchema (schéma production)", () => {
  it("base migrée → ok=true, tous les contrôles verts", async () => {
    const v = await verifyFounderAccessSchema(h.db);
    const failed = v.checks.filter((c) => !c.ok);
    expect(failed, `contrôles en échec: ${JSON.stringify(failed)}`).toHaveLength(0);
    expect(v.ok).toBe(true);
  });

  it("contrôles essentiels présents (tables, fonction journal, grants moindre privilège)", async () => {
    const v = await verifyFounderAccessSchema(h.db);
    const names = v.checks.map((c) => c.name);
    expect(names).toContain("table:clonestore_founder_stripe_events");
    expect(names).toContain("function:clonestore_record_founder_stripe_event");
    expect(names).toContain("grant:pierre_rt_app_no_execute");
    expect(names).toContain("grant:writer_execute");
    expect(names).toContain("grant:public_no_execute");
    // Les grants de moindre privilège sont effectivement verts.
    for (const n of ["grant:pierre_rt_app_no_execute", "grant:pierre_rt_app_no_raw_insert", "grant:public_no_execute", "grant:writer_execute"]) {
      expect(v.checks.find((c) => c.name === n)?.ok, n).toBe(true);
    }
  });
});
