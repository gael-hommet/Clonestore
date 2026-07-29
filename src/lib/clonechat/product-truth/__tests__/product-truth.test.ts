// src/lib/clonechat/product-truth/__tests__/product-truth.test.ts
//
// BLOC 1 — GATE du Product Truth Engine.
// Couverture (toutes pages actives / employés affichés / prix actifs / limites publiques),
// intégrité (0 contradiction active, 0 stale, 0 date périmée), enveloppe complète, et projection
// FIDÈLE aux sources RÉELLES (jamais de valeur inventée).

import { describe, it, expect } from "vitest";
import {
  productTruth, activeProductTruth, truthsForArea, getTruthById, productTruthVersion,
  findActiveContradictions, findStaleTruths, findSupersededDateReferences, invalidateProductTruthCache,
} from "../registry";
import { isProductionServable } from "../types";
import { ROUTE_REGISTRY } from "@/lib/nav/route-registry";
import { PUBLIC_EMPLOYEES } from "@/lib/catalog/public-catalog";
import { SUPPORTED_LAUNCH_COUNTRIES } from "@/lib/clonestore/pricing/country-pricing";
import { getCloneStoreTechnologyDefinitions } from "@/lib/clonestore/technologies/registry";

describe("BLOC 1 — Product Truth Engine : enveloppe & intégrité", () => {
  invalidateProductTruthCache();
  const all = productTruth();
  const active = activeProductTruth();

  it("chaque vérité porte l'enveloppe complète et non vide", () => {
    for (const t of all) {
      expect(t.id, "id").toBeTruthy();
      expect(t.area, "area").toBeTruthy();
      expect(t.status, "status").toBeTruthy();
      expect(t.value.trim().length, `value:${t.id}`).toBeGreaterThan(0);
      expect(t.version, `version:${t.id}`).toMatch(/^[0-9a-f]{8}$/);
      expect(t.source, `source:${t.id}`).toMatch(/^src\//);
      expect(t.owner, `owner:${t.id}`).toBeTruthy();
      expect(t.environment, `env:${t.id}`).toBeTruthy();
      expect(t.evidence.trim().length, `evidence:${t.id}`).toBeGreaterThan(0);
      expect(t.certainty, `certainty:${t.id}`).toBeTruthy();
      expect(t.key, `key:${t.id}`).toBeTruthy();
    }
  });

  it("les identifiants sont uniques", () => {
    const ids = all.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("0 contradiction active", () => {
    expect(findActiveContradictions()).toEqual([]);
  });

  it("0 vérité périmée (stale) à une date de référence après le lancement", () => {
    // À une date bien après le lancement mais avant la fermeture fondateur : rien n'est encore périmé.
    expect(findStaleTruths("2026-08-20T00:00:00+02:00")).toEqual([]);
  });

  it("la fermeture fondateur devient périmée APRÈS le 31 août 2026 (le moteur de staleness fonctionne)", () => {
    const stale = findStaleTruths("2026-09-05T00:00:00+02:00");
    expect(stale.map((t) => t.id)).toContain("launch:founder_close");
  });

  it("aucune vérité active ne référence la date supersédée du 5 août 2026", () => {
    expect(findSupersededDateReferences()).toEqual([]);
  });

  it("Production ne sert que des statuts active/gated", () => {
    for (const t of active) {
      expect(isProductionServable(t), `${t.id} status=${t.status}`).toBe(true);
      expect(["active", "gated"]).toContain(t.status);
    }
  });

  it("la version globale est déterministe et stable entre deux lectures", () => {
    const v1 = productTruthVersion();
    invalidateProductTruthCache();
    const v2 = productTruthVersion();
    expect(v1).toBe(v2);
    expect(v1).toMatch(/^pt-[0-9a-f]{8}$/);
  });
});

describe("BLOC 1 — couverture des vérités actives obligatoires", () => {
  invalidateProductTruthCache();

  it("toutes les routes actives/gated du registre réel sont couvertes", () => {
    const covered = new Set(truthsForArea("route").map((t) => t.key));
    const required = ROUTE_REGISTRY.filter((r) => r.status === "active" || r.status === "gated").map((r) => r.path);
    const missing = required.filter((p) => !covered.has(p));
    expect(missing, `routes non couvertes: ${missing.join(", ")}`).toEqual([]);
  });

  it("tous les employés affichés du catalogue réel sont couverts", () => {
    const covered = new Set(truthsForArea("employee").map((t) => t.key));
    const missing = PUBLIC_EMPLOYEES.filter((e) => !covered.has(e.slug)).map((e) => e.slug);
    expect(missing).toEqual([]);
  });

  it("tous les prix actifs par pays de lancement sont couverts (FR/BE/LU/CH)", () => {
    const covered = new Set(truthsForArea("pricing").map((t) => t.key));
    for (const c of SUPPORTED_LAUNCH_COUNTRIES) expect(covered.has(c), `prix ${c}`).toBe(true);
    // Valeurs réelles présentes.
    const catalog = truthsForArea("pricing").map((t) => t.value).join(" ");
    expect(catalog).toMatch(/449/);
    expect(catalog).toMatch(/499/);
  });

  it("toutes les technologies réelles sont couvertes (CloneVoice = beta, non servie active)", () => {
    const techByKey = new Map(truthsForArea("technology").filter((t) => t.key !== "overview").map((t) => [t.key, t]));
    for (const d of getCloneStoreTechnologyDefinitions()) {
      expect(techByKey.has(d.slug), `techno ${d.slug}`).toBe(true);
    }
    // CloneVoice est en beta → jamais servie comme vérité active établie.
    const voice = techByKey.get("clonevoice");
    expect(voice?.status).toBe("beta");
    expect(isProductionServable(voice!)).toBe(false);
  });

  it("les limites publiques obligatoires de Pierre sont couvertes (décisions strictement humaines)", () => {
    const humanOnly = getTruthById("limitation:pierre_human_only");
    expect(humanOnly).toBeTruthy();
    expect(humanOnly!.value).toMatch(/licenciement/i);
    expect(humanOnly!.value).toMatch(/(éthique|ethique)/i);
    expect(isProductionServable(humanOnly!)).toBe(true);
  });

  it("la date de lancement active est bien le 12 août 2026", () => {
    const launch = getTruthById("launch:demo_open");
    expect(launch).toBeTruthy();
    expect(launch!.value).toMatch(/12 août 2026/);
    expect(launch!.validFrom).toBe("2026-08-12T00:00:00+02:00");
  });

  it("la vision CloneStore et CloneChat est couverte et active", () => {
    const vs = truthsForArea("vision");
    expect(vs.map((t) => t.key).sort()).toEqual(["clonechat", "clonestore"]);
    for (const t of vs) expect(t.status).toBe("active");
  });
});
