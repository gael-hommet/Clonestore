import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function BillingCard({
  loading,
  lastOrder,
}: {
  loading: boolean;
  lastOrder: { agent_slug: string; status: string; started_at: string } | null;
}) {
  const label = loading
    ? "Chargement…"
    : lastOrder
      ? `Dernière action: ${lastOrder.agent_slug} (${lastOrder.status})`
      : "Aucune activité de facturation";

  return (
    <div className="rounded-xl border p-5 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Facturation</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {!loading && lastOrder && (
          <p className="text-xs text-muted-foreground">
            {new Date(lastOrder.started_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button asChild variant="outline">
          <Link href="/profile/billing">Historique</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/paiement">Embaucher un agent</Link>
        </Button>
      </div>
    </div>
  );
}
