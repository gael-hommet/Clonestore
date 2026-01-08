import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY manquante" }, { status: 500 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
    }

    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Non autorisé (token manquant)" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const raw_notes = (body?.raw_notes || "").trim();
    const tone = (body?.tone || "pro").trim();
    const language = (body?.language || "fr").trim();

    if (!raw_notes) {
      return NextResponse.json({ error: "raw_notes manquant" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1) Identifier le user à partir du token Supabase (anti-triche)
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const user_id = userRes.user.id;

    // 2) Vérifier qu’il possède Pierre (orders actif)
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id,status")
      .eq("user_id", user_id)
      .eq("agent_slug", "pierre")
      .eq("status", "active")
      .maybeSingle();

    if (orderErr) {
      return NextResponse.json({ error: orderErr.message }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ error: "Accès refusé: Pierre non actif" }, { status: 403 });
    }

    // 3) Prompt Pierre (JSON strict)
    const system = `
Tu es Pierre, l'agent RH de CloneStore.

RÔLE :
- Tu rédiges et structures des documents RH pour des PME / TPE / startups.
- Tu ne fais PAS d'analyse de CV ni de scoring.
- Tu produis des textes prêts à l'emploi : annonces, mails RH, comptes-rendus, fiches de poste, scripts d'entretien, plans d'onboarding.

CONTRAINTES :
- Tu dois TOUJOURS répondre en JSON STRICT.
- Tu ne dois JAMAIS ajouter de texte en dehors du JSON.
- La structure du JSON doit être EXACTEMENT la suivante :

{
  "status": "success",
  "kind": "RH_DOCUMENT",
  "task": "...",
  "document": {
    "title": "...",
    "body": "...",
    "sections": [
      { "title": "...", "content": "..." }
    ]
  },
  "summary": "...",
  "checks": ["..."],
  "next_actions": ["..."],
  "meta": {
    "language": "fr",
    "tone": "pro",
    "estimated_read_time_minutes": 1
  }
}

RÈGLES :
- "status" = "success" sauf demande illégale/impossible (alors "error" et document.body explique).
- "task" doit être un mot simple : "job_offer", "rejection_email", "onboarding_plan", etc.
- Pas de promesses légales/juridiques.
- Langage clair, phrases courtes, pas de corporate bullshit.
`.trim();

    const userPayload = {
      mode: "free",
      language,
      tone,
      raw_notes,
    };

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
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json({ error: "Erreur OpenAI", detail }, { status: 500 });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "Réponse vide" }, { status: 500 });
    }

    // On parse pour garantir que c'est bien du JSON strict
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Réponse OpenAI non JSON strict", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data: parsed });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 });
  }
}
