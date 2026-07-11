// Cabinets Fondateurs — REPRISE des candidatures existantes vers le parcours automatique.
//
// Les dossiers créés avant l'admission automatique sont restés en `received` /
// `under_review` : personne ne les a validés. Cette reprise applique EXACTEMENT les mêmes
// règles que la candidature d'aujourd'hui — pas un second chemin, pas une seconde logique.
//
// GARANTIES
//  - Simulation par défaut (`dryRun: true`) : aucune écriture, un plan lisible.
//  - Idempotente : un dossier déjà provisionné est ignoré ; l'e-mail d'accès porte une clé
//    d'idempotence par partenaire → jamais deux partenaires, jamais deux e-mails.
//  - Auditée : chaque décision est tracée avec un acteur nommé.
//  - Isolée : UNE transaction par dossier. Un dossier fautif est annulé seul, les autres
//    passent (une erreur SQL avorte la transaction courante — jamais celle des voisins).

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import {
  assessApplicationRisk, provisionPartnerFromApplication, type ApplicationRow,
} from "./applications";
import { recordAudit } from "./audit";
import { enqueuePartnerEmailTx } from "./emails";
import { BLOCKING_RISKS, type RiskFlag } from "../onboarding-rules";

/** Statuts « en attente d'un humain » hérités de l'ancien parcours. */
const LEGACY_PENDING = ["received", "under_review"] as const;

export type BackfillAction = "provision" | "manual_review" | "skipped_already_provisioned" | "error";

export type BackfillItem = {
  applicationId: string;
  email: string;
  cabinetName: string;
  action: BackfillAction;
  /** Risques bloquants ayant imposé la revue humaine (vide si admission automatique). */
  blocking: string[];
  /** Renseignés uniquement lors d'une exécution réelle qui provisionne. */
  partnerId?: string;
  publicSlug?: string;
  error?: string;
};

export type BackfillReport = {
  dryRun: boolean;
  scanned: number;
  provisioned: number;
  manualReview: number;
  skipped: number;
  errors: number;
  items: BackfillItem[];
};

export type BackfillOptions = {
  /** true = simulation (défaut). Aucune écriture n'est effectuée. */
  dryRun?: boolean;
  /** Acteur tracé dans l'audit. Toujours nommé. */
  actor?: string;
  /** Borne de sécurité sur le nombre de dossiers traités. */
  limit?: number;
};

export type WithServiceFn = <T>(db: SqlExecutor, fn: (tx: SqlExecutor) => Promise<T>) => Promise<T>;

async function raiseFlags(tx: SqlExecutor, partnerId: string | null, applicationId: string, flags: RiskFlag[]): Promise<void> {
  for (const f of flags) {
    await tx.query(
      `insert into clonestore_pp_risk_flags (partner_id, entity_type, entity_id, kind, severity, explanation, evidence_safe, status)
       values ($1,'application',$2,$3,$4,$5,$6::jsonb,'open')`,
      [partnerId, applicationId, f.kind, f.severity, f.explanation, JSON.stringify({ blocking: BLOCKING_RISKS.has(f.kind), source: "backfill" })],
    );
  }
}

/** Traite UN dossier dans sa propre transaction. Retourne la ligne de rapport. */
async function processOne(tx: SqlExecutor, app: ApplicationRow, dryRun: boolean, actor: string): Promise<BackfillItem> {
  const base = { applicationId: app.id, email: app.email, cabinetName: app.cabinet_name };

  // Idempotence : le partenaire existe déjà (reprise déjà passée, ou création manuelle).
  const existing = await tx.query<{ id: string }>(
    `select id from clonestore_pp_partners where application_id = $1 or email_normalized = $2 limit 1`,
    [app.id, app.email_normalized],
  );
  if (app.created_partner_id || existing.rows.length) {
    const partnerId = app.created_partner_id ?? existing.rows[0].id;
    // Le cabinet existe : on RELIE le dossier orphelin (sans rien créer ni ré-envoyer),
    // sinon il resterait `received` et serait ré-examiné à chaque reprise.
    if (!dryRun && !app.created_partner_id) {
      await tx.query(
        `update clonestore_pp_applications
            set status='auto_approved', created_partner_id=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now()
          where id=$1`,
        [app.id, partnerId, actor],
      );
      await recordAudit(tx, {
        actor, action: "application.linked_existing_partner", entityType: "application", entityId: app.id,
        reason: "reprise — un cabinet existait déjà pour cet e-mail : aucun doublon créé",
        next: { partnerId, source: "backfill" },
      });
    }
    return { ...base, action: "skipped_already_provisioned", blocking: [], partnerId };
  }

  // Mêmes règles que la candidature d'aujourd'hui — le dossier ne se compte pas lui-même.
  const decision = await assessApplicationRisk(tx, {
    emailNormalized: app.email_normalized,
    website: app.website,
    country: app.country,
    ipHash: app.ip_hash,
    excludeApplicationId: app.id,
  });

  if (decision.admit === "manual_review") {
    if (dryRun) return { ...base, action: "manual_review", blocking: decision.blocking };

    await tx.query(`update clonestore_pp_applications set status='manual_review', updated_at=now() where id=$1`, [app.id]);
    await raiseFlags(tx, null, app.id, decision.flags);
    await enqueuePartnerEmailTx(tx, {
      applicationId: app.id, kind: "manual_review_pending", toEmail: app.email,
      idempotencyKey: `pp-email:manual_review_pending:${app.id}`,
    });
    await recordAudit(tx, {
      actor, action: "application.manual_review", entityType: "application", entityId: app.id,
      reason: `reprise — risques bloquants : ${decision.blocking.join(", ")}`,
      next: { blocking: decision.blocking, source: "backfill" },
    });
    return { ...base, action: "manual_review", blocking: decision.blocking };
  }

  // Admission automatique rétroactive.
  if (dryRun) return { ...base, action: "provision", blocking: [] };

  const prov = await provisionPartnerFromApplication(tx, app);
  if (decision.flags.length) await raiseFlags(tx, prov.partnerId, app.id, decision.flags);
  await tx.query(
    `update clonestore_pp_applications
        set status='auto_approved', created_partner_id=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now()
      where id=$1`,
    [app.id, prov.partnerId, actor],
  );
  await recordAudit(tx, {
    actor, action: "application.auto_approved", entityType: "application", entityId: app.id,
    reason: "reprise — admission automatique, aucun risque bloquant",
    next: { partnerId: prov.partnerId, slug: prov.publicSlug, source: "backfill" },
  });
  return { ...base, action: "provision", blocking: [], partnerId: prov.partnerId, publicSlug: prov.publicSlug };
}

/**
 * Reprend les candidatures héritées et les fait entrer dans le parcours automatique.
 * En simulation (défaut), retourne le plan exact qui serait appliqué, sans rien écrire.
 */
export async function backfillLegacyApplications(
  db: SqlExecutor, withServiceFn: WithServiceFn, opts: BackfillOptions = {},
): Promise<BackfillReport> {
  const dryRun = opts.dryRun !== false; // sécurité : simulation SAUF demande explicite
  const actor = opts.actor?.trim() || "backfill";
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 5000);

  const { rows } = await withServiceFn(db, (tx) =>
    tx.query<ApplicationRow>(
      `select id, cabinet_name, first_name, last_name, role_title, email, email_normalized,
              phone, website, country, cabinet_type, status, created_partner_id, ip_hash
         from clonestore_pp_applications
        where status = any($1::text[])
        order by created_at asc
        limit $2`,
      [[...LEGACY_PENDING], limit],
    ),
  );

  const report: BackfillReport = {
    dryRun, scanned: rows.length, provisioned: 0, manualReview: 0, skipped: 0, errors: 0, items: [],
  };

  for (const app of rows) {
    let item: BackfillItem;
    try {
      // UNE transaction par dossier : un échec n'annule que ce dossier.
      item = await withServiceFn(db, (tx) => processOne(tx, app, dryRun, actor));
    } catch (e) {
      item = {
        applicationId: app.id, email: app.email, cabinetName: app.cabinet_name,
        action: "error", blocking: [], error: e instanceof Error ? e.message : "unknown",
      };
    }
    if (item.action === "provision") report.provisioned += 1;
    else if (item.action === "manual_review") report.manualReview += 1;
    else if (item.action === "skipped_already_provisioned") report.skipped += 1;
    else report.errors += 1;
    report.items.push(item);
  }

  return report;
}
