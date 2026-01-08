import Link from "next/link";
import { Button } from "@/components/ui/button";

type OrderRow = {
  id: string;
  agent_slug: string;
  status: string;
  started_at: string;
  ended_at: string | null;
};

function formatEvent(o: OrderRow) {
  if (o.status === "active") return `Activation: ${o.agent_slug}`;
  if (o.status === "cancelled") return `Résiliation: ${o.agent_slug}`;
  return `Mise à jour: ${o.agent_slug} (${o.status})`;
}

export default function ActivityCard({
  loading,
  orders,
}: {
  loading: boolean;
  orders: OrderRow[];
}) {
  return (
    <section className="rounded-xl border p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium">Activité récente</h2>
        <Button asChild variant="outline">
          <Link href="/profile/agents">Voir mes agents</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune activité pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {orders.slice(0, 8).map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{formatEvent(o)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.started_at).toLocaleString()}
                  {o.ended_at ? ` • fin: ${new Date(o.ended_at).toLocaleString()}` : ""}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href={`/agents/${o.agent_slug}`}>Ouvrir</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
