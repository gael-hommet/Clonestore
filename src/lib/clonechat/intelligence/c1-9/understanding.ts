// C1.9 — COMPRÉHENSION PAR LE MODÈLE.
//
// Remplace les cinq classifieurs regex mono-intention. Le modèle lit la phrase ENTIÈRE,
// avec la mémoire de conversation, et produit une représentation OUVERTE du besoin.
//
// Aucune liste de sujets, aucune taxonomie, aucun mot-clé : le prompt décrit une TÂCHE
// d'analyse, pas un catalogue de cas. C'est ce qui permet de comprendre une demande que
// personne n'a anticipée.
import type { Understanding } from "./understanding-schema";
import { parseUnderstanding, understandingIsCoherent } from "./understanding-schema";
import type { ConversationMemory, ConversationTurn } from "./conversation-memory";
import { renderMemoryForPrompt } from "./conversation-memory";

/** Port modèle minimal. Volontairement plus simple que le port CloneChat existant :
 *  la compréhension n'a pas besoin du contrat de réponse, seulement de JSON libre. */
export interface C19ModelPort {
  complete(req: {
    readonly system: string;
    readonly userText: string;
    readonly history?: readonly ConversationTurn[];
    readonly maxOutputTokens: number;
    readonly purpose: "understand" | "compose";
  }): Promise<{
    readonly ok: boolean;
    readonly text: string | null;
    readonly usage: { readonly inputTokens: number; readonly outputTokens: number; readonly model: string } | null;
    readonly error: string | null;
  }>;
}

export interface UnderstandInput {
  readonly message: string;
  readonly history: readonly ConversationTurn[];
  readonly memory: ConversationMemory;
  readonly viewerIsAuthenticated: boolean;
  readonly hasCompanyContext: boolean;
  readonly availableToolIds: readonly string[];
  readonly at: string;
}

export interface UnderstandOutcome {
  readonly ok: boolean;
  readonly understanding: Understanding | null;
  readonly reason: string | null;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number; readonly model: string } | null;
}

const SCHEMA_SHAPE = `{
  "summary": string,
  "primary_goal": string,
  "secondary_goals": string[],
  "questions_detected": string[],
  "entities": [{ "kind": string, "value": string, "inferred": boolean }],
  "requested_metrics": string[],
  "requested_actions": string[],
  "constraints": string[],
  "assumptions": string[],
  "missing_information": string[],
  "ambiguities": string[],
  "user_emotion": string,
  "requires_clarification": boolean,
  "clarification_question": string | null,
  "knowledge_needs": string[],
  "tool_needs": string[],
  "risk_signals": string[],
  "confidence": number,
  "depends_on_history": boolean,
  "is_correction": boolean,
  "out_of_scope": boolean,
  "request_nature": "support_incident" | "sensitive_action" | "out_of_scope" | "capability" | "pricing" | "country" | "objection" | "data_governance" | "next_step" | "general",
  "topics_requested": string[],
  "answer_depth": "atomic" | "multi" | "detailed",
  "asks_for_next_step": boolean,
  "countries_mentioned": string[]
}`;

export function buildUnderstandingPrompt(input: UnderstandInput): string {
  const memoryBlock = renderMemoryForPrompt(input.memory);
  return [
    "Tu analyses la demande d'un utilisateur adressée à CloneChat, l'assistant de CloneStore.",
    "CloneStore vend des employés IA d'entreprise ; le premier est Pierre, un employé IA RH.",
    "",
    "Ta seule tâche ici est de COMPRENDRE — tu ne réponds pas à l'utilisateur.",
    "",
    "Décompose la demande telle qu'elle est, sans la ramener à une catégorie connue :",
    "- recense CHAQUE question distincte réellement posée, même implicite ;",
    "- relève les valeurs données (effectif, durées, pays, rôles, budgets) dans `entities` ;",
    "  ajoute-y aussi ce que la personne demande sur la FORME de l'échange — son prénom, son",
    "  rôle, et le tutoiement ou le vouvoiement qu'elle réclame : ce sont des faits de",
    "  conversation, à tenir aux tours suivants au même titre qu'un effectif ;",
    "- si le tour ne se comprend qu'avec les tours précédents (pronom, ellipse, « et avec ça ? »),",
    "  mets `depends_on_history` à vrai et résous la référence dans `summary` ;",
    "- si l'utilisateur corrige une réponse précédente, mets `is_correction` à vrai ;",
    "- si la demande sort du périmètre CloneStore, mets `out_of_scope` à vrai — n'essaie pas",
    "  de la rattacher de force à un sujet produit ;",
    "- ne demande une clarification que si la demande est réellement inexploitable ;",
    "  une question large mais traitable ne requiert pas de clarification.",
    // Mesuré (a2, vg1) : « et sinon, comment ça se passe ? », « bon, et concrètement ? » —
    // une relance courte SANS sujet identifiable — recevait un panorama produit deviné.
    // Ces relances vagues exigent une clarification : on demande DE QUOI il s'agit.
    "- Une relance courte et vague, sans sujet clair (« et sinon ? », « et concrètement ? »,",
    "  « comment ça se passe ? » hors de tout contexte identifiable), n'est PAS traitable en",
    "  l'état : mets `requires_clarification` à vrai et propose une `clarification_question`",
    "  courte demandant sur quoi porte la question.",
    "",
    "`knowledge_needs` est le champ le plus important : écris ce qu'il faudrait CHERCHER pour",
    "répondre, dans le vocabulaire du domaine RH et produit — pas avec les mots de l'utilisateur.",
    "Exemple de transformation attendue : une question familière sur la charge administrative",
    "devient des besoins comme « automatisation des tâches administratives RH » ou",
    "« comparaison entre le coût d'une embauche et un abonnement ».",
    "",
    `Outils dont l'exécution pourrait être proposée : ${input.availableToolIds.join(", ") || "aucun"}.`,
    "Mets dans `tool_needs` l'identifiant d'un outil seulement si la demande l'exige vraiment.",
    "",
    // Ces cinq champs décident de ce que la réponse aura le DROIT d'aborder. Ils portent
    // sur la demande telle qu'elle est posée, jamais sur ce qu'il serait commercialement
    // utile d'y répondre.
    "Qualifie ensuite la demande, sans l'élargir :",
    "- `request_nature` : la nature de l'ÉCHANGE. Un problème vécu (prélèvement contesté,",
    "  page qui échoue, connexion impossible, facturation inattendue) est `support_incident`,",
    "  même s'il mentionne un produit ou un prix.",
    "- `topics_requested` : uniquement les sujets que la personne aborde elle-même.",
    "- `answer_depth` : `atomic` pour une question unique, `multi` si plusieurs points sont",
    "  demandés, `detailed` seulement si une explication de fond est explicitement attendue.",
    "- `asks_for_next_step` : vrai SEULEMENT si la personne demande comment avancer, voir,",
    "  essayer, réserver ou souscrire. Une simple question factuelle ne le déclenche pas.",
    "- `countries_mentioned` : les codes ISO-3166 alpha-2 des pays concernés, y compris",
    "  déduits d'une ville ou d'une région (« Zurich » donne CH, « Anvers » donne BE).",
    "  N'y mets aucun pays que la personne n'a pas évoqué.",
    "",
    `Contexte du lecteur : ${input.viewerIsAuthenticated ? "connecté" : "visiteur anonyme"}` +
      `, ${input.hasCompanyContext ? "avec entreprise active" : "sans entreprise active"}.`,
    memoryBlock ? `\n${memoryBlock}` : "",
    "",
    `Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, de forme :\n${SCHEMA_SHAPE}`,
  ].filter(Boolean).join("\n");
}

/**
 * Plafond de sortie de la compréhension.
 *
 * Mesuré : à 700 tokens l'objet était TRONQUÉ sur 9 cas sur 12 d'une campagne réelle —
 * `invalid_json` avec `out` exactement égal au plafond. La structure compte 21 champs
 * dont plusieurs tableaux ; il lui faut de la place. Le coût reste marginal car la
 * compréhension tourne sur le modèle économique.
 */
// Relevé à 2 000 avec l'ajout des cinq champs du contrat de pertinence : le budget de
// sortie couvre aussi le raisonnement du modèle, et un objet coupé coûte un tour entier.
const UNDERSTAND_MAX_OUTPUT_TOKENS = 2000;

export async function understand(port: C19ModelPort, input: UnderstandInput): Promise<UnderstandOutcome> {
  const system = buildUnderstandingPrompt(input);

  const call = async (repair: boolean) => port.complete({
    system: repair
      ? `${system}\n\nTa réponse précédente n'était pas un JSON complet et valide. Renvoie STRICTEMENT l'objet demandé, en restant concis dans chaque tableau.`
      : system,
    userText: input.message,
    history: input.history.slice(-6),
    maxOutputTokens: UNDERSTAND_MAX_OUTPUT_TOKENS,
    purpose: "understand" as const,
  });

  let res: Awaited<ReturnType<C19ModelPort["complete"]>>;
  try {
    res = await call(false);
  } catch (e) {
    return { ok: false, understanding: null, reason: `port_threw:${String(e)}`, usage: null };
  }

  if (!res.ok || !res.text) {
    return { ok: false, understanding: null, reason: res.error ?? "no_text", usage: res.usage };
  }

  let parsed = parseUnderstanding(res.text);
  if (!parsed.ok) {
    // Une seule tentative de réparation — même politique que le client CloneChat existant.
    try {
      const retry = await call(true);
      if (retry.ok && retry.text) {
        const reparsed = parseUnderstanding(retry.text);
        if (reparsed.ok) { parsed = reparsed; res = retry; }
      }
    } catch { /* la réparation est best-effort : on retombe sur l'échec initial */ }
  }
  if (!parsed.ok || !parsed.value) {
    return { ok: false, understanding: null, reason: parsed.error ?? "unparseable", usage: res.usage };
  }

  const coherence = understandingIsCoherent(parsed.value);
  if (!coherence.ok) {
    // Une compréhension incohérente est dégradée en CONFIANCE BASSE plutôt que rejetée :
    // le pipeline demandera une précision, ce qui est honnête et exploitable.
    return {
      ok: true,
      understanding: { ...parsed.value, confidence: Math.min(parsed.value.confidence, 0.3) },
      reason: `incoherent:${coherence.reasons.join("|")}`,
      usage: res.usage,
    };
  }

  return { ok: true, understanding: parsed.value, reason: null, usage: res.usage };
}
