import { describe, it, expect } from "vitest";
import { mapMission, mapTask, mapValidation, mapArtifact, employeeReference } from "../map";
import { permissionsFromKeys } from "../permissions";
import type {
  PierreCockpitMissionSummary,
  PierreCockpitTaskSummary,
  PierreCockpitValidationSummary,
  PierreCockpitDocumentSummary,
} from "@/lib/pierre/cockpit/types";

const mission = (over: Partial<PierreCockpitMissionSummary> = {}): PierreCockpitMissionSummary => ({
  id: "m1", title: "Contrat CDI Marie", summary: "Préparer le CDI", status: "active", riskLevel: "medium",
  requiresValidation: true, tasksTotal: 4, tasksDone: 1, tasksBlocked: 0, tasksAwaiting: 1,
  createdAt: "2026-07-01T10:00:00Z", updatedAt: "2026-07-01T10:00:00Z", ...over,
});

describe("mapMission", () => {
  it("progression = done/total, urgence combine statut + risque", () => {
    const m = mapMission(mission({ tasksTotal: 4, tasksDone: 2, riskLevel: "red" }));
    expect(m.progress).toBeCloseTo(0.5);
    expect(m.status).toBe("in_progress");
    expect(m.urgency).toBe("critical"); // red risk élève l'urgence
    expect(m.nextAction.kind).toBe("open");
  });
  it("mission terminée → progress 1 même sans tâches", () => {
    const m = mapMission(mission({ status: "done", tasksTotal: 0, tasksDone: 0 }));
    expect(m.progress).toBe(1);
    expect(m.status).toBe("done");
  });
  it("bloquée → blockedReason + urgence critique", () => {
    const m = mapMission(mission({ status: "blocked" }));
    expect(m.status).toBe("blocked");
    expect(m.blockedReason).toBeTruthy();
    expect(m.urgency).toBe("critical");
  });
  it("attache une référence salarié + freshness stale", () => {
    const emp = employeeReference("e1", "Marie Dupont", "RH");
    const m = mapMission(mission(), { employee: emp, freshness: "stale" });
    expect(m.employee?.href).toContain("/agents/pierre/employees?employee=e1");
    expect(m.freshness).toBe("stale");
  });
});

describe("mapTask", () => {
  it("mappe statut + drapeaux", () => {
    const t: PierreCockpitTaskSummary = {
      id: "t1", missionId: "m1", type: "email.send", title: "", description: null, status: "awaiting_approval",
      riskLevel: "orange", requiresValidation: true, isEmailTask: true, isSensitive: true,
      executeAt: null, blockedReason: null, createdAt: null,
    };
    const mapped = mapTask(t);
    expect(mapped.status).toBe("awaiting_approval");
    expect(mapped.isEmail).toBe(true);
    expect(mapped.isSensitive).toBe(true);
    expect(mapped.title).toBe("Email.Send"); // humanize du type quand titre vide
  });
});

describe("mapValidation — CTA gouvernés par permission", () => {
  const base: PierreCockpitValidationSummary = {
    taskId: "t1", missionId: "m1", title: "Envoyer le contrat à Marie", type: "email.send",
    reason: "Contient des données contractuelles", riskLevel: "red", isEmailTask: true, isSensitive: true,
    requiresHuman: true, createdAt: "2026-07-01T09:00:00Z", validationId: "v1", version: 3, status: "pending",
  };
  it("pending → 3 actions autorisées si validation.decide", () => {
    const v = mapValidation(base, { permissions: permissionsFromKeys(["validation.decide"]) });
    expect(v.id).toBe("v1");
    expect(v.version).toBe(3);
    expect(v.actions.map((a) => a.kind)).toEqual(["approve", "request_changes", "reject"]);
    expect(v.actions.every((a) => a.allowed)).toBe(true);
    expect(v.urgency).toBe("critical");
  });
  it("sans permission → actions présentes mais désactivées avec raison", () => {
    const v = mapValidation(base, { permissions: permissionsFromKeys(["mission.read"]) });
    expect(v.actions.every((a) => !a.allowed)).toBe(true);
    expect(v.actions[0].reason).toMatch(/rôle/i);
  });
  it("non-pending → aucune action", () => {
    const v = mapValidation({ ...base, status: "approved" });
    expect(v.actions).toHaveLength(0);
    expect(v.status).toBe("approved");
  });
  it("fallback identifiant = taskId si pas de validationId", () => {
    const v = mapValidation({ ...base, validationId: undefined });
    expect(v.id).toBe("t1");
    expect(v.version).toBe(3);
  });
});

describe("mapArtifact", () => {
  const doc: PierreCockpitDocumentSummary = {
    id: "d1", missionId: "m1", title: "CDI Marie Dupont", docType: "contract", status: "generated",
    qualityScore: 0.9, requiresValidation: true, validationMode: "human", riskLevel: "orange",
    isPdf: true, contentText: null, templateId: null, createdAt: "2026-07-01T11:00:00Z",
  };
  it("requiresValidation + generated → awaiting_validation", () => {
    const a = mapArtifact(doc, { permissions: permissionsFromKeys(["document.read"]) });
    expect(a.status).toBe("awaiting_validation");
    expect(a.isPdf).toBe(true);
    expect(a.canDownload).toBe(true);
    expect(a.family).toBe("Contract");
  });
  it("téléchargement refusé sans permission document", () => {
    const a = mapArtifact(doc, { permissions: permissionsFromKeys(["mission.cancel"]) });
    expect(a.canDownload).toBe(false);
    expect(a.canPreview).toBe(true);
  });
});
