"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { AGENTS } from "@/lib/agent-catalog";

type AccessState = "loading" | "denied" | "allowed";

function titleCaseSlug(slug: string) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function AgentUsePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();

  const agent = useMemo(() => AGENTS.find((a) => a.slug === slug), [slug]);

  const [state, setState] = useState<AccessState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      setState("loading");

      const { data: auth, error: authErr } = await supabaseBrowser.auth.getUser();
      const user = auth?.user;

      if (cancelled) return;

      if (authErr || !user) {
        // vers ta route réelle de login (tu utilises /login ailleurs)
        router.push("/login");
        return;
      }

      const { data, error } = await supabaseBrowser
        .from("agents_owned")
        .select("id,status")
        .eq("user_id", user.id)
        .eq("agent_slug", slug)
        .eq("status", "active")
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setState("denied");
        return;
      }

      setState("allowed");
    }

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router, slug]);

  const agentName = agent?.name ?? titleCaseSlug(slug);

  if (state === "loading") {
    return (
      <main className="mx-auto max-w-4xl py-12 px-4 space-y-6">
        <header className="space-y-2">
          <p className="text-xs text-muted-foreground">
            <Link className="underline underline-offset-4" href="/agents">
              Boutique
            </Link>{" "}
            / <span className="text-muted-foreground">{agentName}</span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {agentName} — Espace agent
          </h1>
          <p className="text-sm text-muted-foreground">Vérification de l’accès…</p>
        </header>

        <section className="rounded-2xl border p-6">
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </section>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="mx-auto max-w-4xl py-12 px-4 space-y-6">
        <header className="space-y-2">
          <p className="text-xs text-muted-foreground">
            <Link className="underline underline-offset-4" href="/agents">
              Boutique
            </Link>{" "}
            / <Link className="underline underline-offset-4" href={`/agents/${slug}`}>
              {agentName}
            </Link>{" "}
            / <span>Utiliser</span>
          </p>

          <h1 className="text-2xl font-semibold tracking-tight">Accès indisponible</h1>
          <p className="text-sm text-muted-foreground">
            Cet agent n’est pas actif sur ton compte.
          </p>
        </header>

        <section className="rounded-2xl border p-6 space-y-4">
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">
              Si tu viens d’effectuer un paiement, attends quelques secondes puis recharge la page.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/agents/${slug}`}>Voir la fiche</Link>
            </Button>
            <Button asChild>
              <Link href={`/paiement?agent=${slug}`}>Activer l’accès</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/profile">Mon compte</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  // allowed
  return (
    <main className="mx-auto max-w-4xl py-12 px-4 space-y-8">
      <header className="space-y-2">
        <p className="text-xs text-muted-foreground">
          <Link className="underline underline-offset-4" href="/agents">
            Boutique
          </Link>{" "}
          / <Link className="underline underline-offset-4" href={`/agents/${slug}`}>
            {agentName}
          </Link>{" "}
          / <span>Utiliser</span>
        </p>

        <h1 className="text-2xl font-semibold tracking-tight">
          {agentName} — Espace agent
        </h1>

        <p className="text-sm text-muted-foreground">
          Lance tes demandes, retrouve l’historique et pilote l’agent depuis cet espace.
        </p>
      </header>

      <section className="rounded-2xl border p-6 space-y-4">
        <h2 className="text-lg font-medium">Actions</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4 space-y-2">
            <p className="text-sm font-medium">Faire une demande</p>
            <p className="text-sm text-muted-foreground">
              Envoie une demande à l’agent (ex : “rédige un mail…”, “prépare un doc…”, “analyse…”).
            </p>
            <Button asChild className="w-full">
              <Link href={`/agents/${slug}/request`}>Créer une demande</Link>
            </Button>
          </div>

          <div className="rounded-xl border p-4 space-y-2">
            <p className="text-sm font-medium">Historique</p>
            <p className="text-sm text-muted-foreground">
              Consulte ce qui a été fait : résultats, statuts et actions passées.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/agents/${slug}/history`}>Voir l’historique</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild variant="outline">
            <Link href="/profile/agents">Retour à Mes agents</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/questions">Support</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Tu veux une action non disponible ? Pose la question au support, on te guide.
        </p>
      </section>
    </main>
  );
}
