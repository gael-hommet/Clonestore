"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function PaiementSuccessPage() {
  const params = useSearchParams();

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) return;

    fetch("/api/orders/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
  }, [params]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border bg-background p-6 text-center space-y-6 shadow-sm">
        <div className="flex justify-center">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Paiement confirmé</h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Merci pour ton achat.
          <br />
          Le paiement a bien été pris en compte et ton accès à <strong>Pierre</strong> va être activé.
        </p>

        <p className="text-xs text-muted-foreground">
          Si quelque chose ne s’affiche pas immédiatement, l’activation peut prendre quelques instants.
        </p>

        <div className="flex flex-col gap-3 pt-2">
          <Button asChild className="w-full">
            <Link href="/agents/pierre">Accéder à Pierre</Link>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link href="/profile">Aller à mon compte</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          Besoin d’aide ? Contacte le support depuis ton espace compte.
        </p>
      </section>
    </main>
  );
}





