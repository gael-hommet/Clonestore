"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./motion";

/** Titre de scène : eyebrow + grand titre court (lignes), accent optionnel sur la dernière ligne. */
export function DemoSectionHeading({
  kicker,
  title,
  accentLastLine = false,
  align = "left",
  className,
  id,
}: {
  kicker?: string;
  title: readonly string[] | string[];
  accentLastLine?: boolean;
  align?: "left" | "center";
  className?: string;
  id?: string;
}) {
  return (
    <Reveal className={cn(align === "center" && "text-center", className)}>
      {kicker ? <p className="demo-kicker">{kicker}</p> : null}
      <h2 id={id} className="demo-title">
        {title.map((line, i) => (
          <span key={i} className="block">
            {accentLastLine && i === title.length - 1 ? (
              <span className="demo-accent">{line}</span>
            ) : (
              line
            )}
          </span>
        ))}
      </h2>
    </Reveal>
  );
}

/** Bloc de paragraphes "lede" (largeur de lecture maîtrisée). */
export function DemoLede({
  paragraphs,
  className,
  center = false,
}: {
  paragraphs: readonly string[] | string[];
  className?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("space-y-4", center && "mx-auto text-center", className)}>
      {paragraphs.map((p, i) => (
        <Reveal key={i} delay={i * 0.04}>
          <p className="demo-lede">{p}</p>
        </Reveal>
      ))}
    </div>
  );
}
