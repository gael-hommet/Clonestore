import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AccountCard({
  loading,
  email,
  userId,
}: {
  loading: boolean;
  email: string | null;
  userId: string | null;
}) {
  return (
    <div className="rounded-xl border p-5 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Compte</p>
        <p className="text-sm text-muted-foreground">
          {loading ? "Chargement…" : email || "—"}
        </p>
        <p className="text-xs text-muted-foreground">
          {loading ? "" : userId ? `ID: ${userId}` : ""}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button asChild variant="outline">
          <Link href="/profile/security">Sécurité & connexion</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/profile/support">Aide & support</Link>
        </Button>
      </div>
    </div>
  );
}
