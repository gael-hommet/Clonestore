// /demo — CHAPITRE 3 : ADAPTATEUR DE PRÉSENTATION des technologies CloneStore.
//
// Source de vérité UNIQUE = les registres canoniques réels :
//   • T2 (14 technologies produit) : listProductTechnologyRegistryEntries()
//   • T1 (15 capacités réutilisables) : listTechnologyRegistryEntries()
//   • CloneChat : sa PROPRE doctrine (clonechat-command-center / truth-matrix) — ajouté UNE fois.
//
// Cet adaptateur NE calcule aucun statut à la main : il DÉRIVE un statut public honnête
// (fail-closed) des statuts/modes réels du contrat, ajoute des libellés humains courts (2-3 mots)
// VÉRIFIÉS contre les ids réels du registre, et refuse toute sur-déclaration :
//   - jamais « Disponible » pour de l'architecture seule ;
//   - jamais un chemin voix/appel live si le provider est désactivé (→ « Live bloqué ») ;
//   - CloneChat n'est jamais présenté comme « en production » (activation gouvernée, flag OFF).
//
// Module PUR (les registres sont purs) : importable côté client comme côté serveur.

import {
  listProductTechnologyRegistryEntries,
  type ProductTechnologyRegistryEntry,
} from "@/lib/clonestore/product-technologies/t2/product-technology-registry";
import type { ProductTechnologyId } from "@/lib/clonestore/product-technologies/t2/product-technology-types";
import {
  listTechnologyRegistryEntries,
  type TechnologyRegistryEntry,
} from "@/lib/clonestore/technologies/t1/technology-registry";
import type { TechnologyId } from "@/lib/clonestore/technologies/t1/technology-types";

// ── Statuts publics honnêtes (le vocabulaire montré au visiteur) ──────────────

export type PublicTechStatusId =
  | "local_available"
  | "validation_required"
  | "provider_pending"
  | "architecture"
  | "in_development"
  | "live_blocked";

export interface PublicTechStatusMeta {
  readonly id: PublicTechStatusId;
  readonly label: string;
  readonly tone: "ok" | "warn" | "neutral" | "blocked";
  readonly note: string;
}

export const PUBLIC_TECH_STATUS: Readonly<Record<PublicTechStatusId, PublicTechStatusMeta>> = Object.freeze({
  local_available: { id: "local_available", label: "Disponible localement", tone: "ok",
    note: "Fonctionne en local, sans effet externe ni provider." },
  validation_required: { id: "validation_required", label: "Validation requise", tone: "warn",
    note: "Prépare une sortie ; chaque usage passe par une validation humaine." },
  provider_pending: { id: "provider_pending", label: "Provider à activer", tone: "warn",
    note: "Le chemin live attend un fournisseur externe vérifié ; le fallback local reste sûr." },
  architecture: { id: "architecture", label: "Architecture disponible", tone: "neutral",
    note: "Conçu et spécifié ; l'implémentation complète est à venir." },
  in_development: { id: "in_development", label: "En développement", tone: "neutral",
    note: "Sur la feuille de route, pas encore ouvert." },
  live_blocked: { id: "live_blocked", label: "Live bloqué", tone: "blocked",
    note: "Chemin live volontairement bloqué (aucun provider vérifié, cadre non validé)." },
});

// ── Familles de présentation (4) — structurent la couche pour la scène Architecture ──

export type TechFamilyId = "orchestration" | "governance" | "knowledge" | "perception";

export interface TechFamily {
  readonly id: TechFamilyId;
  readonly label: string;
  readonly description: string;
}

export const TECH_FAMILIES: readonly TechFamily[] = Object.freeze([
  { id: "orchestration", label: "Orchestration & exécution",
    description: "Transforme une intention en mission, la fait avancer, la coordonne et la mène jusqu'au bout." },
  { id: "governance", label: "Gouvernance & confiance",
    description: "Décide ce qui est permis, borne l'autonomie, trace tout — rien de sensible ne passe sans contrôle." },
  { id: "knowledge", label: "Connaissance & contenu",
    description: "Le profil de l'entreprise, la relecture, les briefs, l'apprentissage supervisé, la conversation." },
  { id: "perception", label: "Perception & signaux",
    description: "Comprend le langage parlé (texte autoritaire) et détecte les signaux à ne pas manquer." },
]);

// ── Libellés humains T2 (2-3 mots) + famille + exemple de mission RH illustratif ──
// VÉRIFIÉS un à un contre definition/role/safeLocalImplementation du registre réel.

interface T2Label {
  readonly publicName: string;
  readonly family: TechFamilyId;
  readonly missionExample: string;
}

const T2_LABELS: Readonly<Record<ProductTechnologyId, T2Label>> = Object.freeze({
  cloneos: { publicName: "Orchestration centrale", family: "orchestration",
    missionExample: "« Préparer l'arrivée de Clara » → mission, tâches, dépendances, routage." },
  cloneadn: { publicName: "Profil d'entreprise", family: "knowledge",
    missionExample: "Reprend le ton, les circuits et les formulations maison (propositions seulement)." },
  cloneguard: { publicName: "Garde-fou décisionnel", family: "governance",
    missionExample: "Classe l'action (normal/sensible/critique) et bloque tout effet live non sûr." },
  clonetrace: { publicName: "Traçabilité & audit", family: "governance",
    missionExample: "Chaque étape reliée à sa mission, sa raison et son point de reprise." },
  clonevoice: { publicName: "Analyse du parlé", family: "perception",
    missionExample: "Nettoie un transcript TEXTE en intentions — la voix live reste bloquée." },
  clonepolicy: { publicName: "Politique d'autonomie", family: "governance",
    missionExample: "Règles par tâche/canal/rôle + plafond d'autonomie ; canal externe = validation." },
  clonecontinuum: { publicName: "Continuité opérationnelle", family: "orchestration",
    missionExample: "Suit attentes, reprises et clôtures ; recommande un réveil — sans cron live." },
  clonetrust: { publicName: "Niveau de confiance", family: "governance",
    missionExample: "Attribue un niveau d'autonomie plafonné ; le critique reste toujours humain." },
  clonereview: { publicName: "Relecture qualité", family: "knowledge",
    missionExample: "Relit ton, placeholders et contradictions ; signale une revue humaine." },
  clonesignals: { publicName: "Détection de signaux", family: "perception",
    missionExample: "Propose des déclencheurs (retards, silences, échéances) — sans rien envoyer." },
  clonelearn: { publicName: "Apprentissage supervisé", family: "knowledge",
    missionExample: "Agrège les événements en candidats d'apprentissage, validés avant toute mémoire." },
  clonebrief: { publicName: "Brief quotidien", family: "knowledge",
    missionExample: "Brief du matin/soir sur les faits fournis — préparé n'est jamais présenté comme fait." },
  clonecall: { publicName: "Préparation d'appels", family: "orchestration",
    missionExample: "Objectif, script, transcript → intentions et mission ; l'appel sortant est bloqué." },
  cloneroom: { publicName: "Salle de coordination", family: "orchestration",
    missionExample: "Participants + fil → missions routées via l'orchestration (jamais de pair-à-pair)." },
});

// ── Libellés humains T1 (2-3 mots) — VÉRIFIÉS contre le registre réel ──────────

const T1_LABELS: Readonly<Record<TechnologyId, string>> = Object.freeze({
  document: "Documents",
  mail: "Rédaction d'e-mails",
  calendar: "Agenda",
  signature: "Signature électronique",
  voice: "Entrée vocale",
  notification: "Rappels",
  connector: "Connecteurs externes",
  memory: "Mémoire d'entreprise",
  evidence: "Journal d'audit",
  workflow: "Flux de travail",
  analytics: "Mesures & analytics",
  file: "Ingestion de fichiers",
  export: "Exports de données",
  permission: "Contrôle d'accès",
  integration_bus: "Bus de contrats",
});

// ── CloneChat : sa PROPRE présentation (ajoutée UNE fois, jamais dérivée de T2) ─
// Statut honnête : la connaissance/architecture est prête mais l'activation publique est une
// décision produit séparée (flag OFF par défaut) — donc « En développement », jamais « en production ».

export const CLONECHAT_PUBLIC = Object.freeze({
  id: "clonechat" as const,
  publicName: "Conversation intelligente",
  family: "knowledge" as TechFamilyId,
  definition:
    "L'interface conversationnelle de CloneStore : elle explique le produit, Pierre, les technologies et les prix — sur une base de vérité, sans jamais promettre le live.",
  role: "Répondre au visiteur et l'orienter, en refusant toute affirmation interdite (voix live, paiement ouvert…).",
  status: "in_development" as PublicTechStatusId,
  liveNote: "Architecture et connaissance prêtes ; activation publique gouvernée (désactivée par défaut).",
  claimableNow: "Assistant de connaissance conçu et gouverné, activable derrière un drapeau.",
  mustNotClaim: ["CloneChat est en production", "réponses live garanties", "paiement ouvert"],
  missionExample: "« Qu'est-ce que Pierre ? » → réponse fondée + orientation vers la démo ou la réservation.",
});

// ── Formes publiques exposées ─────────────────────────────────────────────────

export interface PublicTechnology {
  readonly id: string;
  readonly publicName: string;
  readonly family: TechFamilyId;
  readonly definition: string;
  readonly role: string;
  readonly status: PublicTechStatusId;
  readonly statusLabel: string;
  readonly statusTone: PublicTechStatusMeta["tone"];
  /** Détail honnête du blocage live, quand il existe (null sinon). */
  readonly liveNote: string | null;
  readonly claimableNow: string;
  readonly mustNotClaim: readonly string[];
  /** Dépendances (autres technologies produit) — libellés humains. */
  readonly dependencies: readonly string[];
  /** Capacités T1 consommées — libellés humains. */
  readonly capabilitiesUsed: readonly string[];
  readonly missionExample: string;
}

export interface PublicCapability {
  readonly id: string;
  readonly humanName: string;
  readonly description: string;
  readonly status: PublicTechStatusId;
  readonly statusLabel: string;
  readonly statusTone: PublicTechStatusMeta["tone"];
  readonly liveNote: string | null;
  readonly fallback: string;
}

// ── Dérivation honnête du statut public ───────────────────────────────────────

function t2PublicStatus(entry: ProductTechnologyRegistryEntry): PublicTechStatusId {
  const status = entry.status;
  const mode = entry.contract.mode;
  // Fail-closed : le plus restrictif l'emporte. Jamais « disponible » pour de l'architecture/live bloqué.
  if (mode === "live_disabled" || status === "live_blocked") return "live_blocked";
  if (mode === "blocked" || status === "external_blocked") return "provider_pending";
  if (mode === "architecture_only" || status === "architecture_ready") return "architecture";
  if (status === "missing") return "in_development";
  if (status === "partial") return "validation_required";
  // verified / local_safe_ready / integration_ready + mode local_safe/integration_ready
  return "local_available";
}

function t1PublicStatus(entry: TechnologyRegistryEntry): PublicTechStatusId {
  const status = entry.status;
  const dep = entry.contract.liveDependency;
  const liveBlocked = entry.liveBlockedReason != null;
  if (status === "disabled") return "live_blocked";
  if (status === "external_blocked") return "provider_pending";
  if (status === "architecture_ready") return "architecture";
  if (status === "missing") return "in_development";
  if (status === "partial") return "validation_required";
  // status === "verified" : la capacité locale existe. Mais si sa VALEUR d'usage repose sur un
  // chemin live qui attend un provider externe (envoi, création d'événement, signature, voix,
  // connecteur, push), on l'annonce « Provider à activer » — jamais « disponible » tout court.
  if (liveBlocked && (dep === "provider" || dep === "external")) return "provider_pending";
  if (liveBlocked) return "live_blocked";
  return "local_available";
}

const withStatus = <S extends PublicTechStatusId>(id: S) => {
  const meta = PUBLIC_TECH_STATUS[id];
  return { statusLabel: meta.label, statusTone: meta.tone };
};

// ── Constructeurs publics ─────────────────────────────────────────────────────

function buildT2Technologies(): PublicTechnology[] {
  const entries = listProductTechnologyRegistryEntries();
  return entries.map((entry) => {
    const label = T2_LABELS[entry.id];
    const status = t2PublicStatus(entry);
    return {
      id: entry.id,
      publicName: label.publicName,
      family: label.family,
      definition: entry.definition,
      role: entry.role,
      status,
      ...withStatus(status),
      liveNote: entry.liveBlockedReason,
      claimableNow: entry.claimableNow,
      mustNotClaim: entry.mustNotClaim,
      dependencies: entry.dependencies.map((d) => T2_LABELS[d]?.publicName ?? d),
      capabilitiesUsed: entry.t1TechnologiesConsumed.map((t) => T1_LABELS[t] ?? t),
      missionExample: label.missionExample,
    };
  });
}

/** Les 15 technologies PUBLIQUES : les 14 T2 + CloneChat (ajouté UNE seule fois). */
export function listPublicTechnologies(): readonly PublicTechnology[] {
  const t2 = buildT2Technologies();
  const chat: PublicTechnology = {
    id: CLONECHAT_PUBLIC.id,
    publicName: CLONECHAT_PUBLIC.publicName,
    family: CLONECHAT_PUBLIC.family,
    definition: CLONECHAT_PUBLIC.definition,
    role: CLONECHAT_PUBLIC.role,
    status: CLONECHAT_PUBLIC.status,
    ...withStatus(CLONECHAT_PUBLIC.status),
    liveNote: CLONECHAT_PUBLIC.liveNote,
    claimableNow: CLONECHAT_PUBLIC.claimableNow,
    mustNotClaim: CLONECHAT_PUBLIC.mustNotClaim,
    dependencies: [T2_LABELS.cloneos.publicName, T2_LABELS.cloneguard.publicName],
    capabilitiesUsed: [T1_LABELS.permission, T1_LABELS.memory],
    missionExample: CLONECHAT_PUBLIC.missionExample,
  };
  return Object.freeze([...t2, chat]);
}

/** Les 15 capacités T1 réutilisables. */
export function listPublicCapabilities(): readonly PublicCapability[] {
  return Object.freeze(
    listTechnologyRegistryEntries().map((entry) => {
      const status = t1PublicStatus(entry);
      return {
        id: entry.id,
        humanName: T1_LABELS[entry.id] ?? entry.id,
        description: entry.safeLocalImplementation,
        status,
        ...withStatus(status),
        liveNote: entry.liveBlockedReason,
        fallback: entry.safeFallback,
      };
    }),
  );
}

/** L'architecture par familles : CloneStore → T2 (4 familles) → T1 → employés IA → missions. */
export function technologyArchitecture(): readonly {
  readonly family: TechFamily;
  readonly technologies: readonly PublicTechnology[];
}[] {
  const all = listPublicTechnologies();
  return TECH_FAMILIES.map((family) => ({
    family,
    technologies: all.filter((t) => t.family === family.id),
  }));
}

// ── Vérification (utilisée par les tests) — la présentation reste FIDÈLE au registre ──

export interface TechnologyPresentationCheck {
  readonly ok: boolean;
  readonly issues: readonly string[];
  readonly counts: { readonly t2: number; readonly t1: number; readonly publicTotal: number };
}

export function verifyTechnologyPresentation(): TechnologyPresentationCheck {
  const issues: string[] = [];
  const t2 = listProductTechnologyRegistryEntries();
  const t1 = listTechnologyRegistryEntries();
  const pub = listPublicTechnologies();
  const caps = listPublicCapabilities();

  if (t2.length !== 14) issues.push(`T2 : ${t2.length} technologies au lieu de 14.`);
  if (t1.length !== 15) issues.push(`T1 : ${t1.length} capacités au lieu de 15.`);
  if (pub.length !== 15) issues.push(`Public : ${pub.length} technologies au lieu de 15 (14 T2 + CloneChat).`);
  if (caps.length !== 15) issues.push(`Capacités publiques : ${caps.length} au lieu de 15.`);

  // Chaque id T2 réel a un libellé humain, et aucun libellé n'invente un id.
  for (const e of t2) if (!T2_LABELS[e.id]) issues.push(`T2 « ${e.id} » sans libellé humain.`);
  for (const id of Object.keys(T2_LABELS)) if (!t2.some((e) => e.id === id)) issues.push(`Libellé T2 « ${id} » sans techno réelle.`);
  for (const e of t1) if (!T1_LABELS[e.id]) issues.push(`T1 « ${e.id} » sans libellé humain.`);
  for (const id of Object.keys(T1_LABELS)) if (!t1.some((e) => e.id === id)) issues.push(`Libellé T1 « ${id} » sans capacité réelle.`);

  // CloneChat apparaît exactement une fois.
  if (pub.filter((t) => t.id === "clonechat").length !== 1) issues.push("CloneChat doit apparaître exactement une fois.");

  // Aucun publicName dupliqué ; libellés courts (≤ 3 mots).
  const names = new Map<string, number>();
  for (const t of pub) {
    names.set(t.publicName, (names.get(t.publicName) ?? 0) + 1);
    if (t.publicName.trim().split(/\s+/).length > 3) issues.push(`Libellé « ${t.publicName} » > 3 mots.`);
  }
  for (const [name, n] of names) if (n > 1) issues.push(`Libellé dupliqué : « ${name} » (${n}×).`);

  // Toutes les dépendances/capacités référencées se résolvent en libellés connus.
  const knownTechNames = new Set(Object.values(T2_LABELS).map((l) => l.publicName));
  const knownCapNames = new Set(Object.values(T1_LABELS));
  for (const t of pub) {
    for (const d of t.dependencies) if (!knownTechNames.has(d)) issues.push(`« ${t.publicName} » dépend d'un libellé inconnu : « ${d} ».`);
    for (const c of t.capabilitiesUsed) if (!knownCapNames.has(c)) issues.push(`« ${t.publicName} » consomme une capacité inconnue : « ${c} ».`);
  }

  // Chaque famille contient au moins une techno (structure d'architecture non vide).
  for (const f of TECH_FAMILIES) if (!pub.some((t) => t.family === f.id)) issues.push(`Famille « ${f.label} » vide.`);

  // HONNÊTETÉ (invariants VRAIS, dérivés du registre réel) :
  //  • CloneVoice a un mode live_disabled → doit être « Live bloqué » (jamais de voix live annoncée).
  const voice = pub.find((t) => t.id === "clonevoice");
  if (voice && voice.status !== "live_blocked") issues.push(`CloneVoice doit être « Live bloqué » (mode live_disabled), pas « ${voice.statusLabel} ».`);
  //  • CloneVoice et CloneCall doivent porter une interdiction explicite de revendication live.
  for (const id of ["clonevoice", "clonecall"] as const) {
    const t = pub.find((x) => x.id === id);
    if (t && t.mustNotClaim.length === 0) issues.push(`« ${t.publicName} » doit lister des revendications interdites (live).`);
  }
  //  • CloneChat n'est jamais annoncé « Disponible » (activation gouvernée, flag OFF par défaut).
  const chat = pub.find((t) => t.id === "clonechat");
  if (chat && chat.status === "local_available") issues.push("CloneChat ne doit pas être annoncé « Disponible » (activation gouvernée).");

  return { ok: issues.length === 0, issues, counts: { t2: t2.length, t1: t1.length, publicTotal: pub.length } };
}
