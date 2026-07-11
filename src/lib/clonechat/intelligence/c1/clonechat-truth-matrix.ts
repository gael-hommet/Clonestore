// src/lib/clonechat/intelligence/c1/clonechat-truth-matrix.ts
// C1 — Matrice de vérité : ce qui est VRAI aujourd'hui, section par section.
// A. CloneStore · B. Pierre · C. T1 · D. T2 · E. Blocages externes/live.
// Les sections C et D sont DÉRIVÉES de la connaissance technologique (elle-même
// cross-checkée contre les registres réels T1/T2 par le command center).
// Statuts honnêtes — rien de « verified_live » tant que rien n'est déployé.

import type { TruthMatrixEntry, TruthStatus } from "./clonechat-knowledge-types";
import { T1_TECHNOLOGY_KNOWLEDGE, T2_TECHNOLOGY_KNOWLEDGE } from "./clonechat-technology-knowledge";

const e = (x: TruthMatrixEntry): TruthMatrixEntry => Object.freeze(x);

// ── A. CloneStore ─────────────────────────────────────────────────────────────
export const CLONESTORE_TRUTH: readonly TruthMatrixEntry[] = Object.freeze([
  e({
    id: "clonestore.marketplace",
    section: "clonestore",
    title: "Marketplace d'employés IA",
    status: "verified_local_safe",
    whatExists: "Boutique publique (/agents), catalogue commercial unique (public-catalog), premier employé disponible : Pierre ; futurs départements affichés en roadmap.",
    whatDoesNotExist: "Autres employés IA achetables aujourd'hui.",
    safeExplanation: "CloneStore est la boutique d'employés IA d'entreprise ; Pierre (RH) est le premier disponible.",
    commercialClaimAllowed: ["CloneStore : des employés IA opérationnels, Pierre est le premier."],
    commercialClaimForbidden: ["Des dizaines d'employés IA disponibles aujourd'hui"],
    sourceReport: "Site polish / P12",
    lastVerifiedPhase: "P12",
  }),
  e({
    id: "clonestore.first_employee_pierre",
    section: "clonestore",
    title: "Premier employé : Pierre",
    status: "verified_local_safe",
    whatExists: "Pierre, employé IA RH opérationnel, version lancement prête (P13/P14 launch vision verified).",
    whatDoesNotExist: "Pierre Ultimate complet (P16A à venir).",
    safeExplanation: "Pierre est le premier employé IA de CloneStore : version de lancement prête, approfondissements en roadmap.",
    commercialClaimAllowed: ["Pierre est un employé IA RH."],
    commercialClaimForbidden: ["Pierre est terminé dans sa version ultime"],
    sourceReport: "P14_PIERRE_ULTIMATE_VISION_COVERAGE_AND_COMMERCIAL_TRUTH_REPORT.md",
    lastVerifiedPhase: "P14",
  }),
  e({
    id: "clonestore.launch_ready",
    section: "clonestore",
    title: "Version de lancement prête",
    status: "verified_local_safe",
    whatExists: "Produit de lancement complet en local : site, démo, réservation fondateur, cockpits, gouvernance, 6800+ tests.",
    whatDoesNotExist: "Déploiement en production (rien n'est déployé).",
    safeExplanation: "Le produit de lancement est prêt techniquement ; l'ouverture publique payante attend les preuves externes.",
    commercialClaimAllowed: ["Le produit de lancement est prêt et démontrable."],
    commercialClaimForbidden: ["CloneStore est en production"],
    sourceReport: "P15_1_PRE_STRIPE_GO_LIVE_PREP_REPORT.md",
    lastVerifiedPhase: "P15.1",
  }),
  e({
    id: "clonestore.paid_launch_blocked",
    section: "clonestore",
    title: "Lancement public payant",
    status: "external_blocked",
    whatExists: "Chaîne checkout/webhook/réconciliation construite et testée en mode test ; garde P15.1 (paiement explicitement fermé).",
    whatDoesNotExist: "Paiement en ligne ouvert : preuves externes absentes (compte de paiement, revue légale/fiscale, monitoring, sign-off).",
    safeExplanation: "Le paiement en ligne n'est pas encore ouvert ; la démo et la réservation fondateur sont disponibles.",
    commercialClaimAllowed: ["Vous pouvez réserver Pierre dès maintenant, sans paiement."],
    commercialClaimForbidden: ["Le paiement en ligne est ouvert", "Vous pouvez payer maintenant"],
    sourceReport: "P15_1_PRE_STRIPE_GO_LIVE_PREP_REPORT.md",
    lastVerifiedPhase: "P15.1",
  }),
  e({
    id: "clonestore.demo_founder_mode",
    section: "clonestore",
    title: "Mode démo / accès fondateur",
    status: "demo_only",
    whatExists: "/demo immersive, /demo/pierre, réservation /reserver/pierre (aucune action n'active un accès payant).",
    whatDoesNotExist: "Essai gratuit, bêta — n'existent pas et ne sont pas promis.",
    safeExplanation: "Démo interactive premium + réservation fondateur : c'est la voie d'entrée actuelle.",
    commercialClaimAllowed: ["Démo immersive disponible ; réservation fondateur ouverte."],
    commercialClaimForbidden: ["Essai gratuit", "accès bêta"],
    sourceReport: "P15_1_PRE_STRIPE_GO_LIVE_PREP_REPORT.md",
    lastVerifiedPhase: "P15.1",
  }),
  e({
    id: "clonestore.production_off",
    section: "clonestore",
    title: "Production : OFF",
    status: "external_blocked",
    whatExists: "PRODUCTION_AUTHORIZED = false (constante P10, plancher dur) ; aucun chemin d'env ne peut l'activer.",
    whatDoesNotExist: "Autorisation de production — seule une modification de code délibérée du propriétaire pourrait la lever.",
    safeExplanation: "La production n'est pas autorisée ; c'est un verrou volontaire, pas un accident.",
    commercialClaimAllowed: [],
    commercialClaimForbidden: ["CloneStore est en production"],
    sourceReport: "P15_EXTERNAL_GO_LIVE_CLOSURE_REPORT.md",
    lastVerifiedPhase: "P15",
  }),
]);

// ── B. Pierre ─────────────────────────────────────────────────────────────────
export const PIERRE_TRUTH: readonly TruthMatrixEntry[] = Object.freeze([
  e({
    id: "pierre.identity",
    section: "pierre",
    title: "Employé IA RH opérationnel",
    status: "verified_local_safe",
    whatExists: "Moteur de missions réel (V1/P8), 215 capacités certifiées fonctionnellement (P8.13 DIM A), cockpit tracé, autonomie contrôlée.",
    whatDoesNotExist: "Un « assistant » générique — Pierre suit des missions, il ne fait pas que répondre.",
    safeExplanation: "Pierre est un employé IA RH : il transforme les demandes en missions, prépare, suit et trace — sous validation humaine.",
    commercialClaimAllowed: ["Pierre est un employé IA RH.", "Pierre n'est pas un assistant ni un chatbot."],
    commercialClaimForbidden: ["Pierre est un DRH autonome"],
    sourceReport: "P14 / P8.13",
    lastVerifiedPhase: "P14",
  }),
  e({
    id: "pierre.launch_ready",
    section: "pierre",
    title: "Version de lancement prête",
    status: "verified_local_safe",
    whatExists: "Parcours complet prouvé E2E sur une vraie entreprise locale (P9.6) : onboarding → missions → validations → cockpit.",
    whatDoesNotExist: "Version ultime complète (12 items Pierre Ultimate classés P16A).",
    safeExplanation: "La version de lancement de Pierre est prête et prouvée de bout en bout en local.",
    commercialClaimAllowed: ["Pierre transforme les demandes RH en missions structurées."],
    commercialClaimForbidden: ["Pierre Ultimate est terminé"],
    sourceReport: "P9.6 / P16.0",
    lastVerifiedPhase: "P16.0",
  }),
  e({
    id: "pierre.ultimate_roadmap",
    section: "pierre",
    title: "Pierre Ultimate (approfondissements)",
    status: "roadmap",
    whatExists: "Plan P16A : 12 items (profondeur missions/documents, dossier 360, rapport de valeur mensuel, helpdesk…).",
    whatDoesNotExist: "Leur implémentation complète — c'est le prochain chantier.",
    safeExplanation: "Les approfondissements « Ultimate » de Pierre sont planifiés (P16A), pas encore construits.",
    commercialClaimAllowed: ["Une roadmap d'approfondissement claire existe."],
    commercialClaimForbidden: ["Les capacités Ultimate sont déjà disponibles"],
    sourceReport: "P16_0_PIERRE_ULTIMATE_AND_TECHNOLOGIES_MASTER_SPLIT_REPORT.md",
    lastVerifiedPhase: "P16.0",
  }),
  e({
    id: "pierre.hr_operational_preparation",
    section: "pierre",
    title: "Préparation RH opérationnelle",
    status: "verified_local_safe",
    whatExists: "Documents, e-mails, onboarding/offboarding, absences/pré-paie (variables), suivis — PRÉPARÉS et tracés, validations humaines sur le sensible.",
    whatDoesNotExist: "Exécution live vers l'extérieur (envoi, signature, connecteurs) tant que les providers ne sont pas vérifiés.",
    safeExplanation: "Pierre prépare et suit le travail RH opérationnel ; les décisions et envois sensibles restent chez vous.",
    commercialClaimAllowed: ["Pierre prépare des documents, e-mails, validations et suivis RH."],
    commercialClaimForbidden: ["Pierre envoie et signe tout seul"],
    sourceReport: "P8.13 / P14",
    lastVerifiedPhase: "P14",
  }),
  e({
    id: "pierre.no_final_legal_decision",
    section: "pierre",
    title: "Décisions légales/humaines finales",
    status: "forbidden_claim",
    whatExists: "Doctrine + planchers durs : décisions disciplinaires/salariales finales = HUMAN_ONLY (jamais automatisées).",
    whatDoesNotExist: "Toute prise de décision finale par Pierre seul.",
    safeExplanation: "Pierre ne remplace ni un juriste ni la responsabilité humaine : il prépare, vous décidez.",
    commercialClaimAllowed: ["Pierre garde les décisions sensibles sous validation humaine."],
    commercialClaimForbidden: ["Pierre prend les décisions disciplinaires finales", "Pierre décide seul"],
    sourceReport: "P14 (MUST_NOT_CLAIM)",
    lastVerifiedPhase: "P14",
  }),
  e({
    id: "pierre.no_full_payroll",
    section: "pierre",
    title: "Paie complète / DSN",
    status: "forbidden_claim",
    whatExists: "Préparation des VARIABLES de pré-paie uniquement.",
    whatDoesNotExist: "Moteur de paie, génération de bulletins, DSN — jamais revendiqués.",
    safeExplanation: "Pierre prépare la pré-paie ; il ne remplace pas un logiciel de paie.",
    commercialClaimAllowed: ["Pierre prépare les variables de pré-paie pour votre outil de paie."],
    commercialClaimForbidden: ["Pierre remplace un moteur de paie / logiciel DSN."],
    sourceReport: "P14 (MUST_NOT_CLAIM)",
    lastVerifiedPhase: "P14",
  }),
  e({
    id: "pierre.no_legal_guarantee",
    section: "pierre",
    title: "Garantie de conformité pays",
    status: "forbidden_claim",
    whatExists: "Moteur pays FR/BE/LU/CH fail-closed (P8.12) avec 276 règles jamais inventées — SANS verdict légal positif.",
    whatDoesNotExist: "Revue légale externe — donc aucune garantie de conformité, dans aucun pays.",
    safeExplanation: "Pierre est conçu pour le cadre FR/BE/LU/CH sans jamais prétendre à une conformité garantie sans revue externe.",
    commercialClaimAllowed: ["Une gouvernance stricte encadre les sujets sensibles pays."],
    commercialClaimForbidden: ["Pierre garantit la conformité légale."],
    sourceReport: "P8.12 / P14",
    lastVerifiedPhase: "P14",
  }),
]);

// ── C/D. Technologies — dérivées de la connaissance canonique ─────────────────
function techToTruth(section: "t1" | "t2") {
  const src = section === "t1" ? T1_TECHNOLOGY_KNOWLEDGE : T2_TECHNOLOGY_KNOWLEDGE;
  return src.map((k) =>
    e({
      id: `${section}.${k.id}`,
      section,
      title: k.name,
      status: k.currentStatus,
      whatExists: k.definition + " " + k.contains.join(" ; "),
      whatDoesNotExist: k.doesNotContain.join(" ; ") || "—",
      safeExplanation: k.clientExplanation,
      commercialClaimAllowed: k.canClaim,
      commercialClaimForbidden: k.cannotClaim,
      sourceReport: section === "t1" ? "T1_CLONESTORE_TECHNOLOGIES_LAYER_REPORT.md" : "T2_CLONESTORE_PRODUCT_TECHNOLOGIES_COMPLETION_REPORT.md",
      lastVerifiedPhase: section.toUpperCase(),
    }),
  );
}

export const T1_TRUTH: readonly TruthMatrixEntry[] = Object.freeze(techToTruth("t1"));
export const T2_TRUTH: readonly TruthMatrixEntry[] = Object.freeze(techToTruth("t2"));

// ── E. Blocages externes / live ───────────────────────────────────────────────
const blocker = (
  id: string,
  title: string,
  whatExists: string,
  whatDoesNotExist: string,
  safeExplanation: string,
): TruthMatrixEntry =>
  e({
    id: `ext.${id}`,
    section: "external_blockers",
    title,
    status: "external_blocked",
    whatExists,
    whatDoesNotExist,
    safeExplanation,
    commercialClaimAllowed: [],
    commercialClaimForbidden: [`« ${title} » présenté comme prêt/actif`],
    sourceReport: "P15 / P15.1 / P11",
    lastVerifiedPhase: "P15.1",
  });

export const EXTERNAL_BLOCKERS_TRUTH: readonly TruthMatrixEntry[] = Object.freeze([
  blocker(
    "stripe_live",
    "Activation du paiement (Stripe)",
    "Chaîne checkout/webhook/réconciliation construite, testée en mode test ; checklist propriétaire prête.",
    "Compte de paiement configuré et vérifié — le paiement en ligne reste fermé.",
    "Le paiement en ligne n'est pas encore ouvert ; la réservation fondateur ne demande aucun paiement.",
  ),
  blocker(
    "yousign_live",
    "Signature électronique (Yousign)",
    "Paquets de signature préparés + fallback circuit manuel documenté.",
    "Provider de signature vérifié (bloqué depuis P8.7.4).",
    "Les dossiers de signature sont préparés ; la signature suit votre circuit habituel.",
  ),
  blocker(
    "email_provider",
    "Provider e-mail",
    "Brouillons d'e-mails prêts à envoyer.",
    "Domaine/provider e-mail vérifié — aucun envoi automatique.",
    "Les e-mails sont préparés ; l'envoi reste chez vous.",
  ),
  blocker(
    "voice_provider",
    "Provider vocal",
    "Architecture d'entrée vocale (T1 voice + CloneVoice).",
    "Provider vocal vérifié — aucune voix opérationnelle.",
    "La voix viendra après vérification externe ; le texte reste la référence.",
  ),
  blocker(
    "telephony_provider",
    "Téléphonie",
    "CloneCall en safe local (sessions texte gouvernées).",
    "Provider télécom/audio vérifié + cadre légal validé — appels réels bloqués (double verrou).",
    "Aucun appel téléphonique réel ; les sessions CloneCall sont locales et gouvernées.",
  ),
  blocker(
    "push_provider",
    "Notifications push",
    "Rappels cockpit.",
    "Provider push — aucune notification téléphone.",
    "Les rappels vivent dans le cockpit.",
  ),
  blocker(
    "connectors",
    "Connecteurs SIRH / paie / Slack",
    "Cadre ConnectorTech + fallback export/import manuel.",
    "Connecteurs live vérifiés.",
    "Les échanges se font par exports maîtrisés en attendant les connecteurs certifiés.",
  ),
  blocker(
    "legal_tax",
    "Revue légale / fiscale externe",
    "Paquet de revue préparé (P15.1) ; registre d'artefacts légaux (P15).",
    "Revue externe réalisée (LEGAL_TAX_READY=false).",
    "La revue légale/fiscale externe est un prérequis assumé avant l'ouverture payante.",
  ),
  blocker(
    "monitoring",
    "Monitoring de production",
    "Contrat monitoring/rollback défini (P15).",
    "Provider de monitoring attesté.",
    "Pas d'ouverture sans surveillance de production digne de ce nom.",
  ),
  blocker(
    "owner_approval",
    "Sign-off propriétaire",
    "Gates d'attestation propriétaire fail-closed (P11).",
    "Attestation finale — et elle ne suffit JAMAIS seule (plancher P10).",
    "Même le propriétaire ne peut pas ouvrir la production par simple variable d'environnement.",
  ),
  blocker(
    "production_authorized",
    "PRODUCTION_AUTHORIZED",
    "Constante false (P10), plancher dur re-vérifié par P11/P15/P15.1/T1/T2.",
    "Toute voie d'activation par configuration.",
    "La production restera OFF jusqu'à une décision de code délibérée, jamais par accident.",
  ),
]);

// ── Matrice complète + helpers ────────────────────────────────────────────────
export const CLONECHAT_TRUTH_MATRIX: readonly TruthMatrixEntry[] = Object.freeze([
  ...CLONESTORE_TRUTH,
  ...PIERRE_TRUTH,
  ...T1_TRUTH,
  ...T2_TRUTH,
  ...EXTERNAL_BLOCKERS_TRUTH,
]);

export function truthEntryById(id: string): TruthMatrixEntry | null {
  return CLONECHAT_TRUTH_MATRIX.find((x) => x.id === id) ?? null;
}

export function truthEntriesBySection(section: TruthMatrixEntry["section"]): readonly TruthMatrixEntry[] {
  return CLONECHAT_TRUTH_MATRIX.filter((x) => x.section === section);
}

export function truthEntriesByStatus(status: TruthStatus): readonly TruthMatrixEntry[] {
  return CLONECHAT_TRUTH_MATRIX.filter((x) => x.status === status);
}

/** Ce qui est prêt (local sûr / démo) vs bloqué (externe) — pour réponses roadmap/founder. */
export function readyVsBlockedSummary(): { readonly ready: readonly string[]; readonly blocked: readonly string[] } {
  const ready = CLONECHAT_TRUTH_MATRIX.filter((x) =>
    ["verified_local_safe", "integration_ready", "demo_only"].includes(x.status),
  ).map((x) => x.title);
  const blocked = CLONECHAT_TRUTH_MATRIX.filter((x) => x.status === "external_blocked").map((x) => x.title);
  return { ready, blocked };
}
