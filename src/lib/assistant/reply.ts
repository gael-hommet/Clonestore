import {
  DEFAULT_ASSISTANT_CONTEXT,
  buildDeterministicAnswer,
  buildFallbackAnswer,
  buildRelevantKnowledge,
  buildSuggestedLinks,
  buildSuggestedStatusCards,
  classifyIntent,
  findRelevantKnowledgeMatches,
  getAssistantQuickAsks,
  getAssistantWelcome,
} from "@/lib/assistant/knowledge";

import type {
  AssistantAccountContext,
  AssistantConversationItem,
  AssistantIntent,
  AssistantLinkCard,
  AssistantResponsePayload,
  AssistantRouteBody,
  AssistantStatusCard,
} from "@/lib/assistant/types";

export type {
  AssistantAccountContext,
  AssistantConversationItem,
  AssistantIntent,
  AssistantLinkCard,
  AssistantResponsePayload,
  AssistantRouteBody,
  AssistantStatusCard,
} from "@/lib/assistant/types";

function cleanText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function mergeContext(
  partial?: Partial<AssistantAccountContext> | null
): AssistantAccountContext {
  return {
    ...DEFAULT_ASSISTANT_CONTEXT,
    ...(partial ?? {}),
    companyName: cleanText(partial?.companyName ?? DEFAULT_ASSISTANT_CONTEXT.companyName),
    contactFirstName: cleanText(
      partial?.contactFirstName ?? DEFAULT_ASSISTANT_CONTEXT.contactFirstName
    ),
    contactJobTitle: cleanText(
      partial?.contactJobTitle ?? DEFAULT_ASSISTANT_CONTEXT.contactJobTitle
    ),
    usualTone: cleanText(partial?.usualTone ?? DEFAULT_ASSISTANT_CONTEXT.usualTone),
    preferredLanguage: cleanText(
      partial?.preferredLanguage ?? DEFAULT_ASSISTANT_CONTEXT.preferredLanguage
    ),
    senderMode: cleanText(partial?.senderMode ?? DEFAULT_ASSISTANT_CONTEXT.senderMode),
    senderStatus: cleanText(partial?.senderStatus ?? DEFAULT_ASSISTANT_CONTEXT.senderStatus),
    domainStatus: cleanText(partial?.domainStatus ?? DEFAULT_ASSISTANT_CONTEXT.domainStatus),
    senderEmailRequested: cleanText(
      partial?.senderEmailRequested ?? DEFAULT_ASSISTANT_CONTEXT.senderEmailRequested
    ),
    senderEmailEffective: cleanText(
      partial?.senderEmailEffective ?? DEFAULT_ASSISTANT_CONTEXT.senderEmailEffective
    ),
    replyToEmail: cleanText(partial?.replyToEmail ?? DEFAULT_ASSISTANT_CONTEXT.replyToEmail),
  };
}

function lastUserMessage(conversation?: AssistantConversationItem[]): string {
  if (!Array.isArray(conversation) || conversation.length === 0) return "";

  for (let i = conversation.length - 1; i >= 0; i -= 1) {
    const item = conversation[i];
    if (item?.role === "user" && cleanText(item.content)) {
      return cleanText(item.content);
    }
  }

  return "";
}

export function resolveAssistantQuestion(body: AssistantRouteBody | string): string {
  if (typeof body === "string") {
    return cleanText(body);
  }

  return (
    cleanText(body.message) ||
    cleanText(body.input) ||
    cleanText(body.query) ||
    lastUserMessage(body.conversation)
  );
}

function buildAnswer(
  question: string,
  context: AssistantAccountContext,
  intent: AssistantIntent
): string {
  const deterministic = buildDeterministicAnswer(question, context, intent);
  if (deterministic) return deterministic;
  return buildFallbackAnswer(question, context, intent);
}

function buildEmptyQuestionResponse(
  context: AssistantAccountContext
): AssistantResponsePayload {
  const welcome = getAssistantWelcome(context);
  const quickAsks = getAssistantQuickAsks(context);
  const statusCards = buildSuggestedStatusCards(context);
  const links = buildSuggestedLinks(context, "general");
  const knowledgeDigest = buildRelevantKnowledge("", "general", context);

  return {
    ok: true,
    answer: welcome,
    response: welcome,
    message: welcome,
    text: welcome,
    intent: "general",
    quickAsks,
    statusCards,
    links,
    contextSnapshot: context,
    usedKnowledge: findRelevantKnowledgeMatches("", "general", 5),
    knowledgeDigest,
  };
}

export function generateAssistantResponse(
  input: AssistantRouteBody | string,
  maybeContext?: Partial<AssistantAccountContext>
): AssistantResponsePayload {
  const body: AssistantRouteBody =
    typeof input === "string"
      ? { message: input, context: maybeContext }
      : input;

  const context = mergeContext({
    ...(body.context ?? {}),
    ...(maybeContext ?? {}),
  });

  const question = resolveAssistantQuestion(body);

  if (!question) {
    return buildEmptyQuestionResponse(context);
  }

  const intent = classifyIntent(question);
  const answer = buildAnswer(question, context, intent);
  const quickAsks = getAssistantQuickAsks(context);
  const statusCards: AssistantStatusCard[] = buildSuggestedStatusCards(context);
  const links: AssistantLinkCard[] = buildSuggestedLinks(context, intent);
  const usedKnowledge = findRelevantKnowledgeMatches(question, intent, 5);
  const knowledgeDigest = buildRelevantKnowledge(question, intent, context);

  return {
    ok: true,
    answer,
    response: answer,
    message: answer,
    text: answer,
    intent,
    quickAsks,
    statusCards,
    links,
    contextSnapshot: context,
    usedKnowledge,
    knowledgeDigest,
  };
}

export function generateAssistantText(
  input: AssistantRouteBody | string,
  maybeContext?: Partial<AssistantAccountContext>
): string {
  return generateAssistantResponse(input, maybeContext).answer;
}