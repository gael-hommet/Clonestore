// BLOC FINAL §4 — vérification du SCHÉMA Founder Access sur une base réelle.
// Réutilisé par scripts/verify-founder-access-production-db.mjs (pg) ET par un test
// d'intégration (PGlite). Comportemental : tente réellement les opérations interdites.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";

export interface SchemaCheck { name: string; ok: boolean; detail: string }
export interface SchemaVerification { ok: boolean; checks: SchemaCheck[] }

const TABLES = [
  "clonestore_founder_reservations", "clonestore_founder_funnel_events", "clonestore_founder_email_jobs",
  "clonestore_web_sessions", "clonestore_web_events", "clonestore_founder_admin_audit",
  "clonestore_rate_limits", "clonestore_founder_stripe_events",
];
const COLUMNS: Array<[string, string]> = [
  ["clonestore_founder_reservations", "contact_status"],
  ["clonestore_founder_reservations", "subscription_status"],
  ["clonestore_founder_reservations", "verification_token_version"],
  ["clonestore_founder_email_jobs", "next_attempt_at"],
  ["clonestore_founder_stripe_events", "processing_result"],
];

export async function verifyFounderAccessSchema(db: SqlExecutor): Promise<SchemaVerification> {
  const checks: SchemaCheck[] = [];
  const add = (name: string, ok: boolean, detail = "") => checks.push({ name, ok, detail });
  // Renvoie la PREMIÈRE colonne de la première ligne (et non l'objet ligne entier) :
  // les contrôles de grants comparent ce scalaire à true/false.
  const scalar = async <T>(sql: string, params?: unknown[]): Promise<T> => {
    const row = (await db.query<Record<string, T>>(sql, params)).rows[0];
    return Object.values(row)[0] as T;
  };

  // Tables.
  for (const t of TABLES) {
    const r = await db.query<{ reg: string | null }>(`select to_regclass('public.${t}') as reg`);
    add(`table:${t}`, r.rows[0].reg !== null, r.rows[0].reg ? "présente" : "ABSENTE");
  }
  // Colonnes clés.
  for (const [t, c] of COLUMNS) {
    const r = await db.query<{ n: number }>("select count(*)::int n from information_schema.columns where table_name=$1 and column_name=$2", [t, c]);
    add(`column:${t}.${c}`, Number(r.rows[0].n) > 0, "");
  }
  // Fonction de journalisation contrôlée présente.
  {
    const r = await db.query<{ n: number }>("select count(*)::int n from pg_proc where proname='clonestore_record_founder_stripe_event'");
    add("function:clonestore_record_founder_stripe_event", Number(r.rows[0].n) > 0, "");
  }
  // Append-only : la mutation doit être refusée. Robuste quelle que soit la connexion :
  //   1) comportement — on tente réellement la mutation (refus via REVOKE pour un rôle
  //      restreint, ou via le trigger anti-mutation si des lignes existent) ;
  //   2) filet propriétaire — si aucune erreur n'est levée (ex. owner sur table vide :
  //      le trigger FOR EACH ROW ne s'arme pas), on confirme que le trigger anti-mutation
  //      `clonestore_forbid_mutation` est BIEN attaché (il refusera toute ligne réelle).
  const triggerArmed = async (table: string): Promise<boolean> => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int n from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
         join pg_proc p on p.oid=tg.tgfoid
        where c.relname=$1 and not tg.tgisinternal and p.proname='clonestore_forbid_mutation'`, [table]);
    return Number(r.rows[0].n) > 0;
  };
  const appendOnly = async (name: string, table: string, mutation: string) => {
    let raised = false;
    try { await db.query(mutation); } catch { raised = true; }
    if (raised) { add(name, true, "mutation refusée (comportement)"); return; }
    const armed = await triggerArmed(table);
    add(name, armed, armed ? "mutation non émise, trigger anti-mutation attaché" : "MUTATION AUTORISÉE (défaut)");
  };
  await appendOnly("append_only:funnel_events_update_blocked", "clonestore_founder_funnel_events",
    "update clonestore_founder_funnel_events set event_name='x' where false");
  await appendOnly("append_only:admin_audit_delete_blocked", "clonestore_founder_admin_audit",
    "delete from clonestore_founder_admin_audit where false");
  // Grants : pierre_rt_app sans EXECUTE du journal ni INSERT brut ; writer avec EXECUTE ; PUBLIC sans EXECUTE.
  try {
    const appExec = await scalar<boolean>("select has_function_privilege('pierre_rt_app','clonestore_record_founder_stripe_event(jsonb)','EXECUTE') as v");
    add("grant:pierre_rt_app_no_execute", appExec === false, `execute=${appExec}`);
    const appInsert = await scalar<boolean>("select has_table_privilege('pierre_rt_app','clonestore_founder_stripe_events','INSERT') as v");
    add("grant:pierre_rt_app_no_raw_insert", appInsert === false, `insert=${appInsert}`);
    const pubExec = await scalar<boolean>("select has_function_privilege('public','clonestore_record_founder_stripe_event(jsonb)','EXECUTE') as v");
    add("grant:public_no_execute", pubExec === false, `execute=${pubExec}`);
    const writerExec = await scalar<boolean>("select has_function_privilege('clonestore_stripe_webhook_writer','clonestore_record_founder_stripe_event(jsonb)','EXECUTE') as v");
    add("grant:writer_execute", writerExec === true, `execute=${writerExec}`);
  } catch (e) {
    add("grant:role_privileges", false, e instanceof Error ? e.message : "role check failed");
  }

  return { ok: checks.every((c) => c.ok), checks };
}
