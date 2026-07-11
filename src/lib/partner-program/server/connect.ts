// Programme partenaires — Stripe Connect (TEST MODE UNIQUEMENT).
// CloneStore reste le vendeur du produit ; la commission est un TRANSFERT séparé vers le
// compte connecté du cabinet (jamais de destination charge, jamais le cabinet vendeur).
// Aucune activation Live : le job de versement refuse les clés live (voir payouts.ts).

import type Stripe from "stripe";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getPartnerById } from "./partners";
import { recordAudit } from "./audit";

export type ConnectDeps = {
  createAccount: (params: { email: string; country: string; metadata: Record<string, string> }) => Promise<{ id: string }>;
  createAccountLink: (params: { account: string; refreshUrl: string; returnUrl: string }) => Promise<{ url: string }>;
};

/** Dépendances Connect par défaut (Stripe Express, test mode). */
export function defaultConnectDeps(stripe: Stripe): ConnectDeps {
  return {
    createAccount: async ({ email, country, metadata }) => {
      const acct = await stripe.accounts.create({
        type: "express",
        email,
        country: country || "FR",
        capabilities: { transfers: { requested: true } },
        business_type: "company",
        metadata,
      });
      return { id: acct.id };
    },
    createAccountLink: async ({ account, refreshUrl, returnUrl }) => {
      const link = await stripe.accountLinks.create({
        account,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      });
      return { url: link.url };
    },
  };
}

/** Crée (ou réutilise) le compte connecté du cabinet. Ne l'active jamais financièrement seul. */
export async function ensureConnectedAccount(
  tx: SqlExecutor,
  deps: ConnectDeps,
  partnerId: string,
): Promise<{ ok: true; accountId: string; created: boolean } | { ok: false; error: string }> {
  const p = await getPartnerById(tx, partnerId);
  if (!p) return { ok: false, error: "partner_not_found" };
  if (p.stripe_connected_account_id) return { ok: true, accountId: p.stripe_connected_account_id, created: false };

  const acct = await deps.createAccount({ email: p.email_normalized, country: "FR", metadata: { partner_id: p.id } });
  await tx.query(
    `update clonestore_pp_partners set stripe_connected_account_id=$2, stripe_onboarding_status='pending', updated_at=now() where id=$1`,
    [partnerId, acct.id],
  );
  await recordAudit(tx, { actor: "system", action: "connect.account_created", entityType: "partner", entityId: partnerId, reason: "onboarding Stripe Connect démarré", next: { accountId: acct.id } });
  return { ok: true, accountId: acct.id, created: true };
}

/** Génère un lien d'onboarding hébergé Stripe pour le compte connecté. */
export async function createOnboardingLink(
  deps: ConnectDeps,
  accountId: string,
  urls: { refreshUrl: string; returnUrl: string },
): Promise<{ url: string }> {
  return deps.createAccountLink({ account: accountId, refreshUrl: urls.refreshUrl, returnUrl: urls.returnUrl });
}

/**
 * Applique un event account.updated : met à jour le statut d'onboarding et payouts_enabled.
 * complete UNIQUEMENT si détails soumis + charges + payouts activés. Idempotent.
 */
export async function applyAccountUpdated(
  tx: SqlExecutor,
  input: { accountId: string; detailsSubmitted: boolean; chargesEnabled: boolean; payoutsEnabled: boolean },
): Promise<{ ok: boolean; partnerId?: string; status?: string }> {
  const { rows } = await tx.query<{ id: string }>(
    `select id from clonestore_pp_partners where stripe_connected_account_id = $1`,
    [input.accountId],
  );
  if (!rows.length) return { ok: false };
  const partnerId = rows[0].id;

  const complete = input.detailsSubmitted && input.chargesEnabled && input.payoutsEnabled;
  const status = complete ? "complete" : input.detailsSubmitted ? "restricted" : "pending";
  await tx.query(
    `update clonestore_pp_partners set stripe_onboarding_status=$2, payouts_enabled=$3, updated_at=now() where id=$1`,
    [partnerId, status, input.payoutsEnabled === true],
  );
  await recordAudit(tx, { actor: "system", action: "connect.account_updated", entityType: "partner", entityId: partnerId, reason: "account.updated Stripe", next: { status, payoutsEnabled: input.payoutsEnabled } });
  return { ok: true, partnerId, status };
}
