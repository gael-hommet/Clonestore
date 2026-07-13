// src/lib/clonestore/external-enablement/e1/__tests__/e1-1-reconciliation.test.ts
// E1.1 §14 — Le poste de commandement de réconciliation calcule ses champs depuis des PREUVES
// RÉELLES et des SONDES DE SOURCE. Ces tests verrouillent ses règles dures : les planchers ne
// peuvent pas être levés, et « prêt » ne peut jamais être prononcé sans build/tests/TS verts.

import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeE11ReconciliationCommandCenter } from "../e1-1-reconciliation-command-center";

const cc = await computeE11ReconciliationCommandCenter();

describe("E1.1 — poste de commandement de réconciliation", () => {
  it("les planchers durs ne sont JAMAIS levés", () => {
    expect(cc.p941AppliedRemotely).toBe(false);
    expect(cc.remoteDatabaseMutated).toBe(false);
    expect(cc.deploymentPerformed).toBe(false);
    expect(cc.productionAuthorized).toBe(false);
    expect(cc.paymentMode).not.toBe("live");
    expect(cc.liveProvidersBlocked).toBe(true);
  });

  it("l'état C1.4 est RECALCULÉ depuis la source courante (pas recopié d'une preuve périmée)", () => {
    expect(cc.c14AccessGateReady).toBe(true);
    expect(cc.c14RealOpenAIProofPreserved).toBe(true);
  });

  it("les défauts réels traités par E1.1 sont verts", () => {
    expect(cc.pierreDocumentInferenceReady).toBe(true);
    expect(cc.fairClaimHarnessStable).toBe(true);
  });

  it("les gates globaux sont mesurés, pas supposés", () => {
    expect(cc.globalTypeScriptReady).toBe(true);
    expect(cc.fullProjectTestsReady).toBe(true);
    expect(cc.canonicalScopedNonRegressionReady).toBe(true);
    expect(cc.globalBuildReady).toBe(true); // compilation ET validation de routes
  });

  it("le prévol P9.4.1 est prêt ET l'état distant reste INCONNU (le fichier ne prouve rien)", () => {
    expect(cc.p941MigrationPresent).toBe(true);
    expect(cc.p941RemotePreflightReady).toBe(true);
    expect(cc.p941AppliedRemotely).toBe(false);
  });

  it("le FAIT HISTORIQUE du chantier concurrent n'est jamais effacé", () => {
    // Même une fois le dépôt figé, l'histoire reste : un autre chantier A écrit ici.
    expect(cc.concurrentWorkstreamWasDetected).toBe(true);
    expect(cc.concurrentWorkstreamDetected).toBe(true); // alias historique
  });

  it("PLANCHER P10 SUR LES VERSEMENTS — aucune variable d'environnement ne peut l'enjamber", () => {
    // Le défaut corrigé : `defaultPayoutDeps` ne consultait QUE la garde d'environnement.
    expect(cc.partnerP10PayoutFloorReady).toBe(true);
    expect(cc.partnerLivePayoutEnvironmentCannotBypassP10).toBe(true);
    // La promesse de `.env.example` est désormais VRAIE.
    expect(cc.envExampleP10ClaimHonest).toBe(true);
    // Et rien de live n'est autorisé ni exécuté.
    expect(cc.partnerPayoutLiveAuthorized).toBe(false);
    expect(cc.partnerPayoutLiveExecuted).toBe(false);
  });

  it("sécurité financière des versements : dry-run pur, idempotence, preuve fournisseur, routes non contournables", () => {
    expect(cc.partnerPayoutDryRunSafe).toBe(true);
    expect(cc.partnerPayoutIdempotencyReady).toBe(true);
    expect(cc.partnerPayoutProviderEvidenceRequired).toBe(true);
    expect(cc.partnerPayoutRoutesCannotBypass).toBe(true);
  });

  it("la migration de versement est présente localement mais JAMAIS appliquée à distance", () => {
    expect(cc.partnerPayoutMigrationPresent).toBe(true);
    expect(cc.partnerPayoutMigrationAppliedRemotely).toBe(false);
  });

  it("l'HISTORIQUE de concurrence et l'ACTIVITÉ COURANTE sont deux faits distincts", () => {
    // Le fait historique ne s'efface jamais…
    expect(cc.concurrentWorkstreamWasDetected).toBe(true);
    // …mais c'est l'activité COURANTE qui gouverne la readiness.
    expect(typeof cc.concurrentWorkstreamCurrentlyActive).toBe("boolean");
    // La readiness ne dépend PAS de l'existence passée d'un chantier : elle dépend de la
    // stabilité COURANTE. Si le chantier est encore actif ⇒ jamais déployable.
    if (cc.concurrentWorkstreamCurrentlyActive) {
      expect(cc.repositoryStable).toBe(false);
      expect(cc.readyForControlledDeployment).toBe(false);
    }
  });

  it("un vert PÉRIMÉ n'autorise RIEN — les preuves lues sur un arbre qui a bougé ne valent plus", () => {
    // `localGreen` est lu dans des preuves tsc/tests/build. Si le chantier a écrit APRÈS leur
    // production, elles décrivent un arbre disparu. Aucune autorisation ne peut en découler.
    if (cc.concurrentWorkstreamCurrentlyActive) {
      expect(cc.readyForRemoteMigrationAuthorization).toBe(false);
      expect(cc.readyForControlledDeployment).toBe(false);
      expect(cc.exactWarnings.some((w) => /PÉRIMÉE|périmé/i.test(w))).toBe(true);
    }
  });

  it("`repositoryStable` est DÉRIVÉ des ÉGALITÉS d'instantanés — jamais d'un drapeau posé à la main", () => {
    // La stabilité n'est pas « le fichier de preuve dit frozen » : le poste de commandement
    // RE-DÉRIVE la stabilité des égalités A=B=C=C2, du fait que les seuls deltas jusqu'à D sont
    // les éditions autorisées d'E1.1, de D=E (le build n'a pas bougé la source) et de l'absence
    // d'agent étranger. Un `frozen: true` inventé sans ces égalités ne suffirait donc PAS.
    expect(cc.repositoryStable).toBe(true);
    expect(cc.concurrentWorkstreamCurrentlyActive).toBe(false);
    // Le dépôt étant figé, plus aucun bloqueur de mouvement.
    expect(cc.exactBlockers.some((b) => /pas figé|écrit encore/i.test(b))).toBe(false);
  });

  it("un dépôt en mouvement INTERDIRAIT « prêt au déploiement contrôlé » (la stabilité est une CONDITION)", () => {
    // Le dépôt est désormais figé. La règle demeure : la readiness EXIGE la stabilité — un vert
    // mesuré sur un arbre qu'un autre chantier réécrit ne serait jamais un état déployable.
    // On verrouille l'IMPLICATION, pas l'état du jour.
    if (!cc.repositoryStable || cc.concurrentWorkstreamCurrentlyActive) {
      expect(cc.readyForControlledDeployment).toBe(false);
    }
    // Et le déploiement reste, lui, non effectué et non autorisé.
    expect(cc.deploymentPerformed).toBe(false);
  });

  it("« prêt au déploiement contrôlé » n'autorise JAMAIS le déploiement (ni ne lève la production)", () => {
    expect(cc.deploymentPerformed).toBe(false);
    expect(cc.productionAuthorized).toBe(false);
    expect(cc.paymentMode).not.toBe("live");
    // Même « prêt », rien n'est déployé : « prêt » ≠ « autorisé » ≠ « fait ».
    expect(cc.nextSafeAction).toMatch(/opérateur|Résoudre|autoris/i);
  });

  it("preuve : le poste de commandement est écrit tel quel", () => {
    const dir = resolve(process.cwd(), ".e1-1-proofs", "repository-reconciliation");
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "command-center.json"), JSON.stringify({ runId: "repository-reconciliation", report: cc }, null, 2));
    writeFileSync(
      resolve(dir, "final-verdict.json"),
      JSON.stringify(
        {
          runId: "repository-reconciliation",
          verdict: cc.verdict,
          readyForRemoteMigrationAuthorization: cc.readyForRemoteMigrationAuthorization,
          readyForControlledDeployment: cc.readyForControlledDeployment,
          exactBlockers: cc.exactBlockers,
          exactWarnings: cc.exactWarnings,
          nextSafeAction: cc.nextSafeAction,
          productionAuthorized: cc.productionAuthorized,
          remoteDatabaseMutated: cc.remoteDatabaseMutated,
          deploymentPerformed: cc.deploymentPerformed,
        },
        null,
        2,
      ),
    );
    expect(cc.verdict.startsWith("E1.1 —")).toBe(true);
  });
});
