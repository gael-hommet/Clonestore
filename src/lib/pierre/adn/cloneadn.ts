// src/lib/pierre/adn/cloneadn.ts
// Pierre CloneADN adapter — Bloc 28
// Pierre-specific interface over the platform CloneADN engine.
// No throw. No async. No Supabase. No UI. No email. No mission creation.

import type {
  CloneADNProfile,
  CloneADNApplicationContext,
  CloneADNRuleEvaluationResult,
} from "../../clonestore/adn/types";
import {
  readCloneADNFromReusableContext,
  buildCloneADNStoragePatch,
  buildCloneADNApplicationContext,
  sanitizeCloneADNProfile,
  analyzeCloneADNProfile,
} from "../../clonestore/adn/profile";
import {
  evaluateCloneADNRules,
  shouldCloneADNRequireValidation,
  shouldCloneADNBlockAction,
  buildCloneADNRuleSummary,
} from "../../clonestore/adn/rules";
import { isPlainObject } from "../../clonestore/adn/utils";

// ── Re-exports for convenience ────────────────────────────────────────────────

export {
  readCloneADNFromReusableContext,
  buildCloneADNStoragePatch,
  buildCloneADNApplicationContext,
  sanitizeCloneADNProfile,
  analyzeCloneADNProfile,
  evaluateCloneADNRules,
  shouldCloneADNRequireValidation,
  shouldCloneADNBlockAction,
  buildCloneADNRuleSummary,
};

// ── Pierre-specific: read CloneADN from Pierre company memory ─────────────────

export function readPierreCloneADNFromReusableContext(
  reusableRhContextJson: unknown,
): CloneADNProfile | null {
  return readCloneADNFromReusableContext(reusableRhContextJson);
}

// ── Pierre-specific: storage patch (preserves employees + document_templates) ─

export function buildPierreCloneADNStoragePatch(params: {
  reusableRhContextJson: Record<string, unknown>;
  profile: CloneADNProfile;
}): Record<string, unknown> {
  return buildCloneADNStoragePatch(params);
}

// ── Pierre brain company context ──────────────────────────────────────────────

export function buildPierreCompanyContextFromCloneADN(
  profile: CloneADNProfile | null,
): Record<string, unknown> | null {
  try {
    if (!profile) return null;

    const appCtx = buildCloneADNApplicationContext(profile);
    const analysis = analyzeCloneADNProfile(profile);

    return {
      clone_adn_status: profile.status,
      clone_adn_completeness: analysis.completeness_score,
      tone: appCtx.tone,
      autonomy_level: appCtx.autonomy_level,
      validation_mode: appCtx.validation_mode,
      language_code: appCtx.language_code,
      company_name: appCtx.company_name,
      sector: appCtx.sector,
      sensitive_topics: appCtx.sensitive_topics,
      never_auto_execute: appCtx.never_auto_execute,
      always_require_human_for: appCtx.always_require_human_for,
      avoid_words: appCtx.avoid_words,
      preferred_words: appCtx.preferred_words,
      formal_closing: appCtx.formal_closing,
      greeting_style: appCtx.greeting_style,
      preferred_format: appCtx.preferred_format,
      active_rules_count: analysis.active_rules_count,
      blocking_rules_count: analysis.blocking_rules_count,
    };
  } catch {
    return null;
  }
}

// ── Pierre brain context enrichment (wraps company context) ───────────────────

export function buildPierreBrainContextWithCloneADN(params: {
  existingContext?: Record<string, unknown> | null;
  cloneADNProfile: CloneADNProfile | null;
}): Record<string, unknown> | null {
  try {
    const { existingContext, cloneADNProfile } = params;
    const adnContext = buildPierreCompanyContextFromCloneADN(cloneADNProfile);

    if (!adnContext && !existingContext) return null;

    const base = isPlainObject(existingContext) ? { ...existingContext } : {};
    if (adnContext) {
      base["clone_adn"] = adnContext;
    }

    return base;
  } catch {
    return null;
  }
}

// ── Document variable enrichment from CloneADN ────────────────────────────────

export function buildPierreDocumentVariablesFromCloneADN(
  profile: CloneADNProfile | null,
): Record<string, unknown> {
  try {
    if (!profile) return {};

    const companyName =
      profile.company_identity.trade_name ??
      profile.company_identity.legal_name ??
      null;

    return {
      company_name: companyName,
      company_legal_name: profile.company_identity.legal_name,
      company_sector: profile.company_identity.sector,
      company_country: profile.company_identity.country_code,
      company_language: profile.communication.language_code || "fr",
      hr_contact_email: profile.company_identity.hr_contact_email,
      document_tone: profile.document.preferred_tone,
      formal_closing: profile.communication.formal_closing,
      greeting_style: profile.communication.greeting_style,
    };
  } catch {
    return {};
  }
}

// ── Action evaluation (block + validation) ────────────────────────────────────

export function evaluatePierreActionWithCloneADN(params: {
  profile: CloneADNProfile | null;
  taskType?: string | null;
  domain?: string | null;
  riskLevel?: string | null;
  sensitiveTopics?: string[];
  text?: string | null;
}): {
  blocked: boolean;
  requires_validation: boolean;
  reasons: string[];
  rule_evaluation: CloneADNRuleEvaluationResult | null;
  cloneadn_applied: boolean;
} {
  try {
    const { profile, taskType, domain, riskLevel, sensitiveTopics } = params;

    if (!profile) {
      return {
        blocked: false,
        requires_validation: false,
        reasons: [],
        rule_evaluation: null,
        cloneadn_applied: false,
      };
    }

    const appCtx = buildCloneADNApplicationContext(profile);

    const blockResult = shouldCloneADNBlockAction({
      profile,
      appContext: appCtx,
      taskType,
      domain,
      riskLevel,
    });

    const requiresValidation = shouldCloneADNRequireValidation({
      profile,
      appContext: appCtx,
      taskType,
      domain,
      riskLevel,
      sensitiveTopics: sensitiveTopics ?? [],
    });

    const ruleEval = evaluateCloneADNRules(profile, {
      task_type: taskType,
      domain,
      risk_level: riskLevel,
      sensitive_topics: sensitiveTopics ?? [],
      text: params.text,
    });

    return {
      blocked: blockResult.blocked,
      requires_validation: requiresValidation,
      reasons: blockResult.reasons,
      rule_evaluation: ruleEval,
      cloneadn_applied: true,
    };
  } catch {
    return {
      blocked: false,
      requires_validation: false,
      reasons: [],
      rule_evaluation: null,
      cloneadn_applied: false,
    };
  }
}

// ── Mission hint (for context_snapshot_json) ──────────────────────────────────

export function buildPierreCloneADNHint(
  profile: CloneADNProfile | null,
): Record<string, unknown> | null {
  try {
    if (!profile) return null;

    const analysis = analyzeCloneADNProfile(profile);
    const appCtx = buildCloneADNApplicationContext(profile);
    const ruleSummary = buildCloneADNRuleSummary(profile);

    return {
      configured: profile.status !== "not_configured",
      status: profile.status,
      completeness_score: analysis.completeness_score,
      tone: appCtx.tone,
      autonomy_level: appCtx.autonomy_level,
      validation_mode: appCtx.validation_mode,
      language_code: appCtx.language_code,
      company_name: appCtx.company_name,
      sector: appCtx.sector,
      active_rules: ruleSummary.active,
      blocking_rules: ruleSummary.blocking_count,
      sites_count: Array.isArray(profile.sites) ? profile.sites.length : 0,
      departments_count: Array.isArray(profile.departments) ? profile.departments.length : 0,
    };
  } catch {
    return null;
  }
}
