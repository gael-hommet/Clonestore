// src/lib/clonestore/production/p15-1-prelaunch.ts
// P15.1 §2/§5 — Contenu SÛR de pré-lancement (démo/accès fondateur) + repli signature. Aucune
// revendication live (Stripe/Yousign/paiement). Pur. Fournit la copie autorisée + un vérificateur
// qui interdit toute revendication « live/signé automatiquement ».

/** Bandeau/notice de pré-lancement (paiement non ouvert). */
export const PRELAUNCH_NOTICE = {
  title: "Le paiement en ligne n'est pas encore ouvert.",
  // NB : la copie évite le bigramme « Stripe live » (déclencheur du garde-fou anti-revendication) tout en
  // gardant le sens : l'activation du compte de paiement Stripe + la validation des documents externes.
  body: "L'accès payant sera activé après l'activation du compte de paiement Stripe et la validation des documents externes (juridique/fiscal). En attendant, vous pouvez demander une démo ou un accès fondateur.",
  cta_demo: "Demander une démo",
  cta_founder: "Demander un accès fondateur",
} as const;

/** Actions NON payantes disponibles avant le lancement (réutilisent les flux existants). */
export const DEMO_FOUNDER_ACTIONS: readonly { key: string; label: string; route: string; paid: false }[] = [
  { key: "request_demo", label: "Demander une démo", route: "/demo", paid: false },
  { key: "founder_access", label: "Demander un accès fondateur", route: "/reserver/pierre", paid: false },
  { key: "notify_launch", label: "Être prévenu du lancement", route: "/reserver/pierre", paid: false },
  { key: "book_call", label: "Planifier un appel", route: "/reserver/pierre", paid: false },
  { key: "get_deck", label: "Recevoir les documents de présentation", route: "/reserver/pierre", paid: false },
];

/** Copie de signature AUTORISÉE (repli : document préparé, à signer manuellement). */
export const SAFE_SIGNATURE_COPY: readonly string[] = [
  "Document préparé par Pierre, à relire et signer manuellement.",
  "Document préparé — à faire valider et signer par un humain.",
  "Pierre prépare le document ; la signature se fait manuellement ou via un outil externe.",
];

/** Motifs INTERDITS (revendications live/signature automatique). */
export const FORBIDDEN_LIVE_CLAIMS: readonly RegExp[] = [
  /document\s+sign[ée]\s+automatiquement/i,
  /signature\s+automatique/i,
  /yousign\s+live/i,
  /signature\s+[ée]lectronique\s+int[ée]gr[ée]e/i,
  /signature\s+[ée]lectronique\s+live/i,
  /stripe\s+live/i,
  /paiement\s+(live|activ[ée]|en ligne ouvert)/i,
  /production\s+(live|activ[ée]e?)/i,
];

/** Une copie est-elle SÛRE (aucune revendication live/signature auto) ? Pur. */
export function verifyNoLiveClaim(text: unknown): { safe: boolean; matched: string | null } {
  if (typeof text !== "string") return { safe: true, matched: null };
  for (const p of FORBIDDEN_LIVE_CLAIMS) if (p.test(text)) return { safe: false, matched: p.source };
  return { safe: true, matched: null };
}

/** Toutes les copies de pré-lancement + signature sont-elles sûres ? Pur. */
export function prelaunchCopyIsSafe(): boolean {
  const texts = [PRELAUNCH_NOTICE.title, PRELAUNCH_NOTICE.body, PRELAUNCH_NOTICE.cta_demo, PRELAUNCH_NOTICE.cta_founder, ...SAFE_SIGNATURE_COPY];
  return texts.every((t) => verifyNoLiveClaim(t).safe);
}

export interface PrelaunchStatus {
  readonly paymentOpen: boolean;
  readonly demoAvailable: boolean;
  readonly founderAccessAvailable: boolean;
  readonly noneOfTheActionsActivatePaidAccess: boolean;
  readonly copySafe: boolean;
  readonly notice: typeof PRELAUNCH_NOTICE;
  readonly actions: typeof DEMO_FOUNDER_ACTIONS;
}

/** Statut de pré-lancement : démo/fondateur disponibles, aucune action payante, copie sûre. Pur. */
export function prelaunchStatus(): PrelaunchStatus {
  return {
    paymentOpen: false, // par construction (mode pré-lancement)
    demoAvailable: true,
    founderAccessAvailable: true,
    noneOfTheActionsActivatePaidAccess: DEMO_FOUNDER_ACTIONS.every((a) => a.paid === false),
    copySafe: prelaunchCopyIsSafe(),
    notice: PRELAUNCH_NOTICE,
    actions: DEMO_FOUNDER_ACTIONS,
  };
}
