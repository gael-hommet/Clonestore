import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import {
  classifyPierreHrActionRequirement,
  type PierreAutonomyLevel,
  type PierreHrDomain,
  type PierreHrTaskKind,
} from "../../../../../lib/pierre/hr/contracts";
import {
  decidePierreHrExecutionPolicy,
  resolvePierreAutonomyLevel,
} from "../../../../../lib/pierre/hr/autonomy";

type PierreUseSubmitBody = {
  input?: string;
  source?: string;
  context?: unknown;
  autonomy_level?: string | null;
};

type PierreTaskType =
  | "email.send"
  | "email.draft"
  | "doc.generate"
  | "doc.rewrite"
  | "pdf.generate"
  | "reminder.create"
  | "followup.schedule";

type PierreTaskStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "awaiting_approval"
  | "blocked";

type PierreRiskLevel = "low" | "medium" | "high";
type PierreHrRiskColor = "green" | "orange" | "red" | "black";

type PierreUnderstandingStatus =
  | "understood"
  | "partially_understood"
  | "missing_info"
  | "out_of_scope";

type PierreMissingInfo = {
  key: string;
  question: string;
  expected_format: "text" | "email" | "date" | "datetime" | "choice";
  required: boolean;
};

type PierreTaskDraft = {
  type: PierreTaskType;
  title: string;
  description: string;
  status: PierreTaskStatus;
  priority: number;
  approval_required: boolean;
  execute_at: string | null;
  payload_json: Record<string, unknown>;
  depends_on_json: string[];
};

type PierreInterpretation = {
  intent: string;
  mission_summary: string;
  understanding_status: PierreUnderstandingStatus;
  classification: string;
  hr_domain: PierreHrDomain;
  risk_level: PierreRiskLevel;
  hr_risk_level: PierreHrRiskColor;
  approval_required: boolean;
  missing_info: PierreMissingInfo[];
  tasks: PierreTaskDraft[];
  autonomy_level: PierreAutonomyLevel;
};

type InsertedMission = Record<string, unknown>;
type InsertedTask = Record<string, unknown>;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizedLower(value: string) {
  return stripAccents(value).toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getStringFromRecord(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string {
  if (!record) return "";
  return safeString(record[key]);
}

function getObjectFromRecord(
  record: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  if (!record) return null;
  const value = record[key];
  return isRecord(value) ? value : null;
}

function getBearerToken(req: NextRequest) {
  const auth =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";

  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice("Bearer ".length).trim();
}

function getSupabaseCookieToken(req: NextRequest) {
  const directCandidates = [
    "sb-access-token",
    "supabase-access-token",
    "access-token",
  ];

  for (const name of directCandidates) {
    const token = req.cookies.get(name)?.value;
    if (token && token.split(".").length === 3) return token;
  }

  for (const cookie of req.cookies.getAll()) {
    if (!cookie.name.includes("auth-token")) continue;

    const raw = cookie.value;
    if (!raw) continue;

    try {
      const parsed: unknown = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        const token = parsed.find(
          (item): item is string =>
            typeof item === "string" && item.split(".").length === 3,
        );

        if (token) return token;
      }

      if (isRecord(parsed)) {
        const direct = getStringFromRecord(parsed, "access_token");
        if (direct) return direct;

        const currentSession = getObjectFromRecord(parsed, "currentSession");
        const nested = getStringFromRecord(currentSession, "access_token");
        if (nested) return nested;
      }
    } catch {
      if (raw.split(".").length === 3) return raw;
    }
  }

  return "";
}

function makeServerSupabase(): SupabaseClient {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL");
  const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRole) {
    throw new Error("Supabase serveur non configuré.");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedUser(
  req: NextRequest,
  supabase: SupabaseClient,
): Promise<{ error: string | null; user: User | null }> {
  const token = getBearerToken(req) || getSupabaseCookieToken(req);

  if (!token) {
    return { error: "Token manquant.", user: null };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      error: error?.message || "Utilisateur non authentifié.",
      user: null,
    };
  }

  return { error: null, user: data.user };
}

async function hasPierreAccess(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("id,status")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: Boolean(data), error: null as string | null };
}

async function readAutonomyLevel(
  supabase: SupabaseClient,
  userId: string,
  bodyLevel?: string | null,
): Promise<PierreAutonomyLevel> {
  if (bodyLevel) {
    return resolvePierreAutonomyLevel(bodyLevel);
  }

  try {
    const { data, error } = await supabase
      .from("pierre_company_memory")
      .select("memory_json")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!error && data && isRecord(data.memory_json)) {
      const memoryJson = data.memory_json as Record<string, unknown>;
      const hrPreferences = getObjectFromRecord(memoryJson, "hr_preferences");

      const fromHrPrefs = getStringFromRecord(hrPreferences, "autonomy_level");
      if (fromHrPrefs) return resolvePierreAutonomyLevel(fromHrPrefs);

      const fromRoot = getStringFromRecord(memoryJson, "autonomy_level");
      if (fromRoot) return resolvePierreAutonomyLevel(fromRoot);
    }
  } catch {
    // fallback below
  }

  try {
    const { data, error } = await supabase
      .from("pierre_company_memory")
      .select("preferences")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!error && data && isRecord(data.preferences)) {
      const fromPreferences = getStringFromRecord(
        data.preferences as Record<string, unknown>,
        "autonomy_level",
      );

      if (fromPreferences) return resolvePierreAutonomyLevel(fromPreferences);
    }
  } catch {
    // fallback below
  }

  return "validation_smart";
}

function detectEmailInText(input: string) {
  const match = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return match?.[0] || "";
}

function detectRiskLevel(input: string): PierreRiskLevel {
  const text = normalizedLower(input);

  if (
    text.includes("licenciement") ||
    text.includes("sanction") ||
    text.includes("disciplinaire") ||
    text.includes("avertissement") ||
    text.includes("mise a pied") ||
    text.includes("juridique") ||
    text.includes("harcelement") ||
    text.includes("discrimination") ||
    text.includes("rupture") ||
    text.includes("plainte") ||
    text.includes("prudhommes") ||
    text.includes("prud'hommes")
  ) {
    return "high";
  }

  if (
    text.includes("contrat") ||
    text.includes("avenant") ||
    text.includes("refus") ||
    text.includes("convocation") ||
    text.includes("candidat") ||
    text.includes("recrutement") ||
    text.includes("absence") ||
    text.includes("justificatif") ||
    text.includes("relance") ||
    text.includes("paie") ||
    text.includes("salaire") ||
    text.includes("remuneration")
  ) {
    return "medium";
  }

  return "low";
}

function toHrRiskLevel(risk: PierreRiskLevel): PierreHrRiskColor {
  if (risk === "high") return "red";
  if (risk === "medium") return "orange";
  return "green";
}

function detectApprovalRequired(input: string, risk: PierreRiskLevel) {
  const text = normalizedLower(input);

  if (risk === "high") return true;

  if (
    text.includes("apres validation") ||
    text.includes("soumets-moi") ||
    text.includes("soumet moi") ||
    text.includes("avant envoi") ||
    text.includes("avant d'envoyer") ||
    text.includes("avant de l'envoyer") ||
    text.includes("ne l'envoie pas tout de suite") ||
    text.includes("ne pas envoyer") ||
    text.includes("validation humaine") ||
    text.includes("je veux validation")
  ) {
    return true;
  }

  return false;
}

function detectNoSendInstruction(input: string) {
  const text = normalizedLower(input);

  return (
    text.includes("ne l'envoie pas") ||
    text.includes("ne pas envoyer") ||
    text.includes("n'envoie pas") ||
    text.includes("brouillon") ||
    text.includes("draft") ||
    text.includes("avant envoi") ||
    text.includes("avant d'envoyer") ||
    text.includes("validation humaine")
  );
}

function detectScheduleText(input: string): string | null {
  const text = normalizedLower(input);
  const now = new Date();

  const hourMatch =
    text.match(/\ba\s+(\d{1,2})h(?:(\d{2}))?\b/) ||
    text.match(/\b(\d{1,2})h(?:(\d{2}))?\b/);

  if (hourMatch) {
    const h = Number(hourMatch[1]);
    const m = Number(hourMatch[2] || "0");

    if (
      Number.isFinite(h) &&
      h >= 0 &&
      h <= 23 &&
      Number.isFinite(m) &&
      m >= 0 &&
      m <= 59
    ) {
      const scheduled = new Date(now);
      scheduled.setHours(h, m, 0, 0);

      if (scheduled.getTime() < now.getTime()) {
        scheduled.setDate(scheduled.getDate() + 1);
      }

      return scheduled.toISOString();
    }
  }

  if (text.includes("demain")) {
    const scheduled = new Date(now);
    scheduled.setDate(scheduled.getDate() + 1);
    scheduled.setHours(9, 0, 0, 0);
    return scheduled.toISOString();
  }

  return null;
}

function detectClassification(input: string) {
  const text = normalizedLower(input);

  if (text.includes("contrat")) return "contract";
  if (text.includes("avenant")) return "amendment";
  if (text.includes("onboarding") || text.includes("integration")) {
    return "onboarding";
  }
  if (
    text.includes("offboarding") ||
    text.includes("depart") ||
    text.includes("sortie")
  ) {
    return "offboarding";
  }
  if (text.includes("absence") || text.includes("justificatif")) {
    return "absence";
  }
  if (
    text.includes("paie") ||
    text.includes("pre-paie") ||
    text.includes("prepaie")
  ) {
    return "payroll_prep";
  }
  if (text.includes("convocation") || text.includes("entretien")) {
    return "interview";
  }
  if (text.includes("refus") && text.includes("candidat")) {
    return "candidate_rejection";
  }
  if (text.includes("candidat") || text.includes("recrutement")) {
    return "recruitment_ops";
  }
  if (text.includes("formation")) return "training_ops";
  if (text.includes("procedure") || text.includes("conformite")) {
    return "compliance_workflow";
  }
  if (
    text.includes("rapport") ||
    text.includes("reporting") ||
    text.includes("recapitulatif")
  ) {
    return "reporting";
  }
  if (text.includes("relance") || text.includes("rappel")) return "followup";
  if (text.includes("email") || text.includes("mail")) {
    return "internal_communication";
  }

  return "general_hr_mission";
}

function routeClassificationToHrDomain(classification: string): PierreHrDomain {
  switch (classification) {
    case "contract":
      return "contract";
    case "amendment":
      return "amendment";
    case "onboarding":
      return "onboarding";
    case "offboarding":
      return "offboarding";
    case "absence":
      return "absence";
    case "payroll_prep":
      return "payroll_prep";
    case "interview":
      return "interview";
    case "candidate_rejection":
    case "recruitment_ops":
      return "recruitment_ops";
    case "training_ops":
      return "training_ops";
    case "compliance_workflow":
      return "compliance_workflow";
    case "reporting":
      return "reporting";
    case "followup":
      return "hr_helpdesk";
    case "internal_communication":
      return "internal_communication";
    default:
      return "unknown";
  }
}

function detectOutOfScope(input: string) {
  const text = normalizedLower(input);

  return (
    text.includes("prospection de masse") ||
    text.includes("cold email") ||
    text.includes("cold emailing") ||
    text.includes("campagne massive") ||
    text.includes("scraping") ||
    text.includes("scraper")
  );
}

function detectMissingInfo(
  input: string,
  classification: string,
  asksEmail: boolean,
  detectedEmail: string,
): PierreMissingInfo[] {
  const text = normalizedLower(input);
  const missing: PierreMissingInfo[] = [];

  if (asksEmail && !detectedEmail) {
    missing.push({
      key: "recipient_email",
      question: "Quel est l’email exact du destinataire ?",
      expected_format: "email",
      required: true,
    });
  }

  if (
    classification === "contract" &&
    !text.includes("cdi") &&
    !text.includes("cdd") &&
    !text.includes("stage") &&
    !text.includes("alternance")
  ) {
    missing.push({
      key: "contract_type",
      question: "Quel est le type de contrat à préparer ?",
      expected_format: "choice",
      required: true,
    });
  }

  if (
    classification === "interview" &&
    !/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/.test(text) &&
    !text.includes("demain") &&
    !text.includes("aujourd")
  ) {
    missing.push({
      key: "interview_date",
      question: "Quelle est la date exacte de l’entretien ?",
      expected_format: "date",
      required: false,
    });
  }

  return missing;
}

function routeTaskKind(
  classification: string,
  taskType: PierreTaskType,
): PierreHrTaskKind | null {
  if (taskType === "followup.schedule") return "relance";
  if (taskType === "reminder.create") return "rappel_echeance";
  if (taskType === "pdf.generate") return "document_rh";

  if (taskType === "email.send" || taskType === "email.draft") {
    if (classification === "candidate_rejection") return "refus_candidat_formel";
    if (classification === "recruitment_ops" || classification === "interview") {
      return "email_candidat";
    }
    return "email_salarie";
  }

  if (taskType === "doc.generate" || taskType === "doc.rewrite") {
    if (classification === "contract") return "contrat";
    if (classification === "amendment") return "avenant";
    if (classification === "onboarding") return "onboarding_prep";
    if (classification === "offboarding") return "offboarding_sensible";
    if (classification === "absence") return "absence_sensible";
    if (classification === "payroll_prep") return "prepaie_prep";
    if (classification === "interview") return "trame_entretien";
    if (classification === "candidate_rejection") return "refus_candidat_formel";
    if (classification === "training_ops") return "document_rh";
    if (classification === "reporting") return "rapport_standard";
    if (classification === "compliance_workflow") return "rapport_standard";
    return "document_rh";
  }

  return null;
}

function buildHrPayload(params: {
  classification: string;
  taskType: PierreTaskType;
  riskLevel: PierreRiskLevel;
  autonomyLevel: PierreAutonomyLevel;
}) {
  const hrDomain = routeClassificationToHrDomain(params.classification);
  const hrRiskLevel = toHrRiskLevel(params.riskLevel);
  const kind = routeTaskKind(params.classification, params.taskType);

  if (!kind) {
    const autonomyDecision = decidePierreHrExecutionPolicy({
      hr_action_class: null,
      hr_approval_policy: null,
      hr_risk_level: hrRiskLevel,
      autonomy_level: params.autonomyLevel,
    });

    return {
      hr_domain: hrDomain,
      hr_risk_level: hrRiskLevel,
      autonomy_level: params.autonomyLevel,
      can_execute: autonomyDecision.can_execute,
      autonomy_decision: {
        can_execute: autonomyDecision.can_execute,
        approval_required: autonomyDecision.approval_required,
        blocked: autonomyDecision.blocked,
        final_status_hint: autonomyDecision.final_status_hint,
      },
      autonomy_reason: autonomyDecision.reason,
    };
  }

  const requirement = classifyPierreHrActionRequirement({
    kind,
    domain: hrDomain,
    override_risk: hrRiskLevel,
  });

  const autonomyDecision = decidePierreHrExecutionPolicy({
    hr_action_class: requirement.action_class,
    hr_approval_policy: requirement.approval_policy,
    hr_risk_level: requirement.risk_level,
    autonomy_level: params.autonomyLevel,
  });

  return {
    hr_task_kind: kind,
    hr_domain: hrDomain,
    hr_risk_level: requirement.risk_level,
    hr_action_class: requirement.action_class,
    hr_approval_policy: requirement.approval_policy,
    human_note: requirement.human_note,
    autonomy_level: params.autonomyLevel,
    can_execute: autonomyDecision.can_execute,
    autonomy_decision: {
      can_execute: autonomyDecision.can_execute,
      approval_required: autonomyDecision.approval_required,
      blocked: autonomyDecision.blocked,
      final_status_hint: autonomyDecision.final_status_hint,
    },
    autonomy_reason: autonomyDecision.reason,
  };
}

function isAutonomyDecisionBlocked(payload: Record<string, unknown>) {
  const decision = isRecord(payload.autonomy_decision)
    ? payload.autonomy_decision
    : null;

  return decision?.blocked === true;
}

function isAutonomyApprovalRequired(payload: Record<string, unknown>) {
  const decision = isRecord(payload.autonomy_decision)
    ? payload.autonomy_decision
    : null;

  return decision?.approval_required === true;
}

function canTaskExecute(payload: Record<string, unknown>) {
  if (payload.can_execute === false) return false;

  const decision = isRecord(payload.autonomy_decision)
    ? payload.autonomy_decision
    : null;

  if (decision?.can_execute === false) return false;

  return true;
}

function computeTaskApprovalRequired(
  taskType: PierreTaskType,
  globalApprovalRequired: boolean,
  hrPayload: Record<string, unknown>,
) {
  const isSendType = taskType === "email.send";

  const policyRequiresHuman =
    hrPayload.hr_approval_policy === "required" ||
    hrPayload.hr_approval_policy === "human_only";

  if (isSendType && globalApprovalRequired) return true;
  if (isSendType && isAutonomyApprovalRequired(hrPayload)) return true;

  return policyRequiresHuman;
}

function computeTaskStatus(params: {
  taskType: PierreTaskType;
  hrPayload: Record<string, unknown>;
  executeAt: string | null;
  approvalRequired: boolean;
  blockedByMissingInfo?: boolean;
}): PierreTaskStatus {
  if (isAutonomyDecisionBlocked(params.hrPayload)) return "blocked";

  if (params.blockedByMissingInfo) {
    if (params.taskType === "reminder.create") return "ready";
    return "blocked";
  }

  if (params.taskType === "email.send") {
    if (!canTaskExecute(params.hrPayload)) return "awaiting_approval";
    if (params.approvalRequired) return "awaiting_approval";
    return params.executeAt ? "scheduled" : "ready";
  }

  if (
    params.taskType === "followup.schedule" ||
    params.taskType === "reminder.create"
  ) {
    if (!canTaskExecute(params.hrPayload) || params.approvalRequired) {
      return "awaiting_approval";
    }

    return params.executeAt ? "scheduled" : "ready";
  }

  return params.executeAt ? "scheduled" : "ready";
}

function buildTask(params: {
  type: PierreTaskType;
  title: string;
  description: string;
  priority: number;
  input: string;
  classification: string;
  riskLevel: PierreRiskLevel;
  autonomyLevel: PierreAutonomyLevel;
  executeAt?: string | null;
  globalApprovalRequired?: boolean;
  extraPayload?: Record<string, unknown>;
  dependsOn?: string[];
  blockedByMissingInfo?: boolean;
}): PierreTaskDraft {
  const executeAt = params.executeAt ?? null;

  const hrPayload = buildHrPayload({
    classification: params.classification,
    taskType: params.type,
    riskLevel: params.riskLevel,
    autonomyLevel: params.autonomyLevel,
  });

  const approvalRequired = computeTaskApprovalRequired(
    params.type,
    params.globalApprovalRequired ?? false,
    hrPayload,
  );

  return {
    type: params.type,
    title: params.title,
    description: params.description,
    status: computeTaskStatus({
      taskType: params.type,
      hrPayload,
      executeAt,
      approvalRequired,
      blockedByMissingInfo: params.blockedByMissingInfo,
    }),
    priority: params.priority,
    approval_required: approvalRequired,
    execute_at: executeAt,
    payload_json: {
      raw_input: params.input,
      classification: params.classification,
      ...hrPayload,
      ...(params.extraPayload ?? {}),
    },
    depends_on_json: params.dependsOn ?? [],
  };
}

function buildInterpretation(
  inputRaw: string,
  autonomyLevel: PierreAutonomyLevel,
): PierreInterpretation {
  const input = normalizeSpaces(inputRaw);
  const lower = normalizedLower(input);

  const detectedEmail = detectEmailInText(input);
  const riskLevel = detectRiskLevel(input);
  const hrRiskLevel = toHrRiskLevel(riskLevel);
  const approvalRequired = detectApprovalRequired(input, riskLevel);
  const executeAt = detectScheduleText(input);
  const noSendInstruction = detectNoSendInstruction(input);
  const classification = detectClassification(input);
  const hrDomain = routeClassificationToHrDomain(classification);

  const asksEmail =
    lower.includes("mail") ||
    lower.includes("email") ||
    lower.includes("envoie") ||
    lower.includes("envoyer") ||
    lower.includes("brouillon email") ||
    lower.includes("brouillon mail");

  const asksDoc =
    lower.includes("document") ||
    lower.includes("courrier") ||
    lower.includes("contrat") ||
    lower.includes("avenant") ||
    lower.includes("convocation") ||
    lower.includes("refus") ||
    lower.includes("compte rendu") ||
    lower.includes("compte-rendu") ||
    lower.includes("onboarding") ||
    lower.includes("offboarding") ||
    lower.includes("offre d'emploi") ||
    lower.includes("offre d’emploi") ||
    lower.includes("fiche de poste") ||
    lower.includes("procedure") ||
    lower.includes("recapitulatif") ||
    lower.includes("genere") ||
    lower.includes("génère");

  const asksReminder =
    lower.includes("rappel") ||
    lower.includes("relance") ||
    lower.includes("si pas de reponse") ||
    lower.includes("si aucune reponse") ||
    lower.includes("si pas de réponse") ||
    lower.includes("si aucune réponse");

  if (detectOutOfScope(input)) {
    return {
      intent: "out_of_scope",
      mission_summary: "Demande hors périmètre RH prévu pour Pierre.",
      understanding_status: "out_of_scope",
      classification: "out_of_scope",
      hr_domain: "unknown",
      risk_level: "high",
      hr_risk_level: "red",
      approval_required: true,
      missing_info: [],
      tasks: [],
      autonomy_level: autonomyLevel,
    };
  }

  const missingInfo = detectMissingInfo(
    input,
    classification,
    asksEmail,
    detectedEmail,
  );

  const blockedByMissingInfo = missingInfo.some((item) => item.required);
  const tasks: PierreTaskDraft[] = [];

  if (asksDoc || (!asksEmail && !asksReminder)) {
    tasks.push(
      buildTask({
        type: "doc.generate",
        title: "Générer le document RH",
        description:
          "Produire un livrable RH exploitable, traçable, rattaché à la mission et adapté au niveau de risque détecté.",
        priority: 90,
        input,
        classification,
        riskLevel,
        autonomyLevel,
        globalApprovalRequired: false,
        blockedByMissingInfo,
        extraPayload: {
          artifact_request: {
            kind: "document",
            title: "Document RH généré par Pierre",
            doc_type: classification,
            text_content: input,
          },
        },
      }),
    );
  }

  if (asksEmail) {
    const canSendImmediately =
      Boolean(detectedEmail) && !approvalRequired && !noSendInstruction;

    const emailType: PierreTaskType = canSendImmediately
      ? "email.send"
      : "email.draft";

    const html = `<p>${escapeHtml(input)}</p>`;

    tasks.push(
      buildTask({
        type: emailType,
        title: canSendImmediately
          ? "Envoyer un email RH"
          : "Préparer un brouillon email RH",
        description: canSendImmediately
          ? "Préparer et envoyer l’email RH demandé, uniquement si l’autonomie et les règles de validation l’autorisent."
          : "Préparer un brouillon email RH exploitable sans envoi automatique.",
        priority: 80,
        input,
        classification,
        riskLevel,
        autonomyLevel,
        executeAt: canSendImmediately ? executeAt : null,
        globalApprovalRequired: approvalRequired || noSendInstruction,
        blockedByMissingInfo,
        extraPayload: {
          recipient_email: detectedEmail || null,
          subject: "Brouillon RH préparé par Pierre",
          body_text: input,
          body_html: html,
          artifact_request: {
            kind: emailType === "email.send" ? "email_send" : "email_draft",
            subject: "Brouillon RH préparé par Pierre",
            body_text: input,
            body_html: html,
          },
        },
      }),
    );
  }

  if (asksReminder) {
    tasks.push(
      buildTask({
        type: "followup.schedule",
        title: "Créer une relance / suivi RH",
        description:
          "Créer une relance ou un suivi RH planifié, traçable et rattaché à la mission.",
        priority: 70,
        input,
        classification,
        riskLevel,
        autonomyLevel,
        executeAt,
        globalApprovalRequired: false,
        blockedByMissingInfo,
        extraPayload: {
          conditional: true,
          followup_rule:
            "Relancer si aucune réponse ou si l’information reste manquante.",
        },
      }),
    );
  }

  if (missingInfo.length > 0) {
    tasks.push(
      buildTask({
        type: "reminder.create",
        title: "Demander les informations manquantes",
        description:
          "Créer une tâche de clarification pour obtenir les informations nécessaires à une exécution RH propre.",
        priority: 95,
        input,
        classification,
        riskLevel,
        autonomyLevel,
        globalApprovalRequired: false,
        extraPayload: {
          missing_info: missingInfo,
          clarification_required: true,
        },
      }),
    );
  }

  const understandingStatus: PierreUnderstandingStatus =
    missingInfo.length > 0
      ? "missing_info"
      : tasks.length > 0
        ? "understood"
        : "partially_understood";

  let intent = "general_rh_request";

  if (asksEmail && asksDoc && asksReminder) intent = "rh_doc_email_followup";
  else if (asksEmail && asksDoc) intent = "rh_doc_plus_email";
  else if (asksEmail) intent = "rh_email";
  else if (asksDoc) intent = "rh_document";
  else if (asksReminder) intent = "rh_followup";

  const missionSummary =
    tasks.length > 0
      ? `Mission interprétée : ${tasks.map((task) => task.title).join(" + ")}.`
      : "Mission reçue, mais aucune action exploitable n’a été détectée.";

  return {
    intent,
    mission_summary: missionSummary,
    understanding_status: understandingStatus,
    classification,
    hr_domain: hrDomain,
    risk_level: riskLevel,
    hr_risk_level: hrRiskLevel,
    approval_required: approvalRequired,
    missing_info: missingInfo,
    tasks,
    autonomy_level: autonomyLevel,
  };
}

function missionStatusFromInterpretation(interpretation: PierreInterpretation) {
  if (interpretation.understanding_status === "out_of_scope") return "blocked";
  if (interpretation.missing_info.length > 0) return "awaiting_info";
  if (interpretation.tasks.some((task) => task.status === "blocked")) {
    return "blocked";
  }
  if (interpretation.tasks.some((task) => task.status === "scheduled")) {
    return "scheduled";
  }
  if (interpretation.tasks.some((task) => task.status === "awaiting_approval")) {
    return "awaiting_approval";
  }

  return "active";
}

async function insertMissionAndTasks(
  supabase: SupabaseClient,
  userId: string,
  source: string,
  input: string,
  interpretation: PierreInterpretation,
  context: unknown,
) {
  const { data: mission, error: missionError } = await supabase
    .from("pierre_missions")
    .insert({
      user_id: userId,
      agent_slug: "pierre",
      source,
      raw_input: input,
      mission_summary: interpretation.mission_summary,
      intent: interpretation.intent,
      understanding_status: interpretation.understanding_status,
      risk_level: interpretation.risk_level,
      approval_required: interpretation.approval_required,
      status: missionStatusFromInterpretation(interpretation),
      missing_info_json: interpretation.missing_info,
      brain_output_json: interpretation,
      context_snapshot_json: {
        submitted_at: new Date().toISOString(),
        source,
        context: context ?? null,
        autonomy_level: interpretation.autonomy_level,
        classification: interpretation.classification,
        hr_domain: interpretation.hr_domain,
        hr_risk_level: interpretation.hr_risk_level,
      },
    })
    .select("*")
    .single();

  if (missionError || !mission) {
    throw new Error(missionError?.message || "Impossible de créer la mission.");
  }

  let insertedTasks: InsertedTask[] = [];

  if (interpretation.tasks.length > 0) {
    const payload = interpretation.tasks.map((task) => ({
      mission_id: mission.id,
      user_id: userId,
      agent_slug: "pierre",
      type: task.type,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      approval_required: task.approval_required,
      payload_json: task.payload_json,
      result_json: {},
      depends_on_json: task.depends_on_json,
      execute_at: task.execute_at,
    }));

    const { data: tasks, error: taskError } = await supabase
      .from("pierre_tasks")
      .insert(payload)
      .select("*");

    if (taskError) {
      throw new Error(taskError.message);
    }

    insertedTasks = (tasks || []) as InsertedTask[];
  }

  const logRows = [
    {
      mission_id: mission.id,
      task_id: null,
      user_id: userId,
      agent_slug: "pierre",
      event_type: "mission_created",
      message: "Mission Pierre créée depuis /api/pierre/use/submit",
      meta_json: {
        source,
        intent: interpretation.intent,
        classification: interpretation.classification,
        hr_domain: interpretation.hr_domain,
        hr_risk_level: interpretation.hr_risk_level,
        autonomy_level: interpretation.autonomy_level,
        understanding_status: interpretation.understanding_status,
        risk_level: interpretation.risk_level,
      },
    },
    ...insertedTasks.map((task) => ({
      mission_id: mission.id,
      task_id: task.id as string,
      user_id: userId,
      agent_slug: "pierre",
      event_type: "task_created",
      message: `Task créée : ${String(task.title || "")}`,
      meta_json: {
        type: task.type,
        status: task.status,
        approval_required: task.approval_required,
      },
    })),
  ];

  const { error: logError } = await supabase
    .from("pierre_task_logs")
    .insert(logRows);

  return {
    mission: mission as InsertedMission,
    tasks: insertedTasks,
    log_error: logError?.message || null,
  };
}

export async function POST(req: NextRequest) {
  let supabase: SupabaseClient;

  try {
    supabase = makeServerSupabase();
  } catch (error: unknown) {
    return json(500, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Configuration serveur invalide.",
    });
  }

  const { error: authError, user } = await getAuthenticatedUser(req, supabase);

  if (authError || !user) {
    return json(401, {
      ok: false,
      error: authError || "Non authentifié.",
    });
  }

  const access = await hasPierreAccess(supabase, user.id);

  if (access.error) {
    return json(500, {
      ok: false,
      error: access.error,
    });
  }

  if (!access.ok) {
    return json(403, {
      ok: false,
      error: "Pierre n’est pas actif sur ce compte.",
    });
  }

  let body: PierreUseSubmitBody;

  try {
    body = (await req.json()) as PierreUseSubmitBody;
  } catch {
    return json(400, {
      ok: false,
      error: "Body JSON invalide.",
    });
  }

  const input = safeString(body.input);
  const source = safeString(body.source) || "use_page";

  if (!input || input.length < 3) {
    return json(400, {
      ok: false,
      error: "Requête libre trop courte.",
    });
  }

  try {
    const autonomyLevel = await readAutonomyLevel(
      supabase,
      user.id,
      body.autonomy_level,
    );

    const interpretation = buildInterpretation(input, autonomyLevel);

    const { mission, tasks, log_error } = await insertMissionAndTasks(
      supabase,
      user.id,
      source,
      input,
      interpretation,
      body.context ?? null,
    );

    return json(200, {
      ok: true,
      mission,
      interpretation,
      tasks,
      meta: {
        source,
        user_id: user.id,
        autonomy_level: autonomyLevel,
        mission_id: mission.id ?? null,
        tasks_count: tasks.length,
        log_error,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    return json(500, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Erreur lors de la création de mission Pierre.",
    });
  }
}