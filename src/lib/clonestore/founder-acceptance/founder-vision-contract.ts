// src/lib/clonestore/founder-acceptance/founder-vision-contract.ts
// P13 §2 — La VISION FONDATEUR de Gaël, exprimée comme un CONTRAT PRODUIT testable.
// Ce module est PUR (aucune I/O, aucun appel réseau). Il ne construit rien : il DÉFINIT ce que
// « ressembler exactement à la vision » signifie, et fournit deux évaluateurs déterministes.
//
// P13 est une PORTE d'acceptation fondateur + de fit pays. Ce n'est PAS une phase de build, PAS un
// go-live, PAS une validation juridique. Rien ici n'active la production ni ne formule un conseil légal.

// ── Les 12 piliers de la vision (§2) ────────────────────────────────────────────
export type FounderPillarId =
  | "os_not_saas"                 // 1. CloneStore = OS d'employés IA, pas un dashboard SaaS
  | "pierre_is_employee"          // 2. Pierre = employé IA RH / équipe RH, pas un assistant
  | "bought_an_employee_feeling"  // 3. « j'ai acheté un employé IA qui travaille pour mon entreprise »
  | "cloneos_command_shell"       // 4. CloneOS = surface de commande / coquille OS de l'entreprise IA
  | "global_cockpit_dirigeant"    // 5. Global Cockpit = centre de commande du dirigeant
  | "pierre_cockpit_hr_desk"      // 6. Pierre Cockpit = bureau de travail RH de Pierre
  | "cloneroom_company_salon"     // 7. CloneRoom = salon de l'entreprise (CloneOS + Pierre + techs + empreinte + mémoire)
  | "mon_clonestore_admin_not_work" // 8. Mon CloneStore = gestion compte/admin, pas le travail
  | "simple_no_chaos"             // 9. Simple : pas de dashboard-scroll chaotique, pas d'action critique cachée
  | "responsive_all_screens"      // 10. Utilisable mobile 390 / tablette 768 / laptop 1280 / grand écran 1600+
  | "no_overclaim"                // 11. Ne surpromet pas (pas de conformité légale/fiscale finale, pas de faux « live »)
  | "pierre_launch_country_aware"; // 12. Pierre est conscient des pays de lancement FR/BE/LU/CH

export interface FounderVisionPillar {
  readonly id: FounderPillarId;
  readonly n: number;             // 1..12 (ordre §2)
  readonly title: string;
  readonly vision: string;        // ce que le fondateur veut RESSENTIR
  readonly evidenceHint: string;  // où/comment on le prouve (surface, contrat, preuve)
  readonly critical: boolean;     // un échec ici bloque l'acceptation (framing/2e cerveau/overclaim/prod)
}

export const FOUNDER_VISION_PILLARS: readonly FounderVisionPillar[] = [
  { id: "os_not_saas", n: 1, title: "Un OS, pas un SaaS", vision: "CloneStore n'est pas un dashboard SaaS classique — c'est un système d'exploitation pour employés IA.", evidenceHint: "/cockpit ouvre la console CloneOS (cos-root) et non une page marketing.", critical: false },
  { id: "pierre_is_employee", n: 2, title: "Pierre est un employé IA RH", vision: "Pierre n'est pas un assistant/chatbot/copilote — c'est un employé IA RH / une équipe RH opérationnelle.", evidenceHint: "Cadrage « Employé IA RH » ; aucun terme assistant/chatbot/copilote pour Pierre.", critical: true },
  { id: "bought_an_employee_feeling", n: 3, title: "« J'ai acheté un employé »", vision: "L'utilisateur ressent : « j'ai acheté un employé IA qui travaille pour mon entreprise ».", evidenceHint: "Pierre a un cockpit de travail (missions/validations/documents/preuves/autonomie), pas un simple chat.", critical: false },
  { id: "cloneos_command_shell", n: 4, title: "CloneOS = surface de commande", vision: "CloneOS ressemble à la surface de commande / coquille d'exploitation de l'entreprise IA.", evidenceHint: "Écran d'accueil /cockpit = composer CloneOS + suggestions + rail + contexte.", critical: false },
  { id: "global_cockpit_dirigeant", n: 5, title: "Global Cockpit = centre dirigeant", vision: "Le Global Cockpit ressemble au centre de commande du dirigeant.", evidenceHint: "Main-d'œuvre IA + missions + validations + risques/blocages + résultats récents + santé système.", critical: false },
  { id: "pierre_cockpit_hr_desk", n: 6, title: "Pierre Cockpit = bureau RH", vision: "Le Pierre Cockpit ressemble au bureau de travail / centre de commande RH de Pierre.", evidenceHint: "Vues P9.3 réelles : missions RH, validations, documents, preuves, activité, autonomie, composer.", critical: false },
  { id: "cloneroom_company_salon", n: 7, title: "CloneRoom = salon de l'entreprise", vision: "CloneRoom ressemble au salon de l'entreprise, où l'on parle à CloneOS, Pierre, technologies, empreinte et mémoire.", evidenceHint: "Rail participants (6) + un composer + identité d'émetteur + extraction d'action réelle vers Pierre.", critical: false },
  { id: "mon_clonestore_admin_not_work", n: 8, title: "Mon CloneStore = admin, pas travail", vision: "Mon CloneStore ressemble à la gestion compte/entreprise/admin, pas à l'espace de travail.", evidenceHint: "Surface distincte (cs-page, pas cos-root) : compte/facturation/pays/employés/… + lien vers le cockpit.", critical: false },
  { id: "simple_no_chaos", n: 9, title: "Simple, sans chaos", vision: "Le produit est simple : pas de dashboard-scroll chaotique, pas d'action critique cachée, pas de labyrinthe de pages.", evidenceHint: "Invariant no-page-scroll sur les surfaces cockpit ; navigation évidente (rail/bottom-nav).", critical: false },
  { id: "responsive_all_screens", n: 10, title: "Utilisable partout", vision: "L'expérience est réellement utilisable en mobile 390, tablette 768, laptop 1280 et grand écran 1600+.", evidenceHint: "Preuve navigateur : pas de débordement horizontal, pas de scroll de page, composer/contexte atteignables.", critical: false },
  { id: "no_overclaim", n: 11, title: "Ne surpromet pas", vision: "Le produit ne surpromet pas : aucune conformité légale/fiscale finale, aucune fausse autonomie, aucun faux « provider live ».", evidenceHint: "Aucune copie « conforme au droit … / validé avocat / TVA validée / Stripe live / production authorized » non encadrée.", critical: true },
  { id: "pierre_launch_country_aware", n: 12, title: "Conscient des pays de lancement", vision: "Pierre est conscient des pays de lancement FR/BE/LU/CH (prix/devise corrects, formulations sûres).", evidenceHint: "P10 pricing FR/BE/LU=449 EUR, CH=499 CHF ; copie pays sûre (préparer/proposer/à valider), jamais « conforme pays ».", critical: false },
];

// ── Critères d'acceptation / de rejet ────────────────────────────────────────────
export const FOUNDER_ACCEPTANCE_CRITERIA: readonly string[] = [
  "L'utilisateur connecté atterrit DANS CloneOS (/cockpit), pas sur une page marketing.",
  "Pierre est cadré « employé IA RH / équipe RH opérationnelle » avec un vrai bureau de travail.",
  "CloneOS oriente/coordonne ; Pierre exécute le RH (aucun 2e cerveau RH).",
  "Global Cockpit = centre dirigeant ; Pierre Cockpit = bureau RH ; CloneRoom = salon ; Mon CloneStore = admin — 4 ressentis distincts.",
  "Un message de CloneRoom peut devenir une mission Pierre (extraction d'action qui transporte le contenu).",
  "Utilisable en 390/768/1280/1600 sans débordement ni scroll de page sur le cockpit.",
  "Prix pays corrects : FR/BE/LU = 449 EUR, CH = 499 CHF.",
  "Les limites (légal/fiscal/provider/production) sont DIVULGUÉES honnêtement, jamais surpromises.",
];

export const FOUNDER_REJECTION_CRITERIA: readonly string[] = [
  "Pierre présenté comme assistant / chatbot / copilote.",
  "Un deuxième cerveau RH (logique RH réimplémentée hors du runtime V1).",
  "Une revendication de conformité légale/fiscale FINALE (droit FR/BE/LU/CH, validé avocat, TVA validée…).",
  "Une fausse revendication « provider live » (Yousign/Stripe live) alors que ce n'est pas le cas.",
  "L'activation de la production (PRODUCTION_AUTHORIZED true) dans le cadre de P13.",
  "Un pays de lancement mal tarifé (CH facturé en EUR, ou FR/BE/LU facturé en CHF).",
  "Un chaos d'usage : scroll de page dans le cockpit, débordement horizontal, action critique cachée.",
];

// ── Checklists (produit / pays) ──────────────────────────────────────────────────
export interface ChecklistItem { readonly key: string; readonly label: string; readonly pillar?: FounderPillarId }

export const PRODUCT_FEEL_CHECKLIST: readonly ChecklistItem[] = [
  { key: "lands_in_cloneos", label: "Connexion → atterrit dans CloneOS (/cockpit), pas de homepage marketing.", pillar: "os_not_saas" },
  { key: "cloneos_command_first", label: "Écran d'accueil = surface de commande CloneOS (composer + suggestions).", pillar: "cloneos_command_shell" },
  { key: "global_cockpit_dirigeant", label: "Global Cockpit montre main-d'œuvre/missions/validations/risques/résultats/santé.", pillar: "global_cockpit_dirigeant" },
  { key: "pierre_hr_desk", label: "Pierre Cockpit = bureau RH réel (missions/validations/documents/preuves/autonomie).", pillar: "pierre_cockpit_hr_desk" },
  { key: "pierre_framing_safe", label: "Pierre cadré « Employé IA RH », jamais assistant/chatbot/copilote.", pillar: "pierre_is_employee" },
  { key: "cloneroom_salon", label: "CloneRoom = salon (participants + un composer + extraction d'action réelle).", pillar: "cloneroom_company_salon" },
  { key: "mon_clonestore_distinct", label: "Mon CloneStore = admin distinct (cs-page, pas cos-root) + lien vers le cockpit.", pillar: "mon_clonestore_admin_not_work" },
  { key: "no_page_scroll", label: "Aucun scroll de page sur les surfaces cockpit (cos-root 100dvh).", pillar: "simple_no_chaos" },
  { key: "no_h_overflow", label: "Aucun débordement horizontal (390/768/1280/1600).", pillar: "responsive_all_screens" },
  { key: "mobile_reachable", label: "Mobile : bottom-nav, composer et contexte atteignables, Pierre/validations en 1–2 taps.", pillar: "responsive_all_screens" },
  { key: "no_footer_leak", label: "Le footer public ne fuit pas dans la console.", pillar: "simple_no_chaos" },
  { key: "no_overclaim", label: "Aucune surpromesse légale/fiscale/provider/production non encadrée.", pillar: "no_overclaim" },
];

export const COUNTRY_FIT_CHECKLIST: readonly ChecklistItem[] = [
  { key: "pricing_correct", label: "FR/BE/LU = 449 EUR ; CH = 499 CHF (P10 pricing).", pillar: "pierre_launch_country_aware" },
  { key: "currency_correct", label: "Devise correcte par pays (EUR vs CHF), jamais l'inverse.", pillar: "pierre_launch_country_aware" },
  { key: "unknown_country_required", label: "Pays inconnu → sélection requise (jamais l'offre la moins chère).", pillar: "pierre_launch_country_aware" },
  { key: "safe_hr_copy", label: "Pierre parle en « prépare/propose/structure/à valider » — jamais « conforme au droit pays ».", pillar: "no_overclaim" },
  { key: "legal_pending_disclosed", label: "Statut légal/fiscal PENDING divulgué (pas présenté comme final).", pillar: "no_overclaim" },
  { key: "provider_pending_disclosed", label: "Signature/provider PENDING divulgué (pas de faux « live »).", pillar: "no_overclaim" },
  { key: "documents_review_flagged", label: "Documents légaux affichés comme nécessitant une revue, pas silencieusement FR-only.", pillar: "no_overclaim" },
];

// ── Évaluateur : acceptation de la vision fondateur ──────────────────────────────
export interface FounderVisionInput {
  /** Ressentis produit observés (preuve navigateur + revue de code). */
  readonly signals: Partial<Record<string, boolean>>; // clés = PRODUCT_FEEL_CHECKLIST.key
  /** Déclencheurs de rejet DUR (doivent être false pour accepter). */
  readonly rejections?: {
    readonly pierreFramedAsAssistant?: boolean;
    readonly secondHrBrain?: boolean;
    readonly legalOverclaim?: boolean;
    readonly fakeProviderLive?: boolean;
    readonly productionEnabled?: boolean;
    readonly countryMispriced?: boolean;
    readonly usageChaos?: boolean;
  };
}

export interface FounderVisionResult {
  readonly accepted: boolean;
  readonly blocked: boolean;
  readonly blockers: string[];       // déclencheurs de rejet DUR rencontrés
  readonly unmet: string[];          // items de checklist non satisfaits (non bloquants seuls)
  readonly satisfiedCount: number;
  readonly totalSignals: number;
  readonly note: string;
}

const REJECTION_LABELS: Record<string, string> = {
  pierreFramedAsAssistant: "Pierre cadré comme assistant/chatbot/copilote (interdit).",
  secondHrBrain: "Deuxième cerveau RH détecté (interdit).",
  legalOverclaim: "Revendication de conformité légale/fiscale finale (interdit).",
  fakeProviderLive: "Fausse revendication provider live (interdit).",
  productionEnabled: "Production activée dans P13 (interdit).",
  countryMispriced: "Pays de lancement mal tarifé (interdit).",
  usageChaos: "Chaos d'usage : scroll de page / débordement / action cachée (interdit).",
};

/**
 * Décide si le produit « ressemble à la vision ». RÈGLE : tout déclencheur de rejet DUR → blocked.
 * Sinon accepté si ≥ 80% des signaux de PRODUCT_FEEL_CHECKLIST sont satisfaits (les manques
 * restants sont listés dans `unmet` pour la revue fondateur). Pur, déterministe.
 */
export function evaluateFounderVisionAcceptance(input: FounderVisionInput): FounderVisionResult {
  const rej = input.rejections ?? {};
  const blockers: string[] = [];
  for (const [k, v] of Object.entries(rej)) if (v === true && REJECTION_LABELS[k]) blockers.push(REJECTION_LABELS[k]);

  const keys = PRODUCT_FEEL_CHECKLIST.map((c) => c.key);
  const unmet = keys.filter((k) => input.signals[k] !== true).map((k) => PRODUCT_FEEL_CHECKLIST.find((c) => c.key === k)!.label);
  const satisfiedCount = keys.length - unmet.length;

  const blocked = blockers.length > 0;
  const enoughSignals = satisfiedCount >= Math.ceil(keys.length * 0.8);
  const accepted = !blocked && enoughSignals;

  return {
    accepted,
    blocked,
    blockers,
    unmet,
    satisfiedCount,
    totalSignals: keys.length,
    note: blocked
      ? "Rejet DUR : la vision fondateur ne peut pas être acceptée tant qu'un déclencheur critique est présent."
      : accepted
        ? "Ressenti produit conforme à la vision fondateur (aucun déclencheur de rejet, signaux suffisants)."
        : "Techniquement fonctionnel mais signaux de ressenti insuffisants → revue fondateur requise.",
  };
}

// ── Évaluateur : acceptation du fit pays (résumé) ────────────────────────────────
// La logique détaillée par pays vit dans launch-country-fit.ts ; ici on statue sur l'AGRÉGAT en
// respectant la règle P13 : le go-live externe (legal/tax/provider/launch) PEUT rester bloqué sans
// bloquer l'acceptation produit, MAIS toute SURPROMESSE (overclaim) ou tarification erronée bloque.
export interface CountryFitAcceptanceInput {
  readonly countries: ReadonlyArray<{
    readonly country: string;
    readonly product_ready: boolean;
    readonly pricing_ready: boolean;
    readonly currency_correct: boolean;
    readonly unsafe_copy: boolean;          // overclaim détecté → bloquant
    readonly disclaimers_present: boolean;  // divulgations pending présentes
  }>;
}

export interface CountryFitAcceptanceResult {
  readonly accepted: boolean;
  readonly blocked: boolean;
  readonly blockers: string[];
  readonly warnings: string[];
  readonly note: string;
}

/**
 * Fit pays accepté si, pour CHAQUE pays de lancement : produit prêt + prix/devise corrects +
 * AUCUN overclaim + divulgations présentes. legal/tax/provider/launch PENDING sont attendus et
 * n'empêchent PAS l'acceptation (P13 n'est pas un go-live) — tant qu'ils sont divulgués, pas surpromis.
 */
export function evaluateCountryFitAcceptance(input: CountryFitAcceptanceInput): CountryFitAcceptanceResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (input.countries.length === 0) blockers.push("Aucun pays de lancement évalué.");
  for (const c of input.countries) {
    if (c.unsafe_copy) blockers.push(`${c.country} : surpromesse légale/pays détectée (interdit).`);
    if (!c.pricing_ready) blockers.push(`${c.country} : tarification non prête.`);
    if (!c.currency_correct) blockers.push(`${c.country} : devise incorrecte.`);
    if (!c.product_ready) warnings.push(`${c.country} : produit non entièrement prêt.`);
    if (!c.disclaimers_present) warnings.push(`${c.country} : divulgations pending manquantes (à afficher).`);
  }
  const blocked = blockers.length > 0;
  return {
    accepted: !blocked,
    blocked,
    blockers,
    warnings,
    note: blocked
      ? "Fit pays BLOQUÉ : corriger tarification/devise/surpromesses avant acceptation pays."
      : "Fit pays crédible pour FR/BE/LU/CH SANS prétendre que la validation légale est terminée (items externes divulgués comme pending).",
  };
}

/** Le contrat de vision est-il complet et cohérent ? (12 piliers, ids uniques, 2 piliers critiques ≥). Pur. */
export function founderVisionContractComplete(): boolean {
  const ids = new Set(FOUNDER_VISION_PILLARS.map((p) => p.id));
  const critical = FOUNDER_VISION_PILLARS.filter((p) => p.critical).length;
  return (
    FOUNDER_VISION_PILLARS.length === 12 &&
    ids.size === 12 &&
    critical >= 2 &&
    FOUNDER_ACCEPTANCE_CRITERIA.length >= 6 &&
    FOUNDER_REJECTION_CRITERIA.length >= 5 &&
    PRODUCT_FEEL_CHECKLIST.length >= 10 &&
    COUNTRY_FIT_CHECKLIST.length >= 5
  );
}
