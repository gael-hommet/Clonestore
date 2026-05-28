// B46 — Pierre Technology Map
// Maps each CloneStore technology to its effect on Pierre workflows.
// Pure: no Supabase, no Next, no async, no side effects. No throw.

import type { CloneStoreTechnologyId } from "../../clonestore/technologies/technology-b46-types";

// ── Technology → Pierre behavior mapping ─────────────────────────────────────

export type PierreTechnologyRole =
  | "core_orchestration"    // CloneOS — without it Pierre cannot run missions
  | "memory_context"        // CloneADN — without it Pierre has no company context
  | "security_gateway"      // CloneGuard — without it Pierre cannot validate actions
  | "audit_trail"           // CloneTrace — without it no timeline/proof
  | "voice_command"         // CloneVoice — optional voice input
  | "chat_interface";       // CloneChat — limited orientation interface

export type PierreTechnologyEffect = {
  technology_id: CloneStoreTechnologyId;
  role: PierreTechnologyRole;
  pierre_feature: string;
  degraded_effect: string;
  disabled_effect: string;
  required_for_launch: boolean;
  can_run_without: boolean;
  degraded_mode_available: boolean;
};

export const PIERRE_TECHNOLOGY_MAP: PierreTechnologyEffect[] = [
  {
    technology_id: "cloneos",
    role: "core_orchestration",
    pierre_feature: "Orchestration missions / tâches / workflow RH",
    degraded_effect: "Missions peuvent être créées mais exécution incomplète.",
    disabled_effect: "Pierre ne peut pas créer ni exécuter de missions. Bloqué.",
    required_for_launch: true,
    can_run_without: false,
    degraded_mode_available: false,
  },
  {
    technology_id: "cloneadn",
    role: "memory_context",
    pierre_feature: "Contexte entreprise, style, règles, empreinte B44",
    degraded_effect: "Pierre répond sans contexte entreprise — réponses génériques.",
    disabled_effect: "Pierre n'a aucune mémoire entreprise. Contexte nul.",
    required_for_launch: true,
    can_run_without: true,
    degraded_mode_available: true,
  },
  {
    technology_id: "cloneguard",
    role: "security_gateway",
    pierre_feature: "Validation gouvernance, blocage actions sensibles, pipeline B41",
    degraded_effect: "Certaines vérifications dégradées — risque accru sur actions sensibles.",
    disabled_effect: "Pierre ne peut pas valider les actions. Toutes les missions bloquées.",
    required_for_launch: true,
    can_run_without: false,
    degraded_mode_available: false,
  },
  {
    technology_id: "clonetrace",
    role: "audit_trail",
    pierre_feature: "Timeline missions, audit trail, artifacts B43, preuve d'exécution",
    degraded_effect: "Logs partiels — timeline dégradée. Historique incomplet.",
    disabled_effect: "Aucun audit trail. Aucune preuve d'exécution. Bloqué pour docs officiels.",
    required_for_launch: true,
    can_run_without: false,
    degraded_mode_available: true,
  },
  {
    technology_id: "clonevoice",
    role: "voice_command",
    pierre_feature: "Dictée missions, commandes vocales, retours oraux",
    degraded_effect: "Voix non disponible — interface texte uniquement.",
    disabled_effect: "CloneVoice désactivé — Pierre fonctionne en mode texte uniquement.",
    required_for_launch: false,
    can_run_without: true,
    degraded_mode_available: true,
  },
  {
    technology_id: "clonechat",
    role: "chat_interface",
    pierre_feature: "Interface chat, orientation utilisateur, support de base",
    degraded_effect: "Interface limitée — orientation de base uniquement.",
    disabled_effect: "Pas d'interface chat — interactions via cockpit uniquement.",
    required_for_launch: false,
    can_run_without: true,
    degraded_mode_available: true,
  },
];

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getPierreTechnologyEffect(
  id: CloneStoreTechnologyId,
): PierreTechnologyEffect | null {
  return PIERRE_TECHNOLOGY_MAP.find((e) => e.technology_id === id) ?? null;
}

export function listPiereRequiredEffects(): PierreTechnologyEffect[] {
  return PIERRE_TECHNOLOGY_MAP.filter((e) => e.required_for_launch);
}

export function listPierreOptionalEffects(): PierreTechnologyEffect[] {
  return PIERRE_TECHNOLOGY_MAP.filter((e) => !e.required_for_launch);
}

export function canPierreRunWithout(id: CloneStoreTechnologyId): boolean {
  const effect = getPierreTechnologyEffect(id);
  return effect ? effect.can_run_without : true;
}
