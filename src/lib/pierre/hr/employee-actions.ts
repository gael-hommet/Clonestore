// Pierre HR Engine — Employee Actions & Workflows RH (Bloc 17)
// Pure module: no Supabase, no Next, no async, no side effects

// ── Helpers internes ──────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStr(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function normalizeText(v: unknown): string {
  const s = asStr(v);
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, keywords: string[]): boolean {
  const t = normalizeText(text);
  return keywords.some((k) => t.includes(k));
}

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

// ── Types exportés ────────────────────────────────────────

export type PierreEmployeeActionDomain =
  | "onboarding"
  | "offboarding"
  | "contract"
  | "absence"
  | "payroll"
  | "training"
  | "interview"
  | "document"
  | "communication"
  | "followup"
  | "note"
  | "general";

export type PierreEmployeeActionGovernance =
  | "auto_safe"
  | "approval_required"
  | "manual_only"
  | "blocked";

export type PierreEmployeeActionRisk =
  | "green"
  | "orange"
  | "red"
  | "black";

export type PierreEmployeeActionCatalogItem = {
  id: string;
  domain: PierreEmployeeActionDomain;
  action_type: string;
  label_fr: string;
  label_en: string;
  governance: PierreEmployeeActionGovernance;
  risk: PierreEmployeeActionRisk;
  requires_employee: boolean;
  requires_document: boolean;
  description: string;
};

export type PierreEmployeeActionContext = {
  employee_id: string;
  employee_name?: string | null;
  department?: string | null;
  contract_type?: string | null;
  status?: string | null;
  action_domain?: PierreEmployeeActionDomain | null;
  action_type?: string | null;
  meta?: Record<string, unknown>;
};

export type PierreEmployeeActionSuggestion = {
  action_type: string;
  domain: PierreEmployeeActionDomain;
  label_fr: string;
  reason: string;
  risk: PierreEmployeeActionRisk;
  governance: PierreEmployeeActionGovernance;
  confidence: number;
};

export type PierreEmployeeActionPlan = {
  employee_id: string;
  employee_name: string | null;
  suggested_actions: PierreEmployeeActionSuggestion[];
  auto_safe_count: number;
  approval_required_count: number;
  blocked_count: number;
  manual_only_count: number;
  next_action: PierreEmployeeActionSuggestion | null;
  generated_at: string;
};

export type PierreEmployeeActionSummary = {
  total_actions: number;
  auto_safe: number;
  approval_required: number;
  manual_only: number;
  blocked: number;
  has_sensitive: boolean;
  domains_active: PierreEmployeeActionDomain[];
};

export type PierreEmployeeActionTaskDraft = {
  type: string;
  title: string;
  description: string;
  status: "ready" | "awaiting_approval" | "blocked";
  approval_required: boolean;
  execute_at: string | null;
  payload_json: Record<string, unknown>;
};

export type PierreEmployeeActionResult = {
  action_type: string;
  domain: PierreEmployeeActionDomain | null;
  risk: PierreEmployeeActionRisk;
  governance: PierreEmployeeActionGovernance;
  allowed_to_auto_execute: boolean;
  explanation: string;
  task_draft: PierreEmployeeActionTaskDraft | null;
};

export type PierreEmployeeActionTrace = {
  id: string;
  employee_id: string;
  action_type: string;
  domain: PierreEmployeeActionDomain | null;
  risk: PierreEmployeeActionRisk;
  governance: PierreEmployeeActionGovernance;
  created_at: string;
  meta: Record<string, unknown>;
};

// ── Constants ─────────────────────────────────────────────

const RISK_RANK: Record<PierreEmployeeActionRisk, number> = {
  green: 0, orange: 1, red: 2, black: 3,
};

const GOVERNANCE_RANK: Record<PierreEmployeeActionGovernance, number> = {
  auto_safe: 0, approval_required: 1, manual_only: 2, blocked: 3,
};

// ── Catalog ───────────────────────────────────────────────

const EMPLOYEE_ACTION_CATALOG: PierreEmployeeActionCatalogItem[] = [
  // ── ONBOARDING ─────────────────────────────────────────
  {
    id: "onboarding.welcome_email",
    domain: "onboarding",
    action_type: "onboarding.welcome_email",
    label_fr: "Email de bienvenue",
    label_en: "Welcome email",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Prépare un email de bienvenue pour le nouveau salarié.",
  },
  {
    id: "onboarding.document_checklist",
    domain: "onboarding",
    action_type: "onboarding.document_checklist",
    label_fr: "Checklist documents d'intégration",
    label_en: "Onboarding document checklist",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Génère la liste des documents à fournir à l'arrivée.",
  },
  {
    id: "onboarding.account_setup_reminder",
    domain: "onboarding",
    action_type: "onboarding.account_setup_reminder",
    label_fr: "Rappel création de comptes",
    label_en: "Account setup reminder",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Planifie un rappel pour la création des accès et comptes IT.",
  },
  {
    id: "onboarding.contract_send",
    domain: "onboarding",
    action_type: "onboarding.contract_send",
    label_fr: "Envoi du contrat de travail",
    label_en: "Employment contract send",
    governance: "approval_required",
    risk: "orange",
    requires_employee: true,
    requires_document: true,
    description: "Prépare l'envoi du contrat de travail — requiert validation RH.",
  },
  // ── OFFBOARDING ────────────────────────────────────────
  {
    id: "offboarding.exit_interview_schedule",
    domain: "offboarding",
    action_type: "offboarding.exit_interview_schedule",
    label_fr: "Planification entretien de départ",
    label_en: "Exit interview schedule",
    governance: "approval_required",
    risk: "orange",
    requires_employee: true,
    requires_document: false,
    description: "Planifie l'entretien de fin de contrat.",
  },
  {
    id: "offboarding.document_return_checklist",
    domain: "offboarding",
    action_type: "offboarding.document_return_checklist",
    label_fr: "Checklist restitution matériel et docs",
    label_en: "Document and material return checklist",
    governance: "approval_required",
    risk: "orange",
    requires_employee: true,
    requires_document: false,
    description: "Génère la liste des éléments à restituer lors du départ.",
  },
  {
    id: "offboarding.termination_letter_draft",
    domain: "offboarding",
    action_type: "offboarding.termination_letter_draft",
    label_fr: "Rédaction lettre de licenciement",
    label_en: "Termination letter draft",
    governance: "manual_only",
    risk: "red",
    requires_employee: true,
    requires_document: true,
    description: "Prépare un brouillon de lettre de licenciement — validation obligatoire.",
  },
  {
    id: "offboarding.access_revocation_note",
    domain: "offboarding",
    action_type: "offboarding.access_revocation_note",
    label_fr: "Note révocation des accès",
    label_en: "Access revocation note",
    governance: "approval_required",
    risk: "orange",
    requires_employee: true,
    requires_document: false,
    description: "Génère une note de demande de révocation des accès IT.",
  },
  // ── CONTRACT ───────────────────────────────────────────
  {
    id: "contract.renewal_reminder",
    domain: "contract",
    action_type: "contract.renewal_reminder",
    label_fr: "Rappel renouvellement CDD",
    label_en: "Fixed-term contract renewal reminder",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Planifie un rappel avant l'échéance du CDD.",
  },
  {
    id: "contract.amendment_draft",
    domain: "contract",
    action_type: "contract.amendment_draft",
    label_fr: "Rédaction avenant de contrat",
    label_en: "Contract amendment draft",
    governance: "approval_required",
    risk: "orange",
    requires_employee: true,
    requires_document: true,
    description: "Prépare un brouillon d'avenant — requiert validation RH.",
  },
  {
    id: "contract.termination_prep",
    domain: "contract",
    action_type: "contract.termination_prep",
    label_fr: "Préparation dossier rupture de contrat",
    label_en: "Contract termination preparation",
    governance: "manual_only",
    risk: "red",
    requires_employee: true,
    requires_document: true,
    description: "Prépare le dossier de rupture — validation et supervision obligatoires.",
  },
  {
    id: "contract.trial_period_followup",
    domain: "contract",
    action_type: "contract.trial_period_followup",
    label_fr: "Suivi période d'essai",
    label_en: "Trial period follow-up",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Génère un rappel de suivi en fin de période d'essai.",
  },
  // ── ABSENCE ────────────────────────────────────────────
  {
    id: "absence.absence_acknowledgment",
    domain: "absence",
    action_type: "absence.absence_acknowledgment",
    label_fr: "Accusé réception absence",
    label_en: "Absence acknowledgment",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Prépare un accusé réception d'absence.",
  },
  {
    id: "absence.return_to_work_schedule",
    domain: "absence",
    action_type: "absence.return_to_work_schedule",
    label_fr: "Planification reprise de travail",
    label_en: "Return to work schedule",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Planifie le suivi de reprise après absence.",
  },
  {
    id: "absence.long_absence_followup",
    domain: "absence",
    action_type: "absence.long_absence_followup",
    label_fr: "Suivi absence longue durée",
    label_en: "Long-term absence follow-up",
    governance: "approval_required",
    risk: "orange",
    requires_employee: true,
    requires_document: false,
    description: "Suivi structuré d'une absence prolongée — requiert validation.",
  },
  {
    id: "absence.medical_certificate_reminder",
    domain: "absence",
    action_type: "absence.medical_certificate_reminder",
    label_fr: "Rappel certificat médical",
    label_en: "Medical certificate reminder",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Envoie un rappel pour la fourniture d'un justificatif médical.",
  },
  // ── PAYROLL ────────────────────────────────────────────
  {
    id: "payroll.variable_element_prep",
    domain: "payroll",
    action_type: "payroll.variable_element_prep",
    label_fr: "Préparation éléments variables de paie",
    label_en: "Variable pay element preparation",
    governance: "approval_required",
    risk: "orange",
    requires_employee: true,
    requires_document: false,
    description: "Prépare les éléments variables pour la paie — requiert validation.",
  },
  {
    id: "payroll.payslip_generation_note",
    domain: "payroll",
    action_type: "payroll.payslip_generation_note",
    label_fr: "Note génération bulletin de paie",
    label_en: "Payslip generation note",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Génère une note de suivi pour la génération des bulletins.",
  },
  {
    id: "payroll.salary_review_draft",
    domain: "payroll",
    action_type: "payroll.salary_review_draft",
    label_fr: "Préparation révision salariale",
    label_en: "Salary review draft",
    governance: "manual_only",
    risk: "red",
    requires_employee: true,
    requires_document: true,
    description: "Prépare un dossier de révision salariale — validation obligatoire.",
  },
  // ── TRAINING ───────────────────────────────────────────
  {
    id: "training.training_plan_draft",
    domain: "training",
    action_type: "training.training_plan_draft",
    label_fr: "Rédaction plan de formation",
    label_en: "Training plan draft",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Génère un brouillon de plan de formation personnalisé.",
  },
  {
    id: "training.training_reminder",
    domain: "training",
    action_type: "training.training_reminder",
    label_fr: "Rappel formation obligatoire",
    label_en: "Mandatory training reminder",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Planifie un rappel pour une formation obligatoire.",
  },
  {
    id: "training.certification_followup",
    domain: "training",
    action_type: "training.certification_followup",
    label_fr: "Suivi certification / habilitation",
    label_en: "Certification follow-up",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Suivi d'une certification ou habilitation en cours ou à renouveler.",
  },
  // ── INTERVIEW ──────────────────────────────────────────
  {
    id: "interview.annual_review_schedule",
    domain: "interview",
    action_type: "interview.annual_review_schedule",
    label_fr: "Planification entretien annuel",
    label_en: "Annual review schedule",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Planifie l'entretien annuel d'évaluation.",
  },
  {
    id: "interview.performance_note_draft",
    domain: "interview",
    action_type: "interview.performance_note_draft",
    label_fr: "Note de performance / évaluation",
    label_en: "Performance note draft",
    governance: "approval_required",
    risk: "orange",
    requires_employee: true,
    requires_document: false,
    description: "Prépare une note de performance — requiert validation RH.",
  },
  {
    id: "interview.disciplinary_prep",
    domain: "interview",
    action_type: "interview.disciplinary_prep",
    label_fr: "Préparation convocation disciplinaire",
    label_en: "Disciplinary hearing preparation",
    governance: "manual_only",
    risk: "red",
    requires_employee: true,
    requires_document: true,
    description: "Prépare les documents de convocation disciplinaire — validation obligatoire.",
  },
  // ── DOCUMENT ───────────────────────────────────────────
  {
    id: "document.employee_file_update",
    domain: "document",
    action_type: "document.employee_file_update",
    label_fr: "Mise à jour dossier salarié",
    label_en: "Employee file update",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Met à jour ou enrichit le dossier salarié.",
  },
  {
    id: "document.reference_letter_draft",
    domain: "document",
    action_type: "document.reference_letter_draft",
    label_fr: "Rédaction lettre de recommandation",
    label_en: "Reference letter draft",
    governance: "approval_required",
    risk: "orange",
    requires_employee: true,
    requires_document: false,
    description: "Prépare une lettre de recommandation — requiert validation.",
  },
  {
    id: "document.work_certificate_draft",
    domain: "document",
    action_type: "document.work_certificate_draft",
    label_fr: "Rédaction attestation de travail",
    label_en: "Work certificate draft",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Génère un brouillon d'attestation de travail.",
  },
  // ── COMMUNICATION ──────────────────────────────────────
  {
    id: "communication.internal_followup",
    domain: "communication",
    action_type: "communication.internal_followup",
    label_fr: "Relance interne",
    label_en: "Internal follow-up",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Génère une relance interne non sensible.",
  },
  {
    id: "communication.manager_alert",
    domain: "communication",
    action_type: "communication.manager_alert",
    label_fr: "Alerte manager RH",
    label_en: "HR manager alert",
    governance: "approval_required",
    risk: "orange",
    requires_employee: true,
    requires_document: false,
    description: "Prépare une alerte à destination du manager — requiert validation.",
  },
  {
    id: "communication.sensitive_communication_prep",
    domain: "communication",
    action_type: "communication.sensitive_communication_prep",
    label_fr: "Préparation communication sensible",
    label_en: "Sensitive communication preparation",
    governance: "manual_only",
    risk: "red",
    requires_employee: true,
    requires_document: false,
    description: "Prépare une communication sensible (disciplinaire, légale) — supervision requise.",
  },
  // ── FOLLOWUP ───────────────────────────────────────────
  {
    id: "followup.task_reminder",
    domain: "followup",
    action_type: "followup.task_reminder",
    label_fr: "Rappel tâche en attente",
    label_en: "Pending task reminder",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Génère un rappel pour une tâche en attente.",
  },
  {
    id: "followup.periodic_check",
    domain: "followup",
    action_type: "followup.periodic_check",
    label_fr: "Point de suivi périodique",
    label_en: "Periodic check-in",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Planifie un point de suivi régulier avec le salarié.",
  },
  // ── NOTE ───────────────────────────────────────────────
  {
    id: "note.employee_observation",
    domain: "note",
    action_type: "note.employee_observation",
    label_fr: "Note d'observation salarié",
    label_en: "Employee observation note",
    governance: "auto_safe",
    risk: "green",
    requires_employee: true,
    requires_document: false,
    description: "Crée une note d'observation ou de suivi pour le dossier.",
  },
  // ── GENERAL ────────────────────────────────────────────
  {
    id: "general.action_reminder",
    domain: "general",
    action_type: "general.action_reminder",
    label_fr: "Rappel action RH générique",
    label_en: "Generic HR action reminder",
    governance: "auto_safe",
    risk: "green",
    requires_employee: false,
    requires_document: false,
    description: "Génère un rappel générique pour une action RH.",
  },
];

// ── Domain/action signal maps ─────────────────────────────

const DOMAIN_SIGNALS: Record<PierreEmployeeActionDomain, string[]> = {
  onboarding: ["onboarding", "integration", "arrivee", "nouveau salarie", "bienvenue", "accueil", "prise de poste"],
  offboarding: ["offboarding", "depart", "licencie", "licenciement", "fin de contrat", "demission", "sortie"],
  contract: ["contrat", "avenant", "cdi", "cdd", "renouvellement", "rupture", "periode essai"],
  absence: ["absence", "arret", "conge", "maladie", "certificat medical", "retour travail"],
  payroll: ["paie", "salaire", "bulletin", "variable", "remuneration", "revision salariale"],
  training: ["formation", "certification", "habilitation", "competence", "plan formation"],
  interview: ["entretien", "evaluation", "annuel", "disciplinaire", "performance", "convocation"],
  document: ["document", "attestation", "certificat", "lettre", "dossier", "recommandation"],
  communication: ["communication", "email", "message", "alerte", "relance", "information", "manager"],
  followup: ["suivi", "rappel", "relance", "planification", "check", "periodicite"],
  note: ["note", "observation", "remarque", "memo"],
  general: [],
};

const ACTION_TYPE_SIGNALS: Record<string, string[]> = {
  "onboarding.welcome_email": ["bienvenue", "welcome", "email arrivee"],
  "onboarding.document_checklist": ["checklist", "documents integration", "liste documents"],
  "onboarding.contract_send": ["envoi contrat", "contrat arrivee"],
  "offboarding.exit_interview_schedule": ["entretien depart", "exit interview"],
  "offboarding.termination_letter_draft": ["lettre licenciement", "licencie", "lettre de rupture"],
  "offboarding.access_revocation_note": ["revocation acces", "acces it", "desactivation"],
  "contract.renewal_reminder": ["renouvellement cdd", "echeance contrat"],
  "contract.amendment_draft": ["avenant contrat", "modification contrat"],
  "contract.termination_prep": ["rupture contrat", "preparation licenciement"],
  "contract.trial_period_followup": ["periode essai", "suivi essai"],
  "absence.absence_acknowledgment": ["accuse reception absence", "confirmer absence"],
  "absence.return_to_work_schedule": ["reprise travail", "retour poste"],
  "absence.long_absence_followup": ["longue absence", "absence prolongee"],
  "absence.medical_certificate_reminder": ["certificat medical", "justificatif absence"],
  "payroll.variable_element_prep": ["elements variables", "variable paie", "primes"],
  "payroll.salary_review_draft": ["revision salariale", "augmentation salaire"],
  "training.training_plan_draft": ["plan formation", "programme formation"],
  "training.training_reminder": ["formation obligatoire", "rappel formation"],
  "interview.annual_review_schedule": ["entretien annuel", "evaluation annuelle"],
  "interview.performance_note_draft": ["note performance", "evaluation performance"],
  "interview.disciplinary_prep": ["convocation disciplinaire", "procedure disciplinaire"],
  "document.work_certificate_draft": ["attestation de travail", "attestation travail", "certificat travail"],
  "document.reference_letter_draft": ["lettre recommandation", "reference professionnelle"],
  "communication.manager_alert": ["alerte manager", "signalement manager"],
  "communication.sensitive_communication_prep": ["communication sensible", "communication disciplinaire"],
};

// ══════════════════════════════════════════════════════════
// 1. CATALOG ACCESS
// ══════════════════════════════════════════════════════════

export function getEmployeeActionCatalog(): PierreEmployeeActionCatalogItem[] {
  return EMPLOYEE_ACTION_CATALOG;
}

export function getEmployeeActionById(id: string): PierreEmployeeActionCatalogItem | null {
  return EMPLOYEE_ACTION_CATALOG.find((a) => a.id === id) ?? null;
}

export function getEmployeeActionsByDomain(
  domain: PierreEmployeeActionDomain,
): PierreEmployeeActionCatalogItem[] {
  return EMPLOYEE_ACTION_CATALOG.filter((a) => a.domain === domain);
}

// ══════════════════════════════════════════════════════════
// 2. INFERENCE
// ══════════════════════════════════════════════════════════

export function inferEmployeeActionDomain(text: string): PierreEmployeeActionDomain {
  for (const entry of Object.entries(DOMAIN_SIGNALS) as Array<[PierreEmployeeActionDomain, string[]]>) {
    const [domain, signals] = entry;
    if (signals.length > 0 && hasAny(text, signals)) return domain;
  }
  return "general";
}

export function inferEmployeeActionType(text: string): string | null {
  const t = normalizeText(text);
  for (const [actionType, signals] of Object.entries(ACTION_TYPE_SIGNALS)) {
    if (signals.some((s) => t.includes(normalizeText(s)))) return actionType;
  }
  const domain = inferEmployeeActionDomain(text);
  const items = getEmployeeActionsByDomain(domain);
  return items.length > 0 ? items[0].action_type : null;
}

// ══════════════════════════════════════════════════════════
// 3. RISK & GOVERNANCE
// ══════════════════════════════════════════════════════════

export function classifyEmployeeActionRisk(
  action_type: string,
  context?: Partial<PierreEmployeeActionContext>,
): PierreEmployeeActionRisk {
  const item = getEmployeeActionById(action_type);
  if (!item) return "orange";

  let risk = item.risk;

  if (
    context?.status === "offboarding" &&
    RISK_RANK[risk] < RISK_RANK["orange"]
  ) {
    risk = "orange";
  }

  if (
    normalizeText(action_type).match(/licenci|disciplin|terminat|sensitive/)
  ) {
    if (RISK_RANK[risk] < RISK_RANK["red"]) risk = "red";
  }

  return risk;
}

export function resolveEmployeeActionGovernance(
  action_type: string,
  context?: Partial<PierreEmployeeActionContext>,
): PierreEmployeeActionGovernance {
  const item = getEmployeeActionById(action_type);
  if (!item) return "approval_required";

  let governance = item.governance;

  const risk = classifyEmployeeActionRisk(action_type, context);
  if (risk === "black") governance = "blocked";
  else if (risk === "red" && GOVERNANCE_RANK[governance] < GOVERNANCE_RANK["manual_only"]) {
    governance = "manual_only";
  }

  return governance;
}

export function isEmployeeActionAutoSafe(
  action_type: string,
  context?: Partial<PierreEmployeeActionContext>,
): boolean {
  return resolveEmployeeActionGovernance(action_type, context) === "auto_safe";
}

// ══════════════════════════════════════════════════════════
// 4. CONFIDENCE SCORING
// ══════════════════════════════════════════════════════════

export function scoreEmployeeActionConfidence(
  action_type: string,
  employee: Record<string, unknown>,
  missions: Record<string, unknown>[],
  tasks: Record<string, unknown>[],
): number {
  const item = getEmployeeActionById(action_type);
  if (!item) return 0;

  let score = 0.5;

  const status = asStr(employee.status);
  const contractType = asStr(employee.contract_type);

  if (item.domain === "onboarding" && status === "onboarding") score += 0.30;
  if (item.domain === "offboarding" && status === "offboarding") score += 0.30;
  if (item.domain === "contract" && contractType === "cdd" && action_type === "contract.renewal_reminder") score += 0.25;
  if (item.domain === "contract" && contractType === "cdd" && action_type === "contract.trial_period_followup") score += 0.15;

  const missionText = missions.map((m) => asStr(m.mission_summary) ?? "").join(" ");
  if (item.domain === "absence" && hasAny(missionText, ["absence", "arret", "conge"])) score += 0.20;
  if (item.domain === "training" && hasAny(missionText, ["formation", "certification"])) score += 0.15;

  const pendingTasks = tasks.filter((t) => {
    const s = asStr(t.status);
    return s === "ready" || s === "awaiting_approval";
  });
  if (pendingTasks.length > 0 && item.domain === "followup") score += 0.15;
  if (item.domain === "document" && item.action_type === "document.employee_file_update") score += 0.10;

  if (item.risk === "red") score -= 0.15;
  else if (item.risk === "orange") score -= 0.05;

  return Math.min(1, Math.max(0, parseFloat(score.toFixed(2))));
}

// ══════════════════════════════════════════════════════════
// 5. SUGGESTIONS & PLAN
// ══════════════════════════════════════════════════════════

export function buildEmployeeActionSuggestions(
  employee: Record<string, unknown>,
  missions: Record<string, unknown>[],
  tasks: Record<string, unknown>[],
): PierreEmployeeActionSuggestion[] {
  const status = asStr(employee.status);
  const contractType = asStr(employee.contract_type);

  const hasPendingTasks = tasks.some((t) => {
    const s = asStr(t.status);
    return s === "ready" || s === "awaiting_approval";
  });

  const missionText = missions.map((m) => asStr(m.mission_summary) ?? "").join(" ");

  const suggestions: PierreEmployeeActionSuggestion[] = [];

  for (const item of EMPLOYEE_ACTION_CATALOG) {
    let include = false;
    let reason = "";

    if (item.domain === "onboarding" && status === "onboarding") {
      include = true;
      reason = "Salarié en phase d'intégration.";
    } else if (item.domain === "offboarding" && status === "offboarding") {
      include = true;
      reason = "Salarié en cours de départ.";
    } else if (item.action_type === "contract.renewal_reminder" && contractType === "cdd") {
      include = true;
      reason = "Contrat à durée déterminée — échéance à surveiller.";
    } else if (item.action_type === "contract.trial_period_followup" && contractType === "cdd") {
      include = true;
      reason = "Période d'essai à suivre.";
    } else if (
      item.domain === "absence" &&
      hasAny(missionText, ["absence", "arret", "conge", "maladie"])
    ) {
      include = true;
      reason = "Mission liée à une absence détectée.";
    } else if (
      item.domain === "training" &&
      hasAny(missionText, ["formation", "certification", "habilitation"])
    ) {
      include = true;
      reason = "Mission liée à une formation détectée.";
    } else if (hasPendingTasks && (item.domain === "followup")) {
      include = true;
      reason = "Tâches en attente de traitement.";
    } else if (item.action_type === "document.employee_file_update") {
      include = true;
      reason = "Mise à jour dossier salarié recommandée.";
    } else if (item.action_type === "note.employee_observation" && missions.length > 0) {
      include = true;
      reason = "Activité enregistrée sur ce salarié.";
    }

    if (!include) continue;

    const ctxStatus = status ?? undefined;
    suggestions.push({
      action_type: item.action_type,
      domain: item.domain,
      label_fr: item.label_fr,
      reason,
      risk: classifyEmployeeActionRisk(item.action_type, { status: ctxStatus }),
      governance: resolveEmployeeActionGovernance(item.action_type, { status: ctxStatus }),
      confidence: scoreEmployeeActionConfidence(item.action_type, employee, missions, tasks),
    });
  }

  return suggestions.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return RISK_RANK[a.risk] - RISK_RANK[b.risk];
  });
}

export function buildEmployeeActionPlan(
  employee: Record<string, unknown>,
  missions: Record<string, unknown>[],
  tasks: Record<string, unknown>[],
  now?: Date,
): PierreEmployeeActionPlan {
  const employeeId = asStr(employee.id) ?? "unknown";
  const employeeName = asStr(employee.full_name);
  const suggestions = buildEmployeeActionSuggestions(employee, missions, tasks);

  const auto_safe_count = suggestions.filter((s) => s.governance === "auto_safe").length;
  const approval_required_count = suggestions.filter((s) => s.governance === "approval_required").length;
  const blocked_count = suggestions.filter((s) => s.governance === "blocked").length;
  const manual_only_count = suggestions.filter((s) => s.governance === "manual_only").length;

  const next_action =
    suggestions.find((s) => s.governance === "auto_safe") ??
    suggestions[0] ??
    null;

  return {
    employee_id: employeeId,
    employee_name: employeeName,
    suggested_actions: suggestions,
    auto_safe_count,
    approval_required_count,
    blocked_count,
    manual_only_count,
    next_action,
    generated_at: (now ?? new Date()).toISOString(),
  };
}

// ══════════════════════════════════════════════════════════
// 6. SUMMARY & DOMAIN HELPERS
// ══════════════════════════════════════════════════════════

export function getEmployeeActionDomainsActive(
  suggestions: PierreEmployeeActionSuggestion[],
): PierreEmployeeActionDomain[] {
  const seen = new Set<PierreEmployeeActionDomain>();
  for (const s of suggestions) seen.add(s.domain);
  return Array.from(seen);
}

export function buildEmployeeActionSummary(
  suggestions: PierreEmployeeActionSuggestion[],
): PierreEmployeeActionSummary {
  return {
    total_actions: suggestions.length,
    auto_safe: suggestions.filter((s) => s.governance === "auto_safe").length,
    approval_required: suggestions.filter((s) => s.governance === "approval_required").length,
    manual_only: suggestions.filter((s) => s.governance === "manual_only").length,
    blocked: suggestions.filter((s) => s.governance === "blocked").length,
    has_sensitive: suggestions.some((s) => s.risk === "red" || s.risk === "black"),
    domains_active: getEmployeeActionDomainsActive(suggestions),
  };
}

// ══════════════════════════════════════════════════════════
// 7. TASK DRAFT & ACTION RESULT
// ══════════════════════════════════════════════════════════

export function buildEmployeeActionTaskDraft(
  action_type: string,
  context: PierreEmployeeActionContext,
): PierreEmployeeActionTaskDraft {
  const item = getEmployeeActionById(action_type);
  const governance = resolveEmployeeActionGovernance(action_type, context);
  const approval_required = governance !== "auto_safe";

  const status: PierreEmployeeActionTaskDraft["status"] =
    governance === "blocked"
      ? "blocked"
      : approval_required
      ? "awaiting_approval"
      : "ready";

  return {
    type: action_type,
    title: item?.label_fr ?? action_type,
    description: item?.description ?? "",
    status,
    approval_required,
    execute_at: null,
    payload_json: {
      employee_id: context.employee_id,
      employee_name: context.employee_name ?? null,
      department: context.department ?? null,
      contract_type: context.contract_type ?? null,
      action_type,
      action_domain: context.action_domain ?? item?.domain ?? null,
      ...(context.meta ?? {}),
    },
  };
}

export function resolveEmployeeActionResult(
  action_type: string,
  context: PierreEmployeeActionContext,
): PierreEmployeeActionResult {
  const item = getEmployeeActionById(action_type);
  const risk = classifyEmployeeActionRisk(action_type, context);
  const governance = resolveEmployeeActionGovernance(action_type, context);
  const allowed_to_auto_execute = governance === "auto_safe";
  const domain = item?.domain ?? null;

  let explanation: string;
  if (governance === "blocked") {
    explanation = "Action bloquée — non autorisée.";
  } else if (governance === "manual_only") {
    explanation = "Action sensible — supervision humaine obligatoire.";
  } else if (governance === "approval_required") {
    explanation = "Approbation RH requise avant exécution.";
  } else {
    explanation = "Action sûre — peut être exécutée automatiquement.";
  }

  const task_draft =
    governance === "auto_safe" || governance === "approval_required"
      ? buildEmployeeActionTaskDraft(action_type, context)
      : null;

  return {
    action_type,
    domain,
    risk,
    governance,
    allowed_to_auto_execute,
    explanation,
    task_draft,
  };
}

// ══════════════════════════════════════════════════════════
// 8. FILTERS
// ══════════════════════════════════════════════════════════

export function filterEmployeeActionsByGovernance(
  actions: PierreEmployeeActionSuggestion[],
  governance: PierreEmployeeActionGovernance,
): PierreEmployeeActionSuggestion[] {
  return actions.filter((a) => a.governance === governance);
}

export function filterEmployeeActionsByRisk(
  actions: PierreEmployeeActionSuggestion[],
  max_risk: PierreEmployeeActionRisk,
): PierreEmployeeActionSuggestion[] {
  const maxRank = RISK_RANK[max_risk];
  return actions.filter((a) => RISK_RANK[a.risk] <= maxRank);
}

// ══════════════════════════════════════════════════════════
// 9. TRACE & AUDIT
// ══════════════════════════════════════════════════════════

export function buildEmployeeActionTrace(
  action_type: string,
  employee_id: string,
  context?: Record<string, unknown>,
  now?: Date,
): PierreEmployeeActionTrace {
  const risk = classifyEmployeeActionRisk(action_type);
  const governance = resolveEmployeeActionGovernance(action_type);
  const item = getEmployeeActionById(action_type);
  const id = "ea_" + simpleHash(employee_id + ":" + action_type);

  return {
    id,
    employee_id,
    action_type,
    domain: item?.domain ?? null,
    risk,
    governance,
    created_at: (now ?? new Date()).toISOString(),
    meta: context ?? {},
  };
}

export function buildEmployeeActionAuditMeta(
  action_type: string,
  employee_id: string,
  governance: PierreEmployeeActionGovernance,
  risk: PierreEmployeeActionRisk,
): Record<string, unknown> {
  const item = getEmployeeActionById(action_type);
  return {
    action_type,
    employee_id,
    governance,
    risk,
    domain: item?.domain ?? null,
    allowed_to_auto_execute: governance === "auto_safe",
    requires_human: governance !== "auto_safe",
    label_fr: item?.label_fr ?? action_type,
  };
}

// ══════════════════════════════════════════════════════════
// 10. INDEX
// ══════════════════════════════════════════════════════════

export function buildEmployeeActionsIndex(
  employees: Record<string, unknown>[],
  allMissions: Record<string, unknown>[],
  allTasks: Record<string, unknown>[],
): Record<string, PierreEmployeeActionPlan> {
  const index: Record<string, PierreEmployeeActionPlan> = {};

  for (const emp of employees) {
    if (!isObject(emp)) continue;
    const empId = asStr(emp.id);
    if (!empId) continue;

    const empMissions = allMissions.filter((m) => {
      const ctx = isObject(m.employee_context) ? m.employee_context : null;
      return asStr(ctx?.employee_id) === empId || asStr(m.employee_id) === empId;
    });

    const empTasks = allTasks.filter((t) => {
      const payload = isObject(t.payload_json) ? t.payload_json : null;
      return asStr(payload?.employee_id) === empId || asStr(t.employee_id) === empId;
    });

    try {
      index[empId] = buildEmployeeActionPlan(emp, empMissions, empTasks);
    } catch (_e) { /* skip malformed */ }
  }

  return index;
}
