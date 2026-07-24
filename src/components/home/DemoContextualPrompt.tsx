"use client";

// DEMO AND MOBILE CONVERSION CLOSURE (2026-07-24) — homepage → demo contextual invitation.
//
// Single trigger (scroll depth past DEMO_PROMPT_SCROLL_THRESHOLD), never shown on mount,
// never modal, dismissed for the session only (sessionStorage, not localStorage). Decision
// logic is the pure evaluateDemoContextualPrompt() (src/lib/demo/contextual-prompt/detect.ts)
// — this component is only the DOM adapter (scroll listener + storage), same split as
// src/lib/pwa/detect.ts + use-pwa.ts. Feature-flagged via isDemoContextualPromptEnabled();
// entirely absent from the DOM when the flag is off (no residual empty wrapper).
//
// Does not touch the hero: this renders as a fixed-position overlay mounted once near the
// end of the homepage tree, not inside the hero section, and never affects hero layout.

import * as React from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";

import { DemoContextualPromptCard } from "./DemoContextualPromptCard";
import { isDemoContextualPromptEnabled } from "@/lib/demo/contextual-prompt/contextual-prompt-flags";
import {
  evaluateDemoContextualPrompt,
  scrollDepthRatio,
} from "@/lib/demo/contextual-prompt/detect";
import { DEMO_PROMPT_STORAGE } from "@/lib/demo/contextual-prompt/constants";
import { emitFounderEvent } from "@/lib/founder-access/funnel-events";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DEMO_PROMPT_STORAGE.dismissed) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    sessionStorage.setItem(DEMO_PROMPT_STORAGE.dismissed, "1");
  } catch {
    /* sessionStorage unavailable (private mode/quota) — fails open to "not dismissed",
       never blocks rendering. */
  }
}

export function DemoContextualPrompt() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const enabled = React.useMemo(() => isDemoContextualPromptEnabled(), []);
  const [show, setShow] = React.useState(false);
  const seenFiredRef = React.useRef(false);
  const dismissedRef = React.useRef(false);

  React.useEffect(() => {
    if (!enabled) return;
    dismissedRef.current = readDismissed();
    if (dismissedRef.current) return;

    function onScroll() {
      const depth = scrollDepthRatio(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight,
      );
      const decision = evaluateDemoContextualPrompt({
        enabled: true,
        pathname,
        scrollDepth: depth,
        dismissedThisSession: dismissedRef.current,
      });
      if (decision.show) setShow(true);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled, pathname]);

  React.useEffect(() => {
    if (show && !seenFiredRef.current) {
      seenFiredRef.current = true;
      emitFounderEvent("homepage_demo_prompt_seen", { landingPath: pathname });
    }
  }, [show, pathname]);

  const handleOpenDemo = React.useCallback(() => {
    emitFounderEvent("homepage_demo_prompt_clicked", { landingPath: pathname });
    dismissedRef.current = true;
    writeDismissed();
    setShow(false);
    router.push("/demo");
  }, [pathname, router]);

  const handleDismiss = React.useCallback(() => {
    emitFounderEvent("homepage_demo_prompt_dismissed", { landingPath: pathname });
    dismissedRef.current = true;
    writeDismissed();
    setShow(false);
  }, [pathname]);

  if (!enabled || !show) return null;

  return <DemoContextualPromptCard onOpenDemo={handleOpenDemo} onDismiss={handleDismiss} />;
}
