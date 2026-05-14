import { describe, expect, it } from "vitest";

import {
  detectPierreApprovalRequired,
  detectPierreRiskLevel,
} from "@/lib/pierre/mission/risk";

describe("Pierre risk", () => {
  it("détecte un risque high sur licenciement", () => {
    const risk = detectPierreRiskLevel(
      "Prépare un courrier de licenciement"
    );

    expect(risk).toBe("high");
  });

  it("détecte un risque medium sur convocation", () => {
    const risk = detectPierreRiskLevel(
      "Prépare une convocation RH"
    );

    expect(risk).toBe("medium");
  });

  it("détecte un risque low sur une demande simple", () => {
    const risk = detectPierreRiskLevel(
      "Prépare une note RH interne"
    );

    expect(risk).toBe("low");
  });

  it("force approval_required si risque high", () => {
    const approval = detectPierreApprovalRequired(
      "Prépare un licenciement",
      "high"
    );

    expect(approval).toBe(true);
  });

  it("détecte approval_required via mots-clés explicites", () => {
    const approval = detectPierreApprovalRequired(
      "Envoie le mail après validation",
      "low"
    );

    expect(approval).toBe(true);
  });
});