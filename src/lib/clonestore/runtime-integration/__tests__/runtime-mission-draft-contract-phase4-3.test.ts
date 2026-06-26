// src/lib/clonestore/runtime-integration/__tests__/runtime-mission-draft-contract-phase4-3.test.ts
// PHASE 4.3 — Runtime Mission Draft Creation Contract / No-Execution Mission Draft — Tests

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

const typesSrc = readSrc(`${RI_DIR}/runtime-mission-draft-types.ts`);
const builderSrc = readSrc(`${RI_DIR}/runtime-mission-draft-builder.ts`);
const validationSrc = readSrc(`${RI_DIR}/runtime-mission-draft-validation.ts`);
const snapshotSrc = readSrc(`${RI_DIR}/runtime-mission-draft-snapshot.ts`);
const qaSrc = readSrc(`${RI_DIR}/runtime-mission-draft-qa.ts`);
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const messagesSrc = readSrc("app/profile/messages/page.tsx");
const ALL_DRAFT = [typesSrc, builderSrc, validationSrc, snapshotSrc, qaSrc];

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Fichiers
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.3 — Fichiers", () => {
  const files = [
    "runtime-mission-draft-types.ts", "runtime-mission-draft-builder.ts",
    "runtime-mission-draft-validation.ts", "runtime-mission-draft-snapshot.ts",
    "runtime-mission-draft-qa.ts",
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

describe("PHASE 4.3 — Types", () => {
  const checks = [
    ["6", "RuntimeMissionDraft"],
    ["7", "RuntimeMissionDraftStep"],
    ["8", "RuntimeMissionDraftValidationRequirement"],
    ["9", "RuntimeMissionDraftGuardSnapshot"],
    ["10", "RuntimeMissionDraftTraceSnapshot"],
    ["11", "execution_enabled: false"],
    ["12", "db_write_enabled: false"],
    ["13", "pierre_engine_called: false"],
    ["14", "ai_call_performed: false"],
    ["15", "email_sent: false"],
    ["16", "document_generated: false"],
  ];
  checks.forEach(([n, c]) => {
    it(`${n}. types contiennent ${c}`, () => {
      expect(typesSrc).toContain(c);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Builder
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.3 — Builder", () => {
  it("17. builder contient buildRuntimeMissionDraftFromIntegrationResult", () => {
    expect(builderSrc).toContain("buildRuntimeMissionDraftFromIntegrationResult");
  });
  it("18. builder contient deriveRuntimeMissionDraftStatus", () => {
    expect(builderSrc).toContain("deriveRuntimeMissionDraftStatus");
  });
  it("19. builder contient deriveRuntimeMissionDraftKind", () => {
    expect(builderSrc).toContain("deriveRuntimeMissionDraftKind");
  });
  it("20. builder contient pierre_mission_draft", () => {
    expect(builderSrc).toContain("pierre_mission_draft");
  });
  it("21. builder contient unsupported_domain_draft", () => {
    expect(builderSrc).toContain("unsupported_domain_draft");
  });
  it("22. builder contient blocked_draft", () => {
    expect(builderSrc).toContain("blocked_draft");
  });
  it("23. builder ne contient pas fetch", () => {
    expect(builderSrc).not.toMatch(/\bfetch\s*\(/);
  });
  it("24. builder ne contient pas Supabase createClient", () => {
    expect(builderSrc).not.toMatch(/createClient\s*\(/);
    expect(builderSrc).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
  });
  it("25. builder ne contient pas import src/lib/pierre", () => {
    expect(builderSrc).not.toMatch(/from\s+["']@\/lib\/pierre/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Validation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.3 — Validation", () => {
  it("26. validation contient validateRuntimeMissionDraft", () => {
    expect(validationSrc).toContain("validateRuntimeMissionDraft");
  });
  it("27. validation contient assertRuntimeMissionDraftNoExecution", () => {
    expect(validationSrc).toContain("assertRuntimeMissionDraftNoExecution");
  });
  it("28. validation contient assertRuntimeMissionDraftNoSecrets", () => {
    expect(validationSrc).toContain("assertRuntimeMissionDraftNoSecrets");
  });
  it("29. validation interdit OPENAI_API_KEY (insensible casse)", () => {
    expect(validationSrc.toLowerCase()).toContain("openai_api_key");
  });
  it("30. validation interdit SUPABASE_SERVICE_ROLE_KEY (insensible casse)", () => {
    expect(validationSrc.toLowerCase()).toContain("supabase_service_role_key");
  });
  it("31. validation interdit 80k scale proven", () => {
    expect(validationSrc).toContain("80k scale proven");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Snapshot
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.3 — Snapshot", () => {
  it("32. snapshot contient buildRuntimeMissionDraftSnapshot", () => {
    expect(snapshotSrc).toContain("buildRuntimeMissionDraftSnapshot");
  });
  it("33. snapshot contient buildRuntimeMissionDraftBadges", () => {
    expect(snapshotSrc).toContain("buildRuntimeMissionDraftBadges");
  });
  it("34. snapshot contient Aucune mission créée en base", () => {
    expect(snapshotSrc).toContain("Aucune mission créée en base");
  });
  it("35. snapshot contient Aucun appel Pierre", () => {
    expect(snapshotSrc).toContain("Aucun appel Pierre");
  });
  it("36. snapshot contient CloneGuard requis", () => {
    expect(snapshotSrc).toContain("CloneGuard requis");
  });
  it("37. snapshot contient CloneTrace requis", () => {
    expect(snapshotSrc).toContain("CloneTrace requis");
  });
  it("38. snapshot contient Scale 80k non prouvé", () => {
    expect(snapshotSrc).toContain("Scale 80k non prouvé");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — QA module + invariants no-write
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.3 — QA module + invariants", () => {
  it("39. QA contient buildRuntimeMissionDraftQaChecklist", () => {
    expect(qaSrc).toContain("buildRuntimeMissionDraftQaChecklist");
  });
  it("40. QA contient draft_no_pierre_engine_call", () => {
    expect(qaSrc).toContain("draft_no_pierre_engine_call");
  });
  it("41. QA contient draft_no_ai_call", () => {
    expect(qaSrc).toContain("draft_no_ai_call");
  });
  it("42. QA contient profile_messages_draft_preview_visible", () => {
    expect(qaSrc).toContain("profile_messages_draft_preview_visible");
  });
  it("43. QA contient no_api_route_created_for_draft_execution", () => {
    expect(qaSrc).toContain("no_api_route_created_for_draft_execution");
  });
  it("44. QA contient public_launch_external_not_validated", () => {
    expect(qaSrc).toContain("public_launch_external_not_validated");
  });
  it("45. aucun fichier mission draft ne contient .insert(", () => {
    ALL_DRAFT.forEach((src) => expect(src).not.toContain(".insert("));
  });
  it("46. aucun fichier mission draft ne contient .update(", () => {
    ALL_DRAFT.forEach((src) => expect(src).not.toContain(".update("));
  });
  it("47. aucun fichier mission draft ne contient .delete(", () => {
    ALL_DRAFT.forEach((src) => expect(src).not.toContain(".delete("));
  });
  it("48. aucun fichier mission draft ne contient .upsert(", () => {
    ALL_DRAFT.forEach((src) => expect(src).not.toContain(".upsert("));
  });
  it('49. aucun fichier mission draft ne contient from "@/lib/pierre', () => {
    ALL_DRAFT.forEach((src) => expect(src).not.toMatch(/from\s+["']@\/lib\/pierre/));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Intégration /profile/messages
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.3 — Intégration /profile/messages", () => {
  it("50. mentionne Brouillon de mission", () => {
    expect(messagesSrc).toContain("Brouillon de mission");
  });
  it("51. mentionne Préparer un brouillon local", () => {
    expect(messagesSrc).toContain("Préparer un brouillon local");
  });
  it("52. mentionne Aucune mission créée en base", () => {
    expect(messagesSrc).toContain("Aucune mission créée en base");
  });
  it("53. mentionne Aucun appel Pierre", () => {
    expect(messagesSrc).toContain("Aucun appel Pierre");
  });
  it("54. mentionne No-execution", () => {
    expect(messagesSrc).toContain("No-execution");
  });
  it("55. utilise buildRuntimeMissionDraftFromIntegrationResult", () => {
    expect(messagesSrc).toContain("buildRuntimeMissionDraftFromIntegrationResult");
  });
  it("56. ne contient pas /api/pierre", () => {
    expect(messagesSrc).not.toContain("/api/pierre");
  });
  it("57. ne contient pas route de création mission (POST mission)", () => {
    expect(messagesSrc).not.toMatch(/\/api\/.*mission.*create/i);
  });
  it("58. ne contient pas Supabase createClient", () => {
    expect(messagesSrc).not.toMatch(/createClient\s*\(/);
  });
  it("59. ne contient pas import src/lib/pierre", () => {
    expect(messagesSrc).not.toMatch(/from\s+["']@\/lib\/pierre/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.3 — Documentation", () => {
  const doc = readDocs("PHASE_4_3_RUNTIME_MISSION_DRAFT_CREATION_CONTRACT.md");
  it("60. doc P4.3 existe", () => {
    expect(doc.length).toBeGreaterThan(0);
  });
  it("61. doc mentionne P4.3", () => {
    expect(doc).toContain("4.3");
  });
  it("62. doc mentionne brouillon local", () => {
    expect(doc.toLowerCase()).toContain("brouillon local");
  });
  it("63. doc mentionne aucune mission créée en base", () => {
    expect(doc.toLowerCase()).toContain("aucune mission créée en base");
  });
  it("64. doc mentionne aucun appel Pierre", () => {
    expect(doc.toLowerCase()).toContain("aucun appel pierre");
  });
  it("65. doc mentionne CloneGuard", () => {
    expect(doc).toContain("CloneGuard");
  });
  it("66. doc mentionne CloneTrace", () => {
    expect(doc).toContain("CloneTrace");
  });
  it("67. doc mentionne idempotency", () => {
    expect(doc.toLowerCase()).toContain("idempotency");
  });
  it("68. doc mentionne queue", () => {
    expect(doc.toLowerCase()).toContain("queue");
  });
  it("69. doc mentionne cost", () => {
    expect(doc.toLowerCase()).toContain("cost");
  });
  it("70. doc mentionne scale 80k non prouvé", () => {
    const has = doc.toLowerCase().includes("scale 80k non prouvé") || (doc.includes("80k") && doc.toLowerCase().includes("non prouvé"));
    expect(has).toBe(true);
  });
  it("71. doc mentionne PHASE 4.4", () => {
    expect(doc).toContain("4.4");
  });
  it("72. doc ne contient pas phrase de lancement public interdite", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });
  it("73. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });
  it("74. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
  it("75. doc ne contient pas '80k scale proven'", () => {
    expect(doc.toLowerCase()).not.toContain("80k scale proven");
  });
  it("76. doc ne contient pas '80k clients guaranteed'", () => {
    expect(doc.toLowerCase()).not.toContain("80k clients guaranteed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 9 — Exports + package
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.3 — Exports + package", () => {
  it("77. index exporte mission draft types", () => {
    expect(indexSrc).toContain("RuntimeMissionDraft");
  });
  it("78. index exporte mission draft builder", () => {
    expect(indexSrc).toContain("buildRuntimeMissionDraftFromIntegrationResult");
  });
  it("79. index exporte mission draft validation", () => {
    expect(indexSrc).toContain("validateRuntimeMissionDraft");
  });
  it("80. index exporte mission draft snapshot", () => {
    expect(indexSrc).toContain("buildRuntimeMissionDraftSnapshot");
  });
  it("81. index exporte mission draft QA", () => {
    expect(indexSrc).toContain("buildRuntimeMissionDraftQaChecklist");
  });
  it("82. package.json contient test:phase4-3", () => {
    expect(readRoot("package.json")).toContain("test:phase4-3");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 10 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  simulateCloneOSToPierreRuntimePlan,
  buildRuntimeMissionDraftFromIntegrationResult,
  deriveRuntimeMissionDraftKind,
  deriveRuntimeMissionDraftStatus,
  validateRuntimeMissionDraft,
  sanitizeRuntimeMissionDraft,
  isRuntimeMissionDraftSafe,
  buildRuntimeMissionDraftSnapshot,
  buildRuntimeMissionDraftBadges,
  buildRuntimeMissionDraftSections,
  buildRuntimeMissionDraftQaChecklist,
  buildRuntimeMissionDraftQaVerdict,
} from "@/lib/clonestore/runtime-integration";

function draftFrom(text: string) {
  const result = simulateCloneOSToPierreRuntimePlan({ raw_text: text, company_id: "co_1" });
  return buildRuntimeMissionDraftFromIntegrationResult(result);
}

describe("PHASE 4.3 — Tests fonctionnels", () => {
  it("110. HR result → pierre_mission_draft", () => {
    const draft = draftFrom("Préparer l'onboarding d'un salarié");
    expect(draft.kind).toBe("pierre_mission_draft");
    expect(draft.employee_key).toBe("pierre");
  });

  it("111. non-HR result → unsupported_domain_draft", () => {
    const draft = draftFrom("Calculer la marge financière du trimestre");
    expect(draft.kind).toBe("unsupported_domain_draft");
    expect(draft.employee_key).toBeNull();
  });

  it("112. blocked guard → blocked_draft", () => {
    const draft = draftFrom("Exécuter le licenciement d'un salarié");
    expect(draft.kind).toBe("blocked_draft");
    expect(draft.status).toBe("blocked");
    expect(draft.blocked_reasons.length).toBeGreaterThan(0);
  });

  it("113. sensitive HR → awaiting_validation", () => {
    const draft = draftFrom("Préparer un avenant au contrat et la paie du salarié");
    expect(draft.status).toBe("awaiting_validation");
    expect(draft.validation_requirements.length).toBeGreaterThan(0);
  });

  it("114-120. draft safety flags false", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    expect(draft.read_only).toBe(true);
    expect(draft.execution_enabled).toBe(false);
    expect(draft.db_write_enabled).toBe(false);
    expect(draft.pierre_engine_called).toBe(false);
    expect(draft.ai_call_performed).toBe(false);
    expect(draft.email_sent).toBe(false);
    expect(draft.document_generated).toBe(false);
  });

  it("121. draft garde idempotency key", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    expect(draft.idempotency.required).toBe(true);
    expect(draft.idempotency.idempotency_key.length).toBeGreaterThan(0);
  });

  it("122. draft garde queue hints", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    expect(draft.queue_snapshot.queue_name).toBe("clonestore_runtime_missions");
    expect(draft.queue_snapshot.dead_letter_on_failure).toBe(true);
  });

  it("123. draft garde cost hints", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    expect(draft.cost_snapshot.orchestration_model_tier).toBe("cheap_or_standard");
    expect(draft.cost_snapshot.avoid_premium_model_for).toBe("recurring_status_or_routing");
  });

  it("124. draft garde CloneGuard snapshot", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    expect(draft.guard_snapshot.cloneguard_required).toBe(true);
    expect(draft.guard_snapshot.bypass_allowed).toBe(false);
  });

  it("125. draft garde CloneTrace snapshot", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    expect(draft.trace_snapshot.clonetrace_required).toBe(true);
    expect(draft.trace_snapshot.server_write_enabled).toBe(false);
    expect(draft.trace_snapshot.final_event).toBe("execution_not_started");
  });

  it("126. validation passe pour un draft safe", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    expect(validateRuntimeMissionDraft(draft).valid).toBe(true);
    expect(isRuntimeMissionDraftSafe(draft)).toBe(true);
  });

  it("127. validation échoue si execution_enabled true", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const tampered = { ...draft, execution_enabled: true as unknown as false };
    expect(validateRuntimeMissionDraft(tampered).valid).toBe(false);
  });

  it("128. validation échoue si secret-like text présent", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const tampered = { ...draft, summary: draft.summary + " OPENAI_API_KEY=sk_live_abc" };
    expect(validateRuntimeMissionDraft(tampered).valid).toBe(false);
  });

  it("129. snapshot badges incluent no-execution", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const labels = buildRuntimeMissionDraftBadges(draft).map((b) => b.label);
    expect(labels).toContain("No-execution");
    expect(labels).toContain("Aucune mission créée en base");
    expect(labels).toContain("Aucun appel Pierre");
  });

  it("130. snapshot sections incluent validations et risques", () => {
    const draft = draftFrom("Préparer un avenant au contrat");
    const sections = buildRuntimeMissionDraftSections(draft);
    const kinds = sections.map((s) => s.kind);
    expect(kinds).toContain("validations");
    expect(kinds).toContain("risks");
  });

  it("sanitize force les flags false", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const sanitized = sanitizeRuntimeMissionDraft({ ...draft, execution_enabled: true as unknown as false });
    expect(sanitized.execution_enabled).toBe(false);
  });

  it("snapshot complet : read_only + local_in_memory", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const snap = buildRuntimeMissionDraftSnapshot(draft);
    expect(snap.read_only).toBe(true);
    expect(snap.local_in_memory).toBe(true);
  });

  it("QA checklist 30 étapes, verdict pending", () => {
    const checklist = buildRuntimeMissionDraftQaChecklist();
    expect(checklist.total).toBe(30);
    expect(checklist.phase).toBe("4.3");
    const summary = buildRuntimeMissionDraftQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("pending");
    expect(summary.safe_to_advance).toBe(true);
  });
});
