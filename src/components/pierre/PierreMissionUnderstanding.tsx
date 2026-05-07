"use client";

import React, { useMemo } from "react";

type RiskLevel = "normal" | "sensitive" | "critical" | "unknown" | string;

type MissionRecord = {
  id?: string | null;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  classification?: string | null;
  status?: string | null;
  risk_level?: RiskLevel | null;
  approval_required?: boolean | null;
  language?: string | null;
  tone?: string | null;
  missing_info?: unknown;
  interpretation?: unknown;
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
  status?: string | null;
  risk_level?: RiskLevel | null;
  approval_required?: boolean | null;
  scheduled_for?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type LogRecord = {
  id?: string | null;
  task_id?: string | null;
  mission_id?: string | null;
  level?: string | null;
  event?: string | null;
  message?: string | null;
  payload?: unknown;
  created_at?: string | null;
  [key: string]: unknown;
};

export type PierreMissionUnderstandingProps = {
  mission?: MissionRecord | null;
  tasks?: TaskRecord[];
  logs?: LogRecord[];
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeRisk(value: unknown): RiskLevel {
  const risk = (asString(value) || "unknown").toLowerCase();
  if (risk === "low") return "normal";
  if (risk === "medium") return "sensitive";
  return risk;
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

function formatDate(value?: string | null) {
  if (!value) return "â€”";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "â€”";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function extractInterpretation(source: MissionRecord | null | undefined) {
  const raw = source?.interpretation;
  if (!isObject(raw)) return null;

  const missingInfoQuestions = asArray<string>(raw.missing_info_questions).filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );

  const tasks = asArray(raw.tasks);
  const missingInfoRaw = raw.missing_info;

  let missingInfoItems: string[] = [];
  if (Array.isArray(missingInfoRaw)) {
    missingInfoItems = missingInfoRaw.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
  } else if (isObject(missingInfoRaw)) {
    missingInfoItems = Object.entries(missingInfoRaw)
      .flatMap(([key, value]) => {
        if (typeof value === "string" && value.trim()) return [`${key}: ${value}`];
        if (typeof value === "boolean") return value ? [key] : [];
        if (Array.isArray(value)) {
          const values = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
          return values.length ? [`${key}: ${values.join(", ")}`] : [];
        }
        return [];
      });
  }

  return {
    intent: asString(raw.intent),
    classification: asString(raw.classification),
    summary: asString(raw.summary),
    language: asString(raw.language),
    tone: asString(raw.tone),
    riskLevel: normalizeRisk(raw.risk_level),
    approvalRequired: asBoolean(raw.approval_required),
    missingInfoQuestions,
    missingInfoItems,
    tasks,
  };
}

function extractMissionMissingInfo(mission: MissionRecord | null | undefined): string[] {
  const raw = mission?.missing_info;

  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (isObject(raw)) {
    return Object.entries(raw).flatMap(([key, value]) => {
      if (typeof value === "string" && value.trim()) return [`${key}: ${value}`];
      if (typeof value === "boolean") return value ? [key] : [];
      if (Array.isArray(value)) {
        const values = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
        return values.length ? [`${key}: ${values.join(", ")}`] : [];
      }
      return [];
    });
  }

  return [];
}

function inferMissionSummary(mission: MissionRecord | null | undefined, interpretation: ReturnType<typeof extractInterpretation>) {
  return (
    interpretation?.summary ||
    asString(mission?.summary) ||
    asString(mission?.description) ||
    "Pierre nâ€™a pas encore produit de rÃ©sumÃ© interprÃ©tÃ© pour cette mission."
  );
}

function inferClassification(mission: MissionRecord | null | undefined, interpretation: ReturnType<typeof extractInterpretation>) {
  return interpretation?.classification || asString(mission?.classification) || "Non classÃ©e";
}

function inferLanguage(mission: MissionRecord | null | undefined, interpretation: ReturnType<typeof extractInterpretation>) {
  return interpretation?.language || asString(mission?.language) || "Non dÃ©fini";
}

function inferTone(mission: MissionRecord | null | undefined, interpretation: ReturnType<typeof extractInterpretation>) {
  return interpretation?.tone || asString(mission?.tone) || "Non dÃ©fini";
}

function inferApprovalRequired(mission: MissionRecord | null | undefined, interpretation: ReturnType<typeof extractInterpretation>) {
  return interpretation?.approvalRequired ?? asBoolean(mission?.approval_required) ?? false;
}

function inferRisk(mission: MissionRecord | null | undefined, interpretation: ReturnType<typeof extractInterpretation>) {
  return interpretation?.riskLevel || normalizeRisk(mission?.risk_level);
}

function buildDetectedSubtasks(tasks: TaskRecord[], interpretedTasks: unknown[]) {
  const taskItems = tasks
    .map((task) => ({
      key: asString(task.id) || `task-${Math.random().toString(36).slice(2, 9)}`,
      title: asString(task.title) || asString(task.type) || "Sous-tÃ¢che dÃ©tectÃ©e",
      description: asString(task.description),
      status: asString(task.status) || "unknown",
      source: "task" as const,
    }));

  const interpretedItems = interpretedTasks
    .map((entry, index) => {
      if (typeof entry === "string" && entry.trim()) {
        return {
          key: `interpreted-${index}`,
          title: entry.trim(),
          description: null,
          status: "detected",
          source: "interpretation" as const,
        };
      }

      if (isObject(entry)) {
        return {
          key: asString(entry.id) || `interpreted-${index}`,
          title:
            asString(entry.title) ||
            asString(entry.label) ||
            asString(entry.type) ||
            "Sous-tÃ¢che interprÃ©tÃ©e",
          description: asString(entry.description),
          status: asString(entry.status) || "detected",
          source: "interpretation" as const,
        };
      }

      return null;
    })
    .filter(
      (item): item is {
        key: string;
        title: string;
        description: string | null;
        status: string;
        source: "interpretation";
      } => Boolean(item),
    );

  const map = new Map<string, {
    key: string;
    title: string;
    description: string | null;
    status: string;
    source: "task" | "interpretation";
  }>();

  for (const item of [...taskItems, ...interpretedItems]) {
    const dedupeKey = item.title.toLowerCase();
    if (!map.has(dedupeKey)) {
      map.set(dedupeKey, item);
    }
  }

  return [...map.values()];
}

function classifyUnderstandingState({
  missingInfoCount,
  approvalRequired,
  risk,
  taskCount,
}: {
  missingInfoCount: number;
  approvalRequired: boolean;
  risk: RiskLevel;
  taskCount: number;
}) {
  if (risk === "critical") {
    return {
      title: "Mission sensible sous contrÃ´le",
      description:
        "Pierre a compris une mission Ã  fort enjeu. Le traitement doit rester traÃ§able, encadrÃ© et potentiellement soumis Ã  validation humaine avant exÃ©cution.",
      tone: "critical" as const,
    };
  }

  if (missingInfoCount > 0) {
    return {
      title: "Mission partiellement comprise",
      description:
        "Pierre a structurÃ© la demande, mais des informations manquantes empÃªchent une exÃ©cution complÃ¨te ou sÃ»re sans clarification.",
      tone: "warn" as const,
    };
  }

  if (approvalRequired) {
    return {
      title: "Mission comprise avec validation requise",
      description:
        "La demande est structurÃ©e et exploitable, mais certaines actions sensibles nÃ©cessitent un accord humain avant passage Ã  lâ€™exÃ©cution.",
      tone: "warn" as const,
    };
  }

  if (taskCount > 0) {
    return {
      title: "Mission comprise et structurÃ©e",
      description:
        "Pierre a transformÃ© la demande RH en un plan lisible avec des sous-tÃ¢ches exploitables et un cadre opÃ©rationnel clair.",
      tone: "good" as const,
    };
  }

  return {
    title: "Mission en cours dâ€™analyse",
    description:
      "Pierre dispose dâ€™Ã©lÃ©ments de comprÃ©hension, mais la structure opÃ©rationnelle reste encore lÃ©gÃ¨re ou incomplÃ¨te.",
    tone: "default" as const,
  };
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "warn" | "critical";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
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

function InfoCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
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
      <div className="mt-2 text-sm font-semibold text-stone-900">{value}</div>
    </div>
  );
}

export default function PierreMissionUnderstanding({
  mission = null,
  tasks = [],
  logs = [],
}: PierreMissionUnderstandingProps) {
  const interpretation = useMemo(() => extractInterpretation(mission), [mission]);

  const risk = useMemo(() => inferRisk(mission, interpretation), [mission, interpretation]);
  const approvalRequired = useMemo(
    () => inferApprovalRequired(mission, interpretation),
    [mission, interpretation],
  );

  const missionMissingInfo = useMemo(() => extractMissionMissingInfo(mission), [mission]);
  const interpretationMissingInfo = interpretation?.missingInfoItems || [];
  const missingInfoQuestions = interpretation?.missingInfoQuestions || [];

  const allMissingInfo = useMemo(() => {
    const unique = new Map<string, string>();
    for (const item of [...missionMissingInfo, ...interpretationMissingInfo]) {
      const normalized = item.trim().toLowerCase();
      if (!unique.has(normalized)) unique.set(normalized, item);
    }
    return [...unique.values()];
  }, [interpretationMissingInfo, missionMissingInfo]);

  const detectedSubtasks = useMemo(
    () => buildDetectedSubtasks(tasks, interpretation?.tasks || []),
    [tasks, interpretation],
  );

  const understandingState = useMemo(
    () =>
      classifyUnderstandingState({
        missingInfoCount: allMissingInfo.length + missingInfoQuestions.length,
        approvalRequired,
        risk,
        taskCount: detectedSubtasks.length,
      }),
    [allMissingInfo.length, approvalRequired, detectedSubtasks.length, missingInfoQuestions.length, risk],
  );

  const timelineSignals = useMemo(() => {
    const recent = [...logs]
      .sort((a, b) => {
        const left = new Date(a.created_at || 0).getTime();
        const right = new Date(b.created_at || 0).getTime();
        return right - left;
      })
      .slice(0, 4);

    return recent;
  }, [logs]);

  const summary = inferMissionSummary(mission, interpretation);
  const classification = inferClassification(mission, interpretation);
  const language = inferLanguage(mission, interpretation);
  const tone = inferTone(mission, interpretation);

  return (
    <section className="rounded-[32px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(250,246,239,0.96))] p-5 shadow-[0_16px_48px_rgba(28,25,23,0.06)]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[980px]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-stone-500">
              ComprÃ©hension de mission
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
              Lecture structurÃ©e de la demande par Pierre
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              Ce bloc doit donner une sensation claire : Pierre ne se contente pas dâ€™afficher une demande,
              il la comprend, la classe, en mesure le risque, repÃ¨re les manques et prÃ©pare une exÃ©cution
              RH sÃ©rieuse sous contrÃ´le.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Pill
                tone={
                  understandingState.tone === "critical"
                    ? "critical"
                    : understandingState.tone === "warn"
                      ? "warn"
                      : understandingState.tone === "good"
                        ? "good"
                        : "default"
                }
              >
                {understandingState.title}
              </Pill>
              <Pill tone={risk === "critical" ? "critical" : risk === "sensitive" ? "warn" : "good"}>
                Risque {riskLabel(risk)}
              </Pill>
              {approvalRequired ? <Pill tone="warn">Validation requise</Pill> : <Pill tone="good">Validation non requise</Pill>}
              {allMissingInfo.length + missingInfoQuestions.length > 0 ? (
                <Pill tone="warn">Informations manquantes</Pill>
              ) : (
                <Pill tone="good">Mission exploitable</Pill>
              )}
            </div>
          </div>

          <div
            className={cn(
              "w-full max-w-[420px] rounded-[26px] border p-5",
              understandingState.tone === "critical"
                ? "border-rose-200 bg-rose-50"
                : understandingState.tone === "warn"
                  ? "border-amber-200 bg-amber-50"
                  : understandingState.tone === "good"
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-stone-200 bg-white/85",
            )}
          >
            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
              Ã‰tat de comprÃ©hension
            </div>
            <div className="mt-3 text-lg font-semibold text-stone-900">{understandingState.title}</div>
            <div className="mt-3 text-sm leading-7 text-stone-700">{understandingState.description}</div>
            <div className="mt-4 text-xs text-stone-500">
              DerniÃ¨re mise Ã  jour : {formatDate(mission?.updated_at || mission?.created_at || null)}
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-4">
          <InfoCard label="Classification" value={classification} />
          <InfoCard
            label="Niveau de risque"
            value={riskLabel(risk)}
            tone={risk === "critical" ? "critical" : risk === "sensitive" ? "warn" : "good"}
          />
          <InfoCard label="Langue" value={language} />
          <InfoCard label="Ton" value={tone} />
        </div>

        <div className="grid gap-6 2xl:grid-cols-[1.2fr_0.9fr]">
          <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">RÃ©sumÃ© interprÃ©tÃ©</div>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">{summary}</div>

            {asString(interpretation?.intent) ? (
              <div className="mt-5 rounded-[22px] border border-stone-200 bg-[#fcfaf6] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Intent dÃ©tectÃ©</div>
                <div className="mt-2 text-sm font-semibold text-stone-900">{asString(interpretation?.intent)}</div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Validation</div>
              <div className="mt-3 text-sm leading-7 text-stone-700">
                {approvalRequired
                  ? "Cette mission comporte au moins une action qui doit rester sous validation humaine avant exÃ©cution complÃ¨te."
                  : "Aucune validation globale obligatoire nâ€™a Ã©tÃ© dÃ©tectÃ©e Ã  ce stade pour la mission."}
              </div>
            </div>

            <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Sous-tÃ¢ches dÃ©tectÃ©es</div>
              <div className="mt-3 text-2xl font-semibold text-stone-900">{detectedSubtasks.length}</div>
              <div className="mt-1 text-xs text-stone-500">Structure opÃ©rationnelle visible</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 2xl:grid-cols-[1.1fr_1fr]">
          <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Informations manquantes</div>
                <div className="mt-2 text-lg font-semibold text-stone-900">Ce quâ€™il manque pour sÃ©curiser lâ€™exÃ©cution</div>
              </div>
              <Pill tone={allMissingInfo.length + missingInfoQuestions.length > 0 ? "warn" : "good"}>
                {allMissingInfo.length + missingInfoQuestions.length}
              </Pill>
            </div>

            <div className="mt-4 grid gap-3">
              {allMissingInfo.length === 0 && missingInfoQuestions.length === 0 ? (
                <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-6 text-sm text-emerald-900">
                  Aucune information manquante explicite nâ€™a Ã©tÃ© dÃ©tectÃ©e pour cette mission.
                </div>
              ) : (
                <>
                  {allMissingInfo.map((item, index) => (
                    <div
                      key={`missing-info-${index}`}
                      className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4"
                    >
                      <div className="text-sm leading-6 text-amber-900">{item}</div>
                    </div>
                  ))}

                  {missingInfoQuestions.map((question, index) => (
                    <div
                      key={`missing-question-${index}`}
                      className="rounded-[22px] border border-stone-200 bg-[#fcfaf6] px-4 py-4"
                    >
                      <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500">
                        Question utile
                      </div>
                      <div className="mt-2 text-sm leading-6 text-stone-800">{question}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Sous-tÃ¢ches dÃ©tectÃ©es</div>
                <div className="mt-2 text-lg font-semibold text-stone-900">DÃ©coupage opÃ©rationnel</div>
              </div>
              <Pill>{detectedSubtasks.length}</Pill>
            </div>

            <div className="mt-4 space-y-3">
              {detectedSubtasks.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-stone-200 bg-[#fcfaf6] px-4 py-8 text-sm text-stone-500">
                  Aucune sous-tÃ¢che claire nâ€™a encore Ã©tÃ© matÃ©rialisÃ©e.
                </div>
              ) : (
                detectedSubtasks.map((task, index) => (
                  <div
                    key={task.key || `detected-task-${index}`}
                    className="rounded-[22px] border border-stone-200 bg-[#fcfaf6] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-stone-900">{task.title}</div>
                        {task.description ? (
                          <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">
                            {task.description}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Pill>{task.source === "task" ? "Task engine" : "InterprÃ©tation"}</Pill>
                        <Pill tone="default">{task.status}</Pill>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 2xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Chronologie de comprÃ©hension</div>
            <div className="mt-4 space-y-3">
              {timelineSignals.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-stone-200 bg-[#fcfaf6] px-4 py-8 text-sm text-stone-500">
                  Aucun signal rÃ©cent de comprÃ©hension disponible.
                </div>
              ) : (
                timelineSignals.map((log, index) => {
                  const level = (asString(log.level) || "info").toLowerCase();
                  return (
                    <div
                      key={asString(log.id) || `understanding-log-${index}`}
                      className={cn(
                        "rounded-[22px] border px-4 py-4",
                        level === "error"
                          ? "border-rose-200 bg-rose-50"
                          : level === "warning" || level === "warn"
                            ? "border-amber-200 bg-amber-50"
                            : "border-stone-200 bg-[#fcfaf6]",
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
                })
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Lecture produit</div>
            <div className="mt-3 text-sm leading-7 text-stone-700">
              Pierre doit Ãªtre perÃ§u ici comme un vÃ©ritable employÃ© IA RH premium :
              il comprend la demande libre, la reformule implicitement en mission structurÃ©e,
              mesure le risque, remonte les validations nÃ©cessaires, repÃ¨re ce qui manque
              et prÃ©pare un passage propre vers lâ€™exÃ©cution ou la clarification.
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-[22px] border border-stone-200 bg-[#fcfaf6] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Mission</div>
                <div className="mt-2 text-sm font-semibold text-stone-900">
                  {asString(mission?.title) || "Sans titre structurÃ©"}
                </div>
              </div>

              <div className="rounded-[22px] border border-stone-200 bg-[#fcfaf6] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500">CrÃ©ation</div>
                <div className="mt-2 text-sm text-stone-700">
                  {formatDate(mission?.created_at || null)}
                </div>
              </div>

              <div className="rounded-[22px] border border-stone-200 bg-[#fcfaf6] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500">DerniÃ¨re mise Ã  jour</div>
                <div className="mt-2 text-sm text-stone-700">
                  {formatDate(mission?.updated_at || mission?.created_at || null)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
export { PierreMissionUnderstanding };

