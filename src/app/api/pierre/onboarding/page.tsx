"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Bot,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  PenSquare,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";

type StepItem = {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
  bullets: string[];
  href: string;
  cta: string;
};

type UseCaseItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type PrincipleItem = {
  title: string;
  text: string;
  icon: LucideIcon;
};

const steps: StepItem[] = [
  {
    number: "01",
    title: "Configurer l’entreprise",
    description:
      "Pierre doit d’abord comprendre ton entreprise, ton ton, ta signature, tes coordonnées et tes règles internes pour produire des contenus vraiment cohérents.",
    icon: Building2,
    bullets: [
      "Identité de l’entreprise",
      "Contact principal RH",
      "Signature et coordonnées",
      "Règles internes et contraintes",
    ],
    href: "/agents/pierre/setup",
    cta: "Ouvrir le formulaire 1",
  },
  {
    number: "02",
    title: "Utiliser Pierre au quotidien",
    description:
      "Une fois configuré, Pierre peut rédiger tes emails et documents RH à partir d’un simple brief, avec historique et réutilisation.",
    icon: PenSquare,
    bullets: [
      "Brief libre ou preset rapide",
      "Rédaction RH structurée",
      "Copie texte ou HTML",
      "Historique réutilisable",
    ],
    href: "/agents/pierre/use",
    cta: "Utiliser Pierre",
  },
  {
    number: "03",
    title: "Transformer le résultat en action",
    description:
      "Pierre peut ensuite servir de base pour l’envoi d’email, la génération documentaire, puis les PDF complets et exacts.",
    icon: Workflow,
    bullets: [
      "Envoi email piloté",
      "Identité d’envoi cadrée",
      "Fallback sécurisé",
      "Base prête pour les PDF",
    ],
    href: "/agents/pierre",
    cta: "Voir la fiche Pierre",
  },
];

const useCases: UseCaseItem[] = [
  {
    title: "Refus candidat",
    description:
      "Pierre rédige un refus clair, humain et professionnel, cohérent avec le ton de l’entreprise.",
    icon: Mail,
  },
  {
    title: "Compte rendu RH",
    description:
      "Pierre structure les faits, les décisions et les actions dans un document directement exploitable.",
    icon: FileText,
  },
  {
    title: "Annonce interne",
    description:
      "Pierre reformule une communication RH en version propre, lisible et adaptée à l’équipe.",
    icon: Briefcase,
  },
];

const principles: PrincipleItem[] = [
  {
    title: "Simple à comprendre",
    text: "Le client doit savoir quoi faire immédiatement, sans chercher où cliquer ni comment démarrer.",
    icon: Sparkles,
  },
  {
    title: "Sérieux et rassurant",
    text: "Pierre doit inspirer confiance, avec un cadre clair, une logique cohérente et une présentation propre.",
    icon: ShieldCheck,
  },
  {
    title: "Vraiment utile",
    text: "Pierre ne sert pas à faire joli : il doit faire gagner du temps et produire des contenus prêts à l’emploi.",
    icon: Bot,
  },
];

function VioletBadge({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs text-violet-700 shadow-sm">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      {eyebrow ? <p className="text-sm font-medium text-violet-700">{eyebrow}</p> : null}
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export default function PierreOnboardingPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-12">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-[28px] border bg-gradient-to-br from-background via-violet-50/60 to-background p-8 shadow-sm"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-fuchsia-200/20 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <VioletBadge icon={Sparkles}>Onboarding Pierre</VioletBadge>
              <VioletBadge icon={Clock3}>Démarrage guidé</VioletBadge>
              <VioletBadge icon={ShieldCheck}>Structuré et sécurisé</VioletBadge>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Bien démarrer avec <span className="text-violet-700">Pierre</span>
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Pierre est ton clone RH rédacteur. Cette page t’explique simplement comment le
                configurer, comment l’utiliser au quotidien, et comment obtenir des résultats
                propres, cohérents et directement exploitables.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="gap-2">
                <Link href="/agents/pierre/setup">
                  Commencer la configuration
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline">
                <Link href="/agents/pierre/use">Utiliser Pierre</Link>
              </Button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="rounded-3xl border border-violet-200/60 bg-background/90 p-6 shadow-sm"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-700">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Pierre</p>
                  <p className="text-xs text-muted-foreground">Assistant RH rédacteur automatisé</p>
                </div>
              </div>

              <div className="rounded-2xl border bg-violet-50/40 p-4">
                <p className="text-sm font-medium">Ce que Pierre fait très bien</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
                    Rédiger des emails RH propres et cohérents
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
                    Produire des documents RH structurés rapidement
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
                    S’adapter au ton, à la signature et aux règles internes
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
                    Préparer une base solide pour l’envoi et les futurs PDF
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <section className="space-y-6">
        <SectionTitle
          eyebrow="Étapes"
          title="Comment fonctionne Pierre"
          description="Le parcours est volontairement simple : d’abord on configure, ensuite on utilise, puis on transforme le résultat en action."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08 * index }}
                className="rounded-3xl border bg-background/80 p-6 shadow-sm"
              >
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                      {step.number}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>

                  <ul className="space-y-2">
                    {step.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>

                  <Button asChild variant="outline" className="w-full">
                    <Link href={step.href}>{step.cta}</Link>
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <SectionTitle
          eyebrow="Cas d’usage"
          title="Ce que le client peut faire facilement"
          description="Pierre doit être compris vite. Voici les usages les plus simples et les plus concrets."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {useCases.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.06 * index }}
                className="rounded-3xl border bg-background/80 p-6 shadow-sm"
              >
                <div className="space-y-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <SectionTitle
          eyebrow="Principes"
          title="Ce que le client doit ressentir"
          description="Pierre doit être perçu comme un outil sérieux, simple et rassurant."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {principles.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 * index }}
                className="rounded-3xl border bg-background/80 p-6 shadow-sm"
              >
                <div className="space-y-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.text}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12 }}
        className="rounded-[28px] border bg-gradient-to-r from-violet-50 via-background to-fuchsia-50 p-8 shadow-sm"
      >
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-3">
            <p className="text-sm font-medium text-violet-700">Prêt à démarrer</p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Le meilleur point de départ reste le formulaire 1
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Plus le formulaire 1 est bien rempli, plus Pierre sera cohérent, précis et utile.
              Ensuite, cette base pourra être modifiée à tout moment depuis le compte client.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button asChild className="gap-2">
              <Link href="/agents/pierre/setup">
                Ouvrir le formulaire 1
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/agents/pierre/use">Aller sur Pierre</Link>
            </Button>
          </div>
        </div>
      </motion.section>
    </main>
  );
}