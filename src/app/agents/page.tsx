"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  BriefcaseBusiness,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { AGENTS, type AgentSpec } from "@/lib/agent-catalog";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { cn } from "@/lib/utils";

function isAvailableNow(slug: string) {
  return slug === "pierre";
}

function getAgentPrice(agent: AgentSpec) {
  if (agent.slug === "pierre") return "449 €/mois";
  return "À venir";
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getAgentSearchAliases(agent: AgentSpec) {
  const aliasesBySlug: Record<string, string> = {
    pierre:
      "rh ressources humaines hr administratif documents courrier mail email recrutement onboarding salarie collaborateur convocation relance contrat note refus entretien employe ia rh operationnel",
    clara:
      "rh ressources humaines recrutement recruteuse candidats candidatures shortlist entretien pipeline talent sourcing embauche profil cv selection poste recruteur",
    emma:
      "support client relation client sav messages mails tickets reponse reclamation satisfaction suivi client service client",
    noah:
      "direction dirigeant assistant direction decision synthese priorites compte rendu pilotage reunion organisation executive",
    alex:
      "operations ops coordination process suivi operationnel production planning taches execution terrain",
    adrien:
      "commandes operations achat fournisseur livraison suivi commande logistique coordination fournisseur",
    lucas:
      "finance comptabilite facture relance paiement tresorerie depenses budget analyse financier",
    sophie:
      "administratif direction administrative gestion bureau documents procedures organisation coordination administrative",
  };

  return aliasesBySlug[agent.slug] ?? "";
}

function buildAgentSearchText(agent: AgentSpec) {
  return normalizeSearch(
    [
      agent.name,
      agent.slug,
      agent.role,
      agent.pricingNote ?? "",
      ...(agent.does ?? []),
      getAgentSearchAliases(agent),
    ].join(" ")
  );
}

function sortAgentsForShop(agents: AgentSpec[]) {
  return [...agents].sort((a, b) => {
    const aAvailable = isAvailableNow(a.slug);
    const bAvailable = isAvailableNow(b.slug);

    if (aAvailable && !bAvailable) return -1;
    if (!aAvailable && bAvailable) return 1;

    return a.name.localeCompare(b.name);
  });
}

function ActionButton({
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
      className={cn(
        "clone-liquid-button min-h-10 px-4 text-[0.82rem]",
        primary && "clone-liquid-button--dark"
      )}
    >
      <span>{label}</span>
      {icon}
    </Link>
  );
}

function StatusChip({ available }: { available: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.72rem] font-bold backdrop-blur-xl",
        available
          ? "border-emerald-500/20 bg-white/42 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_24px_rgba(20,120,80,0.07)]"
          : "border-white/54 bg-white/34 text-[var(--cs-ink-4)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_24px_rgba(38,32,22,0.05)]"
      )}
    >
      {available ? (
        <BadgeCheck className="h-3.5 w-3.5" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {available ? "Disponible" : "Bientôt"}
    </span>
  );
}

function AgentShopCard({ agent }: { agent: AgentSpec }) {
  const available = isAvailableNow(agent.slug);
  const highlights = agent.does.slice(0, 3);

  return (
    <LiquidGlass
      variant="panel"
      intensity="strong"
      refractive
      interactive
      className="group h-full overflow-hidden rounded-[2.15rem] p-[1px]"
    >
      <article className="relative flex h-full min-h-[410px] flex-col justify-between overflow-hidden rounded-[2.08rem] border border-white/58 bg-[linear-gradient(145deg,rgba(255,255,255,0.52),rgba(255,255,255,0.20)_48%,rgba(250,247,239,0.22))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_22px_58px_rgba(38,32,22,0.075)] backdrop-blur-[28px] md:p-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-24 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.86),transparent_70%)] blur-3xl" />
          <div className="absolute -right-24 top-0 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(111,131,255,0.12),transparent_70%)] blur-3xl" />
          <div className="absolute bottom-[-110px] left-[18%] h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(216,193,152,0.13),transparent_70%)] blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.25rem] border border-white/60 bg-white/42 text-[#6f83ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_28px_rgba(38,32,22,0.07)] backdrop-blur-xl">
                <Sparkles className="h-4.5 w-4.5" />
              </span>

              <div className="min-w-0">
                <h2 className="text-[1.45rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
                  {agent.name}
                </h2>
                <p className="mt-1 text-sm font-medium leading-6 text-[var(--cs-ink-3)]">
                  {agent.role}
                </p>
              </div>
            </div>

            <StatusChip available={available} />
          </div>

          <div className="mt-6 rounded-[1.55rem] border border-white/46 bg-white/26 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[var(--cs-ink-4)]">
              Tarif
            </p>
            <p className="mt-2 text-[1.55rem] font-semibold tracking-[-0.06em] text-[var(--cs-ink-1)]">
              {getAgentPrice(agent)}
            </p>
          </div>

          <div className="mt-5 space-y-2.5">
            {highlights.map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <span className="mt-[0.52rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#6f83ff] shadow-[0_0_12px_rgba(111,131,255,0.5)]" />
                <p className="text-[0.88rem] leading-6 text-[var(--cs-ink-3)]">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-6 flex flex-wrap gap-2.5">
          <ActionButton
            href={`/agents/${agent.slug}`}
            label="Voir"
            primary={available}
            icon={<ArrowRight className="h-3.5 w-3.5" />}
          />

          {available ? (
            <ActionButton
              href="/checkout?agent=pierre"
              label="Activer"
              icon={<Sparkles className="h-3.5 w-3.5" />}
            />
          ) : (
            <ActionButton
              href="/questions"
              label="Question"
              icon={<Bot className="h-3.5 w-3.5" />}
            />
          )}
        </div>
      </article>
    </LiquidGlass>
  );
}

export default function AgentsPage() {
  const [query, setQuery] = useState("");

  const sortedAgents = useMemo(() => sortAgentsForShop(AGENTS), []);

  const normalizedQuery = useMemo(() => normalizeSearch(query), [query]);

  const filteredAgents = useMemo(() => {
    if (!normalizedQuery) return sortedAgents;

    return sortedAgents.filter((agent) =>
      buildAgentSearchText(agent).includes(normalizedQuery)
    );
  }, [normalizedQuery, sortedAgents]);

  const readyAgents = useMemo(
    () => sortedAgents.filter((agent) => isAvailableNow(agent.slug)),
    [sortedAgents]
  );

  const upcomingAgents = useMemo(
    () => sortedAgents.filter((agent) => !isAvailableNow(agent.slug)),
    [sortedAgents]
  );

  return (
    <main className="cs-page">
      <div className="cs-page-shell py-8 md:py-10">
        <div className="space-y-6">
          <LiquidGlass
            variant="panel"
            intensity="strong"
            refractive
            className="relative overflow-hidden rounded-[2.6rem] p-6 md:p-8"
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-[-180px] top-[-190px] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.88),transparent_70%)] blur-3xl" />
              <div className="absolute right-[-160px] top-[-160px] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(111,131,255,0.12),transparent_72%)] blur-3xl" />
              <div className="absolute bottom-[-180px] right-[14%] h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,rgba(216,193,152,0.15),transparent_72%)] blur-3xl" />
            </div>

            <div className="relative z-10 grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.42fr)] xl:items-end">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="cs-pill">
                    <BriefcaseBusiness className="h-3.5 w-3.5 text-[#6f83ff]" />
                    Boutique CloneStore
                  </span>
                  <span className="cs-pill">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                    Employés IA
                  </span>
                </div>

                <h1 className="cs-heading mt-6 text-[clamp(2.6rem,5vw,5.1rem)] leading-[0.94]">
                  Boutique
                </h1>

                <p className="mt-4 max-w-2xl text-[1rem] leading-8 text-[var(--cs-ink-3)] md:text-[1.06rem]">
                  Choisissez les employés IA à intégrer dans votre entreprise.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <LiquidGlass
                  variant="clear"
                  intensity="soft"
                  className="rounded-[1.7rem] px-5 py-4"
                >
                  <p className="text-[1.8rem] font-semibold tracking-[-0.07em] text-[var(--cs-ink-1)]">
                    {readyAgents.length}
                  </p>
                  <p className="mt-1 text-xs text-[var(--cs-ink-4)]">
                    disponible maintenant
                  </p>
                </LiquidGlass>

                <LiquidGlass
                  variant="clear"
                  intensity="soft"
                  className="rounded-[1.7rem] px-5 py-4"
                >
                  <p className="text-[1.8rem] font-semibold tracking-[-0.07em] text-[var(--cs-ink-1)]">
                    {upcomingAgents.length}
                  </p>
                  <p className="mt-1 text-xs text-[var(--cs-ink-4)]">
                    en construction
                  </p>
                </LiquidGlass>
              </div>
            </div>
          </LiquidGlass>

          <LiquidGlass
            variant="panel"
            intensity="strong"
            refractive
            className="rounded-[2.2rem] p-3 md:p-4"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[var(--cs-ink-4)]" />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un employé, un métier, un besoin… exemple : RH, recrutement, support, finance"
                className="h-14 w-full rounded-full border border-white/56 bg-white/34 px-12 text-[0.95rem] font-medium text-[var(--cs-ink-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_14px_34px_rgba(38,32,22,0.06)] outline-none backdrop-blur-xl placeholder:text-[var(--cs-ink-4)] focus:border-white/80 focus:bg-white/48"
              />

              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/56 bg-white/42 text-[var(--cs-ink-3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl transition hover:text-[var(--cs-ink-1)]"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </LiquidGlass>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="cs-eyebrow">Catalogue</p>
                <h2 className="cs-heading mt-2 text-[clamp(1.7rem,2.6vw,2.8rem)]">
                  {normalizedQuery
                    ? `${filteredAgents.length} résultat${
                        filteredAgents.length > 1 ? "s" : ""
                      }`
                    : "Tous les employés IA"}
                </h2>
              </div>
            </div>

            {filteredAgents.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredAgents.map((agent) => (
                  <AgentShopCard key={agent.slug} agent={agent} />
                ))}
              </div>
            ) : (
              <LiquidGlass
                variant="panel"
                intensity="strong"
                refractive
                className="rounded-[2.2rem] p-8 text-center"
              >
                <p className="text-lg font-semibold text-[var(--cs-ink-1)]">
                  Aucun employé trouvé.
                </p>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-[var(--cs-ink-3)]">
                  Essayez un autre besoin : RH, recrutement, support, finance,
                  administratif, opérations ou direction.
                </p>
              </LiquidGlass>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}