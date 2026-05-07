import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

export function ActionButton({
  href,
  label,
  primary = false,
  icon,
}: {
  href: string;
  label: string;
  primary?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-all duration-[var(--cs-speed-fast)] ease-[var(--cs-ease)] border",
        primary
          ? "border-[color:color-mix(in_srgb,var(--cs-violet)_18%,white)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cs-violet)_92%,white),color-mix(in_srgb,var(--cs-violet-2)_30%,var(--cs-violet)))] text-white shadow-[0_18px_40px_rgba(95,92,230,0.18)] hover:-translate-y-0.5"
          : "border-[color:color-mix(in_srgb,var(--cs-line-soft)_68%,white)] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.82),rgba(255,250,244,0.56))] text-[var(--cs-ink-2)] hover:-translate-y-0.5 hover:bg-white/92",
      ].join(" ")}
    >
      {label}
      {icon}
    </Link>
  );
}

export function SectionTitle({
  kicker,
  title,
  text,
  right,
}: {
  kicker: string;
  title: string;
  text: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--cs-ink-4)]">
          {kicker}
        </p>
        <h2 className="cs-heading text-2xl md:text-4xl">{title}</h2>
        <p className="text-sm text-[var(--cs-ink-4)] md:text-base">{text}</p>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function InfoCard({
  title,
  text,
  icon,
  tone = "violet",
}: {
  title: string;
  text: string;
  icon: ReactNode;
  tone?: "violet" | "blue" | "rose" | "green";
}) {
  const toneClass =
    tone === "violet"
      ? "text-[var(--cs-violet)]"
      : tone === "blue"
        ? "text-[color:#4f73ff]"
        : tone === "rose"
          ? "text-[var(--cs-danger)]"
          : "text-[var(--cs-success)]";

  return (
    <div className="cs-card h-full">
      <div className="relative flex h-full flex-col gap-4">
        <div className={`flex items-center gap-2 ${toneClass}`}>
          {icon}
          <span className="text-sm font-medium text-[var(--cs-ink-2)]">
            {title}
          </span>
        </div>
        <p className="text-sm leading-7 text-[var(--cs-ink-4)]">{text}</p>
      </div>
    </div>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-violet)]" />
          <span className="text-sm leading-7 text-[var(--cs-ink-4)]">{item}</span>
        </li>
      ))}
    </ul>
  );
}