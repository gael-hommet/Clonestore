"use client";

// /demo — Clôture : « Ce qui se passe ensuite. Sans zone d'ombre. »
//
// Une objection non traitée bloque plus sûrement qu'un prix : « et si j'avance,
// il se passe quoi ? ». On répond factuellement, sans ajouter un tunnel commercial.
//
// VÉRITÉ PRODUIT (aucune invention) :
//   • aucun paiement avant l'ouverture des accès — la formulation vient de
//     commercial-state (source de vérité unique des dates et du tarif) ;
//   • l'Empreinte Entreprise se prépare « en quelques jours » — formulation déjà
//     tenue par la FAQ de la démo ;
//   • aucune activation instantanée n'est promise ;
//   • aucune absence d'erreur n'est promise : on montre où une erreur serait
//     visible, encadrée et rattrapable.

import * as React from "react";
import { ShieldAlert } from "lucide-react";

import { Reveal } from "../primitives/motion";
import { GlassSurface } from "../primitives/GlassSurface";
import { SCENE_DECISION } from "@/lib/demo/presentation/content";

export function AfterReservation() {
  return (
    <Reveal className="demo-after">
      <GlassSurface
        kind="read"
        weight="structure"
        materialize={false}
        className="demo-after__card rounded-[1.8rem] p-6 sm:p-9"
      >
        <p className="demo-kicker">{SCENE_DECISION.afterKicker}</p>
        <h2 className="demo-after__title">{SCENE_DECISION.afterTitle}</h2>

        <ol className="demo-after__steps">
          {SCENE_DECISION.afterSteps.map((step, i) => (
            <li key={step.k} className="demo-after__step">
              <span className="demo-after__num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="demo-after__body">
                <span className="demo-after__k">{step.k}</span>
                <span className="demo-after__v">{step.v}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="demo-after__note">
          <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--demo-amber)]" aria-hidden="true" />
          <span>{SCENE_DECISION.afterNote}</span>
        </p>
      </GlassSurface>
    </Reveal>
  );
}
