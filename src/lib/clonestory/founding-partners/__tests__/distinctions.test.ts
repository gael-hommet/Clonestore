// CS-FINAL 1 — distinctions du Cercle (unitaire). Aucune valeur inventée, aucun
// terme interdit, attribution auto dérivée de stats RÉELLES, manuel jamais auto.

import { describe, it, expect } from "vitest";
import {
  DISTINCTIONS,
  computeDistinctions,
  countEarned,
  type PartnerStatsForDistinction,
} from "../distinctions";
import { findForbiddenTerm } from "../vocabulary";

const base: PartnerStatsForDistinction = {
  status: "registered",
  introductionsDeclared: 0,
  prospectsConfirmed: 0,
  accountsCreated: 0,
  clientsAttributed: 0,
  contributionsVerified: 0,
  isFoundingPartner: false,
};

describe("catalogue des distinctions", () => {
  it("aucun code en double", () => {
    const codes = DISTINCTIONS.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("aucun libellé/description n'emploie un terme interdit (récompense, points, action, commission…)", () => {
    for (const d of DISTINCTIONS) {
      expect(findForbiddenTerm(d.name), `nom: ${d.name}`).toBeNull();
      expect(findForbiddenTerm(d.description), `desc: ${d.code}`).toBeNull();
    }
  });

  it("chaque distinction auto a une règle ; chaque manuelle n'en a pas", () => {
    for (const d of DISTINCTIONS) {
      if (d.grant === "auto") expect(typeof d.rule).toBe("function");
      else expect(d.rule).toBeUndefined();
    }
  });
});

describe("computeDistinctions — aucun faux acquis", () => {
  it("partenaire non vérifié : aucune distinction obtenue", () => {
    const out = computeDistinctions(base);
    expect(countEarned(out)).toBe(0);
    expect(out.every((d) => d.locked)).toBe(true);
  });

  it("membre vérifié : 'Membre du Cercle Fondateur' obtenu, pas 'Partenaire Fondateur'", () => {
    const out = computeDistinctions({ ...base, status: "email_verified" });
    expect(out.find((d) => d.code === "founding_member")?.earned).toBe(true);
    expect(out.find((d) => d.code === "founding_partner")?.earned).toBe(false);
  });

  it("première introduction & premier prospect confirmé : étapes débloquées au bon seuil", () => {
    expect(computeDistinctions({ ...base, status: "email_verified", introductionsDeclared: 1 }).find((d) => d.code === "first_introduction")?.earned).toBe(true);
    expect(computeDistinctions({ ...base, status: "email_verified" }).find((d) => d.code === "first_introduction")?.earned).toBe(false);
    expect(computeDistinctions({ ...base, status: "email_verified", prospectsConfirmed: 1 }).find((d) => d.code === "first_confirmed")?.earned).toBe(true);
  });

  it("Partenaire Fondateur uniquement si founding_partner réel (registry alloué)", () => {
    const fp = computeDistinctions({ ...base, status: "founding_partner", isFoundingPartner: true });
    expect(fp.find((d) => d.code === "founding_partner")?.earned).toBe(true);
  });

  it("Bâtisseur (5) et Ambassadeur (10) : seuils de contributions vérifiées", () => {
    const four = computeDistinctions({ ...base, status: "active_contributor", contributionsVerified: 4 });
    expect(four.find((d) => d.code === "builder_5")?.earned).toBe(false);
    const five = computeDistinctions({ ...base, status: "active_contributor", contributionsVerified: 5 });
    expect(five.find((d) => d.code === "builder_5")?.earned).toBe(true);
    expect(five.find((d) => d.code === "ambassador_10")?.earned).toBe(false);
    const ten = computeDistinctions({ ...base, status: "active_contributor", contributionsVerified: 10 });
    expect(ten.find((d) => d.code === "ambassador_10")?.earned).toBe(true);
  });

  it("distinctions MANUELLES (pioneer, architect) : jamais auto, obtenues seulement si accordées", () => {
    const auto = computeDistinctions({ ...base, status: "founding_partner", isFoundingPartner: true, contributionsVerified: 99 });
    expect(auto.find((d) => d.code === "pioneer")?.earned).toBe(false);
    expect(auto.find((d) => d.code === "architect")?.earned).toBe(false);
    const granted = computeDistinctions(base, ["pioneer"]);
    expect(granted.find((d) => d.code === "pioneer")?.earned).toBe(true);
    expect(granted.find((d) => d.code === "architect")?.earned).toBe(false);
  });
});
