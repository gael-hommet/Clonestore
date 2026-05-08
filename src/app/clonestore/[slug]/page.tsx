import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import {
  CLONESTORE_SECTIONS,
  getCloneStoreSectionById,
  type CloneStoreSection,
} from "@/components/site/clonestore-sections";

export function generateStaticParams() {
  return CLONESTORE_SECTIONS.map((section: CloneStoreSection) => ({
    slug: section.id,
  }));
}

function ActionButton({
  href,
  label,
  primary = false,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-all duration-[var(--cs-speed-fast)] ease-[var(--cs-ease)] border",
        primary
          ? "border-[rgba(111,99,246,0.16)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cs-violet)_92%,white),color-mix(in_srgb,var(--cs-violet-2)_88%,white))] text-white shadow-[0_18px_40px_rgba(95,92,230,0.18)] hover:-translate-y-0.5"
          : "border-[var(--cs-line-soft)] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.82),rgba(255,250,244,0.56))] text-[var(--cs-ink-2)] hover:-translate-y-0.5 hover:bg-white/92",
      ].join(" ")}
    >
      {label}
      {primary ? <ArrowRight className="h-4 w-4" /> : null}
    </Link>
  );
}

export default async function CloneStoreDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const section = getCloneStoreSectionById(slug);

  if (!section) {
    notFound();
  }

  return (
    <div className="cs-page">
      <div className="cs-page-shell">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--cs-line-soft)] bg-white/58 px-4 py-2 text-[0.84rem] font-medium text-[var(--cs-ink-2)] transition hover:-translate-y-0.5 hover:bg-white/84"
            >
              <ChevronLeft className="h-4 w-4" />
              Retour à l’accueil
            </Link>

            <span className="cs-pill">
              <Sparkles className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
              <span>{section.label}</span>
            </span>
          </div>

          <section className="cs-command-surface overflow-hidden">
            <div className="space-y-5">
              <p className="cs-eyebrow">{section.label}</p>

              <h1 className="cs-display text-[clamp(2rem,3.4vw,4.4rem)] leading-[0.96]">
                {section.title}
              </h1>

              <p className="max-w-4xl text-[0.94rem] leading-7 text-[var(--cs-ink-3)]">
                {section.intro}
              </p>

              <div className="flex flex-wrap gap-3">
                <ActionButton href="/assistant" label="Ouvrir CloneChat" primary />
                <ActionButton href="/profile" label="Aller au cockpit" />
              </div>
            </div>
          </section>

          <section className="cs-panel">
            <div className="p-6 md:p-7">
              <div className="max-w-4xl">
                <p className="cs-eyebrow">Résumé</p>
                <p className="mt-3 text-base leading-8 text-[var(--cs-ink-3)]">
                  {section.summary}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.blocks.map((block) => (
              <article key={block.title} className="cs-card h-full">
                <div className="space-y-3">
                  <h2 className="text-[1rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
                    {block.title}
                  </h2>
                  <p className="text-[0.9rem] leading-7 text-[var(--cs-ink-3)]">
                    {block.text}
                  </p>
                </div>
              </article>
            ))}
          </section>

          <section className="cs-panel overflow-hidden">
            <div className="p-6 text-center md:p-8">
              <div className="mx-auto w-fit">
                <span className="cs-pill">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                  <span>CloneStore doit rester lisible</span>
                </span>
              </div>

              <h2 className="cs-heading mt-6 text-3xl md:text-5xl">
                Comprendre la technologie,
                <br />
                sans perdre la simplicité.
              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--cs-ink-4)] md:text-base">
                Ces pages servent à expliquer la profondeur de CloneStore sans noyer
                le client. Le système doit rester premium, lisible et crédible.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <ActionButton href="/assistant" label="Ouvrir CloneChat" primary />
                <ActionButton href="/" label="Retour accueil" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}