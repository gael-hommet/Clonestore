"use client";

import { useEffect } from "react";

const APPEARANCE_STORAGE_KEY = "clonestore.appearance-settings.v1";

type AppearanceSettings = {
  theme?: string;
  accent?: string;
  density?: string;
  motion?: string;
};

function normalizeAppearance(settings: AppearanceSettings | null) {
  const theme = settings?.theme ?? "Ivoire premium";
  const accent = settings?.accent ?? "Bleu graphite";
  const density = settings?.density ?? "Confortable";

  let appearance = "signature";

  if (theme === "Graphite clair" || accent === "Bleu graphite") {
    appearance = "graphite";
  }

  if (theme === "Crème champagne" || accent === "Champagne") {
    appearance = "champagne";
  }

  let densityMode = "comfortable";

  if (density === "Compacte") {
    densityMode = "compact";
  }

  if (density === "Très aérée") {
    densityMode = "airy";
  }

  return {
    appearance,
    density: densityMode,
  };
}

function applyAppearanceFromStorage() {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AppearanceSettings) : null;
    const normalized = normalizeAppearance(parsed);

    document.documentElement.dataset.cloneAppearance = normalized.appearance;
    document.documentElement.dataset.cloneDensity = normalized.density;
  } catch {
    document.documentElement.dataset.cloneAppearance = "signature";
    document.documentElement.dataset.cloneDensity = "comfortable";
  }
}

export default function AppearanceBridge() {
  useEffect(() => {
    applyAppearanceFromStorage();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_STORAGE_KEY) {
        applyAppearanceFromStorage();
      }
    };

    const handleCustomChange = () => {
      applyAppearanceFromStorage();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("clonestore:appearance-updated", handleCustomChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("clonestore:appearance-updated", handleCustomChange);
    };
  }, []);

  return null;
}