#!/usr/bin/env node
// BLOC FINAL §8 — smoke test analytics (HTTP) contre un serveur en marche.
// Sans URL → BLOCKED_EXTERNAL + runbook. Avec URL → scénario session/PII réel.
import { writeFileSync } from "fs";

const base = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? process.env.CLONESTORE_PUBLIC_APP_URL;

if (!base) {
  console.log("BLOCKED_EXTERNAL:");
  console.log("- URL de base manquante (--url=https://... ou CLONESTORE_PUBLIC_APP_URL)");
  console.log("\nRunbook opérateur :");
  console.log("  1. démarrer l'app (npm run build && npm run start) avec les secrets analytics configurés");
  console.log("  2. node scripts/smoke-founder-analytics.mjs --url=https://votre-app");
  console.log("  3. vérifie : cookie cs_analytics_session émis, réutilisé, UUID du corps ignoré, aucune PII persistée");
  process.exit(0);
}

const COOKIE = "cs_analytics_session";
function getCookie(res) {
  const sc = res.headers.get("set-cookie") ?? "";
  const m = sc.match(new RegExp(`${COOKIE}=([^;]+)`));
  return m ? `${COOKIE}=${m[1]}` : null;
}

(async () => {
  const proof = { timestamp: new Date().toISOString(), base, checks: {} };
  let bad = 0;
  const ok = (n, c) => { if (c) console.log(`  ✓ ${n}`); else { console.error(`  ✗ ${n}`); bad++; } proof.checks[n] = c; };
  const post = (body, cookie) => fetch(`${base}/api/founder-access/presence`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  try {
    const r1 = await post({ current_path: "/" });
    const cookie = getCookie(r1);
    ok("session-cookie-emitted", Boolean(cookie));
    const r2 = await post({ current_path: "/demo", anonymous_session_id: "99999999-9999-4999-8999-999999999999" }, cookie);
    ok("session-reused-no-new-cookie", getCookie(r2) === null);
    await post({ current_path: "/reserver?email=test@example.com&token=secret", referrer: "https://u:p@x.com/a?s=1#f", utm_source: "secret_token" }, cookie);
    ok("requests-accepted", r1.status === 204 && r2.status === 204);
    console.log("  Vérifier ensuite en base : aucune PII persistée (sessions/events).");
  } catch (e) { console.error("[smoke-analytics] ERREUR :", e.message); bad++; }
  writeFileSync("founder-analytics-smoke-proof.local.json", JSON.stringify(proof, null, 2));
  console.log(`\n[smoke-analytics] ${bad === 0 ? "OK" : "ÉCHEC"} — preuve : founder-analytics-smoke-proof.local.json`);
  process.exit(bad === 0 ? 0 : 1);
})();
