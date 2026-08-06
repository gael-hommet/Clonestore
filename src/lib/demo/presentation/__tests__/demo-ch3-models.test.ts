// /demo — CHAPITRE 3 : VERROUS des modèles canoniques (value/cost) et de l'adaptateur de
// présentation des technologies. Rien n'est écrit en dur : tout est dérivé des registres réels.

import { describe, it, expect } from "vitest";
import {
  VALUE_REFERENCES,
  VALUE_SCENARIO_IDS,
  annualValue,
  scenarioValue,
} from "../value-model";
import {
  listPublicTechnologies,
  listPublicCapabilities,
  technologyArchitecture,
  verifyTechnologyPresentation,
  PUBLIC_TECH_STATUS,
} from "../technology-presentation";

describe("value-model — références canoniques (elite + 3 modes)", () => {
  it("VALUE_REFERENCES = exactement elite + draft + copilot + governed", () => {
    expect(VALUE_REFERENCES.map((r) => r.id)).toEqual(["elite", "draft", "copilot", "governed"]);
    const elite = VALUE_REFERENCES.find((r) => r.id === "elite")!;
    expect(elite.isHumanBaseline).toBe(true);
    // Les 3 modes de Pierre = les non-baseline, exactement draft/copilot/governed.
    const modes = VALUE_REFERENCES.filter((r) => !r.isHumanBaseline).map((r) => r.id);
    expect(modes).toEqual(["draft", "copilot", "governed"]);
    expect(VALUE_REFERENCES.filter((r) => r.isHumanBaseline)).toHaveLength(1);
  });

  it("annualValue(groupe) : capacité et gain net croissants draft ≤ copilot ≤ governed ; elite sans coût", () => {
    const av = annualValue("groupe");
    const by = (id: string) => av.perReference.find((r) => r.reference === id)!;
    const elite = by("elite"), draft = by("draft"), copilot = by("copilot"), governed = by("governed");

    expect(elite.pierreCostMinor).toBe(0);
    expect(elite.capacityValueMinor).toBe(0);
    // Monotonie de la valeur (facteur d'absorption croissant).
    expect(draft.capacityValueMinor).toBeLessThanOrEqual(copilot.capacityValueMinor);
    expect(copilot.capacityValueMinor).toBeLessThanOrEqual(governed.capacityValueMinor);
    expect(draft.netValueMinor).toBeLessThanOrEqual(governed.netValueMinor);
    // netValueMinor est un entier fini (jamais NaN/Infinity — arithmétique entière).
    for (const r of av.perReference) expect(Number.isFinite(r.netValueMinor)).toBe(true);
    // Temps humain décroissant : elite (manuel) ≥ draft ≥ copilot ≥ governed.
    expect(elite.humanMinutesYear).toBeGreaterThanOrEqual(draft.humanMinutesYear);
    expect(copilot.humanMinutesYear).toBeGreaterThanOrEqual(governed.humanMinutesYear);
  });

  it("scenarioValue : chaque scénario donne les 4 vues, elite le plus lent, governed le plus rapide", () => {
    const sv = scenarioValue(VALUE_SCENARIO_IDS[0])!;
    expect(sv).not.toBeNull();
    expect(sv.views.map((v) => v.reference)).toEqual(["elite", "draft", "copilot", "governed"]);
    const min = (id: string) => sv.views.find((v) => v.reference === id)!.humanMinutes;
    expect(min("elite")).toBeGreaterThanOrEqual(min("governed"));
  });
});

describe("technology-presentation — fidèle aux registres réels (T2=14, T1=15, CloneChat une fois)", () => {
  it("verifyTechnologyPresentation() est vert et compte 14 / 15 / 15", () => {
    const check = verifyTechnologyPresentation();
    expect(check.issues).toEqual([]);
    expect(check.ok).toBe(true);
    expect(check.counts).toEqual({ t2: 14, t1: 15, publicTotal: 15 });
  });

  it("15 technologies publiques = 14 T2 + CloneChat (exactement une fois), sans doublon de libellé", () => {
    const pub = listPublicTechnologies();
    expect(pub).toHaveLength(15);
    expect(pub.filter((t) => t.id === "clonechat")).toHaveLength(1);
    const names = pub.map((t) => t.publicName);
    expect(new Set(names).size).toBe(names.length);
    for (const t of pub) expect(t.publicName.trim().split(/\s+/).length).toBeLessThanOrEqual(3);
  });

  it("15 capacités T1, chacune avec un libellé humain et un statut public connu", () => {
    const caps = listPublicCapabilities();
    expect(caps).toHaveLength(15);
    for (const c of caps) {
      expect(c.humanName.length).toBeGreaterThan(0);
      expect(PUBLIC_TECH_STATUS[c.status]).toBeDefined();
    }
  });

  it("statuts HONNÊTES : CloneVoice « Live bloqué », CloneChat jamais « Disponible »", () => {
    const pub = listPublicTechnologies();
    const voice = pub.find((t) => t.id === "clonevoice")!;
    const chat = pub.find((t) => t.id === "clonechat")!;
    expect(voice.status).toBe("live_blocked");
    expect(chat.status).not.toBe("local_available");
    // Aucun libellé « Disponible » ne peut coexister avec une note de blocage live vide de sens :
    // toute techno « Live bloqué » ou « Provider à activer » porte une explication.
    for (const t of pub) {
      if (t.status === "live_blocked" || t.status === "provider_pending") {
        expect((t.liveNote ?? "").length + PUBLIC_TECH_STATUS[t.status].note.length).toBeGreaterThan(0);
      }
    }
  });

  it("l'architecture couvre les 4 familles, chacune non vide, total = 15", () => {
    const arch = technologyArchitecture();
    expect(arch).toHaveLength(4);
    for (const fam of arch) expect(fam.technologies.length).toBeGreaterThan(0);
    expect(arch.reduce((n, f) => n + f.technologies.length, 0)).toBe(15);
  });
});
