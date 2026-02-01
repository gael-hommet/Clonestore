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
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-20 space-y-28">
      {/* ================= HERO ================= */}
      <section className="max-w-3xl">
       <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
  Des agents IA qui prennent en charge votre travail.
</h1>

<p className="mt-4 text-lg md:text-xl font-medium">
  Gagnez du temps et de l’argent. Sans recruter.
</p>

<p className="mt-3 text-muted-foreground text-base md:text-lg leading-relaxed">
  CloneStore déploie des agents IA spécialisés, configurés pour votre entreprise,
  capables d’exécuter des tâches réelles (RH, support, opérations), seuls ou en
  équipe via un Router intelligent.
</p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Button asChild className="px-6">
            <Link href="/agents">Voir les agents</Link>
          </Button>

          <Button asChild variant="outline" className="px-6">
            <Link href="/chatbot">Parler au chatbot</Link>
          </Button>
        </div>

        {/* Badges confiance */}
        <div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
            <Zap size={14} /> Mise en place &lt; 24h
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
            <ShieldCheck size={14} /> Sécurisé RGPD
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
            <Headphones size={14} /> Support humain + IA
          </span>
        </div>
      </section>

      {/* ================= VISUEL CONCEPT ================= */}
      <section className="rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-medium">Agents spécialisés</span>
          <span>→</span>
          <span className="font-medium">Router CloneStore</span>
          <span>→</span>
          <span className="font-medium">Résultat exploitable</span>
        </div>
      </section>

      {/* ================= COMMENT ÇA MARCHE ================= */}
      <section className="grid gap-10 md:grid-cols-3">
        <Step
          icon={<Users />}
          title="Choisissez un agent"
          text="Chaque agent correspond à un métier précis. Ce ne sont pas des prompts génériques."
        />
        <Step
          icon={<Settings />}
          title="Configuration entreprise"
          text="Règles, contexte, formats, données autorisées : tout est cadré."
        />
        <Step
          icon={<Network />}
          title="Il travaille (seul ou en équipe)"
          text="Les agents coopèrent via le Router pour produire un résultat final."
        />
      </section>

      {/* ================= AGENTS = CHARGE DE TRAVAIL ================= */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">
          Des agents qui remplacent des heures de travail
        </h2>

        <ul className="space-y-4 text-muted-foreground">
          <li>• Un agent RH peut gérer le tri de CV, la présélection et les emails candidats</li>
          <li>• Un agent support répond, classe et prépare les réponses clients</li>
          <li>• Un agent administratif génère documents, mails et synthèses</li>
        </ul>

        <p className="text-sm text-muted-foreground">
          → Chaque agent équivaut à plusieurs heures de travail humain par semaine.
        </p>
      </section>

      {/* ================= DIFFÉRENCIATION ================= */}
      <section className="grid gap-6 md:grid-cols-2">
        <DiffPoint
          icon={<Users />}
          title="Agents finis"
          text="Chaque agent est un produit spécialisé, pas un simple prompt."
        />
        <DiffPoint
          icon={<Network />}
          title="Coopération entre agents"
          text="Les agents peuvent travailler ensemble via le Router (CloneOS)."
        />
        <DiffPoint
          icon={<FileText />}
          title="Historique des actions"
          text="Tout ce qui est fait est traçable et consultable."
        />
        <DiffPoint
          icon={<Headphones />}
          title="Support + chatbot"
          text="Aide immédiate par IA, et support humain si nécessaire."
        />
      </section>

      {/* ================= SÉCURITÉ ================= */}
      <section className="rounded-xl border p-6 space-y-4">
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

      {/* ================= CTA FINAL ================= */}
      <section className="text-center space-y-6">
        <h2 className="text-2xl font-semibold">
          Prêt à déléguer une partie de votre travail ?
        </h2>
        <Button asChild size="lg">
          <Link href="/agents">Découvrir les agents</Link>
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
    <div className="space-y-3">
      <div className="w-10 h-10 rounded-lg border flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
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
    <div className="flex gap-3">
      <div className="mt-1">{icon}</div>
      <div>
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}


