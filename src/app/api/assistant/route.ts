import { NextRequest, NextResponse } from "next/server";
import { AGENTS } from "@/lib/agent-catalog";

type IncomingMsg = { role: "user" | "assistant" | "system"; content: string };

function buildCatalogText() {
  return (Array.isArray(AGENTS) ? AGENTS : [])
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
}

function sanitizeMessages(messages: IncomingMsg[]) {
  return messages
    .filter((m) => m && typeof m.content === "string" && typeof m.role === "string")
    .map((m) => ({
      role: m.role === "user" || m.role === "assistant" || m.role === "system" ? m.role : "user",
      content: String(m.content).slice(0, 4000),
    }))
    .slice(-20); // évite payloads énormes
}

function extractTextFromResponsesAPI(data: any): string {
  // Responses API returns { output: [ { content: [ { type: "output_text", text: "..." } ] } ] }
  const out = data?.output;
  if (!Array.isArray(out)) return "";

  let text = "";
  for (const item of out) {
    const content = item?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c?.type === "output_text" && typeof c?.text === "string") {
        text += c.text;
      }
    }
  }
  return text.trim();
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY manquante (vérifie Vercel + .env.local)" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const messages = body?.messages as IncomingMsg[] | undefined;

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages[] manquant" }, { status: 400 });
    }

    const safeMessages = sanitizeMessages(messages);

    const agentCatalogText = buildCatalogText();
    if (!agentCatalogText.trim()) {
      return NextResponse.json(
        { error: "Catalogue AGENTS vide. Vérifie /lib/agent-catalog.ts" },
        { status: 500 }
      );
    }

    const systemPrompt = [
      "Tu es l'assistant commercial officiel du site CloneStore (avant achat).",
      "Objectif : aider le visiteur à choisir le bon clone et comprendre le fonctionnement.",
      "",
      "RÈGLES STRICTES :",
      "- Tu utilises en priorité le CATALOGUE fourni (source de vérité).",
      "- Tu n'inventes jamais de capacités, prix, intégrations ou disponibilités.",
      "- Si une info n'est pas dans le catalogue : réponds 'Non confirmé' / 'Pas encore disponible' / 'Option selon configuration'.",
      "- Pas de conseil juridique formel.",
      "",
      "STYLE :",
      "- Français clair, court, pro.",
      "- Réponses structurées (titres courts + puces).",
      "- Termine TOUJOURS par 1 action : lien vers la fiche /agents/<slug> ou /paiement, ou /assistant si hésitation.",
      "",
      "CONNAISSANCES CLONESTORE (cadre général autorisé) :",
      "- CloneOS = l'architecture d'orchestration (Router) qui permet à des clones d'un même client de coopérer.",
      "- Des actions externes peuvent exister via automatisations/intégrations selon le setup (ex: envoi d'email, génération de documents, intégrations).",
      "- L'email d'agent au nom de l'entreprise via DNS est une option de configuration (si mentionné/activé).",
      "- Si l'utilisateur demande 'comment exactement' : explique le principe, et dis que les détails dépendent de la configuration.",
      "",
      "CATALOGUE (source de vérité) :",
      agentCatalogText,
    ].join("\n");

    // Convert messages to Responses API format
    // We keep the conversation, but system prompt stays as instruction.
    const input = safeMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role,
        content: [{ type: "input_text", text: m.content }],
      }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        instructions: systemPrompt,
        input,
      }),
    }).catch((e) => {
      throw e;
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Erreur OpenAI", detail: detail || "Aucun détail reçu" },
        { status: 500 }
      );
    }

    const data = await res.json();
    const answer = extractTextFromResponsesAPI(data) || "Je n’ai pas pu générer une réponse.";

    return NextResponse.json({ answer });
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? "Timeout API (OpenAI trop lent). Réessaie."
        : e?.message || "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


