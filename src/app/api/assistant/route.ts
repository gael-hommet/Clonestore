import { NextRequest, NextResponse } from "next/server";
import { AGENTS } from "@/lib/agent-catalog";

type IncomingMsg = { role: "user" | "assistant" | "system"; content: string };

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY manquante (vérifie .env.local)" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const messages = body?.messages as IncomingMsg[] | undefined;

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages[] manquant" }, { status: 400 });
    }

    // ✅ Nettoyage minimal : on garde uniquement role/content valides
    const safeMessages = messages
      .filter((m) => m && typeof m.content === "string" && typeof m.role === "string")
      .map((m) => ({
        role: m.role === "user" || m.role === "assistant" || m.role === "system" ? m.role : "user",
        content: String(m.content),
      }));

    // ✅ Catalogue rendu robuste
    const agentCatalogText = (Array.isArray(AGENTS) ? AGENTS : [])
      .map((a) =>
        [
          `Agent: ${a.name} (${a.slug})`,
          `Rôle: ${a.role}`,
          `Pour: ${(a.forWho || []).join(", ")}`,
          `Fait: ${(a.does || []).join(" | ")}`,
          `Ne fait pas: ${(a.doesNot || []).join(" | ")}`,
          `Exemples: ${(a.examples || []).join(" | ")}`,
          a.pricingNote ? `Prix: ${a.pricingNote}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      )
      .join("\n\n---\n\n");

    if (!agentCatalogText.trim()) {
      return NextResponse.json(
        { error: "Catalogue AGENTS vide ou introuvable. Vérifie /lib/agent-catalog.ts" },
        { status: 500 }
      );
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: [
              "Tu es l'assistant commercial officiel du site CloneStore.",
              "Tu réponds aux questions avant achat sur les clones. Tu n'inventes jamais.",
              "Règles:",
              "- Utilise uniquement le catalogue fourni. Si info absente: dis que ce n'est pas confirmé/disponible.",
              "- Reste clair, simple, professionnel. Pas de conseil juridique formel.",
              "- Pierre = rédaction/structuration RH. Clara = analyse/scoring CV.",
              "- Termine par une action: recommander la fiche (/agents/<slug>) ou le paiement (/paiement).",
              "",
              "Catalogue (source de vérité):\n" + agentCatalogText,
            ].join("\n"),
          },
          ...safeMessages,
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Erreur OpenAI",
          detail: detail || "Aucun détail reçu",
        },
        { status: 500 }
      );
    }

    const data = await res.json();
    const answer = data?.choices?.[0]?.message?.content ?? "Je n’ai pas pu générer une réponse.";

    return NextResponse.json({ answer });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 });
  }
}


