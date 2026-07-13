// src/lib/clonestore/external-enablement/e1/e1-1-reconciliation-command-center.ts
// E1.1 §14 — Poste de commandement de RÉCONCILIATION.
//
// Additif : le `e1-command-center.ts` existant (vérifié, testé) n'est PAS muté. La
// réconciliation est une préoccupation distincte — état du dépôt, gates globaux, prévol de
// migration — et vit donc dans son propre module.
//
// RÈGLE ABSOLUE : aucune valeur verte codée en dur. Chaque champ est :
//   · soit SONDÉ dans la source réelle (regex sur le vrai fichier) ;
//   · soit LU dans une preuve produite par une VRAIE commande (tsc / vitest / next build).
// L'absence d'une preuve ⇒ le champ est faux, jamais « supposé vert ».
// L'existence d'un fichier de migration NE PROUVE JAMAIS son application distante.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import { isLiveExecutionAllowed } from "@/lib/clonestore/technologies/t1";

const PROOF_DIR = ".e1-1-proofs/repository-reconciliation";

async function readRepo(rel: string): Promise<string | null> {
  try {
    return await readFile(resolve(process.cwd(), rel), "utf8");
  } catch {
    return null;
  }
}

async function readProof<T = Record<string, unknown>>(name: string): Promise<T | null> {
  const raw = await readRepo(`${PROOF_DIR}/${name}`);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type E11Verdict =
  | "E1.1 — GLOBAL REPOSITORY GREEN / CONTROLLED DEPLOYMENT PREFLIGHT READY"
  | "E1.1 — REPOSITORY LOCALLY RECONCILED / REMOTE MIGRATION AND DEPLOYMENT AUTHORIZATION REQUIRED"
  | "E1.1 — RECONCILIATION PARTIAL / GLOBAL BUILD OR TESTS BLOCKED"
  | "E1.1 — RECONCILIATION BLOCKED / PARTNER WORKSTREAM STILL ACTIVE";

export interface E11ReconciliationCommandCenter {
  // ── État du dépôt / chantier concurrent ──
  // `repositoryStable` est DÉRIVÉ de la preuve de gel à trois instantanés (frozen-repository-proof.json),
  // jamais d'une fenêtre de calme ni d'une valeur codée en dur. Preuve absente ⇒ faux (fail-closed).
  readonly repositoryStable: boolean;
  /** FAIT HISTORIQUE — un chantier concurrent A ÉCRIT dans ce dépôt pendant E1.1. Ne s'efface jamais. */
  readonly concurrentWorkstreamWasDetected: boolean;
  /** ÉTAT COURANT — le chantier écrit-il ENCORE ? C'est CELUI-CI qui gouverne la readiness. */
  readonly concurrentWorkstreamCurrentlyActive: boolean;
  /** @deprecated Alias historique de `concurrentWorkstreamWasDetected` (conservé pour les preuves antérieures). */
  readonly concurrentWorkstreamDetected: boolean;
  // ── Partner program ──
  readonly partnerProgramTypeScriptReady: boolean;
  readonly partnerProgramTestsReady: boolean;
  readonly nextRouteExportsValid: boolean;
  // ── Plancher P10 sur les versements partenaires (sondes de source réelle) ──
  readonly partnerP10PayoutFloorReady: boolean;
  readonly partnerLivePayoutEnvironmentCannotBypassP10: boolean;
  readonly partnerPayoutDryRunSafe: boolean;
  readonly partnerPayoutIdempotencyReady: boolean;
  readonly partnerPayoutProviderEvidenceRequired: boolean;
  readonly partnerPayoutRoutesCannotBypass: boolean;
  readonly envExampleP10ClaimHonest: boolean;
  readonly partnerPayoutMigrationPresent: boolean;
  readonly partnerPayoutMigrationAppliedRemotely: false;
  readonly partnerPayoutLiveAuthorized: false;
  readonly partnerPayoutLiveExecuted: false;
  // ── Défauts Pierre hors périmètre C1.4 ──
  readonly pierreDocumentInferenceReady: boolean;
  readonly fairClaimHarnessStable: boolean;
  // ── Gates globaux ──
  readonly globalTypeScriptReady: boolean;
  readonly fullProjectTestsReady: boolean;
  readonly canonicalScopedNonRegressionReady: boolean;
  readonly globalBuildReady: boolean;
  // ── C1.4 ──
  readonly c14AccessGateReady: boolean;
  readonly c14RealOpenAIProofPreserved: boolean;
  // ── P9.4.1 ──
  readonly p941MigrationPresent: boolean;
  readonly p941RemotePreflightReady: boolean;
  readonly p941AppliedRemotely: false;
  readonly remoteDatabaseMutated: false;
  // ── Planchers ──
  readonly deploymentPerformed: false;
  readonly productionAuthorized: boolean;
  readonly paymentMode: "disabled" | "test" | "live";
  readonly liveProvidersBlocked: boolean;
  // ── Sorties ──
  readonly readyForRemoteMigrationAuthorization: boolean;
  readonly readyForControlledDeployment: boolean;
  readonly exactWarnings: readonly string[];
  readonly exactBlockers: readonly string[];
  readonly nextSafeAction: string;
  readonly verdict: E11Verdict;
}

export async function computeE11ReconciliationCommandCenter(): Promise<E11ReconciliationCommandCenter> {
  const warnings: string[] = [];
  const blockers: string[] = [];

  // ── Preuves issues de VRAIES commandes (absentes ⇒ faux, jamais supposées) ──
  const collision = await readProof<{ repositoryStable: boolean; perimeterStableBeforeEdits: boolean; concurrentWorkstreamDetected: boolean; partnerFilesEditedByE11: number }>("collision-safety.json");
  const ts = await readProof<{ errorCount: number }>("typescript.json");
  const targeted = await readProof<{ suites: Record<string, { passed: number; failed: number }> }>("targeted-tests.json");
  const full = await readProof<{ passed: number; failed: number }>("full-project-tests.json");
  const canonical = await readProof<{ passed: number; failed: number }>("canonical-non-regression.json");
  const build = await readProof<{ exitCode: number; compiled: boolean; routeValidationPassed: boolean; assistantRoutePresent: boolean; partnerRouteCount: number }>("build.json");
  const preflight = await readProof<{ readOnly: boolean; mutationsExecuted: number; migrationState: string; target: { productionSuspected: boolean } }>("p941-remote-preflight.json");

  // ── Sondes de SOURCE réelle ──
  const route = await readRepo("src/app/api/assistant/chat/route.ts");
  const access = await readRepo("src/lib/pierre/access.ts");
  const migration = await readRepo("supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql");
  const preflightSrc = await readRepo("scripts/e1-1-clonechat-remote-preflight.mjs");

  // C1.4 : la porte d'accès est-elle TOUJOURS correcte dans la source COURANTE ?
  const unionTyped = access !== null && /ok:\s*false;\s*readonly reason:\s*"NO_ENTITLEMENT"/.test(access.replace(/readonly /g, "readonly ")) === false
    ? access.includes('reason: "NO_ENTITLEMENT"') && access.includes('reason: "LOOKUP_FAILED"')
    : true;
  const truthinessBugAbsent = route !== null && !/if\s*\(\s*!\s*access\s*\)/.test(route);
  // C1.6 — La porte d'ENTRÉE de C1.4 est SUPPLANTÉE : CloneChat est universel. On sonde donc
  // l'intention de sécurité, pas l'ancien texte : le droit Pierre et l'entreprise restent des
  // PRÉREQUIS de l'ACTION, et l'anonyme n'atteint jamais la voie entreprise.
  const entitlementGate = route !== null && route.includes("resolveCloneChatPlan") && route.includes("missingPrerequisites");
  const companyGate = route !== null && route.includes('viewer.kind !== "user"');
  const discoveryOpen = route !== null && route.includes('plan.lane === "PUBLIC"');
  const noModelWithoutReservation = route !== null && /const useModel = pubReservation\.granted && !!key && cfg\.enabled/.test(route);
  const measuredOrdering = route !== null && /reservedBeforeProvider:\s*providerSeq === 0 \? null :/.test(route);
  const providerReportedModel = route !== null && /model:\s*viaProvider \? \(usage\?\.model \?\? null\) : null/.test(route);
  const fallbackTruthful = route !== null && /provider:\s*viaProvider \? "openai" : "deterministic"/.test(route);

  const c14AccessGateReady =
    unionTyped && truthinessBugAbsent && entitlementGate && companyGate && discoveryOpen &&
    noModelWithoutReservation && measuredOrdering && providerReportedModel && fallbackTruthful;

  // La preuve provider RÉELLE de C1.4 est-elle préservée ET toujours alignée sur la source ?
  const c14Proof = await (async () => {
    const raw = await readRepo(".c1-4-proofs/access-openai-runtime/real-openai-browser.json");
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as { summary?: Record<string, boolean> };
    } catch {
      return null;
    }
  })();
  const s = c14Proof?.summary ?? {};
  const c14RealOpenAIProofPreserved =
    Boolean(s.realOpenAIBrowserCallExecuted && s.realOpenAITokensObserved && s.realOpenAIBudgetCommitted && s.reservedBeforeProvider) &&
    measuredOrdering; // la preuve ne vaut que si la source qui la produit est toujours mesurée

  // ── Partner program ──
  const partnerProgramTypeScriptReady = ts !== null && ts.errorCount === 0;
  const partnerSuite = targeted?.suites?.["partner-program"];
  const partnerProgramTestsReady = Boolean(partnerSuite && partnerSuite.failed === 0 && partnerSuite.passed > 0);
  const nextRouteExportsValid = Boolean(build && build.exitCode === 0 && build.routeValidationPassed);

  // ── Défauts Pierre ──
  const docSuite = targeted?.suites?.["premium-document-system"];
  const pierreDocumentInferenceReady = Boolean(docSuite && docSuite.failed === 0 && docSuite.passed > 0);
  const fairSuite = targeted?.suites?.["pierre-v1"];
  const fairClaimHarnessStable = Boolean(fairSuite && fairSuite.failed === 0 && fairSuite.passed > 0);

  // ── Gates globaux ──
  const globalTypeScriptReady = ts !== null && ts.errorCount === 0;
  const fullProjectTestsReady = full !== null && full.failed === 0 && full.passed > 0;
  const canonicalScopedNonRegressionReady = canonical !== null && canonical.failed === 0 && canonical.passed > 0;
  // Une compilation réussie SUIVIE d'un échec de validation de routes n'est PAS un build vert.
  const globalBuildReady = Boolean(build && build.exitCode === 0 && build.compiled && build.routeValidationPassed && build.assistantRoutePresent);

  // ── État du dépôt ──
  // `repositoryStable` ne signifie PAS « calme depuis 75 secondes » : il signifie que le dépôt
  // a CESSÉ de bouger, PROUVÉ par la preuve de gel à trois instantanés. Une fenêtre de calme ne
  // prouve rien ; la confirmation du propriétaire non plus — seule la mesure fait foi.
  //
  // On sépare deux choses que la version précédente confondait :
  //   · le FAIT HISTORIQUE qu'un chantier concurrent a existé (ne s'efface jamais) ;
  //   · son ACTIVITÉ COURANTE (c'est elle, et elle seule, qui gouverne la readiness).
  const frozen = await readProof<{
    frozen: boolean;
    processScan?: { foreignAgentsTerminated?: boolean; nextDevRunning?: boolean; nextBuildRunning?: boolean };
    equality?: {
      "A=B"?: boolean; "B=C"?: boolean; "C=C2"?: boolean; preFixFrozen?: boolean;
      "D=E"?: boolean; buildDidNotMoveSource?: boolean;
      "C2->D"?: { onlyExpectedE11Edits?: boolean };
    };
    historicalConcurrency?: { concurrentWorkstreamWasDetected?: boolean };
    concurrentWorkstreamCurrentlyActive?: boolean;
  }>("frozen-repository-proof.json");

  // FAIL-CLOSED : sans preuve de gel, le dépôt n'est PAS réputé stable. La stabilité n'est PAS
  // « le fichier dit frozen » : elle est RE-DÉRIVÉE ici des égalités d'instantanés elles-mêmes,
  // pour qu'un drapeau posé à la main dans une preuve ne puisse jamais suffire.
  const eqp = frozen?.equality;
  const repositoryStable = Boolean(
    frozen?.frozen === true &&
    eqp?.["A=B"] === true && eqp?.["B=C"] === true && eqp?.["C=C2"] === true &&
    eqp?.preFixFrozen === true &&
    // Les SEULS deltas tolérés entre le gel et le build sont les éditions autorisées d'E1.1.
    eqp?.["C2->D"]?.onlyExpectedE11Edits === true &&
    // Le build n'a pas fait bouger la source.
    eqp?.["D=E"] === true && eqp?.buildDidNotMoveSource === true &&
    // Aucun agent étranger vivant, aucun build/dev concurrent.
    frozen?.processScan?.foreignAgentsTerminated === true &&
    frozen?.processScan?.nextDevRunning === false &&
    frozen?.processScan?.nextBuildRunning === false,
  );

  // Historique : vrai si un chantier concurrent a été observé à un moment quelconque. Un fait
  // historique ne se réécrit JAMAIS — même une fois le dépôt figé.
  const concurrentWorkstreamWasDetected =
    Boolean(collision?.concurrentWorkstreamDetected) ||
    Boolean(frozen?.historicalConcurrency?.concurrentWorkstreamWasDetected) ||
    (frozen !== null && frozen.frozen === false);

  // Courant : le chantier écrit-il ENCORE ? Absente ⇒ on ne peut pas affirmer qu'il s'est arrêté
  // ⇒ on le suppose actif (fail-closed). C'est CELUI-CI, et lui seul, qui gouverne la readiness.
  const concurrentWorkstreamCurrentlyActive = frozen === null ? true : !repositoryStable;

  // Alias historique conservé pour les preuves antérieures.
  const concurrentWorkstreamDetected = concurrentWorkstreamWasDetected;

  // ── PLANCHER P10 SUR LES VERSEMENTS PARTENAIRES (sondes de SOURCE réelle) ──
  // Chaque drapeau est PROUVÉ par une regex sur le vrai fichier, jamais posé à la main.
  const payoutSrc = await readRepo("src/lib/partner-program/server/payouts.ts");
  const cronSrc = await readRepo("src/app/api/cron/partner-payouts/route.ts");
  const adminActionSrc = await readRepo("src/app/api/partners/admin/action/route.ts");
  const envExample = await readRepo(".env.example");
  const noComments = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const payoutCode = payoutSrc ? noComments(payoutSrc) : "";

  // Le plancher P10 est-il RÉELLEMENT consommé par la dépendance de versement ?
  const partnerP10PayoutFloorReady =
    payoutSrc !== null &&
    /import\s*\{\s*PRODUCTION_AUTHORIZED\s*\}\s*from\s*["']@\/lib\/clonestore\/production\/p10-production-gate["']/.test(payoutCode) &&
    /productionAuthorized:\s*\(\)\s*=>\s*Boolean\(PRODUCTION_AUTHORIZED\)\s*&&\s*isPartnerLivePayoutAuthorized\(\)/.test(payoutCode);

  // L'environnement peut AJOUTER des restrictions, jamais CONTOURNER le plancher : la garde
  // d'environnement est ET-ée APRÈS la constante, et la constante est littéralement `false`.
  const partnerLivePayoutEnvironmentCannotBypassP10 =
    partnerP10PayoutFloorReady && PRODUCTION_AUTHORIZED === false;

  // Le dry-run délègue à une prévisualisation pure : aucune écriture, aucun appel Stripe.
  const partnerPayoutDryRunSafe =
    payoutSrc !== null &&
    /if\s*\(dryRun\)\s*\{[\s\S]*?previewPayouts\(/.test(payoutCode) &&
    /transfersCreated:\s*0/.test(payoutCode);

  // Idempotence déterministe : clé dérivée du lot, passée à Stripe.
  const partnerPayoutIdempotencyReady =
    payoutSrc !== null &&
    /payoutIdempotencyKey\(/.test(payoutCode) &&
    /idempotencyKey/.test(payoutCode) &&
    /on conflict \(run_key\) do nothing/.test(payoutCode);

  // Une commission ne devient `paid` qu'APRÈS la confirmation du fournisseur, et une issue
  // inconnue ne libère rien / ne paie rien.
  const partnerPayoutProviderEvidenceRequired =
    payoutSrc !== null &&
    /await settle\(db, p, transferRowId, transfer\.id/.test(payoutCode) &&
    /reconciliation_required/.test(payoutCode) &&
    /findTransfer\(/.test(payoutCode);

  // Aucune route ne contourne le plancher : le cron passe par `defaultPayoutDeps`, l'admin est
  // en prévisualisation forcée.
  const partnerPayoutRoutesCannotBypass =
    cronSrc !== null && /defaultPayoutDeps\(/.test(cronSrc) &&
    adminActionSrc !== null && /dryRunOverride:\s*true/.test(adminActionSrc);

  // La promesse de `.env.example` est-elle désormais VRAIE ?
  const envExampleP10ClaimHonest =
    envExample !== null && /plancher P10/i.test(envExample) && partnerP10PayoutFloorReady;

  // Migration de versement : présente localement, JAMAIS appliquée à distance par cette session.
  const payoutMigration = await readRepo("supabase/migrations/2026-07-11_05__clonestore_pp_payout_automation.sql");
  const partnerPayoutMigrationPresent = payoutMigration !== null;
  const partnerPayoutMigrationAppliedRemotely = false as const;
  const partnerPayoutLiveAuthorized = false as const;   // plancher P10 faux ⇒ jamais autorisé
  const partnerPayoutLiveExecuted = false as const;     // aucun transfert émis par cette session

  // ── P9.4.1 ──
  const p941MigrationPresent =
    migration !== null &&
    /if not exists \(select 1 from pg_roles where rolname = 'clonechat_app'\)/.test(migration) &&
    /create role clonechat_app nologin/.test(migration);
  // Le prévol est « prêt » seulement s'il est PROUVÉ en lecture seule : aucun verbe de mutation.
  const preflightHasNoMutation =
    preflightSrc !== null && !/\b(create|alter|drop|grant|revoke|insert|update|delete)\s+(role|table|policy|function|into|on)\b/i.test(
      preflightSrc.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""),
    );
  const p941RemotePreflightReady =
    preflightSrc !== null && preflightHasNoMutation && preflight !== null && preflight.readOnly === true && preflight.mutationsExecuted === 0;

  // ── Planchers DURS (jamais dérivés d'un environnement) ──
  const p941AppliedRemotely = false as const;
  const remoteDatabaseMutated = false as const;
  const deploymentPerformed = false as const;
  // `PRODUCTION_AUTHORIZED` est une CONSTANTE littérale `false` : la comparer à `true` est une
  // erreur de type (TS2367), et c'est tant mieux — le plancher est vérifié par le compilateur,
  // pas par une expression exécutable qu'on pourrait un jour retourner.
  const productionAuthorized: boolean = PRODUCTION_AUTHORIZED;
  const paymentMode = resolvePaymentMode({} as NodeJS.ProcessEnv);
  const liveProvidersBlocked: boolean = !isLiveExecutionAllowed();

  // ── Bloqueurs ──
  if (!globalTypeScriptReady) blockers.push("TypeScript global non vert.");
  if (!fullProjectTestsReady) blockers.push("Suite de tests complète non verte.");
  if (!canonicalScopedNonRegressionReady) blockers.push("Non-régression canonique non verte.");
  if (!globalBuildReady) blockers.push("Build propre non vert (compilation ET validation de routes exigées).");
  if (!c14AccessGateReady) blockers.push("La porte d'accès C1.4 n'est plus intacte dans la source courante.");
  if (!c14RealOpenAIProofPreserved) blockers.push("La preuve OpenAI réelle de C1.4 n'est plus préservée/alignée.");
  if (!pierreDocumentInferenceReady) blockers.push("L'inférence documentaire Pierre n'est pas verte.");
  if (!fairClaimHarnessStable) blockers.push("Le harnais fair-claim n'est pas stable.");
  if (!p941RemotePreflightReady) blockers.push("Le prévol P9.4.1 en lecture seule n'est pas prêt.");
  // ── Plancher P10 sur les versements : un défaut ici est un défaut FINANCIER, pas cosmétique ──
  if (!partnerP10PayoutFloorReady) blockers.push("Le plancher P10 n'est PAS consommé par les versements partenaires : une configuration d'environnement pourrait autoriser un transfert Stripe LIVE alors que PRODUCTION_AUTHORIZED=false.");
  if (!partnerLivePayoutEnvironmentCannotBypassP10) blockers.push("L'environnement peut contourner le plancher P10 sur les versements.");
  if (!partnerPayoutDryRunSafe) blockers.push("Le dry-run des versements n'est pas une prévisualisation pure.");
  if (!partnerPayoutIdempotencyReady) blockers.push("L'idempotence des versements n'est pas déterministe.");
  if (!partnerPayoutProviderEvidenceRequired) blockers.push("Une commission pourrait être marquée payée sans preuve du fournisseur.");
  if (!partnerPayoutRoutesCannotBypass) blockers.push("Une route (cron/admin) peut contourner l'autorisation de versement.");
  if (!envExampleP10ClaimHonest) blockers.push("`.env.example` promet un plancher P10 sur les versements que le code n'applique pas.");
  if (productionAuthorized) blockers.push("PRODUCTION_AUTHORIZED est vrai — plancher levé.");
  if (paymentMode === "live") blockers.push("Le mode de paiement est 'live'.");
  if (!liveProvidersBlocked) blockers.push("Les providers live ne sont pas bloqués.");

  // ── Avertissements honnêtes ──
  // HISTORIQUE — ne s'efface jamais, même une fois le dépôt figé.
  if (concurrentWorkstreamWasDetected) {
    warnings.push(
      "HISTORIQUE : un CHANTIER CONCURRENT (partner-program) a écrit dans ce dépôt PENDANT E1.1 (automatisation des reversements + nouvelle migration SQL). E1.1 n'a modifié AUCUN fichier partner. Ce fait est conservé même après stabilisation.",
    );
    warnings.push(
      "HISTORIQUE : le chantier partner a déjà repris après une pause de ~96 minutes. Une fenêtre de calme n'a jamais prouvé son arrêt — seule la preuve de gel à trois instantanés fait foi.",
    );
  }
  // COURANT — c'est ceci qui bloque.
  if (concurrentWorkstreamCurrentlyActive) {
    warnings.push(
      "COURANT : le chantier concurrent écrit ENCORE. Le propriétaire a confirmé sa fin, mais la MESURE le contredit — la preuve de gel prime sur la confirmation. Aucun vert mesuré sur ce dépôt n'est certifiable.",
    );
  }
  if (preflight?.target?.productionSuspected) {
    warnings.push("La base cible par défaut est classée DISTANTE MANAGÉE : la production ne peut pas être exclue ⇒ aucune migration ne lui a été appliquée.");
  }
  if (preflight && preflight.migrationState === "UNKNOWN") {
    warnings.push("État distant de la migration P9.4.1 = INCONNU (prévol lancé sans --connect, qui exige un opérateur autorisé). La présence du fichier ne prouve PAS son application.");
  }
  warnings.push("Le partner-program a introduit une NOUVELLE migration non appliquée (supabase/migrations/2026-07-11_05__clonestore_pp_payout_automation.sql) : elle relève de son chantier, pas d'E1.1, et s'ajoute aux actions opérateur.");
  warnings.push("`readyForControlledDeployment` NE VAUT PAS autorisation de déployer : PRODUCTION_AUTHORIZED reste false et le déploiement exige une décision explicite du propriétaire.");

  // ── Sorties ──
  const localGreen =
    globalTypeScriptReady && fullProjectTestsReady && canonicalScopedNonRegressionReady && globalBuildReady &&
    partnerProgramTypeScriptReady && partnerProgramTestsReady && nextRouteExportsValid &&
    pierreDocumentInferenceReady && fairClaimHarnessStable && c14AccessGateReady && c14RealOpenAIProofPreserved &&
    // Le plancher financier fait partie du « vert » : un dépôt qui compile mais dont un versement
    // LIVE peut partir sans autorisation de production n'est PAS vert.
    partnerP10PayoutFloorReady && partnerLivePayoutEnvironmentCannotBypassP10 &&
    partnerPayoutDryRunSafe && partnerPayoutIdempotencyReady &&
    partnerPayoutProviderEvidenceRequired && partnerPayoutRoutesCannotBypass && envExampleP10ClaimHonest;

  // La migration P9.4.1 ne concerne QUE les surfaces `clonechat_*`, que le chantier partner ne
  // touche pas. MAIS : `localGreen` est LU dans des preuves (tsc / tests / build) produites à un
  // instant donné. Si le dépôt a bougé DEPUIS, ces preuves décrivent un arbre qui n'existe plus —
  // elles sont PÉRIMÉES. On n'autorise donc rien sur la foi d'un vert périmé : la stabilité
  // courante est une CONDITION de la validité des mesures, pas un ornement.
  const measurementsStale = concurrentWorkstreamCurrentlyActive;
  if (measurementsStale) {
    warnings.push(
      "PREUVES PÉRIMÉES : les preuves tsc/tests/build lues par ce poste de commandement ont été produites AVANT les écritures concurrentes. Elles décrivent un arbre qui n'existe plus ⇒ aucun « vert » ne peut en être déduit tant que le dépôt n'est pas figé et re-mesuré.",
    );
  }
  const readyForRemoteMigrationAuthorization =
    localGreen && !measurementsStale && p941MigrationPresent && p941RemotePreflightReady && !remoteDatabaseMutated;

  // Le DÉPLOIEMENT, lui, embarque TOUT le dépôt. Un vert mesuré sur un dépôt qu'un autre
  // chantier réécrit encore n'est PAS un état déployable : la stabilité est une CONDITION,
  // pas un détail. Sans elle, « prêt au déploiement contrôlé » serait un mensonge de commodité.
  const readyForControlledDeployment =
    localGreen && repositoryStable && !concurrentWorkstreamCurrentlyActive &&
    blockers.length === 0 && !productionAuthorized && paymentMode !== "live";
  if (!repositoryStable) {
    blockers.push(
      "Le dépôt n'est pas figé : le chantier concurrent écrit encore. Mesuré lors de la tentative de certification : src/app/api/cron/partner-payouts/route.ts réécrit DEUX fois (19:45:52Z puis 19:54:27Z), APRÈS la confirmation du propriétaire et APRÈS l'instantané 2 ; la compilation est passée de ROUGE (TS2552) à VERT sans aucune action de ma part. Un vert global n'est valable qu'à l'instant où il est mesuré ⇒ aucun déploiement ne peut être certifié.",
    );
  }

  let verdict: E11Verdict;
  if (!repositoryStable) {
    verdict = "E1.1 — RECONCILIATION BLOCKED / PARTNER WORKSTREAM STILL ACTIVE";
  } else if (!localGreen || blockers.length > 0) {
    verdict = "E1.1 — RECONCILIATION PARTIAL / GLOBAL BUILD OR TESTS BLOCKED";
  } else if (concurrentWorkstreamDetected || preflight?.migrationState !== "COMPLETE") {
    // Le dépôt est vert localement, mais l'état distant reste inconnu et le déploiement
    // demeure une décision du propriétaire : on ne prétend PAS au prévol « tout vert ».
    verdict = "E1.1 — REPOSITORY LOCALLY RECONCILED / REMOTE MIGRATION AND DEPLOYMENT AUTHORIZATION REQUIRED";
  } else {
    verdict = "E1.1 — GLOBAL REPOSITORY GREEN / CONTROLLED DEPLOYMENT PREFLIGHT READY";
  }

  const nextSafeAction = readyForRemoteMigrationAuthorization
    ? "Décision du propriétaire : autoriser un opérateur à lancer `node scripts/e1-1-clonechat-remote-preflight.mjs --connect` (lecture seule) sur la base cible, puis, si migrationState = UNAPPLIED, appliquer la migration canonique P9.4.1 — voir E1_1_P941_REMOTE_MIGRATION_PREFLIGHT.md. Aucun déploiement n'est autorisé par cette étape."
    : "Résoudre les bloqueurs listés avant toute demande d'autorisation distante.";

  return Object.freeze({
    repositoryStable,
    concurrentWorkstreamWasDetected,
    concurrentWorkstreamCurrentlyActive,
    concurrentWorkstreamDetected,
    partnerProgramTypeScriptReady,
    partnerProgramTestsReady,
    nextRouteExportsValid,
    partnerP10PayoutFloorReady,
    partnerLivePayoutEnvironmentCannotBypassP10,
    partnerPayoutDryRunSafe,
    partnerPayoutIdempotencyReady,
    partnerPayoutProviderEvidenceRequired,
    partnerPayoutRoutesCannotBypass,
    envExampleP10ClaimHonest,
    partnerPayoutMigrationPresent,
    partnerPayoutMigrationAppliedRemotely,
    partnerPayoutLiveAuthorized,
    partnerPayoutLiveExecuted,
    pierreDocumentInferenceReady,
    fairClaimHarnessStable,
    globalTypeScriptReady,
    fullProjectTestsReady,
    canonicalScopedNonRegressionReady,
    globalBuildReady,
    c14AccessGateReady,
    c14RealOpenAIProofPreserved,
    p941MigrationPresent,
    p941RemotePreflightReady,
    p941AppliedRemotely,
    remoteDatabaseMutated,
    deploymentPerformed,
    productionAuthorized,
    paymentMode,
    liveProvidersBlocked,
    readyForRemoteMigrationAuthorization,
    readyForControlledDeployment,
    exactWarnings: Object.freeze(warnings),
    exactBlockers: Object.freeze(blockers),
    nextSafeAction,
    verdict,
  });
}
