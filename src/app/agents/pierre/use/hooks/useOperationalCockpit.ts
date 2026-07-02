"use client";

// P9.3 — Hook d'orchestration du cockpit opérationnel client.
//
// Source unique de données : runtime V1 via les clients existants
// (`src/lib/pierre/cockpit/api-client`), mappés en modèles canoniques via
// `src/lib/client-cockpit`. AUCUN composant ne lit de JSON brut : tout passe ici.
// Polling borné (onglet caché → pause, backoff, AbortController), état stale,
// mutations idempotentes côté UI (une mutation active à la fois).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  submitPierreMission,
  fetchPierreHistory,
  fetchPierreMission,
  fetchPierreMissionValidations,
  fetchPierreMissionTimeline,
  fetchPierreEmployeesV1,
  approvePierreValidation,
  rejectPierreValidation,
  requestPierreValidationChanges,
  cancelPierreMission,
} from "@/lib/pierre/cockpit/api-client";
import {
  buildOverview,
  mapV1MissionList,
  mapV1MissionView,
  mapV1Tasks,
  mapV1Validations,
  mapV1Timeline,
  mapV1Employees,
  deriveV1Artifacts,
  groupTimeline,
  DEFAULT_PERMISSIONS,
  type CockpitArtifact,
  type CockpitEmployeeListItem,
  type CockpitMissionSummary,
  type CockpitOverview,
  type CockpitPermissions,
  type CockpitTask,
  type CockpitTimelineEvent,
  type CockpitValidation,
  type CockpitTimelineGroup,
} from "@/lib/client-cockpit";

const POLL_MS = 12000;
const STALE_MS = 60000;
const DETAIL_CAP = 12;

export type CockpitPhase = "loading" | "ready" | "error";
export type DecisionKind = "approve" | "reject" | "request_changes";

export interface MissionDetail {
  mission: CockpitMissionSummary;
  tasks: CockpitTask[];
  validations: CockpitValidation[];
  artifacts: CockpitArtifact[];
  timeline: CockpitTimelineEvent[];
  timelineGroups: CockpitTimelineGroup[];
}

export interface CreateMissionResult {
  ok: boolean;
  missionId?: string;
  error?: string;
  uncertain?: boolean;
}
export interface DecisionResult {
  ok: boolean;
  error?: string;
  stale?: boolean;
}

interface Aggregate {
  missions: CockpitMissionSummary[];
  validations: CockpitValidation[];
  artifacts: CockpitArtifact[];
  tasks: CockpitTask[];
}

function isTerminal(status: CockpitMissionSummary["status"]): boolean {
  return status === "done" || status === "cancelled";
}

export function useOperationalCockpit() {
  const [phase, setPhase] = useState<CockpitPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [agg, setAgg] = useState<Aggregate>({ missions: [], validations: [], artifacts: [], tasks: [] });
  const [employees, setEmployees] = useState<CockpitEmployeeListItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [missionDetail, setMissionDetail] = useState<MissionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [mutating, setMutating] = useState(false);

  const permissions: CockpitPermissions = DEFAULT_PERMISSIONS; // serveur = autorité finale à chaque mutation
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const backoffRef = useRef(0);

  // ── Chargement agrégé (liste + enrichissement borné) ──────────────────────
  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (opts.silent) setRefreshing(true);
    else setPhase((p) => (p === "ready" ? p : "loading"));
    try {
      const listRes = await fetchPierreHistory({ limit: 50 });
      if (listRes.status === 401) {
        if (mountedRef.current) { setAuthRequired(true); setPhase("error"); }
        return;
      }
      if (!listRes.ok) {
        if (mountedRef.current) { setError(humanError(listRes.error)); setPhase((p) => (p === "ready" ? p : "error")); }
        backoffRef.current = Math.min(backoffRef.current + 1, 4);
        return;
      }
      setAuthRequired(false);
      const { missions: listMissions } = mapV1MissionList(listRes.data);

      // Salariés réels (tenant résolu serveur) — quick-list ; le détail vit dans Employee 360.
      fetchPierreEmployeesV1().then((empRes) => {
        if (mountedRef.current && empRes.ok) setEmployees(mapV1Employees(empRes.data));
      }).catch(() => { /* liste salariés non bloquante */ });

      // Enrichir les missions non terminales (bornées) : détail + validations.
      const toEnrich = listMissions.filter((m) => !isTerminal(m.status)).slice(0, DETAIL_CAP);
      const details = await Promise.all(
        toEnrich.map(async (m) => {
          const [detailRes, valRes] = await Promise.all([
            fetchPierreMission(m.id),
            fetchPierreMissionValidations(m.id),
          ]);
          const view = detailRes.ok ? mapV1MissionView(detailRes.data) : null;
          const tasks = detailRes.ok ? mapV1Tasks(unwrapTasks(detailRes.data), m.id) : [];
          const tasksById = new Map(tasks.map((t) => [t.id, t]));
          const validations = valRes.ok
            ? mapV1Validations(valRes.data, { permissions, missionId: m.id, tasksById })
            : [];
          const artifacts = detailRes.ok ? deriveV1Artifacts(unwrapTasks(detailRes.data), { permissions, missionId: m.id }) : [];
          return { id: m.id, view, tasks, validations, artifacts };
        }),
      );

      const enrichedById = new Map(details.map((d) => [d.id, d]));
      const missions = listMissions.map((m) => enrichedById.get(m.id)?.view ?? m);
      const validations = details.flatMap((d) => d.validations);
      const artifacts = details.flatMap((d) => d.artifacts);
      const tasks = details.flatMap((d) => d.tasks);

      if (!mountedRef.current) return;
      setAgg({ missions, validations, artifacts, tasks });
      setError(null);
      setPhase("ready");
      setStale(false);
      setLastUpdated(new Date().toISOString());
      backoffRef.current = 0;
    } catch (e) {
      if (mountedRef.current) {
        setError(humanError(e instanceof Error ? e.message : null));
        setPhase((p) => (p === "ready" ? p : "error"));
      }
      backoffRef.current = Math.min(backoffRef.current + 1, 4);
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setRefreshing(false);
    }
  }, [permissions]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => { mountedRef.current = false; };
  }, [load]);

  // ── Polling borné : uniquement si mission active, pause onglet caché ──────
  const hasActiveWork = useMemo(
    () => agg.missions.some((m) => m.status === "in_progress" || m.status === "awaiting_approval"),
    [agg.missions],
  );
  useEffect(() => {
    if (phase !== "ready" || !hasActiveWork) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const delay = POLL_MS * (1 + backoffRef.current) * (hidden ? 4 : 1);
      timer = setTimeout(async () => {
        if (typeof document === "undefined" || document.visibilityState !== "hidden") {
          await load({ silent: true });
        }
        tick();
      }, delay);
    };
    tick();
    return () => clearTimeout(timer);
  }, [phase, hasActiveWork, load]);

  // ── Marqueur stale après seuil ────────────────────────────────────────────
  useEffect(() => {
    if (!lastUpdated) return;
    const t = setTimeout(() => mountedRef.current && setStale(true), STALE_MS);
    return () => clearTimeout(t);
  }, [lastUpdated]);

  // ── Détail mission ────────────────────────────────────────────────────────
  const loadDetail = useCallback(async (missionId: string) => {
    setLoadingDetail(true);
    try {
      const [detailRes, valRes, timelineRes] = await Promise.all([
        fetchPierreMission(missionId),
        fetchPierreMissionValidations(missionId),
        fetchPierreMissionTimeline(missionId),
      ]);
      const view = detailRes.ok ? mapV1MissionView(detailRes.data) : null;
      if (!view) { if (mountedRef.current) setMissionDetail(null); return; }
      const tasks = mapV1Tasks(unwrapTasks(detailRes.data), missionId);
      const tasksById = new Map(tasks.map((t) => [t.id, t]));
      const validations = valRes.ok ? mapV1Validations(valRes.data, { permissions, missionId, tasksById }) : [];
      const artifacts = deriveV1Artifacts(unwrapTasks(detailRes.data), { permissions, missionId });
      const timeline = timelineRes.ok ? mapV1Timeline(timelineRes.data) : [];
      if (!mountedRef.current) return;
      setMissionDetail({ mission: view, tasks, validations, artifacts, timeline, timelineGroups: groupTimeline(timeline) });
    } finally {
      if (mountedRef.current) setLoadingDetail(false);
    }
  }, [permissions]);

  const selectMission = useCallback((missionId: string | null) => {
    setActiveMissionId(missionId);
    setMissionDetail(null);
    if (missionId) void loadDetail(missionId);
  }, [loadDetail]);

  // ── Création de mission (idempotence UI : une mutation active) ─────────────
  const createMission = useCallback(async (input: string): Promise<CreateMissionResult> => {
    const clean = input.trim();
    if (!clean) return { ok: false, error: "Décrivez la mission à confier à Pierre." };
    if (mutating) return { ok: false, error: "Une action est déjà en cours." };
    setMutating(true);
    try {
      const res = await submitPierreMission({ input: clean, source: "cockpit" });
      if (res.status === 401) { setAuthRequired(true); return { ok: false, error: "Session expirée." }; }
      if (!res.ok) {
        // Réseau ambigu (status 0) → ne pas réémettre ; vérifier via reload.
        if (res.status === 0) {
          await load({ silent: true });
          const found = agg.missions.find((m) => m.title.trim() === clean);
          return found ? { ok: true, missionId: found.id } : { ok: false, uncertain: true, error: "Vérification de la création…" };
        }
        return { ok: false, error: humanError(res.error) };
      }
      const view = mapV1MissionView(res.data);
      await load({ silent: true });
      const missionId = view?.id ?? null;
      if (missionId) selectMission(missionId);
      return { ok: true, missionId: missionId ?? undefined };
    } finally {
      setMutating(false);
    }
  }, [mutating, load, agg.missions, selectMission]);

  // ── Décision de validation (version obligatoire, relecture serveur) ────────
  const decideValidation = useCallback(async (
    validationId: string,
    version: number,
    kind: DecisionKind,
  ): Promise<DecisionResult> => {
    if (mutating) return { ok: false, error: "Une décision est déjà en cours." };
    setMutating(true);
    try {
      const fn = kind === "approve" ? approvePierreValidation : kind === "reject" ? rejectPierreValidation : requestPierreValidationChanges;
      const res = await fn(validationId, version);
      if (res.status === 401) { setAuthRequired(true); return { ok: false, error: "Session expirée." }; }
      if (res.status === 409 || res.status === 412) {
        await refreshActive();
        return { ok: false, stale: true, error: "Cette validation a déjà changé. Elle a été actualisée." };
      }
      if (!res.ok) return { ok: false, error: humanError(res.error) };
      await refreshActive();
      return { ok: true };
    } finally {
      setMutating(false);
    }
    async function refreshActive() {
      await load({ silent: true });
      if (activeMissionId) await loadDetail(activeMissionId);
    }
  }, [mutating, load, activeMissionId, loadDetail]);

  const doCancelMission = useCallback(async (missionId: string): Promise<DecisionResult> => {
    if (mutating) return { ok: false, error: "Une action est déjà en cours." };
    setMutating(true);
    try {
      const res = await cancelPierreMission(missionId);
      if (!res.ok) return { ok: false, error: humanError(res.error) };
      await load({ silent: true });
      if (activeMissionId === missionId) await loadDetail(missionId);
      return { ok: true };
    } finally {
      setMutating(false);
    }
  }, [mutating, load, activeMissionId, loadDetail]);

  // ── Dérivés ───────────────────────────────────────────────────────────────
  const overview: CockpitOverview = useMemo(
    () => buildOverview({ missions: agg.missions, tasks: agg.tasks, validations: agg.validations, artifacts: agg.artifacts }),
    [agg],
  );
  const pendingValidations = useMemo(() => agg.validations.filter((v) => v.status === "pending"), [agg.validations]);

  return {
    phase,
    error,
    authRequired,
    overview,
    missions: agg.missions,
    validations: agg.validations,
    pendingValidations,
    artifacts: agg.artifacts,
    employees,
    permissions,
    lastUpdated,
    stale,
    refreshing,
    mutating,
    activeMissionId,
    missionDetail,
    loadingDetail,
    refresh: () => load({ silent: true }),
    selectMission,
    createMission,
    decideValidation,
    cancelMission: doCancelMission,
  } as const;
}

// ── helpers ───────────────────────────────────────────────────────────────
function unwrapTasks(data: unknown): unknown {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.tasks)) return o.tasks;
    if (o.mission && typeof o.mission === "object" && Array.isArray((o.mission as Record<string, unknown>).tasks)) {
      return (o.mission as Record<string, unknown>).tasks;
    }
  }
  return data;
}

function humanError(code: string | null | undefined): string {
  const c = (code ?? "").toLowerCase();
  if (!c) return "Une erreur est survenue. Réessayez dans un instant.";
  if (c.includes("auth")) return "Votre session a expiré. Reconnectez-vous.";
  if (c.includes("forbidden") || c.includes("403")) return "Vous n'avez pas accès à cette ressource.";
  if (c.includes("network") || c.includes("réseau")) return "Connexion interrompue. Vérifiez votre réseau.";
  if (c.includes("suspended")) return "L'accès à Pierre n'est pas actif pour le moment.";
  return "Une erreur est survenue. Réessayez dans un instant.";
}
