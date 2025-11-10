"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

interface AgentRow {
  id: string;
  agent_slug: string;
  status: string;
  started_at: string;
}

export default function MyAgentsPage() {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const sb = getSupabase();
        if (!sb) {
          setErr("Configuration Supabase manquante");
          setLoading(false);
          return;
        }

        const { data: userData, error: userErr } = await sb.auth.getUser();
        if (userErr) throw userErr;
        if (!userData?.user) {
          setLoading(false);
          return;
        }

        setEmail(userData.user.email ?? null);

        const { data, error } = await sb
          .from("orders")
          .select("id, agent_slug, status, started_at")
          .eq("user_id", userData.user.id)
          .order("started_at", { ascending: false });

        if (error) throw error;
        setRows((data as AgentRow[]) ?? []);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setErr(message);
      } finally {
        setLoading(false);
      }
    };
    load();
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
        <a href="/login" className="inline-block mt-4 border rounded px-3 py-2">
          Se connecter
        </a>
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
          <p className="text-muted-foreground">
            Aucun agent activé pour l’instant.
          </p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded border p-3">
              <div className="font-medium">{r.agent_slug}</div>
              <div className="text-sm text-muted-foreground">
                Statut: {r.status} —{" "}
                {new Date(r.started_at).toLocaleString("fr-FR")}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}




