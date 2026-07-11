// Programme partenaires — moteur d'attribution SERVER-AUTHORITATIVE.
// Le cookie ne porte qu'un touch_key ; la vérité (partenaire, expiration, source) vit en base.
// On ne fait JAMAIS confiance à la seule valeur du cookie.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getPartnerById, getPartnerBySlug, resolvePartnerByCode, type PartnerRow } from "./partners";
import { canSupersede, detectSelfReferral, isTouchValid, type AttributionSource } from "../attribution-rules";
import { emailDomain } from "./identity";
import { recordAudit } from "./audit";

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Enregistre un referral touch CÔTÉ SERVEUR au clic. Retourne touch_key (→ cookie signé). */
export async function recordReferralTouch(
  tx: SqlExecutor,
  input: { partner: PartnerRow; source: "link" | "code"; campaign?: string | null; landingPage?: string | null; ipHash?: string | null; uaSummary?: string | null },
): Promise<{ touchKey: string } | null> {
  if (input.partner.status !== "active") return null; // partenaire inactif → aucune touche
  const { rows } = await tx.query<{ touch_key: string }>(
    `insert into clonestore_pp_referral_touches
       (partner_id, source, campaign, landing_page, ip_hash, ua_summary, expires_at)
     values ($1,$2,$3,$4,$5,$6,$7) returning touch_key`,
    [
      input.partner.id, input.source, input.campaign?.slice(0, 120) ?? null, input.landingPage?.slice(0, 200) ?? null,
      input.ipHash ?? null, input.uaSummary?.slice(0, 300) ?? null, daysFromNow(input.partner.attribution_window_days),
    ],
  );
  return { touchKey: rows[0].touch_key };
}

/** Résout un partenaire depuis un lien (slug) OU un code saisi. */
export async function resolvePartnerForClick(tx: SqlExecutor, input: { slug?: string | null; code?: string | null }): Promise<PartnerRow | null> {
  if (input.slug) {
    const bySlug = await getPartnerBySlug(tx, input.slug);
    if (bySlug) return bySlug;
  }
  if (input.code) return resolvePartnerByCode(tx, input.code);
  return null;
}

type TouchRow = { id: string; partner_id: string; source: "link" | "code"; expires_at: string };

async function loadValidTouch(tx: SqlExecutor, touchKey: string): Promise<TouchRow | null> {
  const { rows } = await tx.query<TouchRow>(
    `select id, partner_id, source, expires_at from clonestore_pp_referral_touches where touch_key = $1`,
    [touchKey],
  );
  const t = rows[0];
  if (!t) return null;
  if (!isTouchValid({ expiresAt: Date.parse(t.expires_at), at: Date.now() })) return null;
  return t;
}

export type AttachResult =
  | { ok: true; attributionId: string; source: AttributionSource; superseded: boolean }
  | { ok: true; skipped: "self_referral"; signals: string[] }
  | { ok: true; skipped: "no_valid_source" }
  | { ok: true; skipped: "partner_inactive" }
  | { ok: true; skipped: "locked_exists" }
  | { ok: false; error: string };

/**
 * Rattache une attribution au prospect à l'inscription. Source résolue côté serveur depuis
 * un touch_key (cookie validé en base), un code, ou une introduction nominative validée
 * dont l'empreinte entreprise correspond. Anti-auto-parrainage : tout signal met en revue
 * (risk flag) et refuse l'attribution automatique. Première attribution valide verrouillée ;
 * une source plus forte peut remplacer tant que l'attribution n'est pas VERROUILLÉE.
 */
export async function attachAttributionAtSignup(
  tx: SqlExecutor,
  input: {
    subjectUserId: string;
    subjectEmail?: string | null;
    subjectStripeCustomerId?: string | null;
    touchKey?: string | null;
    code?: string | null;
    companyFingerprint?: string | null;
  },
): Promise<AttachResult> {
  // 1) Déterminer le partenaire candidat + la source (priorité : introduction > code > lien).
  let partnerId: string | null = null;
  let source: AttributionSource | null = null;
  let touchId: string | null = null;
  let introductionId: string | null = null;

  // Introduction nominative validée dont l'empreinte entreprise correspond (protection active).
  if (input.companyFingerprint) {
    const intro = await tx.query<{ id: string; partner_id: string }>(
      `select id, partner_id from clonestore_pp_introductions
       where company_fingerprint = $1 and status = 'validated'
         and (protected_until is null or protected_until >= now())
       order by validated_at asc limit 1`,
      [input.companyFingerprint],
    );
    if (intro.rows.length) { partnerId = intro.rows[0].partner_id; source = "introduction"; introductionId = intro.rows[0].id; }
  }

  // Code saisi (si pas déjà une introduction).
  if (!partnerId && input.code) {
    const p = await resolvePartnerByCode(tx, input.code);
    if (p) { partnerId = p.id; source = "code"; }
  }

  // Lien via touch_key (cookie validé en base).
  if (!partnerId && input.touchKey) {
    const touch = await loadValidTouch(tx, input.touchKey);
    if (touch) { partnerId = touch.partner_id; source = touch.source === "code" ? "code" : "link"; touchId = touch.id; }
  }

  if (!partnerId || !source) return { ok: true, skipped: "no_valid_source" };

  const partner = await getPartnerById(tx, partnerId);
  if (!partner || partner.status !== "active") return { ok: true, skipped: "partner_inactive" };

  // 2) Anti-auto-parrainage.
  const signals = detectSelfReferral({
    partnerAccountUserId: partner.account_user_id,
    subjectUserId: input.subjectUserId,
    partnerSelfDomains: partner.self_domains ?? [],
    subjectEmailDomain: emailDomain(input.subjectEmail ?? null),
    partnerStripeCustomerId: null,
    subjectStripeCustomerId: input.subjectStripeCustomerId ?? null,
  });
  if (signals.length) {
    await raiseRiskFlag(tx, { partnerId, entityType: "attribution", entityId: input.subjectUserId, kind: "self_referral_suspected", explanation: `signaux: ${signals.join(", ")}`, evidence: { signals } });
    return { ok: true, skipped: "self_referral", signals };
  }

  // 3) Attribution courante ?
  const cur = await tx.query<{ id: string; source: AttributionSource; status: "pending" | "locked" | "revoked" | "superseded" }>(
    `select id, source, status from clonestore_pp_attributions where subject_user_id = $1 and status in ('pending','locked') order by created_at asc limit 1`,
    [input.subjectUserId],
  );
  const current = cur.rows[0] ?? null;

  if (current && current.status === "locked") return { ok: true, skipped: "locked_exists" };

  if (!canSupersede({ current: current ? { source: current.source, status: current.status } : null, candidate: source })) {
    // On garde l'attribution existante (première valide gagne).
    return { ok: true, attributionId: current!.id, source: current!.source, superseded: false };
  }

  // 4) Créer / remplacer.
  const expiresAt = source === "link" || source === "code" ? daysFromNow(partner.attribution_window_days) : null;
  const created = await tx.query<{ id: string }>(
    `insert into clonestore_pp_attributions
       (partner_id, subject_user_id, source, touch_id, introduction_id, status, first_touch_at, expires_at)
     values ($1,$2,$3,$4,$5,'pending', now(), $6) returning id`,
    [partnerId, input.subjectUserId, source, touchId, introductionId, expiresAt],
  );
  const newId = created.rows[0].id;

  if (current) {
    await tx.query(`update clonestore_pp_attributions set status='superseded', superseded_by=$2, updated_at=now() where id=$1`, [current.id, newId]);
    await recordAttributionEvent(tx, { attributionId: current.id, partnerId, type: "superseded", toStatus: "superseded", reason: `remplacée par ${source}` });
  }
  await recordAttributionEvent(tx, { attributionId: newId, partnerId, type: "created", toStatus: "pending", reason: `source=${source}` });

  return { ok: true, attributionId: newId, source, superseded: Boolean(current) };
}

/**
 * VERROUILLE l'attribution financière à la première facture payée. Idempotent par event.
 * Crée la relation cabinet ↔ client. Après verrouillage, aucun changement libre.
 */
export async function lockAttributionOnFirstPayment(
  tx: SqlExecutor,
  input: { subjectUserId: string; stripeEventId: string; companyId?: string | null; stripeCustomerId?: string | null; stripeSubscriptionId?: string | null; companyLabel?: string | null },
): Promise<{ ok: true; attributionId: string; partnerId: string; alreadyLocked: boolean } | { ok: false; error: string }> {
  const cur = await tx.query<{ id: string; partner_id: string; status: string }>(
    `select id, partner_id, status from clonestore_pp_attributions where subject_user_id = $1 and status in ('pending','locked') order by created_at asc limit 1`,
    [input.subjectUserId],
  );
  const a = cur.rows[0];
  if (!a) return { ok: false, error: "no_attribution" };

  if (a.status === "locked") {
    return { ok: true, attributionId: a.id, partnerId: a.partner_id, alreadyLocked: true };
  }

  await tx.query(
    `update clonestore_pp_attributions set status='locked', locked_at=now(), locked_by_event_id=$2, updated_at=now() where id=$1`,
    [a.id, input.stripeEventId],
  );
  await recordAttributionEvent(tx, { attributionId: a.id, partnerId: a.partner_id, type: "locked", fromStatus: "pending", toStatus: "locked", reason: `1ʳᵉ facture payée (${input.stripeEventId})` });

  // Relation cabinet ↔ client (une par abonnement ; anti-doublon par index).
  await tx.query(
    `insert into clonestore_pp_customers (partner_id, attribution_id, subject_user_id, company_id, company_label, stripe_customer_id, stripe_subscription_id, status)
     values ($1,$2,$3,$4,$5,$6,$7,'active')
     on conflict (stripe_subscription_id) where stripe_subscription_id is not null do nothing`,
    [a.partner_id, a.id, input.subjectUserId, input.companyId ?? null, input.companyLabel ?? null, input.stripeCustomerId ?? null, input.stripeSubscriptionId ?? null],
  );

  return { ok: true, attributionId: a.id, partnerId: a.partner_id, alreadyLocked: false };
}

// ── Événements & risk flags ──────────────────────────────────────────────────

export async function recordAttributionEvent(
  tx: SqlExecutor,
  e: { attributionId: string; partnerId: string; type: string; fromStatus?: string | null; toStatus?: string | null; actor?: string; reason?: string; evidence?: unknown },
): Promise<void> {
  await tx.query(
    `insert into clonestore_pp_attribution_events (attribution_id, partner_id, type, from_status, to_status, actor, reason, evidence_safe)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [e.attributionId, e.partnerId, e.type, e.fromStatus ?? null, e.toStatus ?? null, e.actor ?? "system", e.reason ?? null, JSON.stringify(e.evidence ?? {})],
  );
}

export async function raiseRiskFlag(
  tx: SqlExecutor,
  f: { partnerId: string | null; entityType: string; entityId: string; kind: string; severity?: "low" | "medium" | "high"; explanation: string; evidence?: unknown },
): Promise<void> {
  await tx.query(
    `insert into clonestore_pp_risk_flags (partner_id, entity_type, entity_id, kind, severity, explanation, evidence_safe, status)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,'open')`,
    [f.partnerId, f.entityType, f.entityId, f.kind, f.severity ?? "medium", f.explanation, JSON.stringify(f.evidence ?? {})],
  );
}

/** Attribution administrative exceptionnelle (double validation en amont via approval_requests). */
export async function adminAttribute(
  tx: SqlExecutor,
  input: { partnerId: string; subjectUserId: string; actor: string; reason: string; approvalRequestId: string },
): Promise<{ ok: boolean; attributionId?: string; error?: string }> {
  const cur = await tx.query<{ id: string; status: string }>(
    `select id, status from clonestore_pp_attributions where subject_user_id = $1 and status = 'locked' limit 1`,
    [input.subjectUserId],
  );
  if (cur.rows.length) return { ok: false, error: "already_locked" };

  await tx.query(
    `update clonestore_pp_attributions set status='superseded', updated_at=now() where subject_user_id=$1 and status='pending'`,
    [input.subjectUserId],
  );
  const created = await tx.query<{ id: string }>(
    `insert into clonestore_pp_attributions (partner_id, subject_user_id, source, status, first_touch_at)
     values ($1,$2,'admin','pending', now()) returning id`,
    [input.partnerId, input.subjectUserId],
  );
  const id = created.rows[0].id;
  await recordAttributionEvent(tx, { attributionId: id, partnerId: input.partnerId, type: "admin_override_applied", toStatus: "pending", actor: input.actor, reason: input.reason, evidence: { approvalRequestId: input.approvalRequestId } });
  await recordAudit(tx, { actor: input.actor, action: "attribution.admin_override", entityType: "attribution", entityId: id, reason: input.reason, next: { partnerId: input.partnerId, subjectUserId: input.subjectUserId } });
  return { ok: true, attributionId: id };
}
