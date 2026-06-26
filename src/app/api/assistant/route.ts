import { NextResponse } from "next/server";
import {
  DEFAULT_ASSISTANT_CONTEXT,
  buildFallbackAnswer,
  buildSuggestedLinks,
  buildSuggestedStatusCards,
  classifyIntent,
  getAssistantQuickAsks,
} from "@/lib/assistant/knowledge";
import type {
  AssistantAccountContext,
  AssistantRequestBody,
  AssistantResponseBody,
} from "@/lib/assistant/types";
import { isCloneChatEnabled } from "@/lib/features/product-availability";

// Blocage RÉEL de l'API CloneChat. Tant que le produit est désactivé, l'API
// répond 503 — l'expérience ne peut pas être utilisée via un appel direct,
// même en contournant l'interface.
function cloneChatDisabledResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "CloneChat n'est pas encore disponible.",
      code: "CLONECHAT_DISABLED",
    },
    { status: 503 },
  );
}

function normalizeContext(
  partial?: Partial<AssistantAccountContext> | null
): AssistantAccountContext {
  return {
    ...DEFAULT_ASSISTANT_CONTEXT,
    ...(partial ?? {}),
  };
}

function extractQuestion(body: AssistantRequestBody | null | undefined) {
  const raw =
    body?.message ??
    body?.input ??
    body?.query ??
    "";

  return typeof raw === "string" ? raw.trim() : "";
}

export async function POST(request: Request) {
  if (!isCloneChatEnabled()) {
    return cloneChatDisabledResponse();
  }

  try {
    const body = (await request.json().catch(() => null)) as AssistantRequestBody | null;
    const question = extractQuestion(body);

    if (!question) {
      return NextResponse.json<AssistantResponseBody>(
        {
          ok: false,
          answer: "Je n’ai reçu aucune question exploitable.",
          intent: "general",
          quickAsks: getAssistantQuickAsks(DEFAULT_ASSISTANT_CONTEXT),
          statusCards: buildSuggestedStatusCards(DEFAULT_ASSISTANT_CONTEXT),
          links: buildSuggestedLinks(DEFAULT_ASSISTANT_CONTEXT),
          supportScope:
            "CloneChat couvre déjà le support de compréhension et d’orientation produit. La couche screenshots/fichiers/bugs live viendra plus tard.",
        },
        { status: 400 }
      );
    }

    const context = normalizeContext(body?.context);
    const intent = classifyIntent(question);
    const answer = buildFallbackAnswer(question, context, intent);

    return NextResponse.json<AssistantResponseBody>({
      ok: true,
      answer,
      intent,
      quickAsks: getAssistantQuickAsks(context),
      statusCards: buildSuggestedStatusCards(context),
      links: buildSuggestedLinks(context),
      supportScope:
        "CloneChat connaît l’état produit actuel, les parcours, les pages, les rôles, les prix visibles, les limites et les usages déjà validés. La couche de diagnostic par captures/fichiers/bugs live sera ajoutée après stabilisation produit.",
    });
  } catch (error) {
    return NextResponse.json<AssistantResponseBody>(
      {
        ok: false,
        answer:
          error instanceof Error
            ? error.message
            : "Impossible de traiter la demande CloneChat pour le moment.",
        intent: "general",
        quickAsks: getAssistantQuickAsks(DEFAULT_ASSISTANT_CONTEXT),
        statusCards: buildSuggestedStatusCards(DEFAULT_ASSISTANT_CONTEXT),
        links: buildSuggestedLinks(DEFAULT_ASSISTANT_CONTEXT),
        supportScope:
          "CloneChat couvre déjà le support de compréhension et d’orientation produit. La couche screenshots/fichiers/bugs live viendra plus tard.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (!isCloneChatEnabled()) {
    return cloneChatDisabledResponse();
  }

  return NextResponse.json({
    ok: true,
    name: "CloneChat assistant route",
    status: "ready",
  });
}