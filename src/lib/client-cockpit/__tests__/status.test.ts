import { describe, it, expect } from "vitest";
import {
  toMissionStatus,
  missionStatusView,
  toTaskStatus,
  taskStatusView,
  toValidationStatus,
  validationStatusView,
  toArtifactStatus,
  artifactStatusView,
  riskTone,
  riskUrgency,
  compareUrgency,
  maxUrgency,
  humanize,
} from "../status";

describe("client-cockpit — mapping de statut mission", () => {
  const cases: Array<[string, string]> = [
    ["draft", "draft"],
    ["awaiting_info", "understanding"],
    ["missing_info", "understanding"],
    ["awaiting_approval", "awaiting_approval"],
    ["active", "in_progress"],
    ["scheduled", "in_progress"],
    ["blocked", "blocked"],
    ["done", "done"],
    ["completed", "done"],
    ["cancelled", "cancelled"],
    ["canceled", "cancelled"],
  ];
  it.each(cases)("mission %s → %s", (raw, expected) => {
    expect(toMissionStatus(raw)).toBe(expected);
  });
  it("statut inconnu → unknown neutre", () => {
    expect(toMissionStatus("wat")).toBe("unknown");
    expect(missionStatusView("wat")).toMatchObject({ canonical: "unknown", tone: "neutral" });
  });
  it("bloquée = danger + critical", () => {
    expect(missionStatusView("blocked")).toMatchObject({ tone: "danger", urgency: "critical" });
  });
  it("insensible à la casse / espaces", () => {
    expect(toMissionStatus("  ACTIVE ")).toBe("in_progress");
  });
});

describe("client-cockpit — mapping de statut tâche (toutes les valeurs DB réelles)", () => {
  const cases: Array<[string, string]> = [
    ["draft", "draft"], ["ready", "ready"], ["scheduled", "scheduled"],
    ["awaiting_approval", "awaiting_approval"], ["queued", "queued"], ["pending", "queued"],
    ["running", "running"], ["blocked", "blocked"], ["completed", "completed"],
    ["failed", "failed"], ["cancelled", "cancelled"],
  ];
  it.each(cases)("task %s → %s", (raw, expected) => {
    expect(toTaskStatus(raw)).toBe(expected);
  });
  it("awaiting_approval = warning/high, failed = danger/high", () => {
    expect(taskStatusView("awaiting_approval")).toMatchObject({ tone: "warning", urgency: "high" });
    expect(taskStatusView("failed")).toMatchObject({ tone: "danger", urgency: "high" });
  });
});

describe("client-cockpit — statuts RÉELS du runtime V1 (state-machine)", () => {
  it("mission : couvre tous les MissionStatus V1", () => {
    const map: Record<string, string> = {
      analyzing: "in_progress", awaiting_info: "understanding", planned: "in_progress",
      awaiting_validation: "awaiting_approval", ready: "in_progress", queued: "in_progress",
      in_progress: "in_progress", partially_completed: "in_progress", retry_scheduled: "in_progress",
      failed: "blocked", escalated: "blocked", done: "done", archived: "done", cancelled: "cancelled",
    };
    for (const [raw, expected] of Object.entries(map)) expect(toMissionStatus(raw)).toBe(expected);
  });
  it("task : couvre tous les TaskStatus V1", () => {
    const map: Record<string, string> = {
      planned: "scheduled", awaiting_info: "queued", awaiting_validation: "awaiting_approval",
      ready: "ready", queued: "queued", leased: "running", in_progress: "running",
      succeeded: "completed", retry_scheduled: "queued", blocked: "blocked", escalated: "blocked",
      archived: "completed", failed: "failed", cancelled: "cancelled",
    };
    for (const [raw, expected] of Object.entries(map)) expect(toTaskStatus(raw)).toBe(expected);
  });
});

describe("client-cockpit — mapping de statut validation", () => {
  it("pending/approved/rejected/request_changes", () => {
    expect(toValidationStatus("pending")).toBe("pending");
    expect(toValidationStatus("awaiting_approval")).toBe("pending");
    expect(toValidationStatus("approved")).toBe("approved");
    expect(toValidationStatus("rejected")).toBe("rejected");
    expect(toValidationStatus("refused")).toBe("rejected");
    expect(toValidationStatus("request_changes")).toBe("changes_requested");
    expect(toValidationStatus("changes_requested")).toBe("changes_requested");
  });
  it("pending = warning/high", () => {
    expect(validationStatusView("pending")).toMatchObject({ tone: "warning", urgency: "high" });
  });
});

describe("client-cockpit — mapping de statut document", () => {
  it("familles de statut", () => {
    expect(toArtifactStatus("draft")).toBe("draft");
    expect(toArtifactStatus("awaiting_approval")).toBe("awaiting_validation");
    expect(toArtifactStatus("blocked")).toBe("needs_review");
    expect(toArtifactStatus("excellent")).toBe("validated");
    expect(toArtifactStatus("signed")).toBe("signed");
    expect(toArtifactStatus("sent")).toBe("sent");
  });
});

describe("client-cockpit — risque + urgence", () => {
  it("couleur HR + niveau DB → tonalité", () => {
    expect(riskTone("green")).toBe("success");
    expect(riskTone("low")).toBe("success");
    expect(riskTone("orange")).toBe("warning");
    expect(riskTone("red")).toBe("danger");
    expect(riskTone("black")).toBe("danger");
    expect(riskTone("high")).toBe("danger");
  });
  it("urgence par risque", () => {
    expect(riskUrgency("black")).toBe("critical");
    expect(riskUrgency("red")).toBe("critical");
    expect(riskUrgency("green")).toBe("low");
  });
  it("compareUrgency trie critical d'abord", () => {
    const arr: Array<"critical" | "high" | "normal" | "low"> = ["low", "critical", "normal", "high"];
    expect([...arr].sort(compareUrgency)).toEqual(["critical", "high", "normal", "low"]);
  });
  it("maxUrgency retient la plus forte", () => {
    expect(maxUrgency("low", "critical")).toBe("critical");
    expect(maxUrgency("normal", "high")).toBe("high");
  });
});

describe("client-cockpit — humanize", () => {
  it("transforme les slugs techniques en libellés", () => {
    expect(humanize("email.send")).toBe("Email.Send");
    expect(humanize("hr_contract_draft")).toBe("Hr Contract Draft");
    expect(humanize("")).toBe("Inconnu");
  });
});
