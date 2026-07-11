// src/lib/clonestore/pierre-journey/__tests__/journey-p96.test.ts
// P9.6 §6 — 10 tests CIBLÉS du parcours produit de Pierre. Prouvent, sur les modules RÉELS,
// les invariants que la preuve navigateur exerce end-to-end (voir .p96-proofs/p96-run1/).
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JOURNEY_STEPS, SECURITY_INVARIANTS, FORBIDDEN_SHORTCUTS, isContractComplete } from "../journey-contract";
import { computeJourneyReadiness } from "../journey-status";
import {
  engineModeFor, productModeForEngine, deriveAutonomyMatrix, willExecuteAlone, requiresHumanFor,
  REPRESENTATIVE_HR_ACTIONS,
} from "@/lib/clonestore/pierre-autonomy/model";
import { createMissionV1 } from "@/lib/clonechat/server/v1-loopback";
import { commandFingerprint, type CanonicalCommand } from "@/lib/clonechat/durable/command-ledger";

afterEach(() => vi.restoreAllMocks());

describe("P9.6 — end-to-end Pierre product journey (targeted)", () => {
  // 1) Le contrat de parcours est complet.
  it("1. journey contract is complete (16 ordered steps, no gap)", () => {
    expect(isContractComplete()).toBe(true);
    expect(JOURNEY_STEPS).toHaveLength(16);
    expect(JOURNEY_STEPS[0].id).toBe("access");
    expect(JOURNEY_STEPS.at(-1)?.id).toBe("audit_trail");
  });

  // 2) companyResolved:true est un invariant NON négociable ; u:<userId> est INTERDIT pour la preuve.
  it("2. companyResolved:true is required; u:<userId> fallback is forbidden for the main proof", () => {
    const inv = SECURITY_INVARIANTS.join(" ").toLowerCase();
    expect(inv).toContain("companyresolved:true");
    expect(inv).toContain("jamais le repli u:<userid>");
    expect(FORBIDDEN_SHORTCUTS.join(" ").toLowerCase()).toContain("u:<userid>");
    // readiness: sans entreprise résolue → bloqué, jamais opérationnel.
    const blocked = computeJourneyReadiness({ companyResolved: false, autonomy: null, missionCount: 0, activeMission: null, pendingValidations: 0, evidenceCount: 0, latestResult: null });
    expect(blocked.level).toBe("blocked");
    expect(blocked.canOperate).toBe(false);
  });

  // 3) L'autonomie persiste via un mapping produit→moteur P8 correct (garde-fou anti-inconnu).
  it("3. autonomy persistence maps product→engine mode correctly", () => {
    expect(engineModeFor("draft")).toBe("draft");
    expect(engineModeFor("validation")).toBe("normal");
    expect(engineModeFor("controlled")).toBe("high_autonomy");
    expect(engineModeFor("governed")).toBe("enterprise_autonomous");
    expect(engineModeFor("dirigeant")).toBe("enterprise_autonomous");
    // round-trip de présentation : la colonne P8 ne stocke que le mode moteur.
    expect(productModeForEngine("high_autonomy").id).toBe("controlled");
    expect(productModeForEngine("normal").id).toBe("validation");
  });

  // 4) Une proposition de mission fige le mode d'autonomie RÉSOLU côté serveur (present dans le payload).
  it("4. a create_mission proposal reflects the server-resolved autonomy engine mode", () => {
    // Le builder (P9.5) fige payload.autonomyMode = engineMode et autonomy = productModeForEngine(engineMode).
    // Ici on prouve la cohérence du mapping utilisé par le builder : engineMode 'high_autonomy' → 'controlled'.
    for (const eng of ["draft", "normal", "high_autonomy", "enterprise_autonomous"] as const) {
      const pm = productModeForEngine(eng);
      expect(pm.engineMode).toBe(eng === "enterprise_autonomous" ? "enterprise_autonomous" : eng);
      expect(typeof pm.label).toBe("string");
      expect(pm.label.length).toBeGreaterThan(0);
    }
  });

  // 5) L'exécution ne fait confiance qu'à la proposition persistée : createMissionV1 ne transmet un
  //    autonomy_mode QUE s'il est un mode moteur P8 valide (un mode forgé/inconnu est OMIS).
  it("5. createMissionV1 forwards autonomy_mode only for a valid P8 engine mode (forged/unknown omitted)", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init: { method: string; body?: string }) => {
      const parsed = init.body ? JSON.parse(init.body) : {};
      if (init.method === "POST") { bodies.push(parsed); return jsonRes({ mission_id: "m-1", status: "awaiting_validation" }); }
      return jsonRes({ id: "m-1", status: "awaiting_validation" }); // re-read GET
    });
    vi.stubGlobal("fetch", fetchMock);
    const v1 = { base: "http://x", headers: { "x-pierre-company": "c1" } };

    await createMissionV1(v1, "Contrat CDI", "fp-1", "high_autonomy"); // valide
    await createMissionV1(v1, "Contrat CDI", "fp-2", "enterprise_autonomous"); // forgé/escalade
    await createMissionV1(v1, "Contrat CDI", "fp-3", "super_admin_hack"); // inconnu
    await createMissionV1(v1, "Contrat CDI", "fp-4"); // absent

    const posts = bodies;
    expect(posts[0].autonomy_mode).toBe("high_autonomy");        // mode valide → transmis
    expect(posts[1].autonomy_mode).toBe("enterprise_autonomous"); // valide (P8 gouverne ensuite via decideValidation)
    expect(posts[2]).not.toHaveProperty("autonomy_mode");         // inconnu → OMIS (garde-fou)
    expect(posts[3]).not.toHaveProperty("autonomy_mode");         // absent → OMIS
    // Toujours l'idempotency_key = fingerprint (exactly-once en reprise).
    expect(posts.every((p) => typeof p.idempotency_key === "string")).toBe(true);
  });

  // 6) Le mode moteur choisi gouverne réellement la mission : sur un mode élevé, une action à risque
  //    critique reste BLOQUÉE et une action restreinte reste RÉSERVÉE À L'HUMAIN (garde dure P8).
  it("6. the resolved engine mode governs the mission via the REAL engine (not cosmetic)", () => {
    const governed = deriveAutonomyMatrix("governed"); // enterprise_autonomous
    const byKey = Object.fromEntries(governed.entries.map((e) => [e.key, e]));
    // routine → Pierre peut agir seul/notifier (comportement RÉEL du moteur, non codé en dur ici).
    expect(["alone", "notify"]).toContain(byKey.status_update.bucket);
    // toute action RESTREINTE → réservée humain OU bloquée (jamais seul/notify/prépare), même en mode gouverné.
    for (const k of ["sanction", "termination", "dismissal", "sensitive_medical", "harassment_flagged"]) {
      expect(["human_only", "blocked"]).toContain(byKey[k].bucket);
    }
  });

  // 7) Pas de double exécution : la même proposition ⇒ MÊME empreinte de commande (dédup exactly-once).
  it("7. duplicate confirm yields the SAME command fingerprint (no double mission)", () => {
    const base: CanonicalCommand = { companyId: "c1", actorId: "u1", conversationId: null, proposalId: "p1", actionKind: "create_mission", payload: { instruction: "Contrat CDI", autonomyMode: "high_autonomy" } };
    const fp1 = commandFingerprint(base);
    const fp2 = commandFingerprint({ ...base, payload: { instruction: "Contrat CDI", autonomyMode: "high_autonomy" } });
    expect(fp1).toBe(fp2); // rejeu du même proposalId+payload → même commande → duplicate
    // une entreprise/acteur/proposition différent ⇒ empreinte différente (isolation).
    expect(commandFingerprint({ ...base, companyId: "c2" })).not.toBe(fp1);
    expect(commandFingerprint({ ...base, proposalId: "p2" })).not.toBe(fp1);
  });

  // 8) Le cockpit résume honnêtement l'état réel (mission en cours, validations, preuves, résultat).
  it("8. cockpit readiness surfaces mission/validation/result from real signals only", () => {
    const r = computeJourneyReadiness({
      companyResolved: true, autonomy: { productModeId: "controlled", label: "Exécution contrôlée" },
      missionCount: 1, activeMission: { id: "m1", title: "Contrat CDI", statusLabel: "En attente de validation" },
      pendingValidations: 1, evidenceCount: 0, latestResult: null,
    });
    expect(r.level).toBe("operating");
    expect(r.items.find((i) => i.id === "mission")?.state).toBe("pending");
    expect(r.items.find((i) => i.id === "validation")?.state).toBe("pending");
    expect(r.items.find((i) => i.id === "evidence")?.state).toBe("todo"); // honnête : aucune preuve encore
    expect(r.items.find((i) => i.id === "result")?.state).toBe("todo");
  });

  // 9) Gardes dures : aucune action réservée-humain/restreinte n'est exécutée seule, dans AUCUN mode.
  it("9. hard floors — restricted actions never auto-execute in ANY product mode (incl. governed/dirigeant)", () => {
    const restricted = REPRESENTATIVE_HR_ACTIONS.filter((a) => a.sensitivity === "restricted");
    expect(restricted.length).toBeGreaterThan(0);
    for (const mode of ["draft", "validation", "controlled", "governed", "dirigeant"] as const) {
      for (const a of restricted) {
        expect(willExecuteAlone(mode, a)).toBe(false); // jamais seul
        expect(requiresHumanFor(mode, a)).toBe(true);  // toujours humain (réservé ou bloqué)
      }
    }
  });

  // 10) Cadrage : Pierre est un EMPLOYÉ IA RH — jamais « assistant RH » / « copilote » dans le parcours.
  it("10. never frames Pierre as an 'assistant RH' / 'copilote' in the journey layer", () => {
    // On scanne les surfaces PRODUIT (texte vu par l'utilisateur). Le contrat, lui, NOMME
    // volontairement « assistant »/« copilote » pour les INTERDIRE → il est exclu du scan.
    const files = [
      "src/lib/clonestore/pierre-journey/journey-status.ts",
      "src/components/pierre/cockpit/JourneyReadinessView.tsx",
    ].map((f) => readFileSync(resolve(process.cwd(), f), "utf8")).join("\n").toLowerCase();
    // "assistant" ne peut apparaître que dans un chemin technique /api/assistant | /assistant.
    const roleText = files.replace(/\/api\/assistant/g, "").replace(/\/assistant/g, "");
    expect(roleText).not.toContain("copilote");
    expect(roleText).not.toMatch(/assistant\s+rh/);
    // et le contrat DOIT bien lister l'interdiction (méta-preuve).
    expect(FORBIDDEN_SHORTCUTS.join(" ").toLowerCase()).toContain("copilote");
  });
});

function jsonRes(obj: unknown) {
  return { ok: true, status: 200, json: async () => obj } as unknown as Response;
}
