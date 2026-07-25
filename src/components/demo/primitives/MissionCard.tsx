"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Sparkles, CalendarClock, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { liquidGlassClass } from "./LiquidGlassPanel";
import { DEMO_MISSION, DEMO_DATA_DISCLAIMER } from "@/lib/demo/presentation/fixtures";
import { TaskCard } from "./TaskCard";

/**
 * Carte de mission centrale — motif récurrent de la narration (E2.1, E2.2,
 * E2.4, E2.10). `layoutId` permet la transition élément-partagé finale.
 */
export function MissionCard({
  className,
  showTasks = false,
  taskCount,
  compact = false,
  layoutId,
  title = DEMO_MISSION.title,
  footnote = true,
}: {
  className?: string;
  showTasks?: boolean;
  taskCount?: number;
  compact?: boolean;
  layoutId?: string;
  title?: string;
  footnote?: boolean;
}) {
  const tasks = DEMO_MISSION.tasks.slice(0, taskCount ?? DEMO_MISSION.tasks.length);

  return (
    <motion.div
      layoutId={layoutId}
      className={cn(
        liquidGlassClass("panel", "strong", { refractive: true }),
        "rounded-[1.75rem] p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(107,99,232,0.12)] text-[var(--demo-violet)]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">
              Mission CloneStore
            </p>
            <p className="text-[0.95rem] font-semibold leading-tight text-[var(--cs-ink-1)]">
              {title}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="demo-chip">
          <CalendarClock className="h-3.5 w-3.5 text-[var(--cs-ink-3)]" aria-hidden="true" />
          Échéance {DEMO_MISSION.deadline}
        </span>
        <span className="demo-chip">
          <Users className="h-3.5 w-3.5 text-[var(--cs-ink-3)]" aria-hidden="true" />
          {DEMO_MISSION.intervenants} intervenants
        </span>
        <span className="demo-chip">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--demo-amber)]" aria-hidden="true" />
          {DEMO_MISSION.validations} validation
        </span>
      </div>

      {showTasks ? (
        <div className={cn("mt-4 grid gap-2.5", !compact && "sm:grid-cols-2")}>
          {tasks.map((task, i) => (
            <TaskCard key={task.id} task={task} index={i} />
          ))}
        </div>
      ) : null}

      {footnote ? (
        <p className="mt-4 text-[0.7rem] text-[var(--cs-ink-4)]">{DEMO_DATA_DISCLAIMER}</p>
      ) : null}
    </motion.div>
  );
}
