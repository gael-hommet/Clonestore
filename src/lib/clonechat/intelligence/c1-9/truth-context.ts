// C1.9 — TRUTHCONTEXT.
//
// Le sol de vérité sur lequel le modèle a le droit de raisonner. On ne réécrit AUCUNE
// vérité : on lit les autorités déjà canoniques du dépôt (P10 pricing, registre de
// routes, chunks visibles) et on les TYPE avec leur provenance.
//
// Différence de fond avec l'existant : un fait porte sa source, son autorité et son
// niveau de preuve. Le vérificateur peut donc distinguer « chiffre officiel » de
// « estimation dérivée » — ce qui rend une estimation POSSIBLE sans ouvrir la porte à
// l'invention. Aujourd'hui, faute de cette distinction, tout montant dérivé est traité
// comme un prix inventé et la réponse entière est jetée.
import type { ParrainRetrievedChunk } from "../c1-1/parrain-types";
import { pricingForCountry, defaultPricingForUnknownCountry, SUPPORTED_LAUNCH_COUNTRIES } from "@/lib/clonestore/pricing/country-pricing";
import { getRouteEntry } from "@/lib/nav/route-registry";
import type { FactRelevancePlan } from "./response-relevance";

/** Contexte sans contrat de pertinence : tout est servi, comme avant §4. */
const ALL_FACTS_RELEVANT: FactRelevancePlan = Object.freeze({
  includePricing: true,
  includeCountryTable: true,
  countryFilter: null,
  includeCountryScope: true,
});

/** Niveau de preuve. C'est ce que la réponse doit rendre visible à l'utilisateur. */
export type Evidence =
  | "official"    // chiffre/statut publié par une autorité du dépôt
  | "retrieved"   // extrait d'une source de connaissance visible
  | "derived"     // calculé à partir de faits officiels + hypothèses explicites
  | "assumption"; // posé faute d'information, doit être annoncé

export interface TruthFact {
  readonly key: string;
  readonly value: string;
  readonly source: string;
  readonly authority: string;
  readonly evidence: Evidence;
  readonly verifiedAt: string;
  readonly confidence: number;
  readonly allowedForViewer: boolean;
  /**
   * Ce fait est-il SERVI au rédacteur pour cette demande précise ?
   *
   * Mesuré (§4) : servir la table tarifaire des quatre pays à chaque tour produisait des
   * réponses justes mais polluées — un rédacteur à qui l'on tend quatre prix en écrit
   * quatre. Un fait retenu reste présent dans le contexte (les outils gouvernés en ont
   * besoin : le calcul de gain lit le montant de l'abonnement) mais n'est ni rendu dans
   * le prompt, ni compté comme un fait fourni. Retenir n'est pas cacher : c'est ne pas
   * répondre à une question qui n'a pas été posée.
   */
  readonly served: boolean;
}

export interface TruthContext {
  readonly facts: readonly TruthFact[];
  readonly availableRoutes: readonly { readonly path: string; readonly label: string }[];
  /** Vrai si la récupération n'a rien fourni : le composeur doit alors se taire ou demander. */
  readonly groundingEmpty: boolean;
}

export interface TruthContextInput {
  readonly retrieved: readonly ParrainRetrievedChunk[];
  /** Pays résolu SERVEUR. Jamais lu du corps client. */
  readonly serverCountry: string | null;
  readonly at: string;
  readonly viewerIsAuthenticated: boolean;
  /**
   * Ce que la demande rend PERTINENT. Absent ⇒ tout est servi (comportement historique,
   * conservé pour les appels structurels et les tests qui ne modélisent pas la demande).
   */
  readonly relevance?: FactRelevancePlan;
}

/** Routes que CloneChat a le droit de proposer. Le registre est l'autorité. */
const PROPOSABLE_ROUTES = ["/agents/pierre", "/demo/pierre", "/reserver/pierre", "/comprendre-clonestore", "/questions", "/login", "/signup"] as const;

export function buildTruthContext(input: TruthContextInput): TruthContext {
  const facts: TruthFact[] = [];
  const rel = input.relevance ?? ALL_FACTS_RELEVANT;

  // ── Prix : autorité P10, jamais un littéral ───────────────────────────────
  const pricing = input.serverCountry ? pricingForCountry(input.serverCountry) : defaultPricingForUnknownCountry();
  if (pricing.status === "ok") {
    facts.push({
      key: "pierre.price.monthly",
      value: pricing.pricing.display,
      source: "src/lib/clonestore/pricing/country-pricing.ts",
      authority: "P10 country-pricing",
      evidence: "official",
      verifiedAt: input.at,
      confidence: 1,
      allowedForViewer: true,
      served: rel.includePricing,
    });
    facts.push({
      key: "pierre.price.country",
      value: pricing.pricing.country,
      source: "src/lib/clonestore/pricing/country-pricing.ts",
      authority: "P10 country-pricing",
      evidence: "official",
      verifiedAt: input.at,
      confidence: 1,
      allowedForViewer: true,
      served: rel.includePricing,
    });
  }

  facts.push({
    key: "launch.countries",
    value: SUPPORTED_LAUNCH_COUNTRIES.join(", "),
    source: "src/lib/clonestore/pricing/country-pricing.ts",
    authority: "P10 country-pricing",
    evidence: "official",
    verifiedAt: input.at,
    confidence: 1,
    allowedForViewer: true,
    served: rel.includeCountryScope,
  });

  // ── Tarif de CHAQUE pays de lancement ─────────────────────────────────────
  // Ne fournir que le prix du pays résolu côté serveur suffisait pour « combien ça
  // coûte ? », mais laissait le modèle sans matière dès qu'une question portait sur un
  // AUTRE pays, ou sur plusieurs à la fois (« des salariés en France et en Suisse »).
  // Mesuré : il comblait alors le vide en affirmant sans élément fourni, et omettait la
  // seconde devise. La table P10 est courte et publique ; la donner en entier supprime la
  // cause au lieu d'ajouter un cas particulier par pays.
  //
  // Elle n'est SERVIE, en revanche, que si la demande touche un pays — et alors restreinte
  // aux pays évoqués. « Vous travaillez au Luxembourg ? » n'appelle pas les quatre tarifs.
  //
  // Cas particulier, trouvé avant la campagne : un prix est demandé mais le pays servi
  // n'est pas résolu (visiteur anonyme). `pierre.price.monthly` n'existe alors PAS — le
  // canon P10 refuse de deviner. Ne rien servir laisserait le rédacteur sans matière face
  // à « combien ça coûte ? », et c'est exactement ainsi qu'on invente un prix. La seule
  // réponse honnête est la table des deux paliers : on la sert.
  //
  // Un SEUL fait compact plutôt que quatre lignes : mesuré, quatre faits tarifaires
  // produisaient quatre lignes de réponse. Une phrase unique porte la même vérité sans
  // inviter à l'énumération.
  const priceNeedsTiers = rel.includePricing && pricing.status !== "ok" && !rel.includeCountryTable;
  if (priceNeedsTiers) {
    const tiers = SUPPORTED_LAUNCH_COUNTRIES
      .map((cc) => ({ cc, p: pricingForCountry(cc) }))
      .filter((x): x is { cc: typeof x.cc; p: Extract<typeof x.p, { status: "ok" }> } => x.p.status === "ok");
    const byDisplay = new Map<string, string[]>();
    for (const t of tiers) {
      const list = byDisplay.get(t.p.pricing.display) ?? [];
      list.push(t.cc);
      byDisplay.set(t.p.pricing.display, list);
    }
    facts.push({
      key: "pierre.price.tiers",
      value: [...byDisplay].map(([display, ccs]) => `${display} (${ccs.join(", ")})`).join(" · "),
      source: "src/lib/clonestore/pricing/country-pricing.ts",
      authority: "P10 country-pricing",
      evidence: "official",
      verifiedAt: input.at,
      confidence: 1,
      allowedForViewer: true,
      served: true,
    });
  }

  for (const cc of SUPPORTED_LAUNCH_COUNTRIES) {
    const p = pricingForCountry(cc);
    if (p.status !== "ok") continue;
    facts.push({
      key: `pierre.price.by-country.${cc}`,
      value: `${cc} : ${p.pricing.display}`,
      source: "src/lib/clonestore/pricing/country-pricing.ts",
      authority: "P10 country-pricing",
      evidence: "official",
      verifiedAt: input.at,
      confidence: 1,
      allowedForViewer: true,
      served: rel.includeCountryTable
        && (rel.countryFilter === null || rel.countryFilter.includes(cc)),
    });
  }

  // Le périmètre est fermé : ce qui n'est pas listé n'est pas couvert. Sans cette
  // affirmation explicite, l'absence d'un pays se lit comme une simple lacune de contexte,
  // et la réponse part en considérations générales au lieu de le dire franchement.
  facts.push({
    key: "launch.countries.scope",
    value: `Seuls ${SUPPORTED_LAUNCH_COUNTRIES.join(", ")} sont couverts au lancement. Tout autre pays n'est PAS couvert aujourd'hui, et aucune date d'ouverture n'est connue.`,
    source: "src/lib/clonestore/pricing/country-pricing.ts",
    authority: "P10 country-pricing",
    evidence: "official",
    verifiedAt: input.at,
    confidence: 1,
    allowedForViewer: true,
    served: rel.includeCountryScope,
  });

  // ── Plancher de gouvernance : une VÉRITÉ produit, donc un FAIT ────────────
  //
  // Mesuré : la pipeline affirmait, à juste titre, qu'aucune action sensible n'est
  // exécutée automatiquement — et le banc la déclarait « non étayée », parce que rien dans
  // les faits transmis ne la portait. La règle vivait dans le prompt, pas dans le sol de
  // vérité. Une limite produit qu'on veut voir énoncée doit être fournie comme un fait,
  // sinon on demande au modèle d'affirmer sans source ce qu'on lui impose de dire.
  facts.push({
    key: "governance.human-only",
    value:
      "Pierre prépare, analyse et propose. L'exécution d'une action sensible — envoi, " +
      "signature, suppression, décision concernant une personne — n'est jamais automatique : " +
      "elle est proposée, puis validée par un humain, et n'est pas active aujourd'hui.",
    source: "src/lib/clonechat/intelligence/c1/clonechat-claims-policy.ts",
    authority: "P16A human-only floor",
    evidence: "official",
    verifiedAt: input.at,
    confidence: 1,
    allowedForViewer: true,
    served: true,
  });

  // ── Connaissance récupérée : chaque chunk devient un fait attribué ─────────
  // Toujours servie : la récupération a déjà jugé de sa pertinence, et un chunk retenu
  // répond par construction à un besoin de connaissance écrit par le modèle.
  for (const r of input.retrieved) {
    facts.push({
      key: `chunk.${r.chunk.id}`,
      value: r.chunk.text,
      source: r.chunk.sourceId,
      authority: String(r.chunk.parrainAuthority),
      evidence: "retrieved",
      verifiedAt: r.chunk.reviewedAt ?? input.at,
      confidence: r.chunk.stale ? 0.6 : 0.9,
      allowedForViewer: true, // la visibilité a déjà filtré en amont
      served: true,
    });
  }

  const availableRoutes = PROPOSABLE_ROUTES
    .map((p) => {
      const e = getRouteEntry(p);
      return e ? { path: e.path, label: e.label } : null;
    })
    .filter((x): x is { path: string; label: string } => x !== null);

  return Object.freeze({
    facts: Object.freeze(facts),
    availableRoutes: Object.freeze(availableRoutes),
    groundingEmpty: input.retrieved.length === 0,
  });
}

/** Les faits réellement SERVIS au rédacteur pour cette demande. Base du grounding jugé. */
export function servedFacts(ctx: TruthContext): readonly TruthFact[] {
  return Object.freeze(ctx.facts.filter((f) => f.served));
}

/**
 * Tout ce qui a été FOURNI au rédacteur, sous forme lisible — faits ET pages autorisées.
 *
 * Les pages en faisaient partie depuis le début (le prompt les liste comme « PAGES
 * EXISTANTES ») mais n'apparaissaient pas dans les faits transmis au banc. Mesuré : le juge
 * a reproché à trois réponses d'assistance d'« inventer la page Support » alors que
 * `/questions — Support` leur avait été explicitement fournie par le registre de routes.
 * C'est la même erreur que celle déjà corrigée pour les faits : un banc qui ne voit pas une
 * source ne mesure pas le grounding, il mesure sa propre ignorance.
 */
export function providedContextForJudge(ctx: TruthContext): readonly string[] {
  return Object.freeze([
    ...servedFacts(ctx).map((f) => `${f.key} = ${f.value}`),
    ...ctx.availableRoutes.map((r) => `page.autorisee ${r.path} = ${r.label}`),
  ]);
}

/** Rendu pour le prompt : les faits sont ÉTIQUETÉS par niveau de preuve. */
export function renderTruthForPrompt(ctx: TruthContext): string {
  const served = servedFacts(ctx);
  if (served.length === 0) return "Aucun fait autorisé n'a pu être réuni pour cette demande.";
  const official = served.filter((f) => f.evidence === "official");
  const retrieved = served.filter((f) => f.evidence === "retrieved");
  const parts: string[] = [];
  if (official.length > 0) {
    parts.push("FAITS OFFICIELS (vérifiés, citables tels quels) :\n" + official.map((f) => `- ${f.key} = ${f.value}`).join("\n"));
  }
  if (retrieved.length > 0) {
    parts.push("SOURCES RÉCUPÉRÉES (cite l'identifiant entre crochets) :\n" + retrieved.map((f) => `- [${f.key.replace(/^chunk\./, "")}] ${f.value}`).join("\n"));
  }
  if (ctx.availableRoutes.length > 0) {
    parts.push("PAGES EXISTANTES (n'en invente aucune autre) :\n" + ctx.availableRoutes.map((r) => `- ${r.path} — ${r.label}`).join("\n"));
  }
  return parts.join("\n\n");
}

/** Identifiants de chunks réellement fournis — base de validation des citations. */
export function citableIds(ctx: TruthContext): readonly string[] {
  return Object.freeze(
    ctx.facts.filter((f) => f.evidence === "retrieved").map((f) => f.key.replace(/^chunk\./, "")),
  );
}
