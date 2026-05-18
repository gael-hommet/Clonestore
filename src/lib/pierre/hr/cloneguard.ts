// Pierre HR Engine — CloneGuard Runtime (Bloc 14)
// Pure module: no Supabase, no Next, no async, no side effects

import {
  type PierreHrRiskLevel,
  normalizePierreHrRiskLevel,
  getPierreHrRiskRank,
  getHighestPierreHrRiskLevel,
} from "./contracts";

// ══════════════════════════════════════════════════════════
// 1. TYPES
// ══════════════════════════════════════════════════════════

export type PierreCloneGuardRiskLevel = PierreHrRiskLevel;

export type PierreCloneGuardDecision =
  | "allow"
  | "allow_with_warning"
  | "require_approval"
  | "block"
  | "refuse";

export const CLONEGUARD_DOMAINS = [
  "recruitment_ops",
  "hiring",
  "contract",
  "amendment",
  "onboarding",
  "employee_file",
  "absence",
  "payroll_prep",
  "internal_communication",
  "hr_helpdesk",
  "performance_ops",
  "employee_relations",
  "compliance_workflow",
  "offboarding",
  "sensitive_case",
  "unknown",
] as const;

export type PierreCloneGuardDomain = (typeof CLONEGUARD_DOMAINS)[number];

export const CLONEGUARD_ACTION_KINDS = [
  "email_send",
  "email_draft",
  "doc_generate",
  "doc_rewrite",
  "pdf_generate",
  "reminder_create",
  "followup_schedule",
  "contract_action",
  "disciplinary_prep",
  "disciplinary_decision",
  "dismissal_action",
  "payroll_action",
  "absence_action",
  "unknown_action",
] as const;

export type PierreCloneGuardActionKind =
  (typeof CLONEGUARD_ACTION_KINDS)[number];

export type PierreCloneGuardSignal = {
  code: string;
  label: string;
  level: PierreCloneGuardRiskLevel;
  source: "task_type" | "text_scan" | "context" | "domain";
  matched_text?: string;
};

export type PierreCloneGuardPolicyRule = {
  id: string;
  description: string;
  decision: PierreCloneGuardDecision;
  risk_level: PierreCloneGuardRiskLevel;
  reason: string;
  can_override: boolean;
  matches: (ctx: PierreCloneGuardContext, collectedText: string) => boolean;
};

export type PierreCloneGuardContext = {
  task_type?: string | null;
  task_title?: string | null;
  task_description?: string | null;
  payload_json?: Record<string, unknown> | null;
  approval_required?: boolean | null;
  domain?: string | null;
  risk_level_hint?: string | null;
  text_corpus?: string | null;
  autonomy_level?: string | null;
  now?: string | null;
};

export type PierreCloneGuardEvaluation = {
  decision: PierreCloneGuardDecision;
  risk_level: PierreCloneGuardRiskLevel;
  signals: PierreCloneGuardSignal[];
  matched_rules: string[];
  allowed_to_auto_execute: boolean;
  requires_human: boolean;
  explanation: string;
  human_note: string;
  evaluated_at: string;
};

export type PierreCloneGuardPreview = {
  decision: PierreCloneGuardDecision;
  risk_level: PierreCloneGuardRiskLevel;
  signal_count: number;
  top_signal: PierreCloneGuardSignal | null;
  allowed_to_auto_execute: boolean;
  summary: string;
};

export type PierreCloneGuardAuditEvent = {
  event_type:
    | "cloneguard_evaluation"
    | "cloneguard_execution_blocked"
    | "cloneguard_signal_detected";
  message: string;
  meta_json: {
    decision: PierreCloneGuardDecision;
    risk_level: PierreCloneGuardRiskLevel;
    signal_count: number;
    signals: PierreCloneGuardSignal[];
    matched_rules: string[];
    allowed_to_auto_execute: boolean;
    task_type?: string | null;
    domain?: string | null;
  };
};

// ══════════════════════════════════════════════════════════
// 2. DECISION RANKING
// ══════════════════════════════════════════════════════════

function stripDiacritics(s: string): string {
  // eslint-disable-next-line no-misleading-character-class
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const DECISION_RANK: Record<PierreCloneGuardDecision, number> = {
  allow: 0,
  allow_with_warning: 1,
  require_approval: 2,
  block: 3,
  refuse: 4,
};

function worstDecision(
  a: PierreCloneGuardDecision,
  b: PierreCloneGuardDecision,
): PierreCloneGuardDecision {
  return DECISION_RANK[a] >= DECISION_RANK[b] ? a : b;
}

function decisionToRisk(
  decision: PierreCloneGuardDecision,
): PierreCloneGuardRiskLevel {
  if (decision === "refuse") return "black";
  if (decision === "block") return "black";
  if (decision === "require_approval") return "red";
  if (decision === "allow_with_warning") return "orange";
  return "green";
}

// ══════════════════════════════════════════════════════════
// 3. TEXT SIGNAL DEFINITIONS
// ══════════════════════════════════════════════════════════

type TextSignalDef = {
  code: string;
  label: string;
  level: PierreCloneGuardRiskLevel;
  pattern: RegExp;
};

const TEXT_SIGNAL_DEFS: TextSignalDef[] = [
  // Black — zone d'intervention humaine absolue
  {
    code: "harcelement",
    label: "Harcèlement signalé",
    level: "black",
    pattern: /harcel/,
  },
  {
    code: "discrimination",
    label: "Discrimination signalée",
    level: "black",
    pattern: /discrimin/,
  },
  {
    code: "violence_agression",
    label: "Violence / Agression",
    level: "black",
    pattern: /agress|violen/,
  },
  {
    code: "prudhommes",
    label: "Procédure Prud'hommes",
    level: "black",
    pattern: /prudhomm|prud.?homm/,
  },
  {
    code: "faute_grave",
    label: "Faute grave ou lourde",
    level: "black",
    pattern: /faute.?grave|faute.?lourde/,
  },
  // Red — validation humaine obligatoire
  {
    code: "licenciement",
    label: "Procédure de licenciement",
    level: "red",
    pattern: /licenci/,
  },
  {
    code: "rupture_conventionnelle",
    label: "Rupture conventionnelle",
    level: "red",
    pattern: /rupture.?conv/,
  },
  {
    code: "disciplinaire",
    label: "Procédure disciplinaire",
    level: "red",
    pattern: /disciplin/,
  },
  {
    code: "judiciaire",
    label: "Procédure judiciaire",
    level: "red",
    pattern: /judiciaire/,
  },
  {
    code: "offboarding_sensible",
    label: "Offboarding sensible",
    level: "red",
    pattern: /offboarding/,
  },
  {
    code: "paie_critique",
    label: "Situation critique",
    level: "red",
    pattern: /critiqu/,
  },
  // Orange — vigilance recommandée
  {
    code: "absence_sensible",
    label: "Absence / arrêt sensible",
    level: "orange",
    pattern: /absence.?sensibl|arr.t.?maladie|mi.?temps.?th.rap/,
  },
  {
    code: "bloquage",
    label: "Situation bloquée",
    level: "orange",
    pattern: /bloquage|bloqu/,
  },
  {
    code: "info_manquante",
    label: "Information manquante",
    level: "orange",
    pattern: /info.?manquante|information.?manquant/,
  },
];

// ══════════════════════════════════════════════════════════
// 4. NORMALIZERS
// ══════════════════════════════════════════════════════════

export function normalizeCloneGuardDomain(
  value: unknown,
): PierreCloneGuardDomain {
  if (typeof value !== "string") return "unknown";
  const t = value.trim().toLowerCase();
  if ((CLONEGUARD_DOMAINS as readonly string[]).includes(t)) {
    return t as PierreCloneGuardDomain;
  }
  if (t === "leave" || t === "lateness") return "absence";
  if (t === "interview") return "hiring";
  if (t === "training_ops") return "hr_helpdesk";
  if (t === "compensation_benefits_ops") return "payroll_prep";
  if (t === "reporting") return "hr_helpdesk";
  if (t === "multi_site_coordination") return "compliance_workflow";
  return "unknown";
}

export function normalizeCloneGuardActionKind(
  value: unknown,
): PierreCloneGuardActionKind {
  if (typeof value !== "string") return "unknown_action";
  const t = value.trim().toLowerCase();
  // Task types from types.ts (dot-notation)
  if (t === "email.send" || t === "send_email") return "email_send";
  if (t === "email.draft") return "email_draft";
  if (t === "doc.generate") return "doc_generate";
  if (t === "doc.rewrite") return "doc_rewrite";
  if (t === "pdf.generate") return "pdf_generate";
  if (t === "reminder.create") return "reminder_create";
  if (t === "followup.schedule") return "followup_schedule";
  // HR kinds — red zone (validation obligatoire)
  if (
    t === "contrat" ||
    t === "avenant" ||
    t === "document_contractuel" ||
    t === "refus_candidat_formel"
  ) {
    return "contract_action";
  }
  if (
    t === "conflit_prelim" ||
    t === "courrier_disciplinaire_prep" ||
    t === "employee_relations_doc"
  ) {
    return "disciplinary_prep";
  }
  // HR kinds — black zone (refus absolu)
  if (t === "decision_sanction" || t === "resolution_conflit_humain") {
    return "disciplinary_decision";
  }
  if (
    t === "decision_licenciement" ||
    t === "decision_discriminatoire" ||
    t === "envoi_juridique_sensible" ||
    t === "interpretation_droit" ||
    t === "modification_politique_rh" ||
    t === "decision_salariale_finale"
  ) {
    return "dismissal_action";
  }
  if (t === "prepaie_prep" || t === "remuneration") {
    return "payroll_action";
  }
  if (t === "absence_sensible" || t === "sujet_medical" || t === "offboarding_sensible") {
    return "absence_action";
  }
  return "unknown_action";
}

// ══════════════════════════════════════════════════════════
// 5. POLICY RULES
// ══════════════════════════════════════════════════════════

export function getPierreCloneGuardPolicyRules(): PierreCloneGuardPolicyRule[] {
  return [
    // ── REFUSE (black, non-négociable) ──────────────────
    {
      id: "harcelement_refuse",
      description: "Harcèlement détecté dans le contexte",
      decision: "refuse",
      risk_level: "black",
      reason:
        "Signal de harcèlement détecté. Toute décision est réservée à un humain. Pierre peut préparer un dossier mais ne peut pas agir seul.",
      can_override: false,
      matches: (_ctx, text) =>
        /harcel/.test(stripDiacritics(text.toLowerCase())),
    },
    {
      id: "discrimination_refuse",
      description: "Discrimination détectée dans le contexte",
      decision: "refuse",
      risk_level: "black",
      reason:
        "Signal de discrimination détecté. Action réservée à l'humain sans exception.",
      can_override: false,
      matches: (_ctx, text) => /discrimin/.test(text),
    },
    {
      id: "violence_refuse",
      description: "Violence ou agression détectée",
      decision: "refuse",
      risk_level: "black",
      reason:
        "Signal de violence ou d'agression détecté. Intervention humaine obligatoire.",
      can_override: false,
      matches: (_ctx, text) => /agress|violen/.test(text),
    },
    {
      id: "prudhommes_refuse",
      description: "Procédure Prud'hommes ou contentieux judiciaire",
      decision: "refuse",
      risk_level: "black",
      reason:
        "Contexte prud'hommal détecté. Seul un juriste ou DRH peut décider.",
      can_override: false,
      matches: (_ctx, text) => /prudhomm|prud.?homm/.test(text),
    },
    {
      id: "faute_grave_refuse",
      description: "Faute grave ou lourde dans le contexte",
      decision: "refuse",
      risk_level: "black",
      reason:
        "Faute grave ou lourde détectée. La qualification et la décision sont exclusivement humaines.",
      can_override: false,
      matches: (_ctx, text) => /faute.?grave|faute.?lourde/.test(text),
    },
    {
      id: "dismissal_action_refuse",
      description: "Action de licenciement ou décision noire identifiée par le type",
      decision: "refuse",
      risk_level: "black",
      reason:
        "Type de tâche classé noir (licenciement, décision discriminatoire, juridique sensible). Pierre ne peut pas exécuter seul.",
      can_override: false,
      matches: (ctx, _text) =>
        normalizeCloneGuardActionKind(ctx.task_type) === "dismissal_action",
    },
    {
      id: "disciplinary_decision_refuse",
      description: "Décision disciplinaire définitive identifiée par le type",
      decision: "refuse",
      risk_level: "black",
      reason:
        "Décision disciplinaire définitive (sanction, résolution de conflit humain). Réservée à l'humain.",
      can_override: false,
      matches: (ctx, _text) =>
        normalizeCloneGuardActionKind(ctx.task_type) === "disciplinary_decision",
    },

    // ── BLOCK (bloqué — exécution manuelle possible) ────
    {
      id: "email_send_block",
      description: "Envoi d'email — jamais auto-exécuté",
      decision: "block",
      risk_level: "black",
      reason:
        "Les envois d'emails ne peuvent jamais être auto-exécutés par Pierre. Un humain doit déclencher l'envoi.",
      can_override: false,
      matches: (ctx, _text) => {
        const t =
          typeof ctx.task_type === "string"
            ? ctx.task_type.trim().toLowerCase()
            : "";
        return (
          t === "email.send" ||
          t === "send_email" ||
          normalizeCloneGuardActionKind(ctx.task_type) === "email_send"
        );
      },
    },
    {
      id: "approval_required_block",
      description: "Tâche marquée approval_required",
      decision: "block",
      risk_level: "red",
      reason:
        "Cette tâche nécessite une approbation humaine explicite avant toute exécution.",
      can_override: false,
      matches: (ctx, _text) => ctx.approval_required === true,
    },
    {
      id: "judiciaire_block",
      description: "Contexte judiciaire détecté dans le texte",
      decision: "block",
      risk_level: "black",
      reason:
        "Contexte judiciaire détecté. Toute action nécessite une validation juridique.",
      can_override: false,
      matches: (_ctx, text) => /judiciaire/.test(text),
    },

    // ── REQUIRE_APPROVAL (rouge) ─────────────────────────
    {
      id: "contract_action_require",
      description: "Action contractuelle",
      decision: "require_approval",
      risk_level: "red",
      reason:
        "Actions sur les contrats nécessitent une validation humaine avant envoi, signature ou usage.",
      can_override: false,
      matches: (ctx, _text) =>
        normalizeCloneGuardActionKind(ctx.task_type) === "contract_action",
    },
    {
      id: "disciplinary_prep_require",
      description: "Préparation disciplinaire",
      decision: "require_approval",
      risk_level: "red",
      reason:
        "Préparation disciplinaire : Pierre prépare le dossier, l'humain valide avant toute action.",
      can_override: false,
      matches: (ctx, _text) =>
        normalizeCloneGuardActionKind(ctx.task_type) === "disciplinary_prep",
    },
    {
      id: "absence_action_require",
      description: "Absence sensible ou sujet médical",
      decision: "require_approval",
      risk_level: "red",
      reason:
        "Sujet médical ou absence sensible : validation humaine obligatoire.",
      can_override: false,
      matches: (ctx, _text) =>
        normalizeCloneGuardActionKind(ctx.task_type) === "absence_action",
    },
    {
      id: "payroll_action_require",
      description: "Action de paie ou rémunération",
      decision: "require_approval",
      risk_level: "red",
      reason:
        "Modifications de rémunération ou décisions de paie nécessitent une validation humaine.",
      can_override: false,
      matches: (ctx, _text) =>
        normalizeCloneGuardActionKind(ctx.task_type) === "payroll_action",
    },
    {
      id: "licenciement_text_require",
      description: "Contexte de licenciement dans le texte",
      decision: "require_approval",
      risk_level: "red",
      reason:
        "Contexte de licenciement détecté. Toute action dans ce contexte nécessite une validation humaine.",
      can_override: false,
      matches: (ctx, text) => {
        const kind = normalizeCloneGuardActionKind(ctx.task_type);
        return /licenci/.test(text) && kind !== "dismissal_action";
      },
    },
    {
      id: "rupture_conventionnelle_require",
      description: "Contexte de rupture conventionnelle",
      decision: "require_approval",
      risk_level: "red",
      reason:
        "Rupture conventionnelle : validation RH et accord des deux parties obligatoires.",
      can_override: false,
      matches: (_ctx, text) => /rupture.?conv/.test(text),
    },
    {
      id: "offboarding_text_require",
      description: "Contexte d'offboarding détecté dans le texte",
      decision: "require_approval",
      risk_level: "red",
      reason:
        "Contexte d'offboarding : validation humaine requise pour toute action.",
      can_override: false,
      matches: (ctx, text) => {
        const kind = normalizeCloneGuardActionKind(ctx.task_type);
        return /offboarding/.test(text) && kind !== "dismissal_action";
      },
    },
    {
      id: "risk_hint_red_require",
      description: "Niveau de risque red ou black indiqué dans le contexte",
      decision: "require_approval",
      risk_level: "red",
      reason:
        "Niveau de risque élevé indiqué explicitement : validation humaine obligatoire.",
      can_override: false,
      matches: (ctx, _text) => {
        const r = normalizePierreHrRiskLevel(ctx.risk_level_hint);
        return r === "red" || r === "black";
      },
    },

    // ── ALLOW_WITH_WARNING (orange) ──────────────────────
    {
      id: "email_draft_warn",
      description: "Brouillon d'email préparé par Pierre",
      decision: "allow_with_warning",
      risk_level: "orange",
      reason:
        "Pierre prépare un brouillon d'email. Relecture humaine recommandée avant envoi.",
      can_override: true,
      matches: (ctx, _text) =>
        normalizeCloneGuardActionKind(ctx.task_type) === "email_draft",
    },
    {
      id: "doc_generate_warn",
      description: "Génération de document RH",
      decision: "allow_with_warning",
      risk_level: "orange",
      reason:
        "Document RH généré par Pierre. Validation recommandée avant usage ou diffusion.",
      can_override: true,
      matches: (ctx, _text) =>
        normalizeCloneGuardActionKind(ctx.task_type) === "doc_generate",
    },
    {
      id: "validation_recommended_warn",
      description: "Type de tâche à validation recommandée",
      decision: "allow_with_warning",
      risk_level: "orange",
      reason:
        "Ce type de tâche bénéficie d'une relecture humaine avant diffusion.",
      can_override: true,
      matches: (ctx, _text) => {
        const t =
          typeof ctx.task_type === "string"
            ? ctx.task_type.trim().toLowerCase()
            : "";
        const recommendedTypes = new Set([
          "email_salarie",
          "email_candidat",
          "document_rh",
          "compte_rendu",
          "trame_entretien",
          "synthese_manager",
          "onboarding_prep",
        ]);
        return recommendedTypes.has(t);
      },
    },
    {
      id: "sensitive_domain_warn",
      description: "Domaine sensible",
      decision: "allow_with_warning",
      risk_level: "orange",
      reason:
        "Le domaine de cette action est classé sensible. Vigilance recommandée.",
      can_override: true,
      matches: (ctx, _text) =>
        normalizeCloneGuardDomain(ctx.domain) === "sensitive_case",
    },
    {
      id: "disciplinaire_text_warn",
      description: "Contexte disciplinaire dans le texte (hors type identifié)",
      decision: "allow_with_warning",
      risk_level: "orange",
      reason:
        "Contexte disciplinaire détecté. Validation recommandée avant toute action.",
      can_override: true,
      matches: (ctx, text) => {
        const kind = normalizeCloneGuardActionKind(ctx.task_type);
        return (
          /disciplin/.test(text) &&
          kind !== "disciplinary_decision" &&
          kind !== "disciplinary_prep"
        );
      },
    },
    {
      id: "risk_hint_orange_warn",
      description: "Niveau de risque orange indiqué dans le contexte",
      decision: "allow_with_warning",
      risk_level: "orange",
      reason: "Niveau de risque modéré : validation recommandée.",
      can_override: true,
      matches: (ctx, _text) =>
        normalizePierreHrRiskLevel(ctx.risk_level_hint) === "orange",
    },
  ];
}

// ══════════════════════════════════════════════════════════
// 6. COLLECT TEXT
// ══════════════════════════════════════════════════════════

export function collectCloneGuardText(ctx: PierreCloneGuardContext): string {
  if (!ctx || typeof ctx !== "object") return "";

  const parts: string[] = [];
  if (typeof ctx.task_type === "string") parts.push(ctx.task_type);
  if (typeof ctx.task_title === "string") parts.push(ctx.task_title);
  if (typeof ctx.task_description === "string") parts.push(ctx.task_description);
  if (typeof ctx.text_corpus === "string") parts.push(ctx.text_corpus);
  if (typeof ctx.domain === "string") parts.push(ctx.domain);

  if (ctx.payload_json && typeof ctx.payload_json === "object") {
    const extractStrings = (obj: Record<string, unknown>): void => {
      for (const val of Object.values(obj)) {
        if (typeof val === "string") {
          parts.push(val);
        } else if (
          typeof val === "object" &&
          val !== null &&
          !Array.isArray(val)
        ) {
          try {
            extractStrings(val as Record<string, unknown>);
          } catch (_e) { /* skip malformed row */ }
        }
      }
    };
    try {
      extractStrings(ctx.payload_json);
    } catch (_e) { /* skip malformed row */ }
  }

  return stripDiacritics(parts.join(" ").toLowerCase());
}

// ══════════════════════════════════════════════════════════
// 7. DETECT SIGNALS
// ══════════════════════════════════════════════════════════

export function detectCloneGuardSignals(
  ctx: PierreCloneGuardContext,
  collectedText?: string,
): PierreCloneGuardSignal[] {
  if (!ctx || typeof ctx !== "object") return [];

  const text =
    typeof collectedText === "string"
      ? collectedText
      : collectCloneGuardText(ctx);
  const signals: PierreCloneGuardSignal[] = [];

  // Text-based signals
  for (const def of TEXT_SIGNAL_DEFS) {
    const match = text.match(def.pattern);
    if (match) {
      signals.push({
        code: def.code,
        label: def.label,
        level: def.level,
        source: "text_scan",
        matched_text: match[0],
      });
    }
  }

  // Task type signal
  const kind = normalizeCloneGuardActionKind(ctx.task_type);
  if (kind === "email_send") {
    signals.push({
      code: "email_send_blocked",
      label: "Envoi d'email — non auto-exécutable",
      level: "black",
      source: "task_type",
    });
  } else if (kind === "dismissal_action") {
    signals.push({
      code: "dismissal_action_black",
      label: "Action de licenciement — humain obligatoire",
      level: "black",
      source: "task_type",
    });
  } else if (kind === "disciplinary_decision") {
    signals.push({
      code: "disciplinary_decision_black",
      label: "Décision disciplinaire — humain obligatoire",
      level: "black",
      source: "task_type",
    });
  } else if (
    kind === "contract_action" ||
    kind === "disciplinary_prep" ||
    kind === "absence_action" ||
    kind === "payroll_action"
  ) {
    signals.push({
      code: `${kind}_red`,
      label: `Action ${kind.replace(/_/g, " ")} — validation requise`,
      level: "red",
      source: "task_type",
    });
  }

  // Approval required signal
  if (ctx.approval_required === true) {
    signals.push({
      code: "approval_required",
      label: "Approbation explicite requise",
      level: "red",
      source: "context",
    });
  }

  // Risk hint signal
  const riskHint = normalizePierreHrRiskLevel(ctx.risk_level_hint);
  if (riskHint === "black") {
    signals.push({
      code: "risk_hint_black",
      label: "Risque RH noir indiqué",
      level: "black",
      source: "context",
    });
  } else if (riskHint === "red") {
    signals.push({
      code: "risk_hint_red",
      label: "Risque RH rouge indiqué",
      level: "red",
      source: "context",
    });
  } else if (riskHint === "orange") {
    signals.push({
      code: "risk_hint_orange",
      label: "Risque RH orange indiqué",
      level: "orange",
      source: "context",
    });
  }

  // Domain signal
  if (normalizeCloneGuardDomain(ctx.domain) === "sensitive_case") {
    signals.push({
      code: "sensitive_domain",
      label: "Domaine sensible",
      level: "orange",
      source: "domain",
    });
  }

  return signals;
}

// ══════════════════════════════════════════════════════════
// 8. EVALUATE (main function)
// ══════════════════════════════════════════════════════════

export function evaluatePierreCloneGuard(
  ctx: PierreCloneGuardContext,
): PierreCloneGuardEvaluation {
  if (!ctx || typeof ctx !== "object") {
    return {
      decision: "allow",
      risk_level: "green",
      signals: [],
      matched_rules: [],
      allowed_to_auto_execute: true,
      requires_human: false,
      explanation: "Contexte vide — aucune restriction détectée.",
      human_note: "",
      evaluated_at: "",
    };
  }

  const collectedText = collectCloneGuardText(ctx);
  const signals = detectCloneGuardSignals(ctx, collectedText);
  const rules = getPierreCloneGuardPolicyRules();

  let worstDec: PierreCloneGuardDecision = "allow";
  const matchedRuleIds: string[] = [];
  const matchedReasons: string[] = [];

  for (const rule of rules) {
    let matched = false;
    try {
      matched = rule.matches(ctx, collectedText);
    } catch (_e) { /* skip malformed row */ }
    if (matched) {
      matchedRuleIds.push(rule.id);
      matchedReasons.push(rule.reason);
      worstDec = worstDecision(worstDec, rule.decision);
    }
  }

  // Effective risk = worst of decision-derived risk and signal-derived risk
  const signalRisk: PierreCloneGuardRiskLevel = signals.reduce(
    (acc, s) =>
      getPierreHrRiskRank(s.level) > getPierreHrRiskRank(acc) ? s.level : acc,
    "green" as PierreCloneGuardRiskLevel,
  );
  const decisionRisk = decisionToRisk(worstDec);
  const effectiveRisk = getHighestPierreHrRiskLevel(decisionRisk, signalRisk);

  // Enforce email.send always non-auto regardless of rule outcome
  const rawType =
    typeof ctx.task_type === "string" ? ctx.task_type.trim().toLowerCase() : "";
  const isEmailSend =
    rawType === "email.send" ||
    rawType === "send_email" ||
    normalizeCloneGuardActionKind(ctx.task_type) === "email_send";

  const allowed_to_auto_execute =
    worstDec === "allow" &&
    !isEmailSend &&
    ctx.approval_required !== true &&
    getPierreHrRiskRank(effectiveRisk) < getPierreHrRiskRank("red");

  const requires_human =
    worstDec === "require_approval" ||
    worstDec === "block" ||
    worstDec === "refuse";

  // Build explanation from worst matched rule
  let explanation: string;
  if (worstDec === "refuse") {
    explanation = `Action refusée par CloneGuard. ${matchedReasons[0] ?? "Risque RH critique — intervention humaine obligatoire."}`;
  } else if (worstDec === "block") {
    explanation = `Exécution automatique bloquée par CloneGuard. ${matchedReasons[0] ?? "Validation humaine requise."}`;
  } else if (worstDec === "require_approval") {
    explanation = `Validation humaine obligatoire. ${matchedReasons[0] ?? "Risque RH élevé."}`;
  } else if (worstDec === "allow_with_warning") {
    explanation = `Action autorisée avec avertissement. ${matchedReasons[0] ?? "Vigilance recommandée."}`;
  } else {
    explanation = "Aucun signal de risque détecté. Action autorisée.";
  }

  const human_note = matchedReasons.join(" | ");

  return {
    decision: worstDec,
    risk_level: effectiveRisk,
    signals,
    matched_rules: matchedRuleIds,
    allowed_to_auto_execute,
    requires_human,
    explanation,
    human_note,
    evaluated_at: typeof ctx.now === "string" ? ctx.now : "",
  };
}

// ══════════════════════════════════════════════════════════
// 9. BUILD PREVIEW
// ══════════════════════════════════════════════════════════

export function buildCloneGuardPreview(
  evaluation: PierreCloneGuardEvaluation,
): PierreCloneGuardPreview {
  if (!evaluation || typeof evaluation !== "object") {
    return {
      decision: "allow",
      risk_level: "green",
      signal_count: 0,
      top_signal: null,
      allowed_to_auto_execute: true,
      summary: "Évaluation CloneGuard non disponible.",
    };
  }

  const signals = Array.isArray(evaluation.signals) ? evaluation.signals : [];

  const topSignal =
    signals.length > 0
      ? signals.reduce((worst, s) =>
          getPierreHrRiskRank(s.level) >= getPierreHrRiskRank(worst.level)
            ? s
            : worst,
          signals[0],
        )
      : null;

  const summaryMap: Record<PierreCloneGuardDecision, string> = {
    allow: "Action autorisée par CloneGuard.",
    allow_with_warning: "Action autorisée — validation recommandée.",
    require_approval: "Validation humaine obligatoire avant exécution.",
    block: "Exécution automatique bloquée.",
    refuse: "Action refusée — intervention humaine exclusive.",
  };

  return {
    decision: evaluation.decision,
    risk_level: evaluation.risk_level,
    signal_count: signals.length,
    top_signal: topSignal,
    allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
    summary: summaryMap[evaluation.decision] ?? "Évaluation CloneGuard.",
  };
}

// ══════════════════════════════════════════════════════════
// 10. BUILD AUDIT EVENT
// ══════════════════════════════════════════════════════════

export function buildCloneGuardAuditEvent(
  evaluation: PierreCloneGuardEvaluation,
  ctx?: PierreCloneGuardContext,
): PierreCloneGuardAuditEvent {
  if (!evaluation || typeof evaluation !== "object") {
    return {
      event_type: "cloneguard_evaluation",
      message: "CloneGuard évaluation — données manquantes.",
      meta_json: {
        decision: "allow",
        risk_level: "green",
        signal_count: 0,
        signals: [],
        matched_rules: [],
        allowed_to_auto_execute: true,
      },
    };
  }

  const signals = Array.isArray(evaluation.signals) ? evaluation.signals : [];

  const eventType: PierreCloneGuardAuditEvent["event_type"] =
    evaluation.decision === "refuse" || evaluation.decision === "block"
      ? "cloneguard_execution_blocked"
      : signals.length > 0
        ? "cloneguard_signal_detected"
        : "cloneguard_evaluation";

  return {
    event_type: eventType,
    message: evaluation.explanation || "CloneGuard évaluation complète.",
    meta_json: {
      decision: evaluation.decision,
      risk_level: evaluation.risk_level,
      signal_count: signals.length,
      signals,
      matched_rules: Array.isArray(evaluation.matched_rules)
        ? evaluation.matched_rules
        : [],
      allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
      task_type: ctx?.task_type ?? null,
      domain: ctx?.domain ?? null,
    },
  };
}

// ══════════════════════════════════════════════════════════
// 11. APPLY TO TASK
// ══════════════════════════════════════════════════════════

export function applyCloneGuardToTask(
  task: Record<string, unknown>,
  evaluation: PierreCloneGuardEvaluation,
): Record<string, unknown> {
  if (
    !task ||
    typeof task !== "object" ||
    Array.isArray(task)
  ) {
    return { cloneguard: null };
  }

  const evalData =
    evaluation && typeof evaluation === "object"
      ? {
          decision: evaluation.decision,
          risk_level: evaluation.risk_level,
          allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
          requires_human: evaluation.requires_human,
          signal_count: Array.isArray(evaluation.signals)
            ? evaluation.signals.length
            : 0,
          explanation: evaluation.explanation,
        }
      : null;

  return { ...task, cloneguard: evalData };
}

// ══════════════════════════════════════════════════════════
// 12. IS AUTO EXECUTABLE (fast path)
// ══════════════════════════════════════════════════════════

export function isCloneGuardAutoExecutable(
  ctx: PierreCloneGuardContext,
): boolean {
  if (!ctx || typeof ctx !== "object") return false;

  // Fast-path hard blocks — no need for full evaluation
  const rawType =
    typeof ctx.task_type === "string" ? ctx.task_type.trim().toLowerCase() : "";
  if (rawType === "email.send" || rawType === "send_email") return false;
  if (ctx.approval_required === true) return false;

  const riskHint = normalizePierreHrRiskLevel(ctx.risk_level_hint);
  if (riskHint === "red" || riskHint === "black") return false;

  const kind = normalizeCloneGuardActionKind(ctx.task_type);
  const nonAutoKinds = new Set<PierreCloneGuardActionKind>([
    "email_send",
    "contract_action",
    "disciplinary_prep",
    "disciplinary_decision",
    "dismissal_action",
    "payroll_action",
    "absence_action",
  ]);
  if (nonAutoKinds.has(kind)) return false;

  return evaluatePierreCloneGuard(ctx).allowed_to_auto_execute;
}

// ══════════════════════════════════════════════════════════
// 13. SUMMARIZE
// ══════════════════════════════════════════════════════════

export function summarizeCloneGuardEvaluation(
  evaluation: PierreCloneGuardEvaluation,
): string {
  if (!evaluation || typeof evaluation !== "object") {
    return "Évaluation CloneGuard non disponible.";
  }

  const decisionLabels: Record<PierreCloneGuardDecision, string> = {
    allow: "Autorisé",
    allow_with_warning: "Autorisé (avec avertissement)",
    require_approval: "Validation obligatoire",
    block: "Bloqué",
    refuse: "Refusé",
  };

  const riskLabels: Record<PierreCloneGuardRiskLevel, string> = {
    green: "Vert (faible risque)",
    orange: "Orange (risque modéré)",
    red: "Rouge (risque élevé)",
    black: "Noir (risque critique)",
  };

  const lines: string[] = [
    `Décision CloneGuard : ${decisionLabels[evaluation.decision] ?? evaluation.decision}`,
    `Niveau de risque : ${riskLabels[evaluation.risk_level] ?? evaluation.risk_level}`,
  ];

  const signals = Array.isArray(evaluation.signals) ? evaluation.signals : [];

  if (signals.length > 0) {
    const blackSignals = signals.filter((s) => s.level === "black");
    const redSignals = signals.filter((s) => s.level === "red");
    if (blackSignals.length > 0) {
      lines.push(
        `Signaux critiques : ${blackSignals.map((s) => s.label).join(", ")}`,
      );
    }
    if (redSignals.length > 0) {
      lines.push(
        `Signaux élevés : ${redSignals.map((s) => s.label).join(", ")}`,
      );
    }
  }

  if (!evaluation.allowed_to_auto_execute) {
    lines.push("Auto-exécution : non autorisée");
  }

  if (evaluation.human_note) {
    lines.push(`Note RH : ${evaluation.human_note}`);
  }

  return lines.join(" | ");
}
