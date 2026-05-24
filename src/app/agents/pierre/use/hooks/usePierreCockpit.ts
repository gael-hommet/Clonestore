"use client";

// src/app/agents/pierre/use/hooks/usePierreCockpit.ts
// Pierre Cockpit B31.2 — Main unified hook.
// B31.2 changes:
//   - On mount: ONLY loads AI status + RC status (2 lightweight calls).
//   - All other data is loaded lazily when the user opens a workspace.
//   - 60s TTL cache per workspace to avoid redundant re-fetches.
//   - authRequired: true stops ALL automatic fetches and polling.
//   - Auth errors do NOT leak into globalError / the chat.

import { useCallback, useEffect, useRef, useState } from "react";
import { getSessionClient } from "@/lib/auth/session-client";

import type {
  PierreCockpitWorkspace,
  PierreCockpitMessage,
  PierreCockpitCard,
  PierreCockpitMissionSummary,
  PierreCockpitTaskSummary,
  PierreCockpitDocumentSummary,
  PierreCockpitEmployeeSummary,
  PierreCockpitValidationSummary,
  PierreCockpitROI,
  PierreCockpitCloneADNSummary,
  PierreCockpitRCStatus,
  PierreCockpitScenarioSummary,
  PierreCockpitAIStatus,
  PierreCockpitActionResult,
} from "@/lib/pierre/cockpit/types";

import {
  normalizeMissionResponse,
  normalizeTaskList,
  normalizeDocumentList,
  normalizeEmployeeFileIndex,
  normalizeCloneADNProfile,
  normalizeCustomerSuccessReport,
  normalizeReleaseCandidateReport,
  normalizeGoldenScenarios,
  extractValidationAlerts,
  extractCockpitCardsFromMission,
  normalizeAIStatus,
} from "@/lib/pierre/cockpit/normalizers";

import {
  submitPierreMission,
  fetchPierreMission,
  approvePierreTask,
  cancelPierreTask,
  runPierreTask,
  reschedulePierreTask,
  fetchPierreEmployeesFiles,
  fetchPierreEmployeeFile,
  fetchPierreCloneADN,
  updatePierreCloneADN,
  fetchPierreDocumentTemplates,
  previewPierreDocumentTemplate,
  fetchPierreCustomerSuccess,
  fetchPierreReleaseCandidate,
  fetchPierreScenarios,
  runPierreScenario,
  runPierreScenarioSuite,
  fetchCloneOSAIStatus,
} from "@/lib/pierre/cockpit/api-client";

import { isAuthFailure } from "@/lib/pierre/cockpit/auth-helpers";

// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════

const STORAGE_KEY = "clonestore:pierre:cockpit:b31:v1";
const WORKSPACE_TTL_MS = 60_000; // 60 seconds TTL per workspace data

// ══════════════════════════════════════════════════════════════
// LOCAL STORAGE
// ══════════════════════════════════════════════════════════════

type StoredState = {
  activeWorkspace: PierreCockpitWorkspace;
  sidebarCollapsed: boolean;
  activeMissionId: string | null;
  inputDraft: string;
};

function readStorage(): Partial<StoredState> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<StoredState>;
  } catch {
    return {};
  }
}

function writeStorage(state: StoredState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function makeId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ══════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════

export function usePierreCockpit() {
  // ── Navigation ────────────────────────────────────────────
  const [activeWorkspace, setActiveWorkspace] = useState<PierreCockpitWorkspace>("mission");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Mission state ─────────────────────────────────────────
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [activeMission, setActiveMission] = useState<PierreCockpitMissionSummary | null>(null);
  const [tasks, setTasks] = useState<PierreCockpitTaskSummary[]>([]);
  const [documents, setDocuments] = useState<PierreCockpitDocumentSummary[]>([]);
  const [validations, setValidations] = useState<PierreCockpitValidationSummary[]>([]);
  const [cards, setCards] = useState<PierreCockpitCard[]>([]);

  // ── Chat messages ─────────────────────────────────────────
  const [messages, setMessages] = useState<PierreCockpitMessage[]>([]);
  const [inputDraft, setInputDraft] = useState("");

  // ── Employees ────────────────────────────────────────────
  const [employees, setEmployees] = useState<PierreCockpitEmployeeSummary[]>([]);

  // ── CloneADN ──────────────────────────────────────────────
  const [cloneADN, setCloneADN] = useState<PierreCockpitCloneADNSummary | null>(null);

  // ── Value / Customer Success ───────────────────────────────
  const [roi, setRoi] = useState<PierreCockpitROI | null>(null);

  // ── Release Candidate ─────────────────────────────────────
  const [rcStatus, setRcStatus] = useState<PierreCockpitRCStatus | null>(null);

  // ── Scenarios ─────────────────────────────────────────────
  const [scenarios, setScenarios] = useState<PierreCockpitScenarioSummary[]>([]);

  // ── AI Status ────────────────────────────────────────────
  const [aiStatus, setAiStatus] = useState<PierreCockpitAIStatus | null>(null);

  // ── Auth ──────────────────────────────────────────────────
  const [authRequired, setAuthRequired] = useState(false);
  const authRequiredRef = useRef(false); // sync ref for use inside async functions

  // ── Loading / error states ────────────────────────────────
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingMission, setLoadingMission] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // ── Document templates raw ────────────────────────────────
  const [documentTemplates, setDocumentTemplates] = useState<Record<string, unknown>[]>([]);

  // ── Raw mission data (for components that need it) ────────
  const [rawMission, setRawMission] = useState<Record<string, unknown> | null>(null);

  // ── Polling ───────────────────────────────────────────────
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Workspace TTL cache ───────────────────────────────────
  const workspaceLoadedAt = useRef<Record<string, number>>({});

  // ── TTL helpers ───────────────────────────────────────────
  function isFresh(key: string): boolean {
    const t = workspaceLoadedAt.current[key];
    return !!t && Date.now() - t < WORKSPACE_TTL_MS;
  }

  function markFresh(key: string): void {
    workspaceLoadedAt.current[key] = Date.now();
  }

  // ── Auth detection ────────────────────────────────────────
  // Returns true if the response is an auth failure — caller should abort.
  function checkAuth(res: PierreCockpitActionResult): boolean {
    if (authRequiredRef.current) return true;
    if (isAuthFailure(res.status ?? 0, res.error)) {
      authRequiredRef.current = true;
      setAuthRequired(true);
      // Stop mission polling immediately
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return true;
    }
    return false;
  }

  // ── Restore from localStorage on mount ───────────────────
  useEffect(() => {
    const saved = readStorage();
    if (saved.activeWorkspace) setActiveWorkspace(saved.activeWorkspace);
    if (saved.sidebarCollapsed !== undefined) setSidebarCollapsed(saved.sidebarCollapsed);
    if (saved.activeMissionId) setActiveMissionId(saved.activeMissionId);
    if (saved.inputDraft) setInputDraft(saved.inputDraft);
  }, []);

  // ── Persist to localStorage ────────────────────────────────
  useEffect(() => {
    writeStorage({ activeWorkspace, sidebarCollapsed, activeMissionId, inputDraft });
  }, [activeWorkspace, sidebarCollapsed, activeMissionId, inputDraft]);

  // ── Initial lightweight data fetch on mount ───────────────
  // Only fetches AI status + RC — 2 fast calls, nothing heavy.
  useEffect(() => {
    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auth state change listener ────────────────────────────
  // Auto-recovers when user signs in (e.g., from another tab).
  // Auto-gates when user signs out.
  useEffect(() => {
    const { data: { subscription } } = getSessionClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && authRequiredRef.current) {
        authRequiredRef.current = false;
        setAuthRequired(false);
        workspaceLoadedAt.current = {};
        void loadInitialData();
      } else if (event === "SIGNED_OUT") {
        authRequiredRef.current = true;
        setAuthRequired(true);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInitialData() {
    if (authRequiredRef.current) return;

    const [rcRes, aiRes] = await Promise.allSettled([
      fetchPierreReleaseCandidate(),
      fetchCloneOSAIStatus(),
    ]);

    if (rcRes.status === "fulfilled") {
      if (checkAuth(rcRes.value)) return;
      if (rcRes.value.ok) setRcStatus(normalizeReleaseCandidateReport(rcRes.value.data));
    }
    if (aiRes.status === "fulfilled") {
      if (checkAuth(aiRes.value)) return;
      if (aiRes.value.ok) setAiStatus(normalizeAIStatus(aiRes.value.data));
    }

    markFresh("initial");
  }

  // ── Lazy workspace data loading ───────────────────────────
  // Called when a workspace is opened. Respects TTL (60s) to avoid refetching.
  async function loadWorkspaceData(workspace: PierreCockpitWorkspace): Promise<void> {
    if (authRequiredRef.current) return;

    switch (workspace) {
      case "employees": {
        if (isFresh("employees")) return;
        setLoadingEmployees(true);
        try {
          const res = await fetchPierreEmployeesFiles();
          if (checkAuth(res)) return;
          if (res.ok) {
            setEmployees(normalizeEmployeeFileIndex(res.data));
            markFresh("employees");
          }
        } finally {
          setLoadingEmployees(false);
        }
        break;
      }

      case "cloneadn": {
        if (isFresh("cloneadn")) return;
        const res = await fetchPierreCloneADN();
        if (checkAuth(res)) return;
        if (res.ok) {
          setCloneADN(normalizeCloneADNProfile(res.data));
          markFresh("cloneadn");
        }
        break;
      }

      case "scenarios": {
        if (isFresh("scenarios")) return;
        const res = await fetchPierreScenarios();
        if (checkAuth(res)) return;
        if (res.ok) {
          setScenarios(normalizeGoldenScenarios(res.data));
          markFresh("scenarios");
        }
        break;
      }

      case "value": {
        if (isFresh("value")) return;
        const res = await fetchPierreCustomerSuccess();
        if (checkAuth(res)) return;
        if (res.ok) {
          setRoi(normalizeCustomerSuccessReport(res.data));
          markFresh("value");
        }
        break;
      }

      case "settings": {
        if (isFresh("settings")) return;
        const res = await fetchPierreDocumentTemplates();
        if (checkAuth(res)) return;
        if (res.ok) {
          const tpl = (res.data as Record<string, unknown>)?.templates;
          if (Array.isArray(tpl)) {
            setDocumentTemplates(tpl as Record<string, unknown>[]);
          }
          markFresh("settings");
        }
        break;
      }

      // mission/validations/documents/emails/pdf/trace: data comes from refreshMission or messages
      default:
        break;
    }
  }

  // ── Mission refresh ────────────────────────────────────────
  const refreshMission = useCallback(async (missionId: string): Promise<void> => {
    if (!missionId || authRequiredRef.current) return;
    setLoadingMission(true);
    try {
      const res = await fetchPierreMission(missionId);
      if (checkAuth(res)) return;
      if (res.ok && res.data) {
        const raw = res.data as Record<string, unknown>;
        setRawMission(raw);

        const missionSummary = normalizeMissionResponse(raw);
        if (missionSummary) setActiveMission(missionSummary);

        const taskList = normalizeTaskList(raw.tasks ?? []);
        setTasks(taskList);

        const docList = normalizeDocumentList(raw.documents ?? []);
        setDocuments(docList);

        const validationList = extractValidationAlerts(taskList);
        setValidations(validationList);

        const newCards = extractCockpitCardsFromMission(missionSummary, taskList, docList);
        setCards(newCards);
      }
    } finally {
      setLoadingMission(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-refresh on mission change ────────────────────────
  useEffect(() => {
    if (activeMissionId && !authRequiredRef.current) {
      void refreshMission(activeMissionId);
    }
  }, [activeMissionId, refreshMission]);

  // ── Polling for active missions ────────────────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;

    if (!activeMissionId || authRequiredRef.current) return;

    const hasRunning = tasks.some((t) => {
      const s = t.status.toLowerCase();
      return s === "running" || s === "queued" || s === "pending";
    });

    if (!hasRunning) return;

    pollRef.current = setInterval(() => {
      if (!authRequiredRef.current && activeMissionId) {
        void refreshMission(activeMissionId);
      }
    }, 12000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeMissionId, tasks, refreshMission]);

  // ── Submit mission ────────────────────────────────────────
  const submitMission = useCallback(
    async (input: string): Promise<PierreCockpitActionResult> => {
      if (!input.trim()) return { ok: false, error: "La mission ne peut pas être vide." };
      if (authRequiredRef.current) return { ok: false, error: "Connexion requise." };

      setLoadingSubmit(true);
      setGlobalError(null);

      const userMsg: PierreCockpitMessage = {
        id: makeId(),
        role: "user",
        content: input.trim(),
        createdAt: new Date().toISOString(),
        status: "done",
      };
      setMessages((prev) => [...prev, userMsg]);

      const pendingMsg: PierreCockpitMessage = {
        id: makeId(),
        role: "pierre",
        content: "Pierre analyse votre mission…",
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      setMessages((prev) => [...prev, pendingMsg]);

      try {
        const res = await submitPierreMission({ input: input.trim() });

        // Auth failure — show gate, remove pending message, don't show error in chat
        if (checkAuth(res)) {
          setMessages((prev) => prev.filter((m) => m.id !== pendingMsg.id));
          setLoadingSubmit(false);
          return { ok: false, error: "Connexion requise." };
        }

        if (res.ok && res.data) {
          const data = res.data as Record<string, unknown>;
          const missionId = typeof data.mission_id === "string" ? data.mission_id : null;

          if (missionId) {
            setActiveMissionId(missionId);
            await refreshMission(missionId);
          }

          const understanding = data.interpretation || data.understanding || {};
          const summary =
            typeof (understanding as Record<string, unknown>).mission_summary === "string"
              ? ((understanding as Record<string, unknown>).mission_summary as string)
              : "Mission structurée et prise en charge.";

          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingMsg.id
                ? { ...m, content: `Pierre a compris : ${summary}`, status: "done" as const }
                : m,
            ),
          );

          setInputDraft("");
          setActiveWorkspace("mission");
          return res;
        } else {
          const errMsg = res.error ?? "Pierre n'a pas pu traiter la mission.";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingMsg.id ? { ...m, content: errMsg, status: "error" as const } : m,
            ),
          );
          setGlobalError(errMsg);
          return res;
        }
      } finally {
        setLoadingSubmit(false);
      }
    },
    [refreshMission],
  );

  // ── Retry auth ────────────────────────────────────────────
  // Called by AuthGate "Réessayer" button after user has logged in.
  const retryAuth = useCallback(async (): Promise<void> => {
    authRequiredRef.current = false;
    setAuthRequired(false);
    workspaceLoadedAt.current = {};
    await loadInitialData();
    await loadWorkspaceData(activeWorkspace);
    if (activeMissionId) await refreshMission(activeMissionId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace, activeMissionId, refreshMission]);

  // ── Refresh all ───────────────────────────────────────────
  const refreshAll = useCallback(async (): Promise<void> => {
    if (authRequiredRef.current) return;
    // Reset TTL cache so all workspaces reload on next visit
    workspaceLoadedAt.current = {};
    await loadInitialData();
    await loadWorkspaceData(activeWorkspace);
    if (activeMissionId) await refreshMission(activeMissionId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace, activeMissionId, refreshMission]);

  // ── Task actions ──────────────────────────────────────────
  const approveTask = useCallback(
    async (taskId: string): Promise<PierreCockpitActionResult> => {
      const res = await approvePierreTask(taskId);
      if (checkAuth(res)) return res;
      if (res.ok && activeMissionId) void refreshMission(activeMissionId);
      return res;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeMissionId, refreshMission],
  );

  const cancelTask = useCallback(
    async (taskId: string): Promise<PierreCockpitActionResult> => {
      const res = await cancelPierreTask(taskId);
      if (checkAuth(res)) return res;
      if (res.ok && activeMissionId) void refreshMission(activeMissionId);
      return res;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeMissionId, refreshMission],
  );

  const doRunTask = useCallback(
    async (taskId: string): Promise<PierreCockpitActionResult> => {
      const res = await runPierreTask(taskId);
      if (checkAuth(res)) return res;
      if (res.ok && activeMissionId) void refreshMission(activeMissionId);
      return res;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeMissionId, refreshMission],
  );

  const rescheduleTask = useCallback(
    async (taskId: string, payload: Record<string, unknown>): Promise<PierreCockpitActionResult> => {
      const res = await reschedulePierreTask(taskId, payload);
      if (checkAuth(res)) return res;
      if (res.ok && activeMissionId) void refreshMission(activeMissionId);
      return res;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeMissionId, refreshMission],
  );

  // ── Employee ──────────────────────────────────────────────
  const selectEmployeeFile = useCallback(
    async (employeeId: string): Promise<PierreCockpitActionResult> => {
      return fetchPierreEmployeeFile(employeeId);
    },
    [],
  );

  // ── Document preview ──────────────────────────────────────
  const previewDocument = useCallback(
    async (payload: {
      template_id?: string;
      kind?: string;
      variables?: Record<string, string>;
    }): Promise<PierreCockpitActionResult> => {
      return previewPierreDocumentTemplate(payload);
    },
    [],
  );

  // ── CloneADN ──────────────────────────────────────────────
  const doUpdateCloneADN = useCallback(
    async (patch: Record<string, unknown>): Promise<PierreCockpitActionResult> => {
      const res = await updatePierreCloneADN(patch);
      if (res.ok) {
        // Invalidate TTL and reload
        workspaceLoadedAt.current["cloneadn"] = 0;
        const refreshed = await fetchPierreCloneADN();
        if (refreshed.ok) setCloneADN(normalizeCloneADNProfile(refreshed.data));
      }
      return res;
    },
    [],
  );

  // ── Scenario ──────────────────────────────────────────────
  const doRunScenario = useCallback(
    async (scenarioId: string): Promise<PierreCockpitActionResult> => {
      setLoadingScenario(scenarioId);
      try {
        return await runPierreScenario(scenarioId, { dry_run: true, ai_mode: "off" });
      } finally {
        setLoadingScenario(null);
      }
    },
    [],
  );

  const doRunScenarioSuite = useCallback(async (): Promise<PierreCockpitActionResult> => {
    setLoadingScenario("suite");
    try {
      return await runPierreScenarioSuite({ dry_run: true, ai_mode: "off" });
    } finally {
      setLoadingScenario(null);
    }
  }, []);

  // ── Navigation ────────────────────────────────────────────
  // Workspace switch is synchronous (instant UI). Data load is triggered after.
  const openWorkspace = useCallback(
    (workspace: PierreCockpitWorkspace) => {
      setActiveWorkspace(workspace);
      // Fire-and-forget lazy load — does not block the tab switch
      void loadWorkspaceData(workspace);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const selectMission = useCallback((missionId: string | null) => {
    setActiveMissionId(missionId);
    if (missionId) setActiveWorkspace("mission");
  }, []);

  const addLocalMessage = useCallback(
    (content: string, role: "pierre" | "system" = "pierre") => {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role,
          content,
          createdAt: new Date().toISOString(),
          status: "done" as const,
        },
      ]);
    },
    [],
  );

  // ══════════════════════════════════════════════════════════
  // EXPOSED API
  // ══════════════════════════════════════════════════════════

  return {
    // Navigation
    activeWorkspace,
    sidebarCollapsed,
    setSidebarCollapsed,
    openWorkspace,

    // Auth
    authRequired,
    retryAuth,

    // Mission
    activeMissionId,
    activeMission,
    rawMission,
    tasks,
    documents,
    validations,
    cards,
    selectMission,
    refreshMission,
    refreshAll,

    // Chat
    messages,
    inputDraft,
    setInputDraft,
    submitMission,
    addLocalMessage,

    // Employees
    employees,
    loadingEmployees,
    selectEmployeeFile,

    // CloneADN
    cloneADN,
    updateCloneADN: doUpdateCloneADN,

    // Documents
    documentTemplates,
    previewDocument,

    // Customer success / ROI
    roi,

    // RC
    rcStatus,

    // Scenarios
    scenarios,
    runScenario: doRunScenario,
    runScenarioSuite: doRunScenarioSuite,
    loadingScenario,

    // AI
    aiStatus,

    // Task actions
    approveTask,
    cancelTask,
    runTask: doRunTask,
    rescheduleTask,

    // Loading / errors
    loadingSubmit,
    loadingMission,
    globalError,
    setGlobalError,
  } as const;
}

export type PierreCockpitState = ReturnType<typeof usePierreCockpit>;
