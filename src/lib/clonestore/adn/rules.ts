// src/lib/clonestore/adn/rules.ts
// CloneADN rule engine — Bloc 28
// Evaluates rules, determines blocking/validation requirements. No throw. No async.

import type {
  CloneADNProfile,
  CloneADNRule,
  CloneADNRuleDecision,
  CloneADNRuleEvaluationResult,
  CloneADNApplicationContext,
} from "./types";
import { isPlainObject } from "./utils";

// ── Rule matching ─────────────────────────────────────────────────────────────

interface RuleMatchContext {
  task_type?: string | null;
  domain?: string | null;
  risk_level?: string | null;
  sensitive_topics?: string[];
  text?: string | null;
}

function matchesRule(rule: CloneADNRule, ctx: RuleMatchContext): boolean {
  try {
    if (!rule.active) return false;

    // Domain filter
    if (rule.applies_to_domains.length > 0 && ctx.domain) {
      const domain = ctx.domain.toLowerCase();
      const matches = rule.applies_to_domains.some(
        (d) => d.toLowerCase() === domain || d === "*",
      );
      if (!matches) return false;
    }

    // Task type filter
    if (rule.applies_to_task_types.length > 0 && ctx.task_type) {
      const taskType = ctx.task_type.toLowerCase();
      const matches = rule.applies_to_task_types.some(
        (t) => t.toLowerCase() === taskType || t === "*",
      );
      if (!matches) return false;
    }

    // Condition evaluation (keyword-based, safe, no eval)
    const condition = rule.condition.toLowerCase().trim();
    if (!condition || condition === "always" || condition === "*") return true;

    // Risk level conditions
    if (condition.includes("risk_level:high") && ctx.risk_level === "high") return true;
    if (condition.includes("risk_level:critical") && ctx.risk_level === "critical") return true;
    if (condition.includes("risk_level:medium") && ctx.risk_level === "medium") return true;

    // Sensitive topic conditions
    if (condition.includes("sensitive_topic") && ctx.sensitive_topics && ctx.sensitive_topics.length > 0) return true;

    // Email task conditions
    if (
      condition.includes("email") &&
      ctx.task_type &&
      ctx.task_type.toLowerCase().includes("email")
    )
      return true;

    // Text-based keyword matching
    if (ctx.text) {
      const textLower = ctx.text.toLowerCase();
      const condKeywords = condition
        .replace(/[^a-z0-9_\s]/g, " ")
        .split(/\s+/)
        .filter((k) => k.length > 3);
      if (condKeywords.length > 0 && condKeywords.some((kw) => textLower.includes(kw))) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// ── Main evaluation ───────────────────────────────────────────────────────────

export function evaluateCloneADNRules(
  profile: CloneADNProfile | null,
  ctx: RuleMatchContext,
): CloneADNRuleEvaluationResult {
  try {
    if (!profile || !Array.isArray(profile.rules) || profile.rules.length === 0) {
      return {
        decisions: [],
        blocked: false,
        requires_validation: false,
        blocking_rules: [],
        triggered_rules: [],
        summary: "No rules configured.",
      };
    }

    const decisions: CloneADNRuleDecision[] = [];

    for (const rule of profile.rules) {
      const triggered = matchesRule(rule, ctx);
      decisions.push({
        rule_id: rule.id,
        label: rule.label,
        severity: rule.severity,
        triggered,
        reason: triggered ? `Rule matched condition: ${rule.condition || "always"}` : "Rule did not match.",
        requires_human_validation: triggered ? rule.requires_human_validation : false,
        action: triggered ? rule.action : "",
      });
    }

    const triggeredRules = decisions.filter((d) => d.triggered);
    const blockingRules = triggeredRules.filter(
      (d) => d.severity === "block" || d.severity === "critical",
    );
    const blocked = blockingRules.length > 0;
    const requiresValidation =
      blocked ||
      triggeredRules.some((d) => d.requires_human_validation) ||
      triggeredRules.some((d) => d.severity === "warning");

    const summaryParts: string[] = [];
    if (blocked) summaryParts.push(`Blocked by ${blockingRules.length} rule(s).`);
    else if (triggeredRules.length > 0)
      summaryParts.push(`${triggeredRules.length} rule(s) triggered.`);
    else summaryParts.push("No rules triggered.");

    if (requiresValidation && !blocked)
      summaryParts.push("Human validation recommended.");

    return {
      decisions,
      blocked,
      requires_validation: requiresValidation,
      blocking_rules: blockingRules,
      triggered_rules: triggeredRules,
      summary: summaryParts.join(" "),
    };
  } catch {
    return {
      decisions: [],
      blocked: false,
      requires_validation: false,
      blocking_rules: [],
      triggered_rules: [],
      summary: "Rule evaluation failed — safe defaults applied.",
    };
  }
}

// ── Validation requirement check ──────────────────────────────────────────────

export function shouldCloneADNRequireValidation(params: {
  profile: CloneADNProfile | null;
  appContext: CloneADNApplicationContext | null;
  taskType?: string | null;
  domain?: string | null;
  riskLevel?: string | null;
  sensitiveTopics?: string[];
}): boolean {
  try {
    const { profile, appContext, taskType, domain, riskLevel, sensitiveTopics } = params;

    if (!profile && !appContext) return false;

    // Check application context rules
    if (appContext) {
      if (
        appContext.validation_mode === "human_only" ||
        appContext.validation_mode === "required"
      )
        return true;

      if (
        taskType &&
        appContext.always_require_human_for.some(
          (t) => t.toLowerCase() === taskType.toLowerCase(),
        )
      )
        return true;

      if (
        riskLevel &&
        (riskLevel === "critical" || riskLevel === "high") &&
        appContext.validation_mode !== "none"
      )
        return true;

      if (sensitiveTopics && sensitiveTopics.length > 0) return true;
    }

    // Run rule engine
    if (profile) {
      const result = evaluateCloneADNRules(profile, {
        task_type: taskType,
        domain,
        risk_level: riskLevel,
        sensitive_topics: sensitiveTopics ?? [],
      });
      if (result.requires_validation) return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ── Block action check ────────────────────────────────────────────────────────

export function shouldCloneADNBlockAction(params: {
  profile: CloneADNProfile | null;
  appContext: CloneADNApplicationContext | null;
  taskType?: string | null;
  domain?: string | null;
  riskLevel?: string | null;
}): { blocked: boolean; reasons: string[] } {
  try {
    const { profile, appContext, taskType, domain, riskLevel } = params;
    const reasons: string[] = [];

    // Check never_auto_execute list
    if (appContext && taskType) {
      const typeNorm = taskType.toLowerCase();
      if (appContext.never_auto_execute.some((t) => t.toLowerCase() === typeNorm)) {
        reasons.push(`Task type "${taskType}" is in never_auto_execute list.`);
      }
    }

    // Check blocked task types from autonomy
    if (profile && taskType) {
      const typeNorm = taskType.toLowerCase();
      if (
        profile.autonomy.blocked_auto_task_types.some((t) => t.toLowerCase() === typeNorm)
      ) {
        reasons.push(`Task type "${taskType}" is blocked by autonomy profile.`);
      }
    }

    // Run rule engine for blocking decisions
    if (profile) {
      const result = evaluateCloneADNRules(profile, {
        task_type: taskType,
        domain,
        risk_level: riskLevel,
      });
      if (result.blocked) {
        for (const r of result.blocking_rules) {
          reasons.push(`Rule "${r.label}" blocked this action.`);
        }
      }
    }

    return { blocked: reasons.length > 0, reasons };
  } catch {
    return { blocked: false, reasons: [] };
  }
}

// ── Rule summary builder ──────────────────────────────────────────────────────

export function buildCloneADNRuleSummary(
  profile: CloneADNProfile | null,
): {
  total: number;
  active: number;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  blocking_count: number;
} {
  try {
    if (!profile || !Array.isArray(profile.rules)) {
      return {
        total: 0,
        active: 0,
        by_severity: {},
        by_category: {},
        blocking_count: 0,
      };
    }

    const rules = profile.rules;
    const active = rules.filter((r) => r.active);
    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const rule of rules) {
      bySeverity[rule.severity] = (bySeverity[rule.severity] ?? 0) + 1;
      byCategory[rule.category] = (byCategory[rule.category] ?? 0) + 1;
    }

    const blocking = active.filter(
      (r) => r.severity === "block" || r.severity === "critical",
    );

    return {
      total: rules.length,
      active: active.length,
      by_severity: bySeverity,
      by_category: byCategory,
      blocking_count: blocking.length,
    };
  } catch {
    return {
      total: 0,
      active: 0,
      by_severity: {},
      by_category: {},
      blocking_count: 0,
    };
  }
}

// ── Profile-based context safety check ───────────────────────────────────────

export function isPlainObjectForRules(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value);
}
