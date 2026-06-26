// BLOC 3 — Test-only seeding endpoint.
//
// Ce endpoint EXISTE UNIQUEMENT pour les tests E2E.
// Il est désactivé dans TOUS les environnements sauf si TWO conditions :
//   1. NODE_ENV != "production"
//   2. CLONESTORE_B3_TEST_SEED_ENABLED === "true"
//
// Production : ce handler répond 404 (route inexistante, fail-closed).
// Aucune fuite, aucun secret exposé. La route accepte uniquement des fixtures
// synthétiques (aucun prospect réel).

import { NextResponse, type NextRequest } from "next/server";
import { importAttributionGrant } from "@/lib/clonestore/conversion/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function disabled() {
  return new NextResponse(null, { status: 404 });
}

function isSeedEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.CLONESTORE_B3_TEST_SEED_ENABLED === "true";
}

export async function POST(request: NextRequest) {
  if (!isSeedEnabled()) return disabled();

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 2048) {
    return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const result = importAttributionGrant({
    tokenId: String(b.token_id ?? ""),
    variant: (b.variant as "VARIANT_DEPARTMENT_OUTCOME" | "VARIANT_PROOF_FIRST") ?? "VARIANT_DEPARTMENT_OUTCOME",
    cohort: String(b.cohort ?? "V0-A"),
    contactKind: (b.contact_kind as "DIRECT" | "GATEWAY") ?? "DIRECT",
    campaignId: String(b.campaign_id ?? "bloc3-e2e"),
    prospectId: String(b.prospect_id ?? "lf_e2e_001"),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 });
  }
  return NextResponse.json({ ok: true, grant_id: result.grant?.id ?? null });
}

export async function GET() {
  return disabled();
}
