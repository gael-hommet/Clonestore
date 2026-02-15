export const dynamic = "force-dynamic";

import Link from "next/link";
import Client from "../client";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mes clones</h1>
          <p className="text-sm text-muted-foreground">
            Gère tes accès, retrouve l’historique, et utilise tes clones en 1 clic.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/profile">Mon compte</Link>
          </Button>
          <Button asChild>
            <Link href="/agents">Embaucher un clone</Link>
          </Button>
        </div>
      </header>

      {/* Client gère la logique et l’affichage détaillé */}
      <Client />
    </main>
  );
}














