// src/lib/clonechat/knowledge/sources.ts
// P9.4.1 — SOURCES canoniques du cerveau de connaissance. Chaque adaptateur LIT un
// module de vérité réel du produit (jamais de prose réinventée) et en dérive des chunks
// client-safe. SERVER-ONLY : ce module lit le canon P8 en LECTURE SEULE (autorisé :
// « consommer leurs APIs / indexer leurs métadonnées autorisées ») ; il n'est jamais
// exporté par le barrel client `@/lib/clonechat`.
//
// HONNÊTETÉ (source public-catalog) : Pierre est le SEUL employé actif/nommé. Les autres
// (clara/emma/…) sont RETIRÉS de la surface publique ; l'avenir est présenté en
// DÉPARTEMENTS génériques (sans nom, sans prix, sans date). On ne les présente jamais
// comme disponibles. Les 4 capacités HUMAN_ONLY du canon ne sont JAMAIS surfacées.

import { PUBLIC_EMPLOYEES, FUTURE_DEPARTMENTS, EMPLOYEE_PRICE, EMPLOYEE_PRICE_SHORT } from "@/lib/catalog/public-catalog";
import { FOUNDER_PRICE_MONTHLY, FOUNDER_CLOSE_LABEL, DEMO_LAUNCH_LABEL } from "@/lib/demo/presentation/commercial-state";
import { ROUTE_REGISTRY, type RouteEntry } from "@/lib/nav/route-registry";
import { getCloneStoreTechnologyDefinitions } from "@/lib/clonestore/technologies/registry";
import { HR_CAPABILITIES } from "@/lib/pierre/v1/hr-canon/capability-registry";
import { SEED_REUSABLE } from "../support-memory";
import { contentHash, type KnowledgeChunk, type KnowledgeVisibility, type KnowledgeCategory, type KnowledgeKind } from "./types";

const P941_REVIEWED_AT = "2026-07-03";
const HUMAN_ONLY_HIDDEN = new Set(["relations.whistleblower", "disciplinary.qualify", "disciplinary.decision", "offboarding.dismissal"]);

function chunk(input: {
  id: string; sourceId: string; title: string; kind: KnowledgeKind; category: KnowledgeCategory;
  visibility: KnowledgeVisibility; authority: string; text: string; routes?: string[]; citationLabel: string; version?: string;
}): KnowledgeChunk {
  return {
    id: input.id, sourceId: input.sourceId, title: input.title, kind: input.kind, category: input.category,
    visibility: input.visibility, authority: input.authority, version: input.version ?? "1", reviewedAt: P941_REVIEWED_AT,
    freshnessStatus: "CURRENT", text: input.text, routes: input.routes, citationLabel: input.citationLabel,
    contentHash: contentHash(input.text),
  };
}

// ── 1) Vision & produit ──────────────────────────────────────────────────────
function visionChunks(): KnowledgeChunk[] {
  return [
    chunk({ id: "vision.platform", sourceId: "product-vision", title: "CloneStore", kind: "product_vision", category: "vision", visibility: "PUBLIC", authority: "public-catalog.ts", citationLabel: "la vision CloneStore", text: "CloneStore est une plateforme d'employés IA opérationnels : une entreprise se compose progressivement d'employés IA qui réalisent un vrai travail métier, sous contrôle et validation humaine." }),
    chunk({ id: "vision.employee", sourceId: "product-vision", title: "Employé IA", kind: "product_vision", category: "vision", visibility: "PUBLIC", authority: "public-catalog.ts", citationLabel: "la définition d'un employé IA", text: "Un employé IA reçoit une demande, la transforme en mission, prépare le travail, suit, relance et garde la trace. Rien de sensible n'est exécuté sans validation humaine." }),
    chunk({ id: "vision.governance", sourceId: "governance-policy", title: "Gouvernance humaine", kind: "product_vision", category: "vision", visibility: "PUBLIC", authority: "public-catalog.ts", citationLabel: "le modèle de gouvernance", text: "Le modèle CloneStore garde l'humain au contrôle : l'employé IA propose et prépare, l'humain valide le sensible, le système exécute puis relit le résultat réel." }),
    chunk({ id: "vision.suite", sourceId: "product-vision", title: "Pierre, CloneChat, CloneVoice", kind: "product_vision", category: "vision", visibility: "PUBLIC", authority: "technologies/registry.ts", citationLabel: "la relation entre les produits", text: "Pierre est l'employé IA RH opérationnel. CloneChat est l'assistant conversationnel (orientation en public, opérationnel une fois connecté). CloneVoice est la couche vocale future de CloneChat." }),
  ];
}

// ── 2) Catalogue employés (Pierre actif + départements futurs génériques) ────
function employeeChunks(): KnowledgeChunk[] {
  const out: KnowledgeChunk[] = [];
  for (const e of PUBLIC_EMPLOYEES) {
    out.push(chunk({
      id: `employee.${e.slug}`, sourceId: "public-catalog", title: e.name, kind: "employee_catalogue", category: "employees",
      visibility: "PUBLIC", authority: "public-catalog.ts", routes: [`/agents/${e.slug}`], citationLabel: `la page ${e.name}`,
      text: `${e.name} — ${e.role}. ${e.tagline} Domaines : ${e.workAreas.join(" ; ")}. Statut : actif (seul employé IA nommé et ouvert aujourd'hui).`,
    }));
  }
  out.push(chunk({
    id: "employees.future", sourceId: "public-catalog", title: "Départements à venir", kind: "employee_catalogue", category: "employees",
    visibility: "PUBLIC", authority: "public-catalog.ts", citationLabel: "la vision d'organisation", text:
      `L'organisation se composera progressivement d'autres employés IA, présentés comme départements génériques (sans nom ni prix ni date tant qu'ils n'existent pas) : ${FUTURE_DEPARTMENTS.map((d) => d.label).join(" ; ")}. Aujourd'hui, seul Pierre est disponible.`,
  }));
  return out;
}

// ── 3) Technologies (12, depuis le registre réel) ────────────────────────────
function technologyChunks(): KnowledgeChunk[] {
  const defs = getCloneStoreTechnologyDefinitions();
  const list = defs.map((d) => `${d.name}`).join(", ");
  const out: KnowledgeChunk[] = [chunk({
    id: "tech.overview", sourceId: "technologies", title: "Technologies CloneStore", kind: "technology_catalogue", category: "technologies",
    visibility: "PUBLIC", authority: "technologies/registry.ts", citationLabel: "les technologies CloneStore",
    text: `CloneStore repose sur ${defs.length} technologies globales (couches système où les employés IA se branchent, ce ne sont PAS des employés) : ${list}.`,
  })];
  for (const d of defs.slice(0, 12)) {
    out.push(chunk({
      id: `tech.${d.slug}`, sourceId: "technologies", title: d.name, kind: "technology_catalogue", category: "technologies",
      visibility: "PUBLIC", authority: "technologies/registry.ts", citationLabel: `la technologie ${d.name}`,
      text: `${d.name} : ${d.description}`,
    }));
  }
  return out;
}

// ── 4) Prix & offre (source commerciale unique) ──────────────────────────────
function pricingChunks(): KnowledgeChunk[] {
  return [
    chunk({ id: "price.pierre", sourceId: "commercial-state", title: "Prix de Pierre", kind: "pricing_config", category: "prices", visibility: "PUBLIC", authority: "commercial-state.ts", citationLabel: "la tarification", text: `Pierre est proposé à ${EMPLOYEE_PRICE} (${EMPLOYEE_PRICE_SHORT}). C'est le tarif de référence, source de vérité commerciale unique.` }),
    chunk({ id: "offer.founder", sourceId: "commercial-state", title: "Offre fondateur", kind: "pricing_config", category: "offers", visibility: "PUBLIC", authority: "commercial-state.ts", citationLabel: "l'offre fondateur", text: `CloneStore propose UN produit ouvert (Pierre) à ${FOUNDER_PRICE_MONTHLY}. Lancement de la démo : ${DEMO_LAUNCH_LABEL}. Fenêtre fondateur jusqu'au ${FOUNDER_CLOSE_LABEL}. Il n'existe pas d'autres offres tarifaires.` }),
  ];
}

// ── 5) Routes & pages (depuis le registre de routes réel) ────────────────────
function routeChunks(): KnowledgeChunk[] {
  const visibleOf = (r: RouteEntry): KnowledgeVisibility => r.audience === "internal" ? "INTERNAL_CLONESTORE" : r.audience === "authenticated" ? "AUTHENTICATED_CLIENT" : "PUBLIC";
  const out: KnowledgeChunk[] = [];
  for (const r of ROUTE_REGISTRY) {
    if (r.status === "deprecated" || r.status === "stub") continue; // honnêteté : ne pas orienter vers un placeholder
    const gated = r.status === "gated" ? " (accès verrouillé par un droit/état)" : "";
    out.push(chunk({
      id: `route.${r.path}`, sourceId: "route-registry", title: r.label, kind: r.audience === "public" ? "public_page" : "route_registry",
      category: r.audience === "public" ? "pages" : "routes", visibility: visibleOf(r), authority: "nav/route-registry.ts",
      routes: [r.path], citationLabel: `la page « ${r.label} »`,
      text: `« ${r.label} » (${r.path})${gated} — espace ${r.space}, audience ${r.audience}.`,
    }));
  }
  return out;
}

// ── 6) Surfaces client (onboarding/cockpit/missions/validations/salariés/documents/communications) ─
function clientSurfaceChunks(): KnowledgeChunk[] {
  const A: KnowledgeVisibility = "AUTHENTICATED_CLIENT";
  return [
    chunk({ id: "surface.onboarding", sourceId: "client-surface", title: "Onboarding entreprise", kind: "client_surface", category: "onboarding", visibility: A, authority: "route-registry.ts", routes: ["/profile/onboarding"], citationLabel: "l'onboarding", text: "L'onboarding (/profile/onboarding) renseigne l'empreinte de l'entreprise pour que Pierre travaille avec le bon contexte (secteur, ton, règles)." }),
    chunk({ id: "surface.account", sourceId: "client-surface", title: "My CloneStore", kind: "client_surface", category: "account", visibility: A, authority: "route-registry.ts", routes: ["/profile"], citationLabel: "My CloneStore", text: "My CloneStore (/profile) est l'espace entreprise et compte : employés IA possédés, empreinte, onboarding, facturation." }),
    chunk({ id: "surface.cockpit", sourceId: "client-surface", title: "Cockpit de Pierre", kind: "client_surface", category: "cockpit", visibility: A, authority: "route-registry.ts", routes: ["/agents/pierre/use"], citationLabel: "votre cockpit", text: "Le cockpit de Pierre (/agents/pierre/use) est l'espace de pilotage : vue d'ensemble, missions, validations, documents, salariés, activité." }),
    chunk({ id: "surface.missions", sourceId: "client-surface", title: "Missions", kind: "client_surface", category: "missions", visibility: A, authority: "route-registry.ts", routes: ["/agents/pierre/use?view=missions"], citationLabel: "vos missions", text: "Une mission est une demande RH transformée en travail suivi. On la confie à Pierre depuis le cockpit ou CloneChat ; les actions sensibles demandent une validation." }),
    chunk({ id: "surface.validations", sourceId: "client-surface", title: "Validations", kind: "client_surface", category: "validations", visibility: A, authority: "route-registry.ts", routes: ["/agents/pierre/use?view=validations"], citationLabel: "vos validations", text: "Les validations sont les décisions humaines requises avant qu'une action sensible s'exécute : approuver, rejeter ou demander des changements, avec traçabilité." }),
    chunk({ id: "surface.salaries", sourceId: "client-surface", title: "Employee 360", kind: "client_surface", category: "salaries", visibility: A, authority: "route-registry.ts", routes: ["/agents/pierre/employees"], citationLabel: "Employee 360", text: "Employee 360 (/agents/pierre/employees) est le dossier des salariés : liste, recherche, fiche, missions et documents associés." }),
    chunk({ id: "surface.documents", sourceId: "client-surface", title: "Documents", kind: "client_surface", category: "documents", visibility: A, authority: "client-cockpit", citationLabel: "vos documents", text: "Les documents (livrables RH) sont produits par les missions : brouillons à relire, valider ou envoyer. Ils sont consultables depuis la mission concernée." }),
    chunk({ id: "surface.communications", sourceId: "client-surface", title: "Messagerie", kind: "client_surface", category: "communications", visibility: A, authority: "route-registry.ts", routes: ["/profile/messages"], citationLabel: "la messagerie", text: "La messagerie (/profile/messages) regroupe communications, notifications et historique. CloneChat, lui, est le dialogue actif avec l'assistant." }),
  ];
}

// ── 7) Capacités Pierre (canon P8, read-only, client-safe & honnête) ─────────
function capabilityChunks(): KnowledgeChunk[] {
  const surfaceable = HR_CAPABILITIES.filter((c) => !HUMAN_ONLY_HIDDEN.has(c.id));
  const auto = surfaceable.filter((c) => c.autonomy === "execute_autonomous").length;
  const withVal = surfaceable.filter((c) => c.autonomy === "execute_with_validation").length;
  const draft = surfaceable.filter((c) => c.autonomy === "prepare_draft").length;
  const domains = [...new Set(surfaceable.map((c) => c.domain))];
  const notYet = surfaceable.filter((c) => c.implementation === "MISSING").length;
  return [
    chunk({ id: "cap.overview", sourceId: "p8-capability-canon", title: "Capacités de Pierre", kind: "runtime_capability", category: "cockpit", visibility: "AUTHENTICATED_CLIENT", authority: "hr-canon/capability-registry.ts (read-only)", citationLabel: "les capacités actuelles de Pierre", text: `Pierre couvre des capacités RH sur ${domains.length} domaines (organisation, recrutement, contrats, onboarding, paie-préparation, congés, disciplinaire, offboarding, reporting…). Certaines s'exécutent en autonomie (${auto}), d'autres avec validation humaine (${withVal}), d'autres en préparation de brouillon à relire (${draft}).` }),
    chunk({ id: "cap.limits", sourceId: "p8-capability-canon", title: "Limites de Pierre", kind: "legal_limit", category: "limits", visibility: "AUTHENTICATED_CLIENT", authority: "hr-canon/capability-registry.ts (read-only)", citationLabel: "les limites actuelles de Pierre", text: `Toutes les capacités RH ne sont pas encore automatisées (${notYet} en cours de construction). Certaines décisions restent strictement humaines (ex. qualification/décision disciplinaire, licenciement, alerte éthique) : Pierre ne les exécute jamais, il peut seulement aider à préparer ce qui est autorisé.` }),
  ];
}

// ── 8) Gouvernance / permissions / sécurité ──────────────────────────────────
function governanceChunks(): KnowledgeChunk[] {
  return [
    chunk({ id: "gov.validation", sourceId: "governance-policy", title: "Validation humaine", kind: "legal_limit", category: "permissions", visibility: "PUBLIC", authority: "governance-policy", citationLabel: "la règle de validation", text: "Pierre ne fait rien de sensible sans validation humaine. Les actions à risque (envoi, document sensible, décision) exigent une confirmation explicite." }),
    chunk({ id: "gov.permissions", sourceId: "governance-policy", title: "Permissions", kind: "client_surface", category: "permissions", visibility: "AUTHENTICATED_CLIENT", authority: "client-cockpit/permissions", citationLabel: "vos permissions", text: "Ce que vous pouvez confier ou décider dépend de vos permissions dans l'entreprise. Le serveur reste l'autorité : une action non permise n'est jamais exécutée." }),
    chunk({ id: "gov.isolation", sourceId: "governance-policy", title: "Isolation des données", kind: "legal_limit", category: "security", visibility: "AUTHENTICATED_CLIENT", authority: "governance-policy", citationLabel: "l'isolation de vos données", text: "Chaque entreprise ne voit que ses propres données. CloneChat n'accède jamais aux données d'une autre entreprise et refuse toute demande de contournement." }),
    chunk({ id: "gov.confirmation", sourceId: "governance-policy", title: "Flux de confirmation", kind: "client_surface", category: "security", visibility: "AUTHENTICATED_CLIENT", authority: "governance-policy", citationLabel: "le flux de confirmation", text: "Une action sensible est d'abord PROPOSÉE, puis confirmée par vous, puis exécutée par le système, puis relue pour montrer le résultat réel." }),
  ];
}

// ── 9) État produit / release / flags (sans secret) ─────────────────────────
function releaseChunks(): KnowledgeChunk[] {
  return [
    chunk({ id: "release.pierre", sourceId: "product-availability", title: "Pierre : disponible", kind: "release_state", category: "release_state", visibility: "PUBLIC", authority: "product-availability.ts", citationLabel: "la disponibilité de Pierre", text: "Pierre est le produit disponible aujourd'hui. Le reste (autres employés, couche vocale CloneVoice) est à venir et présenté honnêtement comme non disponible tant qu'il n'existe pas." }),
    chunk({ id: "release.clonechat", sourceId: "product-availability", title: "CloneChat : état", kind: "release_state", category: "release_state", visibility: "PUBLIC", authority: "product-availability.ts", citationLabel: "l'état de CloneChat", text: "CloneChat est activé par une configuration produit contrôlée. Quand il est actif, il oriente en public et devient opérationnel une fois connecté." }),
    chunk({ id: "release.demo", sourceId: "public-demo", title: "Démonstration", kind: "public_page", category: "pages", visibility: "PUBLIC", authority: "route-registry.ts", routes: ["/demo/pierre"], citationLabel: "la démonstration", text: "La démonstration (/demo/pierre) montre une mission RH complète, de la demande au résultat, en quelques minutes." }),
  ];
}

// ── 10) Support / bugs connus (uniquement les cas VÉRIFIÉS réutilisables) ─────
function supportChunks(): KnowledgeChunk[] {
  const out: KnowledgeChunk[] = [
    chunk({ id: "support.report", sourceId: "support-procedure", title: "Signaler un problème", kind: "support_procedure", category: "support", visibility: "AUTHENTICATED_CLIENT", authority: "support-memory", citationLabel: "la procédure de support", text: "Si quelque chose ne marche pas, décrivez le problème (une capture d'écran aide). Je reconnais les problèmes connus, propose un contournement vérifié quand il en existe un, et j'ouvre un cas de support tenant-safe si besoin." }),
  ];
  for (const c of SEED_REUSABLE.filter((x) => x.reusable)) {
    const fix = c.solution ?? c.workaround;
    if (!fix) continue;
    out.push(chunk({ id: `bug.${c.fingerprint}`, sourceId: "known-issue", title: c.title, kind: "known_issue", category: "bugs", visibility: "AUTHENTICATED_CLIENT", authority: "support-memory (verified)", citationLabel: "un problème connu", text: `Problème connu : ${c.title}. Contournement vérifié : ${fix}` }));
  }
  return out;
}

/** Registre canonique COMPLET (assemblé dynamiquement depuis les sources réelles). */
export function buildKnowledgeChunks(): KnowledgeChunk[] {
  return [
    ...visionChunks(), ...employeeChunks(), ...technologyChunks(), ...pricingChunks(),
    ...routeChunks(), ...clientSurfaceChunks(), ...capabilityChunks(), ...governanceChunks(),
    ...releaseChunks(), ...supportChunks(),
  ];
}

/** Registre mis en cache (dérivé une fois par processus des sources réelles). */
let CACHE: KnowledgeChunk[] | null = null;
export function knowledgeChunks(): KnowledgeChunk[] {
  return (CACHE ??= buildKnowledgeChunks());
}
/** Invalidation : recalcule le registre depuis les sources (après changement de config). */
export function invalidateKnowledgeCache(): void { CACHE = null; }
