import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ProfileSection({
  title,
  description,
  children,
  right,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("cs-panel p-5", className)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="cs-eyebrow">{title}</p>
            {description ? (
              <p className="text-[0.88rem] leading-6 text-[var(--cs-ink-3)]">
                {description}
              </p>
            ) : null}
          </div>
          {right ? <div>{right}</div> : null}
        </div>

        {children}
      </div>
    </section>
  );
}

export function ProfileStatCard({
  title,
  value,
  helper,
  icon,
  tone = "violet",
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: ReactNode;
  tone?: "violet" | "success" | "blue" | "default";
}) {
  const toneClass =
    tone === "success"
      ? "text-[var(--cs-success)]"
      : tone === "blue"
        ? "text-[color:#4f73ff]"
        : tone === "default"
          ? "text-[var(--cs-ink-4)]"
          : "text-[var(--cs-violet)]";

  return (
    <div className="cs-card cs-card-tight">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[0.8rem] font-medium text-[var(--cs-ink-4)]">
            {title}
          </p>
          <p className="text-[1.35rem] font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
            {value}
          </p>
          <p className="text-[0.82rem] leading-6 text-[var(--cs-ink-3)]">
            {helper}
          </p>
        </div>
        <div className={cn("mt-0.5", toneClass)}>{icon}</div>
      </div>
    </div>
  );
}

export function ProfileActionLink({
  href,
  label,
  primary = false,
  icon,
  className,
}: {
  href: string;
  label: string;
  primary?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[0.88rem] font-medium transition-all duration-[var(--cs-speed-fast)] ease-[var(--cs-ease)] border",
        primary
          ? "border-[color:color-mix(in_srgb,var(--cs-violet)_18%,white)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cs-violet)_92%,white),color-mix(in_srgb,var(--cs-violet-2)_30%,var(--cs-violet)))] text-white shadow-[0_12px_30px_rgba(95,92,230,0.18)] hover:-translate-y-0.5"
          : "border-[color:color-mix(in_srgb,var(--cs-line-soft)_68%,white)] bg-white/60 text-[var(--cs-ink-2)] hover:-translate-y-0.5 hover:bg-white/88",
        className,
      )}
    >
      <span>{label}</span>
      {icon ?? <ArrowRight className="h-4 w-4" />}
    </Link>
  );
}

export function ProfileQuickLink({
  href,
  title,
  text,
  badge,
}: {
  href: string;
  title: string;
  text: string;
  badge?: ReactNode;
}) {
  return (
    <Link href={href} className="cs-card cs-card-tight cs-hover-lift block">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[0.9rem] font-semibold text-[var(--cs-ink-1)]">
            {title}
          </p>
          <p className="text-[0.84rem] leading-6 text-[var(--cs-ink-3)]">
            {text}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {badge ? <div className="shrink-0">{badge}</div> : null}
          <ChevronRight className="mt-0.5 h-4 w-4 text-[var(--cs-ink-4)]" />
        </div>
      </div>
    </Link>
  );
}

export function ProfileControlCard({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <div className="cs-card cs-card-tight">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-[var(--cs-violet)]">{icon}</div>
        <div className="space-y-1">
          <p className="text-[0.88rem] font-semibold text-[var(--cs-ink-1)]">
            {title}
          </p>
          <p className="text-[0.84rem] leading-6 text-[var(--cs-ink-3)]">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ProfileMetaRow({
  label,
  value,
  icon,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[1.15rem] border border-[var(--cs-line-soft)] bg-white/34 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="text-[var(--cs-ink-4)]">{icon}</div>
        <p className="text-[0.84rem] text-[var(--cs-ink-3)]">{label}</p>
      </div>

      <p
        className={cn(
          "max-w-[58%] text-right text-[0.86rem] font-medium text-[var(--cs-ink-1)]",
          mono && "font-mono text-[0.76rem]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function ProfileErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-[1.2rem] border border-[rgba(184,66,66,0.18)] bg-[rgba(184,66,66,0.06)] px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--cs-danger)]" />
        <p className="text-[0.84rem] leading-6 text-[var(--cs-danger)]">
          {message}
        </p>
      </div>
    </div>
  );
}

export function ProfileEmptyState({
  title,
  text,
  actions,
}: {
  title: string;
  text: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--cs-line-soft)] bg-white/28 px-4 py-5">
      <div className="space-y-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-violet)]">
          <ShieldCheck className="h-4 w-4" />
        </div>

        <div className="space-y-1">
          <p className="text-[0.96rem] font-semibold text-[var(--cs-ink-1)]">
            {title}
          </p>
          <p className="max-w-2xl text-[0.84rem] leading-6 text-[var(--cs-ink-3)]">
            {text}
          </p>
        </div>

        {actions ? <div className="flex flex-wrap gap-3 pt-1">{actions}</div> : null}
      </div>
    </div>
  );
}