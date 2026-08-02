// src/lib/clonechat/visual/types.ts
//
// CloneChat BLOC 9 — GUIDAGE VISUEL RÉEL. Accompagne l'utilisateur sur les VRAIES interfaces
// CloneStore, au-dessus de Brain → Context → Diagnosis → Guide → Voice → Care → Actions. Cibles
// prouvées uniquement (attributs `data-tour-id` réellement rendus + routes réelles du registre), avec
// fallback textuel HONNÊTE si aucune cible fiable n'existe. Ne JAMAIS inventer un bouton, un champ,
// une position, une capture, une page, un sélecteur ou un état UI. Types PURS, versionnés,
// déterministes. Réutilise la redaction (CloneCare) et l'isolation (CloneContext).

import type { CloneChatPrerequisite } from "@/lib/clonechat/server/universal-access";

export const CLONECHAT_VISUAL_VERSION = "visual-1" as const;
export const CLONECHAT_CAPTURE_VERSION = "capture-1" as const;

/** Viewports supportés (dimensions réelles ; utilisées par les captures et les tests navigateur). */
export type VisualViewport = "desktop" | "mobile_iphone" | "mobile_android";
export const VIEWPORTS: Readonly<Record<VisualViewport, { readonly width: number; readonly height: number }>> = {
  desktop: { width: 1440, height: 900 },
  mobile_iphone: { width: 390, height: 844 }, // iPhone courant (vertical)
  mobile_android: { width: 412, height: 915 }, // Android courant (vertical)
};

export type VisualAudience = "public" | "authenticated" | "gated";

/** Ordre de préférence de localisation d'un élément (du plus stable au dernier recours). */
export type LocationStrategy =
  | "accessible_role_name"
  | "accessible_label"
  | "stable_attribute" // ex. data-tour-id existant
  | "data_testid"
  | "structural_selector";

/** Statut de vérification d'une cible. `verified` UNIQUEMENT si prouvé par un rendu / test navigateur. */
export type VerificationStatus = "verified" | "declared" | "stale" | "unavailable";

/** État explicite du guidage visuel. */
export type VisualState =
  | "ready"
  | "target_found"
  | "target_not_found"
  | "page_state_mismatch"
  | "stale"
  | "needs_authentication"
  | "needs_context"
  | "fallback_text"
  | "completed";

export type VisualConfidence = "high" | "medium" | "low";

/** Description d'un élément cible (jamais de coordonnées codées en dur). */
export interface VisualElement {
  /** Valeur `data-tour-id` réellement rendue, ou null (cible au niveau route / sans ancre). */
  readonly tourId: string | null;
  readonly role: string | null; // rôle accessible attendu, si connu
  readonly label: string | null; // nom accessible, si connu
  /** Sélecteur stable dérivé (ex. [data-tour-id="..."]), ou null. */
  readonly stableSelector: string | null;
}

/** Rectangle mesuré RÉELLEMENT (jamais deviné). null tant qu'aucune mesure navigateur n'existe. */
export interface MeasuredRect {
  readonly viewport: VisualViewport;
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
  readonly measuredAtCommit: string;
}

/** Entrée du registre canonique des cibles visuelles. */
export interface VisualTarget {
  readonly id: string;
  readonly version: string;
  readonly route: string; // route RÉELLE (registre)
  readonly surface: string; // page/surface
  readonly goal: string; // objectif utilisateur
  readonly viewports: readonly VisualViewport[];
  readonly requiredPageState: string; // état de page attendu
  readonly audience: VisualAudience;
  readonly prerequisites: readonly CloneChatPrerequisite[];
  readonly element: VisualElement;
  readonly locationStrategy: LocationStrategy;
  readonly accessibleRole: string | null;
  readonly accessibleLabel: string | null;
  readonly stableSelector: string | null;
  /** Rectangle seulement s'il a été mesuré réellement (sinon null). */
  readonly rect: MeasuredRect | null;
  readonly instruction: string; // texte d'instruction
  readonly appearCondition: string; // condition observable d'apparition
  readonly successCondition: string; // condition observable de réussite
  readonly fallbackText: string; // fallback textuel honnête
  readonly provenance: string; // preuve (route-registry / tour-registry / e2e spec)
  readonly pageFingerprint: string | null; // empreinte/version de page ou de capture
  readonly status: VerificationStatus;
  /** Route recommandée à ouvrir (peut différer de `route`, ex. réservation depuis la page Pierre). */
  readonly recommendedRoute: string | null;
}

/** Référence de capture officielle (métadonnées uniquement ; jamais l'image dans le repo). */
export interface CaptureRef {
  readonly version: typeof CLONECHAT_CAPTURE_VERSION;
  readonly route: string;
  readonly viewport: VisualViewport;
  readonly pageState: string;
  readonly fingerprint: string;
  readonly commit: string | null;
  readonly redacted: true;
  /** Chemin LOCAL hors-repo (jamais committé), ou null si non produite. */
  readonly path: string | null;
}

/** Sortie structurée du guidage visuel (additive, versionnée). */
export interface VisualGuidance {
  readonly version: typeof CLONECHAT_VISUAL_VERSION;
  readonly goal: string;
  readonly route: string | null; // route réelle concernée
  readonly viewport: VisualViewport;
  readonly expectedPageState: string | null;
  readonly target: VisualTarget | null; // cible résolue (ou null → fallback)
  readonly locationMethod: LocationStrategy | null;
  readonly rect: MeasuredRect | null; // seulement si mesuré réellement
  readonly capture: CaptureRef | null;
  readonly instruction: string; // toujours exploitable par un lecteur d'écran
  readonly guideStepId: string | null;
  readonly actionId: string | null;
  readonly prerequisites: readonly CloneChatPrerequisite[];
  readonly confidence: VisualConfidence;
  readonly state: VisualState;
  readonly unavailableReason: string | null; // raison d'indisponibilité / d'obsolescence
  readonly fallbackText: string; // fallback textuel honnête (toujours présent)
  readonly evidence: readonly string[];
}
