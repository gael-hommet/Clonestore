"use client";

import React, { useMemo } from "react";

type TaskStatus =
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
  | "unknown"
  | string;

type RiskLevel = "normal" | "sensitive" | "critical" | "unknown" | string;

type MissionRecord = {
  id?: string | null;
  title?: string | null;
  summary?: string | null;
  status?: string | null;
  risk_level?: RiskLevel | null;
  approval_required?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type TaskRecord = {
  id?: string | null;
  mission_id?: string | null;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  status?: TaskStatus | null;
  risk_level?: RiskLevel | null;
  approval_required?: boolean | null;
  scheduled_for?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  blocked_reason?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  payload?: unknown;
  result?: unknown;
  [key: string]: unknown;
};

type LogRecord = {
  id?: string | null;
  task_id?: string | null;
  mission_id?: string | null;
  level?: string | null;
  event?: string | null;
  message?: string | null;
  created_at?: string | null;
  payload?: unknown;
  [key: string]: unknown;
};

type RelatedArtifact = {
  id?: string | null;
  title?: string | null;
  subject?: string | null;
  status?: string | null;
  filename?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
} | null;

export type PierreExecutionBoardProps = {
  mission?: MissionRecord | null;
  tasks?: TaskRecord[];
  logs?: LogRecord[];
  relatedDocumentForTask?: (task: TaskRecord) => RelatedArtifact;
  relatedEmailForTask?: (task: TaskRecord) => RelatedArtifact;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const v = value.trim();
    return v.length ? v : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeStatus(value: unknown): TaskStatus {
  const status = (asString(value) || "unknown").toLowerCase();

  if (status === "done" || status === "success") return "completed";
  if (status === "error") return "failed";
  if (status === "needs_approval" || status === "pending_approval") {
    return "awaiting_approval";
  }

  return status;
}

function normalizeRisk(value: unknown): RiskLevel {
  const risk = (asString(value) || "unknown").toLowerCase();
  if (risk === "low") return "normal";
  if (risk === "medium") return "sensitive";
  return risk;
}

function formatDate(value?: string | null) {
  if (!value) return "â€”";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "â€”";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: TaskStatus) {
  switch (status) {
    case "pending":
      return "En attente";
    case "queued":
      return "En file";
    case "running":
      return "En cours";
    case "awaiting_info":
      return "Infos requises";
    case "awaiting_approval":
      return "Validation requise";
    case "scheduled":
      return "PlanifiÃ©e";
    case "blocked":
      return "BloquÃ©e";
    case "completed":
      return "TerminÃ©e";
    case "cancelled":
      return "AnnulÃ©e";
    case "failed":
      return "Ã‰chec";
    default:
      return "Inconnu";
  }
}

function statusTone(status: TaskStatus) {
  switch (status) {
    case "running":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "queued":
    case "scheduled":
      return "border-stone-200 bg-stone-100 text-stone-700";
    case "awaiting_info":
    case "awaiting_approval":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "blocked":
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "cancelled":
      return "border-stone-200 bg-stone-100 text-stone-500";
    default:
      return "border-stone-200 bg-stone-100 text-stone-700";
  }
}

function riskLabel(risk: RiskLevel) {
  switch (risk) {
    case "normal":
      return "Normal";
    case "sensitive":
      return "Sensible";
    case "critical":
      return "Critique";
    default:
      return "Non dÃ©fini";
  }
}

function riskTone(risk: RiskLevel) {
  switch (risk) {
    case "normal":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "sensitive":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "critical":
      return "border-rose-200 bg-rose-50 text-rose-800";
    default:
      return "border-stone-200 bg-stone-100 text-stone-700";
  }
}

function taskSortScore(task: TaskRecord) {
  const status = normalizeStatus(task.status);
  const risk = normalizeRisk(task.risk_level);

  let score = 0;

  if (status === "running") score += 1000;
  else if (status === "awaiting_approval") score += 900;
  else if (status === "awaiting_info") score += 850;
  else if (status === "blocked") score += 800;
  else if (status === "queued") score += 700;
  else if (status === "scheduled") score += 600;
  else if (status === "pending") score += 500;
  else if (status === "failed") score += 400;
  else if (status === "completed") score += 100;
  else if (status === "cancelled") score += 50;

  if (risk === "critical") score += 90;
  else if (risk === "sensitive") score += 45;

  if (asBoolean(task.approval_required)) score += 40;

  const scheduled = task.scheduled_for ? new Date(task.scheduled_for).getTime() : 0;
  const updated = task.updated_at ? new Date(task.updated_at).getTime() : 0;
  const created = task.created_at ? new Date(task.created_at).getTime() : 0;

  return score * 1_000_000 + Math.max(scheduled, updated, created, 0);
}

function inferLane(task: TaskRecord) {
  const status = normalizeStatus(task.status);

  if (status === "running") return "running";
  if (status === "awaiting_approval") return "approval";
  if (status === "awaiting_info") return "info";
  if (status === "blocked" || status === "failed") return "blocked";
  if (status === "queued" || status === "pending" || status === "scheduled") return "queue";
  if (status === "completed") return "done";
  if (status === "cancelled") return "done";
  return "queue";
}

function buildTaskSignals(task: TaskRecord, logs: LogRecord[]) {
  const taskId = asString(task.id);
  const linkedLogs = logs.filter((log) => asString(log.task_id) === taskId);

  const hasRecentError = linkedLogs.some((log) => {
    const level = (asString(log.level) || "").toLowerCase();
    const event = (asString(log.event) || "").toLowerCase();
    return level === "error" || event.includes("error") || event.includes("failed");
  });

  const hasValidationSignal =
    normalizeStatus(task.status) === "awaiting_approval" || asBoolean(task.approval_required) === true;

  const hasMissingInfoSignal = normalizeStatus(task.status) === "awaiting_info";
  const hasScheduleSignal = Boolean(asString(task.scheduled_for));
  const hasBlockSignal =
    normalizeStatus(task.status) === "blocked" || Boolean(asString(task.blocked_reason)) || hasRecentError;

  return {
    linkedLogs,
    hasRecentError,
    hasValidationSignal,
    hasMissingInfoSignal,
    hasScheduleSignal,
    hasBlockSignal,
  };
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "good" | "warn" | "critical";
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border px-4 py-4",
        tone === "good"
          ? "border-emerald-200 bg-emerald-50/80"
          : tone === "warn"
            ? "border-amber-200 bg-amber-50/80"
            : tone === "critical"
              ? "border-rose-200 bg-rose-50/80"
              : "border-stone-200 bg-white/80",
      )}
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-stone-500">{hint}</div> : null}
    </div>
  );
}

function SignalPill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "warn" | "good" | "critical";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
        tone === "good"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : tone === "warn"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : tone === "critical"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-stone-200 bg-stone-100 text-stone-700",
      )}
    >
      {children}
    </span>
  );
}

function TaskExecutionCard({
  task,
  logs,
  relatedDocument,
  relatedEmail,
}: {
  task: TaskRecord;
  logs: LogRecord[];
  relatedDocument: RelatedArtifact;
  relatedEmail: RelatedArtifact;
}) {
  const status = normalizeStatus(task.status);
  const risk = normalizeRisk(task.risk_level);
  const signals = buildTaskSignals(task, logs);

  return (
    <article className="rounded-[28px] border border-stone-200 bg-white/90 p-5 shadow-[0_10px_36px_rgba(28,25,23,0.05)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SignalPill>{statusLabel(status)}</SignalPill>
              <SignalPill tone={risk === "critical" ? "critical" : risk === "sensitive" ? "warn" : "good"}>
                {riskLabel(risk)}
              </SignalPill>
              {asBoolean(task.approval_required) ? <SignalPill tone="warn">Validation</SignalPill> : null}
              {signals.hasBlockSignal ? <SignalPill tone="critical">Alerte</SignalPill> : null}
            </div>

            <h3 className="mt-3 text-base font-semibold text-stone-900">
              {asString(task.title) || asString(task.type) || "TÃ¢che sans titre"}
            </h3>

            {asString(task.description) ? (
              <p className="mt-2 max-w-[900px] whitespace-pre-wrap text-sm leading-6 text-stone-600">
                {asString(task.description)}
              </p>
            ) : null}
          </div>

          <div className="grid min-w-[210px] gap-2 text-right text-xs text-stone-500">
            <div>CrÃ©Ã©e : {formatDate(task.created_at)}</div>
            <div>MÃ j : {formatDate(task.updated_at)}</div>
            {task.scheduled_for ? <div>PrÃ©vue : {formatDate(task.scheduled_for)}</div> : null}
            {task.started_at ? <div>DÃ©marrÃ©e : {formatDate(task.started_at)}</div> : null}
            {task.completed_at ? <div>TerminÃ©e : {formatDate(task.completed_at)}</div> : null}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <div className="rounded-[22px] border border-stone-200 bg-[#fcfaf6] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Pilotage</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {signals.hasValidationSignal ? <SignalPill tone="warn">Validation humaine requise</SignalPill> : null}
              {signals.hasMissingInfoSignal ? <SignalPill tone="warn">Informations manquantes</SignalPill> : null}
              {signals.hasScheduleSignal ? <SignalPill>Action planifiÃ©e</SignalPill> : null}
              {!signals.hasValidationSignal &&
              !signals.hasMissingInfoSignal &&
              !signals.hasScheduleSignal &&
              !signals.hasBlockSignal ? (
                <SignalPill tone="good">ExÃ©cutable proprement</SignalPill>
              ) : null}
            </div>
          </div>

          <div className="rounded-[22px] border border-stone-200 bg-[#fcfaf6] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Artefact document</div>
            <div className="mt-3 text-sm text-stone-700">
              {relatedDocument ? (
                <div className="space-y-1">
                  <div className="font-medium text-stone-900">
                    {asString(relatedDocument.title) || asString(relatedDocument.filename) || "Document liÃ©"}
                  </div>
                  {asString(relatedDocument.status) ? (
                    <div className="text-xs text-stone-500">Statut : {asString(relatedDocument.status)}</div>
                  ) : null}
                </div>
              ) : (
                <span className="text-stone-500">Aucun document liÃ©.</span>
              )}
            </div>
          </div>

          <div className="rounded-[22px] border border-stone-200 bg-[#fcfaf6] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Artefact email</div>
            <div className="mt-3 text-sm text-stone-700">
              {relatedEmail ? (
                <div className="space-y-1">
                  <div className="font-medium text-stone-900">
                    {asString(relatedEmail.subject) || "Email liÃ©"}
                  </div>
                  {asString(relatedEmail.status) ? (
                    <div className="text-xs text-stone-500">Statut : {asString(relatedEmail.status)}</div>
                  ) : null}
                </div>
              ) : (
                <span className="text-stone-500">Aucun email liÃ©.</span>
              )}
            </div>
          </div>
        </div>

        {asString(task.blocked_reason) || asString(task.error_message) ? (
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-rose-700">Blocage</div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-rose-900">
              {asString(task.blocked_reason) || asString(task.error_message)}
            </div>
          </div>
        ) : null}

        {signals.linkedLogs.length > 0 ? (
          <div className="rounded-[22px] border border-stone-200 bg-[#fcfaf6] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Derniers logs</div>
              <div className="text-xs text-stone-400">{signals.linkedLogs.length} entrÃ©e(s)</div>
            </div>

            <div className="mt-3 space-y-2">
              {signals.linkedLogs.slice(0, 4).map((log, index) => {
                const level = (asString(log.level) || "info").toLowerCase();
                return (
                  <div
                    key={asString(log.id) || `log-${index}`}
                    className={cn(
                      "rounded-2xl border px-3 py-3",
                      level === "error"
                        ? "border-rose-200 bg-rose-50"
                        : level === "warning" || level === "warn"
                          ? "border-amber-200 bg-amber-50"
                          : "border-stone-200 bg-white",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                        {asString(log.event) || level}
                      </div>
                      <div className="text-[11px] text-stone-400">{formatDate(log.created_at)}</div>
                    </div>
                    {asString(log.message) ? (
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                        {asString(log.message)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function PierreExecutionBoard({
  mission = null,
  tasks = [],
  logs = [],
  relatedDocumentForTask,
  relatedEmailForTask,
}: PierreExecutionBoardProps) {
  const normalizedMissionRisk = normalizeRisk(mission?.risk_level);
  const normalizedMissionStatus = normalizeStatus(mission?.status);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => taskSortScore(b) - taskSortScore(a));
  }, [tasks]);

  const lanes = useMemo(() => {
    const base = {
      running: [] as TaskRecord[],
      approval: [] as TaskRecord[],
      info: [] as TaskRecord[],
      queue: [] as TaskRecord[],
      blocked: [] as TaskRecord[],
      done: [] as TaskRecord[],
    };

    for (const task of sortedTasks) {
      const lane = inferLane(task);
      base[lane].push(task);
    }

    return base;
  }, [sortedTasks]);

  const stats = useMemo(() => {
    let running = 0;
    let awaitingApproval = 0;
    let awaitingInfo = 0;
    let queued = 0;
    let scheduled = 0;
    let blocked = 0;
    let completed = 0;
    let failed = 0;
    let critical = 0;

    for (const task of tasks) {
      const status = normalizeStatus(task.status);
      const risk = normalizeRisk(task.risk_level);

      if (status === "running") running += 1;
      else if (status === "awaiting_approval") awaitingApproval += 1;
      else if (status === "awaiting_info") awaitingInfo += 1;
      else if (status === "queued" || status === "pending") queued += 1;
      else if (status === "scheduled") scheduled += 1;
      else if (status === "blocked") blocked += 1;
      else if (status === "completed") completed += 1;
      else if (status === "failed") failed += 1;

      if (risk === "critical") critical += 1;
    }

    return {
      total: tasks.length,
      running,
      awaitingApproval,
      awaitingInfo,
      queued,
      scheduled,
      blocked,
      completed,
      failed,
      critical,
    };
  }, [tasks]);

  const recentCriticalLogs = useMemo(() => {
    return [...logs]
      .filter((log) => {
        const level = (asString(log.level) || "").toLowerCase();
        const event = (asString(log.event) || "").toLowerCase();
        return level === "error" || level === "warning" || event.includes("blocked") || event.includes("failed");
      })
      .sort((a, b) => {
        const left = new Date(a.created_at || 0).getTime();
        const right = new Date(b.created_at || 0).getTime();
        return right - left;
      })
      .slice(0, 6);
  }, [logs]);

  const heartbeatText = useMemo(() => {
    if (stats.running > 0) return "Pierre exÃ©cute actuellement des tÃ¢ches.";
    if (stats.awaitingApproval > 0) return "Des validations humaines sont requises.";
    if (stats.awaitingInfo > 0) return "Des informations sont attendues pour poursuivre.";
    if (stats.blocked > 0 || stats.failed > 0) return "Le flux contient des blocages Ã  traiter.";
    if (stats.queued > 0 || stats.scheduled > 0) return "Des tÃ¢ches sont prÃªtes ou planifiÃ©es.";
    if (stats.completed > 0 && stats.total === stats.completed) return "Le cycle courant est proprement clÃ´turÃ©.";
    return "Aucune exÃ©cution active pour le moment.";
  }, [stats]);

  return (
    <section className="rounded-[32px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(250,246,239,0.96))] p-5 shadow-[0_16px_50px_rgba(28,25,23,0.06)]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[980px]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-stone-500">
              Pilotage opÃ©rationnel
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
              Tableau dâ€™exÃ©cution Pierre
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              Vue centralisÃ©e des tÃ¢ches actives, validations, blocages, rythme dâ€™exÃ©cution, signaux de
              risque et artefacts liÃ©s Ã  la mission RH en cours.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]", statusTone(normalizedMissionStatus))}>
                {statusLabel(normalizedMissionStatus)}
              </span>
              <span className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]", riskTone(normalizedMissionRisk))}>
                Risque {riskLabel(normalizedMissionRisk)}
              </span>
              {asBoolean(mission?.approval_required) ? (
                <SignalPill tone="warn">Validation globale requise</SignalPill>
              ) : null}
            </div>

            {asString(mission?.summary) ? (
              <div className="mt-4 max-w-[1050px] whitespace-pre-wrap text-sm leading-7 text-stone-700">
                {asString(mission?.summary)}
              </div>
            ) : null}
          </div>

          <div className="w-full max-w-[380px] rounded-[26px] border border-stone-200 bg-white/85 p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Heartbeat</div>
            <div className="mt-3 text-base font-semibold text-stone-900">{heartbeatText}</div>
            <div className="mt-4 grid gap-2 text-sm text-stone-600">
              <div>Mission : {asString(mission?.title) || "Aucune mission active"}</div>
              <div>Mise Ã  jour : {formatDate(mission?.updated_at || mission?.created_at || null)}</div>
              <div>Logs actifs : {logs.length}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-5">
          <StatCard label="En cours" value={stats.running} hint="TÃ¢ches exÃ©cutÃ©es maintenant" tone={stats.running > 0 ? "good" : "default"} />
          <StatCard label="Validation" value={stats.awaitingApproval} hint="Actions Ã  valider" tone={stats.awaitingApproval > 0 ? "warn" : "default"} />
          <StatCard label="Infos requises" value={stats.awaitingInfo} hint="Ã‰lÃ©ments manquants" tone={stats.awaitingInfo > 0 ? "warn" : "default"} />
          <StatCard label="Blocages" value={stats.blocked + stats.failed} hint="Erreurs ou arrÃªts" tone={stats.blocked + stats.failed > 0 ? "critical" : "default"} />
          <StatCard label="TerminÃ©es" value={stats.completed} hint="TÃ¢ches clÃ´turÃ©es" tone={stats.completed > 0 ? "good" : "default"} />
        </div>

        <div className="grid gap-4 2xl:grid-cols-[1.1fr_1.1fr_1fr]">
          <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Flux prioritaire</div>
                <div className="mt-2 text-lg font-semibold text-stone-900">ExÃ©cution immÃ©diate</div>
              </div>
              <SignalPill>{lanes.running.length + lanes.approval.length + lanes.info.length}</SignalPill>
            </div>

            <div className="mt-4 space-y-3">
              {[...lanes.running, ...lanes.approval, ...lanes.info].length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-stone-200 bg-[#fcfaf6] px-4 py-8 text-sm text-stone-500">
                  Aucun point chaud immÃ©diat.
                </div>
              ) : (
                [...lanes.running, ...lanes.approval, ...lanes.info].map((task, index) => (
                  <TaskExecutionCard
                    key={asString(task.id) || `priority-task-${index}`}
                    task={task}
                    logs={logs}
                    relatedDocument={relatedDocumentForTask ? relatedDocumentForTask(task) : null}
                    relatedEmail={relatedEmailForTask ? relatedEmailForTask(task) : null}
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Queue logique</div>
                <div className="mt-2 text-lg font-semibold text-stone-900">Ã€ exÃ©cuter ensuite</div>
              </div>
              <SignalPill>{lanes.queue.length}</SignalPill>
            </div>

            <div className="mt-4 space-y-3">
              {lanes.queue.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-stone-200 bg-[#fcfaf6] px-4 py-8 text-sm text-stone-500">
                  Aucune tÃ¢che en file pour le moment.
                </div>
              ) : (
                lanes.queue.map((task, index) => (
                  <TaskExecutionCard
                    key={asString(task.id) || `queue-task-${index}`}
                    task={task}
                    logs={logs}
                    relatedDocument={relatedDocumentForTask ? relatedDocumentForTask(task) : null}
                    relatedEmail={relatedEmailForTask ? relatedEmailForTask(task) : null}
                  />
                ))
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Blocages & alertes</div>
                  <div className="mt-2 text-lg font-semibold text-stone-900">Points sensibles</div>
                </div>
                <SignalPill tone={stats.blocked + stats.failed > 0 ? "critical" : "default"}>
                  {stats.blocked + stats.failed}
                </SignalPill>
              </div>

              <div className="mt-4 space-y-3">
                {lanes.blocked.length === 0 && recentCriticalLogs.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-stone-200 bg-[#fcfaf6] px-4 py-8 text-sm text-stone-500">
                    Aucun blocage majeur dÃ©tectÃ©.
                  </div>
                ) : (
                  <>
                    {lanes.blocked.map((task, index) => (
                      <div
                        key={asString(task.id) || `blocked-task-${index}`}
                        className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-rose-900">
                              {asString(task.title) || asString(task.type) || "TÃ¢che bloquÃ©e"}
                            </div>
                            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-rose-800">
                              {asString(task.blocked_reason) ||
                                asString(task.error_message) ||
                                "Blocage dÃ©tectÃ© sans dÃ©tail supplÃ©mentaire."}
                            </div>
                          </div>
                          <div className="text-[11px] text-rose-700">{formatDate(task.updated_at || task.created_at)}</div>
                        </div>
                      </div>
                    ))}

                    {recentCriticalLogs.map((log, index) => (
                      <div
                        key={asString(log.id) || `critical-log-${index}`}
                        className="rounded-[22px] border border-stone-200 bg-[#fcfaf6] px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                            {asString(log.event) || asString(log.level) || "signal"}
                          </div>
                          <div className="text-[11px] text-stone-400">{formatDate(log.created_at)}</div>
                        </div>
                        {asString(log.message) ? (
                          <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                            {asString(log.message)}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Cycle clÃ´turÃ©</div>
                  <div className="mt-2 text-lg font-semibold text-stone-900">TerminÃ©es</div>
                </div>
                <SignalPill tone={stats.completed > 0 ? "good" : "default"}>{lanes.done.length}</SignalPill>
              </div>

              <div className="mt-4 space-y-3">
                {lanes.done.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-stone-200 bg-[#fcfaf6] px-4 py-8 text-sm text-stone-500">
                    Aucune tÃ¢che terminÃ©e dans ce cycle.
                  </div>
                ) : (
                  lanes.done.slice(0, 6).map((task, index) => (
                    <div
                      key={asString(task.id) || `done-task-${index}`}
                      className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-emerald-900">
                            {asString(task.title) || asString(task.type) || "TÃ¢che terminÃ©e"}
                          </div>
                          {asString(task.description) ? (
                            <div className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-emerald-800">
                              {asString(task.description)}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-emerald-700">
                          {formatDate(task.completed_at || task.updated_at || task.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
export { PierreExecutionBoard };

