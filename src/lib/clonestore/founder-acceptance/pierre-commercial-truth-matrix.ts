// src/lib/clonestore/founder-acceptance/pierre-commercial-truth-matrix.ts
// P14 §4 — Matrice de VÉRITÉ COMMERCIALE. Définit ce qui PEUT être revendiqué (fort / avec prudence)
// et ce qui est INTERDIT, plus un vérificateur de sûreté de claim + des générateurs de langage de
// vente honnête (lancement / fondateur / site). Module PUR. Aligne le discours sur les preuves P8–P13.

export type ClaimSafety = "allowed_strong" | "allowed_caution" | "forbidden" | "unknown_review";

// ── Claims FORTS autorisés (soutenus par preuves P8–P13) ──────────────────────────
export const ALLOWED_STRONG_CLAIMS: readonly string[] = [
  "Pierre est un employé IA RH.",
  "Pierre n'est pas un assistant ni un chatbot.",
  "Pierre transforme les demandes RH en missions structurées.",
  "Pierre prépare des documents, e-mails, validations et suivis RH.",
  "Pierre centralise le travail RH dans un cockpit.",
  "Pierre conserve trace et historique.",
  "Pierre supporte une autonomie contrôlée.",
  "Pierre aide à réduire la charge RH quotidienne.",
  "Pierre peut absorber une grande partie de l'exécution RH opérationnelle.",
  "Pierre garde les décisions sensibles sous validation humaine.",
  "Pierre est conçu pour être plus rapide, plus régulier et plus traçable qu'une équipe humaine sur le travail RH répétitif et opérationnel.",
  "Pierre coûte 449 € / mois en France, Belgique et Luxembourg, et 499 CHF / mois en Suisse.",
];

// ── Claims autorisés AVEC PRUDENCE ────────────────────────────────────────────────
export const ALLOWED_CAUTION_CLAIMS: readonly string[] = [
  "Pierre peut remplacer une grande partie de l'exécution RH quotidienne.",
  "Pierre peut agir comme une équipe RH opérationnelle sur le travail numérique, répétitif, documentaire, de suivi et de coordination.",
  "Pierre peut faire gagner de nombreuses heures par mois.",
  "Pierre peut revenir moins cher que d'embaucher ou de maintenir une capacité d'exécution RH.",
];

// ── Claims INTERDITS (jamais, sans preuve externe / par doctrine) ─────────────────
export const FORBIDDEN_CLAIMS: readonly string[] = [
  "Pierre remplace toute la RH.",
  "Pierre remplace la responsabilité légale.",
  "Pierre garantit la conformité légale.",
  "Pierre prend les décisions disciplinaires finales.",
  "Pierre décide seul des licenciements, sanctions, décisions salariales sensibles ou promotions.",
  "Pierre remplace un moteur de paie / logiciel DSN.",
  "Pierre est pleinement adapté juridiquement à la Suisse / Belgique / Luxembourg sans revue externe.",
  "Pierre est en production live.",
  "Pierre dispose de Stripe / Yousign live vérifiés.",
  "Pierre est parfait / sans erreur.",
  "Pierre ne nécessite aucune validation humaine.",
  "Pierre est un DRH autonome.",
];

// Motifs déclencheurs d'interdiction — ROBUSTES aux reformulations/synonymes (review P14).
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  // Remplacement total de la RH / des ressources humaines / DRH (synonymes couverts).
  /remplace[^.]{0,30}(toute la rh|l'ensemble de la rh|100\s*% (de )?la rh|tout(e)? la rh|ressources humaines|(votre|une|l'|la|toute la) (équipe|fonction|service|direction) rh|votre drh|le drh|un drh|la fonction rh|toute la fonction rh)/i,
  /remplace (la |une |toute )?responsabilité (légale|juridique|humaine|managériale|disciplinaire)/i,
  // Conformité GARANTIE/ASSURÉE (légale, juridique, RGPD, fiscale, sociale, réglementaire…).
  /(garanti[et]?|garantir|assure|assurer|assur[ée]s?)[^.]{0,25}(conformité|conforme|mise en conformité)/i,
  /(conformité|mise en conformité)[^.]{0,20}(garanti|assur[ée]|100\s*%)/i,
  /conforme au droit (suisse|belge|luxembourgeois|français)/i,
  /100\s*% conforme|aucun risque (légal|juridique)|sans risque (légal|juridique)/i,
  // Décisions sensibles finales prises SEUL / automatiquement (verbes synonymes).
  /(décide|tranche|statue|arbitre|prononce)[^.]{0,15}\bseul/i,
  /(licenci|sanctionn?|renvoi|met[s]? à pied|rétrograd)[^.]{0,20}(seul|automatiquement|sans validation|de façon autonome)/i,
  /décisions? (disciplinaires?|de licenciement|de sanction|salariales?|de promotion)s?[^.]{0,15}(finales?|automatiques?|seul|autonomes?)/i,
  // Paie / DSN / bulletins (remplacement ou exécution complète).
  /remplace[^.]{0,25}\b(moteur de paie|logiciel (de |officiel de )?paie|logiciel dsn|dsn|paie officiel)/i,
  /(gère|calcule|traite|édite|génère|produit|établit)[^.]{0,20}(la paie|toute la paie|les? bulletins|des bulletins|bulletins? de (paie|salaire)|la dsn|les fiches de paie)/i,
  /(moteur de )?paie compl[èe]te?|bulletins? de paie (certifiés?|officiels?)/i,
  // Live/production/perfection/aucune validation/DRH autonome/assistant.
  /production (live|activée|autorisée)|stripe live|yousign live/i,
  /parfait|sans erreur|zéro erreur|zero.?error/i,
  /aucune validation humaine|sans validation humaine|100\s*% autonome/i,
  /drh (autonome|complet|automatique)|remplace (le |un |votre )?drh/i,
  /assistant|chatbot|copilote/i, // Pierre n'est PAS un assistant (framing interdit)
];

// Signaux SENSIBLES : si présents et non catalogués comme approuvés, on N'AUTORISE PAS « avec prudence »
// (on renvoie unknown_review = revue humaine obligatoire), même si un verbe opérationnel apparaît.
const SENSITIVE_SIGNALS = /remplace|remplacer|\bseul(e)?\b|tranche|statue|arbitre|prononce|paie\b|bulletin|dsn|conformité|conforme|licenci|sanction|disciplinaire|\bdrh\b|ressources humaines|promotion|augmentation salariale|responsabilité (légale|juridique|humaine)|juridiquement|légalement/i;

/** Évalue la sûreté d'un claim libre. Les listes EXACTES priment (une formulation approuvée qui NIE un
 *  interdit — « n'est pas un assistant » — ne doit pas être bloquée par le motif « assistant »). Ensuite
 *  motifs interdits (robustes aux reformulations affirmatives), puis heuristiques prudentes. Pur. */
export function evaluateClaimSafety(claim: unknown): { safety: ClaimSafety; matched: string | null; reason: string } {
  if (typeof claim !== "string" || !claim.trim()) return { safety: "unknown_review", matched: null, reason: "Claim vide — revue requise." };
  const c = claim.trim();
  const lc = c.toLowerCase();
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

  // 1) Listes exactes (approuvées d'abord — priment sur les motifs).
  if (ALLOWED_STRONG_CLAIMS.some((f) => norm(f) === norm(c))) return { safety: "allowed_strong", matched: c, reason: "Claim fort autorisé (soutenu par preuves)." };
  if (ALLOWED_CAUTION_CLAIMS.some((f) => norm(f) === norm(c))) return { safety: "allowed_caution", matched: c, reason: "Claim autorisé avec prudence." };
  if (FORBIDDEN_CLAIMS.some((f) => norm(f) === norm(c))) return { safety: "forbidden", matched: c, reason: "Claim explicitement interdit." };

  // 2) Motifs interdits (formulation affirmative). On neutralise d'abord les segments de NÉGATION
  //    explicites (« ne remplace pas », « n'est pas un assistant », « ne garantit pas », « sans… seul »)
  //    pour éviter les faux positifs sur une phrase qui NIE l'interdit.
  const affirmative = c
    .replace(/n['’]est pas[^.,;]*/gi, "")
    .replace(/ne\s+\w+\s+pas[^.,;]*/gi, "")
    .replace(/ne\s+remplace\s+pas[^.,;]*/gi, "")
    .replace(/ne\s+garantit\s+pas[^.,;]*/gi, "")
    .replace(/ne\s+se\s+substitue\s+pas[^.,;]*/gi, "")
    .replace(/jamais[^.,;]*/gi, "");
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.test(affirmative)) return { safety: "forbidden", matched: p.source, reason: "Correspond à un motif de claim INTERDIT (jamais revendiquer sans preuve externe / par doctrine)." };
  }

  // 3) Garde SENSIBLE : un claim qui contient un signal sensible (remplace/seul/paie/conformité/DRH/…)
  //    mais qui a échappé aux motifs interdits NE PEUT PAS être approuvé « avec prudence » — il exige
  //    une revue humaine (unknown_review). Empêche l'heuristique opérationnelle de blanchir un interdit reformulé.
  if (SENSITIVE_SIGNALS.test(affirmative))
    return { safety: "unknown_review", matched: null, reason: "Contient un signal sensible (remplacement/décision seule/paie/conformité/DRH) non catalogué — revue humaine OBLIGATOIRE avant toute publication." };

  // 4) Heuristiques positives prudentes (uniquement si AUCUN signal sensible).
  if (/aide|réduire|structur|prépar|suivi|coordination|cockpit|trace|autonomie contrôlée/i.test(lc))
    return { safety: "allowed_caution", matched: null, reason: "Formulation opérationnelle prudente — probablement acceptable, à revoir." };
  return { safety: "unknown_review", matched: null, reason: "Claim non catalogué — revue humaine requise avant publication." };
}

// ── Générateurs de langage de vente honnête ──────────────────────────────────────
export function generateLaunchSalesLanguage(): string {
  return [
    "Pierre est votre employé IA RH : il transforme vos demandes RH en missions structurées,",
    "prépare vos documents, e-mails, validations et relances, et centralise tout dans un cockpit avec historique et preuves.",
    "Il absorbe une grande partie de l'exécution RH opérationnelle quotidienne — tout en gardant les décisions sensibles sous votre validation.",
    "449 € / mois (France, Belgique, Luxembourg) · 499 CHF / mois (Suisse).",
  ].join(" ");
}

export function generateFounderSalesLanguage(): string {
  return [
    "Ne comparez pas Pierre à un outil IA généraliste : comparez-le à la charge RH opérationnelle qu'il absorbe.",
    "Pierre n'est pas un assistant : c'est un employé IA RH qui prend en charge le travail répétitif, documentaire, de suivi et de coordination,",
    "plus vite, de façon plus régulière et plus traçable qu'une exécution humaine sur ces tâches.",
    "Il ne remplace PAS la responsabilité finale humaine, légale, disciplinaire ou managériale — et ne prétend pas à une conformité légale garantie.",
    "C'est un employé opérationnel puissant, sous contrôle humain.",
  ].join(" ");
}

export function generateWebsiteSafeCopy(): { headline: string; sub: string; disclaimer: string } {
  return {
    headline: "Pierre — votre employé IA RH opérationnel",
    sub: "Il transforme vos demandes en missions, prépare vos documents et suivis RH, centralise tout dans un cockpit tracé — et garde les décisions sensibles sous votre validation.",
    disclaimer: "Pierre assiste l'exécution RH opérationnelle ; il ne remplace pas la responsabilité finale humaine/légale, ne garantit pas la conformité juridique et ne se substitue pas à un logiciel de paie. Validation humaine requise sur les actes sensibles.",
  };
}

/** Toutes les copies générées sont-elles sûres (aucun motif interdit) ? Pur. */
export function generatedCopyIsSafe(): boolean {
  const texts = [generateLaunchSalesLanguage(), generateFounderSalesLanguage(), JSON.stringify(generateWebsiteSafeCopy())];
  return texts.every((t) => {
    // Le langage fondateur cite des interdits pour les NIER (« ne remplace PAS », « ne prétend pas ») :
    // on vérifie qu'aucun motif interdit n'apparaît en formulation AFFIRMATIVE. Heuristique : on retire
    // les segments de négation explicites avant de tester.
    const affirmative = t
      .replace(/ne remplace pas[^.]*\./gi, "")
      .replace(/ne prétend pas[^.]*\./gi, "")
      .replace(/ne se substitue pas[^.]*\./gi, "")
      .replace(/ne remplace PAS[^.]*/gi, "")
      .replace(/n'est pas un assistant[^.]*/gi, "")
      .replace(/sous (votre |contrôle )?validation[^.]*/gi, "")
      .replace(/garde les décisions sensibles[^.]*/gi, "");
    return !FORBIDDEN_PATTERNS.some((p) => p.test(affirmative));
  });
}
