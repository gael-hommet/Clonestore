"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Msg = { role: "user" | "assistant"; content: string };

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Pose tes questions sur CloneStore (Pierre, Clara, Emma, Alex, Noah). Je réponds uniquement avec ce qui est confirmé et j’indique quand c’est “en construction” ou “option”.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    setLastError(null);

    const nextMessages: Msg[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const payload = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        const detail =
          (payload && (payload.error || payload.detail)) || "Erreur serveur.";
        setLastError(typeof detail === "string" ? detail : "Erreur serveur.");
        setMessages([
          ...nextMessages,
          {
            role: "assistant",
            content: "Erreur. Réessaie dans un instant.",
          },
        ]);
        return;
      }

      const answer =
        (payload &&
          typeof payload.answer === "string" &&
          payload.answer.trim()) ||
        "Réponse vide du serveur. Vérifie /api/assistant.";

      setMessages([...nextMessages, { role: "assistant", content: answer }]);
    } catch {
      setLastError("Erreur réseau.");
      setMessages([
        ...nextMessages,
        { role: "assistant", content: "Erreur réseau. Réessaie." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setLastError(null);
    setInput("");
    setLoading(false);
    setMessages([
      {
        role: "assistant",
        content:
          "Ok. Repartons de zéro : pose ta question sur CloneStore et je te réponds uniquement avec du confirmé.",
      },
    ]);
  }

  return (
    <main className="mx-auto max-w-3xl py-10 px-4 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Questions</h1>
        <p className="text-sm text-muted-foreground">
          Assistant CloneStore avant achat. Réponses basées sur les capacités confirmées.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild variant="outline">
            <Link href="/agents">Boutique</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile/agents">Voir Mes Clones</Link>
          </Button>
          <Button asChild>
            <Link href="/paiement">Paiement</Link>
          </Button>
          <Button variant="outline" onClick={clearChat}>
            Effacer
          </Button>
        </div>
      </header>

      <section className="rounded-xl border p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => setInput("Quels sont les clones disponibles sur CloneStore ?")}
          >
            Clones disponibles
          </button>

          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => setInput("Quelle est la différence entre Pierre, Clara, Emma, Alex et Noah ?")}
          >
            Différences
          </button>

          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => setInput("Quel clone choisir selon mon besoin ?")}
          >
            Quel clone choisir ?
          </button>

          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => setInput("Comment fonctionne CloneOS / Router et la collaboration entre clones ?")}
          >
            CloneOS / Router
          </button>

          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => setInput("Comment marche l’email pro via DNS (ex: pierre@monentreprise.com) ?")}
          >
            Email via DNS
          </button>

          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => setInput("Comment fonctionne l’accès après paiement ?")}
          >
            Accès après paiement
          </button>
        </div>

        <div className="rounded-lg border bg-background p-3 space-y-3">
          <div
            ref={listRef}
            className="max-h-[380px] overflow-y-auto space-y-3 pr-1"
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed border ${
                    m.role === "user" ? "bg-muted" : "bg-background"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm border bg-background text-muted-foreground">
                  Réponse en cours…
                </div>
              </div>
            ) : null}
          </div>

          {lastError ? (
            <div className="rounded-md border p-2 text-xs text-red-600">
              {lastError}
            </div>
          ) : null}

          <div className="flex gap-2">
            <textarea
              className="w-full min-h-[42px] max-h-[120px] resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none"
              placeholder="Écris ta question… (Entrée = envoyer, Shift+Entrée = nouvelle ligne)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button onClick={() => send()} disabled={loading}>
              {loading ? "…" : "Envoyer"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}



