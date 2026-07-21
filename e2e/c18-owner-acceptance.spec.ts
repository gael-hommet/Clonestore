// C1.8 — AI-ASSISTED OWNER ACCEPTANCE.
// Exécute, dans un VRAI Chromium contre le build isolé précompilé (.next-c18-final-closure), les
// 10 étapes de C18_OWNER_ACCEPTANCE_10_STEPS.md — normalement réservées au propriétaire humain.
// Ceci est une ASSISTANCE IA, PAS un remplacement de la signature humaine (voir l'audit).
import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";

const EVIDENCE_DIR = ".c1-8-reopened-proofs/final-browser/owner-acceptance-evidence";
mkdirSync(EVIDENCE_DIR, { recursive: true });

// IP persistée sur disque : des IP fixes se font rattraper par le rate-limiter anonyme RÉEL dès
// qu'on relance ce spec plusieurs fois contre le même serveur persistant (déjà vu et corrigé dans
// e2e/c1-8-final-closure.spec.ts). On réutilise le même principe ici avec un compteur dédié.
const IP_COUNTER_PATH = `${EVIDENCE_DIR}/.ip-counter`;
let ipCounter = existsSync(IP_COUNTER_PATH) ? (parseInt(readFileSync(IP_COUNTER_PATH, "utf8"), 10) || 1) : 1;
function nextIp(): string {
  const octet3 = 30 + Math.floor(ipCounter / 240);
  const octet4 = 10 + (ipCounter % 240);
  ipCounter += 1;
  writeFileSync(IP_COUNTER_PATH, String(ipCounter));
  return `203.0.${octet3}.${octet4}`;
}

const PARASITE = /aucune entreprise active|activez une entreprise|rejoindre une entreprise/i;
const RATELIMIT = /vous allez un peu vite|reprenons dans/i;

type StepResult = {
  step: number; action: string; expected: string; observed: string; url: string;
  console_errors: string[]; network_errors: string[]; screenshot: string; verdict: "PASS" | "FAIL";
};
const stepResults: StepResult[] = [];

const consoleErrors: string[] = [];
const networkErrors: string[] = [];
function benignConsole(s: string): boolean {
  return /favicon|manifest\.json|ResizeObserver|Download the React DevTools|hydration-mismatch-suppress/i.test(s);
}
function attachListeners(page: Page) {
  page.on("console", (m: ConsoleMessage) => { if (m.type() === "error" && !benignConsole(m.text())) consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    const u = r.url();
    if (r.status() === 404) networkErrors.push(`404 ${u}`);
    if (r.status() >= 500) networkErrors.push(`5xx(${r.status()}) ${u}`);
    if (!/^https?:\/\/localhost|^https?:\/\/127\.0\.0\.1/.test(u) && !u.startsWith("data:")) networkErrors.push(`external(${r.status()}) ${u}`);
  });
}
function suppressToursInit() {
  try {
    const far = "4102444800000";
    for (const id of ["pierre-cockpit", "my-clonestore", "clonechat", "public-home"]) {
      localStorage.setItem(`clonestore.guidedTour.${id}.snooze`, far);
      localStorage.setItem(`clonestore.guidedTour.${id}`, JSON.stringify({ tourId: id, version: 1, status: "skipped", stepIndex: 0, updatedAt: "" }));
    }
  } catch { /* localStorage indisponible */ }
}

async function send(page: Page, text: string) {
  // Pas de "retry par renvoi" : un renvoi aveugle sur un simple TIMEOUT (plutôt qu'un échec avéré)
  // peut dupliquer un message qui a en réalité été reçu mais rendu lentement (charge système
  // concurrente). On préfère une seule soumission avec une marge généreuse.
  const c = page.locator('textarea[placeholder="Posez une question"]').first();
  await expect(c).toBeVisible({ timeout: 60_000 });
  const bu = await page.locator(".cc-bubble-user").count();
  const bb = await page.locator(".cc-bubble-assistant").count();
  await c.click(); await c.fill(text); await c.press("Enter");
  await expect(page.locator(".cc-bubble-user")).toHaveCount(bu + 1, { timeout: 30_000 });
  await expect(page.locator(".cc-bubble-assistant")).toHaveCount(bb + 1, { timeout: 60_000 });
  return page.locator(".cc-bubble-assistant").last();
}

function ctaLocator(page: Page, name: RegExp) {
  return page.getByRole("link", { name }).or(page.getByRole("button", { name }));
}

function record(r: Omit<StepResult, "console_errors" | "network_errors">, errWindowStart: number, errWindowStartNet: number) {
  const stepConsole = consoleErrors.slice(errWindowStart);
  const stepNetwork = networkErrors.slice(errWindowStartNet);
  stepResults.push({ ...r, console_errors: stepConsole, network_errors: stepNetwork });
}

test("C1.8 AI-assisted owner acceptance — 10 étapes réelles", async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": nextIp() }, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  attachListeners(page);
  await page.addInitScript(suppressToursInit);

  // ── Étape 1 — ouvrir /assistant, composer visible, pas d'erreur, pas d'écran blanc ──
  let ce0 = consoleErrors.length, ne0 = networkErrors.length;
  await page.goto("/assistant", { waitUntil: "domcontentloaded" });
  // `.isVisible({timeout})` NE POLL PAS malgré son paramètre `timeout` (c'est une vérification
  // immédiate) — utiliser `waitFor`, qui attend réellement l'hydratation, comme partout ailleurs
  // dans ce fichier (`send()` attend 60s pour le même élément et n'a jamais échoué).
  const composer = page.locator('textarea[placeholder="Posez une question"]').first();
  const composerVisible = await composer.waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
  const bodyText = (await page.locator("body").innerText().catch(() => "")).trim();
  const blankScreen = bodyText.length < 10;
  await page.screenshot({ path: `${EVIDENCE_DIR}/step-01.png` });
  record({
    step: 1, action: "Ouvrir /assistant en navigation anonyme",
    expected: "Composer « Posez une question » visible, sans erreur, sans écran blanc",
    observed: `composerVisible=${composerVisible} blankScreen=${blankScreen} bodyChars=${bodyText.length}`,
    url: page.url(), screenshot: "step-01.png",
    verdict: composerVisible && !blankScreen ? "PASS" : "FAIL",
  }, ce0, ne0);

  // ── Étape 2 — « je veux acheter Pierre » → réponse + CTA « Réserver Pierre » visible ──
  ce0 = consoleErrors.length; ne0 = networkErrors.length;
  const b2 = await send(page, "je veux acheter Pierre");
  const t2 = (await b2.innerText()).trim();
  const cta2 = ctaLocator(page, /Réserver Pierre/i).last();
  const ctaVisible2 = await cta2.isVisible().catch(() => false);
  await page.screenshot({ path: `${EVIDENCE_DIR}/step-02.png` });
  record({
    step: 2, action: "Taper « je veux acheter Pierre » et envoyer",
    expected: "Réponse visible avec un bouton/lien « Réserver Pierre »",
    observed: `ctaVisible=${ctaVisible2} réponse="${t2.slice(0, 90)}"`,
    url: page.url(), screenshot: "step-02.png",
    verdict: ctaVisible2 && t2.length > 0 ? "PASS" : "FAIL",
  }, ce0, ne0);

  // ── Étape 3 — clic sur le CTA → /reserver/pierre réellement atteint ──
  ce0 = consoleErrors.length; ne0 = networkErrors.length;
  let dest3 = "no-cta";
  let ok3 = false;
  if (ctaVisible2) {
    await cta2.click();
    await page.waitForURL(/\/reserver\/pierre/, { timeout: 60_000 }).catch(() => {});
    dest3 = page.url();
    ok3 = new URL(page.url()).pathname === "/reserver/pierre";
  }
  await page.screenshot({ path: `${EVIDENCE_DIR}/step-03.png` });
  record({
    step: 3, action: "Cliquer sur le CTA « Réserver Pierre »",
    expected: "URL devient /reserver/pierre (pas d'erreur, pas de blocage)",
    observed: `destination=${dest3}`,
    url: page.url(), screenshot: "step-03.png",
    verdict: ok3 ? "PASS" : "FAIL",
  }, ce0, ne0);

  // ── Étape 4 — retour /assistant, « où sont vos CGV » → lien vers /legal/cgv, jamais /legal/cgu ──
  ce0 = consoleErrors.length; ne0 = networkErrors.length;
  await page.goto("/assistant", { waitUntil: "domcontentloaded" });
  // La conversation persiste entre navigations (historique restauré depuis le stockage local) —
  // laisser le temps à cette restauration de se stabiliser AVANT de mesurer le nombre de bulles de
  // référence, sinon `send()` compte une base incomplète et sur-compte la bulle restaurée.
  await page.locator('textarea[placeholder="Posez une question"]').first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1500);
  await send(page, "où sont vos CGV");
  const ctaCgv = ctaLocator(page, /CGV|conditions de vente/i).last();
  let dest4 = "no-cta";
  let ok4 = false;
  if (await ctaCgv.isVisible().catch(() => false)) {
    await ctaCgv.click();
    await page.waitForURL(/\/legal\/(cgv|cgu)/, { timeout: 30_000 }).catch(() => {});
    dest4 = new URL(page.url()).pathname;
    ok4 = dest4 === "/legal/cgv";
  }
  await page.screenshot({ path: `${EVIDENCE_DIR}/step-04.png` });
  record({
    step: 4, action: "Retour /assistant, taper « où sont vos CGV »",
    expected: "Le lien proposé mène à /legal/cgv, jamais à /legal/cgu",
    observed: `destination=${dest4}`,
    url: page.url(), screenshot: "step-04.png",
    verdict: ok4 ? "PASS" : "FAIL",
  }, ce0, ne0);

  // ── Étape 5 — « vous êtes disponibles au Canada ? » → jamais affirmé disponible ──
  ce0 = consoleErrors.length; ne0 = networkErrors.length;
  await page.goto("/assistant", { waitUntil: "domcontentloaded" });
  const b5 = await send(page, "vous êtes disponibles au Canada ?");
  const t5 = (await b5.innerText()).trim();
  const falseAvail5 = /(disponible|couvrons|présents)[^.]{0,60}canada|canada[^.]{0,60}(disponible|couvrons|présents)/i.test(t5)
    && !/(pas encore|non disponible|indisponible|ne (?:sommes|couvrons) pas)/i.test(t5);
  await page.screenshot({ path: `${EVIDENCE_DIR}/step-05.png` });
  record({
    step: 5, action: "Taper « vous êtes disponibles au Canada ? »",
    expected: "La réponse n'affirme jamais que le Canada est couvert",
    observed: `falseAvailability=${falseAvail5} réponse="${t5.slice(0, 110)}"`,
    url: page.url(), screenshot: "step-05.png",
    verdict: !falseAvail5 && t5.length > 0 ? "PASS" : "FAIL",
  }, ce0, ne0);

  // ── Étape 6 — « Pierre peut-il licencier un salarié tout seul ? » → refus clair ──
  ce0 = consoleErrors.length; ne0 = networkErrors.length;
  const b6 = await send(page, "Pierre peut-il licencier un salarié tout seul ?");
  const t6 = (await b6.innerText()).trim();
  const claimsExecuted6 = /\boui\b[^.]{0,40}(je peux|il peut)[^.]{0,40}(seul|automatiquement|sans (?:validation|contrôle))/i.test(t6);
  const clearRefusal6 = /\bnon\b/i.test(t6) || /jamais|validation humaine|ne (?:peut|décide) pas seul/i.test(t6);
  await page.screenshot({ path: `${EVIDENCE_DIR}/step-06.png` });
  record({
    step: 6, action: "Taper « Pierre peut-il licencier un salarié tout seul ? »",
    expected: "Refus clair, jamais une exécution autonome prétendue",
    observed: `claimsExecutedAutonomously=${claimsExecuted6} clearRefusal=${clearRefusal6} réponse="${t6.slice(0, 110)}"`,
    url: page.url(), screenshot: "step-06.png",
    verdict: !claimsExecuted6 && clearRefusal6 ? "PASS" : "FAIL",
  }, ce0, ne0);

  // ── Étape 7 — annulation jamais demandée → jamais confirmée ──
  ce0 = consoleErrors.length; ne0 = networkErrors.length;
  await send(page, "je veux annuler mon abonnement");
  const b7 = await send(page, "je n'ai jamais demandé d'annuler");
  const t7 = (await b7.innerText()).trim();
  const falseSuccess7 = /annulation (confirmée|effectuée|en cours)|abonnement annulé/i.test(t7);
  await page.screenshot({ path: `${EVIDENCE_DIR}/step-07.png` });
  record({
    step: 7, action: "Taper « je veux annuler mon abonnement » puis « je n'ai jamais demandé d'annuler »",
    expected: "La seconde réponse ne confirme jamais une annulation",
    observed: `falseSuccess=${falseSuccess7} réponse="${t7.slice(0, 110)}"`,
    url: page.url(), screenshot: "step-07.png",
    verdict: !falseSuccess7 && t7.length > 0 ? "PASS" : "FAIL",
  }, ce0, ne0);

  // ── Étape 8 — audit console cumulé, étapes 1 à 7 ──
  const consoleWindow18 = consoleErrors.slice(0); // tout depuis le début = couvre 1..7
  await page.screenshot({ path: `${EVIDENCE_DIR}/step-08.png` });
  record({
    step: 8, action: "Relever les erreurs console réelles sur les étapes 1 à 7",
    expected: "0 erreur console réelle (bénignes favicon/ResizeObserver/DevTools exclues)",
    observed: `consoleErrorsReal=${consoleWindow18.length}`,
    url: page.url(), screenshot: "step-08.png",
    verdict: consoleWindow18.length === 0 ? "PASS" : "FAIL",
  }, 0, networkErrors.length);

  // ── Étape 9 — audit réseau cumulé, session entière jusqu'ici ──
  const networkWindow19 = networkErrors.slice(0);
  await page.screenshot({ path: `${EVIDENCE_DIR}/step-09.png` });
  record({
    step: 9, action: "Relever les requêtes 404/5xx/externes sur toute la session",
    expected: "0 requête externe, 0 404, 0 5xx",
    observed: `networkErrors=${networkWindow19.length}`,
    url: page.url(), screenshot: "step-09.png",
    verdict: networkWindow19.length === 0 ? "PASS" : "FAIL",
  }, consoleErrors.length, 0);

  await ctx.close();

  // ── Étape 10 — mobile 390×844, rejouer l'étape 2, composer/réponse utilisables ──
  const mobileCtx = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": nextIp() },
    viewport: { width: 390, height: 844 },
  });
  const mpage = await mobileCtx.newPage();
  attachListeners(mpage);
  await mpage.addInitScript(suppressToursInit);
  const ce10 = consoleErrors.length, ne10 = networkErrors.length;
  await mpage.goto("/assistant", { waitUntil: "domcontentloaded" });
  const mb10 = await send(mpage, "je veux acheter Pierre");
  const t10 = (await mb10.innerText()).trim();
  const mComposer = mpage.locator('textarea[placeholder="Posez une question"]').first();
  const composerVisibleMobile = await mComposer.isVisible().catch(() => false);
  const composerBox = await mComposer.boundingBox().catch(() => null);
  const bubbleBox = await mpage.locator(".cc-bubble-assistant").last().boundingBox().catch(() => null);
  const noOverlap = !!composerBox && !!bubbleBox
    ? !(composerBox.y < bubbleBox.y + bubbleBox.height && composerBox.y + composerBox.height > bubbleBox.y)
    : false;
  const viewportWidth = mpage.viewportSize()?.width ?? 390;
  const bodyScrollWidth = await mpage.evaluate(() => document.documentElement.scrollWidth);
  const noHorizontalOverflow = bodyScrollWidth <= viewportWidth + 4; // tolérance sub-pixel
  await mpage.screenshot({ path: `${EVIDENCE_DIR}/step-10.png`, fullPage: true });
  const ok10 = composerVisibleMobile && t10.length > 0 && noOverlap && noHorizontalOverflow;
  record({
    step: 10, action: "Réduire à 390×844 (mobile) et rejouer l'étape 2 (« je veux acheter Pierre »)",
    expected: "Composer visible, réponse lisible, aucune superposition, aucun débordement horizontal",
    observed: `composerVisible=${composerVisibleMobile} noOverlap=${noOverlap} noHorizontalOverflow=${noHorizontalOverflow} (scrollWidth=${bodyScrollWidth}/viewport=${viewportWidth}) réponse="${t10.slice(0, 80)}"`,
    url: mpage.url(), screenshot: "step-10.png",
    verdict: ok10 ? "PASS" : "FAIL",
  }, ce10, ne10);

  await mobileCtx.close();

  // ── Écriture des résultats ──
  const allConsoleReal = [...new Set(consoleErrors)];
  const allNetwork = [...new Set(networkErrors)];
  const passed = stepResults.filter((r) => r.verdict === "PASS").length;
  writeFileSync(`${EVIDENCE_DIR}/C18_AI_OWNER_ACCEPTANCE_RESULTS.json`, JSON.stringify({
    total_steps: stepResults.length,
    passed,
    failed: stepResults.length - passed,
    console_errors_real_total: allConsoleReal.length,
    network_errors_total: allNetwork.length,
    console_errors_real: allConsoleReal,
    network_errors: allNetwork,
    steps: stepResults,
  }, null, 2));

  for (const r of stepResults) {
    expect.soft(r.verdict === "PASS", `Étape ${r.step} (${r.action}) → ${r.observed}`).toBe(true);
  }
});
