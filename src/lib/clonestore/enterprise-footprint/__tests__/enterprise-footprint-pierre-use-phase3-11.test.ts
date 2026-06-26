// src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-pierre-use-phase3-11.test.ts
// PHASE 3.11 — Pierre Use Reads Enterprise Footprint Read-Only — Tests QA
//
// Vérifie :
//   - le bridge Pierre Use (structure, invariants, pas de Supabase, pas de pierre moteur)
//   - le QA module Pierre Use
//   - l'intégration dans /agents/pierre/use
//   - la cascade de régression PHASE 3.10 → 3.1, 2.9, TECH-11, pfinal02
//
// Aucun write DB. Aucun appel réseau. Aucun runtime Pierre. Aucun auto-submit.

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
// BLOC 1 — Bridge pierre-use existe
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.11 — Bridge Pierre Use", () => {
  const bridgePath = "lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-use.ts";
  const bridge = readSrc(bridgePath);

  it("1. enterprise-footprint-pierre-use.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", bridgePath))).toBe(true);
  });

  it("3. bridge use contient loadPierreUseEnterpriseFootprint", () => {
    expect(bridge).toContain("loadPierreUseEnterpriseFootprint");
  });

  it("4. bridge use contient buildPierreUseFootprintSummary", () => {
    expect(bridge).toContain("buildPierreUseFootprintSummary");
  });

  it("5. bridge use contient buildPierreUseFootprintCards", () => {
    expect(bridge).toContain("buildPierreUseFootprintCards");
  });

  it("6. bridge use contient buildPierreUseFootprintWarnings", () => {
    expect(bridge).toContain("buildPierreUseFootprintWarnings");
  });

  it("7. bridge use contient buildPierreUseFootprintMissionSuggestions", () => {
    expect(bridge).toContain("buildPierreUseFootprintMissionSuggestions");
  });

  it("8. bridge use utilise loadEnterpriseFootprintForCockpit", () => {
    expect(bridge).toContain("loadEnterpriseFootprintForCockpit");
  });

  it("9. bridge use utilise buildPierreEnterpriseFootprintContext", () => {
    expect(bridge).toContain("buildPierreEnterpriseFootprintContext");
  });

  it("10. bridge use utilise validatePierreEnterpriseFootprintContext", () => {
    expect(bridge).toContain("validatePierreEnterpriseFootprintContext");
  });

  it("11. bridge use ne contient pas Supabase import (réel)", () => {
    expect(bridge).not.toMatch(/^import\s+.*from\s+["']@supabase\/supabase-js["']/m);
    expect(bridge).not.toMatch(/^import\s+.*createClient.*from/m);
  });

  it("12. bridge use ne contient pas insert/update/delete/upsert DB", () => {
    expect(bridge).not.toMatch(/\.insert\s*\(/);
    expect(bridge).not.toMatch(/\.update\s*\(/);
    expect(bridge).not.toMatch(/\.delete\s*\(/);
    expect(bridge).not.toMatch(/\.upsert\s*\(/);
  });

  it("13. bridge use ne contient pas import src/lib/pierre (réel)", () => {
    expect(bridge).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
    expect(bridge).not.toMatch(/^import\s+.*from\s+["'].*\/pierre\//m);
  });

  it("14. bridge use ne contient pas runtime execution", () => {
    expect(bridge).not.toContain("processCloneOSCommand");
    expect(bridge).not.toContain("executeTask");
    expect(bridge).not.toContain("runPierre");
  });

  it("15. bridge use contient plan_only", () => {
    expect(bridge).toContain("plan_only");
  });

  it("16. toutes les suggestions sont plan_only: true dans le code", () => {
    // Vérifier que plan_only: true apparaît (et jamais plan_only: false)
    expect(bridge).toContain("plan_only: true");
    expect(bridge).not.toContain("plan_only: false");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — QA module pierre-use existe
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.11 — QA Module Pierre Use", () => {
  const qaPath = "lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-use-qa.ts";
  const qa = readSrc(qaPath);

  it("2. enterprise-footprint-pierre-use-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", qaPath))).toBe(true);
  });

  it("28. QA module contient buildPierreUseFootprintQaChecklist", () => {
    expect(qa).toContain("buildPierreUseFootprintQaChecklist");
  });

  it("29. QA module contient no_db_write", () => {
    expect(qa).toContain("no_db_write");
  });

  it("30. QA module contient no_pierre_engine_import", () => {
    expect(qa).toContain("no_pierre_engine_import");
  });

  it("31. QA module contient no_runtime_execution", () => {
    expect(qa).toContain("no_runtime_execution");
  });

  it("32. QA module contient no_auto_submit", () => {
    expect(qa).toContain("no_auto_submit");
  });

  it("33. QA module ne contient pas Supabase createClient (réel)", () => {
    expect(qa).not.toMatch(/^import\s+.*createClient.*from\s+["']@supabase/m);
    expect(qa).not.toMatch(/^import\s+.*from\s+["']@supabase\/supabase-js["']/m);
  });

  it("34. QA module ne contient pas insert/update/delete/upsert", () => {
    expect(qa).not.toMatch(/\.insert\s*\(/);
    expect(qa).not.toMatch(/\.update\s*\(/);
    expect(qa).not.toMatch(/\.delete\s*\(/);
    expect(qa).not.toMatch(/\.upsert\s*\(/);
  });

  it("35. QA module ne contient pas import src/lib/pierre (réel)", () => {
    expect(qa).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
    expect(qa).not.toMatch(/^import\s+.*from\s+["'].*\/pierre\//m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Intégration /agents/pierre/use
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.11 — Intégration /agents/pierre/use", () => {
  const pagePath = "app/agents/pierre/use/page.tsx";
  const page = readSrc(pagePath);

  it("17. /agents/pierre/use mentionne 'Empreinte Entreprise' ou 'Contexte Entreprise'", () => {
    const hasLabel =
      page.includes("Empreinte Entreprise") ||
      page.includes("Contexte Entreprise");
    expect(hasLabel).toBe(true);
  });

  it("18. /agents/pierre/use mentionne 'Lecture seule'", () => {
    expect(page).toContain("Lecture seule");
  });

  it("19. /agents/pierre/use mentionne 'Aucune action exécutée'", () => {
    expect(page).toContain("Aucune action exécutée");
  });

  it("20. /agents/pierre/use mentionne 'Plan-only' ou 'plan-only'", () => {
    const hasPlanOnly =
      page.includes("Plan-only") ||
      page.includes("plan-only") ||
      page.includes("plan_only");
    expect(hasPlanOnly).toBe(true);
  });

  it("21. /agents/pierre/use contient /profile/onboarding", () => {
    expect(page).toContain("/profile/onboarding");
  });

  it("22. /agents/pierre/use contient /agents/pierre/setup", () => {
    expect(page).toContain("/agents/pierre/setup");
  });

  it("23. /agents/pierre/use utilise le bridge use (loadPierreUseEnterpriseFootprint)", () => {
    expect(page).toContain("loadPierreUseEnterpriseFootprint");
  });

  it("24. /agents/pierre/use ne contient pas Supabase import pour footprint", () => {
    // La page n'importe pas supabase directement pour la partie footprint
    const hasFootprintSupabase =
      page.includes("createClient") &&
      page.includes("enterprise-footprint");
    expect(hasFootprintSupabase).toBe(false);
  });

  it("25. /agents/pierre/use ne contient pas insert/upsert direct pour footprint", () => {
    expect(page).not.toMatch(/footprint.*\.insert\s*\(/);
    expect(page).not.toMatch(/footprint.*\.upsert\s*\(/);
  });

  it("26. /agents/pierre/use ne contient pas runtime execution ajouté pour footprint", () => {
    // Aucun appel moteur Pierre ajouté pour la partie footprint
    expect(page).not.toContain("processCloneOSCommand");
    expect(page).not.toContain("runPierre");
  });

  it("27. /agents/pierre/use ne déclenche pas auto-submit depuis suggestions", () => {
    // Les suggestions n'appellent pas onSubmit ou submitMission directement
    // Elles affichent le prompt en lecture seule
    expect(page).not.toMatch(/suggestion.*onSubmit/);
    expect(page).not.toMatch(/suggestion.*submitMission/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Index exports PHASE 3.11
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.11 — Index exports", () => {
  const index = readSrc("lib/clonestore/enterprise-footprint/index.ts");

  it("index.ts exporte PierreUseFootprintStatus", () => {
    expect(index).toContain("PierreUseFootprintStatus");
  });

  it("index.ts exporte PierreUseFootprintReadResult", () => {
    expect(index).toContain("PierreUseFootprintReadResult");
  });

  it("index.ts exporte PierreUseFootprintMissionSuggestion", () => {
    expect(index).toContain("PierreUseFootprintMissionSuggestion");
  });

  it("index.ts exporte loadPierreUseEnterpriseFootprint", () => {
    expect(index).toContain("loadPierreUseEnterpriseFootprint");
  });

  it("index.ts exporte buildPierreUseFootprintQaChecklist", () => {
    expect(index).toContain("buildPierreUseFootprintQaChecklist");
  });

  it("index.ts exporte PierreUseFootprintQaChecklist", () => {
    expect(index).toContain("PierreUseFootprintQaChecklist");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Doc PHASE 3.11
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.11 — Documentation", () => {
  const docName = "PHASE_3_11_PIERRE_USE_READS_ENTERPRISE_FOOTPRINT_READONLY.md";
  const doc = readDocs(docName);

  it("36. doc PHASE_3_11 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", docName))).toBe(true);
  });

  it("37. doc mentionne /agents/pierre/use", () => {
    expect(doc).toContain("/agents/pierre/use");
  });

  it("38. doc mentionne Enterprise Footprint / Empreinte Entreprise", () => {
    const hasFootprint =
      doc.includes("Enterprise Footprint") ||
      doc.includes("Empreinte Entreprise");
    expect(hasFootprint).toBe(true);
  });

  it("39. doc mentionne PierreEnterpriseFootprintContext", () => {
    expect(doc).toContain("PierreEnterpriseFootprintContext");
  });

  it("40. doc mentionne read-only / lecture seule", () => {
    const hasReadOnly =
      doc.toLowerCase().includes("read-only") ||
      doc.toLowerCase().includes("lecture seule");
    expect(hasReadOnly).toBe(true);
  });

  it("41. doc mentionne plan-only", () => {
    const hasPlanOnly =
      doc.toLowerCase().includes("plan-only") ||
      doc.toLowerCase().includes("plan_only");
    expect(hasPlanOnly).toBe(true);
  });

  it("42. doc mentionne PHASE 3.12", () => {
    expect(doc).toContain("3.12");
  });

  it("43. doc ne contient pas la phrase exacte 'public launch go'", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });

  it("44. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });

  it("45. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Régression PHASE 3.10 non cassée
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.11 — Régression PHASE 3.10 (bridge setup non cassé)", () => {
  const setup = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-setup.ts");
  const index = readSrc("lib/clonestore/enterprise-footprint/index.ts");

  it("46. enterprise-footprint-pierre-setup.ts toujours présent", () => {
    expect(existsSync(resolve(ROOT, "src", "lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-setup.ts"))).toBe(true);
  });

  it("47. loadPierreSetupEnterpriseFootprint toujours exporté dans index", () => {
    expect(index).toContain("loadPierreSetupEnterpriseFootprint");
  });

  it("48. /agents/pierre/setup toujours présent", () => {
    expect(existsSync(resolve(ROOT, "src", "app/agents/pierre/setup/page.tsx"))).toBe(true);
  });

  it("49. setup bridge ne contient pas d'import moteur Pierre (réel)", () => {
    expect(setup).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Invariants read-only / plan-only globaux
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.11 — Invariants read-only / plan-only", () => {
  const bridge = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-use.ts");
  const page = readSrc("app/agents/pierre/use/page.tsx");

  it("50. Le bridge use a read_only: true dans le summary", () => {
    expect(bridge).toContain("read_only: true");
  });

  it("51. Toutes les suggestions ont plan_only: true (pas plan_only: false)", () => {
    expect(bridge).toContain("plan_only: true");
    expect(bridge).not.toContain("plan_only: false");
  });

  it("52. La page use affiche 'Empreinte Entreprise manquante' dans l'état vide", () => {
    expect(page).toContain("Empreinte Entreprise manquante");
  });

  it("53. Le bridge use a un guard SSR (typeof window)", () => {
    expect(bridge).toContain("typeof window");
  });

  it("54. Le bridge use a un try/catch silencieux (pas de throw brut)", () => {
    expect(bridge).toContain("catch");
    expect(bridge).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*throw/);
  });

  it("55. La page use n'a pas de auto-submit lié aux suggestions footprint", () => {
    // Les suggestions sont affichées en lecture seule, sans soumettre au moteur
    expect(page).not.toMatch(/suggestion.*\.submit/i);
    expect(page).not.toMatch(/suggestion.*submitMission/);
  });

  it("56. Le CockpitWrapper existant est préservé (comportement submit non modifié)", () => {
    // page.tsx délègue toujours au CockpitWrapper/PierreCockpitShell — non modifié
    expect(page).toContain("CockpitWrapper");
    expect(page).toContain("PierreCockpitShell");
    expect(page).toContain("usePierreCockpit");
  });
});
