"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Msg = { role: "user" | "assistant"; content: string };

export default function AssistantPage() {
  const starter: Msg[] = useMemo(
    () => [
      {
        role: "assistant",
        content:
          "Pose tes questions sur CloneStore (Pierre, Clara, Emma, Alex, Noah). Je réponds uniquement avec ce qui est confirmé et je tranche (je choisis pour toi).",
      },
    ],
    []
  );

  const [messages, setMessages] = useState<Msg[]>(starter);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function quickAsk(text: string) {
    setInput(text);
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    setServerError(null);

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

      const payload = (await res.json().catch(() => ({} as any))) as {
        answer?: string;
        error?: string;
        detail?: string;
      };

      if (!res.ok) {
        const msg = payload?.error || "Erreur serveur. Réessaie.";
        const detail = payload?.detail ? `\n\nDétail: ${payload.detail}` : "";
        setServerError(msg + detail);

        setMessages([
          ...nextMessages,
          { role: "assistant", content: "Erreur. Réessaie dans un instant." },
        ]);
        return;
      }

      const answer =
        (payload && typeof payload.answer === "string" && payload.answer.trim()) ||
        "Réponse vide du serveur. Vérifie /api/assistant.";

      setMessages([...nextMessages, { role: "assistant", content: answer }]);
    } catch {
      setServerError("Erreur réseau.");
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
          Assistant CloneStore avant achat. Réponses basées sur le catalogue officiel. Je tranche.
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
        </div>
      </header>

      <section className="rounded-xl border p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => quickAsk("J’hésite entre Pierre et Clara. Pose 2 questions max puis choisis pour moi.")}
          >
            Hésitation Pierre/Clara
          </button>

          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => quickAsk("Je veux gagner du temps sur la rédaction RH. Quel clone je prends ?")}
          >
            Gagner du temps RH
          </button>

          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => quickAsk("Je recrute et j’ai trop de CV. Quel clone je prends et pourquoi ?")}
          >
            Trop de CV
          </button>

          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => quickAsk("PME 5–20 salariés. Je veux un clone utile tout de suite. Tu me dis lequel prendre.")}
          >
            PME 5–20
          </button>

          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => quickAsk("Comment marche l’accès après paiement ? Réponse courte + étapes.")}
          >
            Accès après paiement
          </button>

          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => quickAsk("Je veux commencer simple, sans me prendre la tête. Tu me conseilles quoi ?")}
          >
            Commencer simple
          </button>

          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => quickAsk("CloneOS / Router : ça change quoi ? Réponse courte.")}
          >
            CloneOS / Router
          </button>

          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => quickAsk("Email via DNS : c’est quoi et à quoi ça sert ?")}
          >
            Email via DNS
          </button>
        </div>

        <div className="rounded-lg border bg-background p-3 space-y-3">
          <div className="max-h-[360px] overflow-y-auto space-y-3 pr-1">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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

          {serverError ? (
            <div className="rounded-lg border p-3 text-xs text-red-600 whitespace-pre-wrap">
              {serverError}
            </div>
          ) : null}

          <div className="flex gap-2">
            <textarea
              className="w-full min-h-[44px] max-h-[140px] resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none"
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



