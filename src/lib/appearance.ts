export type CloneAppearance = "signature" | "graphite" | "aura";
export type CloneAccent = "blue-graphite" | "cold-blue" | "champagne" | "soft-violet";
export type CloneDensity = "comfortable" | "compact" | "airy";
export type CloneMotion = "subtle" | "reduced" | "none";

export type CloneAppearanceSettings = {
  theme: string;
  accent: string;
  density: string;
  motion: string;
};

type ApplyOptions = {
  persist?: boolean;
  emit?: boolean;
};

const LEGACY_APPEARANCE_KEY = "clonestore:appearance";
const FULL_APPEARANCE_KEY = "clonestore.appearance-settings.v1";

export const DEFAULT_APPEARANCE_SETTINGS: CloneAppearanceSettings = {
  theme: "Ivoire premium",
  accent: "Bleu graphite",
  density: "Confortable",
  motion: "Subtile",
};

const THEME_TO_DATASET: Record<string, CloneAppearance> = {
  "Ivoire premium": "signature",
  "Graphite clair": "graphite",
  "Crème champagne": "aura",
};

const ACCENT_TO_DATASET: Record<string, CloneAccent> = {
  "Bleu graphite": "blue-graphite",
  "Bleu froid": "cold-blue",
  Champagne: "champagne",
  "Violet discret": "soft-violet",
};

const DENSITY_TO_DATASET: Record<string, CloneDensity> = {
  Confortable: "comfortable",
  Compacte: "compact",
  "Très aérée": "airy",
};

const MOTION_TO_DATASET: Record<string, CloneMotion> = {
  Subtile: "subtle",
  Réduite: "reduced",
  Désactivée: "none",
};

function safeSettings(
  settings: Partial<CloneAppearanceSettings> | null | undefined
): CloneAppearanceSettings {
  return {
    ...DEFAULT_APPEARANCE_SETTINGS,
    ...(settings ?? {}),
  };
}

export function getCloneAppearanceFromSettings(
  settings: Partial<CloneAppearanceSettings> | null | undefined
): CloneAppearance {
  const safe = safeSettings(settings);
  return THEME_TO_DATASET[safe.theme] ?? "signature";
}

export function getCloneAccentFromSettings(
  settings: Partial<CloneAppearanceSettings> | null | undefined
): CloneAccent {
  const safe = safeSettings(settings);
  return ACCENT_TO_DATASET[safe.accent] ?? "blue-graphite";
}

export function getCloneDensityFromSettings(
  settings: Partial<CloneAppearanceSettings> | null | undefined
): CloneDensity {
  const safe = safeSettings(settings);
  return DENSITY_TO_DATASET[safe.density] ?? "comfortable";
}

export function getCloneMotionFromSettings(
  settings: Partial<CloneAppearanceSettings> | null | undefined
): CloneMotion {
  const safe = safeSettings(settings);
  return MOTION_TO_DATASET[safe.motion] ?? "subtle";
}

export function applyCloneAppearance(
  appearance: CloneAppearance,
  options: ApplyOptions = {}
) {
  if (typeof window === "undefined") return;

  const persist = options.persist ?? true;
  const emit = options.emit ?? true;

  document.documentElement.dataset.cloneAppearance = appearance;
  document.documentElement.style.colorScheme = appearance === "graphite" ? "dark" : "light";

  if (persist) {
    window.localStorage.setItem(LEGACY_APPEARANCE_KEY, appearance);
  }

  if (emit) {
    window.dispatchEvent(
      new CustomEvent("clonestore:appearance-change", {
        detail: { appearance },
      })
    );
  }
}

export function applyCloneAppearanceSettings(
  settings: Partial<CloneAppearanceSettings> | null | undefined,
  options: ApplyOptions = {}
) {
  if (typeof window === "undefined") return;

  const persist = options.persist ?? true;
  const emit = options.emit ?? true;

  const safe = safeSettings(settings);

  const appearance = getCloneAppearanceFromSettings(safe);
  const accent = getCloneAccentFromSettings(safe);
  const density = getCloneDensityFromSettings(safe);
  const motion = getCloneMotionFromSettings(safe);

  document.documentElement.dataset.cloneAppearance = appearance;
  document.documentElement.dataset.cloneAccent = accent;
  document.documentElement.dataset.cloneDensity = density;
  document.documentElement.dataset.cloneMotion = motion;
  document.documentElement.style.colorScheme = appearance === "graphite" ? "dark" : "light";

  if (persist) {
    window.localStorage.setItem(LEGACY_APPEARANCE_KEY, appearance);
    window.localStorage.setItem(FULL_APPEARANCE_KEY, JSON.stringify(safe));
  }

  if (emit) {
    window.dispatchEvent(
      new CustomEvent("clonestore:appearance-change", {
        detail: {
          appearance,
          accent,
          density,
          motion,
          settings: safe,
        },
      })
    );
  }
}

export function readCloneAppearanceSettings(): CloneAppearanceSettings {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE_SETTINGS;

  try {
    const raw = window.localStorage.getItem(FULL_APPEARANCE_KEY);
    if (!raw) return DEFAULT_APPEARANCE_SETTINGS;

    return safeSettings(JSON.parse(raw) as Partial<CloneAppearanceSettings>);
  } catch {
    return DEFAULT_APPEARANCE_SETTINGS;
  }
}