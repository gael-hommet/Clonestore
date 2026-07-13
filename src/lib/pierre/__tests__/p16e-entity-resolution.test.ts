// src/lib/pierre/__tests__/p16e-entity-resolution.test.ts
// P16E §7.A — résolution d'entité non ambiguë : ne jamais choisir le premier « Paul ».
//
// DÉFAUT CORRIGÉ — `findPierreEmployeeByName` renvoyait le PREMIER match partiel. Sur un chemin
// d'action gouverné (/api/pierre/use/submit, /workflows/rh), « prépare un document pour Paul »
// agissait sur un salarié deviné parmi plusieurs. Désormais une ambiguïté renvoie null ⇒
// l'appelant ne résout pas et n'exécute aucun effet de bord (Pierre demande).

import { describe, it, expect } from "vitest";
import { findPierreEmployeeByName } from "@/lib/pierre/hr/employee";
import type { PierreEmployeeProfile } from "@/lib/pierre/hr/employee";

function emp(id: string, full_name: string): PierreEmployeeProfile {
  return { id, full_name, first_name: full_name.split(" ")[0], last_name: full_name.split(" ").slice(1).join(" "),
    email: null, role: null, department: null, contract_type: null, status: "active", tags: [], site: null,
    manager_name: null, start_date: null } as unknown as PierreEmployeeProfile;
}

const roster = [emp("e1", "Paul Martin"), emp("e2", "Paul Durand"), emp("e3", "Marie Curie")];

describe("P16E §7.A — jamais de match partiel deviné", () => {
  it("« Paul » avec plusieurs Paul ⇒ null (ambigu, on désambiguïse)", () => {
    expect(findPierreEmployeeByName(roster, "Paul")).toBeNull();
  });

  it("un nom complet unique se résout", () => {
    expect(findPierreEmployeeByName(roster, "Paul Martin")?.id).toBe("e1");
    expect(findPierreEmployeeByName(roster, "Marie Curie")?.id).toBe("e3");
  });

  it("un prénom qui ne désigne qu'UN salarié distinct se résout", () => {
    expect(findPierreEmployeeByName(roster, "Marie")?.id).toBe("e3"); // une seule Marie
  });

  it("des homonymes exacts ⇒ null (jamais le premier)", () => {
    const dup = [emp("a", "Jean Bon"), emp("b", "Jean Bon")];
    expect(findPierreEmployeeByName(dup, "Jean Bon")).toBeNull();
  });

  it("nom vide / inconnu ⇒ null", () => {
    expect(findPierreEmployeeByName(roster, "   ")).toBeNull();
    expect(findPierreEmployeeByName(roster, "Zoe Inconnue")).toBeNull();
  });

  it("insensible à la casse pour un match unique", () => {
    expect(findPierreEmployeeByName(roster, "marie curie")?.id).toBe("e3");
  });
});
