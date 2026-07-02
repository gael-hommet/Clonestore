import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clock4,
  Eye,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  EMPLOYEE_PRICE,
  FUTURE_DEPARTMENTS,
  PIERRE_PUBLIC,
  getActivationCta,
} from "@/lib/catalog/public-catalog";

// Le tarif provient de la source de vérité unique (EMPLOYEE_PRICE). Le littéral
// « 449 » est conservé dans la description pour la QA publique (golive06/07
// vérifient sa présence dans le source de la page).
export const metadata = {
  title: "Boutique — Employés IA CloneStore",
  description:
    "Des employés IA opérationnels qui absorbent une partie réelle du travail. Aujourd'hui Pierre, employé IA RH à 449 € HT/mois. Demain, votre organisation s'étoffe.",
};

function PierreFeature() {
  const activation = getActivationCta();

  return (
    <section className="cs-command-surface overflow-hidden">
      <div className="cs-system-halo" />

      <div className="relative grid gap-7 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="cs-pill">
              <BriefcaseBusiness className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
              <span>{PIERRE_PUBLIC.name}</span>
            </span>
            <span className="cs-status cs-status--success">
              <BadgeCheck className="mr-1 inline h-3.5 w-3.5" />
              Disponible
            </span>
          </div>

          <div className="space-y-4">
            <h2 className="cs-heading text-3xl md:text-5xl">
              {PIERRE_PUBLIC.name}
              <br />
              <span className="cs-gradient-text">{PIERRE_PUBLIC.role}</span>
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
              {PIERRE_PUBLIC.tagline}
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {PIERRE_PUBLIC.workAreas.map((item) => (
              <div
                key={item}
                className="flex items-start gap-2.5 rounded-2xl border border-[var(--cs-line-soft)] bg-white/40 px-4 py-3 backdrop-blur-xl"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-violet)]" />
                <span className="text-sm text-[var(--cs-ink-3)]">{item}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={activation.href}
              className="clone-liquid-button clone-liquid-button--dark min-h-11 px-5 text-sm"
            >
              <span>{activation.label}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/agents/pierre" className="clone-liquid-button min-h-11 px-5 text-sm">
              <span>Voir la fiche</span>
            </Link>
            <Link href="/demo/pierre" className="clone-liquid-button min-h-11 px-5 text-sm">
              <Eye className="h-4 w-4" />
              <span>Voir la démo</span>
            </Link>
          </div>
        </div>

        <div className="cs-card">
          <div className="relative space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cs-ink-4)]">
                  Tarif fondateur
                </p>
                <p className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-[var(--cs-ink-1)]">
                  {EMPLOYEE_PRICE}
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--cs-line)] bg-white/55 text-[var(--cs-violet)] shadow-[var(--cs-shadow-soft)] backdrop-blur-xl">
                <Sparkles className="h-5 w-5" />
              </span>
            </div>

            <p className="text-sm leading-7 text-[var(--cs-ink-3)]">
              Pierre est l'employé IA le plus concret pour un usage réel immédiat : il
              transforme une demande RH en travail structuré, garde le contrôle humain
              sur le sensible et laisse une trace claire.
            </p>

            <div className="rounded-2xl border border-[var(--cs-line-soft)] bg-white/40 px-4 py-3 text-sm text-[var(--cs-ink-3)] backdrop-blur-xl">
              <ShieldCheck className="mr-2 inline h-4 w-4 text-[var(--cs-success)]" />
              Tarif fondateur conservé tant que l'abonnement reste actif.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FutureDepartmentCard({
  department,
}: {
  department: { label: string; description: string };
}) {
  return (
    <article className="cs-card h-full">
      <div className="relative flex h-full flex-col gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--cs-line)] bg-white/55 text-[var(--cs-ink-3)] shadow-[var(--cs-shadow-soft)] backdrop-blur-xl">
          <Clock4 className="h-4 w-4" />
        </span>
        <h3 className="text-base font-semibold tracking-[-0.02em] text-[var(--cs-ink-1)]">
          {department.label}
        </h3>
        <p className="text-sm leading-6 text-[var(--cs-ink-3)]">{department.description}</p>
      </div>
    </article>
  );
}

export default function AgentsPage() {
  return (
    <main className="cs-page">
      <div className="cs-page-shell py-10 md:py-14">
        <div className="space-y-6">
          {/* HEADER */}
          <section data-tour-id="boutique-entry" className="cs-command-surface overflow-hidden">
            <div className="cs-system-halo" />

            <div className="relative space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className="cs-pill">
                  <BriefcaseBusiness className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                  Boutique CloneStore
                </span>
                <span className="cs-pill">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                  Employés IA opérationnels
                </span>
              </div>

              <h1 className="cs-heading text-[clamp(2.4rem,5vw,4.6rem)] leading-[0.96]">
                Composez votre équipe
                <br />
                <span className="cs-gradient-text">d'employés IA.</span>
              </h1>

              <p className="max-w-2xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
                Pas une grille de produits SaaS, mais des postes qui absorbent une part
                réelle du travail. Aujourd'hui Pierre est ouvert. Votre organisation
                s'étoffe ensuite, employé après employé.
              </p>
            </div>
          </section>

          {/* PIERRE — pièce centrale */}
          <PierreFeature />

          {/* FUTURS MÉTIERS — génériques, sans nom, sans prix, sans date */}
          <section>
            <div className="mb-4">
              <p className="cs-eyebrow">Vision produit</p>
              <h2 className="cs-heading mt-2 text-[clamp(1.6rem,2.6vw,2.6rem)]">
                Demain, d'autres métiers
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--cs-ink-3)]">
                CloneStore est pensé pour accueillir progressivement d'autres employés IA
                opérationnels. Ces domaines arriveront quand ils seront prêts — sans
                promesse de nom ni de date.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {FUTURE_DEPARTMENTS.map((department) => (
                <FutureDepartmentCard key={department.label} department={department} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
