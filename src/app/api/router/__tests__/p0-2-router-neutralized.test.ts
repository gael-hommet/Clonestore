// src/app/api/router/__tests__/p0-2-router-neutralized.test.ts
// P0.2 SIBLING SURFACES CLOSURE — /api/router doit être neutralisée (410 Gone) sur
// toute méthode, sans aucun appel réseau ni lecture de la table de tokens dépréciée.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/router/route";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("fetch() must never be called by the neutralized /api/router");
    })
  );
});

describe("P0.2 — /api/router neutralisée (Option A)", () => {
  it("POST -> 410 Gone, quel que soit le corps envoyé, aucun appel réseau", async () => {
    const res = await POST();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.status).toBe("GONE");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET -> 410 Gone, aucun appel réseau", async () => {
    const res = await GET();
    expect(res.status).toBe(410);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("le code source ne contient plus l'URL Make codée en dur ni de référence à api_tokens/agents_owned", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/router/route.ts"),
      "utf-8"
    );
    expect(src).not.toMatch(/hook\.eu2\.make\.com/);
    expect(src).not.toMatch(/\.from\(["']api_tokens["']\)/);
    expect(src).not.toMatch(/\.from\(["']agents_owned["']\)/);
    expect(src).not.toMatch(/createClient/); // plus aucune dépendance Supabase
  });
});
