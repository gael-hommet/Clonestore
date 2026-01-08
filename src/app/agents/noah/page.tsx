import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AgentPage() {
  return (
    <section className="mx-auto max-w-3xl py-12 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Noah — Agent de pilotage RH
        </h1>

        <p className="mt-4 text-muted-foreground leading-relaxed text-sm md:text-base">
          Noah sera l&apos;agent dédié au pilotage RH. Il synthétisera les informations
          venant de Pierre, Clara et Emma pour t&apos;offrir une vision claire de ta
          situation RH actuelle.
        </p>
      </div>

      {/* Statut */}
      <div className="inline-flex items-center gap-2 rounded-full bg-yellow-50 px-3 py-1 border border-yellow-200">
        <span className="h-2 w-2 rounded-full bg-yellow-500" />
        <span className="text-xs font-semibold text-yellow-700">
          Phase de réflexion — priorisé après les agents opérationnels
        </span>
      </div>

      {/* Contenu */}
      <div className="space-y-4 text-sm md:text-base text-muted-foreground">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">
            Ce que Noah fera pour toi
          </h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Synthèse des données issues des autres agents.</li>
            <li>Préparation des points RH mensuels.</li>
            <li>Suivi de quelques indicateurs RH simples.</li>
            <li>Aide à structurer les priorités RH de ton équipe.</li>
            <li>Préparation de recommandations stratégiques légères.</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Pourquoi Noah arrive en dernier ?
          </h3>
          <p>
            Le pilotage RH n’est utile que si les bases sont solides :
            Pierre doit maîtriser la rédaction, Clara doit scorer les profils,
            Emma doit gérer le quotidien. Noah viendra compléter l’écosystème
            une fois ces briques stabilisées en production.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href="/agents">Retour à la boutique</Link>
        </Button>

        <Button disabled>
          Disponible en phase finale
        </Button>
      </div>
    </section>
  );
}

