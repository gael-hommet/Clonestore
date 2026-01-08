import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AgentsCard({
  loading,
  activeAgents,
}: {
  loading: boolean;
  activeAgents: { id: string; agent_slug: string; started_at: string }[];
}) {
  return (
    <div className="rounded-xl border p-5 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Mes agents actifs</p>
        <p className="text-sm text-muted-foreground">
          {loading ? "Chargement…" : `${activeAgents.length} agent(s) actif(s)`}
        </p>
      </div>

      {!loading && activeAgents.length > 0 ? (
        <div className="space-y-2">
          {activeAgents.slice(0, 3).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="font-medium capitalize truncate">{a.agent_slug}</p>
                <p className="text-xs text-muted-foreground">
                  Actif depuis {new Date(a.started_at).toLocaleString()}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href={`/agents/${a.agent_slug}/use`}>Utiliser</Link>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        !loading && <p className="text-sm text-muted-foreground">Aucun agent actif.</p>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <Button asChild>
          <Link href="/profile/agents">Gérer mes agents</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/agents">Boutique</Link>
        </Button>
      </div>
    </div>
  );
}
