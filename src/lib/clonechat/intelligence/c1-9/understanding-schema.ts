// C1.9 — SCHÉMA DE COMPRÉHENSION.
//
// Cette structure remplace les cinq classifieurs mono-intention par une représentation
// OUVERTE du besoin. Trois propriétés la distinguent d'une taxonomie :
//   1. aucun champ n'est un enum fermé de sujets produit ;
//   2. les objectifs sont MULTIPLES par construction (tableaux, pas une valeur) ;
//   3. `knowledge_needs` est écrit par le modèle, en vocabulaire libre — c'est ce qui
//      permet de retrouver une source dont l'utilisateur n'a employé aucun mot.
import { z } from "zod";

/** Un objectif réellement présent dans le message. */
export const GoalSchema = z.object({
  /** Ce que l'utilisateur veut obtenir, formulé librement. */
  goal: z.string().min(1),
  /** Forme attendue : explication, comparaison, estimation, action, orientation… */
  answer_type: z.string().min(1),
  /** Vrai si cet objectif ne peut pas être servi sans une précision de l'utilisateur. */
  must_clarify: z.boolean().default(false),
});
export type Goal = z.infer<typeof GoalSchema>;

/** Une valeur que l'utilisateur a fournie et qui doit être réutilisée telle quelle. */
export const EntitySchema = z.object({
  /** Ce que la valeur désigne : effectif, durée, pays, rôle, produit… (texte libre) */
  kind: z.string().min(1),
  /** La valeur telle qu'exprimée par l'utilisateur. */
  value: z.string().min(1),
  /** Vrai si la valeur est déduite du contexte plutôt qu'énoncée dans ce tour. */
  inferred: z.boolean().default(false),
});
export type Entity = z.infer<typeof EntitySchema>;

export const UnderstandingSchema = z.object({
  /** Reformulation neutre du besoin, en une ou deux phrases. */
  summary: z.string().min(1),
  primary_goal: z.string().min(1),
  secondary_goals: z.array(z.string()).default([]),
  /** Chaque question distincte réellement posée. Sert de contrat de couverture. */
  questions_detected: z.array(z.string()).default([]),
  entities: z.array(EntitySchema).default([]),
  /** Grandeurs demandées : temps gagné, coût, délai, nombre… (texte libre) */
  requested_metrics: z.array(z.string()).default([]),
  /** Actions demandées sur des données réelles. */
  requested_actions: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  /** Hypothèses que le modèle doit poser faute d'information — à expliciter en réponse. */
  assumptions: z.array(z.string()).default([]),
  missing_information: z.array(z.string()).default([]),
  ambiguities: z.array(z.string()).default([]),
  user_emotion: z.string().default("neutre"),
  requires_clarification: z.boolean().default(false),
  clarification_question: z.string().nullable().default(null),
  /**
   * CE QU'IL FAUT CHERCHER, en vocabulaire du domaine — pas les mots de l'utilisateur.
   * « éviter de recruter pour la paperasse » doit produire des besoins comme
   * « automatisation des tâches administratives », « comparaison coût embauche ».
   */
  knowledge_needs: z.array(z.string()).default([]),
  tool_needs: z.array(z.string()).default([]),
  risk_signals: z.array(z.string()).default([]),
  /** Confiance du modèle dans sa propre lecture, 0 → 1. */
  confidence: z.number().min(0).max(1).default(0.5),
  /**
   * Vrai si le tour ne se comprend QUE grâce aux tours précédents (ellipse, pronom,
   * correction). Impose au pipeline de traiter la mémoire comme obligatoire.
   */
  depends_on_history: z.boolean().default(false),
  /** Vrai si l'utilisateur corrige ou rectifie une réponse précédente. */
  is_correction: z.boolean().default(false),
  /** Vrai si la demande sort du périmètre CloneStore. */
  out_of_scope: z.boolean().default(false),

  // ── Contrat de PERTINENCE (§4) ────────────────────────────────────────────
  // Mesuré : les réponses justes étaient polluées par des ajouts que personne n'avait
  // demandés. La décision « ce sujet a-t-il été sollicité ? » appartient à la lecture de
  // la demande, donc au modèle — pas à une règle écrite après coup pour une question.
  /**
   * Nature de l'ÉCHANGE, pas du sujet produit : support_incident, sensitive_action,
   * out_of_scope, capability, pricing, country, objection, data_governance, next_step,
   * general. Normalisée côté code ; une valeur inattendue retombe sur `general`.
   */
  request_nature: z.string().default("general"),
  /** Sujets réellement abordés par l'utilisateur, en vocabulaire libre. */
  topics_requested: z.array(z.string()).default([]),
  /** Profondeur appelée par la demande : atomic, multi, detailed. */
  answer_depth: z.string().default("atomic"),
  /** Vrai UNIQUEMENT si l'utilisateur demande comment avancer, voir, essayer ou souscrire. */
  asks_for_next_step: z.boolean().default(false),
  /**
   * Codes ISO-3166 alpha-2 des pays concernés par la demande, y compris déduits d'une
   * ville ou d'une région. C'est le modèle qui fait la géographie ; le code n'applique
   * que la politique de couverture.
   */
  countries_mentioned: z.array(z.string()).default([]),
});
export type Understanding = z.infer<typeof UnderstandingSchema>;

export interface UnderstandingParse {
  readonly ok: boolean;
  readonly value: Understanding | null;
  readonly error: string | null;
}

/** Extrait le premier objet JSON d'une réponse éventuellement entourée de prose. */
function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
}

/** Analyse défensive : ne lève jamais. */
export function parseUnderstanding(raw: unknown): UnderstandingParse {
  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(extractJson(raw));
    } catch {
      return { ok: false, value: null, error: "invalid_json" };
    }
  }
  const parsed = UnderstandingSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, value: null, error: "schema_mismatch" };
  return { ok: true, value: parsed.data, error: null };
}

/**
 * Cohérence interne. Une compréhension incohérente est traitée comme une confiance
 * basse : le pipeline demandera une précision plutôt que de deviner.
 */
export function understandingIsCoherent(u: Understanding): { readonly ok: boolean; readonly reasons: readonly string[] } {
  const reasons: string[] = [];
  if (u.requires_clarification && !u.clarification_question) reasons.push("clarification demandée sans question");
  if (!u.requires_clarification && u.clarification_question) reasons.push("question de clarification sans demande");
  if (u.questions_detected.length === 0 && u.requested_actions.length === 0 && !u.out_of_scope) {
    reasons.push("aucune question ni action détectée");
  }
  if (u.confidence < 0 || u.confidence > 1) reasons.push("confiance hors bornes");
  return { ok: reasons.length === 0, reasons: Object.freeze(reasons) };
}

/**
 * Contrat de couverture : la liste des éléments auxquels la réponse finale DOIT
 * répondre. C'est ce que le vérificateur contrôlera, et c'est ce qui rend
 * structurellement impossible de n'answerer qu'un tiers d'une question triple.
 */
export function coverageContract(u: Understanding): readonly string[] {
  const items = [...u.questions_detected, ...u.requested_actions];
  if (items.length === 0 && u.primary_goal) return Object.freeze([u.primary_goal]);
  return Object.freeze([...new Set(items)]);
}
