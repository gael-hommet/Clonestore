"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

function makeSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase env manquante (URL/ANON)");
  return createClient(url, anon);
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v : "";
}

export default function PierreUsePage() {
  const router = useRouter();
  const supabase = useMemo(() => makeSupabase(), []);

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const [rawNotes, setRawNotes] = useState("");
  const [tone, setTone] = useState<"pro" | "convivial">("pro");
  const [language, setLanguage] = useState<"fr" | "en">("fr");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PierreResponse | null>(null);

  const [copyOk, setCopyOk] = useState(false);

  async function checkAccessOnce() {
    setGateError(null);
    setChecking(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setAllowed(false);
      setChecking(false);
      setGateError(userErr.message);
      return;
    }

    const user = userRes.user;
    if (!user) {
      setAllowed(false);
      setChecking(false);
      router.push("/login");
      return;
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("agent_slug", "pierre")
      .eq("status", "active")
      .maybeSingle();

    if (orderErr) {
      setAllowed(false);
      setChecking(false);
      setGateError(orderErr.message);
      return;
    }

    if (!order) {
      setAllowed(false);
      setChecking(false);
      return;
    }

    setAllowed(true);
    setChecking(false);
  }

  useEffect(() => {
    checkAccessOnce();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      checkAccessOnce();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setError(null);
    setResult(null);
    setCopyOk(false);

    if (!allowed) {
      setError("Accès refusé : Pierre n’est pas actif sur ce compte.");
      return;
    }

    const notes = rawNotes.trim();
    if (!notes) {
      setError("Ajoute un brief pour lancer la génération.");
      return;
    }

    setBusy(true);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes.session?.access_token;

      if (!token) {
        setError("Session manquante. Reconnecte-toi.");
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

      const payload: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          typeof (payload as { error?: unknown })?.error === "string"
            ? (payload as { error: string }).error
            : "Erreur génération.";
        setError(msg);
        setBusy(false);
        return;
      }

      const data = (payload as { data?: PierreResponse }).data ?? null;
      if (!data) {
        setError("Réponse vide.");
        setBusy(false);
        return;
      }

      setResult(data);
      setBusy(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
      setBusy(false);
    }
  }

  function buildCopyText(r: PierreResponse) {
    const title = safeStr(r.document?.title);
    const body = safeStr(r.document?.body);
    const sections = Array.isArray(r.document?.sections) ? r.document.sections : [];

    const parts: string[] = [];
    if (title) parts.push(title);
    if (body) parts.push("", body);

    if (sections.length) {
      parts.push("", "—");
      for (const s of sections) {
        parts.push("", safeStr(s.title));
        parts.push(safeStr(s.content));
      }
    }

    return parts.join("\n");
  }

  async function copyDocument() {
    if (!result) return;
    try {
      const text = buildCopyText(result);
      await navigator.clipboard.writeText(text);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1500);
    } catch {
      setError("Impossible de copier automatiquement. Copie manuellement le texte.");
    }
  }

  // Checking
  if (checking) {
    return (
      <main className="mx-auto max-w-3xl py-12 px-4 space-y-3">
        <p className="text-sm text-muted-foreground">Vérification de l’accès…</p>
        {gateError && <p className="text-sm text-red-600">{gateError}</p>}
      </main>
    );
  }

  // Denied
  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl py-12 px-4 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Accès indisponible</h1>
          <p className="text-sm text-muted-foreground">
            Pierre n’est pas actif sur ce compte.
          </p>
        </header>

        {gateError && (
          <div className="rounded-2xl border p-4">
            <p className="text-sm text-red-600">{gateError}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="/paiement?agent=pierre">Activer Pierre</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agents/pierre">Voir la fiche</Link>
          </Button>
          <Button variant="outline" onClick={checkAccessOnce}>
            Rafraîchir
          </Button>
        </div>
      </main>
    );
  }

  // Allowed
  return (
    <main className="mx-auto max-w-3xl py-12 px-4 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pierre — Rédaction RH</h1>
        <p className="text-sm text-muted-foreground">
          Décris la situation en langage naturel. Pierre renvoie un document RH structuré, prêt à être utilisé.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/agents/pierre">Fiche Pierre</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile/agents">Mes agents</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/questions">Support</Link>
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
              onChange={(e) => setLanguage(e.target.value as "fr" | "en")}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Ton</p>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={tone}
              onChange={(e) => setTone(e.target.value as "pro" | "convivial")}
            >
              <option value="pro">Professionnel</option>
              <option value="convivial">Convivial</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Brief</p>
          <textarea
            className="min-h-[160px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none"
            placeholder="Ex : Rédige un mail de refus candidat poli (dev front), en précisant qu’on garde son profil en shortlist."
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Astuce : donne le contexte (poste, raison, ton souhaité, points à inclure).
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={busy}>
            {busy ? "Génération…" : "Générer"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setRawNotes("");
              setError(null);
              setResult(null);
              setCopyOk(false);
            }}
            disabled={busy}
          >
            Réinitialiser
          </Button>
        </div>
      </section>

      {result && (
        <section className="rounded-2xl border p-6 space-y-5">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Document</p>
              <h2 className="text-xl font-semibold tracking-tight">
                {safeStr(result.document?.title) || "Sans titre"}
              </h2>
              {result.meta?.estimated_read_time_minutes ? (
                <p className="text-xs text-muted-foreground">
                  Lecture estimée : {result.meta.estimated_read_time_minutes} min
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copyDocument}>
                {copyOk ? "Copié ✅" : "Copier"}
              </Button>
            </div>
          </header>

          {result.summary ? (
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">{safeStr(result.summary)}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Contenu</p>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">
              {safeStr(result.document?.body)}
            </pre>
          </div>

          {Array.isArray(result.document?.sections) && result.document.sections.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Sections</p>
              <div className="space-y-3">
                {result.document.sections.map((s, idx) => (
                  <div key={idx} className="rounded-xl border p-4 space-y-2">
                    <p className="font-medium">{safeStr(s.title) || `Section ${idx + 1}`}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {safeStr(s.content)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(Array.isArray(result.checks) && result.checks.length > 0) ||
          (Array.isArray(result.next_actions) && result.next_actions.length > 0) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.isArray(result.checks) && result.checks.length > 0 ? (
                <div className="rounded-xl border p-4 space-y-2">
                  <p className="text-sm font-medium">Points vérifiés</p>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    {result.checks.map((c, i) => (
                      <li key={i}>{safeStr(c)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {Array.isArray(result.next_actions) && result.next_actions.length > 0 ? (
                <div className="rounded-xl border p-4 space-y-2">
                  <p className="text-sm font-medium">Prochaines actions</p>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    {result.next_actions.map((n, i) => (
                      <li key={i}>{safeStr(n)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}




