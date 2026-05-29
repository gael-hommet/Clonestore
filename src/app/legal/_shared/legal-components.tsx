// Shared components for CloneStore legal pages.
// These components follow the same visual style as /legal/confidentialite.

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="cs-card">
      <div className="relative space-y-4">
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
          {title}
        </h3>
        <div className="space-y-3 text-sm leading-7 text-[var(--cs-ink-4)]">
          {children}
        </div>
      </div>
    </section>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cs-violet)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LegalValidationBanner({ version = "Draft" }: { version?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <p className="text-xs leading-6 text-amber-800">
        <strong>Version {version} — à faire valider par un conseil juridique.</strong>{" "}
        Ce document constitue une base de travail destinée à être révisée et validée par un avocat
        ou juriste compétent avant toute utilisation contractuelle officielle. CloneStore n'est pas
        un cabinet juridique. Ce contenu n'est pas un avis juridique.
      </p>
    </div>
  );
}

export function LegalHero({
  pill,
  title,
  subtitle,
  icon,
  backHref = "/",
  backLabel = "Retour",
}: {
  pill: string;
  title: ReactNode;
  subtitle: string;
  icon: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <section className="cs-command-surface overflow-hidden">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="cs-pill">
            {icon}
            <span>{pill}</span>
          </span>
          <span className="cs-pill">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>Draft — validation juridique requise</span>
          </span>
        </div>
        <div className="space-y-4">
          <h1 className="cs-display text-[clamp(2rem,3.5vw,4.2rem)] leading-[0.96]">{title}</h1>
          <p className="max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
            {subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={backHref}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-[rgba(255,255,255,0.72)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.56)_100%)] px-5 text-sm font-semibold text-[var(--cs-ink-2)] shadow-[0_10px_30px_rgba(31,41,55,0.06),inset_0_1px_0_rgba(255,255,255,0.82)] transition-all hover:-translate-y-0.5"
          >
            <span>{backLabel}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LegalNavBar() {
  const links = [
    { href: "/legal/cgu", label: "CGU" },
    { href: "/legal/cgv", label: "CGV" },
    { href: "/legal/confidentialite", label: "Confidentialité" },
    { href: "/legal/dpa", label: "DPA" },
    { href: "/legal/mentions", label: "Mentions légales" },
  ];
  return (
    <nav className="cs-panel px-4 py-3">
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border border-[rgba(255,255,255,0.6)] bg-white/60 px-3 py-1.5 text-xs font-medium text-[var(--cs-ink-3)] transition-colors hover:text-[var(--cs-ink-1)]"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
