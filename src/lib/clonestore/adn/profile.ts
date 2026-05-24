// src/lib/clonestore/adn/profile.ts
// CloneADN profile management — Bloc 28
// Defaults, sanitizer, analyzer, patch merger. No throw. No async. No Supabase.

import type {
  CloneADNProfile,
  CloneADNRule,
  CloneADNSite,
  CloneADNDepartment,
  CloneADNInferredPreference,
  CloneADNCompanyIdentity,
  CloneADNCommunicationProfile,
  CloneADNValidationProfile,
  CloneADNAutonomyProfile,
  CloneADNDocumentProfile,
  CloneADNProfileStatus,
  CloneADNProfilePatch,
  CloneADNAnalysis,
  CloneADNApplicationContext,
} from "./types";
import {
  isPlainObject,
  safeADNString,
  normalizeADNId,
  normalizeCloneADNTone,
  normalizeCloneADNAutonomyLevel,
  normalizeCloneADNValidationMode,
  normalizeCloneADNRuleSeverity,
  normalizeCloneADNRuleCategory,
  normalizeCloneADNCommunicationLength,
  dedupeADNStringList,
  clampADNScore,
  nowISO,
  isValidADNEmail,
  normalizeADNCountryCode,
} from "./utils";

// ── Limits ────────────────────────────────────────────────────────────────────

const MAX_RULES = 100;
const MAX_SITES = 50;
const MAX_DEPARTMENTS = 100;
const MAX_INFERRED = 200;
const MAX_VALUES = 20;
const MAX_STRING_WORDS = 20;
const MAX_AVOID_WORDS = 50;
const MAX_PREFERRED_WORDS = 50;
const MAX_TEMPLATE_IDS = 30;
const MAX_TASK_TYPES = 50;
const MAX_DOMAINS = 50;

// ── Defaults ──────────────────────────────────────────────────────────────────

export function buildDefaultCloneADNCompanyIdentity(): CloneADNCompanyIdentity {
  return {
    legal_name: null,
    trade_name: null,
    sector: null,
    size_range: null,
    country_code: null,
    main_language: null,
    hr_contact_email: null,
    values: [],
    mission_statement: null,
  };
}

export function buildDefaultCloneADNCommunicationProfile(): CloneADNCommunicationProfile {
  return {
    tone: "formal",
    preferred_length: "standard",
    formal_closing: null,
    greeting_style: null,
    avoid_words: [],
    preferred_words: [],
    signature_template: null,
    language_code: "fr",
  };
}

export function buildDefaultCloneADNValidationProfile(): CloneADNValidationProfile {
  return {
    default_mode: "recommended",
    always_require_human_for: [],
    never_auto_execute: ["email.send", "email_send"],
    sensitive_topics: [],
    approval_required_risk_levels: ["high", "critical"],
  };
}

export function buildDefaultCloneADNAutonomyProfile(): CloneADNAutonomyProfile {
  return {
    level: "supervised",
    allowed_auto_task_types: [],
    blocked_auto_task_types: ["email.send", "email_send"],
    max_auto_tasks_per_mission: 5,
    require_approval_above_risk: "medium",
  };
}

export function buildDefaultCloneADNDocumentProfile(): CloneADNDocumentProfile {
  return {
    preferred_format: "html",
    preferred_tone: "formal",
    always_include_signature: false,
    always_include_legal_footer: false,
    require_validation_for_risk_levels: ["high", "critical"],
    preferred_template_ids: [],
  };
}

export function buildDefaultCloneADNProfile(): CloneADNProfile {
  const now = nowISO();
  return {
    status: "not_configured",
    version: "1.0.0",
    company_identity: buildDefaultCloneADNCompanyIdentity(),
    communication: buildDefaultCloneADNCommunicationProfile(),
    validation: buildDefaultCloneADNValidationProfile(),
    autonomy: buildDefaultCloneADNAutonomyProfile(),
    document: buildDefaultCloneADNDocumentProfile(),
    rules: [],
    sites: [],
    departments: [],
    inferred_preferences: [],
    completeness_score: 0,
    created_at: now,
    updated_at: now,
  };
}

// ── Rule sanitization ─────────────────────────────────────────────────────────

export function sanitizeCloneADNRule(input: unknown): CloneADNRule | null {
  try {
    if (!isPlainObject(input)) return null;

    const id = normalizeADNId(input["id"]);
    if (!id) return null;

    const label = safeADNString(input["label"], 200);
    if (!label) return null;

    const now = nowISO();

    return {
      id,
      label,
      description: safeADNString(input["description"], 1000, true) ?? "",
      category: normalizeCloneADNRuleCategory(input["category"]),
      severity: normalizeCloneADNRuleSeverity(input["severity"]),
      condition: safeADNString(input["condition"], 2000, true) ?? "",
      action: safeADNString(input["action"], 1000, true) ?? "",
      active: typeof input["active"] === "boolean" ? input["active"] : true,
      applies_to_domains: dedupeADNStringList(input["applies_to_domains"], MAX_DOMAINS, 100),
      applies_to_task_types: dedupeADNStringList(input["applies_to_task_types"], MAX_TASK_TYPES, 100),
      requires_human_validation:
        typeof input["requires_human_validation"] === "boolean"
          ? input["requires_human_validation"]
          : false,
      created_at:
        typeof input["created_at"] === "string" ? input["created_at"] : now,
      updated_at: now,
    };
  } catch {
    return null;
  }
}

// ── Site sanitization ─────────────────────────────────────────────────────────

export function sanitizeCloneADNSite(input: unknown): CloneADNSite | null {
  try {
    if (!isPlainObject(input)) return null;

    const id = normalizeADNId(input["id"]);
    if (!id) return null;

    const name = safeADNString(input["name"], 200);
    if (!name) return null;

    return {
      id,
      name,
      country_code: normalizeADNCountryCode(input["country_code"]),
      city: safeADNString(input["city"], 100) ?? null,
      timezone: safeADNString(input["timezone"], 100) ?? null,
      active: typeof input["active"] === "boolean" ? input["active"] : true,
    };
  } catch {
    return null;
  }
}

// ── Department sanitization ───────────────────────────────────────────────────

export function sanitizeCloneADNDepartment(input: unknown): CloneADNDepartment | null {
  try {
    if (!isPlainObject(input)) return null;

    const id = normalizeADNId(input["id"]);
    if (!id) return null;

    const name = safeADNString(input["name"], 200);
    if (!name) return null;

    const rawHeadcount = input["headcount"];
    const headcount =
      typeof rawHeadcount === "number" && Number.isFinite(rawHeadcount) && rawHeadcount >= 0
        ? Math.round(rawHeadcount)
        : null;

    return {
      id,
      name,
      manager_name: safeADNString(input["manager_name"], 200) ?? null,
      headcount,
      active: typeof input["active"] === "boolean" ? input["active"] : true,
    };
  } catch {
    return null;
  }
}

// ── Inferred preference sanitization ─────────────────────────────────────────

export function sanitizeCloneADNInferredPreference(
  input: unknown,
): CloneADNInferredPreference | null {
  try {
    if (!isPlainObject(input)) return null;

    const key =
      typeof input["key"] === "string"
        ? input["key"].trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 100)
        : "";
    if (!key) return null;

    const value = safeADNString(input["value"], 500);
    if (!value) return null;

    const rawSource = input["source"];
    const source =
      rawSource === "explicit" ||
      rawSource === "inferred" ||
      rawSource === "default" ||
      rawSource === "inherited"
        ? rawSource
        : "inferred";

    const rawConfidence = input["confidence"];
    const confidence =
      typeof rawConfidence === "number" && Number.isFinite(rawConfidence)
        ? Math.max(0, Math.min(1, rawConfidence))
        : 0.5;

    return {
      key,
      value,
      source,
      confidence,
      inferred_at:
        typeof input["inferred_at"] === "string" ? input["inferred_at"] : nowISO(),
      domain: safeADNString(input["domain"], 100) ?? null,
    };
  } catch {
    return null;
  }
}

// ── Sub-profile sanitization ──────────────────────────────────────────────────

function sanitizeCompanyIdentity(input: unknown): CloneADNCompanyIdentity {
  const defaults = buildDefaultCloneADNCompanyIdentity();
  if (!isPlainObject(input)) return defaults;

  const rawEmail =
    typeof input["hr_contact_email"] === "string" ? input["hr_contact_email"].trim() : null;

  return {
    legal_name: safeADNString(input["legal_name"], 300) ?? null,
    trade_name: safeADNString(input["trade_name"], 300) ?? null,
    sector: safeADNString(input["sector"], 200) ?? null,
    size_range: safeADNString(input["size_range"], 100) ?? null,
    country_code: normalizeADNCountryCode(input["country_code"]),
    main_language: safeADNString(input["main_language"], 10) ?? null,
    hr_contact_email:
      rawEmail && isValidADNEmail(rawEmail) ? rawEmail.slice(0, 200) : null,
    values: dedupeADNStringList(input["values"], MAX_VALUES, 100),
    mission_statement: safeADNString(input["mission_statement"], 2000) ?? null,
  };
}

function sanitizeCommunicationProfile(input: unknown): CloneADNCommunicationProfile {
  const defaults = buildDefaultCloneADNCommunicationProfile();
  if (!isPlainObject(input)) return defaults;

  const rawLang = safeADNString(input["language_code"], 10, true);
  const langCode =
    rawLang && /^[a-z]{2,5}(-[A-Z]{2})?$/.test(rawLang.trim()) ? rawLang.trim() : "fr";

  return {
    tone: normalizeCloneADNTone(input["tone"], defaults.tone),
    preferred_length: normalizeCloneADNCommunicationLength(
      input["preferred_length"],
      defaults.preferred_length,
    ),
    formal_closing: safeADNString(input["formal_closing"], 500) ?? null,
    greeting_style: safeADNString(input["greeting_style"], 300) ?? null,
    avoid_words: dedupeADNStringList(input["avoid_words"], MAX_AVOID_WORDS, MAX_STRING_WORDS),
    preferred_words: dedupeADNStringList(
      input["preferred_words"],
      MAX_PREFERRED_WORDS,
      MAX_STRING_WORDS,
    ),
    signature_template: safeADNString(input["signature_template"], 2000) ?? null,
    language_code: langCode,
  };
}

function sanitizeValidationProfile(input: unknown): CloneADNValidationProfile {
  const defaults = buildDefaultCloneADNValidationProfile();
  if (!isPlainObject(input)) return defaults;

  return {
    default_mode: normalizeCloneADNValidationMode(input["default_mode"], defaults.default_mode),
    always_require_human_for: dedupeADNStringList(
      input["always_require_human_for"],
      MAX_TASK_TYPES,
      100,
    ),
    never_auto_execute: dedupeADNStringList(input["never_auto_execute"], MAX_TASK_TYPES, 100),
    sensitive_topics: dedupeADNStringList(input["sensitive_topics"], MAX_TASK_TYPES, 100),
    approval_required_risk_levels: dedupeADNStringList(
      input["approval_required_risk_levels"],
      10,
      20,
    ),
  };
}

function sanitizeAutonomyProfile(input: unknown): CloneADNAutonomyProfile {
  const defaults = buildDefaultCloneADNAutonomyProfile();
  if (!isPlainObject(input)) return defaults;

  const rawMax = input["max_auto_tasks_per_mission"];
  const maxAuto =
    typeof rawMax === "number" && Number.isFinite(rawMax) && rawMax >= 0
      ? Math.min(Math.round(rawMax), 50)
      : defaults.max_auto_tasks_per_mission;

  return {
    level: normalizeCloneADNAutonomyLevel(input["level"], defaults.level),
    allowed_auto_task_types: dedupeADNStringList(
      input["allowed_auto_task_types"],
      MAX_TASK_TYPES,
      100,
    ),
    blocked_auto_task_types: dedupeADNStringList(
      input["blocked_auto_task_types"],
      MAX_TASK_TYPES,
      100,
    ),
    max_auto_tasks_per_mission: maxAuto,
    require_approval_above_risk:
      safeADNString(input["require_approval_above_risk"], 20) ??
      defaults.require_approval_above_risk,
  };
}

function sanitizeDocumentProfile(input: unknown): CloneADNDocumentProfile {
  const defaults = buildDefaultCloneADNDocumentProfile();
  if (!isPlainObject(input)) return defaults;

  const rawFormat = input["preferred_format"];
  const preferredFormat =
    rawFormat === "text" ||
    rawFormat === "markdown" ||
    rawFormat === "html" ||
    rawFormat === "pdf_ready_html"
      ? rawFormat
      : defaults.preferred_format;

  return {
    preferred_format: preferredFormat,
    preferred_tone: normalizeCloneADNTone(input["preferred_tone"], defaults.preferred_tone),
    always_include_signature:
      typeof input["always_include_signature"] === "boolean"
        ? input["always_include_signature"]
        : defaults.always_include_signature,
    always_include_legal_footer:
      typeof input["always_include_legal_footer"] === "boolean"
        ? input["always_include_legal_footer"]
        : defaults.always_include_legal_footer,
    require_validation_for_risk_levels: dedupeADNStringList(
      input["require_validation_for_risk_levels"],
      10,
      20,
    ),
    preferred_template_ids: dedupeADNStringList(
      input["preferred_template_ids"],
      MAX_TEMPLATE_IDS,
      120,
    ),
  };
}

// ── Main sanitizer ────────────────────────────────────────────────────────────

export function sanitizeCloneADNProfile(input: unknown): CloneADNProfile | null {
  try {
    if (!isPlainObject(input)) return null;

    const now = nowISO();

    const company_identity = sanitizeCompanyIdentity(input["company_identity"]);
    const communication = sanitizeCommunicationProfile(input["communication"]);
    const validation = sanitizeValidationProfile(input["validation"]);
    const autonomy = sanitizeAutonomyProfile(input["autonomy"]);
    const document = sanitizeDocumentProfile(input["document"]);

    const rawRules = Array.isArray(input["rules"]) ? input["rules"] : [];
    const rules = rawRules
      .map(sanitizeCloneADNRule)
      .filter((r): r is CloneADNRule => r !== null)
      .slice(0, MAX_RULES);

    const rawSites = Array.isArray(input["sites"]) ? input["sites"] : [];
    const sites = rawSites
      .map(sanitizeCloneADNSite)
      .filter((s): s is CloneADNSite => s !== null)
      .slice(0, MAX_SITES);

    const rawDepts = Array.isArray(input["departments"]) ? input["departments"] : [];
    const departments = rawDepts
      .map(sanitizeCloneADNDepartment)
      .filter((d): d is CloneADNDepartment => d !== null)
      .slice(0, MAX_DEPARTMENTS);

    const rawInferred = Array.isArray(input["inferred_preferences"])
      ? input["inferred_preferences"]
      : [];
    const inferred_preferences = rawInferred
      .map(sanitizeCloneADNInferredPreference)
      .filter((p): p is CloneADNInferredPreference => p !== null)
      .slice(0, MAX_INFERRED);

    const rawScore = input["completeness_score"];
    const completeness_score = clampADNScore(rawScore);

    const rawStatus = input["status"];
    const status: CloneADNProfileStatus =
      rawStatus === "not_configured" ||
      rawStatus === "partial" ||
      rawStatus === "configured" ||
      rawStatus === "strong" ||
      rawStatus === "locked"
        ? rawStatus
        : "partial";

    const profile: CloneADNProfile = {
      status,
      version:
        typeof input["version"] === "string" && input["version"].trim()
          ? input["version"].trim().slice(0, 20)
          : "1.0.0",
      company_identity,
      communication,
      validation,
      autonomy,
      document,
      rules,
      sites,
      departments,
      inferred_preferences,
      completeness_score,
      created_at:
        typeof input["created_at"] === "string" ? input["created_at"] : now,
      updated_at: now,
    };

    return profile;
  } catch {
    return null;
  }
}

// ── Merge patch ───────────────────────────────────────────────────────────────

export function mergeCloneADNProfilePatch(
  base: CloneADNProfile,
  patch: CloneADNProfilePatch,
): CloneADNProfile {
  try {
    const merged: CloneADNProfile = {
      ...base,
      company_identity: isPlainObject(patch.company_identity)
        ? { ...base.company_identity, ...patch.company_identity }
        : base.company_identity,
      communication: isPlainObject(patch.communication)
        ? { ...base.communication, ...patch.communication }
        : base.communication,
      validation: isPlainObject(patch.validation)
        ? { ...base.validation, ...patch.validation }
        : base.validation,
      autonomy: isPlainObject(patch.autonomy)
        ? { ...base.autonomy, ...patch.autonomy }
        : base.autonomy,
      document: isPlainObject(patch.document)
        ? { ...base.document, ...patch.document }
        : base.document,
      rules: Array.isArray(patch.rules)
        ? patch.rules
            .map(sanitizeCloneADNRule)
            .filter((r): r is CloneADNRule => r !== null)
            .slice(0, MAX_RULES)
        : base.rules,
      sites: Array.isArray(patch.sites)
        ? patch.sites
            .map(sanitizeCloneADNSite)
            .filter((s): s is CloneADNSite => s !== null)
            .slice(0, MAX_SITES)
        : base.sites,
      departments: Array.isArray(patch.departments)
        ? patch.departments
            .map(sanitizeCloneADNDepartment)
            .filter((d): d is CloneADNDepartment => d !== null)
            .slice(0, MAX_DEPARTMENTS)
        : base.departments,
      inferred_preferences: Array.isArray(patch.inferred_preferences)
        ? patch.inferred_preferences
            .map(sanitizeCloneADNInferredPreference)
            .filter((p): p is CloneADNInferredPreference => p !== null)
            .slice(0, MAX_INFERRED)
        : base.inferred_preferences,
      version: typeof patch.version === "string" ? patch.version.trim().slice(0, 20) : base.version,
      updated_at: nowISO(),
    };

    // Re-sanitize to ensure consistency
    const reSanitized = sanitizeCloneADNProfile(merged);
    return reSanitized ?? merged;
  } catch {
    return base;
  }
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export function analyzeCloneADNProfile(profile: CloneADNProfile | null): CloneADNAnalysis {
  try {
    if (!profile) {
      return {
        status: "not_configured",
        completeness_score: 0,
        has_communication_profile: false,
        has_validation_rules: false,
        has_autonomy_config: false,
        has_document_profile: false,
        has_company_identity: false,
        active_rules_count: 0,
        blocking_rules_count: 0,
        inferred_preferences_count: 0,
        missing_fields: [
          "company_identity",
          "communication",
          "validation",
          "autonomy",
          "document",
        ],
        recommendations: ["Configure CloneADN to enable personalized AI behavior."],
        strengths: [],
      };
    }

    const hasIdentity = Boolean(
      profile.company_identity.legal_name || profile.company_identity.trade_name,
    );
    const hasComm = profile.communication.tone !== "formal" || profile.communication.formal_closing !== null;
    const hasValidation = profile.validation.always_require_human_for.length > 0 ||
      profile.validation.sensitive_topics.length > 0;
    const hasAutonomy = profile.autonomy.level !== "supervised";
    const hasDocument =
      profile.document.preferred_template_ids.length > 0 ||
      profile.document.always_include_signature ||
      profile.document.always_include_legal_footer;

    const activeRules = profile.rules.filter((r) => r.active);
    const blockingRules = activeRules.filter(
      (r) => r.severity === "block" || r.severity === "critical",
    );

    const missing: string[] = [];
    if (!hasIdentity) missing.push("company_identity.legal_name");
    if (!profile.company_identity.sector) missing.push("company_identity.sector");
    if (!profile.company_identity.country_code) missing.push("company_identity.country_code");
    if (profile.communication.formal_closing === null) missing.push("communication.formal_closing");
    if (profile.communication.greeting_style === null) missing.push("communication.greeting_style");
    if (profile.validation.sensitive_topics.length === 0) missing.push("validation.sensitive_topics");

    const total = 10;
    const filled = total - missing.length;
    const score = clampADNScore((filled / total) * 100);

    let status: CloneADNProfileStatus;
    if (score === 0) status = "not_configured";
    else if (score < 40) status = "partial";
    else if (score < 70) status = "configured";
    else if (score < 90) status = "strong";
    else status = "locked";

    const recommendations: string[] = [];
    if (!hasIdentity) recommendations.push("Add company legal name to enable personalization.");
    if (!hasComm) recommendations.push("Configure communication tone and closing style.");
    if (!hasValidation) recommendations.push("Define sensitive topics for safer AI behavior.");
    if (profile.rules.length === 0)
      recommendations.push("Add rules to tailor AI behavior to company policies.");
    if (profile.sites.length === 0) recommendations.push("Add sites to enable location context.");

    const strengths: string[] = [];
    if (hasIdentity) strengths.push("Company identity configured.");
    if (hasComm) strengths.push("Communication profile defined.");
    if (hasValidation) strengths.push("Validation rules defined.");
    if (hasAutonomy) strengths.push("Custom autonomy level set.");
    if (hasDocument) strengths.push("Document preferences configured.");
    if (activeRules.length > 0) strengths.push(`${activeRules.length} active rule(s).`);

    return {
      status,
      completeness_score: score,
      has_communication_profile: hasComm,
      has_validation_rules: hasValidation,
      has_autonomy_config: hasAutonomy,
      has_document_profile: hasDocument,
      has_company_identity: hasIdentity,
      active_rules_count: activeRules.length,
      blocking_rules_count: blockingRules.length,
      inferred_preferences_count: profile.inferred_preferences.length,
      missing_fields: missing,
      recommendations,
      strengths,
    };
  } catch {
    return {
      status: "not_configured",
      completeness_score: 0,
      has_communication_profile: false,
      has_validation_rules: false,
      has_autonomy_config: false,
      has_document_profile: false,
      has_company_identity: false,
      active_rules_count: 0,
      blocking_rules_count: 0,
      inferred_preferences_count: 0,
      missing_fields: [],
      recommendations: [],
      strengths: [],
    };
  }
}

// ── Application context builder ───────────────────────────────────────────────

export function buildCloneADNApplicationContext(
  profile: CloneADNProfile | null,
): CloneADNApplicationContext {
  try {
    if (!profile) {
      return {
        tone: "formal",
        autonomy_level: "supervised",
        validation_mode: "recommended",
        language_code: "fr",
        sensitive_topics: [],
        never_auto_execute: ["email.send", "email_send"],
        always_require_human_for: [],
        preferred_format: "html",
        company_name: null,
        sector: null,
        active_rules: [],
        avoid_words: [],
        preferred_words: [],
        formal_closing: null,
        greeting_style: null,
      };
    }

    const activeRules = Array.isArray(profile.rules)
      ? profile.rules.filter((r) => r.active)
      : [];

    const companyName =
      profile.company_identity.trade_name ??
      profile.company_identity.legal_name ??
      null;

    return {
      tone: profile.communication.tone,
      autonomy_level: profile.autonomy.level,
      validation_mode: profile.validation.default_mode,
      language_code: profile.communication.language_code || "fr",
      sensitive_topics: profile.validation.sensitive_topics,
      never_auto_execute: profile.validation.never_auto_execute,
      always_require_human_for: profile.validation.always_require_human_for,
      preferred_format: profile.document.preferred_format,
      company_name: companyName,
      sector: profile.company_identity.sector,
      active_rules: activeRules,
      avoid_words: profile.communication.avoid_words,
      preferred_words: profile.communication.preferred_words,
      formal_closing: profile.communication.formal_closing,
      greeting_style: profile.communication.greeting_style,
    };
  } catch {
    return {
      tone: "formal",
      autonomy_level: "supervised",
      validation_mode: "recommended",
      language_code: "fr",
      sensitive_topics: [],
      never_auto_execute: ["email.send", "email_send"],
      always_require_human_for: [],
      preferred_format: "html",
      company_name: null,
      sector: null,
      active_rules: [],
      avoid_words: [],
      preferred_words: [],
      formal_closing: null,
      greeting_style: null,
    };
  }
}

// ── Storage helpers ───────────────────────────────────────────────────────────

export function readCloneADNFromReusableContext(
  reusableRhContextJson: unknown,
): CloneADNProfile | null {
  try {
    if (!isPlainObject(reusableRhContextJson)) return null;
    const raw = reusableRhContextJson["clone_adn"];
    if (!isPlainObject(raw)) return null;
    return sanitizeCloneADNProfile(raw);
  } catch {
    return null;
  }
}

export function buildCloneADNStoragePatch(params: {
  reusableRhContextJson: Record<string, unknown>;
  profile: CloneADNProfile;
}): Record<string, unknown> {
  try {
    const { reusableRhContextJson, profile } = params;

    if (!isPlainObject(reusableRhContextJson)) {
      return { clone_adn: profile };
    }

    // CRITICAL: never touch employees or document_templates keys
    const patch: Record<string, unknown> = { ...reusableRhContextJson };
    patch["clone_adn"] = profile;

    if ("employees" in reusableRhContextJson) {
      patch["employees"] = reusableRhContextJson["employees"];
    }
    if ("document_templates" in reusableRhContextJson) {
      patch["document_templates"] = reusableRhContextJson["document_templates"];
    }

    return patch;
  } catch {
    return { clone_adn: params.profile };
  }
}
