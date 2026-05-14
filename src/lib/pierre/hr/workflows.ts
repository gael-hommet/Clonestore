// ═══════════════════════════════════════════════════════════
// Pierre HR Workflow Engine V1 — pure, no DB, no async
// ═══════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────

export type PierreHrWorkflowDomain =
  | "hiring"
  | "onboarding"
  | "absence"
  | "contract"
  | "payroll_prep"
  | "employee_file"
  | "training"
  | "interview"
  | "offboarding"
  | "sensitive_case"
  | "general_hr";

export type PierreHrWorkflowRiskLevel = "green" | "orange" | "red" | "black";

export type PierreHrWorkflowPriority = "low" | "normal" | "high" | "urgent";

export type PierreHrWorkflowMissingInfo = {
  field: string;
  question: string;
  required: boolean;
};

export type PierreHrWorkflowValidationPolicy = {
  approval_required: boolean;
  approval_reason: string | null;
  blocked: boolean;
  can_execute_low_risk_tasks: boolean;
};

export type PierreHrWorkflowNextAction = {
  type: "provide_info" | "validate" | "execute" | "escalate";
  description: string;
};

export type PierreHrWorkflowTaskDraft = {
  type: string;
  title: string;
  description: string;
  status: "ready" | "awaiting_approval" | "blocked";
  approval_required: boolean;
  execute_at: string | null;
  payload_json: Record<string, unknown>;
};

export type PierreHrWorkflowAnalysis = {
  input: string;
  domain: PierreHrWorkflowDomain;
  risk_level: PierreHrWorkflowRiskLevel;
  priority: PierreHrWorkflowPriority;
  signals: string[];
  language: "fr" | "en";
  tone: string;
  has_employee_reference: boolean;
  employee_name_detected: string | null;
  missing_info: PierreHrWorkflowMissingInfo[];
  approval_required: boolean;
  validation_policy: PierreHrWorkflowValidationPolicy;
  employee_context: Record<string, unknown> | null;
};

export type PierreHrWorkflowPlan = {
  domain: PierreHrWorkflowDomain;
  summary: string;
  priority: PierreHrWorkflowPriority;
  risk_level: PierreHrWorkflowRiskLevel;
  approval_required: boolean;
  validation_policy: PierreHrWorkflowValidationPolicy;
  can_execute_low_risk_tasks: boolean;
  employee_context: Record<string, unknown> | null;
  missing_info: string[];
  missing_info_questions: string[];
  tasks: PierreHrWorkflowTaskDraft[];
  blocked_actions: string[];
  recommended_next_action: PierreHrWorkflowNextAction;
  explanation: string;
};

// ── Helpers ───────────────────────────────────────────────────

function lower(s: string): string {
  return s.toLowerCase();
}

function hasAny(text: string, keywords: string[]): boolean {
  const t = lower(text);
  return keywords.some((k) => t.includes(k));
}

// ── Signal detection ──────────────────────────────────────────

const DOMAIN_SIGNALS: Record<PierreHrWorkflowDomain, string[]> = {
  sensitive_case: [
    "sanction", "licenciement", "licencie", "harcèlement", "harcelement",
    "discrimination", "conflit", "plainte", "prud'hommes", "prudhommes",
    "disciplinaire", "accident grave", "faute grave", "faute lourde",
    "avertissement formel", "mise en demeure", "rupture forcée",
    "rupture forcee", "atteinte", "agressions", "agression",
  ],
  offboarding: [
    "départ", "depart", "sortie salarié", "sortie salarie", "démission",
    "demission", "fin cdd", "fin de cdd", "fin de contrat", "rupture conventionnelle",
    "offboarding", "solde tout compte", "documents de fin", "quitte",
    "clôture dossier", "cloture dossier",
  ],
  contract: [
    "contrat", "avenant", "renouvellement contrat", "période d'essai",
    "periode d'essai", "clause", "temps de travail", "durée de travail",
    "rémunération contrat", "conditions contrat", "modification contrat",
  ],
  hiring: [
    "embauche", "recrute", "recrutement", "nouveau salarié", "nouveau salarie",
    "cdi", "cdd", "temps partiel", "dpae", "promesse d'embauche",
    "promesse embauche", "lettre d'offre", "lettre offre", "candidat retenu",
    "prise de poste", "arrivée prévue", "arrivee prevue",
  ],
  payroll_prep: [
    "paie", "pré-paie", "prepaie", "salaire", "prime", "bulletin",
    "heures supplémentaires", "heures supplementaires", "variable paie",
    "export paie", "éléments de paie", "elements de paie", "rémunération mensuelle",
    "remuneratin mensuelle", "note de frais paie", "mutuelle", "prévoyance",
  ],
  absence: [
    "absent", "absence", "congé", "conge", "arrêt", "arret", "maladie",
    "justificatif", "retard", "accident travail", "at/mp", "mi-temps",
    "mi temps thérapeutique", "mi temps therapeutique", "prolongation",
    "congé maladie", "conge maladie", "absence injustifiée", "absence injustifiee",
  ],
  onboarding: [
    "onboarding", "intégration", "integration", "arrivée", "arrivee",
    "premier jour", "welcome", "bienvenue", "accueil salarié", "accueil salarie",
    "checklist arrivée", "checklist arrivee", "parcours d'intégration",
    "parcours integration", "badge", "matériel informatique",
  ],
  employee_file: [
    "dossier salarié", "dossier salarie", "pièce manquante", "piece manquante",
    "documents manquants", "fiche salarié", "fiche salarie", "archive salarié",
    "archive salarie", "dossier incomplet", "complétude dossier", "completude dossier",
    "cnaps", "cnpas", "registre", "attestation",
  ],
  training: [
    "formation", "habilitation", "sécurité formation", "securite formation",
    "plan de formation", "cpf", "opco", "montée en compétence",
    "montee en competence", "certification", "e-learning",
  ],
  interview: [
    "entretien", "entretien annuel", "entretien professionnel",
    "entretien rh", "entretien manager", "convocation entretien",
    "bilan annuel", "eea", "ep",
  ],
  general_hr: [],
};

export function extractPierreHrWorkflowSignals(input: string): string[] {
  const t = lower(input);
  const found: string[] = [];
  for (const [, signals] of Object.entries(DOMAIN_SIGNALS)) {
    for (const sig of signals) {
      if (t.includes(sig) && !found.includes(sig)) {
        found.push(sig);
      }
    }
  }
  return found;
}

// ── Domain detection ──────────────────────────────────────────

export function detectPierreHrWorkflowDomain(
  input: string,
  context?: Record<string, unknown> | null,
): PierreHrWorkflowDomain {
  const t = lower(input);
  const ctxDomain = context?.domain ?? context?.workflow_domain ?? context?.hr_domain;
  if (typeof ctxDomain === "string" && ctxDomain.length > 0) {
    const known: PierreHrWorkflowDomain[] = [
      "hiring", "onboarding", "absence", "contract", "payroll_prep",
      "employee_file", "training", "interview", "offboarding",
      "sensitive_case", "general_hr",
    ];
    const normalized = ctxDomain.toLowerCase().trim() as PierreHrWorkflowDomain;
    if (known.includes(normalized)) return normalized;
  }

  // Priority order: most dangerous first
  const ordered: PierreHrWorkflowDomain[] = [
    "sensitive_case", "offboarding", "contract", "hiring", "payroll_prep",
    "absence", "onboarding", "employee_file", "training", "interview",
  ];

  for (const domain of ordered) {
    if (hasAny(t, DOMAIN_SIGNALS[domain])) return domain;
  }

  return "general_hr";
}

// ── Risk detection ────────────────────────────────────────────

const BLACK_SIGNALS = [
  "licenciement", "licencie", "harcèlement", "harcelement",
  "discrimination", "faute grave", "faute lourde", "prud'hommes",
  "prudhommes", "sanction disciplinaire", "accident grave", "agression",
  "mise en demeure", "tribunal", "atteinte",
];

const RED_SIGNALS = [
  "avertissement", "mise à pied", "mise a pied", "conflit salarié",
  "conflit salarie", "absence injustifiée", "absence injustifiee",
  "rupture conventionnelle", "contrat", "avenant", "démission sous pression",
  "demission sous pression", "arrêt maladie longue durée",
  "arret maladie longue duree", "sanction", "plainte",
];

const ORANGE_SIGNALS = [
  "absence", "congé", "conge", "justificatif", "paie", "prime",
  "salaire", "embauche", "recrutement", "offboarding", "départ",
  "depart", "formation obligatoire", "bulletin",
];

export function detectPierreHrWorkflowRisk(
  input: string,
  domain: PierreHrWorkflowDomain,
  context?: Record<string, unknown> | null,
): PierreHrWorkflowRiskLevel {
  const t = lower(input);

  // Domain-level baseline
  const domainRisk: Record<PierreHrWorkflowDomain, PierreHrWorkflowRiskLevel> = {
    sensitive_case: "black",
    contract: "red",
    offboarding: "orange",
    payroll_prep: "orange",
    hiring: "orange",
    absence: "green",
    onboarding: "green",
    employee_file: "green",
    training: "green",
    interview: "green",
    general_hr: "green",
  };

  let risk: PierreHrWorkflowRiskLevel = domainRisk[domain];

  // Context override (can only escalate)
  const ctxRisk = context?.risk_level ?? context?.hr_risk_level;
  if (typeof ctxRisk === "string") {
    const r = lower(ctxRisk) as PierreHrWorkflowRiskLevel;
    const rank = { green: 0, orange: 1, red: 2, black: 3 };
    if (rank[r] !== undefined && rank[r] > rank[risk]) {
      risk = r;
    }
  }

  // Signal escalation (most severe wins)
  if (hasAny(t, BLACK_SIGNALS)) return "black";
  if (hasAny(t, RED_SIGNALS) && risk !== "black") {
    if (risk === "green" || risk === "orange") risk = "red";
  } else if (hasAny(t, ORANGE_SIGNALS) && risk === "green") {
    risk = "orange";
  }

  // Absence injustifiée / maladie répétée → red
  if (domain === "absence") {
    if (
      t.includes("injustifi") ||
      t.includes("répétée") || t.includes("repetee") ||
      t.includes("maladie chronique") ||
      t.includes("licenciement pour absence")
    ) {
      risk = "red";
    }
  }

  return risk;
}

// ── Priority detection ────────────────────────────────────────

export function detectPierreHrWorkflowPriority(
  input: string,
  domain: PierreHrWorkflowDomain,
  risk?: PierreHrWorkflowRiskLevel,
): PierreHrWorkflowPriority {
  const t = lower(input);
  const r = risk ?? "green";

  if (r === "black") return "urgent";

  const urgentSignals = [
    "urgent", "immédiatement", "immediatement", "dès aujourd'hui",
    "des aujourd'hui", "aujourd'hui", "maintenant", "asap",
    "en urgence", "avant ce soir", "avant demain matin",
  ];
  if (hasAny(t, urgentSignals)) return "urgent";

  if (r === "red") return "high";
  if (domain === "sensitive_case") return "urgent";
  if (domain === "offboarding" && r === "orange") return "high";
  if (domain === "payroll_prep") return "high";

  const highSignals = [
    "prioritaire", "rapidement", "vite", "semaine", "délai",
    "echeance", "échéance", "deadline",
  ];
  if (hasAny(t, highSignals)) return "high";

  if (r === "orange") return "normal";
  return "low";
}

// ── Missing info ──────────────────────────────────────────────

export function buildPierreHrMissingInfo(
  domain: PierreHrWorkflowDomain,
  input: string,
  employeeContext?: Record<string, unknown> | null,
): PierreHrWorkflowMissingInfo[] {
  const t = lower(input);
  const hasEmployee = Boolean(
    employeeContext?.employee_name || employeeContext?.employee_id,
  );
  const hasEmail = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(input);
  const hasDate = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/.test(input);
  const hasPersonName = /\b[A-ZÀ-Ÿ][a-zà-ÿ'-]+\s+[A-ZÀ-Ÿ][a-zà-ÿ'-]+\b/.test(input);

  const missing: PierreHrWorkflowMissingInfo[] = [];

  switch (domain) {
    case "hiring":
      if (!hasEmployee && !hasPersonName)
        missing.push({ field: "employee_name", question: "Quel est le nom complet du candidat ?", required: false });
      if (!t.includes("cdi") && !t.includes("cdd") && !t.includes("temps partiel") && !t.includes("type de contrat"))
        missing.push({ field: "contract_type", question: "Quel est le type de contrat (CDI, CDD, temps partiel) ?", required: true });
      if (!hasDate)
        missing.push({ field: "start_date", question: "Quelle est la date de prise de poste prévue ?", required: true });
      break;

    case "onboarding":
      if (!hasEmployee && !hasPersonName)
        missing.push({ field: "employee_name", question: "Quel est le nom du salarié concerné par l'onboarding ?", required: false });
      if (!hasDate)
        missing.push({ field: "start_date", question: "Quelle est la date d'arrivée prévue ?", required: false });
      break;

    case "absence":
      if (!hasEmployee && !hasPersonName)
        missing.push({ field: "employee_name", question: "Quel est le nom du salarié absent ?", required: true });
      if (!hasDate)
        missing.push({ field: "absence_dates", question: "Quelles sont les dates d'absence (début, fin) ?", required: true });
      if (!t.includes("justificatif") && !t.includes("médical") && !t.includes("medical") && !t.includes("raison"))
        missing.push({ field: "absence_reason", question: "Quelle est la raison de l'absence ? (maladie, congé, accident...)", required: false });
      break;

    case "contract":
      if (!hasEmployee && !hasPersonName)
        missing.push({ field: "employee_name", question: "Quel est le nom du salarié concerné par ce contrat / avenant ?", required: true });
      if (!t.includes("cdi") && !t.includes("cdd") && !t.includes("avenant"))
        missing.push({ field: "contract_type", question: "Quel est le type de contrat ou d'avenant ?", required: true });
      if (!hasDate)
        missing.push({ field: "effective_date", question: "Quelle est la date d'effet du contrat / avenant ?", required: true });
      break;

    case "payroll_prep":
      if (!hasDate)
        missing.push({ field: "pay_period", question: "Pour quelle période de paie prépare-t-on la synthèse ?", required: true });
      if (!t.includes("variable") && !t.includes("prime") && !t.includes("heures sup") && !t.includes("anomalie"))
        missing.push({ field: "variable_elements", question: "Y a-t-il des éléments variables à traiter (primes, heures sup, absences) ?", required: false });
      break;

    case "employee_file":
      if (!hasEmployee && !hasPersonName)
        missing.push({ field: "employee_name", question: "Quel est le nom du salarié dont on traite le dossier ?", required: true });
      break;

    case "training":
      if (!t.includes("quelle formation") && !t.includes("formation "))
        missing.push({ field: "training_name", question: "Quel est l'intitulé de la formation concernée ?", required: false });
      break;

    case "interview":
      if (!hasEmployee && !hasPersonName)
        missing.push({ field: "employee_name", question: "Quel est le nom du salarié concerné par cet entretien ?", required: true });
      if (!hasDate)
        missing.push({ field: "interview_date", question: "Quelle est la date et l'heure prévue de l'entretien ?", required: true });
      break;

    case "offboarding":
      if (!hasEmployee && !hasPersonName)
        missing.push({ field: "employee_name", question: "Quel est le nom du salarié qui part ?", required: true });
      if (!hasDate)
        missing.push({ field: "departure_date", question: "Quelle est la date de départ officielle ?", required: true });
      break;

    case "sensitive_case":
      if (!hasEmployee && !hasPersonName)
        missing.push({ field: "employee_name", question: "Quel(s) est/sont le(s) salarié(s) concerné(s) ?", required: true });
      if (!t.includes("fait") && !t.includes("contexte") && !t.includes("date"))
        missing.push({ field: "incident_description", question: "Pouvez-vous décrire les faits avec dates et contexte ?", required: true });
      break;

    case "general_hr":
      // No mandatory missing info — general request
      if (!hasEmployee && !hasPersonName && (t.includes("salarié") || t.includes("salarie") || t.includes("employé") || t.includes("employe")))
        missing.push({ field: "employee_name", question: "Quel est le nom du salarié concerné ?", required: false });
      break;
  }

  // Remove if email explicitly not needed
  if (t.includes("aucun email") || t.includes("pas d'email") || t.includes("pas email") || t.includes("sans email")) {
    return missing.filter((m) => m.field !== "email");
  }

  // Remove employee_name if explicitly stated no specific employee
  if (
    t.includes("aucun salarié") || t.includes("aucun salarie") ||
    t.includes("pas de salarié spécifique") || t.includes("pas de salarie specifique") ||
    t.includes("salarie specifique") || t.includes("général") || t.includes("general")
  ) {
    return missing.filter((m) => m.field !== "employee_name");
  }

  return missing;
}

// ── Validation policy ─────────────────────────────────────────

function buildValidationPolicy(
  domain: PierreHrWorkflowDomain,
  risk: PierreHrWorkflowRiskLevel,
): PierreHrWorkflowValidationPolicy {
  const isSensitive = domain === "sensitive_case";
  const isContractual = domain === "contract";
  const isPayroll = domain === "payroll_prep";
  const isHighRisk = risk === "red" || risk === "black";
  const isOffboardingHigh = domain === "offboarding" && isHighRisk;

  const approval_required =
    isSensitive || isContractual || isPayroll || isOffboardingHigh || isHighRisk;

  let approval_reason: string | null = null;
  if (isSensitive) approval_reason = "Cas sensible RH : toute action nécessite une validation humaine explicite.";
  else if (isContractual) approval_reason = "Document contractuel : validation juridique et managériale obligatoire avant toute signature.";
  else if (isPayroll) approval_reason = "Données de paie : validation obligatoire avant transmission au service paie.";
  else if (isHighRisk) approval_reason = "Risque RH élevé : validation humaine requise avant toute exécution.";

  return {
    approval_required,
    approval_reason,
    blocked: isSensitive,
    can_execute_low_risk_tasks: !isSensitive,
  };
}

// ── Task builders per domain ──────────────────────────────────

function makeTask(
  type: string,
  title: string,
  description: string,
  status: PierreHrWorkflowTaskDraft["status"],
  approval_required: boolean,
  payloadExtra: Record<string, unknown>,
  domain: PierreHrWorkflowDomain,
  risk_level: PierreHrWorkflowRiskLevel,
  step: string,
): PierreHrWorkflowTaskDraft {
  return {
    type,
    title,
    description,
    status,
    approval_required,
    execute_at: null,
    payload_json: {
      domain,
      risk_level,
      workflow_step: step,
      artifact_expected: type,
      ...payloadExtra,
    },
  };
}

function buildHiringTasks(a: PierreHrWorkflowAnalysis): PierreHrWorkflowTaskDraft[] {
  const ap = a.validation_policy.approval_required;
  const st = ap ? "awaiting_approval" : "ready";
  return [
    makeTask("doc.generate", "Préparer le dossier d'embauche",
      "Rédiger le dossier d'embauche : fiche de poste, checklist DPAE, synthèse administrative.",
      st, ap, { source: "mission_engine", doc_type: "document_embauche", hr_task_kind: "document_rh" }, "hiring", a.risk_level, "dossier_embauche"),
    makeTask("email.draft", "Demander les pièces justificatives au candidat",
      "Préparer un email de demande de pièces : pièce d'identité, RIB, diplômes, etc.",
      "ready", false, { source: "mission_engine", doc_type: "email_draft", hr_task_kind: "email_candidat" }, "hiring", a.risk_level, "demande_pieces"),
    makeTask("reminder.create", "Rappel pièces manquantes J+3",
      "Programmer un rappel automatique si les pièces ne sont pas reçues sous 3 jours.",
      "ready", false, { source: "mission_engine", conditional: true, days_delay: 3, hr_task_kind: "rappel_echeance" }, "hiring", a.risk_level, "rappel_pieces"),
    makeTask("followup.schedule", "Suivi signature et validation",
      "Suivre l'avancement de la signature du contrat et des validations administratives.",
      "ready", false, { source: "mission_engine", hr_task_kind: "relance" }, "hiring", a.risk_level, "suivi_signature"),
  ];
}

function buildOnboardingTasks(a: PierreHrWorkflowAnalysis): PierreHrWorkflowTaskDraft[] {
  return [
    makeTask("doc.generate", "Préparer la checklist d'onboarding",
      "Générer la checklist d'intégration : accueil, matériel, accès, présentation équipe.",
      "ready", false, { source: "mission_engine", doc_type: "document_onboarding", hr_task_kind: "onboarding_prep" }, "onboarding", a.risk_level, "checklist_onboarding"),
    makeTask("email.draft", "Préparer l'email de bienvenue",
      "Rédiger l'email de bienvenue pour le nouveau salarié avec les informations pratiques.",
      "ready", false, { source: "mission_engine", doc_type: "email_bienvenue", hr_task_kind: "email_salarie" }, "onboarding", a.risk_level, "email_bienvenue"),
    makeTask("reminder.create", "Rappel manager J-1",
      "Envoyer un rappel au manager la veille de l'arrivée pour préparer l'accueil.",
      "ready", false, { source: "mission_engine", days_before: 1, hr_task_kind: "rappel_echeance" }, "onboarding", a.risk_level, "rappel_manager"),
    makeTask("followup.schedule", "Suivi intégration J+7",
      "Programmer un point de suivi d'intégration à J+7 pour vérifier le bon déroulement.",
      "ready", false, { source: "mission_engine", days_delay: 7, hr_task_kind: "relance" }, "onboarding", a.risk_level, "suivi_integration"),
  ];
}

function buildAbsenceTasks(a: PierreHrWorkflowAnalysis): PierreHrWorkflowTaskDraft[] {
  const ap = a.validation_policy.approval_required;
  const st = ap ? "awaiting_approval" : "ready";
  return [
    makeTask("doc.generate", "Préparer la note de suivi d'absence",
      "Rédiger une note de suivi RH traçant l'absence, les dates, le motif connu et les actions prévues.",
      st, ap, { source: "mission_engine", doc_type: "document_absence", hr_task_kind: ap ? "absence_sensible" : "document_rh" }, "absence", a.risk_level, "note_absence"),
    makeTask("email.draft", "Demander le justificatif au salarié",
      "Préparer un email de demande de justificatif d'absence dans les délais légaux.",
      "ready", false, { source: "mission_engine", doc_type: "email_draft", hr_task_kind: "email_salarie" }, "absence", a.risk_level, "demande_justificatif"),
    makeTask("followup.schedule", "Relance justificatif si non reçu",
      "Programmer une relance automatique si le justificatif n'est pas reçu sous 48h.",
      "ready", false, { source: "mission_engine", conditional: true, hours_delay: 48, hr_task_kind: "relance" }, "absence", a.risk_level, "relance_justificatif"),
    makeTask("reminder.create", "Signaler impact pré-paie",
      "Créer un rappel pour intégrer l'absence dans la synthèse de pré-paie du mois.",
      "ready", false, { source: "mission_engine", hr_task_kind: "rappel_echeance" }, "absence", a.risk_level, "impact_prepaie"),
  ];
}

function buildContractTasks(a: PierreHrWorkflowAnalysis): PierreHrWorkflowTaskDraft[] {
  return [
    makeTask("doc.generate", "Préparer le document contractuel",
      "Rédiger le projet de contrat ou d'avenant selon les données disponibles. Validation obligatoire avant tout usage.",
      "awaiting_approval", true, {
        source: "mission_engine", doc_type: "document_contractuel",
        hr_task_kind: "document_contractuel",
        validation_reason: "Document contractuel : validation juridique et managériale requise.",
        approval_required: true,
      }, "contract", a.risk_level, "document_contrat"),
    makeTask("email.draft", "Préparer l'email de transmission pour validation",
      "Préparer un email d'envoi du brouillon pour validation interne avant signature.",
      "awaiting_approval", true, {
        source: "mission_engine", doc_type: "email_draft",
        hr_task_kind: "document_contractuel",
        approval_required: true,
      }, "contract", a.risk_level, "envoi_validation"),
    makeTask("followup.schedule", "Suivi de la signature",
      "Programmer un suivi pour s'assurer que la signature est obtenue dans les délais.",
      "ready", false, { source: "mission_engine", hr_task_kind: "relance" }, "contract", a.risk_level, "suivi_signature"),
  ];
}

function buildPayrollPrepTasks(a: PierreHrWorkflowAnalysis): PierreHrWorkflowTaskDraft[] {
  return [
    makeTask("doc.generate", "Synthèse pré-paie",
      "Préparer la synthèse pré-paie : éléments variables, absences, primes, heures supplémentaires.",
      "awaiting_approval", true, {
        source: "mission_engine", doc_type: "document_paie",
        hr_task_kind: "prepaie_prep",
        validation_reason: "Données de paie : validation obligatoire avant transmission.",
        approval_required: true,
      }, "payroll_prep", a.risk_level, "synthese_prepaie"),
    makeTask("reminder.create", "Signaler anomalies et informations manquantes",
      "Créer un rappel listant les anomalies détectées ou informations manquantes pour la paie.",
      "ready", false, { source: "mission_engine", hr_task_kind: "demande_info" }, "payroll_prep", a.risk_level, "anomalies_paie"),
    makeTask("followup.schedule", "Relances justificatifs paie",
      "Programmer des relances pour obtenir les justificatifs manquants avant clôture.",
      "ready", false, { source: "mission_engine", hr_task_kind: "relance" }, "payroll_prep", a.risk_level, "relances_justificatifs"),
  ];
}

function buildEmployeeFileTasks(a: PierreHrWorkflowAnalysis): PierreHrWorkflowTaskDraft[] {
  return [
    makeTask("doc.generate", "Synthèse du dossier salarié",
      "Générer une synthèse de l'état du dossier salarié : pièces présentes, pièces manquantes, conformité.",
      "ready", false, { source: "mission_engine", doc_type: "document_rh", hr_task_kind: "rapport_standard" }, "employee_file", a.risk_level, "synthese_dossier"),
    makeTask("email.draft", "Demander les pièces manquantes au salarié",
      "Préparer un email de relance pour les pièces manquantes du dossier.",
      "ready", false, { source: "mission_engine", doc_type: "email_draft", hr_task_kind: "demande_info" }, "employee_file", a.risk_level, "demande_pieces"),
    makeTask("reminder.create", "Relance complétion dossier",
      "Créer un rappel de suivi pour s'assurer de la complétion du dossier dans les délais.",
      "ready", false, { source: "mission_engine", hr_task_kind: "rappel_echeance" }, "employee_file", a.risk_level, "relance_completion"),
    makeTask("followup.schedule", "Suivi complétude dossier",
      "Programmer un contrôle de complétude du dossier à J+14.",
      "ready", false, { source: "mission_engine", days_delay: 14, hr_task_kind: "relance" }, "employee_file", a.risk_level, "suivi_completude"),
  ];
}

function buildTrainingTasks(a: PierreHrWorkflowAnalysis): PierreHrWorkflowTaskDraft[] {
  return [
    makeTask("doc.generate", "Préparer le plan de formation",
      "Générer le document de plan de formation : objectifs, dates, salarié(s) concerné(s), formateur.",
      "ready", false, { source: "mission_engine", doc_type: "document_rh", hr_task_kind: "rapport_standard" }, "training", a.risk_level, "plan_formation"),
    makeTask("email.draft", "Préparer la convocation de formation",
      "Rédiger la convocation officielle à la formation avec toutes les informations pratiques.",
      "ready", false, { source: "mission_engine", doc_type: "email_draft", hr_task_kind: "email_salarie" }, "training", a.risk_level, "convocation_formation"),
    makeTask("reminder.create", "Rappel formation J-2",
      "Envoyer un rappel au salarié et au manager 2 jours avant la formation.",
      "ready", false, { source: "mission_engine", days_before: 2, hr_task_kind: "rappel_echeance" }, "training", a.risk_level, "rappel_formation"),
    makeTask("followup.schedule", "Suivi complétion formation",
      "Programmer un suivi pour confirmer la réalisation de la formation et le recueil des justificatifs.",
      "ready", false, { source: "mission_engine", hr_task_kind: "relance" }, "training", a.risk_level, "suivi_formation"),
  ];
}

function buildInterviewTasks(a: PierreHrWorkflowAnalysis): PierreHrWorkflowTaskDraft[] {
  return [
    makeTask("doc.generate", "Préparer la trame d'entretien",
      "Générer une trame d'entretien structurée adaptée au type d'entretien (annuel, professionnel, RH).",
      "ready", false, { source: "mission_engine", doc_type: "document_rh", hr_task_kind: "trame_entretien" }, "interview", a.risk_level, "trame_entretien"),
    makeTask("email.draft", "Préparer la convocation d'entretien",
      "Rédiger la convocation officielle avec date, heure, lieu et objet de l'entretien.",
      "ready", false, { source: "mission_engine", doc_type: "email_draft", hr_task_kind: "email_salarie" }, "interview", a.risk_level, "convocation_entretien"),
    makeTask("reminder.create", "Rappel manager et salarié",
      "Envoyer un rappel au manager et au salarié la veille de l'entretien.",
      "ready", false, { source: "mission_engine", days_before: 1, hr_task_kind: "rappel_echeance" }, "interview", a.risk_level, "rappel_entretien"),
    makeTask("followup.schedule", "Compte rendu d'entretien",
      "Programmer la production du compte rendu d'entretien après la réunion.",
      "ready", false, { source: "mission_engine", hr_task_kind: "compte_rendu" }, "interview", a.risk_level, "compte_rendu"),
  ];
}

function buildOffboardingTasks(a: PierreHrWorkflowAnalysis): PierreHrWorkflowTaskDraft[] {
  const ap = a.validation_policy.approval_required;
  const st = ap ? "awaiting_approval" : "ready";
  return [
    makeTask("doc.generate", "Préparer la checklist de sortie salarié",
      "Générer la checklist de sortie : restitution matériel, accès à révoquer, solde tout compte, documents légaux.",
      st, ap, { source: "mission_engine", doc_type: "document_rh", hr_task_kind: ap ? "offboarding_sensible" : "rapport_standard" }, "offboarding", a.risk_level, "checklist_sortie"),
    makeTask("email.draft", "Préparer le message de sortie",
      "Rédiger l'email de départ : remerciements, restitution matériel, documents à retourner.",
      st, ap, { source: "mission_engine", doc_type: "email_draft", hr_task_kind: ap ? "offboarding_sensible" : "email_salarie" }, "offboarding", a.risk_level, "message_sortie"),
    makeTask("reminder.create", "Documents de fin de contrat",
      "Créer un rappel pour s'assurer que tous les documents de fin de contrat sont transmis.",
      "ready", false, { source: "mission_engine", hr_task_kind: "rappel_echeance" }, "offboarding", a.risk_level, "documents_fin"),
    makeTask("followup.schedule", "Clôture du dossier salarié",
      "Programmer la vérification de clôture complète du dossier après le départ.",
      "ready", false, { source: "mission_engine", hr_task_kind: "relance" }, "offboarding", a.risk_level, "cloture_dossier"),
  ];
}

function buildSensitiveCaseTasks(a: PierreHrWorkflowAnalysis): PierreHrWorkflowTaskDraft[] {
  return [
    makeTask("doc.generate", "Préparer la synthèse factuelle",
      "Rédiger une synthèse factuelle et chronologique des éléments disponibles. Aucune décision incluse. Validation obligatoire.",
      "awaiting_approval", true, {
        source: "mission_engine", doc_type: "document_disciplinaire",
        hr_task_kind: "conflit_prelim",
        validation_reason: "Cas sensible : validation humaine obligatoire avant toute action.",
        approval_required: true,
      }, "sensitive_case", a.risk_level, "synthese_factuelle"),
    makeTask("doc.generate", "Préparer la chronologie des faits",
      "Documenter la chronologie précise des événements. Pierre ne formule aucune décision ni conclusion.",
      "awaiting_approval", true, {
        source: "mission_engine", doc_type: "document_disciplinaire",
        hr_task_kind: "conflit_prelim",
        validation_reason: "Chronologie sensible : validation humaine obligatoire.",
        approval_required: true,
      }, "sensitive_case", a.risk_level, "chronologie_faits"),
    makeTask("followup.schedule", "Soumettre pour validation humaine et arbitrage",
      "Soumettre le dossier à l'arbitrage humain pour décision. Pierre ne peut pas décider seul.",
      "awaiting_approval", true, {
        source: "mission_engine", hr_task_kind: "resolution_conflit_humain",
        validation_reason: "Décision réservée à l'humain.",
        approval_required: true,
        blocked: true,
      }, "sensitive_case", a.risk_level, "arbitrage_humain"),
  ];
}

function buildGeneralHrTasks(a: PierreHrWorkflowAnalysis): PierreHrWorkflowTaskDraft[] {
  return [
    makeTask("doc.generate", "Préparer le document RH",
      "Rédiger le livrable RH adapté à la demande. Contenu généré selon les informations disponibles.",
      "ready", false, { source: "mission_engine", doc_type: "document_rh", hr_task_kind: "document_rh" }, "general_hr", a.risk_level, "document_rh"),
    makeTask("followup.schedule", "Suivi de la demande RH",
      "Programmer un suivi pour s'assurer du traitement complet de la demande.",
      "ready", false, { source: "mission_engine", hr_task_kind: "relance" }, "general_hr", a.risk_level, "suivi_demande"),
  ];
}

export function buildPierreHrWorkflowTasks(
  analysis: PierreHrWorkflowAnalysis,
): PierreHrWorkflowTaskDraft[] {
  const { missing_info } = analysis;

  let tasks: PierreHrWorkflowTaskDraft[];

  switch (analysis.domain) {
    case "hiring":         tasks = buildHiringTasks(analysis); break;
    case "onboarding":     tasks = buildOnboardingTasks(analysis); break;
    case "absence":        tasks = buildAbsenceTasks(analysis); break;
    case "contract":       tasks = buildContractTasks(analysis); break;
    case "payroll_prep":   tasks = buildPayrollPrepTasks(analysis); break;
    case "employee_file":  tasks = buildEmployeeFileTasks(analysis); break;
    case "training":       tasks = buildTrainingTasks(analysis); break;
    case "interview":      tasks = buildInterviewTasks(analysis); break;
    case "offboarding":    tasks = buildOffboardingTasks(analysis); break;
    case "sensitive_case": tasks = buildSensitiveCaseTasks(analysis); break;
    default:               tasks = buildGeneralHrTasks(analysis);
  }

  // If there are required missing_info items, add a reminder.create task
  const requiredMissing = missing_info.filter((m) => m.required);
  if (requiredMissing.length > 0) {
    tasks.push({
      type: "reminder.create",
      title: "Informations manquantes à collecter",
      description: "Pierre a détecté des informations obligatoires manquantes. Ce rappel bloque l'exécution complète.",
      status: "blocked",
      approval_required: false,
      execute_at: null,
      payload_json: {
        domain: analysis.domain,
        risk_level: analysis.risk_level,
        workflow_step: "missing_info_collection",
        artifact_expected: "reminder.create",
        missing_info: requiredMissing.map((m) => m.field),
        missing_info_questions: requiredMissing.map((m) => m.question),
        source: "mission_engine",
        hr_task_kind: "demande_info",
      },
    });
  }

  // Enrich all tasks with employee context if available
  if (analysis.employee_context) {
    const ec = analysis.employee_context;
    tasks = tasks.map((t) => ({
      ...t,
      payload_json: {
        ...t.payload_json,
        employee_id: ec.employee_id ?? null,
        employee_name: ec.employee_name ?? null,
        employee_context: ec,
      },
    }));
  } else if (analysis.employee_name_detected) {
    tasks = tasks.map((t) => ({
      ...t,
      payload_json: {
        ...t.payload_json,
        employee_name: analysis.employee_name_detected,
      },
    }));
  }

  return tasks;
}

// ── DB task mapper ────────────────────────────────────────────

export function mapPierreWorkflowTaskToDbTask(task: PierreHrWorkflowTaskDraft): {
  type: string;
  title: string;
  description: string;
  status: string;
  approval_required: boolean;
  execute_at: string | null;
  payload_json: Record<string, unknown>;
} {
  return {
    type: task.type,
    title: task.title,
    description: task.description,
    status: task.status,
    approval_required: task.approval_required,
    execute_at: task.execute_at ?? null,
    payload_json: task.payload_json,
  };
}

// ── Blocked actions ───────────────────────────────────────────

function buildBlockedActions(domain: PierreHrWorkflowDomain, risk: PierreHrWorkflowRiskLevel): string[] {
  if (domain === "sensitive_case") {
    return [
      "Envoi direct sans validation humaine préalable",
      "Décision finale de sanction ou de licenciement",
      "Notification externe (salarié, avocat, inspection du travail)",
      "Modification ou suppression de pièces du dossier",
      "Formulation de conclusions disciplinaires",
    ];
  }
  if (risk === "black") {
    return [
      "Décision finale irréversible",
      "Communication externe sans validation",
    ];
  }
  if (domain === "contract") {
    return [
      "Signature sans validation managériale et juridique",
      "Envoi direct du contrat au salarié",
    ];
  }
  if (domain === "payroll_prep") {
    return [
      "Transmission directe au service paie sans validation",
    ];
  }
  return [];
}

// ── Language & tone detection ─────────────────────────────────

function detectLanguage(input: string): "fr" | "en" {
  const t = lower(input);
  const en = ["candidate", "interview", "job offer", "onboarding", "payroll", "employee", "contract"];
  return en.filter((s) => t.includes(s)).length >= 2 ? "en" : "fr";
}

function detectTone(input: string): string {
  const t = lower(input);
  if (t.includes("ferme") || t.includes("strict") || t.includes("formel")) return "ferme";
  if (t.includes("bienveillant") || t.includes("humain") || t.includes("chaleureux")) return "bienveillant";
  return "professionnel";
}

// ── Employee name detection ───────────────────────────────────

function detectEmployeeName(input: string): string | null {
  const match = /\b([A-ZÀ-Ÿ][a-zà-ÿ'-]+\s+[A-ZÀ-Ÿ][a-zà-ÿ'-]+)\b/.exec(input);
  return match ? match[1] : null;
}

// ── Summary builder ───────────────────────────────────────────

function buildWorkflowSummary(
  domain: PierreHrWorkflowDomain,
  risk: PierreHrWorkflowRiskLevel,
  input: string,
): string {
  const clipped = input.trim().length > 200 ? `${input.trim().slice(0, 197).trimEnd()}…` : input.trim();
  const domainLabel: Record<PierreHrWorkflowDomain, string> = {
    hiring: "Embauche / Recrutement",
    onboarding: "Intégration salarié",
    absence: "Gestion des absences",
    contract: "Documents contractuels",
    payroll_prep: "Préparation pré-paie",
    employee_file: "Dossier salarié",
    training: "Formation",
    interview: "Entretien RH",
    offboarding: "Sortie salarié",
    sensitive_case: "Cas sensible RH",
    general_hr: "Mission RH générale",
  };
  return `[${domainLabel[domain]} / risque ${risk}] ${clipped}`;
}

// ── Recommended next action ───────────────────────────────────

function buildRecommendedNextAction(
  domain: PierreHrWorkflowDomain,
  missingInfo: PierreHrWorkflowMissingInfo[],
  policy: PierreHrWorkflowValidationPolicy,
): PierreHrWorkflowNextAction {
  const required = missingInfo.filter((m) => m.required);
  if (required.length > 0) {
    return {
      type: "provide_info",
      description: `Fournir les informations obligatoires manquantes : ${required.map((m) => m.field).join(", ")}.`,
    };
  }
  if (domain === "sensitive_case") {
    return {
      type: "escalate",
      description: "Soumettre le dossier à l'arbitrage humain. Pierre ne peut pas traiter ce cas de manière autonome.",
    };
  }
  if (policy.approval_required) {
    return {
      type: "validate",
      description: "Valider les tâches produites par Pierre avant toute exécution ou diffusion.",
    };
  }
  return {
    type: "execute",
    description: "Les tâches sont prêtes. Lancer l'exécution des tâches à statut 'ready'.",
  };
}

// ── Main plan builder ─────────────────────────────────────────

export function buildPierreHrWorkflowPlan(
  input: string,
  options?: {
    autonomy_level?: string | null;
    employee_context?: Record<string, unknown> | null;
    execute_at?: string | null;
  },
): PierreHrWorkflowPlan {
  const safeInput = (typeof input === "string" ? input : "").trim();
  const employeeContext = options?.employee_context ?? null;

  const signals = extractPierreHrWorkflowSignals(safeInput);
  const domain = detectPierreHrWorkflowDomain(safeInput, employeeContext);
  const risk = detectPierreHrWorkflowRisk(safeInput, domain, employeeContext);
  const priority = detectPierreHrWorkflowPriority(safeInput, domain, risk);
  const language = detectLanguage(safeInput);
  const tone = detectTone(safeInput);
  const employeeNameDetected = detectEmployeeName(safeInput);
  const hasEmployeeRef = Boolean(employeeContext) || Boolean(employeeNameDetected);
  const missing = buildPierreHrMissingInfo(domain, safeInput, employeeContext);
  const validationPolicy = buildValidationPolicy(domain, risk);
  const approvalRequired = validationPolicy.approval_required;

  const analysis: PierreHrWorkflowAnalysis = {
    input: safeInput,
    domain,
    risk_level: risk,
    priority,
    signals,
    language,
    tone,
    has_employee_reference: hasEmployeeRef,
    employee_name_detected: employeeNameDetected,
    missing_info: missing,
    approval_required: approvalRequired,
    validation_policy: validationPolicy,
    employee_context: employeeContext,
  };

  let tasks = buildPierreHrWorkflowTasks(analysis);

  // Apply execute_at if provided (e.g. scheduled tasks)
  if (options?.execute_at) {
    tasks = tasks.map((t) =>
      t.type === "followup.schedule"
        ? { ...t, execute_at: options.execute_at ?? null }
        : t,
    );
  }

  const blockedActions = buildBlockedActions(domain, risk);
  const recommendedNextAction = buildRecommendedNextAction(domain, missing, validationPolicy);
  const summary = buildWorkflowSummary(domain, risk, safeInput);
  const explanation = explainPierreWorkflowPlan({
    domain,
    summary,
    priority,
    risk_level: risk,
    approval_required: approvalRequired,
    validation_policy: validationPolicy,
    can_execute_low_risk_tasks: validationPolicy.can_execute_low_risk_tasks,
    employee_context: employeeContext,
    missing_info: missing.map((m) => m.field),
    missing_info_questions: missing.map((m) => m.question),
    tasks,
    blocked_actions: blockedActions,
    recommended_next_action: recommendedNextAction,
    explanation: "",
  });

  return {
    domain,
    summary,
    priority,
    risk_level: risk,
    approval_required: approvalRequired,
    validation_policy: validationPolicy,
    can_execute_low_risk_tasks: validationPolicy.can_execute_low_risk_tasks,
    employee_context: employeeContext,
    missing_info: missing.map((m) => m.field),
    missing_info_questions: missing.map((m) => m.question),
    tasks,
    blocked_actions: blockedActions,
    recommended_next_action: recommendedNextAction,
    explanation,
  };
}

// ── Plan explainer ────────────────────────────────────────────

export function explainPierreWorkflowPlan(plan: PierreHrWorkflowPlan): string {
  const parts: string[] = [];

  const domainLabel: Record<PierreHrWorkflowDomain, string> = {
    hiring: "embauche / recrutement",
    onboarding: "intégration salarié",
    absence: "gestion des absences",
    contract: "documents contractuels",
    payroll_prep: "préparation pré-paie",
    employee_file: "dossier salarié",
    training: "formation",
    interview: "entretien RH",
    offboarding: "sortie salarié",
    sensitive_case: "cas sensible RH",
    general_hr: "mission RH générale",
  };

  parts.push(`Domaine identifié : ${domainLabel[plan.domain]}.`);

  const riskMsg: Record<PierreHrWorkflowRiskLevel, string> = {
    green: "Risque faible : Pierre peut traiter en autonomie partielle.",
    orange: "Risque modéré : validation recommandée avant diffusion.",
    red: "Risque élevé : validation humaine obligatoire avant toute exécution.",
    black: "Risque critique : décision réservée à l'humain — Pierre prépare uniquement.",
  };
  parts.push(riskMsg[plan.risk_level]);

  if (plan.missing_info.length > 0) {
    parts.push(`Informations manquantes détectées (${plan.missing_info.length}) : ${plan.missing_info.join(", ")}.`);
  }

  const ready = plan.tasks.filter((t) => t.status === "ready").length;
  const awaiting = plan.tasks.filter((t) => t.status === "awaiting_approval").length;
  const blocked = plan.tasks.filter((t) => t.status === "blocked").length;
  parts.push(`${plan.tasks.length} tâche(s) créée(s) : ${ready} prête(s), ${awaiting} en attente validation, ${blocked} bloquée(s).`);

  if (plan.blocked_actions.length > 0) {
    parts.push(`Actions bloquées (${plan.blocked_actions.length}) : Pierre ne peut PAS réaliser ces actions seul.`);
  }

  parts.push(`Prochaine action recommandée : ${plan.recommended_next_action.description}`);

  return parts.join(" ");
}
