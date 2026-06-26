// GO-LIVE 03 — Public Copy Final Scanner
// Pure: no Supabase, no Next, no async, no throw.

import type { CopyFinalScanResult, CopyFinalMultiScanResult, CopyFinalViolation } from "./types";
import { getForbiddenRulesForContext } from "./public-copy-final-registry";

export function scanCopyFinal(content: string, context: string): CopyFinalScanResult {
  const rules = getForbiddenRulesForContext(context);
  const violations: CopyFinalViolation[] = [];

  for (const rule of rules) {
    const match = content.match(rule.pattern);
    if (match) {
      violations.push({
        rule_id: rule.id,
        found_text: match[0],
        severity: rule.severity,
        explanation: rule.explanation,
        suggested_fix: rule.suggested_fix,
      });
    }
  }

  const blocking_count = violations.filter((v) => v.severity === "blocking").length;
  const warning_count = violations.filter((v) => v.severity === "warning").length;

  return {
    context,
    violations,
    blocking_count,
    warning_count,
    is_clean: blocking_count === 0,
    scanned_at: new Date().toISOString(),
  };
}

export function scanMultipleCopyFinal(
  pages: Array<{ content: string; context: string }>
): CopyFinalMultiScanResult {
  const results = pages.map((p) => scanCopyFinal(p.content, p.context));
  const total_blocking = results.reduce((s, r) => s + r.blocking_count, 0);
  const total_warnings = results.reduce((s, r) => s + r.warning_count, 0);
  const all_clean = results.every((r) => r.is_clean);
  const dirty_contexts = results.filter((r) => !r.is_clean).map((r) => r.context);

  return { results, total_blocking, total_warnings, all_clean, dirty_contexts };
}
