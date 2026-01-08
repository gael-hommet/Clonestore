"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Msg = { role: "user" | "assistant"; content: string };

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Pose tes questions sur les agents CloneStore (Pierre, Clara). Je réponds uniquement avec ce qui est confirmé.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

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

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessages([
          ...nextMessages,
          { role: "assistant", content: "Erreur. Réessaie dans un instant." },
        ]);
        return;
      }

      setMessages([...nextMessages, { role: "assistant", content: payload.answer }]);
    } catch {
      setMessages([...nextMessages, { role: "assistant", content: "Erreur réseau. Réessaie." }]);
    } finally {
      setLoading(false);
    }
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
            <Link href="/profile/agents">Voir Mes Agents</Link>
          </Button>
          <Button asChild>
            <Link href="/paiement">Paiement</Link>
          </Button>
        </div>
      </header>

      <section className="rounded-xl border p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
  <button
    type="button"
    className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
    onClick={() => setInput("Quels sont les agents disponibles sur CloneStore ?")}
  >
    Agents disponibles
  </button>

  <button
    type="button"
    className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
    onClick={() =>
      setInput("Quelle est la différence entre les agents CloneStore ?")
    }
  >
    Différences entre agents
  </button>

  <button
    type="button"
    className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
    onClick={() =>
      setInput("Quel agent choisir selon mon besoin ?")
    }
  >
    Quel agent choisir ?
  </button>

  <button
    type="button"
    className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
    onClick={() =>
      setInput("Que peut faire un agent CloneStore et que ne fait-il pas ?")
    }
  >
    Capacités & limites
  </button>

  <button
    type="button"
    className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
    onClick={() =>
      setInput("Comment fonctionne l’accès après paiement ?")
    }
  >
    Accès après paiement
  </button>

  <button
    type="button"
    className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
    onClick={() =>
      setInput("Comment résilier ou changer d’agent ?")
    }
  >
    Résiliation / changement
  </button>
</div>


        <div className="flex gap-2">
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none"
            placeholder="Écris ta question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <Button onClick={() => send()} disabled={loading}>
            {loading ? "…" : "Envoyer"}
          </Button>
        </div>
      </section>
    </main>
  );
}



