// Tour de contrôle Founder — tokens chromatiques + helpers visuels. Aucune donnée fictive :
// les helpers ne font que dériver des PROPORTIONS réelles (jamais d'historique inventé).

export interface AccentTone { base: string; soft: string; glow: string; text: string }

export const ACCENTS = {
  pink: { base: "#ff63c3", soft: "rgba(255,99,195,0.16)", glow: "rgba(255,99,195,0.45)", text: "#ff9ddb" },
  violet: { base: "#8b7cff", soft: "rgba(139,124,255,0.16)", glow: "rgba(139,124,255,0.45)", text: "#bcb2ff" },
  blue: { base: "#5f8bff", soft: "rgba(95,139,255,0.16)", glow: "rgba(95,139,255,0.45)", text: "#a7bcff" },
  cyan: { base: "#43d4f4", soft: "rgba(67,212,244,0.15)", glow: "rgba(67,212,244,0.4)", text: "#9be9fb" },
  success: { base: "#34d399", soft: "rgba(52,211,153,0.15)", glow: "rgba(52,211,153,0.4)", text: "#7ff0c6" },
  warning: { base: "#fbbf24", soft: "rgba(251,191,36,0.15)", glow: "rgba(251,191,36,0.4)", text: "#ffd97a" },
  danger: { base: "#fb7185", soft: "rgba(251,113,133,0.15)", glow: "rgba(251,113,133,0.4)", text: "#ffa6b2" },
} as const satisfies Record<string, AccentTone>;

export type AccentName = keyof typeof ACCENTS;

/** Borne une valeur en pourcentage [0,100] (NaN → 0). */
export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Proportion réelle part/whole en % (0 si whole ≤ 0). */
export function ratioPct(part: number, whole: number): number {
  return whole > 0 ? clampPct(Math.round((part / whole) * 100)) : 0;
}

/** true si l'utilisateur préfère des animations réduites (sûr côté serveur). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
