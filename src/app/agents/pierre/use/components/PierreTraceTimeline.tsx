// src/app/agents/pierre/use/components/PierreTraceTimeline.tsx
// Conversation + audit trace timeline — Pierre Cockpit B31.

import * as React from "react";
import type { PierreCockpitMessage } from "@/lib/pierre/cockpit/types";
import { EmptyState } from "./PierreEmptyStates";

function TimelineEvent({
  msg,
}: {
  msg: PierreCockpitMessage;
}) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  let dotColor = "var(--cs-ink-4)";
  let labelColor = "var(--cs-ink-4)";
  let label = "Système";

  if (isUser) {
    dotColor = "var(--cs-blue)";
    labelColor = "var(--cs-blue)";
    label = "Vous";
  } else if (!isSystem) {
    dotColor = "var(--cs-graphite)";
    labelColor = "var(--cs-ink-2)";
    label = "Pierre";
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0 mt-1"
          style={{ background: dotColor }}
        />
        <div
          className="flex-1 w-px mt-1"
          style={{ background: "var(--cs-line)", minHeight: 16 }}
        />
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-xs font-semibold" style={{ color: labelColor }}>
            {label}
          </span>
          <span className="text-[11px]" style={{ color: "var(--cs-ink-4)" }}>
            {new Date(msg.createdAt).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p
          className="text-sm leading-relaxed"
          style={{
            color: msg.status === "error" ? "var(--cs-danger)" : "var(--cs-ink-2)",
          }}
        >
          {msg.content}
        </p>
        {msg.cards && msg.cards.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.cards.map((card) => (
              <span
                key={card.id}
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: "var(--cs-blue-soft)",
                  color: "var(--cs-blue)",
                }}
              >
                {card.kind} · {card.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PierreTraceTimeline({
  messages,
}: {
  messages: PierreCockpitMessage[];
}) {
  if (messages.length === 0) {
    return (
      <EmptyState
        icon="⏳"
        title="Aucun événement"
        subtitle="La chronologie des échanges et actions de Pierre apparaîtra ici."
      />
    );
  }

  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div className="flex flex-col">
      <h3
        className="mb-4 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--cs-ink-4)" }}
      >
        Chronologie · {messages.length} événement{messages.length > 1 ? "s" : ""}
      </h3>
      <div>
        {sorted.map((msg) => (
          <TimelineEvent key={msg.id} msg={msg} />
        ))}
      </div>
    </div>
  );
}
