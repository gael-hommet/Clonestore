import Link from "next/link";
import { Button } from "@/components/ui/button";

type AgentData = {
  slug: string;
  name: string;
  role: string;
  price: string;
  available: boolean;
};

const AGENTS: Record<string, AgentData> = {
  pierre: {
    slug: "pierre",
    name: "Pierre",
    role: "Assistant RH rédacteur",
    price: "299€/mois",
    available: true,
  },
  clara: { slug: "clara", name: "Clara", role: "Recruteuse IA", price: "549€/mois", available: false },
  alex: { slug: "alex", name: "Alex", role: "Assistant Ops", price: "399€/mois", available: false },
  emma: { slug: "emma", name: "Emma", role: "Support & mails", price: "449€/mois", available: false },
  noah: { slug: "noah", name: "Noah", role: "Assistant direction", price: "499€/mois", available: false },
};

function PierreSalesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 space-y-10">
      {/* HERO */}
      <header className="space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          Agent CloneStore • RH rédaction & structuration
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">
            Pierre — l’assistant RH qui transforme un brief flou en documents prêts à envoyer
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-3xl">
            Tu écris 3 lignes. Pierre te rend un document RH propre, clair, structuré, au bon ton,
            prêt à être envoyé ou publié. Offres d’emploi, mails candidats, fiches de poste, grilles
            d’entretien, onboarding, procédures… sans perdre 1h à reformuler.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="/paiement?agent=pierre">Embaucher Pierre — 299€/mois</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agents">Retour boutique</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Idéal pour PME / managers / RH débordés. Résultat en quelques secondes, format pro, ton maîtrisé.
        </p>
      </header>

      {/* PROOF / PROMESSE */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm font-medium">Gain de temps immédiat</p>
          <p className="text-sm text-muted-foreground">
            Un brief brut → un document utilisable. Tu arrêtes de “réécrire pour faire pro”.
          </p>
        </div>
        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm font-medium">Qualité RH constante</p>
          <p className="text-sm text-muted-foreground">
            Structure claire, formulation propre, ton adapté (pro/convivial), cohérence.
          </p>
        </div>
        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm font-medium">Prêt à envoyer</p>
          <p className="text-sm text-muted-foreground">
            Contenu final directement copiable. Pas une ébauche “brouillon”.
          </p>
        </div>
      </section>

      {/* CE QUE PIERRE FAIT */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Ce que Pierre fait</h2>
            <p className="text-sm text-muted-foreground">
              Le but : sortir des documents RH clean en un temps record.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="font-medium">Offres d’emploi & fiches de poste</p>
            <p className="text-sm text-muted-foreground">
              À partir de : poste, stack, missions, profil, salaire, lieu, type de contrat.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-2">
            <p className="font-medium">Mails candidats</p>
            <p className="text-sm text-muted-foreground">
              Reçu, refus, convocation, relance, confirmation, onboarding — ton propre et humain.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-2">
            <p className="font-medium">Entretiens</p>
            <p className="text-sm text-muted-foreground">
              Questions + grille simple + compte rendu structuré à partir de tes notes.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-2">
            <p className="font-medium">Onboarding & docs internes</p>
            <p className="text-sm text-muted-foreground">
              Plans 30/60/90 jours, procédures, scripts, documents internes.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border p-6">
          <p className="text-sm">
            <span className="font-medium">Pierre ne fait pas :</span>{" "}
            <span className="text-muted-foreground">
              scoring/tri de CV (ça sera Clara).
            </span>
          </p>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Comment ça marche</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm font-medium">1) Tu donnes un brief</p>
            <p className="text-sm text-muted-foreground">
              Même brouillon. Pierre pose une structure et reformule.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm font-medium">2) Tu choisis le ton</p>
            <p className="text-sm text-muted-foreground">
              Pro, convivial… Pierre adapte la rédaction.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm font-medium">3) Tu récupères le doc</p>
            <p className="text-sm text-muted-foreground">
              Directement copiable. Prêt à envoyer / publier.
            </p>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="rounded-2xl border p-8 space-y-4">
        <h2 className="text-xl font-semibold">Prêt à gagner du temps dès ce soir ?</h2>
        <p className="text-sm text-muted-foreground">
          Embauche Pierre et commence à produire des documents RH propres en quelques minutes.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="/paiement?agent=pierre">Embaucher Pierre — 299€/mois</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile/agents">Voir mes agents</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function ComingSoon({ slug }: { slug: string }) {
  const a = AGENTS[slug];
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        {a.name} — {a.role}
      </h1>
      <p className="text-sm text-muted-foreground">
        Cette fiche est en cours. Prix indicatif : <span className="font-medium">{a.price}</span>
      </p>

      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link href="/agents">Retour boutique</Link>
        </Button>
        <Button disabled>Bientôt disponible</Button>
      </div>
    </main>
  );
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const agent = AGENTS[slug];
  if (!agent) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 space-y-6">
        <h1 className="text-2xl font-semibold">Agent introuvable</h1>
        <Button asChild variant="outline">
          <Link href="/agents">Retour boutique</Link>
        </Button>
      </main>
    );
  }

  if (slug === "pierre") return <PierreSalesPage />;

  return <ComingSoon slug={slug} />;
}

