// BLOC FINAL §7/§11/§14 — protections de la page readiness, dans l'ORDRE du cockpit :
// slug exact → porte configurée → porte déverrouillée → session → allowlist. On teste la
// garde réelle (resolveReadiness) : décisions + données assemblées (aucun secret collecté).
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

vi.mock("@/lib/founder-access/admin-guard", () => ({
  resolveOwnerGateState: vi.fn(() => "unlocked"),
  resolveFounderAdmin: vi.fn(async () => ({ ok: true, email: "owner@acme.fr" })),
}));
// Base indisponible en test → la garde emprunte sa branche résiliente (db non vérifiée).
vi.mock("@/lib/pierre/v1/db", () => ({
  getRuntimeDb: vi.fn(async () => { throw new Error("db indisponible (test)"); }),
  createRuntimeExecutorForUrl: vi.fn(),
}));

import { resolveReadiness } from "../readiness-guard";
import { resolveOwnerGateState, resolveFounderAdmin } from "@/lib/founder-access/admin-guard";

const gate = resolveOwnerGateState as unknown as Mock;
const admin = resolveFounderAdmin as unknown as Mock;
const SLUG = "owner-secret-slug";
const COOKIE = "cs_owner_gate=x";

beforeEach(() => {
  process.env.CLONESTORE_OWNER_COCKPIT_SLUG = SLUG;
  gate.mockReturnValue("unlocked");
  admin.mockResolvedValue({ ok: true, email: "owner@acme.fr" });
});

describe("§7 — page readiness : ordre exact des protections (fail-closed)", () => {
  it("mauvais slug → notfound (404)", async () => {
    expect(await resolveReadiness("mauvais-slug", COOKIE)).toEqual({ kind: "notfound" });
  });
  it("slug non configuré → notfound", async () => {
    delete process.env.CLONESTORE_OWNER_COCKPIT_SLUG;
    expect(await resolveReadiness(SLUG, COOKIE)).toEqual({ kind: "notfound" });
  });
  it("porte mal configurée → notfound", async () => {
    gate.mockReturnValue("misconfigured");
    expect(await resolveReadiness(SLUG, COOKIE)).toEqual({ kind: "notfound" });
  });
  it("porte verrouillée → locked (Owner Gate, aucune donnée)", async () => {
    gate.mockReturnValue("locked");
    expect(await resolveReadiness(SLUG, COOKIE)).toEqual({ kind: "locked" });
  });
  it("session absente après déverrouillage → redirect login", async () => {
    admin.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    expect(await resolveReadiness(SLUG, COOKIE)).toEqual({ kind: "redirect", to: `/login?next=/internal/${SLUG}/command-center/readiness` });
  });
  it("utilisateur hors allowlist → notfound (ne révèle pas l'existence)", async () => {
    admin.mockResolvedValue({ ok: false, reason: "forbidden" });
    expect(await resolveReadiness(SLUG, COOKIE)).toEqual({ kind: "notfound" });
  });
  it("utilisateur autorisé → ready : composants visibles, aucune valeur de secret", async () => {
    const r = await resolveReadiness(SLUG, COOKIE);
    expect(r.kind).toBe("ready");
    if (r.kind !== "ready") throw new Error("unreachable");
    expect(r.email).toBe("owner@acme.fr");
    const keys = r.components.map((c) => c.key);
    for (const k of ["stripe-env", "email-env", "analytics-env"]) expect(keys).toContain(k);
    // composant DB présent (branche résiliente quand la connexion est indisponible)
    expect(keys.some((k) => k.startsWith("db"))).toBe(true);
    expect(["ready", "blocked"]).toContain(r.verdict.status);
    // Aucune valeur de secret/URL ne doit transiter par les données du composant :
    // seuls des NOMS de variables (MAJUSCULES) et des libellés sont présents. Les
    // préfixes de secrets réels sont en minuscules → comparaison sensible à la casse.
    const serialized = JSON.stringify(r);
    expect(serialized).not.toMatch(/postgres:\/\/|sk_live_|sk_test_|whsec_|re_[a-z0-9]{6}/);
  });
});
