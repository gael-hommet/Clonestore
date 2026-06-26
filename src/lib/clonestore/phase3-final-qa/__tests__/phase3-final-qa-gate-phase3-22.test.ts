// src/lib/clonestore/phase3-final-qa/__tests__/phase3-final-qa-gate-phase3-22.test.ts
// PHASE 3.22 — Phase 3 Final QA Gate — Tests

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../../..");
const QA_DIR = "lib/clonestore/phase3-final-qa";

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
function readTemplate(name: string): string {
  const full = resolve(ROOT, "docs/templates", name);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}
function readScript(name: string): string {
  const full = resolve(ROOT, "scripts", name);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}
function readRoot(name: string): string {
  const full = resolve(ROOT, name);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

const typesSrc = readSrc(`${QA_DIR}/phase3-final-qa-types.ts`);
const checklistSrc = readSrc(`${QA_DIR}/phase3-final-qa-checklist.ts`);
const invariantsSrc = readSrc(`${QA_DIR}/phase3-final-qa-invariants.ts`);
const reportSrc = readSrc(`${QA_DIR}/phase3-final-qa-report.ts`);
const evidenceSrc = readSrc(`${QA_DIR}/phase3-final-qa-evidence.ts`);
const qaSrc = readSrc(`${QA_DIR}/phase3-final-qa-qa.ts`);
const indexSrc = readSrc(`${QA_DIR}/index.ts`);
const scriptSrc = readScript("check-phase3-final-qa.mjs");
const ALL_QA = [typesSrc, checklistSrc, invariantsSrc, reportSrc, evidenceSrc, qaSrc, indexSrc];

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Fichiers
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.22 — Fichiers", () => {
  const files = [
    "phase3-final-qa-types.ts", "phase3-final-qa-checklist.ts",
    "phase3-final-qa-invariants.ts", "phase3-final-qa-report.ts",
    "phase3-final-qa-evidence.ts", "phase3-final-qa-qa.ts", "index.ts",
  ];
  files.forEach((f, i) => {
    it(`${i + 1}. ${f} existe`, () => {
      expect(existsSync(resolve(ROOT, "src", `${QA_DIR}/${f}`))).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Checklist
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.22 — Checklist", () => {
  const ids = [
    ["8", "phase3_1_messages_readonly_validated"],
    ["9", "phase3_21_employee_context_registry_ui_validated"],
    ["10", "no_pierre_engine_modification"],
    ["11", "no_clonevoice_activation"],
    ["12", "no_cloneos_execution"],
    ["13", "no_unflagged_server_write"],
    ["14", "no_sql_auto_apply"],
    ["15", "no_env_auto_change"],
    ["16", "no_go_live_proof_auto_validation"],
    ["17", "localstorage_fallback_preserved"],
    ["18", "public_launch_external_not_validated"],
  ];
  ids.forEach(([n, id]) => {
    it(`${n}. checklist contient ${id}`, () => {
      expect(checklistSrc).toContain(id);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Invariants
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.22 — Invariants", () => {
  it("19. invariants contient no_pierre_engine_import", () => {
    expect(invariantsSrc).toContain("no_pierre_engine_import");
  });
  it("20. invariants contient no_clonevoice_active_production_claim", () => {
    expect(invariantsSrc).toContain("no_clonevoice_active_production_claim");
  });
  it("21. invariants contient no_fetch_post_in_profile_messages", () => {
    expect(invariantsSrc).toContain("no_fetch_post_in_profile_messages");
  });
  it("22. invariants contient no_sql_auto_apply_script", () => {
    expect(invariantsSrc).toContain("no_sql_auto_apply_script");
  });
  it("23. invariants contient no_service_role_client", () => {
    expect(invariantsSrc).toContain("no_service_role_client");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Report
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.22 — Report", () => {
  it("24. report contient buildPhase3FinalQaReport", () => {
    expect(reportSrc).toContain("buildPhase3FinalQaReport");
  });
  it("25. report contient buildPhase3FinalQaReleaseBoundary", () => {
    expect(reportSrc).toContain("buildPhase3FinalQaReleaseBoundary");
  });
  it("26. report contient buildPhase3FinalQaNextPhaseRecommendation", () => {
    expect(reportSrc).toContain("buildPhase3FinalQaNextPhaseRecommendation");
  });
  it("27. report mentionne Phase 4", () => {
    expect(reportSrc).toContain("PHASE 4");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Evidence + QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.22 — Evidence + QA", () => {
  it("28. evidence contient buildPhase3FinalQaEvidenceTemplate", () => {
    expect(evidenceSrc).toContain("buildPhase3FinalQaEvidenceTemplate");
  });
  it("29. QA module contient buildPhase3FinalQaQaChecklist", () => {
    expect(qaSrc).toContain("buildPhase3FinalQaQaChecklist");
  });
  it("30. QA module contient public_launch_external_not_validated", () => {
    expect(qaSrc).toContain("public_launch_external_not_validated");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Script read-only
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.22 — Script read-only", () => {
  it("31. script check-phase3-final-qa.mjs existe", () => {
    expect(existsSync(resolve(ROOT, "scripts", "check-phase3-final-qa.mjs"))).toBe(true);
  });
  it("32. script contient test:phase3-22", () => {
    expect(scriptSrc).toContain("test:phase3-22");
  });
  it("33. script contient test:phase3-21", () => {
    expect(scriptSrc).toContain("test:phase3-21");
  });
  it("34. script contient test:phase3-1", () => {
    expect(scriptSrc).toContain("test:phase3-1");
  });
  it("35. script contient npm run build", () => {
    expect(scriptSrc).toContain("npm run build");
  });
  it("36. script ne contient pas .insert(", () => {
    expect(scriptSrc).not.toContain(".insert(");
  });
  it("37. script ne contient pas .update(", () => {
    expect(scriptSrc).not.toContain(".update(");
  });
  it("38. script ne contient pas .delete(", () => {
    expect(scriptSrc).not.toContain(".delete(");
  });
  it("39. script ne contient pas .upsert(", () => {
    expect(scriptSrc).not.toContain(".upsert(");
  });
  it("40. script ne contient pas fetch POST", () => {
    expect(scriptSrc).not.toMatch(/fetch\s*\([^)]*method:\s*["']POST["']/s);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Evidence template
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.22 — Evidence template", () => {
  const tpl = readTemplate("PHASE_3_22_FINAL_QA_GATE_EVIDENCE.md");
  it("41. evidence template existe", () => {
    expect(existsSync(resolve(ROOT, "docs/templates", "PHASE_3_22_FINAL_QA_GATE_EVIDENCE.md"))).toBe(true);
  });
  it("42. evidence template mentionne test:phase3-21", () => {
    expect(tpl).toContain("test:phase3-21");
  });
  it("43. evidence template mentionne test:phase3-1", () => {
    expect(tpl).toContain("test:phase3-1");
  });
  it("44. evidence template mentionne public external launch status", () => {
    const has = tpl.toLowerCase().includes("public external launch") || tpl.toLowerCase().includes("lancement public externe");
    expect(has).toBe(true);
  });
  it("45. evidence template mentionne non validé", () => {
    expect(tpl).toContain("non validé");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.22 — Documentation", () => {
  const doc = readDocs("PHASE_3_22_PHASE_3_FINAL_QA_GATE.md");
  it("46. doc P3.22 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", "PHASE_3_22_PHASE_3_FINAL_QA_GATE.md"))).toBe(true);
  });
  it("47. doc mentionne Phase 3 Final QA Gate", () => {
    expect(doc).toContain("Phase 3 Final QA Gate");
  });
  it("48. doc mentionne PHASE 3.1", () => {
    expect(doc).toContain("PHASE 3.1");
  });
  it("49. doc mentionne PHASE 3.21", () => {
    expect(doc).toContain("PHASE 3.21");
  });
  it("50. doc mentionne Phase 4", () => {
    expect(doc).toContain("PHASE 4");
  });
  it("51. doc mentionne CloneVoice non actif", () => {
    expect(doc).toContain("CloneVoice non actif");
  });
  it("52. doc mentionne Pierre moteur non modifié", () => {
    const has = doc.includes("Pierre moteur non modifié") || doc.includes("moteur Pierre non modifié");
    expect(has).toBe(true);
  });
  it("53. doc mentionne lancement public externe non validé", () => {
    expect(doc.toLowerCase()).toContain("lancement public externe non validé");
  });
  it("54. doc ne contient pas phrase de lancement public interdite", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });
  it("55. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });
  it("56. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 9 — package.json + invariants modules
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.22 — package + invariants modules", () => {
  const pkg = readRoot("package.json");
  it("57. package.json contient test:phase3-22", () => {
    expect(pkg).toContain("test:phase3-22");
  });
  it("58. package.json contient check:phase3-final-qa", () => {
    expect(pkg).toContain("check:phase3-final-qa");
  });
  it("59. final qa modules ne contiennent pas Supabase createClient", () => {
    ALL_QA.forEach((src) => {
      expect(src).not.toMatch(/createClient\s*\(/);
      expect(src).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
    });
  });
  it("60. final qa modules ne contiennent pas .insert(", () => {
    ALL_QA.forEach((src) => expect(src).not.toContain(".insert("));
  });
  it("61. final qa modules ne contiennent pas .update(", () => {
    ALL_QA.forEach((src) => expect(src).not.toContain(".update("));
  });
  it("62. final qa modules ne contiennent pas .delete(", () => {
    ALL_QA.forEach((src) => expect(src).not.toContain(".delete("));
  });
  it("63. final qa modules ne contiennent pas .upsert(", () => {
    ALL_QA.forEach((src) => expect(src).not.toContain(".upsert("));
  });
  it("64. final qa modules ne contiennent pas import src/lib/pierre", () => {
    ALL_QA.forEach((src) => expect(src).not.toMatch(/from\s+["']@\/lib\/pierre/));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 10 — Invariants pages profile
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.22 — Invariants pages profile", () => {
  it("65. /profile/messages ne contient pas route enterprise-footprint", () => {
    expect(readSrc("app/profile/messages/page.tsx")).not.toContain("/api/profile/enterprise-footprint");
  });
  it("66. /profile/agents ne contient pas fetch POST", () => {
    expect(readSrc("app/profile/agents/page.tsx")).not.toMatch(/fetch\s*\([^)]*method:\s*["']POST["']/s);
  });
  it("67. /agents/pierre/setup ne contient pas fetch POST enterprise-footprint", () => {
    const setup = readSrc("app/agents/pierre/setup/page.tsx");
    expect(setup).not.toMatch(/fetch\s*\(.*enterprise-footprint.*method.*POST/s);
  });
  it("68. /agents/pierre/use conserve prefill-only (setInputDraft) ou no auto-submit", () => {
    const use = readSrc("app/agents/pierre/use/page.tsx");
    const safe = use.includes("setInputDraft") || use.includes("plan_only") || use.includes("plan-only");
    expect(safe).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 11 — Exports index
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.22 — Exports index", () => {
  it("index exporte buildPhase3FinalQaChecklist", () => {
    expect(indexSrc).toContain("buildPhase3FinalQaChecklist");
  });
  it("index exporte buildPhase3FinalQaReport", () => {
    expect(indexSrc).toContain("buildPhase3FinalQaReport");
  });
  it("index exporte buildPhase3FinalQaQaChecklist", () => {
    expect(indexSrc).toContain("buildPhase3FinalQaQaChecklist");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 12 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildPhase3FinalQaChecklist,
  buildPhase3FinalQaDomainSummaries,
  buildPhase3FinalQaVerdict,
  getPhase3FinalQaBlockingSteps,
  summarizePhase3FinalQaChecklist,
  buildPhase3FinalQaInvariants,
  evaluatePhase3FinalQaInvariantFromText,
  summarizePhase3FinalQaInvariants,
  getPhase3FinalQaBlockingInvariants,
  buildPhase3FinalQaReport,
  buildPhase3FinalQaReleaseBoundary,
  buildPhase3FinalQaNextPhaseRecommendation,
  buildPhase3FinalQaGoNoGoMessage,
  buildPhase3FinalQaEvidenceTemplate,
  validatePhase3FinalQaEvidenceTemplate,
  buildPhase3FinalQaQaChecklist,
  buildPhase3FinalQaQaVerdict,
} from "@/lib/clonestore/phase3-final-qa";

describe("PHASE 3.22 — Tests fonctionnels", () => {
  it("checklist couvre P3.1 → P3.21 (21 steps de phase)", () => {
    const checklist = buildPhase3FinalQaChecklist();
    const phaseSteps = checklist.steps.filter((s) => s.phase_key && s.phase_key !== "phase3_22");
    expect(phaseSteps.length).toBe(21);
    expect(checklist.phase).toBe("3.22");
  });

  it("checklist a 45 étapes", () => {
    const checklist = buildPhase3FinalQaChecklist();
    expect(checklist.total).toBe(45);
  });

  it("verdict toutes pending → needs_review", () => {
    const checklist = buildPhase3FinalQaChecklist();
    const verdict = buildPhase3FinalQaVerdict(checklist.steps);
    expect(verdict).toBe("needs_review");
  });

  it("verdict toutes passed → pass", () => {
    const checklist = buildPhase3FinalQaChecklist();
    const allPassed = checklist.steps.map((s) => ({ ...s, status: "passed" as const }));
    expect(buildPhase3FinalQaVerdict(allPassed)).toBe("pass");
  });

  it("verdict blocking failed → blocked", () => {
    const checklist = buildPhase3FinalQaChecklist();
    const withFail = checklist.steps.map((s) =>
      s.id === "no_pierre_engine_modification" ? { ...s, status: "failed" as const } : s
    );
    expect(buildPhase3FinalQaVerdict(withFail)).toBe("blocked");
  });

  it("domain summaries couvrent plusieurs domaines", () => {
    const checklist = buildPhase3FinalQaChecklist();
    const summaries = buildPhase3FinalQaDomainSummaries(checklist.steps);
    expect(summaries.length).toBeGreaterThan(3);
  });

  it("getBlockingSteps retourne uniquement les bloquantes", () => {
    const blocking = getPhase3FinalQaBlockingSteps();
    expect(blocking.every((s) => s.severity === "blocking")).toBe(true);
  });

  it("summarize contient le verdict", () => {
    const checklist = buildPhase3FinalQaChecklist();
    expect(summarizePhase3FinalQaChecklist(checklist)).toContain("Verdict");
  });

  it("invariants : 14 définitions", () => {
    const invs = buildPhase3FinalQaInvariants();
    expect(invs.length).toBe(14);
  });

  it("invariant must_be_absent satisfait si needle absent", () => {
    const inv = buildPhase3FinalQaInvariants().find((i) => i.id === "no_service_role_client")!;
    const result = evaluatePhase3FinalQaInvariantFromText(inv, "anon key only", "service_role");
    expect(result.satisfied).toBe(true);
  });

  it("invariant must_be_absent non satisfait si needle présent", () => {
    const inv = buildPhase3FinalQaInvariants().find((i) => i.id === "no_service_role_client")!;
    const result = evaluatePhase3FinalQaInvariantFromText(inv, "uses service_role here", "service_role");
    expect(result.satisfied).toBe(false);
  });

  it("invariant must_be_present satisfait si needle présent", () => {
    const inv = buildPhase3FinalQaInvariants().find((i) => i.id === "localstorage_fallback_text_present")!;
    const result = evaluatePhase3FinalQaInvariantFromText(inv, "localStorage reste le fallback actif", "localStorage reste le fallback actif");
    expect(result.satisfied).toBe(true);
  });

  it("summarize invariants + blocking", () => {
    const invs = buildPhase3FinalQaInvariants();
    const results = invs.map((i) => evaluatePhase3FinalQaInvariantFromText(i, "", undefined));
    expect(summarizePhase3FinalQaInvariants(results)).toContain("Invariants");
    expect(getPhase3FinalQaBlockingInvariants(results).length).toBe(0);
  });

  it("report par défaut needs_review avec release boundary", () => {
    const report = buildPhase3FinalQaReport();
    expect(report.verdict).toBe("needs_review");
    expect(report.release_boundary.public_launch_external_validated).toBe(false);
    expect(report.release_boundary.pierre_engine_unchanged).toBe(true);
    expect(report.next_phase.recommended_phase).toContain("PHASE 4");
  });

  it("release boundary : conditions présentes", () => {
    const rb = buildPhase3FinalQaReleaseBoundary();
    expect(rb.phase3_can_close).toBe(true);
    expect(rb.clonevoice_production_active).toBe(false);
    expect(rb.server_persistence_manual_activation_required).toBe(true);
  });

  it("next phase recommendation → Phase 4", () => {
    const next = buildPhase3FinalQaNextPhaseRecommendation();
    expect(next.recommended_phase).toContain("PHASE 4");
    expect(next.alternatives.length).toBeGreaterThan(0);
  });

  it("go/no-go message", () => {
    const report = buildPhase3FinalQaReport();
    const msg = buildPhase3FinalQaGoNoGoMessage(report);
    expect(msg).toContain("non validé");
  });

  it("evidence template PENDING + not_validated", () => {
    const ev = buildPhase3FinalQaEvidenceTemplate();
    expect(ev.decision).toBe("PENDING");
    expect(ev.public_launch_external_status).toBe("not_validated");
    expect(ev.sql_auto_applied).toBe(false);
  });

  it("validate evidence → invalid si vide", () => {
    const ev = buildPhase3FinalQaEvidenceTemplate();
    const result = validatePhase3FinalQaEvidenceTemplate(ev);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("QA méta checklist 14 étapes, verdict pending", () => {
    const checklist = buildPhase3FinalQaQaChecklist();
    expect(checklist.total).toBe(14);
    const summary = buildPhase3FinalQaQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("pending");
    expect(summary.safe_to_close).toBe(true);
  });
});
