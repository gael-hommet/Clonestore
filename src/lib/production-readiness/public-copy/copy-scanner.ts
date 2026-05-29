// P-FINAL 01 — Phase 8 — Public copy scanner function.
// Pure: no Supabase, no Next, no async, no throw.

import type { CopyContext, CopyScanResult, CopyViolation, CopyWarning } from "./copy-scanner-types";
import {
  getForbiddenRulesForContext,
  getRequiredDisclaimersForContext,
} from "./copy-scanner-rules";

export function scanPublicCopy(content: string, context: CopyContext): CopyScanResult {
  const normalizedContent = content.toLowerCase();
  const violations: CopyViolation[] = [];
  const warnings: CopyWarning[] = [];
  const missing_disclaimers: string[] = [];

  // Check forbidden patterns
  const forbiddenRules = getForbiddenRulesForContext(context);
  for (const rule of forbiddenRules) {
    const pattern =
      typeof rule.pattern === "string"
        ? new RegExp(rule.pattern, "i")
        : rule.pattern;

    const match = content.match(pattern);
    if (match) {
      violations.push({
        id: rule.id,
        pattern: rule.pattern.toString(),
        found_text: match[0],
        severity: rule.severity,
        explanation: rule.explanation,
        suggested_fix: rule.suggested_fix,
      });
    }
  }

  // Check required disclaimers
  const requiredDisclaimers = getRequiredDisclaimersForContext(context);
  for (const disclaimer of requiredDisclaimers) {
    if (!normalizedContent.includes(disclaimer.text_pattern.toLowerCase())) {
      if (disclaimer.required) {
        missing_disclaimers.push(disclaimer.id);
        warnings.push({
          id: `missing_disclaimer_${disclaimer.id}`,
          message: `Disclaimer requis manquant : ${disclaimer.description}`,
          detail: `Ajouter la mention : "${disclaimer.text_pattern}"`,
        });
      }
    }
  }

  const blocking_violation_count = violations.filter((v) => v.severity === "blocking").length;
  const is_safe_for_launch = blocking_violation_count === 0;

  return {
    context,
    violations,
    warnings,
    missing_disclaimers,
    is_safe_for_launch,
    blocking_violation_count,
    scanned_at: new Date().toISOString(),
  };
}

export function scanMultiplePages(
  pages: Array<{ content: string; context: CopyContext }>
): {
  results: CopyScanResult[];
  total_violations: number;
  total_blocking: number;
  all_safe: boolean;
  unsafe_contexts: CopyContext[];
} {
  const results = pages.map((p) => scanPublicCopy(p.content, p.context));
  const total_violations = results.reduce((sum, r) => sum + r.violations.length, 0);
  const total_blocking = results.reduce((sum, r) => sum + r.blocking_violation_count, 0);
  const all_safe = results.every((r) => r.is_safe_for_launch);
  const unsafe_contexts = results.filter((r) => !r.is_safe_for_launch).map((r) => r.context);

  return { results, total_violations, total_blocking, all_safe, unsafe_contexts };
}
