// TECH-05 — CloneADN Global / Enterprise Memory — Tests
// 45 tests couvrant : types, defaults, validation, snapshot, storage, accès, bridge.
//
// Tests purs : aucun appel Supabase, OpenAI, Anthropic, Stripe.
// Aucune preuve modifiée. Aucune écriture go-live-proofs.local.json.

import { describe, it, expect, beforeEach } from "vitest";

import {
  buildEmptyGlobalEnterpriseMemory,
  buildDemoGlobalEnterpriseMemory,
  DEFAULT_ENTERPRISE_MEMORY_VERSION,
  DEFAULT_ENTERPRISE_TONE_PROFILE,
  DEFAULT_ENTERPRISE_COMMUNICATION_PROFILE,
} from "../global-enterprise-memory-defaults";

import {
  validateGlobalEnterpriseMemory,
  computeCoverageScore,
} from "../global-enterprise-memory-validation";

import {
  buildGlobalEnterpriseMemorySnapshot,
} from "../global-enterprise-memory-snapshot";

import {
  setEnterpriseMemory,
  getEnterpriseMemory,
  patchEnterpriseMemory,
  deleteEnterpriseMemory,
  clearEnterpriseMemoryStore,
  getMemoryItemsForEmployee,
  getHumansForEmployee,
  getOrCreateEnterpriseMemory,
  listEnterpriseMemoryIds,
} from "../global-enterprise-memory-storage";

import {
  PIERRE_DEFAULT_ACCESS_PROFILE,
  buildEmployeeAccessProfile,
  canEmployeeReadCategory,
  canEmployeeAccessDomain,
  filterReadableCategories,
  HR_READABLE_CATEGORIES,
  STANDARD_READABLE_CATEGORIES,
} from "../employee-adn-access";

import {
  buildPierreEnterpriseContextDirect,
  extractActiveRulesForPierre,
  isPierreValidationRequired,
  getRequiredApproversForDomain,
} from "../pierre-adn-bridge";

import type { GlobalEnterpriseMemory } from "../global-enterprise-memory";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeValidMemory(companyId = "test_company"): GlobalEnterpriseMemory {
  const m = buildEmptyGlobalEnterpriseMemory(companyId);
  m.identity.company_name = "Test Corp";
  m.identity.country = "FR";
  m.identity.language = "fr";
  m.identity.timezone = "Europe/Paris";
  return m;
}

// ── 1. Types — constants ──────────────────────────────────────────────────────

describe("tech-05 — constants", () => {
  it("1. DEFAULT_ENTERPRISE_MEMORY_VERSION est défini", () => {
    expect(DEFAULT_ENTERPRISE_MEMORY_VERSION).toBeTruthy();
    expect(typeof DEFAULT_ENTERPRISE_MEMORY_VERSION).toBe("string");
  });

  it("2. DEFAULT_ENTERPRISE_TONE_PROFILE a un default_tone", () => {
    expect(DEFAULT_ENTERPRISE_TONE_PROFILE.default_tone).toBeTruthy();
  });

  it("3. DEFAULT_ENTERPRISE_COMMUNICATION_PROFILE a un default_channel", () => {
    expect(DEFAULT_ENTERPRISE_COMMUNICATION_PROFILE.default_channel).toBeTruthy();
  });
});

// ── 2. Defaults — buildEmptyGlobalEnterpriseMemory ────────────────────────────

describe("tech-05 — buildEmptyGlobalEnterpriseMemory", () => {
  it("4. retourne un objet avec les champs requis", () => {
    const m = buildEmptyGlobalEnterpriseMemory("cmp_001");
    expect(m.memory_id).toBeTruthy();
    expect(m.company_id).toBe("cmp_001");
    expect(m.identity).toBeDefined();
    expect(m.tone).toBeDefined();
    expect(m.communication).toBeDefined();
  });

  it("5. listes vides par défaut", () => {
    const m = buildEmptyGlobalEnterpriseMemory("cmp_002");
    expect(m.humans.humans).toHaveLength(0);
    expect(m.sites).toHaveLength(0);
    expect(m.documents).toHaveLength(0);
    expect(m.rules).toHaveLength(0);
    expect(m.memory_items).toHaveLength(0);
  });

  it("6. metadata.is_demo = false", () => {
    const m = buildEmptyGlobalEnterpriseMemory("cmp_003");
    expect(m.metadata.is_demo).toBe(false);
  });

  it("7. validation_circuits contient au moins un circuit par défaut", () => {
    const m = buildEmptyGlobalEnterpriseMemory("cmp_004");
    expect(m.validation_circuits.length).toBeGreaterThan(0);
  });

  it("8. writable_categories est vide (V1)", () => {
    const m = buildEmptyGlobalEnterpriseMemory("cmp_005");
    for (const profile of m.employee_access_profiles) {
      expect(profile.writable_categories).toHaveLength(0);
    }
  });
});

// ── 3. Defaults — buildDemoGlobalEnterpriseMemory ────────────────────────────

describe("tech-05 — buildDemoGlobalEnterpriseMemory", () => {
  const demo = buildDemoGlobalEnterpriseMemory("demo_co");

  it("9. metadata.is_demo = true", () => {
    expect(demo.metadata.is_demo).toBe(true);
  });

  it("10. demo contient au moins 2 humains fictifs", () => {
    expect(demo.humans.humans.length).toBeGreaterThanOrEqual(2);
  });

  it("11. demo — les humains ne sont PAS des employés IA CloneStore", () => {
    // Les human_id ne doivent pas contenir "pierre", "emma", "lucas", "sophie"
    for (const human of demo.humans.humans) {
      expect(human.human_id.toLowerCase()).not.toMatch(/^(pierre|emma|lucas|sophie)$/);
    }
  });

  it("12. demo contient au moins 2 sites", () => {
    expect(demo.sites.length).toBeGreaterThanOrEqual(2);
  });

  it("13. demo contient au moins 2 départements", () => {
    expect(demo.departments.length).toBeGreaterThanOrEqual(2);
  });

  it("14. demo contient au moins 3 memory_items", () => {
    expect(demo.memory_items.length).toBeGreaterThanOrEqual(3);
  });

  it("15. demo a un profil d'accès pour Pierre", () => {
    const pierre = demo.employee_access_profiles.find(p => p.employee_slug === "pierre");
    expect(pierre).toBeDefined();
    expect(pierre?.can_access_humans).toBe(true);
  });
});

// ── 4. Validation ─────────────────────────────────────────────────────────────

describe("tech-05 — validateGlobalEnterpriseMemory", () => {
  it("16. mémoire valide → ok = true", () => {
    const m = makeValidMemory();
    const report = validateGlobalEnterpriseMemory(m);
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it("17. company_name vide → erreur R03", () => {
    const m = makeValidMemory();
    m.identity.company_name = "";
    const report = validateGlobalEnterpriseMemory(m);
    expect(report.ok).toBe(false);
    expect(report.errors.some(e => e.code === "R03")).toBe(true);
  });

  it("18. country invalide → erreur R04", () => {
    const m = makeValidMemory();
    m.identity.country = "France";  // doit être 2 lettres majuscules
    const report = validateGlobalEnterpriseMemory(m);
    expect(report.errors.some(e => e.code === "R04")).toBe(true);
  });

  it("19. language invalide → erreur R05", () => {
    const m = makeValidMemory();
    m.identity.language = "French";  // doit être 2 lettres minuscules
    const report = validateGlobalEnterpriseMemory(m);
    expect(report.errors.some(e => e.code === "R05")).toBe(true);
  });

  it("20. human_id dupliqué → erreur R13", () => {
    const m = makeValidMemory();
    const human = {
      human_id: "h001",
      full_name: "Test Human",
      employment_status: "active" as const,
      permissions: [],
      sensitive_notes_allowed: false,
      document_refs: [],
      tags: [],
    };
    m.humans.humans = [human, { ...human }];
    m.humans.total_count = 2;
    const report = validateGlobalEnterpriseMemory(m);
    expect(report.errors.some(e => e.code === "R13")).toBe(true);
  });

  it("21. confidence > 1.0 → erreur R20", () => {
    const m = makeValidMemory();
    m.memory_items.push({
      item_id: "item_bad",
      category: "identity",
      content: "test",
      source: "explicit",
      scope: "global",
      stability: "stable",
      sensitivity: "internal",
      confidence: 1.5,  // invalide
      applies_to_employee_slugs: [],
      expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const report = validateGlobalEnterpriseMemory(m);
    expect(report.errors.some(e => e.code === "R20")).toBe(true);
  });

  it("22. rapport contient les compteurs corrects", () => {
    const m = buildDemoGlobalEnterpriseMemory();
    const report = validateGlobalEnterpriseMemory(m);
    expect(report.human_count).toBe(m.humans.humans.length);
    expect(report.site_count).toBe(m.sites.length);
    expect(report.department_count).toBe(m.departments.length);
    expect(report.memory_item_count).toBe(m.memory_items.length);
  });

  it("23. coverage_score est entre 0 et 100", () => {
    const m = buildDemoGlobalEnterpriseMemory();
    const report = validateGlobalEnterpriseMemory(m);
    expect(report.coverage_score).toBeGreaterThanOrEqual(0);
    expect(report.coverage_score).toBeLessThanOrEqual(100);
  });
});

// ── 5. Snapshot ───────────────────────────────────────────────────────────────

describe("tech-05 — buildGlobalEnterpriseMemorySnapshot", () => {
  it("24. snapshot contient les identifiants", () => {
    const m = buildDemoGlobalEnterpriseMemory("snap_co");
    const snap = buildGlobalEnterpriseMemorySnapshot(m);
    expect(snap.memory_id).toBe(m.memory_id);
    expect(snap.company_id).toBe(m.company_id);
  });

  it("25. snapshot.is_demo correspond à metadata.is_demo", () => {
    const demo = buildDemoGlobalEnterpriseMemory();
    expect(buildGlobalEnterpriseMemorySnapshot(demo).is_demo).toBe(true);
    const real = makeValidMemory();
    expect(buildGlobalEnterpriseMemorySnapshot(real).is_demo).toBe(false);
  });

  it("26. snapshot.human_count est cohérent avec les humains", () => {
    const m = buildDemoGlobalEnterpriseMemory();
    const snap = buildGlobalEnterpriseMemorySnapshot(m);
    expect(snap.human_count).toBe(m.humans.humans.length);
  });

  it("27. snapshot.overall_coverage est entre 0 et 100", () => {
    const m = buildDemoGlobalEnterpriseMemory();
    const snap = buildGlobalEnterpriseMemorySnapshot(m);
    expect(snap.overall_coverage).toBeGreaterThanOrEqual(0);
    expect(snap.overall_coverage).toBeLessThanOrEqual(100);
  });

  it("28. snapshot.generated_at est une ISO date valide", () => {
    const m = makeValidMemory();
    const snap = buildGlobalEnterpriseMemorySnapshot(m);
    expect(() => new Date(snap.generated_at)).not.toThrow();
    expect(new Date(snap.generated_at).getTime()).toBeGreaterThan(0);
  });
});

// ── 6. Storage ────────────────────────────────────────────────────────────────

describe("tech-05 — storage", () => {
  beforeEach(() => {
    clearEnterpriseMemoryStore();
  });

  it("29. setEnterpriseMemory puis getEnterpriseMemory retourne la même mémoire", () => {
    const m = makeValidMemory("store_co");
    setEnterpriseMemory(m);
    const retrieved = getEnterpriseMemory("store_co");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.company_id).toBe("store_co");
  });

  it("30. getEnterpriseMemory retourne null si company_id inexistant", () => {
    expect(getEnterpriseMemory("unknown_co")).toBeNull();
  });

  it("31. getOrCreateEnterpriseMemory crée une mémoire vide si absente", () => {
    const m = getOrCreateEnterpriseMemory("new_co");
    expect(m.company_id).toBe("new_co");
    expect(m.memory_items).toHaveLength(0);
  });

  it("32. patchEnterpriseMemory met à jour les champs patchés", () => {
    const m = makeValidMemory("patch_co");
    setEnterpriseMemory(m);
    const patched = patchEnterpriseMemory("patch_co", {
      identity: { company_name: "Patched Corp" },
    });
    expect(patched.identity.company_name).toBe("Patched Corp");
    expect(patched.identity.country).toBe(m.identity.country);  // non modifié
  });

  it("33. deleteEnterpriseMemory supprime la mémoire", () => {
    const m = makeValidMemory("del_co");
    setEnterpriseMemory(m);
    deleteEnterpriseMemory("del_co");
    expect(getEnterpriseMemory("del_co")).toBeNull();
  });

  it("34. listEnterpriseMemoryIds retourne les company_ids stockés", () => {
    setEnterpriseMemory(makeValidMemory("co_a"));
    setEnterpriseMemory(makeValidMemory("co_b"));
    const ids = listEnterpriseMemoryIds();
    expect(ids).toContain("co_a");
    expect(ids).toContain("co_b");
  });
});

// ── 7. Employee ADN Access ────────────────────────────────────────────────────

describe("tech-05 — employee-adn-access", () => {
  it("35. PIERRE_DEFAULT_ACCESS_PROFILE a employee_slug = 'pierre'", () => {
    expect(PIERRE_DEFAULT_ACCESS_PROFILE.employee_slug).toBe("pierre");
  });

  it("36. PIERRE_DEFAULT_ACCESS_PROFILE.writable_categories est vide (V1)", () => {
    expect(PIERRE_DEFAULT_ACCESS_PROFILE.writable_categories).toHaveLength(0);
  });

  it("37. PIERRE_DEFAULT_ACCESS_PROFILE.write_requires_human_validation = true", () => {
    expect(PIERRE_DEFAULT_ACCESS_PROFILE.write_requires_human_validation).toBe(true);
  });

  it("38. buildEmployeeAccessProfile respecte les contraintes V1", () => {
    const profile = buildEmployeeAccessProfile({
      employee_slug: "emma",
      readable_categories: STANDARD_READABLE_CATEGORIES,
      can_access_humans: false,
      can_access_documents: false,
      can_access_sensitive: false,
      allowed_domains: [],
    });
    expect(profile.writable_categories).toHaveLength(0);
    expect(profile.write_requires_human_validation).toBe(true);
  });

  it("39. canEmployeeReadCategory retourne true pour une catégorie autorisée", () => {
    const result = canEmployeeReadCategory(PIERRE_DEFAULT_ACCESS_PROFILE, "identity");
    expect(result).toBe(true);
  });

  it("40. HR_READABLE_CATEGORIES inclut 'humans'", () => {
    expect(HR_READABLE_CATEGORIES).toContain("humans");
  });

  it("41. filterReadableCategories filtre correctement", () => {
    const profile = buildEmployeeAccessProfile({
      employee_slug: "test",
      readable_categories: ["identity", "tone"],
      can_access_humans: false,
      can_access_documents: false,
      can_access_sensitive: false,
      allowed_domains: [],
    });
    const result = filterReadableCategories(profile, ["identity", "tone", "finance"]);
    expect(result).toContain("identity");
    expect(result).toContain("tone");
    expect(result).not.toContain("finance");
  });
});

// ── 8. Pierre ADN Bridge ──────────────────────────────────────────────────────

describe("tech-05 — pierre-adn-bridge", () => {
  it("42. buildPierreEnterpriseContextDirect retourne company_name", () => {
    const m = buildDemoGlobalEnterpriseMemory();
    const ctx = buildPierreEnterpriseContextDirect(m);
    expect(ctx.company_name).toBeTruthy();
  });

  it("43. buildPierreEnterpriseContextDirect ne retourne pas les items restricted", () => {
    const m = makeValidMemory("bridge_co");
    m.memory_items.push({
      item_id: "item_restricted",
      category: "identity",
      content: "Secret absolu",
      source: "explicit",
      scope: "global",
      stability: "permanent",
      sensitivity: "restricted",  // doit être filtré
      confidence: 1.0,
      applies_to_employee_slugs: [],
      expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    m.employee_access_profiles.push(PIERRE_DEFAULT_ACCESS_PROFILE);
    const ctx = buildPierreEnterpriseContextDirect(m);
    const hasRestricted = ctx.accessible_memory_items.some(i => i.sensitivity === "restricted");
    expect(hasRestricted).toBe(false);
  });

  it("44. isPierreValidationRequired retourne true pour un domaine couvert", () => {
    const m = buildDemoGlobalEnterpriseMemory();
    const required = isPierreValidationRequired(m, "hr");
    expect(typeof required).toBe("boolean");
    // Au moins un circuit de validation doit couvrir 'hr' ou '*'
    // En demo, le circuit_rh_demo couvre 'hr'
    expect(required).toBe(true);
  });

  it("45. extractActiveRulesForPierre retourne un tableau de strings", () => {
    const m = buildDemoGlobalEnterpriseMemory();
    const rules = extractActiveRulesForPierre(m);
    expect(Array.isArray(rules)).toBe(true);
    // Chaque règle doit être une string
    for (const rule of rules) {
      expect(typeof rule).toBe("string");
    }
  });
});
