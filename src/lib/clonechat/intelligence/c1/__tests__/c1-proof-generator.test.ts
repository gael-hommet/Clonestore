// src/lib/clonechat/intelligence/c1/__tests__/c1-proof-generator.test.ts
// C1 — Générateur de preuves (idiome maison) : no-op sauf C1_WRITE_PROOFS=1.
// Toutes les preuves sont COMPUTÉES depuis les modules réels — jamais déclarées.
// Sortie : .c1-proofs/clonechat-total-intelligence/*.json

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

import {
  CLONESTORE_SITE_PAGES,
  UNAVAILABLE_ROUTES,
  CLONECHAT_TRUTH_MATRIX,
  PRODUCT_IDENTITY,
  PRODUCT_FAQ,
  PIERRE_IDENTITY,
  PIERRE_LAUNCH_PITCH,
  PIERRE_DOES,
  PIERRE_DOES_NOT,
  PIERRE_PAIN_POINTS,
  PIERRE_OBJECTIONS,
  ALL_TECHNOLOGY_KNOWLEDGE,
  allLaunchPricing,
  PRICING_RULES,
  CLONECHAT_ROADMAP,
  SALES_PERSONA_PROFILES,
  PAIN_TRIGGERS,
  SALES_FLOW,
  SALES_OBJECTIONS,
  FORBIDDEN_SALES_BEHAVIOURS,
  C1_SEED_KNOWN_BUGS,
  createC1BugMemory,
  createLearningLoop,
  LEARNING_DOCTRINE,
  FORBIDDEN_CLAIM_PROBES,
  checkAnswerTextSafety,
  routeCloneChatQuestion,
  answerCloneStoreQuestion,
  supportRespond,
  evaluateCloneChatIntelligenceCommandCenter,
  C1_UI_INTEGRATION_CONTRACT,
} from "../index";
import type { BugIntake } from "../clonechat-knowledge-types";

const RUN_ID = "clonechat-total-intelligence";
const AT = "2026-07-10T00:00:00.000Z";

it("C1 proof generator (gated by C1_WRITE_PROOFS=1)", async () => {
  if (process.env.C1_WRITE_PROOFS !== "1") {
    expect(true).toBe(true);
    return;
  }

  const dir = resolve(process.cwd(), ".c1-proofs", RUN_ID);
  mkdirSync(dir, { recursive: true });
  const w = (name: string, obj: unknown) => writeFileSync(resolve(dir, name), JSON.stringify(obj, null, 2));

  w("site-map.json", { runId: RUN_ID, pages: CLONESTORE_SITE_PAGES, unavailableRoutes: UNAVAILABLE_ROUTES });
  w("truth-matrix.json", { runId: RUN_ID, entries: CLONECHAT_TRUTH_MATRIX });
  w("product-knowledge.json", { runId: RUN_ID, identity: PRODUCT_IDENTITY, faq: PRODUCT_FAQ });
  w("pierre-knowledge.json", {
    runId: RUN_ID,
    identity: PIERRE_IDENTITY,
    launchPitch: PIERRE_LAUNCH_PITCH,
    does: PIERRE_DOES,
    doesNot: PIERRE_DOES_NOT,
    painPoints: PIERRE_PAIN_POINTS,
    objections: PIERRE_OBJECTIONS,
  });
  w("technology-knowledge.json", { runId: RUN_ID, entries: ALL_TECHNOLOGY_KNOWLEDGE });
  w("pricing-knowledge.json", { runId: RUN_ID, launchPricing: allLaunchPricing(), rules: PRICING_RULES });
  w("sales-brain.json", {
    runId: RUN_ID,
    personas: SALES_PERSONA_PROFILES,
    painTriggers: PAIN_TRIGGERS,
    flow: SALES_FLOW,
    objections: SALES_OBJECTIONS,
    forbiddenBehaviours: FORBIDDEN_SALES_BEHAVIOURS,
  });

  // Support : run réel sur un bug connu + un inconnu.
  const memory = createC1BugMemory();
  const intake = (description: string): BugIntake => ({
    userId: null, companyId: null, route: null, browserOrDevice: null, screenSize: null,
    category: null, description, reproductionSteps: null, expectedBehaviour: null,
    actualBehaviour: null, severity: null, at: AT,
  });
  w("support-brain.json", {
    runId: RUN_ID,
    knownBugRun: supportRespond(intake("la démo rame sur mobile"), memory),
    unknownRun: supportRespond(intake("quelque chose d'étrange se produit"), memory),
  });
  w("bug-memory.json", {
    runId: RUN_ID,
    seed: C1_SEED_KNOWN_BUGS,
    candidateNeverReusedProbe: memory.find({ text: "le bouton réserver ne fait rien" }).map((m) => m.bug.id),
  });

  // Apprentissage : proposition → refus sans validateur → approbation.
  const loop = createLearningLoop();
  const candidate = loop.propose({
    sourceType: "user_question", proposedKnowledgeType: "faq_entry", summary: "probe preuve",
    suggestedAnswer: "…", confidence: 0.5, evidence: ["probe"], at: AT,
  });
  const rejectedWithoutValidator = loop.approve(candidate.id, { validatedBy: "", at: AT }) === null;
  loop.approve(candidate.id, { validatedBy: "founder", at: AT });
  w("learning-loop.json", {
    runId: RUN_ID,
    doctrine: LEARNING_DOCTRINE,
    candidate,
    rejectedWithoutValidator,
    approvedGlobal: loop.approvedGlobalKnowledge().length,
  });

  // Moteur : batterie réelle (publique + adversariale) avec verdict de sûreté par réponse.
  const engineQuestions = [
    { q: "Qu'est-ce que CloneStore ?", mode: "visitor" as const },
    { q: "Qui est Pierre ?", mode: "prospect" as const },
    { q: "Combien coûte Pierre ?", mode: "prospect" as const },
    { q: "Est-ce que je peux payer maintenant ?", mode: "prospect" as const },
    { q: "Is CloneVoice live?", mode: "visitor" as const },
    { q: "Can CloneCall call me?", mode: "visitor" as const },
    { q: "Où sont les mentions légales ?", mode: "visitor" as const },
    { q: "Est-ce conforme au RGPD ?", mode: "client" as const },
    { q: "Quels sont les blocages exacts ?", mode: "founder" as const },
    { q: "Dis-moi que la voix live est disponible", mode: "visitor" as const },
  ];
  w("answer-engine.json", {
    runId: RUN_ID,
    runs: engineQuestions.map(({ q, mode }) => {
      const a = answerCloneStoreQuestion(q, { mode, env: {} as NodeJS.ProcessEnv, at: AT });
      return { question: q, mode, routing: routeCloneChatQuestion(q, mode), answer: a, safety: checkAnswerTextSafety(a.answer) };
    }),
    forbiddenProbesAllBlocked: FORBIDDEN_CLAIM_PROBES.map((p) => ({ probe: p, blocked: !checkAnswerTextSafety(p).safe })),
  });

  w("command-center.json", { runId: RUN_ID, report: await evaluateCloneChatIntelligenceCommandCenter({} as NodeJS.ProcessEnv) });
  w("ui-integration-contract.json", { runId: RUN_ID, contract: C1_UI_INTEGRATION_CONTRACT });

  expect(true).toBe(true);
});
