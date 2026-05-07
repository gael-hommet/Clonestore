import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type PierreUseSubmitBody = {
  input?: string;
  source?: string;
};

type PierreTaskType =
  | "email.send"
  | "email.draft"
  | "doc.generate"
  | "doc.rewrite"
  | "pdf.generate"
  | "reminder.create"
  | "followup.schedule";

type PierreTaskDraft = {
  type: PierreTaskType;
  title: string;
  description: string;
  status: "draft" | "ready" | "scheduled" | "awaiting_approval" | "blocked";
  priority: number;
  approval_required: boolean;
  execute_at: string | null;
  payload_json: Record<string, unknown>;
  depends_on_json: string[];
};

type PierreInterpretation = {
  intent: string;
  mission_summary: string;
  understanding_status:
    | "understood"
    | "partially_understood"
    | "missing_info"
    | "out_of_scope";
  risk_level: "low" | "medium" | "high";
  approval_required: boolean;
  missing_info: Array<{
    key: string;
    question: string;
    expected_format: "text" | "email" | "date" | "datetime" | "choice";
    required: boolean;
  }>;
  tasks: PierreTaskDraft[];
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice("Bearer ".length).trim();
}

function makeServerSupabase(): SupabaseClient {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRole) {
    throw new Error("Supabase serveur non configurÃ©.");
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
  supabase: SupabaseClient
): Promise<{ error: string | null; user: User | null }> {
  const token = getBearerToken(req);

  if (!token) {
    return { error: "Token manquant.", user: null };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { error: error?.message || "Utilisateur non authentifiÃ©.", user: null };
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

function detectEmailInText(input: string) {
  const match = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return match?.[0] || "";
}

function detectRiskLevel(input: string): "low" | "medium" | "high" {
  const text = input.toLowerCase();

  if (
    text.includes("licenciement") ||
    text.includes("sanction") ||
    text.includes("disciplinaire") ||
    text.includes("avertissement") ||
    text.includes("mise Ã  pied") ||
    text.includes("juridique")
  ) {
    return "high";
  }

  if (
    text.includes("refus") ||
    text.includes("convocation") ||
    text.includes("candidat") ||
    text.includes("recrutement") ||
    text.includes("relance")
  ) {
    return "medium";
  }

  return "low";
}

function detectApprovalRequired(input: string, risk: "low" | "medium" | "high") {
  const text = input.toLowerCase();

  if (risk === "high") return true;

  if (
    text.includes("aprÃ¨s validation") ||
    text.includes("apres validation") ||
    text.includes("soumets-moi") ||
    text.includes("avant envoi") ||
    text.includes("ne l'envoie pas tout de suite") ||
    text.includes("ne lâ€™envoie pas tout de suite")
  ) {
    return true;
  }

  return false;
}

function detectScheduleText(input: string): string | null {
  const text = input.toLowerCase();

  const hourMatch = text.match(/\bÃ \s+(\d{1,2})h(?:(\d{2}))?\b/);
  if (!hourMatch) return null;

  const h = Number(hourMatch[1]);
  const m = Number(hourMatch[2] || "0");

  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  if (!Number.isFinite(m) || m < 0 || m > 59) return null;

  const now = new Date();
  const scheduled = new Date(now);
  scheduled.setHours(h, m, 0, 0);

  if (scheduled.getTime() < now.getTime()) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  return scheduled.toISOString();
}

function buildInterpretation(inputRaw: string): PierreInterpretation {
  const input = normalizeSpaces(inputRaw);
  const lower = input.toLowerCase();

  const detectedEmail = detectEmailInText(input);
  const riskLevel = detectRiskLevel(input);
  const approvalRequired = detectApprovalRequired(input, riskLevel);
  const executeAt = detectScheduleText(input);

  const missingInfo: PierreInterpretation["missing_info"] = [];
  const tasks: PierreTaskDraft[] = [];

  const asksEmail =
    lower.includes("mail") ||
    lower.includes("email") ||
    lower.includes("envoie") ||
    lower.includes("envoyer");

  const asksDoc =
    lower.includes("convocation") ||
    lower.includes("document") ||
    lower.includes("courrier") ||
    lower.includes("refus") ||
    lower.includes("compte rendu") ||
    lower.includes("compte-rendu") ||
    lower.includes("onboarding") ||
    lower.includes("offre d'emploi") ||
    lower.includes("offre dâ€™emploi") ||
    lower.includes("fiche de poste") ||
    lower.includes("procÃ©dure") ||
    lower.includes("procedure");

  const asksReminder =
    lower.includes("rappel") ||
    lower.includes("relance") ||
    lower.includes("si pas de rÃ©ponse") ||
    lower.includes("si pas de reponse");

  const outOfScope =
    lower.includes("prospection de masse") ||
    lower.includes("cold email") ||
    lower.includes("cold emailing") ||
    lower.includes("campagne massive");

  if (outOfScope) {
    return {
      intent: "out_of_scope",
      mission_summary: "Demande hors pÃ©rimÃ¨tre RH prÃ©vu pour Pierre.",
      understanding_status: "out_of_scope",
      risk_level: "high",
      approval_required: true,
      missing_info: [],
      tasks: [],
    };
  }

  if (asksEmail && !detectedEmail) {
    missingInfo.push({
      key: "recipient_email",
      question: "Quel est lâ€™email exact du destinataire ?",
      expected_format: "email",
      required: true,
    });
  }

  if (asksEmail) {
    tasks.push({
      type: detectedEmail ? "email.send" : "email.draft",
      title: detectedEmail ? "Envoyer un email RH" : "PrÃ©parer un brouillon email RH",
      description: detectedEmail
        ? "Envoi email demandÃ© depuis la requÃªte libre."
        : "La requÃªte demande un email mais lâ€™adresse du destinataire manque encore.",
      status: approvalRequired
        ? "awaiting_approval"
        : executeAt
        ? "scheduled"
        : missingInfo.length
        ? "blocked"
        : "ready",
      priority: 80,
      approval_required: approvalRequired,
      execute_at: executeAt,
      payload_json: {
        recipient_email: detectedEmail || null,
        raw_input: input,
      },
      depends_on_json: [],
    });
  }

  if (asksDoc || (!asksEmail && !asksReminder)) {
    tasks.push({
      type: "doc.generate",
      title: "GÃ©nÃ©rer le document RH",
      description: "Production du rendu RH demandÃ© par la mission.",
      status: missingInfo.length ? "blocked" : "ready",
      priority: 90,
      approval_required: false,
      execute_at: null,
      payload_json: {
        raw_input: input,
      },
      depends_on_json: [],
    });
  }

  if (asksReminder) {
    tasks.push({
      type: "followup.schedule",
      title: "CrÃ©er une relance / suivi",
      description: "La mission contient une logique de rappel ou relance.",
      status: missingInfo.length ? "blocked" : executeAt ? "scheduled" : "draft",
      priority: 70,
      approval_required: false,
      execute_at: executeAt,
      payload_json: {
        raw_input: input,
      },
      depends_on_json: [],
    });
  }

  const understandingStatus: PierreInterpretation["understanding_status"] = missingInfo.length
    ? "missing_info"
    : "understood";

  let intent = "general_rh_request";
  if (asksEmail && asksDoc) intent = "rh_doc_plus_email";
  else if (asksEmail) intent = "rh_email";
  else if (asksDoc) intent = "rh_document";
  else if (asksReminder) intent = "rh_followup";

  const missionSummary =
    tasks.length > 0
      ? `Mission interprÃ©tÃ©e : ${tasks.map((t) => t.title).join(" + ")}.`
      : "Mission reÃ§ue, mais aucune action exploitable nâ€™a Ã©tÃ© dÃ©tectÃ©e.";

  return {
    intent,
    mission_summary: missionSummary,
    understanding_status: tasks.length ? understandingStatus : "partially_understood",
    risk_level: riskLevel,
    approval_required: approvalRequired,
    missing_info: missingInfo,
    tasks,
  };
}

async function insertMissionAndTasks(
  supabase: SupabaseClient,
  userId: string,
  source: string,
  input: string,
  interpretation: PierreInterpretation
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
      status:
        interpretation.understanding_status === "out_of_scope"
          ? "blocked"
          : interpretation.missing_info.length > 0
          ? "awaiting_info"
          : interpretation.tasks.some((t) => t.status === "scheduled")
          ? "scheduled"
          : interpretation.tasks.some((t) => t.status === "awaiting_approval")
          ? "awaiting_approval"
          : "active",
      missing_info_json: interpretation.missing_info,
      brain_output_json: interpretation,
      context_snapshot_json: {},
    })
    .select("*")
    .single();

  if (missionError || !mission) {
    throw new Error(missionError?.message || "Impossible de crÃ©er la mission.");
  }

  let insertedTasks: Record<string, unknown>[] = [];

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

    insertedTasks = tasks || [];
  }

  const logRows = [
    {
      mission_id: mission.id,
      task_id: null,
      user_id: userId,
      agent_slug: "pierre",
      event_type: "mission_created",
      message: "Mission Pierre crÃ©Ã©e depuis /api/pierre/use/submit",
      meta_json: {
        source,
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
      message: `Task crÃ©Ã©e : ${String(task.title || "")}`,
      meta_json: {
        type: task.type,
        status: task.status,
      },
    })),
  ];

  await supabase.from("pierre_task_logs").insert(logRows);

  return {
    mission,
    tasks: insertedTasks,
  };
}

export async function POST(req: NextRequest) {
  let supabase: SupabaseClient;

  try {
    supabase = makeServerSupabase();
  } catch (e: unknown) {
    return json(500, {
      ok: false,
      error: e instanceof Error ? e.message : "Configuration serveur invalide.",
    });
  }

  const { error: authError, user } = await getAuthenticatedUser(req, supabase);

  if (authError || !user) {
    return json(401, { ok: false, error: authError || "Non authentifiÃ©." });
  }

  const access = await hasPierreAccess(supabase, user.id);

  if (access.error) {
    return json(500, { ok: false, error: access.error });
  }

  if (!access.ok) {
    return json(403, { ok: false, error: "Pierre nâ€™est pas actif sur ce compte." });
  }

  let body: PierreUseSubmitBody;

  try {
    body = (await req.json()) as PierreUseSubmitBody;
  } catch {
    return json(400, { ok: false, error: "Body JSON invalide." });
  }

  const input = safeString(body.input);
  const source = safeString(body.source) || "use_page";

  if (!input || input.length < 3) {
    return json(400, { ok: false, error: "RequÃªte libre trop courte." });
  }

  try {
    const interpretation = buildInterpretation(input);

    const { mission, tasks } = await insertMissionAndTasks(
      supabase,
      user.id,
      source,
      input,
      interpretation
    );

    return json(200, {
      ok: true,
      mission,
      interpretation,
      tasks,
    });
  } catch (e: unknown) {
    return json(500, {
      ok: false,
      error: e instanceof Error ? e.message : "Erreur lors de la crÃ©ation de mission Pierre.",
    });
  }
}