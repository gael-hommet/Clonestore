"use client";

// /demo — Panneau liquid glass animé (matérialisation §6)
// Fondation : le système de classes liquid-glass existant (src/styles/liquid-glass.css).
// Choreographie : distorsion légère → contour → densité → profondeur → contenu net.
// La durée dépend de l'importance (weight). prefers-reduced-motion : apparition neutre.

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import { DEMO_EASE } from "./motion";

type GlassVariant = "default" | "clear" | "cream" | "panel" | "dark";
type GlassIntensity = "soft" | "medium" | "strong";
type GlassWeight = "micro" | "card" | "structure";

const WEIGHT_DURATION: Record<GlassWeight, number> = {
  micro: 0.42,
  card: 0.62,
  structure: 1.1,
};

export function liquidGlassClass(
  variant: GlassVariant = "default",
  intensity: GlassIntensity = "medium",
  opts: { interactive?: boolean; refractive?: boolean } = {},
): string {
  return cn(
    "liquid-glass",
    variant !== "default" && `liquid-glass--${variant}`,
    `liquid-glass--${intensity}`,
    opts.interactive && "liquid-glass--interactive",
    opts.refractive && "liquid-glass--refractive",
  );
}

export function LiquidGlassPanel({
  children,
  className,
  variant = "default",
  intensity = "medium",
  weight = "card",
  interactive = false,
  refractive = true,
  sheen = false,
  delay = 0,
  amount = 0.3,
  ...rest
}: {
  children?: React.ReactNode;
  className?: string;
  variant?: GlassVariant;
  intensity?: GlassIntensity;
  weight?: GlassWeight;
  interactive?: boolean;
  refractive?: boolean;
  sheen?: boolean;
  delay?: number;
  amount?: number;
} & Omit<React.ComponentProps<typeof motion.div>, "children" | "ref">) {
  const duration = WEIGHT_DURATION[weight];

  // Variantes non branchées sur reduced-motion (compatibilité hydratation SSR) :
  // <MotionConfig reducedMotion="user"> neutralise transform/scale/y pour les
  // utilisateurs concernés ; il ne reste alors qu'un fondu d'opacité discret.
  const variants: Variants = {
    hidden: { opacity: 0, scale: 0.985, filter: "blur(7px)", y: 14 },
    show: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      y: 0,
      transition: { duration, delay, ease: DEMO_EASE },
    },
  };

  return (
    <motion.div
      className={cn(
        liquidGlassClass(variant, intensity, { interactive, refractive }),
        sheen && "demo-sheen",
        className,
      )}
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
