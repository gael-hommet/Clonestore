// src/lib/clonestore/runtime-integration/__tests__/runtime-integration-foundation-phase4-1.test.ts
// PHASE 4.1 — CloneOS / Pierre Runtime Operational Integration Foundation — Tests

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../../..");
const RI_DIR = "lib/clonestore/runtime-integration";

function readSrc(rel: string): string {
  const full = resolve(ROOT, "src", rel);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}
function readDocs(name: string): string {
  const full = resolve(ROOT, "docs", name);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}
function readRoot(name: string): string {
  const full = resolve(ROOT, name);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

const typesSrc = readSrc(`${RI_DIR}/runtime-integration-types.ts`);
const commandSrc = readSrc(`${RI_DIR}/runtime-integration-command-contract.ts`);
const routerSrc = readSrc(`${RI_DIR}/runtime-integration-intent-router.ts`);
const planSrc = readSrc(`${RI_DIR}/runtime-integration-plan-builder.ts`);
const guardSrc = readSrc(`${RI_DIR}/runtime-integration-guardrails.ts`);
const traceSrc = readSrc(`${RI_DIR}/runtime-integration-trace-contract.ts`);
const scaleSrc = readSrc(`${RI_DIR}/runtime-integration-scale-readiness.ts`);
const orchSrc = readSrc(`${RI_DIR}/runtime-integration-orchestrator.ts`);
const qaSrc = readSrc(`${RI_DIR}/runtime-integration-qa.ts`);
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const ALL_RI = [typesSrc, commandSrc, routerSrc, planSrc, guardSrc, traceSrc, scaleSrc, orchSrc, qaSrc, indexSrc];

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Fichiers
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.1 — Fichiers", () => {
  const files = [
    "runtime-integration-types.ts", "runtime-integration-command-contract.ts",
    "runtime-integration-intent-router.ts", "runtime-integration-plan-builder.ts",
    "runtime-integration-guardrails.ts", "runtime-integration-trace-contract.ts",
    "runtime-integration-scale-readiness.ts", "runtime-integration-orchestrator.ts",
    "runtime-integration-qa.ts", "index.ts",
  ];
  files.forEach((f, i) => {
    it(`${i + 1}. ${f} existe`, () => {
      expect(existsSync(resolve(ROOT, "src", `${RI_DIR}/${f}`))).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Types
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.1 — Types", () => {
  const types = [
    ["11", "RuntimeIntegrationCommand"],
    ["12", "RuntimeIntegrationIntent"],
    ["13", "RuntimeIntegrationIntentRoute"],
    ["14", "RuntimeIntegrationPlan"],
    ["15", "RuntimeIntegrationGuardDecision"],
    ["16", "RuntimeIntegrationTraceContract"],
    ["17", "RuntimeIntegrationScaleHint"],
    ["18", "RuntimeIntegrationIdempotencyContract"],
  ];
  types.forEach(([n, t]) => {
    it(`${n}. types contiennent ${t}`, () => {
      expect(typesSrc).toContain(t);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Command / Router / Plan / Guard / Trace / Scale / Orchestrator / QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.1 — Modules (statique)", () => {
  it("19. command contract contient buildRuntimeIntegrationCommand", () => {
    expect(commandSrc).toContain("buildRuntimeIntegrationCommand");
  });
  it("20. command contract interdit sk_live_", () => {
    expect(commandSrc).toContain("sk_live_");
  });
  it("21. command contract interdit OPENAI_API_KEY (insensible casse)", () => {
    expect(commandSrc.toLowerCase()).toContain("openai_api_key");
  });
  it("22. intent router contient routeRuntimeIntegrationIntent", () => {
    expect(routerSrc).toContain("routeRuntimeIntegrationIntent");
  });
  it("23. intent router route RH vers pierre", () => {
    expect(routerSrc).toContain('"pierre"');
  });
  it("24. intent router empêche placeholders actifs (filterActive)", () => {
    expect(routerSrc).toContain("filterActiveEmployeeContexts");
  });
  it("25. plan builder contient buildRuntimeIntegrationPlan", () => {
    expect(planSrc).toContain("buildRuntimeIntegrationPlan");
  });
  it("26. plan builder contient plan_only", () => {
    expect(planSrc).toContain("plan_only");
  });
  it("27. plan builder contient execution_enabled false", () => {
    expect(planSrc).toContain("execution_enabled: false");
  });
  it("28. guardrails contient CloneGuard ou cloneguard", () => {
    expect(guardSrc.toLowerCase()).toContain("cloneguard");
  });
  it("29. guardrails bloque sujets disciplinaires/juridiques finals", () => {
    expect(guardSrc).toContain("final_disciplinary_action");
    expect(guardSrc).toContain("final_legal_decision");
  });
  it("30. trace contract contient CloneTrace ou clonetrace", () => {
    expect(traceSrc.toLowerCase()).toContain("clonetrace");
  });
  it("31. trace contract contient execution_not_started", () => {
    expect(traceSrc).toContain("execution_not_started");
  });
  it("32. scale readiness contient idempotency", () => {
    expect(scaleSrc.toLowerCase()).toContain("idempotency");
  });
  it("33. scale readiness contient queue", () => {
    expect(scaleSrc.toLowerCase()).toContain("queue");
  });
  it("34. scale readiness contient rate_limit", () => {
    expect(scaleSrc).toContain("rate_limit");
  });
  it("35. scale readiness contient cost_budget", () => {
    expect(scaleSrc).toContain("cost_budget");
  });
  it("36. scale readiness contient model_routing", () => {
    expect(scaleSrc).toContain("model_routing");
  });
  it("37. scale readiness contient load_test", () => {
    expect(scaleSrc).toContain("load_test");
  });
  it("38. scale readiness contient scale_80k_not_proven", () => {
    expect(scaleSrc).toContain("scale_80k_not_proven");
  });
  it("39. orchestrator contient simulateCloneOSToPierreRuntimePlan", () => {
    expect(orchSrc).toContain("simulateCloneOSToPierreRuntimePlan");
  });
  it("40. orchestrator retourne read_only true", () => {
    expect(orchSrc).toContain("read_only: true");
  });
  it("41. orchestrator retourne execution_enabled false", () => {
    expect(orchSrc).toContain("execution_enabled: false");
  });
  it("42. QA module contient scale_80k_not_claimed_as_proven", () => {
    expect(qaSrc).toContain("scale_80k_not_claimed_as_proven");
  });
  it("43. QA module contient no_pierre_engine_import", () => {
    expect(qaSrc).toContain("no_pierre_engine_import");
  });
  it("44. QA module contient no_cloneos_execution", () => {
    expect(qaSrc).toContain("no_cloneos_execution");
  });
  it("45. QA module contient no_clonevoice_activation", () => {
    expect(qaSrc).toContain("no_clonevoice_activation");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Invariants no-write / no-supabase / no-pierre
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.1 — Invariants modules", () => {
  it("46. aucun fichier ne contient Supabase createClient", () => {
    ALL_RI.forEach((src) => {
      expect(src).not.toMatch(/createClient\s*\(/);
      expect(src).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
    });
  });
  it("47. aucun fichier ne contient .insert(", () => {
    ALL_RI.forEach((src) => expect(src).not.toContain(".insert("));
  });
  it("48. aucun fichier ne contient .update(", () => {
    ALL_RI.forEach((src) => expect(src).not.toContain(".update("));
  });
  it("49. aucun fichier ne contient .delete(", () => {
    ALL_RI.forEach((src) => expect(src).not.toContain(".delete("));
  });
  it("50. aucun fichier ne contient .upsert(", () => {
    ALL_RI.forEach((src) => expect(src).not.toContain(".upsert("));
  });
  it("51. aucun fichier ne contient fetch(", () => {
    ALL_RI.forEach((src) => expect(src).not.toMatch(/\bfetch\s*\(/));
  });
  it("52. aucun fichier ne contient import src/lib/pierre", () => {
    ALL_RI.forEach((src) => expect(src).not.toMatch(/from\s+["']@\/lib\/pierre/));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.1 — Documentation", () => {
  const doc = readDocs("PHASE_4_1_CLONEOS_PIERRE_RUNTIME_OPERATIONAL_INTEGRATION_FOUNDATION.md");
  it("53. doc Phase 4.1 existe", () => {
    expect(doc.length).toBeGreaterThan(0);
  });
  it("54. doc mentionne Phase 3 closed", () => {
    const has = doc.toLowerCase().includes("phase 3 closed") || doc.includes("CLOSED / GO") || doc.toLowerCase().includes("phase 3 (p3.1");
    expect(has).toBe(true);
  });
  it("55. doc mentionne CloneOS / Pierre Runtime", () => {
    expect(doc).toContain("CloneOS");
    expect(doc).toContain("Pierre");
    expect(doc.toLowerCase()).toContain("runtime");
  });
  it("56. doc mentionne CloneGuard", () => {
    expect(doc).toContain("CloneGuard");
  });
  it("57. doc mentionne CloneTrace", () => {
    expect(doc).toContain("CloneTrace");
  });
  it("58. doc mentionne idempotency", () => {
    expect(doc.toLowerCase()).toContain("idempotency");
  });
  it("59. doc mentionne queue", () => {
    expect(doc.toLowerCase()).toContain("queue");
  });
  it("60. doc mentionne cost/model routing", () => {
    const has = doc.toLowerCase().includes("model routing") || doc.toLowerCase().includes("cost");
    expect(has).toBe(true);
  });
  it("61. doc mentionne 80k non prouvé ou not proven", () => {
    const has = doc.toLowerCase().includes("non prouvé") || doc.toLowerCase().includes("not proven") || doc.includes("scale_80k_not_proven");
    expect(has).toBe(true);
  });
  it("62. doc mentionne PHASE 4.2", () => {
    expect(doc).toContain("4.2");
  });
  it("63. doc ne contient pas phrase de lancement public interdite", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });
  it("64. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });
  it("65. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
  it("66. doc ne contient pas '80k scale proven'", () => {
    expect(doc.toLowerCase()).not.toContain("80k scale proven");
  });
  it("67. doc ne contient pas '80k clients guaranteed'", () => {
    expect(doc.toLowerCase()).not.toContain("80k clients guaranteed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — package
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.1 — package", () => {
  it("68. package.json contient test:phase4-1", () => {
    expect(readRoot("package.json")).toContain("test:phase4-1");
  });
  it("index exporte simulateCloneOSToPierreRuntimePlan", () => {
    expect(indexSrc).toContain("simulateCloneOSToPierreRuntimePlan");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildRuntimeIntegrationCommand,
  validateRuntimeIntegrationCommand,
  detectRuntimeIntegrationUnsafeText,
  buildRuntimeIntegrationIntent,
  routeRuntimeIntegrationIntent,
  inferRuntimeIntegrationDomain,
  classifyRuntimeIntegrationRisk,
  buildRuntimeIntegrationPlan,
  buildRuntimeIntegrationGuardDecision,
  buildRuntimeIntegrationTraceContract,
  buildRuntimeIntegrationScaleHints,
  buildRuntimeIntegrationQueueHints,
  buildRuntimeIntegrationCostHints,
  buildRuntimeIntegrationIdempotencyContract,
  simulateCloneOSToPierreRuntimePlan,
  buildRuntimeIntegrationReadResult,
  buildRuntimeIntegrationQaChecklist,
  buildRuntimeIntegrationQaVerdict,
} from "@/lib/clonestore/runtime-integration";

describe("PHASE 4.1 — Tests fonctionnels", () => {
  it("76. commande RH route vers Pierre", () => {
    const result = simulateCloneOSToPierreRuntimePlan({
      raw_text: "Préparer un document RH pour un salarié et son onboarding",
      company_id: "co_1",
    });
    expect(result.intent.domain).toBe("hr");
    expect(result.route.employee_key).toBe("pierre");
  });

  it("77. commande non-RH ne route pas vers un placeholder inactif", () => {
    const result = simulateCloneOSToPierreRuntimePlan({
      raw_text: "Calculer la marge financière du trimestre",
    });
    expect(result.route.employee_key).toBeNull();
    expect(result.plan.status).toBe("simulated_only");
  });

  it("78. commande RH sensible requiert validation humaine", () => {
    const result = simulateCloneOSToPierreRuntimePlan({
      raw_text: "Préparer un avenant au contrat et gérer la paie du salarié",
      company_id: "co_1",
    });
    expect(["sensitive", "high"]).toContain(result.intent.risk_level);
    expect(result.plan.guard_decision.human_validation_required).toBe(true);
  });

  it("79. action juridique/disciplinaire finale est bloquée", () => {
    const result = simulateCloneOSToPierreRuntimePlan({
      raw_text: "Exécuter le licenciement et signer le contrat définitivement",
      company_id: "co_1",
    });
    expect(result.plan.guard_decision.decision).toBe("block");
    expect(result.plan.status).toBe("blocked");
  });

  it("80. plan simulé est read_only et execution_enabled false", () => {
    const result = simulateCloneOSToPierreRuntimePlan({ raw_text: "Préparer onboarding salarié", company_id: "co_1" });
    expect(result.read_only).toBe(true);
    expect(result.execution_enabled).toBe(false);
    expect(result.plan.read_only).toBe(true);
    expect(result.plan.execution_enabled).toBe(false);
    expect(result.plan.steps.every((s) => s.execution_enabled === false)).toBe(true);
  });

  it("81. trace contract inclut execution_not_started", () => {
    const result = simulateCloneOSToPierreRuntimePlan({ raw_text: "Préparer onboarding salarié", company_id: "co_1" });
    const events = result.plan.trace_contract.events.map((e) => e.event_key);
    // events de base ; on vérifie via le builder dédié
    const cmd = buildRuntimeIntegrationCommand({ raw_text: "Préparer onboarding salarié", company_id: "co_1" });
    const intent = buildRuntimeIntegrationIntent(cmd);
    const route = routeRuntimeIntegrationIntent(intent);
    const trace = buildRuntimeIntegrationTraceContract(cmd, intent, route);
    expect(trace.clonetrace_required).toBe(true);
    expect(trace.server_write_enabled).toBe(false);
    expect(events.length).toBeGreaterThan(0);
  });

  it("82. scale hints : load_test_required true", () => {
    const hints = buildRuntimeIntegrationScaleHints();
    expect(hints.load_test_required).toBe(true);
  });

  it("83. scale hints : scale_80k_not_proven true", () => {
    const hints = buildRuntimeIntegrationScaleHints();
    expect(hints.scale_80k_not_proven).toBe(true);
  });

  it("84. cost hints évitent le premium model pour routing récurrent", () => {
    const cost = buildRuntimeIntegrationCostHints();
    expect(cost.avoid_premium_model_for).toBe("recurring_status_or_routing");
    expect(cost.orchestration_model_tier).toBe("cheap_or_standard");
  });

  it("85. idempotency key requise", () => {
    const cmd = buildRuntimeIntegrationCommand({ raw_text: "Préparer onboarding", company_id: "co_1" });
    const intent = buildRuntimeIntegrationIntent(cmd);
    const idem = buildRuntimeIntegrationIdempotencyContract(cmd, intent);
    expect(idem.required).toBe(true);
    expect(idem.idempotency_key.startsWith("idem_")).toBe(true);
  });

  it("command : detectUnsafe détecte sk_live_", () => {
    expect(detectRuntimeIntegrationUnsafeText("token sk_live_abc").length).toBeGreaterThan(0);
  });

  it("command : raw_text vide → invalid", () => {
    const cmd = buildRuntimeIntegrationCommand({ raw_text: "" });
    expect(validateRuntimeIntegrationCommand(cmd).valid).toBe(false);
  });

  it("inferDomain RH", () => {
    expect(inferRuntimeIntegrationDomain("gérer une absence salarié")).toBe("hr");
  });

  it("classifyRisk : blocked pour licenciement effectif", () => {
    expect(classifyRuntimeIntegrationRisk("exécuter le licenciement")).toBe("blocked");
  });

  it("guard decision allow_plan_only pour demande basique", () => {
    const cmd = buildRuntimeIntegrationCommand({ raw_text: "préparer une checklist onboarding", company_id: "co_1" });
    const intent = buildRuntimeIntegrationIntent(cmd);
    const route = routeRuntimeIntegrationIntent(intent);
    const plan = buildRuntimeIntegrationPlan(cmd, intent, route);
    const guard = buildRuntimeIntegrationGuardDecision(intent, route, plan.steps);
    expect(guard.cloneguard_required).toBe(true);
    expect(guard.bypass_allowed).toBe(false);
  });

  it("read result mode design_only par défaut", () => {
    const result = buildRuntimeIntegrationReadResult({ raw_text: "préparer onboarding", company_id: "co_1" });
    expect(result.mode).toBe("design_only");
    expect(result.public_launch_external_validated).toBe(false);
  });

  it("queue hints high priority pour risque sensible", () => {
    const result = simulateCloneOSToPierreRuntimePlan({ raw_text: "gérer un arrêt maladie salarié", company_id: "co_1" });
    expect(buildRuntimeIntegrationQueueHints(result.plan).priority).toBe("high");
  });

  it("QA checklist 24 étapes, verdict pending", () => {
    const checklist = buildRuntimeIntegrationQaChecklist();
    expect(checklist.total).toBe(24);
    expect(checklist.phase).toBe("4.1");
    const summary = buildRuntimeIntegrationQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("pending");
    expect(summary.safe_to_advance).toBe(true);
  });
});
