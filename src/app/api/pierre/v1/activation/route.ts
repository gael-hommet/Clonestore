// src/app/api/pierre/v1/activation/route.ts
// PHASE 8.6 — request a customer activation. The owner/requestor identity is DERIVED FROM THE SESSION
// (never accepted from the body); the commercial proof comes from a signed handoff token or, in non-prod
// Paid-Customer-Test mode, an explicit test reference. The body never carries owner_user_id, a paid
// status, nor a company_id. In production with no valid proof, NO activation is created.
import { withUser, jsonBody } from "../_runtime";
import { Errors } from "@/lib/pierre/v1/errors";
import { requestCustomerActivation, computeProvisioningKey } from "@/lib/pierre/v1/customer-activation";
import { resolveActivationProof } from "@/lib/pierre/v1/activation-handoff";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withUser(req, async (db, identity) => {
    // a verified email is required to activate (the account that becomes owner must be real).
    if (!identity.email_confirmed_at) throw Errors.forbidden("Email must be verified to activate");
    const body = await jsonBody<{ company_name?: string; handoff_token?: string; test_commercial_reference?: string; product_key?: string }>(req);

    const proof = resolveActivationProof({
      handoff_token: body.handoff_token ?? null,
      test_commercial_reference: body.test_commercial_reference ?? null,
      product_key: body.product_key,
    });
    if (!proof) throw Errors.forbidden("No valid commercial proof for activation");

    const provisioning_key = computeProvisioningKey({ product_key: proof.product_key, commercial_reference: proof.commercial_reference });
    const activationId = await db.transaction(async (tx) => {
      await tx.query("set local role pierre_rt_app");
      return requestCustomerActivation(tx, {
        provisioning_key,
        commercial_reference: proof.commercial_reference,
        product_key: proof.product_key,
        // identity is authoritative from the SESSION — the body can never set owner_user_id/requested_by.
        requested_by: identity.user_id,
        owner_user_id: identity.user_id,
        company_name: body.company_name ?? "Nouvelle entreprise",
      });
    });
    return { ok: true, activation_id: activationId, status: "awaiting_commercial_proof" };
  });
}
