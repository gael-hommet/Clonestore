// src/app/api/clonestore/runtime/simulate/route.ts
// PHASE 4.2 — Runtime API Simulation Endpoint
//
// SIMULATION-ONLY. Aucun write DB, aucune mission créée, aucun appel IA,
// aucun envoi email/message/document, aucune exécution CloneOS, aucun moteur Pierre.
// Pas de Supabase, pas de service role. Le POST est autorisé ici UNIQUEMENT parce
// que c'est une simulation pure sans effet de bord (analyse du texte fourni).
//
// GET  → capabilities + examples (aucune simulation).
// POST → simulation-only : raw_text → intent → route → plan (plan-only).

import { NextRequest, NextResponse } from "next/server";
import {
  simulateCloneOSToPierreRuntimePlan,
} from "@/lib/clonestore/runtime-integration";
import {
  buildRuntimeIntegrationSimulationApiCapabilitiesResponse,
  buildRuntimeIntegrationSimulationApiResponse,
  buildRuntimeIntegrationSimulationApiError,
  validateRuntimeIntegrationSimulationApiRequest,
  sanitizeRuntimeIntegrationSimulationApiRequest,
} from "@/lib/clonestore/runtime-integration";

// ── GET — capabilities (read-only, aucune simulation) ─────────────────────────

export async function GET() {
  const response = buildRuntimeIntegrationSimulationApiCapabilitiesResponse();
  return NextResponse.json(response, { status: 200 });
}

// ── POST — simulation-only (aucun write, aucune mission créée) ────────────────

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      buildRuntimeIntegrationSimulationApiError(
        { code: "INVALID_JSON", message: "Corps de requête JSON invalide." },
        "invalid_request"
      ),
      { status: 400 }
    );
  }

  const validation = validateRuntimeIntegrationSimulationApiRequest(body);
  if (!validation.valid) {
    return NextResponse.json(
      buildRuntimeIntegrationSimulationApiError(
        validation.error ?? { code: "INVALID_REQUEST", message: "Requête invalide." },
        "invalid_request"
      ),
      { status: 400 }
    );
  }

  const safe = sanitizeRuntimeIntegrationSimulationApiRequest(body);

  // Simulation pure — aucun effet de bord. Aucune DB. Aucun moteur Pierre.
  const result = simulateCloneOSToPierreRuntimePlan(
    {
      raw_text: safe.raw_text,
      source: "cloneos_command_center",
      locale: safe.locale,
      user_id: safe.user_id,
      company_id: safe.company_id,
      metadata: safe.metadata,
    },
    {
      mode: "simulation",
      user_id: safe.user_id,
      company_id: safe.company_id,
    }
  );

  return NextResponse.json(
    buildRuntimeIntegrationSimulationApiResponse(result),
    { status: 200 }
  );
}
