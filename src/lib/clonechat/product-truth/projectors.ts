// src/lib/clonechat/product-truth/projectors.ts
//
// PROJECTEURS — chaque fonction transforme UNE source de code réelle en vérités produit (enveloppe
// complète). Jamais de duplication de la donnée : on lit le registre canonique et on projette. Si
// une source change, sa projection change, et le hash de version aussi. Pur & déterministe.

import { ROUTE_REGISTRY, type RouteEntry, type RouteStatus } from "@/lib/nav/route-registry";
import { PUBLIC_EMPLOYEES, FUTURE_DEPARTMENTS, RETIRED_PUBLIC_SLUGS } from "@/lib/catalog/public-catalog";
import { publicPricingCatalog, pricingForCountry, SUPPORTED_LAUNCH_COUNTRIES } from "@/lib/clonestore/pricing/country-pricing";
import {
  DEMO_LAUNCH_ISO, DEMO_LAUNCH_LABEL, FOUNDER_CLOSE_ISO, FOUNDER_CLOSE_LABEL,
  FOUNDER_PRICE_MONTHLY, FOUNDER_PRICE_RULE,
} from "@/lib/demo/presentation/commercial-state";
import { getCloneStoreTechnologyDefinitions } from "@/lib/clonestore/technologies/registry";
import { HR_CAPABILITIES } from "@/lib/pierre/v1/hr-canon/capability-registry";
import { AREA_OWNER, truthVersionHash, type ProductTruth, type TruthArea, type TruthStatus } from "./types";

// Domaines sensibles jamais surfacés (miroir du corpus). Décisions strictement humaines.
const HUMAN_ONLY_HIDDEN = new Set(["relations.whistleblower", "disciplinary.qualify", "disciplinary.decision", "offboarding.dismissal"]);

/** Fabrique une vérité en calculant sa version (hash de contenu) et son owner canonique. */
function truth(t: Omit<ProductTruth, "version" | "owner">): ProductTruth {
  return Object.freeze({
    ...t,
    owner: AREA_OWNER[t.area],
    version: truthVersionHash(`${t.area}|${t.id}|${t.status}|${t.value}`),
  });
}

// ── 1) VISION ────────────────────────────────────────────────────────────────
export function projectVision(): ProductTruth[] {
  return [
    truth({
      id: "vision:clonestore", area: "vision", status: "active",
      value: "CloneStore est une plateforme d'employés IA opérationnels : une entreprise se compose progressivement d'employés IA qui réalisent un vrai travail métier, sous contrôle et validation humaine (l'IA propose et prépare, l'humain valide le sensible, le système exécute puis relit).",
      source: "src/lib/catalog/public-catalog.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "declared", key: "clonestore",
      evidence: "PUBLIC_EMPLOYEES + commercial-state (employé IA RH opérationnel, validation humaine)",
    }),
    truth({
      id: "vision:clonechat", area: "vision", status: "active",
      value: "CloneChat est l'employé IA système central : point d'entrée universel, support, guide de navigation, couche d'explication et de diagnostic — il connaît CloneStore en profondeur et ne ment jamais.",
      source: "src/lib/clonechat/core/system-prompt.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "declared", key: "clonechat",
      evidence: "CLONECHAT_SYSTEM_PROMPT (assistant général officiel de CloneStore)",
    }),
  ];
}

// ── 2) ROUTES / PAGES ────────────────────────────────────────────────────────
function routeStatusToTruth(s: RouteStatus): TruthStatus {
  return s; // RouteStatus ⊂ TruthStatus ("active"|"gated"|"stub"|"deprecated"|"internal")
}
export function projectRoutes(): ProductTruth[] {
  return (ROUTE_REGISTRY as readonly RouteEntry[]).map((r) =>
    truth({
      id: `route:${r.path}`, area: "route", status: routeStatusToTruth(r.status),
      value: `« ${r.label} » (${r.path}) — audience ${r.audience}${r.status === "gated" ? ", verrouillée par un droit/état" : ""}.`,
      source: "src/lib/nav/route-registry.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: r.audience === "internal" ? "production" : "production",
      certainty: "verified", key: r.path, routes: [r.path],
      evidence: `ROUTE_REGISTRY: { path:"${r.path}", label:"${r.label}", audience:"${r.audience}", status:"${r.status}" }`,
    }),
  );
}

// ── 3) EMPLOYÉS ──────────────────────────────────────────────────────────────
export function projectEmployees(): ProductTruth[] {
  const out: ProductTruth[] = PUBLIC_EMPLOYEES.map((e) =>
    truth({
      id: `employee:${e.slug}`, area: "employee", status: e.status === "active" ? "active" : "planned",
      value: `${e.name} — ${e.role}. ${e.tagline} Domaines : ${e.workAreas.join(" ; ")}. Seul employé IA nommé et ouvert aujourd'hui.`,
      source: "src/lib/catalog/public-catalog.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "verified", key: e.slug, routes: [`/agents/${e.slug}`],
      evidence: `PUBLIC_EMPLOYEES: { slug:"${e.slug}", role:"${e.role}", status:"${e.status}" }`,
    }),
  );
  // Anciens slugs retirés : vérité négative explicite (jamais présentés comme disponibles).
  out.push(truth({
    id: "employee:retired", area: "employee", status: "deprecated",
    value: `Anciens employés retirés de la surface publique (leurs URLs redirigent vers la boutique) : ${[...RETIRED_PUBLIC_SLUGS].join(", ")}. Aucun n'est un produit disponible.`,
    source: "src/lib/catalog/public-catalog.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
    environment: "production", certainty: "verified", key: "retired",
    evidence: `RETIRED_PUBLIC_SLUGS = [${[...RETIRED_PUBLIC_SLUGS].map((s) => `"${s}"`).join(", ")}]`,
  }));
  return out;
}

export function projectFutureDepartments(): ProductTruth[] {
  return FUTURE_DEPARTMENTS.map((d, i) =>
    truth({
      id: `future_department:${i}`, area: "future_department", status: "planned",
      value: `Futur département (générique, sans nom d'employé, sans prix, sans date) : ${d.label} — ${d.description}`,
      source: "src/lib/catalog/public-catalog.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "verified", key: d.label,
      evidence: `FUTURE_DEPARTMENTS: { label:"${d.label}" }`,
    }),
  );
}

// ── 4) PRIX & PAYS ───────────────────────────────────────────────────────────
export function projectPricing(): ProductTruth[] {
  const out: ProductTruth[] = [];
  for (const country of SUPPORTED_LAUNCH_COUNTRIES) {
    const r = pricingForCountry(country);
    if (r.status !== "ok") continue;
    const p = r.pricing;
    out.push(truth({
      id: `pricing:${country}`, area: "pricing", status: "active",
      value: `Pierre en ${country} : ${p.display} (${p.currency}). ${country === "CH" ? "Un client suisse voit et paie l'offre CHF." : "Un client France/Belgique/Luxembourg voit et paie l'offre euro."}`,
      source: "src/lib/clonestore/pricing/country-pricing.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "verified", key: country,
      evidence: `PRICING.${country} = { amount:${p.amount}, currency:"${p.currency}", display:"${p.display}" }`,
    }));
    out.push(truth({
      id: `country:${country}`, area: "country", status: "active",
      value: `${country} est un pays de lancement supporté aujourd'hui.`,
      source: "src/lib/clonestore/pricing/country-pricing.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "verified", key: country,
      evidence: `SUPPORTED_LAUNCH_COUNTRIES contient "${country}"`,
    }));
  }
  // Catalogue synthétique (groupes EUR/CHF) pour une réponse compacte.
  const cat = publicPricingCatalog().map((c) => `${c.countries.join("/")} : ${c.display}`).join(" · ");
  out.push(truth({
    id: "pricing:catalog", area: "pricing", status: "active",
    value: `Pays de lancement : ${SUPPORTED_LAUNCH_COUNTRIES.join(", ")}. ${cat}. Pays non déterminé → demander le pays, jamais proposer l'offre la moins chère par défaut. Prix HT.`,
    source: "src/lib/clonestore/pricing/country-pricing.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
    environment: "production", certainty: "verified", key: "catalog",
    evidence: "publicPricingCatalog() + SUPPORTED_LAUNCH_COUNTRIES",
  }));
  return out;
}

// ── 5) LANCEMENT (dates) ─────────────────────────────────────────────────────
export function projectLaunch(): ProductTruth[] {
  return [
    truth({
      id: "launch:demo_open", area: "launch", status: "active",
      value: `Ouverture des accès / démo de Pierre : ${DEMO_LAUNCH_LABEL}. Réservation fondateur déjà possible sans paiement avant cette date.`,
      source: "src/lib/demo/presentation/commercial-state.ts", lastUpdatedAt: DEMO_LAUNCH_ISO,
      validFrom: DEMO_LAUNCH_ISO, validUntil: null, environment: "production", certainty: "verified", key: "demo_open",
      evidence: `DEMO_LAUNCH_ISO = "${DEMO_LAUNCH_ISO}" (DEMO_LAUNCH_LABEL = "${DEMO_LAUNCH_LABEL}")`,
    }),
    truth({
      id: "launch:founder_close", area: "launch", status: "active",
      value: `Fermeture de la fenêtre fondateur : ${FOUNDER_CLOSE_LABEL}.`,
      source: "src/lib/demo/presentation/commercial-state.ts", lastUpdatedAt: FOUNDER_CLOSE_ISO,
      validFrom: null, validUntil: FOUNDER_CLOSE_ISO, environment: "production", certainty: "verified", key: "founder_close",
      evidence: `FOUNDER_CLOSE_ISO = "${FOUNDER_CLOSE_ISO}"`,
    }),
    truth({
      id: "launch:founder_price_rule", area: "promise", status: "active",
      value: FOUNDER_PRICE_RULE,
      source: "src/lib/demo/presentation/commercial-state.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "verified", key: "founder_price_rule",
      evidence: `FOUNDER_PRICE_RULE (tarif fondateur ${FOUNDER_PRICE_MONTHLY} conservé sans limite tant que l'abonnement reste actif)`,
    }),
  ];
}

// ── 6) TECHNOLOGIES ──────────────────────────────────────────────────────────
export function projectTechnologies(): ProductTruth[] {
  const defs = getCloneStoreTechnologyDefinitions();
  const out: ProductTruth[] = [
    truth({
      id: "technology:overview", area: "technology", status: "active",
      value: `CloneStore repose sur ${defs.length} technologies globales (couches système où les employés IA se branchent — ce ne sont pas des employés) : ${defs.map((d) => d.name).join(", ")}.`,
      source: "src/lib/clonestore/technologies/registry.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "derived", key: "overview",
      evidence: "getCloneStoreTechnologyDefinitions()",
    }),
  ];
  for (const d of defs) {
    // visibility "public" → active ; "beta" (ex. CloneVoice) → beta/partielle ; disabled par défaut → disabled.
    const status: TruthStatus = d.visibility === "beta" ? "beta" : d.default_status === "disabled" ? "disabled" : "active";
    out.push(truth({
      id: `technology:${d.slug}`, area: "technology", status,
      value: `${d.name} — ${d.public_label} : ${d.one_liner} ${d.description}`,
      source: "src/lib/clonestore/technologies/registry.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "verified", key: d.slug,
      evidence: `TECHNOLOGY_DEFINITIONS: { slug:"${d.slug}", visibility:"${d.visibility}", default_status:"${d.default_status}" }`,
    }));
  }
  return out;
}

// ── 7) CAPACITÉS & LIMITES DE PIERRE ─────────────────────────────────────────
export function projectCapabilities(): ProductTruth[] {
  const surfaceable = HR_CAPABILITIES.filter((c) => !HUMAN_ONLY_HIDDEN.has(c.id));
  const auto = surfaceable.filter((c) => c.autonomy === "execute_autonomous").length;
  const withVal = surfaceable.filter((c) => c.autonomy === "execute_with_validation").length;
  const draft = surfaceable.filter((c) => c.autonomy === "prepare_draft").length;
  const domains = [...new Set(surfaceable.map((c) => c.domain))];
  return [
    truth({
      id: "capability:pierre_overview", area: "capability", status: "active",
      value: `Pierre couvre des capacités RH sur ${domains.length} domaines. ${auto} s'exécutent en autonomie, ${withVal} avec validation humaine, ${draft} en préparation de brouillon à relire. Pierre ne remplace pas totalement un DRH.`,
      source: "src/lib/pierre/v1/hr-canon/capability-registry.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "verified", key: "pierre_overview",
      evidence: `HR_CAPABILITIES: ${surfaceable.length} surfaçables / ${domains.length} domaines (auto=${auto}, withVal=${withVal}, draft=${draft})`,
    }),
    truth({
      id: "limitation:pierre_human_only", area: "limitation", status: "active",
      value: "Pierre ne décide JAMAIS à la place d'un humain pour le licenciement, une décision salariale, une alerte éthique ou la qualification disciplinaire. Aucune action à effet externe réel n'est exécutée sans les validations prévues.",
      source: "src/lib/pierre/v1/hr-canon/capability-registry.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "verified", key: "pierre_human_only",
      evidence: `HUMAN_ONLY_HIDDEN = [${[...HUMAN_ONLY_HIDDEN].map((s) => `"${s}"`).join(", ")}]`,
    }),
    truth({
      id: "limitation:pierre_roi", area: "promise", status: "active",
      value: "Aucune moyenne officielle de gain de temps ou d'argent n'est publiée par CloneStore ; il ne faut jamais en inventer une. Le gain dépend de l'entreprise ; méthode : partir des heures RH réelles et comparer au coût de l'abonnement.",
      source: "src/lib/clonechat/core/knowledge-corpus.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "declared", key: "pierre_roi",
      evidence: "pierre.roi (aucune moyenne publiée — méthode de calcul, jamais un chiffre inventé)",
    }),
  ];
}

// ── 8) GOUVERNANCE ───────────────────────────────────────────────────────────
export function projectGovernance(): ProductTruth[] {
  return [
    truth({
      id: "governance:human_validation", area: "governance", status: "active",
      value: "Pierre ne fait rien de sensible sans validation humaine : proposer → confirmer → exécuter → relire le résultat réel.",
      source: "src/lib/clonestore/technologies/registry.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "declared", key: "human_validation",
      evidence: "CloneGuard: risk_assessment + action_blocking + approval_routing (requires_human_validation)",
    }),
    truth({
      id: "governance:tenant_isolation", area: "governance", status: "active",
      value: "Chaque entreprise ne voit que ses propres données ; CloneChat n'accède jamais aux données d'une autre entreprise et refuse toute demande de comparaison ou de contournement.",
      source: "src/lib/clonechat/context-boundary.ts", lastUpdatedAt: null, validFrom: null, validUntil: null,
      environment: "production", certainty: "verified", key: "tenant_isolation",
      evidence: "detectPromptInjection (Classe 5 exfiltration inter-entreprise) + RLS clonechat_*",
    }),
  ];
}
