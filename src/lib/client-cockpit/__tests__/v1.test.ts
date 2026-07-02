import { describe, it, expect } from "vitest";
import {
  mapV1MissionList,
  mapV1MissionView,
  mapV1Task,
  mapV1Tasks,
  mapV1Validation,
  mapV1Validations,
  deriveV1Artifacts,
  mapV1Timeline,
} from "../v1";
import { permissionsFromKeys } from "../permissions";

describe("v1 bridge — missions", () => {
  it("mapV1MissionList (contrat réel {items,next_cursor})", () => {
    const { missions, nextCursor } = mapV1MissionList({
      items: [
        { id: "m1", status: "active", risk: "medium", summary: "Contrat CDI Marie", created_at: "2026-07-01T10:00:00Z" },
        { id: "m2", status: "done", risk: "green", summary: "Attestation", created_at: "2026-07-02T10:00:00Z" },
      ],
      next_cursor: "cursor-2",
    });
    expect(missions).toHaveLength(2);
    expect(missions[0]).toMatchObject({ id: "m1", status: "in_progress", title: "Contrat CDI Marie" });
    expect(missions[1].status).toBe("done");
    expect(missions[1].progress).toBe(1);
    expect(nextCursor).toBe("cursor-2");
  });

  it("mapV1MissionView compte les tâches et dérive la progression", () => {
    const m = mapV1MissionView({
      mission_id: "m1", status: "active", summary: "Onboarding Marie", risk: "red", next_action: "await approval",
      tasks: [
        { id: "t1", type: "doc.generate", status: "completed", approval_required: false, risk: "green" },
        { id: "t2", type: "email.send", status: "awaiting_approval", approval_required: true, risk: "red" },
        { id: "t3", type: "reminder.create", status: "blocked", approval_required: false, risk: "orange" },
        { id: "t4", type: "followup.schedule", status: "scheduled", approval_required: false, risk: "green" },
      ],
      approvals: [], queued_actions: 1, trace_reference: "tr", idempotent_replay: false,
    });
    expect(m).not.toBeNull();
    expect(m!.id).toBe("m1");
    expect(m!.tasksTotal).toBe(4);
    expect(m!.tasksDone).toBe(1);
    expect(m!.tasksBlocked).toBe(1);
    expect(m!.tasksAwaiting).toBe(1);
    expect(m!.progress).toBeCloseTo(0.25);
    expect(m!.urgency).toBe("critical"); // red risk
  });

  it("mission sans id → null", () => {
    expect(mapV1MissionView({ status: "active" })).toBeNull();
    expect(mapV1MissionList({ items: [{ status: "active" }] }).missions).toHaveLength(0);
  });
});

describe("v1 bridge — tâches", () => {
  it("mapV1Task (objective→title, sensitivity/approval→flags)", () => {
    const t = mapV1Task(
      { id: "t1", type: "email.send", objective: "Envoyer le contrat", status: "awaiting_approval", risk: "red", sensitivity: "high", approval_required: true, attempts: 0, max_attempts: 3 },
      "m1",
    );
    expect(t).toMatchObject({ id: "t1", missionId: "m1", title: "Envoyer le contrat", status: "awaiting_approval", requiresValidation: true, isSensitive: true, isEmail: true });
  });
  it("mapV1Tasks filtre les entrées invalides", () => {
    expect(mapV1Tasks([{ id: "t1", type: "x", objective: "o", status: "ready", risk: "green", sensitivity: "low", approval_required: false }, { type: "no-id" }])).toHaveLength(1);
  });
});

describe("v1 bridge — validations (version pour optimistic-lock)", () => {
  const raw = { id: "v1", status: "pending", reason: "Contient des données contractuelles", validator_role: "owner", task_id: "t2", version: 4, risk_context: { risk: "red" } };
  it("mappe id/version/urgence + actions selon permission", () => {
    const tasks = new Map([["t2", mapV1Task({ id: "t2", type: "email.send", objective: "Envoyer", status: "awaiting_approval", risk: "red", sensitivity: "high", approval_required: true }, "m1")!]]);
    const list = mapV1Validations([raw], { permissions: permissionsFromKeys(["validation.decide"]), missionId: "m1", tasksById: tasks });
    expect(list).toHaveLength(1);
    const v = list[0];
    expect(v.id).toBe("v1");
    expect(v.version).toBe(4);
    expect(v.taskId).toBe("t2");
    expect(v.urgency).toBe("critical");
    expect(v.isSensitive).toBe(true);
    expect(v.actions.map((a) => a.kind)).toEqual(["approve", "request_changes", "reject"]);
    expect(v.actions.every((a) => a.allowed)).toBe(true);
  });
  it("sans permission → actions désactivées", () => {
    const v = mapV1Validation(raw, { permissions: permissionsFromKeys(["mission.read"]) });
    expect(v!.actions.every((a) => !a.allowed)).toBe(true);
  });
  it("statut non-pending → aucune action", () => {
    const v = mapV1Validation({ ...raw, status: "approved" });
    expect(v!.status).toBe("approved");
    expect(v!.actions).toHaveLength(0);
  });
});

describe("v1 bridge — artifacts dérivés des tâches (types réels du runtime V1)", () => {
  const tasks = [
    { id: "t1", type: "prepare_sensitive_draft", objective: "CDI Marie", status: "awaiting_validation", approval_required: true, risk: "high" },
    { id: "t2", type: "communication", objective: "Email bienvenue", status: "succeeded", approval_required: false, risk: "green" },
    { id: "t3", type: "request_missing_info", objective: "Infos", status: "ready", approval_required: false, risk: "green" },
  ];
  it("ne dérive que les tâches document/communication réelles", () => {
    const arts = deriveV1Artifacts(tasks, { permissions: permissionsFromKeys(["document.read"]), missionId: "m1" });
    expect(arts).toHaveLength(2); // prepare_sensitive_draft (doc) + communication ; request_missing_info exclu
    const doc = arts.find((a) => a.id === "t1")!;
    expect(doc.status).toBe("awaiting_validation");
    expect(doc.family).toBe("Document");
    const comm = arts.find((a) => a.id === "t2")!;
    expect(comm.status).toBe("sent");
    expect(comm.family).toBe("Communication");
    expect(comm.canDownload).toBe(true); // succeeded = terminé
  });
  it("téléchargement refusé sans permission document/mission", () => {
    const arts = deriveV1Artifacts(tasks, { permissions: permissionsFromKeys(["validation.read"]) });
    expect(arts.find((a) => a.id === "t2")!.canDownload).toBe(false);
  });
});

describe("v1 bridge — timeline", () => {
  it("mappe type→kind humain, masque metadata", () => {
    const evts = mapV1Timeline([
      { id: "e1", type: "mission_created", actor_type: "user", created_at: "2026-07-01T00:00:00Z", metadata: { secret: "x" } },
      { id: "e2", type: "task_failed", actor_type: "system", created_at: "2026-07-01T01:00:00Z" },
      { id: "e3", type: "validation_approved", actor_type: "human", created_at: "2026-07-01T02:00:00Z" },
    ]);
    expect(evts).toHaveLength(3);
    expect(evts[0]).toMatchObject({ kind: "mission", actor: "human" });
    expect(evts[1]).toMatchObject({ kind: "incident", tone: "danger" });
    expect(evts[2].kind).toBe("validation");
    expect(evts[0].detail).toBeNull(); // metadata jamais exposée
  });
});
