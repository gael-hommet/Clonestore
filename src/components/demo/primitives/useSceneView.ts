"use client";

import { useEffect, useRef } from "react";
import { useInView } from "framer-motion";
import { emitDemoEvent, type DemoEventName } from "@/lib/demo/presentation/analytics";

/**
 * Renvoie une ref à attacher à une section : émet `event` une seule fois quand
 * la section devient suffisamment visible. Sûr en SSR (effet client uniquement).
 */
export function useSceneView<T extends Element = HTMLDivElement>(
  event?: DemoEventName,
  amount = 0.4,
) {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, amount });

  useEffect(() => {
    if (inView && event) {
      emitDemoEvent(event, {}, { once: true });
    }
  }, [inView, event]);

  return ref;
}
