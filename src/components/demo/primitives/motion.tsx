"use client";

// /demo — Fondations d'animation (Framer Motion)
// Reveal / Stagger au scroll. La réduction de mouvement est gérée par
// <MotionConfig reducedMotion="user"> au niveau de l'orchestrateur (SSR-safe) :
// on ne branche JAMAIS le rendu initial sur prefers-reduced-motion, ce qui
// éviterait sinon un écart d'hydratation. Le contenu reste présent côté serveur.

import * as React from "react";
import {
  motion,
  useReducedMotion,
  type Variants,
  type HTMLMotionProps,
} from "framer-motion";

export const DEMO_EASE = [0.22, 1, 0.36, 1] as const;

/** Apparition simple (opacité + translation), une seule fois, au scroll. */
export function Reveal({
  children,
  delay = 0,
  y = 26,
  amount = 0.3,
  className,
  ...rest
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  amount?: number;
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children">) {
  const variants: Variants = {
    hidden: { opacity: 0, y },
    show: { opacity: 1, y: 0, transition: { duration: 0.62, delay, ease: DEMO_EASE } },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Conteneur de cascade : les enfants <StaggerItem> apparaissent en séquence. */
export function Stagger({
  children,
  className,
  step = 0.08,
  amount = 0.25,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  step?: number;
  amount?: number;
} & Omit<HTMLMotionProps<"div">, "children">) {
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: step } },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: DEMO_EASE } },
};

export function StaggerItem({
  children,
  className,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div className={className} variants={staggerItemVariants} {...rest}>
      {children}
    </motion.div>
  );
}

/**
 * Hook partagé : true si l'utilisateur préfère réduire les animations.
 * À n'utiliser que dans des gestionnaires d'événements / effets (pas dans le
 * rendu initial, pour rester compatible avec l'hydratation SSR).
 */
export function useDemoReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}
