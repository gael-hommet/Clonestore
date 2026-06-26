// Non-régression route-level — resolveCockpitAccess couvre EXACTEMENT les 5 cas :
//   mauvais slug → notfound (404) · gate verrouillée → locked (200 formulaire)
//   gate ouverte + pas de session → redirect /login?next= · hors allowlist → notfound (404)
//   allowlisté → ok + email. (Le vrai statut HTTP 404 du mauvais slug est garanti par
//   src/app/not-found.tsx ; ici on prouve la décision de la garde.)
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

vi.mock("@/lib/founder-access/admin-guard", () => ({
  resolveOwnerGateState: vi.fn(() => "unlocked"),
  resolveFounderAdmin: vi.fn(async () => ({ ok: true, email: "owner@acme.fr" })),
}));

import { resolveCockpitAccess } from "../cockpit-guard";
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

describe("resolveCockpitAccess — 5 cas fail-closed", () => {
  it("mauvais slug → notfound (404)", async () => {
    expect(await resolveCockpitAccess("mauvais-slug", COOKIE)).toEqual({ kind: "notfound" });
  });
  it("slug non configuré → notfound", async () => {
    delete process.env.CLONESTORE_OWNER_COCKPIT_SLUG;
    expect(await resolveCockpitAccess(SLUG, COOKIE)).toEqual({ kind: "notfound" });
  });
  it("bon slug + gate verrouillée → locked (200 formulaire)", async () => {
    gate.mockReturnValue("locked");
    expect(await resolveCockpitAccess(SLUG, COOKIE)).toEqual({ kind: "locked" });
  });
  it("bon slug + gate mal configurée → notfound", async () => {
    gate.mockReturnValue("misconfigured");
    expect(await resolveCockpitAccess(SLUG, COOKIE)).toEqual({ kind: "notfound" });
  });
  it("bon slug + gate ouverte + pas de session → redirect /login avec next", async () => {
    admin.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    expect(await resolveCockpitAccess(SLUG, COOKIE)).toEqual({ kind: "redirect", to: `/login?next=/internal/${SLUG}/command-center` });
  });
  it("bon slug + gate ouverte + email hors allowlist → notfound (404)", async () => {
    admin.mockResolvedValue({ ok: false, reason: "forbidden" });
    expect(await resolveCockpitAccess(SLUG, COOKIE)).toEqual({ kind: "notfound" });
  });
  it("bon slug + gate ouverte + email allowlisté → ok + email", async () => {
    expect(await resolveCockpitAccess(SLUG, COOKIE)).toEqual({ kind: "ok", email: "owner@acme.fr" });
  });
});
