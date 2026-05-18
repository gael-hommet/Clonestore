// Pierre HR Engine — ClonePolicy Runtime (Bloc 15)
// Pure module: no Supabase, no Next, no async, no side effects
// Role: transform company rules into executable governance decisions

import {
  type PierreHrRiskLevel,
  normalizePierreHrRiskLevel,
  getPierreHrRiskRank,
  getHighestPierreHrRiskLevel,
} from "./contracts";

// ══════════════════════════════════════════════════════════
// 1. TYPES
// ══════════════════════════════════════════════════════════

export type PierreClonePolicyDecision =
  | "allow"
  | "allow_with_warning"
  | "require_approval"
  | "block"
  | "refuse";

export type PierreClonePolicyRiskLevel = PierreHrRiskLevel;

export type PierreClonePolicySeverity =
  | "info"
  | "warning"
  | "approval_required"
  | "blocked"
  | "refused";

export type PierreClonePolicyScope =
  | "global"
  | "domain"
  | "task_type"
  | "employee"
  | "mission"
  | "site"
  | "department"
  | "risk_level"
  | "autonomy_level";

export type PierreClonePolicyRuleStatus = "enabled" | "disabled";

export type PierreClonePolicySource =
  | "default"
  | "company_memory"
  | "runtime_payload"
  | "system";

export type PierreClonePolicyCondition = {
  domains?: string[];
  task_types?: string[];
  action_kinds?: string[];
  employee_ids?: string[];
  employee_names?: string[];
  sites?: string[];
  departments?: string[];
  risk_levels?: PierreClonePolicyRiskLevel[];
  autonomy_levels?: string[];
  keywords?: string[];
  approval_required?: boolean | null;
  external_communication?: boolean | null;
};

export type PierreClonePolicyRule = {
  id: string;
  name: string;
  description: string;
  status: PierreClonePolicyRuleStatus;
  source: PierreClonePolicySource;
  scope: PierreClonePolicyScope;
  severity: PierreClonePolicySeverity;
  decision: PierreClonePolicyDecision;
  risk_level: PierreClonePolicyRiskLevel;
  can_override: boolean;
  priority: number;
  condition: PierreClonePolicyCondition;
  reason: string;
};

export type PierreClonePolicyContext = {
  task_type?: string | null;
  task_title?: string | null;
  task_description?: string | null;
  payload_json?: Record<string, unknown> | null;
  domain?: string | null;
  action_kind?: string | null;
  risk_level_hint?: string | null;
  autonomy_level?: string | null;
  approval_required?: boolean | null;
  employee_id?: string | null;
  employee_name?: string | null;
  employee_site?: string | null;
  employee_department?: string | null;
  mission_id?: string | null;
  mission_summary?: string | null;
  text_corpus?: string | null;
  company_memory?: Record<string, unknown> | null;
  runtime_rules?: PierreClonePolicyRule[] | null;
  now?: string | null;
};

export type PierreClonePolicyMatch = {
  rule_id: string;
  rule_name: string;
  decision: PierreClonePolicyDecision;
  risk_level: PierreClonePolicyRiskLevel;
  severity: PierreClonePolicySeverity;
  reason: string;
  priority: number;
  source: PierreClonePolicySource;
};

export type PierreClonePolicyEvaluation = {
  decision: PierreClonePolicyDecision;
  risk_level: PierreClonePolicyRiskLevel;
  matched_rules: PierreClonePolicyMatch[];
  allowed_to_auto_execute: boolean;
  requires_human: boolean;
  explanation: string;
  human_note: string;
  evaluated_at: string;
};

export type PierreClonePolicyPreview = {
  decision: PierreClonePolicyDecision;
  risk_level: PierreClonePolicyRiskLevel;
  matched_rules_count: number;
  top_rule: PierreClonePolicyMatch | null;
  allowed_to_auto_execute: boolean;
  summary: string;
};

export type PierreClonePolicyAuditEvent = {
  event_type:
    | "clonepolicy_evaluation"
    | "clonepolicy_rule_matched"
    | "clonepolicy_execution_blocked";
  message: string;
  meta_json: {
    decision: PierreClonePolicyDecision;
    risk_level: PierreClonePolicyRiskLevel;
    matched_rules_count: number;
    matched_rules: PierreClonePolicyMatch[];
    allowed_to_auto_execute: boolean;
    task_type?: string | null;
    domain?: string | null;
    employee_id?: string | null;
    mission_id?: string | null;
  };
};

// ══════════════════════════════════════════════════════════
// 2. DECISION RANKING
// ══════════════════════════════════════════════════════════

const POLICY_DECISION_RANK: Record<PierreClonePolicyDecision, number> = {
  allow: 0,
  allow_with_warning: 1,
  require_approval: 2,
  block: 3,
  refuse: 4,
};

function worstPolicyDecision(
  a: PierreClonePolicyDecision,
  b: PierreClonePolicyDecision,
): PierreClonePolicyDecision {
  return POLICY_DECISION_RANK[a] >= POLICY_DECISION_RANK[b] ? a : b;
}

function decisionToRisk(
  decision: PierreClonePolicyDecision,
): PierreClonePolicyRiskLevel {
  if (decision === "refuse") return "black";
  if (decision === "block") return "black";
  if (decision === "require_approval") return "red";
  if (decision === "allow_with_warning") return "orange";
  return "green";
}

// ══════════════════════════════════════════════════════════
// 3. NORMALIZERS
// ══════════════════════════════════════════════════════════

export function normalizeClonePolicyDecision(
  value: unknown,
): PierreClonePolicyDecision {
  if (typeof value !== "string") return "allow_with_warning";
  const t = value.trim().toLowerCase();
  if (t === "allow") return "allow";
  if (t === "allow_with_warning") return "allow_with_warning";
  if (t === "require_approval") return "require_approval";
  if (t === "block") return "block";
  if (t === "refuse") return "refuse";
  return "allow_with_warning";
}

export function normalizeClonePolicyRiskLevel(
  value: unknown,
): PierreClonePolicyRiskLevel {
  return normalizePierreHrRiskLevel(value);
}

export function normalizeClonePolicySeverity(
  value: unknown,
): PierreClonePolicySeverity {
  if (typeof value !== "string") return "warning";
  const t = value.trim().toLowerCase();
  if (t === "info") return "info";
  if (t === "warning") return "warning";
  if (t === "approval_required") return "approval_required";
  if (t === "blocked") return "blocked";
  if (t === "refused") return "refused";
  return "warning";
}

export function normalizeClonePolicyScope(
  value: unknown,
): PierreClonePolicyScope {
  if (typeof value !== "string") return "global";
  const t = value.trim().toLowerCase();
  const valid: PierreClonePolicyScope[] = [
    "global", "domain", "task_type", "employee", "mission",
    "site", "department", "risk_level", "autonomy_level",
  ];
  return (valid as string[]).includes(t) ? (t as PierreClonePolicyScope) : "global";
}

// ══════════════════════════════════════════════════════════
// 4. TEXT HELPERS (local — no import from cloneguard)
// ══════════════════════════════════════════════════════════

function stripDiacritics(s: string): string {
  // eslint-disable-next-line no-misleading-character-class
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

export function collectClonePolicyText(ctx: PierreClonePolicyContext): string {
  if (!ctx || typeof ctx !== "object") return "";
  const parts: string[] = [];
  if (typeof ctx.task_type === "string") parts.push(ctx.task_type);
  if (typeof ctx.task_title === "string") parts.push(ctx.task_title);
  if (typeof ctx.task_description === "string") parts.push(ctx.task_description);
  if (typeof ctx.text_corpus === "string") parts.push(ctx.text_corpus);
  if (typeof ctx.domain === "string") parts.push(ctx.domain);
  if (typeof ctx.mission_summary === "string") parts.push(ctx.mission_summary);

  if (ctx.payload_json && typeof ctx.payload_json === "object") {
    const extract = (obj: Record<string, unknown>): void => {
      for (const val of Object.values(obj)) {
        if (typeof val === "string") {
          parts.push(val);
        } else if (isObject(val)) {
          try { extract(val); } catch (_e) { /* skip malformed row */ }
        }
      }
    };
    try { extract(ctx.payload_json); } catch (_e) { /* skip malformed row */ }
  }

  return stripDiacritics(parts.join(" ").toLowerCase());
}

// ══════════════════════════════════════════════════════════
// 5. DEFAULT POLICY RULES
// ══════════════════════════════════════════════════════════

export function buildDefaultClonePolicyRules(): PierreClonePolicyRule[] {
  return [
    // ── REFUSE (système — non négociable) ─────────────────
    {
      id: "policy_harcelement_refuse",
      name: "Harcèlement — refus absolu",
      description: "Contexte de harcèlement détecté dans la demande",
      status: "enabled",
      source: "system",
      scope: "global",
      severity: "refused",
      decision: "refuse",
      risk_level: "black",
      can_override: false,
      priority: 100,
      condition: { keywords: ["harcel"] },
      reason:
        "Signal de harcèlement détecté. Toute décision est réservée à un humain. Pierre peut préparer un dossier mais ne peut pas agir seul.",
    },
    {
      id: "policy_discrimination_refuse",
      name: "Discrimination — refus absolu",
      description: "Contexte de discrimination détecté",
      status: "enabled",
      source: "system",
      scope: "global",
      severity: "refused",
      decision: "refuse",
      risk_level: "black",
      can_override: false,
      priority: 100,
      condition: { keywords: ["discrimin"] },
      reason:
        "Signal de discrimination détecté. Action réservée à l'humain sans exception.",
    },
    {
      id: "policy_violence_refuse",
      name: "Violence / Agression — refus absolu",
      description: "Contexte de violence ou agression détecté",
      status: "enabled",
      source: "system",
      scope: "global",
      severity: "refused",
      decision: "refuse",
      risk_level: "black",
      can_override: false,
      priority: 100,
      condition: { keywords: ["agress", "violen"] },
      reason:
        "Signal de violence ou agression détecté. Intervention humaine obligatoire.",
    },
    {
      id: "policy_prudhommes_refuse",
      name: "Prud'hommes — refus absolu",
      description: "Procédure prud'hommale détectée",
      status: "enabled",
      source: "system",
      scope: "global",
      severity: "refused",
      decision: "refuse",
      risk_level: "black",
      can_override: false,
      priority: 100,
      condition: { keywords: ["prudhomm", "prud"] },
      reason:
        "Contexte prud'hommal détecté. Seul un juriste ou DRH peut décider.",
    },
    {
      id: "policy_faute_grave_refuse",
      name: "Faute grave — refus absolu",
      description: "Faute grave ou lourde détectée dans le contexte",
      status: "enabled",
      source: "system",
      scope: "global",
      severity: "refused",
      decision: "refuse",
      risk_level: "black",
      can_override: false,
      priority: 100,
      condition: { keywords: ["faute grave", "faute lourde"] },
      reason:
        "Faute grave ou lourde détectée. La qualification et la décision sont exclusivement humaines.",
    },
    {
      id: "policy_decision_licenciement_refuse",
      name: "Décision de licenciement — refus absolu",
      description: "Type de tâche classé noir (licenciement/discriminatoire/juridique sensible)",
      status: "enabled",
      source: "system",
      scope: "task_type",
      severity: "refused",
      decision: "refuse",
      risk_level: "black",
      can_override: false,
      priority: 100,
      condition: {
        task_types: [
          "decision_licenciement",
          "decision_discriminatoire",
          "envoi_juridique_sensible",
          "interpretation_droit",
          "modification_politique_rh",
          "decision_salariale_finale",
        ],
      },
      reason:
        "Type de tâche classé noir : licenciement, décision discriminatoire ou juridique sensible. Pierre ne peut pas exécuter seul.",
    },
    {
      id: "policy_decision_sanction_refuse",
      name: "Décision disciplinaire définitive — refus absolu",
      description: "Décision disciplinaire ou résolution de conflit humain",
      status: "enabled",
      source: "system",
      scope: "task_type",
      severity: "refused",
      decision: "refuse",
      risk_level: "black",
      can_override: false,
      priority: 100,
      condition: { task_types: ["decision_sanction", "resolution_conflit_humain"] },
      reason:
        "Décision disciplinaire définitive. Réservée à l'humain sans exception.",
    },
    {
      id: "policy_risk_black_refuse",
      name: "Risque noir — refus automatique",
      description: "Niveau de risque black indiqué dans le contexte",
      status: "enabled",
      source: "system",
      scope: "risk_level",
      severity: "refused",
      decision: "refuse",
      risk_level: "black",
      can_override: false,
      priority: 95,
      condition: { risk_levels: ["black"] },
      reason:
        "Niveau de risque RH noir. Pierre ne peut pas agir seul sur ce contexte.",
    },

    // ── BLOCK (exécution manuelle possible) ──────────────
    {
      id: "policy_email_send_block",
      name: "Envoi d'email — jamais auto-exécuté",
      description: "email.send et send_email ne peuvent jamais être auto-exécutés",
      status: "enabled",
      source: "system",
      scope: "task_type",
      severity: "blocked",
      decision: "block",
      risk_level: "black",
      can_override: false,
      priority: 99,
      condition: { task_types: ["email.send", "send_email"] },
      reason:
        "Les envois d'emails ne peuvent jamais être auto-exécutés par Pierre. Un humain doit déclencher l'envoi.",
    },
    {
      id: "policy_judiciaire_block",
      name: "Contexte judiciaire — blocage",
      description: "Procédure judiciaire détectée dans le texte",
      status: "enabled",
      source: "system",
      scope: "global",
      severity: "blocked",
      decision: "block",
      risk_level: "black",
      can_override: false,
      priority: 95,
      condition: { keywords: ["judiciaire"] },
      reason:
        "Contexte judiciaire détecté. Toute action nécessite une validation juridique.",
    },

    // ── REQUIRE_APPROVAL (rouge) ─────────────────────────
    {
      id: "policy_approval_required_block",
      name: "Approbation requise — validation obligatoire",
      description: "Tâche marquée approval_required",
      status: "enabled",
      source: "system",
      scope: "global",
      severity: "approval_required",
      decision: "require_approval",
      risk_level: "red",
      can_override: false,
      priority: 98,
      condition: { approval_required: true },
      reason:
        "Cette tâche nécessite une approbation humaine explicite avant toute exécution.",
    },
    {
      id: "policy_contrat_require",
      name: "Action contractuelle — validation obligatoire",
      description: "Contrats, avenants, documents contractuels",
      status: "enabled",
      source: "system",
      scope: "task_type",
      severity: "approval_required",
      decision: "require_approval",
      risk_level: "red",
      can_override: false,
      priority: 90,
      condition: {
        task_types: ["contrat", "avenant", "document_contractuel", "refus_candidat_formel"],
      },
      reason:
        "Actions contractuelles : validation humaine obligatoire avant envoi, signature ou usage.",
    },
    {
      id: "policy_paie_require",
      name: "Action de paie — validation obligatoire",
      description: "Préparation paie et rémunération",
      status: "enabled",
      source: "system",
      scope: "task_type",
      severity: "approval_required",
      decision: "require_approval",
      risk_level: "red",
      can_override: false,
      priority: 90,
      condition: { task_types: ["prepaie_prep", "remuneration"] },
      reason:
        "Modifications de rémunération ou décisions de paie nécessitent une validation humaine.",
    },
    {
      id: "policy_absence_sensible_require",
      name: "Absence sensible / sujet médical — validation obligatoire",
      description: "Absence sensible, sujet médical, offboarding sensible",
      status: "enabled",
      source: "system",
      scope: "task_type",
      severity: "approval_required",
      decision: "require_approval",
      risk_level: "red",
      can_override: false,
      priority: 88,
      condition: {
        task_types: ["absence_sensible", "sujet_medical", "offboarding_sensible"],
      },
      reason:
        "Sujet médical ou absence sensible : validation humaine obligatoire.",
    },
    {
      id: "policy_disciplinaire_prep_require",
      name: "Préparation disciplinaire — validation obligatoire",
      description: "Conflit préliminaire, courrier disciplinaire en préparation",
      status: "enabled",
      source: "system",
      scope: "task_type",
      severity: "approval_required",
      decision: "require_approval",
      risk_level: "red",
      can_override: false,
      priority: 88,
      condition: {
        task_types: ["conflit_prelim", "courrier_disciplinaire_prep", "employee_relations_doc"],
      },
      reason:
        "Préparation disciplinaire : Pierre prépare le dossier, l'humain valide avant toute action.",
    },
    {
      id: "policy_licenciement_text_require",
      name: "Contexte de licenciement — validation obligatoire",
      description: "Mot 'licenci' détecté dans le texte",
      status: "enabled",
      source: "system",
      scope: "global",
      severity: "approval_required",
      decision: "require_approval",
      risk_level: "red",
      can_override: false,
      priority: 85,
      condition: { keywords: ["licenci"] },
      reason:
        "Contexte de licenciement détecté. Toute action dans ce contexte nécessite une validation humaine.",
    },
    {
      id: "policy_rupture_conv_require",
      name: "Rupture conventionnelle — validation obligatoire",
      description: "Contexte de rupture conventionnelle",
      status: "enabled",
      source: "system",
      scope: "global",
      severity: "approval_required",
      decision: "require_approval",
      risk_level: "red",
      can_override: false,
      priority: 85,
      condition: { keywords: ["rupture conv", "rupture_conv"] },
      reason:
        "Rupture conventionnelle : validation RH et accord des deux parties obligatoires.",
    },
    {
      id: "policy_offboarding_require",
      name: "Offboarding — validation obligatoire",
      description: "Contexte d'offboarding dans le texte",
      status: "enabled",
      source: "system",
      scope: "global",
      severity: "approval_required",
      decision: "require_approval",
      risk_level: "red",
      can_override: false,
      priority: 82,
      condition: { keywords: ["offboarding"] },
      reason:
        "Contexte d'offboarding : validation humaine requise pour toute action.",
    },
    {
      id: "policy_risk_red_require",
      name: "Risque rouge — validation obligatoire",
      description: "Niveau de risque red indiqué dans le contexte",
      status: "enabled",
      source: "system",
      scope: "risk_level",
      severity: "approval_required",
      decision: "require_approval",
      risk_level: "red",
      can_override: false,
      priority: 80,
      condition: { risk_levels: ["red"] },
      reason:
        "Niveau de risque élevé indiqué explicitement : validation humaine obligatoire.",
    },

    // ── ALLOW_WITH_WARNING (orange) ──────────────────────
    {
      id: "policy_email_draft_warn",
      name: "Brouillon d'email — vigilance recommandée",
      description: "Pierre prépare un brouillon d'email",
      status: "enabled",
      source: "default",
      scope: "task_type",
      severity: "warning",
      decision: "allow_with_warning",
      risk_level: "orange",
      can_override: true,
      priority: 60,
      condition: { task_types: ["email.draft"] },
      reason:
        "Pierre prépare un brouillon d'email. Relecture humaine recommandée avant envoi.",
    },
    {
      id: "policy_doc_generate_warn",
      name: "Génération de document — vigilance recommandée",
      description: "Pierre génère un document RH",
      status: "enabled",
      source: "default",
      scope: "task_type",
      severity: "warning",
      decision: "allow_with_warning",
      risk_level: "orange",
      can_override: true,
      priority: 60,
      condition: { task_types: ["doc.generate", "doc.rewrite", "pdf.generate"] },
      reason:
        "Document RH généré par Pierre. Validation recommandée avant usage ou diffusion.",
    },
    {
      id: "policy_sensitive_domain_warn",
      name: "Domaine sensible — vigilance recommandée",
      description: "Domain sensitive_case détecté",
      status: "enabled",
      source: "default",
      scope: "domain",
      severity: "warning",
      decision: "allow_with_warning",
      risk_level: "orange",
      can_override: true,
      priority: 55,
      condition: { domains: ["sensitive_case"] },
      reason:
        "Le domaine de cette action est classé sensible. Vigilance recommandée.",
    },
    {
      id: "policy_disciplin_text_warn",
      name: "Contexte disciplinaire — vigilance recommandée",
      description: "Contexte disciplinaire dans le texte (hors type identifié)",
      status: "enabled",
      source: "default",
      scope: "global",
      severity: "warning",
      decision: "allow_with_warning",
      risk_level: "orange",
      can_override: true,
      priority: 50,
      condition: { keywords: ["disciplin"] },
      reason:
        "Contexte disciplinaire détecté. Validation recommandée avant toute action.",
    },
    {
      id: "policy_risk_orange_warn",
      name: "Risque orange — vigilance recommandée",
      description: "Niveau de risque orange indiqué dans le contexte",
      status: "enabled",
      source: "default",
      scope: "risk_level",
      severity: "warning",
      decision: "allow_with_warning",
      risk_level: "orange",
      can_override: true,
      priority: 50,
      condition: { risk_levels: ["orange"] },
      reason: "Niveau de risque modéré : validation recommandée.",
    },
    {
      id: "policy_hr_communication_warn",
      name: "Communication RH — vigilance recommandée",
      description: "Email salarié, email candidat, document RH",
      status: "enabled",
      source: "default",
      scope: "task_type",
      severity: "warning",
      decision: "allow_with_warning",
      risk_level: "orange",
      can_override: true,
      priority: 55,
      condition: {
        task_types: [
          "email_salarie",
          "email_candidat",
          "document_rh",
          "compte_rendu",
          "trame_entretien",
          "synthese_manager",
          "onboarding_prep",
        ],
      },
      reason:
        "Communication ou document RH préparé par Pierre. Relecture recommandée avant diffusion.",
    },
  ];
}

// ══════════════════════════════════════════════════════════
// 6. COMPANY MEMORY EXTRACTOR
// ══════════════════════════════════════════════════════════

function extractRulesFromArray(
  arr: unknown,
  source: PierreClonePolicySource,
): PierreClonePolicyRule[] {
  if (!Array.isArray(arr)) return [];
  const result: PierreClonePolicyRule[] = [];
  for (const item of arr) {
    const rule = normalizeClonePolicyRule(item, source);
    if (rule) result.push(rule);
  }
  return result;
}

export function extractClonePolicyRulesFromCompanyMemory(
  companyMemory: Record<string, unknown> | null | undefined,
): PierreClonePolicyRule[] {
  if (!isObject(companyMemory)) return [];

  const candidates: unknown[] = [
    companyMemory.clonepolicy_rules,
    companyMemory.policy_rules,
    companyMemory.governance_rules,
  ];

  const rhCtx = isObject(companyMemory.reusable_rh_context_json)
    ? companyMemory.reusable_rh_context_json
    : null;

  if (rhCtx) {
    candidates.push(rhCtx.clonepolicy_rules, rhCtx.policy_rules, rhCtx.governance_rules);
  }

  const results: PierreClonePolicyRule[] = [];
  for (const arr of candidates) {
    if (arr) {
      results.push(...extractRulesFromArray(arr, "company_memory"));
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════
// 7. RULE NORMALIZER
// ══════════════════════════════════════════════════════════

export function normalizeClonePolicyRule(
  raw: unknown,
  source: PierreClonePolicySource,
): PierreClonePolicyRule | null {
  if (!isObject(raw)) return null;

  const id =
    asString(raw.id) ||
    asString(raw.rule_id) ||
    `custom_rule_${asString(raw.decision) || "unknown"}_${Math.random().toString(36).slice(2, 7)}`;

  const name = asString(raw.name) || asString(raw.label) || id;
  const description = asString(raw.description) || asString(raw.reason) || "";
  const decisionRaw = asString(raw.decision) || "allow_with_warning";
  const decision = normalizeClonePolicyDecision(decisionRaw);
  const risk_level = normalizeClonePolicyRiskLevel(
    raw.risk_level ?? raw.riskLevel ?? decisionToRisk(decision),
  );
  const severity = normalizeClonePolicySeverity(raw.severity ?? decisionToSeverity(decision));
  const scope = normalizeClonePolicyScope(raw.scope);
  const status: PierreClonePolicyRuleStatus =
    raw.status === "disabled" ? "disabled" : "enabled";
  const can_override =
    raw.can_override === true || raw.canOverride === true ? true : false;
  const priority =
    typeof raw.priority === "number" && Number.isFinite(raw.priority)
      ? Math.max(0, Math.min(100, Math.floor(raw.priority)))
      : 50;
  const reason = asString(raw.reason) || asString(raw.description) || "Règle entreprise.";

  // Normalize condition
  let condition: PierreClonePolicyCondition = {};
  try {
    if (isObject(raw.condition)) {
      condition = buildSafeCondition(raw.condition);
    } else if (isObject(raw.match)) {
      condition = buildSafeCondition(raw.match);
    }
  } catch (_e) { /* skip malformed row */ }

  return {
    id,
    name,
    description,
    status,
    source,
    scope,
    severity,
    decision,
    risk_level,
    can_override,
    priority,
    condition,
    reason,
  };
}

function decisionToSeverity(decision: PierreClonePolicyDecision): PierreClonePolicySeverity {
  if (decision === "refuse") return "refused";
  if (decision === "block") return "blocked";
  if (decision === "require_approval") return "approval_required";
  if (decision === "allow_with_warning") return "warning";
  return "info";
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function buildSafeCondition(raw: Record<string, unknown>): PierreClonePolicyCondition {
  const c: PierreClonePolicyCondition = {};
  const domains = toStringArray(raw.domains);
  if (domains.length > 0) c.domains = domains;
  const task_types = toStringArray(raw.task_types ?? raw.taskTypes);
  if (task_types.length > 0) c.task_types = task_types;
  const action_kinds = toStringArray(raw.action_kinds ?? raw.actionKinds);
  if (action_kinds.length > 0) c.action_kinds = action_kinds;
  const employee_ids = toStringArray(raw.employee_ids ?? raw.employeeIds);
  if (employee_ids.length > 0) c.employee_ids = employee_ids;
  const employee_names = toStringArray(raw.employee_names ?? raw.employeeNames);
  if (employee_names.length > 0) c.employee_names = employee_names;
  const sites = toStringArray(raw.sites);
  if (sites.length > 0) c.sites = sites;
  const departments = toStringArray(raw.departments);
  if (departments.length > 0) c.departments = departments;
  const risk_levels = toStringArray(raw.risk_levels ?? raw.riskLevels).filter(
    (x): x is PierreClonePolicyRiskLevel => ["green", "orange", "red", "black"].includes(x),
  );
  if (risk_levels.length > 0) c.risk_levels = risk_levels;
  const autonomy_levels = toStringArray(raw.autonomy_levels ?? raw.autonomyLevels);
  if (autonomy_levels.length > 0) c.autonomy_levels = autonomy_levels;
  const keywords = toStringArray(raw.keywords);
  if (keywords.length > 0) c.keywords = keywords;
  if (typeof raw.approval_required === "boolean") {
    c.approval_required = raw.approval_required;
  }
  if (typeof raw.external_communication === "boolean") {
    c.external_communication = raw.external_communication;
  }
  return c;
}

// ══════════════════════════════════════════════════════════
// 8. RULE MATCHER
// ══════════════════════════════════════════════════════════

export function doesClonePolicyRuleMatch(
  rule: PierreClonePolicyRule,
  ctx: PierreClonePolicyContext,
  collectedText: string,
): boolean {
  if (!rule || rule.status === "disabled") return false;
  const cond = rule.condition;
  if (!isObject(cond)) return false;

  // domains
  if (cond.domains && cond.domains.length > 0) {
    const domain = typeof ctx.domain === "string" ? ctx.domain.trim().toLowerCase() : null;
    if (!domain || !cond.domains.map((d) => d.toLowerCase()).includes(domain)) return false;
  }

  // task_types
  if (cond.task_types && cond.task_types.length > 0) {
    const tt = typeof ctx.task_type === "string" ? ctx.task_type.trim().toLowerCase() : null;
    if (!tt || !cond.task_types.map((t) => t.toLowerCase()).includes(tt)) return false;
  }

  // action_kinds
  if (cond.action_kinds && cond.action_kinds.length > 0) {
    const ak = typeof ctx.action_kind === "string" ? ctx.action_kind.trim().toLowerCase() : null;
    if (!ak || !cond.action_kinds.map((a) => a.toLowerCase()).includes(ak)) return false;
  }

  // employee_ids
  if (cond.employee_ids && cond.employee_ids.length > 0) {
    const eid = typeof ctx.employee_id === "string" ? ctx.employee_id : null;
    if (!eid || !cond.employee_ids.includes(eid)) return false;
  }

  // employee_names
  if (cond.employee_names && cond.employee_names.length > 0) {
    const en = typeof ctx.employee_name === "string" ? ctx.employee_name.toLowerCase() : null;
    if (!en || !cond.employee_names.map((n) => n.toLowerCase()).includes(en)) return false;
  }

  // sites
  if (cond.sites && cond.sites.length > 0) {
    const site = typeof ctx.employee_site === "string" ? ctx.employee_site.toLowerCase() : null;
    if (!site || !cond.sites.map((s) => s.toLowerCase()).includes(site)) return false;
  }

  // departments
  if (cond.departments && cond.departments.length > 0) {
    const dept = typeof ctx.employee_department === "string"
      ? ctx.employee_department.toLowerCase()
      : null;
    if (!dept || !cond.departments.map((d) => d.toLowerCase()).includes(dept)) return false;
  }

  // risk_levels
  if (cond.risk_levels && cond.risk_levels.length > 0) {
    const rl = normalizePierreHrRiskLevel(ctx.risk_level_hint);
    if (!cond.risk_levels.includes(rl)) return false;
  }

  // autonomy_levels
  if (cond.autonomy_levels && cond.autonomy_levels.length > 0) {
    const al = typeof ctx.autonomy_level === "string" ? ctx.autonomy_level.toLowerCase() : null;
    if (!al || !cond.autonomy_levels.map((a) => a.toLowerCase()).includes(al)) return false;
  }

  // approval_required
  if (typeof cond.approval_required === "boolean") {
    if (ctx.approval_required !== cond.approval_required) return false;
  }

  // external_communication
  if (typeof cond.external_communication === "boolean") {
    const isEmailSend =
      ctx.task_type === "email.send" ||
      ctx.task_type === "send_email" ||
      ctx.action_kind === "email_send";
    if (cond.external_communication !== isEmailSend) return false;
  }

  // keywords — ANY keyword must match (OR logic among keywords, AND with other conditions)
  if (cond.keywords && cond.keywords.length > 0) {
    const text = collectedText || "";
    const normalizedKeywords = cond.keywords.map((k) =>
      stripDiacritics(k.toLowerCase()),
    );
    const matched = normalizedKeywords.some((kw) => text.includes(kw));
    if (!matched) return false;
  }

  return true;
}

// ══════════════════════════════════════════════════════════
// 9. MAIN EVALUATOR
// ══════════════════════════════════════════════════════════

export function evaluatePierreClonePolicy(
  ctx: PierreClonePolicyContext,
): PierreClonePolicyEvaluation {
  if (!ctx || typeof ctx !== "object") {
    return {
      decision: "allow",
      risk_level: "green",
      matched_rules: [],
      allowed_to_auto_execute: true,
      requires_human: false,
      explanation: "Contexte vide — aucune restriction politique détectée.",
      human_note: "",
      evaluated_at: "",
    };
  }

  const collectedText = collectClonePolicyText(ctx);

  // Collect all applicable rules: default + company_memory + runtime_rules
  const defaultRules = buildDefaultClonePolicyRules();
  const memoryRules = extractClonePolicyRulesFromCompanyMemory(ctx.company_memory ?? null);
  const runtimeRules: PierreClonePolicyRule[] = [];

  if (Array.isArray(ctx.runtime_rules)) {
    for (const r of ctx.runtime_rules) {
      if (r && typeof r === "object" && asString((r as Record<string, unknown>).id)) {
        const norm = normalizeClonePolicyRule(r, "runtime_payload");
        if (norm) runtimeRules.push(norm);
      }
    }
  }

  const allRules = [...defaultRules, ...memoryRules, ...runtimeRules];

  let worstDec: PierreClonePolicyDecision = "allow";
  const matchedRules: PierreClonePolicyMatch[] = [];

  for (const rule of allRules) {
    let matched = false;
    try {
      matched = doesClonePolicyRuleMatch(rule, ctx, collectedText);
    } catch (_e) { /* skip malformed row */ }

    if (matched) {
      matchedRules.push({
        rule_id: rule.id,
        rule_name: rule.name,
        decision: rule.decision,
        risk_level: rule.risk_level,
        severity: rule.severity,
        reason: rule.reason,
        priority: rule.priority,
        source: rule.source,
      });
      worstDec = worstPolicyDecision(worstDec, rule.decision);
    }
  }

  // Effective risk level
  const signalRisk: PierreClonePolicyRiskLevel = matchedRules.reduce(
    (acc, r) =>
      getPierreHrRiskRank(r.risk_level) > getPierreHrRiskRank(acc) ? r.risk_level : acc,
    "green" as PierreClonePolicyRiskLevel,
  );
  const decRisk = decisionToRisk(worstDec);
  const effectiveRisk = getHighestPierreHrRiskLevel(decRisk, signalRisk);

  // Email send hard-block check
  const rawType =
    typeof ctx.task_type === "string" ? ctx.task_type.trim().toLowerCase() : "";
  const isEmailSend =
    rawType === "email.send" || rawType === "send_email" || rawType === "email_send";

  const allowed_to_auto_execute =
    worstDec === "allow" &&
    !isEmailSend &&
    ctx.approval_required !== true &&
    getPierreHrRiskRank(effectiveRisk) < getPierreHrRiskRank("red");

  const requires_human =
    worstDec === "require_approval" ||
    worstDec === "block" ||
    worstDec === "refuse";

  // Sort matched rules by priority desc for explanation
  const sortedMatches = [...matchedRules].sort((a, b) => b.priority - a.priority);
  const topReason = sortedMatches[0]?.reason ?? "";

  let explanation: string;
  if (worstDec === "refuse") {
    explanation = `Action refusée par ClonePolicy. ${topReason}`;
  } else if (worstDec === "block") {
    explanation = `Exécution automatique bloquée par ClonePolicy. ${topReason}`;
  } else if (worstDec === "require_approval") {
    explanation = `Validation humaine obligatoire (ClonePolicy). ${topReason}`;
  } else if (worstDec === "allow_with_warning") {
    explanation = `Action autorisée avec avertissement (ClonePolicy). ${topReason}`;
  } else {
    explanation = "Aucune restriction politique détectée. Action autorisée.";
  }

  const human_note = sortedMatches.map((r) => r.reason).join(" | ");

  return {
    decision: worstDec,
    risk_level: effectiveRisk,
    matched_rules: matchedRules,
    allowed_to_auto_execute,
    requires_human,
    explanation,
    human_note,
    evaluated_at: typeof ctx.now === "string" ? ctx.now : "",
  };
}

// ══════════════════════════════════════════════════════════
// 10. BUILD PREVIEW
// ══════════════════════════════════════════════════════════

export function buildClonePolicyPreview(
  evaluation: PierreClonePolicyEvaluation,
): PierreClonePolicyPreview {
  if (!evaluation || typeof evaluation !== "object") {
    return {
      decision: "allow",
      risk_level: "green",
      matched_rules_count: 0,
      top_rule: null,
      allowed_to_auto_execute: true,
      summary: "Évaluation ClonePolicy non disponible.",
    };
  }

  const matched = Array.isArray(evaluation.matched_rules) ? evaluation.matched_rules : [];
  const topRule =
    matched.length > 0
      ? [...matched].sort((a, b) => b.priority - a.priority)[0]
      : null;

  const summaryMap: Record<PierreClonePolicyDecision, string> = {
    allow: "Action autorisée par ClonePolicy.",
    allow_with_warning: "Action autorisée — validation recommandée (ClonePolicy).",
    require_approval: "Validation humaine obligatoire (ClonePolicy).",
    block: "Exécution automatique bloquée (ClonePolicy).",
    refuse: "Action refusée — intervention humaine exclusive (ClonePolicy).",
  };

  return {
    decision: evaluation.decision,
    risk_level: evaluation.risk_level,
    matched_rules_count: matched.length,
    top_rule: topRule,
    allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
    summary: summaryMap[evaluation.decision] ?? "Évaluation ClonePolicy.",
  };
}

// ══════════════════════════════════════════════════════════
// 11. BUILD AUDIT EVENT
// ══════════════════════════════════════════════════════════

export function buildClonePolicyAuditEvent(
  evaluation: PierreClonePolicyEvaluation,
  ctx?: PierreClonePolicyContext,
): PierreClonePolicyAuditEvent {
  if (!evaluation || typeof evaluation !== "object") {
    return {
      event_type: "clonepolicy_evaluation",
      message: "ClonePolicy évaluation — données manquantes.",
      meta_json: {
        decision: "allow",
        risk_level: "green",
        matched_rules_count: 0,
        matched_rules: [],
        allowed_to_auto_execute: true,
      },
    };
  }

  const matched = Array.isArray(evaluation.matched_rules) ? evaluation.matched_rules : [];

  const eventType: PierreClonePolicyAuditEvent["event_type"] =
    evaluation.decision === "refuse" || evaluation.decision === "block"
      ? "clonepolicy_execution_blocked"
      : matched.length > 0
        ? "clonepolicy_rule_matched"
        : "clonepolicy_evaluation";

  return {
    event_type: eventType,
    message: evaluation.explanation || "ClonePolicy évaluation complète.",
    meta_json: {
      decision: evaluation.decision,
      risk_level: evaluation.risk_level,
      matched_rules_count: matched.length,
      matched_rules: matched,
      allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
      task_type: ctx?.task_type ?? null,
      domain: ctx?.domain ?? null,
      employee_id: ctx?.employee_id ?? null,
      mission_id: ctx?.mission_id ?? null,
    },
  };
}

// ══════════════════════════════════════════════════════════
// 12. APPLY TO TASK
// ══════════════════════════════════════════════════════════

export function applyClonePolicyToTask(
  task: Record<string, unknown>,
  evaluation: PierreClonePolicyEvaluation,
): Record<string, unknown> {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    return { clonepolicy: null };
  }

  const evalData =
    evaluation && typeof evaluation === "object"
      ? {
          decision: evaluation.decision,
          risk_level: evaluation.risk_level,
          allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
          requires_human: evaluation.requires_human,
          matched_rules_count: Array.isArray(evaluation.matched_rules)
            ? evaluation.matched_rules.length
            : 0,
          explanation: evaluation.explanation,
        }
      : null;

  return { ...task, clonepolicy: evalData };
}

// ══════════════════════════════════════════════════════════
// 13. FAST PATH
// ══════════════════════════════════════════════════════════

export function isClonePolicyAutoExecutable(
  ctx: PierreClonePolicyContext,
): boolean {
  if (!ctx || typeof ctx !== "object") return false;

  // Fast-path hard blocks
  const rawType =
    typeof ctx.task_type === "string" ? ctx.task_type.trim().toLowerCase() : "";
  if (rawType === "email.send" || rawType === "send_email") return false;
  if (ctx.approval_required === true) return false;

  const riskHint = normalizePierreHrRiskLevel(ctx.risk_level_hint);
  if (riskHint === "red" || riskHint === "black") return false;

  const nonAutoTypes = new Set([
    "decision_licenciement", "decision_discriminatoire", "envoi_juridique_sensible",
    "interpretation_droit", "modification_politique_rh", "decision_salariale_finale",
    "decision_sanction", "resolution_conflit_humain",
    "contrat", "avenant", "document_contractuel",
    "prepaie_prep", "remuneration",
    "absence_sensible", "sujet_medical", "offboarding_sensible",
    "conflit_prelim", "courrier_disciplinaire_prep",
  ]);
  if (rawType && nonAutoTypes.has(rawType)) return false;

  return evaluatePierreClonePolicy(ctx).allowed_to_auto_execute;
}

// ══════════════════════════════════════════════════════════
// 14. SUMMARIZE
// ══════════════════════════════════════════════════════════

export function summarizeClonePolicyEvaluation(
  evaluation: PierreClonePolicyEvaluation,
): string {
  if (!evaluation || typeof evaluation !== "object") {
    return "Évaluation ClonePolicy non disponible.";
  }

  const decisionLabels: Record<PierreClonePolicyDecision, string> = {
    allow: "Autorisé",
    allow_with_warning: "Autorisé (avec avertissement)",
    require_approval: "Validation obligatoire",
    block: "Bloqué",
    refuse: "Refusé",
  };

  const riskLabels: Record<PierreClonePolicyRiskLevel, string> = {
    green: "Vert (faible risque)",
    orange: "Orange (risque modéré)",
    red: "Rouge (risque élevé)",
    black: "Noir (risque critique)",
  };

  const lines: string[] = [
    `Décision ClonePolicy : ${decisionLabels[evaluation.decision] ?? evaluation.decision}`,
    `Niveau de risque : ${riskLabels[evaluation.risk_level] ?? evaluation.risk_level}`,
  ];

  const matched = Array.isArray(evaluation.matched_rules) ? evaluation.matched_rules : [];
  if (matched.length > 0) {
    lines.push(`Règles matchées : ${matched.length}`);
    const criticals = matched.filter((r) => r.risk_level === "black" || r.risk_level === "red");
    if (criticals.length > 0) {
      lines.push(`Règles critiques : ${criticals.map((r) => r.rule_name).join(", ")}`);
    }
  }

  if (!evaluation.allowed_to_auto_execute) {
    lines.push("Auto-exécution : non autorisée");
  }

  if (evaluation.human_note) {
    lines.push(`Note politique : ${evaluation.human_note.slice(0, 200)}`);
  }

  return lines.join(" | ");
}
