"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

function titleCaseSlug(slug: string) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function PaiementCancelPage() {
  const params = useSearchParams();

  const agent = useMemo(() => {
    const a = (params.get("agent") || "").trim().toLowerCase();
    return a || null;
  }, [params]);

  const displayAgent = agent ? titleCaseSlug(agent) : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border bg-background p-6 text-center space-y-6 shadow-sm">
        <div className="flex justify-center">
          <XCircle className="h-12 w-12 text-red-600" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Paiement annulé</h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Aucun montant n’a été débité.
          <br />
          {displayAgent ? (
            <>
              Tu peux réessayer quand tu veux pour activer <strong>{displayAgent}</strong>.
            </>
          ) : (
            <>Tu peux réessayer à tout moment si tu le souhaites.</>
          )}
        </p>

        <div className="flex flex-col gap-3 pt-2">
          <Button asChild className="w-full">
            <Link href={agent ? `/paiement?agent=${agent}` : "/paiement"}>Revenir au paiement</Link>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link href={agent ? `/agents/${agent}` : "/agents"}>Retour</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          Si tu as une question, contacte le support depuis ton espace compte.
        </p>
      </section>
    </main>
  );
}




