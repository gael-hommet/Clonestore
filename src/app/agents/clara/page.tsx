import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ClaraPage() {
  return (
    <main className="mx-auto max-w-3xl py-12 px-4 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Clara — Recruteuse IA</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Clara est l’agent CloneStore spécialisé dans l’analyse des candidatures.
          Elle trie, structure et aide à décider — avec un scoring clair et des shortlists.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild variant="outline">
            <Link href="/agents">Retour à la boutique</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/assistant">Poser une question</Link>
          </Button>
        </div>
      </header>

      <section className="rounded-2xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Ce que Clara fait</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
          <li>Analyse des CV (lecture, extraction des infos utiles, résumé).</li>
          <li>Scoring des profils selon tes critères (poste, seniorité, must-have).</li>
          <li>Shortlist claire avec raisons (pourquoi oui / pourquoi non).</li>
          <li>Préparation d’un retour RH “prêt à envoyer” (si activé dans le flux).</li>
        </ul>
      </section>

      <section className="rounded-2xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Ce que Clara ne fait pas</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
          <li>Ne remplace pas un entretien humain (elle prépare la décision).</li>
          <li>Ne “devine” pas des infos non présentes dans les CV.</li>
          <li>Ne fait pas de promesses légales/juridiques.</li>
        </ul>
      </section>

      <section className="rounded-2xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Exemples d’usage</h2>
        <div className="grid gap-3">
          <div className="rounded-lg border p-4">
            <p className="font-medium text-sm">Tri candidatures</p>
            <p className="text-sm text-muted-foreground">
              “J’ai 37 CV pour un commercial B2B. Fais un scoring + une shortlist de 5.”
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-medium text-sm">Comparaison candidats</p>
            <p className="text-sm text-muted-foreground">
              “Compare ces 3 candidats et dis lequel est le plus adapté + pourquoi.”
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-medium text-sm">Préparation entretien</p>
            <p className="text-sm text-muted-foreground">
              “Génère des questions ciblées à partir du CV et du poste.”
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Disponibilité</h2>
        <p className="text-sm text-muted-foreground">
          Clara arrive prochainement. Pour l’instant, l’agent disponible est Pierre.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/agents/pierre">Voir Pierre</Link>
          </Button>
          <Button disabled>Disponible prochainement</Button>
        </div>
      </section>
    </main>
  );
}



