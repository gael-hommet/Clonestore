// Non-régression route-level — /founder réutilise resolveFounderCockpitAccess SANS slug.
//   gate verrouillée → locked (200 formulaire)
//   ouverte + aucune session → redirect /login?next=/founder
//   ouverte + hors allowlist → notfound (404)
//   ouverte + allowlisté → ok + email (200 cockpit)
//   gate mal configurée → notfound · et : indépendance totale du slug.
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

vi.mock("@/lib/founder-access/admin-guard", () => ({
  resolveOwnerGateState: vi.fn(() => "unlocked"),
  resolveFounderAdmin: vi.fn(async () => ({ ok: true, email: "owner@acme.fr" })),
}));

import { resolveFounderCockpitAccess } from "../../internal/[slug]/command-center/cockpit-guard";
import { resolveOwnerGateState, resolveFounderAdmin } from "@/lib/founder-access/admin-guard";

const gate = resolveOwnerGateState as unknown as Mock;
const admin = resolveFounderAdmin as unknown as Mock;
const ARGS = { cookieHeader: "cs_owner_gate=x", loginReturnPath: "/founder" };

beforeEach(() => {
  gate.mockReturnValue("unlocked");
  admin.mockResolvedValue({ ok: true, email: "owner@acme.fr" });
});

describe("/founder — accès sans slug", () => {
  it("gate verrouillée → locked (200 formulaire)", async () => {
    gate.mockReturnValue("locked");
    expect(await resolveFounderCockpitAccess(ARGS)).toEqual({ kind: "locked" });
  });
  it("gate mal configurée → notfound", async () => {
    gate.mockReturnValue("misconfigured");
    expect(await resolveFounderCockpitAccess(ARGS)).toEqual({ kind: "notfound" });
  });
  it("ouverte + aucune session → redirect /login?next=/founder", async () => {
    admin.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    expect(await resolveFounderCockpitAccess(ARGS)).toEqual({ kind: "redirect", to: "/login?next=/founder" });
  });
  it("ouverte + email hors allowlist → notfound (404)", async () => {
    admin.mockResolvedValue({ ok: false, reason: "forbidden" });
    expect(await resolveFounderCockpitAccess(ARGS)).toEqual({ kind: "notfound" });
  });
  it("ouverte + email allowlisté → ok + email (cockpit)", async () => {
    expect(await resolveFounderCockpitAccess(ARGS)).toEqual({ kind: "ok", email: "owner@acme.fr" });
  });
  it("ne dépend d'AUCUN slug (fonctionne même sans CLONESTORE_OWNER_COCKPIT_SLUG)", async () => {
    const prev = process.env.CLONESTORE_OWNER_COCKPIT_SLUG;
    delete process.env.CLONESTORE_OWNER_COCKPIT_SLUG;
    try {
      expect(await resolveFounderCockpitAccess(ARGS)).toEqual({ kind: "ok", email: "owner@acme.fr" });
    } finally {
      if (prev !== undefined) process.env.CLONESTORE_OWNER_COCKPIT_SLUG = prev;
    }
  });
});
