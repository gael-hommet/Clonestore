"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Primitive = string | number | boolean | null | undefined;
type JsonValue = Primitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

type MissionRiskLevel = "normal" | "sensitive" | "critical" | "unknown";
type MissionLifecycleStatus =
  | "draft"
  | "created"
  | "queued"
  | "running"
  | "awaiting_info"
  | "awaiting_approval"
  | "blocked"
  | "completed"
  | "cancelled"
  | "failed"
  | "unknown";

type TaskLifecycleStatus =
  | "pending"
  | "queued"
  | "running"
  | "awaiting_info"
  | "awaiting_approval"
  | "scheduled"
  | "blocked"
  | "completed"
  | "cancelled"
  | "failed"
  | "unknown";

type HookError = {
  message: string;
  status?: number;
  code?: string | null;
  details?: unknown;
};

export type PierreMissionRecord = {
  id: string;
  company_id?: string | null;
  user_id?: string | null;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  classification?: string | null;
  status?: MissionLifecycleStatus | string | null;
  risk_level?: MissionRiskLevel | string | null;
  approval_required?: boolean | null;
  language?: string | null;
  tone?: string | null;
  missing_info?: unknown;
  interpretation?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type PierreTaskRecord = {
  id: string;
  mission_id?: string | null;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  status?: TaskLifecycleStatus | string | null;
  risk_level?: MissionRiskLevel | string | null;
  approval_required?: boolean | null;
  scheduled_for?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  blocked_reason?: string | null;
  error_message?: string | null;
  payload?: unknown;
  result?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type PierreTaskLogRecord = {
  id: string;
  mission_id?: string | null;
  task_id?: string | null;
  level?: string | null;
  event?: string | null;
  message?: string | null;
  payload?: unknown;
  created_at?: string | null;
  [key: string]: unknown;
};

export type PierreDocumentRecord = {
  id: string;
  mission_id?: string | null;
  task_id?: string | null;
  title?: string | null;
  doc_type?: string | null;
  status?: string | null;
  text_content?: string | null;
  html_content?: string | null;
  content?: unknown;
  metadata?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type PierreOutboundEmailRecord = {
  id: string;
  mission_id?: string | null;
  task_id?: string | null;
  to?: string | string[] | null;
  cc?: string | string[] | null;
  bcc?: string | string[] | null;
  subject?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  status?: string | null;
  provider_message_id?: string | null;
  attachments?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type PierrePdfRecord = {
  id: string;
  mission_id?: string | null;
  task_id?: string | null;
  title?: string | null;
  filename?: string | null;
  storage_path?: string | null;
  public_url?: string | null;
  signed_url?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type PierreMissionInterpretation = {
  intent?: string | null;
  classification?: string | null;
  summary?: string | null;
  language?: string | null;
  tone?: string | null;
  risk_level?: MissionRiskLevel | string | null;
  approval_required?: boolean | null;
  missing_info_questions?: string[];
  missing_info?: unknown;
  tasks?: unknown[];
  [key: string]: unknown;
};

export type PierreMissionSubmitPayload = {
  
  mode?: string | null;
input: string;
  missionId?: string | null;
  context?: unknown;
};

export type PierreDirectDocumentPayload = {
  instructions: string;
  context?: string;
  type?: string;
  tone?: string;
  language?: string;
  title?: string;
  missionId?: string | null;
};

export type PierreDirectEmailPayload = {
  
  replyTo?: string | null;
to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  body?: string;
  tone?: string;
  language?: string;
  senderName?: string;
  senderEmail?: string;
  missionId?: string | null;
  attachments?: unknown;
};

export type PierreDirectPdfPayload = {
  title?: string;
  text: string;
  filename?: string;
  missionId?: string | null;
};

export type PierreTaskActionPayload = {
  taskId: string;
  body?: Record<string, unknown>;
  missionId?: string | null;
};

export type PierreTaskReschedulePayload = {
  taskId: string;
  scheduledFor: string;
  reason?: string;
  missionId?: string | null;
};

export type PierreMissionCenterOptions = {
  initialFocusedMissionId?: string | null;
  autoLoad?: boolean;
  autoPoll?: boolean;
  pollIntervalMs?: number;
};

type MissionSnapshot = {
  mission: PierreMissionRecord | null;
  interpretation: PierreMissionInterpretation | null;
  tasks: PierreTaskRecord[];
  logs: PierreTaskLogRecord[];
  documents: PierreDocumentRecord[];
  outboundEmails: PierreOutboundEmailRecord[];
  pdfs: PierrePdfRecord[];
};

type UsePierreMissionCenterState = {
  missions: PierreMissionRecord[];
  activeMission: PierreMissionRecord | null;
  focusedMissionId: string | null;
  interpretation: PierreMissionInterpretation | null;
  tasks: PierreTaskRecord[];
  logs: PierreTaskLogRecord[];
  documents: PierreDocumentRecord[];
  outboundEmails: PierreOutboundEmailRecord[];
  pdfs: PierrePdfRecord[];
  directDocuments: PierreDocumentRecord[];
  directEmails: PierreOutboundEmailRecord[];
  directPdfs: PierrePdfRecord[];
  loading: boolean;
  refreshing: boolean;
  submittingMission: boolean;
  runningTask: boolean;
  approvingTask: boolean;
  cancellingTask: boolean;
  reschedulingTask: boolean;
  generatingDirectDocument: boolean;
  draftingDirectEmail: boolean;
  sendingDirectEmail: boolean;
  generatingDirectPdf: boolean;
  error: HookError | null;
  lastUpdatedAt: string | null;
};

export type UsePierreMissionCenterReturn = UsePierreMissionCenterState & {
  mission: PierreMissionRecord | null;
  hasActiveTask: boolean;
  submitting: boolean;
  setFocusedMissionId: (missionId: string | null) => void;
  clearError: () => void;
  setActiveMissionFromRecord: (mission: PierreMissionRecord | null) => void;
  submitMission: (
    payload: PierreMissionSubmitPayload,
  ) => Promise<{
    mission: PierreMissionRecord | null;
    interpretation: PierreMissionInterpretation | null;
    tasks: PierreTaskRecord[];
  }>;
  refreshMission: (missionId?: string | null) => Promise<MissionSnapshot | null>;
  refreshAll: (missionId?: string | null) => Promise<MissionSnapshot | null>;
  runTask: (payload: PierreTaskActionPayload) => Promise<Record<string, unknown> | null>;
  approveTask: (payload: PierreTaskActionPayload) => Promise<Record<string, unknown> | null>;
  cancelTask: (payload: PierreTaskActionPayload) => Promise<Record<string, unknown> | null>;
  rescheduleTask: (
    payload: PierreTaskReschedulePayload,
  ) => Promise<Record<string, unknown> | null>;
  generateDirectDocument: (
    payload: PierreDirectDocumentPayload,
  ) => Promise<PierreDocumentRecord | null>;
  draftDirectEmail: (
    payload: PierreDirectEmailPayload,
  ) => Promise<PierreOutboundEmailRecord | null>;
  sendDirectEmail: (
    payload: PierreDirectEmailPayload,
  ) => Promise<PierreOutboundEmailRecord | null>;
  generateDirectPdf: (payload: PierreDirectPdfPayload) => Promise<PierrePdfRecord | null>;
  hasActiveExecution: boolean;
  awaitingApprovalCount: number;
  blockedCount: number;
  completedCount: number;
};

const DEFAULT_OPTIONS: Required<PierreMissionCenterOptions> = {
  initialFocusedMissionId: null,
  autoLoad: true,
  autoPoll: true,
  pollIntervalMs: 6000,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeError(error: unknown): HookError {
  if (error instanceof Error) {
    return { message: error.message || "Une erreur est survenue." };
  }

  if (isObject(error)) {
    return {
      message:
        asString(error.message) ||
        asString(error.error) ||
        asString(error.detail) ||
        "Une erreur est survenue.",
      status:
        typeof error.status === "number" && Number.isFinite(error.status)
          ? error.status
          : undefined,
      code: asString(error.code),
      details: error.details,
    };
  }

  return { message: "Une erreur est survenue." };
}

async function safeReadJson(response: Response): Promise<unknown | null> {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const data = await safeReadJson(response);

  if (!response.ok) {
    const source = isObject(data) ? data : {};
    throw {
      message:
        asString(source.message) ||
        asString(source.error) ||
        asString(source.detail) ||
        `HTTP ${response.status}`,
      status: response.status,
      code: asString(source.code),
      details: data,
    };
  }

  return (data as T | null) ?? null;
}

function normalizeMission(raw: unknown): PierreMissionRecord | null {
  if (!isObject(raw)) return null;

  const id = asString(raw.id);
  if (!id) return null;

  return {
    ...raw,
    id,
    company_id: asString(raw.company_id),
    user_id: asString(raw.user_id),
    title: asString(raw.title),
    summary: asString(raw.summary),
    description: asString(raw.description),
    classification: asString(raw.classification),
    status: (asString(raw.status) ?? "unknown") as PierreMissionRecord["status"],
    risk_level: (asString(raw.risk_level) ?? "unknown") as PierreMissionRecord["risk_level"],
    approval_required: asBoolean(raw.approval_required),
    language: asString(raw.language),
    tone: asString(raw.tone),
    created_at: asString(raw.created_at),
    updated_at: asString(raw.updated_at),
  };
}

function normalizeTask(raw: unknown): PierreTaskRecord | null {
  if (!isObject(raw)) return null;

  const id = asString(raw.id);
  if (!id) return null;

  return {
    ...raw,
    id,
    mission_id: asString(raw.mission_id),
    type: asString(raw.type),
    title: asString(raw.title),
    description: asString(raw.description),
    status: (asString(raw.status) ?? "unknown") as PierreTaskRecord["status"],
    risk_level: (asString(raw.risk_level) ?? "unknown") as PierreTaskRecord["risk_level"],
    approval_required: asBoolean(raw.approval_required),
    scheduled_for: asString(raw.scheduled_for),
    started_at: asString(raw.started_at),
    completed_at: asString(raw.completed_at),
    blocked_reason: asString(raw.blocked_reason),
    error_message: asString(raw.error_message),
    created_at: asString(raw.created_at),
    updated_at: asString(raw.updated_at),
  };
}

function normalizeLog(raw: unknown): PierreTaskLogRecord | null {
  if (!isObject(raw)) return null;

  const id = asString(raw.id);
  if (!id) return null;

  return {
    ...raw,
    id,
    mission_id: asString(raw.mission_id),
    task_id: asString(raw.task_id),
    level: asString(raw.level),
    event: asString(raw.event),
    message: asString(raw.message),
    created_at: asString(raw.created_at),
  };
}

function normalizeDocument(raw: unknown): PierreDocumentRecord | null {
  if (!isObject(raw)) return null;

  const id = asString(raw.id);
  if (!id) return null;

  return {
    ...raw,
    id,
    mission_id: asString(raw.mission_id),
    task_id: asString(raw.task_id),
    title: asString(raw.title),
    doc_type: asString(raw.doc_type),
    status: asString(raw.status),
    text_content: asString(raw.text_content),
    html_content: asString(raw.html_content),
    created_at: asString(raw.created_at),
    updated_at: asString(raw.updated_at),
  };
}

function normalizeEmail(raw: unknown): PierreOutboundEmailRecord | null {
  if (!isObject(raw)) return null;

  const id = asString(raw.id);
  if (!id) return null;

  return {
    ...raw,
    id,
    mission_id: asString(raw.mission_id),
    task_id: asString(raw.task_id),
    subject: asString(raw.subject),
    body_text: asString(raw.body_text),
    body_html: asString(raw.body_html),
    sender_name: asString(raw.sender_name),
    sender_email: asString(raw.sender_email),
    status: asString(raw.status),
    provider_message_id: asString(raw.provider_message_id),
    created_at: asString(raw.created_at),
    updated_at: asString(raw.updated_at),
  };
}

function normalizePdf(raw: unknown): PierrePdfRecord | null {
  if (!isObject(raw)) return null;

  const id = asString(raw.id);
  if (!id) return null;

  return {
    ...raw,
    id,
    mission_id: asString(raw.mission_id),
    task_id: asString(raw.task_id),
    title: asString(raw.title),
    filename: asString(raw.filename),
    storage_path: asString(raw.storage_path),
    public_url: asString(raw.public_url),
    signed_url: asString(raw.signed_url),
    status: asString(raw.status),
    created_at: asString(raw.created_at),
    updated_at: asString(raw.updated_at),
  };
}

function normalizeInterpretation(raw: unknown): PierreMissionInterpretation | null {
  if (!isObject(raw)) return null;

  return {
    ...raw,
    intent: asString(raw.intent),
    classification: asString(raw.classification),
    summary: asString(raw.summary),
    language: asString(raw.language),
    tone: asString(raw.tone),
    risk_level: asString(raw.risk_level),
    approval_required: asBoolean(raw.approval_required),
    missing_info_questions: asArray<string>(raw.missing_info_questions).filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    ),
    missing_info: raw.missing_info,
    tasks: asArray(raw.tasks),
  };
}

function extractSnapshot(data: unknown): MissionSnapshot {
  const source = isObject(data) ? data : {};
  const dataBlock = isObject(source.data) ? source.data : null;
  const resultBlock = isObject(source.result) ? source.result : null;

  const mission =
    normalizeMission(source.mission) ||
    normalizeMission(dataBlock?.mission) ||
    normalizeMission(resultBlock?.mission);

  const interpretation =
    normalizeInterpretation(source.interpretation) ||
    normalizeInterpretation(dataBlock?.interpretation) ||
    normalizeInterpretation(resultBlock?.interpretation) ||
    normalizeInterpretation(mission?.interpretation);

  const tasksSource =
    asArray(source.tasks).length > 0
      ? asArray(source.tasks)
      : asArray(dataBlock?.tasks).length > 0
        ? asArray(dataBlock?.tasks)
        : asArray(resultBlock?.tasks);

  const logsSource =
    asArray(source.logs).length > 0
      ? asArray(source.logs)
      : asArray(source.task_logs).length > 0
        ? asArray(source.task_logs)
        : asArray(dataBlock?.logs).length > 0
          ? asArray(dataBlock?.logs)
          : asArray(dataBlock?.task_logs).length > 0
            ? asArray(dataBlock?.task_logs)
            : asArray(resultBlock?.logs).length > 0
              ? asArray(resultBlock?.logs)
              : asArray(resultBlock?.task_logs);

  const documentsSource =
    asArray(source.documents).length > 0
      ? asArray(source.documents)
      : asArray(dataBlock?.documents).length > 0
        ? asArray(dataBlock?.documents)
        : asArray(resultBlock?.documents);

  const outboundEmailsSource =
    asArray(source.outbound_emails).length > 0
      ? asArray(source.outbound_emails)
      : asArray(source.outboundEmails).length > 0
        ? asArray(source.outboundEmails)
        : asArray(dataBlock?.outbound_emails).length > 0
          ? asArray(dataBlock?.outbound_emails)
          : asArray(dataBlock?.outboundEmails).length > 0
            ? asArray(dataBlock?.outboundEmails)
            : asArray(resultBlock?.outbound_emails).length > 0
              ? asArray(resultBlock?.outbound_emails)
              : asArray(resultBlock?.outboundEmails);

  const pdfsSource =
    asArray(source.pdfs).length > 0
      ? asArray(source.pdfs)
      : asArray(dataBlock?.pdfs).length > 0
        ? asArray(dataBlock?.pdfs)
        : asArray(resultBlock?.pdfs);

  return {
    mission,
    interpretation,
    tasks: tasksSource.map(normalizeTask).filter((item): item is PierreTaskRecord => Boolean(item)),
    logs: logsSource.map(normalizeLog).filter((item): item is PierreTaskLogRecord => Boolean(item)),
    documents: documentsSource
      .map(normalizeDocument)
      .filter((item): item is PierreDocumentRecord => Boolean(item)),
    outboundEmails: outboundEmailsSource
      .map(normalizeEmail)
      .filter((item): item is PierreOutboundEmailRecord => Boolean(item)),
    pdfs: pdfsSource.map(normalizePdf).filter((item): item is PierrePdfRecord => Boolean(item)),
  };
}

function sortByUpdatedDesc<T extends { updated_at?: string | null; created_at?: string | null }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const aTs = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTs = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTs - aTs;
  });
}

function mergeMissionRecord(
  list: PierreMissionRecord[],
  mission: PierreMissionRecord | null,
): PierreMissionRecord[] {
  if (!mission) return list;

  const index = list.findIndex((item) => item.id === mission.id);

  if (index === -1) {
    return sortByUpdatedDesc([mission, ...list]);
  }

  const next = [...list];
  next[index] = { ...next[index], ...mission };
  return sortByUpdatedDesc(next);
}

function mergeArtifactRecord<
  T extends { id: string; updated_at?: string | null; created_at?: string | null },
>(list: T[], item: T | null): T[] {
  if (!item) return list;

  const index = list.findIndex((entry) => entry.id === item.id);

  if (index === -1) {
    return sortByUpdatedDesc([item, ...list]);
  }

  const next = [...list];
  next[index] = { ...next[index], ...item };
  return sortByUpdatedDesc(next);
}

function normalizeTaskStatus(status: string | null | undefined): TaskLifecycleStatus {
  const value = (status || "").trim().toLowerCase();

  if (!value) return "unknown";

  if (
    value === "pending" ||
    value === "queued" ||
    value === "running" ||
    value === "awaiting_info" ||
    value === "awaiting_approval" ||
    value === "scheduled" ||
    value === "blocked" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "failed"
  ) {
    return value;
  }

  if (value === "done" || value === "success") return "completed";
  if (value === "error") return "failed";
  if (value === "needs_approval" || value === "pending_approval") return "awaiting_approval";

  return "unknown";
}

function shouldPollMission(
  mission: PierreMissionRecord | null,
  tasks: PierreTaskRecord[],
): boolean {
  const missionStatus = (mission?.status || "").toString().trim().toLowerCase();

  if (missionStatus === "running" || missionStatus === "queued") return true;

  return tasks.some((task) => {
    const status = normalizeTaskStatus(task.status);
    return status === "queued" || status === "running" || status === "scheduled";
  });
}

export default function usePierreMissionCenter(
  options?: PierreMissionCenterOptions,
): UsePierreMissionCenterReturn {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...(options ?? {}) };

  const [missions, setMissions] = useState<PierreMissionRecord[]>([]);
  const [activeMission, setActiveMission] = useState<PierreMissionRecord | null>(null);
  const [focusedMissionId, setFocusedMissionIdState] = useState<string | null>(
    resolvedOptions.initialFocusedMissionId,
  );
  const [interpretation, setInterpretation] = useState<PierreMissionInterpretation | null>(null);
  const [tasks, setTasks] = useState<PierreTaskRecord[]>([]);
  const [logs, setLogs] = useState<PierreTaskLogRecord[]>([]);
  const [documents, setDocuments] = useState<PierreDocumentRecord[]>([]);
  const [outboundEmails, setOutboundEmails] = useState<PierreOutboundEmailRecord[]>([]);
  const [pdfs, setPdfs] = useState<PierrePdfRecord[]>([]);
  const [directDocuments, setDirectDocuments] = useState<PierreDocumentRecord[]>([]);
  const [directEmails, setDirectEmails] = useState<PierreOutboundEmailRecord[]>([]);
  const [directPdfs, setDirectPdfs] = useState<PierrePdfRecord[]>([]);

  const [loading, setLoading] = useState<boolean>(resolvedOptions.autoLoad);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [submittingMission, setSubmittingMission] = useState<boolean>(false);
  const [runningTask, setRunningTask] = useState<boolean>(false);
  const [approvingTask, setApprovingTask] = useState<boolean>(false);
  const [cancellingTask, setCancellingTask] = useState<boolean>(false);
  const [reschedulingTask, setReschedulingTask] = useState<boolean>(false);
  const [generatingDirectDocument, setGeneratingDirectDocument] = useState<boolean>(false);
  const [draftingDirectEmail, setDraftingDirectEmail] = useState<boolean>(false);
  const [sendingDirectEmail, setSendingDirectEmail] = useState<boolean>(false);
  const [generatingDirectPdf, setGeneratingDirectPdf] = useState<boolean>(false);
  const [error, setError] = useState<HookError | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const pollingTimerRef = useRef<number | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const applySnapshot = useCallback((snapshot: MissionSnapshot) => {
    setActiveMission(snapshot.mission);
    setInterpretation(snapshot.interpretation);
    setTasks(sortByUpdatedDesc(snapshot.tasks));
    setLogs(sortByUpdatedDesc(snapshot.logs));
    setDocuments(sortByUpdatedDesc(snapshot.documents));
    setOutboundEmails(sortByUpdatedDesc(snapshot.outboundEmails));
    setPdfs(sortByUpdatedDesc(snapshot.pdfs));

    if (snapshot.mission) {
      setMissions((prev) => mergeMissionRecord(prev, snapshot.mission));
    }

    setLastUpdatedAt(nowIso());
  }, []);

  const setFocusedMissionId = useCallback((missionId: string | null) => {
    setFocusedMissionIdState(missionId);
  }, []);

  const setActiveMissionFromRecord = useCallback((mission: PierreMissionRecord | null) => {
    setActiveMission(mission);
    setFocusedMissionIdState(mission?.id ?? null);

    if (mission) {
      setMissions((prev) => mergeMissionRecord(prev, mission));
    }
  }, []);

  const refreshMission = useCallback(
    async (missionId?: string | null): Promise<MissionSnapshot | null> => {
      const targetMissionId = missionId ?? focusedMissionId ?? activeMission?.id ?? null;

      if (!targetMissionId) return null;

      setRefreshing(true);
      setError(null);

      try {
        const data = await requestJson<unknown>(
          `/api/pierre/use/mission/${encodeURIComponent(targetMissionId)}`,
          { method: "GET" },
        );

        const snapshot = extractSnapshot(data);
        applySnapshot(snapshot);

        if (snapshot.mission?.id && snapshot.mission.id !== focusedMissionId) {
          setFocusedMissionIdState(snapshot.mission.id);
        }

        return snapshot;
      } catch (caught) {
        const normalized = normalizeError(caught);
        setError(normalized);
        throw normalized;
      } finally {
        if (isMountedRef.current) {
          setRefreshing(false);
          setLoading(false);
        }
      }
    },
    [activeMission?.id, applySnapshot, focusedMissionId],
  );

  const refreshAll = useCallback(
    async (missionId?: string | null): Promise<MissionSnapshot | null> => {
      return refreshMission(missionId);
    },
    [refreshMission],
  );

  const submitMission = useCallback(
    async (
      payload: PierreMissionSubmitPayload,
    ): Promise<{
      mission: PierreMissionRecord | null;
      interpretation: PierreMissionInterpretation | null;
      tasks: PierreTaskRecord[];
    }> => {
      setSubmittingMission(true);
      setError(null);

      try {
        const data = await requestJson<unknown>("/api/pierre/use/submit", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const snapshot = extractSnapshot(data);
        applySnapshot(snapshot);

        if (snapshot.mission?.id) {
          setFocusedMissionIdState(snapshot.mission.id);
        }

        return {
          mission: snapshot.mission,
          interpretation: snapshot.interpretation,
          tasks: snapshot.tasks,
        };
      } catch (caught) {
        const normalized = normalizeError(caught);
        setError(normalized);
        throw normalized;
      } finally {
        if (isMountedRef.current) {
          setSubmittingMission(false);
          setLoading(false);
        }
      }
    },
    [applySnapshot],
  );

  const runTask = useCallback(
    async (payload: PierreTaskActionPayload): Promise<Record<string, unknown> | null> => {
      setRunningTask(true);
      setError(null);

      try {
        const data = await requestJson<Record<string, unknown>>(
          `/api/pierre/use/task/${encodeURIComponent(payload.taskId)}/run`,
          {
            method: "POST",
            body: JSON.stringify(payload.body ?? {}),
          },
        );

        await refreshMission(payload.missionId);
        return data;
      } catch (caught) {
        const normalized = normalizeError(caught);
        setError(normalized);
        throw normalized;
      } finally {
        if (isMountedRef.current) {
          setRunningTask(false);
        }
      }
    },
    [refreshMission],
  );

  const approveTask = useCallback(
    async (payload: PierreTaskActionPayload): Promise<Record<string, unknown> | null> => {
      setApprovingTask(true);
      setError(null);

      try {
        const data = await requestJson<Record<string, unknown>>(
          `/api/pierre/use/task/${encodeURIComponent(payload.taskId)}/approve`,
          {
            method: "POST",
            body: JSON.stringify(payload.body ?? {}),
          },
        );

        await refreshMission(payload.missionId);
        return data;
      } catch (caught) {
        const normalized = normalizeError(caught);
        setError(normalized);
        throw normalized;
      } finally {
        if (isMountedRef.current) {
          setApprovingTask(false);
        }
      }
    },
    [refreshMission],
  );

  const cancelTask = useCallback(
    async (payload: PierreTaskActionPayload): Promise<Record<string, unknown> | null> => {
      setCancellingTask(true);
      setError(null);

      try {
        const data = await requestJson<Record<string, unknown>>(
          `/api/pierre/use/task/${encodeURIComponent(payload.taskId)}/cancel`,
          {
            method: "POST",
            body: JSON.stringify(payload.body ?? {}),
          },
        );

        await refreshMission(payload.missionId);
        return data;
      } catch (caught) {
        const normalized = normalizeError(caught);
        setError(normalized);
        throw normalized;
      } finally {
        if (isMountedRef.current) {
          setCancellingTask(false);
        }
      }
    },
    [refreshMission],
  );

  const rescheduleTask = useCallback(
    async (
      payload: PierreTaskReschedulePayload,
    ): Promise<Record<string, unknown> | null> => {
      setReschedulingTask(true);
      setError(null);

      try {
        const data = await requestJson<Record<string, unknown>>(
          `/api/pierre/use/task/${encodeURIComponent(payload.taskId)}/reschedule`,
          {
            method: "POST",
            body: JSON.stringify({
              scheduledFor: payload.scheduledFor,
              reason: payload.reason ?? null,
            }),
          },
        );

        await refreshMission(payload.missionId);
        return data;
      } catch (caught) {
        const normalized = normalizeError(caught);
        setError(normalized);
        throw normalized;
      } finally {
        if (isMountedRef.current) {
          setReschedulingTask(false);
        }
      }
    },
    [refreshMission],
  );

  const generateDirectDocument = useCallback(
    async (payload: PierreDirectDocumentPayload): Promise<PierreDocumentRecord | null> => {
      setGeneratingDirectDocument(true);
      setError(null);

      try {
        const data = await requestJson<unknown>("/api/pierre/doc/generate", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const source = isObject(data) ? data : {};
        const document =
          normalizeDocument(source.document) ||
          normalizeDocument(isObject(source.data) ? source.data.document : null) ||
          normalizeDocument(isObject(source.result) ? source.result.document : null) ||
          normalizeDocument(data);

        if (document) {
          setDirectDocuments((prev) => mergeArtifactRecord(prev, document));
        }

        const targetMissionId = payload.missionId ?? focusedMissionId ?? activeMission?.id ?? null;
        if (targetMissionId) {
          await refreshMission(targetMissionId);
        } else {
          setLastUpdatedAt(nowIso());
        }

        return document;
      } catch (caught) {
        const normalized = normalizeError(caught);
        setError(normalized);
        throw normalized;
      } finally {
        if (isMountedRef.current) {
          setGeneratingDirectDocument(false);
        }
      }
    },
    [activeMission?.id, focusedMissionId, refreshMission],
  );

  const draftDirectEmail = useCallback(
    async (payload: PierreDirectEmailPayload): Promise<PierreOutboundEmailRecord | null> => {
      setDraftingDirectEmail(true);
      setError(null);

      try {
        const data = await requestJson<unknown>("/api/pierre/email/draft", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const source = isObject(data) ? data : {};
        const email =
          normalizeEmail(source.email) ||
          normalizeEmail(source.draft) ||
          normalizeEmail(isObject(source.data) ? source.data.email ?? source.data.draft : null) ||
          normalizeEmail(isObject(source.result) ? source.result.email ?? source.result.draft : null) ||
          normalizeEmail(data);

        if (email) {
          setDirectEmails((prev) => mergeArtifactRecord(prev, email));
        }

        const targetMissionId = payload.missionId ?? focusedMissionId ?? activeMission?.id ?? null;
        if (targetMissionId) {
          await refreshMission(targetMissionId);
        } else {
          setLastUpdatedAt(nowIso());
        }

        return email;
      } catch (caught) {
        const normalized = normalizeError(caught);
        setError(normalized);
        throw normalized;
      } finally {
        if (isMountedRef.current) {
          setDraftingDirectEmail(false);
        }
      }
    },
    [activeMission?.id, focusedMissionId, refreshMission],
  );

  const sendDirectEmail = useCallback(
    async (payload: PierreDirectEmailPayload): Promise<PierreOutboundEmailRecord | null> => {
      setSendingDirectEmail(true);
      setError(null);

      try {
        const data = await requestJson<unknown>("/api/pierre/email/send", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const source = isObject(data) ? data : {};
        const email =
          normalizeEmail(source.email) ||
          normalizeEmail(source.sent) ||
          normalizeEmail(isObject(source.data) ? source.data.email ?? source.data.sent : null) ||
          normalizeEmail(isObject(source.result) ? source.result.email ?? source.result.sent : null) ||
          normalizeEmail(data);

        if (email) {
          setDirectEmails((prev) => mergeArtifactRecord(prev, email));
        }

        const targetMissionId = payload.missionId ?? focusedMissionId ?? activeMission?.id ?? null;
        if (targetMissionId) {
          await refreshMission(targetMissionId);
        } else {
          setLastUpdatedAt(nowIso());
        }

        return email;
      } catch (caught) {
        const normalized = normalizeError(caught);
        setError(normalized);
        throw normalized;
      } finally {
        if (isMountedRef.current) {
          setSendingDirectEmail(false);
        }
      }
    },
    [activeMission?.id, focusedMissionId, refreshMission],
  );

  const generateDirectPdf = useCallback(
    async (payload: PierreDirectPdfPayload): Promise<PierrePdfRecord | null> => {
      setGeneratingDirectPdf(true);
      setError(null);

      try {
        const data = await requestJson<unknown>("/api/pierre/pdf/generate", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const source = isObject(data) ? data : {};
        const pdf =
          normalizePdf(source.pdf) ||
          normalizePdf(source.file) ||
          normalizePdf(isObject(source.data) ? source.data.pdf ?? source.data.file : null) ||
          normalizePdf(isObject(source.result) ? source.result.pdf ?? source.result.file : null) ||
          normalizePdf(data);

        if (pdf) {
          setDirectPdfs((prev) => mergeArtifactRecord(prev, pdf));
        }

        const targetMissionId = payload.missionId ?? focusedMissionId ?? activeMission?.id ?? null;
        if (targetMissionId) {
          await refreshMission(targetMissionId);
        } else {
          setLastUpdatedAt(nowIso());
        }

        return pdf;
      } catch (caught) {
        const normalized = normalizeError(caught);
        setError(normalized);
        throw normalized;
      } finally {
        if (isMountedRef.current) {
          setGeneratingDirectPdf(false);
        }
      }
    },
    [activeMission?.id, focusedMissionId, refreshMission],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (pollingTimerRef.current !== null) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!resolvedOptions.autoLoad) {
      setLoading(false);
      return;
    }

    const initialMissionId = resolvedOptions.initialFocusedMissionId ?? null;
    if (!initialMissionId) {
      setLoading(false);
      return;
    }

    void refreshMission(initialMissionId);

    // mount/options only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedOptions.autoLoad, resolvedOptions.initialFocusedMissionId]);

  useEffect(() => {
    if (!resolvedOptions.autoPoll) {
      if (pollingTimerRef.current !== null) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    const pollNeeded = shouldPollMission(activeMission, tasks);

    if (!pollNeeded) {
      if (pollingTimerRef.current !== null) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    if (pollingTimerRef.current !== null) {
      window.clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    pollingTimerRef.current = window.setInterval(() => {
      const missionId = focusedMissionId ?? activeMission?.id ?? null;
      if (!missionId) return;

      void refreshMission(missionId).catch(() => undefined);
    }, Math.max(2500, resolvedOptions.pollIntervalMs));

    return () => {
      if (pollingTimerRef.current !== null) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [
    activeMission,
    focusedMissionId,
    refreshMission,
    resolvedOptions.autoPoll,
    resolvedOptions.pollIntervalMs,
    tasks,
  ]);

  const hasActiveExecution = useMemo(() => {
    return shouldPollMission(activeMission, tasks);
  }, [activeMission, tasks]);

  const awaitingApprovalCount = useMemo(() => {
    return tasks.filter((task) => normalizeTaskStatus(task.status) === "awaiting_approval").length;
  }, [tasks]);

  const blockedCount = useMemo(() => {
    return tasks.filter((task) => normalizeTaskStatus(task.status) === "blocked").length;
  }, [tasks]);

  const completedCount = useMemo(() => {
    return tasks.filter((task) => normalizeTaskStatus(task.status) === "completed").length;
  }, [tasks]);

  return {
    mission: activeMission,
    hasActiveTask: tasks.some((task) => {
      const status = normalizeTaskStatus(task.status);
      return ["pending", "queued", "scheduled", "running", "ready"].includes(status);
    }),
    submitting: submittingMission,
    missions,
    activeMission,
    focusedMissionId,
    interpretation,
    tasks,
    logs,
    documents,
    outboundEmails,
    pdfs,
    directDocuments,
    directEmails,
    directPdfs,
    loading,
    refreshing,
    submittingMission,
    runningTask,
    approvingTask,
    cancellingTask,
    reschedulingTask,
    generatingDirectDocument,
    draftingDirectEmail,
    sendingDirectEmail,
    generatingDirectPdf,
    error,
    lastUpdatedAt,
    setFocusedMissionId,
    clearError,
    setActiveMissionFromRecord,
    submitMission,
    refreshMission,
    refreshAll,
    runTask,
    approveTask,
    cancelTask,
    rescheduleTask,
    generateDirectDocument,
    draftDirectEmail,
    sendDirectEmail,
    generateDirectPdf,
    hasActiveExecution,
    awaitingApprovalCount,
    blockedCount,
    completedCount,
  };
}
export { usePierreMissionCenter };
export type PierreTask = PierreTaskRecord;
export type PierreDocument = PierreDocumentRecord;
export type PierreOutboundEmail = PierreOutboundEmailRecord;
export type PierreApiMissingInfoItem = {
  key?: string | null;
  code?: string | null;
  label?: string | null;
  question?: string | null;
  required?: boolean | null;
  reason?: string | null;
  [key: string]: unknown;
};





