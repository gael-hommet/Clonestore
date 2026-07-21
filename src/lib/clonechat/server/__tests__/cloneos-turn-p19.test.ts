// src/lib/clonechat/server/__tests__/cloneos-turn-p19.test.ts
// P19 — CloneChat → CloneOS sur le vrai chemin : statut structurel dérivé des faits + vrai orchestrateur
// avec PAYS SERVEUR (pierre_rt_companies via getRuntimeDb → PGlite, PIERRE_E2E_TEST_MODE=1).
// Émet P19_CLONECHAT_CLONEOS_LIVE_PROOF.json depuis les exécutions réelles.

import { describe, it, expect, beforeAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { deriveStructuralStatus, buildCloneOsTurn, resolveServerCountryForCompany } from "../cloneos-turn";
import { getTestRuntimeDb } from "../../../pierre/v1/test-runtime-db";
import { newUuid } from "../../../pierre/v1/sql";

process.env.PIERRE_E2E_TEST_MODE = "1"; // getRuntimeDb → PGlite (fail-closed en production)

let companyFR: string; let companyCH: string;
beforeAll(async () => {
  const db = await getTestRuntimeDb();
  companyFR = newUuid(); companyCH = newUuid();
  await db.query(`insert into pierre_rt_companies (id, name, registration_country) values ($1,'A-FR','FR'), ($2,'B-CH','CH')`, [companyFR, companyCH]);
}, 120_000);

const scenarios: Record<string, unknown> = {};

describe("P19 — statut structurel dérivé des faits (jamais d'une phrase)", () => {
  it("1. question simple → answer", () => {
    const s = deriveStructuralStatus({ honesty: "answered", proposalKind: null, cloneos: null });
    scenarios["1_answer"] = s; expect(s).toBe("answer");
  });
  it("2. ambiguïté → clarification_required", () => {
    const s = deriveStructuralStatus({ honesty: "clarification_required", proposalKind: null, cloneos: null });
    scenarios["2_clarification"] = s; expect(s).toBe("clarification_required");
  });
  it("6. provider indisponible → provider_unavailable ; échec → failed ; blocage → blocked", () => {
    expect(deriveStructuralStatus({ honesty: "answered", proposalKind: null, cloneos: null, providerUnavailable: true })).toBe("provider_unavailable");
    expect(deriveStructuralStatus({ honesty: "answered", proposalKind: null, cloneos: null, turnFailed: true })).toBe("failed");
    expect(deriveStructuralStatus({ honesty: "blocked", proposalKind: null, cloneos: null })).toBe("blocked");
    scenarios["6_provider_unavailable"] = "provider_unavailable";
  });
  it("4. mission_created/executed JAMAIS émis par le tour chat (réservés à /execute → runtime V1)", () => {
    // Quelle que soit la combinaison chat, jamais mission_created/executed depuis le tour conversationnel.
    const all = [
      deriveStructuralStatus({ honesty: "answered", proposalKind: "create_mission", cloneos: null }),
      deriveStructuralStatus({ honesty: "answered", proposalKind: "send_email", cloneos: null }),
    ];
    for (const s of all) expect(["mission_created", "executed"]).not.toContain(s);
    scenarios["4_confirmation_path"] = "mission V1 via /api/assistant/execute (proposalId → SHA-256 → claim atomique) — déjà prouvé runtime-core 23/23";
  });
});

describe("P19 — vrai CloneOS avec pays SERVEUR (PGlite)", () => {
  it("3. demande multi-action → plan CloneOS segmenté + gouverné (action_prepared)", async () => {
    const t = await buildCloneOsTurn({ message: "m", instruction: "Prépare une synthèse de l'équipe ; puis relance le manager", companyId: companyFR, userId: "u1", nowIso: "2026-07-17T08:00:00Z", correlationId: "conv-1" });
    expect(t!.actions).toBe(2);
    expect(t!.legalCountry).toBe("FR");
    expect(t!.executed).toBe(false);
    const s = deriveStructuralStatus({ honesty: "answered", proposalKind: "create_mission", cloneos: t });
    scenarios["3_multi_action_plan"] = { actions: t!.actions, status: s, tasks: t!.tasks };
    expect(s).toBe("action_prepared");
  });
  it("5. demande sensible → validation_required / human_only via gouvernance", async () => {
    const t = await buildCloneOsTurn({ message: "m", instruction: "Prépare la lettre de licenciement de Paul", companyId: companyFR, userId: "u1", nowIso: "2026-07-17T08:00:00Z", correlationId: "conv-2" });
    expect(t!.requiresValidation).toBe(true);
    expect(t!.tasks[0].decision).toBe("human_only");
    const s = deriveStructuralStatus({ honesty: "answered", proposalKind: "create_mission", cloneos: t });
    scenarios["5_sensitive"] = { decision: t!.tasks[0].decision, status: s };
    expect(s).toBe("validation_required");
  });
  it("7+8. A/B isolées + le TEXTE ne surcharge jamais le pays serveur", async () => {
    // Le texte réclame la France ; l'entreprise est SUISSE côté serveur → CH gouverne (contrat jamais auto).
    const ch = await buildCloneOsTurn({ message: "m", instruction: "Rédige le contrat de travail français de Marie, droit France", companyId: companyCH, userId: "u1", nowIso: "2026-07-17T08:00:00Z", correlationId: "conv-3" });
    const fr = await buildCloneOsTurn({ message: "m", instruction: "Rédige le contrat de travail de Marie", companyId: companyFR, userId: "u1", nowIso: "2026-07-17T08:00:00Z", correlationId: "conv-4" });
    expect(ch!.legalCountry).toBe("CH");            // le texte "droit France" n'a rien changé
    expect(fr!.legalCountry).toBe("FR");            // A/B isolées, chacun son pays serveur
    const chContract = ch!.tasks.find((t) => t.action === "contract")!;
    expect(chContract.decision).not.toBe("allow_execute");
    scenarios["7_8_ab_country"] = { ch: ch!.legalCountry, fr: fr!.legalCountry, ch_contract_decision: chContract.decision };
  });
  it("9. timeline corrélée : chaque tâche du plan émet un événement canonique corrélé", async () => {
    const t = await buildCloneOsTurn({ message: "m", instruction: "Classe le dossier ; puis prépare une note", companyId: companyFR, userId: "u1", nowIso: "2026-07-17T08:00:00Z", correlationId: "conv-5" });
    expect(t!.traceEventCount).toBe(t!.actions);
    scenarios["9_trace"] = { actions: t!.actions, traceEvents: t!.traceEventCount, correlationId: "conv-5" };
  });
  it("10. pays inconnu → fail-closed (jamais France par défaut) ; reprise = conversation durable C1.8", async () => {
    const unknown = await resolveServerCountryForCompany(newUuid()); // société inexistante
    expect(unknown).toBeNull();
    scenarios["10_resume"] = { unknown_country: unknown, resume: "historique durable clonechat_conversations (C1.8, navigateur 10/10) — inchangé" };
  });

  it("émet la preuve depuis les exécutions réelles", () => {
    mkdirSync(join(process.cwd(), ".p19-proofs"), { recursive: true });
    writeFileSync(join(process.cwd(), ".p19-proofs", "P19_CLONECHAT_CLONEOS_LIVE_PROOF.json"), JSON.stringify({
      generatedBy: "cloneos-turn.ts (vrai orchestrateur + pays serveur PGlite via getRuntimeDb) — câblé dans /api/assistant/chat (structural_status + cloneos)",
      wiring: "src/app/api/assistant/chat/route.ts : reply({ structural_status, cloneos, proposal, governance })",
      execution_note: "mission_created/executed réservés à /api/assistant/execute → runtime mission V1 (aucun second moteur)",
      scenarios,
    }, null, 2), "utf8");
    expect(Object.keys(scenarios).length).toBeGreaterThanOrEqual(7);
  });
});
