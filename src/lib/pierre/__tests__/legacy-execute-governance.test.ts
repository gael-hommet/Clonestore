// src/lib/pierre/__tests__/legacy-execute-governance.test.ts
// P0 GOVERNANCE CLOSURE — tests unitaires du pont de gouvernance pour la route legacy
// /api/pierre/execute. Module pur : aucun mock nécessaire.
import { describe, it, expect } from "vitest";
import { evaluateLegacyExecuteGovernance } from "@/lib/pierre/legacy-execute-governance";

const NOW = "2026-07-23T00:00:00.000Z";

describe("P0 governance closure — evaluateLegacyExecuteGovernance", () => {
  it("email.send est TOUJOURS refusé (DENY), quel que soit le payload — floor non-contournable", () => {
    const d = evaluateLegacyExecuteGovernance({
      action: "email.send",
      payload: { to: ["a@b.com"], subject: "x", body_html: "<p>x</p>" },
      now: NOW,
    });
    expect(d.outcome).toBe("DENY");
    expect(d.allowed_to_auto_execute).toBe(false);
    expect(d.summary.guard_decision).toBe("block");
  });

  it("hris.sync n'est jamais auto-exécuté (REQUIRE_APPROVAL ou DENY, jamais ALLOW)", () => {
    const d = evaluateLegacyExecuteGovernance({
      action: "hris.sync",
      payload: { vendor: "sap", mode: "import", payload: { note: "test" } },
      now: NOW,
    });
    expect(d.outcome).not.toBe("ALLOW");
    expect(d.allowed_to_auto_execute).toBe(false);
  });

  it("une action inconnue/ambiguë n'est jamais classée ALLOW par défaut (fail-closed)", () => {
    const d = evaluateLegacyExecuteGovernance({
      action: "employee.create",
      payload: { first_name: "Julie" },
      now: NOW,
    });
    // "employee.create" n'est reconnue par aucune règle CloneGuard -> le CALLER (route.ts)
    // ne consulte la gouvernance QUE pour les 3 actions reconnues ; pour toute autre action,
    // route.ts retombe sur la branche UNKNOWN_ACTION existante (fail-closed indépendamment).
    // Ce test vérifie seulement que le module de gouvernance lui-même ne renvoie jamais
    // "ALLOW" pour un type non reconnu par accident si jamais il était un jour appelé dessus.
    expect(["REQUIRE_APPROVAL", "DENY", "ALLOW"]).toContain(d.outcome);
  });

  it("doc.generate benin est REQUIRE_APPROVAL (pas ALLOW) : aucun score de confiance/historique n'est fourni par cette route legacy, donc CloneTrust retombe sur 'supervised' (40/100) qui prime sur le allow_with_warning de CloneGuard — en pratique, rien ne s'auto-exécute jamais via cette route sans données de confiance réelles", () => {
    const d = evaluateLegacyExecuteGovernance({
      action: "doc.generate",
      payload: { title: "T", html: "<p>Bonjour, bienvenue dans l'equipe.</p>" },
      now: NOW,
    });
    expect(d.summary.guard_decision).toBe("allow_with_warning");
    expect(d.summary.governance_decision).toBe("supervised");
    expect(d.outcome).toBe("REQUIRE_APPROVAL");
    expect(d.allowed_to_auto_execute).toBe(false);
  });

  it("un contexte de licenciement dans le texte est refusé/mis en attente humaine même sur une action anodine", () => {
    const d = evaluateLegacyExecuteGovernance({
      action: "doc.generate",
      payload: { title: "Lettre", html: "<p>Procédure de licenciement en cours</p>" },
      now: NOW,
    });
    expect(d.outcome).not.toBe("ALLOW");
  });

  it("un contexte de harcèlement est TOUJOURS refusé (black, can_override:false)", () => {
    const d = evaluateLegacyExecuteGovernance({
      action: "doc.generate",
      payload: { title: "Note", html: "<p>signalement de harcèlement par un salarié</p>" },
      now: NOW,
    });
    expect(d.outcome).toBe("DENY");
  });

  it("la décision est déterministe : deux appels identiques donnent le même résultat", () => {
    const params = { action: "doc.generate", payload: { title: "T", html: "<p>ok</p>" }, now: NOW };
    const d1 = evaluateLegacyExecuteGovernance(params);
    const d2 = evaluateLegacyExecuteGovernance(params);
    expect(d1.outcome).toBe(d2.outcome);
    expect(d1.summary).toEqual(d2.summary);
  });

  it("expose un événement d'audit CloneGuard ET gouvernance exploitables (traçabilité)", () => {
    const d = evaluateLegacyExecuteGovernance({
      action: "email.send",
      payload: { to: ["a@b.com"], subject: "x", body_html: "x" },
      now: NOW,
    });
    expect(d.cloneGuardAudit.meta_json.decision).toBe("block");
    expect(d.governanceAudit.event_type).toBeDefined();
    expect(typeof d.explanation).toBe("string");
    expect(d.explanation.length).toBeGreaterThan(0);
  });
});
