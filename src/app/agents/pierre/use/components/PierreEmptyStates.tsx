// src/app/agents/pierre/use/components/PierreEmptyStates.tsx
// Empty, loading, error state components — Pierre Cockpit B31.1.
// No emojis. CloneStore design DNA.

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Chargement…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12 text-center", className)}>
      <div
        className="h-7 w-7 rounded-full border-2 animate-spin"
        style={{
          borderColor: "var(--cs-champagne)",
          borderTopColor: "var(--cs-graphite-3)",
        }}
        aria-hidden="true"
      />
      <p style={{ color: "var(--cs-ink-4)", fontSize: 13 }}>{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-14 text-center px-6", className)}>
      {icon && (
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{
            background: "var(--cs-bg-2)",
            border: "1px solid var(--cs-line)",
            color: "var(--cs-ink-4)",
          }}
        >
          {icon}
        </div>
      )}
      <p style={{ color: "var(--cs-ink-2)", fontSize: 14, fontWeight: 600 }}>{title}</p>
      {subtitle && (
        <p style={{ color: "var(--cs-ink-4)", fontSize: 13, maxWidth: 320 }}>{subtitle}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12 text-center px-6", className)}>
      <div
        className="flex h-10 w-10 items-center justify-center rounded-2xl"
        style={{ background: "var(--cs-danger-bg)", color: "var(--cs-danger)" }}
      >
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <p style={{ color: "var(--cs-danger)", fontSize: 13 }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-lg px-4 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: "var(--cs-bg-3)", color: "var(--cs-ink-2)" }}
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
