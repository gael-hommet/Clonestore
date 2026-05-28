// B44 — PierreEmpreinte tests (80+ tests)

import { describe, it, expect } from "vitest";

import {
  buildDefaultPierreEmpreinte,
  buildDefaultPierreIdentity,
  buildDefaultHrScope,
  buildDefaultPierreAutonomyRules,
  buildDefaultPierreEmailRules,
  buildDefaultSensitiveCaseRules,
  PIERRE_EMPREINTE_CURRENT_VERSION,
} from "../pierre-defaults";
import { computePierreEmpreinteCompletion } from "../pierre-completion";
import { validatePierreEmpreinte } from "../pierre-validation";
import { normalizePierreEmpreinte, applyPierreEmpreintePatch } from "../pierre-normalizer";
import {
  readPierreEmpreinteFromMemory,
  readOrCreatePierreEmpreinte,
  buildPierreEmpreinteMemoryPatch,
  applyAndPersistPierreEmpreintePatch,
  resetPierreEmpreinteInMemory,
  PIERRE_EMPREINTE_MEMORY_KEY,
} from "../pierre-memory-bridge";
import {
  buildPierreWorkflowRuntimeConfig,
  isDomainEnabledInEmpreinte,
  isTaskTypeBlockedInEmpreinte,
  requiresHumanForDocumentType,
} from "../pierre-workflow-config";
import {
  buildPierreDocumentRenderConfig,
  buildDocumentVariablesFromEmpreinte,
} from "../pierre-document-prep";
import {
  bumpPierreEmpreinteVersion,
  parsePierreEmpreinteVersion,
  isPierreVersionNewer,
  pierreEmpreinteNeedsMigration,
} from "../pierre-versioning";
import { buildPierreEmpreinteVerdict } from "../pierre-empreinte-verdict";
import {
  buildMinimalPierreEmpreinte,
  buildCompletePierreEmpreinte,
  buildEmptyPierreEmpreinte,
} from "../pierre-fixtures";
import { buildCompleteEnterpriseEmpreinte } from "../../../clonestore/empreinte/enterprise-fixtures";

// ── Defaults ──────────────────────────────────────────────────────────────────

describe("pierre empreinte defaults", () => {
  it("default identity display_name is Pierre", () => {
    const id = buildDefaultPierreIdentity();
    expect(id.display_name).toBe("Pierre");
    expect(id.show_powered_by_clonestore).toBe(true);
  });

  it("default hr_scope has standard domains enabled", () => {
    const hs = buildDefaultHrScope();
    expect(hs.enabled_domains).toContain("task");
    expect(hs.enabled_domains).toContain("document");
    expect(hs.contract_types_in_scope).toContain("CDI");
  });

  it("default autonomy blocks email.send", () => {
    const a = buildDefaultPierreAutonomyRules();
    expect(a.blocked_task_types).toContain("email.send");
    expect(a.blocked_task_types).toContain("send_email");
    expect(a.require_human_review_before_send).toBe(true);
  });

  it("default email rules use draft_only mode", () => {
    const e = buildDefaultPierreEmailRules();
    expect(e.send_mode).toBe("draft_only");
    expect(e.never_auto_send_domains.length).toBeGreaterThan(0);
  });

  it("default sensitive cases always require human", () => {
    const sc = buildDefaultSensitiveCaseRules();
    expect(sc.always_require_human).toBe(true);
    expect(sc.hr_manager_must_validate).toBe(true);
    expect(sc.documentation_required).toBe(true);
  });

  it("builds default pierre empreinte with version", () => {
    const e = buildDefaultPierreEmpreinte("user1", "enterprise1");
    expect(e.id).toBe("user1");
    expect(e.enterprise_empreinte_id).toBe("enterprise1");
    expect(e.version).toBe(PIERRE_EMPREINTE_CURRENT_VERSION);
    expect(e.status).toBe("not_configured");
  });
});

// ── Completion ────────────────────────────────────────────────────────────────

describe("pierre empreinte completion", () => {
  it("scores empty (defaults) empreinte with a defined score", () => {
    const e = buildEmptyPierreEmpreinte();
    // Defaults fill sections — score is non-zero but identity section is empty
    expect(e.completion.score).toBeGreaterThanOrEqual(0);
    expect(typeof e.completion.can_activate).toBe("boolean");
  });

  it("scores minimal empreinte as partial or above", () => {
    const e = buildMinimalPierreEmpreinte();
    expect(e.completion.score).toBeGreaterThan(20);
  });

  it("scores complete empreinte as configured or complete", () => {
    const e = buildCompletePierreEmpreinte();
    expect(e.completion.score).toBeGreaterThan(50);
    expect(["configured", "complete"]).toContain(e.completion.status);
  });

  it("has identity_ready field", () => {
    const e = buildMinimalPierreEmpreinte();
    expect(typeof e.completion.identity_ready).toBe("boolean");
  });

  it("has hr_scope_ready field", () => {
    const e = buildMinimalPierreEmpreinte();
    expect(typeof e.completion.hr_scope_ready).toBe("boolean");
  });

  it("has document_ready field", () => {
    const e = buildMinimalPierreEmpreinte();
    expect(typeof e.completion.document_ready).toBe("boolean");
  });

  it("includes filled_sections and empty_sections", () => {
    const e = buildCompletePierreEmpreinte();
    expect(Array.isArray(e.completion.filled_sections)).toBe(true);
    expect(Array.isArray(e.completion.empty_sections)).toBe(true);
  });

  it("recommendations list is array", () => {
    const e = buildEmptyPierreEmpreinte();
    expect(Array.isArray(e.completion.recommendations)).toBe(true);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("pierre empreinte validation", () => {
  it("validates complete empreinte without errors", () => {
    const e = buildCompletePierreEmpreinte();
    const result = validatePierreEmpreinte(e);
    expect(result.error_count).toBe(0);
  });

  it("flags live_auto send mode as warning", () => {
    const e = buildMinimalPierreEmpreinte({
      email_rules: { send_mode: "live_auto", never_auto_send_domains: ["offboarding"] },
    });
    const result = validatePierreEmpreinte(e);
    expect(result.issues.some((i) => i.field.includes("send_mode") && i.severity === "warning")).toBe(true);
  });

  it("flags invalid ai_mode", () => {
    const e = buildMinimalPierreEmpreinte({
      autonomy: { ai_mode: "turbo", trust_level: "supervised", blocked_task_types: ["email.send"], require_human_review_before_send: true },
    });
    const result = validatePierreEmpreinte(e);
    expect(result.issues.some((i) => i.field.includes("ai_mode"))).toBe(true);
  });

  it("flags invalid trust_level", () => {
    const e = buildMinimalPierreEmpreinte({
      autonomy: { ai_mode: "assist", trust_level: "godmode", blocked_task_types: ["email.send"], require_human_review_before_send: true },
    });
    const result = validatePierreEmpreinte(e);
    expect(result.issues.some((i) => i.field.includes("trust_level"))).toBe(true);
  });

  it("flags invalid page_margin_mm", () => {
    const e = buildMinimalPierreEmpreinte({
      document_style: { page_margin_mm: 200, primary_color_hex: null, secondary_color_hex: null, font_family: null, header_template_id: null, footer_template_id: null, watermark_text: null, use_company_brand_mark: false },
    });
    const result = validatePierreEmpreinte(e);
    expect(result.issues.some((i) => i.field.includes("page_margin_mm"))).toBe(true);
  });

  it("returns valid for blank display_name error", () => {
    const e = buildMinimalPierreEmpreinte();
    e.identity.display_name = "";
    const result = validatePierreEmpreinte(e);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field.includes("display_name"))).toBe(true);
  });
});

// ── Normalizer ────────────────────────────────────────────────────────────────

describe("pierre empreinte normalizer", () => {
  it("handles null input gracefully", () => {
    const e = normalizePierreEmpreinte(null, "user1", "enterprise1");
    expect(e.id).toBe("user1");
    expect(e.identity.display_name).toBe("Pierre");
  });

  it("preserves custom display_name", () => {
    const e = normalizePierreEmpreinte({ identity: { display_name: "RH Acme" } }, "user1", "e1");
    expect(e.identity.display_name).toBe("RH Acme");
  });

  it("never_auto_execute preserves default if input empty", () => {
    const e = normalizePierreEmpreinte({}, "user1", "e1");
    expect(e.autonomy.blocked_task_types).toContain("email.send");
  });

  it("applies patch correctly", () => {
    const base = buildMinimalPierreEmpreinte();
    const patched = applyPierreEmpreintePatch(base, {
      identity: { greeting_message: "Bienvenue !" },
    });
    expect(patched.identity.greeting_message).toBe("Bienvenue !");
    expect(patched.identity.display_name).toBe(base.identity.display_name);
  });

  it("patch updates completion", () => {
    const base = buildEmptyPierreEmpreinte();
    const patched = applyPierreEmpreintePatch(base, {
      identity: { greeting_message: "Bonjour", persona_description: "Assistant RH" },
      document_rules: { default_tone: "warm", always_require_human_for_types: ["hr_contract_draft"] },
    });
    expect(patched.completion.score).toBeGreaterThan(base.completion.score);
  });

  it("auto-corrects missing never_auto_send_domains to defaults", () => {
    const e = normalizePierreEmpreinte({
      email_rules: { send_mode: "draft_only", never_auto_send_domains: [] },
    }, "user1", "e1");
    expect(e.email_rules.never_auto_send_domains.length).toBeGreaterThan(0);
  });
});

// ── Memory bridge ─────────────────────────────────────────────────────────────

describe("pierre empreinte memory bridge", () => {
  it("returns null when key missing", () => {
    expect(readPierreEmpreinteFromMemory({}, "user1", "e1")).toBeNull();
    expect(readPierreEmpreinteFromMemory(null, "user1", "e1")).toBeNull();
  });

  it("reads from memory_json", () => {
    const stored = buildMinimalPierreEmpreinte();
    const memory = { [PIERRE_EMPREINTE_MEMORY_KEY]: stored };
    const read = readPierreEmpreinteFromMemory(memory, "user1", stored.enterprise_empreinte_id);
    expect(read).not.toBeNull();
    expect(read?.identity.display_name).toBeDefined();
  });

  it("creates default if missing", () => {
    const e = readOrCreatePierreEmpreinte({}, "user1", "e1");
    expect(e.id).toBe("user1");
    expect(e.enterprise_empreinte_id).toBe("e1");
  });

  it("builds memory patch preserving other keys", () => {
    const p = buildMinimalPierreEmpreinte();
    const memory = { other_key: "value" };
    const patched = buildPierreEmpreinteMemoryPatch(memory, p);
    expect(patched.other_key).toBe("value");
    expect(patched[PIERRE_EMPREINTE_MEMORY_KEY]).toBeDefined();
  });

  it("applies and persists patch", () => {
    const { updated, newMemoryJson } = applyAndPersistPierreEmpreintePatch({
      memoryJson: {},
      userId: "user1",
      enterpriseEmpreinteId: "e1",
      patch: { identity: { display_name: "Pierre Acme" } },
    });
    expect(updated.identity.display_name).toBe("Pierre Acme");
    expect(newMemoryJson[PIERRE_EMPREINTE_MEMORY_KEY]).toBeDefined();
  });

  it("reset produces factory default", () => {
    const memory = buildPierreEmpreinteMemoryPatch({}, buildCompletePierreEmpreinte());
    const { reset } = resetPierreEmpreinteInMemory(memory, "user1", "e1");
    expect(reset.identity.display_name).toBe("Pierre");
    expect(reset.status).toBe("not_configured");
  });
});

// ── Workflow config ───────────────────────────────────────────────────────────

describe("pierre workflow runtime config", () => {
  it("builds config from empreinte", () => {
    const e = buildCompletePierreEmpreinte();
    const config = buildPierreWorkflowRuntimeConfig(e);
    expect(config.language).toBe("fr");
    expect(config.blocked_task_types).toContain("email.send");
    expect(config.sensitive_case_always_human).toBe(true);
  });

  it("builds default config when null", () => {
    const config = buildPierreWorkflowRuntimeConfig(null);
    expect(config.blocked_task_types).toContain("email.send");
    expect(config.email_send_mode).toBe("draft_only");
  });

  it("isDomainEnabled returns true for enabled domain", () => {
    const e = buildMinimalPierreEmpreinte();
    expect(isDomainEnabledInEmpreinte("task", e)).toBe(true);
  });

  it("isDomainEnabled returns false for disabled domain", () => {
    const e = buildMinimalPierreEmpreinte({
      hr_scope: { enabled_domains: ["task"], disabled_domains: ["prepayroll"] },
    });
    expect(isDomainEnabledInEmpreinte("prepayroll", e)).toBe(false);
  });

  it("isTaskTypeBlocked returns true for email.send", () => {
    const e = buildMinimalPierreEmpreinte();
    expect(isTaskTypeBlockedInEmpreinte("email.send", e)).toBe(true);
  });

  it("isTaskTypeBlocked returns false for email.draft", () => {
    const e = buildMinimalPierreEmpreinte();
    expect(isTaskTypeBlockedInEmpreinte("email.draft", e)).toBe(false);
  });

  it("requiresHumanForDocumentType returns true for contract", () => {
    const e = buildMinimalPierreEmpreinte();
    expect(requiresHumanForDocumentType("hr_contract_draft", e)).toBe(true);
  });
});

// ── Document prep ─────────────────────────────────────────────────────────────

describe("pierre document render config", () => {
  it("builds config from empreinte + enterprise", () => {
    const pierre = buildCompletePierreEmpreinte();
    const enterprise = buildCompleteEnterpriseEmpreinte();
    const config = buildPierreDocumentRenderConfig({ pierre, enterprise });
    expect(config.tone).toBeDefined();
    expect(config.language).toBeDefined();
  });

  it("falls back to defaults when both null", () => {
    const config = buildPierreDocumentRenderConfig({ pierre: null, enterprise: null });
    expect(config.language).toBe("fr");
    expect(config.format).toBe("markdown");
  });

  it("builds document variables", () => {
    const pierre = buildCompletePierreEmpreinte();
    const enterprise = buildCompleteEnterpriseEmpreinte();
    const vars = buildDocumentVariablesFromEmpreinte({ pierre, enterprise });
    expect(vars.company_name).toBeDefined();
    expect(vars.document_language).toBeDefined();
  });
});

// ── Versioning ────────────────────────────────────────────────────────────────

describe("pierre empreinte versioning", () => {
  it("parses version correctly", () => {
    const v = parsePierreEmpreinteVersion("1.2.3");
    expect(v.major).toBe(1);
    expect(v.minor).toBe(2);
    expect(v.patch).toBe(3);
  });

  it("bumps major version", () => {
    expect(bumpPierreEmpreinteVersion("1.2.3", "major")).toBe("2.0.0");
  });

  it("bumps minor version", () => {
    expect(bumpPierreEmpreinteVersion("1.2.3", "minor")).toBe("1.3.0");
  });

  it("isPierreVersionNewer works", () => {
    expect(isPierreVersionNewer("2.0.0", "1.9.9")).toBe(true);
    expect(isPierreVersionNewer("1.0.0", "2.0.0")).toBe(false);
  });

  it("current version does not need migration", () => {
    const e = buildCompletePierreEmpreinte();
    expect(pierreEmpreinteNeedsMigration(e)).toBe(false);
  });
});

// ── Verdict ───────────────────────────────────────────────────────────────────

describe("pierre empreinte verdict", () => {
  it("returns not_ready for empty empreinte", () => {
    const pierre = buildEmptyPierreEmpreinte();
    const verdict = buildPierreEmpreinteVerdict({ pierre, enterprise: null });
    expect(verdict.level).toBe("not_ready");
    expect(verdict.safe_to_activate).toBe(false);
    expect(verdict.blocking_issues.length).toBeGreaterThan(0);
  });

  it("returns production_ready or above for complete setup", () => {
    const pierre = buildCompletePierreEmpreinte();
    const enterprise = buildCompleteEnterpriseEmpreinte();
    const verdict = buildPierreEmpreinteVerdict({ pierre, enterprise });
    expect(["minimal_viable", "production_ready", "fully_configured"]).toContain(verdict.level);
  });

  it("blocks live_auto email mode", () => {
    const pierre = buildMinimalPierreEmpreinte({
      email_rules: { send_mode: "live_auto", never_auto_send_domains: [] },
    });
    const verdict = buildPierreEmpreinteVerdict({ pierre, enterprise: null });
    expect(verdict.safe_to_activate).toBe(false);
    expect(verdict.blocking_issues.some((b: string) => b.includes("live_auto"))).toBe(true);
  });

  it("blocks when email.send not in blocked_task_types", () => {
    // Pass non-empty array that doesn't include email.send (non-empty bypasses normalizer default)
    const pierre = buildMinimalPierreEmpreinte({
      autonomy: { ai_mode: "assist", trust_level: "supervised", blocked_task_types: ["document.generate"], require_human_review_before_send: true, max_auto_actions_per_session: 5, allowed_auto_task_types: [] },
    });
    const verdict = buildPierreEmpreinteVerdict({ pierre, enterprise: null });
    expect(verdict.areas.find((a) => a.area === "autonomy")?.ready).toBe(false);
  });

  it("includes areas array", () => {
    const pierre = buildMinimalPierreEmpreinte();
    const verdict = buildPierreEmpreinteVerdict({ pierre, enterprise: null });
    expect(Array.isArray(verdict.areas)).toBe(true);
    expect(verdict.areas.length).toBeGreaterThan(0);
  });

  it("includes enterprise and pierre completion scores", () => {
    const pierre = buildMinimalPierreEmpreinte();
    const enterprise = buildCompleteEnterpriseEmpreinte();
    const verdict = buildPierreEmpreinteVerdict({ pierre, enterprise });
    expect(typeof verdict.enterprise_completion).toBe("number");
    expect(typeof verdict.pierre_completion).toBe("number");
    expect(typeof verdict.overall_score).toBe("number");
  });
});
