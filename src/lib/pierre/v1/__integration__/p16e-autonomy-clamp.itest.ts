// src/lib/pierre/v1/__integration__/p16e-autonomy-clamp.itest.ts
// P16E §8 — l'autonomie de mission est bornée par le réglage d'entreprise gouverné.
//
// DÉFAUT CORRIGÉ (HIGH) — `createMission` faisait `input.autonomy_mode ?? "normal"` : le corps de
// requête de /api/pierre/v1/missions était honoré tel quel. Un utilisateur `mission.create`
// pouvait forger `autonomy_mode:"enterprise_autonomous"` pour élever sa mission au-dessus du
// `default_autonomy_mode` de l'entreprise. Désormais le plafond est résolu côté serveur et
// l'autonomie effective est BORNÉE : on peut demander plus prudent, jamais plus élevé.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { apiCreateMission } from "../api";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

const missionAutonomy = async (missionId: string): Promise<string> =>
  String((await h.db.query<{ autonomy_mode: string }>(`select autonomy_mode from pierre_rt_missions where id=$1`, [missionId])).rows[0].autonomy_mode);

const setCompanyDefault = (mode: string) => h.db.query(`update pierre_rt_companies set default_autonomy_mode=$2 where id=$1`, [h.companyA, mode]);

describe("P16E §8 — autonomie de mission bornée par le plafond entreprise", () => {
  it("entreprise 'normal' + demande forgée 'enterprise_autonomous' ⇒ bornée à 'normal'", async () => {
    await setCompanyDefault("normal");
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Notifier l'équipe", autonomy_mode: "enterprise_autonomous" });
    expect(await missionAutonomy(v.mission_id)).toBe("normal");
  });

  it("entreprise 'high_autonomy' + demande 'enterprise_autonomous' ⇒ bornée à 'high_autonomy'", async () => {
    await setCompanyDefault("high_autonomy");
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Préparer une synthèse", autonomy_mode: "enterprise_autonomous" });
    expect(await missionAutonomy(v.mission_id)).toBe("high_autonomy");
  });

  it("un mode PLUS prudent que le plafond est autorisé (draft < normal)", async () => {
    await setCompanyDefault("normal");
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Classer des documents", autonomy_mode: "draft" });
    expect(await missionAutonomy(v.mission_id)).toBe("draft");
  });

  it("sans autonomy_mode fourni ⇒ le plafond entreprise s'applique", async () => {
    await setCompanyDefault("high_autonomy");
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Notifier l'équipe" });
    expect(await missionAutonomy(v.mission_id)).toBe("high_autonomy");
  });

  it("un autonomy_mode invalide (inconnu) est ignoré ⇒ plafond entreprise", async () => {
    await setCompanyDefault("normal");
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Notifier", autonomy_mode: "hacker_mode" as never });
    expect(await missionAutonomy(v.mission_id)).toBe("normal");
  });
});
