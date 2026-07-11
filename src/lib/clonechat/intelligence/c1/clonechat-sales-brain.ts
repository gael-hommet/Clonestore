// src/lib/clonechat/intelligence/c1/clonechat-sales-brain.ts
// C1 — Cerveau de vente : vendre EXTRÊMEMENT bien, mais honnêtement.
// Doctrine : diagnostiquer la douleur avant de pitcher ; valeur en travail concret ;
// contraste avec l'assistant générique ; jamais de sur-promesse ; jamais prétendre
// que les blocages live sont levés ; pousser vers démo/réservation/appel ; adapter
// au persona. Interdits : fausse urgence, fausse rareté, garantie légale,
// « remplace toute la RH », « voix/appels/signature/e-mail live », lancement payant.

import type { AnswerCTA, SalesObjectionAnswer, SalesPersona } from "./clonechat-knowledge-types";
import { PIERRE_LAUNCH_PITCH, PIERRE_OBJECTIONS } from "./clonechat-pierre-knowledge";
import { answerWhy449 } from "./clonechat-pricing-knowledge";

const cta = (label: string, route: string): AnswerCTA => Object.freeze({ label, route });
const CTA_DEMO = cta("Réserver une démo", "/demo");
const CTA_RESERVER = cta("Réserver Pierre", "/reserver/pierre");
const CTA_PIERRE = cta("Voir la page Pierre", "/agents/pierre");
const CTA_QUESTIONS = cta("Parler à un humain", "/questions");

// ── Personas ──────────────────────────────────────────────────────────────────
export interface SalesPersonaProfile {
  readonly id: SalesPersona;
  readonly label: string;
  readonly painFocus: string;
  readonly angle: string;
  readonly cta: AnswerCTA;
}

const p = (x: SalesPersonaProfile): SalesPersonaProfile => Object.freeze(x);

export const SALES_PERSONA_PROFILES: readonly SalesPersonaProfile[] = Object.freeze([
  p({ id: "ceo", label: "CEO / dirigeant", painFocus: "Temps d'équipe brûlé sur du répétitif ; risque non tracé.", angle: "Capacité d'exécution + contrôle : un employé IA qui rend des comptes, chiffres mensuels à l'appui.", cta: CTA_DEMO }),
  p({ id: "hr_director", label: "DRH / responsable RH", painFocus: "Documents, onboardings, relances : la journée part en micro-tâches.", angle: "Pierre absorbe l'exécution ; vous gardez les décisions — et enfin une trace propre de tout.", cta: CTA_DEMO }),
  p({ id: "founder", label: "Fondateur de PME", painFocus: "Pas de RH dédiée : la RH, c'est vous, le soir.", angle: "Un employé RH opérationnel à 449 €/mois, sans recrutement ni management.", cta: CTA_RESERVER }),
  p({ id: "office_manager", label: "Office manager", painFocus: "Vous êtes le filet de sécurité de tous les suivis.", angle: "Les relances et suivis deviennent portés par Pierre, visibles dans un cockpit.", cta: CTA_DEMO }),
  p({ id: "operations_manager", label: "Responsable des opérations", painFocus: "Processus RH non standardisés, dépendants des personnes.", angle: "Missions structurées + règles d'entreprise exécutables + audit : la RH devient un processus fiable.", cta: CTA_PIERRE }),
  p({ id: "skeptical_buyer", label: "Acheteur sceptique", painFocus: "Déjà vu trop de promesses IA.", angle: "Zéro sur-promesse : voici ce qui est prêt, voici ce qui est bloqué, et la démo montre le vrai produit.", cta: CTA_DEMO }),
  p({ id: "technical_buyer", label: "Acheteur technique", painFocus: "Sécurité, isolation, réversibilité.", angle: "Isolation par entreprise, permissions fail-closed, audit complet, validations humaines par construction.", cta: CTA_PIERRE }),
  p({ id: "legal_minded_buyer", label: "Acheteur juridique", painFocus: "Responsabilité et conformité.", angle: "Pierre prépare, l'humain décide ; aucune garantie légale prétendue ; revue externe assumée comme prérequis.", cta: CTA_QUESTIONS }),
]);

export function personaProfile(id: SalesPersona): SalesPersonaProfile {
  return SALES_PERSONA_PROFILES.find((x) => x.id === id) ?? SALES_PERSONA_PROFILES[0];
}

// ── Déclencheurs de douleur (verbatim doctrine) ───────────────────────────────
export const PAIN_TRIGGERS: readonly string[] = Object.freeze([
  "Vous réexpliquez tout à chaque outil.",
  "Vos suivis RH dépendent trop de la mémoire humaine.",
  "Un document RH simple déclenche souvent 10 micro-actions.",
  "Le vrai coût n'est pas la rédaction, c'est le suivi.",
  "Le risque n'est pas l'IA, c'est l'IA sans validation.",
  "Un assistant répond. Un employé suit une mission.",
  "ChatGPT vous aide à écrire. Pierre vous aide à faire avancer le travail.",
]);

// ── Flow de vente ─────────────────────────────────────────────────────────────
export const SALES_FLOW: readonly string[] = Object.freeze([
  "1. Identifier le persona.",
  "2. Identifier la douleur.",
  "3. Relier la douleur à une capacité de Pierre.",
  "4. Expliquer pourquoi une IA générique ne suffit pas.",
  "5. Donner un exemple concret.",
  "6. Traiter le risque et le contrôle.",
  "7. Traiter le prix.",
  "8. CTA : démo, réservation, page Pierre, ou question suivante.",
]);

// ── Objections (10 requises) ──────────────────────────────────────────────────
const so = (x: SalesObjectionAnswer): SalesObjectionAnswer => Object.freeze(x);

export const SALES_OBJECTIONS: readonly SalesObjectionAnswer[] = Object.freeze([
  so({
    id: "price",
    objection: "C'est trop cher / objection prix",
    shortAnswer: "449 €/mois pour un employé IA RH opérationnel — comparez au coût réel des heures RH répétitives, pas au prix d'un logiciel.",
    explanation: answerWhy449(),
    painReframing: "Un document RH simple déclenche souvent 10 micro-actions : ce fardeau invisible se paie déjà, en heures cachées.",
    proofOrFeature: "Rapport d'activité mesuré sur vos données réelles ; réservation fondateur sans paiement pour juger sur pièce.",
    cta: CTA_RESERVER,
  }),
  so({
    id: "already_chatgpt",
    objection: "On utilise déjà ChatGPT",
    shortAnswer: "Très bien pour écrire — mais qui SUIT le dossier ensuite ? ChatGPT vous aide à écrire. Pierre vous aide à faire avancer le travail.",
    explanation: "Un assistant repart de zéro à chaque conversation : pas de mémoire d'entreprise, pas de missions, pas de validations, pas de trace. Pierre porte le travail dans la durée, dans un cockpit auditable.",
    painReframing: "Vous réexpliquez tout à chaque outil — et vos suivis dépendent encore de la mémoire humaine.",
    proofOrFeature: "Mémoire d'entreprise durable et isolée + missions suivies + relances tenues : la démo le montre en 3 minutes.",
    cta: CTA_DEMO,
  }),
  so({
    id: "already_hr_software",
    objection: "On a déjà un logiciel RH / SIRH",
    shortAnswer: "Parfait — Pierre ne le remplace pas : il fait le travail AUTOUR (préparer, suivre, relancer, tracer) que votre SIRH ne fait pas.",
    explanation: "Un SIRH stocke et administre. Il ne rédige pas l'avenant, ne relance pas le salarié, ne prépare pas l'onboarding pas à pas. Pierre exécute ce travail-là et peut préparer des exports propres pour vos outils.",
    painReframing: "Le SIRH n'a jamais réduit les 10 micro-actions autour d'un document — c'est là que part le temps.",
    proofOrFeature: "Variables de pré-paie consolidées et exports maîtrisés vers votre écosystème.",
    cta: CTA_PIERRE,
  }),
  so({
    id: "trust",
    objection: "Peut-on lui faire confiance ?",
    shortAnswer: "Vous n'avez pas à lui faire une confiance aveugle : tout le sensible passe par votre validation, et tout est tracé.",
    explanation: "La confiance se construit par le contrôle : classification de risque (CloneGuard), autonomie graduelle plafonnée (CloneTrust), relecture systématique (CloneReview), timeline complète (CloneTrace).",
    painReframing: "Le risque n'est pas l'IA, c'est l'IA sans validation — ici la validation est structurelle, pas optionnelle.",
    proofOrFeature: "Planchers durs : jamais de décision disciplinaire/salariale finale automatisée.",
    cta: CTA_DEMO,
  }),
  so({
    id: "legal_safety",
    objection: "Est-ce juridiquement sûr ?",
    shortAnswer: "Pierre prépare un travail gouverné et tracé ; il ne rend pas d'avis juridique et ne garantit pas la conformité — la revue légale externe est un prérequis assumé.",
    explanation: "Doctrine stricte : décisions finales humaines, refus expliqués sur l'interdit, cadre pays FR/BE/LU/CH fail-closed sans jamais inventer de règle de droit.",
    painReframing: "Comparez à l'existant : combien d'actions RH partent aujourd'hui sans trace ni relecture ?",
    proofOrFeature: "Audit complet + validation humaine systématique sur le sensible ; recommandation de revue humaine/juridique quand il le faut.",
    cta: CTA_QUESTIONS,
  }),
  so({
    id: "integration",
    objection: "Est-ce que ça s'intègre à nos outils ?",
    shortAnswer: "Aujourd'hui : exports propres et maîtrisés (pré-paie, dossiers). Les connecteurs directs (SIRH, paie, Slack) viendront après vérification.",
    explanation: "Le cadre d'intégration (ConnectorTech + bus technologique) est prêt côté architecture ; aucun connecteur live n'est activé tant qu'il n'est pas vérifié — par sécurité, pas par manque.",
    painReframing: "L'urgence n'est pas le connecteur : c'est d'avoir des données consolidées et fiables à transmettre.",
    proofOrFeature: "Exports tracés + variables de pré-paie prêtes pour votre gestionnaire de paie.",
    cta: CTA_PIERRE,
  }),
  so({
    id: "replace_hr",
    objection: "Ça remplace la RH ?",
    shortAnswer: "Non — et méfiez-vous de quiconque le promet. Pierre absorbe l'exécution opérationnelle ; les décisions et la responsabilité restent humaines.",
    explanation: "Pierre peut agir comme une équipe RH opérationnelle sur le travail numérique, répétitif, documentaire, de suivi et de coordination — sous validation humaine. C'est un multiplicateur, pas un remplaçant.",
    painReframing: "La vraie question : combien d'heures de votre équipe partent en tâches qu'un employé IA gouverné peut porter ?",
    proofOrFeature: "Autonomie contrôlée : les sujets critiques sont structurellement human-only.",
    cta: CTA_DEMO,
  }),
  so({
    id: "mistakes",
    objection: "Et s'il fait des erreurs ?",
    shortAnswer: "Rien de sensible ne part sans vous : Pierre prépare, vous validez — et chaque étape est tracée pour corriger vite.",
    explanation: "Relecture interne systématique (ton, contradictions, placeholders), validation humaine avant tout effet, timeline complète pour audit et reprise.",
    painReframing: "L'erreur humaine actuelle est-elle tracée, relue, réversible ? Ici, oui.",
    proofOrFeature: "CloneReview + validations + CloneTrace : le triptyque anti-erreur.",
    cta: CTA_DEMO,
  }),
  so({
    id: "readiness",
    objection: "C'est vraiment prêt ?",
    shortAnswer: "La version de lancement est prête et démontrable. Ce qui ne l'est pas encore, nous le disons : paiement en ligne fermé, approfondissements en roadmap.",
    explanation: "Le produit est prouvé de bout en bout en local (missions, documents, validations, cockpit). L'ouverture payante attend des preuves externes (paiement, revue légale) — un choix de sérieux, pas un retard caché.",
    painReframing: "Vous préférez un produit qui prétend tout, ou un produit qui montre tout ?",
    proofOrFeature: "Démo immersive du vrai produit + réservation fondateur sans paiement.",
    cta: CTA_RESERVER,
  }),
  so({
    id: "why_now",
    objection: "Pourquoi maintenant ?",
    shortAnswer: "Parce que la réservation fondateur est ouverte : prix fondateur conservé, place réservée — sans paiement ni engagement financier aujourd'hui.",
    explanation: "Réserver maintenant, c'est prendre date au prix fondateur et démarrer l'Empreinte Entreprise tôt : plus Pierre connaît votre contexte, plus il est utile au premier jour.",
    painReframing: "Chaque mois d'attente, ce sont des heures RH répétitives de plus — le statu quo a un coût.",
    proofOrFeature: "Réservation gratuite et sans paiement, prix fondateur 449 € HT/mois conservé tant que l'abonnement reste actif.",
    cta: CTA_RESERVER,
  }),
]);

export function salesObjectionById(id: string): SalesObjectionAnswer | null {
  return SALES_OBJECTIONS.find((x) => x.id === id) ?? null;
}

/** Détection souple d'une objection dans une question libre. */
export function findSalesObjection(text: string): SalesObjectionAnswer | null {
  const q = text.toLowerCase();
  if (/cher|prix|coû|combien|449|budget|expensive|cost/.test(q)) return salesObjectionById("price");
  if (/chatgpt|gpt|claude|copilot|assistant\s+(générique|ia)|generic\s+assistant/.test(q)) return salesObjectionById("already_chatgpt");
  if (/sirh|logiciel\s+rh|payfit|lucca|hr\s+software|outil\s+rh/.test(q)) return salesObjectionById("already_hr_software");
  if (/confiance|trust|fiable|fiabilité/.test(q)) return salesObjectionById("trust");
  if (/légal|juridique|conform|legal|liabilit|responsabilité/.test(q)) return salesObjectionById("legal_safety");
  if (/intégr|integrat|connect|api|slack|paie\b|payroll/.test(q)) return salesObjectionById("integration");
  if (/remplac|replace/.test(q)) return salesObjectionById("replace_hr");
  if (/erreur|mistake|se\s+trompe|faute/.test(q)) return salesObjectionById("mistakes");
  if (/prêt|pret\b|ready|mûr|mature|fini/.test(q)) return salesObjectionById("readiness");
  if (/pourquoi\s+maintenant|why\s+now|attendre|plus\s+tard/.test(q)) return salesObjectionById("why_now");
  return null;
}

/** Pitch adapté au persona — diagnostic de douleur AVANT l'argument. */
export function salesPitchFor(personaId: SalesPersona): string {
  const profile = personaProfile(personaId);
  return (
    `${profile.painFocus} ${PIERRE_LAUNCH_PITCH} ` +
    `${profile.angle} ` +
    "Et par honnêteté : le paiement en ligne n'est pas encore ouvert — la démo et la réservation fondateur, si."
  );
}

/** Objection de Pierre correspondante (réponses profondes) — pont vers pierre-knowledge. */
export function deepObjectionAnswer(text: string): string | null {
  const q = text.toLowerCase();
  const hit = PIERRE_OBJECTIONS.find(
    (obj) =>
      obj.objection.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && q.includes(w)).length >= 2,
  );
  if (!hit) return null;
  return `${hit.directAnswer} ${hit.honestLimitation} ${hit.valueArgument}`;
}
