// src/app/api/pierre/v1/missions/route.ts
// PHASE 8.1 — GET (list, paginated) + POST (create, idempotent) missions.
// PHASE 8.6 — gated by the product-access policy: listing is READ; creating a mission is WRITE_COSTLY
// (refused under grace/suspended/read_only/onboarding_required/denied).
import { withProductAccess } from "../_runtime";
import { apiCreateMission, apiListMissions } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return withProductAccess(req, "read", (db, ctx) =>
    apiListMissions(db, ctx, {
      limit: Number(url.searchParams.get("limit") ?? 20),
      cursor: url.searchParams.get("cursor"),
      status: url.searchParams.get("status"),
    })
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return withProductAccess(req, "write_costly", (db, ctx) =>
    apiCreateMission(db, ctx, {
      instruction: String(body.instruction ?? ""),
      source: typeof body.source === "string" ? body.source : "cockpit",
      employee_id: (body.employee_id as string) ?? null,
      site_id: (body.site_id as string) ?? null,
      autonomy_mode: body.autonomy_mode as never,
      idempotency_key: typeof body.idempotency_key === "string" ? body.idempotency_key : undefined,
    })
  );
}
