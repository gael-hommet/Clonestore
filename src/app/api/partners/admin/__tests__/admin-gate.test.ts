// Sécurité du gate admin : une session NON-admin ne peut exécuter AUCUNE action ni lire
// l'overview. On mocke resolveFounderAdmin (le gate réel) et on prouve qu'aucune opération
// DB n'est atteinte sur refus, et que la raison obligatoire est exigée quand le gate passe.

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  admin: { ok: false, reason: "unauthenticated" } as { ok: true; email: string } | { ok: false; reason: string },
  dbTouched: false,
}));

vi.mock("@/lib/founder-access/admin-guard", () => ({
  resolveFounderAdmin: async () => h.admin,
  founderAdminDeniedResponse: (reason: string) => {
    const status = reason === "unauthenticated" ? 401 : 404;
    return new Response(JSON.stringify({ ok: false }), { status, headers: { "content-type": "application/json" } });
  },
}));

// Toute résolution DB marque un drapeau : sur refus, elle ne doit JAMAIS être appelée.
vi.mock("@/lib/partner-program/server/runtime", () => ({
  getPartnerDb: async () => { h.dbTouched = true; return {}; },
  withService: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({ query: async () => ({ rows: [] }) }),
}));

function actionReq(body: Record<string, unknown>) {
  return new Request("http://x/api/partners/admin/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => { h.dbTouched = false; });

describe("POST /api/partners/admin/action — gate", () => {
  it("session non authentifiée → 401, aucune DB touchée", async () => {
    h.admin = { ok: false, reason: "unauthenticated" };
    const { POST } = await import("../action/route");
    const res = await POST(actionReq({ action: "suspend_partner", id: "x", reason: "y" }));
    expect(res.status).toBe(401);
    expect(h.dbTouched).toBe(false);
  });

  it("email non autorisé (forbidden) → 404 (ne révèle pas), aucune DB touchée", async () => {
    h.admin = { ok: false, reason: "forbidden" };
    const { POST } = await import("../action/route");
    const res = await POST(actionReq({ action: "accept_application", id: "x", reason: "y" }));
    expect(res.status).toBe(404);
    expect(h.dbTouched).toBe(false);
  });

  it("admin authentifié mais SANS raison sur action sensible → 422, aucune DB touchée", async () => {
    h.admin = { ok: true, email: "owner@clonestore" };
    const { POST } = await import("../action/route");
    const res = await POST(actionReq({ action: "suspend_partner", id: "x" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("reason_required");
    expect(h.dbTouched).toBe(false);
  });

  it("admin authentifié + action inconnue → 400", async () => {
    h.admin = { ok: true, email: "owner@clonestore" };
    const { POST } = await import("../action/route");
    const res = await POST(actionReq({ action: "wipe_everything", reason: "malice" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/partners/admin/overview — gate", () => {
  it("non-admin → refus, aucune DB touchée", async () => {
    h.admin = { ok: false, reason: "unauthenticated" };
    const { GET } = await import("../overview/route");
    const res = await GET();
    expect(res.status).toBe(401);
    expect(h.dbTouched).toBe(false);
  });
});
