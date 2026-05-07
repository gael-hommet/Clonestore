"use client";

import * as React from "react";
import { Clock3, FileText, Mail, ShieldAlert, Workflow } from "lucide-react";

type Props = {
  mission?: Record<string, unknown> | null;
  tasks?: Array<Record<string, unknown>> | null;
  logs?: Array<Record<string, unknown>> | null;
  documents?: Array<Record<string, unknown>> | null;
  emails?: Array<Record<string, unknown>> | null;
};

type TimelineEntry = {
  id: string;
  kind: "mission" | "task" | "log" | "document" | "email";
  title: string;
  subtitle: string;
  createdAt: string | null;
  status?: string | null;
};

function text(value: unknown, fallback = "â€”") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asDate(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function formatDate(value: string | null) {
  if (!value) return "â€”";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "â€”";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusTone(status: string) {
  const s = status.toLowerCase();

  if (["done", "completed"].includes(s)) {
    return "border-[#d7e8da] bg-[#edf8ef] text-[#2f6c43]";
  }

  if (["blocked", "failed", "cancelled"].includes(s)) {
    return "border-[#f0c2bc] bg-[#fff1ef] text-[#8b3d33]";
  }

  if (["awaiting_validation", "awaiting_approval", "awaiting_info"].includes(s)) {
    return "border-[#ecd8b4] bg-[#fff8ea] text-[#8a5b17]";
  }

  if (["running", "in_progress"].includes(s)) {
    return "border-[#d8e1ef] bg-[#f5f8fd] text-[#425f8c]";
  }

  if (["planned", "ready", "queued", "retry"].includes(s)) {
    return "border-[#eadbc9] bg-[#fffdf8] text-[#735f4b]";
  }

  return "border-[#eadbc9] bg-[#fffdf8] text-[#735f4b]";
}

function dateValue(value: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function PierreMissionTimeline({
  mission,
  tasks,
  logs,
  documents,
  emails,
}: Props) {
  const entries = React.useMemo(() => {
    const items: TimelineEntry[] = [];

    if (mission?.id) {
      items.push({
        id: `mission-${String(mission.id)}`,
        kind: "mission",
        title: text(mission.title, "Mission Pierre"),
        subtitle: text(mission.summary, text(mission.status, "Mission crÃ©Ã©e")),
        createdAt: asDate(mission.updated_at) ?? asDate(mission.created_at),
        status: text(mission.status, "draft"),
      });
    }

    for (const task of Array.isArray(tasks) ? tasks : []) {
      items.push({
        id: `task-${String(task.id ?? Math.random())}`,
        kind: "task",
        title: text(task.title, "TÃ¢che Pierre"),
        subtitle: `Type : ${text(task.type, "other")}`,
        createdAt: asDate(task.updated_at) ?? asDate(task.created_at),
        status: text(task.status, "draft"),
      });
    }

    for (const log of Array.isArray(logs) ? logs : []) {
      items.push({
        id: `log-${String(log.id ?? Math.random())}`,
        kind: "log",
        title: text(log.event, "Ã‰vÃ©nement"),
        subtitle: text(log.message, "Log systÃ¨me"),
        createdAt: asDate(log.created_at),
        status: null,
      });
    }

    for (const doc of Array.isArray(documents) ? documents : []) {
      items.push({
        id: `doc-${String(doc.id ?? Math.random())}`,
        kind: "document",
        title: text(doc.title, "Document Pierre"),
        subtitle: text(doc.type, "document"),
        createdAt: asDate(doc.updated_at) ?? asDate(doc.created_at),
        status: text(doc.status, "ready"),
      });
    }

    for (const email of Array.isArray(emails) ? emails : []) {
      items.push({
        id: `email-${String(email.id ?? Math.random())}`,
        kind: "email",
        title: text(email.subject, "Email Pierre"),
        subtitle: text(email.status, "draft"),
        createdAt: asDate(email.updated_at) ?? asDate(email.created_at),
        status: text(email.status, "draft"),
      });
    }

    return items.sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
  }, [mission, tasks, logs, documents, emails]);

  function iconFor(kind: TimelineEntry["kind"]) {
    switch (kind) {
      case "mission":
        return Workflow;
      case "task":
        return Clock3;
      case "document":
        return FileText;
      case "email":
        return Mail;
      default:
        return ShieldAlert;
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[#241b12]">Timeline mission</p>
        <p className="mt-1 text-sm text-[#6b5b4b]">
          Vue unifiÃ©e de la mission, des tÃ¢ches, des logs et des artefacts.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-[#e6dacb] bg-[#fffdf9] px-4 py-8 text-center">
          <p className="text-sm font-semibold text-[#2e241a]">Aucune activitÃ©</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#7a6957]">
            La timeline se construira automatiquement Ã  mesure que Pierre interprÃ¨te,
            planifie, exÃ©cute et journalise la mission.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.slice(0, 30).map((entry) => {
            const Icon = iconFor(entry.kind);

            return (
              <div
                key={entry.id}
                className="flex items-start gap-4 rounded-[20px] border border-[#eadfce] bg-white px-4 py-4"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4ebdf] text-[#6d573d]">
                  <Icon className="h-4.5 w-4.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#2b2118]">{entry.title}</p>
                      <p className="mt-1 text-sm leading-6 text-[#5f5144]">{entry.subtitle}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {entry.status ? (
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(
                            entry.status
                          )}`}
                        >
                          {entry.status}
                        </span>
                      ) : null}

                      <span className="text-xs text-[#9a856f]">{formatDate(entry.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PierreMissionTimeline;