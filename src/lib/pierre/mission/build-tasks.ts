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
      return "Produire lâ€™offre dâ€™emploi";
    case "convocation_entretien":
      return "RÃ©diger la convocation dâ€™entretien";
    case "refus_candidat":
      return "RÃ©diger le refus candidat";
    case "onboarding":
      return "PrÃ©parer le document dâ€™onboarding";
    case "note_rh":
      return "RÃ©diger la note RH";
    case "rappel_procedure":
      return "RÃ©diger le rappel de procÃ©dure";
    case "compte_rendu":
      return "RÃ©diger le compte rendu";
    case "courrier_rh":
      return "RÃ©diger le courrier RH";
    case "communication_interne_rh":
      return "RÃ©diger la communication RH interne";
    default:
      return "Produire le document RH";
  }
}

function buildDocumentDescription(
  classification: PierreMissionClassification,
): string {
  switch (classification) {
    case "offre_emploi":
      return "CrÃ©er une offre dâ€™emploi claire, crÃ©dible, structurÃ©e et alignÃ©e avec le ton de lâ€™entreprise.";
    case "convocation_entretien":
      return "RÃ©diger une convocation dâ€™entretien propre, lisible, prÃ©cise et professionnelle.";
    case "refus_candidat":
      return "RÃ©diger un refus candidat respectueux, humain et traÃ§able.";
    case "onboarding":
      return "PrÃ©parer un document dâ€™intÃ©gration clair, opÃ©rationnel et rassurant.";
    case "note_rh":
      return "Structurer une note RH propre et facilement diffusable.";
    case "rappel_procedure":
      return "RÃ©diger un rappel de procÃ©dure clair, ferme si nÃ©cessaire, et comprÃ©hensible.";
    case "compte_rendu":
      return "Formaliser un compte rendu RH exploitable, propre et traÃ§able.";
    case "courrier_rh":
      return "RÃ©diger un courrier RH formel, cohÃ©rent et maÃ®trisÃ©.";
    case "communication_interne_rh":
      return "PrÃ©parer une communication interne RH claire et bien cadrÃ©e.";
    default:
      return "Produire un livrable RH premium Ã  partir de la mission libre.";
  }
}

function buildEmailTitle(
  classification: PierreMissionClassification,
): string {
  switch (classification) {
    case "convocation_entretien":
      return "PrÃ©parer lâ€™email de convocation";
    case "refus_candidat":
      return "PrÃ©parer lâ€™email de refus";
    case "relance_candidat":
      return "PrÃ©parer lâ€™email de relance";
    case "onboarding":
      return "PrÃ©parer lâ€™email dâ€™onboarding";
    case "communication_interne_rh":
      return "PrÃ©parer lâ€™email de communication interne";
    default:
      return "PrÃ©parer lâ€™email RH";
  }
}

function buildEmailDescription(
  classification: PierreMissionClassification,
): string {
  switch (classification) {
    case "convocation_entretien":
      return "PrÃ©parer un email clair de convocation dâ€™entretien avec les informations pratiques nÃ©cessaires.";
    case "refus_candidat":
      return "PrÃ©parer un email de refus candidat propre, respectueux et cohÃ©rent avec lâ€™image de lâ€™entreprise.";
    case "relance_candidat":
      return "PrÃ©parer un email de relance RH clair, poli et actionnable.";
    case "onboarding":
      return "PrÃ©parer un email dâ€™intÃ©gration structurÃ© et rassurant.";
    case "communication_interne_rh":
      return "PrÃ©parer un email interne RH lisible et directement diffusable.";
    default:
      return "PrÃ©parer un email RH traÃ§able, cohÃ©rent et contrÃ´lable.";
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
    lower.includes("piÃ¨ce jointe")
  ) {
    tasks.push({
      type: "generate_pdf",
      title: "PrÃ©parer lâ€™export PDF",
      description:
        "GÃ©nÃ©rer un PDF propre Ã  partir du livrable RH final ou dâ€™un document joint Ã  une communication.",
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
    lower.includes("si pas de rÃ©ponse")
  ) {
    tasks.push({
      type: "schedule_follow_up",
      title: "PrÃ©parer la relance RH",
      description:
        "Programmer une relance propre, traÃ§able et contrÃ´lÃ©e si aucune rÃ©ponse nâ€™est obtenue.",
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
        "Suspendre lâ€™exÃ©cution complÃ¨te tant que les informations essentielles Ã  une action RH propre et sÃ»re ne sont pas rÃ©unies.",
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
        "EmpÃªcher lâ€™exÃ©cution tant que la demande reste hors pÃ©rimÃ¨tre ou incompatible avec les rÃ¨gles de sÃ©curitÃ© RH de Pierre.",
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
        "CrÃ©er un cadre dâ€™exÃ©cution RH exploitable Ã  partir de la demande libre.",
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
