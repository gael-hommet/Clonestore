// src/lib/clonechat/core/knowledge-corpus.ts
//
// CloneChat Unified Intelligence — corpus CloneStore canonique.
//
// Ce module GÉNÈRE le corpus de connaissance depuis les sources officielles déjà réelles du
// dépôt (registres de code produit, jamais de prose réinventée) : catalogue employés, prix
// canonique, registre de routes, technologies publiques, capacités RH, gouvernance. C'est un
// script DÉTERMINISTE — même code, même corpus — traçable jusqu'à sa source.
//
// Hiérarchie des sources (priorité décroissante), en cas de contradiction la plus prioritaire
// gagne et la contradiction est documentée plutôt que fusionnée :
//   1) configuration runtime / code produit exécuté (pricing, route-registry, capability-registry)
//   2) pages publiques déclarées (route-registry, audience "public")
//   3) documentation produit canonique validée (CLONECHAT_TRUTH_MATRIX)
//   4) faits de gouvernance/produit rédigés à la main mais directement dérivés du code ci-dessus
//
// Aucun secret, aucune donnée client, aucun contenu de proof/audit historique n'est une source.
import { pricingForCountry, publicPricingCatalog, SUPPORTED_LAUNCH_COUNTRIES } from "@/lib/clonestore/pricing/country-pricing";
import { PUBLIC_EMPLOYEES, FUTURE_DEPARTMENTS } from "@/lib/catalog/public-catalog";
import { FOUNDER_PRICE_MONTHLY, DEMO_LAUNCH_LABEL } from "@/lib/demo/presentation/commercial-state";
import { ROUTE_REGISTRY, type RouteEntry } from "@/lib/nav/route-registry";
import { getCloneStoreTechnologyDefinitions } from "@/lib/clonestore/technologies/registry";
import { HR_CAPABILITIES } from "@/lib/pierre/v1/hr-canon/capability-registry";

export type CorpusCategory =
  | "identity" | "employees" | "pierre_capabilities" | "clonechat_identity" | "pricing"
  | "countries" | "reservation" | "checkout" | "demo" | "cockpit" | "missions" | "validations"
  | "security_governance" | "data_privacy" | "partners" | "support" | "integrations"
  | "limits" | "technologies" | "faq" | "pages";

export interface CorpusUnit {
  readonly id: string;
  readonly title: string;
  readonly category: CorpusCategory;
  readonly text: string;
  readonly source: string;
  /** 1 = configuration runtime (le plus fiable) … 4 = fait dérivé rédigé. */
  readonly priority: 1 | 2 | 3 | 4;
  readonly routes?: readonly string[];
}

const HUMAN_ONLY_HIDDEN = new Set(["relations.whistleblower", "disciplinary.qualify", "disciplinary.decision", "offboarding.dismissal"]);

function unit(u: CorpusUnit): CorpusUnit {
  return Object.freeze(u);
}

// ── 1) Identité CloneStore & CloneChat ───────────────────────────────────────
function identityUnits(): CorpusUnit[] {
  return [
    unit({
      id: "identity.clonestore", title: "CloneStore", category: "identity", priority: 4,
      source: "public-catalog.ts + commercial-state.ts",
      text: "CloneStore est une plateforme d'employés IA opérationnels. Une entreprise se compose progressivement d'employés IA qui réalisent un vrai travail métier, sous contrôle et validation humaine. Le modèle garde l'humain au contrôle : l'employé IA propose et prépare, l'humain valide le sensible, le système exécute puis relit le résultat réel.",
    }),
    unit({
      id: "identity.clonechat", title: "CloneChat", category: "clonechat_identity", priority: 4,
      source: "product knowledge (dérivé du rôle réel de la route /api/assistant/chat)",
      text: "CloneChat est l'assistant conversationnel officiel de CloneStore. Il répond aux questions générales comme un assistant moderne, et connaît en priorité et en profondeur CloneStore : Pierre, les employés IA, les prix, les pays, la démo, le cockpit, les missions, les validations, la sécurité, le support et les technologies publiques. Il n'est pas un chatbot générique : il fonde ses réponses CloneStore sur des sources officielles, et recherche sur le web pour l'actualité externe.",
    }),
    unit({
      id: "identity.pierre_vs_clonechat", title: "Différence entre Pierre et CloneChat", category: "clonechat_identity", priority: 4,
      source: "product knowledge",
      text: "Pierre est l'employé IA RH opérationnel : il exécute des missions RH réelles (documents, onboarding, relances, préparation de paie) sous gouvernance et validation humaine, dans le cockpit de l'entreprise qui l'a activé. CloneChat est l'assistant conversationnel du site : il oriente, explique, répond aux questions et peut discuter de sujets généraux ; il n'exécute pas lui-même les missions RH de Pierre.",
    }),
  ];
}

// ── 2) Catalogue employés IA ─────────────────────────────────────────────────
function employeeUnits(): CorpusUnit[] {
  const out: CorpusUnit[] = [];
  for (const e of PUBLIC_EMPLOYEES) {
    out.push(unit({
      id: `employee.${e.slug}`, title: e.name, category: "employees", priority: 1,
      source: "public-catalog.ts", routes: [`/agents/${e.slug}`],
      text: `${e.name} — ${e.role}. ${e.tagline} Domaines : ${e.workAreas.join(" ; ")}. Statut : actif, seul employé IA nommé et ouvert aujourd'hui.`,
    }));
  }
  out.push(unit({
    id: "employees.future", title: "Départements à venir", category: "employees", priority: 1,
    source: "public-catalog.ts",
    text: `D'autres employés IA arriveront progressivement, présentés comme départements génériques (sans nom, sans prix, sans date tant qu'ils n'existent pas) : ${FUTURE_DEPARTMENTS.map((d) => d.label).join(" ; ")}. Aujourd'hui, seul Pierre est disponible à l'achat.`,
  }));
  return out;
}

// ── 3) Capacités et limites de Pierre ────────────────────────────────────────
function pierreCapabilityUnits(): CorpusUnit[] {
  const surfaceable = HR_CAPABILITIES.filter((c) => !HUMAN_ONLY_HIDDEN.has(c.id));
  const auto = surfaceable.filter((c) => c.autonomy === "execute_autonomous").length;
  const withVal = surfaceable.filter((c) => c.autonomy === "execute_with_validation").length;
  const draft = surfaceable.filter((c) => c.autonomy === "prepare_draft").length;
  const domains = [...new Set(surfaceable.map((c) => c.domain))];
  return [
    unit({
      id: "pierre.capabilities", title: "Ce que Pierre peut faire aujourd'hui", category: "pierre_capabilities", priority: 1,
      source: "hr-canon/capability-registry.ts",
      text: `Pierre couvre des capacités RH sur ${domains.length} domaines (organisation, recrutement, contrats, onboarding, paie-préparation, congés, disciplinaire, offboarding, reporting…). ${auto} s'exécutent en autonomie, ${withVal} avec validation humaine, ${draft} en préparation de brouillon à relire. Pierre ne remplace pas totalement un DRH : les décisions sensibles (licenciement, décision salariale, alerte éthique, qualification disciplinaire) restent strictement humaines — Pierre ne les exécute jamais.`,
    }),
    unit({
      id: "pierre.limits", title: "Limites actuelles de Pierre", category: "limits", priority: 1,
      source: "hr-canon/capability-registry.ts",
      text: "Toutes les capacités RH ne sont pas encore automatisées ; certaines sont en cours de construction. Pierre ne décide jamais à la place d'un humain pour le licenciement, une décision salariale ou une alerte éthique. Aucune action à effet externe réel (email envoyé, document publié, synchronisation externe) n'est exécutée sans les validations prévues par le produit.",
    }),
    unit({
      id: "pierre.roi", title: "Gains de temps et d'argent — méthode honnête", category: "faq", priority: 4,
      source: "product knowledge (aucune moyenne publiée par CloneStore)",
      text: "Aucune moyenne officielle de gain de temps ou d'argent n'est publiée par CloneStore, et il ne faut jamais en inventer une. Le gain réel dépend de l'entreprise : sa taille, le volume de tâches RH concernées, le nombre de salariés, la part de processus aujourd'hui manuels. Ce que Pierre absorbe concrètement : contrats et avenants, onboarding et offboarding, absences et congés, attestations et courriers RH, relances et suivis, préparation des variables de paie — tâches que l'équipe referait sinon à la main. Méthode pour estimer : partir des heures RH actuelles réellement passées sur ces tâches, comparer ce temps libéré au coût de l'abonnement et, le cas échéant, au coût d'une embauche ou d'un prestataire pour le même volume. Le prix de Pierre est un INTRANT du calcul de ROI, jamais la réponse à la question du gain.",
    }),
  ];
}

// ── 4) Prix et pays (source canonique unique — jamais dupliquée en dur) ──────
function pricingUnits(): CorpusUnit[] {
  const catalog = publicPricingCatalog();
  const lines = catalog.map((c) => `${c.countries.join("/")} : ${c.display}`).join(" · ");
  const perCountry = SUPPORTED_LAUNCH_COUNTRIES.map((c) => {
    const r = pricingForCountry(c);
    return r.status === "ok" ? `${r.pricing.country} : ${r.pricing.display}` : null;
  }).filter(Boolean).join(" · ");
  return [
    unit({
      id: "pricing.catalog", title: "Tarif de Pierre par pays", category: "pricing", priority: 1,
      source: "country-pricing.ts (résolveur canonique P10)",
      text: `Pays de lancement : ${SUPPORTED_LAUNCH_COUNTRIES.join(", ")}. ${lines}. Détail : ${perCountry}. Un client suisse voit et paie l'offre suisse (CHF) ; un client France/Belgique/Luxembourg voit et paie l'offre euro. Pays non déterminé → il faut demander le pays, jamais proposer une offre par défaut. Prix HT, hors taxes applicables.`,
    }),
    unit({
      id: "pricing.founder_offer", title: "Offre de lancement", category: "pricing", priority: 1,
      source: "commercial-state.ts",
      // Défaut RÉEL trouvé (2026-07-27) : cette unité citait UNIQUEMENT France/Belgique/Luxembourg,
      // ce qui se lisait comme une liste exhaustive de disponibilité — alors que la Suisse est un
      // pays de lancement à part entière (voir pricing.catalog), avec son propre prix standard hors
      // offre fondateur. Reformulé pour ne jamais laisser croire que Pierre n'est PAS disponible en
      // Suisse : seule l'offre PROMOTIONNELLE fondateur est limitée à FR/BE/LU.
      text: `CloneStore propose aujourd'hui un seul produit ouvert : Pierre, disponible dans les 4 pays de lancement (France, Belgique, Luxembourg, Suisse). L'offre de lancement fondateur à ${FOUNDER_PRICE_MONTHLY} s'applique en France/Belgique/Luxembourg ; la Suisse a son propre prix standard (voir le tarif par pays). Lancement de la démo : ${DEMO_LAUNCH_LABEL}. Abonnement mensuel. Le paiement en ligne n'est pas encore ouvert partout ; la réservation fondateur reste possible sans paiement. Il n'existe ni essai gratuit ni bêta.`,
    }),
  ];
}

// ── 5) Routes et pages publiques (registre réel) ─────────────────────────────
function routeUnits(): CorpusUnit[] {
  const out: CorpusUnit[] = [];
  for (const r of ROUTE_REGISTRY as readonly RouteEntry[]) {
    if (r.status === "deprecated" || r.status === "stub") continue;
    const category: CorpusCategory =
      r.path === "/demo" || r.path === "/demo/pierre" ? "demo" :
      r.path.startsWith("/agents/pierre/use") ? "cockpit" :
      r.path === "/reserver/pierre" ? "reservation" :
      r.path === "/checkout" || r.path.startsWith("/paiement") ? "checkout" :
      r.audience === "public" ? "pages" : "pages";
    out.push(unit({
      id: `route.${r.path}`, title: r.label, category, priority: 1,
      source: "route-registry.ts", routes: [r.path],
      text: `« ${r.label} » (${r.path}) — audience ${r.audience}${r.status === "gated" ? ", accès verrouillé par un droit/état" : ""}.`,
    }));
  }
  return out;
}

// ── 6) Technologies publiques ─────────────────────────────────────────────────
function technologyUnits(): CorpusUnit[] {
  const defs = getCloneStoreTechnologyDefinitions();
  const out: CorpusUnit[] = [unit({
    id: "tech.overview", title: "Technologies CloneStore", category: "technologies", priority: 1,
    source: "technologies/registry.ts",
    text: `CloneStore repose sur ${defs.length} technologies globales — des couches système où les employés IA se branchent ; ce ne sont pas des employés : ${defs.map((d) => d.name).join(", ")}.`,
  })];
  for (const d of defs) {
    out.push(unit({
      id: `tech.${d.slug}`, title: d.name, category: "technologies", priority: 1,
      source: "technologies/registry.ts",
      text: `${d.name} : ${d.description}`,
    }));
  }
  return out;
}

// ── 7) Gouvernance, sécurité, données ────────────────────────────────────────
function governanceUnits(): CorpusUnit[] {
  return [
    unit({
      id: "gov.validation", title: "Validation humaine", category: "security_governance", priority: 4,
      source: "governance policy (dérivé du moteur v1/hr)",
      text: "Pierre ne fait rien de sensible sans validation humaine. Les actions à risque (envoi, document sensible, décision) exigent une confirmation explicite avant exécution. Le cycle est : proposer → confirmer → exécuter → relire le résultat réel.",
    }),
    unit({
      id: "gov.isolation", title: "Isolation des données entre entreprises", category: "data_privacy", priority: 4,
      source: "governance policy",
      text: "Chaque entreprise ne voit que ses propres données. CloneChat n'accède jamais aux données d'une autre entreprise et refuse toute demande de comparaison ou de contournement.",
    }),
    unit({
      id: "gov.mission_vs_conversation", title: "Mission vs conversation", category: "missions", priority: 4,
      source: "product knowledge",
      text: "Une conversation est un échange libre avec CloneChat ou Pierre. Une mission est une demande RH transformée en travail suivi (avec étapes, documents et validations) confiée à Pierre depuis le cockpit ou depuis CloneChat.",
    }),
    unit({
      id: "support.contact", title: "Contacter le support", category: "support", priority: 4,
      source: "support procedure",
      text: "Pour un problème, décrivez-le (une capture d'écran aide). CloneChat reconnaît les problèmes déjà connus et vérifiés, propose un contournement quand il existe, et transmet à un humain les cas exceptionnels (sécurité, vie privée, litige).",
    }),
  ];
}

/** Registre COMPLET, assemblé dynamiquement depuis les sources réelles. Pur, déterministe. */
export function buildCorpus(): readonly CorpusUnit[] {
  return Object.freeze([
    ...identityUnits(), ...employeeUnits(), ...pierreCapabilityUnits(),
    ...pricingUnits(), ...routeUnits(), ...technologyUnits(), ...governanceUnits(),
  ]);
}

let CACHE: readonly CorpusUnit[] | null = null;
/** Corpus mis en cache (recalculé une fois par process depuis les sources réelles). */
export function corpus(): readonly CorpusUnit[] {
  return (CACHE ??= buildCorpus());
}
export function invalidateCorpusCache(): void { CACHE = null; }
