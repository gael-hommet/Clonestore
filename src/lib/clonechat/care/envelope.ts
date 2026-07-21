// src/lib/clonechat/care/envelope.ts
// C1.8 §4/§6/§7 — L'ENVELOPPE DE SUPPORT attachée à CHAQUE réponse de la route canonique.
//
// Elle est ADDITIVE : elle n'altère aucune réponse existante (C1.6 / C1.7 intacts). Elle ajoute
// ce que le support a le droit de dire — et rien de plus :
//   · l'état du compte tel que le SERVEUR l'a résolu (jamais tel que le client l'a déclaré) ;
//   · un diagnostic FONDÉ SUR PREUVES, avec sa confiance et ses sources ;
//   · des actions GOUVERNÉES, déjà autorisées ou déjà désactivées AVEC LEUR RAISON ;
//   · l'aveu, le cas échéant, qu'un humain est nécessaire.
//
// Ce qu'elle ne contient JAMAIS : une donnée d'un autre tenant, un secret, un blocage supposé,
// une action « prête » qui ne le serait pas.

import type {
  CloneChatPageContext, CloneChatResolvedAccountContext, CloneChatDiagnosis,
  CloneChatAction, CloneChatActionKind,
} from "./contracts";
import { validatePageContext, isPageContextStale } from "./contracts";
import { diagnose, classifySupportIntent, expressesTrouble, ACCOUNT_RELEVANT_INTENTS, type SupportIntent } from "./diagnosis";
import { authorizeAction, buildAction, actionIdempotencyKey } from "./actions";
import { requiresHuman } from "./tickets";
import { SUPPORT_TRUTH_VERSION, matchesTroubleSignature } from "./support-memory";
import type { CloneChatRequestClass } from "../server/universal-access";

export interface CareEnvelope {
  readonly support_truth_version: string;
  readonly context_version: string;
  readonly viewer_kind: string;
  readonly intent: SupportIntent;
  readonly diagnosis: {
    readonly status: string;
    readonly area: string;
    readonly reason: string;
    readonly confidence: string;
    readonly evidence: readonly { source: string; label: string; version: string | null }[];
    readonly escalation_required: boolean;
  };
  readonly blockers: readonly { code: string; title: string; message: string; next_step_label: string | null; next_step_href: string | null }[];
  readonly actions: readonly CloneChatAction[];
  readonly human_required: boolean;
  readonly human_reason: string | null;
  /** Le contexte d'écran envoyé par le client était-il périmé / usurpé ? (transparence) */
  readonly page_context_rejected_fields: readonly string[];
  readonly page_context_stale: boolean;
  /**
   * Route d'ÉCRAN déclarée par le client, APRÈS validation. Ce n'est PAS une autorité d'identité :
   * elle ne sert qu'à CORROBORER un diagnostic de capture. Un client qui la forge ne peut donc
   * rien inventer — au mieux il corrobore une route déjà prouvée par l'image, au pire il crée une
   * contradiction, et une contradiction fait TAIRE le diagnostic (`cannot_conclude`).
   */
  readonly page_route: string | null;
}

/**
 * Actions CANDIDATES, dérivées du diagnostic. Elles sont ensuite passées à la porte
 * d'autorisation UNIQUE : aucune n'échappe à `authorizeAction`.
 */
function candidates(d: CloneChatDiagnosis, intent: SupportIntent): Array<{ id: string; kind: CloneChatActionKind; label: string; description: string; href?: string }> {
  const out: Array<{ id: string; kind: CloneChatActionKind; label: string; description: string; href?: string }> = [];

  const blocker = d.blocking_step;
  if (blocker === "pierre_not_active") {
    out.push({ id: "act.activate_pierre", kind: "navigate", label: "Activer Pierre", description: "Ouvrir la page de réservation de Pierre.", href: "/reserver/pierre" });
  }
  if (blocker === "no_active_company" || blocker === "company_selection_required") {
    out.push({ id: "act.company", kind: "navigate", label: "Gérer mon entreprise", description: "Ouvrir votre espace CloneStore.", href: "/mon-clonestore" });
  }
  // L'INTENTION suffit pour une action de LECTURE ou de NAVIGATION : on n'a pas besoin d'avoir
  // prouvé la cause d'un problème pour proposer d'ouvrir ses factures. En revanche, tout EFFET
  // reste subordonné à `authorizeAction` — qui, lui, exige un diagnostic solide.
  const billingish = d.area === "billing" || intent === "billing_question"
    || intent === "payment_failure" || intent === "subscription_question" || intent === "cancellation_question";
  if (billingish) {
    out.push({ id: "act.invoice", kind: "show_invoice", label: "Voir mes factures", description: "Consulter vos factures (lecture seule)." });
    // Palier 4 : proposée mais DÉSACTIVÉE hors production — l'utilisateur voit pourquoi.
    out.push({ id: "act.portal", kind: "open_billing_portal", label: "Ouvrir le portail de facturation", description: "Gérer votre abonnement chez le prestataire." });
  }
  const missionish = d.area === "mission" || d.area === "employee_access"
    || intent === "mission_blocker" || intent === "employee_access_problem";
  if (missionish) {
    out.push({ id: "act.mission", kind: "prefill_mission", label: "Préparer la mission", description: "Pré-remplir la mission pour vous (réversible, à confirmer)." });
  }
  // Demander de l'aide reste TOUJOURS possible — y compris sans compte.
  if (d.escalation_required || d.confidence === "unknown" || d.confidence === "low") {
    out.push({ id: "act.ticket", kind: "create_support_ticket", label: "Préparer une demande d'aide", description: "Rédiger un brouillon (vous décidez de l'envoyer)." });
  }
  return out;
}

export function buildCareEnvelope(input: {
  message: string;
  account: CloneChatResolvedAccountContext;
  rawPageContext: unknown;
  /**
   * Classe de demande C1.6 (le classifieur CANONIQUE — on n'en écrit pas un second).
   * Elle décide si l'état du COMPTE est seulement PERTINENT.
   */
  requestClass: CloneChatRequestClass;
  /** Version courante de la page selon le registre officiel (null = page inconnue). */
  currentPageVersion?: string | null;
  /** Le mode live est-il autorisé ? (plancher de production — false en local) */
  liveEnabled?: boolean;
}): CareEnvelope {
  // 1) Le contexte d'ÉCRAN est validé, nettoyé, et toute usurpation est SIGNALÉE.
  const validation = input.rawPageContext == null
    ? { ok: false as const, sanitized: null, spoofedFields: [] as string[], errors: [] as string[] }
    : validatePageContext(input.rawPageContext);
  const page: CloneChatPageContext | null = validation.ok ? validation.sanitized : null;
  const stale = page !== null && isPageContextStale(page, input.currentPageVersion ?? null);

  // ── 2) PERTINENCE : un blocage de compte ne s'invite pas dans une question publique ──
  //
  // C1.6 : « un prérequis manquant s'attache à la DEMANDE, jamais au droit de converser ».
  // Quand on demande « quels sont les prix ? », répondre « vous n'avez pas d'entreprise active »
  // serait répondre à une question que personne n'a posée — et rappeler à un visiteur, à chaque
  // phrase, ce qui lui manque. Sur une demande PUBLIQUE, l'état du compte n'est donc ni utilisé
  // comme preuve, ni affiché. Il n'est pas « caché » : il n'est simplement pas pertinent.
  //
  // Deux signaux, et il FAUT les deux : la classe de demande C1.6 (« faut-il du privé ou une
  // action ? ») et l'intention de support (« est-ce que ça parle du compte ? »). Se fier à la
  // seule classe C1.6 masquait les blocages sur « je ne peux pas créer de mission » — une
  // plainte n'est ni une lecture privée ni une action, et pourtant c'est tout le support.
  // Trois signaux, et le troisième est indispensable : « je ne vois pas mes salariés » tombe dans
  // l'intention PAR DÉFAUT (`product_question`) exactement comme « c'est quoi CloneStore ? ».
  // Sans le signal de DÉTRESSE, les blocages réels disparaissaient (banc §17).
  const intent = classifySupportIntent(input.message);
  const accountIsRelevant =
    input.requestClass !== "CONVERSATIONAL_OR_PUBLIC"
    || ACCOUNT_RELEVANT_INTENTS.has(intent)
    || expressesTrouble(input.message)
    // Et surtout : si une PREUVE désigne une panne VÉCUE (signature sujet + échec du registre),
    // c'est un cas de support — l'état du compte est donc pertinent, quelle que soit la tournure.
    // Sans cette ligne, « Pierre reste éteint chez moi » reconnaissait le problème mais taisait
    // le blocage serveur qui en était la cause prouvée (banc §17). On exige bien une PANNE, pas
    // un simple rapprochement : « Pierre peut-il appeler ? » est une question, pas un incident.
    || matchesTroubleSignature(input.message);

  const scopedAccount: CloneChatResolvedAccountContext = accountIsRelevant
    ? input.account
    : Object.freeze({ ...input.account, known_account_blockers: Object.freeze([]) });

  // 3) Diagnostic — un contexte d'écran PÉRIMÉ n'est pas une preuve : on ne s'en sert pas.
  const d = diagnose({
    message: input.message,
    page: stale ? null : page,
    account: scopedAccount,
    pageStale: stale,
  });

  // 3) Actions — chacune passe par la porte d'autorisation UNIQUE.
  const actions: CloneChatAction[] = candidates(d, intent).map((c) => {
    const decision = authorizeAction({
      kind: c.kind,
      account: scopedAccount,
      diagnosis: d,
      confirmed: false, // la confirmation est un geste de l'utilisateur, jamais un défaut
      idempotencyKey: actionIdempotencyKey({
        kind: c.kind,
        userId: scopedAccount.user_id,
        companyId: scopedAccount.company_id,
        targetId: c.id,
        contextVersion: scopedAccount.context_version,
      }),
      proposedAtContextVersion: scopedAccount.context_version,
      liveEnabled: input.liveEnabled === true,
    });
    return buildAction({ id: c.id, kind: c.kind, label: c.label, description: c.description, href: c.href, decision });
  });

  const human = requiresHuman({ intent, diagnosis: d });

  return Object.freeze({
    support_truth_version: SUPPORT_TRUTH_VERSION,
    context_version: input.account.context_version,
    viewer_kind: input.account.viewer_kind,
    intent,
    diagnosis: Object.freeze({
      status: d.status,
      area: d.area,
      reason: d.reason,
      confidence: d.confidence,
      evidence: Object.freeze(d.evidence.map((e) => ({ source: e.source, label: e.label, version: e.version }))),
      escalation_required: d.escalation_required,
    }),
    blockers: Object.freeze(scopedAccount.known_account_blockers.map((b) => ({
      code: b.code, title: b.title, message: b.message,
      next_step_label: b.next_step_label, next_step_href: b.next_step_href,
    }))),
    actions: Object.freeze(actions),
    human_required: human.required,
    human_reason: human.reason,
    page_context_rejected_fields: Object.freeze([...validation.spoofedFields]),
    page_context_stale: stale,
    page_route: stale ? null : (page?.route ?? null),
  });
}
