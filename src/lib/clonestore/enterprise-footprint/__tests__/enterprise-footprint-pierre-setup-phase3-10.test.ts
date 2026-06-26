// src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-pierre-setup-phase3-10.test.ts
// PHASE 3.10 — Pierre Setup Reads Enterprise Footprint — Tests QA
//
// Vérifie :
//   - le bridge Pierre Setup (structure, invariants, pas de Supabase, pas de pierre moteur)
//   - le QA module Pierre Setup
//   - l'intégration dans /agents/pierre/setup
//   - la cascade de régression PHASE 3.9 → 3.1, 2.9, TECH-11, pfinal02
//
// Aucun write DB. Aucun appel réseau. Aucun runtime Pierre.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../../..");

function readSrc(relativePath: string): string {
  const full = resolve(ROOT, "src", relativePath);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

function readDocs(filename: string): string {
  const full = resolve(ROOT, "docs", filename);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Bridge pierre-setup existe
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.10 — Bridge Pierre Setup", () => {
  const bridgePath = "lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-setup.ts";
  const bridge = readSrc(bridgePath);

  it("1. enterprise-footprint-pierre-setup.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", bridgePath))).toBe(true);
  });

  it("3. bridge setup contient loadPierreSetupEnterpriseFootprint", () => {
    expect(bridge).toContain("loadPierreSetupEnterpriseFootprint");
  });

  it("4. bridge setup contient buildPierreSetupFootprintSummary", () => {
    expect(bridge).toContain("buildPierreSetupFootprintSummary");
  });

  it("5. bridge setup contient buildPierreSetupFootprintCards", () => {
    expect(bridge).toContain("buildPierreSetupFootprintCards");
  });

  it("6. bridge setup contient buildPierreSetupFootprintRecommendations", () => {
    expect(bridge).toContain("buildPierreSetupFootprintRecommendations");
  });

  it("7. bridge setup utilise loadEnterpriseFootprintForCockpit", () => {
    expect(bridge).toContain("loadEnterpriseFootprintForCockpit");
  });

  it("8. bridge setup utilise buildPierreEnterpriseFootprintContext", () => {
    expect(bridge).toContain("buildPierreEnterpriseFootprintContext");
  });

  it("9. bridge setup utilise validatePierreEnterpriseFootprintContext", () => {
    expect(bridge).toContain("validatePierreEnterpriseFootprintContext");
  });

  it("10. bridge setup ne contient pas Supabase import", () => {
    expect(bridge).not.toContain("@supabase/supabase-js");
    expect(bridge).not.toContain("createClient");
  });

  it("11. bridge setup ne contient pas insert/update/delete/upsert DB", () => {
    expect(bridge).not.toMatch(/\.insert\s*\(/);
    expect(bridge).not.toMatch(/\.update\s*\(/);
    expect(bridge).not.toMatch(/\.delete\s*\(/);
    expect(bridge).not.toMatch(/\.upsert\s*\(/);
  });

  it("12. bridge setup ne contient pas import src/lib/pierre (import réel)", () => {
    // Vérifie qu'il n'y a pas d'import réel vers le moteur Pierre
    // Les commentaires mentionnant l'invariant sont autorisés
    expect(bridge).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
    expect(bridge).not.toMatch(/^import\s+.*from\s+["'].*\/pierre\//m);
  });

  it("13. bridge setup ne contient pas runtime execution (processCloneOSCommand / executeTask / runPierre)", () => {
    expect(bridge).not.toContain("processCloneOSCommand");
    expect(bridge).not.toContain("executeTask");
    expect(bridge).not.toContain("runPierre");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — QA module pierre-setup existe
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.10 — QA Module Pierre Setup", () => {
  const qaPath = "lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-setup-qa.ts";
  const qa = readSrc(qaPath);

  it("2. enterprise-footprint-pierre-setup-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", qaPath))).toBe(true);
  });

  it("23. QA module contient buildPierreSetupFootprintQaChecklist", () => {
    expect(qa).toContain("buildPierreSetupFootprintQaChecklist");
  });

  it("24. QA module contient no_db_write", () => {
    expect(qa).toContain("no_db_write");
  });

  it("25. QA module contient no_pierre_engine_import", () => {
    expect(qa).toContain("no_pierre_engine_import");
  });

  it("26. QA module contient no_runtime_execution", () => {
    expect(qa).toContain("no_runtime_execution");
  });

  it("27. QA module ne contient pas Supabase createClient (import réel)", () => {
    // Vérifie l'absence d'imports Supabase réels — les mentions dans des strings QA sont autorisées
    expect(qa).not.toMatch(/^import\s+.*createClient.*from\s+["']@supabase/m);
    expect(qa).not.toMatch(/^import\s+.*from\s+["']@supabase\/supabase-js["']/m);
  });

  it("28. QA module ne contient pas insert/update/delete/upsert", () => {
    expect(qa).not.toMatch(/\.insert\s*\(/);
    expect(qa).not.toMatch(/\.update\s*\(/);
    expect(qa).not.toMatch(/\.delete\s*\(/);
    expect(qa).not.toMatch(/\.upsert\s*\(/);
  });

  it("29. QA module ne contient pas import src/lib/pierre (import réel)", () => {
    // Vérifie l'absence d'imports réels vers le moteur Pierre
    // Les mentions dans des strings how_to_verify sont autorisées
    expect(qa).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
    expect(qa).not.toMatch(/^import\s+.*from\s+["'].*\/pierre\//m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Intégration /agents/pierre/setup
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.10 — Intégration /agents/pierre/setup", () => {
  const pagePath = "app/agents/pierre/setup/page.tsx";
  const page = readSrc(pagePath);

  it("14. /agents/pierre/setup mentionne 'Empreinte Entreprise'", () => {
    expect(page).toContain("Empreinte Entreprise");
  });

  it("15. /agents/pierre/setup mentionne 'Lecture seule'", () => {
    expect(page).toContain("Lecture seule");
  });

  it("16. /agents/pierre/setup mentionne 'Aucune action exécutée'", () => {
    expect(page).toContain("Aucune action exécutée");
  });

  it("17. /agents/pierre/setup contient /profile/onboarding", () => {
    expect(page).toContain("/profile/onboarding");
  });

  it("18. /agents/pierre/setup contient /profile/agents#empreinte-entreprise", () => {
    expect(page).toContain("/profile/agents#empreinte-entreprise");
  });

  it("19. /agents/pierre/setup utilise le bridge setup (loadPierreSetupEnterpriseFootprint)", () => {
    expect(page).toContain("loadPierreSetupEnterpriseFootprint");
  });

  it("20. /agents/pierre/setup ne contient pas Supabase import dédié footprint", () => {
    // La page n'importe pas supabase directement pour la partie footprint
    const hasFootprintSupabase =
      page.includes("createClient") &&
      page.includes("enterprise-footprint");
    expect(hasFootprintSupabase).toBe(false);
  });

  it("21. /agents/pierre/setup ne contient pas insert/upsert direct pour footprint", () => {
    expect(page).not.toMatch(/footprint.*\.insert\s*\(/);
    expect(page).not.toMatch(/footprint.*\.upsert\s*\(/);
  });

  it("22. /agents/pierre/setup ne contient pas runtime execution ajouté pour footprint", () => {
    expect(page).not.toContain("processCloneOSCommand");
    expect(page).not.toContain("runPierre");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Index exports PHASE 3.10
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.10 — Index exports", () => {
  const index = readSrc("lib/clonestore/enterprise-footprint/index.ts");

  it("index.ts exporte PierreSetupFootprintStatus", () => {
    expect(index).toContain("PierreSetupFootprintStatus");
  });

  it("index.ts exporte PierreSetupFootprintReadResult", () => {
    expect(index).toContain("PierreSetupFootprintReadResult");
  });

  it("index.ts exporte loadPierreSetupEnterpriseFootprint", () => {
    expect(index).toContain("loadPierreSetupEnterpriseFootprint");
  });

  it("index.ts exporte buildPierreSetupFootprintQaChecklist", () => {
    expect(index).toContain("buildPierreSetupFootprintQaChecklist");
  });

  it("index.ts exporte PierreSetupFootprintQaChecklist", () => {
    expect(index).toContain("PierreSetupFootprintQaChecklist");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Doc PHASE 3.10
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.10 — Documentation", () => {
  const docName = "PHASE_3_10_PIERRE_SETUP_READS_ENTERPRISE_FOOTPRINT.md";
  const doc = readDocs(docName);

  it("30. doc PHASE_3_10 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", docName))).toBe(true);
  });

  it("31. doc mentionne /agents/pierre/setup", () => {
    expect(doc).toContain("/agents/pierre/setup");
  });

  it("32. doc mentionne Enterprise Footprint / Empreinte Entreprise", () => {
    const hasFootprint =
      doc.includes("Enterprise Footprint") ||
      doc.includes("Empreinte Entreprise");
    expect(hasFootprint).toBe(true);
  });

  it("33. doc mentionne PierreEnterpriseFootprintContext", () => {
    expect(doc).toContain("PierreEnterpriseFootprintContext");
  });

  it("34. doc mentionne read-only / lecture seule", () => {
    const hasReadOnly =
      doc.toLowerCase().includes("read-only") ||
      doc.toLowerCase().includes("lecture seule");
    expect(hasReadOnly).toBe(true);
  });

  it("35. doc mentionne PHASE 3.11", () => {
    expect(doc).toContain("3.11");
  });

  it("36. doc ne contient pas la phrase exacte 'public launch go'", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });

  it("37. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });

  it("38. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Régression PHASE 3.9 : cockpit et handoff non cassés
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.10 — Régression PHASE 3.9 (cockpit / handoff non cassés)", () => {
  const cockpit = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-cockpit.ts");
  const handoff = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-handoff.ts");
  const index = readSrc("lib/clonestore/enterprise-footprint/index.ts");

  it("39. Cockpit bridge PHASE 3.9 toujours présent", () => {
    expect(existsSync(resolve(ROOT, "src", "lib/clonestore/enterprise-footprint/enterprise-footprint-cockpit.ts"))).toBe(true);
  });

  it("40. Handoff Pierre PHASE 3.9 toujours présent", () => {
    expect(existsSync(resolve(ROOT, "src", "lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-handoff.ts"))).toBe(true);
  });

  it("41. loadEnterpriseFootprintForCockpit toujours exporté dans index", () => {
    expect(index).toContain("loadEnterpriseFootprintForCockpit");
  });

  it("42. buildPierreEnterpriseFootprintContext toujours exporté dans index", () => {
    expect(index).toContain("buildPierreEnterpriseFootprintContext");
  });

  it("43. validatePierreEnterpriseFootprintContext toujours exporté dans index", () => {
    expect(index).toContain("validatePierreEnterpriseFootprintContext");
  });

  it("44. Cockpit bridge ne contient pas import src/lib/pierre", () => {
    expect(cockpit).not.toContain("@/lib/pierre");
  });

  it("45. Handoff Pierre ne contient pas import src/lib/pierre runtime", () => {
    // Le handoff est design-only, pas d'import moteur
    expect(handoff).not.toContain("processCloneOSCommand");
    expect(handoff).not.toContain("executeTask");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Régression PHASE 3.8 : localstorage non cassé
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.10 — Régression PHASE 3.8 (localStorage non cassé)", () => {
  const ls = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-localstorage.ts");
  const index = readSrc("lib/clonestore/enterprise-footprint/index.ts");

  it("46. enterprise-footprint-localstorage.ts toujours présent", () => {
    expect(existsSync(resolve(ROOT, "src", "lib/clonestore/enterprise-footprint/enterprise-footprint-localstorage.ts"))).toBe(true);
  });

  it("47. loadEnterpriseFootprintFromLocalStorage toujours exporté", () => {
    expect(index).toContain("loadEnterpriseFootprintFromLocalStorage");
  });

  it("48. saveEnterpriseFootprintToLocalStorage toujours exporté", () => {
    expect(index).toContain("saveEnterpriseFootprintToLocalStorage");
  });

  it("49. ENTERPRISE_FOOTPRINT_LOCALSTORAGE_KEY toujours exporté", () => {
    expect(index).toContain("ENTERPRISE_FOOTPRINT_LOCALSTORAGE_KEY");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — Invariant lecture seule total
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.10 — Invariant lecture seule global", () => {
  const bridge = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-setup.ts");
  const qa = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-setup-qa.ts");
  const page = readSrc("app/agents/pierre/setup/page.tsx");

  it("50. Le bridge setup a le champ read_only: true dans le summary", () => {
    expect(bridge).toContain("read_only: true");
  });

  it("51. La page setup a has_footprint dans la condition d'affichage", () => {
    expect(page).toContain("has_footprint");
  });

  it("52. La page setup affiche 'Empreinte Entreprise manquante' dans l'état vide", () => {
    expect(page).toContain("Empreinte Entreprise manquante");
  });

  it("53. Le bridge setup contient un guard SSR (typeof window)", () => {
    expect(bridge).toContain("typeof window");
  });

  it("54. Le bridge setup a un try/catch silencieux (pas de throw brut)", () => {
    expect(bridge).toContain("catch");
    // Le bridge ne doit pas re-throw
    expect(bridge).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*throw/);
  });
});
