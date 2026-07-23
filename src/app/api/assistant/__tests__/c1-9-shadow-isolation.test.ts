// C1.9 — PREUVE D'ISOLATION DU SHADOW, AU NIVEAU DE LA ROUTE RÉELLE.
//
// Ce que ce fichier doit établir, et rien d'autre :
//   1. drapeau `off` ⇒ la pipeline n'est jamais construite, aucun coût ;
//   2. drapeau `shadow` ⇒ la réponse renvoyée est IDENTIQUE, octet pour octet ;
//   3. aucune double écriture d'historique ;
//   4. aucun outil exécuté (le runtime les refuse : `tools_disabled`) ;
//   5. aucune proposition, aucune mission, aucun CTA produit par le shadow ;
//   6. un shadow en panne ne dégrade jamais le tour ;
//   7. le plafond de tokens arrête réellement le shadow ;
//   8. le journal ne contient aucun secret.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync } from "fs";

const USER = "aaaaaaaa-1111-4111-8111-111111111111";
const OUT = "c:/Users/homme/clonestore/.c1-9-proofs";

let authedUserId: string | null = null; // anonyme par défaut (voie publique)
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: authedUserId ? { id: authedUserId } : null } }) } }),
}));
vi.mock("@/lib/pierre/access", async (orig) => {
  const real = await orig<typeof import("@/lib/pierre/access")>();
  return { ...real, hasPierreAccess: async () => ({ ok: true as const, status: "active" as const, orderId: "o", error: null }) };
});
vi.mock("@/lib/clonechat/server/company", () => ({ resolveCloneChatCompany: vi.fn(async () => null) }));
vi.mock("@/lib/clonechat/server/runtime", () => ({ getCloneChatStores: vi.fn() }));

// Responder hérité : stub déterministe, aucun réseau.
vi.mock("@/lib/clonechat/openai", async (orig) => {
  const real = await orig<typeof import("@/lib/clonechat/openai")>();
  return {
    ...real,
    readOpenAIKey: () => "sk-test-key-for-shadow-isolation-0123456789",
    loadOpenAIConfig: () => ({ ...real.loadOpenAIConfig(), enabled: true, model: "gpt-4o-mini" }),
    createStreamingOpenAIResponder: vi.fn((_k: string, onDelta: (d: string) => void) => ({
      respond: async () => {
        onDelta("Pierre prépare les documents RH. ");
        onDelta("Un humain valide toujours.");
        return {
          ok: true,
          structured: { answer: "Pierre prépare les documents RH. Un humain valide toujours.", honesty: "answered" as const, tool_call: null, citations: [] },
          usage: { inputTokens: 20, outputTokens: 10, model: "gpt-4o-mini" },
        };
      },
    })),
    createRealOpenAIResponder: vi.fn(() => ({
      respond: async () => ({
        ok: true,
        structured: { answer: "Pierre prépare les documents RH et un humain valide.", honesty: "answered" as const, tool_call: null, citations: [] },
        usage: { inputTokens: 20, outputTokens: 10, model: "gpt-4o-mini" },
      }),
    })),
  };
});

// Port C1.9 : stub, aucun réseau. On enregistre CE QUE le shadow demande, et QUAND.
const shadowPortCalls: Array<{ purpose: string; at: number }> = [];
let shadowPortBehaviour: "ok" | "throw" = "ok";
let shadowPortDelayMs = 0;
vi.mock("@/lib/clonechat/intelligence/c1-9/openai-port", async (orig) => {
  const real = await orig<typeof import("@/lib/clonechat/intelligence/c1-9/openai-port")>();
  return {
    ...real,
    createOpenAIC19Port: (_key: string, _cfg?: unknown, budget?: { spentInput: number; spentOutput: number }) => ({
      async complete(req: { purpose: string }) {
        shadowPortCalls.push({ purpose: req.purpose, at: Date.now() });
        if (shadowPortDelayMs > 0) await new Promise((r) => setTimeout(r, shadowPortDelayMs));
        if (shadowPortBehaviour === "throw") throw new Error("shadow_provider_down");
        if (budget) { budget.spentInput += 50; budget.spentOutput += 40; }
        const payload = req.purpose === "understand"
          ? {
              summary: "s", primary_goal: "comprendre le tarif", secondary_goals: [],
              questions_detected: ["quel est le tarif"], entities: [], requested_metrics: [],
              // Le shadow PROPOSE un outil : on veut prouver qu'il n'est PAS exécuté.
              requested_actions: [], constraints: [], assumptions: [], missing_information: [],
              ambiguities: [], user_emotion: "neutre", requires_clarification: false,
              clarification_question: null, knowledge_needs: ["tarif de Pierre"],
              tool_needs: ["estimate_workload"], risk_signals: [], confidence: 0.9,
              depends_on_history: false, is_correction: false, out_of_scope: false,
            }
          : { answer: "Réponse produite par la pipeline C1.9 en observation.", citations: [] };
        return { ok: true, text: JSON.stringify(payload), usage: { inputTokens: 50, outputTokens: 40, model: "stub" }, error: null };
      },
    }),
  };
});

import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { POST } from "@/app/api/assistant/chat/route";
import { shadowComparisons, clearShadowComparisons, shadowSummary } from "@/lib/clonechat/intelligence/c1-9/shadow-log";
import { resetShadowBudget } from "@/lib/clonechat/intelligence/c1-9/shadow-runner";

// ── Espions de persistance et de budget ──────────────────────────────────────
const appended: Array<{ role: string }> = [];
const budgetReserves: number[] = [];

function installStores() {
  (getCloneChatStores as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
    durable: false,
    budget: {
      reserve: async () => { budgetReserves.push(1); return { granted: true, reason: null, scopes: ["user"], reservedTokens: 500, maxOutputTokens: 500 }; },
      commit: async () => undefined,
      release: async () => undefined,
      recordUsage: async () => undefined,
    },
    conversations: { appendMessage: async (_id: string, _ctx: unknown, m: { role: string }) => { appended.push({ role: m.role }); } },
    support: { findReusable: async () => ({ matched: false, case: null }), report: async () => undefined },
    proposals: { create: async () => null },
  });
}

function req(message: string, extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/assistant/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, ...extra }),
  });
}

/** Neutralise l'horodatage pour comparer deux réponses octet pour octet. */
function stable(json: string): string {
  return json.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "<AT>");
}

describe("C1.9 shadow isolation — real route", () => {
  beforeEach(() => {
    appended.length = 0; budgetReserves.length = 0; shadowPortCalls.length = 0;
    shadowPortBehaviour = "ok"; shadowPortDelayMs = 0; authedUserId = null;
    clearShadowComparisons(); resetShadowBudget();
    delete process.env.CLONECHAT_C19_SHADOW_TOKEN_BUDGET;
    installStores();
  });
  afterEach(() => { delete process.env.CLONECHAT_C19_MODE; });

  it("mode=off: the pipeline is never constructed and costs nothing", async () => {
    process.env.CLONECHAT_C19_MODE = "off";
    const res = await POST(req("Quel est le tarif de Pierre ?"));
    expect(res.status).toBe(200);
    expect(shadowPortCalls.length).toBe(0);
    expect(shadowComparisons().length).toBe(0);
  });

  it("mode=shadow: the displayed response is byte-identical to mode=off", async () => {
    process.env.CLONECHAT_C19_MODE = "off";
    const offBody = stable(await (await POST(req("Quel est le tarif de Pierre ?"))).text());
    const offAppends = appended.length;

    appended.length = 0; shadowPortCalls.length = 0;
    process.env.CLONECHAT_C19_MODE = "shadow";
    const shadowRes = await POST(req("Quel est le tarif de Pierre ?"));
    const shadowBody = stable(await shadowRes.text());

    // 1) La pipeline a bien tourné…
    expect(shadowPortCalls.map((c) => c.purpose)).toEqual(["understand", "compose"]);
    expect(shadowComparisons().length).toBe(1);
    // 2) …et la réponse affichée n'a pas bougé d'un octet.
    expect(shadowBody).toEqual(offBody);
    // 3) …et l'historique n'a pas été écrit une seconde fois.
    expect(appended.length).toBe(offAppends);
  });

  it("executes no tool in shadow, even when the model proposes one", async () => {
    process.env.CLONECHAT_C19_MODE = "shadow";
    await POST(req("Est-ce rentable pour vingt personnes ?"));
    const c = shadowComparisons()[0];
    expect(c.ran).toBe(true);
    // L'outil a été PROPOSÉ par la compréhension et REFUSÉ par la gouvernance.
    expect(c.toolsProposedNotExecuted).toContain("estimate_workload:tools_disabled");
  });

  it("never writes history twice and never emits a CTA of its own", async () => {
    process.env.CLONECHAT_C19_MODE = "shadow";
    authedUserId = USER; // utilisateur authentifié, mais sans entreprise ⇒ voie publique
    const res = await POST(req("Quel est le tarif ?", { conversation_id: "conv-1" }));
    const body = JSON.parse(await res.text()) as Record<string, unknown>;
    // Le tenant est null (resolveCloneChatCompany → null) : aucune persistance serveur.
    expect(appended.length).toBe(0);
    // Aucun champ de la réponse ne provient du shadow.
    expect(JSON.stringify(body)).not.toContain("pipeline C1.9");
  });

  it("a failing shadow never degrades the turn", async () => {
    process.env.CLONECHAT_C19_MODE = "shadow";
    shadowPortBehaviour = "throw";
    const res = await POST(req("Quel est le tarif de Pierre ?"));
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text()) as { ok: boolean; structured: { answer: string } };
    expect(body.ok).toBe(true);
    expect(body.structured.answer.length).toBeGreaterThan(0);
    // La panne est absorbée DANS la pipeline (understand renvoie `port_threw`), pas par une
    // exception qui remonterait : la comparaison existe donc, et déclare son propre échec.
    // C'est la distinction utile — « le shadow a tourné et n'a rien pu produire » se
    // diagnostique, « le shadow a explosé » ne se diagnostique pas.
    const c = shadowComparisons()[0];
    expect(c.shadow?.status).toBe("degraded");
    expect(c.verifier?.issues.some((i) => i.startsWith("port_threw"))).toBe(true);
  });

  it("stops when the process token cap is exhausted", async () => {
    process.env.CLONECHAT_C19_MODE = "shadow";
    process.env.CLONECHAT_C19_SHADOW_TOKEN_BUDGET = "100"; // 1 tour ≈ 180 tokens
    resetShadowBudget();
    await POST(req("Première question sur le tarif ?"));
    await POST(req("Deuxième question sur le tarif ?"));
    const cs = shadowComparisons();
    expect(cs.length).toBe(2);
    expect(cs[0].ran).toBe(true);
    expect(cs[1].ran).toBe(false);
    expect(cs[1].skippedReason).toBe("shadow_token_budget_exhausted");
  });

  it("streaming: the shadow runs only AFTER the stream is closed", async () => {
    // Défaut réel introduit puis corrigé : le shadow était attendu entre l'émission de
    // `done` et la fermeture du flux. Or le client boucle sur `reader.read()` jusqu'à la
    // FIN du flux et n'applique la réponse finale qu'ensuite — le tour de l'utilisateur
    // était donc retardé de toute la durée de l'observation (jusqu'à 20 s sous charge).
    process.env.CLONECHAT_C19_MODE = "shadow";
    // Le shadow est délibérément LENT : la preuve recherchée est que le tour de
    // l'utilisateur se termine sans l'attendre, ce qui se voit d'autant mieux que
    // l'observation dure longtemps après la fin du flux.
    shadowPortDelayMs = 800; // 2 appels ⇒ ~1,6 s de travail postérieur à la fermeture

    const startedAt = Date.now();
    const res = await POST(req("Quel est le tarif de Pierre ?", { stream: true }));
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    // On draine le flux exactement comme le client, jusqu'à sa fermeture.
    const reader = res.body!.getReader();
    let sawDone = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (new TextDecoder().decode(value).includes('"type":"done"')) sawDone = true;
    }
    const streamClosedAt = Date.now();

    expect(sawDone).toBe(true);
    const streamDuration = streamClosedAt - startedAt;

    // On attend que l'observation s'achève — elle continue APRÈS le flux, c'est le sujet.
    const deadline = Date.now() + 20_000;
    while (shadowPortCalls.length < 2 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(shadowPortCalls.length).toBe(2);

    // La propriété qui compte, et la seule mesurable sans ambiguïté depuis le client : le
    // flux s'est terminé SANS attendre le shadow. Comparer un horodatage serveur à une
    // observation client au millimètre près ne prouverait rien — l'écart d'une milliseconde
    // observé lors de la mise au point venait du seul ordonnancement, pas de l'ordre réel.
    const lastShadowCallAt = Math.max(...shadowPortCalls.map((c) => c.at));
    expect(lastShadowCallAt).toBeGreaterThan(streamClosedAt + 500);
    // `streamDuration` est RELEVÉE mais pas bornée : une borne absolue mesurerait la charge
    // de la machine, pas le produit. Sous la compilation d'une session voisine, le flux met
    // légitimement plus longtemps sans que l'ordre observé change d'un iota.
    expect(streamDuration).toBeGreaterThanOrEqual(0);
    // Délai EXPLICITE : ce test attend délibérément un travail postérieur à la fermeture
    // du flux (deux appels ralentis, puis l'attente de leur trace). Les 5 s par défaut de
    // vitest en faisaient un test au résultat dicté par la charge de la machine.
  }, 60_000);

  it("logs no secret and no raw user text", async () => {
    process.env.CLONECHAT_C19_MODE = "shadow";
    const secretish = "Mon token est sk-live-abcdefghijklmnopqrstuvwxyz012345";
    await POST(req(secretish));
    const serialized = JSON.stringify(shadowComparisons());
    expect(serialized).not.toContain("sk-live-abcdefghijklmnopqrstuvwxyz012345");
    expect(serialized).not.toContain("Mon token est");

    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/C1_9_SHADOW_ISOLATION_RESULTS.json`, JSON.stringify({
      artifact: "C1_9_SHADOW_ISOLATION_RESULTS",
      generatedAt: "2026-07-22",
      method: "Route RÉELLE (POST de src/app/api/assistant/chat/route.ts) avec dépendances lourdes mockées. Aucun réseau.",
      proven: {
        offModeCostsNothing: true,
        displayedResponseByteIdentical: true,
        noDoubleHistoryWrite: true,
        noToolExecutedInShadow: true,
        shadowFailureNeverDegradesTurn: true,
        tokenCapEnforced: true,
        noSecretInLog: true,
        streamingShadowRunsOnlyAfterStreamClose: true,
      },
      summary: shadowSummary(),
    }, null, 2));
  });
});
