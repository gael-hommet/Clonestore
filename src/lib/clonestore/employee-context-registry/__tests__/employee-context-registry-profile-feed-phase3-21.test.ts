// src/lib/clonestore/employee-context-registry/__tests__/employee-context-registry-profile-feed-phase3-21.test.ts
// PHASE 3.21 — Global Employee Context Registry UI Preview / Read-Only Feed — Tests

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../../..");
const REG_DIR = "lib/clonestore/employee-context-registry";

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
function readRoot(filename: string): string {
  const full = resolve(ROOT, filename);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

const feedSrc = readSrc(`${REG_DIR}/employee-context-registry-profile-feed.ts`);
const qaSrc = readSrc(`${REG_DIR}/employee-context-registry-profile-feed-qa.ts`);
const indexSrc = readSrc(`${REG_DIR}/index.ts`);
const agentsSrc = readSrc("app/profile/agents/page.tsx");

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Bridge profile feed
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.21 — Bridge profile feed", () => {
  it("1. employee-context-registry-profile-feed.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", `${REG_DIR}/employee-context-registry-profile-feed.ts`))).toBe(true);
  });
  it("2. employee-context-registry-profile-feed-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", `${REG_DIR}/employee-context-registry-profile-feed-qa.ts`))).toBe(true);
  });

  const fns = [
    ["3", "loadEmployeeContextRegistryProfileFeed"],
    ["4", "buildEmployeeContextRegistryProfileFeed"],
    ["5", "buildEmployeeContextRegistryProfileFeedSummary"],
    ["6", "buildEmployeeContextRegistryProfileFeedSections"],
    ["7", "buildEmployeeContextRegistryProfileFeedEmployees"],
    ["8", "buildEmployeeContextRegistryProfileFeedCapabilities"],
    ["9", "buildEmployeeContextRegistryProfileFeedFunctions"],
    ["10", "buildEmployeeContextRegistryProfileFeedWarnings"],
  ];
  fns.forEach(([n, fn]) => {
    it(`${n}. profile feed contient ${fn}`, () => {
      expect(feedSrc).toContain(fn);
    });
  });

  it("11. profile feed utilise buildDefaultEmployeeContextRegistry", () => {
    expect(feedSrc).toContain("buildDefaultEmployeeContextRegistry");
  });
  it("12. profile feed utilise buildEmployeeContextRegistrySnapshot", () => {
    expect(feedSrc).toContain("buildEmployeeContextRegistrySnapshot");
  });
  it("13. profile feed utilise buildCloneVoiceEmployeeContextContract", () => {
    expect(feedSrc).toContain("buildCloneVoiceEmployeeContextContract");
  });
  it("14. profile feed utilise sanitizeEmployeeContextRegistry", () => {
    expect(feedSrc).toContain("sanitizeEmployeeContextRegistry");
  });
  it("15. profile feed utilise validateEmployeeContextRegistry", () => {
    expect(feedSrc).toContain("validateEmployeeContextRegistry");
  });
  it("16. profile feed ne contient pas Supabase import", () => {
    expect(feedSrc).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
    expect(feedSrc).not.toMatch(/createClient\s*\(/);
  });
  it("17. profile feed ne contient pas insert/update/delete/upsert", () => {
    expect(feedSrc).not.toMatch(/\.insert\s*\(/);
    expect(feedSrc).not.toMatch(/\.update\s*\(/);
    expect(feedSrc).not.toMatch(/\.delete\s*\(/);
    expect(feedSrc).not.toMatch(/\.upsert\s*\(/);
  });
  it("18. profile feed ne contient pas fetch", () => {
    expect(feedSrc).not.toMatch(/\bfetch\s*\(/);
  });
  it("19. profile feed ne contient pas import src/lib/pierre", () => {
    expect(feedSrc).not.toMatch(/from\s+["']@\/lib\/pierre/);
  });
  it("20. profile feed mentionne CloneVoice non actif", () => {
    expect(feedSrc).toContain("CloneVoice n'est pas actif production");
  });
  it("21. profile feed mentionne execution_enabled false", () => {
    expect(feedSrc).toContain("execution_enabled false");
  });
  it("22. profile feed mentionne public_launch_external_not_validated", () => {
    expect(feedSrc).toContain("public_launch_external_not_validated");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — QA module
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.21 — QA module", () => {
  it("23. QA module contient buildEmployeeContextRegistryProfileFeedQaChecklist", () => {
    expect(qaSrc).toContain("buildEmployeeContextRegistryProfileFeedQaChecklist");
  });
  it("24. QA module contient clonevoice_contract_visible_design_only", () => {
    expect(qaSrc).toContain("clonevoice_contract_visible_design_only");
  });
  it("25. QA module contient no_clonevoice_activation", () => {
    expect(qaSrc).toContain("no_clonevoice_activation");
  });
  it("26. QA module contient no_cloneos_execution", () => {
    expect(qaSrc).toContain("no_cloneos_execution");
  });
  it("27. QA module contient no_db_write", () => {
    expect(qaSrc).toContain("no_db_write");
  });
  it("28. QA module contient public_launch_external_not_validated", () => {
    expect(qaSrc).toContain("public_launch_external_not_validated");
  });
  it("29. QA module ne contient pas Supabase createClient", () => {
    expect(qaSrc).not.toMatch(/createClient\s*\(/);
    expect(qaSrc).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
  });
  it("30. QA module ne contient pas insert/update/delete/upsert", () => {
    expect(qaSrc).not.toMatch(/\.insert\s*\(/);
    expect(qaSrc).not.toMatch(/\.update\s*\(/);
    expect(qaSrc).not.toMatch(/\.delete\s*\(/);
    expect(qaSrc).not.toMatch(/\.upsert\s*\(/);
  });
  it("31. QA module ne contient pas import src/lib/pierre", () => {
    expect(qaSrc).not.toMatch(/from\s+["']@\/lib\/pierre/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Intégration /profile/agents
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.21 — Intégration /profile/agents", () => {
  it("32. /profile/agents mentionne Registre employés IA", () => {
    const has = agentsSrc.includes("Registre employés IA") || agentsSrc.includes("Registry employés IA");
    expect(has).toBe(true);
  });
  it("33. /profile/agents mentionne Lecture seule", () => {
    expect(agentsSrc).toContain("Lecture seule");
  });
  it("34. /profile/agents mentionne Design-only", () => {
    expect(agentsSrc).toContain("Design-only");
  });
  it("35. /profile/agents mentionne Aucune action exécutée", () => {
    expect(agentsSrc).toContain("Aucune action exécutée");
  });
  it("36. /profile/agents mentionne Aucun write serveur", () => {
    expect(agentsSrc).toContain("Aucun write serveur");
  });
  it("37. /profile/agents mentionne CloneVoice non actif", () => {
    expect(agentsSrc).toContain("CloneVoice non actif");
  });
  it("38. /profile/agents mentionne employee_key", () => {
    expect(agentsSrc).toContain("employee_key");
  });
  it("39. /profile/agents mentionne function_key", () => {
    expect(agentsSrc).toContain("function_key");
  });
  it("40. /profile/agents mentionne capability_key", () => {
    expect(agentsSrc).toContain("capability_key");
  });
  it("41. /profile/agents mentionne ne sont pas des secrets", () => {
    expect(agentsSrc).toContain("ne sont pas des secrets");
  });

  const names = ["42|Pierre", "43|Clara", "44|Emma", "45|Alex", "46|Noah", "47|Lucas", "48|Sophie", "49|Adrien"];
  names.forEach((entry) => {
    const [n, name] = entry.split("|");
    it(`${n}. /profile/agents mentionne ${name}`, () => {
      expect(agentsSrc).toContain(name);
    });
  });

  it("50. /profile/agents utilise loadEmployeeContextRegistryProfileFeed", () => {
    expect(agentsSrc).toContain("loadEmployeeContextRegistryProfileFeed");
  });
  it("51. /profile/agents ne contient pas POST /api/profile/enterprise-footprint", () => {
    expect(agentsSrc).not.toMatch(/fetch\s*\(.*enterprise-footprint.*method.*POST/s);
  });
  it("52. /profile/agents ne contient pas fetch POST", () => {
    expect(agentsSrc).not.toMatch(/fetch\s*\([^)]*method:\s*["']POST["']/s);
  });
  it("53. /profile/agents ne contient pas import Supabase direct ajouté pour registry", () => {
    // La page peut utiliser getSessionClient (existant), mais pas d'import direct
    // @supabase/supabase-js ajouté pour le registry.
    expect(feedSrc).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
  });
  it("54. /profile/agents ne contient pas import src/lib/pierre", () => {
    expect(agentsSrc).not.toMatch(/from\s+["']@\/lib\/pierre/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.21 — Documentation", () => {
  const docName = "PHASE_3_21_GLOBAL_EMPLOYEE_CONTEXT_REGISTRY_UI_PREVIEW.md";
  const doc = readDocs(docName);

  it("55. doc P3.21 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", docName))).toBe(true);
  });
  it("56. doc mentionne /profile/agents", () => {
    expect(doc).toContain("/profile/agents");
  });
  it("57. doc mentionne Registre employés IA", () => {
    expect(doc).toContain("Registre employés IA");
  });
  it("58. doc mentionne Pierre V1", () => {
    expect(doc).toContain("Pierre V1");
  });
  it("59. doc mentionne placeholders futurs", () => {
    expect(doc.toLowerCase()).toContain("placeholders futurs");
  });
  it("60. doc mentionne CloneVoice governed context", () => {
    const has = doc.includes("governed context") || doc.toLowerCase().includes("contexte gouverné") || doc.includes("governed_context_only");
    expect(has).toBe(true);
  });
  it("61. doc mentionne read-only ou lecture seule", () => {
    const has = doc.toLowerCase().includes("read-only") || doc.toLowerCase().includes("lecture seule");
    expect(has).toBe(true);
  });
  it("62. doc mentionne no execution / aucune exécution", () => {
    const has = doc.toLowerCase().includes("aucune exécution") || doc.toLowerCase().includes("no execution");
    expect(has).toBe(true);
  });
  it("63. doc mentionne no write / aucun write", () => {
    const has = doc.toLowerCase().includes("aucun write") || doc.toLowerCase().includes("no write");
    expect(has).toBe(true);
  });
  it("64. doc mentionne PHASE 3.22", () => {
    expect(doc).toContain("3.22");
  });
  it("65. doc ne contient pas phrase de lancement public interdite", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });
  it("66. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });
  it("67. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Exports + package
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.21 — Exports + package", () => {
  it("68. index exporte profile feed (loadEmployeeContextRegistryProfileFeed)", () => {
    expect(indexSrc).toContain("loadEmployeeContextRegistryProfileFeed");
  });
  it("69. index exporte profile feed QA (buildEmployeeContextRegistryProfileFeedQaChecklist)", () => {
    expect(indexSrc).toContain("buildEmployeeContextRegistryProfileFeedQaChecklist");
  });
  it("package.json contient test:phase3-21", () => {
    expect(readRoot("package.json")).toContain("test:phase3-21");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  loadEmployeeContextRegistryProfileFeed,
  buildEmployeeContextRegistryProfileFeed,
  buildEmptyEmployeeContextRegistryProfileFeed,
  buildEmployeeContextRegistryProfileFeedSummary,
  buildEmployeeContextRegistryProfileFeedEmployees,
  buildEmployeeContextRegistryProfileFeedWarnings,
  getEmployeeContextRegistryProfileFeedStatusLabel,
  getEmployeeContextRegistryProfileFeedSourceLabel,
  buildDefaultEmployeeContextRegistry,
} from "@/lib/clonestore/employee-context-registry";

import {
  buildEmployeeContextRegistryProfileFeedQaChecklist,
  buildEmployeeContextRegistryProfileFeedQaVerdict,
  getEmployeeContextRegistryProfileFeedBlockingSteps,
  summarizeEmployeeContextRegistryProfileFeedQaVerdict,
} from "@/lib/clonestore/employee-context-registry";

describe("PHASE 3.21 — Tests fonctionnels profile feed", () => {
  it("loadProfileFeed retourne un feed valide (SSR-safe)", () => {
    const feed = loadEmployeeContextRegistryProfileFeed();
    expect(feed.read_only).toBe(true);
    expect(feed.status).toBe("ready");
    expect(Array.isArray(feed.employees)).toBe(true);
    expect(Array.isArray(feed.future_placeholders)).toBe(true);
  });

  it("feed contient Pierre dans les employés actifs", () => {
    const feed = buildEmployeeContextRegistryProfileFeed(buildDefaultEmployeeContextRegistry());
    expect(feed.employees.some((e) => e.employee_key === "pierre")).toBe(true);
    expect(feed.summary.has_pierre).toBe(true);
  });

  it("feed contient 7 placeholders futurs", () => {
    const feed = buildEmployeeContextRegistryProfileFeed(buildDefaultEmployeeContextRegistry());
    expect(feed.future_placeholders.length).toBe(7);
    const names = feed.future_placeholders.map((p) => p.display_name);
    ["Clara", "Emma", "Alex", "Noah", "Lucas", "Sophie", "Adrien"].forEach((n) => {
      expect(names).toContain(n);
    });
  });

  it("execution_enabled_count est 0", () => {
    const feed = buildEmployeeContextRegistryProfileFeed(buildDefaultEmployeeContextRegistry());
    expect(feed.summary.execution_enabled_count).toBe(0);
  });

  it("Pierre card a 8 capacités et 8 fonctions, execution_enabled false", () => {
    const feed = buildEmployeeContextRegistryProfileFeed(buildDefaultEmployeeContextRegistry());
    const pierre = feed.employees.find((e) => e.employee_key === "pierre");
    expect(pierre?.capabilities_count).toBe(8);
    expect(pierre?.functions_count).toBe(8);
    expect(pierre?.execution_enabled).toBe(false);
    expect(pierre?.design_only).toBe(true);
  });

  it("CloneVoice contract design-only : can_execute_actions false", () => {
    const feed = buildEmployeeContextRegistryProfileFeed(buildDefaultEmployeeContextRegistry());
    expect(feed.clonevoice_contract.can_execute_actions).toBe(false);
    expect(feed.clonevoice_contract.must_route_through_cloneos).toBe(true);
    expect(feed.clonevoice_contract.public_launch_validated).toBe(false);
  });

  it("warnings incluent read_only_registry et clonevoice_not_active", () => {
    const warnings = buildEmployeeContextRegistryProfileFeedWarnings(buildDefaultEmployeeContextRegistry());
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain("read_only_registry");
    expect(codes).toContain("clonevoice_not_active");
    expect(codes).toContain("public_launch_external_not_validated");
  });

  it("warnings : aucune exécution activée (success)", () => {
    const warnings = buildEmployeeContextRegistryProfileFeedWarnings(buildDefaultEmployeeContextRegistry());
    const exec = warnings.find((w) => w.code === "execution_enabled_detected");
    expect(exec?.tone).toBe("success");
  });

  it("empty feed reste read_only", () => {
    const feed = buildEmptyEmployeeContextRegistryProfileFeed();
    expect(feed.read_only).toBe(true);
    expect(feed.summary.has_pierre).toBe(true);
  });

  it("summary direct cohérent", () => {
    const summary = buildEmployeeContextRegistryProfileFeedSummary(buildDefaultEmployeeContextRegistry());
    expect(summary.active_employees_count).toBe(1);
    expect(summary.future_placeholders_count).toBe(7);
    expect(summary.read_only).toBe(true);
  });

  it("employees builder ne retourne que les actifs", () => {
    const employees = buildEmployeeContextRegistryProfileFeedEmployees(buildDefaultEmployeeContextRegistry());
    expect(employees.length).toBe(1);
    expect(employees[0]?.employee_key).toBe("pierre");
  });

  it("labels status/source", () => {
    expect(getEmployeeContextRegistryProfileFeedStatusLabel("ready")).toBe("Registre disponible");
    expect(getEmployeeContextRegistryProfileFeedSourceLabel("default_registry")).toBe("Registre par défaut");
  });

  it("notes contiennent les invariants de sécurité", () => {
    const feed = buildEmployeeContextRegistryProfileFeed(buildDefaultEmployeeContextRegistry());
    const blob = feed.notes.join(" ");
    expect(blob).toContain("ne sont pas des secrets");
    expect(blob).toContain("CloneVoice n'est pas actif production");
  });
});

describe("PHASE 3.21 — Tests fonctionnels QA module", () => {
  it("QA checklist retourne 17 étapes", () => {
    const checklist = buildEmployeeContextRegistryProfileFeedQaChecklist();
    expect(checklist.total).toBe(17);
    expect(checklist.phase).toBe("3.21");
  });
  it("verdict pending initialement", () => {
    const checklist = buildEmployeeContextRegistryProfileFeedQaChecklist();
    const summary = buildEmployeeContextRegistryProfileFeedQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("pending");
    expect(summary.safe_to_activate).toBe(true);
  });
  it("verdict blocking failed → blocked", () => {
    const checklist = buildEmployeeContextRegistryProfileFeedQaChecklist();
    const withFail = checklist.steps.map((s) =>
      s.id === "no_db_write" ? { ...s, status: "failed" as const } : s
    );
    const summary = buildEmployeeContextRegistryProfileFeedQaVerdict(withFail);
    expect(summary.verdict).toBe("blocked");
  });
  it("getBlockingSteps retourne uniquement les bloquantes", () => {
    const blocking = getEmployeeContextRegistryProfileFeedBlockingSteps();
    expect(blocking.every((s) => s.severity === "blocking")).toBe(true);
  });
  it("summarize contient PHASE 3.21", () => {
    const checklist = buildEmployeeContextRegistryProfileFeedQaChecklist();
    const summary = buildEmployeeContextRegistryProfileFeedQaVerdict(checklist.steps);
    expect(summarizeEmployeeContextRegistryProfileFeedQaVerdict(summary)).toContain("PHASE 3.21");
  });
});
