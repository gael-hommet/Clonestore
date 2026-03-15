export const dynamic = "force-dynamic";

import Link from "next/link";
import Client from "../client";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  BadgeCheck,
  Activity,
  ShieldCheck,
  Clock,
  ArrowRight,
  Layers,
  Sparkles,
} from "lucide-react";

function QuickPill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground bg-background/70">
      {icon}
      {children}
    </span>
  );
}

function QuickCard({
  title,
  description,
  href,
  cta,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border bg-background/70 p-5 transition hover:bg-background hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">{icon}</div>
            <p className="text-sm font-medium">{title}</p>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="inline-flex items-center gap-2 text-sm font-medium">
            {cta}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 space-y-8">
      <header className="space-y-6">
        <section className="rounded-3xl border bg-background/80 p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Espace client</p>
                <h1 className="text-3xl font-semibold tracking-tight">Mes employés</h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Gère tes employés IA, retrouve tes accès, consulte leur statut et utilise-les
                  rapidement depuis un espace centralisé, clair et professionnel.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <QuickPill icon={<BadgeCheck size={14} />}>Accès centralisés</QuickPill>
                <QuickPill icon={<ShieldCheck size={14} />}>Données isolées</QuickPill>
                <QuickPill icon={<Clock size={14} />}>Utilisation rapide</QuickPill>
                <QuickPill icon={<Layers size={14} />}>Employés spécialisés</QuickPill>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/profile">Mon compte</Link>
              </Button>
              <Button asChild>
                <Link href="/agents">Recruter un employé</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <QuickCard
            href="/profile"
            title="Mon compte"
            description="Retrouve ton profil, ta facturation et la vue globale de ton espace."
            cta="Voir mon compte"
            icon={<Briefcase className="h-4 w-4" />}
          />
          <QuickCard
            href="/agents"
            title="Recruter"
            description="Découvre les employés disponibles et ajoute de nouveaux postes automatisés."
            cta="Voir la boutique"
            icon={<Sparkles className="h-4 w-4" />}
          />
          <QuickCard
            href="/questions"
            title="Support"
            description="Besoin d’aide ou d’un réglage ? Accède rapidement au support CloneStore."
            cta="Ouvrir le support"
            icon={<Activity className="h-4 w-4" />}
          />
        </section>
      </header>

      <section className="rounded-3xl border bg-background/80 p-6 shadow-sm space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Gestion détaillée</h2>
          <p className="text-sm text-muted-foreground">
            Retrouve ci-dessous la liste complète de tes employés, leurs statuts, leurs accès et
            les actions disponibles.
          </p>
        </div>

        <Client />
      </section>
    </main>
  );
}













