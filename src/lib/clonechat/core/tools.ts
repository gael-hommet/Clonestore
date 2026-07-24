// src/lib/clonechat/core/tools.ts
//
// CloneChat Unified Intelligence — outils CloneStore typés pour le modèle. Périmètre de cette
// passe : navigation seule (« ouvrir une page »), le seul outil sûr, sans effet externe, dont
// une question informative anonyme a réellement besoin. Les outils métier existants de Pierre
// (missions, documents, validations…) restent sur la voie ENTREPRISE gouvernée existante et ne
// sont pas dupliqués ici : CloneChat et Pierre restent distincts.
import { getRouteEntry } from "@/lib/nav/route-registry";

export interface CloneStoreToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

/** Déclaration function-calling (Responses API) — description non commerciale, jamais un CTA. */
export const CLONECHAT_TOOLS: readonly CloneStoreToolDefinition[] = [
  {
    name: "open_page",
    description:
      "Indique la page CloneStore réelle la plus pertinente pour la demande de l'utilisateur (jamais une URL inventée). " +
      "À utiliser seulement quand l'utilisateur demande explicitement où aller, comment réserver, comment payer, ou veut voir une page précise — jamais pour une simple question informative.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Chemin de route CloneStore, ex. /reserver/pierre, /demo/pierre, /agents/pierre" },
        reason: { type: "string", description: "Une phrase expliquant pourquoi cette page répond à la demande." },
      },
      required: ["path", "reason"],
      additionalProperties: false,
    },
  },
];

export interface OpenPageResult {
  readonly ok: boolean;
  readonly path: string | null;
  readonly label: string | null;
  readonly reason: string;
}

/** Exécute `open_page` : valide le chemin contre le registre RÉEL, fail-closed sinon. */
export function executeOpenPage(args: { path?: unknown; reason?: unknown }): OpenPageResult {
  const path = typeof args.path === "string" ? args.path : "";
  const reason = typeof args.reason === "string" ? args.reason : "";
  const entry = getRouteEntry(path);
  if (!entry || entry.audience !== "public" || entry.status === "deprecated" || entry.status === "stub") {
    return { ok: false, path: null, label: null, reason };
  }
  return { ok: true, path: entry.path, label: entry.label, reason };
}

/** Une page ouverte vers un chemin d'achat/réservation/paiement justifie une carte d'action. */
const PURCHASE_INTENT_ROUTES = new Set(["/reserver/pierre", "/checkout", "/agents/pierre"]);
export function isPurchaseIntentRoute(path: string): boolean {
  return PURCHASE_INTENT_ROUTES.has(path);
}
