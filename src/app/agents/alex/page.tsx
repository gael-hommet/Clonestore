import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AlexPage() {
  return (
    <section className="mx-auto max-w-3xl py-12 px-4">
      <h1 className="text-3xl font-semibold tracking-tight">
        Alex — Assistant Commercial IA
      </h1>

      <p className="mt-4 text-muted-foreground leading-relaxed text-sm md:text-base">
        Alex automatise la prospection, répond aux emails des prospects, suit les leads,
        rédige des messages personnalisés et vous aide à générer plus d’opportunités,
        sans effort de votre part.
      </p>

      <p className="mt-2 text-muted-foreground text-sm">
        La fiche complète sera disponible lors du lancement officiel.
      </p>

      <div className="mt-6 flex gap-3">
        <Button variant="outline" asChild>
          <Link href="/agents">Retour à la boutique</Link>
        </Button>
        <Button disabled>Disponible prochainement</Button>
      </div>
    </section>
  );
}
