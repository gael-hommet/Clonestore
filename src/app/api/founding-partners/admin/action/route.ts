// CloneStory — actions d'administration (POST). Gardée par la session Supabase +
// allowlist propriétaire (réutilise la garde Phase E). Chaque action exige une RAISON
// et est tracée dans le journal append-only.

import { NextResponse } from "next/server";
import { resolveFounderAdmin, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { readJsonBounded } from "@/lib/founder-access/request-utils";
import {
  adminResolveDispute,
  adminRevokeLink,
  adminSetSuspension,
  adminVerifyContribution,
  adminInvalidateContribution,
  adminReconcileCommercial,
  adminAddNote,
  adminReplayEmails,
  adminAnonymizeProspect,
  adminAnonymizePartner,
} from "@/lib/clonestory/founding-partners/server/admin-store";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

export async function POST(req: Request) {
  const auth = await resolveFounderAdmin();
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);

  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_STORE });
  const action = String(body.action ?? "");
  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ ok: false, error: "reason_required" }, { status: 422, headers: NO_STORE });
  const partnerId = typeof body.partnerId === "string" ? body.partnerId : null;
  const introductionId = typeof body.introductionId === "string" ? body.introductionId : null;
  const contributionId = typeof body.contributionId === "string" ? body.contributionId : null;

  let result: { ok: boolean } = { ok: false };
  switch (action) {
    case "suspend":
      if (partnerId) result = await adminSetSuspension(auth.email, partnerId, true, reason);
      break;
    case "reinstate":
      if (partnerId) result = await adminSetSuspension(auth.email, partnerId, false, reason);
      break;
    case "revoke_link":
      if (partnerId) result = await adminRevokeLink(auth.email, partnerId, reason);
      break;
    case "resolve_dispute":
      if (introductionId && (body.decision === "verified" || body.decision === "canceled")) {
        result = await adminResolveDispute(auth.email, introductionId, body.decision, reason);
      }
      break;
    case "verify_contribution":
      if (contributionId) result = await adminVerifyContribution(auth.email, contributionId, reason);
      break;
    case "invalidate_contribution":
      if (contributionId) result = await adminInvalidateContribution(auth.email, contributionId, reason);
      break;
    case "reconcile_commercial":
      result = await adminReconcileCommercial(auth.email, reason);
      break;
    case "add_note":
      if (partnerId) result = await adminAddNote(auth.email, partnerId, typeof body.note === "string" ? body.note : reason);
      break;
    case "replay_emails":
      result = await adminReplayEmails(auth.email, reason);
      break;
    case "anonymize_prospect":
      if (introductionId) result = await adminAnonymizeProspect(auth.email, introductionId, reason);
      break;
    case "anonymize_partner":
      if (partnerId) result = await adminAnonymizePartner(auth.email, partnerId, reason);
      break;
    default:
      return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 422, headers: NO_STORE });
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 422, headers: NO_STORE });
}
