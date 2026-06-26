// PHASE F §12 — parcours navigateur contrôlé de l'expérience publique :
//   homepage → page Pierre → démo → changement de scénario → réservation.
// Vérifie navigation, CTA, prix, phrase de démo sécurisée, absence d'erreur console
// et absence d'appel externe réel inattendu (Stripe/Resend/Supabase/IA), desktop + mobile.
//
// Gated : nécessite un runner Playwright + Chromium + un serveur local.
//   npm run build && npm run start                 (serveur sur :3000)
//   npx playwright install chromium                (si binaire absent)
//   npx playwright test e2e/public-presentation-demo.spec.ts
// (Non inclus dans `npm test`/vitest — comme les autres specs Playwright du repo.)

import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// Hôtes externes qui ne doivent JAMAIS être appelés depuis l'expérience publique/démo.
const FORBIDDEN_HOSTS = [/api\.stripe\.com/, /api\.resend\.com/, /\.supabase\.co/, /api\.anthropic\.com/, /openai\.com/];

// Backend analytics/présence : nécessite la base runtime (état Phase E). Sans base
// configurée localement, ces endpoints renvoient 500 — blocker EXTERNE, pas un défaut
// de présentation. On les tolère explicitement, et on échoue sur tout autre échec.
const ANALYTICS_BACKEND = /\/api\/founder-access\/(presence|funnel|reservations)/;

function track(page: Page) {
  const pageErrors: string[] = [];        // exceptions JS non capturées = vrais défauts
  const consoleErrors: string[] = [];     // erreurs console hors échecs réseau de ressource
  const externalCalls: string[] = [];     // appels externes réels interdits
  const badResponses: string[] = [];      // réponses non-2xx hors backend analytics toléré
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource/i.test(t)) return; // échec réseau → couvert par badResponses
    consoleErrors.push(t);
  });
  page.on("request", (r) => {
    if (FORBIDDEN_HOSTS.some((re) => re.test(r.url()))) externalCalls.push(r.url());
  });
  page.on("response", (r) => {
    const url = r.url();
    if (r.status() < 400) return;
    if (new URL(url).origin === new URL(BASE).origin && ANALYTICS_BACKEND.test(url)) return; // toléré
    if (FORBIDDEN_HOSTS.some((re) => re.test(url))) return; // déjà compté ailleurs
    badResponses.push(`${r.status()} ${url}`);
  });
  return { pageErrors, consoleErrors, externalCalls, badResponses };
}

for (const vp of [{ name: "desktop", w: 1440, h: 900 }, { name: "mobile", w: 390, h: 844 }]) {
  test(`parcours public ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const { pageErrors, consoleErrors, externalCalls, badResponses } = track(page);

    // 1) Homepage : différenciation + prix + CTA démo.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/prend le travail et le fait avancer/i)).toBeVisible();
    await expect(page.getByText(/449 € HT/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Voir la démo Pierre/i }).first()).toBeVisible();

    // 2) Page Pierre (fiche).
    await page.goto(`${BASE}/agents/pierre`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/449/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /démo/i }).first()).toBeVisible();

    // 3) Démo : phrase de sécurité explicite + scénarios.
    await page.goto(`${BASE}/demo/pierre`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Démonstration sécurisée — aucune action réelle envoyée/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Recrutement/i })).toBeVisible();

    // 4) Changement de scénario → contenu mis à jour.
    await page.getByRole("button", { name: /Onboarding/i }).click();
    await expect(page.getByText(/Léa Dumont/i).first()).toBeVisible();

    // 5) CTA réservation → page de réservation (CTA en bas de page : on défile d'abord).
    const reserveCta = page.getByRole("link", { name: /Réserver Pierre/i }).first();
    await reserveCta.scrollIntoViewIfNeeded();
    await expect(reserveCta).toHaveAttribute("href", /\/reserver\/pierre/);
    // CTA en bas de page avec transform au survol : activation clavier (fidèle et robuste
    // quelle que soit la position dans le viewport).
    await reserveCta.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/reserver\/pierre/);
    await expect(page.getByText(/Réservez Pierre/i)).toBeVisible();

    // 6) Présentation saine : aucune exception JS, aucun appel externe réel, aucune
    //    erreur console (hors échecs réseau), et seul le backend analytics (base Phase E
    //    absente en local) peut renvoyer non-2xx — les pages publiques, elles, rendent.
    expect(pageErrors, `exceptions JS: ${pageErrors.join(" | ")}`).toEqual([]);
    expect(externalCalls, `appels externes inattendus: ${externalCalls.join(", ")}`).toEqual([]);
    expect(consoleErrors, `erreurs console: ${consoleErrors.join(" | ")}`).toEqual([]);
    expect(badResponses, `réponses en échec hors analytics: ${badResponses.join(", ")}`).toEqual([]);
  });
}
