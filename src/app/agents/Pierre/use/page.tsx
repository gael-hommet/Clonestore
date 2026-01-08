"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

type PierreResponse = {
  status: string;
  kind: string;
  task: string;
  document: {
    title: string;
    body: string;
    sections: { title: string; content: string }[];
  };
  summary: string;
  checks: string[];
  next_actions: string[];
  meta: { language: string; tone: string; estimated_read_time_minutes: number };
};

export default function PierreUsePage() {
  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [rawNotes, setRawNotes] = useState("");
  const [tone, setTone] = useState("pro");
  const [language, setLanguage] = useState("fr");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PierreResponse | null>(null);

  useEffect(() => {
    async function gate() {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: order } = await supabase
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
  }, [supabase]);

  async function generate() {
    setError(null);
    setResult(null);

    const notes = rawNotes.trim();
    if (!notes) {
      setError("Ajoute un brief.");
      return;
    }

    setBusy(true);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes.session?.access_token;
      if (!token) {
        setError("Tu dois être connecté.");
        setBusy(false);
        return;
      }

      const res = await fetch("/api/pierre/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ raw_notes: notes, tone, language }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || "Erreur génération.");
        setBusy(false);
        return;
      }

      setResult(payload.data);
      setBusy(false);
    } catch (e: any) {
      setError(e?.message || "Erreur");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl py-12 px-4">
        <p className="text-sm text-muted-foreground">Vérification de l’accès…</p>
      </main>
    );
  }

  if (!allowed) return null;

  return (
    <main className="mx-auto max-w-3xl py-12 px-4 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Utiliser Pierre</h1>
        <p className="text-sm text-muted-foreground">
          Donne un brief brut. Pierre renvoie un document RH structuré, prêt à envoyer.
        </p>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/agents/pierre">Fiche Pierre</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile/agents">Mes agents</Link>
          </Button>
        </div>
      </header>

      <section className="rounded-2xl border p-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">Langue</p>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="fr">fr</option>
              <option value="en">en</option>
            </select>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Ton</p>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            >
              <option value="pro">pro</option>
              <option value="convivial">convivial</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Brief</p>
          <textarea
            className="min-h-[140px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none"
            placeholder="Ex: Écris un mail de refus candidat poli, développeur front, qu’on garde en shortlist."
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={generate} disabled={busy}>
          {busy ? "Génération…" : "Générer"}
        </Button>
      </section>

      {result && (
        <section className="rounded-2xl border p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Titre</p>
            <h2 className="text-xl font-semibold tracking-tight">{result.document?.title}</h2>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Document</p>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">
              {result.document?.body}
            </pre>
          </div>

          {Array.isArray(result.document?.sections) && result.document.sections.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Sections</p>
              <div className="space-y-3">
                {result.document.sections.map((s, idx) => (
                  <div key={idx} className="rounded-lg border p-4">
                    <p className="font-medium">{s.title}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

