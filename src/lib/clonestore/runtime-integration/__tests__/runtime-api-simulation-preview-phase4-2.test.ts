// src/lib/clonestore/runtime-integration/__tests__/runtime-api-simulation-preview-phase4-2.test.ts
// PHASE 4.2 — Runtime API Simulation Endpoint / Command Center Preview — Tests

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

const contractSrc = readSrc(`${RI_DIR}/runtime-integration-api-contract.ts`);
const clientSrc = readSrc(`${RI_DIR}/runtime-integration-api-client.ts`);
const previewSrc = readSrc(`${RI_DIR}/runtime-integration-preview-model.ts`);
const previewQaSrc = readSrc(`${RI_DIR}/runtime-integration-preview-qa.ts`);
const routeSrc = readSrc("app/api/clonestore/runtime/simulate/route.ts");
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const messagesSrc = readSrc("app/profile/messages/page.tsx");

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Fichiers
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.2 — Fichiers", () => {
  it("1. api-contract.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", `${RI_DIR}/runtime-integration-api-contract.ts`))).toBe(true);
  });
  it("2. api-client.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", `${RI_DIR}/runtime-integration-api-client.ts`))).toBe(true);
  });
  it("3. preview-model.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", `${RI_DIR}/runtime-integration-preview-model.ts`))).toBe(true);
  });
  it("4. preview-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", `${RI_DIR}/runtime-integration-preview-qa.ts`))).toBe(true);
  });
  it("5. route simulate existe", () => {
    expect(existsSync(resolve(ROOT, "src", "app/api/clonestore/runtime/simulate/route.ts"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Route
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.2 — Route simulate", () => {
  it("6. route contient GET", () => {
    expect(routeSrc).toMatch(/export\s+async\s+function\s+GET/);
  });
  it("7. route contient POST", () => {
    expect(routeSrc).toMatch(/export\s+async\s+function\s+POST/);
  });
  it("8. route contient simulateCloneOSToPierreRuntimePlan", () => {
    expect(routeSrc).toContain("simulateCloneOSToPierreRuntimePlan");
  });
  it("9. route contient simulation_only (via builders)", () => {
    const has = routeSrc.includes("simulation") && (routeSrc.includes("SimulationApiResponse") || routeSrc.includes("simulation_only"));
    expect(has).toBe(true);
  });
  it("10. route porte execution_enabled false (via response builder)", () => {
    // La réponse provient des builders du contrat qui fixent execution_enabled: false
    expect(contractSrc).toContain("execution_enabled: false");
  });
  it("11. contrat porte db_write_performed false", () => {
    expect(contractSrc).toContain("db_write_performed: false");
  });
  it("12. contrat porte ai_call_performed false", () => {
    expect(contractSrc).toContain("ai_call_performed: false");
  });
  it("13. route ne contient pas Supabase createClient", () => {
    expect(routeSrc).not.toMatch(/createClient\s*\(/);
    expect(routeSrc).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
  });
  it("14. route ne contient pas .insert(", () => {
    expect(routeSrc).not.toContain(".insert(");
  });
  it("15. route ne contient pas .update(", () => {
    expect(routeSrc).not.toContain(".update(");
  });
  it("16. route ne contient pas .delete(", () => {
    expect(routeSrc).not.toContain(".delete(");
  });
  it("17. route ne contient pas .upsert(", () => {
    expect(routeSrc).not.toContain(".upsert(");
  });
  it("18. route ne contient pas import src/lib/pierre", () => {
    expect(routeSrc).not.toMatch(/from\s+["']@\/lib\/pierre/);
  });
  it("19. route ne contient pas openai", () => {
    expect(routeSrc.toLowerCase()).not.toContain("openai");
  });
  it("20. route ne contient pas anthropic", () => {
    expect(routeSrc.toLowerCase()).not.toContain("anthropic");
  });
  it("21. route ne contient pas stripe", () => {
    expect(routeSrc.toLowerCase()).not.toContain("stripe");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — API client
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.2 — API client", () => {
  it("22. client appelle /api/clonestore/runtime/simulate", () => {
    const has = clientSrc.includes("RUNTIME_INTEGRATION_SIMULATE_ENDPOINT") || clientSrc.includes("/api/clonestore/runtime/simulate");
    expect(has).toBe(true);
  });
  it("23. client ne contient pas /api/profile/enterprise-footprint", () => {
    expect(clientSrc).not.toContain("/api/profile/enterprise-footprint");
  });
  it("24. client ne contient pas /api/pierre", () => {
    expect(clientSrc).not.toContain("/api/pierre");
  });
  it('25. client contient method: "POST"', () => {
    expect(clientSrc).toContain('method: "POST"');
  });
  it("26. client mentionne simulation-only ou simulation_only", () => {
    const has = clientSrc.includes("simulation-only") || clientSrc.includes("simulation_only") || clientSrc.includes('mode: "simulation"');
    expect(has).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Preview model + QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.2 — Preview model + QA", () => {
  it("27. preview model contient buildRuntimeIntegrationPreviewSnapshot", () => {
    expect(previewSrc).toContain("buildRuntimeIntegrationPreviewSnapshot");
  });
  it("28. preview model contient buildRuntimeIntegrationPreviewBadges", () => {
    expect(previewSrc).toContain("buildRuntimeIntegrationPreviewBadges");
  });
  it("29. preview model contient buildRuntimeIntegrationPreviewCards", () => {
    expect(previewSrc).toContain("buildRuntimeIntegrationPreviewCards");
  });
  it("30. preview model contient buildRuntimeIntegrationPreviewSections", () => {
    expect(previewSrc).toContain("buildRuntimeIntegrationPreviewSections");
  });
  it("31. preview model contient CloneGuard", () => {
    expect(previewSrc).toContain("CloneGuard");
  });
  it("32. preview model contient CloneTrace", () => {
    expect(previewSrc).toContain("CloneTrace");
  });
  it("33. preview model contient scale_80k_not_proven", () => {
    expect(previewSrc).toContain("scale_80k_not_proven");
  });
  it("34. preview model contient Aucune mission créée", () => {
    expect(previewSrc).toContain("Aucune mission créée");
  });
  it("35. preview model contient Aucun appel IA", () => {
    expect(previewSrc).toContain("Aucun appel IA");
  });
  it("36. preview QA contient buildRuntimeIntegrationPreviewQaChecklist", () => {
    expect(previewQaSrc).toContain("buildRuntimeIntegrationPreviewQaChecklist");
  });
  it("37. preview QA contient route_post_simulation_only", () => {
    expect(previewQaSrc).toContain("route_post_simulation_only");
  });
  it("38. preview QA contient no_auto_simulation_on_mount", () => {
    expect(previewQaSrc).toContain("no_auto_simulation_on_mount");
  });
  it("39. preview QA contient scale_80k_not_proven_visible", () => {
    expect(previewQaSrc).toContain("scale_80k_not_proven_visible");
  });
  it("40. preview QA contient public_launch_external_not_validated", () => {
    expect(previewQaSrc).toContain("public_launch_external_not_validated");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Intégration /profile/messages
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.2 — Intégration /profile/messages", () => {
  it("41. mentionne Command Center Preview ou Prévisualisation Runtime CloneOS", () => {
    const has = messagesSrc.includes("Command Center Preview") || messagesSrc.includes("Prévisualisation Runtime CloneOS");
    expect(has).toBe(true);
  });
  it("42. mentionne Simulation uniquement", () => {
    expect(messagesSrc).toContain("Simulation uniquement");
  });
  it("43. mentionne Lecture seule", () => {
    expect(messagesSrc).toContain("Lecture seule");
  });
  it("44. mentionne Aucune mission créée", () => {
    expect(messagesSrc).toContain("Aucune mission créée");
  });
  it("45. mentionne Aucun message envoyé", () => {
    expect(messagesSrc).toContain("Aucun message envoyé");
  });
  it("46. mentionne Aucun appel IA", () => {
    expect(messagesSrc).toContain("Aucun appel IA");
  });
  it("47. mentionne CloneVoice non actif", () => {
    expect(messagesSrc).toContain("CloneVoice non actif");
  });
  it("48. mentionne Scale 80k non prouvé", () => {
    expect(messagesSrc).toContain("Scale 80k non prouvé");
  });
  it("49. utilise postRuntimeIntegrationSimulation", () => {
    expect(messagesSrc).toContain("postRuntimeIntegrationSimulation");
  });
  it("50. ne contient pas /api/profile/enterprise-footprint", () => {
    expect(messagesSrc).not.toContain("/api/profile/enterprise-footprint");
  });
  it("51. ne contient pas /api/pierre", () => {
    expect(messagesSrc).not.toContain("/api/pierre");
  });
  it("52. ne contient pas import Supabase direct ajouté pour runtime", () => {
    // La page importe SupabaseClient comme type (P3.1) mais pas createClient
    expect(messagesSrc).not.toMatch(/createClient\s*\(/);
  });
  it("53. ne contient pas import src/lib/pierre", () => {
    expect(messagesSrc).not.toMatch(/from\s+["']@\/lib\/pierre/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.2 — Documentation", () => {
  const doc = readDocs("PHASE_4_2_RUNTIME_API_SIMULATION_ENDPOINT_COMMAND_CENTER_PREVIEW.md");
  it("54. doc P4.2 existe", () => {
    expect(doc.length).toBeGreaterThan(0);
  });
  it("55. doc mentionne P4.2", () => {
    expect(doc).toContain("4.2");
  });
  it("56. doc mentionne GET capabilities", () => {
    expect(doc.toLowerCase()).toContain("get capabilities");
  });
  it("57. doc mentionne POST simulation-only", () => {
    expect(doc.toLowerCase()).toContain("post simulation-only");
  });
  it("58. doc mentionne aucun write DB", () => {
    expect(doc.toLowerCase()).toContain("aucun write db");
  });
  it("59. doc mentionne aucune mission créée", () => {
    expect(doc.toLowerCase()).toContain("aucune mission créée");
  });
  it("60. doc mentionne aucun appel IA", () => {
    expect(doc.toLowerCase()).toContain("aucun appel ia");
  });
  it("61. doc mentionne CloneGuard", () => {
    expect(doc).toContain("CloneGuard");
  });
  it("62. doc mentionne CloneTrace", () => {
    expect(doc).toContain("CloneTrace");
  });
  it("63. doc mentionne scale 80k non prouvé", () => {
    const has = doc.toLowerCase().includes("scale 80k non prouvé") || doc.toLowerCase().includes("80k") && doc.toLowerCase().includes("non prouvé");
    expect(has).toBe(true);
  });
  it("64. doc mentionne PHASE 4.3", () => {
    expect(doc).toContain("4.3");
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
  it("68. doc ne contient pas '80k scale proven'", () => {
    expect(doc.toLowerCase()).not.toContain("80k scale proven");
  });
  it("69. doc ne contient pas '80k clients guaranteed'", () => {
    expect(doc.toLowerCase()).not.toContain("80k clients guaranteed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Exports + package
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.2 — Exports + package", () => {
  it("70. index exporte api contract", () => {
    expect(indexSrc).toContain("buildRuntimeIntegrationSimulationApiCapabilities");
  });
  it("71. index exporte api client", () => {
    expect(indexSrc).toContain("postRuntimeIntegrationSimulation");
  });
  it("72. index exporte preview model", () => {
    expect(indexSrc).toContain("buildRuntimeIntegrationPreviewSnapshot");
  });
  it("73. index exporte preview QA", () => {
    expect(indexSrc).toContain("buildRuntimeIntegrationPreviewQaChecklist");
  });
  it("74. package.json contient test:phase4-2", () => {
    expect(readRoot("package.json")).toContain("test:phase4-2");
  });
  it("110. aucune simulation auto au mount (pas de useEffect appelant postRuntimeIntegrationSimulation)", () => {
    // Vérifie qu'aucun useEffect ne contient postRuntimeIntegrationSimulation.
    const useEffectBlocks = messagesSrc.match(/useEffect\([\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\)/g) ?? [];
    const autoSim = useEffectBlocks.some((b) => b.includes("postRuntimeIntegrationSimulation"));
    expect(autoSim).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildRuntimeIntegrationSimulationApiCapabilities,
  buildRuntimeIntegrationSimulationApiCapabilitiesResponse,
  buildRuntimeIntegrationSimulationApiResponse,
  buildRuntimeIntegrationSimulationApiError,
  validateRuntimeIntegrationSimulationApiRequest,
  sanitizeRuntimeIntegrationSimulationApiRequest,
  buildRuntimeIntegrationSimulationApiExamples,
  normalizeRuntimeIntegrationSimulationApiError,
  isRuntimeIntegrationSimulationApiResponse,
  buildRuntimeIntegrationPreviewSnapshot,
  buildRuntimeIntegrationPreviewBadges,
  buildRuntimeIntegrationPreviewSections,
  simulateCloneOSToPierreRuntimePlan,
  buildRuntimeIntegrationPreviewQaChecklist,
  buildRuntimeIntegrationPreviewQaVerdict,
} from "@/lib/clonestore/runtime-integration";

describe("PHASE 4.2 — Tests fonctionnels", () => {
  it("101. capabilities : supports_execution false", () => {
    const caps = buildRuntimeIntegrationSimulationApiCapabilities();
    expect(caps.supports_execution).toBe(false);
    expect(caps.supports_db_write).toBe(false);
    expect(caps.scale_80k_not_proven).toBe(true);
    const resp = buildRuntimeIntegrationSimulationApiCapabilitiesResponse();
    expect(resp.status).toBe("capabilities");
    expect(resp.examples?.length).toBe(4);
  });

  it("102. POST simulation HR retourne route Pierre", () => {
    const result = simulateCloneOSToPierreRuntimePlan({ raw_text: "Préparer l'onboarding d'un salarié", company_id: "co_1" });
    const resp = buildRuntimeIntegrationSimulationApiResponse(result);
    expect(resp.ok).toBe(true);
    expect(resp.result?.route.employee_key).toBe("pierre");
    expect(resp.simulation_only).toBe(true);
    expect(resp.db_write_performed).toBe(false);
  });

  it("103. simulation sensible HR retourne validation humaine", () => {
    const result = simulateCloneOSToPierreRuntimePlan({ raw_text: "Préparer un avenant au contrat et la paie", company_id: "co_1" });
    expect(result.plan.guard_decision.human_validation_required).toBe(true);
    const snap = buildRuntimeIntegrationPreviewSnapshot(result);
    expect(snap.status).toBe("awaiting_validation");
  });

  it("104. commande disciplinaire bloquée → guard block", () => {
    const result = simulateCloneOSToPierreRuntimePlan({ raw_text: "Exécuter le licenciement d'un salarié", company_id: "co_1" });
    expect(result.plan.guard_decision.decision).toBe("block");
    const snap = buildRuntimeIntegrationPreviewSnapshot(result);
    expect(snap.status).toBe("blocked");
  });

  it("105. raw_text vide → erreur 400 structurée", () => {
    const validation = validateRuntimeIntegrationSimulationApiRequest({ raw_text: "" });
    expect(validation.valid).toBe(false);
    expect(validation.error?.code).toBe("RAW_TEXT_REQUIRED");
    const errResp = buildRuntimeIntegrationSimulationApiError(validation.error!, "invalid_request");
    expect(errResp.ok).toBe(false);
    expect(errResp.status).toBe("invalid_request");
  });

  it("106. preview snapshot contient badges read-only", () => {
    const result = simulateCloneOSToPierreRuntimePlan({ raw_text: "Préparer onboarding salarié", company_id: "co_1" });
    const snap = buildRuntimeIntegrationPreviewSnapshot(result);
    const labels = buildRuntimeIntegrationPreviewBadges(snap).map((b) => b.label);
    expect(labels).toContain("Lecture seule");
    expect(labels).toContain("Aucune mission créée");
    expect(labels).toContain("Aucun appel IA");
    expect(labels).toContain("Scale 80k non prouvé");
  });

  it("107. preview snapshot contient plan steps (section plan)", () => {
    const result = simulateCloneOSToPierreRuntimePlan({ raw_text: "Préparer onboarding salarié", company_id: "co_1" });
    const snap = buildRuntimeIntegrationPreviewSnapshot(result);
    const sections = buildRuntimeIntegrationPreviewSections(snap);
    const plan = sections.find((s) => s.kind === "plan");
    expect(plan?.lines.length).toBeGreaterThan(0);
  });

  it("108. preview sections contiennent scale_80k_not_proven", () => {
    const result = simulateCloneOSToPierreRuntimePlan({ raw_text: "Préparer onboarding salarié", company_id: "co_1" });
    const snap = buildRuntimeIntegrationPreviewSnapshot(result);
    const blob = buildRuntimeIntegrationPreviewSections(snap).flatMap((s) => s.lines).join(" ");
    expect(blob.toLowerCase()).toContain("non prouvé");
  });

  it("109. client normalise les erreurs", () => {
    const err = normalizeRuntimeIntegrationSimulationApiError(new Error("boom"));
    expect(err.message).toBe("boom");
    const err2 = normalizeRuntimeIntegrationSimulationApiError({ code: "X", message: "Y" });
    expect(err2.code).toBe("X");
  });

  it("guards : isResponse type guard", () => {
    const result = simulateCloneOSToPierreRuntimePlan({ raw_text: "onboarding salarié", company_id: "co_1" });
    const resp = buildRuntimeIntegrationSimulationApiResponse(result);
    expect(isRuntimeIntegrationSimulationApiResponse(resp)).toBe(true);
    expect(isRuntimeIntegrationSimulationApiResponse({})).toBe(false);
  });

  it("examples : licenciement marqué blocked", () => {
    const examples = buildRuntimeIntegrationSimulationApiExamples();
    expect(examples.find((e) => e.id === "ex_blocked")?.expected_blocked).toBe(true);
  });

  it("sanitize request : mode simulation forcé", () => {
    const safe = sanitizeRuntimeIntegrationSimulationApiRequest({ raw_text: "test" });
    expect(safe.mode).toBe("simulation");
  });

  it("preview QA : 21 étapes, verdict pending", () => {
    const checklist = buildRuntimeIntegrationPreviewQaChecklist();
    expect(checklist.total).toBe(21);
    expect(checklist.phase).toBe("4.2");
    const summary = buildRuntimeIntegrationPreviewQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("pending");
    expect(summary.safe_to_advance).toBe(true);
  });
});
