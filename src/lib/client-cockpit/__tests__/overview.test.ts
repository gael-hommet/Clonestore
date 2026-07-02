import { describe, it, expect } from "vitest";
import { buildOverview, buildAttention, buildIndicators, buildHealth } from "../overview";
import type { OverviewInput } from "../overview";
import { mapMission, mapValidation, mapArtifact, mapTask, employeeReference } from "../map";
import type {
  PierreCockpitMissionSummary,
  PierreCockpitValidationSummary,
  PierreCockpitTaskSummary,
  PierreCockpitDocumentSummary,
} from "@/lib/pierre/cockpit/types";

function mission(over: Partial<PierreCockpitMissionSummary>): PierreCockpitMissionSummary {
  return {
    id: "m", title: "M", summary: null, status: "active", riskLevel: "low", requiresValidation: false,
    tasksTotal: 2, tasksDone: 0, tasksBlocked: 0, tasksAwaiting: 0, createdAt: "2026-07-01T00:00:00Z",
    updatedAt: null, ...over,
  };
}
function validation(over: Partial<PierreCockpitValidationSummary>): PierreCockpitValidationSummary {
  return {
    taskId: "t", missionId: "m", title: "V", type: "email.send", reason: null, riskLevel: "orange",
    isEmailTask: true, isSensitive: false, requiresHuman: true, createdAt: "2026-07-01T00:00:00Z",
    validationId: "v", version: 1, status: "pending", ...over,
  };
}

const EMPTY: OverviewInput = { missions: [], tasks: [], validations: [], artifacts: [] };

describe("buildOverview", () => {
  it("aucune mission → isEmpty + santé à jour", () => {
    const o = buildOverview(EMPTY);
    expect(o.isEmpty).toBe(true);
    expect(o.attention).toHaveLength(0);
    expect(o.health.label).toBe("À jour");
    expect(o.indicators.missionsInProgress).toBe(0);
  });

  it("validation pending → attention + santé décisions en attente", () => {
    const input: OverviewInput = {
      missions: [mapMission(mission({ id: "m1", status: "awaiting_approval" }))],
      tasks: [],
      validations: [mapValidation(validation({ validationId: "v1" }))],
      artifacts: [],
    };
    const o = buildOverview(input);
    expect(o.isEmpty).toBe(false);
    expect(o.attention.some((a) => a.kind === "validation")).toBe(true);
    expect(o.indicators.validationsPending).toBe(1);
    expect(["Décisions en attente", "Attention requise"]).toContain(o.health.label);
  });

  it("mission bloquée → attention critique + santé danger, triée en premier", () => {
    const input: OverviewInput = {
      missions: [
        mapMission(mission({ id: "m1", status: "active" })),
        mapMission(mission({ id: "m2", status: "blocked", riskLevel: "red" })),
      ],
      tasks: [],
      validations: [mapValidation(validation({ validationId: "v1", riskLevel: "orange" }))],
      artifacts: [],
    };
    const o = buildOverview(input);
    expect(o.health.tone).toBe("danger");
    expect(o.attention[0].urgency).toBe("critical"); // bloqué remonte en tête
    expect(o.indicators.incidentsOpen).toBeGreaterThanOrEqual(1);
  });

  it("mission understanding → attention missing_info", () => {
    const o = buildOverview({ ...EMPTY, missions: [mapMission(mission({ id: "m1", status: "awaiting_info" }))] });
    expect(o.attention.some((a) => a.kind === "missing_info")).toBe(true);
  });

  it("tâche failed → incident dans l'attention", () => {
    const t: PierreCockpitTaskSummary = {
      id: "t1", missionId: "m1", type: "email.send", title: "Envoi", description: null, status: "failed",
      riskLevel: "red", requiresValidation: false, isEmailTask: true, isSensitive: false,
      executeAt: null, blockedReason: "SMTP refusé", createdAt: null,
    };
    const o = buildOverview({ ...EMPTY, missions: [mapMission(mission({ id: "m1" }))], tasks: [mapTask(t)] });
    expect(o.attention.some((a) => a.kind === "incident")).toBe(true);
  });

  it("document needs_review → document_review", () => {
    const d: PierreCockpitDocumentSummary = {
      id: "d1", missionId: "m1", title: "CDI", docType: "contract", status: "blocked", qualityScore: 0.4,
      requiresValidation: true, validationMode: "human", riskLevel: "red", isPdf: false, contentText: null,
      templateId: null, createdAt: "2026-07-01T00:00:00Z",
    };
    const o = buildOverview({ ...EMPTY, missions: [mapMission(mission({ id: "m1" }))], artifacts: [mapArtifact(d)] });
    expect(o.attention.some((a) => a.kind === "document_review")).toBe(true);
    expect(o.indicators.documentsProduced).toBe(1);
  });

  it("recentlyDone limité + inProgress exclut done", () => {
    const missions = [
      mapMission(mission({ id: "a", status: "done", createdAt: "2026-07-03T00:00:00Z" })),
      mapMission(mission({ id: "b", status: "done", createdAt: "2026-07-05T00:00:00Z" })),
      mapMission(mission({ id: "c", status: "active" })),
    ];
    const o = buildOverview({ ...EMPTY, missions, recentLimit: 1 });
    expect(o.recentlyDone).toHaveLength(1);
    expect(o.recentlyDone[0].id).toBe("b"); // plus récent d'abord
    expect(o.inProgress.every((m) => m.status !== "done")).toBe(true);
  });

  it("employeesConcerned compte les salariés distincts", () => {
    const emp = employeeReference("e1", "Marie");
    const missions = [mapMission(mission({ id: "m1" }))];
    const validations = [mapValidation(validation({ validationId: "v1" }))];
    const o = buildOverview({
      missions: missions.map((m) => ({ ...m, employee: emp })),
      tasks: [],
      validations: validations.map((v) => ({ ...v, employee: emp })),
      artifacts: [],
    });
    expect(o.indicators.employeesConcerned).toBe(1);
  });
});

describe("buildHealth", () => {
  it("critique domine", () => {
    const attention = buildAttention({ ...EMPTY, missions: [mapMission(mission({ id: "m1", status: "blocked" }))] });
    const ind = buildIndicators({ ...EMPTY, missions: [mapMission(mission({ id: "m1", status: "blocked" }))] });
    expect(buildHealth(attention, ind).tone).toBe("danger");
  });
});
