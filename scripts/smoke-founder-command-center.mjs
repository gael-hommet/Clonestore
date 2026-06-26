#!/usr/bin/env node
// BLOC FINAL §9 — smoke test Founder Command Center (HTTP). Sécurité fail-closed.
// Sans URL/slug → BLOCKED_EXTERNAL + runbook. Avec → vérifie les refus d'accès.
const base = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? process.env.CLONESTORE_PUBLIC_APP_URL;
const slug = process.env.CLONESTORE_OWNER_COCKPIT_SLUG;

if (!base) {
  console.log("BLOCKED_EXTERNAL:");
  console.log("- URL de base manquante (--url=https://... ou CLONESTORE_PUBLIC_APP_URL)");
  console.log("\nRunbook opérateur :");
  console.log("  1. configurer slug + hash + secret cookie owner gate, démarrer l'app");
  console.log("  2. node scripts/smoke-founder-command-center.mjs --url=https://votre-app");
  console.log("  3. vérifie : mauvais slug → 404 ; bon slug → écran owner gate ; (login + mot de passe = étapes manuelles)");
  process.exit(0);
}

(async () => {
  let bad = 0;
  const ok = (n, c) => { if (c) console.log(`  ✓ ${n}`); else { console.error(`  ✗ ${n}`); bad++; } };
  try {
    // Mauvais slug → 404 (jamais le cockpit).
    const r404 = await fetch(`${base}/internal/mauvais-slug-inexistant/command-center`, { redirect: "manual" });
    ok("bad-slug-404", r404.status === 404);
    if (slug) {
      const rGate = await fetch(`${base}/internal/${slug}/command-center`, { redirect: "manual" });
      // gate verrouillée → 200 (formulaire) ; session absente → redirection /login ; jamais de données.
      ok("good-slug-gate-or-login", [200, 302, 307].includes(rGate.status));
    } else {
      console.log("  ! CLONESTORE_OWNER_COCKPIT_SLUG absent : test du bon slug ignoré.");
    }
    // API interne sans porte → refus.
    const rApi = await fetch(`${base}/api/internal/founder-access/dashboard`, { redirect: "manual" });
    ok("internal-api-denied", [401, 404].includes(rApi.status));
    console.log("  (login + mot de passe owner + navigation cockpit = étapes manuelles, voir runbook)");
  } catch (e) { console.error("[smoke-cc] ERREUR :", e.message); bad++; }
  console.log(`\n[smoke-cc] ${bad === 0 ? "OK" : "ÉCHEC"}`);
  process.exit(bad === 0 ? 0 : 1);
})();
