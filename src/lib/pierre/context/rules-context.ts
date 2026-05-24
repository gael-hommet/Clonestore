// src/lib/pierre/context/rules-context.ts
// B35 — Rules context signals from CloneADN rules.

import type { PierreContextSignal } from "./types";
import { buildContextSignal } from "./context-signals";
import { sanitizeCloneADNProfile } from "../adn/cloneadn";

export function buildRulesContextSignals(params: {
  company_id: string;
  clone_adn_profile: Record<string, unknown> | null;
  current_task_type?: string | null;
  current_domain?: string | null;
}): PierreContextSignal[] {
  const { company_id } = params;
  const signals: PierreContextSignal[] = [];

  const profile = sanitizeCloneADNProfile(params.clone_adn_profile);
  if (!profile) return signals;

  const rules = profile.rules ?? [];
  const activeRules = Array.isArray(rules) ? rules.filter((r) => r.active === true) : [];
  const blockingRules = activeRules.filter((r) => r.severity === "block" || r.severity === "critical");
  const warningRules = activeRules.filter((r) => r.severity === "warning");

  // ── Overview (only when rules exist) ──────────────────────────────────────

  if (activeRules.length > 0) {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "rules",
        source: "clone_adn",
        type: "rule",
        priority: blockingRules.length > 0 ? "high" : "medium",
        risk: blockingRules.length > 0 ? "high" : "none",
        title: `Règles CloneADN (${activeRules.length} actives)`,
        content: [
          `${Array.isArray(rules) ? rules.length : 0} règle(s) au total, ${activeRules.length} active(s)`,
          blockingRules.length > 0 ? `⚠ ${blockingRules.length} règle(s) bloquante(s)` : null,
          warningRules.length > 0 ? `${warningRules.length} avertissement(s)` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        confidence: 0.95,
        currentTaskType: params.current_task_type,
        currentDomain: params.current_domain,
        metadata: {
          total_rules: Array.isArray(rules) ? rules.length : 0,
          active_rules: activeRules.length,
          blocking_rules: blockingRules.length,
        },
      }),
    );

    // ── Per blocking rule ───────────────────────────────────────────────────

    for (const rule of blockingRules.slice(0, 5)) {
      const appliesToCurrentTask =
        !params.current_task_type ||
        !Array.isArray(rule.applies_to_task_types) ||
        rule.applies_to_task_types.length === 0 ||
        rule.applies_to_task_types.includes(params.current_task_type);

      if (!appliesToCurrentTask) continue;

      signals.push(
        buildContextSignal({
          company_id,
          scope: "rules",
          source: "clone_adn",
          type: "constraint",
          priority: rule.severity === "critical" ? "critical" : "high",
          risk: "high",
          title: `Règle: ${rule.label ?? rule.id ?? "sans nom"}`,
          content: `${rule.description ?? rule.label ?? "Règle bloquante active."} Action: ${rule.action ?? "blocage"}`,
          confidence: 1.0,
          currentTaskType: params.current_task_type,
          currentDomain: params.current_domain,
          metadata: {
            rule_id: rule.id,
            severity: rule.severity,
            category: rule.category,
            requires_human_validation: rule.requires_human_validation === true,
          },
        }),
      );
    }
  }

  // ── Never auto-execute list (always checked) ──────────────────────────────

  const neverAutoExecute = profile.validation?.never_auto_execute ?? [];
  if (Array.isArray(neverAutoExecute) && neverAutoExecute.length > 0) {
    const relevantItem =
      params.current_task_type &&
      neverAutoExecute.some((t: unknown) => typeof t === "string" && t === params.current_task_type)
        ? params.current_task_type
        : null;

    if (relevantItem) {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "rules",
          source: "clone_adn",
          type: "constraint",
          priority: "critical",
          risk: "blocked",
          title: `Exécution automatique interdite: ${relevantItem}`,
          content: `La tâche de type "${relevantItem}" est dans la liste never_auto_execute du CloneADN. Approbation humaine obligatoire.`,
          confidence: 1.0,
          currentTaskType: params.current_task_type,
          metadata: { task_type: relevantItem, never_auto_execute: neverAutoExecute },
        }),
      );
    }
  }

  // ── Sensitive topics (always checked) ─────────────────────────────────────

  const sensitiveTopics = profile.validation?.sensitive_topics ?? [];
  if (Array.isArray(sensitiveTopics) && sensitiveTopics.length > 0) {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "rules",
        source: "clone_adn",
        type: "rule",
        priority: "medium",
        risk: "medium",
        title: `Topics sensibles (${sensitiveTopics.length})`,
        content: `Sujets nécessitant une attention particulière: ${(sensitiveTopics as string[]).slice(0, 10).join(", ")}`,
        confidence: 0.9,
        metadata: { sensitive_topics: sensitiveTopics },
      }),
    );
  }

  return signals;
}
