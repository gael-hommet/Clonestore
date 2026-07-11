// Cabinets Fondateurs — moteur d'attribution SERVER-AUTHORITATIVE.
//
// Le cookie ne porte qu'un touch_key ; la vérité (partenaire, expiration, source) vit en
// base. On ne fait JAMAIS confiance à la seule valeur du cookie ni à un paramètre d'URL.
//
// RÈGLES DE PRIORITÉ (déterministes) :
//   1. Une attribution VERROUILLÉE ne change jamais automatiquement.
//   2. Une introduction explicite enregistrée AVANT la création du compte est prioritaire.
//   3. Sinon, le premier referral touch valide.
//   4. Sinon, un code partenaire saisi volontairement.
//   5. L'entreprise ne peut appartenir qu'à un partenaire ACTIF.
//   6. La première introduction valide gagne.
//   7. Les conflits partent en revue admin (jamais de double attribution).
//   8. Un partenaire ne peut pas se parrainer lui-même.
//   9. Un client déjà existant AVANT la source n'est pas rétroactivement attribué.
//  10. Toute décision est journalisée (source, partenaire, entreprise, raison, acteur).

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getPartnerById, getPartnerBySlug, resolvePartnerByCode, type PartnerRow } from "./partners";
import { canSupersede, detectSelfReferral, isTouchValid, sourcePriority, type AttributionSource } from "../attribution-rules";
import { emailDomain, companyFingerprint, normalizeEmail } from "./identity";
import { recordAudit } from "./audit";

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

// ── Journal des décisions (append-only) ─────────────────────────────────────

export type DecisionKind =
  | "attributed" | "superseded" | "rejected_self_referral" | "rejected_existing_client"
  | "rejected_no_source" | "rejected_partner_inactive" | "conflict_manual_review"
  | "kept_existing" | "locked";

export async function recordAttributionDecision(
  tx: SqlExecutor,
  d: {
    decision: DecisionKind;
    source?: AttributionSource | null;
    partnerId?: string | null;
    competingPartnerId?: string | null;
    subjectUserId?: string | null;
    companyDomain?: string | null;
    companyFingerprint?: string | null;
    attributionId?: string | null;
    touchId?: string | null;
    introductionId?: string | null;
    usedCode?: boolean;
    reason: string;
    actor?: string;
    conflict?: boolean;
    evidence?: unknown;
  },
): Promise<void> {
  await tx.query(
    `insert into clonestore_pp_attribution_decisions
       (decision, source, partner_id, competing_partner_id, subject_user_id, company_domain,
        company_fingerprint, attribution_id, touch_id, introduction_id, used_code, reason, actor, conflict, evidence_safe)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)`,
    [
      d.decision, d.source ?? null, d.partnerId ?? null, d.competingPartnerId ?? null, d.subjectUserId ?? null,
      d.companyDomain ?? null, d.companyFingerprint ?? null, d.attributionId ?? null, d.touchId ?? null,
      d.introductionId ?? null, d.usedCode === true, d.reason, d.actor ?? "system", d.conflict === true,
      JSON.stringify(d.evidence ?? {}),
    ],
  );
}

// ── Referral touch (clic) ────────────────────────────────────────────────────

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

type TouchRow = { id: string; partner_id: string; source: "link" | "code"; expires_at: string; occurred_at: string };

async function loadValidTouch(tx: SqlExecutor, touchKey: string): Promise<TouchRow | null> {
  const { rows } = await tx.query<TouchRow>(
    `select id, partner_id, source, expires_at, occurred_at from clonestore_pp_referral_touches where touch_key = $1`,
    [touchKey],
  );
  const t = rows[0];
  if (!t) return null;
  if (!isTouchValid({ expiresAt: Date.parse(t.expires_at), at: Date.now() })) return null;
  return t;
}

// ── Rattachement au signup ───────────────────────────────────────────────────

type Candidate = {
  partnerId: string;
  source: AttributionSource;
  touchId: string | null;
  introductionId: string | null;
  usedCode: boolean;
  sourceAt: number; // date de la source (pour la garde « client existant »)
};

export type AttachResult =
  | { ok: true; attributionId: string; source: AttributionSource; superseded: boolean }
  | { ok: true; skipped: "self_referral" | "no_valid_source" | "partner_inactive" | "locked_exists" | "existing_client" | "conflict"; }
  | { ok: false; error: string };

/**
 * Rattache une attribution au prospect à l'inscription (ou au checkout).
 * Sources résolues CÔTÉ SERVEUR, par priorité : introduction > code > lien.
 */
export async function attachAttributionAtSignup(
  tx: SqlExecutor,
  input: {
    subjectUserId: string;
    subjectEmail?: string | null;
    subjectCompanyName?: string | null;
    subjectStripeCustomerId?: string | null;
    /** Date depuis laquelle le prospect est DÉJÀ client (orders). Bloque l'attribution rétroactive. */
    subjectCustomerSince?: string | null;
    touchKey?: string | null;
    code?: string | null;
  },
): Promise<AttachResult> {
  const subjEmail = input.subjectEmail ? normalizeEmail(input.subjectEmail) : null;
  const domain = emailDomain(subjEmail);
  const fingerprint = input.subjectCompanyName
    ? companyFingerprint({ companyName: input.subjectCompanyName, email: subjEmail })
    : null;

  // Règle 1 — une attribution VERROUILLÉE ne change jamais automatiquement.
  const cur = await tx.query<{ id: string; source: AttributionSource; status: "pending" | "locked" | "revoked" | "superseded"; partner_id: string }>(
    `select id, source, status, partner_id from clonestore_pp_attributions
     where subject_user_id = $1 and status in ('pending','locked') order by created_at asc limit 1`,
    [input.subjectUserId],
  );
  const current = cur.rows[0] ?? null;
  if (current && current.status === "locked") {
    await recordAttributionDecision(tx, {
      decision: "locked", partnerId: current.partner_id, subjectUserId: input.subjectUserId, attributionId: current.id,
      companyDomain: domain, reason: "Attribution déjà verrouillée : aucun changement automatique.",
    });
    return { ok: true, skipped: "locked_exists" };
  }

  // ── Candidats, par priorité ────────────────────────────────────────────────
  const candidates: Candidate[] = [];

  // (2) Introduction explicite — rapprochement NORMALISÉ : domaine, e-mail, empreinte.
  const introRows = await tx.query<{ id: string; partner_id: string; submitted_at: string }>(
    `select id, partner_id, submitted_at from clonestore_pp_introductions
     where status in ('submitted','validated','matched')
       and (protected_until is null or protected_until >= now())
       and (
         (company_domain is not null and company_domain = $1)
         or (contact_email_normalized is not null and contact_email_normalized = $2)
         or (company_fingerprint = coalesce($3, '~none~'))
       )
     order by submitted_at asc`,
    [domain, subjEmail, fingerprint],
  );

  // (7) Conflit : plusieurs cabinets ont introduit la même entreprise → revue admin.
  const introPartners = [...new Set(introRows.rows.map((r) => r.partner_id))];
  if (introPartners.length > 1) {
    await recordAttributionDecision(tx, {
      decision: "conflict_manual_review", source: "introduction", partnerId: introPartners[0],
      competingPartnerId: introPartners[1], subjectUserId: input.subjectUserId, companyDomain: domain,
      companyFingerprint: fingerprint, introductionId: introRows.rows[0].id, conflict: true,
      reason: `Entreprise introduite par ${introPartners.length} cabinets — arbitrage administrateur requis.`,
      evidence: { partners: introPartners },
    });
    for (const pid of introPartners) {
      await tx.query(
        `insert into clonestore_pp_risk_flags (partner_id, entity_type, entity_id, kind, severity, explanation, status)
         values ($1,'attribution',$2,'attribution_conflict','high','Plusieurs cabinets ont introduit la même entreprise.','open')`,
        [pid, input.subjectUserId],
      );
    }
    return { ok: true, skipped: "conflict" };
  }

  // (6) La première introduction valide gagne.
  if (introRows.rows.length === 1 || introPartners.length === 1) {
    const first = introRows.rows[0];
    candidates.push({
      partnerId: first.partner_id, source: "introduction", touchId: null, introductionId: first.id,
      usedCode: false, sourceAt: Date.parse(first.submitted_at),
    });
  }

  // (4) Code saisi volontairement.
  if (input.code) {
    const p = await resolvePartnerByCode(tx, input.code);
    if (p) candidates.push({ partnerId: p.id, source: "code", touchId: null, introductionId: null, usedCode: true, sourceAt: Date.now() });
  }

  // (3) Premier referral touch valide (cookie signé validé en base).
  if (input.touchKey) {
    const touch = await loadValidTouch(tx, input.touchKey);
    if (touch) {
      candidates.push({
        partnerId: touch.partner_id, source: touch.source === "code" ? "code" : "link",
        touchId: touch.id, introductionId: null, usedCode: touch.source === "code",
        sourceAt: Date.parse(touch.occurred_at),
      });
    }
  }

  if (!candidates.length) {
    await recordAttributionDecision(tx, {
      decision: "rejected_no_source", subjectUserId: input.subjectUserId, companyDomain: domain,
      reason: "Aucune source d’attribution valide (ni introduction, ni code, ni lien).",
    });
    return { ok: true, skipped: "no_valid_source" };
  }

  // Priorité déterministe : introduction > invitation > code > lien.
  candidates.sort((a, b) => sourcePriority(b.source) - sourcePriority(a.source) || a.sourceAt - b.sourceAt);
  const winner = candidates[0];

  // (5) L'entreprise ne peut appartenir qu'à un partenaire ACTIF.
  const partner = await getPartnerById(tx, winner.partnerId);
  if (!partner || partner.status !== "active") {
    await recordAttributionDecision(tx, {
      decision: "rejected_partner_inactive", source: winner.source, partnerId: winner.partnerId,
      subjectUserId: input.subjectUserId, companyDomain: domain,
      reason: "Le cabinet n’est pas actif : aucune attribution.",
    });
    return { ok: true, skipped: "partner_inactive" };
  }

  // (9) Client déjà existant AVANT la source → aucune attribution rétroactive.
  if (input.subjectCustomerSince) {
    const customerSince = Date.parse(input.subjectCustomerSince);
    if (Number.isFinite(customerSince) && customerSince < winner.sourceAt) {
      await recordAttributionDecision(tx, {
        decision: "rejected_existing_client", source: winner.source, partnerId: winner.partnerId,
        subjectUserId: input.subjectUserId, companyDomain: domain, introductionId: winner.introductionId,
        touchId: winner.touchId, usedCode: winner.usedCode,
        reason: "L’entreprise était déjà cliente avant la mise en relation : pas d’attribution rétroactive.",
        evidence: { customerSince: input.subjectCustomerSince },
      });
      return { ok: true, skipped: "existing_client" };
    }
  }

  // (8) Anti-auto-parrainage.
  const signals = detectSelfReferral({
    partnerAccountUserId: partner.account_user_id,
    subjectUserId: input.subjectUserId,
    partnerSelfDomains: partner.self_domains ?? [],
    subjectEmailDomain: domain,
    partnerStripeCustomerId: null,
    subjectStripeCustomerId: input.subjectStripeCustomerId ?? null,
  });
  if (signals.length) {
    await raiseRiskFlag(tx, {
      partnerId: partner.id, entityType: "attribution", entityId: input.subjectUserId,
      kind: "self_referral_suspected", explanation: `signaux : ${signals.join(", ")}`, evidence: { signals },
    });
    await recordAttributionDecision(tx, {
      decision: "rejected_self_referral", source: winner.source, partnerId: partner.id,
      subjectUserId: input.subjectUserId, companyDomain: domain,
      reason: `Auto-parrainage détecté (${signals.join(", ")}).`, evidence: { signals },
    });
    return { ok: true, skipped: "self_referral" };
  }

  // Attribution courante conservée si la candidate n'est pas strictement prioritaire.
  if (current && !canSupersede({ current: { source: current.source, status: current.status }, candidate: winner.source })) {
    await recordAttributionDecision(tx, {
      decision: "kept_existing", source: current.source, partnerId: current.partner_id,
      subjectUserId: input.subjectUserId, attributionId: current.id, companyDomain: domain,
      reason: "Première attribution valide conservée (priorité non supérieure).",
    });
    return { ok: true, attributionId: current.id, source: current.source, superseded: false };
  }

  // ── Création de l'attribution ──────────────────────────────────────────────
  const expiresAt = winner.source === "link" || winner.source === "code" ? daysFromNow(partner.attribution_window_days) : null;
  const created = await tx.query<{ id: string }>(
    `insert into clonestore_pp_attributions
       (partner_id, subject_user_id, source, touch_id, introduction_id, status, first_touch_at, expires_at)
     values ($1,$2,$3,$4,$5,'pending', now(), $6) returning id`,
    [partner.id, input.subjectUserId, winner.source, winner.touchId, winner.introductionId, expiresAt],
  );
  const newId = created.rows[0].id;

  if (current) {
    await tx.query(`update clonestore_pp_attributions set status='superseded', superseded_by=$2, updated_at=now() where id=$1`, [current.id, newId]);
    await recordAttributionEvent(tx, { attributionId: current.id, partnerId: current.partner_id, type: "superseded", toStatus: "superseded", reason: `remplacée par ${winner.source}` });
    await recordAttributionDecision(tx, {
      decision: "superseded", source: winner.source, partnerId: partner.id, competingPartnerId: current.partner_id,
      subjectUserId: input.subjectUserId, attributionId: newId, companyDomain: domain,
      reason: `Source plus prioritaire (${winner.source}) que l’attribution existante (${current.source}).`,
    });
  }

  await recordAttributionEvent(tx, { attributionId: newId, partnerId: partner.id, type: "created", toStatus: "pending", reason: `source=${winner.source}` });
  await recordAttributionDecision(tx, {
    decision: "attributed", source: winner.source, partnerId: partner.id, subjectUserId: input.subjectUserId,
    companyDomain: domain, companyFingerprint: fingerprint, attributionId: newId,
    touchId: winner.touchId, introductionId: winner.introductionId, usedCode: winner.usedCode,
    reason: `Attribution ${winner.source} retenue (priorité ${sourcePriority(winner.source)}).`,
  });

  // L'introduction devient « matched ».
  if (winner.introductionId) {
    await tx.query(
      `update clonestore_pp_introductions set status='matched', matched_user_id=$2, updated_at=now() where id=$1 and status <> 'matched'`,
      [winner.introductionId, input.subjectUserId],
    );
  }

  return { ok: true, attributionId: newId, source: winner.source, superseded: Boolean(current) };
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

  // Le cabinet doit toujours être actif au moment du verrouillage.
  const partner = await getPartnerById(tx, a.partner_id);
  if (!partner || partner.status !== "active") return { ok: false, error: "partner_inactive" };

  await tx.query(
    `update clonestore_pp_attributions set status='locked', locked_at=now(), locked_by_event_id=$2, updated_at=now() where id=$1`,
    [a.id, input.stripeEventId],
  );
  await recordAttributionEvent(tx, { attributionId: a.id, partnerId: a.partner_id, type: "locked", fromStatus: "pending", toStatus: "locked", reason: `1ʳᵉ facture payée (${input.stripeEventId})` });
  await recordAttributionDecision(tx, {
    decision: "locked", partnerId: a.partner_id, subjectUserId: input.subjectUserId, attributionId: a.id,
    reason: `Attribution verrouillée à la première facture payée (${input.stripeEventId}).`,
  });

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

/** Attribution administrative exceptionnelle (double validation en amont). */
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
  await recordAttributionDecision(tx, {
    decision: "attributed", source: "admin", partnerId: input.partnerId, subjectUserId: input.subjectUserId,
    attributionId: id, reason: input.reason, actor: input.actor,
  });
  await recordAudit(tx, { actor: input.actor, action: "attribution.admin_override", entityType: "attribution", entityId: id, reason: input.reason, next: { partnerId: input.partnerId, subjectUserId: input.subjectUserId } });
  return { ok: true, attributionId: id };
}
