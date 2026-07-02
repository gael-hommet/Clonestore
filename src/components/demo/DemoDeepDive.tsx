"use client";

// /demo — Tiroir d'approfondissement (couche 3).
// Le parcours principal se comprend sans jamais l'ouvrir. Ceux qui veulent la
// profondeur peuvent détailler chaque technologie / garantie ici. Contenu tiré
// de la bibliothèque de copie (content.ts) — aucune affirmation nouvelle.

import * as React from "react";
import {
  X, Boxes, Fingerprint, ShieldCheck, RefreshCw, ScrollText, Building2, Scale, Network,
} from "lucide-react";
import type { DeepDiveTopic } from "./shared";
import {
  SCENE_SYSTEM, SCENE_FOOTPRINT, SCENE_TRUST, SCENE_SCALE, SCENE_PIERRE_SCOPE, SCENE_ORGANIZATION,
} from "@/lib/demo/presentation/content";

interface DeepDiveSection {
  heading: string;
  items: readonly string[];
}
interface DeepDiveContent {
  Icon: typeof Boxes;
  kicker: string;
  title: string;
  lead: string;
  chips?: readonly string[];
  sections?: readonly DeepDiveSection[];
  note?: string;
}

export const DEEP_DIVES: Record<DeepDiveTopic, DeepDiveContent> = {
  cloneos: {
    Icon: Boxes,
    kicker: "Le coordinateur",
    title: "CloneOS — transforme un objectif en travail organisé",
    lead: "CloneOS lit la demande, la décompose en missions et en tâches, établit les dépendances, les échéances et les intervenants, puis coordonne l'avancement.",
    chips: SCENE_SYSTEM.layers[0].facts,
    sections: [{ heading: "Ce qu'il fait", items: ["Comprendre", "Décomposer", "Prioriser", "Coordonner"] }],
    note: SCENE_ORGANIZATION.orchestrationMessage[1],
  },
  empreinte: {
    Icon: Fingerprint,
    kicker: "La connaissance de l'entreprise",
    title: "L'Empreinte Entreprise — travailler comme votre entreprise",
    lead: SCENE_FOOTPRINT.paragraphs[1],
    chips: SCENE_FOOTPRINT.dimensions,
    sections: [
      { heading: "Avant l'Empreinte", items: SCENE_FOOTPRINT.before },
      { heading: "Avec l'Empreinte", items: SCENE_FOOTPRINT.after },
      { heading: "Mise en place", items: SCENE_FOOTPRINT.timeline },
    ],
    note: SCENE_FOOTPRINT.privacy[1],
  },
  cloneguard: {
    Icon: ShieldCheck,
    kicker: "L'autonomie encadrée",
    title: "CloneGuard — avancer seul, sans jamais agir à l'aveugle",
    lead: SCENE_TRUST.paragraphs[0],
    sections: [
      { heading: "Chaque action suit un chemin", items: SCENE_TRUST.outcomes },
      { heading: "Niveaux d'autonomie", items: SCENE_TRUST.trustLevels },
    ],
    note: SCENE_TRUST.paragraphs[7],
  },
  clonecontinuum: {
    Icon: RefreshCw,
    kicker: "La continuité",
    title: "CloneContinuum — la mission reste active dans le temps",
    lead: "Lorsqu'une mission attend une information ou une échéance, Pierre ne l'abandonne pas : il la maintient active, la reprend et la suit jusqu'à sa clôture.",
    sections: [{ heading: "Sur une semaine", items: ["Relance planifiée", "Attente signalée", "Reprise sans perte de contexte", "Échéance surveillée"] }],
    note: SCENE_PIERRE_SCOPE.compression[1],
  },
  clonetrace: {
    Icon: ScrollText,
    kicker: "La preuve",
    title: "CloneTrace — chaque étape reste visible et retrouvable",
    lead: SCENE_TRUST.paragraphs[6],
    chips: SCENE_SYSTEM.layers[4].facts,
    sections: [{ heading: "Ce qui est tracé", items: SCENE_TRUST.traceSteps }],
  },
  sizing: {
    Icon: Building2,
    kicker: "L'adaptation à la taille",
    title: "Une même capacité, adaptée à chaque organisation",
    lead: SCENE_SCALE.conclusion[0] + " " + SCENE_SCALE.conclusion[1],
    sections: [
      { heading: SCENE_SCALE.tiers[0].label, items: [SCENE_SCALE.tiers[0].detail] },
      { heading: SCENE_SCALE.tiers[1].label, items: [SCENE_SCALE.tiers[1].detail] },
      { heading: SCENE_SCALE.tiers[2].label, items: SCENE_SCALE.tiers[2].metrics },
      { heading: SCENE_SCALE.tiers[3].label, items: [SCENE_SCALE.tiers[3].detail] },
    ],
  },
  frontier: {
    Icon: Scale,
    kicker: "La frontière",
    title: "Ce que Pierre prend en charge, ce que vous conservez",
    lead: SCENE_PIERRE_SCOPE.frontierPhrase[0] + " " + SCENE_PIERRE_SCOPE.frontierPhrase[1],
    sections: [
      { heading: "Pierre prend en charge", items: SCENE_PIERRE_SCOPE.frontierPierre },
      { heading: "Votre équipe conserve", items: SCENE_PIERRE_SCOPE.frontierCompany },
    ],
  },
  organization: {
    Icon: Network,
    kicker: "La suite",
    title: "Pierre est le premier employé. CloneStore est l'organisation.",
    lead: SCENE_ORGANIZATION.paragraphs[1],
    chips: SCENE_ORGANIZATION.futureDomains,
    sections: [{ heading: "Ce qui reste commun", items: SCENE_ORGANIZATION.pillars }],
    note: SCENE_ORGANIZATION.earlyValue,
  },
};

export function DemoDeepDive({
  topic,
  onClose,
}: {
  topic: DeepDiveTopic | null;
  onClose: () => void;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const open = topic !== null;

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus({ preventScroll: true });
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
    };
  }, [open, topic, onClose]);

  if (!topic) return null;
  const c = DEEP_DIVES[topic];

  return (
    <div className="demo-dd-backdrop" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className="demo-dd"
        role="dialog"
        aria-modal="true"
        aria-label={c.title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="demo-dd__head">
          <span className="demo-dd__ico" aria-hidden>
            <c.Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="demo-kicker">{c.kicker}</p>
            <p className="text-[0.98rem] font-semibold text-[var(--cs-ink-1)]">{c.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="demo-btn demo-btn-ghost ml-auto shrink-0"
            style={{ minHeight: 36, padding: "0 10px" }}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="demo-dd__body" ref={bodyRef}>
          <p className="demo-lede">{c.lead}</p>
          {c.chips ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {c.chips.map((chip) => (
                <span key={chip} className="demo-chip">{chip}</span>
              ))}
            </div>
          ) : null}
          {c.sections?.map((s) => (
            <div key={s.heading} className="mt-5">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">{s.heading}</p>
              <ul className="mt-2 grid gap-1.5">
                {s.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-[0.86rem] text-[var(--cs-ink-2)]">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--demo-violet)]" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {c.note ? (
            <p className="mt-5 rounded-2xl border border-[var(--cs-line)] bg-white/55 p-4 text-[0.84rem] text-[var(--cs-ink-2)]">
              {c.note}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
