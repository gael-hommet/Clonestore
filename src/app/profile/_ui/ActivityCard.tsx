import Link from "next/link";
import { Activity } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ActivityRowObject = {
  title?: ReactNode;
  text?: ReactNode;
};

type LooseRow = ReactNode | ActivityRowObject;

export type ActivityCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  rows?: LooseRow[];
  ctaLabel?: ReactNode;
  ctaHref?: string;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

function isActivityRowObject(row: LooseRow): row is ActivityRowObject {
  return (
    typeof row === "object" &&
    row !== null &&
    !Array.isArray(row) &&
    ("title" in row || "text" in row)
  );
}

function renderRow(row: LooseRow, index: number) {
  if (isActivityRowObject(row)) {
    return (
      <div
        key={index}
        className="rounded-[1.05rem] border border-[var(--cs-line-soft)] bg-white/58 px-4 py-3"
      >
        <p className="text-sm font-medium text-[var(--cs-ink-2)]">{row.title}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--cs-ink-4)]">{row.text}</p>
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

export default function ActivityCard({
  title = "Activité",
  description = "Lecture simple de l’activité récente.",
  icon,
  rows,
  ctaLabel,
  ctaHref,
  footer,
  children,
  className,
}: ActivityCardProps) {
  return (
    <section className={cn("cs-card h-full", className)}>
      <div className="relative flex h-full flex-col justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[var(--cs-violet)]">
            {icon ?? <Activity className="h-4 w-4" />}
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