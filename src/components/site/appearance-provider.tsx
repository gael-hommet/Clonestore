"use client";

import { useEffect } from "react";
import {
  applyCloneAppearanceSettings,
  readCloneAppearanceSettings,
} from "@/lib/appearance";

export default function AppearanceProvider() {
  useEffect(() => {
    applyCloneAppearanceSettings(readCloneAppearanceSettings(), {
      persist: true,
      emit: false,
    });

    function handleStorage(event: StorageEvent) {
      if (
        event.key === "clonestore.appearance-settings.v1" ||
        event.key === "clonestore:appearance"
      ) {
        applyCloneAppearanceSettings(readCloneAppearanceSettings(), {
          persist: false,
          emit: false,
        });
      }
    }

    function handleAppearanceChange() {
      applyCloneAppearanceSettings(readCloneAppearanceSettings(), {
        persist: false,
        emit: false,
      });
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("clonestore:appearance-change", handleAppearanceChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "clonestore:appearance-change",
        handleAppearanceChange
      );
    };
  }, []);

  return null;
}