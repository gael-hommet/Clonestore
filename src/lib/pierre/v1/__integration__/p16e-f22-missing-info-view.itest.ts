// src/lib/pierre/v1/__integration__/p16e-f22-missing-info-view.itest.ts
// P16E §3 (F22) — les questions d'information manquante ne sont JAMAIS discardées dans MissionView.
//
// DÉFAUT CORRIGÉ — assembleView / apiGetMission renvoyaient `missing_info: []` alors que la mission
// passait `awaiting_info` : la RAISON exacte du blocage était perdue. Correctif : les questions
// (id/question/priorité) sont persistées dans l'événement `missing_info_detected` et relues à la
// création ET à la relecture. Ordre/priorité préservés ; répondre à une question n'efface pas les autres.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { apiCreateMission, apiGetMission } from "../api";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

describe("P16E §3 F22 — missing_info exposé et persistant", () => {
  it("une demande ambiguë ⇒ MissionView.missing_info porte les questions exactes (pas [])", async () => {
    // « Fais le nécessaire. » : le planificateur détecte le « qui » ET le « quoi » manquants.
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Fais le nécessaire." });
    expect(v.status).toBe("awaiting_info");
    expect(v.missing_info.length).toBeGreaterThan(0);
    const ids = v.missing_info.map((m) => m.id);
    expect(ids).toContain("who");
    expect(ids).toContain("what");
    // priorité conservée
    expect(v.missing_info.every((m) => typeof m.priority === "string" && m.priority.length > 0)).toBe(true);
  });

  it("les questions survivent à la RELECTURE (apiGetMission), jamais discardées", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Fais le nécessaire." });
    const reread = await apiGetMission(h.db, h.ctx("A"), v.mission_id);
    expect(reread.status).toBe("awaiting_info");
    expect(reread.missing_info.map((m) => m.id).sort()).toEqual(v.missing_info.map((m) => m.id).sort());
  });

  it("une demande claire ⇒ missing_info vide (pas de bruit)", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Prépare une synthèse pour l'équipe technique" });
    expect(v.missing_info).toEqual([]);
  });
});
