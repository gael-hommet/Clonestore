import { notFound } from "next/navigation";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { AGENTS, type AgentSpec } from "@/lib/agent-catalog";
import {
  ActionButton,
  BulletList,
  InfoCard,
  SectionTitle,
} from "@/components/site/public-primitives";

function isAvailableNow(slug: string) {
  return slug === "pierre";
}

function findAgent(slug: string): AgentSpec | null {
  return AGENTS.find((agent) => agent.slug === slug) ?? null;
}

export function generateStaticParams() {
  return AGENTS.map((agent) => ({
    slug: agent.slug,
  }));
}

function AgentStatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="cs-card">
      <div className="relative space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">
          {label}
        </p>
        <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
          {value}
        </p>
        <p className="text-xs text-[var(--cs-ink-4)]">{helper}</p>
      </div>
    </div>
  );
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = findAgent(slug);

  if (!agent) {
    notFound();
  }

  const available = isAvailableNow(agent.slug);

  return (
    <div className="cs-page-shell py-10 md:py-14">
      <div className="space-y-6">
        <section className="cs-command-surface overflow-hidden">
          <div className="cs-system-halo" />

          <div className="relative grid gap-6 xl:grid-cols-[1.06fr_0.94fr] xl:items-start">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="cs-pill">
                  <BriefcaseBusiness className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                  <span>{agent.name}</span>
                </span>
                <span className={available ? "cs-status cs-status--success" : "cs-status"}>
                  {available ? "Disponible maintenant" : "En construction"}
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="cs-heading text-3xl md:text-5xl">
                  {agent.name}
                  <br />
                  <span className="cs-gradient-text">{agent.role}</span>
                </h1>

                <p className="max-w-3xl text-sm leading-8 text-[var(--cs-ink-4)] md:text-base">
                  {available
                    ? `${agent.name} est aujourdâ€™hui lâ€™employÃ© CloneStore le plus concret pour un usage rÃ©el immÃ©diat. La page doit inspirer confiance, clarifier le pÃ©rimÃ¨tre mÃ©tier, montrer la valeur, poser les limites, puis emmener proprement vers le checkout et lâ€™activation.`
                    : `${agent.name} existe dÃ©jÃ  dans la vision CloneStore et dans lâ€™architecture produit. En revanche, cette fiche doit rester honnÃªte : lâ€™employÃ© peut Ãªtre visible, comprÃ©hensible et dÃ©sirable, sans Ãªtre survendu comme totalement prÃªt si ce nâ€™est pas encore le cas.`}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {available ? (
                  <>
                    <ActionButton
                      href="/checkout?agent=pierre"
                      label={`Activer ${agent.name}`}
                      primary
                      icon={<ArrowRight className="h-4 w-4" />}
                    />
                    <ActionButton
                      href="/paiement"
                      label="Voir le parcours de paiement"
                      icon={<Sparkles className="h-4 w-4" />}
                    />
                  </>
                ) : (
                  <>
                    <ActionButton
                      href="/questions"
                      label="Poser une question"
                      primary
                      icon={<Bot className="h-4 w-4" />}
                    />
                    <ActionButton
                      href="/agents"
                      label="Retour boutique"
                      icon={<Waypoints className="h-4 w-4" />}
                    />
                  </>
                )}

                <ActionButton
                  href="/profile"
                  label="Voir Mon espace"
                  icon={<ShieldCheck className="h-4 w-4" />}
                />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="cs-card">
                <div className="relative space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                        Lecture rapide
                      </p>
                      <p className="mt-1 text-sm text-[var(--cs-ink-4)]">
                        Ce quâ€™il faut comprendre immÃ©diatement.
                      </p>
                    </div>
                    <span className={available ? "cs-status cs-status--success" : "cs-status"}>
                      {available ? "Ouvert" : "PrÃ©paration"}
                    </span>
                  </div>

                  <BulletList
                    items={[
                      agent.does[0] ?? "PÃ©rimÃ¨tre mÃ©tier en cours de finalisation.",
                      agent.does[1] ?? "EmployÃ© visible dans lâ€™Ã©cosystÃ¨me CloneStore.",
                      available
                        ? "Parcours commercial et usage dÃ©jÃ  cohÃ©rents."
                        : "VisibilitÃ© produit assumÃ©e, maturitÃ© encore en construction.",
                      available
                        ? "EntrÃ©e recommandÃ©e aujourdâ€™hui."
                        : "Ã€ suivre au fur et Ã  mesure de lâ€™avancement produit.",
                    ]}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <AgentStatCard
                  label="PÃ©rimÃ¨tre"
                  value={available ? "Concret" : "Ã‰volutif"}
                  helper={available ? "Usage rÃ©el maintenant" : "MaturitÃ© encore en progression"}
                />
                <AgentStatCard
                  label="Tarif"
                  value={agent.pricingNote?.replace("Tarif dÃ©fini sur la page de paiement CloneStore.", "Voir paiement") ?? "BientÃ´t"}
                  helper="RÃ©fÃ©rence affichÃ©e cÃ´tÃ© parcours"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="cs-panel">
            <SectionTitle
              kicker="Pour qui"
              title="Qui doit regarder cette fiche ?"
              text="La lecture doit tout de suite faire comprendre Ã  quel type dâ€™entreprise ou de rÃ´le cet employÃ© peut apporter de la valeur."
            />

            <div className="mt-6">
              <BulletList items={agent.forWho} />
            </div>
          </div>

          <div className="cs-panel">
            <SectionTitle
              kicker="Ce quâ€™il fait"
              title="CapacitÃ©s principales"
              text="On montre ici le vrai bloc de travail que lâ€™employÃ© est censÃ© absorber."
            />

            <div className="mt-6">
              <BulletList items={agent.does} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="cs-panel">
            <SectionTitle
              kicker="Ce quâ€™il ne fait pas"
              title="Limites et honnÃªtetÃ© produit"
              text="Cette partie est essentielle pour la crÃ©dibilitÃ© CloneStore. Un pÃ©rimÃ¨tre clair vaut mieux quâ€™une promesse floue."
            />

            <div className="mt-6">
              <BulletList items={agent.doesNot} />
            </div>
          </div>

          <div className="cs-panel">
            <SectionTitle
              kicker="Exemples"
              title="Ce que lâ€™utilisateur peut lui demander"
              text="Les exemples doivent aider Ã  se projeter vite dans un usage rÃ©el."
            />

            <div className="mt-6">
              <BulletList items={agent.examples} />
            </div>
          </div>
        </section>

        <section className="cs-panel">
          <SectionTitle
            kicker="Ce que cette fiche doit transmettre"
            title="CloneStore vend de la capacitÃ© opÃ©rationnelle, pas un effet waouh vide."
            text="La fiche doit aider le client Ã  comprendre trois choses : le pÃ©rimÃ¨tre mÃ©tier, la valeur concrÃ¨te et le niveau de maturitÃ© rÃ©el de lâ€™employÃ©."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard
              title="LisibilitÃ©"
              text="Un rÃ´le clair, comprÃ©hensible en quelques secondes."
              icon={<Waypoints className="h-4 w-4" />}
              tone="violet"
            />
            <InfoCard
              title="CrÃ©dibilitÃ©"
              text="Une promesse alignÃ©e avec la rÃ©alitÃ© produit."
              icon={<ShieldCheck className="h-4 w-4" />}
              tone="green"
            />
            <InfoCard
              title="Projection"
              text="Des exemples concrets pour sentir lâ€™usage rÃ©el."
              icon={<Sparkles className="h-4 w-4" />}
              tone="blue"
            />
            <InfoCard
              title="DÃ©cision"
              text="Un chemin Ã©vident vers la question, la dÃ©couverte ou lâ€™activation."
              icon={<ArrowRight className="h-4 w-4" />}
              tone="rose"
            />
          </div>
        </section>

        <section className="cs-panel overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--cs-violet)_12%,transparent),transparent_72%)]" />

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mx-auto w-fit">
              <span className="cs-pill">
                <Sparkles className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                <span>{available ? "PrÃªt Ã  entrer ?" : "Besoin de clarifier ?"}</span>
              </span>
            </div>

            <h2 className="cs-heading mt-6 text-3xl md:text-5xl">
              {available
                ? `Active ${agent.name}, puis entre dans CloneStore.`
                : `Comprends ${agent.name}, puis reviens au bon moment.`}
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--cs-ink-4)] md:text-base">
              {available
                ? "Le bon parcours est simple : comprendre, activer, configurer, utiliser."
                : "Cette fiche doit nourrir la vision produit sans mentir sur lâ€™Ã©tat rÃ©el dâ€™ouverture publique."}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {available ? (
                <>
                  <ActionButton
                    href="/checkout?agent=pierre"
                    label={`Activer ${agent.name}`}
                    primary
                    icon={<ArrowRight className="h-4 w-4" />}
                  />
                  <ActionButton
                    href="/questions"
                    label="Parler Ã  CloneChat"
                    icon={<Bot className="h-4 w-4" />}
                  />
                </>
              ) : (
                <>
                  <ActionButton
                    href="/questions"
                    label="Poser une question"
                    primary
                    icon={<Bot className="h-4 w-4" />}
                  />
                  <ActionButton
                    href="/agents"
                    label="Retour boutique"
                    icon={<Waypoints className="h-4 w-4" />}
                  />
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}