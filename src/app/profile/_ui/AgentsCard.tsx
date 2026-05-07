import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AgentRowObject = {
  name?: ReactNode;
  role?: ReactNode;
  status?: ReactNode;
};

type AgentRow = ReactNode | AgentRowObject;

export type AgentsCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  rows?: AgentRow[];
  ctaLabel?: ReactNode;
  ctaHref?: string;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

function isAgentRowObject(row: AgentRow): row is AgentRowObject {
  return (
    typeof row === "object" &&
    row !== null &&
    !Array.isArray(row) &&
    ("name" in row || "role" in row || "status" in row)
  );
}

function renderRow(row: AgentRow, index: number) {
  if (isAgentRowObject(row)) {
    return (
      <div
        key={index}
        className="rounded-[1.05rem] border border-[var(--cs-line-soft)] bg-white/58 px-4 py-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--cs-ink-2)]">{row.name}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--cs-ink-4)]">{row.role}</p>
          </div>
          {row.status ? <div className="shrink-0">{row.status}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      key={index}
      className="rounded-[1.05rem] border border-[var(--cs-line-soft)] bg-white/58 px-4 py-3 text-sm leading-6 text-[var(--cs-ink-4)]"
    >
      {row}
    </div>
  );
}

export default function AgentsCard({
  title = "Employés IA",
  description = "Vue condensée des employés liés au compte.",
  icon,
  rows,
  ctaLabel,
  ctaHref,
  footer,
  children,
  className,
}: AgentsCardProps) {
  return (
    <section className={cn("cs-card h-full", className)}>
      <div className="relative flex h-full flex-col justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[var(--cs-violet)]">
            {icon ?? <BriefcaseBusiness className="h-4 w-4" />}
            <span className="text-sm font-medium text-[var(--cs-ink-2)]">{title}</span>
          </div>

          <p className="text-sm leading-6 text-[var(--cs-ink-4)]">{description}</p>

          {rows && rows.length > 0 ? <div className="grid gap-3">{rows.map(renderRow)}</div> : null}

          {children ? <div>{children}</div> : null}
        </div>

        {ctaHref && ctaLabel ? (
          <Link
            href={ctaHref}
            className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--cs-line-soft)] bg-white/72 px-4 text-sm font-medium text-[var(--cs-ink-2)] transition hover:-translate-y-0.5 hover:bg-white/92"
          >
            {ctaLabel}
          </Link>
        ) : footer ? (
          <div>{footer}</div>
        ) : null}
      </div>
    </section>
  );
}