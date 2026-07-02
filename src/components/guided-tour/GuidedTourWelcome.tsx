"use client";

// Invitation de bienvenue (P9.1 + P9.2).
// Proposition discrète, NON intrusive, portée via le portail global. La copy est
// fournie par l'orchestrateur (contextuelle : tour public sur `/`, tour
// authentifié sur `/profile`) → un seul composant, plusieurs tours.

import { motion } from "framer-motion";
import { X } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

export interface WelcomeCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly accept: string;
  readonly decline: string;
  readonly dismissLabel: string;
}

export function GuidedTourWelcome({
  welcome,
  reduced,
  onAccept,
  onDismiss,
}: {
  welcome: WelcomeCopy;
  reduced: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      className="csgt-welcome"
      role="dialog"
      aria-label="Découverte guidée CloneStore"
      initial={reduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, y: 20 }}
      transition={{ duration: reduced ? 0 : 0.42, ease: EASE }}
    >
      <button
        type="button"
        className="csgt-welcome__close"
        onClick={onDismiss}
        aria-label={welcome.dismissLabel}
      >
        <X className="h-4 w-4" />
      </button>

      <p className="csgt-welcome__eyebrow">{welcome.eyebrow}</p>
      <p className="csgt-welcome__title">{welcome.title}</p>
      <p className="csgt-welcome__body">{welcome.body}</p>

      <div className="csgt-welcome__actions">
        <button type="button" className="csgt-btn csgt-btn--primary" onClick={onAccept}>
          {welcome.accept}
        </button>
        <button type="button" className="csgt-btn csgt-btn--ghost" onClick={onDismiss}>
          {welcome.decline}
        </button>
      </div>
    </motion.div>
  );
}
