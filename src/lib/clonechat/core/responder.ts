// src/lib/clonechat/core/responder.ts
//
// CloneChat Unified Intelligence — CŒUR CONVERSATIONNEL UNIQUE. Un seul appel OpenAI Responses
// API pour une conversation normale ; le modèle décide lui-même s'il répond directement, s'il
// utilise le contexte CloneStore fourni, s'il lance web_search (outil hébergé — exécuté par
// OpenAI, ne compte pas comme un second appel de notre côté), ou s'il appelle open_page.
//
// Init PARESSEUSE : rien n'est instancié au niveau module. Vercel importe cette route pendant
// "Collecting page data" ; une clé absente ne doit jamais faire échouer le build.
import { retrieve, formatRetrievedContext } from "./retrieval";
import { buildInstructions } from "./system-prompt";
import { CLONECHAT_TOOLS, executeOpenPage, isPurchaseIntentRoute, type OpenPageResult } from "./tools";

export interface ResponderConfig {
  readonly model: string;
  readonly reasoningEffort: "low" | "minimal";
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
}

const DEFAULT_MODEL = "gpt-5.4-mini";

/** Lit la config depuis l'environnement. Jamais de throw ici — une valeur absente retombe sur le défaut sûr. */
export function loadResponderConfig(env: NodeJS.ProcessEnv = process.env): ResponderConfig {
  const model = (env.CLONECHAT_MODEL ?? "").trim() || DEFAULT_MODEL;
  return {
    model,
    reasoningEffort: "low",
    maxOutputTokens: 900,
    timeoutMs: 25_000,
  };
}

/**
 * Lecture paresseuse de la clé — jamais lue/validée au niveau module (import-time), pour ne
 * jamais faire échouer le build. `OPENAI_API_KEY` est REQUISE en production pour que la voie
 * publique de CloneChat fonctionne : son absence en production a déjà causé une panne réelle
 * (2026-07-24) — silencieuse, car repliée sans log sur l'ancienne voie commerciale. Ce cas est
 * désormais journalisé bruyamment (voir logUnifiedFailure) au lieu d'être invisible.
 */
export function readOpenAIKeyLazy(env: NodeJS.ProcessEnv = process.env): string | null {
  const k = (env.OPENAI_API_KEY ?? "").trim();
  if (k.length === 0 && env.NODE_ENV === "production") {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      event: "clonechat_unified_failure",
      at: new Date().toISOString(),
      errorCode: "no_api_key",
      httpStatus: null,
      requestedModel: null,
      production: true,
      message: "OPENAI_API_KEY absente en production — CloneChat ne peut pas utiliser le cœur unifié.",
    }));
  }
  return k.length > 0 ? k : null;
}

export interface ConversationTurn {
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface UnifiedRequest {
  readonly apiKey: string;
  readonly config: ResponderConfig;
  readonly message: string;
  readonly history: readonly ConversationTurn[];
  readonly signal?: AbortSignal;
}

export interface UnifiedUsage {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface UnifiedResult {
  readonly ok: boolean;
  readonly answer: string;
  readonly usedWebSearch: boolean;
  readonly webSources: readonly { readonly title: string; readonly url: string }[];
  readonly openedPage: OpenPageResult | null;
  readonly suggestCard: boolean;
  readonly usage: UnifiedUsage | null;
  readonly error: string | null;
}

const EMPTY_RESULT = (error: string): UnifiedResult => ({
  ok: false, answer: "", usedWebSearch: false, webSources: [], openedPage: null,
  suggestCard: false, usage: null, error,
});

/**
 * Journalisation STRUCTURÉE d'un échec du cœur unifié — jamais de secret (pas de clé, pas de
 * message utilisateur, pas de réponse). Défaut réel trouvé en production (2026-07-24) : les
 * échecs étaient avalés silencieusement (aucun log), donc invisibles — un `OPENAI_API_KEY`
 * absent en production basculait chaque tour vers l'ancienne voie commerciale sans que rien ne
 * le signale. Ce log est la seule preuve exploitable pour diagnostiquer une panne réelle.
 */
function logUnifiedFailure(params: {
  readonly errorCode: string;
  readonly httpStatus?: number | null;
  readonly requestedModel: string;
}): void {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({
    event: "clonechat_unified_failure",
    at: new Date().toISOString(),
    errorCode: params.errorCode,
    httpStatus: params.httpStatus ?? null,
    requestedModel: params.requestedModel,
  }));
}

/**
 * Un seul appel principal OpenAI pour une conversation normale. web_search est un outil
 * HÉBERGÉ : s'il est utilisé, l'exécution a lieu côté OpenAI, dans ce même appel — nous ne
 * faisons pas de second aller-retour réseau pour cela. open_page (function-calling classique)
 * peut nécessiter un second tour local si le modèle choisit de l'appeler ; ce n'est jamais le
 * cas pour une question purement informative (voir system-prompt.ts, règle ACTIONS).
 */
export async function respondUnified(req: UnifiedRequest): Promise<UnifiedResult> {
  const { apiKey, config, message, history, signal } = req;
  if (!apiKey) {
    logUnifiedFailure({ errorCode: "no_api_key", requestedModel: config.model });
    return EMPTY_RESULT("no_api_key");
  }
  if (!message.trim()) return EMPTY_RESULT("empty_message"); // pas une panne : rien à journaliser

  const retrieved = retrieve(message, 6);
  const instructions = buildInstructions(formatRetrievedContext(retrieved));

  const input: Array<Record<string, unknown>> = [
    ...history.slice(-6).map((h) => ({ role: h.role, content: h.text })),
    { role: "user", content: message },
  ];

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), config.timeoutMs);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    // Import dynamique : le SDK OpenAI reste hors du bundle client, cohérent avec le reste du module openai/.
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const tools: Array<Record<string, unknown>> = [
      { type: "web_search" },
      ...CLONECHAT_TOOLS.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.parameters })),
    ];

    const res = await client.responses.create(
      {
        model: config.model,
        instructions,
        input,
        tools,
        max_output_tokens: config.maxOutputTokens,
        reasoning: { effort: config.reasoningEffort },
      } as unknown as Parameters<typeof client.responses.create>[0],
      { signal: combinedSignal },
    );

    const result = extractResult(res, config.model);
    if (!result.ok) {
      // Réponse renvoyée sans texte exploitable (ex. filtrage de contenu, sortie vide) — pas
      // une exception réseau, mais tout aussi silencieux sans ce log.
      logUnifiedFailure({ errorCode: "empty_or_unusable_response", requestedModel: config.model });
    }
    return result;
  } catch (e) {
    if (combinedSignal.aborted) {
      logUnifiedFailure({ errorCode: "timeout", requestedModel: config.model });
      return EMPTY_RESULT("timeout");
    }
    const status = (e as { status?: number } | null)?.status ?? null;
    const errorCode = status ? `openai_http_${status}` : "openai_error";
    logUnifiedFailure({ errorCode, httpStatus: status, requestedModel: config.model });
    return EMPTY_RESULT(errorCode);
  } finally {
    clearTimeout(timer);
  }
}

interface ResponsesOutputItem {
  readonly type?: string;
  readonly role?: string;
  readonly content?: ReadonlyArray<{ readonly type?: string; readonly text?: string }>;
  readonly name?: string;
  readonly arguments?: string;
  readonly action?: { readonly sources?: ReadonlyArray<{ readonly title?: string; readonly url?: string }> };
}

// Défaut RÉEL trouvé en test navigateur-libre (appel OpenAI réel, gpt-5.4-mini, question
// "Combien coûte Pierre en Suisse ?") : le jeton de citation brut d'un modèle avec navigation
// (`citeturn0search0`) a fui tel quel dans le texte affiché — un artefact de formatage
// interne au provider, jamais destiné à l'utilisateur final. Filet de sécurité : aucun marqueur
// brut de ce type n'atteint jamais l'écran, qu'il vienne d'un futur changement de modèle ou
// d'un cas non couvert par l'extraction structurée ci-dessus.
const RAW_CITATION_MARKER_RE = /\s*[:：]?citeturn\d+(search|news)\d+/gi;
function stripRawCitationMarkers(text: string): string {
  return text.replace(RAW_CITATION_MARKER_RE, "").trim();
}

function extractResult(res: unknown, model: string): UnifiedResult {
  const r = res as {
    output?: readonly ResponsesOutputItem[];
    output_text?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
    model?: string;
  };
  const items = r.output ?? [];

  let answer = typeof r.output_text === "string" ? r.output_text : "";
  let usedWebSearch = false;
  const webSources: { title: string; url: string }[] = [];
  let openedPage: OpenPageResult | null = null;

  for (const item of items) {
    if (item.type === "web_search_call") {
      usedWebSearch = true;
      for (const s of item.action?.sources ?? []) {
        if (s.url) webSources.push({ title: s.title ?? s.url, url: s.url });
      }
    }
    if (item.type === "function_call" && item.name === "open_page") {
      try {
        const args = JSON.parse(item.arguments ?? "{}") as { path?: unknown; reason?: unknown };
        openedPage = executeOpenPage(args);
      } catch {
        openedPage = { ok: false, path: null, label: null, reason: "" };
      }
    }
    if (!answer && item.type === "message" && item.role === "assistant") {
      const textPart = item.content?.find((c) => c.type === "output_text");
      if (textPart?.text) answer = textPart.text;
    }
  }

  const suggestCard = !!openedPage?.ok && isPurchaseIntentRoute(openedPage.path ?? "");

  // Défaut RÉEL trouvé en Production (2026-07-29) : une question de NAVIGATION (« Sur quelle page
  // puis-je réserver Pierre ? ») fait choisir au modèle l'outil open_page — un function_call SANS
  // texte d'accompagnement. respondUnified ne fait qu'UN seul appel (pas d'aller-retour de résultat
  // d'outil), donc `answer` restait vide → ok=false → la route renvoyait « CloneChat rencontre
  // momentanément un problème de connexion à son modèle » pour une simple demande d'orientation.
  // Correctif : quand le modèle a résolu une VRAIE page (openedPage.ok, chemin validé contre le
  // registre réel) mais n'a produit aucun texte, on SYNTHÉTISE une réponse d'orientation déterministe
  // et fondée (label + chemin réels — jamais une route inventée). L'orientation est un droit produit,
  // pas une panne.
  if (!answer.trim() && openedPage?.ok && openedPage.path && openedPage.label) {
    const why = openedPage.reason?.trim();
    answer = `${why ? why.replace(/\s*[.。]?\s*$/, "") + ". " : ""}Rendez-vous sur la page « ${openedPage.label} » : ${openedPage.path}.`;
  }

  return {
    ok: answer.trim().length > 0,
    answer: stripRawCitationMarkers(answer),
    usedWebSearch,
    webSources: Object.freeze(webSources),
    openedPage,
    suggestCard,
    usage: {
      model: r.model ?? model,
      inputTokens: r.usage?.input_tokens ?? 0,
      outputTokens: r.usage?.output_tokens ?? 0,
    },
    error: null,
  };
}
