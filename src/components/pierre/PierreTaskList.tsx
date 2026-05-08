"use client";

import * as React from "react";
import { Layers3 } from "lucide-react";

import { PierreTaskCard } from "@/components/pierre/PierreTaskCard";

type TaskLike = Record<string, unknown>;

type Props = {
  tasks?: TaskLike[] | null;
  onRunTask?: (taskId: string) => void | Promise<void>;
  onApproveTask?: (taskId: string) => void | Promise<void>;
  onCancelTask?: (taskId: string) => void | Promise<void>;
  onRescheduleTask?: (taskId: string, scheduledFor?: string | null) => void | Promise<void>;
  relatedDocumentForTask?: (task: TaskLike) => Record<string, unknown> | null;
  relatedEmailForTask?: (task: TaskLike) => Record<string, unknown> | null;
};

function groupLabel(status: string) {
  const s = status.toLowerCase();

  if (["awaiting_info"].includes(s)) return "En attente d’information";
  if (["awaiting_validation", "awaiting_approval"].includes(s)) {
    return "En attente de validation";
  }
  if (["ready", "queued", "retry"].includes(s)) return "Prêtes à traiter";
  if (["planned"].includes(s)) return "Planifiées";
  if (["running", "in_progress"].includes(s)) return "En cours";
  if (["blocked", "failed"].includes(s)) return "Bloquées";
  if (["done", "completed"].includes(s)) return "Terminées";
  if (["cancelled"].includes(s)) return "Annulées";
  return "Autres";
}

function orderForGroup(label: string) {
  switch (label) {
    case "En attente d’information":
      return 1;
    case "En attente de validation":
      return 2;
    case "Prêtes à traiter":
      return 3;
    case "Planifiées":
      return 4;
    case "En cours":
      return 5;
    case "Bloquées":
      return 6;
    case "Terminées":
      return 7;
    case "Annulées":
      return 8;
    default:
      return 99;
  }
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateValue(value: unknown): number {
  if (typeof value !== "string" || !value.trim()) return 0;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortTasksInGroup(tasks: TaskLike[]) {
  return [...tasks].sort((a, b) => {
    const pa = numberValue(a.priority) ?? -999;
    const pb = numberValue(b.priority) ?? -999;
    if (pb !== pa) return pb - pa;

    const sa = dateValue(a.scheduled_for);
    const sb = dateValue(b.scheduled_for);
    if (sb !== sa) return sb - sa;

    const ua = dateValue(a.updated_at) || dateValue(a.created_at);
    const ub = dateValue(b.updated_at) || dateValue(b.created_at);
    return ub - ua;
  });
}

export function PierreTaskList({
  tasks,
  onRunTask,
  onApproveTask,
  onCancelTask,
  onRescheduleTask,
  relatedDocumentForTask,
  relatedEmailForTask,
}: Props) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  const grouped = React.useMemo(() => {
    const map = new Map<string, TaskLike[]>();

    for (const task of safeTasks) {
      const label = groupLabel(String(task.status ?? "draft"));
      const current = map.get(label) ?? [];
      current.push(task);
      map.set(label, current);
    }

    return Array.from(map.entries())
      .sort((a, b) => orderForGroup(a[0]) - orderForGroup(b[0]))
      .map(([label, groupTasks]) => [label, sortTasksInGroup(groupTasks)] as const);
  }, [safeTasks]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4ebdf] text-[#6d573d]">
          <Layers3 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#241b12]">Tâches de mission</p>
          <p className="mt-1 text-sm text-[#6b5b4b]">
            Pilotage détaillé des actions RH interprétées par Pierre.
          </p>
        </div>
      </div>

      {safeTasks.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-[#e6dacb] bg-[#fffdf9] px-4 py-8 text-center">
          <p className="text-sm font-semibold text-[#2e241a]">Aucune tâche disponible</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#7a6957]">
            Les tâches structurées de la mission apparaîtront ici avec leur statut,
            leurs dépendances et leurs actions possibles.
          </p>
        </div>
      ) : (
        grouped.map(([label, groupTasks]) => (
          <section key={label} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9a856f]">
                {label}
              </h4>
              <span className="rounded-full border border-[#eadbc9] bg-[#fffdf8] px-3 py-1 text-xs font-semibold text-[#735f4b]">
                {groupTasks.length}
              </span>
            </div>

            <div className="space-y-4">
              {groupTasks.map((task, index) => (
                <PierreTaskCard
                  key={String(task.id ?? `${String(task.title ?? "task")}-${index}`)}
                  task={task}
                  onRunTask={onRunTask}
                  onApproveTask={onApproveTask}
                  onCancelTask={onCancelTask}
                  onRescheduleTask={onRescheduleTask}
                  relatedDocument={relatedDocumentForTask ? relatedDocumentForTask(task) : null}
                  relatedEmail={relatedEmailForTask ? relatedEmailForTask(task) : null}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export default PierreTaskList;