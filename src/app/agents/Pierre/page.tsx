import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Mail,
  MessageSquareMore,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Waypoints,
} from "lucide-react";

type Capability = {
  title: string;
  text: string;
  icon: React.ReactNode;
  tone: "violet" | "blue" | "rose" | "green";
};

const keyCapabilities: Capability[] = [
  {
    title: "Mission libre RH",
    text: "Pierre comprend une demande naturelle, la transforme en mission, dÃ©tecte les informations manquantes et structure le travail.",
    icon: <Waypoints className="h-4 w-4" />,
    tone: "violet",
  },
  {
    title: "Documents RH premium",
    text: "Convocations, refus, relances, onboarding, notes internes, courriers RH simples, synthÃ¨ses et brouillons propres.",
    icon: <FileText className="h-4 w-4" />,
    tone: "blue",
  },
  {
    title: "Emails & relances",
    text: "PrÃ©pare, envoie si autorisÃ©, relance et suit les Ã©changes dans le temps avec historique clair.",
    icon: <Mail className="h-4 w-4" />,
    tone: "rose",
  },
  {
    title: "TraÃ§abilitÃ© & contrÃ´le",
    text: "Validations, blocages, livrables, Ã©tats et continuitÃ© remontent dans une logique CloneTrace exploitable.",
    icon: <FileCheck2 className="h-4 w-4" />,
    tone: "green",
  },
];

const useCases = [
  "PrÃ©parer une convocation pour demain Ã  14h.",
  "Relancer ce candidat demain matin si je nâ€™ai pas de rÃ©ponse ce soir.",
  "PrÃ©parer un mail dâ€™onboarding pour lâ€™arrivÃ©e de LÃ©a lundi.",
  "Refaire ce message en plus humain et plus professionnel.",
  "Demander les piÃ¨ces manquantes puis relancer dans 48h.",
  "PrÃ©parer le PDF et garder le document prÃªt Ã  validation.",
];

const workflow = [
  {
    step: "01",
    title: "Vous donnez une demande RH naturelle",
    text: "Pas besoin de parler en prompts. Vous exprimez une mission comme Ã  un collaborateur RH.",
  },
  {
    step: "02",
    title: "Pierre comprend, structure et classe",
    text: "Il dÃ©tecte le type de mission, le niveau de sensibilitÃ©, les infos manquantes et les validations nÃ©cessaires.",
  },
  {
    step: "03",
    title: "Il produit, suit et relance",
    text: "Documents, emails, PDF, relances, reprise de mission et continuitÃ© sous rÃ¨gles.",
  },
  {
    step: "04",
    title: "Vous gardez le contrÃ´le",
    text: "Les cas sensibles remontent, le reste avance, et tout reste visible dans le cockpit.",
  },
];

function ActionButton({
  href,
  label,
  primary = false,
  icon,
}: {
  href: string;
  label: string;
  primary?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-all duration-[var(--cs-speed-fast)] ease-[var(--cs-ease-premium)]",
        "border",
        primary
          ? [
              "border-[color:color-mix(in_srgb,var(--cs-account-accent)_18%,white)]",
              "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cs-account-accent)_92%,white),color-mix(in_srgb,var(--cs-accent-blue)_30%,var(--cs-account-accent)))]",
              "text-white",
              "shadow-[0_18px_40px_color-mix(in_srgb,var(--cs-account-accent)_18%,transparent)]",
              "hover:-translate-y-0.5 hover:shadow-[0_24px_52px_color-mix(in_srgb,var(--cs-account-accent)_24%,transparent)]",
            ].join(" ")
          : [
              "border-[color:color-mix(in_srgb,var(--cs-line-soft)_68%,white)]",
              "bg-[linear-gradient(to_bottom,rgba(255,255,255,0.82),rgba(255,250,244,0.56))]",
              "text-[var(--cs-ink-2)]",
              "hover:-translate-y-0.5 hover:bg-white/92",
            ].join(" "),
      ].join(" ")}
    >
      {label}
      {icon}
    </Link>
  );
}

function SectionTitle({
  kicker,
  title,
  text,
  right,
}: {
  kicker: string;
  title: string;
  text: string;
  right?: React.ReactNode;
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

function CapabilityCard({ item }: { item: Capability }) {
  const toneClass =
    item.tone === "violet"
      ? "text-[var(--cs-account-accent)]"
      : item.tone === "blue"
        ? "text-[var(--cs-info)]"
        : item.tone === "rose"
          ? "text-[var(--cs-danger)]"
          : "text-[var(--cs-success)]";

  return (
    <div className="cs-card h-full">
      <div className="relative flex h-full flex-col gap-4">
        <div className={`flex items-center gap-2 ${toneClass}`}>
          {item.icon}
          <span className="text-sm font-medium text-[var(--cs-ink-2)]">
            {item.title}
          </span>
        </div>
        <p className="text-sm text-[var(--cs-ink-4)]">{item.text}</p>
      </div>
    </div>
  );
}

function StatTile({
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
        <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
          {value}
        </p>
        <p className="text-xs text-[var(--cs-ink-4)]">{helper}</p>
      </div>
    </div>
  );
}

function WorkflowCard({
  step,
  title,
  text,
}: {
  step: string;
  title: string;
  text: string;
}) {
  return (
    <div className="cs-card h-full">
      <div className="relative space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="cs-pill">{step}</span>
          <span className="cs-status cs-status--info">Workflow</span>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
            {title}
          </h3>
          <p className="text-sm text-[var(--cs-ink-4)]">{text}</p>
        </div>
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-account-accent)]" />
          <span className="text-sm text-[var(--cs-ink-4)]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PierrePage() {
  return (
    <div className="cs-page-shell py-10 md:py-14">
      <div className="space-y-6">
        {/* HERO */}
        <section className="cs-command-surface overflow-hidden">
          <div className="cs-system-halo" />

          <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="cs-pill">
                  <BriefcaseBusiness className="h-3.5 w-3.5 text-[var(--cs-account-accent)]" />
                  <span>Pierre</span>
                </span>
                <span className="cs-pill">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                  <span>Poste RH opÃ©rationnel automatisÃ©</span>
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="cs-heading text-3xl md:text-5xl">
                  Pierre absorbe une part massive
                  <br />
                  <span className="cs-gradient-text">
                    du travail RH opÃ©rationnel.
                  </span>
                </h1>

                <p className="max-w-3xl text-sm text-[var(--cs-ink-4)] md:text-base">
                  Pierre nâ€™est pas un bot RH. Pierre est un poste RH
                  opÃ©rationnel automatisÃ© conÃ§u pour comprendre une demande RH
                  libre, la transformer en mission structurÃ©e, produire des
                  documents et communications propres, exÃ©cuter certaines
                  actions autorisÃ©es, relancer, suivre et garder une trace
                  claire dans le temps.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <ActionButton
                  href="/paiement"
                  label="Commencer avec Pierre"
                  primary
                  icon={<ArrowRight className="h-4 w-4" />}
                />
                <ActionButton
                  href="/questions"
                  label="Poser une question"
                  icon={<Bot className="h-4 w-4" />}
                />
                <ActionButton
                  href="/agents"
                  label="Retour Ã  la boutique"
                  icon={<Sparkles className="h-4 w-4" />}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatTile
                  label="Prix actuel"
                  value="449â‚¬/mois"
                  helper="Prix fondateur affichÃ© aujourdâ€™hui."
                />
                <StatTile
                  label="Positionnement"
                  value="Poste RH"
                  helper="Pas un simple assistant rÃ©dactionnel."
                />
                <StatTile
                  label="Promesse"
                  value="Travail absorbÃ©"
                  helper="Moins de charge mentale, plus de continuitÃ©."
                />
              </div>
            </div>

            {/* HERO RIGHT */}
            <div className="grid gap-4">
              <div className="cs-panel">
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--cs-ink-4)]">
                        Ce que Pierre fait ressentir
                      </p>
                      <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
                        â€œJâ€™ai un RH qui travaille.â€
                      </p>
                    </div>
                    <span className="cs-status cs-status--success">Disponible</span>
                  </div>

                  <div className="grid gap-3">
                    <div className="cs-card">
                      <div className="relative flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--cs-line-soft)_70%,white)] bg-white/58 text-[var(--cs-account-accent)] shadow-[var(--cs-shadow-soft)]">
                          <FileText className="h-4.5 w-4.5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                            Documents RH propres
                          </p>
                          <p className="text-sm text-[var(--cs-ink-4)]">
                            Convocations, refus, relances, onboarding, notes et
                            brouillons prÃªts Ã  valider ou Ã  envoyer.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="cs-card">
                      <div className="relative flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--cs-line-soft)_70%,white)] bg-white/58 text-[var(--cs-info)] shadow-[var(--cs-shadow-soft)]">
                          <MessageSquareMore className="h-4.5 w-4.5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                            ContinuitÃ© dans le temps
                          </p>
                          <p className="text-sm text-[var(--cs-ink-4)]">
                            Pierre ne rÃ©pond pas juste une fois. Il suit,
                            relance, reprend et garde le fil.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="cs-card">
                      <div className="relative flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--cs-line-soft)_70%,white)] bg-white/58 text-[var(--cs-danger)] shadow-[var(--cs-shadow-soft)]">
                          <ShieldCheck className="h-4.5 w-4.5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                            ContrÃ´le humain sur le sensible
                          </p>
                          <p className="text-sm text-[var(--cs-ink-4)]">
                            Les cas critiques, disciplinaires ou juridiques ne
                            partent pas en roue libre.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="cs-card">
                    <div className="relative space-y-2">
                      <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                        Prix fondateur
                      </p>
                      <p className="text-sm text-[var(--cs-ink-4)]">
                        Les premiers clients conservent leur prix fondateur tant
                        que le prix affichÃ© au moment de leur souscription ne
                        baisse pas ensuite.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CORE CAPABILITIES */}
        <section className="cs-panel">
          <SectionTitle
            kicker="Ce que Pierre fait vraiment"
            title="Un moteur de missions RH, pas un simple gÃ©nÃ©rateur."
            text="Pierre doit comprendre, produire, exÃ©cuter sous rÃ¨gles, relancer, suivre, mÃ©moriser et rendre un historique clair."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {keyCapabilities.map((item) => (
              <CapabilityCard key={item.title} item={item} />
            ))}
          </div>
        </section>

        {/* USE CASES */}
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="cs-panel">
            <SectionTitle
              kicker="Exemples de demandes"
              title="Pierre doit comprendre ce genre de formulations naturelles."
              text="Le client parle Ã  Pierre comme Ã  un collaborateur RH en tÃ©lÃ©travail, pas comme Ã  une IA fragile."
            />

            <div className="mt-6 grid gap-3">
              {useCases.map((item) => (
                <div key={item} className="cs-card">
                  <div className="relative flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--cs-line-soft)_70%,white)] bg-white/58 text-[var(--cs-account-accent)] shadow-[var(--cs-shadow-soft)]">
                      <Bot className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-[var(--cs-ink-3)]">â€œ{item}â€</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="cs-panel">
            <SectionTitle
              kicker="Ce que Pierre absorbe"
              title="Une masse rÃ©elle de travail RH opÃ©rationnel."
              text="La valeur nâ€™est pas seulement la qualitÃ© du texte. La valeur, câ€™est la charge retirÃ©e au client."
            />

            <div className="mt-6">
              <BulletList
                items={[
                  "PrÃ©parer et rÃ©Ã©crire des documents RH crÃ©dibles.",
                  "PrÃ©parer et envoyer des emails simples si autorisÃ©.",
                  "GÃ©nÃ©rer des PDF propres et exploitables.",
                  "Demander les informations manquantes intelligemment.",
                  "Planifier des actions et des relances.",
                  "Maintenir des missions sur plusieurs jours.",
                  "Historiser documents, tÃ¢ches, validations, blocages et sorties.",
                  "Sâ€™aligner progressivement sur le ton et les habitudes de lâ€™entreprise.",
                ]}
              />
            </div>
          </div>
        </section>

        {/* WORKFLOW */}
        <section className="cs-panel">
          <SectionTitle
            kicker="Comment Pierre travaille"
            title="Une logique de mission structurÃ©e, pas un simple Ã©change de messages."
            text="Le client donne une mission, Pierre interprÃ¨te, structure, produit, suit et remonte ce qui exige une dÃ©cision humaine."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflow.map((item) => (
              <WorkflowCard
                key={item.step}
                step={item.step}
                title={item.title}
                text={item.text}
              />
            ))}
          </div>
        </section>

        {/* SAFEGUARDS */}
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="cs-panel">
            <SectionTitle
              kicker="Garde-fous"
              title="Pierre est puissant, mais jamais incontrÃ´lÃ©."
              text="Le produit doit rester crÃ©dible. Il refuse ou escalade ce qui sort du cadre RH opÃ©rationnel autorisÃ©."
            />

            <div className="mt-6">
              <BulletList
                items={[
                  "Ne pas inventer les informations manquantes.",
                  "Ne pas prendre seul une dÃ©cision disciplinaire.",
                  "Ne pas prendre seul une dÃ©cision juridique sensible.",
                  "Bloquer ou soumettre les cas critiques.",
                  "Expliquer pourquoi une action est validÃ©e, bloquÃ©e ou refusÃ©e.",
                  "Laisser une trace claire des actions et des statuts.",
                ]}
              />
            </div>
          </div>

          <div className="cs-panel">
            <SectionTitle
              kicker="Pourquoi Pierre est rentable"
              title="Le client doit sentir du temps rendu dÃ¨s la premiÃ¨re semaine."
              text="Pierre vaut le prix lorsquâ€™il retire immÃ©diatement de la charge mentale, des oublis, des relances et de lâ€™administratif RH rÃ©pÃ©titif."
            />

            <div className="mt-6 grid gap-3">
              <div className="cs-card">
                <div className="relative flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-account-accent)]" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                      Moins de temps perdu
                    </p>
                    <p className="text-sm text-[var(--cs-ink-4)]">
                      Les tÃ¢ches RH rÃ©pÃ©titives cessent de reposer entiÃ¨rement
                      sur lâ€™humain.
                    </p>
                  </div>
                </div>
              </div>

              <div className="cs-card">
                <div className="relative flex items-start gap-3">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-info)]" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                      Moins de charge mentale
                    </p>
                    <p className="text-sm text-[var(--cs-ink-4)]">
                      Pierre garde la continuitÃ©, les rappels, les tÃ¢ches et les
                      sorties organisÃ©es.
                    </p>
                  </div>
                </div>
              </div>

              <div className="cs-card">
                <div className="relative flex items-start gap-3">
                  <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-success)]" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                      Meilleur contrÃ´le
                    </p>
                    <p className="text-sm text-[var(--cs-ink-4)]">
                      Le client rÃ©cupÃ¨re la main sur les bons cas, pas sur toute
                      la mÃ©canique.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="cs-panel overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--cs-account-accent)_12%,transparent),transparent_72%)]" />

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mx-auto w-fit">
              <span className="cs-pill">
                <Sparkles className="h-3.5 w-3.5 text-[var(--cs-account-accent)]" />
                <span>Pierre est la meilleure porte dâ€™entrÃ©e dans CloneStore</span>
              </span>
            </div>

            <h2 className="cs-heading mt-6 text-3xl md:text-5xl">
              Commencez par le poste RH.
              <br />
              Entrez ensuite dans le cockpit complet.
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--cs-ink-4)] md:text-base">
              Pierre est pensÃ© pour Ãªtre une preuve forte : mission libre,
              documents, emails, relances, continuitÃ©, contrÃ´le et traÃ§abilitÃ©,
              le tout dans un produit sÃ©rieux et premium.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ActionButton
                href="/paiement"
                label="Commencer avec Pierre"
                primary
                icon={<ArrowRight className="h-4 w-4" />}
              />
              <ActionButton
                href="/questions"
                label="Parler Ã  CloneStore"
                icon={<Bot className="h-4 w-4" />}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}