import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Zap,
  ShieldCheck,
  Headphones,
  Users,
  Settings,
  Network,
  Lock,
  FileText,
  ArrowRight,
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="relative mx-auto max-w-6xl px-4 py-16 md:py-24 space-y-24">
      {/* HERO */}
      <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] items-start">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground shadow-soft">
            <span className="cs-mark scale-50" />
            Plateforme d’employés IA pour PME
          </div>

          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
            Des employés IA <span className="underline decoration-[var(--cs-beige)] decoration-8 underline-offset-4">qui exécutent</span> votre travail.
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
            CloneStore déploie des clones IA spécialisés, configurés pour votre entreprise,
            capables d’exécuter des tâches réelles (RH, support, opérations), seuls ou en
            équipe via un Router intelligent.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild className="px-6">
              <Link href="/agents">Voir les clones</Link>
            </Button>

            <Button asChild variant="outline" className="px-6">
              <Link href="/assistant">Parler au chatbot</Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4">
            <span className="cs-pill">
              <Zap size={14} /> Mise en place &lt; 24h
            </span>
            <span className="cs-pill">
              <ShieldCheck size={14} /> Sécurisé RGPD
            </span>
            <span className="cs-pill">
              <Headphones size={14} /> Support humain + IA
            </span>
          </div>
        </div>

        {/* VISUEL “SYSTEM” */}
        <div className="cs-card p-6 md:p-7">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">CloneOS — orchestration</p>
            <span className="text-xs text-muted-foreground">Router + agents</span>
          </div>

          <div className="mt-6 space-y-4">
            <SystemRow left="Clones spécialisés" mid="Router CloneStore" right="Résultat exploitable" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <MiniCard title="RH" text="CV, mails, synthèses" icon={<Users size={16} />} />
              <MiniCard title="Support" text="Réponses, classement" icon={<Headphones size={16} />} />
              <MiniCard title="Ops" text="Docs, process, suivi" icon={<Settings size={16} />} />
              <MiniCard title="Traçabilité" text="Logs & historique" icon={<FileText size={16} />} />
            </div>
          </div>

          <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Lock size={14} />
              Données isolées par entreprise • HMAC • logs
            </div>
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="space-y-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Comment ça marche
            </h2>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Un process simple, mais structuré comme une vraie plateforme entreprise.
            </p>
          </div>

          <Link
            href="/agents"
            className="hidden md:inline-flex items-center gap-2 text-sm font-medium hover:opacity-80"
          >
            Voir la boutique <ArrowRight size={16} />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Step
            icon={<Users size={18} />}
            title="Choisissez un clone"
            text="Chaque clone correspond à un métier précis. Ce ne sont pas des prompts génériques."
          />
          <Step
            icon={<Settings size={18} />}
            title="Configuration entreprise"
            text="Règles, contexte, formats, données autorisées : tout est cadré."
          />
          <Step
            icon={<Network size={18} />}
            title="Il exécute (seul ou en équipe)"
            text="Les clones coopèrent via le Router pour produire un résultat final."
          />
        </div>
      </section>

      {/* IMPACT */}
      <section className="cs-card p-8 md:p-10">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">Des clones qui remplacent des heures de travail</h2>
            <p className="text-muted-foreground">
              Tu ne vends pas “de l’IA”. Tu vends un poste automatisé, avec un cadre et des résultats.
            </p>
          </div>

          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>• Un clone RH peut gérer le tri de CV, la présélection et les emails candidats</li>
            <li>• Un clone support répond, classe et prépare les réponses clients</li>
            <li>• Un clone administratif génère documents, mails et synthèses</li>
          </ul>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Metric label="Mise en place" value="&lt; 24h" />
          <Metric label="Disponibilité" value="24/7" />
          <Metric label="Traçabilité" value="Logs" />
          <Metric label="Sécurité" value="RGPD" />
        </div>
      </section>

      {/* DIFFERENCIATION */}
      <section className="grid gap-6 md:grid-cols-2">
        <DiffPoint
          icon={<Users size={18} />}
          title="Clones finis"
          text="Chaque clone est un produit spécialisé, pas un simple prompt."
        />
        <DiffPoint
          icon={<Network size={18} />}
          title="Coopération entre clones"
          text="Les clones peuvent travailler ensemble via le Router (CloneOS)."
        />
        <DiffPoint
          icon={<FileText size={18} />}
          title="Historique des actions"
          text="Tout ce qui est fait est traçable et consultable."
        />
        <DiffPoint
          icon={<Headphones size={18} />}
          title="Support + chatbot"
          text="Aide immédiate par IA, et support humain si nécessaire."
        />
      </section>

      {/* SECURITE */}
      <section className="cs-card p-8 space-y-4">
        <h2 className="text-xl font-semibold">Sécurité & confiance</h2>
        <ul className="space-y-2 text-muted-foreground text-sm">
          <li className="flex items-center gap-2">
            <Lock size={14} /> Données isolées par entreprise
          </li>
          <li className="flex items-center gap-2">
            <FileText size={14} /> Logs et historique des actions
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck size={14} /> Aucune donnée utilisée pour l’entraînement
          </li>
        </ul>
      </section>

      {/* CTA */}
      <section className="text-center space-y-6">
        <h2 className="text-2xl md:text-3xl font-semibold">
          Prêt à déléguer une partie de votre travail ?
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Commence par un agent (Pierre, Clara, Emma…). Ensuite, tu étends à d’autres postes.
        </p>
        <Button asChild size="lg">
          <Link href="/agents">Découvrir les clones</Link>
        </Button>
      </section>
    </main>
  );
}

/* ================= COMPONENTS ================= */

function Step({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="cs-card p-6 space-y-3">
      <div className="w-10 h-10 rounded-xl border bg-muted/40 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function DiffPoint({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="cs-card p-6 flex gap-3">
      <div className="mt-0.5 text-foreground/90">{icon}</div>
      <div>
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function SystemRow({
  left,
  mid,
  right,
}: {
  left: string;
  mid: string;
  right: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-sm">
        <span className="font-medium">{left}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-medium">{mid}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-medium">{right}</span>
      </div>
    </div>
  );
}

function MiniCard({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

