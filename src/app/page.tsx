import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap, ShieldCheck, Headphones } from "lucide-react";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-3xl py-20 px-4">
      {/* HERO */}
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
        Vos employés IA, clé en main.
      </h1>

      <p className="mt-4 text-muted-foreground text-base md:text-lg leading-relaxed">
        Agents IA professionnels prêts à l’emploi pour recruter, assister, 
        analyser, prospecter et gérer vos opérations.  
        Aucun setup complexe — branchez, lancez, optimisez.
      </p>

      {/* CTA */}
      <div className="mt-8 flex flex-wrap gap-4">
        <Button asChild className="px-6">
          <Link href="/agents">Voir les agents</Link>
        </Button>

        <Button asChild variant="outline" className="px-6">
          <Link href="/signup">Commencer maintenant</Link>
        </Button>
      </div>

      {/* BADGES DE CONFIANCE */}
      <div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
          <Zap size={14} aria-hidden /> Mise en place &lt; 24h
        </span>

        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
          <ShieldCheck size={14} aria-hidden /> Sécurisé RGPD
        </span>

        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
          <Headphones size={14} aria-hidden /> Support humain dédié
        </span>
      </div>
    </section>
  );
}


