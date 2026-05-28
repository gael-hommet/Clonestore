// B46 — POST /api/clonestore/technologies/validate
// Validates technology configuration. No auth required. Cache: no-store.
// Pure computation — no DB writes.

import { NextRequest, NextResponse } from "next/server";
import { buildAllB46TechnologyItems } from "../../../../../lib/clonestore/technologies/technology-b46-registry";
import { computeGlobalTechnologiesReadiness, getDefaultB46ReadinessContext } from "../../../../../lib/clonestore/technologies/technology-readiness";
import { buildB46TechnologiesVerdict } from "../../../../../lib/clonestore/technologies/technology-verdict";
import type {
  B46ReadinessContext,
  B46TechnologyStatus,
  CloneStoreTechnologyId,
} from "../../../../../lib/clonestore/technologies/technology-b46-types";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asString(v: unknown): string | null {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : null; }
  return null;
}

const VALID_STATUSES = new Set<B46TechnologyStatus>([
  "disabled", "draft", "needs_configuration", "ready", "active", "degraded", "blocked", "archived",
]);
const VALID_IDS = new Set<CloneStoreTechnologyId>([
  "cloneos", "cloneadn", "cloneguard", "clonetrace", "clonevoice", "clonechat",
]);

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };

  try {
    let rawBody: unknown;
    try { rawBody = await request.json(); } catch {
      rawBody = {};
    }

    const body = isObject(rawBody) ? rawBody : {};

    // Parse optional context overrides
    const rawContext = isObject(body.context) ? body.context : {};
    const context: B46ReadinessContext = getDefaultB46ReadinessContext({
      b38_closed: rawContext.b38_closed !== false,
      b39_closed: rawContext.b39_closed !== false,
      b40_closed: rawContext.b40_closed !== false,
      b41_closed: rawContext.b41_closed !== false,
      b42_closed: rawContext.b42_closed !== false,
      b43_closed: rawContext.b43_closed !== false,
      b44_closed: rawContext.b44_closed !== false,
      b45_closed: rawContext.b45_closed !== false,
      empreinte_ready: rawContext.empreinte_ready !== false,
      email_runtime_mode: asString(rawContext.email_runtime_mode) ?? (process.env.EMAIL_RUNTIME_MODE ?? "mock"),
      ai_runtime_mode: asString(rawContext.ai_runtime_mode) ?? (process.env.AI_RUNTIME_MODE ?? "mock"),
    });

    // Parse optional status overrides (strip unknown/invalid entries)
    const rawStatuses = isObject(body.status_overrides) ? body.status_overrides : {};
    const statusOverrides: Partial<Record<CloneStoreTechnologyId, B46TechnologyStatus>> = {};
    for (const [k, v] of Object.entries(rawStatuses)) {
      if (VALID_IDS.has(k as CloneStoreTechnologyId) && typeof v === "string" && VALID_STATUSES.has(v as B46TechnologyStatus)) {
        statusOverrides[k as CloneStoreTechnologyId] = v as B46TechnologyStatus;
      }
    }

    const items = buildAllB46TechnologyItems(context, statusOverrides);
    const global_readiness = computeGlobalTechnologiesReadiness(items, context);
    const verdict = buildB46TechnologiesVerdict(items, context);

    return NextResponse.json(
      {
        ok: true,
        global_readiness,
        verdict,
        technologies: items.map((t) => ({
          id: t.id,
          status: t.status,
          readiness: {
            score: t.readiness.score,
            ready: t.readiness.ready,
            blockers: t.readiness.blockers,
            warnings: t.readiness.warnings,
          },
          launch_critical: t.launch_critical,
          locked: t.locked,
        })),
        meta: { generated_at: new Date().toISOString() },
      },
      { status: 200, headers },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur interne validation.";
    return NextResponse.json({ ok: false, error: msg, code: "VALIDATE_INTERNAL_ERROR" }, { status: 500, headers });
  }
}
