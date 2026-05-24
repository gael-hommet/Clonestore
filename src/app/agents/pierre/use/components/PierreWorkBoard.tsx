// src/app/agents/pierre/use/components/PierreWorkBoard.tsx
// Active mission task board — Pierre Cockpit B31.

import * as React from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import type {
  PierreCockpitMissionSummary,
  PierreCockpitTaskSummary,
  PierreCockpitActionResult,
} from "@/lib/pierre/cockpit/types";
import { PierreMissionUnderstandingCard } from "./PierreMissionUnderstandingCard";
import { PierreCockpitTaskCard } from "./PierreCockpitTaskCard";
import { EmptyState, LoadingState } from "./PierreEmptyStates";

type TaskActions = {
  onApprove: (id: string) => Promise<PierreCockpitActionResult>;
  onCancel: (id: string) => Promise<PierreCockpitActionResult>;
  onRun: (id: string) => Promise<PierreCockpitActionResult>;
};

const STATUS_ORDER: Record<string, number> = {
  running: 0,
  queued: 1,
  pending: 2,
  failed: 3,
  blocked: 4,
  done: 5,
  completed: 5,
  cancelled: 6,
};

function sortTasks(tasks: PierreCockpitTaskSummary[]): PierreCockpitTaskSummary[] {
  return [...tasks].sort((a, b) => {
    const ao = STATUS_ORDER[a.status.toLowerCase()] ?? 99;
    const bo = STATUS_ORDER[b.status.toLowerCase()] ?? 99;
    return ao - bo;
  });
}

export function PierreWorkBoard({
  mission,
  tasks,
  loadingMission,
  taskActions,
}: {
  mission: PierreCockpitMissionSummary | null;
  tasks: PierreCockpitTaskSummary[];
  loadingMission: boolean;
  taskActions: TaskActions;
}) {
  if (loadingMission && !mission) {
    return <LoadingState label="Chargement de la mission…" />;
  }

  if (!mission) {
    return (
      <EmptyState
        icon={<Sparkles className="h-5 w-5" />}
        title="Aucune mission active"
        subtitle="Soumettez une mission via le centre de commande pour voir les tâches ici."
      />
    );
  }

  const sorted = sortTasks(tasks);

  return (
    <div className="flex flex-col gap-4">
      <PierreMissionUnderstandingCard mission={mission} />

      <div>
        <h3
          className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--cs-ink-4)" }}
        >
          Tâches · {tasks.length}
        </h3>

        {sorted.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="Aucune tâche"
            subtitle="Pierre n'a pas encore généré de tâches pour cette mission."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((task) => (
              <PierreCockpitTaskCard
                key={task.id}
                task={task}
                actions={taskActions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
