import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AgentPage() {
  return (
    <section className="mx-auto max-w-3xl py-12 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Emma — Assistante RH quotidienne
        </h1>

        <p className="mt-4 text-muted-foreground leading-relaxed text-sm md:text-base">
          Emma sera l&apos;assistante RH de ton équipe. Elle prendra en charge les petites
          tâches RH du quotidien pour te faire gagner en clarté, en organisation et en
          sérénité.
        </p>
      </div>

      {/* Statut */}
      <div className="inline-flex items-center gap-2 rounded-full bg-yellow-50 px-3 py-1 border border-yellow-200">
        <span className="h-2 w-2 rounded-full bg-yellow-500" />
        <span className="text-xs font-semibold text-yellow-700">
          En conception — après Pierre & Clara
        </span>
      </div>

      {/* Contenu */}
      <div className="space-y-4 text-sm md:text-base text-muted-foreground">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">
            Ce qu&apos;Emma fera pour toi
          </h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Réponses aux questions RH de base.</li>
            <li>Aide à la rédaction de petits mails internes.</li>
            <li>Rappels automatiques : congés, échéances, tâches RH.</li>
            <li>Préparation de points de suivi RH simples.</li>
            <li>Support administratif léger.</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Positionnement dans la roadmap
          </h3>
          <p>
            Après Pierre (rédaction RH) et Clara (recrutement), Emma apportera une aide
            quotidienne aux petites équipes qui n&apos;ont pas de service RH interne.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href="/agents">Retour à la boutique</Link>
        </Button>

        <Button disabled>
          Disponible après Clara
        </Button>
      </div>
    </section>
  );
}


