// src/lib/pierre/hr/trial-activation.ts
// Bloc 23 — Pierre Trial Activation & First-Value Engine
// Module pur : pas de Supabase, pas de Next, pas d'async, pas d'effets de bord.
// Robuste face aux objets null/undefined/malformés.

// ── Helpers internes ────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function asStr(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "true" || v === "1") return true;
  if (v === 0 || v === "false" || v === "0") return false;
  return null;
}

function safeRows(v: unknown): Record<string, unknown>[] {
  if (!isArray(v)) return [];
  return v.filter(isObject);
}

function safeField(row: Record<string, unknown>, field: string): unknown {
  try { return row[field]; } catch { return undefined; }
}

function rowStatus(row: Record<string, unknown>): string | null {
  return asStr(safeField(row, "status"));
}

function rowType(row: Record<string, unknown>): string | null {
  return asStr(safeField(row, "type"));
}

function rowFamily(row: Record<string, unknown>): string | null {
  return asStr(safeField(row, "family")) ?? asStr(safeField(row, "doc_family"));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Constantes ──────────────────────────────────────────────────────────────

const SEND_TASK_TYPES = new Set(["email.send", "send_email"]);

const PREMIUM_DOC_FAMILIES = new Set([
  "contract", "amendment", "offer", "convocation", "refusal", "followup",
  "onboarding", "absence", "pre_payroll", "performance", "training",
  "offboarding", "employee_summary", "internal_note", "generic_hr",
]);

const TERMINAL_STATUSES = new Set(["done", "completed", "archived"]);
const APPROVAL_STATUSES = new Set(["pending_approval", "awaiting_validation", "blocked"]);
const ERROR_STATUSES = new Set(["error", "failed", "cancelled"]);

// ── Types exportés ──────────────────────────────────────────────────────────

export type PierreTrialActivationStage =
  | "not_started"
  | "setup_needed"
  | "ready_to_launch"
  | "first_value_started"
  | "value_proven"
  | "conversion_ready"
  | "blocked";

export type PierreTrialActivationStatus =
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "black";

export type PierreTrialDayKey =
  | "day_0_setup"
  | "day_1_first_mission"
  | "day_2_employee_files"
  | "day_3_documents"
  | "day_4_continuity"
  | "day_5_sensitive_control"
  | "day_6_value_review"
  | "day_7_conversion";

export type PierreTrialMissionTemplateKey =
  | "audit_rh_initial"
  | "create_employee_file"
  | "generate_contract_or_document"
  | "absence_followup"
  | "onboarding_plan"
  | "prepay_summary"
  | "employee_file_review"
  | "sensitive_case_review"
  | "offboarding_plan"
  | "hr_weekly_briefing";

export type PierreTrialProofType =
  | "mission_created"
  | "task_completed"
  | "document_generated"
  | "pdf_generated"
  | "employee_file_created"
  | "risk_controlled"
  | "approval_required"
  | "continuity_recovered"
  | "readiness_passed"
  | "release_gate_passed"
  | "time_saved_estimated";

export type PierreTrialActivationBlockerType =
  | "missing_company_memory"
  | "missing_employees"
  | "missing_templates"
  | "missing_documents"
  | "no_missions"
  | "no_completed_tasks"
  | "no_traceability"
  | "schema_risk"
  | "safety_risk"
  | "sensitive_case_uncontrolled"
  | "low_value_proof"
  | "configuration_incomplete";

export type PierreTrialMissionTemplate = {
  key: PierreTrialMissionTemplateKey;
  title: string;
  description: string;
  business_value: string;
  suggested_prompt: string;
  expected_outputs: string[];
  required_inputs: string[];
  risk_level: "low" | "medium" | "high" | "critical";
  requires_human_validation: boolean;
  recommended_day: PierreTrialDayKey;
};

export type PierreTrialActivationProof = {
  type: PierreTrialProofType;
  label: string;
  source_type: "mission" | "task" | "document" | "employee_file" | "readiness" | "release" | "system";
  source_id: string | null;
  value_score: number;
};

export type PierreTrialActivationBlocker = {
  type: PierreTrialActivationBlockerType;
  label: string;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
  recommended_fix: string;
};

export type PierreTrialDayPlan = {
  day: PierreTrialDayKey;
  label: string;
  objective: string;
  recommended_missions: PierreTrialMissionTemplateKey[];
  expected_proofs: PierreTrialProofType[];
  success_criteria: string[];
  status: "not_started" | "available" | "in_progress" | "done" | "blocked";
  blockers: PierreTrialActivationBlocker[];
};

export type PierreTrialActivationMetrics = {
  missions_total: number;
  completed_tasks: number;
  documents_generated: number;
  premium_documents: number;
  pdf_documents: number;
  employees_configured: number;
  employee_files_ready: number;
  logs_total: number;
  approval_pending: number;
  blocked_tasks: number;
  error_tasks: number;
  release_score: number | null;
  readiness_score: number | null;
};

export type PierreTrialValueScore = {
  score: number;
  label: string;
  estimated_hours_saved_low: number;
  estimated_hours_saved_high: number;
  estimated_value_eur_low: number;
  estimated_value_eur_high: number;
  confidence: "low" | "medium" | "high";
  explanation: string;
};

export type PierreTrialConversionScore = {
  score: number;
  label: string;
  probability_band: "low" | "medium" | "high" | "very_high";
  reasons: string[];
};

export type PierreTrialActivationDigest = {
  tone: "setup" | "action" | "value" | "blocked" | "conversion";
  text: string;
};

export type PierreTrialActivationNextAction = {
  type:
    | "complete_setup"
    | "add_employees"
    | "configure_templates"
    | "launch_first_mission"
    | "generate_document"
    | "review_employee_file"
    | "resolve_blocker"
    | "run_release_proof"
    | "prepare_conversion"
    | "no_action";
  label: string;
  priority: "low" | "normal" | "high" | "urgent";
  mission_template_key?: PierreTrialMissionTemplateKey;
  blocker_type?: PierreTrialActivationBlockerType;
};

export type PierreTrialActivationReport = {
  generated_at: string;
  stage: PierreTrialActivationStage;
  status: PierreTrialActivationStatus;
  activation_score: number;
  metrics: PierreTrialActivationMetrics;
  value_score: PierreTrialValueScore;
  conversion_score: PierreTrialConversionScore;
  proofs: PierreTrialActivationProof[];
  blockers: PierreTrialActivationBlocker[];
  day_plan: PierreTrialDayPlan[];
  recommended_missions: PierreTrialMissionTemplate[];
  next_actions: PierreTrialActivationNextAction[];
  digest: PierreTrialActivationDigest;
};

export type PierreTrialActivationParams = {
  companyMemory?: Record<string, unknown> | null;
  missions?: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
  documents?: Record<string, unknown>[];
  logs?: Record<string, unknown>[];
  employees?: Record<string, unknown>[];
  employeeFiles?: unknown[];
  readinessReport?: unknown;
  releaseReport?: unknown;
  now?: Date;
};

// ── Templates de premières missions ────────────────────────────────────────

export function buildPierreTrialMissionTemplates(): PierreTrialMissionTemplate[] {
  return [
    {
      key: "audit_rh_initial",
      title: "Audit RH initial de l'entreprise",
      description:
        "Première mission RH de mise en place : analyse rapide de la situation RH actuelle, "
        + "identification des urgences, des dossiers à créer, des documents manquants, "
        + "et des risques à traiter en priorité.",
      business_value:
        "Permet d'avoir une vue d'ensemble de la situation RH en moins de 30 minutes. "
        + "Remplace 2 à 4 heures de travail manuel de collecte et de synthèse.",
      suggested_prompt:
        "Fais un audit RH complet de notre entreprise. "
        + "Dresse la liste de nos salariés actifs, identifie les dossiers incomplets, "
        + "les documents manquants, les contrats à renouveler ou à mettre à jour, "
        + "et les risques RH à traiter en priorité ce mois-ci. "
        + "Produis un rapport structuré avec les actions recommandées.",
      expected_outputs: [
        "Rapport d'audit RH structuré",
        "Liste des dossiers salariés à créer ou compléter",
        "Risques RH identifiés et priorisés",
        "Plan d'actions recommandé",
      ],
      required_inputs: ["Liste des salariés ou effectif approximatif"],
      risk_level: "low",
      requires_human_validation: false,
      recommended_day: "day_1_first_mission",
    },
    {
      key: "create_employee_file",
      title: "Création d'un dossier salarié 360°",
      description:
        "Création et initialisation d'un dossier salarié complet : informations personnelles, "
        + "contrat, historique RH, absences, formations, et suivi des actions.",
      business_value:
        "Centralise toutes les informations d'un salarié en un dossier structuré. "
        + "Économise 1 à 2 heures par dossier créé manuellement.",
      suggested_prompt:
        "Crée le dossier salarié complet pour [Prénom Nom], "
        + "[poste] chez nous depuis le [date d'entrée]. "
        + "Initialise son profil avec les informations disponibles, "
        + "liste les documents à compléter, et propose les prochaines actions RH.",
      expected_outputs: [
        "Dossier salarié 360° initialisé",
        "Liste des documents manquants",
        "Prochaines actions RH recommandées",
      ],
      required_inputs: ["Nom, prénom, poste, date d'entrée du salarié"],
      risk_level: "low",
      requires_human_validation: false,
      recommended_day: "day_2_employee_files",
    },
    {
      key: "generate_contract_or_document",
      title: "Génération d'un contrat ou document RH premium",
      description:
        "Génération d'un document contractuel via le moteur premium : contrat de travail, "
        + "avenant, lettre d'offre, ou tout document RH officiel. "
        + "Rendu HTML + export PDF. Validation humaine avant envoi.",
      business_value:
        "Produit un document contractuel conforme en quelques minutes. "
        + "Économise 1 à 3 heures de rédaction. Réduit le risque d'erreur juridique.",
      suggested_prompt:
        "Génère un [type de contrat : CDI / CDD / avenant / lettre d'offre] "
        + "pour [Prénom Nom], [poste], [salaire] brut annuel. "
        + "Utilise nos templates premium, produis le document en PDF, "
        + "et mets-le en attente de validation avant tout envoi.",
      expected_outputs: [
        "Document généré en HTML premium",
        "Export PDF du document",
        "Document en attente de validation humaine",
        "Audit trace de la génération",
      ],
      required_inputs: ["Type de contrat, nom salarié, poste, salaire"],
      risk_level: "high",
      requires_human_validation: true,
      recommended_day: "day_3_documents",
    },
    {
      key: "absence_followup",
      title: "Suivi et gestion d'une absence salarié",
      description:
        "Prise en charge complète d'une absence : enregistrement, vérification du justificatif, "
        + "impact sur la paie, relance si nécessaire. Aucun email envoyé sans validation.",
      business_value:
        "Traite une absence en moins de 10 minutes au lieu d'une demi-heure. "
        + "Réduit les oublis de relance et les erreurs de calcul pré-paie.",
      suggested_prompt:
        "Gère l'absence de [Prénom Nom] depuis le [date]. "
        + "Enregistre l'absence dans son dossier, prépare un brouillon de relance si pas de justificatif, "
        + "calcule l'impact pré-paie, et mets à jour le dossier RH.",
      expected_outputs: [
        "Absence enregistrée dans le dossier salarié",
        "Brouillon de relance justificatif (pas d'envoi automatique)",
        "Impact pré-paie calculé",
        "Tâche de suivi créée",
      ],
      required_inputs: ["Nom salarié, date de début d'absence, type d'absence"],
      risk_level: "low",
      requires_human_validation: false,
      recommended_day: "day_2_employee_files",
    },
    {
      key: "onboarding_plan",
      title: "Plan d'onboarding pour une nouvelle recrue",
      description:
        "Création d'un plan d'onboarding complet pour un nouveau salarié : "
        + "checklist administrative, accès informatiques, formation initiale, "
        + "documents à signer, et suivi premier mois.",
      business_value:
        "Structure l'onboarding dès le premier jour. "
        + "Réduit le temps de mise en route de 20 à 30%. "
        + "Améliore l'expérience salarié.",
      suggested_prompt:
        "Crée le plan d'onboarding complet pour [Prénom Nom], "
        + "[poste], qui arrive le [date de début]. "
        + "Génère la checklist administrative, les documents à signer, "
        + "les accès à demander, le planning de formation initiale, "
        + "et les jalons du premier mois.",
      expected_outputs: [
        "Plan d'onboarding structuré avec jalons",
        "Checklist administrative complète",
        "Liste des documents à signer",
        "Planning premier mois",
      ],
      required_inputs: ["Nom, poste, date d'arrivée de la nouvelle recrue"],
      risk_level: "medium",
      requires_human_validation: true,
      recommended_day: "day_1_first_mission",
    },
    {
      key: "prepay_summary",
      title: "Synthèse éléments variables de paie",
      description:
        "Collecte et synthèse des éléments variables de paie du mois : "
        + "absences, heures supplémentaires, primes, anomalies. "
        + "Rapport structuré pour le service paie ou le comptable.",
      business_value:
        "Prépare les éléments de paie en 20 minutes au lieu de 2 heures. "
        + "Réduit les erreurs de transmission au service paie.",
      suggested_prompt:
        "Prépare les éléments variables de paie pour le mois en cours. "
        + "Synthétise les absences, heures supplémentaires déclarées, primes, "
        + "anomalies détectées, et liste les salariés avec données manquantes. "
        + "Génère un rapport structuré pour notre comptable.",
      expected_outputs: [
        "Rapport pré-paie mensuel structuré",
        "Liste des anomalies détectées",
        "Liste salariés avec données manquantes",
        "Document synthèse exportable en PDF",
      ],
      required_inputs: ["Mois concerné, liste des salariés"],
      risk_level: "medium",
      requires_human_validation: true,
      recommended_day: "day_6_value_review",
    },
    {
      key: "employee_file_review",
      title: "Revue complète d'un dossier salarié",
      description:
        "Analyse approfondie d'un dossier salarié : état de santé du dossier, "
        + "informations manquantes, risques identifiés, prochaines actions recommandées.",
      business_value:
        "Identifie en quelques minutes les lacunes d'un dossier salarié. "
        + "Prévient les problèmes juridiques liés à des dossiers incomplets.",
      suggested_prompt:
        "Fais une revue complète du dossier de [Prénom Nom]. "
        + "Analyse sa situation actuelle, identifie les informations manquantes, "
        + "les risques détectés, et propose les prochaines actions RH prioritaires.",
      expected_outputs: [
        "Rapport de santé du dossier salarié",
        "Liste des informations manquantes",
        "Risques identifiés et priorisés",
        "Plan d'actions recommandé",
      ],
      required_inputs: ["Nom du salarié dont revoir le dossier"],
      risk_level: "low",
      requires_human_validation: false,
      recommended_day: "day_2_employee_files",
    },
    {
      key: "sensitive_case_review",
      title: "Revue d'un cas RH sensible",
      description:
        "Préparation et gestion d'un cas RH à risque : disciplinaire, licenciement, "
        + "harcèlement, ou conflit. Aucune action automatique. "
        + "Validation humaine obligatoire pour chaque document.",
      business_value:
        "Structure la gestion des cas sensibles avec traçabilité complète. "
        + "Réduit le risque juridique. Chaque action nécessite une validation humaine explicite.",
      suggested_prompt:
        "Prépare le dossier pour le cas suivant : [description du cas, sans données personnelles sensibles]. "
        + "Génère la chronologie des faits, les documents nécessaires, "
        + "la liste des obligations légales de l'employeur. "
        + "Ne rien envoyer, ne rien exécuter sans ma validation humaine explicite. "
        + "Tous les documents doivent être en attente de validation.",
      expected_outputs: [
        "Dossier structuré avec chronologie",
        "Documents en attente de validation humaine",
        "Checklist obligations légales",
        "Audit trail complet de chaque action",
      ],
      required_inputs: ["Description du cas (sans données personnelles sensibles)"],
      risk_level: "critical",
      requires_human_validation: true,
      recommended_day: "day_5_sensitive_control",
    },
    {
      key: "offboarding_plan",
      title: "Plan de départ salarié — Offboarding",
      description:
        "Gestion complète d'un départ : procédure administrative, documents de fin de contrat, "
        + "checklist matériel et accès, solde de tout compte, archivage du dossier.",
      business_value:
        "Sécurise le départ d'un salarié avec toutes les obligations légales. "
        + "Réduit le risque de litige. Économise 2 à 4 heures de coordination.",
      suggested_prompt:
        "Lance la procédure d'offboarding pour [Prénom Nom] "
        + "dont le départ est prévu le [date]. "
        + "Prépare le solde de tout compte, l'attestation Pôle Emploi, "
        + "la checklist matériel informatique à récupérer, les accès à révoquer, "
        + "et l'archivage du dossier RH. "
        + "Tous les documents légaux doivent être en attente de validation humaine.",
      expected_outputs: [
        "Procédure d'offboarding structurée",
        "Documents légaux en attente de validation",
        "Checklist matériel et accès",
        "Dossier archivé avec timeline",
      ],
      required_inputs: ["Nom salarié, date de départ, motif de départ"],
      risk_level: "high",
      requires_human_validation: true,
      recommended_day: "day_4_continuity",
    },
    {
      key: "hr_weekly_briefing",
      title: "Briefing RH hebdomadaire",
      description:
        "Synthèse hebdomadaire de l'activité RH : tâches en cours, alertes, "
        + "dossiers à traiter, prochaines échéances, et recommandations de la semaine.",
      business_value:
        "Donne une vue complète de l'activité RH en 5 minutes. "
        + "Priorise les actions de la semaine. Remplace 45 minutes de revue manuelle.",
      suggested_prompt:
        "Génère le briefing RH de la semaine. "
        + "Synthétise les missions en cours, les tâches en attente, "
        + "les alertes actives, les prochaines échéances importantes, "
        + "et les actions prioritaires pour cette semaine.",
      expected_outputs: [
        "Briefing RH hebdomadaire structuré",
        "Liste des alertes actives",
        "Prochaines échéances avec priorités",
        "Actions recommandées de la semaine",
      ],
      required_inputs: ["Aucune entrée spécifique requise"],
      risk_level: "low",
      requires_human_validation: false,
      recommended_day: "day_6_value_review",
    },
  ];
}

// ── Extraction de scores depuis les rapports externes ───────────────────────

function extractReleaseScore(releaseReport: unknown): number | null {
  if (!isObject(releaseReport)) return null;
  const direct = asNum(safeField(releaseReport, "global_score"));
  if (direct !== null) return direct;
  const nested = isObject(safeField(releaseReport, "report"))
    ? (safeField(releaseReport, "report") as Record<string, unknown>)
    : null;
  if (nested) return asNum(safeField(nested, "global_score"));
  return null;
}

function extractReadinessScore(readinessReport: unknown): number | null {
  if (!isObject(readinessReport)) return null;
  const direct =
    asNum(safeField(readinessReport, "global_score")) ??
    asNum(safeField(readinessReport, "score"));
  if (direct !== null) return direct;
  const nested = isObject(safeField(readinessReport, "report"))
    ? (safeField(readinessReport, "report") as Record<string, unknown>)
    : null;
  if (nested) {
    return (
      asNum(safeField(nested, "global_score")) ??
      asNum(safeField(nested, "score")) ??
      null
    );
  }
  return null;
}

// ── Métriques ────────────────────────────────────────────────────────────────

export function computePierreTrialMetrics(
  params: PierreTrialActivationParams,
): PierreTrialActivationMetrics {
  const missions = safeRows(params.missions);
  const tasks = safeRows(params.tasks);
  const documents = safeRows(params.documents);
  const logs = safeRows(params.logs);
  const employees = safeRows(params.employees);
  const employeeFiles = (params.employeeFiles ?? []).filter(isObject);

  const completedTasks = tasks.filter((t) => TERMINAL_STATUSES.has(rowStatus(t) ?? ""));
  const premiumDocs = documents.filter((d) => PREMIUM_DOC_FAMILIES.has(rowFamily(d) ?? ""));
  const pdfDocs = documents.filter((d) => {
    return (
      asBool(safeField(d, "has_pdf")) === true ||
      asStr(safeField(d, "pdf_url")) !== null ||
      asStr(safeField(d, "pdf_path")) !== null
    );
  });
  const approvalPending = tasks.filter((t) => APPROVAL_STATUSES.has(rowStatus(t) ?? ""));
  const blockedTasks = tasks.filter((t) => rowStatus(t) === "blocked");
  const errorTasks = tasks.filter((t) => ERROR_STATUSES.has(rowStatus(t) ?? ""));

  return {
    missions_total: missions.length,
    completed_tasks: completedTasks.length,
    documents_generated: documents.length,
    premium_documents: premiumDocs.length,
    pdf_documents: pdfDocs.length,
    employees_configured: employees.length,
    employee_files_ready: employeeFiles.length,
    logs_total: logs.length,
    approval_pending: approvalPending.length,
    blocked_tasks: blockedTasks.length,
    error_tasks: errorTasks.length,
    release_score: extractReleaseScore(params.releaseReport),
    readiness_score: extractReadinessScore(params.readinessReport),
  };
}

// ── Preuves de valeur ────────────────────────────────────────────────────────

export function detectPierreTrialProofs(
  params: PierreTrialActivationParams,
): PierreTrialActivationProof[] {
  const proofs: PierreTrialActivationProof[] = [];
  const missions = safeRows(params.missions);
  const tasks = safeRows(params.tasks);
  const documents = safeRows(params.documents);
  const employees = safeRows(params.employees);
  const employeeFiles = (params.employeeFiles ?? []).filter(isObject);
  const logs = safeRows(params.logs);

  // Missions créées
  if (missions.length > 0) {
    proofs.push({
      type: "mission_created",
      label: `${missions.length} mission(s) RH créée(s)`,
      source_type: "mission",
      source_id: null,
      value_score: clamp(missions.length * 8, 0, 60),
    });
  }

  // Tâches terminées
  const completedTasks = tasks.filter((t) => TERMINAL_STATUSES.has(rowStatus(t) ?? ""));
  if (completedTasks.length > 0) {
    proofs.push({
      type: "task_completed",
      label: `${completedTasks.length} tâche(s) exécutée(s) avec succès`,
      source_type: "task",
      source_id: null,
      value_score: clamp(completedTasks.length * 6, 0, 70),
    });
  }

  // Documents générés
  if (documents.length > 0) {
    proofs.push({
      type: "document_generated",
      label: `${documents.length} document(s) RH généré(s)`,
      source_type: "document",
      source_id: null,
      value_score: clamp(documents.length * 7, 0, 65),
    });
  }

  // PDFs générés
  const pdfDocs = documents.filter((d) => {
    return (
      asBool(safeField(d, "has_pdf")) === true ||
      asStr(safeField(d, "pdf_url")) !== null ||
      asStr(safeField(d, "pdf_path")) !== null
    );
  });
  if (pdfDocs.length > 0) {
    proofs.push({
      type: "pdf_generated",
      label: `${pdfDocs.length} document(s) PDF généré(s)`,
      source_type: "document",
      source_id: null,
      value_score: clamp(pdfDocs.length * 10, 0, 70),
    });
  }

  // Dossiers salariés créés
  if (employeeFiles.length > 0) {
    proofs.push({
      type: "employee_file_created",
      label: `${employeeFiles.length} dossier(s) salarié 360° construit(s)`,
      source_type: "employee_file",
      source_id: null,
      value_score: clamp(employeeFiles.length * 8, 0, 60),
    });
  } else if (employees.length > 0) {
    proofs.push({
      type: "employee_file_created",
      label: `${employees.length} salarié(s) configuré(s)`,
      source_type: "employee_file",
      source_id: null,
      value_score: clamp(employees.length * 5, 0, 40),
    });
  }

  // Risque maîtrisé (tâches approval_required)
  const approvalTasks = tasks.filter((t) => asBool(safeField(t, "approval_required")) === true);
  if (approvalTasks.length > 0) {
    proofs.push({
      type: "risk_controlled",
      label: `${approvalTasks.length} tâche(s) sensible(s) sous validation humaine`,
      source_type: "task",
      source_id: null,
      value_score: clamp(approvalTasks.length * 12, 0, 80),
    });
    proofs.push({
      type: "approval_required",
      label: `Circuit de validation humaine actif (${approvalTasks.length} tâche(s))`,
      source_type: "task",
      source_id: null,
      value_score: 75,
    });
  }

  // Continuité récupérée (logs de continuité)
  const continuityLogs = logs.filter((l) => {
    const et = asStr(safeField(l, "event_type")) ?? "";
    return et.includes("continuity") || et.includes("recovery") || et.includes("resume");
  });
  if (continuityLogs.length > 0) {
    proofs.push({
      type: "continuity_recovered",
      label: `${continuityLogs.length} event(s) de continuité/reprise enregistrés`,
      source_type: "system",
      source_id: null,
      value_score: clamp(continuityLogs.length * 10, 0, 60),
    });
  }

  // Readiness passée
  const readinessScore = extractReadinessScore(params.readinessReport);
  if (readinessScore !== null && readinessScore >= 50) {
    proofs.push({
      type: "readiness_passed",
      label: `Certification opérationnelle validée — score ${readinessScore}/100`,
      source_type: "readiness",
      source_id: null,
      value_score: clamp(readinessScore, 0, 100),
    });
  }

  // Release gate passé
  const releaseScore = extractReleaseScore(params.releaseReport);
  if (releaseScore !== null && releaseScore >= 50) {
    proofs.push({
      type: "release_gate_passed",
      label: `Release proof validé — score ${releaseScore}/100`,
      source_type: "release",
      source_id: null,
      value_score: clamp(releaseScore, 0, 100),
    });
  }

  // Estimation temps gagné (si données suffisantes)
  const hoursEstimate =
    completedTasks.length * 1.5 +
    documents.filter((d) => PREMIUM_DOC_FAMILIES.has(rowFamily(d) ?? "")).length * 1.0 +
    employeeFiles.length * 0.5;

  if (hoursEstimate > 0) {
    proofs.push({
      type: "time_saved_estimated",
      label: `Économie estimée : ${Math.round(hoursEstimate)}–${Math.round(hoursEstimate * 1.5)} heures`,
      source_type: "system",
      source_id: null,
      value_score: clamp(Math.round(hoursEstimate * 5), 0, 100),
    });
  }

  return proofs;
}

// ── Détection des blockers ───────────────────────────────────────────────────

export function detectPierreTrialBlockers(
  params: PierreTrialActivationParams,
): PierreTrialActivationBlocker[] {
  const blockers: PierreTrialActivationBlocker[] = [];
  const missions = safeRows(params.missions);
  const tasks = safeRows(params.tasks);
  const documents = safeRows(params.documents);
  const logs = safeRows(params.logs);
  const employees = safeRows(params.employees);
  const employeeFiles = (params.employeeFiles ?? []).filter(isObject);
  const companyMemory = params.companyMemory;

  // missing_company_memory
  if (!isObject(companyMemory)) {
    blockers.push({
      type: "missing_company_memory",
      label: "Mémoire entreprise manquante",
      reason: "Aucune configuration d'entreprise trouvée dans pierre_company_memory.",
      severity: "high",
      recommended_fix: "Compléter l'Empreinte Entreprise dans les paramètres Pierre.",
    });
  } else {
    const rrh = isObject(safeField(companyMemory, "reusable_rh_context_json"))
      ? (safeField(companyMemory, "reusable_rh_context_json") as Record<string, unknown>)
      : null;

    if (!rrh) {
      blockers.push({
        type: "configuration_incomplete",
        label: "Configuration RH incomplète",
        reason: "reusable_rh_context_json absent de la mémoire entreprise.",
        severity: "high",
        recommended_fix: "Remplir la section contexte RH réutilisable dans les paramètres Pierre.",
      });
    } else {
      // missing_employees
      const memEmployees = safeRows(safeField(rrh, "employees"));
      if (memEmployees.length === 0 && employees.length === 0) {
        blockers.push({
          type: "missing_employees",
          label: "Aucun salarié configuré",
          reason: "Aucun salarié trouvé dans pierre_company_memory.reusable_rh_context_json.employees.",
          severity: "medium",
          recommended_fix: "Ajouter au moins un salarié via l'interface Pierre.",
        });
      }

      // missing_templates (document_system absent)
      const docSystem = safeField(rrh, "document_system");
      if (!isObject(docSystem)) {
        blockers.push({
          type: "missing_templates",
          label: "Système documentaire non configuré",
          reason: "Aucune configuration de templates dans reusable_rh_context_json.document_system.",
          severity: "medium",
          recommended_fix: "Configurer le système documentaire dans les paramètres Pierre.",
        });
      }
    }
  }

  // no_missions
  if (missions.length === 0) {
    blockers.push({
      type: "no_missions",
      label: "Aucune mission RH lancée",
      reason: "Pierre n'a traité aucune mission RH — la valeur n'a pas encore été démontrée.",
      severity: "high",
      recommended_fix: "Lancer la première mission RH via le template 'Audit RH initial'.",
    });
  }

  // no_completed_tasks
  const completedTasks = tasks.filter((t) => TERMINAL_STATUSES.has(rowStatus(t) ?? ""));
  if (tasks.length > 0 && completedTasks.length === 0) {
    blockers.push({
      type: "no_completed_tasks",
      label: "Aucune tâche complétée",
      reason: `${tasks.length} tâche(s) en cours mais aucune terminée — la preuve de valeur est partielle.`,
      severity: "medium",
      recommended_fix: "Compléter les tâches en attente ou débloquer les tâches suspendues.",
    });
  } else if (tasks.length === 0) {
    blockers.push({
      type: "no_completed_tasks",
      label: "Aucune tâche trouvée",
      reason: "Aucune tâche RH créée — la preuve de valeur est impossible.",
      severity: "medium",
      recommended_fix: "Lancer une mission pour générer les premières tâches.",
    });
  }

  // no_traceability
  if (logs.length === 0 && missions.length > 0) {
    blockers.push({
      type: "no_traceability",
      label: "Audit trail absent",
      reason: "Aucun log de traçabilité malgré des missions actives.",
      severity: "medium",
      recommended_fix: "Vérifier la configuration de la traçabilité dans les paramètres Pierre.",
    });
  }

  // missing_documents
  if (documents.length === 0 && completedTasks.length >= 3) {
    blockers.push({
      type: "missing_documents",
      label: "Aucun document généré",
      reason: "Des tâches ont été complétées mais aucun document RH n'a été généré.",
      severity: "low",
      recommended_fix: "Lancer une mission de génération de document (contrat, rapport, etc.).",
    });
  }

  // schema_risk : scheduled_for présent dans les tâches
  const tasksWithScheduledFor = tasks.filter((t) => {
    const sf = safeField(t, "scheduled_for");
    return sf !== undefined && sf !== null;
  });
  if (tasksWithScheduledFor.length > 0) {
    blockers.push({
      type: "schema_risk",
      label: "Risque schéma DB critique",
      reason: `${tasksWithScheduledFor.length} tâche(s) utilisent 'scheduled_for' au lieu de 'execute_at' — invariant DB violé.`,
      severity: "critical",
      recommended_fix: "Corriger immédiatement : utiliser 'execute_at' et non 'scheduled_for' dans pierre_tasks.",
    });
  }

  // schema_risk : logs avec ancien schéma level/event/payload
  const logsWithWrongSchema = logs.filter((l) => {
    const hasLevel = safeField(l, "level") !== undefined && safeField(l, "level") !== null;
    const hasEvent = safeField(l, "event") !== undefined && safeField(l, "event") !== null;
    const hasPayload = safeField(l, "payload") !== undefined && safeField(l, "payload") !== null;
    return hasLevel || hasEvent || hasPayload;
  });
  if (logsWithWrongSchema.length > 0) {
    blockers.push({
      type: "schema_risk",
      label: "Risque schéma logs critique",
      reason: `${logsWithWrongSchema.length} log(s) utilisent level/event/payload au lieu de event_type/message/meta_json.`,
      severity: "critical",
      recommended_fix: "Corriger le schéma pierre_task_logs : utiliser event_type, message, meta_json.",
    });
  }

  // safety_risk : email.send/send_email auto-exécuté sans approval
  const autoSendTasks = tasks.filter((t) => {
    const type = rowType(t) ?? "";
    return (
      SEND_TASK_TYPES.has(type) &&
      TERMINAL_STATUSES.has(rowStatus(t) ?? "") &&
      asBool(safeField(t, "approval_required")) !== true
    );
  });
  if (autoSendTasks.length > 0) {
    blockers.push({
      type: "safety_risk",
      label: "Violation de sécurité critique : email auto-exécuté",
      reason: `${autoSendTasks.length} tâche(s) email.send/send_email ont été exécutées sans validation humaine.`,
      severity: "critical",
      recommended_fix: "Ne jamais auto-exécuter des tâches email. Configurer approval_required=true pour tout envoi.",
    });
  }

  // sensitive_case_uncontrolled
  const sensitiveDocs = documents.filter((d) => {
    const family = rowFamily(d) ?? "";
    return (
      family === "contract" ||
      family === "convocation" ||
      family === "refusal" ||
      family === "amendment"
    );
  });
  const uncontrolledSensitiveDocs = sensitiveDocs.filter((d) => {
    const status = rowStatus(d);
    const approvalRequired = asBool(safeField(d, "approval_required"));
    return TERMINAL_STATUSES.has(status ?? "") && approvalRequired !== true;
  });
  if (uncontrolledSensitiveDocs.length > 0) {
    blockers.push({
      type: "sensitive_case_uncontrolled",
      label: "Document sensible sans validation humaine",
      reason: `${uncontrolledSensitiveDocs.length} document(s) sensible(s) (contrat/convocation) complétés sans approval_required.`,
      severity: "high",
      recommended_fix: "S'assurer que tous les documents contractuels passent par le circuit de validation.",
    });
  }

  // low_value_proof
  const highValueProofs = detectPierreTrialProofs(params).filter((p) => p.value_score >= 40);
  if (
    missions.length > 0 &&
    highValueProofs.length < 2 &&
    completedTasks.length < 2 &&
    documents.length < 2
  ) {
    blockers.push({
      type: "low_value_proof",
      label: "Preuve de valeur insuffisante",
      reason: "Peu de preuves de valeur générées pour justifier la conversion.",
      severity: "medium",
      recommended_fix: "Compléter plusieurs missions et générer des documents premium pour démontrer la valeur.",
    });
  }

  return blockers;
}

// ── Plan 7 jours ─────────────────────────────────────────────────────────────

export function buildPierreTrialDayPlan(
  params: PierreTrialActivationParams,
): PierreTrialDayPlan[] {
  const blockers = detectPierreTrialBlockers(params);
  const missions = safeRows(params.missions);
  const tasks = safeRows(params.tasks);
  const documents = safeRows(params.documents);
  const employees = safeRows(params.employees);
  const employeeFiles = (params.employeeFiles ?? []).filter(isObject);
  const companyMemory = params.companyMemory;

  const hasCompanyMemory = isObject(companyMemory);
  const hasEmployees = employees.length > 0;
  const hasMissions = missions.length > 0;
  const completedTasks = tasks.filter((t) => TERMINAL_STATUSES.has(rowStatus(t) ?? ""));
  const hasDocs = documents.length > 0;
  const premiumDocs = documents.filter((d) => PREMIUM_DOC_FAMILIES.has(rowFamily(d) ?? ""));
  const approvalTasks = tasks.filter((t) => asBool(safeField(t, "approval_required")) === true);
  const hasPdf = documents.some((d) => asBool(safeField(d, "has_pdf")) === true);
  const releaseScore = extractReleaseScore(params.releaseReport);
  const readinessScore = extractReadinessScore(params.readinessReport);

  const setupDone = hasCompanyMemory && hasEmployees;
  const firstMissionDone = hasMissions && completedTasks.length >= 1;
  const employeeFileDone = employeeFiles.length >= 1;
  const documentsDone = premiumDocs.length >= 1;
  const continuityDone = hasMissions && hasDocs;
  const sensitiveControlDone = approvalTasks.length >= 1;
  const valueReviewDone = completedTasks.length >= 3 && (releaseScore !== null || readinessScore !== null);
  const conversionDone = (releaseScore !== null && releaseScore >= 65) || (readinessScore !== null && readinessScore >= 65);

  const setupBlockers = blockers.filter((b) =>
    b.type === "missing_company_memory" ||
    b.type === "missing_employees" ||
    b.type === "configuration_incomplete"
  );
  const missionBlockers = blockers.filter((b) => b.type === "no_missions");
  const traceBlockers = blockers.filter((b) => b.type === "no_traceability" || b.type === "schema_risk");
  const safetyBlockers = blockers.filter((b) => b.type === "safety_risk" || b.type === "sensitive_case_uncontrolled");
  const valueBlockers = blockers.filter((b) => b.type === "low_value_proof" || b.type === "no_completed_tasks");

  function dayStatus(done: boolean, available: boolean, dayBlockers: PierreTrialActivationBlocker[]): PierreTrialDayPlan["status"] {
    if (dayBlockers.some((b) => b.severity === "critical")) return "blocked";
    if (done) return "done";
    if (!available) return "not_started";
    return "available";
  }

  return [
    {
      day: "day_0_setup",
      label: "Jour 0 — Configuration initiale",
      objective: "Configurer Pierre : mémoire entreprise, salariés, templates documentaires.",
      recommended_missions: ["audit_rh_initial"],
      expected_proofs: ["mission_created"],
      success_criteria: [
        "Mémoire entreprise complète (nom, secteur, coordonnées)",
        "Au moins un salarié configuré",
        "Système documentaire initialisé",
      ],
      status: dayStatus(setupDone, true, setupBlockers),
      blockers: setupBlockers,
    },
    {
      day: "day_1_first_mission",
      label: "Jour 1 — Première mission RH",
      objective: "Lancer la première mission RH et obtenir les premiers livrables.",
      recommended_missions: ["audit_rh_initial", "onboarding_plan"],
      expected_proofs: ["mission_created", "task_completed"],
      success_criteria: [
        "Au moins une mission créée",
        "Au moins une tâche complétée",
        "Premier livrable généré",
      ],
      status: dayStatus(firstMissionDone, setupDone, missionBlockers),
      blockers: missionBlockers,
    },
    {
      day: "day_2_employee_files",
      label: "Jour 2 — Dossiers salariés",
      objective: "Créer et enrichir les dossiers salariés 360° pour l'équipe.",
      recommended_missions: ["create_employee_file", "employee_file_review", "absence_followup"],
      expected_proofs: ["employee_file_created", "task_completed"],
      success_criteria: [
        "Au moins un dossier salarié 360° construit",
        "Informations manquantes identifiées",
        "Prochaines actions RH planifiées",
      ],
      status: dayStatus(employeeFileDone, firstMissionDone || setupDone, []),
      blockers: blockers.filter((b) => b.type === "missing_employees"),
    },
    {
      day: "day_3_documents",
      label: "Jour 3 — Génération documentaire premium",
      objective: "Générer le premier document RH premium : contrat, avenant, ou rapport.",
      recommended_missions: ["generate_contract_or_document", "prepay_summary"],
      expected_proofs: ["document_generated", "pdf_generated", "approval_required"],
      success_criteria: [
        "Au moins un document premium généré",
        "Export PDF disponible",
        "Circuit de validation activé pour documents sensibles",
      ],
      status: dayStatus(documentsDone, firstMissionDone, blockers.filter((b) => b.type === "missing_templates")),
      blockers: blockers.filter((b) => b.type === "missing_templates" || b.type === "missing_documents"),
    },
    {
      day: "day_4_continuity",
      label: "Jour 4 — Continuité opérationnelle",
      objective: "Tester la continuité : missions planifiées, offboarding, suivi multi-missions.",
      recommended_missions: ["offboarding_plan", "hr_weekly_briefing"],
      expected_proofs: ["mission_created", "task_completed", "continuity_recovered"],
      success_criteria: [
        "Mission de continuité testée",
        "Offboarding ou plan de suivi créé",
        "Briefing RH hebdomadaire généré",
      ],
      status: dayStatus(continuityDone, firstMissionDone, traceBlockers),
      blockers: traceBlockers,
    },
    {
      day: "day_5_sensitive_control",
      label: "Jour 5 — Contrôle des cas sensibles",
      objective: "Valider la gestion des cas RH sensibles avec validation humaine obligatoire.",
      recommended_missions: ["sensitive_case_review"],
      expected_proofs: ["risk_controlled", "approval_required"],
      success_criteria: [
        "Cas sensible géré avec validation humaine explicite",
        "Aucun document sensible envoyé automatiquement",
        "Audit trail complet du cas",
      ],
      status: dayStatus(sensitiveControlDone, firstMissionDone, safetyBlockers),
      blockers: safetyBlockers,
    },
    {
      day: "day_6_value_review",
      label: "Jour 6 — Revue de la valeur créée",
      objective: "Mesurer la valeur obtenue avec Pierre : temps économisé, livrables, preuves.",
      recommended_missions: ["hr_weekly_briefing", "prepay_summary", "employee_file_review"],
      expected_proofs: ["time_saved_estimated", "readiness_passed", "release_gate_passed"],
      success_criteria: [
        "Score de valeur calculé > 50",
        "Release proof ou readiness disponible",
        "Rapport de valeur présenté",
      ],
      status: dayStatus(valueReviewDone, continuityDone || firstMissionDone, valueBlockers),
      blockers: valueBlockers,
    },
    {
      day: "day_7_conversion",
      label: "Jour 7 — Décision de conversion",
      objective: "Évaluer si Pierre est prêt à convertir l'essai en abonnement payant.",
      recommended_missions: ["audit_rh_initial", "hr_weekly_briefing"],
      expected_proofs: ["readiness_passed", "release_gate_passed", "time_saved_estimated"],
      success_criteria: [
        "Score de conversion >= 65",
        "Au moins 3 preuves de valeur fortes",
        "Aucun blocker critique",
        "ROI mensuel estimé documenté",
      ],
      status: dayStatus(conversionDone, valueReviewDone || hasDocs, []),
      blockers: blockers.filter((b) => b.severity === "critical"),
    },
  ];
}

// ── Score de valeur ──────────────────────────────────────────────────────────

export function scorePierreTrialValue(
  metrics: PierreTrialActivationMetrics,
  proofs: PierreTrialActivationProof[],
): PierreTrialValueScore {
  // Heures économisées
  const hoursLow =
    metrics.completed_tasks * 1.5 +
    metrics.premium_documents * 1.0 +
    metrics.employee_files_ready * 0.5 +
    (metrics.approval_pending > 0 ? 0.75 : 0);

  const hoursHigh = hoursLow * 1.5 + 2;

  const eurLow = Math.max(0, Math.round(hoursLow * 50));
  const eurHigh = Math.max(50, Math.round(hoursHigh * 50));

  // Score 0-100
  let score = 20;
  score += Math.min(25, metrics.completed_tasks * 4);
  score += Math.min(20, metrics.premium_documents * 5);
  score += Math.min(15, metrics.employee_files_ready * 5);
  score += Math.min(10, metrics.pdf_documents * 4);
  if (metrics.release_score !== null) score += Math.round(metrics.release_score * 0.1);
  if (metrics.readiness_score !== null) score += Math.round(metrics.readiness_score * 0.1);

  // Bonus pour preuves fortes
  const strongProofs = proofs.filter((p) => p.value_score >= 60);
  score += Math.min(10, strongProofs.length * 3);

  score = clamp(Math.round(score), 0, 100);

  // Confidence
  const totalProofScore = proofs.reduce((acc, p) => acc + p.value_score, 0);
  const releaseHigh = metrics.release_score !== null && metrics.release_score >= 75;
  const readinessHigh = metrics.readiness_score !== null && metrics.readiness_score >= 75;

  const confidence: PierreTrialValueScore["confidence"] =
    score >= 70 && (releaseHigh || readinessHigh) ? "high"
    : score >= 45 || totalProofScore >= 100 ? "medium"
    : "low";

  let label: string;
  if (score >= 80) label = "Valeur forte — ROI clairement démontré";
  else if (score >= 60) label = "Valeur bonne — preuves convaincantes";
  else if (score >= 40) label = "Valeur partielle — enrichir pour convaincre";
  else if (score >= 20) label = "Valeur en construction";
  else label = "Valeur non encore démontrée";

  const explanation =
    `Score basé sur ${metrics.completed_tasks} tâches complétées, ` +
    `${metrics.premium_documents} documents premium, ` +
    `${metrics.employee_files_ready} dossiers salariés. ` +
    `Économie estimée : ${Math.round(hoursLow)}–${Math.round(hoursHigh)}h/mois ` +
    `soit ${eurLow}–${eurHigh}€/mois à 50€/h. ` +
    `Confiance : ${confidence}.`;

  return {
    score,
    label,
    estimated_hours_saved_low: Math.round(hoursLow),
    estimated_hours_saved_high: Math.round(hoursHigh),
    estimated_value_eur_low: eurLow,
    estimated_value_eur_high: eurHigh,
    confidence,
    explanation,
  };
}

// ── Score de conversion ──────────────────────────────────────────────────────

export function scorePierreTrialConversion(params: {
  metrics: PierreTrialActivationMetrics;
  proofs: PierreTrialActivationProof[];
  blockers: PierreTrialActivationBlocker[];
  valueScore: PierreTrialValueScore;
}): PierreTrialConversionScore {
  const { metrics, proofs, blockers, valueScore } = params;
  const reasons: string[] = [];
  let score = 30;

  // Augmente avec la valeur
  score += Math.round(valueScore.score * 0.35);
  if (valueScore.score >= 60) {
    reasons.push("Valeur clairement démontrée");
  }

  // Augmente avec les documents premium
  if (metrics.premium_documents >= 2) {
    score += 10;
    reasons.push(`${metrics.premium_documents} documents premium générés`);
  }

  // Augmente avec les tâches terminées
  if (metrics.completed_tasks >= 3) {
    score += 10;
    reasons.push(`${metrics.completed_tasks} tâches complétées`);
  }

  // Augmente avec les dossiers salariés
  if (metrics.employee_files_ready >= 1) {
    score += 8;
    reasons.push(`${metrics.employee_files_ready} dossier(s) salarié 360° actifs`);
  }

  // Augmente avec release/readiness
  if (metrics.release_score !== null && metrics.release_score >= 65) {
    score += 8;
    reasons.push(`Release proof validé (score ${metrics.release_score})`);
  }
  if (metrics.readiness_score !== null && metrics.readiness_score >= 65) {
    score += 8;
    reasons.push(`Readiness certifiée (score ${metrics.readiness_score})`);
  }

  // Diminue avec les blockers
  const criticalBlockers = blockers.filter((b) => b.severity === "critical");
  const highBlockers = blockers.filter((b) => b.severity === "high");

  if (criticalBlockers.length > 0) {
    score -= criticalBlockers.length * 20;
    reasons.push(`${criticalBlockers.length} blocker(s) critique(s) à corriger`);
  }
  if (highBlockers.length > 0) {
    score -= highBlockers.length * 8;
    if (highBlockers.length >= 2) {
      reasons.push(`${highBlockers.length} blockers importants non résolus`);
    }
  }

  // Diminue si pas de missions/tâches
  if (metrics.missions_total === 0) {
    score -= 20;
    reasons.push("Aucune mission lancée");
  }
  if (metrics.completed_tasks === 0) {
    score -= 15;
    reasons.push("Aucune tâche complétée");
  }
  if (metrics.logs_total === 0 && metrics.missions_total > 0) {
    score -= 10;
    reasons.push("Traçabilité insuffisante");
  }

  score = clamp(Math.round(score), 0, 100);

  const probabilityBand: PierreTrialConversionScore["probability_band"] =
    score >= 85 ? "very_high"
    : score >= 65 ? "high"
    : score >= 45 ? "medium"
    : "low";

  let label: string;
  if (probabilityBand === "very_high") label = "Prêt à convertir — recommander l'abonnement";
  else if (probabilityBand === "high") label = "Forte probabilité — finir les dernières étapes";
  else if (probabilityBand === "medium") label = "Conversion possible — renforcer la valeur prouvée";
  else label = "Conversion risquée — résoudre les blockers en priorité";

  return { score, label, probability_band: probabilityBand, reasons };
}

// ── Classification du stage ──────────────────────────────────────────────────

export function classifyPierreTrialActivationStage(params: {
  metrics: PierreTrialActivationMetrics;
  proofs: PierreTrialActivationProof[];
  blockers: PierreTrialActivationBlocker[];
  valueScore: PierreTrialValueScore;
  conversionScore: PierreTrialConversionScore;
}): PierreTrialActivationStage {
  const { metrics, blockers, valueScore, conversionScore } = params;

  // Blocked si critical blockers
  const criticalBlockers = blockers.filter((b) => b.severity === "critical");
  if (criticalBlockers.length > 0) return "blocked";

  // not_started : rien du tout
  if (metrics.missions_total === 0 && metrics.completed_tasks === 0 && metrics.logs_total === 0) {
    const hasMemory = blockers.some((b) => b.type === "missing_company_memory");
    if (hasMemory) return "not_started";
    return "not_started";
  }

  // setup_needed : pas de config ou salariés
  const setupBlockers = blockers.filter((b) =>
    b.type === "missing_company_memory" ||
    b.type === "missing_employees" ||
    b.type === "configuration_incomplete"
  );
  if (setupBlockers.length >= 2 && metrics.missions_total === 0) return "setup_needed";

  // ready_to_launch : config présente mais pas encore de mission
  if (metrics.missions_total === 0 && setupBlockers.length === 0) return "ready_to_launch";

  // conversion_ready : valeur forte + pas de blockers graves + scores hauts
  if (
    conversionScore.probability_band === "very_high" ||
    (conversionScore.score >= 65 &&
      blockers.filter((b) => b.severity === "high" || b.severity === "critical").length === 0 &&
      valueScore.score >= 60)
  ) {
    return "conversion_ready";
  }

  // value_proven : valeur forte démontrée
  if (valueScore.score >= 60 && metrics.completed_tasks >= 3 && metrics.documents_generated >= 2) {
    return "value_proven";
  }

  // first_value_started : missions/tâches commencées
  if (metrics.missions_total >= 1 || metrics.completed_tasks >= 1) {
    return "first_value_started";
  }

  return "setup_needed";
}

// ── Classification du status ─────────────────────────────────────────────────

export function classifyPierreTrialActivationStatus(params: {
  stage: PierreTrialActivationStage;
  blockers: PierreTrialActivationBlocker[];
  valueScore: PierreTrialValueScore;
}): PierreTrialActivationStatus {
  const { stage, blockers } = params;

  const criticalBlockers = blockers.filter((b) => b.severity === "critical");
  const highBlockers = blockers.filter((b) => b.severity === "high");

  if (criticalBlockers.length > 0 || stage === "blocked") return "black";
  if (highBlockers.length >= 2) return "red";

  switch (stage) {
    case "conversion_ready": return "green";
    case "value_proven": return "green";
    case "first_value_started": return highBlockers.length >= 1 ? "orange" : "yellow";
    case "ready_to_launch": return "yellow";
    case "setup_needed": return highBlockers.length >= 1 ? "orange" : "yellow";
    case "not_started": return "red";
    default: return "black";
  }
}

// ── Missions recommandées ────────────────────────────────────────────────────

export function buildPierreTrialRecommendedMissions(
  params: PierreTrialActivationParams,
  blockers: PierreTrialActivationBlocker[],
): PierreTrialMissionTemplate[] {
  const all = buildPierreTrialMissionTemplates();
  const byKey = new Map(all.map((t) => [t.key, t]));

  const missions = safeRows(params.missions);
  const employees = safeRows(params.employees);
  const employeeFiles = (params.employeeFiles ?? []).filter(isObject);
  const documents = safeRows(params.documents);
  const tasks = safeRows(params.tasks);

  const recommended: PierreTrialMissionTemplate[] = [];
  const addedKeys = new Set<string>();

  function add(key: PierreTrialMissionTemplateKey) {
    if (addedKeys.has(key) || recommended.length >= 5) return;
    const t = byKey.get(key);
    if (t) {
      recommended.push(t);
      addedKeys.add(key);
    }
  }

  // Priorité 1 : si pas de missions → audit initial en premier
  if (missions.length === 0) {
    add("audit_rh_initial");
    add("onboarding_plan");
  }

  // Priorité 2 : si pas d'employés → créer dossier salarié
  if (employees.length === 0 || employeeFiles.length === 0) {
    add("create_employee_file");
  }

  // Priorité 3 : si pas de documents → générer un contrat/document
  if (documents.length === 0) {
    add("generate_contract_or_document");
  }

  // Priorité 4 : si pas de dossier salarié complet → revue dossier
  if (employeeFiles.length === 0 && employees.length > 0) {
    add("employee_file_review");
  }

  // Priorité 5 : si safety risk → cas sensible
  if (blockers.some((b) => b.type === "safety_risk")) {
    add("sensitive_case_review");
  }

  // Priorité 6 : si beaucoup de tâches → résumé pré-paie
  const completedTasks = tasks.filter((t) => TERMINAL_STATUSES.has(rowStatus(t) ?? ""));
  if (completedTasks.length >= 3) {
    add("prepay_summary");
  }

  // Priorité 7 : toujours proposer briefing hebdomadaire si peu recommandé
  if (recommended.length < 3) {
    add("hr_weekly_briefing");
  }

  // Priorité 8 : audit initial comme fallback
  if (recommended.length === 0) {
    add("audit_rh_initial");
  }

  return recommended;
}

// ── Prompt de première valeur ────────────────────────────────────────────────

export function buildPierreTrialFirstValuePrompt(params: {
  template_key: PierreTrialMissionTemplateKey;
  company_name?: string | null;
  employee_name?: string | null;
  role?: string | null;
}): {
  template_key: PierreTrialMissionTemplateKey;
  title: string;
  prompt: string;
  required_inputs: string[];
  expected_outputs: string[];
  requires_human_validation: boolean;
} {
  const { template_key, company_name, employee_name, role } = params;
  const all = buildPierreTrialMissionTemplates();
  const template = all.find((t) => t.key === template_key);

  if (!template) {
    return {
      template_key,
      title: "Template inconnu",
      prompt: "Template non reconnu. Utiliser un des templates disponibles.",
      required_inputs: [],
      expected_outputs: [],
      requires_human_validation: true,
    };
  }

  const companyCtx = asStr(company_name) ? ` pour l'entreprise ${company_name}` : "";
  const employeeCtx = asStr(employee_name)
    ? ` concernant ${employee_name}${role ? `, ${role}` : ""}`
    : "";

  let prompt = template.suggested_prompt
    .replace("[Prénom Nom]", asStr(employee_name) ?? "le(la) salarié(e)")
    .replace("[Prénom Nom]", asStr(employee_name) ?? "le(la) salarié(e)")
    .replace("[poste]", asStr(role) ?? "le poste concerné");

  if (companyCtx || employeeCtx) {
    prompt = `Contexte${companyCtx}${employeeCtx}.\n\n${prompt}`;
  }

  if (template.requires_human_validation) {
    prompt +=
      "\n\nIMPORTANT : Ne rien envoyer, ne rien exécuter sans ma validation humaine explicite. " +
      "Tous les documents et actions doivent être en attente de validation.";
  }

  return {
    template_key,
    title: template.title,
    prompt,
    required_inputs: template.required_inputs,
    expected_outputs: template.expected_outputs,
    requires_human_validation: template.requires_human_validation,
  };
}

// ── Next actions ─────────────────────────────────────────────────────────────

export function buildPierreTrialNextActions(params: {
  stage: PierreTrialActivationStage;
  blockers: PierreTrialActivationBlocker[];
  recommendedMissions: PierreTrialMissionTemplate[];
  conversionScore: PierreTrialConversionScore;
}): PierreTrialActivationNextAction[] {
  const { stage, blockers, recommendedMissions, conversionScore } = params;
  const actions: PierreTrialActivationNextAction[] = [];

  // Critical blockers first
  const criticalBlockers = blockers.filter((b) => b.severity === "critical");
  for (const b of criticalBlockers) {
    if (actions.length >= 8) break;
    actions.push({
      type: "resolve_blocker",
      label: `Corriger : ${b.label}`,
      priority: "urgent",
      blocker_type: b.type,
    });
  }

  // Setup actions
  if (stage === "not_started" || stage === "setup_needed") {
    const setupBlockers = blockers.filter(
      (b) =>
        b.type === "missing_company_memory" ||
        b.type === "configuration_incomplete"
    );
    if (setupBlockers.length > 0) {
      actions.push({
        type: "complete_setup",
        label: "Compléter la configuration Pierre (Empreinte Entreprise)",
        priority: "urgent",
        blocker_type: "missing_company_memory",
      });
    }
    const empBlockers = blockers.filter((b) => b.type === "missing_employees");
    if (empBlockers.length > 0) {
      actions.push({
        type: "add_employees",
        label: "Ajouter les premiers salariés dans Pierre",
        priority: "high",
        blocker_type: "missing_employees",
      });
    }
  }

  // Template config
  if (blockers.some((b) => b.type === "missing_templates")) {
    actions.push({
      type: "configure_templates",
      label: "Configurer le système documentaire (templates premium)",
      priority: "high",
      blocker_type: "missing_templates",
    });
  }

  // First mission
  if (stage === "ready_to_launch" || (stage === "setup_needed" && criticalBlockers.length === 0)) {
    const firstTemplate = recommendedMissions[0];
    if (firstTemplate) {
      actions.push({
        type: "launch_first_mission",
        label: `Lancer la première mission : ${firstTemplate.title}`,
        priority: "high",
        mission_template_key: firstTemplate.key,
      });
    }
  }

  // Document generation
  if (stage === "first_value_started" && blockers.some((b) => b.type === "missing_documents")) {
    actions.push({
      type: "generate_document",
      label: "Générer le premier document RH premium (contrat ou rapport)",
      priority: "normal",
      mission_template_key: "generate_contract_or_document",
    });
  }

  // Employee file review
  if (blockers.some((b) => b.type === "missing_employees") === false && stage === "first_value_started") {
    actions.push({
      type: "review_employee_file",
      label: "Revoir et compléter les dossiers salariés 360°",
      priority: "normal",
      mission_template_key: "employee_file_review",
    });
  }

  // Release proof
  if (stage === "value_proven" || stage === "first_value_started") {
    actions.push({
      type: "run_release_proof",
      label: "Exécuter le diagnostic release-proof pour mesurer la maturité produit",
      priority: "normal",
    });
  }

  // Conversion
  if (stage === "conversion_ready" || conversionScore.probability_band === "very_high") {
    actions.push({
      type: "prepare_conversion",
      label: "Pierre est prêt — préparer la conversion vers l'abonnement",
      priority: "high",
    });
  }

  // No action needed
  if (actions.length === 0) {
    actions.push({
      type: "no_action",
      label: "Pierre est opérationnel — continuer l'utilisation",
      priority: "low",
    });
  }

  return actions.slice(0, 8);
}

// ── Digest ───────────────────────────────────────────────────────────────────

export function buildPierreTrialDigest(params: {
  stage: PierreTrialActivationStage;
  status: PierreTrialActivationStatus;
  metrics: PierreTrialActivationMetrics;
  valueScore: PierreTrialValueScore;
  conversionScore: PierreTrialConversionScore;
  blockers: PierreTrialActivationBlocker[];
}): PierreTrialActivationDigest {
  const { stage, metrics, valueScore, conversionScore, blockers } = params;

  const criticalBlockers = blockers.filter((b) => b.severity === "critical");

  if (stage === "blocked" || criticalBlockers.length > 0) {
    return {
      tone: "blocked",
      text:
        `Pierre détecte ${criticalBlockers.length} problème(s) critique(s) à corriger avant de continuer. ` +
        `${criticalBlockers[0] ? `Principal problème : ${criticalBlockers[0].label}. ` : ""}` +
        `Corriger ces points pour débloquer l'activation.`,
    };
  }

  if (stage === "not_started" || stage === "setup_needed") {
    return {
      tone: "setup",
      text:
        "Pierre est installé mais pas encore configuré. " +
        "Pour démarrer, complétez l'Empreinte Entreprise (nom, salariés, templates). " +
        "Comptez 15 à 20 minutes pour la configuration initiale.",
    };
  }

  if (stage === "ready_to_launch") {
    return {
      tone: "action",
      text:
        "Pierre est configuré et prêt à démarrer. " +
        "Lancez votre première mission RH — un audit initial ou un dossier salarié — " +
        "pour voir la valeur en action en moins de 5 minutes.",
    };
  }

  if (stage === "conversion_ready") {
    return {
      tone: "conversion",
      text:
        `Pierre a prouvé sa valeur : ${metrics.completed_tasks} tâches terminées, ` +
        `${metrics.documents_generated} documents générés, ` +
        `économie estimée de ${valueScore.estimated_value_eur_low}–${valueScore.estimated_value_eur_high}€/mois. ` +
        `Score de conversion : ${conversionScore.score}/100. ` +
        `Pierre est prêt pour l'abonnement — la valeur est démontrée.`,
    };
  }

  if (stage === "value_proven") {
    return {
      tone: "value",
      text:
        `Excellent — Pierre a généré une valeur mesurable. ` +
        `${metrics.completed_tasks} tâches terminées, ${metrics.documents_generated} documents, ` +
        `${metrics.employee_files_ready} dossiers salariés actifs. ` +
        `Économie estimée : ${valueScore.estimated_value_eur_low}–${valueScore.estimated_value_eur_high}€/mois. ` +
        `Restez sur cette lancée pour passer au stade "conversion_ready".`,
    };
  }

  // first_value_started
  return {
    tone: "action",
    text:
      `Pierre est en action : ${metrics.missions_total} mission(s), ` +
      `${metrics.completed_tasks} tâche(s) terminée(s), ` +
      `${metrics.documents_generated} document(s). ` +
      `Continuez sur cette lancée — quelques missions de plus suffiront à prouver la valeur client.`,
  };
}

// ── Rapport principal ────────────────────────────────────────────────────────

export function buildPierreTrialActivationReport(
  params: PierreTrialActivationParams,
): PierreTrialActivationReport {
  const safeParams: PierreTrialActivationParams = {
    companyMemory: isObject(params.companyMemory) ? params.companyMemory : null,
    missions: safeRows(params.missions),
    tasks: safeRows(params.tasks),
    documents: safeRows(params.documents),
    logs: safeRows(params.logs),
    employees: safeRows(params.employees),
    employeeFiles: (params.employeeFiles ?? []).filter(isObject),
    readinessReport: params.readinessReport,
    releaseReport: params.releaseReport,
    now: params.now ?? new Date(),
  };

  const metrics = computePierreTrialMetrics(safeParams);
  const proofs = detectPierreTrialProofs(safeParams);
  const blockers = detectPierreTrialBlockers(safeParams);
  const valueScore = scorePierreTrialValue(metrics, proofs);
  const conversionScore = scorePierreTrialConversion({ metrics, proofs, blockers, valueScore });

  const stage = classifyPierreTrialActivationStage({
    metrics,
    proofs,
    blockers,
    valueScore,
    conversionScore,
  });
  const status = classifyPierreTrialActivationStatus({ stage, blockers, valueScore });

  const dayPlan = buildPierreTrialDayPlan(safeParams);
  const recommendedMissions = buildPierreTrialRecommendedMissions(safeParams, blockers);
  const nextActions = buildPierreTrialNextActions({
    stage,
    blockers,
    recommendedMissions,
    conversionScore,
  });
  const digest = buildPierreTrialDigest({
    stage,
    status,
    metrics,
    valueScore,
    conversionScore,
    blockers,
  });

  // activation_score : pondération 35/25/20/20
  const releaseContrib =
    metrics.release_score !== null ? metrics.release_score : 40;
  const readinessContrib =
    metrics.readiness_score !== null ? metrics.readiness_score : 40;
  const infraScore = Math.round((releaseContrib + readinessContrib) / 2);

  const blockersScore = clamp(
    100 - blockers.filter((b) => b.severity === "critical").length * 30 -
      blockers.filter((b) => b.severity === "high").length * 10 -
      blockers.filter((b) => b.severity === "medium").length * 5,
    0,
    100,
  );

  let activationScore = Math.round(
    valueScore.score * 0.35 +
    conversionScore.score * 0.25 +
    infraScore * 0.20 +
    blockersScore * 0.20,
  );

  // Critical blockers cap
  const criticalBlockers = blockers.filter((b) => b.severity === "critical");
  if (criticalBlockers.length > 0) {
    activationScore = Math.min(activationScore, 49);
  }

  activationScore = clamp(activationScore, 0, 100);

  return {
    generated_at: (safeParams.now ?? new Date()).toISOString(),
    stage,
    status,
    activation_score: activationScore,
    metrics,
    value_score: valueScore,
    conversion_score: conversionScore,
    proofs,
    blockers,
    day_plan: dayPlan,
    recommended_missions: recommendedMissions,
    next_actions: nextActions,
    digest,
  };
}

// ── Hint mission légère ──────────────────────────────────────────────────────

export type PierreTrialActivationHint = {
  stage: PierreTrialActivationStage;
  status: PierreTrialActivationStatus;
  value_score: number;
  conversion_score: number;
  next_action_label: string;
};

export function buildMissionTrialActivationHint(
  mission: Record<string, unknown>,
  tasks: Record<string, unknown>[],
  documents: Record<string, unknown>[],
  logs: Record<string, unknown>[],
  cloneADNHint?: {
    configured?: boolean;
    status?: string;
    completeness_score?: number;
  } | null,
): PierreTrialActivationHint {
  const params: PierreTrialActivationParams = {
    missions: [mission],
    tasks: safeRows(tasks),
    documents: safeRows(documents),
    logs: safeRows(logs),
  };

  const metrics = computePierreTrialMetrics(params);
  const proofs = detectPierreTrialProofs(params);
  const blockers = detectPierreTrialBlockers(params);
  const valueScore = scorePierreTrialValue(metrics, proofs);
  const conversionScore = scorePierreTrialConversion({ metrics, proofs, blockers, valueScore });

  const stage = classifyPierreTrialActivationStage({
    metrics, proofs, blockers, valueScore, conversionScore,
  });
  const status = classifyPierreTrialActivationStatus({ stage, blockers, valueScore });

  const nextActions = buildPierreTrialNextActions({
    stage,
    blockers,
    recommendedMissions: buildPierreTrialRecommendedMissions(params, blockers),
    conversionScore,
  });

  const nextActionLabel = nextActions.length > 0 ? nextActions[0].label : "Pierre est opérationnel";

  // CloneADN signal: configured ADN improves activation scores
  const adnBonus = cloneADNHint && cloneADNHint.configured ? 3 : 0;

  return {
    stage,
    status,
    value_score: Math.min(100, valueScore.score + adnBonus),
    conversion_score: Math.min(100, conversionScore.score + adnBonus),
    next_action_label: nextActionLabel,
  };
}
