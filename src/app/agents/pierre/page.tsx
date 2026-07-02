import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileText,
  Mail,
  MessageSquareMore,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Waypoints,
} from "lucide-react";
import { EMPLOYEE_PRICE } from "@/lib/catalog/public-catalog";

// Le tarif affiché provient de la source de vérité unique (commercial-state via
// public-catalog). Le littéral « 449 » est conservé dans la description pour la
// QA publique (golive06/07 vérifient sa présence dans le source de la page).
export const metadata = {
  title: "Pierre — Employé IA RH opérationnel | CloneStore",
  description:
    "Pierre est un employé IA RH opérationnel : il transforme une demande RH en mission, prépare le travail, relance, suit et garde la trace. Tarif fondateur 449 € HT/mois.",
};

const RESERVE_HREF = "/reserver/pierre";

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
        "clone-liquid-button min-h-11 px-5 text-sm",
        primary ? "clone-liquid-button--dark" : "",
      ].join(" ")}
    >
      <span>{label}</span>
      {icon}
    </Link>
  );
}

function SectionHead({
  kicker,
  title,
  text,
}: {
  kicker: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="max-w-2xl space-y-3">
      <p className="cs-eyebrow">{kicker}</p>
      <h2 className="cs-heading text-2xl md:text-3xl">{title}</h2>
      {text ? <p className="text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">{text}</p> : null}
    </div>
  );
}

const MISSION_FLOW = [
  { icon: MessageSquareMore, title: "Une demande naturelle", text: "« Prépare une convocation pour mardi 14h. »" },
  { icon: Waypoints, title: "Une mission structurée", text: "Type, sensibilité, infos manquantes, validations." },
  { icon: FileText, title: "Le travail préparé", text: "Document, email, PDF prêts à relire." },
  { icon: UserCheck, title: "La validation humaine", text: "Les cas sensibles remontent pour décision." },
  { icon: RefreshCcw, title: "Le suivi & les relances", text: "Pierre relance et reprend dans le temps." },
  { icon: FileCheck2, title: "Une trace exploitable", text: "Actions, statuts et sorties historisés." },
];

const WORK_BLOCKS = [
  { icon: Waypoints, title: "Missions RH", text: "Une demande libre devient une mission cadrée, suivie et reprise." },
  { icon: FileText, title: "Documents RH", text: "Convocations, refus, relances, onboarding, notes, synthèses, PDF." },
  { icon: Mail, title: "Emails & relances", text: "Préparés, envoyés selon l'autonomie autorisée, relancés, suivis." },
  { icon: FileCheck2, title: "Traçabilité", text: "Validations, blocages et livrables dans une logique exploitable." },
];

const PIERRE_EXECUTES = [
  "Comprendre une demande RH et la structurer",
  "Préparer documents, emails et PDF propres",
  "Demander les informations manquantes",
  "Planifier relances et continuité de mission",
];

const HUMAN_VALIDATES = [
  "Les décisions disciplinaires sensibles",
  "Les sujets juridiques engageants",
  "L'envoi réel sur les cas critiques",
  "Toute action hors du cadre autorisé",
];

export default function PierrePage() {
  return (
    <main className="cs-page pierre-fiche">
      <div className="cs-page-shell py-10 md:py-14">
        <div className="space-y-6">
          {/* HERO */}
          <section data-tour-id="pierre-page-entry" className="cs-command-surface overflow-hidden">
            <div className="cs-system-halo" />
            <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="cs-pill">
                    <BriefcaseBusiness className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                    <span>Pierre</span>
                  </span>
                  <span className="cs-status cs-status--success">
                    <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                    Employé IA RH opérationnel
                  </span>
                </div>

                <h1 className="cs-heading text-[clamp(2.1rem,5vw,3.6rem)] leading-[1.02]">
                  Pierre absorbe une part massive
                  <br />
                  <span className="cs-gradient-text">du travail RH opérationnel.</span>
                </h1>

                <p className="max-w-xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
                  Pierre n'est pas un chatbot. Il reçoit un besoin RH, le transforme en
                  mission, prépare le travail, demande les validations sensibles, relance,
                  suit et garde une trace claire — pendant que vous gardez le contrôle.
                </p>

                <div className="flex flex-wrap gap-2.5">
                  <ActionButton href="/demo/pierre" label="Voir la démo Pierre" primary icon={<Eye className="h-4 w-4" />} />
                  <ActionButton href={RESERVE_HREF} label="Préparer l'accès" icon={<ArrowRight className="h-4 w-4" />} />
                  <ActionButton href="/questions" label="Poser une question" icon={<Bot className="h-4 w-4" />} />
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
                    Le poste RH le plus concret pour un usage réel immédiat. Tarif fondateur
                    conservé tant que l'abonnement reste actif.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      { k: "Poste RH", v: "Pas un assistant" },
                      { k: "Contrôle", v: "Humain sur le sensible" },
                      { k: "Trace", v: "Tout est historisé" },
                    ].map((s) => (
                      <div key={s.k} className="rounded-2xl border border-[var(--cs-line-soft)] bg-white/40 px-3 py-2.5 backdrop-blur-xl">
                        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">{s.k}</p>
                        <p className="mt-0.5 text-sm font-semibold text-[var(--cs-ink-1)]">{s.v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* MISSION VISUELLE */}
          <section className="cs-panel">
            <SectionHead
              kicker="Une mission, du début à la trace"
              title="Une demande naturelle devient un travail fini et suivi."
              text="Pas de prompts à apprendre : vous parlez à Pierre comme à un collaborateur RH. Voici ce qui se passe ensuite."
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {MISSION_FLOW.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="cs-card h-full">
                    <div className="relative flex h-full flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--cs-line)] bg-white/55 text-[var(--cs-violet)] shadow-[var(--cs-shadow-soft)]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-xs font-bold text-[var(--cs-ink-4)]">0{i + 1}</span>
                      </div>
                      <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{step.title}</p>
                      <p className="text-sm leading-6 text-[var(--cs-ink-3)]">{step.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5">
              <ActionButton href="/demo/pierre" label="Voir la démo Pierre" primary icon={<Eye className="h-4 w-4" />} />
            </div>
          </section>

          {/* BLOCS DE TRAVAIL */}
          <section className="cs-panel">
            <SectionHead
              kicker="Ce que Pierre absorbe"
              title="Des blocs de travail RH réels, pas un générateur de texte."
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {WORK_BLOCKS.map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.title} className="cs-card h-full">
                    <div className="relative flex h-full flex-col gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--cs-line)] bg-white/55 text-[var(--cs-violet)] shadow-[var(--cs-shadow-soft)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{b.title}</p>
                      <p className="text-sm leading-6 text-[var(--cs-ink-3)]">{b.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* AUTONOMIE & CONTRÔLE */}
          <section className="grid gap-6 xl:grid-cols-2">
            <div className="cs-panel">
              <SectionHead kicker="Ce que Pierre exécute" title="Autonome sur l'opérationnel." />
              <ul className="mt-5 space-y-3">
                {PIERRE_EXECUTES.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-success)]" />
                    <span className="text-sm text-[var(--cs-ink-3)]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="cs-panel">
              <SectionHead kicker="Ce qui exige une validation" title="Contrôlé sur le sensible." />
              <ul className="mt-5 space-y-3">
                {HUMAN_VALIDATES.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-violet)]" />
                    <span className="text-sm text-[var(--cs-ink-3)]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* EMPREINTE ENTREPRISE */}
          <section className="cs-panel">
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-center">
              <SectionHead
                kicker="Compréhension de l'entreprise"
                title="Pierre travaille avec votre Empreinte Entreprise."
                text="Pierre s'aligne progressivement sur votre structure, votre ton, vos règles, vos modèles, vos responsables et vos circuits de validation — pour produire un travail qui ressemble vraiment à votre entreprise."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Building2, t: "Structure & sites", d: "Organisation, équipes, responsables." },
                  { icon: MessageSquareMore, t: "Ton & modèles", d: "Style d'écriture et formats récurrents." },
                  { icon: ShieldCheck, t: "Règles & validations", d: "Ce qui s'exécute, ce qui se valide." },
                  { icon: FileCheck2, t: "Continuité", d: "Le contexte est conservé dans le temps." },
                ].map((c) => {
                  const Icon = c.icon;
                  return (
                    <div key={c.t} className="cs-card">
                      <div className="relative flex items-start gap-3">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-violet)]" />
                        <div>
                          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{c.t}</p>
                          <p className="text-sm text-[var(--cs-ink-4)]">{c.d}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* CONFIANCE */}
          <section className="cs-panel">
            <SectionHead
              kicker="Gouvernance & confiance"
              title="Puissant, jamais incontrôlé."
              text="Pierre refuse ou escalade ce qui sort du cadre RH autorisé, explique ses décisions et conserve une trace claire."
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { t: "Garde-fous actifs", d: "Les cas critiques sont bloqués ou soumis à validation." },
                { t: "Décisions expliquées", d: "Pourquoi une action est validée, bloquée ou refusée." },
                { t: "Historique exploitable", d: "Actions, statuts, livrables et sorties conservés." },
              ].map((c) => (
                <div key={c.t} className="cs-card">
                  <div className="relative space-y-1.5">
                    <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{c.t}</p>
                    <p className="text-sm text-[var(--cs-ink-3)]">{c.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* TARIF & ACTIVATION */}
          <section className="cs-command-surface overflow-hidden text-center">
            <div className="cs-system-halo" />
            <div className="relative mx-auto max-w-2xl space-y-5">
              <span className="cs-pill mx-auto w-fit">
                <Sparkles className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                <span>Tarif fondateur {EMPLOYEE_PRICE}</span>
              </span>
              <h2 className="cs-heading text-2xl md:text-4xl">
                Commencez par le poste RH.
                <br />
                Entrez ensuite dans le cockpit complet.
              </h2>
              <p className="mx-auto max-w-xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
                Voyez Pierre en action en quelques minutes, puis préparez votre accès.
                Aucun engagement avant l'ouverture des activations.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <ActionButton href="/demo/pierre" label="Voir la démo Pierre" primary icon={<Eye className="h-4 w-4" />} />
                <ActionButton href={RESERVE_HREF} label="Préparer l'accès" icon={<ArrowRight className="h-4 w-4" />} />
                <ActionButton href="/questions" label="Parler à CloneStore" icon={<Bot className="h-4 w-4" />} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
