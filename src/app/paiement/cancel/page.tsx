import Link from "next/link";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function PaiementCancelPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border bg-background p-6 text-center space-y-6 shadow-sm">
        
        <div className="flex justify-center">
          <XCircle className="h-12 w-12 text-red-600" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          Paiement annulé
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Aucun montant n’a été débité.  
          Tu peux réessayer à tout moment si tu le souhaites.
        </p>

        <div className="flex flex-col gap-3 pt-2">
          <Button asChild className="w-full">
            <Link href="/paiement">
              Revenir au paiement
            </Link>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link href="/agents/pierre">
              Retour à Pierre
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          Si tu as une question, tu peux nous contacter depuis ton espace compte.
        </p>
      </section>
    </main>
  );
}



