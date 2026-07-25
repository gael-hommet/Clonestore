import { describe, it, expect } from "vitest";
import {
  processPierreTask,
  type PierreQueuePersistenceAdapter,
  type PierreQueueTaskRecord,
} from "../queue/process-task";

// P21 — regression guard for the queue-worker governance bypass.
// Before P21, processPierreTask() called executePierreTask() directly and relied only on
// the governance flags baked into payload_json at creation time. A sensitive/black-level
// action whose payload lacked those flags could auto-execute on this path. These tests prove
// CloneGuard + governance are now re-evaluated live and hard-block refuse/block decisions,
// while benign drafts still complete (no over-blocking).

type Update = { taskId: string; patch: Record<string, unknown> };
type LogEntry = {
  level: "info" | "warning" | "error";
  event: string;
  message: string;
};

function makeAdapter() {
  const updates: Update[] = [];
  const logs: LogEntry[] = [];
  const adapter: PierreQueuePersistenceAdapter = {
    updateTask: async (taskId, patch) => {
      updates.push({ taskId, patch });
    },
    insertTaskLog: async (entry) => {
      logs.push({ level: entry.level, event: entry.event, message: entry.message });
    },
    insertArtifact: async () => ({ artifact_id: "art-1", artifact_kind: "document" }),
  };
  return { adapter, updates, logs };
}

describe("processPierreTask — live governance gate (P21)", () => {
  it("hard-blocks a sensitive (harcèlement) task and never marks it running", async () => {
    const { adapter, updates, logs } = makeAdapter();
    const task: PierreQueueTaskRecord = {
      id: "task-sensitive",
      mission_id: "m1",
      user_id: "u1",
      type: "generate_document",
      title: "Signalement harcèlement moral",
      status: "ready",
      payload_json: { raw_input: "note interne" },
    };

    const result = await processPierreTask({
      task,
      workerId: "worker-1",
      persistence: adapter,
      now: new Date("2026-07-25T10:00:00.000Z"),
    });

    expect(result.ok).toBe(false);
    expect(result.finalStatus).toBe("blocked");
    if (!result.ok) expect(result.errorCode).toBe("GOVERNANCE_BLOCKED");

    // The task must NEVER have been transitioned to "running".
    expect(updates.some((u) => u.patch.status === "running")).toBe(false);
    // It must have been persisted as blocked with a reason.
    const blockedUpdate = updates.find((u) => u.patch.status === "blocked");
    expect(blockedUpdate).toBeDefined();
    expect(blockedUpdate?.patch.blocked_reason).toBeTruthy();
    // A visible governance-block alert must have been logged.
    expect(logs.some((l) => l.event === "task_governance_blocked")).toBe(true);
  });

  it("still completes a benign document-draft task (no over-blocking)", async () => {
    const { adapter, updates } = makeAdapter();
    const task: PierreQueueTaskRecord = {
      id: "task-benign",
      mission_id: "m2",
      user_id: "u1",
      type: "generate_document",
      title: "Attestation de travail",
      status: "ready",
      payload_json: {
        text_content: "Nous attestons que le salarié travaille dans l'entreprise.",
      },
    };

    const result = await processPierreTask({
      task,
      workerId: "worker-1",
      persistence: adapter,
      now: new Date("2026-07-25T10:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.finalStatus).toBe("done");
    expect(updates.some((u) => u.patch.status === "running")).toBe(true);
    expect(updates.some((u) => u.patch.status === "done")).toBe(true);
  });
});
