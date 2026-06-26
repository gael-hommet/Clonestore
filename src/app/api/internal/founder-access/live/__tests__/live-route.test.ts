// §3 — route SSE temps réel : MÊMES protections que le cockpit (gated). Aucun accès public.
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

vi.mock("@/lib/founder-access/admin-guard", () => ({
  guardInternalRequest: vi.fn(),
  founderAdminDeniedResponse: (reason: string) =>
    new Response(JSON.stringify({ error: reason }), { status: reason === "unauthenticated" ? 401 : 404 }),
}));
vi.mock("@/lib/pierre/v1/db", () => ({ getRuntimeDb: vi.fn(async () => ({ __fake: true })) }));
vi.mock("@/lib/founder-access/command-center", () => ({
  getFounderCommandCenterSnapshot: vi.fn(async () => ({ overview: { reservations_total: 0 }, sources: [], alerts: [], generated_at: "x" })),
}));
vi.mock("@/lib/founder-access/commercial", () => ({ getFounderPhase: () => "launched" }));

import { GET } from "@/app/api/internal/founder-access/live/route";
import { guardInternalRequest } from "@/lib/founder-access/admin-guard";
import { liveConnections } from "@/lib/founder-access/realtime";

const guard = guardInternalRequest as unknown as Mock;
const req = () => new Request("http://x/api/internal/founder-access/live");

describe("live SSE route — gating fail-closed", () => {
  beforeEach(() => { while (liveConnections.count > 0) liveConnections.dec(); });

  it("non authentifié → 401 (aucun flux)", async () => {
    guard.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    expect((await GET(req())).status).toBe(401);
    expect(liveConnections.count).toBe(0);
  });
  it("hors allowlist → 404 (aucun flux)", async () => {
    guard.mockResolvedValue({ ok: false, reason: "forbidden" });
    expect((await GET(req())).status).toBe(404);
    expect(liveConnections.count).toBe(0);
  });
  it("fondateur autorisé → flux SSE ouvert, connexion comptée, fermeture propre", async () => {
    guard.mockResolvedValue({ ok: true, email: "owner@acme.fr" });
    const res = await GET(req());
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    await new Promise((r) => setTimeout(r, 30)); // laisse start() s'achever
    expect(liveConnections.count).toBe(1);
    await res.body?.cancel(); // fermeture → clearInterval + dec
    expect(liveConnections.count).toBe(0);
  });
});
