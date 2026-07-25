"use client";

// /demo — Surface liquid glass renforcée (matière perceptible, multi-étapes).
// kind: "read" (lecture calme, opaque) · "material" (réfraction spectaculaire)
// · "floating" (profondeur + arête lumineuse). Matérialisation à la 1re vue.

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { DEMO_EASE } from "./motion";

type GlassKind = "read" | "material" | "floating";
type GlassWeight = "micro" | "card" | "structure";

const DURATION: Record<GlassWeight, number> = { micro: 0.5, card: 0.72, structure: 0.96 };

export function GlassSurface({
  children,
  className,
  kind = "material",
  weight = "card",
  materialize = true,
  sheen = false,
  delay = 0,
  // « some » (un pixel visible suffit) et non un ratio : un ratio (ex. 0.3) n'est
  // JAMAIS atteint par un élément plus haut que ~1/ratio viewport ⇒ whileInView ne
  // se déclenche jamais et la surface reste invisible (opacity 0) en permanence.
  amount = "some",
  ...rest
}: {
  children?: React.ReactNode;
  className?: string;
  kind?: GlassKind;
  weight?: GlassWeight;
  materialize?: boolean;
  sheen?: boolean;
  delay?: number;
  amount?: number | "some" | "all";
} & Omit<HTMLMotionProps<"div">, "children" | "ref">) {
  const dur = DURATION[weight];
  const variants = {
    hidden: { opacity: 0, scale: 0.975, filter: "blur(8px)" },
    show: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: { duration: dur, delay, ease: DEMO_EASE },
    },
  };
  return (
    <motion.div
      className={cn("demo-glass", `demo-glass--${kind}`, sheen && "demo-sheen", className)}
      variants={materialize ? variants : undefined}
      initial={materialize ? "hidden" : false}
      whileInView={materialize ? "show" : undefined}
      viewport={{ once: true, amount }}
      {...rest}
    >
      {sheen ? <span className="demo-sheen__bar" aria-hidden="true" /> : null}
      {children}
    </motion.div>
  );
}
