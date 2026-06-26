"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { DemoTask } from "@/lib/demo/presentation/fixtures";
import { StatusBadge } from "./status";

/** Carte de tâche (liquid glass niveau 2). */
export function TaskCard({
  task,
  index,
  className,
}: {
  task: DemoTask;
  index?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/60 bg-white/55 p-3.5 backdrop-blur-md",
        "shadow-[0_10px_26px_rgba(18,24,36,0.045),inset_0_1px_0_rgba(255,255,255,0.8)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {typeof index === "number" ? (
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(107,99,232,0.12)] text-[0.72rem] font-bold text-[var(--demo-violet)]">
              {index + 1}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="text-[0.86rem] font-semibold leading-snug text-[var(--cs-ink-1)]">
              {task.title}
            </p>
            <p className="mt-0.5 text-[0.72rem] text-[var(--cs-ink-4)]">{task.owner}</p>
          </div>
        </div>
        <StatusBadge tone={task.tone} className="shrink-0">
          {task.status}
        </StatusBadge>
      </div>
    </div>
  );
}
