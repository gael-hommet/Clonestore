import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  classifyPierreHrActionRequirement,
  type PierreHrTaskKind,
} from "../../../../../lib/pierre/hr/contracts";

type DbRow = Record<string, unknown>;

type AuthenticatedContext = {
  userId: string;
  accessToken: string | null;
};

type SubmitBody = {
  input: string;
  missionId?: string | null;
  context?: unknown;
};

type MissionRiskLevel = "normal" | "sensitive" | "critical";

type TaskLifecycleStatus =
  | "pending"
  | "queued"
  | "scheduled"
  | "awaiting_info"
  | "awaiting_approval"
  | "blocked";

type MissionTaskDraft = {
  type: string;
  title: string;
  description: string;
  status: TaskLifecycleStatus;
  approval_required: boolean;
  risk_level: MissionRiskLevel;
  scheduled_for: string | null;
  payload: Record<string, unknown>;
};

type MissionInterpretationBase = {
  intent: string;
  classification: string;
  summary: string;
  language: string;
  tone: string;
  risk_level: MissionRiskLevel;
  approval_required: boolean;
  missing_info: string[];
  missing_info_questions: string[];
};

type MissionInterpretation = MissionInterpretationBase & {
  tasks: MissionTaskDraft[];
};

type JsonErrorExtra = {
  code?: string | null;
  details?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function getNestedObject(
  source: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  if (!source) return null;
  const value = source[key];
  return isObject(value) ? value : null;
}

function getNestedString(
  source: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!source) return null;
  return asString(source[key]);
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(extra ?? {}),
    },
    { status },
  );
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function tryReadBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;

  return token.trim() || null;
}

function tryReadSupabaseCookieToken(request: NextRequest): string | null {
  const cookies = request.cookies.getAll();

  const directCandidates = [
    "sb-access-token",
    "supabase-access-token",
    "access-token",
  ];

  for (const key of directCandidates) {
    const found = request.cookies.get(key)?.value;
    if (found) return found;
  }

  for (const cookie of cookies) {
    if (!cookie.name.includes("auth-token")) continue;

    const raw = cookie.value;
    if (!raw) continue;

    try {
      const parsed: unknown = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        const candidate = parsed.find(
          (item): item is string =>
            typeof item === "string" && item.split(".").length === 3,
        );
        if (typeof candidate === "string") return candidate;
      }

      if (isObject(parsed)) {
        const currentSession = getNestedObject(parsed, "currentSession");

        const candidate =
          getNestedString(parsed, "access_token") ||
          getNestedString(currentSession, "access_token");

        if (candidate) return candidate;
      }
    } catch {
      if (raw.split(".").length === 3) return raw;
    }
  }

  return null;
}

async function authenticateRequest(
  request: NextRequest,
  supabaseAdmin: SupabaseClient,
): Promise<AuthenticatedContext> {
  const accessToken =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);

  if (!accessToken) {
    throw {
      status: 401,
      message: "Auth session missing.",
      code: "AUTH_SESSION_MISSING",
    };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw {
      status: 401,
      message: "Unable to authenticate request.",
      code: "AUTH_INVALID",
      details: error?.message || null,
    };
  }

  return {
    userId: data.user.id,
    accessToken,
  };
}

function mapDbError(error: unknown) {
  if (isObject(error)) {
    return {
      message:
        asString(error.message) ||
        asString(error.error_description) ||
        "Unexpected database error.",
      code: asString(error.code),
      details: error,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: null,
      details: null,
    };
  }

  return {
    message: "Unexpected database error.",
    code: null,
    details: null,
  };
}

function normalizeBody(raw: unknown): SubmitBody {
  if (!isObject(raw)) {
    return {
      input: "",
      missionId: null,
      context: null,
    };
  }

  return {
    input: asString(raw.input) || "",
    missionId: asString(raw.missionId),
    context: raw.context ?? null,
  };
}

function detectLanguage(input: string): string {
  const lower = input.toLowerCase();

  const englishSignals = [
    "candidate",
    "interview",
    "job offer",
    "follow up",
    "meeting",
    "please",
    "draft",
    "recruitment",
    "hiring",
  ];

  const englishHits = englishSignals.filter((signal) =>
    lower.includes(signal),
  ).length;

  return englishHits >= 2 ? "en" : "fr";
}

function detectTone(input: string): string {
  const lower = input.toLowerCase();

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
    lower.includes("professionnel") ||
    lower.includes("corporate") ||
    lower.includes("pro")
  ) {
    return "professionnel";
  }

  return "professionnel";
}

function detectClassification(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes("offre d'emploi") || lower.includes("job offer")) {
    return "offre_emploi";
  }
  if (lower.includes("convocation") || lower.includes("entretien")) {
    return "convocation_entretien";
  }
  if (lower.includes("refus") || lower.includes("rejet candidature")) {
    return "refus_candidat";
  }
  if (lower.includes("relance") || lower.includes("follow up")) {
    return "relance_rh";
  }
  if (lower.includes("onboarding") || lower.includes("intégration")) {
    return "onboarding";
  }
  if (lower.includes("note rh")) {
    return "note_rh";
  }
  if (lower.includes("procédure") || lower.includes("procedure")) {
    return "rappel_procedure";
  }
  if (lower.includes("compte rendu") || lower.includes("compte-rendu")) {
    return "compte_rendu";
  }
  if (lower.includes("courrier")) {
    return "courrier_rh";
  }
  if (lower.includes("candidat") || lower.includes("recrut")) {
    return "recrutement";
  }

  return "mission_rh_generale";
}

function detectIntent(input: string): string {
  const lower = input.toLowerCase();

  if (
    lower.includes("envoie") ||
    lower.includes("envoyer") ||
    lower.includes("send")
  ) {
    return "execute_rh_action";
  }
  if (
    lower.includes("prépare") ||
    lower.includes("prepare") ||
    lower.includes("rédige") ||
    lower.includes("redige") ||
    lower.includes("draft")
  ) {
    return "prepare_rh_deliverable";
  }
  if (lower.includes("relance")) {
    return "follow_up_rh_action";
  }
  if (lower.includes("programme") || lower.includes("planifie")) {
    return "schedule_rh_action";
  }

  return "structure_rh_mission";
}

function detectRisk(
  input: string,
  classification: string,
): MissionRiskLevel {
  const lower = input.toLowerCase();

  const criticalSignals = [
    "licenciement",
    "sanction disciplinaire",
    "harcèlement",
    "harcelement",
    "plainte",
    "contentieux",
    "prud'hommes",
    "discrimination",
    "rupture conventionnelle forcée",
  ];

  const sensitiveSignals = [
    "avertissement",
    "mise à pied",
    "mise a pied",
    "conflit",
    "problème salarié",
    "probleme salarie",
    "absence injustifiée",
    "absence injustifiee",
    "salaire",
    "confidentiel",
    "dossier sensible",
  ];

  if (criticalSignals.some((signal) => lower.includes(signal))) {
    return "critical";
  }

  if (sensitiveSignals.some((signal) => lower.includes(signal))) {
    return "sensitive";
  }

  if (
    classification === "refus_candidat" ||
    classification === "convocation_entretien" ||
    classification === "onboarding" ||
    classification === "offre_emploi"
  ) {
    return "normal";
  }

  return "normal";
}

function needsApproval(
  input: string,
  risk: MissionRiskLevel,
): boolean {
  const lower = input.toLowerCase();

  if (risk === "critical") return true;

  const approvalSignals = [
    "après validation",
    "apres validation",
    "soumets moi avant envoi",
    "avant d'envoyer",
    "avant envoi",
    "à valider",
    "a valider",
    "validation manager",
    "validation humaine",
  ];

  if (approvalSignals.some((signal) => lower.includes(signal))) return true;
  if (risk === "sensitive") return true;

  return false;
}

function detectScheduling(input: string): string | null {
  const lower = input.toLowerCase();
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

function detectMissingInfo(
  input: string,
  classification: string,
): { missing: string[]; questions: string[] } {
  const lower = input.toLowerCase();
  const missing: string[] = [];
  const questions: string[] = [];

  const hasPersonName =
    /\b[A-ZÉÈÀÂÊÎÔÛÄËÏÖÜ][a-zéèàâêîôûäëïöü'-]+\s+[A-ZÉÈÀÂÊÎÔÛÄËÏÖÜ][a-zéèàâêîôûäëïöü'-]+\b/.test(
      input,
    );

  const hasEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(input);
  const hasDate = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/.test(input);
  const hasHour = /\b\d{1,2}h(\d{2})?\b/i.test(input);

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
      classification === "relance_rh" ||
      classification === "onboarding" ||
      classification === "convocation_entretien"
    ) &&
    !hasPersonName
  ) {
    missing.push("Identité de la personne concernée manquante");
    questions.push("Quel est le nom complet de la personne concernée ?");
  }

  if (
    (
      classification === "refus_candidat" ||
      classification === "relance_rh" ||
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

  return {
    missing,
    questions,
  };
}

function buildMissionSummary(
  input: string,
  classification: string,
  risk: MissionRiskLevel,
): string {
  const base = input.trim().replace(/\s+/g, " ");
  const clipped = base.length > 260 ? `${base.slice(0, 257)}…` : base;

  return `Mission RH classée "${classification}" avec niveau de risque "${risk}". Demande structurée à partir de : ${clipped}`;
}

function routeClassificationToHrDomain(classification: string): string {
  switch (classification) {
    case "recrutement": return "recruitment_ops";
    case "offre_emploi": return "hiring";
    case "convocation_entretien": return "interview";
    case "refus_candidat": return "recruitment_ops";
    case "relance_rh": return "recruitment_ops";
    case "onboarding": return "onboarding";
    case "note_rh": return "internal_communication";
    case "rappel_procedure": return "compliance_workflow";
    case "compte_rendu": return "hr_helpdesk";
    case "courrier_rh": return "employee_relations";
    default: return "unknown";
  }
}

function routeTaskKind(classification: string, taskType: string): PierreHrTaskKind | null {
  if (taskType === "request_missing_info") return "demande_info";
  if (taskType === "schedule_follow_up") return "relance";
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
      default: return "document_rh";
    }
  }

  if (taskType === "prepare_email") {
    switch (classification) {
      case "refus_candidat": return "refus_candidat_formel";
      case "convocation_entretien": return "email_candidat";
      case "relance_rh": return "email_candidat";
      default: return "email_salarie";
    }
  }

  return null;
}

function routeHrPayload(
  classification: string,
  taskType: string,
  missionRisk: MissionRiskLevel,
): Record<string, unknown> {
  const hrDomain = routeClassificationToHrDomain(classification);
  const hrRisk = missionRisk === "critical" ? "red" : missionRisk === "sensitive" ? "orange" : "green";
  const kind = routeTaskKind(classification, taskType);

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

function buildTasks(
  input: string,
  interpretation: MissionInterpretationBase,
): MissionTaskDraft[] {
  const lower = input.toLowerCase();
  const scheduledFor = detectScheduling(input);

  const tasks: MissionTaskDraft[] = [];

  const requiresDraftDocument =
    interpretation.classification === "offre_emploi" ||
    interpretation.classification === "convocation_entretien" ||
    interpretation.classification === "refus_candidat" ||
    interpretation.classification === "onboarding" ||
    interpretation.classification === "note_rh" ||
    interpretation.classification === "courrier_rh" ||
    interpretation.classification === "compte_rendu" ||
    interpretation.classification === "rappel_procedure";

  if (requiresDraftDocument) {
    tasks.push({
      type: "generate_document",
      title: "Produire le document RH",
      description:
        "Rédiger un livrable RH premium cohérent avec la demande, le ton voulu, la langue détectée et les contraintes de risque.",
      status:
        interpretation.missing_info.length > 0
          ? "awaiting_info"
          : interpretation.approval_required
            ? "awaiting_approval"
            : "queued",
      approval_required: interpretation.approval_required,
      risk_level: interpretation.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        classification: interpretation.classification,
        language: interpretation.language,
        tone: interpretation.tone,
        ...routeHrPayload(interpretation.classification, "generate_document", interpretation.risk_level),
      },
    });
  }

  if (
    lower.includes("mail") ||
    lower.includes("email") ||
    lower.includes("envoyer") ||
    lower.includes("send") ||
    interpretation.classification === "refus_candidat" ||
    interpretation.classification === "convocation_entretien" ||
    interpretation.classification === "relance_rh" ||
    interpretation.classification === "onboarding"
  ) {
    tasks.push({
      type: "prepare_email",
      title: "Préparer l’email RH",
      description:
        "Préparer un email clair, traçable et cohérent avec la mission, prêt à être validé ou envoyé selon le niveau de risque.",
      status:
        interpretation.missing_info.length > 0
          ? "awaiting_info"
          : interpretation.approval_required
            ? "awaiting_approval"
            : scheduledFor
              ? "scheduled"
              : "queued",
      approval_required: interpretation.approval_required,
      risk_level: interpretation.risk_level,
      scheduled_for: scheduledFor,
      payload: {
        source: "mission_engine",
        language: interpretation.language,
        tone: interpretation.tone,
        scheduled_for: scheduledFor,
        ...routeHrPayload(interpretation.classification, "prepare_email", interpretation.risk_level),
      },
    });
  }

  if (
    lower.includes("pdf") ||
    lower.includes("export") ||
    lower.includes("document à joindre") ||
    lower.includes("document a joindre") ||
    lower.includes("piece jointe") ||
    lower.includes("pièce jointe")
  ) {
    tasks.push({
      type: "generate_pdf",
      title: "Préparer l’export PDF",
      description:
        "Générer un PDF propre à partir du document ou du contenu RH finalisé.",
      status:
        interpretation.missing_info.length > 0
          ? "awaiting_info"
          : interpretation.approval_required
            ? "awaiting_approval"
            : "queued",
      approval_required: interpretation.approval_required,
      risk_level: interpretation.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        ...routeHrPayload(interpretation.classification, "generate_pdf", interpretation.risk_level),
      },
    });
  }

  if (
    lower.includes("relance") ||
    lower.includes("si pas de réponse") ||
    lower.includes("si pas de reponse")
  ) {
    tasks.push({
      type: "schedule_follow_up",
      title: "Préparer une relance RH",
      description:
        "Programmer une relance propre et traçable si aucune réponse n’est obtenue.",
      status:
        interpretation.approval_required || interpretation.missing_info.length > 0
          ? "awaiting_approval"
          : "scheduled",
      approval_required: true,
      risk_level: interpretation.risk_level,
      scheduled_for: scheduledFor,
      payload: {
        source: "mission_engine",
        conditional: true,
        ...routeHrPayload(interpretation.classification, "schedule_follow_up", interpretation.risk_level),
      },
    });
  }

  if (interpretation.missing_info.length > 0) {
    tasks.push({
      type: "request_missing_info",
      title: "Demander les informations manquantes",
      description:
        "Bloquer l’exécution complète tant que les éléments indispensables à une action RH propre ne sont pas fournis.",
      status: "awaiting_info",
      approval_required: false,
      risk_level: interpretation.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        missing_info: interpretation.missing_info,
        questions: interpretation.missing_info_questions,
        ...routeHrPayload(interpretation.classification, "request_missing_info", interpretation.risk_level),
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
        interpretation.missing_info.length > 0
          ? "awaiting_info"
          : interpretation.approval_required
            ? "awaiting_approval"
            : "queued",
      approval_required: interpretation.approval_required,
      risk_level: interpretation.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        ...routeHrPayload(interpretation.classification, "structure_mission", interpretation.risk_level),
      },
    });
  }

  return tasks;
}

function interpretMission(input: string): MissionInterpretation {
  const classification = detectClassification(input);
  const language = detectLanguage(input);
  const tone = detectTone(input);
  const risk_level = detectRisk(input, classification);
  const approval_required = needsApproval(input, risk_level);
  const intent = detectIntent(input);
  const missingInfo = detectMissingInfo(input, classification);
  const summary = buildMissionSummary(input, classification, risk_level);

  const baseInterpretation: MissionInterpretationBase = {
    intent,
    classification,
    summary,
    language,
    tone,
    risk_level,
    approval_required,
    missing_info: missingInfo.missing,
    missing_info_questions: missingInfo.questions,
  };

  return {
    ...baseInterpretation,
    tasks: buildTasks(input, baseInterpretation),
  };
}

async function insertMission(
  supabaseAdmin: SupabaseClient,
  userId: string,
  body: SubmitBody,
  interpretation: MissionInterpretation,
): Promise<DbRow> {
  const title =
    body.input.length > 120
      ? `${body.input.slice(0, 117).trim()}…`
      : body.input || "Mission RH";

  const insertPayload = {
    user_id: userId,
    title,
    summary: interpretation.summary,
    description: body.input,
    classification: interpretation.classification,
    status:
      interpretation.missing_info.length > 0
        ? "awaiting_info"
        : interpretation.approval_required
          ? "awaiting_approval"
          : "queued",
    risk_level: interpretation.risk_level,
    approval_required: interpretation.approval_required,
    language: interpretation.language,
    tone: interpretation.tone,
    missing_info: interpretation.missing_info,
    interpretation,
    context: body.context ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from("pierre_missions")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error || !data) {
    throw {
      status: 500,
      message: "Unable to create mission.",
      code: "MISSION_CREATE_FAILED",
      details: mapDbError(error),
    };
  }

  return data satisfies DbRow;
}

async function insertTasks(
  supabaseAdmin: SupabaseClient,
  missionId: string,
  interpretation: MissionInterpretation,
): Promise<DbRow[]> {
  const taskRows = interpretation.tasks.map((task) => ({
    mission_id: missionId,
    type: task.type,
    title: task.title,
    description: task.description,
    status: task.status,
    risk_level: task.risk_level,
    approval_required: task.approval_required,
    scheduled_for: task.scheduled_for,
    payload: task.payload,
  }));

  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .insert(taskRows)
    .select("*");

  if (error) {
    throw {
      status: 500,
      message: "Unable to create mission tasks.",
      code: "TASKS_CREATE_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

async function insertLogs(
  supabaseAdmin: SupabaseClient,
  missionId: string,
  tasks: DbRow[],
  interpretation: MissionInterpretation,
): Promise<DbRow[]> {
  const logs: Array<Record<string, unknown>> = [
    {
      mission_id: missionId,
      level: "info",
      event: "mission_created",
      message: "Mission créée et structurée par Pierre.",
      payload: {
        classification: interpretation.classification,
        risk_level: interpretation.risk_level,
        approval_required: interpretation.approval_required,
      },
    },
    {
      mission_id: missionId,
      level:
        interpretation.risk_level === "critical"
          ? "warning"
          : interpretation.missing_info.length > 0
            ? "warning"
            : "info",
      event: "mission_interpreted",
      message:
        interpretation.missing_info.length > 0
          ? "Mission interprétée avec informations manquantes."
          : interpretation.approval_required
            ? "Mission interprétée avec validation requise."
            : "Mission interprétée et prête pour exécution contrôlée.",
      payload: interpretation,
    },
  ];

  for (const task of tasks) {
    logs.push({
      mission_id: missionId,
      task_id: task.id,
      level: "info",
      event: "task_created",
      message: `Tâche créée : ${asString(task.title) || asString(task.type) || "task"}`,
      payload: {
        task_type: asString(task.type),
        task_status: asString(task.status),
      },
    });
  }

  const { data, error } = await supabaseAdmin
    .from("pierre_task_logs")
    .insert(logs)
    .select("*");

  if (error) {
    throw {
      status: 500,
      message: "Unable to create mission logs.",
      code: "LOGS_CREATE_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

export async function POST(request: NextRequest) {
  try {
    const body = normalizeBody(await request.json());

    if (!body.input || !body.input.trim()) {
      return jsonError("Mission input is required.", 400, {
        code: "MISSION_INPUT_REQUIRED",
      });
    }

    const supabaseAdmin = createAdminClient();
    const auth = await authenticateRequest(request, supabaseAdmin);

    const interpretation = interpretMission(body.input);
    const mission = await insertMission(
      supabaseAdmin,
      auth.userId,
      body,
      interpretation,
    );

    const tasks = await insertTasks(
      supabaseAdmin,
      mission.id as string,
      interpretation,
    );

    const logs = await insertLogs(
      supabaseAdmin,
      mission.id as string,
      tasks,
      interpretation,
    );

    return NextResponse.json({
      ok: true,
      mission,
      interpretation,
      tasks,
      logs,
      threadEntries: [
        {
          id: `assistant-${mission.id as string}`,
          role: "assistant",
          content:
            interpretation.missing_info.length > 0
              ? "Mission comprise partiellement. Pierre a structuré la demande mais a détecté des informations manquantes avant exécution complète."
              : interpretation.approval_required
                ? "Mission comprise. Pierre a structuré l’action et positionné une validation humaine avant exécution sensible."
                : "Mission comprise et structurée. Pierre a créé les tâches nécessaires pour lancer le traitement RH.",
          created_at: new Date().toISOString(),
        },
      ],
      meta: {
        missionId: mission.id,
        userId: auth.userId,
        fetchedAt: new Date().toISOString(),
        counts: {
          tasks: tasks.length,
          logs: logs.length,
        },
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status,
        {
          code: asString(error.code),
          details: error.details ?? null,
        },
      );
    }

    const mapped = mapDbError(error);

    return jsonError(mapped.message, 500, {
      code: mapped.code,
      details: mapped.details,
    });
  }
}
