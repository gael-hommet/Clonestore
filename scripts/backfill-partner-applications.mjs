#!/usr/bin/env node
// Reprise des candidatures Cabinets Fondateurs héritées de l'ancien parcours manuel.
//
// Les dossiers restés en `received` / `under_review` n'ont jamais été validés par personne.
// Ce script les fait entrer dans le parcours AUTOMATIQUE en appelant l'action admin réelle
// (`backfill_applications`) — il ne réimplémente AUCUNE règle : mêmes risques, mêmes
// provisionnements, même audit que la candidature d'aujourd'hui.
//
// SÉCURITÉ
//   - SIMULATION par défaut. Rien n'est écrit sans `--apply`.
//   - `--apply` est refusé tant qu'une simulation n'a pas été affichée dans le même appel.
//   - Aucun secret n'est écrit dans les logs : le cookie de session n'est jamais affiché.
//   - Aucune clé Stripe, aucun paiement, aucun transfert : ce script ne touche pas l'argent.
//
// USAGE
//   CLONESTORE_ADMIN_COOKIE="sb-...=..." node scripts/backfill-partner-applications.mjs \
//     --base-url=https://clonestore.pro [--limit=500] [--apply]
//
//   Le cookie est celui d'une session administrateur (allowlist CLONESTORE_OWNER_ADMIN_EMAILS)
//   récupérée depuis un navigateur connecté. L'action est auditée sous l'email de cet admin.

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.length ? rest.join("=") : "true"];
  }),
);

const baseUrl = (args.get("base-url") || process.env.CLONESTORE_BASE_URL || "").replace(/\/+$/, "");
const cookie = process.env.CLONESTORE_ADMIN_COOKIE || "";
const limit = Number(args.get("limit") || 500);
const apply = args.get("apply") === "true";
const reason = args.get("reason") || "reprise des dossiers hérités vers l'admission automatique";

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!baseUrl) fail("--base-url manquant (ex : --base-url=https://clonestore.pro)");
if (!cookie) fail("CLONESTORE_ADMIN_COOKIE manquant (session admin). Il n'est jamais affiché ni journalisé.");

async function call(dryRunApply) {
  const res = await fetch(`${baseUrl}/api/partners/admin/action`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ action: "backfill_applications", reason, limit, apply: dryRunApply }),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
  if (!res.ok || !body.ok) {
    fail(`l'API a refusé (HTTP ${res.status}) : ${body.message || body.error || body.raw || "réponse inattendue"}`);
  }
  return body.report;
}

function render(report, title) {
  const counts = `${report.scanned} examiné(s) · ${report.provisioned} à provisionner · ${report.manualReview} en revue humaine · ${report.skipped} déjà provisionné(s) · ${report.errors} erreur(s)`;
  console.log(`\n${title}`);
  console.log("─".repeat(title.length));
  console.log(counts);
  for (const it of report.items) {
    const flags = it.blocking.length ? ` [${it.blocking.join(", ")}]` : "";
    const slug = it.publicSlug ? ` → /partenaires/r/${it.publicSlug}` : "";
    console.log(`  ${it.action.padEnd(28)} ${it.cabinetName} <${it.email}>${flags}${slug}`);
    if (it.error) console.log(`    ⚠ ${it.error}`);
  }
}

const plan = await call(false); // toujours simuler d'abord
render(plan, apply ? "SIMULATION (avant application)" : "SIMULATION — aucune écriture");

if (!apply) {
  console.log("\nRien n'a été modifié. Relancez avec --apply pour exécuter ce plan.\n");
  process.exit(0);
}

if (plan.scanned === 0) {
  console.log("\nAucun dossier hérité à reprendre. Rien à appliquer.\n");
  process.exit(0);
}

const applied = await call(true);
render(applied, "APPLIQUÉ");
console.log(
  `\n✓ Reprise appliquée. ${applied.provisioned} cabinet(s) provisionné(s) — lien + code envoyés. ` +
  `${applied.manualReview} dossier(s) en revue humaine (risque réel).\n` +
  `Idempotent : relancer ce script ne recrée aucun cabinet et ne renvoie aucun e-mail.\n`,
);
