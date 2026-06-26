"use client";

// /demo — Filtres SVG de réfraction, scoppés à la présentation (rendus une fois).
// Distincts des filtres globaux de LiquidGlassFilters : on n'y touche pas.

import * as React from "react";

export function DemoGlassFilters() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute" }}
    >
      <defs>
        {/* Réfraction douce du fond derrière une surface "matière" */}
        <filter id="demo-refract-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.009 0.013"
            numOctaves="2"
            seed="17"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="0.6" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="9"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Réfraction plus marquée — surfaces qui se matérialisent / traversent */}
        <filter id="demo-refract-strong" x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.011 0.016"
            numOctaves="3"
            seed="23"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="16"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
