// src/lib/clonestore/pierre-journey/journey-contract.ts
// P9.6 — CONTRAT canonique du PARCOURS PRODUIT de Pierre (bout en bout).
//
// Décrit — de façon vérifiable — le vrai chemin client :
//   onboarding entreprise → empreinte → réglage autonomie → CloneChat → mission Pierre →
//   cockpit → preuves → validations → résultat → reload/resume.
// Ce module NE contient AUCUNE logique RH (pas de 2e cerveau) : c'est la définition du parcours,
// des surfaces UI, des points de preuve API, des invariants de sécurité, et des raccourcis
// de test AUTORISÉS / INTERDITS. Pure TS → utilisable côté client + tests + preuve navigateur.

export type JourneyPhase = "setup" | "config" | "conversation" | "execution" | "cockpit" | "persistence";

export type JourneyStepId =
  | "access"            // 1. l'utilisateur a l'accès Pierre
  | "company"           // 2. l'entreprise existe (UUID valide)
  | "membership"        // 3. l'utilisateur est membre avec permissions
  | "footprint"         // 4. empreinte/onboarding minimum pour opérer
  | "autonomy"          // 5. le mode d'autonomie est choisi (persisté P8)
  | "chat_request"      // 6. CloneChat accepte une demande RH naturelle
  | "proposal"          // 7. proposition PERSISTÉE côté serveur
  | "confirm"           // 8. confirmation humaine si le mode l'exige
  | "execute"           // 9. /execute n'envoie que { proposalId }
  | "mission_created"   // 10. P8 crée la mission avec le bon autonomy_mode
  | "cockpit_mission"   // 11. la mission apparaît dans le cockpit Pierre
  | "cockpit_evidence"  // 12. statut / validations / preuves (ou état d'attente honnête)
  | "validation"        // 13. le chemin de validation humaine fonctionne si requis
  | "result_persist"    // 14. le résultat apparaît et survit au reload
  | "no_double_execute" // 15. doublon/reload/resume ne double-exécutent pas
  | "audit_trail";      // 16. une trace d'audit/preuve existe

export interface JourneyStep {
  readonly id: JourneyStepId;
  readonly order: number;
  readonly phase: JourneyPhase;
  readonly label: string;
  readonly uiSurface: string;      // où, dans le produit, l'étape se manifeste
  readonly apiProofPoint: string;  // le point de preuve API/réseau à observer
  readonly securityInvariant?: string;
}

export const JOURNEY_STEPS: readonly JourneyStep[] = [
  { id: "access", order: 1, phase: "setup", label: "Accès Pierre actif", uiSurface: "/agents/pierre/use (access gate)", apiProofPoint: "GET /api/checkout?agent_slug=pierre → active" },
  { id: "company", order: 2, phase: "setup", label: "Entreprise réelle (UUID valide)", uiSurface: "cockpit header", apiProofPoint: "companyResolved:true (V1 company résolue, UUID)" , securityInvariant: "aucune fausse entreprise ; jamais u:<userId>" },
  { id: "membership", order: 3, phase: "setup", label: "Membre avec permissions", uiSurface: "cockpit", apiProofPoint: "GET /api/pierre/v1/company 200 (membership re-vérifié P8)", securityInvariant: "P8 re-vérifie le membership sur chaque mutation" },
  { id: "footprint", order: 4, phase: "setup", label: "Empreinte / onboarding minimum", uiSurface: "cockpit readiness + /profile/onboarding", apiProofPoint: "readiness state honnête (bloque seulement si nécessaire)" },
  { id: "autonomy", order: 5, phase: "config", label: "Mode d'autonomie choisi", uiSurface: "cockpit → Autonomie", apiProofPoint: "POST /api/assistant/autonomy {productModeId} → PATCH P8 default_autonomy_mode ; GET reflète", securityInvariant: "client envoie productModeId SEUL ; pas d'engineMode forgé" },
  { id: "chat_request", order: 6, phase: "conversation", label: "Demande RH naturelle", uiSurface: "/assistant (CloneChat)", apiProofPoint: "POST /api/assistant/chat (openai réel gouverné)" },
  { id: "proposal", order: 7, phase: "conversation", label: "Proposition persistée serveur", uiSurface: "bulle CloneChat (bouton Confirmer)", apiProofPoint: "réponse chat → proposal.id + proposal.autonomy (mode reflété)", securityInvariant: "payload canonique dérivé serveur, jamais client" },
  { id: "confirm", order: 8, phase: "conversation", label: "Confirmation humaine si requise", uiSurface: "clic « Confirmer »", apiProofPoint: "le mode reflété correspond au mode d'entreprise" },
  { id: "execute", order: 9, phase: "execution", label: "Exécution par référence", uiSurface: "confirmation", apiProofPoint: "POST /api/assistant/execute body = { proposalId } UNIQUEMENT", securityInvariant: "aucun payload/companyId/fingerprint/autonomyMode envoyé par le client" },
  { id: "mission_created", order: 10, phase: "execution", label: "Mission P8 créée (bon autonomy_mode)", uiSurface: "—", apiProofPoint: "V1 createMission appelé avec autonomy_mode = mode d'entreprise ; mission_id réel", securityInvariant: "autonomy_mode résolu serveur depuis la proposition persistée" },
  { id: "cockpit_mission", order: 11, phase: "cockpit", label: "Mission visible dans le cockpit", uiSurface: "/agents/pierre/use?view=missions", apiProofPoint: "la mission créée apparaît (deep-link mission=<id>)" },
  { id: "cockpit_evidence", order: 12, phase: "cockpit", label: "Statut / validations / preuves (ou attente honnête)", uiSurface: "détail mission + Validations + Documents", apiProofPoint: "statut mission + validations + artefacts OU état pending honnête" },
  { id: "validation", order: 13, phase: "cockpit", label: "Chemin de validation humaine si requis", uiSurface: "cockpit → Validations", apiProofPoint: "approve/reject/request_changes fonctionne, ou N/A honnête", securityInvariant: "gardes dures P8 (restreint/humain-seul) jamais bypassées" },
  { id: "result_persist", order: 14, phase: "persistence", label: "Résultat survit au reload", uiSurface: "cockpit après reload", apiProofPoint: "mission + statut re-lus depuis le serveur après reload" },
  { id: "no_double_execute", order: 15, phase: "persistence", label: "Pas de double exécution", uiSurface: "re-confirmer / reload / resume", apiProofPoint: "re-confirmer renvoie le résultat EXISTANT ; 1 seule mission", securityInvariant: "registre de commandes SHA-256 + lease fencing (P9.4.2)" },
  { id: "audit_trail", order: 16, phase: "persistence", label: "Trace d'audit / preuve", uiSurface: "cockpit → Activité (timeline) ", apiProofPoint: "timeline mission / événements P8 présents" },
];

export const SECURITY_INVARIANTS: readonly string[] = [
  "aucune fausse entreprise (companyResolved:true, UUID réel) — jamais le repli u:<userId> pour la preuve principale",
  "aucune fausse autonomie (mode moteur résolu serveur depuis la colonne P8 ; jamais forgé par le client)",
  "exécution par référence : /execute reçoit { proposalId } uniquement — aucun payload/company/fingerprint/autonomyMode client",
  "pas de double exécution (registre SHA-256 + fencing) ; re-confirmer renvoie l'existant",
  "gardes dures P8 (restreint / réservé humain / légal / fournisseur) jamais bypassées, quel que soit le mode",
  "P8 gouverne : logique RH, exécution, validation, preuves ; CloneChat reste interface/proposition/pont cockpit",
];

export const ALLOWED_TEST_SHORTCUTS: readonly string[] = [
  "isolated Next distDir (NEXT_DIST_DIR) — ne touche pas le .next partagé / serveur P8 :3000",
  "runtime V1 LOCAL en E2E (PIERRE_E2E_TEST_MODE=1, PGlite in-process) — jamais la production",
  "utilisateur Supabase éphémère (nettoyé, zéro résidu)",
  "entreprise de test LOCALE avec UUID valide + membership + entitlement + accès Pierre",
  "fixtures d'empreinte entreprise locales",
  "fournisseurs simulés uniquement s'ils sont clairement marqués LOCAL/TEST (jamais production)",
];

export const FORBIDDEN_SHORTCUTS: readonly string[] = [
  "repli u:<userId> comme entreprise pour la preuve de succès principale",
  "preuve navigateur avec companyResolved:false comme SEULE preuve",
  "mission fictive uniquement front-end",
  "contournement de /api/assistant/execute",
  "insertion DB directe pour prétendre qu'une mission a été créée (sauf données de SETUP claires)",
  "appeler Pierre un « assistant » / « copilote »",
  "créer un 2e cerveau RH dans CloneChat",
  "activer la production / appliquer une migration prod / utiliser de vraies données client",
];

export interface JourneyContract {
  readonly steps: readonly JourneyStep[];
  readonly invariants: readonly string[];
  readonly allowed: readonly string[];
  readonly forbidden: readonly string[];
}
export function journeyContract(): JourneyContract {
  return { steps: JOURNEY_STEPS, invariants: SECURITY_INVARIANTS, allowed: ALLOWED_TEST_SHORTCUTS, forbidden: FORBIDDEN_SHORTCUTS };
}

const ALL_IDS = new Set(JOURNEY_STEPS.map((s) => s.id));
/** Le contrat couvre-t-il toutes les étapes obligatoires ? (ordre 1..16, sans trou). */
export function isContractComplete(): boolean {
  const orders = JOURNEY_STEPS.map((s) => s.order).sort((a, b) => a - b);
  return ALL_IDS.size === 16 && orders.every((o, i) => o === i + 1);
}
/** Un ensemble d'étapes prouvées couvre-t-il tout le parcours ? */
export function coveredSteps(proven: readonly JourneyStepId[]): { complete: boolean; missing: JourneyStepId[] } {
  const set = new Set(proven);
  const missing = JOURNEY_STEPS.filter((s) => !set.has(s.id)).map((s) => s.id);
  return { complete: missing.length === 0, missing };
}
