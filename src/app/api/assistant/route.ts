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
  try {
    const body = (await request.json().catch(() => null)) as AssistantRequestBody | null;
    const question = extractQuestion(body);

    if (!question) {
      return NextResponse.json<AssistantResponseBody>(
        {
          ok: false,
          answer: "Je nâ€™ai reÃ§u aucune question exploitable.",
          intent: "general",
          quickAsks: getAssistantQuickAsks(DEFAULT_ASSISTANT_CONTEXT),
          statusCards: buildSuggestedStatusCards(DEFAULT_ASSISTANT_CONTEXT),
          links: buildSuggestedLinks(DEFAULT_ASSISTANT_CONTEXT),
          supportScope:
            "CloneChat couvre dÃ©jÃ  le support de comprÃ©hension et dâ€™orientation produit. La couche screenshots/fichiers/bugs live viendra plus tard.",
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
        "CloneChat connaÃ®t lâ€™Ã©tat produit actuel, les parcours, les pages, les rÃ´les, les prix visibles, les limites et les usages dÃ©jÃ  validÃ©s. La couche de diagnostic par captures/fichiers/bugs live sera ajoutÃ©e aprÃ¨s stabilisation produit.",
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
          "CloneChat couvre dÃ©jÃ  le support de comprÃ©hension et dâ€™orientation produit. La couche screenshots/fichiers/bugs live viendra plus tard.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "CloneChat assistant route",
    status: "ready",
  });
}