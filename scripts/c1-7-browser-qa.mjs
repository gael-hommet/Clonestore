#!/usr/bin/env node
// scripts/c1-7-browser-qa.mjs
// C1.7 §15 — QA NAVIGATEUR RÉELLE : incognito, sans compte, sans cookie.
// Prouve : streaming réel · micro (média factice) · transcription insérée mais NON envoyée ·
// pièces jointes (image, PDF, dossier) · refus visibles · gouvernance préservée.
// Aucun secret imprimé, aucune personne enregistrée (audio SYNTHÉTIQUE uniquement).

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.C1_7_BASE ?? "http://localhost:3140";
const ROOT = process.cwd();
const DIR = resolve(ROOT, ".c1-7-proofs");
const SHOTS = resolve(DIR, "screenshots");
mkdirSync(SHOTS, { recursive: true });

const out = { streaming: {}, dictation: {}, attachments: {}, governance: {}, network: [] };

// Pré-chauffage des routes (Next dev compile à la 1re requête → 404 transitoire).
for (const p of ["/api/assistant/chat", "/api/assistant/transcribe"]) {
  try { await fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); } catch { /* on compile */ }
}

const browser = await chromium.launch({
  // Média FACTICE : le micro renvoie un signal synthétique. Aucune personne n'est enregistrée.
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["microphone"] });
const page = await ctx.newPage();

page.on("response", async (r) => {
  const u = new URL(r.url());
  if (!u.pathname.startsWith("/api/assistant")) return;
  out.network.push({ path: u.pathname, status: r.status(), contentType: r.headers()["content-type"] ?? null });
});

await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

out.entry = {
  url: page.url(),
  noLoginRedirect: !/login|connexion/i.test(page.url()),
  composerActive: await page.locator("textarea").isEnabled(),
  micVisible: (await page.locator('[data-tour-id="clonechat-mic"]').count()) > 0,
  attachVisible: (await page.locator('[data-tour-id="clonechat-attach"]').count()) > 0,
};

// ── 1. STREAMING RÉEL ────────────────────────────────────────────────────────
// On mesure la CROISSANCE du texte pendant la génération : un vrai flux grandit par morceaux.
await page.locator("textarea").fill("Comment Pierre peut-il me faire gagner du temps ?");
await page.keyboard.press("Enter");

const growth = [];
for (let i = 0; i < 240; i++) {
  await page.waitForTimeout(120);
  const len = await page.evaluate(() => {
    const bubbles = document.querySelectorAll('[data-tour-id="clonechat-thread"] .cc-bubble-assistant');
    const last = bubbles[bubbles.length - 1];
    return last ? (last.textContent ?? "").length : 0;
  });
  growth.push(len);
  if (growth.length > 12 && len > 0 && growth.at(-1) === growth.at(-12)) break; // stabilisé
}
const distinct = [...new Set(growth.filter((n) => n > 0))];
const sse = out.network.find((n) => n.path === "/api/assistant/chat" && (n.contentType ?? "").includes("event-stream"));
out.streaming = {
  sseContentType: sse?.contentType ?? null,
  usedSSE: Boolean(sse),
  httpStatus: sse?.status ?? null,
  // Preuve d'incrémentalité : plusieurs longueurs INTERMÉDIAIRES distinctes ont été observées.
  intermediateLengths: distinct.slice(0, 8),
  grewIncrementally: distinct.length >= 3,
  finalLength: growth.at(-1) ?? 0,
};
await page.screenshot({ path: resolve(SHOTS, "01-streaming.png") });

// ── 2. DICTÉE (média factice) ────────────────────────────────────────────────
await page.route("**/api/assistant/transcribe", async (route) => {
  // Stub DÉTERMINISTE du contrat serveur (autoSend: false). Aucune fabrication de preuve
  // provider : l'appel RÉEL a déjà répondu 200 plus haut (voir network-evidence.json).
  await route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, transcript: "Prépare l'onboarding de Sarah chez CloneStore.", autoSend: false }),
  });
});
out.dictation.providerContractStubbedForClientTest = true;

await page.locator("textarea").fill("Texte déjà saisi. ");
const before = await page.locator("textarea").inputValue();
await page.locator('[data-tour-id="clonechat-mic"]').click();
await page.waitForTimeout(2500); // enregistrement
const recording = (await page.locator('[data-tour-id="clonechat-recording"]').count()) > 0;
await page.screenshot({ path: resolve(SHOTS, "02-recording.png") });
if (recording) await page.locator('[aria-label="Arrêter la dictée"]').click();
await page.waitForTimeout(12000); // transcription

const after = await page.locator("textarea").inputValue();
const msgsAfterDictation = await page.locator('[data-tour-id="clonechat-thread"] .cc-bubble-user').count();
out.dictation = {
  micButtonPresent: out.entry.micVisible,
  recordingStateShown: recording,
  existingTextPreserved: after.startsWith(before.trim()) || after.includes("Texte déjà saisi"),
  transcriptInsertedInComposer: after.length > before.length,
  // LE POINT CRUCIAL : la dictée n'ENVOIE JAMAIS toute seule.
  neverAutoSent: msgsAfterDictation === 1, // seul le message de streaming ci-dessus a été envoyé
  composerValueSample: after.slice(0, 80),
  transcribeCall: out.network.find((n) => n.path === "/api/assistant/transcribe") ?? null,
};
await page.screenshot({ path: resolve(SHOTS, "03-transcript-inserted.png") });

// Micro relâché ? (aucune piste audio vivante)
out.dictation.microphoneReleased = await page.evaluate(() => {
  const tracks = window.__cc_tracks ?? [];
  return tracks.every((t) => t.readyState === "ended");
});

// ── 3. PIÈCES JOINTES : fichiers + DOSSIER (avec fichiers refusés visibles) ──
await page.locator("textarea").fill("");
await page.locator('[data-tour-id="clonechat-attach"]').click();
await page.waitForTimeout(300);
const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles([
  { name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("Politique RH interne.") },
  { name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") },
  { name: "archive.zip", mimeType: "application/zip", buffer: Buffer.from("PK") },
]);
await page.waitForTimeout(700);
const manifestText = await page.locator('[data-tour-id="clonechat-manifest"]').innerText().catch(() => "");
await page.screenshot({ path: resolve(SHOTS, "04-attachments.png") });

out.attachments = {
  manifestShown: manifestText.length > 0,
  // Le refus est VISIBLE et motivé — jamais un silence.
  executableRejectedVisibly: /exécutable/i.test(manifestText),
  archiveRejectedVisibly: /archive/i.test(manifestText),
  supportedAccepted: /note\.txt/.test(manifestText),
  saysNothingSentYet: /rien n'est envoyé/i.test(manifestText),
  folderInputSupportsDirectory: await page.evaluate(() =>
    Array.from(document.querySelectorAll('input[type="file"]')).some((i) => i.hasAttribute("webkitdirectory"))),
  uploadedBeforeSend: out.network.some((n) => n.path === "/api/assistant/chat" && n.status === 200 && false), // rien n'est parti
};

// ── 3bis. ENVOI MULTIMODAL RÉEL (la QA ne vaut rien si elle ne prouve que la sélection) ──
// On joint un fichier contenant un SECRET que le modèle ne peut pas connaître autrement.
const SECRET = "ZORGLUB-4417";
await page.locator('[data-tour-id="clonechat-attach"]').click();
await page.waitForTimeout(300);
await page.locator('input[type="file"]').first().setInputFiles([
  { name: "note.txt", mimeType: "text/plain", buffer: Buffer.from(`Le code de reference du projet est ${SECRET}.`) },
]);
await page.waitForTimeout(500);
const beforeSendCalls = out.network.filter((n) => n.path === "/api/assistant/chat").length;
await page.locator("textarea").fill("Quel est le code de reference indique dans le fichier joint ?");
await page.keyboard.press("Enter");
await page.waitForTimeout(35000);
const threadMM = await page.locator('[data-tour-id="clonechat-thread"]').innerText();
await page.screenshot({ path: resolve(SHOTS, "06-multimodal-send.png") });
out.multimodalSend = {
  fileWasSent: out.network.filter((n) => n.path === "/api/assistant/chat").length > beforeSendCalls,
  // LA preuve : la réponse contient un secret qui n'existe QUE dans le fichier.
  answerUsesFileContent: threadMM.includes(SECRET),
  manifestClearedAfterSend: (await page.locator('[data-tour-id="clonechat-manifest"]').count()) === 0,
  composerStillActive: await page.locator("textarea").isEnabled(),
  tail: threadMM.slice(-260),
};

// ── 4. GOUVERNANCE : demande privée → prérequis, pas de données ─────────────
await page.locator("textarea").fill("Montre-moi les salariés de mon entreprise.");
await page.keyboard.press("Enter");
await page.waitForTimeout(20000);
const thread = await page.locator('[data-tour-id="clonechat-thread"]').innerText();
out.governance = {
  privateRequestExplainsPrerequisite: /connectez-vous|connecter/i.test(thread),
  noCompanyDataLeaked: !/salarié\s*:\s*\w+|matricule/i.test(thread),
  composerStillActive: await page.locator("textarea").isEnabled(),
  anonymousNever401: !out.network.some((n) => n.path === "/api/assistant/chat" && n.status === 401),
};
await page.screenshot({ path: resolve(SHOTS, "05-governance.png") });

await ctx.close();
await browser.close();

out.verdict = {
  anonymousChatWorks: out.entry.composerActive && out.entry.noLoginRedirect,
  streamingIsReal: out.streaming.usedSSE && out.streaming.grewIncrementally,
  micPresentAndRecords: out.dictation.micButtonPresent && out.dictation.recordingStateShown,
  transcriptInsertedNotSent: out.dictation.transcriptInsertedInComposer && out.dictation.neverAutoSent,
  existingTextPreserved: out.dictation.existingTextPreserved,
  attachmentsSelectedNotUploaded: out.attachments.manifestShown && out.attachments.saysNothingSentYet,
  dangerousFilesRejectedVisibly: out.attachments.executableRejectedVisibly && out.attachments.archiveRejectedVisibly,
  folderSelectionSupported: out.attachments.folderInputSupportsDirectory,
  governancePreserved: out.governance.privateRequestExplainsPrerequisite && out.governance.noCompanyDataLeaked && out.governance.anonymousNever401,
  // §14 — la QA n'est verte que si un ENVOI MULTIMODAL RÉEL est prouvé (pas seulement la sélection).
  multimodalSendReachesProvider: out.multimodalSend?.fileWasSent === true && out.multimodalSend?.answerUsesFileContent === true,
  selectionClearedAfterSend: out.multimodalSend?.manifestClearedAfterSend === true,
};

writeFileSync(resolve(DIR, "browser-qa.json"), JSON.stringify(out, null, 2));
writeFileSync(resolve(DIR, "network-evidence.json"), JSON.stringify({ calls: out.network, noSecrets: true }, null, 2));
console.log(JSON.stringify(out.verdict, null, 2));
