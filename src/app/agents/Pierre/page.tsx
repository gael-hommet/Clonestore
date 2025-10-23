import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PierrePage() {
  return (
    <section className="mx-auto max-w-3xl py-12 px-4">
      <Link href="/agents" className="text-sm underline hover:opacity-80">
        ← Retour aux agents
      </Link>

      <h1 className="mt-3 text-3xl md:text-4xl font-bold">Pierre — Assistant RH IA</h1>
      <p className="mt-2 text-muted-foreground">
        Génère et envoie des emails RH (sélection, rejet, convocation),
        relances automatiques, suivi des réponses, et rapport hebdo.
      </p>

      <Card className="mt-6 p-5 grid gap-3 rounded-2xl">
        <h2 className="font-semibold">Fonctions clés</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground grid gap-1">
          <li>Mails RH (sélection / rejet / convocation) au ton pro</li>
          <li>Relances automatiques (J+2, J+7) configurables</li>
          <li>Lecture des réponses et mise à jour de statut</li>
          <li>Rapport hebdomadaire (Synthèse + KPIs)</li>
        </ul>

        <div className="pt-2">
          <Button asChild>
            <Link href="/checkout">Activer Pierre</Link>
          </Button>
        </div>
      </Card>

      <Card className="mt-6 p-5 grid gap-2 rounded-2xl">
        <h3 className="font-medium">Pré-requis (tech)</h3>
        <p className="text-sm text-muted-foreground">
          Compte email (pro), feuille Google Sheets (ou DB), et accès au Router (clé API).
          Tout est assisté à l’installation.
        </p>
      </Card>
    </section>
  );
}
