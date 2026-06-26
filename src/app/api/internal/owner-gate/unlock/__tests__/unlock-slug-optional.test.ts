// Non-régression — route unlock : statuts DISTINCTS + cookie. L'entrée /founder accepte
// l'absence de slug (le mot de passe est le secret réel) sans retirer aucune protection :
//   bon mot de passe → 200 + Set-Cookie · mauvais → 401 sans cookie · slug erroné → 401
//   rate-limit → 429 sans cookie · porte non configurée → 401 sans cookie.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/pierre/v1/db", () => ({ getRuntimeDb: vi.fn(async () => ({ __fake: true })) }));
const gateConfigured = { value: true };
vi.mock("@/lib/founder-access/owner-gate", () => ({
  isOwnerGateConfigured: vi.fn(() => gateConfigured.value),
  verifyOwnerPassword: vi.fn((pw: string) => pw === "good-password"),
}));
vi.mock("@/lib/founder-access/owner-password-config", () => ({
  loadOwnerPasswordHash: vi.fn(() => ({ present: true, normalized: "scrypt$1$1$1$aa$bb", length: 20, parts: 6, formatValid: true, fingerprint: "deadbeef" })),
}));
vi.mock("@/lib/founder-access/signed-cookie", () => ({
  buildOwnerGateCookie: vi.fn(() => "cs_owner_gate=token; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200"),
}));
const rl = { ok: true, retryAfter: 0 };
vi.mock("@/lib/founder-access/request-utils", () => ({
  distributedRateLimit: vi.fn(async () => ({ ok: rl.ok, retryAfter: rl.retryAfter, count: 1, limit: 5 })),
  hashIp: vi.fn(() => "iphash"),
  getClientIp: vi.fn(() => "1.2.3.4"),
  readJsonBounded: vi.fn(async (req: Request) => { try { return await req.json(); } catch { return null; } }),
}));
vi.mock("@/lib/founder-access/store", () => ({ recordAdminAudit: vi.fn(async () => {}) }));

import { POST } from "@/app/api/internal/owner-gate/unlock/route";

const SLUG = "secret-slug";
let prevSlug: string | undefined;
beforeEach(() => {
  prevSlug = process.env.CLONESTORE_OWNER_COCKPIT_SLUG;
  process.env.CLONESTORE_OWNER_COCKPIT_SLUG = SLUG;
  gateConfigured.value = true; rl.ok = true; rl.retryAfter = 0;
});
afterEach(() => { if (prevSlug === undefined) delete process.env.CLONESTORE_OWNER_COCKPIT_SLUG; else process.env.CLONESTORE_OWNER_COCKPIT_SLUG = prevSlug; });

function post(body: unknown) {
  return POST(new Request("http://x/api/internal/owner-gate/unlock", { method: "POST", body: JSON.stringify(body) }));
}

describe("owner-gate unlock — statuts + cookie", () => {
  it("mot de passe valide SANS slug (/founder) → 200 + Set-Cookie", async () => {
    const res = await post({ password: "good-password" });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("cs_owner_gate=");
  });
  it("mot de passe valide AVEC bon slug → 200 + Set-Cookie", async () => {
    const res = await post({ password: "good-password", slug: SLUG });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("cs_owner_gate=");
  });
  it("slug ERRONÉ → 401 sans cookie", async () => {
    const res = await post({ password: "good-password", slug: "wrong-slug" });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("mauvais mot de passe → 401 sans cookie", async () => {
    const res = await post({ password: "nope" });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("rate-limit atteint → 429 sans cookie (jamais 401)", async () => {
    rl.ok = false; rl.retryAfter = 120;
    const res = await post({ password: "good-password" });
    expect(res.status).toBe(429);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("retry-after")).toBe("120");
  });
  it("porte non configurée → 401 sans cookie (fail-closed)", async () => {
    gateConfigured.value = false;
    const res = await post({ password: "good-password" });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
