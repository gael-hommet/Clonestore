// TECH-09 — CloneBrief Executive Summaries — Defaults
// Valeurs par défaut et constructeurs pour la couche CloneBrief.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneBriefId,
  CloneBriefCompanyId,
  CloneBriefType,
  CloneBriefAudience,
  CloneBriefStatus,
  CloneBriefPeriod,
  CloneBriefSection,
  CloneBriefSectionType,
  CloneBriefMetric,
  CloneBriefSourceRef,
  CloneBriefExecutiveSummary,
} from "./clonebrief-types";

// ── ID generation ─────────────────────────────────────────────────────────────

export function generateCloneBriefId(): CloneBriefId {
  return `brief_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Period builders ───────────────────────────────────────────────────────────

export function buildDefaultBriefPeriod(type: CloneBriefType): CloneBriefPeriod {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  switch (type) {
    case "daily": {
      return {
        from: today + "T00:00:00.000Z",
        to: today + "T23:59:59.999Z",
        label: "Aujourd'hui",
        type: "day",
      };
    }
    case "weekly": {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1); // Lundi
      return {
        from: weekStart.toISOString().slice(0, 10) + "T00:00:00.000Z",
        to: today + "T23:59:59.999Z",
        label: "Cette semaine",
        type: "week",
      };
    }
    case "monthly": {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      return {
        from: monthStart + "T00:00:00.000Z",
        to: today + "T23:59:59.999Z",
        label: `${now.toLocaleString("fr-FR", { month: "long" })} ${now.getFullYear()}`,
        type: "month",
      };
    }
    case "mission":
      return {
        from: today + "T00:00:00.000Z",
        to: today + "T23:59:59.999Z",
        label: "Durée de la mission",
        type: "mission",
      };
    default:
      return {
        from: today + "T00:00:00.000Z",
        to: today + "T23:59:59.999Z",
        label: "Période en cours",
        type: "custom",
      };
  }
}

// ── Source ref builders ───────────────────────────────────────────────────────

export function buildSystemBriefSourceRef(): CloneBriefSourceRef {
  return {
    source_type: "system",
    source_id: "clonebrief_system",
    source_label: "CloneBrief — génération automatique",
    created_at: new Date().toISOString(),
  };
}

export function buildTraceBriefSourceRef(eventId: string): CloneBriefSourceRef {
  return {
    source_type: "clonetrace",
    source_id: eventId,
    source_label: `Événement CloneTrace: ${eventId}`,
    created_at: new Date().toISOString(),
  };
}

export function buildCommandBriefSourceRef(commandId: string): CloneBriefSourceRef {
  return {
    source_type: "cloneos",
    source_id: commandId,
    source_label: `Commande CloneOS: ${commandId}`,
    created_at: new Date().toISOString(),
  };
}

export function buildGuardBriefSourceRef(ruleId: string): CloneBriefSourceRef {
  return {
    source_type: "cloneguard",
    source_id: ruleId,
    source_label: `Règle CloneGuard: ${ruleId}`,
    created_at: new Date().toISOString(),
  };
}

export function buildAdnBriefSourceRef(companyId: string): CloneBriefSourceRef {
  return {
    source_type: "cloneadn",
    source_id: `adn_${companyId}`,
    source_label: `Mémoire CloneADN: ${companyId}`,
    created_at: new Date().toISOString(),
  };
}

// ── Section builder ───────────────────────────────────────────────────────────

export function buildEmptyBriefSection(type: CloneBriefSectionType): CloneBriefSection {
  const sectionTitles: Record<CloneBriefSectionType, string> = {
    overview: "Vue d'ensemble",
    completed_actions: "Actions terminées",
    pending_actions: "Actions en attente",
    blocked_actions: "Actions bloquées",
    validations_required: "Validations requises",
    risks: "Risques identifiés",
    employee_activity: "Activité des employés IA",
    technology_activity: "Activité des technologies",
    next_steps: "Prochaines étapes",
    attention_points: "Points d'attention",
    system_health: "Santé du système",
  };

  return {
    section_id: `section_${type}_${Date.now()}`,
    type,
    title: sectionTitles[type] ?? type,
    summary: "",
    priority: "normal",
    severity: "info",
    items: [],
    source_refs: [],
    is_empty: true,
  };
}

// ── Metric builder ────────────────────────────────────────────────────────────

export function buildDefaultBriefMetric(
  label: string,
  value: number | string,
): CloneBriefMetric {
  return {
    metric_id: `metric_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label,
    value,
    severity: "info",
    source_ref: buildSystemBriefSourceRef(),
  };
}

// ── Empty brief ───────────────────────────────────────────────────────────────

export function buildEmptyCloneBrief(
  companyId: CloneBriefCompanyId,
  type: CloneBriefType = "daily",
): CloneBriefExecutiveSummary {
  return {
    brief_id: generateCloneBriefId(),
    company_id: companyId,
    brief_type: type,
    period: buildDefaultBriefPeriod(type),
    audience: "founder",
    status: "empty" as CloneBriefStatus,
    title: buildDefaultBriefTitle(type, companyId),
    executive_summary: "",
    key_metrics: [],
    sections: [],
    action_items: [],
    risk_items: [],
    validation_items: [],
    blocked_items: [],
    employee_summaries: [],
    technology_summaries: [],
    source_refs: [buildSystemBriefSourceRef()],
    generated_at: new Date().toISOString(),
    is_demo: false,
    warnings: [],
  };
}

function buildDefaultBriefTitle(type: CloneBriefType, _companyId: string): string {
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const titles: Record<CloneBriefType, string> = {
    daily: `Briefing du ${today}`,
    weekly: "Résumé de la semaine",
    monthly: "Résumé mensuel",
    mission: "Résumé de mission",
    employee: "Résumé d'activité employé IA",
    risk: "Briefing risques",
    validation: "Briefing validations en attente",
    incident: "Briefing incident",
    executive: "Synthèse exécutive",
  };
  return titles[type] ?? `Briefing CloneStore — ${today}`;
}

// ── Demo brief ────────────────────────────────────────────────────────────────

/**
 * Construit un briefing de démonstration avec des données fictives.
 * Pas de vrais noms clients. Pas de secrets. Pas de promesse de conformité.
 * Aucune action réelle n'est représentée.
 */
export function buildDemoCloneBrief(companyId: CloneBriefCompanyId = "demo_company"): CloneBriefExecutiveSummary {
  const brief = buildEmptyCloneBrief(companyId, "daily");

  // Section overview demo
  const overviewSection = buildEmptyBriefSection("overview");
  overviewSection.summary = "Journée de démonstration — données fictives uniquement.";
  overviewSection.is_empty = false;
  overviewSection.severity = "info";

  // Section completed demo
  const completedSection = buildEmptyBriefSection("completed_actions");
  completedSection.summary = "1 document préparé (démo).";
  completedSection.is_empty = false;
  completedSection.severity = "success";

  // Section pending demo
  const pendingSection = buildEmptyBriefSection("pending_actions");
  pendingSection.summary = "1 validation en attente (démo).";
  pendingSection.is_empty = false;
  pendingSection.severity = "warning";

  return {
    ...brief,
    status: "ready",
    title: "Briefing de démonstration CloneStore",
    executive_summary:
      "Journée de démonstration. Pierre a préparé 1 document RH fictif. "
      + "1 validation est en attente. Aucune action critique. "
      + "Données fictives — aucune action réelle.",
    key_metrics: [
      buildDefaultBriefMetric("Documents préparés (démo)", 1),
      buildDefaultBriefMetric("Validations en attente (démo)", 1),
      buildDefaultBriefMetric("Risques détectés", 0),
      buildDefaultBriefMetric("Actions bloquées", 0),
    ],
    sections: [overviewSection, completedSection, pendingSection],
    is_demo: true,
    warnings: ["Données de démonstration — ne représente pas une activité réelle."],
  };
}
