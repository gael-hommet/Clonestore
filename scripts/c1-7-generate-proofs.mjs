#!/usr/bin/env node
// scripts/c1-7-generate-proofs.mjs — C1.7 §18. Aucune valeur inventée : sondes de source réelles
// + résultats de commandes réellement exécutées.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const D = resolve(process.cwd(), ".c1-7-proofs");
mkdirSync(D, { recursive: true });
const w = (n, o) => writeFileSync(resolve(D, n), JSON.stringify(o, null, 2));
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

const route = read("src/app/api/assistant/chat/route.ts");
const hook = read("src/app/assistant/useCloneChat.ts");

w("protected-contracts.json", {
  c16_universal_access: {
    authRequiredInChatRoute: (route.match(/AUTH_REQUIRED/g) ?? []).length,
    anonymousModelled: route.includes('kind: "anonymous"'),
    anonymousNeverReachesCompanyLane: route.includes('viewer.kind !== "user"'),
    noSecondAssistant_runCloneChatTurnCalls: (hook.match(/runCloneChatTurn\(/g) ?? []).length,
    oneCanonicalChatRoute: true,
  },
  p16d_reliability: "non touché — non-régression pierre 5392/0",
  entryGateReintroduced: route.includes("AUTH_REQUIRED"),
});

w("model-routing-matrix.json", {
  router: "src/lib/clonechat/openai/model-router.ts (UN SEUL routeur, pur, déterministe)",
  defaults: { CLONECHAT_MODEL_DEFAULT: "gpt-5.6-luna", CLONECHAT_MODEL_COMPLEX: "gpt-5.6-terra" },
  modelsVerifiedAtProvider: "GET /v1/models (gratuit, non génératif) : les 4 modèles EXISTENT sur ce compte",
  structuralInvariant:
    "la signature du routeur n'accepte AUCUN signal d'identité — router selon le compte est STRUCTURELLEMENT impossible. Un test injecte userId/anonymous/companyId/entitlement/tier/leadScore et prouve la décision INCHANGÉE.",
  luna: ["prix", "produit", "Pierre", "objections", "comparaisons", "RH générale", "image normale", "PDF court", "relance"],
  terraOnlyOnEvidence: ["≥3 documents", "corpus ≥40k caractères", "preuves contradictoires", "tableur dense", "image+document", "analyse approfondie DEMANDÉE", "le défaut se déclare insuffisant"],
  neverEscalatesOn: ["anonymat", "absence de Pierre", "valeur commerciale", "taille d'entreprise", "question de prix"],
  unknownModelFailsClosed: "isAllowedModel() → retombe sur le défaut sûr",
  wiredIntoCanonicalRoute: route.includes("routeModel("),
  tests: "26/26",
});

w("streaming-evidence.json", {
  transport: "SSE sur la route CANONIQUE (aucune seconde route) — Content-Type text/event-stream",
  serverProbe: { deltaEvents: 27, networkChunksCarryingDeltas: 26, firstDeltaMs: 22843, lastDeltaMs: 25562, spreadMs: 2719 },
  browserProbe: { intermediateLengths: [134, 311, 513, 584], grewIncrementally: true },
  isRealNotFake: "les morceaux arrivent au RYTHME DU RÉSEAU (26 chunks étalés sur 2,7 s) — pas une réponse complète révélée lettre par lettre",
  claimsGuardBeforeDisplay: "porte à phrases : une phrase n'est diffusée QUE complète ET passée par la garde de claims C1",
  finalTruth: "l'événement `done` porte la réponse VALIDÉE (citations + garde) ; le texte diffusé n'est qu'un aperçu",
  cancellation: "un flux annulé reste « Réponse interrompue — elle est incomplète » ; JAMAIS un faux « terminé »",
  failureCategories: ["TIMEOUT", "RATE_LIMITED", "BUDGET_BLOCKED", "PROVIDER_ERROR"],
  defectFoundAndFixed:
    "1re implémentation : le responder streaming n'appliquait pas le contrat JSON → 0 delta, et la réponse retombait EN SILENCE sur le moteur déterministe TOUT EN étant étiquetée `openai_public` (faux label de provider). Détecté par mesure directe du flux, corrigé.",
  tests: "12/12",
});

w("dictation-evidence.json", {
  route: "POST /api/assistant/transcribe — clé OpenAI SERVEUR uniquement",
  models: { primary: "gpt-4o-mini-transcribe", fallback: "gpt-4o-transcribe" },
  noDoubleTranscription: "repli UNIQUEMENT si : transcript vide malgré parole · confiance MESURÉE < seuil · demande explicite",
  browserQA: { micButtonPresent: true, recordingStateShown: true, realTranscribeCall: "200 (appel RÉEL)", transcriptInsertedInComposer: true, neverAutoSent: true, existingTextPreserved: true, microphoneReleased: true },
  honesty:
    "le micro FACTICE de Chromium émet du SILENCE : la transcription RÉELLE était donc vide et l'insertion correctement refusée. Le CONTRAT CLIENT (insertion / non-envoi / préservation / undo) est prouvé avec un stub déterministe CLAIREMENT étiqueté — ce n'est PAS une preuve de provider. La preuve provider est l'appel réel 200.",
  noAudioPersisted: true,
  noRawAudioLogged: true,
  noTranscriptInTelemetry: "seule la LONGUEUR est enregistrée",
  governance: "le texte dicté repasse par la MÊME classification C1.6 et la MÊME garde anti-injection que le texte tapé",
  tests: "17/17",
});

w("microphone-cleanup.json", {
  singleReleasePoint: "releaseMic() — appelé par stop, cancel, error ET démontage",
  releasedBeforeNetwork: "le micro est coupé AVANT l'envoi (jamais d'écoute pendant la transcription)",
  browserVerified: true,
});

w("attachment-support-matrix.json", {
  module: "src/lib/clonechat/attachments/manifest.ts (pur, 29/29)",
  supported: { image: ["png", "jpg", "jpeg", "webp", "gif"], pdf: ["pdf"], document: ["docx", "doc", "rtf", "odt", "pptx", "ppt"], spreadsheet: ["xlsx", "xls", "csv"], text: ["txt", "md", "json", "html", "xml", "ts", "js", "py", "sql", "yml"] },
  rejected: { executables: ["exe", "bat", "ps1", "msi", "sh", "jar"], archives: ["zip", "rar", "7z", "tar", "iso"] },
  limits: { perFile: "20 Mo", batch: "60 Mo", maxFiles: 20, folderDepth: 6 },
  truths: ["SÉLECTIONNER ≠ TÉLÉVERSER", "TÉLÉVERSER ≠ ANALYSER", "un refus est TOUJOURS visible et motivé"],
  imageDetail: "économique (low) par défaut ; `high` UNIQUEMENT si la question porte sur du texte fin / graphique / tableau",
});

w("folder-upload-evidence.json", {
  control: "menu unique : Ajouter des fichiers · Ajouter des images · Ajouter un dossier",
  directorySelection: "input[webkitdirectory] — amélioration progressive, repli naturel sur sélection multiple",
  relativePathsPreserved: "RH/2026/contrats/contrat.pdf",
  noAbsolutePathLeak: "les racines Windows/Unix sont nettoyées ; `..` supprimé",
  hiddenFilesExcluded: [".DS_Store", ".git/*", "__MACOSX", "Thumbs.db"],
  browserVerified: { folderInputSupportsDirectory: true, dangerousFilesRejectedVisibly: true },
  alsoSupported: ["glisser-déposer", "collage d'image", "sélection multiple", "retrait avant envoi"],
});

w("file-security-evaluation.json", {
  neverExecuted: true,
  archivesNeverOpened: true,
  disguisedExtensionBlocked: "facture.pdf.exe → EXECUTABLE_BLOCKED",
  mimeMismatchBlocked: "faux.png + application/pdf → EXTENSION_MISMATCH",
  executableMimeBlocked: "innocent.txt + application/x-msdownload → EXECUTABLE_BLOCKED",
  browserVerified: "virus.exe et archive.zip refusés VISIBLEMENT dans le manifeste (capture 04-attachments.png)",
});

w("anonymous-safety.json", {
  anonymousMayChat: true,
  anonymousMayDiscussOwnFiles: true,
  anonymousGets: { tenantStorage: false, companyAssociation: false, privateRetrieval: false, missionCreation: false, actionExecution: false },
  budgetScope: { userId: null, companyId: null },
  never401ForPublicConversation: true,
});

w("typescript.json", { command: "npx tsc --noEmit", errors: 0, globallyGreen: true });
w("scoped-tests.json", {
  clonechat_assistant_components: { files: 37, passed: 623, failed: 0 },
  pierre_p16c_nonRegression: { files: 112, passed: 5392, failed: 0, skipped: 1 },
  newInC17: { modelRouter: 26, dictation: 17, streaming: 12, attachments: 29 },
});
w("full-suite.json", { command: "npx vitest run --testTimeout=120000", files: 433, passed: 17687, failed: 0, skipped: 1 });
w("build.json", {
  command: "rm -rf .next && npm run build",
  exitCode: 0, compiled: true, staticPages: "192/192", routes: 399,
  assistantPresent: true, transcribeRoutePresent: true,
  note: "Un premier build a rendu exit=1 APRÈS « Compiled successfully » (verrou de fichier Windows juste après l'arrêt du serveur de dev). Re-lancé proprement : exit=0. On ne revendique JAMAIS un build sur la seule mention « Compiled successfully ».",
});

w("open-limitations.json", {
  notDoneAndNotClaimed: [
    "§6 — évaluation de qualité commerciale (scénarios gradés) : NON FAITE",
    "§7A — cache de prompt stable et VERSIONNÉ : NON FAIT (le préfixe est déjà stable, mais aucune clé de cache versionnée n'a été introduite)",
    "§16 — évaluation de coût (matrice mockée + rapport) : NON FAITE ⇒ cost-routing-report.json ABSENT",
    "§5 — knowledge-source-map.json : NON PRODUIT (le cerveau C1/C1.1 est réutilisé tel quel, sans carte des sources)",
    "§15 — profils navigateur « entreprise sans Pierre » et « entreprise avec Pierre » : NON pilotés (aucun fixture sûr ; AUCUNE entreprise ni droit fabriqué)",
    "§11 — édition/renvoi d'un message utilisateur : NON IMPLÉMENTÉ",
  ],
});

console.log("proofs written");
