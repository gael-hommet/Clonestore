"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

type PierreResponse = {
  document: {
    title: string;
    body: string;
    sections: { title: string; content: string }[];
  };
};

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("ENV Supabase manquante");
  }

  return createClient(url, key);
}

export default function PierreUsePage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rawNotes, setRawNotes] = useState("");
  const [result, setResult] = useState<PierreResponse | null>(null);
  const [busy, setBusy] = useState(false);

  // ✅ GATE ACCÈS
  useEffect(() => {
    async function gate() {
      let client;
      try {
        client = getClient();
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
        return;
      }

      const { data: userRes } = await client.auth.getUser();
      const user = userRes.user;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: order } = await client
        .from("orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("agent_slug", "pierre")
        .eq("status", "active")
        .maybeSingle();

      if (!order) {
        window.location.href = "/agents/pierre";
        return;
      }

      setAllowed(true);
      setLoading(false);
    }

    gate();
  }, []);

  async function generate() {
    setError(null);
    setResult(null);

    if (!rawNotes.trim()) {
      setError("Ajoute un brief.");
      return;
    }

    let client;
    try {
      client = getClient();
    } catch (e: any) {
      setError(e.message);
      return;
    }

    setBusy(true);

    const { data: sessionRes } = await client.auth.getSession();
    const token = sessionRes.session?.access_token;

    if (!token) {
      setError("Session invalide.");
      setBusy(false);
      return;
    }

    const res = await fetch("/api/pierre/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ raw_notes: rawNotes }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(json.error || "Erreur génération.");
      setBusy(false);
      return;
    }

    setResult(json.data);
    setBusy(false);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl py-12 px-4">
        <p>Vérification de l’accès…</p>
        {error && <p className="text-red-600">{error}</p>}
      </main>
    );
  }

  if (!allowed) return null;

  return (
    <main className="mx-auto max-w-3xl py-12 px-4 space-y-6">
      <h1 className="text-2xl font-semibold">Utiliser Pierre</h1>

      <textarea
        className="w-full min-h-[140px] border rounded-md p-3"
        placeholder="Ton brief…"
        value={rawNotes}
        onChange={(e) => setRawNotes(e.target.value)}
      />

      {error && <p className="text-red-600">{error}</p>}

      <Button onClick={generate} disabled={busy}>
        {busy ? "Génération…" : "Générer"}
      </Button>

      {result && (
        <pre className="whitespace-pre-wrap border rounded-md p-4">
          {result.document.body}
        </pre>
      )}

      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href="/agents/pierre">Retour Pierre</Link>
        </Button>
      </div>
    </main>
  );
}




