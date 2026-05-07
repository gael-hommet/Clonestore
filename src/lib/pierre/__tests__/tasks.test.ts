import { describe, expect, it } from "vitest";

import { buildPierreTasks } from "@/lib/pierre/mission/build-tasks";
import type { PierreClassification } from "@/lib/pierre/mission/classify";

function makeClassification(
  patch?: Partial<PierreClassification>
): PierreClassification {
  return {
    asksEmail: false,
    asksDocument: false,
    asksRewrite: false,
    asksPdf: false,
    asksReminder: false,
    outOfScope: false,
    ...patch,
  };
}

describe("buildPierreTasks", () => {
  it("construit une task email.send si email dÃ©tectÃ©", () => {
    const tasks = buildPierreTasks({
      rawInput: "Envoie un mail Ã  test@gmail.com",
      classification: makeClassification({ asksEmail: true }),
      missingInfo: [],
      approvalRequired: false,
      executeAt: null,
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("email.send");
    expect(tasks[0].status).toBe("ready");
  });

  it("construit une task email.draft si destinataire absent", () => {
    const tasks = buildPierreTasks({
      rawInput: "Envoie un mail de suivi",
      classification: makeClassification({ asksEmail: true }),
      missingInfo: [
        {
          key: "recipient_email",
          question: "Quel est lâ€™email exact du destinataire ?",
          expected_format: "email",
          required: true,
        },
      ],
      approvalRequired: false,
      executeAt: null,
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("email.draft");
    expect(tasks[0].status).toBe("blocked");
  });

  it("construit une task document par dÃ©faut si ni email ni reminder", () => {
    const tasks = buildPierreTasks({
      rawInput: "PrÃ©pare un document RH",
      classification: makeClassification({ asksDocument: true }),
      missingInfo: [],
      approvalRequired: false,
      executeAt: null,
    });

    expect(tasks.some((task) => task.type === "doc.generate")).toBe(true);
  });

  it("construit une task pdf.generate", () => {
    const tasks = buildPierreTasks({
      rawInput: "GÃ©nÃ¨re un PDF",
      classification: makeClassification({ asksPdf: true }),
      missingInfo: [],
      approvalRequired: false,
      executeAt: null,
    });

    expect(tasks.some((task) => task.type === "pdf.generate")).toBe(true);
  });

  it("construit une task followup.schedule si reminder demandÃ©", () => {
    const tasks = buildPierreTasks({
      rawInput: "Relance demain Ã  17h",
      classification: makeClassification({ asksReminder: true }),
      missingInfo: [],
      approvalRequired: false,
      executeAt: new Date(Date.now() + 3_600_000).toISOString(),
    });

    expect(tasks.some((task) => task.type === "followup.schedule")).toBe(true);
    expect(tasks.find((task) => task.type === "followup.schedule")?.status).toBe(
      "scheduled"
    );
  });
});