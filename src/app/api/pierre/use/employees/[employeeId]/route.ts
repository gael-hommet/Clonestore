import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizePierreEmployeeList,
  findPierreEmployeeById,
  updatePierreEmployeeProfile,
  deletePierreEmployeeProfile,
  type PierreEmployeeProfile,
} from "../../../../../../lib/pierre/hr/employee";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type JsonErrorExtra = { code?: string | null; details?: unknown };

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json(
    { ok: false, error: message, ...(extra ?? {}) },
    { status },
  );
}

function mapDbError(error: unknown) {
  if (isObject(error)) {
    return {
      message: asString(error.message) || "Unexpected database error.",
      code: asString(error.code),
    };
  }
  if (error instanceof Error) return { message: error.message, code: null };
  return { message: "Unexpected database error.", code: null };
}

// ═══════════════════════════════════════════════════════════
// CLIENT SUPABASE
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

function tryReadBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function tryReadSupabaseCookieToken(request: NextRequest): string | null {
  for (const key of ["sb-access-token", "supabase-access-token", "access-token"]) {
    const found = request.cookies.get(key)?.value;
    if (found) return found;
  }

  for (const cookie of request.cookies.getAll()) {
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
        if (candidate) return candidate;
      }
      if (isObject(parsed)) {
        const currentSession = isObject(parsed.currentSession)
          ? parsed.currentSession
          : null;
        const candidate =
          asString(parsed.access_token) ||
          (currentSession ? asString(currentSession.access_token) : null);
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
): Promise<string> {
  const accessToken =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);

  if (!accessToken) {
    throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
  }

  return data.user.id;
}

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

// ═══════════════════════════════════════════════════════════
// STOCKAGE — reusable_rh_context_json
// ═══════════════════════════════════════════════════════════

type MemoryRow = {
  id: string;
  reusable_rh_context_json: Record<string, unknown> | null;
};

async function readMemoryRow(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<MemoryRow | null> {
  const { data, error } = await supabaseAdmin
    .from("pierre_company_memory")
    .select("id, reusable_rh_context_json")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    reusable_rh_context_json: isObject(data.reusable_rh_context_json)
      ? (data.reusable_rh_context_json as Record<string, unknown>)
      : null,
  };
}

function extractEmployees(row: MemoryRow | null): PierreEmployeeProfile[] {
  if (!row?.reusable_rh_context_json) return [];
  return sanitizePierreEmployeeList(row.reusable_rh_context_json.employees);
}

async function persistEmployees(
  supabaseAdmin: SupabaseClient,
  row: MemoryRow,
  nextEmployees: PierreEmployeeProfile[],
): Promise<void> {
  const currentContext = row.reusable_rh_context_json ?? {};
  const nextContext = { ...currentContext, employees: nextEmployees };

  const { error } = await supabaseAdmin
    .from("pierre_company_memory")
    .update({ reusable_rh_context_json: nextContext })
    .eq("id", row.id);

  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════
// GET — profil salarié unique
// ═══════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const { employeeId } = await params;
    if (!employeeId?.trim()) {
      return jsonError("Employee ID is required.", 400, { code: "EMPLOYEE_ID_REQUIRED" });
    }

    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    const row = await readMemoryRow(supabaseAdmin, userId);
    const employees = extractEmployees(row);
    const employee = findPierreEmployeeById(employees, employeeId);

    if (!employee) {
      return jsonError(
        `Aucun profil salarié trouvé pour l'identifiant : ${employeeId}`,
        404,
        { code: "EMPLOYEE_NOT_FOUND" },
      );
    }

    return NextResponse.json({ ok: true, employee });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status as number,
        { code: asString(error.code) },
      );
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}

// ═══════════════════════════════════════════════════════════
// PATCH — mise à jour partielle d'un salarié
// ═══════════════════════════════════════════════════════════

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const { employeeId } = await params;
    if (!employeeId?.trim()) {
      return jsonError("Employee ID is required.", 400, { code: "EMPLOYEE_ID_REQUIRED" });
    }

    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonError("Corps JSON invalide.", 400, { code: "INVALID_JSON" });
    }

    const patch = isObject(rawBody) ? (rawBody as Record<string, unknown>) : {};

    const row = await readMemoryRow(supabaseAdmin, userId);
    const employees = extractEmployees(row);

    const { employees: nextEmployees, employee } = updatePierreEmployeeProfile(
      employees,
      employeeId,
      patch,
    );

    if (!employee) {
      return jsonError(
        `Aucun profil salarié trouvé pour l'identifiant : ${employeeId}`,
        404,
        { code: "EMPLOYEE_NOT_FOUND" },
      );
    }

    if (!row) {
      return jsonError("Mémoire entreprise introuvable.", 404, {
        code: "MEMORY_NOT_FOUND",
      });
    }

    await persistEmployees(supabaseAdmin, row, nextEmployees);

    return NextResponse.json({ ok: true, employee });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status as number,
        { code: asString(error.code) },
      );
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE — supprime un salarié (conserve missions/tasks/docs)
// ═══════════════════════════════════════════════════════════

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const { employeeId } = await params;
    if (!employeeId?.trim()) {
      return jsonError("Employee ID is required.", 400, { code: "EMPLOYEE_ID_REQUIRED" });
    }

    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    const row = await readMemoryRow(supabaseAdmin, userId);
    const employees = extractEmployees(row);

    const { employees: nextEmployees, deleted } = deletePierreEmployeeProfile(
      employees,
      employeeId,
    );

    if (!deleted) {
      return jsonError(
        `Aucun profil salarié trouvé pour l'identifiant : ${employeeId}`,
        404,
        { code: "EMPLOYEE_NOT_FOUND" },
      );
    }

    if (!row) {
      return jsonError("Mémoire entreprise introuvable.", 404, {
        code: "MEMORY_NOT_FOUND",
      });
    }

    await persistEmployees(supabaseAdmin, row, nextEmployees);

    return NextResponse.json({
      ok: true,
      deleted: true,
      employee_id: employeeId,
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status as number,
        { code: asString(error.code) },
      );
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
