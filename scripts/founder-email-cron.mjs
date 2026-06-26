#!/usr/bin/env node
// Preuve LOCALE du cron email : appelle réellement la route interne email-tick avec le
// secret de cron. Démontre l'auth (refus sans secret) puis l'exécution (qui enregistre un
// run dans clonestore_founder_cron_runs → la carte « Cron email » passe « connecté »).
//
//   node --env-file=.env.local scripts/founder-email-cron.mjs [--url=http://localhost:3000]
const base = (process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET;
const url = `${base}/api/internal/founder-access/email-tick`;

if (!secret) {
  console.log("BLOCKED_EXTERNAL: CLONESTORE_FOUNDER_EMAIL_CRON_SECRET absent.");
  console.log("  export CLONESTORE_FOUNDER_EMAIL_CRON_SECRET=… puis relancez.");
  process.exit(0);
}

(async () => {
  // 1) sans secret → refus
  const noauth = await fetch(url, { method: "POST" }).then((r) => r.status).catch(() => "ERR");
  console.log(`no-secret -> ${noauth} (attendu 401)`);
  // 2) mauvais secret → refus
  const bad = await fetch(url, { method: "POST", headers: { "x-cron-secret": "mauvais" } }).then((r) => r.status).catch(() => "ERR");
  console.log(`bad-secret -> ${bad} (attendu 401)`);
  // 3) bon secret → exécution
  const ok = await fetch(url, { method: "POST", headers: { "x-cron-secret": secret } });
  const body = await ok.json().catch(() => ({}));
  console.log(`good-secret -> ${ok.status}`, ok.status === 200 ? JSON.stringify(body) : (ok.status === 503 ? "(email non configuré — exécution refusée proprement)" : ""));
  console.log("\n[cron] run enregistré dans clonestore_founder_cron_runs si exécution réussie.");
})();
