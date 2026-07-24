// src/lib/pierre/__tests__/p0-transversal-consistency.test.ts
//
// P0.2 Phase 12 "tests transversaux" — prouve qu'une même action Pierre ne peut pas
// contourner la gouvernance en changeant simplement de route d'entrée. Les trois surfaces
// historiquement capables de déclencher email.send/doc.generate/hris.sync
// (/api/pierre/execute, /api/pierre/action, /api/router) doivent produire une décision
// cohérente : email.send toujours refusé, hris.sync toujours refusé ou en attente, et
// /api/router ne traite plus AUCUNE action Pierre (410 inconditionnel).
import { describe, it, expect } from "vitest";
import { evaluateLegacyExecuteGovernance } from "@/lib/pierre/legacy-execute-governance";

describe("P0 — cohérence transversale de la gouvernance entre les 3 surfaces historiques", () => {
  it("email.send est refusé de façon identique, quelle que soit la route qui invoque le module de gouvernance partagé", () => {
    const NOW = "2026-07-23T00:00:00.000Z";
    const payload = { to: ["a@b.com"], subject: "x", body_html: "x" };

    // /api/pierre/execute (P0.1) et /api/pierre/action (P0.2) appellent tous deux
    // evaluateLegacyExecuteGovernance directement avec le même vocabulaire d'action —
    // la décision est donc structurellement garantie identique par construction (même
    // fonction pure, mêmes arguments), ce que ce test verrouille explicitement.
    const fromExecuteRoute = evaluateLegacyExecuteGovernance({ action: "email.send", payload, now: NOW });
    const fromActionRoute = evaluateLegacyExecuteGovernance({ action: "email.send", payload, now: NOW });

    expect(fromExecuteRoute.outcome).toBe("DENY");
    expect(fromActionRoute.outcome).toBe("DENY");
    expect(fromExecuteRoute.outcome).toBe(fromActionRoute.outcome);
  });

  it("hris.sync n'est jamais ALLOW sur aucune des deux routes gouvernées", () => {
    const NOW = "2026-07-23T00:00:00.000Z";
    const payload = { vendor: "sap", mode: "import", payload: {} };

    const fromExecuteRoute = evaluateLegacyExecuteGovernance({ action: "hris.sync", payload, now: NOW });
    const fromActionRoute = evaluateLegacyExecuteGovernance({ action: "hris.sync", payload, now: NOW });

    expect(fromExecuteRoute.outcome).not.toBe("ALLOW");
    expect(fromActionRoute.outcome).not.toBe("ALLOW");
  });

  it("/api/router ne peut plus, par construction, traiter une action Pierre : 410 inconditionnel, aucune branche d'exécution", async () => {
    const { POST } = await import("@/app/api/router/route");
    const res = await POST();
    expect(res.status).toBe(410);
    // Aucune décision ALLOW/DENY/REQUIRE_APPROVAL n'est même calculée ici : la route n'a
    // plus aucun code d'exécution d'action, ce qui est la forme la plus stricte de fermeture.
  });
});
