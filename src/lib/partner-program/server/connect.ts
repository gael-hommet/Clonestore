// Programme partenaires — Stripe Connect (TEST MODE UNIQUEMENT).
// CloneStore reste le vendeur du produit ; la commission est un TRANSFERT séparé vers le
// compte connecté du cabinet (jamais de destination charge, jamais le cabinet vendeur).
// Aucune activation Live : le job de versement refuse les clés live (voir payouts.ts).

import type Stripe from "stripe";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getPartnerById, tryAutoActivate } from "./partners";
import { recordAudit } from "./audit";
import { enqueuePartnerEmailTx } from "./emails";

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
 *
 * CE QUI EST STOCKÉ : uniquement l'ÉTAT de complétude renvoyé par Stripe et la liste des
 * exigences encore dues (des identifiants de champs Stripe, ex. `individual.id_number`).
 * Aucune coordonnée bancaire, aucun IBAN, aucun document : ils restent chez Stripe.
 */
export async function applyAccountUpdated(
  tx: SqlExecutor,
  input: {
    accountId: string; detailsSubmitted: boolean; chargesEnabled: boolean; payoutsEnabled: boolean;
    /** Identifiants de champs Stripe encore requis (jamais de valeurs, jamais de PII). */
    requirementsDue?: string[];
    disabledReason?: string | null;
  },
): Promise<{ ok: boolean; partnerId?: string; status?: string; activated?: boolean }> {
  const { rows } = await tx.query<{ id: string; email_normalized: string; payouts_enabled: boolean }>(
    `select id, email_normalized, payouts_enabled from clonestore_pp_partners where stripe_connected_account_id = $1`,
    [input.accountId],
  );
  if (!rows.length) return { ok: false };
  const partnerId = rows[0].id;
  const wasPayoutsEnabled = rows[0].payouts_enabled === true;

  const complete = input.detailsSubmitted && input.chargesEnabled && input.payoutsEnabled;
  const status = complete ? "complete" : input.detailsSubmitted ? "restricted" : "pending";
  // Les exigences sont bornées et tronquées : ce sont des noms de champs, jamais des valeurs.
  const due = (input.requirementsDue ?? []).slice(0, 40).map((r) => String(r).slice(0, 80));
  await tx.query(
    `update clonestore_pp_partners
        set stripe_onboarding_status=$2, payouts_enabled=$3, stripe_details_submitted=$4,
            stripe_requirements_due=$5, stripe_disabled_reason=$6, updated_at=now()
      where id=$1`,
    [partnerId, status, input.payoutsEnabled === true, input.detailsSubmitted === true, due, input.disabledReason ?? null],
  );
  await recordAudit(tx, { actor: "system", action: "connect.account_updated", entityType: "partner", entityId: partnerId, reason: "account.updated Stripe", next: { status, payoutsEnabled: input.payoutsEnabled, requirementsDue: due.length } });

  // Le compte vient de devenir capable de recevoir : on prévient le cabinet, une seule fois.
  if (input.payoutsEnabled === true && !wasPayoutsEnabled) {
    await enqueuePartnerEmailTx(tx, {
      partnerId, kind: "connect_ready", toEmail: rows[0].email_normalized,
      idempotencyKey: `pp-email:connect_ready:${partnerId}`,
    });
  }

  // Un même compte connecté ne peut pas servir plusieurs cabinets (fraude) → revue.
  const shared = await tx.query<{ n: number }>(
    `select count(*)::int n from clonestore_pp_partners where stripe_connected_account_id = $1`,
    [input.accountId],
  );
  if (Number(shared.rows[0]?.n ?? 0) > 1) {
    await tx.query(
      `insert into clonestore_pp_risk_flags (partner_id, entity_type, entity_id, kind, severity, explanation, status)
       values ($1,'partner',$2,'shared_stripe_account','high','Le même compte Stripe Connect est rattaché à plusieurs cabinets.','open')`,
      [partnerId, partnerId],
    );
  }

  // ACTIVATION AUTOMATIQUE : dès que l'onboarding est complet et les conditions acceptées,
  // le cabinet devient actif sans aucune intervention administrateur.
  const auto = await tryAutoActivate(tx, partnerId);
  return { ok: true, partnerId, status, activated: auto.activated };
}
