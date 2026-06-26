// CloneStory — CONFORMITÉ : antifraude, anonymisation RGPD, rétention (SERVER-ONLY, CS-FINAL 4).
//
// Aucun DELETE : l'anonymisation NULLifie la PII et marque `anonymized_at` en préservant
// les contraintes, l'intégrité, les comptages honnêtes et le registre honorifique
// (registry_number conservé). Les décisions antifraude sont append-only (allow/review/block).

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getClonestoryDb, withService } from "./runtime";
import { recordObservabilityEventTx } from "./observability";

export type FraudDecision = "allow" | "review" | "block";
export type FraudSubject = "registration" | "introduction" | "attribution" | "contribution" | "link";

/** Journalise une décision antifraude (append-only, preuves sûres). */
export async function recordFraudDecisionTx(
  tx: SqlExecutor, subjectType: FraudSubject, subjectId: string | null,
  decision: FraudDecision, reason: string, evidence: Record<string, unknown> = {},
): Promise<void> {
  await tx.query(
    `insert into clonestory_fp_fraud_decisions (subject_type, subject_id, decision, reason, evidence_safe)
     values ($1,$2,$3,$4,$5::jsonb)`,
    [subjectType, subjectId, decision, reason, JSON.stringify(evidence)],
  );
  if (decision !== "allow") {
    await recordObservabilityEventTx(tx, "fraud_decision", { refType: subjectType, refId: subjectId, level: "warn", message: decision, evidence: { reason } });
  }
}

export async function recordFraudDecision(
  subjectType: FraudSubject, subjectId: string | null, decision: FraudDecision, reason: string, evidence: Record<string, unknown> = {},
): Promise<void> {
  const db = await getClonestoryDb();
  await withService(db, (tx) => recordFraudDecisionTx(tx, subjectType, subjectId, decision, reason, evidence));
}

/**
 * Anonymise le prospect d'une introduction (droit à l'effacement / opposition). NULLifie
 * la PII, marque `anonymized_at`, conserve la ligne + le statut + les comptages. Idempotent.
 */
export async function anonymizeIntroductionProspect(introductionId: string, actor: string, reason: string): Promise<{ ok: boolean }> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<{ id: string; partner_id: string; anonymized_at: string | null }>(
      `select id, partner_id, anonymized_at from clonestory_fp_introductions where id = $1`, [introductionId],
    );
    const intro = rows[0];
    if (!intro) return { ok: false };
    if (intro.anonymized_at) return { ok: true }; // idempotent
    await tx.query(
      `update clonestory_fp_introductions
          set prospect_email = null, prospect_email_normalized = null, prospect_first_name = null,
              note = null, confirm_token_hash = null, anonymized_at = now(), updated_at = now()
        where id = $1`,
      [introductionId],
    );
    await recordObservabilityEventTx(tx, "introduction_anonymized", { refType: "introduction", refId: introductionId, evidence: { actor } });
    void reason;
    return { ok: true };
  });
}

/**
 * Anonymise un partenaire RETIRÉ (RGPD). NULLifie la PII, marque `anonymized_at`, CONSERVE
 * le registry_number et le statut honorifique (base légale : registre vérifié). Le compte
 * doit être `withdrawn` (sécurité). Idempotent. Aucun DELETE.
 */
export async function anonymizeWithdrawnPartner(partnerId: string, actor: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const { rows } = await tx.query<{ id: string; status: string; anonymized_at: string | null }>(
      `select id, status, anonymized_at from clonestory_fp_partners where id = $1`, [partnerId],
    );
    const p = rows[0];
    if (!p) return { ok: false, error: "not_found" };
    if (p.status !== "withdrawn") return { ok: false, error: "not_withdrawn" };
    if (p.anonymized_at) return { ok: true }; // idempotent
    // email/email_normalized sont NOT NULL + uniques → tombstone NON ROUTABLE et unique
    // (dérivé de l'id), jamais une vraie adresse. On conserve registry_number + status
    // (honorifique). phone/company/role nullables → null. Noms → tombstone neutre.
    const tombstone = `anonymized+${partnerId}@clonestory.invalid`;
    await tx.query(
      `update clonestory_fp_partners
          set email = $2, email_normalized = $2, phone = null, company = null, role = null,
              first_name = '—', last_name = '—', display_name = 'Partenaire retiré',
              anonymized_at = now(), updated_at = now()
        where id = $1`,
      [partnerId, tombstone],
    );
    await recordObservabilityEventTx(tx, "partner_anonymized", { refType: "partner", refId: partnerId, evidence: { actor } });
    void reason;
    return { ok: true };
  });
}

/**
 * Balayage de rétention (idempotent, non destructif) : anonymise les introductions REFUSÉES
 * (PII déjà purgée au refus) plus anciennes que `refusedRetentionDays`, en marquant
 * `anonymized_at`. Les durées sont configurables et documentées (CLONESTORY_DATA_RETENTION).
 */
export async function retentionSweep(now: Date = new Date(), refusedRetentionDays = 90): Promise<{ anonymizedIntroductions: number }> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const cutoff = new Date(now.getTime() - refusedRetentionDays * 24 * 3600 * 1000).toISOString();
    const { rows } = await tx.query<{ id: string }>(
      `update clonestory_fp_introductions
          set anonymized_at = now(), updated_at = now()
        where status = 'canceled' and refused_at is not null and refused_at < $1 and anonymized_at is null
        returning id::text`,
      [cutoff],
    );
    if (rows.length > 0) await recordObservabilityEventTx(tx, "retention_sweep", { refType: "introduction", evidence: { count: rows.length } });
    return { anonymizedIntroductions: rows.length };
  });
}

/** Inventaire des données traitées (transparence RGPD). Comptages seulement, aucune PII. */
export async function dataInventory(): Promise<Record<string, number>> {
  const db = await getClonestoryDb();
  return withService(db, async (tx) => {
    const count = async (sql: string) => {
      try { return Number((await tx.query<{ n: number }>(sql)).rows[0]?.n ?? 0); } catch { return 0; }
    };
    return {
      partners: await count(`select count(*)::int n from clonestory_fp_partners`),
      partnersAnonymized: await count(`select count(*)::int n from clonestory_fp_partners where anonymized_at is not null`),
      introductions: await count(`select count(*)::int n from clonestory_fp_introductions`),
      introductionsAnonymized: await count(`select count(*)::int n from clonestory_fp_introductions where anonymized_at is not null`),
      introductionsWithProspectPII: await count(`select count(*)::int n from clonestory_fp_introductions where prospect_email is not null`),
    };
  });
}
