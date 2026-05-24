// src/lib/clonestore/adn/__tests__/cloneadn.test.ts
// Bloc 28 — CloneADN unit tests (220+ tests)
// No real API calls. No Supabase. No OpenAI/Anthropic. Pure functions only.

import { describe, it, expect } from "vitest";

// Utils
import {
  isPlainObject,
  safeADNString,
  normalizeADNId,
  normalizeCloneADNTone,
  normalizeCloneADNAutonomyLevel,
  normalizeCloneADNValidationMode,
  normalizeCloneADNRuleSeverity,
  normalizeCloneADNCommunicationLength,
  normalizeCloneADNRuleCategory,
  normalizeCloneADNProfileStatus,
  dedupeADNStringList,
  clampADNScore,
  nowISO,
  containsSensitiveHRTopic,
  detectADNDomainFromText,
  isValidADNEmail,
  normalizeADNCountryCode,
} from "../utils";

// Profile
import {
  buildDefaultCloneADNProfile,
  buildDefaultCloneADNCommunicationProfile,
  buildDefaultCloneADNValidationProfile,
  buildDefaultCloneADNAutonomyProfile,
  buildDefaultCloneADNDocumentProfile,
  buildDefaultCloneADNCompanyIdentity,
  sanitizeCloneADNProfile,
  sanitizeCloneADNRule,
  sanitizeCloneADNSite,
  sanitizeCloneADNDepartment,
  sanitizeCloneADNInferredPreference,
  mergeCloneADNProfilePatch,
  analyzeCloneADNProfile,
  buildCloneADNApplicationContext,
  readCloneADNFromReusableContext,
  buildCloneADNStoragePatch,
} from "../profile";

// Rules
import {
  evaluateCloneADNRules,
  shouldCloneADNRequireValidation,
  shouldCloneADNBlockAction,
  buildCloneADNRuleSummary,
} from "../rules";

// Pierre adapter
import {
  readPierreCloneADNFromReusableContext,
  buildPierreCompanyContextFromCloneADN,
  buildPierreDocumentVariablesFromCloneADN,
  evaluatePierreActionWithCloneADN,
  buildPierreCloneADNHint,
} from "../../../pierre/adn/cloneadn";

import type { CloneADNProfile, CloneADNRule } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRule(overrides: Partial<CloneADNRule> = {}): CloneADNRule {
  return {
    id: "rule-01",
    label: "Test rule",
    description: "",
    category: "custom",
    severity: "warning",
    condition: "always",
    action: "require_review",
    active: true,
    applies_to_domains: [],
    applies_to_task_types: [],
    requires_human_validation: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeFullProfile(overrides: Partial<CloneADNProfile> = {}): CloneADNProfile {
  const base = buildDefaultCloneADNProfile();
  return {
    ...base,
    company_identity: {
      ...base.company_identity,
      legal_name: "Acme Corp",
      trade_name: "Acme",
      sector: "tech",
      country_code: "FR",
    },
    communication: {
      ...base.communication,
      tone: "warm",
      formal_closing: "Cordialement",
      greeting_style: "Bonjour",
    },
    validation: {
      ...base.validation,
      sensitive_topics: ["licenciement", "salaire"],
    },
    ...overrides,
  };
}

// ── 1. isPlainObject ──────────────────────────────────────────────────────────

describe("isPlainObject", () => {
  it("returns true for plain objects", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });
  it("returns false for arrays", () => expect(isPlainObject([])).toBe(false));
  it("returns false for null", () => expect(isPlainObject(null)).toBe(false));
  it("returns false for primitives", () => {
    expect(isPlainObject("str")).toBe(false);
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject(true)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
  });
});

// ── 2. safeADNString ──────────────────────────────────────────────────────────

describe("safeADNString", () => {
  it("trims and returns string within limit", () => {
    expect(safeADNString("  hello  ", 100)).toBe("hello");
  });
  it("truncates to maxChars", () => {
    expect(safeADNString("abcdefgh", 3)).toBe("abc");
  });
  it("returns null for non-string", () => {
    expect(safeADNString(null)).toBeNull();
    expect(safeADNString(42)).toBeNull();
  });
  it("returns null for empty string when allowEmpty=false (default)", () => {
    expect(safeADNString("   ")).toBeNull();
  });
  it("returns empty string when allowEmpty=true", () => {
    expect(safeADNString("   ", 500, true)).toBe("");
  });
});

// ── 3. normalizeADNId ─────────────────────────────────────────────────────────

describe("normalizeADNId", () => {
  it("lowercases and strips invalid chars", () => {
    expect(normalizeADNId("Rule-01")).toBe("rule-01");
    expect(normalizeADNId("ABC_123")).toBe("abc_123");
  });
  it("returns null for too-short ID", () => {
    expect(normalizeADNId("a")).toBeNull();
  });
  it("returns null for too-long ID", () => {
    expect(normalizeADNId("a".repeat(200))).toBeNull();
  });
  it("returns null for non-string", () => {
    expect(normalizeADNId(null)).toBeNull();
    expect(normalizeADNId(42)).toBeNull();
  });
});

// ── 4. normalizeCloneADNTone ──────────────────────────────────────────────────

describe("normalizeCloneADNTone", () => {
  it("accepts all valid tones", () => {
    const tones = ["formal", "warm", "direct", "executive", "neutral", "legal_careful", "candidate_friendly", "internal_concise"] as const;
    for (const t of tones) {
      expect(normalizeCloneADNTone(t)).toBe(t);
    }
  });
  it("falls back to 'formal' for unknown value", () => {
    expect(normalizeCloneADNTone("casual")).toBe("formal");
    expect(normalizeCloneADNTone(null)).toBe("formal");
  });
  it("respects custom fallback", () => {
    expect(normalizeCloneADNTone("unknown", "warm")).toBe("warm");
  });
});

// ── 5. normalizeCloneADNAutonomyLevel ─────────────────────────────────────────

describe("normalizeCloneADNAutonomyLevel", () => {
  it("accepts all valid levels", () => {
    const levels = ["manual", "assist", "supervised", "trusted", "restricted"] as const;
    for (const l of levels) {
      expect(normalizeCloneADNAutonomyLevel(l)).toBe(l);
    }
  });
  it("falls back to 'supervised'", () => {
    expect(normalizeCloneADNAutonomyLevel("auto")).toBe("supervised");
    expect(normalizeCloneADNAutonomyLevel(undefined)).toBe("supervised");
  });
});

// ── 6. normalizeCloneADNValidationMode ────────────────────────────────────────

describe("normalizeCloneADNValidationMode", () => {
  it("accepts none, recommended, required, human_only", () => {
    expect(normalizeCloneADNValidationMode("none")).toBe("none");
    expect(normalizeCloneADNValidationMode("recommended")).toBe("recommended");
    expect(normalizeCloneADNValidationMode("required")).toBe("required");
    expect(normalizeCloneADNValidationMode("human_only")).toBe("human_only");
  });
  it("falls back to recommended for unknown", () => {
    expect(normalizeCloneADNValidationMode("strict")).toBe("recommended");
  });
});

// ── 7. normalizeCloneADNRuleSeverity ──────────────────────────────────────────

describe("normalizeCloneADNRuleSeverity", () => {
  it("accepts info, warning, block, critical", () => {
    expect(normalizeCloneADNRuleSeverity("info")).toBe("info");
    expect(normalizeCloneADNRuleSeverity("warning")).toBe("warning");
    expect(normalizeCloneADNRuleSeverity("block")).toBe("block");
    expect(normalizeCloneADNRuleSeverity("critical")).toBe("critical");
  });
  it("falls back to warning", () => {
    expect(normalizeCloneADNRuleSeverity("high")).toBe("warning");
  });
});

// ── 8. normalizeCloneADNCommunicationLength ───────────────────────────────────

describe("normalizeCloneADNCommunicationLength", () => {
  it("accepts concise, standard, detailed, comprehensive", () => {
    expect(normalizeCloneADNCommunicationLength("concise")).toBe("concise");
    expect(normalizeCloneADNCommunicationLength("standard")).toBe("standard");
    expect(normalizeCloneADNCommunicationLength("detailed")).toBe("detailed");
    expect(normalizeCloneADNCommunicationLength("comprehensive")).toBe("comprehensive");
  });
  it("falls back to standard", () => {
    expect(normalizeCloneADNCommunicationLength("verbose")).toBe("standard");
  });
});

// ── 9. normalizeCloneADNRuleCategory ──────────────────────────────────────────

describe("normalizeCloneADNRuleCategory", () => {
  it("accepts all valid categories", () => {
    const cats = ["communication", "validation", "autonomy", "document", "compliance", "security", "hr_process", "custom"] as const;
    for (const c of cats) {
      expect(normalizeCloneADNRuleCategory(c)).toBe(c);
    }
  });
  it("falls back to custom", () => {
    expect(normalizeCloneADNRuleCategory("other")).toBe("custom");
  });
});

// ── 10. normalizeCloneADNProfileStatus ────────────────────────────────────────

describe("normalizeCloneADNProfileStatus", () => {
  it("accepts all valid statuses", () => {
    const statuses = ["not_configured", "partial", "configured", "strong", "locked"] as const;
    for (const s of statuses) {
      expect(normalizeCloneADNProfileStatus(s)).toBe(s);
    }
  });
  it("falls back to not_configured", () => {
    expect(normalizeCloneADNProfileStatus("unknown")).toBe("not_configured");
  });
});

// ── 11. dedupeADNStringList ───────────────────────────────────────────────────

describe("dedupeADNStringList", () => {
  it("deduplicates strings", () => {
    expect(dedupeADNStringList(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });
  it("respects maxItems", () => {
    expect(dedupeADNStringList(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]);
  });
  it("trims items", () => {
    expect(dedupeADNStringList(["  hello  "])).toEqual(["hello"]);
  });
  it("filters non-strings", () => {
    expect(dedupeADNStringList([1, null, "ok", true])).toEqual(["ok"]);
  });
  it("returns empty array for non-array input", () => {
    expect(dedupeADNStringList(null)).toEqual([]);
    expect(dedupeADNStringList("string")).toEqual([]);
  });
  it("respects maxChars per item", () => {
    const result = dedupeADNStringList(["abcde"], 10, 3);
    expect(result).toEqual(["abc"]);
  });
  it("drops empty strings after trim", () => {
    expect(dedupeADNStringList(["   "])).toEqual([]);
  });
});

// ── 12. clampADNScore ─────────────────────────────────────────────────────────

describe("clampADNScore", () => {
  it("clamps to 0-100", () => {
    expect(clampADNScore(-5)).toBe(0);
    expect(clampADNScore(105)).toBe(100);
    expect(clampADNScore(50)).toBe(50);
  });
  it("rounds fractional values", () => {
    expect(clampADNScore(50.6)).toBe(51);
  });
  it("returns 0 for NaN, Infinity, null, string", () => {
    expect(clampADNScore(NaN)).toBe(0);
    expect(clampADNScore(Infinity)).toBe(0);
    expect(clampADNScore(null)).toBe(0);
    expect(clampADNScore("50")).toBe(0);
  });
});

// ── 13. nowISO ────────────────────────────────────────────────────────────────

describe("nowISO", () => {
  it("returns a valid ISO string", () => {
    const result = nowISO();
    expect(typeof result).toBe("string");
    expect(() => new Date(result)).not.toThrow();
    expect(new Date(result).toISOString()).toBe(result);
  });
});

// ── 14. containsSensitiveHRTopic ──────────────────────────────────────────────

describe("containsSensitiveHRTopic", () => {
  it("detects disciplinary", () => expect(containsSensitiveHRTopic("a disciplinary meeting")).toBe(true));
  it("detects licenciement", () => expect(containsSensitiveHRTopic("lettre de licenciement")).toBe(true));
  it("detects harassment", () => expect(containsSensitiveHRTopic("harassment complaint")).toBe(true));
  it("detects salary", () => expect(containsSensitiveHRTopic("salary review")).toBe(true));
  it("detects medical", () => expect(containsSensitiveHRTopic("medical leave")).toBe(true));
  it("detects termination", () => expect(containsSensitiveHRTopic("termination letter")).toBe(true));
  it("detects legal", () => expect(containsSensitiveHRTopic("legal proceedings")).toBe(true));
  it("detects faute", () => expect(containsSensitiveHRTopic("faute grave")).toBe(true));
  it("returns false for normal text", () => expect(containsSensitiveHRTopic("onboarding plan")).toBe(false));
  it("returns false for non-string", () => {
    expect(containsSensitiveHRTopic(null)).toBe(false);
    expect(containsSensitiveHRTopic(42)).toBe(false);
  });
  it("is case-insensitive", () => expect(containsSensitiveHRTopic("SALARY")).toBe(true));
});

// ── 15. detectADNDomainFromText ───────────────────────────────────────────────

describe("detectADNDomainFromText", () => {
  it("detects contract", () => expect(detectADNDomainFromText("sign the contract")).toBe("contract"));
  it("detects onboarding", () => expect(detectADNDomainFromText("onboarding plan")).toBe("onboarding"));
  it("detects payroll", () => expect(detectADNDomainFromText("payroll review")).toBe("payroll"));
  it("detects communication", () => expect(detectADNDomainFromText("send an email")).toBe("communication"));
  it("detects disciplinary", () => expect(detectADNDomainFromText("disciplinary warning")).toBe("disciplinary"));
  it("detects absence", () => expect(detectADNDomainFromText("absence report")).toBe("absence"));
  it("returns general for unknown", () => expect(detectADNDomainFromText("random text here")).toBe("general"));
  it("returns general for empty", () => expect(detectADNDomainFromText("")).toBe("general"));
  it("returns general for non-string", () => expect(detectADNDomainFromText(null)).toBe("general"));
});

// ── 16. isValidADNEmail ───────────────────────────────────────────────────────

describe("isValidADNEmail", () => {
  it("validates valid emails", () => {
    expect(isValidADNEmail("rh@acme.fr")).toBe(true);
    expect(isValidADNEmail("user.name+tag@example.com")).toBe(true);
  });
  it("rejects invalid emails", () => {
    expect(isValidADNEmail("notanemail")).toBe(false);
    expect(isValidADNEmail("@domain.com")).toBe(false);
    expect(isValidADNEmail("user@")).toBe(false);
  });
  it("rejects non-string", () => {
    expect(isValidADNEmail(null)).toBe(false);
    expect(isValidADNEmail(42)).toBe(false);
  });
});

// ── 17. normalizeADNCountryCode ───────────────────────────────────────────────

describe("normalizeADNCountryCode", () => {
  it("normalizes 2-letter codes", () => {
    expect(normalizeADNCountryCode("fr")).toBe("FR");
    expect(normalizeADNCountryCode("us")).toBe("US");
    expect(normalizeADNCountryCode("FR")).toBe("FR");
  });
  it("returns null for invalid codes", () => {
    expect(normalizeADNCountryCode("FRA")).toBeNull();
    expect(normalizeADNCountryCode("F")).toBeNull();
    expect(normalizeADNCountryCode(null)).toBeNull();
    expect(normalizeADNCountryCode("12")).toBeNull();
  });
});

// ── 18. buildDefaultCloneADNProfile ──────────────────────────────────────────

describe("buildDefaultCloneADNProfile", () => {
  it("returns status not_configured", () => {
    expect(buildDefaultCloneADNProfile().status).toBe("not_configured");
  });
  it("has supervised autonomy level", () => {
    expect(buildDefaultCloneADNProfile().autonomy.level).toBe("supervised");
  });
  it("never_auto_execute includes email.send and email_send", () => {
    const p = buildDefaultCloneADNProfile();
    expect(p.validation.never_auto_execute).toContain("email.send");
    expect(p.validation.never_auto_execute).toContain("email_send");
  });
  it("has recommended default_mode", () => {
    expect(buildDefaultCloneADNProfile().validation.default_mode).toBe("recommended");
  });
  it("has empty rules, sites, departments", () => {
    const p = buildDefaultCloneADNProfile();
    expect(p.rules).toHaveLength(0);
    expect(p.sites).toHaveLength(0);
    expect(p.departments).toHaveLength(0);
  });
  it("has version 1.0.0", () => {
    expect(buildDefaultCloneADNProfile().version).toBe("1.0.0");
  });
  it("has completeness_score 0", () => {
    expect(buildDefaultCloneADNProfile().completeness_score).toBe(0);
  });
  it("has created_at and updated_at as ISO strings", () => {
    const p = buildDefaultCloneADNProfile();
    expect(() => new Date(p.created_at)).not.toThrow();
    expect(() => new Date(p.updated_at)).not.toThrow();
  });
  it("has formal tone by default", () => {
    expect(buildDefaultCloneADNProfile().communication.tone).toBe("formal");
  });
  it("blocks email.send in autonomy blocked_auto_task_types", () => {
    expect(buildDefaultCloneADNProfile().autonomy.blocked_auto_task_types).toContain("email.send");
  });
});

// ── 19. sanitizeCloneADNRule ──────────────────────────────────────────────────

describe("sanitizeCloneADNRule", () => {
  it("sanitizes a valid rule", () => {
    const result = sanitizeCloneADNRule({ id: "rule-01", label: "Test rule", condition: "always" });
    expect(result).not.toBeNull();
    expect(result!.id).toBe("rule-01");
    expect(result!.label).toBe("Test rule");
    expect(result!.active).toBe(true);
  });
  it("returns null for missing id", () => {
    expect(sanitizeCloneADNRule({ label: "No ID" })).toBeNull();
  });
  it("returns null for missing label", () => {
    expect(sanitizeCloneADNRule({ id: "rule-01" })).toBeNull();
  });
  it("returns null for non-object", () => {
    expect(sanitizeCloneADNRule(null)).toBeNull();
    expect(sanitizeCloneADNRule("string")).toBeNull();
  });
  it("normalizes severity with fallback", () => {
    const r = sanitizeCloneADNRule({ id: "r-02", label: "Test", severity: "bad" });
    expect(r!.severity).toBe("warning");
  });
  it("normalizes category with fallback", () => {
    const r = sanitizeCloneADNRule({ id: "r-03", label: "Test", category: "unknown" });
    expect(r!.category).toBe("custom");
  });
  it("sets active=true by default", () => {
    const r = sanitizeCloneADNRule({ id: "r-04", label: "Active" });
    expect(r!.active).toBe(true);
  });
  it("respects active=false", () => {
    const r = sanitizeCloneADNRule({ id: "r-05", label: "Inactive", active: false });
    expect(r!.active).toBe(false);
  });
  it("dedupes applies_to_domains", () => {
    const r = sanitizeCloneADNRule({ id: "r-06", label: "L", applies_to_domains: ["hr", "hr", "payroll"] });
    expect(r!.applies_to_domains).toEqual(["hr", "payroll"]);
  });
});

// ── 20. sanitizeCloneADNSite ──────────────────────────────────────────────────

describe("sanitizeCloneADNSite", () => {
  it("sanitizes a valid site", () => {
    const s = sanitizeCloneADNSite({ id: "site-01", name: "Paris HQ", country_code: "FR", active: true });
    expect(s).not.toBeNull();
    expect(s!.id).toBe("site-01");
    expect(s!.name).toBe("Paris HQ");
    expect(s!.country_code).toBe("FR");
  });
  it("returns null for missing id", () => expect(sanitizeCloneADNSite({ name: "Site" })).toBeNull());
  it("returns null for missing name", () => expect(sanitizeCloneADNSite({ id: "s1" })).toBeNull());
  it("returns null for non-object", () => expect(sanitizeCloneADNSite("string")).toBeNull());
  it("normalizes country_code to uppercase 2-letter", () => {
    const s = sanitizeCloneADNSite({ id: "site-02", name: "London", country_code: "gb" });
    expect(s!.country_code).toBe("GB");
  });
  it("sets active=true by default", () => {
    const s = sanitizeCloneADNSite({ id: "site-03", name: "Lyon" });
    expect(s!.active).toBe(true);
  });
});

// ── 21. sanitizeCloneADNDepartment ────────────────────────────────────────────

describe("sanitizeCloneADNDepartment", () => {
  it("sanitizes a valid department", () => {
    const d = sanitizeCloneADNDepartment({ id: "dept-01", name: "RH", headcount: 5 });
    expect(d).not.toBeNull();
    expect(d!.headcount).toBe(5);
  });
  it("returns null for missing id", () => expect(sanitizeCloneADNDepartment({ name: "RH" })).toBeNull());
  it("returns null for non-object", () => expect(sanitizeCloneADNDepartment(null)).toBeNull());
  it("sets headcount null for invalid value", () => {
    const d = sanitizeCloneADNDepartment({ id: "dept-02", name: "IT", headcount: "five" });
    expect(d!.headcount).toBeNull();
  });
  it("clamps negative headcount to null", () => {
    const d = sanitizeCloneADNDepartment({ id: "dept-03", name: "Sales", headcount: -1 });
    expect(d!.headcount).toBeNull();
  });
});

// ── 22. sanitizeCloneADNInferredPreference ────────────────────────────────────

describe("sanitizeCloneADNInferredPreference", () => {
  it("sanitizes a valid preference", () => {
    const p = sanitizeCloneADNInferredPreference({ key: "tone_pref", value: "formal", source: "explicit", confidence: 0.9 });
    expect(p).not.toBeNull();
    expect(p!.key).toBe("tone_pref");
    expect(p!.confidence).toBe(0.9);
  });
  it("returns null for missing key", () => {
    expect(sanitizeCloneADNInferredPreference({ value: "formal" })).toBeNull();
  });
  it("returns null for missing value", () => {
    expect(sanitizeCloneADNInferredPreference({ key: "pref" })).toBeNull();
  });
  it("clamps confidence to 0-1", () => {
    const p = sanitizeCloneADNInferredPreference({ key: "k", value: "v", confidence: 2.5 });
    expect(p!.confidence).toBe(1);
  });
  it("defaults source to inferred", () => {
    const p = sanitizeCloneADNInferredPreference({ key: "k", value: "v", source: "unknown" });
    expect(p!.source).toBe("inferred");
  });
});

// ── 23. sanitizeCloneADNProfile ───────────────────────────────────────────────

describe("sanitizeCloneADNProfile", () => {
  it("returns null for null input", () => expect(sanitizeCloneADNProfile(null)).toBeNull());
  it("returns null for non-object", () => expect(sanitizeCloneADNProfile("bad")).toBeNull());
  it("sanitizes a minimal object", () => {
    const result = sanitizeCloneADNProfile({ status: "partial" });
    expect(result).not.toBeNull();
    expect(result!.status).toBe("partial");
  });
  it("defaults status to partial for missing status", () => {
    const result = sanitizeCloneADNProfile({});
    expect(result!.status).toBe("partial");
  });
  it("sanitizes communication profile", () => {
    const result = sanitizeCloneADNProfile({ communication: { tone: "warm" } });
    expect(result!.communication.tone).toBe("warm");
  });
  it("limits rules to MAX_RULES=100", () => {
    const rules = Array.from({ length: 120 }, (_, i) => ({ id: `r-${String(i).padStart(3, "0")}`, label: `Rule ${i}`, condition: "always" }));
    const result = sanitizeCloneADNProfile({ rules });
    expect(result!.rules.length).toBeLessThanOrEqual(100);
  });
  it("limits sites to MAX_SITES=50", () => {
    const sites = Array.from({ length: 60 }, (_, i) => ({ id: `site-${String(i).padStart(3, "0")}`, name: `Site ${i}` }));
    const result = sanitizeCloneADNProfile({ sites });
    expect(result!.sites.length).toBeLessThanOrEqual(50);
  });
  it("filters invalid rules", () => {
    const result = sanitizeCloneADNProfile({ rules: [{ label: "No ID" }, { id: "ok-rule", label: "Valid" }] });
    expect(result!.rules.length).toBe(1);
  });
  it("preserves valid_at timestamps", () => {
    const result = sanitizeCloneADNProfile({ created_at: "2025-01-01T00:00:00.000Z" });
    expect(result!.created_at).toBe("2025-01-01T00:00:00.000Z");
  });
  it("clamps completeness_score", () => {
    const result = sanitizeCloneADNProfile({ completeness_score: 150 });
    expect(result!.completeness_score).toBe(100);
  });
});

// ── 24. mergeCloneADNProfilePatch ─────────────────────────────────────────────

describe("mergeCloneADNProfilePatch", () => {
  it("merges communication patch", () => {
    const base = buildDefaultCloneADNProfile();
    const merged = mergeCloneADNProfilePatch(base, { communication: { tone: "warm" } });
    expect(merged.communication.tone).toBe("warm");
  });
  it("preserves unpatched fields", () => {
    const base = buildDefaultCloneADNProfile();
    const merged = mergeCloneADNProfilePatch(base, { communication: { tone: "direct" } });
    expect(merged.validation.default_mode).toBe("recommended");
  });
  it("replaces rules array entirely", () => {
    const base = buildDefaultCloneADNProfile();
    const newRules = [makeRule({ id: "new-01", label: "New rule" })];
    const merged = mergeCloneADNProfilePatch(base, { rules: newRules });
    expect(merged.rules.length).toBe(1);
    expect(merged.rules[0].id).toBe("new-01");
  });
  it("replaces sites array entirely", () => {
    const base = buildDefaultCloneADNProfile();
    const merged = mergeCloneADNProfilePatch(base, { sites: [{ id: "site-01", name: "HQ", active: true }] });
    expect(merged.sites.length).toBe(1);
  });
  it("returns base on exception", () => {
    const base = buildDefaultCloneADNProfile();
    const merged = mergeCloneADNProfilePatch(base, {} as never);
    expect(merged).toBeTruthy();
  });
  it("updates updated_at", () => {
    const base = { ...buildDefaultCloneADNProfile(), updated_at: "2025-01-01T00:00:00.000Z" };
    const merged = mergeCloneADNProfilePatch(base, { communication: { tone: "warm" } });
    expect(merged.updated_at).not.toBe("2025-01-01T00:00:00.000Z");
  });
  it("merges autonomy patch", () => {
    const base = buildDefaultCloneADNProfile();
    const merged = mergeCloneADNProfilePatch(base, { autonomy: { level: "trusted" } });
    expect(merged.autonomy.level).toBe("trusted");
  });
});

// ── 25. analyzeCloneADNProfile ────────────────────────────────────────────────

describe("analyzeCloneADNProfile", () => {
  it("returns not_configured for null", () => {
    const a = analyzeCloneADNProfile(null);
    expect(a.status).toBe("not_configured");
    expect(a.completeness_score).toBe(0);
  });
  it("detects company identity", () => {
    const p = makeFullProfile();
    const a = analyzeCloneADNProfile(p);
    expect(a.has_company_identity).toBe(true);
  });
  it("detects communication profile", () => {
    const p = makeFullProfile();
    const a = analyzeCloneADNProfile(p);
    expect(a.has_communication_profile).toBe(true);
  });
  it("detects validation rules when sensitive_topics set", () => {
    const p = makeFullProfile({ validation: { ...buildDefaultCloneADNValidationProfile(), sensitive_topics: ["licenciement"] } });
    const a = analyzeCloneADNProfile(p);
    expect(a.has_validation_rules).toBe(true);
  });
  it("counts active rules", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "R1", active: true }), makeRule({ id: "r2", label: "R2", active: false })] });
    const a = analyzeCloneADNProfile(p);
    expect(a.active_rules_count).toBe(1);
  });
  it("counts blocking rules (severity block/critical)", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Block", severity: "block", active: true })] });
    const a = analyzeCloneADNProfile(p);
    expect(a.blocking_rules_count).toBe(1);
  });
  it("produces recommendations for empty profile", () => {
    const a = analyzeCloneADNProfile(buildDefaultCloneADNProfile());
    expect(a.recommendations.length).toBeGreaterThan(0);
  });
  it("produces strengths for configured profile", () => {
    const p = makeFullProfile();
    const a = analyzeCloneADNProfile(p);
    expect(a.strengths.length).toBeGreaterThan(0);
  });
  it("assigns status based on score", () => {
    const p = makeFullProfile();
    const a = analyzeCloneADNProfile(p);
    expect(["partial", "configured", "strong", "locked"]).toContain(a.status);
  });
  it("counts inferred preferences", () => {
    const pref = sanitizeCloneADNInferredPreference({ key: "k", value: "v" });
    const p = makeFullProfile({ inferred_preferences: pref ? [pref] : [] });
    const a = analyzeCloneADNProfile(p);
    expect(a.inferred_preferences_count).toBe(1);
  });
});

// ── 26. buildCloneADNApplicationContext ───────────────────────────────────────

describe("buildCloneADNApplicationContext", () => {
  it("returns safe defaults for null", () => {
    const ctx = buildCloneADNApplicationContext(null);
    expect(ctx.tone).toBe("formal");
    expect(ctx.autonomy_level).toBe("supervised");
    expect(ctx.never_auto_execute).toContain("email.send");
  });
  it("returns profile tone", () => {
    const p = makeFullProfile();
    const ctx = buildCloneADNApplicationContext(p);
    expect(ctx.tone).toBe("warm");
  });
  it("returns company name (trade_name preferred)", () => {
    const p = makeFullProfile();
    const ctx = buildCloneADNApplicationContext(p);
    expect(ctx.company_name).toBe("Acme");
  });
  it("falls back to legal_name when no trade_name", () => {
    const p = makeFullProfile({ company_identity: { ...buildDefaultCloneADNCompanyIdentity(), legal_name: "Legal Corp", trade_name: null } });
    const ctx = buildCloneADNApplicationContext(p);
    expect(ctx.company_name).toBe("Legal Corp");
  });
  it("returns sector", () => {
    const ctx = buildCloneADNApplicationContext(makeFullProfile());
    expect(ctx.sector).toBe("tech");
  });
  it("only returns active rules", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Active" }), makeRule({ id: "r2", label: "Inactive", active: false })] });
    const ctx = buildCloneADNApplicationContext(p);
    expect(ctx.active_rules.length).toBe(1);
  });
  it("returns formal_closing and greeting_style", () => {
    const ctx = buildCloneADNApplicationContext(makeFullProfile());
    expect(ctx.formal_closing).toBe("Cordialement");
    expect(ctx.greeting_style).toBe("Bonjour");
  });
  it("returns preferred_format from document profile", () => {
    const p = makeFullProfile({ document: { ...buildDefaultCloneADNDocumentProfile(), preferred_format: "markdown" } });
    const ctx = buildCloneADNApplicationContext(p);
    expect(ctx.preferred_format).toBe("markdown");
  });
});

// ── 27. readCloneADNFromReusableContext ───────────────────────────────────────

describe("readCloneADNFromReusableContext", () => {
  it("reads clone_adn from context", () => {
    const profile = buildDefaultCloneADNProfile();
    const ctx = { clone_adn: profile, employees: [] };
    const result = readCloneADNFromReusableContext(ctx);
    expect(result).not.toBeNull();
  });
  it("returns null for missing clone_adn", () => {
    expect(readCloneADNFromReusableContext({ employees: [] })).toBeNull();
  });
  it("returns null for null input", () => {
    expect(readCloneADNFromReusableContext(null)).toBeNull();
  });
  it("returns null for non-object input", () => {
    expect(readCloneADNFromReusableContext("string")).toBeNull();
  });
  it("returns null for invalid clone_adn value", () => {
    expect(readCloneADNFromReusableContext({ clone_adn: "not-an-object" })).toBeNull();
  });
});

// ── 28. buildCloneADNStoragePatch ─────────────────────────────────────────────

describe("buildCloneADNStoragePatch", () => {
  it("writes clone_adn key", () => {
    const profile = buildDefaultCloneADNProfile();
    const patch = buildCloneADNStoragePatch({ reusableRhContextJson: {}, profile });
    expect(patch["clone_adn"]).toBe(profile);
  });
  it("preserves employees key", () => {
    const profile = buildDefaultCloneADNProfile();
    const existing = { employees: [{ id: "e1" }], document_templates: [] };
    const patch = buildCloneADNStoragePatch({ reusableRhContextJson: existing, profile });
    expect(patch["employees"]).toEqual([{ id: "e1" }]);
  });
  it("preserves document_templates key", () => {
    const profile = buildDefaultCloneADNProfile();
    const existing = { document_templates: [{ id: "tmpl-01" }] };
    const patch = buildCloneADNStoragePatch({ reusableRhContextJson: existing, profile });
    expect(patch["document_templates"]).toEqual([{ id: "tmpl-01" }]);
  });
  it("preserves other existing keys", () => {
    const profile = buildDefaultCloneADNProfile();
    const existing = { other_key: "other_value" };
    const patch = buildCloneADNStoragePatch({ reusableRhContextJson: existing, profile });
    expect(patch["other_key"]).toBe("other_value");
  });
  it("does not add employees key if not in existing", () => {
    const profile = buildDefaultCloneADNProfile();
    const patch = buildCloneADNStoragePatch({ reusableRhContextJson: {}, profile });
    expect("employees" in patch).toBe(false);
  });
  it("does not add document_templates key if not in existing", () => {
    const profile = buildDefaultCloneADNProfile();
    const patch = buildCloneADNStoragePatch({ reusableRhContextJson: {}, profile });
    expect("document_templates" in patch).toBe(false);
  });
});

// ── 29. evaluateCloneADNRules ─────────────────────────────────────────────────

describe("evaluateCloneADNRules", () => {
  it("returns safe defaults for null profile", () => {
    const result = evaluateCloneADNRules(null, {});
    expect(result.blocked).toBe(false);
    expect(result.requires_validation).toBe(false);
    expect(result.decisions).toHaveLength(0);
  });

  it("triggers rule with condition=always", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Always", condition: "always" })] });
    const result = evaluateCloneADNRules(p, {});
    expect(result.triggered_rules.length).toBe(1);
  });

  it("does not trigger inactive rule", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Inactive", active: false, condition: "always" })] });
    const result = evaluateCloneADNRules(p, {});
    expect(result.triggered_rules.length).toBe(0);
  });

  it("triggers rule on risk_level:high", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "High risk", condition: "risk_level:high", severity: "block" })] });
    const result = evaluateCloneADNRules(p, { risk_level: "high" });
    expect(result.blocked).toBe(true);
  });

  it("does not trigger risk_level:high rule for medium risk", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "High risk", condition: "risk_level:high", severity: "block" })] });
    const result = evaluateCloneADNRules(p, { risk_level: "medium" });
    expect(result.blocked).toBe(false);
  });

  it("triggers sensitive_topic condition", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Sensitive", condition: "sensitive_topic", severity: "critical" })] });
    const result = evaluateCloneADNRules(p, { sensitive_topics: ["licenciement"] });
    expect(result.blocked).toBe(true);
  });

  it("triggers email task condition", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Email", condition: "email task_type" })] });
    const result = evaluateCloneADNRules(p, { task_type: "email.draft" });
    expect(result.triggered_rules.length).toBe(1);
  });

  it("filters by domain when applies_to_domains set", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "HR only", condition: "always", applies_to_domains: ["hr"] })] });
    const result = evaluateCloneADNRules(p, { domain: "payroll" });
    expect(result.triggered_rules.length).toBe(0);
  });

  it("filters by task_type when applies_to_task_types set", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Email only", condition: "always", applies_to_task_types: ["email.send"] })] });
    const result = evaluateCloneADNRules(p, { task_type: "doc.generate" });
    expect(result.triggered_rules.length).toBe(0);
  });

  it("wildcards pass domain filter", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "All", condition: "always", applies_to_domains: ["*"] })] });
    const result = evaluateCloneADNRules(p, { domain: "payroll" });
    expect(result.triggered_rules.length).toBe(1);
  });

  it("requires_validation for warning-severity triggered rule", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Warning", condition: "always", severity: "warning" })] });
    const result = evaluateCloneADNRules(p, {});
    expect(result.requires_validation).toBe(true);
  });

  it("requires_validation for rule with requires_human_validation=true", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Human", condition: "always", severity: "info", requires_human_validation: true })] });
    const result = evaluateCloneADNRules(p, {});
    expect(result.requires_validation).toBe(true);
  });

  it("blocking_rules list populated for block severity", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Block", condition: "always", severity: "block" })] });
    const result = evaluateCloneADNRules(p, {});
    expect(result.blocking_rules.length).toBe(1);
  });

  it("handles empty rules array", () => {
    const p = makeFullProfile({ rules: [] });
    const result = evaluateCloneADNRules(p, {});
    expect(result.blocked).toBe(false);
    expect(result.decisions).toHaveLength(0);
  });
});

// ── 30. shouldCloneADNRequireValidation ───────────────────────────────────────

describe("shouldCloneADNRequireValidation", () => {
  it("returns false when no profile and no context", () => {
    expect(shouldCloneADNRequireValidation({ profile: null, appContext: null })).toBe(false);
  });

  it("returns true when validation_mode is human_only", () => {
    const ctx = buildCloneADNApplicationContext(null);
    const modified = { ...ctx, validation_mode: "human_only" as const };
    expect(shouldCloneADNRequireValidation({ profile: null, appContext: modified })).toBe(true);
  });

  it("returns true when validation_mode is required", () => {
    const ctx = { ...buildCloneADNApplicationContext(null), validation_mode: "required" as const };
    expect(shouldCloneADNRequireValidation({ profile: null, appContext: ctx })).toBe(true);
  });

  it("returns true for task in always_require_human_for", () => {
    const ctx = { ...buildCloneADNApplicationContext(null), always_require_human_for: ["email.send"] };
    expect(shouldCloneADNRequireValidation({ profile: null, appContext: ctx, taskType: "email.send" })).toBe(true);
  });

  it("returns true for high risk_level with non-none mode", () => {
    const ctx = { ...buildCloneADNApplicationContext(null), validation_mode: "recommended" as const };
    expect(shouldCloneADNRequireValidation({ profile: null, appContext: ctx, riskLevel: "high" })).toBe(true);
  });

  it("returns true when sensitive_topics present", () => {
    const ctx = buildCloneADNApplicationContext(null);
    expect(shouldCloneADNRequireValidation({ profile: null, appContext: ctx, sensitiveTopics: ["licenciement"] })).toBe(true);
  });

  it("returns true when rule engine triggers validation", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Block", condition: "always", severity: "block" })] });
    expect(shouldCloneADNRequireValidation({ profile: p, appContext: null })).toBe(true);
  });
});

// ── 31. shouldCloneADNBlockAction ─────────────────────────────────────────────

describe("shouldCloneADNBlockAction", () => {
  it("returns not blocked when no profile and no context", () => {
    const r = shouldCloneADNBlockAction({ profile: null, appContext: null });
    expect(r.blocked).toBe(false);
  });

  it("blocks task in never_auto_execute list", () => {
    const ctx = { ...buildCloneADNApplicationContext(null), never_auto_execute: ["email.send"] };
    const r = shouldCloneADNBlockAction({ profile: null, appContext: ctx, taskType: "email.send" });
    expect(r.blocked).toBe(true);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("blocks task in autonomy blocked_auto_task_types", () => {
    const p = makeFullProfile({ autonomy: { ...buildDefaultCloneADNAutonomyProfile(), blocked_auto_task_types: ["email.send", "email_send", "doc.generate"] } });
    const r = shouldCloneADNBlockAction({ profile: p, appContext: null, taskType: "doc.generate" });
    expect(r.blocked).toBe(true);
  });

  it("blocks via rule engine (severity=block)", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Block all", condition: "always", severity: "block" })] });
    const r = shouldCloneADNBlockAction({ profile: p, appContext: null });
    expect(r.blocked).toBe(true);
  });

  it("does not block for unrelated task type", () => {
    const ctx = { ...buildCloneADNApplicationContext(null), never_auto_execute: ["email.send"] };
    const r = shouldCloneADNBlockAction({ profile: null, appContext: ctx, taskType: "doc.generate" });
    expect(r.blocked).toBe(false);
  });
});

// ── 32. buildCloneADNRuleSummary ──────────────────────────────────────────────

describe("buildCloneADNRuleSummary", () => {
  it("returns zero counts for null profile", () => {
    const s = buildCloneADNRuleSummary(null);
    expect(s.total).toBe(0);
    expect(s.active).toBe(0);
    expect(s.blocking_count).toBe(0);
  });

  it("counts rules correctly", () => {
    const p = makeFullProfile({
      rules: [
        makeRule({ id: "r1", label: "A", severity: "block", active: true }),
        makeRule({ id: "r2", label: "B", severity: "warning", active: true }),
        makeRule({ id: "r3", label: "C", severity: "info", active: false }),
      ],
    });
    const s = buildCloneADNRuleSummary(p);
    expect(s.total).toBe(3);
    expect(s.active).toBe(2);
    expect(s.blocking_count).toBe(1);
  });

  it("groups by severity", () => {
    const p = makeFullProfile({
      rules: [
        makeRule({ id: "r1", label: "A", severity: "block" }),
        makeRule({ id: "r2", label: "B", severity: "block" }),
        makeRule({ id: "r3", label: "C", severity: "warning" }),
      ],
    });
    const s = buildCloneADNRuleSummary(p);
    expect(s.by_severity["block"]).toBe(2);
    expect(s.by_severity["warning"]).toBe(1);
  });

  it("groups by category", () => {
    const p = makeFullProfile({
      rules: [
        makeRule({ id: "r1", label: "A", category: "compliance" }),
        makeRule({ id: "r2", label: "B", category: "compliance" }),
      ],
    });
    const s = buildCloneADNRuleSummary(p);
    expect(s.by_category["compliance"]).toBe(2);
  });

  it("counts critical as blocking", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Crit", severity: "critical", active: true })] });
    const s = buildCloneADNRuleSummary(p);
    expect(s.blocking_count).toBe(1);
  });
});

// ── 33. Pierre adapter: readPierreCloneADNFromReusableContext ─────────────────

describe("readPierreCloneADNFromReusableContext", () => {
  it("reads profile from context", () => {
    const profile = buildDefaultCloneADNProfile();
    const ctx = { clone_adn: profile };
    expect(readPierreCloneADNFromReusableContext(ctx)).not.toBeNull();
  });
  it("returns null for missing clone_adn", () => {
    expect(readPierreCloneADNFromReusableContext({})).toBeNull();
  });
  it("returns null for null input", () => {
    expect(readPierreCloneADNFromReusableContext(null)).toBeNull();
  });
});

// ── 34. Pierre adapter: buildPierreCompanyContextFromCloneADN ─────────────────

describe("buildPierreCompanyContextFromCloneADN", () => {
  it("returns null for null profile", () => {
    expect(buildPierreCompanyContextFromCloneADN(null)).toBeNull();
  });
  it("returns tone in context", () => {
    const ctx = buildPierreCompanyContextFromCloneADN(makeFullProfile());
    expect(ctx!["tone"]).toBe("warm");
  });
  it("returns company_name in context", () => {
    const ctx = buildPierreCompanyContextFromCloneADN(makeFullProfile());
    expect(ctx!["company_name"]).toBe("Acme");
  });
  it("returns autonomy_level in context", () => {
    const ctx = buildPierreCompanyContextFromCloneADN(makeFullProfile());
    expect(ctx!["autonomy_level"]).toBeDefined();
  });
  it("returns validation_mode in context", () => {
    const ctx = buildPierreCompanyContextFromCloneADN(makeFullProfile());
    expect(ctx!["validation_mode"]).toBeDefined();
  });
  it("returns clone_adn_status key in context", () => {
    const ctx = buildPierreCompanyContextFromCloneADN(makeFullProfile());
    expect(ctx!["clone_adn_status"]).toBeDefined();
  });
  it("returns active_rules_count in context", () => {
    const ctx = buildPierreCompanyContextFromCloneADN(makeFullProfile());
    expect(typeof ctx!["active_rules_count"]).toBe("number");
  });
});

// ── 35. Pierre adapter: buildPierreDocumentVariablesFromCloneADN ──────────────

describe("buildPierreDocumentVariablesFromCloneADN", () => {
  it("returns empty object for null", () => {
    const vars = buildPierreDocumentVariablesFromCloneADN(null);
    expect(typeof vars).toBe("object");
  });
  it("returns company_name", () => {
    const vars = buildPierreDocumentVariablesFromCloneADN(makeFullProfile());
    expect(vars["company_name"]).toBe("Acme");
  });
  it("returns formal_closing", () => {
    const vars = buildPierreDocumentVariablesFromCloneADN(makeFullProfile());
    expect(vars["formal_closing"]).toBe("Cordialement");
  });
  it("returns greeting_style", () => {
    const vars = buildPierreDocumentVariablesFromCloneADN(makeFullProfile());
    expect(vars["greeting_style"]).toBe("Bonjour");
  });
  it("returns document_tone", () => {
    const vars = buildPierreDocumentVariablesFromCloneADN(makeFullProfile());
    expect(vars["document_tone"]).toBeDefined();
  });
  it("returns company_sector", () => {
    const vars = buildPierreDocumentVariablesFromCloneADN(makeFullProfile());
    expect(vars["company_sector"]).toBe("tech");
  });
});

// ── 36. Pierre adapter: evaluatePierreActionWithCloneADN ─────────────────────

describe("evaluatePierreActionWithCloneADN", () => {
  it("returns cloneadn_applied=true for configured profile", () => {
    const result = evaluatePierreActionWithCloneADN({ profile: makeFullProfile(), taskType: "email.draft" });
    expect(result.cloneadn_applied).toBe(true);
  });
  it("blocks email.send (in never_auto_execute)", () => {
    const result = evaluatePierreActionWithCloneADN({ profile: makeFullProfile(), taskType: "email.send" });
    expect(result.blocked).toBe(true);
  });
  it("returns requires_validation for high risk", () => {
    const result = evaluatePierreActionWithCloneADN({ profile: makeFullProfile(), riskLevel: "high" });
    expect(result.requires_validation).toBe(true);
  });
  it("returns requires_validation for sensitive topic", () => {
    const result = evaluatePierreActionWithCloneADN({ profile: makeFullProfile(), sensitiveTopics: ["licenciement"] });
    expect(result.requires_validation).toBe(true);
  });
  it("returns rule_evaluation object", () => {
    const result = evaluatePierreActionWithCloneADN({ profile: makeFullProfile() });
    expect(result.rule_evaluation).toBeDefined();
  });
  it("returns reasons array", () => {
    const result = evaluatePierreActionWithCloneADN({ profile: makeFullProfile(), taskType: "email.send" });
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
  it("handles null profile gracefully", () => {
    const result = evaluatePierreActionWithCloneADN({ profile: null });
    expect(result.blocked).toBe(false);
    expect(result.cloneadn_applied).toBe(false);
  });
});

// ── 37. Pierre adapter: buildPierreCloneADNHint ───────────────────────────────

describe("buildPierreCloneADNHint", () => {
  it("returns null for null profile", () => {
    expect(buildPierreCloneADNHint(null)).toBeNull();
  });
  it("returns configured=false for not_configured profile", () => {
    const hint = buildPierreCloneADNHint(buildDefaultCloneADNProfile());
    expect(hint!["configured"]).toBe(false);
  });
  it("returns configured=true for non-not_configured profile", () => {
    const hint = buildPierreCloneADNHint(makeFullProfile({ status: "configured" }));
    expect(hint!["configured"]).toBe(true);
  });
  it("returns status", () => {
    const hint = buildPierreCloneADNHint(makeFullProfile());
    expect(hint!["status"]).toBeDefined();
  });
  it("returns completeness_score", () => {
    const hint = buildPierreCloneADNHint(makeFullProfile());
    expect(typeof hint!["completeness_score"]).toBe("number");
  });
  it("returns tone", () => {
    const hint = buildPierreCloneADNHint(makeFullProfile());
    expect(hint!["tone"]).toBe("warm");
  });
  it("returns autonomy_level", () => {
    const hint = buildPierreCloneADNHint(makeFullProfile());
    expect(hint!["autonomy_level"]).toBeDefined();
  });
  it("returns company_name", () => {
    const hint = buildPierreCloneADNHint(makeFullProfile());
    expect(hint!["company_name"]).toBe("Acme");
  });
  it("returns active_rules count", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "R", active: true })] });
    const hint = buildPierreCloneADNHint(p);
    expect(hint!["active_rules"]).toBe(1);
  });
  it("returns blocking_rules count", () => {
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Block", severity: "block", active: true })] });
    const hint = buildPierreCloneADNHint(p);
    expect(hint!["blocking_rules"]).toBe(1);
  });
  it("returns sites_count and departments_count", () => {
    const hint = buildPierreCloneADNHint(makeFullProfile());
    expect(typeof hint!["sites_count"]).toBe("number");
    expect(typeof hint!["departments_count"]).toBe("number");
  });
  it("returns validation_mode", () => {
    const hint = buildPierreCloneADNHint(makeFullProfile());
    expect(hint!["validation_mode"]).toBeDefined();
  });
});

// ── 38. Security / invariants ─────────────────────────────────────────────────

describe("Security invariants", () => {
  it("never_auto_execute always includes email.send in defaults", () => {
    const p = buildDefaultCloneADNProfile();
    expect(p.validation.never_auto_execute).toContain("email.send");
  });
  it("email.send is always blocked by default autonomy", () => {
    const p = buildDefaultCloneADNProfile();
    expect(p.autonomy.blocked_auto_task_types).toContain("email.send");
  });
  it("buildCloneADNStoragePatch never removes employees key", () => {
    const existing = { employees: [{ id: "e1" }], clone_adn: {} };
    const patch = buildCloneADNStoragePatch({ reusableRhContextJson: existing, profile: buildDefaultCloneADNProfile() });
    expect(patch["employees"]).toBeDefined();
  });
  it("buildCloneADNStoragePatch never removes document_templates key", () => {
    const existing = { document_templates: [{ id: "t1" }], clone_adn: {} };
    const patch = buildCloneADNStoragePatch({ reusableRhContextJson: existing, profile: buildDefaultCloneADNProfile() });
    expect(patch["document_templates"]).toBeDefined();
  });
  it("rule engine uses no eval — condition is string matched only", () => {
    // Verify that a condition containing eval-like syntax does NOT execute
    const p = makeFullProfile({ rules: [makeRule({ id: "r1", label: "Eval test", condition: "process.exit(1)" })] });
    // Should not throw, should not exit, should simply not match without a matching keyword > 3 chars
    const result = evaluateCloneADNRules(p, { text: "normal text" });
    expect(result).toBeDefined();
  });
  it("sanitizeCloneADNProfile is null-safe on any garbage input", () => {
    const inputs = [null, undefined, 42, [], "bad", true, Symbol("x")];
    for (const input of inputs) {
      expect(() => sanitizeCloneADNProfile(input)).not.toThrow();
    }
  });
  it("buildDefaultCloneADNProfile is idempotent", () => {
    const p1 = buildDefaultCloneADNProfile();
    const p2 = buildDefaultCloneADNProfile();
    expect(p1.status).toBe(p2.status);
    expect(p1.autonomy.level).toBe(p2.autonomy.level);
    expect(p1.validation.never_auto_execute).toEqual(p2.validation.never_auto_execute);
  });
});

// ── 39. Edge cases & robustness ───────────────────────────────────────────────

describe("Edge cases and robustness", () => {
  it("analyzeCloneADNProfile handles garbage rules gracefully", () => {
    const p = buildDefaultCloneADNProfile();
    (p as Record<string, unknown>)["rules"] = [null, undefined, "bad", 42];
    expect(() => analyzeCloneADNProfile(p)).not.toThrow();
  });
  it("mergeCloneADNProfilePatch returns base on error", () => {
    const base = buildDefaultCloneADNProfile();
    expect(() => mergeCloneADNProfilePatch(base, { communication: { tone: "invalid" as never } })).not.toThrow();
  });
  it("buildCloneADNApplicationContext never throws", () => {
    const inputs = [null, buildDefaultCloneADNProfile(), makeFullProfile()];
    for (const input of inputs) {
      expect(() => buildCloneADNApplicationContext(input)).not.toThrow();
    }
  });
  it("evaluateCloneADNRules returns safe result on any exception", () => {
    const badProfile = { rules: "not-an-array" } as unknown as CloneADNProfile;
    const result = evaluateCloneADNRules(badProfile, {});
    expect(result.blocked).toBe(false);
  });
  it("shouldCloneADNBlockAction returns not-blocked on any exception", () => {
    const r = shouldCloneADNBlockAction({ profile: null, appContext: null, taskType: undefined });
    expect(r.blocked).toBe(false);
  });
  it("dedupeADNStringList handles large input without hanging", () => {
    const input = Array.from({ length: 5000 }, (_, i) => `item-${i}`);
    const result = dedupeADNStringList(input, 100);
    expect(result.length).toBeLessThanOrEqual(100);
  });
  it("clampADNScore handles -Infinity", () => {
    expect(clampADNScore(-Infinity)).toBe(0);
  });
  it("normalizeADNId strips special chars", () => {
    expect(normalizeADNId("rule!@#$%^&*()_01")).toBe("rule_01");
  });
  it("sanitizeCloneADNSite normalizes invalid country code to null", () => {
    const s = sanitizeCloneADNSite({ id: "site-01", name: "Paris", country_code: "FRANCE" });
    expect(s!.country_code).toBeNull();
  });
  it("buildPierreCloneADNHint returns valid object for default profile", () => {
    const hint = buildPierreCloneADNHint(buildDefaultCloneADNProfile());
    expect(hint).not.toBeNull();
    expect(hint!["configured"]).toBe(false);
    expect(hint!["active_rules"]).toBe(0);
  });
});
