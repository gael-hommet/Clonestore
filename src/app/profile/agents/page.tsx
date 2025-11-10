"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Row = { id: string; agent_slug: string; status: string; started_at: string };

export default function MyAgentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        if (!sb) { setLoading(false); return; } // pas d'env → pas de crash

        const { data: { user }, error: userErr } = await sb.auth.getUser();
        if (userErr) throw userErr;
        if (!user) { setLoading(false); return; }

        setEmail(user.email ?? null);

        const { data, error } = await sb
          .from("orders")
          .select("id, agent_slug, status, started_at")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false });

        if (error) throw error;
        setRows((data ?? []) as Row[]);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setErr(message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <section className="mx-auto max-w-3xl py-12 px-4">
        <h1 className="text-2xl font-semibold">Mes agents</h1>
        <p className="text-sm text-muted-foreground mt-2">Chargement…</p>
      </section>
    );
  }

  if (!email) {
    return (
      <section className="mx-auto max-w-3xl py-12 px-4">
        <h1 className="text-2xl font-semibold">Mes agents</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Vous devez être connecté pour voir vos agents.
        </p>
        <a href="/login" className="inline-block mt-4 border rounded px-3 py-2">Se connecter</a>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl py-12 px-4">
      <h1 className="text-2xl font-semibold">Mes agents</h1>
      <p className="text-sm text-muted-foreground">Connecté : {email}</p>
      {err && <p className="mt-3 text-sm text-red-600">Erreur : {err}</p>}
      <div className="mt-6 grid gap-3">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">Aucun agent activé pour l’instant.</p>
        ) : (
          rows.map(r => (
            <div key={r.id} className="rounded border p-3">
              <div className="font-medium">{r.agent_slug}</div>
              <div className="text-sm text-muted-foreground">
                Statut: {r.status} — {new Date(r.started_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}




