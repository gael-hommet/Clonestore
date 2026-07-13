// src/lib/clonechat/__tests__/p16d-target-resolution-safety.test.ts
// P16D §3.A — RÉSOLUTION DE CIBLE : Pierre ne devine JAMAIS quelle mission annuler ni quelle
// validation décider.
//
// DÉFAUT CORRIGÉ (HIGH, confirmé) — `resolveCancellableMissionV1` faisait `byHint ?? active[0]`
// et `resolvePendingValidationV1` faisait `byHint ?? 1re pending`. Un `hintId` HALLUCINÉ par le
// modèle (id inexistant) ⇒ `byHint` undefined ⇒ repli silencieux sur la 1re mission active /
// la 1re validation pending. Résultat : « annule la mission X » (X inexistante) annulait une
// AUTRE mission ; « approuve la validation Y » décidait une AUTRE validation. Cible devinée sur
// une action irréversible / une décision RH sensible.
//
// Correction : un hint fourni-mais-introuvable ⇒ null (pas de retarget) ; sans hint, auto-choix
// UNIQUEMENT si exactement une cible candidate existe.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveCancellableMissionV1, resolvePendingValidationV1 } from "@/lib/clonechat/server/v1-loopback";

const V1 = { base: "http://localhost:3000", headers: {} as Record<string, string> };

/** Stub du fetch loopback vers l'API V1 : missions + validations paramétrables. */
function installFetch(missions: Array<{ id: string; status: string; summary?: string }>, validations: Record<string, Array<{ id: string; status: string; version?: number }>> = {}) {
  global.fetch = vi.fn(async (url: unknown) => {
    const u = String(url);
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    if (u.includes("/api/pierre/v1/missions?")) return json({ items: missions });
    const mm = u.match(/\/missions\/([^/]+)\/validations$/);
    if (mm) return json(validations[decodeURIComponent(mm[1])] ?? []);
    return json({});
  }) as unknown as typeof fetch;
}

beforeEach(() => vi.restoreAllMocks());

describe("P16D §3.A — annulation de mission : jamais de cible devinée", () => {
  it("un hintId HALLUCINÉ (mission inexistante) ⇒ null, JAMAIS un repli sur la 1re active", async () => {
    installFetch([{ id: "m-1", status: "running", summary: "Mission A" }, { id: "m-2", status: "queued", summary: "Mission B" }]);
    const r = await resolveCancellableMissionV1(V1, "m-INEXISTANTE");
    expect(r).toBeNull();                              // ← avant P16D : renvoyait m-1
  });

  it("un hintId réel résout exactement cette mission", async () => {
    installFetch([{ id: "m-1", status: "running", summary: "Mission A" }, { id: "m-2", status: "queued", summary: "Mission B" }]);
    const r = await resolveCancellableMissionV1(V1, "m-2");
    expect(r?.id).toBe("m-2");
  });

  it("sans hint et PLUSIEURS missions actives ⇒ null (ambigu, on redemande)", async () => {
    installFetch([{ id: "m-1", status: "running" }, { id: "m-2", status: "queued" }]);
    expect(await resolveCancellableMissionV1(V1, "")).toBeNull();
  });

  it("sans hint et UNE SEULE mission active ⇒ auto-résolution non ambiguë", async () => {
    installFetch([{ id: "m-1", status: "running", summary: "Seule" }, { id: "m-2", status: "done" }]);
    const r = await resolveCancellableMissionV1(V1, "");
    expect(r?.id).toBe("m-1");
  });
});

describe("P16D §3.A — décision de validation : jamais de cible devinée", () => {
  it("un validation_id HALLUCINÉ ⇒ null, JAMAIS un repli sur la 1re pending", async () => {
    installFetch([{ id: "m-1", status: "awaiting_validation" }], { "m-1": [{ id: "val-1", status: "pending", version: 2 }] });
    const r = await resolvePendingValidationV1(V1, "val-INEXISTANTE");
    expect(r).toBeNull();                              // ← avant P16D : renvoyait val-1
  });

  it("un validation_id réel + pending résout exactement cette validation avec sa version", async () => {
    installFetch([{ id: "m-1", status: "awaiting_validation" }], { "m-1": [{ id: "val-1", status: "pending", version: 3 }] });
    const r = await resolvePendingValidationV1(V1, "val-1");
    expect(r).toMatchObject({ id: "val-1", missionId: "m-1", version: 3 });
  });

  it("sans hint et PLUSIEURS validations pending ⇒ null (ambigu)", async () => {
    installFetch(
      [{ id: "m-1", status: "awaiting_validation" }, { id: "m-2", status: "awaiting_validation" }],
      { "m-1": [{ id: "val-1", status: "pending" }], "m-2": [{ id: "val-2", status: "pending" }] },
    );
    expect(await resolvePendingValidationV1(V1, "")).toBeNull();
  });

  it("sans hint et UNE SEULE validation pending ⇒ auto-résolution", async () => {
    installFetch([{ id: "m-1", status: "awaiting_validation" }], { "m-1": [{ id: "val-1", status: "pending", version: 1 }, { id: "val-0", status: "approved" }] });
    const r = await resolvePendingValidationV1(V1, "");
    expect(r?.id).toBe("val-1");
  });
});
