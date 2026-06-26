// CloneStory — MOTEUR D'ATTRIBUTION (CS-FINAL 2).
//
// Unifie deux origines en une attribution centrale auditable :
//   • clic d'un lien partenaire `/r/<code>` (origine A) ;
//   • introduction nominative confirmée (origine B).
//
// Règles VERROUILLÉES (déterministes, documentées — voir docs/CS_FINAL_2) :
//   1. une attribution durable déjà attachée au compte est CONSERVÉE (aucun vol) ;
//   2. une introduction nominative confirmée prime sur un simple clic (nominatif >
//      anonyme), quel que soit l'ordre ;
//   3. à défaut, le premier lien partenaire valide (first-touch cookie) ;
//   4. sinon, aucune attribution.
// Tout conflit → décision déterministe + motif structuré + trace append-only ;
// jamais d'écrasement illégitime ; aucune attribution sur domaine générique / IP seule.
//
// Ce module N'effectue AUCUN paiement (purchase/verified = CS-FINAL 3) ; le modèle est
// prêt à les recevoir. Toutes les écritures passent en mode SERVICE (validation en code,
// RLS forcée). L'e-mail fourni à `captureAccountAttribution` DOIT être authentifié.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getClonestoryDb, withService } from "./runtime";
import { normalizeEmailForCompare, companyDedupKey } from "../normalize";
import { companyFingerprint, sha256Hex } from "../token";
import { companySalt } from "./config";

// Priorités de source (plus haut = plus fort).
const P_MANUAL = 200;
const P_INTRODUCTION = 100;
const P_LINK = 50;

const ACTIVE = ["anonymous", "account_linked", "company_linked"] as const;
const DURABLE = ["account_linked", "company_linked"] as const;
const INTRO_CONFIRMED_PLUS = [
  "prospect_confirmed", "prospect_registered", "company_created",
  "purchase_captured", "activation_completed", "validation_pending", "verified",
];

// Domaines génériques : jamais une preuve d'entreprise.
const GENERIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.fr", "hotmail.com", "hotmail.fr",
  "live.com", "live.fr", "yahoo.com", "yahoo.fr", "icloud.com", "me.com", "aol.com",
  "proton.me", "protonmail.com", "gmx.com", "gmx.fr", "orange.fr", "free.fr", "wanadoo.fr",
  "laposte.net", "sfr.fr", "bbox.fr", "yopmail.com", "mailinator.com",
]);

function emailFingerprint(emailNorm: string): string {
  if (!emailNorm) return "";
  return sha256Hex(`csy-email:${companySalt()}:${emailNorm}`);
}
function companyDomain(emailNorm: string): string | null {
  const at = emailNorm.lastIndexOf("@");
  if (at < 0) return null;
  const d = emailNorm.slice(at + 1).trim().replace(/^www\./, "");
  return d && !GENERIC_DOMAINS.has(d) ? d : null;
}
function eligible(status: string): boolean {
  return status !== "suspended" && status !== "withdrawn";
}

// ── Événements ────────────────────────────────────────────────────────────────
async function recordAttributionEvent(
  tx: SqlExecutor, attributionId: string | null, partnerId: string, type: string,
  reason: string | null, evidence: Record<string, unknown> = {},
): Promise<void> {
  await tx.query(
    `insert into clonestory_fp_attribution_events (attribution_id, partner_id, type, reason, evidence_safe)
     values ($1,$2,$3,$4,$5::jsonb)`,
    [attributionId, partnerId, type, reason, JSON.stringify(evidence)],
  );
}
async function recordContributionEvent(
  tx: SqlExecutor, partnerId: string, introductionId: string | null, type: string, source: string,
): Promise<void> {
  await tx.query(
    `insert into clonestory_fp_contribution_events (partner_id, introduction_id, type, source, evidence_ref)
     values ($1,$2,$3,$4,$5)`,
    [partnerId, introductionId, type, source, introductionId],
  );
}

// ── Machine d'états des introductions (avance UNIQUEMENT vers l'avant) ──────────
const INTRO_ORDER: Record<string, number> = {
  declared: 0, prospect_confirmed: 1, prospect_registered: 2, company_created: 3,
  purchase_captured: 4, activation_completed: 5, validation_pending: 6, verified: 7,
};
const INTRO_TERMINAL = new Set(["canceled", "disputed", "expired"]);
const INTRO_TS: Record<string, string | null> = {
  prospect_registered: null, company_created: null, // pas de colonne dédiée → updated_at suffit
};

/** Avance une introduction vers `target` si et seulement si c'est une transition AVANT. */
export async function advanceIntroductionStatus(
  tx: SqlExecutor, introductionId: string, target: string, source = "declared",
): Promise<boolean> {
  const { rows } = await tx.query<{ status: string; partner_id: string }>(
    `select status, partner_id::text from clonestory_fp_introductions where id = $1`,
    [introductionId],
  );
  const cur = rows[0];
  if (!cur || INTRO_TERMINAL.has(cur.status)) return false;
  if ((INTRO_ORDER[target] ?? -1) <= (INTRO_ORDER[cur.status] ?? -1)) return false; // déjà au moins là
  await tx.query(`update clonestory_fp_introductions set status = $2, updated_at = now() where id = $1`, [introductionId, target]);
  const evt = target === "prospect_registered" ? "prospect_registered" : target === "company_created" ? "company_created" : null;
  if (evt) await recordContributionEvent(tx, cur.partner_id, introductionId, evt, source);
  void INTRO_TS;
  return true;
}

interface PartnerLite { id: string; status: string; email_normalized: string }
async function partnerOf(tx: SqlExecutor, partnerId: string): Promise<PartnerLite | null> {
  const { rows } = await tx.query<PartnerLite>(
    `select id::text, status, email_normalized from clonestory_fp_partners where id = $1`, [partnerId],
  );
  return rows[0] ?? null;
}

// ── Origine A : capture du clic de lien partenaire ──────────────────────────────
export interface VisitResult {
  ok: boolean;
  partnerId?: string;
  visitorId: string;
  reason: string;
  alreadyAttributed: boolean; // first-touch déjà posé
}

/**
 * Enregistre (idempotent) une attribution ANONYME first-touch pour un visiteur.
 * `partnerId` doit déjà être résolu (lien valide, non révoqué) par l'appelant.
 * `existingVisitorId` = identifiant du cookie d'attribution déjà présent (first-touch).
 */
export async function capturePartnerVisit(input: {
  partnerId: string;
  visitorId: string;
  existingVisitorId: string | null;
  sourceLinkUsageId?: number | null;
  hashedIp?: string | null;
}): Promise<VisitResult> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const partner = await partnerOf(tx, input.partnerId);
    if (!partner || !eligible(partner.status)) {
      return { ok: false, visitorId: input.visitorId, reason: "partner_ineligible", alreadyAttributed: false };
    }

    // First-touch : si le visiteur a DÉJÀ une attribution anonyme active, on la conserve
    // (un clic ultérieur ne remplace pas le premier — journalisé comme visite secondaire).
    const prior = input.existingVisitorId
      ? (await tx.query<{ id: string; partner_id: string }>(
          `select id::text, partner_id::text from clonestory_fp_attributions
            where anonymous_visitor_id = $1 and status = 'anonymous' order by first_seen_at asc limit 1`,
          [input.existingVisitorId],
        )).rows[0]
      : undefined;

    if (prior) {
      await recordAttributionEvent(tx, prior.id, prior.partner_id, "attribution_link_visited",
        prior.partner_id === input.partnerId ? "repeat_same_partner" : "secondary_other_partner",
        { secondary: true });
      return { ok: true, partnerId: prior.partner_id, visitorId: input.existingVisitorId!, reason: "first_touch_kept", alreadyAttributed: true };
    }

    // Idempotence (retry du même visiteur+partenaire) : ne pas dupliquer.
    const dup = (await tx.query<{ id: string }>(
      `select id::text from clonestory_fp_attributions
        where anonymous_visitor_id = $1 and partner_id = $2 and status = 'anonymous' limit 1`,
      [input.visitorId, input.partnerId],
    )).rows[0];
    if (dup) {
      await recordAttributionEvent(tx, dup.id, input.partnerId, "attribution_link_visited", "repeat", {});
      return { ok: true, partnerId: input.partnerId, visitorId: input.visitorId, reason: "already", alreadyAttributed: true };
    }

    const ins = await tx.query<{ id: string }>(
      `insert into clonestory_fp_attributions
         (partner_id, source_type, source_link_usage_id, anonymous_visitor_id, status, priority, expires_at, decision_reason)
       values ($1,'partner_link',$2,$3,'anonymous',$4, now() + interval '90 days', 'first_touch_link')
       returning id::text`,
      [input.partnerId, input.sourceLinkUsageId ?? null, input.visitorId, P_LINK],
    );
    const attrId = ins.rows[0].id;
    await recordAttributionEvent(tx, attrId, input.partnerId, "attribution_link_visited", "first_touch", {});
    await recordAttributionEvent(tx, attrId, input.partnerId, "attribution_candidate_created", "partner_link", {});
    return { ok: true, partnerId: input.partnerId, visitorId: input.visitorId, reason: "created", alreadyAttributed: false };
  });
}

// ── Origine B + convergence : capture à la création du compte (authentifié) ─────
export interface CaptureDecision {
  ok: boolean;
  attributed: boolean;
  partnerId?: string;
  source?: string;
  reason: string;
  conflict?: boolean;
  companyLinked?: boolean;
}

/** L'e-mail DOIT être authentifié (session). companyName optionnel (métadonnées d'inscription). */
export async function captureAccountAttribution(input: {
  accountUserId: string;
  email: string | null;
  companyName?: string | null;
  visitorId?: string | null;
}): Promise<CaptureDecision> {
  const emailNorm = normalizeEmailForCompare(input.email ?? "");
  if (!input.accountUserId || !emailNorm) return { ok: false, attributed: false, reason: "invalid_input" };

  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    // 0) Déjà attribué ? (idempotent / aucun vol)
    const existing = (await tx.query<{ id: string; partner_id: string; source_type: string }>(
      `select id::text, partner_id::text, source_type from clonestory_fp_attributions
        where account_user_id = $1 and status in ('account_linked','company_linked') limit 1`,
      [input.accountUserId],
    )).rows[0];

    // 1) Candidat introduction nominative confirmée (la plus ancienne), partenaire éligible, non self.
    const introRow = (await tx.query<{ id: string; partner_id: string; pstatus: string; pemail: string }>(
      `select i.id::text, i.partner_id::text, p.status pstatus, p.email_normalized pemail
         from clonestory_fp_introductions i join clonestory_fp_partners p on p.id = i.partner_id
        where i.prospect_email_normalized = $1 and i.status = any($2)
        order by i.confirmed_at asc nulls last, i.declared_at asc limit 1`,
      [emailNorm, INTRO_CONFIRMED_PLUS],
    )).rows[0];
    const introCand = introRow && eligible(introRow.pstatus) && introRow.pemail !== emailNorm
      ? { partnerId: introRow.partner_id, introId: introRow.id, priority: P_INTRODUCTION } : null;

    // 2) Candidat lien (cookie first-touch), partenaire éligible, non self.
    const anonRow = input.visitorId
      ? (await tx.query<{ id: string; partner_id: string; pstatus: string; pemail: string }>(
          `select a.id::text, a.partner_id::text, p.status pstatus, p.email_normalized pemail
             from clonestory_fp_attributions a join clonestory_fp_partners p on p.id = a.partner_id
            where a.anonymous_visitor_id = $1 and a.status = 'anonymous'
            order by a.first_seen_at asc limit 1`,
          [input.visitorId],
        )).rows[0]
      : undefined;
    const linkCand = anonRow && eligible(anonRow.pstatus) && anonRow.pemail !== emailNorm
      ? { partnerId: anonRow.partner_id, attrId: anonRow.id, priority: P_LINK } : null;

    const efp = emailFingerprint(emailNorm);

    // 3) Compte déjà attribué → on conserve, on tente seulement l'avancement de l'intro + entreprise.
    if (existing) {
      if (introCand && introCand.partnerId === existing.partner_id) {
        await advanceIntroductionStatus(tx, introCand.introId, "prospect_registered", "declared");
      } else if (introCand && introCand.partnerId !== existing.partner_id) {
        await recordAttributionEvent(tx, existing.id, existing.partner_id, "attribution_conflict_detected",
          "existing_kept_vs_introduction", { other_partner: introCand.partnerId });
      }
      const companyLinked = await maybeLinkCompany(tx, existing.id, existing.partner_id, input.companyName ?? null, emailNorm);
      return { ok: true, attributed: true, partnerId: existing.partner_id, source: existing.source_type, reason: "existing_kept", companyLinked };
    }

    // 4) Choix du gagnant (intro > lien) + conflit éventuel.
    const candidates = [introCand, linkCand].filter(Boolean) as { partnerId: string; priority: number }[];
    if (candidates.length === 0) return { ok: true, attributed: false, reason: "no_eligible_source" };
    const winner = candidates.reduce((a, b) => (b.priority > a.priority ? b : a));
    const conflict = Boolean(introCand && linkCand && introCand.partnerId !== linkCand.partnerId);

    let attributionId: string;
    if (winner === linkCand && linkCand) {
      // Le lien gagne (aucune intro éligible) → on promeut l'attribution anonyme.
      await tx.query(
        `update clonestory_fp_attributions
            set status='account_linked', account_user_id=$2, email_fingerprint=$3, priority=$4,
                linked_at=now(), updated_at=now(), decision_reason='link_first_touch'
          where id=$1`,
        [linkCand.attrId, input.accountUserId, efp, P_LINK],
      );
      attributionId = linkCand.attrId;
    } else if (introCand) {
      // L'introduction gagne. Si une attribution anonyme du MÊME partenaire existe, on la promeut ;
      // sinon on supersède l'anonyme d'un autre partenaire et on crée l'attribution introduction.
      if (anonRow && anonRow.partner_id === introCand.partnerId) {
        await tx.query(
          `update clonestory_fp_attributions
              set status='account_linked', account_user_id=$2, email_fingerprint=$3,
                  source_type='confirmed_introduction', source_introduction_id=$4, priority=$5,
                  linked_at=now(), updated_at=now(), decision_reason='introduction_over_link_same_partner'
            where id=$1`,
          [anonRow.id, input.accountUserId, efp, introCand.introId, P_INTRODUCTION],
        );
        attributionId = anonRow.id;
      } else {
        if (anonRow) {
          await tx.query(
            `update clonestory_fp_attributions set status='superseded', superseded_at=now(), updated_at=now(),
                    decision_reason='superseded_by_confirmed_introduction' where id=$1`,
            [anonRow.id],
          );
          await recordAttributionEvent(tx, anonRow.id, anonRow.partner_id, "attribution_superseded", "confirmed_introduction_wins", { winner: introCand.partnerId });
        }
        const ins = await tx.query<{ id: string }>(
          `insert into clonestory_fp_attributions
             (partner_id, source_type, source_introduction_id, account_user_id, email_fingerprint, status, priority, linked_at, expires_at, decision_reason)
           values ($1,'confirmed_introduction',$2,$3,$4,'account_linked',$5, now(), now()+interval '90 days','confirmed_introduction')
           returning id::text`,
          [introCand.partnerId, introCand.introId, input.accountUserId, efp, P_INTRODUCTION],
        );
        attributionId = ins.rows[0].id;
      }
      if (conflict) {
        await recordAttributionEvent(tx, attributionId, introCand.partnerId, "attribution_conflict_detected",
          "introduction_over_link", { link_partner: linkCand?.partnerId });
      }
    } else {
      return { ok: true, attributed: false, reason: "no_eligible_source" };
    }

    await recordAttributionEvent(tx, attributionId, winner.partnerId, "attribution_account_linked",
      winner === linkCand ? "partner_link" : "confirmed_introduction", {});

    // Avance l'introduction gagnante → prospect_registered.
    if (introCand && winner.partnerId === introCand.partnerId) {
      await advanceIntroductionStatus(tx, introCand.introId, "prospect_registered", "declared");
    }

    const companyLinked = await maybeLinkCompany(tx, attributionId, winner.partnerId, input.companyName ?? null, emailNorm);
    return { ok: true, attributed: true, partnerId: winner.partnerId, source: winner === linkCand ? "partner_link" : "confirmed_introduction", reason: "linked", conflict, companyLinked };
  });
}

/** Lie l'entreprise (dédup par empreinte) si un signal d'entreprise FIABLE est présent. */
async function maybeLinkCompany(
  tx: SqlExecutor, attributionId: string, partnerId: string, companyName: string | null, emailNorm: string,
): Promise<boolean> {
  const dedup = companyDedupKey({ name: companyName ?? null, domain: companyDomain(emailNorm) });
  if (!dedup) return false; // aucun signal d'entreprise fiable (domaine générique exclu)
  const fp = companyFingerprint(dedup, companySalt());
  if (!fp) return false;

  // Entreprise déjà attribuée à un AUTRE partenaire → on ne vole pas (conflit journalisé).
  const taken = (await tx.query<{ id: string; partner_id: string }>(
    `select id::text, partner_id::text from clonestory_fp_attributions
      where company_fingerprint = $1 and status = 'company_linked' limit 1`,
    [fp],
  )).rows[0];
  if (taken && taken.partner_id !== partnerId) {
    await recordAttributionEvent(tx, attributionId, partnerId, "attribution_conflict_detected",
      "company_already_attributed", { holder_partner: taken.partner_id });
    return false;
  }
  if (taken && taken.partner_id === partnerId) return true; // déjà lié (idempotent)

  await tx.query(
    `update clonestory_fp_attributions
        set status='company_linked', company_fingerprint=$2, company_ref=$3, linked_at=now(), updated_at=now()
      where id=$1`,
    [attributionId, fp, (companyName ?? "").trim().slice(0, 200) || null],
  );
  await recordAttributionEvent(tx, attributionId, partnerId, "attribution_company_linked", "company_fingerprint", {});

  // Avance l'introduction du MÊME partenaire et de la MÊME entreprise → company_created.
  const intro = (await tx.query<{ id: string }>(
    `select id::text from clonestory_fp_introductions
      where partner_id = $1 and company_fingerprint = $2 and status = any($3) order by declared_at asc limit 1`,
    [partnerId, fp, INTRO_CONFIRMED_PLUS],
  )).rows[0];
  if (intro) await advanceIntroductionStatus(tx, intro.id, "company_created", "declared");
  return true;
}

// ── Lectures / administration ───────────────────────────────────────────────────
export async function getAttributionForAccount(accountUserId: string): Promise<{ partnerId: string; status: string; source: string } | null> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const r = (await tx.query<{ partner_id: string; status: string; source_type: string }>(
      `select partner_id::text, status, source_type from clonestory_fp_attributions
        where account_user_id = $1 and status in ('account_linked','company_linked') limit 1`,
      [accountUserId],
    )).rows[0];
    return r ? { partnerId: r.partner_id, status: r.status, source: r.source_type } : null;
  });
}

/** Conflits ouverts (contrat admin). Preuves SÛRES uniquement, jamais e-mail/IP en clair. */
export async function listAttributionConflicts(limit = 50): Promise<
  { attributionId: string; partnerId: string; reason: string | null; occurredAt: string }[]
> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<{ attribution_id: string; partner_id: string; reason: string | null; occurred_at: string | Date }>(
      `select attribution_id::text, partner_id::text, reason, occurred_at
         from clonestory_fp_attribution_events where type = 'attribution_conflict_detected'
        order by occurred_at desc limit $1`,
      [limit],
    );
    return rows.map((r) => ({ attributionId: r.attribution_id, partnerId: r.partner_id, reason: r.reason, occurredAt: new Date(r.occurred_at).toISOString() }));
  });
}

export async function invalidateAttribution(attributionId: string, reason: string): Promise<boolean> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const r = (await tx.query<{ partner_id: string }>(
      `update clonestory_fp_attributions set status='invalidated', invalidated_at=now(), updated_at=now(), decision_reason=$2
        where id=$1 and status <> 'invalidated' returning partner_id::text`,
      [attributionId, reason],
    )).rows[0];
    if (!r) return false;
    await recordAttributionEvent(tx, attributionId, r.partner_id, "attribution_invalidated", reason, {});
    return true;
  });
}

/** Attribution manuelle (admin), priorité maximale. `awardedBy` non exposé au membre. */
export async function manualAttribute(input: {
  partnerId: string; accountUserId: string; awardedBy: string; reason: string;
}): Promise<{ ok: boolean; attributionId?: string }> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const partner = await partnerOf(tx, input.partnerId);
    if (!partner || !eligible(partner.status)) return { ok: false };
    // Supersède toute attribution active du compte.
    await tx.query(
      `update clonestory_fp_attributions set status='superseded', superseded_at=now(), updated_at=now(),
              decision_reason='superseded_by_manual_admin'
        where account_user_id=$1 and status in ('account_linked','company_linked')`,
      [input.accountUserId],
    );
    const ins = await tx.query<{ id: string }>(
      `insert into clonestory_fp_attributions
         (partner_id, source_type, account_user_id, status, priority, linked_at, decision_reason, evidence_safe)
       values ($1,'manual_admin',$2,'account_linked',$3, now(), $4, jsonb_build_object('awarded_by',$5::text))
       returning id::text`,
      [input.partnerId, input.accountUserId, P_MANUAL, input.reason, input.awardedBy],
    );
    await recordAttributionEvent(tx, ins.rows[0].id, input.partnerId, "attribution_account_linked", "manual_admin", { reason: input.reason });
    return { ok: true, attributionId: ins.rows[0].id };
  });
}
