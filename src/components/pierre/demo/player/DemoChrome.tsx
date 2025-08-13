"use client";

// PIERRE ZERO-SCROLL DEMO PLAYER — persistent chrome bar (fixed height).
// Left: CloneStore / Pierre logo. Center: accessible progress (1/6 + six dots that
// jump to a scene). Right: a permanent "Réserver Pierre" purchase CTA and a discreet
// "Quitter" back to the general demo. The bar never scrolls and never changes height.

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { DEMO_CTA_DESTINATIONS } from "@/lib/pierre/demo";
import { PLAYER_SCENES, SCENE_COUNT, scenePosition, clampScene } from "./player-machine";

export function DemoChrome({
  index,
  onGoto,
}: {
  index: number;
  onGoto: (i: number) => void;
}) {
  const pos = scenePosition(index);
  const cur = clampScene(index);
  return (
    <header className="pdp-chrome">
      <div className="pdp-brand">
        <span className="pdp-brand__mark" aria-hidden>P</span>
        <span style={{ minWidth: 0 }}>
          <span className="pdp-brand__name">CloneStore · Pierre</span>
          <span className="pdp-brand__sub" style={{ display: "block" }}>Employé IA RH — démonstration</span>
        </span>
      </div>

      <div
        className="pdp-progress"
        role="progressbar"
        aria-label="Progression de la démonstration"
        aria-valuenow={pos}
        aria-valuemin={1}
        aria-valuemax={SCENE_COUNT}
        aria-valuetext={`Scène ${pos} sur ${SCENE_COUNT} — ${PLAYER_SCENES[cur].label}`}
      >
        <span className="pdp-progress__count">{pos}/{SCENE_COUNT}</span>
        <span className="pdp-dots">
          {PLAYER_SCENES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`pdp-dot${i === cur ? " pdp-dot--cur" : i < cur ? " pdp-dot--done" : ""}`}
              aria-label={`Aller à la scène ${i + 1} : ${s.label}`}
              aria-current={i === cur ? "step" : undefined}
              onClick={() => onGoto(i)}
            />
          ))}
        </span>
      </div>

      <div className="pdp-chrome__actions">
        <Link
          href={DEMO_CTA_DESTINATIONS.reserve}
          className="pd-btn pd-btn-primary"
          data-conversion-cta="purchase"
          data-cta-name="demo_chrome_reserve"
        >
          Réserver Pierre <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link href={DEMO_CTA_DESTINATIONS.demo_home} className="pdp-quit" aria-label="Quitter la démonstration">
          <X className="h-3.5 w-3.5" aria-hidden />
          <span>Quitter</span>
        </Link>
      </div>
    </header>
  );
}
