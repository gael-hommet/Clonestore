// C1.9 — PIPELINE, TESTS DÉTERMINISTES.
//
// Le port modèle est SCRIPTÉ : aucun appel réseau, aucun coût. On ne teste pas la qualité
// rédactionnelle du modèle (c'est l'objet de la campagne réelle) mais les GARANTIES
// STRUCTURELLES de la pipeline : couverture multi-intentions, honnêteté du mode dégradé,
// réparation plutôt que substitution, refus d'outil, isolation.
import { describe, it, expect } from "vitest";
import { writeFileSync } from "fs";
import { runCloneChatIntelligence } from "../intelligence-runtime";
import type { C19ModelPort } from "../understanding";
import type { ParrainViewerContext } from "../../c1-1/parrain-types";
import { collectCandidateChunks } from "../../c1-1/parrain-source-adapters";
import { estimateWorkload, executeGovernedTool } from "../governed-tools";
import { verifyResponse } from "../response-verifier";
import { buildResponsePlan } from "../response-composer";
import type { Understanding } from "../understanding-schema";

const PUBLIC_VIEWER: ParrainViewerContext = { mode: "public", companyId: null, userId: null, role: null };
const AT = "2026-07-22T10:00:00.000Z";
const OUT = "c:/Users/homme/clonestore/.c1-9-proofs";

/** Port scripté : la 1re réponse sert `understand`, la 2e `compose`. */
function scriptedPort(understanding: unknown, answer: unknown): C19ModelPort & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async complete(req) {
      calls.push(req.purpose);
      const payload = req.purpose === "understand" ? understanding : answer;
      return {
        ok: true,
        text: typeof payload === "string" ? payload : JSON.stringify(payload),
        usage: { inputTokens: 10, outputTokens: 20, model: "scripted" },
        error: null,
      };
    },
  };
}

function failingPort(): C19ModelPort {
  return { async complete() { return { ok: false, text: null, usage: null, error: "provider_down" }; } };
}

const baseUnderstanding = (over: Partial<Understanding> = {}) => ({
  summary: "l'utilisateur veut comprendre", primary_goal: "comprendre", secondary_goals: [],
  questions_detected: [], entities: [], requested_metrics: [], requested_actions: [],
  constraints: [], assumptions: [], missing_information: [], ambiguities: [],
  user_emotion: "neutre", requires_clarification: false, clarification_question: null,
  knowledge_needs: [], tool_needs: [], risk_signals: [], confidence: 0.8,
  depends_on_history: false, is_correction: false, out_of_scope: false,
  ...over,
});

describe("C1.9 runtime — structural guarantees", () => {
  const results: Array<Record<string, unknown>> = [];

  it("calls the model for understanding AND composition — no branch skips it", async () => {
    const port = scriptedPort(
      baseUnderstanding({ knowledge_needs: ["tarif de Pierre"], questions_detected: ["quel est le prix"] }),
      { answer: "Le tarif est de 449 € / mois en France.", citations: [] },
    );
    const r = await runCloneChatIntelligence(port, {
      turnId: "t1", message: "combien ça coûte ?", history: [], viewer: PUBLIC_VIEWER,
      candidates: collectCandidateChunks({ question: "combien ça coûte ?" }),
      serverCountry: "FR", at: AT, mode: "on",
    });
    expect(port.calls).toEqual(["understand", "compose"]);
    expect(r.trace.modelCalls).toBe(2);
    results.push({ test: "model reached", calls: port.calls, status: r.status });
  });

  it("builds one coverage goal per question — a triple question cannot collapse to one", () => {
    const u = baseUnderstanding({
      questions_detected: ["quel est le prix", "est-ce disponible en Belgique", "gère-t-il les congés payés"],
    }) as Understanding;
    const plan = buildResponsePlan(u, "strong");
    expect(plan.coverage.length).toBe(3);
    expect(plan.items.length).toBe(3);
    results.push({ test: "multi-intent plan", goals: plan.coverage.length });
  });

  it("flags an answer that covers only one of three questions", () => {
    const u = baseUnderstanding({
      questions_detected: ["le tarif mensuel de Pierre", "la disponibilité en Belgique", "la gestion des congés payés"],
    }) as Understanding;
    const plan = buildResponsePlan(u, "strong");
    const verdict = verifyResponse({
      answer: "La Belgique fait partie des pays de lancement.",
      citations: [], plan,
      truth: { facts: [{ key: "x", value: "y", source: "s", authority: "a", evidence: "retrieved", verifiedAt: AT, confidence: 1, allowedForViewer: true }], availableRoutes: [], groundingEmpty: false },
      toolOutcomes: [],
    });
    expect(verdict.issues.map((i) => i.code)).toContain("INCOMPLETE_COVERAGE");
    expect(verdict.uncoveredGoals.length).toBeGreaterThanOrEqual(2);
    expect(verdict.action).toBe("clarify");
    results.push({ test: "incomplete coverage detected", uncovered: verdict.uncoveredGoals.length, action: verdict.action });
  });

  it("repairs a claims violation by excision instead of discarding the whole answer", () => {
    const u = baseUnderstanding({ questions_detected: ["ce que Pierre prépare"] }) as Understanding;
    const plan = buildResponsePlan(u, "strong");
    const verdict = verifyResponse({
      answer: "Pierre prépare vos contrats et un humain valide. Le paiement en ligne est ouvert dès maintenant. Je reste disponible pour préparer vos contrats.",
      citations: [], plan,
      truth: { facts: [{ key: "x", value: "y", source: "s", authority: "a", evidence: "retrieved", verifiedAt: AT, confidence: 1, allowedForViewer: true }], availableRoutes: [], groundingEmpty: false },
      toolOutcomes: [],
    });
    // L'ancienne garde renvoyait SAFE_REFUSAL_TEXT à la place de TOUT le texte.
    expect(verdict.action).toBe("repaired");
    expect(verdict.text).toContain("Pierre prépare vos contrats");
    expect(verdict.text).not.toContain("paiement en ligne est ouvert");
    expect(verdict.text).not.toContain("Je préfère ne pas affirmer cela");
    // L'espace inter-phrase est restitué (l'ancien assemblage produisait « précisément.Pour »).
    expect(verdict.text).not.toMatch(/[a-zé]\.[A-ZÉ]/);
    results.push({ test: "claims repair not substitution", action: verdict.action, keptChars: verdict.text.length });
  });

  it("refuses to claim an executed action", () => {
    const u = baseUnderstanding({ questions_detected: ["envoyer le contrat"] }) as Understanding;
    const plan = buildResponsePlan(u, "strong");
    const verdict = verifyResponse({
      answer: "C'est fait, j'ai envoyé le contrat à Paul pour envoyer le contrat.",
      citations: [], plan,
      truth: { facts: [], availableRoutes: [], groundingEmpty: true },
      toolOutcomes: [],
    });
    expect(verdict.issues.map((i) => i.code)).toContain("FALSE_EXECUTION_CLAIM");
    results.push({ test: "false execution claim caught", action: verdict.action });
  });

  it("is honest when the provider is down — it does not impersonate intelligence", async () => {
    const r = await runCloneChatIntelligence(failingPort(), {
      turnId: "t2", message: "combien ça coûte ?", history: [], viewer: PUBLIC_VIEWER,
      candidates: collectCandidateChunks({ question: "combien ça coûte ?" }),
      serverCountry: "FR", at: AT, mode: "on",
    });
    expect(r.status).toBe("degraded");
    // Le point corrigé : l'ancien repli renvoyait honesty "answered".
    expect(r.status).not.toBe("answered");
    expect(r.answer).toMatch(/je préfère vous le dire/i);
    results.push({ test: "degraded honesty", status: r.status });
  });

  it("says source_missing rather than answering a neighbouring topic", async () => {
    const port = scriptedPort(
      baseUnderstanding({ knowledge_needs: ["géographie mondiale capitales"], questions_detected: ["quelle est la capitale"], out_of_scope: true }),
      { answer: "Je ne dispose pas de cette information : ce n'est pas mon domaine.", citations: [] },
    );
    const r = await runCloneChatIntelligence(port, {
      turnId: "t3", message: "quelle est la capitale de ce pays ?", history: [], viewer: PUBLIC_VIEWER,
      candidates: collectCandidateChunks({ question: "capitale" }),
      serverCountry: null, at: AT, mode: "on",
    });
    // L'ancien moteur répondait « ce pays ne fait pas partie des pays couverts » avec
    // honesty "answered" — une question jamais posée, affirmée avec confiance.
    expect(r.status).toBe("source_missing");
    expect(r.diagnostics.sufficiency).toBe("none");
    results.push({ test: "out of scope honest", status: r.status, sufficiency: r.diagnostics.sufficiency });
  });

  it("computes an estimate with explicit assumptions rather than reciting a paragraph", () => {
    const a = estimateWorkload({ peopleOnAdmin: 2, hoursPerWeekPerPerson: 15, hourlyCost: 35, subscriptionMonthly: 449 });
    const b = estimateWorkload({ peopleOnAdmin: 1, hoursPerWeekPerPerson: 4, hourlyCost: 28, subscriptionMonthly: 449 });
    expect(a.ok && b.ok).toBe(true);
    // Deux entreprises différentes → deux résultats différents (§8 du cahier des charges).
    expect(a.hoursFreedPerMonth).not.toEqual(b.hoursFreedPerMonth);
    expect(a.assumptions.some((x) => x.origin === "assumed")).toBe(true);
    expect(a.note).toMatch(/jamais une garantie/i);
    results.push({ test: "estimation differs per company", a: a.hoursFreedPerMonth, b: b.hoursFreedPerMonth });
  });

  it("asks for what is missing instead of inventing an average", () => {
    const r = estimateWorkload({ peopleOnAdmin: null, hoursPerWeekPerPerson: null });
    expect(r.ok).toBe(false);
    expect(r.missing.length).toBeGreaterThan(0);
    expect(r.note).toMatch(/plutôt que d'inventer/i);
    results.push({ test: "estimation asks rather than invents", missing: r.missing.length });
  });

  it("never executes tools in shadow mode", () => {
    const shadow = executeGovernedTool({ toolId: "estimate_workload", args: {} }, { viewerIsAuthenticated: false, toolsEnabled: false });
    expect(shadow.executed).toBe(false);
    expect(shadow.refusedReason).toBe("tools_disabled");
    const unknown = executeGovernedTool({ toolId: "send_email", args: {} }, { viewerIsAuthenticated: true, toolsEnabled: true });
    expect(unknown.executed).toBe(false);
    expect(unknown.refusedReason).toBe("unknown_tool");
    results.push({ test: "tool governance", shadow: shadow.refusedReason, unknown: unknown.refusedReason });
  });

  it("emits a trace that explains the turn without leaking content", async () => {
    const port = scriptedPort(
      baseUnderstanding({ knowledge_needs: ["tarif"], questions_detected: ["le prix"] }),
      { answer: "Le tarif est de 449 € / mois.", citations: [] },
    );
    const r = await runCloneChatIntelligence(port, {
      turnId: "t4", message: "prix ?", history: [], viewer: PUBLIC_VIEWER,
      candidates: collectCandidateChunks({ question: "prix" }), serverCountry: "FR", at: AT, mode: "on",
    });
    const stages = r.trace.stages.map((s) => s.stage);
    expect(stages).toEqual(["understand", "retrieve", "reason", "executeGovernedTools", "compose", "verify"]);
    const serialized = JSON.stringify(r.trace);
    expect(serialized).not.toContain("prix ?");            // pas le message brut
    expect(serialized).not.toContain("449");               // pas le contenu des sources
    results.push({ test: "trace observable and clean", stages: stages.length });

    writeFileSync(`${OUT}/C1_9_RUNTIME_RESULTS.json`, JSON.stringify({
      artifact: "C1_9_RUNTIME_RESULTS", generatedAt: "2026-07-22",
      method: "Port modèle scripté, aucun réseau. Garanties structurelles uniquement.",
      results,
    }, null, 2));
  });
});
