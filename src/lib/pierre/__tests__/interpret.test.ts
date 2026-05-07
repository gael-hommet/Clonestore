import { describe, expect, it } from "vitest";

import { interpretPierreMission } from "@/lib/pierre/mission/interpret";

describe("interpretPierreMission", () => {
  it("dÃ©tecte une mission email simple", () => {
    const result = interpretPierreMission(
      "Envoie un mail Ã  jean.dupont@gmail.com pour confirmer l'entretien."
    );

    expect(result.intent).toBe("rh_email");
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.tasks.some((task) => task.type === "email.send")).toBe(true);
    expect(result.missing_info.length).toBe(0);
  });

  it("dÃ©tecte une mission document + email", () => {
    const result = interpretPierreMission(
      "PrÃ©pare une convocation et envoie-la Ã  candidat@test.com"
    );

    expect(result.intent).toBe("rh_doc_plus_email");
    expect(result.tasks.some((task) => task.type === "doc.generate")).toBe(true);
    expect(result.tasks.some((task) => task.type === "email.send")).toBe(true);
  });

  it("dÃ©tecte une demande hors pÃ©rimÃ¨tre", () => {
    const result = interpretPierreMission(
      "Lance une campagne massive de cold emailing"
    );

    expect(result.intent).toBe("out_of_scope");
    expect(result.understanding_status).toBe("out_of_scope");
    expect(result.tasks).toHaveLength(0);
    expect(result.approval_required).toBe(true);
  });

  it("dÃ©tecte missing_info quand un email est demandÃ© sans destinataire", () => {
    const result = interpretPierreMission(
      "Envoie un mail de convocation pour demain"
    );

    expect(result.understanding_status).toBe("missing_info");
    expect(
      result.missing_info.some((item) => item.key === "recipient_email")
    ).toBe(true);
  });

  it("dÃ©tecte une rÃ©Ã©criture", () => {
    const result = interpretPierreMission(
      "RÃ©Ã©cris ce courrier pour le rendre plus pro"
    );

    expect(result.intent).toBe("rh_rewrite");
    expect(result.tasks.some((task) => task.type === "doc.rewrite")).toBe(true);
  });
});