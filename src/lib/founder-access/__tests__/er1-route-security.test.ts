// E-R1 — sécurité route-level (sans DB) : porte fail-closed (§1/§2), refus des
// événements serveur côté funnel public (§3/§9). Les chemins de REFUS ne touchent
// jamais la base : un refus survient avant tout accès données.
import { describe, it, expect, beforeEach, afterEach } from "vitest";

const OWNER_ENVS = [
  "CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH",
  "CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET",
  "CLONESTORE_OWNER_COCKPIT_SLUG",
];
let saved: Record<string, string | undefined> = {};
beforeEach(() => { saved = Object.fromEntries(OWNER_ENVS.map((k) => [k, process.env[k]])); });
afterEach(() => { for (const k of OWNER_ENVS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

function clearOwnerEnvs() { for (const k of OWNER_ENVS) delete process.env[k]; }
function configureOwnerEnvs() {
  process.env.CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH = "scrypt$16384$8$1$aa$bb";
  process.env.CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET = "cookie-secret-0123456789";
  process.env.CLONESTORE_OWNER_COCKPIT_SLUG = "secret-slug";
}

describe("§1/§2 — porte propriétaire fail-closed (route owner-gate unlock)", () => {
  it("porte NON configurée → refus générique (401), sans accès base", async () => {
    clearOwnerEnvs();
    const { POST } = await import("@/app/api/internal/owner-gate/unlock/route");
    const res = await POST(new Request("http://x/api/internal/owner-gate/unlock", { method: "POST", body: JSON.stringify({ password: "x", slug: "y" }) }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Accès refusé");
  });

  it("porte configurée mais base indisponible → jamais autorisé (fail-closed)", async () => {
    configureOwnerEnvs();
    const savedDb = { a: process.env.DATABASE_URL, b: process.env.SUPABASE_DB_URL };
    delete process.env.DATABASE_URL; delete process.env.SUPABASE_DB_URL; // pas de Postgres → fail-closed
    try {
      const { POST } = await import("@/app/api/internal/owner-gate/unlock/route");
      const res = await POST(new Request("http://x/api/internal/owner-gate/unlock", { method: "POST", body: JSON.stringify({ password: "x", slug: "secret-slug" }) }));
      expect(res.status).not.toBe(200); // jamais d'accès accordé sans base
    } finally {
      if (savedDb.a !== undefined) process.env.DATABASE_URL = savedDb.a;
      if (savedDb.b !== undefined) process.env.SUPABASE_DB_URL = savedDb.b;
    }
  });
});

describe("§2 — API interne dashboard fail-closed (sans DB avant autorisation)", () => {
  it("porte non configurée → 404 sans toucher la base", async () => {
    clearOwnerEnvs();
    const { GET } = await import("@/app/api/internal/founder-access/dashboard/route");
    const res = await GET(new Request("http://x/api/internal/founder-access/dashboard"));
    expect(res.status).toBe(404);
  });
  it("porte configurée mais cookie absent → 404 (verrouillée), sans base", async () => {
    configureOwnerEnvs();
    const { GET } = await import("@/app/api/internal/founder-access/dashboard/route");
    const res = await GET(new Request("http://x/api/internal/founder-access/dashboard"));
    expect(res.status).toBe(404);
  });
});

describe("§11 — unsubscribe GET ne mute jamais (confirmation seule)", () => {
  it("GET avec jeton valide → page de confirmation 200 (aucun appel base)", async () => {
    process.env.CLONESTORE_FOUNDER_EMAIL_LINK_SECRET = "link-secret-0123456789";
    const { unsubscribeToken } = await import("../mailing-links");
    const rid = "3f1a8c2e-1b2c-4d3e-8f9a-0b1c2d3e4f5a";
    const token = unsubscribeToken(rid)!;
    const { GET } = await import("@/app/api/founder-access/unsubscribe/route");
    const res = await GET(new Request(`http://x/api/founder-access/unsubscribe?rid=${rid}&token=${encodeURIComponent(token)}`));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Confirmer la désinscription");
    expect(html).toContain("method=\"post\"");
  });
  it("GET avec jeton invalide → 400", async () => {
    const { GET } = await import("@/app/api/founder-access/unsubscribe/route");
    const res = await GET(new Request("http://x/api/founder-access/unsubscribe?rid=3f1a8c2e-1b2c-4d3e-8f9a-0b1c2d3e4f5a&token=faux"));
    expect(res.status).toBe(400);
  });
});

describe("§3/§9 — funnel public refuse les événements serveur (avant toute base)", () => {
  it("founder_payment_completed depuis le navigateur → 422", async () => {
    const { POST } = await import("@/app/api/founder-access/funnel/route");
    for (const name of ["founder_payment_completed", "founder_email_verified", "founder_reservation_created"]) {
      const res = await POST(new Request("http://x/api/founder-access/funnel", { method: "POST", body: JSON.stringify({ name }) }));
      expect(res.status).toBe(422);
    }
  });
  it("événement inconnu → 204 (ignoré), sans base", async () => {
    const { POST } = await import("@/app/api/founder-access/funnel/route");
    const res = await POST(new Request("http://x/api/founder-access/funnel", { method: "POST", body: JSON.stringify({ name: "rm_rf" }) }));
    expect(res.status).toBe(204);
  });
});
