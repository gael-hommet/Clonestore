// src/lib/pierre/context/company-context.ts
// B35 — Company context signals from company memory + CloneADN.

import type { PierreContextSignal } from "./types";
import { buildContextSignal } from "./context-signals";
import {
  sanitizeCloneADNProfile,
  buildPierreCloneADNHint,
  evaluatePierreActionWithCloneADN,
} from "../adn/cloneadn";

function safeStr(v: unknown, maxLen = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, maxLen) : null;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function buildCompanyContextSignals(params: {
  company_id: string;
  company_memory: Record<string, unknown> | null;
  clone_adn_profile: Record<string, unknown> | null;
  current_task_type?: string | null;
  current_domain?: string | null;
}): PierreContextSignal[] {
  const { company_id, company_memory, clone_adn_profile } = params;
  const signals: PierreContextSignal[] = [];

  const profile = sanitizeCloneADNProfile(clone_adn_profile);
  const hint = buildPierreCloneADNHint(profile);

  // ── Company identity signal ───────────────────────────────────────────────

  const companyProfile = isObj(company_memory?.company_profile)
    ? (company_memory!.company_profile as Record<string, unknown>)
    : null;

  const companyName =
    safeStr(hint?.company_name) ??
    safeStr(companyProfile?.company_name) ??
    null;

  const sector =
    safeStr(hint?.sector) ??
    safeStr(companyProfile?.sector) ??
    null;

  if (companyName || sector) {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "company",
        source: "company_memory",
        type: "identity",
        priority: "medium",
        risk: "none",
        title: "Identité entreprise",
        content: [
          companyName ? `Entreprise: ${companyName}` : null,
          sector ? `Secteur: ${sector}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        confidence: companyName ? 0.9 : 0.6,
        currentTaskType: params.current_task_type,
        currentDomain: params.current_domain,
        metadata: { company_name: companyName, sector },
      }),
    );
  } else {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "company",
        source: "default",
        type: "missing_info",
        priority: "low",
        risk: "none",
        title: "Identité entreprise manquante",
        content: "Nom et secteur de l'entreprise non configurés dans la mémoire Pierre.",
        confidence: 1.0,
      }),
    );
  }

  // ── CloneADN status signal ─────────────────────────────────────────────────

  if (hint) {
    const adnConfigured = hint.configured === true;
    signals.push(
      buildContextSignal({
        company_id,
        scope: "adn",
        source: "clone_adn",
        type: "status",
        priority: adnConfigured ? "medium" : "high",
        risk: adnConfigured ? "none" : "medium",
        title: adnConfigured ? "CloneADN configuré" : "CloneADN non configuré",
        content: adnConfigured
          ? `CloneADN actif — score: ${hint.completeness_score ?? "?"}, ton: ${hint.tone ?? "?"}, autonomie: ${hint.autonomy_level ?? "?"}${hint.blocking_rules ? `, règles bloquantes: ${hint.blocking_rules}` : ""}`
          : "CloneADN non configuré. Pierre utilisera les comportements par défaut.",
        confidence: 1.0,
        currentTaskType: params.current_task_type,
        currentDomain: params.current_domain,
        metadata: hint as Record<string, unknown>,
      }),
    );
  } else {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "adn",
        source: "default",
        type: "missing_info",
        priority: "medium",
        risk: "none",
        title: "CloneADN absent",
        content: "Aucun profil CloneADN trouvé. Comportements par défaut appliqués.",
        confidence: 1.0,
      }),
    );
  }

  // ── Tone & communication preferences ──────────────────────────────────────

  if (profile) {
    const tone = profile.communication?.tone;
    const lang = profile.communication?.language_code;
    const length = profile.communication?.preferred_length;

    if (tone || lang) {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "preference",
          source: "clone_adn",
          type: "preference",
          priority: "low",
          risk: "none",
          title: "Préférences de communication",
          content: [
            tone ? `Ton: ${tone}` : null,
            lang ? `Langue: ${lang}` : null,
            length ? `Longueur: ${length}` : null,
          ]
            .filter(Boolean)
            .join(" | "),
          confidence: 0.9,
          currentTaskType: params.current_task_type,
          currentDomain: params.current_domain,
          metadata: { tone, lang, length },
        }),
      );
    }
  }

  // ── Validation rules from CloneADN ────────────────────────────────────────

  if (profile && params.current_task_type) {
    const evalResult = evaluatePierreActionWithCloneADN({
      profile,
      taskType: params.current_task_type,
      domain: params.current_domain,
      riskLevel: null,
      sensitiveTopics: [],
    });

    if (evalResult.cloneadn_applied && (evalResult.blocked || evalResult.requires_validation)) {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "rules",
          source: "clone_adn",
          type: evalResult.blocked ? "constraint" : "validation_gate",
          priority: evalResult.blocked ? "critical" : "high",
          risk: evalResult.blocked ? "blocked" : "high",
          title: evalResult.blocked
            ? "Action bloquée par CloneADN"
            : "Validation humaine requise par CloneADN",
          content:
            evalResult.reasons.length > 0
              ? evalResult.reasons.join(". ")
              : evalResult.blocked
                ? "Cette action est bloquée par les règles CloneADN de l'entreprise."
                : "Cette action nécessite une validation humaine selon les règles CloneADN.",
          confidence: 0.95,
          currentTaskType: params.current_task_type,
          currentDomain: params.current_domain,
          metadata: { blocked: evalResult.blocked, requires_validation: evalResult.requires_validation },
        }),
      );
    }
  }

  // ── HR preferences from memory ─────────────────────────────────────────────

  const hrPrefs = isObj(company_memory?.hr_preferences)
    ? (company_memory!.hr_preferences as Record<string, unknown>)
    : null;

  if (hrPrefs) {
    const autonomy = safeStr(hrPrefs.autonomy_level);
    const approval = safeStr(hrPrefs.approval_policy);

    if (autonomy || approval) {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "preference",
          source: "company_memory",
          type: "preference",
          priority: "medium",
          risk: "none",
          title: "Préférences RH",
          content: [
            autonomy ? `Autonomie Pierre: ${autonomy}` : null,
            approval ? `Politique approbation: ${approval}` : null,
          ]
            .filter(Boolean)
            .join(" | "),
          confidence: 0.85,
          currentTaskType: params.current_task_type,
          currentDomain: params.current_domain,
          metadata: { autonomy_level: autonomy, approval_policy: approval },
        }),
      );
    }
  }

  return signals;
}
