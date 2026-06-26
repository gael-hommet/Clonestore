#!/usr/bin/env node
// CloneStory — PRÉFLIGHT PRODUCTION CS-FINAL 4 (LECTURE SEULE).
//
// Vérifie, SANS RIEN MODIFIER, l'état de la base avant activation contrôlée :
//   • présence des migrations _01.._08 (par existence des objets) ;
//   • RLS forcée sur les tables clonestory_fp_* ;
//   • triggers append-only ;
//   • flag d'inscription (doit rester fermé) ;
//   • compteurs de données smoke (doivent rester inchangés) ;
//   • dead-letters / events Stripe en échec.
//
// Usage :
//   node scripts/check-clonestory-cs4-preflight.mjs            # PGlite local (.pglite-data)
//   DATABASE_URL=... node scripts/check-clonestory-cs4-preflight.mjs --pg   # base réelle (opérateur)
//
// N'AFFICHE JAMAIS de secret. Sort 0 si prêt (ou état attendu), 1 si anomalie bloquante.

const usePg = process.argv.includes("--pg");

async function getClient() {
  if (usePg) {
    const url = process.env.DATABASE_URL;
    if (!url) { console.error("[preflight] DATABASE_URL requis avec --pg"); process.exit(1); }
    const spec = ["p", "g"].join("");
    const { default: pg } = await import(spec);
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    const pool = new pg.Pool({ connectionString: url, ssl: isLocal ? undefined : { rejectUnauthorized: false } });
    return { query: (t, p) => pool.query(t, p), close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create(process.env.PGLITE_DATA ?? ".pglite-data");
  return { query: (t, p) => db.query(t, p), close: () => db.close() };
}

async function main() {
  const c = await getClient();
  const q = async (sql, params) => { try { return (await c.query(sql, params)).rows; } catch { return null; } };
  const count = async (sql) => { const r = await q(sql); return r ? Number(r[0].n) : -1; };
  const tableExists = async (name) => {
    const r = await q(`select count(*)::int n from information_schema.tables where table_name=$1`, [name]);
    return r ? Number(r[0].n) > 0 : false;
  };

  const rows = [];
  const push = (item, state, action) => rows.push({ item, state, action });

  // Migrations (par existence d'objets clés).
  const t = {
    _01: await tableExists("clonestory_fp_partners"),
    _05: await tableExists("clonestory_fp_distinctions"),
    _06: await tableExists("clonestory_fp_attributions"),
    _07: await tableExists("clonestory_fp_commercial_contributions"),
    _08: await tableExists("clonestory_fp_notifications_outbox"),
  };
  push("Migration _01 (fondations)", t._01 ? "appliquée" : "ABSENTE", t._01 ? "—" : "appliquer _01.._04");
  push("Migration _05 (distinctions)", t._05 ? "appliquée" : "non", t._05 ? "—" : "db:migrate:pg (_05)");
  push("Migration _06 (attribution)", t._06 ? "appliquée" : "non", t._06 ? "—" : "db:migrate:pg (_06)");
  push("Migration _07 (commercial)", t._07 ? "appliquée" : "non", t._07 ? "—" : "db:migrate:pg (_07)");
  push("Migration _08 (hardening)", t._08 ? "appliquée" : "non", t._08 ? "—" : "db:migrate:pg (_08)");

  // RLS forcée sur un échantillon.
  let rlsForced = true;
  if (t._01) {
    const r = await q(`select relname, relrowsecurity, relforcerowsecurity from pg_class
                        where relname like 'clonestory_fp_%' and relkind='r'`);
    if (r) for (const x of r) if (!x.relrowsecurity || !x.relforcerowsecurity) rlsForced = false;
    push("RLS forcée (clonestory_fp_*)", rlsForced ? "OK" : "ANOMALIE", rlsForced ? "—" : "vérifier policies");
  }

  // Triggers append-only.
  const trg = await count(`select count(*)::int n from information_schema.triggers where trigger_name like 'trg_clonestory_fp_%append_only%'`);
  push("Triggers append-only", trg >= 0 ? String(trg) : "n/a", "—");

  // Flag inscription (doit rester fermé en préflight).
  const flag = (process.env.CLONESTORY_REGISTRATION_OPEN ?? "").trim() === "true";
  push("Inscriptions", flag ? "OUVERTES" : "fermées", flag ? "REFERMER avant activation" : "rester fermées");

  // Données smoke (inchangées attendues).
  const partners = t._01 ? await count(`select count(*)::int n from clonestory_fp_partners`) : 0;
  const introsConfirmed = t._01 ? await count(`select count(*)::int n from clonestory_fp_introductions where status<>'declared'`) : 0;
  push("Partenaires (smoke)", String(partners), "inchangé attendu");
  push("Introductions confirmées+ (smoke)", String(introsConfirmed), "inchangé attendu");

  // Dead-letters / échecs.
  const vDead = t._01 ? await count(`select count(*)::int n from clonestory_fp_email_outbox where status='dead'`) : 0;
  const nDead = t._08 ? await count(`select count(*)::int n from clonestory_fp_notifications_outbox where status='dead'`) : 0;
  const cDead = t._07 ? await count(`select count(*)::int n from clonestory_fp_commercial_outbox where status='dead'`) : 0;
  const sFailed = t._07 ? await count(`select count(*)::int n from clonestory_fp_stripe_events where processing_result='failed'`) : 0;
  push("Emails morts (vérif/notif/comm)", `${vDead}/${nDead}/${cDead}`, vDead + nDead + cDead > 0 ? "replay_emails" : "—");
  push("Events Stripe en échec", String(sFailed), sFailed > 0 ? "réconcilier" : "—");

  // Rapport.
  console.log("\nCloneStory — PRÉFLIGHT CS-FINAL 4 (lecture seule)\n");
  const w = Math.max(...rows.map((r) => r.item.length));
  for (const r of rows) console.log(`  ${r.item.padEnd(w)}  | ${String(r.state).padEnd(14)} | ${r.action}`);

  const blocking = (!t._01) || !rlsForced;
  console.log(`\nVERDICT PRÉFLIGHT: ${blocking ? "ANOMALIE BLOQUANTE" : "ÉTAT COHÉRENT (voir actions)"}\n`);
  await c.close();
  process.exit(blocking ? 1 : 0);
}

main().catch((e) => { console.error("[preflight] échec:", e.message); process.exit(1); });
