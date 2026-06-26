// Non-régression §2-4 — l'allowlist administrateur doit reconnaître l'email malgré les
// formats .env réels (guillemets, point-virgule, espaces, sauts de ligne, casse) qui
// provoquaient un faux « forbidden » → 404 après déverrouillage. L'authentification et
// l'allowlist ne sont JAMAIS contournées : un email absent reste refusé.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let mockEmail: string | null = "owner@acme.fr";
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: () => ({
    auth: { getUser: async () => ({ data: { user: mockEmail ? { email: mockEmail } : null } }) },
  }),
}));

import { resolveFounderAdmin } from "@/lib/founder-access/admin-guard";

const KEYS = ["CLONESTORE_OWNER_ADMIN_EMAILS", "CLONESTORE_FOUNDER_ACCESS_ADMIN_EMAILS"];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  mockEmail = "owner@acme.fr";
});
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

describe("resolveFounderAdmin — allowlist robuste", () => {
  it("email simple dans la variable 1 → ok", async () => {
    process.env.CLONESTORE_OWNER_ADMIN_EMAILS = "owner@acme.fr";
    expect(await resolveFounderAdmin()).toEqual({ ok: true, email: "owner@acme.fr" });
  });
  it("email seulement dans la variable 2 → ok", async () => {
    process.env.CLONESTORE_FOUNDER_ACCESS_ADMIN_EMAILS = "owner@acme.fr";
    expect((await resolveFounderAdmin()).ok).toBe(true);
  });
  it("valeur entre guillemets → ok", async () => {
    process.env.CLONESTORE_OWNER_ADMIN_EMAILS = '"owner@acme.fr"';
    expect((await resolveFounderAdmin()).ok).toBe(true);
  });
  it("liste séparée par points-virgules et espaces → ok", async () => {
    process.env.CLONESTORE_OWNER_ADMIN_EMAILS = "a@x.com; owner@acme.fr ; b@y.com";
    expect((await resolveFounderAdmin()).ok).toBe(true);
  });
  it("liste sur plusieurs lignes → ok", async () => {
    process.env.CLONESTORE_OWNER_ADMIN_EMAILS = "a@x.com\nowner@acme.fr\n";
    expect((await resolveFounderAdmin()).ok).toBe(true);
  });
  it("casse différente côté session Supabase → ok", async () => {
    mockEmail = "Owner@Acme.FR";
    process.env.CLONESTORE_OWNER_ADMIN_EMAILS = "owner@acme.fr";
    expect((await resolveFounderAdmin()).ok).toBe(true);
  });
  it("email hors liste → forbidden (jamais contourné)", async () => {
    process.env.CLONESTORE_OWNER_ADMIN_EMAILS = "autre@x.com";
    expect(await resolveFounderAdmin()).toEqual({ ok: false, reason: "forbidden" });
  });
  it("allowlist vide → forbidden (fail-closed)", async () => {
    expect(await resolveFounderAdmin()).toEqual({ ok: false, reason: "forbidden" });
  });
  it("aucune session → unauthenticated", async () => {
    mockEmail = null;
    process.env.CLONESTORE_OWNER_ADMIN_EMAILS = "owner@acme.fr";
    expect(await resolveFounderAdmin()).toEqual({ ok: false, reason: "unauthenticated" });
  });
});
