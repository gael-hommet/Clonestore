"use client";

// /demo — ACTE 5 : la confiance, dans l'ordre des questions du prospect.
// Comprend-il mon entreprise ? Peut-il travailler ? Peut-il tout faire ?
// Puis-je vérifier ? Que se passe-t-il quand il ne sait pas ?
// Un panneau interactif regroupe les objections — pas cinq scènes séparées.

import * as React from "react";
import { Fingerprint, CheckCircle2, ShieldAlert, ScrollText, HelpCircle, ChevronRight, Plus, Building2, Scale } from "lucide-react";
import { Reveal } from "../primitives/motion";
import { GlassSurface } from "../primitives/GlassSurface";
import { ValidationCard } from "../primitives/ValidationCard";
import { StatusBadge } from "../primitives/status";
import { useSceneView } from "../primitives/useSceneView";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_TRUST, SCENE_FOOTPRINT } from "@/lib/demo/presentation/content";
import type { DeepDiveTopic } from "../shared";

const QUESTIONS = [
  { id: "adn", Icon: Fingerprint, q: "Comprend-il vraiment mon entreprise ?" },
  { id: "work", Icon: CheckCircle2, q: "Peut-il réellement travailler seul ?" },
  { id: "guard", Icon: ShieldAlert, q: "Peut-il faire n'importe quoi ?" },
  { id: "verify", Icon: ScrollText, q: "Puis-je vérifier ce qu'il fait ?" },
  { id: "unknown", Icon: HelpCircle, q: "Que se passe-t-il quand il ne sait pas ?" },
] as const;

type QId = (typeof QUESTIONS)[number]["id"];

function Answer({ id, onDeepDive }: { id: QId; onDeepDive: (t: DeepDiveTopic) => void }) {
  if (id === "adn") {
    return (
      <AnswerShell lead={SCENE_FOOTPRINT.paragraphs[1]} deepDive={["empreinte", "Détailler l'Empreinte"]} onDeepDive={onDeepDive}>
        <div className="flex flex-wrap gap-1.5">
          {SCENE_FOOTPRINT.after.map((a) => (
            <span key={a} className="demo-chip">{a}</span>
          ))}
        </div>
      </AnswerShell>
    );
  }
  if (id === "work") {
    return (
      <AnswerShell lead="Oui — dans son périmètre. Pierre exécute les actions autorisées, prépare le reste et présente ce qui attend une décision.">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="ok">Exécuter — autorisé</StatusBadge>
          <StatusBadge tone="warn">Préparer — validation</StatusBadge>
          <StatusBadge tone="info">Présenter — décision</StatusBadge>
        </div>
      </AnswerShell>
    );
  }
  if (id === "guard") {
    return (
      <AnswerShell
        lead="Non. Chaque action est évaluée selon son contexte, sa sensibilité et les droits du demandeur."
        deepDive={["cloneguard", "Détailler CloneGuard"]}
        onDeepDive={onDeepDive}
      >
        <div className="grid gap-1.5 sm:grid-cols-2">
          {SCENE_TRUST.permissions.map((p) => (
            <div key={p.label} className="flex items-center gap-2 rounded-lg border border-white/65 bg-white/55 px-2.5 py-2">
              <StatusBadge tone={p.tone}>{p.verdict}</StatusBadge>
              <span className="text-[0.76rem] text-[var(--cs-ink-2)]">{p.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-[rgba(184,74,74,0.22)] bg-[rgba(184,74,74,0.06)] p-3">
          <p className="text-[0.76rem] font-medium text-[var(--cs-ink-1)]">« {SCENE_TRUST.refusalRequest} »</p>
          <p className="mt-1.5 text-[0.78rem] font-semibold text-[var(--demo-danger)]">{SCENE_TRUST.refusalResponse[0]}</p>
          <p className="mt-1 text-[0.76rem] text-[var(--cs-ink-2)]">{SCENE_TRUST.refusalResponse[2]}</p>
        </div>
      </AnswerShell>
    );
  }
  if (id === "verify") {
    return (
      <AnswerShell
        lead={SCENE_TRUST.paragraphs[6]}
        deepDive={["clonetrace", "Détailler CloneTrace"]}
        onDeepDive={onDeepDive}
      >
        <div className="flex flex-wrap gap-1.5">
          {SCENE_TRUST.traceSteps.map((t) => (
            <span key={t} className="demo-chip">{t}</span>
          ))}
        </div>
      </AnswerShell>
    );
  }
  return (
    <AnswerShell lead="Il signale l'information manquante et attend — il ne l'invente jamais. Une validation humaine intervient lorsque la nature de l'action le justifie.">
      <ValidationCard action="Envoi de l'avenant de Clara" fields={SCENE_TRUST.validationCard} />
    </AnswerShell>
  );
}

function AnswerShell({
  lead,
  children,
  deepDive,
  onDeepDive,
}: {
  lead: string;
  children: React.ReactNode;
  deepDive?: [DeepDiveTopic, string];
  onDeepDive?: (t: DeepDiveTopic) => void;
}) {
  return (
    <div>
      <p className="demo-lede">{lead}</p>
      <div className="mt-4">{children}</div>
      {deepDive && onDeepDive ? (
        <button
          type="button"
          onClick={() => onDeepDive(deepDive[0])}
          className="demo-btn demo-btn-ghost mt-4"
          style={{ minHeight: 34, fontSize: "0.78rem", padding: "0 12px" }}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {deepDive[1]}
        </button>
      ) : null}
    </div>
  );
}

export function Act5Trust({ onDeepDive }: { onDeepDive: (t: DeepDiveTopic) => void }) {
  const ref = useSceneView<HTMLElement>(DEMO_EVENTS.trustSectionViewed);
  const [active, setActive] = React.useState<QId>("adn");

  return (
    <section ref={ref} id="demo-act-trust" className="demo-section demo-cv" aria-label="La confiance : gouvernance et contrôle">
      <div className="demo-shell">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="demo-kicker">La confiance</p>
          <h2 className="demo-title demo-title--section mt-3">
            La confiance n&apos;est pas une promesse.
            <br />
            <span className="demo-accent">C&apos;est une architecture.</span>
          </h2>
          <p className="demo-lede mx-auto mt-3 max-w-2xl">
            Vous définissez le cadre. CloneStore l&apos;applique. Cliquez sur une question — dans l&apos;ordre où elle
            vient à l&apos;esprit.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <Reveal className="grid gap-2">
            {QUESTIONS.map((item) => {
              const on = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(item.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    on
                      ? "border-[var(--demo-violet-soft)] bg-[rgba(107,99,232,0.08)]"
                      : "border-[var(--cs-line)] bg-white/55 hover:bg-white/75"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      on ? "bg-[rgba(107,99,232,0.14)] text-[var(--demo-violet)]" : "bg-white/70 text-[var(--cs-ink-4)]"
                    }`}
                  >
                    <item.Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className={`flex-1 text-[0.86rem] font-medium ${on ? "text-[var(--cs-ink-1)]" : "text-[var(--cs-ink-2)]"}`}>
                    {item.q}
                  </span>
                  <ChevronRight className={`h-4 w-4 shrink-0 ${on ? "text-[var(--demo-violet)]" : "text-[var(--cs-ink-4)]"}`} aria-hidden="true" />
                </button>
              );
            })}
          </Reveal>

          <GlassSurface key={active} kind="material" weight="card" className="rounded-[1.5rem] p-5" materialize={false}>
            <Answer id={active} onDeepDive={onDeepDive} />
          </GlassSurface>
        </div>

        <Reveal delay={0.06} className="mt-7 flex flex-col items-center gap-3 text-center">
          <p className="demo-statement max-w-2xl">{SCENE_TRUST.conclusion[0]} {SCENE_TRUST.conclusion[1]}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => onDeepDive("sizing")} className="demo-btn demo-btn-ghost" style={{ minHeight: 36 }}>
              <Building2 className="h-4 w-4" aria-hidden="true" /> Adaptation à la taille
            </button>
            <button type="button" onClick={() => onDeepDive("frontier")} className="demo-btn demo-btn-ghost" style={{ minHeight: 36 }}>
              <Scale className="h-4 w-4" aria-hidden="true" /> Pierre / vous : la frontière
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
