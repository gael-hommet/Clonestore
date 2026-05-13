import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  classifyPierreHrActionRequirement,
  type PierreHrTaskKind,
  type PierreAutonomyLevel,
} from "../../../../../lib/pierre/hr/contracts";
import {
  resolvePierreAutonomyLevel,
  decidePierreHrExecutionPolicy,
} from "../../../../../lib/pierre/hr/autonomy";
import {
  type PierreEmployeeContext,
  type PierreEmployeeProfile,
  sanitizePierreEmployeeList,
  findPierreEmployeeById,
  findPierreEmployeeByName,
  buildPierreEmployeeContext,
  detectEmployeeReferenceFromText,
  enrichPayloadWithEmployeeContext,
} from "../../../../../lib/pierre/hr/employee";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

type DbRow = Record<string, unknown>;

type AuthenticatedContext = {
  userId: string;
  accessToken: string | null;
};

type SubmitBody = {
  input: string;
  missionId?: string | null;
  source?: string | null;
  autonomy_level?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  context?: unknown;
};

// Niveau de risque logique (interne Ã  la route)
type MissionRiskLevel = "normal" | "sensitive" | "critical";

// Statut DB rÃ©el pour pierre_missions
type DbMissionStatus =
  | "active"
  | "awaiting_info"
  | "awaiting_approval"
  | "draft";

// Statut DB rÃ©el pour pierre_tasks
type DbTaskStatus =
  | "ready"
  | "scheduled"
  | "awaiting_approval"
  | "blocked";

// Statut logique interne de la route
type TaskLifecycleStatus =
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
    { ok: false, error: message, ...(extra ?? {}) },
    { status },
  );
}

/**
 * Mappe le risque logique interne vers le vocabulaire rÃ©el de la DB pierre_missions.
 * PierreRiskLevel = "low" | "medium" | "high"
 */
function mapToDbRiskLevel(risk: MissionRiskLevel): "low" | "medium" | "high" {
  if (risk === "critical") return "high";
  if (risk === "sensitive") return "medium";
  return "low";
}

/**
 * Mappe le statut logique interne vers le statut DB rÃ©el de pierre_tasks.
 * PierreTaskStatus valides : "ready" | "scheduled" | "awaiting_approval" | "blocked"
 * - "queued" â†’ "ready" (DB ne connaÃ®t pas "queued")
 * - "awaiting_info" â†’ "blocked" (DB ne connaÃ®t pas "awaiting_info" pour les tasks)
 */

function mapToDbTaskType(type: string): string {
  switch (type) {
    case "generate_document":
      return "doc.generate";
    case "prepare_email":
      return "email.draft";
    case "generate_pdf":
      return "pdf.generate";
    case "schedule_follow_up":
      return "followup.schedule";
    case "request_missing_info":
      return "reminder.create";
    case "structure_mission":
      return "doc.generate";
    case "block_mission":
      return "reminder.create";

    case "email.send":
    case "email.draft":
    case "doc.generate":
    case "doc.rewrite":
    case "pdf.generate":
    case "reminder.create":
    case "followup.schedule":
      return type;

    default:
      return "doc.generate";
  }
}

function mapToDbTaskStatus(status: TaskLifecycleStatus): DbTaskStatus {
  switch (status) {
    case "queued":        return "ready";
    case "awaiting_info": return "blocked";
    case "scheduled":     return "scheduled";
    case "awaiting_approval": return "awaiting_approval";
    case "blocked":       return "blocked";
  }
}

/**
 * Mappe le statut logique vers le statut DB rÃ©el de pierre_missions.
 * PierreMissionStatus valides : "draft"|"active"|"awaiting_info"|"awaiting_approval"|...
 * - "queued" â†’ "active"
 */
function mapToDbMissionStatus(
  missingInfoCount: number,
  approvalRequired: boolean,
): DbMissionStatus {
  if (missingInfoCount > 0) return "awaiting_info";
  if (approvalRequired) return "awaiting_approval";
  return "active";
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
    return { message: error.message, code: null, details: null };
  }
  return { message: "Unexpected database error.", code: null, details: null };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CLIENT SUPABASE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AUTH
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  for (const key of ["sb-access-token", "supabase-access-token", "access-token"]) {
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

  return { userId: data.user.id, accessToken };
}

/**
 * VÃ©rifie que l'utilisateur a un accÃ¨s actif Ã  Pierre via la table orders.
 */
async function hasPierreAccess(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * Lit la liste des salariés depuis pierre_company_memory.reusable_rh_context_json.employees[].
 * Retourne [] silencieusement sur absence ou erreur — non bloquant.
 */
async function readEmployeeList(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<PierreEmployeeProfile[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_company_memory")
      .select("reusable_rh_context_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();

    if (!data) return [];

    const context = isObject(data.reusable_rh_context_json)
      ? (data.reusable_rh_context_json as Record<string, unknown>)
      : null;

    if (!context) return [];

    return sanitizePierreEmployeeList(context.employees);
  } catch {
    return [];
  }
}

/**
 * Lit le niveau d'autonomie depuis la mÃ©moire entreprise.
 * Cherche dans memory_json.hr_preferences.autonomy_level â†’ memory_json.autonomy_level
 * â†’ preferences.autonomy_level.
 * Fallback silencieux "validation_smart" sur absence ou erreur.
 */
async function readAutonomyLevel(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<PierreAutonomyLevel> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_company_memory")
      .select("memory_json, preferences")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return "validation_smart";

    const memoryJson: Record<string, unknown> | null = isObject(data.memory_json)
      ? (data.memory_json as Record<string, unknown>)
      : null;

    const hrPrefs = getNestedObject(memoryJson, "hr_preferences");
    const fromHrPrefs = getNestedString(hrPrefs, "autonomy_level");
    if (fromHrPrefs) return resolvePierreAutonomyLevel(fromHrPrefs);

    const fromMemory = getNestedString(memoryJson, "autonomy_level");
    if (fromMemory) return resolvePierreAutonomyLevel(fromMemory);

    const preferences: Record<string, unknown> | null = isObject(data.preferences)
      ? (data.preferences as Record<string, unknown>)
      : null;
    const fromPrefs = getNestedString(preferences, "autonomy_level");
    if (fromPrefs) return resolvePierreAutonomyLevel(fromPrefs);

    return "validation_smart";
  } catch {
    return "validation_smart";
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BODY PARSING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function normalizeBody(raw: unknown): SubmitBody {
  if (!isObject(raw)) {
    return { input: "", missionId: null, source: null, context: null, autonomy_level: null };
  }
  return {
    input: asString(raw.input) || "",
    missionId: asString(raw.missionId),
    source: asString(raw.source),
    autonomy_level: asString(raw.autonomy_level),
    employee_id: asString(raw.employee_id),
    employee_name: asString(raw.employee_name),
    context: raw.context ?? null,
  };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// INTERPRÃ‰TATION (logique pure, sans DB)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function detectLanguage(input: string): string {
  const lower = input.toLowerCase();
  const englishSignals = [
    "candidate", "interview", "job offer", "follow up",
    "meeting", "please", "draft", "recruitment", "hiring",
  ];
  const hits = englishSignals.filter((s) => lower.includes(s)).length;
  return hits >= 2 ? "en" : "fr";
}

function detectTone(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("ferme") || lower.includes("strict") || lower.includes("recadr") || lower.includes("formal warning")) return "ferme";
  if (lower.includes("humain") || lower.includes("bienveillant") || lower.includes("chaleureux")) return "humain";
  return "professionnel";
}

function detectClassification(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("offre d'emploi") || lower.includes("job offer")) return "offre_emploi";
  if (lower.includes("convocation") || lower.includes("entretien")) return "convocation_entretien";
  if (lower.includes("refus") || lower.includes("rejet candidature")) return "refus_candidat";
  if (lower.includes("relance") || lower.includes("follow up")) return "relance_rh";
  if (lower.includes("onboarding") || lower.includes("intÃ©gration")) return "onboarding";
  if (lower.includes("note rh")) return "note_rh";
  if (lower.includes("procÃ©dure") || lower.includes("procedure")) return "rappel_procedure";
  if (lower.includes("compte rendu") || lower.includes("compte-rendu")) return "compte_rendu";
  if (lower.includes("courrier")) return "courrier_rh";
  if (lower.includes("candidat") || lower.includes("recrut")) return "recrutement";
  return "mission_rh_generale";
}

function detectIntent(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("envoie") || lower.includes("envoyer") || lower.includes("send")) return "execute_rh_action";
  if (lower.includes("prÃ©pare") || lower.includes("prepare") || lower.includes("rÃ©dige") || lower.includes("redige") || lower.includes("draft")) return "prepare_rh_deliverable";
  if (lower.includes("relance")) return "follow_up_rh_action";
  if (lower.includes("programme") || lower.includes("planifie")) return "schedule_rh_action";
  return "structure_rh_mission";
}

function detectRisk(input: string, classification: string): MissionRiskLevel {
  const lower = input.toLowerCase();

  const criticalSignals = [
    "licenciement", "sanction disciplinaire", "harcÃ¨lement", "harcelement",
    "plainte", "contentieux", "prud'hommes", "discrimination", "rupture conventionnelle forcÃ©e",
  ];
  const sensitiveSignals = [
    "avertissement", "mise Ã  pied", "mise a pied", "conflit",
    "problÃ¨me salariÃ©", "probleme salarie", "absence injustifiÃ©e",
    "absence injustifiee", "salaire", "confidentiel", "dossier sensible",
  ];

  if (criticalSignals.some((s) => lower.includes(s))) return "critical";
  if (sensitiveSignals.some((s) => lower.includes(s))) return "sensitive";
  if (
    classification === "refus_candidat" ||
    classification === "convocation_entretien" ||
    classification === "onboarding" ||
    classification === "offre_emploi"
  ) return "normal";

  return "normal";
}

function needsApproval(input: string, risk: MissionRiskLevel): boolean {
  const lower = input.toLowerCase();
  if (risk === "critical") return true;

  const approvalSignals = [
    "aprÃ¨s validation", "apres validation", "soumets moi avant envoi",
    "avant d'envoyer", "avant envoi", "Ã  valider", "a valider",
    "validation manager", "validation humaine",
  ];
  if (approvalSignals.some((s) => lower.includes(s))) return true;
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
      if (date.getTime() < now.getTime()) date.setDate(date.getDate() + 1);
      return date.toISOString();
    }
  }

  if (lower.includes("plus tard aujourd'hui") || lower.includes("plus tard aujourd hui")) {
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
  const missing: string[] = [];
  const questions: string[] = [];

  const hasPersonName = /\b[A-ZÃ‰ÃˆÃ€Ã‚ÃŠÃŽÃ”Ã›Ã„Ã‹ÃÃ–Ãœ][a-zÃ©Ã¨Ã Ã¢ÃªÃ®Ã´Ã»Ã¤Ã«Ã¯Ã¶Ã¼'-]+\s+[A-ZÃ‰ÃˆÃ€Ã‚ÃŠÃŽÃ”Ã›Ã„Ã‹ÃÃ–Ãœ][a-zÃ©Ã¨Ã Ã¢ÃªÃ®Ã´Ã»Ã¤Ã«Ã¯Ã¶Ã¼'-]+\b/.test(input);
  const hasEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(input);
  const hasDate = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/.test(input);
  const hasHour = /\b\d{1,2}h(\d{2})?\b/i.test(input);

  if (classification === "convocation_entretien" && !hasDate) {
    missing.push("Date d'entretien manquante");
    questions.push("Quelle est la date exacte de l'entretien ?");
  }
  if (classification === "convocation_entretien" && !hasHour) {
    missing.push("Horaire d'entretien manquant");
    questions.push("Ã€ quelle heure doit avoir lieu l'entretien ?");
  }
  if (
    (classification === "refus_candidat" || classification === "relance_rh" ||
     classification === "onboarding" || classification === "convocation_entretien") &&
    !hasPersonName
  ) {
    missing.push("IdentitÃ© de la personne concernÃ©e manquante");
    questions.push("Quel est le nom complet de la personne concernÃ©e ?");
  }
  if (
    (classification === "refus_candidat" || classification === "relance_rh" ||
     classification === "convocation_entretien") &&
    !hasEmail
  ) {
    missing.push("Adresse email destinataire manquante");
    questions.push("Quelle est l'adresse email du destinataire ?");
  }
  if (classification === "offre_emploi" && !input.toLowerCase().includes("poste")) {
    missing.push("IntitulÃ© du poste absent ou insuffisant");
    questions.push("Quel est l'intitulÃ© exact du poste ?");
  }

  return { missing, questions };
}

function buildMissionSummary(
  input: string,
  classification: string,
  risk: MissionRiskLevel,
): string {
  const base = input.trim().replace(/\s+/g, " ");
  const clipped = base.length > 260 ? `${base.slice(0, 257)}â€¦` : base;
  return `Mission RH classÃ©e "${classification}" avec niveau de risque "${risk}". Demande structurÃ©e Ã  partir de : ${clipped}`;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HR ROUTING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function routeClassificationToHrDomain(classification: string): string {
  switch (classification) {
    case "recrutement":           return "recruitment_ops";
    case "offre_emploi":          return "hiring";
    case "convocation_entretien": return "interview";
    case "refus_candidat":        return "recruitment_ops";
    case "relance_rh":            return "recruitment_ops";
    case "onboarding":            return "onboarding";
    case "note_rh":               return "internal_communication";
    case "rappel_procedure":      return "compliance_workflow";
    case "compte_rendu":          return "hr_helpdesk";
    case "courrier_rh":           return "employee_relations";
    default:                      return "unknown";
  }
}

function routeTaskKind(classification: string, taskType: string): PierreHrTaskKind | null {
  if (taskType === "request_missing_info") return "demande_info";
  if (taskType === "schedule_follow_up")   return "relance";
  if (taskType === "structure_mission")    return "creation_tache";
  if (taskType === "generate_pdf")         return "document_rh";

  if (taskType === "generate_document") {
    switch (classification) {
      case "convocation_entretien": return "trame_entretien";
      case "onboarding":            return "onboarding_prep";
      case "note_rh":               return "synthese_interne";
      case "rappel_procedure":      return "rapport_standard";
      case "compte_rendu":          return "compte_rendu";
      case "courrier_rh":           return "courrier_disciplinaire_prep";
      default:                      return "document_rh";
    }
  }

  if (taskType === "prepare_email") {
    switch (classification) {
      case "refus_candidat":        return "refus_candidat_formel";
      case "convocation_entretien": return "email_candidat";
      case "relance_rh":            return "email_candidat";
      default:                      return "email_salarie";
    }
  }

  return null;
}

function routeHrPayload(
  classification: string,
  taskType: string,
  missionRisk: MissionRiskLevel,
  autonomyLevel: PierreAutonomyLevel,
): Record<string, unknown> {
  const hrDomain = routeClassificationToHrDomain(classification);
  const hrRisk =
    missionRisk === "critical" ? "red" :
    missionRisk === "sensitive" ? "orange" :
    "green";
  const kind = routeTaskKind(classification, taskType);

  if (!kind) {
    const autonomyDecision = decidePierreHrExecutionPolicy({
      hr_action_class: null,
      hr_approval_policy: null,
      hr_risk_level: hrRisk,
      autonomy_level: autonomyLevel,
    });
    return {
      hr_domain: hrDomain,
      hr_risk_level: hrRisk,
      autonomy_level: autonomyLevel,
      can_execute: autonomyDecision.can_execute,
      autonomy_decision: {
        can_execute: autonomyDecision.can_execute,
        approval_required: autonomyDecision.approval_required,
        blocked: autonomyDecision.blocked,
      },
      autonomy_reason: autonomyDecision.reason,
    };
  }

  const req = classifyPierreHrActionRequirement({ kind, domain: hrDomain, override_risk: hrRisk });

  const autonomyDecision = decidePierreHrExecutionPolicy({
    hr_action_class: req.action_class,
    hr_approval_policy: req.approval_policy,
    hr_risk_level: req.risk_level,
    autonomy_level: autonomyLevel,
  });

  return {
    hr_task_kind: kind,
    hr_domain: hrDomain,
    hr_risk_level: req.risk_level,
    hr_action_class: req.action_class,
    hr_approval_policy: req.approval_policy,
    human_note: req.human_note,
    autonomy_level: autonomyLevel,
    can_execute: autonomyDecision.can_execute,
    autonomy_decision: {
      can_execute: autonomyDecision.can_execute,
      approval_required: autonomyDecision.approval_required,
      blocked: autonomyDecision.blocked,
    },
    autonomy_reason: autonomyDecision.reason,
  };
}

/**
 * Calcule le statut logique d'une tÃ¢che (avant mapping DB).
 */
function routeTaskStatus(
  hrPayload: Record<string, unknown>,
  missingInfoCount: number,
  baseApprovalRequired: boolean,
  scheduledFor: string | null,
): TaskLifecycleStatus {
  const decision = isObject(hrPayload.autonomy_decision) ? hrPayload.autonomy_decision : null;
  if (decision?.blocked === true) return "blocked";
  if (missingInfoCount > 0) return "awaiting_info";
  const canExec = hrPayload.can_execute !== false;
  if (!canExec || baseApprovalRequired) return "awaiting_approval";
  if (scheduledFor) return "scheduled";
  return "queued";
}

/**
 * Calcule approval_required combinant la dÃ©cision base et la dÃ©cision autonomie.
 */
function routeTaskApproval(
  hrPayload: Record<string, unknown>,
  baseApproval: boolean,
): boolean {
  const decision = isObject(hrPayload.autonomy_decision) ? hrPayload.autonomy_decision : null;
  return baseApproval || decision?.approval_required === true;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONSTRUCTION DES TÃ‚CHES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function buildTasks(
  input: string,
  interpretation: MissionInterpretationBase,
  autonomyLevel: PierreAutonomyLevel,
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
    const hrPayload = routeHrPayload(interpretation.classification, "generate_document", interpretation.risk_level, autonomyLevel);
    tasks.push({
      type: "generate_document",
      title: "Produire le document RH",
      description: "RÃ©diger un livrable RH premium cohÃ©rent avec la demande, le ton voulu, la langue dÃ©tectÃ©e et les contraintes de risque.",
      status: routeTaskStatus(hrPayload, interpretation.missing_info.length, interpretation.approval_required, null),
      approval_required: routeTaskApproval(hrPayload, interpretation.approval_required),
      risk_level: interpretation.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        classification: interpretation.classification,
        language: interpretation.language,
        tone: interpretation.tone,
        ...hrPayload,
      },
    });
  }

  if (
    lower.includes("mail") || lower.includes("email") ||
    lower.includes("envoyer") || lower.includes("send") ||
    lower.includes("brouillon") ||
    interpretation.classification === "refus_candidat" ||
    interpretation.classification === "convocation_entretien" ||
    interpretation.classification === "relance_rh" ||
    interpretation.classification === "onboarding"
  ) {
    const hrPayload = routeHrPayload(interpretation.classification, "prepare_email", interpretation.risk_level, autonomyLevel);
    tasks.push({
      type: "prepare_email",
      title: "PrÃ©parer l'email RH",
      description: "PrÃ©parer un email clair, traÃ§able et cohÃ©rent avec la mission, prÃªt Ã  Ãªtre validÃ© ou envoyÃ© selon le niveau de risque.",
      status: routeTaskStatus(hrPayload, interpretation.missing_info.length, interpretation.approval_required, scheduledFor),
      approval_required: routeTaskApproval(hrPayload, interpretation.approval_required),
      risk_level: interpretation.risk_level,
      scheduled_for: scheduledFor,
      payload: {
        source: "mission_engine",
        language: interpretation.language,
        tone: interpretation.tone,
        scheduled_for: scheduledFor,
        ...hrPayload,
      },
    });
  }

  if (
    lower.includes("pdf") || lower.includes("export") ||
    lower.includes("document Ã  joindre") || lower.includes("document a joindre") ||
    lower.includes("piece jointe") || lower.includes("piÃ¨ce jointe")
  ) {
    const hrPayload = routeHrPayload(interpretation.classification, "generate_pdf", interpretation.risk_level, autonomyLevel);
    tasks.push({
      type: "generate_pdf",
      title: "PrÃ©parer l'export PDF",
      description: "GÃ©nÃ©rer un PDF propre Ã  partir du document ou du contenu RH finalisÃ©.",
      status: routeTaskStatus(hrPayload, interpretation.missing_info.length, interpretation.approval_required, null),
      approval_required: routeTaskApproval(hrPayload, interpretation.approval_required),
      risk_level: interpretation.risk_level,
      scheduled_for: null,
      payload: { source: "mission_engine", ...hrPayload },
    });
  }

  if (
    lower.includes("relance") ||
    lower.includes("si pas de rÃ©ponse") ||
    lower.includes("si pas de reponse")
  ) {
    const hrPayload = routeHrPayload(interpretation.classification, "schedule_follow_up", interpretation.risk_level, autonomyLevel);
    tasks.push({
      type: "schedule_follow_up",
      title: "PrÃ©parer une relance RH",
      description: "Programmer une relance propre et traÃ§able si aucune rÃ©ponse n'est obtenue.",
      status: routeTaskStatus(hrPayload, interpretation.missing_info.length, true, scheduledFor),
      approval_required: true,
      risk_level: interpretation.risk_level,
      scheduled_for: scheduledFor,
      payload: {
        source: "mission_engine",
        conditional: true,
        ...hrPayload,
      },
    });
  }

  if (interpretation.missing_info.length > 0) {
    const hrPayload = routeHrPayload(interpretation.classification, "request_missing_info", interpretation.risk_level, autonomyLevel);
    tasks.push({
      type: "request_missing_info",
      title: "Demander les informations manquantes",
      description: "Bloquer l'exÃ©cution complÃ¨te tant que les Ã©lÃ©ments indispensables Ã  une action RH propre ne sont pas fournis.",
      status: "awaiting_info",
      approval_required: false,
      risk_level: interpretation.risk_level,
      scheduled_for: null,
      payload: {
        source: "mission_engine",
        missing_info: interpretation.missing_info,
        questions: interpretation.missing_info_questions,
        ...hrPayload,
      },
    });
  }

  if (tasks.length === 0) {
    const hrPayload = routeHrPayload(interpretation.classification, "structure_mission", interpretation.risk_level, autonomyLevel);
    tasks.push({
      type: "structure_mission",
      title: "Structurer la mission RH",
      description: "CrÃ©er un cadre d'exÃ©cution RH exploitable Ã  partir de la demande libre.",
      status: routeTaskStatus(hrPayload, interpretation.missing_info.length, interpretation.approval_required, null),
      approval_required: routeTaskApproval(hrPayload, interpretation.approval_required),
      risk_level: interpretation.risk_level,
      scheduled_for: null,
      payload: { source: "mission_engine", ...hrPayload },
    });
  }

  return tasks;
}

function interpretMission(
  input: string,
  autonomyLevel: PierreAutonomyLevel = "validation_smart",
): MissionInterpretation {
  const classification = detectClassification(input);
  const language = detectLanguage(input);
  const tone = detectTone(input);
  const risk_level = detectRisk(input, classification);
  const approval_required = needsApproval(input, risk_level);
  const intent = detectIntent(input);
  const missingInfo = detectMissingInfo(input, classification);
  const summary = buildMissionSummary(input, classification, risk_level);

  const base: MissionInterpretationBase = {
    intent, classification, summary, language, tone,
    risk_level, approval_required,
    missing_info: missingInfo.missing,
    missing_info_questions: missingInfo.questions,
  };

  return { ...base, tasks: buildTasks(input, base, autonomyLevel) };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DB INSERTS â€” utilise uniquement les vraies colonnes Supabase
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * InsÃ¨re une mission dans pierre_missions.
 * Colonnes rÃ©elles : user_id, agent_slug, source, raw_input, mission_summary,
 * intent, understanding_status, risk_level, approval_required, status,
 * missing_info_json, brain_output_json, context_snapshot_json.
 */
async function insertMission(
  supabaseAdmin: SupabaseClient,
  userId: string,
  body: SubmitBody,
  interpretation: MissionInterpretation,
  employeeContext: PierreEmployeeContext | null,
  employeeWarning: string | null,
  employeeResolutionSource: "explicit_id" | "explicit_name" | "text_detection" | "none",
): Promise<DbRow> {
  const missionTitle =
    body.input.length > 120
      ? `${body.input.slice(0, 117).trim()}â€¦`
      : body.input || "Mission RH";

  const understandingStatus =
    interpretation.missing_info.length > 0 ? "missing_info" : "understood";

  const insertPayload = {
    user_id: userId,
    agent_slug: "pierre",
    source: body.source || "use_submit",
    raw_input: body.input,
    mission_summary: interpretation.summary,
    intent: interpretation.intent,
    understanding_status: understandingStatus,
    risk_level: mapToDbRiskLevel(interpretation.risk_level),
    approval_required: interpretation.approval_required,
    status: mapToDbMissionStatus(
      interpretation.missing_info.length,
      interpretation.approval_required,
    ),
    missing_info_json: interpretation.missing_info,
    brain_output_json: {
      title: missionTitle,
      classification: interpretation.classification,
      language: interpretation.language,
      tone: interpretation.tone,
      intent: interpretation.intent,
      risk_level: interpretation.risk_level,
      approval_required: interpretation.approval_required,
      missing_info: interpretation.missing_info,
      missing_info_questions: interpretation.missing_info_questions,
      task_count: interpretation.tasks.length,
      task_types: interpretation.tasks.map((t) => t.type),
      employee_resolution_source: employeeResolutionSource,
      ...(employeeContext ? {
        employee_id: employeeContext.employee_id,
        employee_name: employeeContext.employee_name,
        employee_context: employeeContext,
      } : {}),
      ...(employeeWarning ? { employee_resolution_warning: employeeWarning } : {}),
    },
    context_snapshot_json: {
      ...(isObject(body.context) ? body.context : {}),
      employee_resolution_source: employeeResolutionSource,
      ...(employeeContext ? {
        employee_id: employeeContext.employee_id,
        employee_name: employeeContext.employee_name,
        employee_context: employeeContext,
      } : {}),
      ...(employeeWarning ? { employee_resolution_warning: employeeWarning } : {}),
    },
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

/**
 * InsÃ¨re les tÃ¢ches dans pierre_tasks.
 * Colonnes rÃ©elles : mission_id, user_id, agent_slug, type, title, description,
 * status, approval_required, execute_at, payload_json.
 * NOTE : risk_level n'existe pas en colonne â€” il va dans payload_json.
 */
async function insertTasks(
  supabaseAdmin: SupabaseClient,
  userId: string,
  missionId: string,
  interpretation: MissionInterpretation,
  employeeContext: PierreEmployeeContext | null,
): Promise<DbRow[]> {
  const taskRows = interpretation.tasks.map((task) => ({
    mission_id: missionId,
    user_id: userId,
    agent_slug: "pierre",
    type: mapToDbTaskType(task.type),
    title: task.title,
    description: task.description,
    status: mapToDbTaskStatus(task.status),
    approval_required: task.approval_required,
    execute_at: task.scheduled_for ?? null,
    payload_json: enrichPayloadWithEmployeeContext(
      { ...task.payload, risk_level: task.risk_level },
      employeeContext,
    ),
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

/**
 * InsÃ¨re les logs dans pierre_task_logs.
 * Colonnes rÃ©elles : mission_id, task_id, user_id, agent_slug, event_type,
 * message, meta_json.
 * NOTE : pas de colonne 'level', 'event', 'payload' â€” tout va dans meta_json.
 */
async function insertLogs(
  supabaseAdmin: SupabaseClient,
  userId: string,
  missionId: string,
  tasks: DbRow[],
  interpretation: MissionInterpretation,
): Promise<DbRow[]> {
  const logs: Array<Record<string, unknown>> = [
    {
      mission_id: missionId,
      task_id: null,
      user_id: userId,
      agent_slug: "pierre",
      event_type: "mission_created",
      message: "Mission crÃ©Ã©e et structurÃ©e par Pierre.",
      meta_json: {
        level: "info",
        classification: interpretation.classification,
        risk_level: interpretation.risk_level,
        approval_required: interpretation.approval_required,
      },
    },
    {
      mission_id: missionId,
      task_id: null,
      user_id: userId,
      agent_slug: "pierre",
      event_type: "mission_interpreted",
      message:
        interpretation.missing_info.length > 0
          ? "Mission interprÃ©tÃ©e avec informations manquantes."
          : interpretation.approval_required
            ? "Mission interprÃ©tÃ©e avec validation requise."
            : "Mission interprÃ©tÃ©e et prÃªte pour exÃ©cution contrÃ´lÃ©e.",
      meta_json: {
        level:
          interpretation.risk_level === "critical" ||
          interpretation.missing_info.length > 0
            ? "warning"
            : "info",
        classification: interpretation.classification,
        intent: interpretation.intent,
        risk_level: interpretation.risk_level,
        missing_info_count: interpretation.missing_info.length,
        task_count: tasks.length,
      },
    },
  ];

  for (const task of tasks) {
    logs.push({
      mission_id: missionId,
      task_id: task.id ?? null,
      user_id: userId,
      agent_slug: "pierre",
      event_type: "task_created",
      message: `TÃ¢che crÃ©Ã©e : ${asString(task.title) || asString(task.type) || "task"}`,
      meta_json: {
        level: "info",
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// POST HANDLER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

    const access = await hasPierreAccess(supabaseAdmin, auth.userId);
    if (!access) {
      return jsonError(
        "AccÃ¨s Pierre requis. Activez votre abonnement Pierre pour continuer.",
        403,
        { code: "PIERRE_ACCESS_DENIED" },
      );
    }

    // Autonomy level : body override > mÃ©moire entreprise > "validation_smart"
    const autonomyLevel = body.autonomy_level
      ? resolvePierreAutonomyLevel(body.autonomy_level)
      : await readAutonomyLevel(supabaseAdmin, auth.userId);

    // Employee context : résolution depuis la liste mémoire entreprise
    const employees = await readEmployeeList(supabaseAdmin, auth.userId);
    let employeeContext: PierreEmployeeContext | null = null;
    let employeeResolutionSource: "explicit_id" | "explicit_name" | "text_detection" | "none" = "none";
    const employeeWarnings: string[] = [];

    if (body.employee_id) {
      const found = findPierreEmployeeById(employees, body.employee_id);
      if (found) {
        employeeContext = buildPierreEmployeeContext(found);
        employeeResolutionSource = "explicit_id";
      } else {
        employeeWarnings.push(`employee_id "${body.employee_id}" not found in registry`);
        if (body.employee_name) {
          const foundByName = findPierreEmployeeByName(employees, body.employee_name);
          if (foundByName) {
            employeeContext = buildPierreEmployeeContext(foundByName);
            employeeResolutionSource = "explicit_name";
          } else {
            employeeWarnings.push(`employee_name "${body.employee_name}" not found in registry`);
          }
        }
      }
    } else if (body.employee_name) {
      const found = findPierreEmployeeByName(employees, body.employee_name);
      if (found) {
        employeeContext = buildPierreEmployeeContext(found);
        employeeResolutionSource = "explicit_name";
      } else {
        employeeWarnings.push(`employee_name "${body.employee_name}" not found in registry`);
      }
    }

    if (!employeeContext && employees.length > 0) {
      const detected = detectEmployeeReferenceFromText(body.input, employees);
      if (detected) {
        employeeContext = buildPierreEmployeeContext(detected);
        employeeResolutionSource = "text_detection";
      }
    }

    const employeeWarning = employeeWarnings.length > 0 ? employeeWarnings.join("; ") : null;

    const interpretation = interpretMission(body.input, autonomyLevel);

    const mission = await insertMission(
      supabaseAdmin,
      auth.userId,
      body,
      interpretation,
      employeeContext,
      employeeWarning,
      employeeResolutionSource,
    );

    const tasks = await insertTasks(
      supabaseAdmin,
      auth.userId,
      mission.id as string,
      interpretation,
      employeeContext,
    );

    const logs = await insertLogs(
      supabaseAdmin,
      auth.userId,
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
              ? "Mission comprise partiellement. Pierre a structurÃ© la demande mais a dÃ©tectÃ© des informations manquantes avant exÃ©cution complÃ¨te."
              : interpretation.approval_required
                ? "Mission comprise. Pierre a structurÃ© l'action et positionnÃ© une validation humaine avant exÃ©cution sensible."
                : "Mission comprise et structurÃ©e. Pierre a crÃ©Ã© les tÃ¢ches nÃ©cessaires pour lancer le traitement RH.",
          created_at: new Date().toISOString(),
        },
      ],
      meta: {
        missionId: mission.id,
        userId: auth.userId,
        autonomyLevel,
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

