import Link from "next/link";
import { UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AccountItemObject = {
  label?: ReactNode;
  value?: ReactNode;
};

type LooseItem = ReactNode | AccountItemObject;

export type AccountCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  value?: ReactNode;
  helper?: ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
  items?: LooseItem[];
  ctaLabel?: ReactNode;
  ctaHref?: string;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

function isAccountItemObject(item: LooseItem): item is AccountItemObject {
  return (
    typeof item === "object" &&
    item !== null &&
    !Array.isArray(item) &&
    ("label" in item || "value" in item)
  );
}

function renderItem(item: LooseItem, index: number) {
  if (isAccountItemObject(item)) {
    return (
      <div
        key={index}
        className="rounded-[1.05rem] border border-[var(--cs-line-soft)] bg-white/58 px-4 py-3"
      >
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">
          {item.label}
        </p>
        <p className="mt-1 text-sm font-medium text-[var(--cs-ink-2)]">{item.value}</p>
      </div>
    );
  }

  return (
    <div
      key={index}
      className="rounded-[1.05rem] border border-[var(--cs-line-soft)] bg-white/58 px-4 py-3 text-sm leading-6 text-[var(--cs-ink-4)]"
    >
      {item}
    </div>
  );
}

export default function AccountCard({
  title = "Compte",
  description = "Résumé du compte CloneStore.",
  value,
  helper,
  badge,
  icon,
  items,
  ctaLabel,
  ctaHref,
  footer,
  children,
  className,
}: AccountCardProps) {
  return (
    <section className={cn("cs-card h-full", className)}>
      <div className="relative flex h-full flex-col justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--cs-violet)]">
                {icon ?? <UserRound className="h-4 w-4" />}
                <span className="text-sm font-medium text-[var(--cs-ink-2)]">{title}</span>
              </div>

              {value ? (
                <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
                  {value}
                </p>
              ) : null}

              <p className="text-sm leading-6 text-[var(--cs-ink-4)]">{description}</p>
            </div>

            {badge ? <div className="shrink-0">{badge}</div> : null}
          </div>

          {helper ? <p className="text-xs text-[var(--cs-ink-4)]">{helper}</p> : null}

          {items && items.length > 0 ? <div className="grid gap-3">{items.map(renderItem)}</div> : null}

          {children ? <div>{children}</div> : null}
        </div>

        {ctaHref && ctaLabel ? (
          <div>
            <Link
              href={ctaHref}
              className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--cs-line-soft)] bg-white/72 px-4 text-sm font-medium text-[var(--cs-ink-2)] transition hover:-translate-y-0.5 hover:bg-white/92"
            >
              {ctaLabel}
            </Link>
          </div>
        ) : footer ? (
          <div>{footer}</div>
        ) : null}
      </div>
    </section>
  );
}
