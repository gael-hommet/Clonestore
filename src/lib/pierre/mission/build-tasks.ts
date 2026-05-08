import type {
  PierreMissionClassification,
} from "./classify";
import type {
  PierreMissionRiskLevel,
} from "./risk";

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

export type PierreBuildTasksInput = {
  rawInput: string;
  classification: PierreMissionClassification;
  language: string;
  tone: string;
  risk_level: PierreMissionRiskLevel;
  approval_required: boolean;
  missing_info: string[];
  missing_info_questions: string[];
  refusals?: string[];
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

  if (
    lower.includes("plus tard aujourd'hui") ||
    lower.includes("plus tard aujourd hui")
  ) {
    const date = new Date(now);
    date.setHours(Math.max(now.getHours() + 2, 16), 0, 0, 0);
    return date.toISOString();
  }

  return null;
}

function baseStatus(params: {
  missingInfoCount: number;
  approvalRequired: boolean;
  scheduledFor: string | null;
  blocked: boolean;
}): PierreMissionTaskStatus {
  if (params.blocked) return "blocked";
  if (params.missingInfoCount > 0) return "awaiting_info";
  if (params.approvalRequired) return "awaiting_approval";
  if (params.scheduledFor) return "scheduled";
  return "queued";
}

function classificationNeedsDocument(
  classification: PierreMissionClassification,
): boolean {
  return [
    "offre_emploi",
    "convocation_entretien",
    "refus_candidat",
    "onboarding",
    "note_rh",
    "rappel_procedure",
    "compte_rendu",
    "courrier_rh",
    "communication_interne_rh",
  ].includes(classification);
}

function classificationNeedsEmail(
  classification: PierreMissionClassification,
): boolean {
  return [
    "convocation_entretien",
    "refus_candidat",
    "relance_candidat",
    "onboarding",
    "communication_interne_rh",
  ].includes(classification);
}

function classificationCanGeneratePdf(
  classification: PierreMissionClassification,
): boolean {
  return [
    "offre_emploi",
    "convocation_entretien",
    "refus_candidat",
    "onboarding",
    "note_rh",
    "courrier_rh",
    "compte_rendu",
  ].includes(classification);
}

function buildDocumentTitle(
  classification: PierreMissionClassification,
): string {
  switch (classification) {
    case "offre_emploi":
      return "Produire l’offre d’emploi";
    case "convocation_entretien":
      return "Rédiger la convocation d’entretien";
    case "refus_candidat":
      return "Rédiger le refus candidat";
    case "onboarding":
      return "Préparer le document d’onboarding";
    case "note_rh":
      return "Rédiger la note RH";
    case "rappel_procedure":
      return "Rédiger le rappel de procédure";
    case "compte_rendu":
      return "Rédiger le compte rendu";
    case "courrier_rh":
      return "Rédiger le courrier RH";
    case "communication_interne_rh":
      return "Rédiger la communication RH interne";
    default:
      return "Produire le document RH";
  }
}

function buildDocumentDescription(
  classification: PierreMissionClassification,
): string {
  switch (classification) {
    case "offre_emploi":
      return "Créer une offre d’emploi claire, crédible, structurée et alignée avec le ton de l’entreprise.";
    case "convocation_entretien":
      return "Rédiger une convocation d’entretien propre, lisible, précise et professionnelle.";
    case "refus_candidat":
      return "Rédiger un refus candidat respectueux, humain et traçable.";
    case "onboarding":
      return "Préparer un document d’intégration clair, opérationnel et rassurant.";
    case "note_rh":
      return "Structurer une note RH propre et facilement diffusable.";
    case "rappel_procedure":
      return "Rédiger un rappel de procédure clair, ferme si nécessaire, et compréhensible.";
    case "compte_rendu":
      return "Formaliser un compte rendu RH exploitable, propre et traçable.";
    case "courrier_rh":
      return "Rédiger un courrier RH formel, cohérent et maîtrisé.";
    case "communication_interne_rh":
      return "Préparer une communication interne RH claire et bien cadrée.";
    default:
      return "Produire un livrable RH premium à partir de la mission libre.";
  }
}

function buildEmailTitle(
  classification: PierreMissionClassification,
): string {
  switch (classification) {
    case "convocation_entretien":
      return "Préparer l’email de convocation";
    case "refus_candidat":
      return "Préparer l’email de refus";
    case "relance_candidat":
      return "Préparer l’email de relance";
    case "onboarding":
      return "Préparer l’email d’onboarding";
    case "communication_interne_rh":
      return "Préparer l’email de communication interne";
    default:
      return "Préparer l’email RH";
  }
}

function buildEmailDescription(
  classification: PierreMissionClassification,
): string {
  switch (classification) {
    case "convocation_entretien":
      return "Préparer un email clair de convocation d’entretien avec les informations pratiques nécessaires.";
    case "refus_candidat":
      return "Préparer un email de refus candidat propre, respectueux et cohérent avec l’image de l’entreprise.";
    case "relance_candidat":
      return "Préparer un email de relance RH clair, poli et actionnable.";
    case "onboarding":
      return "Préparer un email d’intégration structuré et rassurant.";
    case "communication_interne_rh":
      return "Préparer un email interne RH lisible et directement diffusable.";
    default:
      return "Préparer un email RH traçable, cohérent et contrôlable.";
  }
}

export function buildMissionTasks(
  input: PierreBuildTasksInput,
): PierreMissionTaskDraft[] {
  const lower = normalizeText(input.rawInput);
  const scheduledFor = detectScheduling(input.rawInput);
  const refusals = input.refusals || [];

  const tasks: PierreMissionTaskDraft[] = [];

  const blockedByRefusal = refusals.length > 0;
  const commonStatus = baseStatus({
    missingInfoCount: input.missing_info.length,
    approvalRequired: input.approval_required,
    scheduledFor,
    blocked: blockedByRefusal,
  });

  if (classificationNeedsDocument(input.classification)) {
    tasks.push({
      type: "generate_document",
      title: buildDocumentTitle(input.classification),
      description: buildDocumentDescription(input.classification),
      status: commonStatus,
      approval_required: input.approval_required,
      risk_level: input.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        classification: input.classification,
        language: input.language,
        tone: input.tone,
      },
    });
  }

  if (
    classificationNeedsEmail(input.classification) ||
    lower.includes("email") ||
    lower.includes("mail") ||
    lower.includes("envoyer") ||
    lower.includes("send")
  ) {
    tasks.push({
      type: "prepare_email",
      title: buildEmailTitle(input.classification),
      description: buildEmailDescription(input.classification),
      status: commonStatus === "queued" && scheduledFor ? "scheduled" : commonStatus,
      approval_required: input.approval_required,
      risk_level: input.risk_level,
      scheduled_for: scheduledFor,
      payload: {
        source: "mission_engine",
        classification: input.classification,
        language: input.language,
        tone: input.tone,
        scheduled_for: scheduledFor,
      },
    });
  }

  if (
    classificationCanGeneratePdf(input.classification) ||
    lower.includes("pdf") ||
    lower.includes("export") ||
    lower.includes("piece jointe") ||
    lower.includes("pièce jointe")
  ) {
    tasks.push({
      type: "generate_pdf",
      title: "Préparer l’export PDF",
      description:
        "Générer un PDF propre à partir du livrable RH final ou d’un document joint à une communication.",
      status: commonStatus,
      approval_required: input.approval_required,
      risk_level: input.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
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
      title: "Préparer la relance RH",
      description:
        "Programmer une relance propre, traçable et contrôlée si aucune réponse n’est obtenue.",
      status:
        blockedByRefusal
          ? "blocked"
          : input.missing_info.length > 0
            ? "awaiting_info"
            : "scheduled",
      approval_required: true,
      risk_level: input.risk_level,
      scheduled_for: scheduledFor,
      payload: {
        source: "mission_engine",
        conditional: true,
      },
    });
  }

  if (input.missing_info.length > 0) {
    tasks.push({
      type: "request_missing_info",
      title: "Demander les informations manquantes",
      description:
        "Suspendre l’exécution complète tant que les informations essentielles à une action RH propre et sûre ne sont pas réunies.",
      status: "awaiting_info",
      approval_required: false,
      risk_level: input.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        missing_info: input.missing_info,
        questions: input.missing_info_questions,
      },
    });
  }

  if (refusals.length > 0) {
    tasks.push({
      type: "block_mission",
      title: "Bloquer la mission",
      description:
        "Empêcher l’exécution tant que la demande reste hors périmètre ou incompatible avec les règles de sécurité RH de Pierre.",
      status: "blocked",
      approval_required: true,
      risk_level: input.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        refusals,
      },
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      type: "structure_mission",
      title: "Structurer la mission RH",
      description:
        "Créer un cadre d’exécution RH exploitable à partir de la demande libre.",
      status: commonStatus,
      approval_required: input.approval_required,
      risk_level: input.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        classification: input.classification,
      },
    });
  }

  return tasks;
}
export { buildMissionTasks as buildPierreTasks };
