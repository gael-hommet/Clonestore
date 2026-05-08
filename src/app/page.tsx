"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  Mic2,
  Orbit,
  ShieldCheck,
  Sparkles,
  Timer,
  Users2,
  Waypoints,
  Workflow,
  Zap,
} from "lucide-react";

import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { cn } from "@/lib/utils";

type SectionKey = "overview" | "employees" | "technologies" | "cockpit" | "trust";

type HomeSection = {
  key: SectionKey;
  label: string;
  eyebrow: string;
  icon: React.ComponentType<{ className?: string }>;
};

const sections: HomeSection[] = [
  { key: "overview", label: "Accueil", eyebrow: "Système", icon: Sparkles },
  { key: "employees", label: "Employés IA", eyebrow: "Postes", icon: Users2 },
  { key: "technologies", label: "Technologies", eyebrow: "Moteur", icon: BrainCircuit },
  { key: "cockpit", label: "Cockpit", eyebrow: "Pilotage", icon: Waypoints },
  { key: "trust", label: "Confiance", eyebrow: "Contrôle", icon: ShieldCheck },
];

const employees = [
  {
    name: "Pierre",
    role: "Poste RH opérationnel automatisé",
    status: "En construction",
    tone: "active",
    text: "Documents RH, emails, relances, suivi, validations et continuité des missions RH.",
    href: "/agents/pierre",
  },
  {
    name: "Clara",
    role: "Recrutement & coordination",
    status: "Bientôt disponible",
    tone: "soon",
    text: "Analyse de candidatures, pipeline recrutement, coordination et synthèses de shortlists.",
    href: "/agents/clara",
  },
  {
    name: "Emma",
    role: "Support & relation client",
    status: "Bientôt disponible",
    tone: "soon",
    text: "Réponses support, suivi client, catégorisation, escalades et qualité de communication.",
    href: "/agents/emma",
  },
  {
    name: "Noah",
    role: "Assistant direction",
    status: "Bientôt disponible",
    tone: "soon",
    text: "Synthèses, décisions, priorités, comptes rendus et pilotage quotidien.",
    href: "/agents/noah",
  },
];

const technologies = [
  {
    name: "CloneOS",
    category: "Orchestration",
    text: "Transforme une demande naturelle en missions, tâches, dépendances, exécution et résultat coordonné.",
    icon: BrainCircuit,
    core: true,
    colorClass: "clone-tech-legend-dot--blue",
  },
  {
    name: "CloneADN",
    category: "Mémoire entreprise",
    text: "Encode le ton, les habitudes, les circuits humains, les styles et les préférences opérationnelles.",
    icon: Fingerprint,
    core: true,
    colorClass: "clone-tech-legend-dot--orange",
  },
  {
    name: "CloneGuard",
    category: "Gouvernance",
    text: "Cadre les risques, validations, refus intelligents, permissions et actions sensibles.",
    icon: LockKeyhole,
    core: true,
    colorClass: "clone-tech-legend-dot--green",
  },
  {
    name: "CloneTrace",
    category: "Traçabilité",
    text: "Rend les actions visibles : historique, statuts, logs, décisions, versions et continuité.",
    icon: Workflow,
    core: true,
    colorClass: "clone-tech-legend-dot--violet",
  },
  {
    name: "CloneChat",
    category: "Interface système",
    text: "Oriente, explique, guide, diagnostique et sert de point d’entrée naturel au système CloneStore.",
    icon: Bot,
    core: true,
    colorClass: "clone-tech-legend-dot--sky",
  },
  {
    name: "CloneVoice",
    category: "Voix native",
    text: "Permet de parler naturellement à CloneStore et prépare le futur mode copilote vocal.",
    icon: Mic2,
    core: true,
    colorClass: "clone-tech-legend-dot--gold",
  },
  {
    name: "ClonePolicy",
    category: "Règles",
    text: "Transforme les règles d’entreprise en comportement machine réellement exécutable.",
    icon: ShieldCheck,
    core: false,
    colorClass: "clone-tech-legend-dot--blue",
  },
  {
    name: "CloneContinuum",
    category: "Continuité",
    text: "Maintient les missions dans le temps : attentes, reprises, relances et réveils.",
    icon: Timer,
    core: false,
    colorClass: "clone-tech-legend-dot--violet",
  },
  {
    name: "CloneTrust",
    category: "Autonomie",
    text: "Détermine jusqu’où un employé IA peut agir seul selon le contexte, le risque et les règles.",
    icon: BadgeCheck,
    core: false,
    colorClass: "clone-tech-legend-dot--green",
  },
  {
    name: "CloneReview",
    category: "Qualité",
    text: "Relit, critique et contrôle les livrables avant sortie ou action sensible.",
    icon: FileCheck2,
    core: false,
    colorClass: "clone-tech-legend-dot--sky",
  },
  {
    name: "CloneSignals",
    category: "Déclencheurs",
    text: "Réagit aux délais, validations en attente, documents manquants et événements métier.",
    icon: Zap,
    core: false,
    colorClass: "clone-tech-legend-dot--gold",
  },
  {
    name: "CloneLearn",
    category: "Apprentissage",
    text: "Améliore progressivement CloneADN à partir des corrections, validations et usages récurrents.",
    icon: Sparkles,
    core: false,
    colorClass: "clone-tech-legend-dot--orange",
  },
];

const coreLegend = technologies.filter((tech) => tech.core);

const cockpitItems = [
  "Vue claire des employés actifs et de leur périmètre.",
  "Missions en cours, bloquées, planifiées ou terminées.",
  "Décisions à valider sans fouiller dans le système.",
  "Historique exploitable pour reprendre rapidement le fil.",
];

const trustItems = [
  {
    title: "Gouvernance",
    text: "Les employés IA travaillent dans un périmètre défini avec règles, permissions et refus.",
    icon: ShieldCheck,
  },
  {
    title: "Traçabilité",
    text: "Les missions, décisions, statuts et livrables restent visibles dans le temps.",
    icon: Workflow,
  },
  {
    title: "Contrôle humain",
    text: "Les sujets sensibles remontent à l’humain au lieu d’être exécutés aveuglément.",
    icon: Users2,
  },
  {
    title: "Rentabilité",
    text: "La promesse reste simple : réduire le temps perdu, la charge mentale et les coûts opérationnels.",
    icon: BriefcaseBusiness,
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
      className={cn("clone-liquid-button", primary && "clone-liquid-button--dark")}
    >
      <span>{label}</span>
      {icon}
    </Link>
  );
}

function SectionTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="cs-eyebrow">{eyebrow}</p>
      <h2 className="cs-heading mt-3 text-[clamp(2rem,3.6vw,4.15rem)] leading-[0.98]">
        {title}
      </h2>
      <p className="mt-5 max-w-2xl text-[0.98rem] leading-8 text-[var(--cs-ink-3)]">
        {text}
      </p>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <LiquidGlass variant="clear" intensity="soft" className="clone-metric-card">
      <p className="text-[1.25rem] font-semibold tracking-[-0.05em] text-[var(--cs-ink-1)]">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--cs-ink-4)]">{label}</p>
    </LiquidGlass>
  );
}

function StatusChip({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={cn("clone-status-chip", tone === "active" && "clone-status-chip--active")}>
      {label}
    </span>
  );
}

function EmployeeCard({ employee }: { employee: (typeof employees)[number] }) {
  return (
    <LiquidGlass
      variant="clear"
      intensity="soft"
      interactive
      className="clone-employee-card"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[1.05rem] font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
            {employee.name}
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-[var(--cs-ink-2)]">
            {employee.role}
          </p>
        </div>

        <StatusChip label={employee.status} tone={employee.tone} />
      </div>

      <p className="mt-5 text-sm leading-7 text-[var(--cs-ink-3)]">{employee.text}</p>

      <Link
        href={employee.href}
        className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--cs-ink-1)]"
      >
        Voir la fiche
        <ArrowRight className="h-4 w-4" />
      </Link>
    </LiquidGlass>
  );
}

function TechnologyCard({ tech }: { tech: (typeof technologies)[number] }) {
  const Icon = tech.icon;

  return (
    <LiquidGlass
      variant="clear"
      intensity="soft"
      interactive
      className={cn("clone-tech-card", tech.core && "clone-tech-card--core")}
    >
      <div className="flex items-start gap-4">
        <div className="clone-tech-icon">
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{tech.name}</p>
            {tech.core ? <span className="clone-mini-chip">mère</span> : null}
          </div>

          <p className="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">
            {tech.category}
          </p>

          <p className="mt-3 text-sm leading-6 text-[var(--cs-ink-3)]">{tech.text}</p>
        </div>
      </div>
    </LiquidGlass>
  );
}

function CloneCoreOrbit() {
  const coreDots = [
    "clone-orbit-point--blue",
    "clone-orbit-point--orange",
    "clone-orbit-point--green",
    "clone-orbit-point--violet",
    "clone-orbit-point--sky",
    "clone-orbit-point--gold",
  ];

  return (
    <div className="clone-core-visual" aria-hidden="true">
      <div className="clone-core-aura" />
      <div className="clone-core-grid" />

      <div className="clone-core-orbit clone-core-orbit--one" />
      <div className="clone-core-orbit clone-core-orbit--two" />
      <div className="clone-core-orbit clone-core-orbit--three" />

      <div className="clone-core-sun">
        <div className="clone-core-sun-inner">
          <Sparkles className="h-7 w-7" />
        </div>
      </div>

      <div className="clone-orbit-ring clone-orbit-ring--slow">
        {coreDots.slice(0, 3).map((className, index) => (
          <span
            key={className}
            className={cn("clone-orbit-point", className)}
            style={{ "--dot-index": index } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="clone-orbit-ring clone-orbit-ring--reverse">
        {coreDots.slice(3).map((className, index) => (
          <span
            key={className}
            className={cn("clone-orbit-point clone-orbit-point--small", className)}
            style={{ "--dot-index": index } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="clone-core-caption clone-core-caption--left">
        <span>Mission</span>
        <strong>Demandes → tâches</strong>
      </div>

      <div className="clone-core-caption clone-core-caption--right">
        <span>Contrôle</span>
        <strong>Règles → trace</strong>
      </div>
    </div>
  );
}

function CloneCoreLegend() {
  return (
    <div className="clone-tech-legend">
      {coreLegend.map((tech) => (
        <div key={tech.name} className="clone-tech-legend-item">
          <span className={cn("clone-tech-legend-dot", tech.colorClass)} />
          <span>{tech.name}</span>
        </div>
      ))}
    </div>
  );
}

function CloneTechnologyConstellation() {
  return (
    <div className="clone-constellation" aria-hidden="true">
      <div className="clone-constellation-core">
        <Orbit className="h-7 w-7" />
      </div>

      {["OS", "ADN", "Guard", "Trace", "Chat", "Voice"].map((label, index) => (
        <div
          key={label}
          className={cn("clone-constellation-node", `clone-constellation-node--${index + 1}`)}
        >
          <CircleDot className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
      ))}

      <span className="clone-constellation-line clone-constellation-line--a" />
      <span className="clone-constellation-line clone-constellation-line--b" />
      <span className="clone-constellation-line clone-constellation-line--c" />
      <span className="clone-constellation-line clone-constellation-line--d" />
    </div>
  );
}

function CloneCockpitFlow() {
  return (
    <LiquidGlass variant="panel" intensity="medium" className="clone-cockpit-visual">
      <div className="clone-cockpit-flow">
        <div className="clone-flow-card clone-flow-card--active">
          <span>01</span>
          <strong>Mission reçue</strong>
          <p>Demande naturelle structurée par CloneOS.</p>
        </div>

        <div className="clone-flow-connector" />

        <div className="clone-flow-card">
          <span>02</span>
          <strong>Règles appliquées</strong>
          <p>Validation, autonomie et contexte entreprise.</p>
        </div>

        <div className="clone-flow-connector" />

        <div className="clone-flow-card">
          <span>03</span>
          <strong>Exécution suivie</strong>
          <p>Tâches, livrables, statuts et historique.</p>
        </div>
      </div>
    </LiquidGlass>
  );
}

export default function HomePage() {
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [railOpen, setRailOpen] = useState(false);

  const activeIndex = useMemo(
    () => sections.findIndex((section) => section.key === activeSection),
    [activeSection]
  );

  return (
    <main className="cs-page clone-home-page">
      <div className="cs-page-shell clone-home-shell">
        <div className="clone-home-layout">
          <aside className={cn("clone-home-rail-wrap", railOpen && "clone-home-rail-wrap--open")}>
            <LiquidGlass
              variant="panel"
              intensity="strong"
              refractive
              className={cn("clone-home-rail", railOpen && "clone-home-rail--open")}
            >
              <button
                type="button"
                onClick={() => setRailOpen((value) => !value)}
                className="clone-rail-toggle"
                aria-label={railOpen ? "Réduire le rail" : "Ouvrir le rail"}
              >
                {railOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              <div className="clone-rail-items">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const active = section.key === activeSection;

                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => {
                        setActiveSection(section.key);
                        document
                          .getElementById(section.key)
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className={cn("clone-rail-item", active && "clone-rail-item--active")}
                    >
                      <span className="clone-rail-icon">
                        <Icon className="h-4 w-4" />
                      </span>

                      {railOpen ? (
                        <span className="clone-rail-copy">
                          <span>{section.eyebrow}</span>
                          <strong>{section.label}</strong>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {railOpen ? (
                <LiquidGlass variant="clear" intensity="soft" className="clone-rail-note">
                  <p>Section active</p>
                  <strong>
                    {activeIndex + 1} / {sections.length}
                  </strong>
                </LiquidGlass>
              ) : null}
            </LiquidGlass>
          </aside>

          <div className="clone-home-content">
            <section id="overview" className="scroll-mt-32 clone-home-screen">
              <LiquidGlass
                variant="panel"
                intensity="strong"
                refractive
                className="clone-hero-shell"
              >
                <div className="clone-hero-grid">
                  <div className="clone-hero-copy">
                    <div className="flex flex-wrap gap-2">
                      <span className="cs-pill">
                        <Sparkles className="h-3.5 w-3.5 text-[#6f83ff]" />
                        OS premium d’employés IA
                      </span>
                      <span className="cs-pill">
                        <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                        Gouverné, traçable, pilotable
                      </span>
                    </div>

                    <div>
                      <h1
                        style={{
                          margin: 0,
                          marginLeft: "-0.18em",
                          paddingLeft: "0.24em",
                          paddingBottom: "0.1em",
                          maxWidth: "900px",
                          overflow: "visible",
                          fontFamily:
                            '"SF Pro Display", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                          fontSize: "clamp(3.8rem, 5.55vw, 5.95rem)",
                          fontWeight: 560,
                          lineHeight: 0.92,
                          letterSpacing: "-0.074em",
                          color: "#151922",
                          textRendering: "geometricPrecision",
                        }}
                      >
                        <span style={{ display: "block", whiteSpace: "nowrap", overflow: "visible" }}>
                          Gagnez du temps
                        </span>
                        <span style={{ display: "block", whiteSpace: "nowrap", overflow: "visible" }}>
                          et de{" "}
                          <span
                            style={{
                              background:
                                "linear-gradient(90deg, #151922 0%, #2f3a5f 42%, #5f74ff 76%, #8b7cff 100%)",
                              WebkitBackgroundClip: "text",
                              backgroundClip: "text",
                              color: "transparent",
                            }}
                          >
                            l’argent.
                          </span>
                        </span>
                      </h1>

                      <p className="clone-hero-text">
                        CloneStore installe des employés IA spécialisés dans votre entreprise.
                        Ils comprennent les demandes, structurent le travail, exécutent sous règles,
                        gardent l’historique et rendent le pilotage plus clair.
                      </p>
                    </div>

                    <div className="clone-actions-row">
                      <ActionButton
                        href="/agents"
                        label="Découvrir les employés"
                        primary
                        icon={<ArrowRight className="h-4 w-4" />}
                      />
                      <ActionButton
                        href="/assistant"
                        label="Parler à CloneChat"
                        icon={<Bot className="h-4 w-4" />}
                      />
                      <ActionButton
                        href="/profile"
                        label="Voir le cockpit"
                        icon={<Waypoints className="h-4 w-4" />}
                      />
                    </div>

                    <div className="clone-metrics-grid">
                      <Metric value="24/7" label="Disponibilité opérationnelle" />
                      <Metric value="Traçable" label="Missions, statuts et historique" />
                      <Metric value="Contrôlé" label="Validation humaine sur le sensible" />
                    </div>
                  </div>

                  <div className="clone-hero-visual">
                    <CloneCoreOrbit />
                    <CloneCoreLegend />
                  </div>
                </div>
              </LiquidGlass>
            </section>

            <section id="employees" className="scroll-mt-32 clone-home-screen">
              <LiquidGlass variant="panel" intensity="medium" className="clone-section-panel">
                <div className="clone-section-head">
                  <SectionTitle
                    eyebrow="Employés IA"
                    title="CloneStore ne tourne pas autour d’un seul employé."
                    text="Chaque employé IA est pensé comme un poste automatisé spécialisé, avec son périmètre, ses limites, ses règles et son cockpit."
                  />

                  <ActionButton
                    href="/agents"
                    label="Voir la boutique"
                    icon={<ArrowRight className="h-4 w-4" />}
                  />
                </div>

                <div className="clone-employees-grid">
                  {employees.map((employee) => (
                    <EmployeeCard key={employee.name} employee={employee} />
                  ))}
                </div>
              </LiquidGlass>
            </section>

            <section id="technologies" className="scroll-mt-32 clone-home-screen">
              <LiquidGlass variant="panel" intensity="medium" className="clone-section-panel">
                <div className="clone-tech-hero">
                  <SectionTitle
                    eyebrow="Technologies CloneStore"
                    title="Un système complet, pas une collection de gadgets."
                    text="Les briques CloneStore organisent la compréhension, la mémoire, les validations, la traçabilité, la continuité, la voix et l’orchestration entre employés IA."
                  />

                  <CloneTechnologyConstellation />
                </div>

                <div className="clone-tech-grid">
                  {technologies.map((tech) => (
                    <TechnologyCard key={tech.name} tech={tech} />
                  ))}
                </div>
              </LiquidGlass>
            </section>

            <section id="cockpit" className="scroll-mt-32 clone-home-screen">
              <div className="clone-cockpit-grid">
                <LiquidGlass variant="panel" intensity="medium" className="clone-section-panel">
                  <SectionTitle
                    eyebrow="Cockpit"
                    title="Piloter l’entreprise depuis une interface calme."
                    text="Le dirigeant doit pouvoir ouvrir CloneStore sur ordinateur, tablette ou téléphone, voir les missions, les employés, les statuts et les prochaines décisions sans perdre de temps."
                  />

                  <div className="clone-cockpit-list">
                    {cockpitItems.map((item) => (
                      <LiquidGlass key={item} variant="clear" intensity="soft" className="clone-cockpit-item">
                        <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-[#6f83ff]" />
                        <p>{item}</p>
                      </LiquidGlass>
                    ))}
                  </div>
                </LiquidGlass>

                <CloneCockpitFlow />
              </div>
            </section>

            <section id="trust" className="scroll-mt-32 clone-home-screen">
              <LiquidGlass variant="panel" intensity="medium" className="clone-section-panel">
                <div className="clone-trust-grid">
                  <SectionTitle
                    eyebrow="Confiance entreprise"
                    title="Puissant, mais jamais incontrôlé."
                    text="CloneStore doit inspirer la maîtrise : actions encadrées, limites explicites, validation humaine sur le sensible, historique exploitable et lecture claire des responsabilités."
                  />

                  <div className="clone-trust-cards">
                    {trustItems.map((item) => {
                      const Icon = item.icon;

                      return (
                        <LiquidGlass
                          key={item.title}
                          variant="clear"
                          intensity="soft"
                          interactive
                          className="clone-trust-card"
                        >
                          <Icon className="h-5 w-5 text-[#6f83ff]" />
                          <p>{item.title}</p>
                          <span>{item.text}</span>
                        </LiquidGlass>
                      );
                    })}
                  </div>
                </div>
              </LiquidGlass>
            </section>

            <section className="clone-home-screen">
              <LiquidGlass
                variant="panel"
                intensity="strong"
                refractive
                className="clone-final-cta"
              >
                <div className="clone-final-ambient" aria-hidden="true" />

                <div className="relative mx-auto max-w-4xl text-center">
                  <p className="cs-eyebrow">Prochaine étape</p>
                  <h2 className="cs-heading mt-4 text-[clamp(2.15rem,4vw,4.7rem)] leading-[0.98]">
                    Découvrez les employés IA disponibles et en construction.
                  </h2>
                  <p className="mx-auto mt-5 max-w-2xl text-[0.98rem] leading-8 text-[var(--cs-ink-3)]">
                    CloneStore avance vers un système complet de postes automatisés :
                    RH, support, recrutement, direction, opérations et fonctions spécialisées.
                  </p>

                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <ActionButton
                      href="/agents"
                      label="Découvrir les employés"
                      primary
                      icon={<ArrowRight className="h-4 w-4" />}
                    />
                    <ActionButton
                      href="/questions"
                      label="Poser une question"
                      icon={<Bot className="h-4 w-4" />}
                    />
                  </div>
                </div>
              </LiquidGlass>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}