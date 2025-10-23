"use client";
import { useSearchParams } from "next/navigation";

export default function CheckoutPage() {
  const params = useSearchParams();
  const agent = params.get("agent");

  return (
    <section className="mx-auto max-w-3xl py-12 px-4">
      <h1 className="text-2xl font-semibold">Paiement</h1>
      <p className="text-muted-foreground mt-2">
        (Placeholder) Stripe sera branché ici en mode test, puis en production au lancement.
      </p>

      <div className="mt-6 rounded-2xl border p-5">
        <h2 className="font-medium mb-2">Résumé</h2>
        <p className="text-sm text-muted-foreground">
          Agent sélectionné : <strong>{agent ?? "Aucun (à choisir sur /agents)"}</strong>
        </p>
      </div>
    </section>
  );
}
