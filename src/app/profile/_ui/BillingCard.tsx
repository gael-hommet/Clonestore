import Link from "next/link";
import { CreditCard } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BillingLineObject = {
  label?: ReactNode;
  value?: ReactNode;
};

type BillingLine = ReactNode | BillingLineObject;

export type BillingCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  price?: ReactNode;
  icon?: ReactNode;
  lines?: BillingLine[];
  ctaLabel?: ReactNode;
  ctaHref?: string;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

function isBillingLineObject(line: BillingLine): line is BillingLineObject {
  return (
    typeof line === "object" &&
    line !== null &&
    !Array.isArray(line) &&
    ("label" in line || "value" in line)
  );
}

function renderLine(line: BillingLine, index: number) {
  if (isBillingLineObject(line)) {
    return (
      <div
        key={index}
        className="flex items-center justify-between gap-3 rounded-[1.05rem] border border-[var(--cs-line-soft)] bg-white/58 px-4 py-3"
      >
        <span className="text-sm text-[var(--cs-ink-4)]">{line.label}</span>
        <span className="text-sm font-medium text-[var(--cs-ink-2)]">{line.value}</span>
      </div>
    );
  }

  return (
    <div
      key={index}
      className="rounded-[1.05rem] border border-[var(--cs-line-soft)] bg-white/58 px-4 py-3 text-sm leading-6 text-[var(--cs-ink-4)]"
    >
      {line}
    </div>
  );
}

export default function BillingCard({
  title = "Facturation",
  description = "Informations de facturation et d’abonnement.",
  price,
  icon,
  lines,
  ctaLabel,
  ctaHref,
  footer,
  children,
  className,
}: BillingCardProps) {
  return (
    <section className={cn("cs-card h-full", className)}>
      <div className="relative flex h-full flex-col justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[var(--cs-violet)]">
            {icon ?? <CreditCard className="h-4 w-4" />}
            <span className="text-sm font-medium text-[var(--cs-ink-2)]">{title}</span>
          </div>

          {price ? (
            <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
              {price}
            </p>
          ) : null}

          <p className="text-sm leading-6 text-[var(--cs-ink-4)]">{description}</p>

          {lines && lines.length > 0 ? <div className="grid gap-3">{lines.map(renderLine)}</div> : null}

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