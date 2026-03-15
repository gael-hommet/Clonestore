import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { AGENTS } from "@/lib/agent-catalog";
import {
  DEFAULT_ASSISTANT_CONTEXT,
  buildAccountSnapshot,
  buildDeterministicAnswer,
  buildFallbackAnswer,
  buildKnowledgeContext,
  buildKnowledgeDigest,
  buildRelevantKnowledge,
  buildSuggestedLinks,
  buildSuggestedStatusCards,
  classifyIntent,
  getAssistantQuickAsks,
  getAssistantWelcome,
  type AssistantAccountContext,
  type AssistantIntent,
} from "@/lib/assistant/knowledge";

type IncomingMsg = {
  role: "user" | "assistant" | "system";
  content: string;
};

type OnboardingRow = {
  company_name?: string | null;
  contact_first_name?: string | null;
  contact_job_title?: string | null;
  usual_tone?: string | null;
  preferred_language?: string | null;
  sender_mode?: string | null;
  sender_status?: string | null;
  domain_status?: string | null;
  sender_email_requested?: string | null;
  sender_email_effective?: string | null;
  reply_to_email?: string | null;
  onboarding_completed?: boolean | null;
};

type RouteAnswer = {
  answer: string;
  source: string;
  hints?: string[];
  quickAsks?: string[];
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function makeServerSupabase(): SupabaseClient {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRole) {
    throw new Error("Supabase serveur non configuré.");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice("Bearer ".length).trim();
}

async function getAuthenticatedUser(
  req: NextRequest,
  supabase: SupabaseClient
): Promise<{ error: string | null; user: User | null }> {
  const token = getBearerToken(req);
  if (!token) {
    return { error: null, user: null };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: error?.message || "Utilisateur non authentifié.", user: null };
  }

  return { error: null, user: data.user };
}

async function hasPierreAccess(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("id,status")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, has: false };
  }

  return { ok: true, error: null, has: Boolean(data) };
}

async function getPierreOnboarding(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("agent_onboarding_pierre")
    .select(
      [
        "company_name",
        "contact_first_name",
        "contact_job_title",
        "usual_tone",
        "preferred_language",
        "sender_mode",
        "sender_status",
        "domain_status",
        "sender_email_requested",
        "sender_email_effective",
        "reply_to_email",
        "onboarding_completed",
      ].join(",")
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, row: null as OnboardingRow | null };
  }

  return { ok: true, error: null, row: (data as OnboardingRow | null) || null };
}

function buildContextFromData(params: {
  user: User | null;
  hasAccess: boolean;
  onboarding: OnboardingRow | null;
}): AssistantAccountContext {
  const { user, hasAccess, onboarding } = params;

  return {
    isAuthenticated: Boolean(user),
    hasPierreAccess: hasAccess,
    onboardingCompleted: onboarding?.onboarding_completed === true,
    companyName: typeof onboarding?.company_name === "string" ? onboarding.company_name : "",
    contactFirstName:
      typeof onboarding?.contact_first_name === "string" ? onboarding.contact_first_name : "",
    contactJobTitle:
      typeof onboarding?.contact_job_title === "string" ? onboarding.contact_job_title : "",
    usualTone: typeof onboarding?.usual_tone === "string" ? onboarding.usual_tone : "",
    preferredLanguage:
      typeof onboarding?.preferred_language === "string" ? onboarding.preferred_language : "fr",
    senderMode: typeof onboarding?.sender_mode === "string" ? onboarding.sender_mode : "",
    senderStatus: typeof onboarding?.sender_status === "string" ? onboarding.sender_status : "",
    domainStatus: typeof onboarding?.domain_status === "string" ? onboarding.domain_status : "",
    senderEmailRequested:
      typeof onboarding?.sender_email_requested === "string" ? onboarding.sender_email_requested : "",
    senderEmailEffective:
      typeof onboarding?.sender_email_effective === "string" ? onboarding.sender_email_effective : "",
    replyToEmail: typeof onboarding?.reply_to_email === "string" ? onboarding.reply_to_email : "",
  };
}

async function buildAccountContext(req: NextRequest, supabase: SupabaseClient) {
  const auth = await getAuthenticatedUser(req, supabase);
  if (auth.error) {
    return {
      context: DEFAULT_ASSISTANT_CONTEXT,
      warning: auth.error,
    };
  }

  if (!auth.user) {
    return {
      context: DEFAULT_ASSISTANT_CONTEXT,
      warning: null,
    };
  }

  const access = await hasPierreAccess(supabase, auth.user.id);
  if (!access.ok) {
    return {
      context: buildContextFromData({ user: auth.user, hasAccess: false, onboarding: null }),
      warning: access.error,
    };
  }

  const onboarding = await getPierreOnboarding(supabase, auth.user.id);
  if (!onboarding.ok) {
    return {
      context: buildContextFromData({ user: auth.user, hasAccess: access.has, onboarding: null }),
      warning: onboarding.error,
    };
  }

  return {
    context: buildContextFromData({
      user: auth.user,
      hasAccess: access.has,
      onboarding: onboarding.row,
    }),
    warning: null,
  };
}

function normalizeMessages(messages: IncomingMsg[] | undefined) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(Boolean)
    .map((msg) => ({
      role:
        msg.role === "assistant" || msg.role === "system" || msg.role === "user"
          ? msg.role
          : "user",
      content: typeof msg.content === "string" ? msg.content.slice(0, 5000) : "",
    }))
    .filter((msg) => msg.content.trim().length > 0)
    .slice(-18);
}

function findLastUserMessage(messages: { role: string; content: string }[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") {
      return messages[i].content.trim();
    }
  }
  return "";
}

function buildRecentConversation(messages: { role: string; content: string }[]) {
  return messages
    .slice(-8)
    .map((msg) => `${msg.role === "user" ? "USER" : "ASSISTANT"}: ${msg.content}`)
    .join("\n\n");
}

function buildAgentCatalogDigest() {
  const catalog = Array.isArray(AGENTS) ? AGENTS : [];
  return catalog
    .map((agent) => {
      return [
        `Agent: ${agent.name} (${agent.slug})`,
        `Role: ${agent.role}`,
        `For: ${(agent.forWho || []).join(", ")}`,
        `Does: ${(agent.does || []).join(" | ")}`,
        `Does not: ${(agent.doesNot || []).join(" | ")}`,
        `Examples: ${(agent.examples || []).join(" | ")}`,
        agent.pricingNote ? `Pricing: ${agent.pricingNote}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

function buildSystemPrompt(params: {
  context: AssistantAccountContext;
  intent: AssistantIntent;
  userQuestion: string;
  recentConversation: string;
  relevantKnowledge: string;
}) {
  const accountSnapshot = buildAccountSnapshot(params.context);
  const catalogDigest = buildAgentCatalogDigest();
  const knowledgeContext = buildKnowledgeContext();

  return [
    "Tu es l'assistant produit officiel CloneStore pour le front du site.",
    "Tu réponds comme un assistant premium, direct, crédible et vraiment utile.",
    "Tu n'écris jamais de réponse scolaire en 5 parties.",
    "Tu préfères 1 à 3 paragraphes courts, ou une mini-liste seulement si elle aide vraiment.",
    "Quand le meilleur choix est clair, tu choisis franchement.",
    "Tu ne survends jamais un clone qui n'est pas réellement prêt.",
    "Si une information n'est pas confirmée, tu le dis clairement.",
    "Tu peux parler de Pierre en profondeur : formulaire 1, page use, modification du contenu, email, PDF, fallback CloneStore, domaine vérifié, identité d'envoi.",
    "Tu peux aussi répondre sur le positionnement général des clones, mais tu restes honnête sur leur état réel.",
    "Tu ne parles pas d'implémentation interne non nécessaire, sauf si l'utilisateur pose explicitement la question.",
    "Tu ne mets pas de markdown décoratif inutile.",
    "Tu ne réponds pas avec des titres numérotés scolaires.",
    "Tu n'utilises pas la formule 'voici en 5 points'.",
    "Si l'utilisateur demande quoi faire maintenant, ta réponse doit finir par le prochain meilleur pas concret.",
    "Si l'utilisateur demande quel clone choisir aujourd'hui, Pierre est le choix de référence si l'objectif est d'avoir quelque chose d'utile maintenant.",
    "Clara, Alex, Emma et Noah ne doivent pas être présentés comme pleinement prêts tant que l'information ne l'affirme pas clairement.",
    "Réponds en français.",
    "",
    `Intent détecté: ${params.intent}`,
    `Question actuelle: ${params.userQuestion}`,
    "",
    "ÉTAT COMPTE / PIERRE:",
    accountSnapshot,
    "",
    "CONNAISSANCE PRODUIT COMPLÈTE:",
    knowledgeContext,
    "",
    "CONNAISSANCE LA PLUS PERTINENTE POUR CETTE QUESTION:",
    params.relevantKnowledge || buildKnowledgeDigest(params.userQuestion),
    "",
    "CATALOGUE AGENTS:",
    catalogDigest,
    "",
    "MÉMOIRE CONVERSATION RÉCENTE:",
    params.recentConversation || "Aucune mémoire récente utile.",
    "",
    "STYLE FINAL ATTENDU:",
    "- humain",
    "- premium",
    "- direct",
    "- sans blabla marketing vide",
    "- sans réponse robotique",
    "- sans structure scolaire",
    "- avec une vraie recommandation si nécessaire",
  ].join("\n");
}

function buildHintsForIntent(intent: AssistantIntent, context: AssistantAccountContext) {
  if (intent === "post_payment") {
    if (context.hasPierreAccess && !context.onboardingCompleted) {
      return [
        "Explique-moi le formulaire 1 simplement.",
        "Quelles parties du formulaire 1 comptent le plus ?",
        "Ensuite je vais où ?",
      ];
    }

    return [
      "À quoi sert le formulaire 1 ?",
      "Comment fonctionne Pierre au quotidien ?",
      "Comment se passe l'accès après paiement ?",
    ];
  }

  if (intent === "onboarding") {
    return [
      "Quelles parties du formulaire 1 sont les plus importantes ?",
      "Comment remplir le bloc email sans me tromper ?",
      "Quand est-ce que Pierre devient vraiment utile ?",
    ];
  }

  if (intent === "use_page") {
    return [
      "Comment modifier puis envoyer un email depuis Pierre ?",
      "Comment fonctionne le PDF si j'ai modifié le contenu ?",
      "À quoi sert l'historique ?",
    ];
  }

  if (intent === "email_identity") {
    return [
      "Le fallback CloneStore, ça change quoi pour moi ?",
      "Quand est-ce qu'on bascule vers pierre@entreprise.com ?",
      "Le reply-to sert à quoi ?",
    ];
  }

  if (intent === "clone_choice") {
    return [
      "Pourquoi tu me conseilles Pierre aujourd'hui ?",
      "Clara est-elle vraiment prête ?",
      "Pierre peut faire quoi exactement ?",
    ];
  }

  return getAssistantQuickAsks(context).slice(0, 4);
}

function enrichDeterministicAnswer(
  answer: string,
  intent: AssistantIntent,
  context: AssistantAccountContext
): RouteAnswer {
  return {
    answer,
    source: `deterministic:${intent}`,
    hints: buildHintsForIntent(intent, context),
    quickAsks: getAssistantQuickAsks(context),
  };
}

function fallbackRouteAnswer(
  question: string,
  intent: AssistantIntent,
  context: AssistantAccountContext,
  source: string
): RouteAnswer {
  return {
    answer: buildFallbackAnswer(question, context, intent),
    source,
    hints: buildHintsForIntent(intent, context),
    quickAsks: getAssistantQuickAsks(context),
  };
}

async function callOpenAIChat(systemPrompt: string, messages: { role: string; content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY manquante.");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.ASSISTANT_MODEL || "gpt-4.1-mini",
      temperature: 0.4,
      max_tokens: 900,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `OpenAI error ${res.status}`);
  }

  const data = (await res.json().catch(() => null)) as
    | {
        choices?: Array<{ message?: { content?: string } }>;
      }
    | null;

  return data?.choices?.[0]?.message?.content?.trim() || "";
}

export async function GET(req: NextRequest) {
  let supabase: SupabaseClient;

  try {
    supabase = makeServerSupabase();
  } catch (error: unknown) {
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Configuration serveur invalide.",
    });
  }

  const { context, warning } = await buildAccountContext(req, supabase);

  return json(200, {
    ok: true,
    context,
    welcome: getAssistantWelcome(context),
    quickAsks: getAssistantQuickAsks(context),
    statusCards: buildSuggestedStatusCards(context),
    linkCards: buildSuggestedLinks(context),
    focusTopics: [
      "Pierre",
      "Formulaire 1",
      "Page use",
      "Email",
      "PDF",
      "DNS",
      "Fallback",
      "Historique",
    ],
    warning,
  });
}

export async function POST(req: NextRequest) {
  let supabase: SupabaseClient;

  try {
    supabase = makeServerSupabase();
  } catch (error: unknown) {
    return json(500, {
      error: error instanceof Error ? error.message : "Configuration serveur invalide.",
    });
  }

  const { context } = await buildAccountContext(req, supabase);

  let body: { messages?: IncomingMsg[] };
  try {
    body = (await req.json()) as { messages?: IncomingMsg[] };
  } catch {
    return json(400, { error: "Body JSON invalide." });
  }

  const safeMessages = normalizeMessages(body?.messages);
  if (!safeMessages.length) {
    return json(400, { error: "messages[] manquant." });
  }

  const userQuestion = findLastUserMessage(safeMessages);
  if (!userQuestion) {
    return json(400, { error: "Question utilisateur introuvable." });
  }

  const intent = classifyIntent(userQuestion);

  const deterministic = buildDeterministicAnswer(userQuestion, context, intent);
  if (deterministic) {
    return json(200, enrichDeterministicAnswer(deterministic, intent, context));
  }

  const recentConversation = buildRecentConversation(safeMessages);
  const relevantKnowledge = buildRelevantKnowledge(userQuestion, intent, context);
  const systemPrompt = buildSystemPrompt({
    context,
    intent,
    userQuestion,
    recentConversation,
    relevantKnowledge,
  });

  try {
    const answer = await callOpenAIChat(systemPrompt, safeMessages);
    if (!answer) {
      const fallback = fallbackRouteAnswer(
        userQuestion,
        intent,
        context,
        "fallback-empty-answer"
      );
      return json(200, fallback);
    }

    return json(200, {
      answer,
      source: `llm:${intent}`,
      hints: buildHintsForIntent(intent, context),
      quickAsks: getAssistantQuickAsks(context),
    });
  } catch (error: unknown) {
    const fallback = fallbackRouteAnswer(
      userQuestion,
      intent,
      context,
      "fallback-openai-error"
    );

    return json(200, {
      ...fallback,
      detail: error instanceof Error ? error.message : "Erreur OpenAI",
    });
  }
}
