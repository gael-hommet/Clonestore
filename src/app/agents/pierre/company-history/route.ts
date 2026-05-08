import { type NextRequest } from "next/server";

import { buildJsonResponse } from "@/lib/pierre/utils";
import {
  getAuthenticatedPierreUser,
  makePierreServerSupabase,
} from "@/lib/pierre/auth";
import { hasPierreAccess } from "@/lib/pierre/access";
import {
  buildPierreDefaultMemoryShape,
  getPierreCompanyMemory,
  upsertPierreCompanyMemory,
} from "@/lib/pierre/memory";

type CompanyMemoryBody = {
  patch?: Record<string, unknown>;
  memory?: Record<string, unknown>;
  mode?: "merge" | "replace";
};

export async function GET(req: NextRequest) {
  const supabase = makePierreServerSupabase();

  const { error: authError, user } = await getAuthenticatedPierreUser(
    req,
    supabase
  );

  if (authError || !user) {
    return buildJsonResponse(401, {
      ok: false,
      error: authError || "Non authentifié.",
    });
  }

  const access = await hasPierreAccess(supabase, user.id);

  if (access.error) {
    return buildJsonResponse(500, {
      ok: false,
      error: access.error,
    });
  }

  if (!access.ok) {
    return buildJsonResponse(403, {
      ok: false,
      error: "Pierre n’est pas actif sur ce compte.",
    });
  }

  const row = await getPierreCompanyMemory(supabase, user.id);

  return buildJsonResponse(200, {
    ok: true,
    memory: buildPierreDefaultMemoryShape(row?.memory_json || {}),
    row: row || null,
  });
}

export async function POST(req: NextRequest) {
  const supabase = makePierreServerSupabase();

  const { error: authError, user } = await getAuthenticatedPierreUser(
    req,
    supabase
  );

  if (authError || !user) {
    return buildJsonResponse(401, {
      ok: false,
      error: authError || "Non authentifié.",
    });
  }

  const access = await hasPierreAccess(supabase, user.id);

  if (access.error) {
    return buildJsonResponse(500, {
      ok: false,
      error: access.error,
    });
  }

  if (!access.ok) {
    return buildJsonResponse(403, {
      ok: false,
      error: "Pierre n’est pas actif sur ce compte.",
    });
  }

  let body: CompanyMemoryBody;

  try {
    body = (await req.json()) as CompanyMemoryBody;
  } catch {
    return buildJsonResponse(400, {
      ok: false,
      error: "Body JSON invalide.",
    });
  }

  const patch = body.patch || body.memory || {};
  const mode = body.mode === "replace" ? "replace" : "merge";

  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return buildJsonResponse(400, {
      ok: false,
      error: "Le patch mémoire doit être un objet JSON.",
    });
  }

  const row = await upsertPierreCompanyMemory(supabase, {
    userId: user.id,
    patch,
    mode,
  });

  return buildJsonResponse(200, {
    ok: true,
    memory: buildPierreDefaultMemoryShape(row.memory_json || {}),
    row,
  });
}