import { NextRequest, NextResponse } from "next/server";
import { AGENTS } from "@/lib/agent-catalog";

type IncomingMsg = { role: "user" | "assistant" | "system"; content: string };

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY manquante" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const messages = body?.messages as IncomingMsg[] | undefined;

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages[] manquant" }, { status: 400 });
    }

    // ✅ nettoyage strict des messages
    const safeMessages = messages
      .filter((m) => m && typeof m.content === "string")
      .map((m) => ({
        role:
          m.role === "user" || m.role === "assistant" || m.role === "system"
            ? m.role
            : "user",
        content: String(m.content).slice(0, 4000),
      }));

    // ✅ catalogue texte (source de vérité)
    const catalog = (Array.isArray(AGENTS) ? AGENTS : [])
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

    // ✅ PROMPT SYSTÈME FINAL (équilibré conversion + crédibilité)
    const systemPrompt = [
      "Tu es le conseiller officiel CloneStore.",
      "Tu aides les entreprises à choisir le bon clone IA.",
      "",
      "OBJECTIF:",
      "- Comprendre le besoin rapidement",
      "- Recommander le clone le plus adapté",
      "- Rester clair, crédible et professionnel",
      "",
      "STYLE:",
      "- Ton professionnel et direct",
      "- Pas de blabla marketing vide",
      "- Réponses structurées",
      "",
      "STRUCTURE DE RÉPONSE:",
      "1) Diagnostic rapide",
      "2) Recommandation claire",
      "3) Pourquoi (max 3 points)",
      "4) Prochain pas (fiche ou paiement)",
      "",
      "RÈGLES STRICTES:",
      "- Source unique = catalogue",
      "- Si info absente → dire 'non confirmé' ou 'en construction'",
      "- Ne jamais inventer",
      "- Pas de conseil juridique",
      "",
      "POSITIONNEMENT:",
      "- Pierre = rédaction RH & structuration",
      "- Clara = analyse massive de CV",
      "- Emma = support client & emails",
      "- Alex = assistant commercial",
      "- Noah = assistant de direction premium",
      "",
      "Catalogue:\n" + catalog,
    ].join("\n");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.25, // ✅ stable mais intelligent
        messages: [
          { role: "system", content: systemPrompt },
          ...safeMessages,
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Erreur OpenAI", detail },
        { status: 500 }
      );
    }

    const data = await res.json();
    const answer =
      data?.choices?.[0]?.message?.content ??
      "Je n’ai pas pu générer une réponse.";

    return NextResponse.json({ answer });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
