import {
  classifyMission,
  type PierreMissionClassification,
} from "./classify";
import {
  type PierreHrDomain,
  type PierreHrRiskLevel,
  type PierreHrTaskKind,
  classifyPierreHrActionRequirement,
} from "../hr/contracts";

export type PierreMissionRiskLevel = "normal" | "sensitive" | "critical";
export type PierreMissionTaskStatus =
  | "pending"
  | "queued"
  | "scheduled"
  | "awaiting_info"
  | "awaiting_approval"
  | "blocked";

export type PierreMissionTaskDraft = {
  type: string;
  title: string;
  description: string;
  status: PierreMissionTaskStatus;
  approval_required: boolean;
  risk_level: PierreMissionRiskLevel;
  scheduled_for: string | null;
  payload: Record<string, unknown>;
};

export type PierreMissionInterpretInput = {
  input: string;
  context?: string | null;
};

export type PierreMissionInterpretation = {
  intent: string;
  classification: PierreMissionClassification;
  summary: string;
  language: string;
  tone: string;
  risk_level: PierreMissionRiskLevel;
  approval_required: boolean;
  missing_info: string[];
  missing_info_questions: string[];
  refusals: string[];
  hr_domain: PierreHrDomain;
  hr_risk_level: PierreHrRiskLevel;
  tasks: PierreMissionTaskDraft[];
  confidence: number;
  explainability: {
    classification_reasons: string[];
    matched_signals: string[];
  };
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function corpus(input: PierreMissionInterpretInput): string {
  return normalizeText([input.input, input.context || ""].filter(Boolean).join("\n"));
}

function detectLanguage(value: string): string {
  const lower = value.toLowerCase();
  const englishSignals = [
    "candidate",
    "interview",
    "job offer",
    "follow up",
    "please",
    "draft",
    "recruitment",
    "hiring",
  ];

  const hits = englishSignals.filter((signal) => lower.includes(signal)).length;
  return hits >= 2 ? "en" : "fr";
}

function detectTone(value: string): string {
  const lower = value.toLowerCase();

  if (
    lower.includes("ferme") ||
    lower.includes("strict") ||
    lower.includes("recadr") ||
    lower.includes("formal warning")
  ) {
    return "ferme";
  }

  if (
    lower.includes("humain") ||
    lower.includes("bienveillant") ||
    lower.includes("chaleureux")
  ) {
    return "humain";
  }

  if (
    lower.includes("direct") ||
    lower.includes("court") ||
    lower.includes("concis")
  ) {
    return "direct";
  }

  return "professionnel";
}

function detectIntent(value: string): string {
  const lower = value.toLowerCase();

  if (
    lower.includes("envoie") ||
    lower.includes("envoyer") ||
    lower.includes("send")
  ) {
    return "execute_rh_action";
  }

  if (
    lower.includes("prepare") ||
    lower.includes("prépare") ||
    lower.includes("redige") ||
    lower.includes("rédige") ||
    lower.includes("draft")
  ) {
    return "prepare_rh_deliverable";
  }

  if (
    lower.includes("programme") ||
    lower.includes("planifie") ||
    lower.includes("schedule")
  ) {
    return "schedule_rh_action";
  }

  if (lower.includes("relance") || lower.includes("follow up")) {
    return "follow_up_rh_action";
  }

  return "structure_rh_mission";
}

function detectRisk(
  text: string,
  classification: PierreMissionClassification,
): PierreMissionRiskLevel {
  const lower = text.toLowerCase();

  const criticalSignals = [
    "licenciement",
    "harcelement",
    "harcèlement",
    "contentieux",
    "prud'hommes",
    "discrimination",
    "sanction disciplinaire",
  ];

  const sensitiveSignals = [
    "avertissement",
    "mise a pied",
    "mise à pied",
    "conflit",
    "absence injustifiee",
    "absence injustifiée",
    "salaire",
    "confidentiel",
    "plainte",
  ];

  if (criticalSignals.some((signal) => lower.includes(signal))) return "critical";
  if (sensitiveSignals.some((signal) => lower.includes(signal))) return "sensitive";
  if (classification === "demande_sensible") return "sensitive";

  return "normal";
}

function needsApproval(
  value: string,
  risk: PierreMissionRiskLevel,
  classification: PierreMissionClassification,
): boolean {
  const lower = value.toLowerCase();

  if (risk === "critical") return true;
  if (classification === "demande_sensible") return true;

  const approvalSignals = [
    "apres validation",
    "après validation",
    "avant envoi",
    "a valider",
    "à valider",
    "validation manager",
    "validation humaine",
  ];

  return approvalSignals.some((signal) => lower.includes(signal)) || risk === "sensitive";
}

function detectScheduling(value: string): string | null {
  const lower = value.toLowerCase();
  const now = new Date();

  if (lower.includes("demain")) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return date.toISOString();
  }

  const hourMatch = lower.match(/\b(\d{1,2})h(\d{2})?\b/);
  if (hourMatch) {
    const date = new Date(now);
    const hours = Number(hourMatch[1]);
    const minutes = hourMatch[2] ? Number(hourMatch[2]) : 0;

    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      date.setHours(hours, minutes, 0, 0);
      if (date.getTime() < now.getTime()) {
        date.setDate(date.getDate() + 1);
      }
      return date.toISOString();
    }
  }

  return null;
}

function detectMissingInfo(
  rawInput: string,
  classification: PierreMissionClassification,
): { missing: string[]; questions: string[] } {
  const lower = rawInput.toLowerCase();
  const missing: string[] = [];
  const questions: string[] = [];

  const hasPersonName =
    /\b[A-ZÉÈÀÂÊÎÔÛÄËÏÖÜ][a-zéèàâêîôûäëïöü'-]+\s+[A-ZÉÈÀÂÊÎÔÛÄËÏÖÜ][a-zéèàâêîôûäëïöü'-]+\b/.test(
      rawInput,
    );
  const hasEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(rawInput);
  const hasDate = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/.test(rawInput);
  const hasHour = /\b\d{1,2}h(\d{2})?\b/i.test(rawInput);

  if (classification === "convocation_entretien" && !hasDate) {
    missing.push("Date d’entretien manquante");
    questions.push("Quelle est la date exacte de l’entretien ?");
  }

  if (classification === "convocation_entretien" && !hasHour) {
    missing.push("Horaire d’entretien manquant");
    questions.push("À quelle heure doit avoir lieu l’entretien ?");
  }

  if (
    (
      classification === "refus_candidat" ||
      classification === "relance_candidat" ||
      classification === "onboarding" ||
      classification === "convocation_entretien" ||
      classification === "candidature"
    ) &&
    !hasPersonName
  ) {
    missing.push("Nom complet de la personne concernée manquant");
    questions.push("Quel est le nom complet de la personne concernée ?");
  }

  if (
    (
      classification === "refus_candidat" ||
      classification === "relance_candidat" ||
      classification === "convocation_entretien"
    ) &&
    !hasEmail
  ) {
    missing.push("Adresse email destinataire manquante");
    questions.push("Quelle est l’adresse email du destinataire ?");
  }

  if (classification === "offre_emploi" && !lower.includes("poste")) {
    missing.push("Intitulé du poste absent ou insuffisant");
    questions.push("Quel est l’intitulé exact du poste ?");
  }

  return { missing, questions };
}

function detectRefusals(
  classification: PierreMissionClassification,
  risk: PierreMissionRiskLevel,
  value: string,
): string[] {
  const lower = value.toLowerCase();
  const refusals: string[] = [];

  if (classification === "hors_perimetre") {
    refusals.push(
      "Demande hors périmètre RH contrôlé de Pierre : prospection commerciale, marketing massif ou usage non RH.",
    );
  }

  if (
    risk === "critical" &&
    (
      lower.includes("decide seul") ||
      lower.includes("sans validation") ||
      lower.includes("envoie directement")
    )
  ) {
    refusals.push(
      "Pierre ne peut pas exécuter seul une action critique RH sans validation humaine explicite.",
    );
  }

  if (
    lower.includes("sanctionne") ||
    lower.includes("licencie directement") ||
    lower.includes("prends la decision juridique")
  ) {
    refusals.push(
      "Pierre ne prend pas seul de décision disciplinaire ou juridique.",
    );
  }

  return refusals;
}

function buildSummary(
  rawInput: string,
  classification: PierreMissionClassification,
  risk: PierreMissionRiskLevel,
): string {
  const cleaned = rawInput.trim().replace(/\s+/g, " ");
  const clipped = cleaned.length > 260 ? `${cleaned.slice(0, 257)}…` : cleaned;
  return `Mission RH classée "${classification}" avec niveau de risque "${risk}". Demande structurée à partir de : ${clipped}`;
}

function buildTasks(params: {
  rawInput: string;
  interpretationBase: Omit<PierreMissionInterpretation, "tasks">;
}): PierreMissionTaskDraft[] {
  const { rawInput, interpretationBase } = params;
  const lower = rawInput.toLowerCase();
  const scheduledFor = detectScheduling(rawInput);
  const tasks: PierreMissionTaskDraft[] = [];

  const requiresDraftDocument =
    interpretationBase.classification === "offre_emploi" ||
    interpretationBase.classification === "convocation_entretien" ||
    interpretationBase.classification === "refus_candidat" ||
    interpretationBase.classification === "onboarding" ||
    interpretationBase.classification === "note_rh" ||
    interpretationBase.classification === "courrier_rh" ||
    interpretationBase.classification === "compte_rendu" ||
    interpretationBase.classification === "rappel_procedure";

  if (requiresDraftDocument) {
    tasks.push({
      type: "generate_document",
      title: "Produire le document RH",
      description:
        "Rédiger un livrable RH premium cohérent avec la demande, la langue, le ton et le niveau de risque détectés.",
      status:
        interpretationBase.missing_info.length > 0
          ? "awaiting_info"
          : interpretationBase.approval_required
            ? "awaiting_approval"
            : "queued",
      approval_required: interpretationBase.approval_required,
      risk_level: interpretationBase.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        classification: interpretationBase.classification,
        language: interpretationBase.language,
        tone: interpretationBase.tone,
        ...buildHrPayload(interpretationBase.classification, "generate_document", interpretationBase.hr_domain, interpretationBase.hr_risk_level),
      },
    });
  }

  if (
    lower.includes("mail") ||
    lower.includes("email") ||
    lower.includes("envoyer") ||
    lower.includes("send") ||
    interpretationBase.classification === "refus_candidat" ||
    interpretationBase.classification === "convocation_entretien" ||
    interpretationBase.classification === "relance_candidat" ||
    interpretationBase.classification === "onboarding"
  ) {
    tasks.push({
      type: "prepare_email",
      title: "Préparer l’email RH",
      description:
        "Préparer un email traçable, clair et conforme au cadre RH de l’entreprise.",
      status:
        interpretationBase.missing_info.length > 0
          ? "awaiting_info"
          : interpretationBase.approval_required
            ? "awaiting_approval"
            : scheduledFor
              ? "scheduled"
              : "queued",
      approval_required: interpretationBase.approval_required,
      risk_level: interpretationBase.risk_level,
      scheduled_for: scheduledFor,
      payload: {
        source: "mission_engine",
        language: interpretationBase.language,
        tone: interpretationBase.tone,
        scheduled_for: scheduledFor,
        ...buildHrPayload(interpretationBase.classification, "prepare_email", interpretationBase.hr_domain, interpretationBase.hr_risk_level),
      },
    });
  }

  if (
    lower.includes("pdf") ||
    lower.includes("piece jointe") ||
    lower.includes("pièce jointe") ||
    lower.includes("export")
  ) {
    tasks.push({
      type: "generate_pdf",
      title: "Préparer l’export PDF",
      description:
        "Générer un PDF propre à partir du document ou du contenu RH finalisé.",
      status:
        interpretationBase.missing_info.length > 0
          ? "awaiting_info"
          : interpretationBase.approval_required
            ? "awaiting_approval"
            : "queued",
      approval_required: interpretationBase.approval_required,
      risk_level: interpretationBase.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        ...buildHrPayload(interpretationBase.classification, "generate_pdf", interpretationBase.hr_domain, interpretationBase.hr_risk_level),
      },
    });
  }

  if (
    lower.includes("relance") ||
    lower.includes("si pas de reponse") ||
    lower.includes("si pas de réponse")
  ) {
    tasks.push({
      type: "schedule_follow_up",
      title: "Préparer une relance RH",
      description:
        "Programmer une relance propre et traçable si aucune réponse n’est obtenue.",
      status:
        interpretationBase.approval_required || interpretationBase.missing_info.length > 0
          ? "awaiting_approval"
          : "scheduled",
      approval_required: true,
      risk_level: interpretationBase.risk_level,
      scheduled_for: scheduledFor,
      payload: {
        source: "mission_engine",
        conditional: true,
        ...buildHrPayload(interpretationBase.classification, "schedule_follow_up", interpretationBase.hr_domain, interpretationBase.hr_risk_level),
      },
    });
  }

  if (interpretationBase.missing_info.length > 0) {
    tasks.push({
      type: "request_missing_info",
      title: "Demander les informations manquantes",
      description:
        "Bloquer l’exécution complète tant que les éléments indispensables ne sont pas fournis.",
      status: "awaiting_info",
      approval_required: false,
      risk_level: interpretationBase.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        missing_info: interpretationBase.missing_info,
        questions: interpretationBase.missing_info_questions,
        ...buildHrPayload(interpretationBase.classification, "request_missing_info", interpretationBase.hr_domain, interpretationBase.hr_risk_level),
      },
    });
  }

  if (interpretationBase.refusals.length > 0) {
    tasks.push({
      type: "block_mission",
      title: "Bloquer l’exécution",
      description:
        "Bloquer la mission car la demande sort du cadre autorisé ou requiert un arbitrage humain préalable.",
      status: "blocked",
      approval_required: true,
      risk_level: interpretationBase.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        refusals: interpretationBase.refusals,
        ...buildHrPayload(interpretationBase.classification, "block_mission", interpretationBase.hr_domain, interpretationBase.hr_risk_level),
      },
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      type: "structure_mission",
      title: "Structurer la mission RH",
      description:
        "Créer un cadre d’exécution RH exploitable à partir de la demande libre.",
      status:
        interpretationBase.missing_info.length > 0
          ? "awaiting_info"
          : interpretationBase.approval_required
            ? "awaiting_approval"
            : "queued",
      approval_required: interpretationBase.approval_required,
      risk_level: interpretationBase.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        ...buildHrPayload(interpretationBase.classification, "structure_mission", interpretationBase.hr_domain, interpretationBase.hr_risk_level),
      },
    });
  }

  return tasks;
}

function mapClassificationToHrDomain(
  c: PierreMissionClassification,
): PierreHrDomain {
  switch (c) {
    case "recrutement": return "recruitment_ops";
    case "candidature": return "hiring";
    case "offre_emploi": return "hiring";
    case "convocation_entretien": return "interview";
    case "refus_candidat": return "recruitment_ops";
    case "relance_candidat": return "recruitment_ops";
    case "onboarding": return "onboarding";
    case "communication_interne_rh": return "internal_communication";
    case "rappel_procedure": return "compliance_workflow";
    case "note_rh": return "internal_communication";
    case "compte_rendu": return "hr_helpdesk";
    case "courrier_rh": return "employee_relations";
    case "mission_suivi": return "hr_helpdesk";
    case "demande_sensible": return "sensitive_case";
    case "hors_perimetre": return "unknown";
    case "mission_rh_generale": return "unknown";
  }
}

function missionRiskToHrRisk(risk: PierreMissionRiskLevel): PierreHrRiskLevel {
  if (risk === "critical") return "red";
  if (risk === "sensitive") return "orange";
  return "green";
}

function toHrTaskKind(
  classification: PierreMissionClassification,
  taskType: string,
): PierreHrTaskKind | null {
  if (taskType === "request_missing_info") return "demande_info";
  if (taskType === "schedule_follow_up") return "relance";
  if (taskType === "block_mission") return "decision_sanction";
  if (taskType === "structure_mission") return "creation_tache";
  if (taskType === "generate_pdf") return "document_rh";

  if (taskType === "generate_document") {
    switch (classification) {
      case "convocation_entretien": return "trame_entretien";
      case "onboarding": return "onboarding_prep";
      case "note_rh": return "synthese_interne";
      case "rappel_procedure": return "rapport_standard";
      case "compte_rendu": return "compte_rendu";
      case "courrier_rh": return "courrier_disciplinaire_prep";
      case "communication_interne_rh": return "email_salarie";
      case "demande_sensible": return "employee_relations_doc";
      default: return "document_rh";
    }
  }

  if (taskType === "prepare_email") {
    switch (classification) {
      case "refus_candidat": return "refus_candidat_formel";
      case "convocation_entretien": return "email_candidat";
      case "relance_candidat": return "email_candidat";
      default: return "email_salarie";
    }
  }

  return null;
}

function buildHrPayload(
  classification: PierreMissionClassification,
  taskType: string,
  hrDomain: PierreHrDomain,
  hrRisk: PierreHrRiskLevel,
): Record<string, unknown> {
  const kind = toHrTaskKind(classification, taskType);
  if (!kind) return { hr_domain: hrDomain, hr_risk_level: hrRisk };
  const req = classifyPierreHrActionRequirement({
    kind,
    domain: hrDomain,
    override_risk: hrRisk,
  });
  return {
    hr_task_kind: kind,
    hr_domain: hrDomain,
    hr_risk_level: req.risk_level,
    hr_action_class: req.action_class,
    hr_approval_policy: req.approval_policy,
    human_note: req.human_note,
  };
}

export function interpretMission(
  input: PierreMissionInterpretInput,
): PierreMissionInterpretation {
  const rawInput = input.input.trim();
  const fullCorpus = corpus(input);

  const classificationResult = classifyMission({
    input: rawInput,
    context: input.context || null,
  });

  const language = detectLanguage(fullCorpus);
  const tone = detectTone(fullCorpus);
  const riskLevel = detectRisk(fullCorpus, classificationResult.classification);
  const approvalRequired = needsApproval(
    fullCorpus,
    riskLevel,
    classificationResult.classification,
  );
  const missingInfo = detectMissingInfo(rawInput, classificationResult.classification);
  const refusals = detectRefusals(
    classificationResult.classification,
    riskLevel,
    fullCorpus,
  );
  const summary = buildSummary(
    rawInput,
    classificationResult.classification,
    riskLevel,
  );
  const intent = detectIntent(fullCorpus);

  const interpretationBase: Omit<PierreMissionInterpretation, "tasks"> = {
    intent,
    classification: classificationResult.classification,
    summary,
    language,
    tone,
    risk_level: riskLevel,
    approval_required: approvalRequired,
    missing_info: missingInfo.missing,
    missing_info_questions: missingInfo.questions,
    refusals,
    hr_domain: mapClassificationToHrDomain(classificationResult.classification),
    hr_risk_level: missionRiskToHrRisk(riskLevel),
    confidence: classificationResult.confidence,
    explainability: {
      classification_reasons: classificationResult.reasons,
      matched_signals: classificationResult.matchedSignals,
    },
  };

  return {
    ...interpretationBase,
    tasks: buildTasks({
      rawInput,
      interpretationBase,
    }),
  };
}

export { interpretMission as interpretPierreMission };
