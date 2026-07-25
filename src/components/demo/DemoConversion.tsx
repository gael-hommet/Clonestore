"use client";

// /demo — CLÔTURE : une architecture de décision, pas un appel au clic.
//
// Remplace l'ancien bloc de conversion (« Prêt à voir Pierre travailler pour votre
// entreprise ? ») : un closer générique, qui dupliquait le CTA de l'acte Pierre et
// laissait deux questions sans réponse — « par quoi je commence ? » et « il se passe
// quoi si j'avance ? ».
//
// Hiérarchie de clôture (funnel démo générale → fiche Pierre) :
//   • ACTION PRINCIPALE dominante : « Découvrir Pierre » → /agents/pierre (la fiche).
//   • Secondaire : « Poser une question à CloneChat » → /assistant.
//   • Tertiaire (discret, jamais concurrent) : réserver / revoir la démonstration.
// La démo générale vend CloneStore ; la fiche vend Pierre ; le cockpit prouve Pierre.
// On ne dirige plus l'action principale vers /demo/pierre.

import * as React from "react";
import { MessagesSquare } from "lucide-react";

import { Reveal } from "./primitives/motion";
import { GlassSurface } from "./primitives/GlassSurface";
import { DemoCTALink } from "./primitives/DemoCTA";
import { FirstMission } from "./decision/FirstMission";
import { AfterReservation } from "./decision/AfterReservation";

import { SCENE_DECISION, PIERRE_DEMO_ROUTE } from "@/lib/demo/presentation/content";

/** Route canonique de CloneChat (cf. SiteHeader). Aucun paramètre : la page n'en lit aucun. */
const CLONECHAT_ROUTE = "/assistant";
const RESERVATION_ROUTE = "/reserver/pierre";
const FICHE_ROUTE = "/agents/pierre";


export function DemoConversion({
  onReserve,
  onPierre,
  onCloneChat,
  onDiscover,
  onFirstMission,
}: {
  onReserve: () => void;
  onPierre: () => void;
  onCloneChat: () => void;
  onDiscover: () => void;
  onFirstMission: () => void;
}) {
  return (
    <section
      id="demo-act-decision"
      className="demo-section demo-section--breath demo-decision"
      aria-label="Votre décision : première mission, suite du parcours et prochaine étape"
    >
      <div className="demo-shell">
        {/* 1 — Par quoi commencer */}
        <FirstMission onSelect={onFirstMission} />

        {/* 2 — Si vous avancez */}
        <div className="demo-decision__after">
          <AfterReservation />
        </div>

        {/* 3 — Les trois issues */}
        <Reveal delay={0.04} className="demo-decision__close">
          <div className="mx-auto max-w-3xl text-center">
            <p className="demo-kicker">{SCENE_DECISION.closeKicker}</p>
            <h2 className="demo-title demo-title--section mt-3">{SCENE_DECISION.closeTitle}</h2>
            <p className="demo-lede demo-decision__lede mx-auto mt-3 max-w-2xl text-center">
              {SCENE_DECISION.closeLede}
            </p>
          </div>

          {/* Action principale dominante : la fiche produit vend Pierre. */}
          <div className="demo-decision__cta">
            <DemoCTALink href={FICHE_ROUTE} variant="primary" hero withArrow onClick={onDiscover}>
              Découvrir Pierre
            </DemoCTALink>
          </div>

          {/* Chemins tertiaires, discrets : jamais concurrents de l'action principale. */}
          <div className="demo-decision__tertiary">
            <DemoCTALink href={RESERVATION_ROUTE} variant="ghost" onClick={onReserve}>
              Réserver Pierre
            </DemoCTALink>
            <span className="demo-decision__tertiary-sep" aria-hidden="true">·</span>
            <DemoCTALink href={PIERRE_DEMO_ROUTE} variant="ghost" onClick={onPierre}>
              Revoir la démonstration
            </DemoCTALink>
          </div>
        </Reveal>

        {/* 4 — La sortie quand la confiance est incomplète mais le besoin réel */}
        <Reveal delay={0.05} className="demo-decision__chat">
          <GlassSurface
            kind="material"
            weight="card"
            materialize={false}
            className="demo-chat-card rounded-[1.6rem] p-6 sm:p-7"
          >
            <div className="demo-chat-card__body">
              <span className="demo-chat-card__ico" aria-hidden="true">
                <MessagesSquare className="h-5 w-5" />
              </span>
              <div className="demo-chat-card__text">
                <p className="demo-chat-card__kicker">{SCENE_DECISION.chatKicker}</p>
                <p className="demo-chat-card__title">{SCENE_DECISION.chatTitle}</p>
                <p className="demo-chat-card__lede">{SCENE_DECISION.chatLede}</p>
              </div>
              <DemoCTALink
                href={CLONECHAT_ROUTE}
                variant="secondary"
                withArrow
                onClick={onCloneChat}
                className="demo-chat-card__cta"
              >
                {SCENE_DECISION.chatCta}
              </DemoCTALink>
            </div>
          </GlassSurface>
        </Reveal>

        {/* 5 — Le dernier mot. Rien après : la conclusion respire. */}
        <Reveal delay={0.06} className="demo-decision__final">
          <p className="demo-decision__final-a">{SCENE_DECISION.finalStatement[0]}</p>
          <p className="demo-decision__final-b">{SCENE_DECISION.finalStatement[1]}</p>
        </Reveal>
      </div>
    </section>
  );
}
