"use client";

// src/components/cloneroom/CloneRoomConsole.tsx
// P12 §6 — CloneRoom : le SALON de l'entreprise. Group-chat premium mais OPÉRATIONNEL. Participants
// = CloneOS + employés IA (Pierre) + Empreinte Entreprise + technologies + mémoire + humains. Un
// composer simple, un rail de participants, une identité d'émetteur claire, des messages qui peuvent
// devenir missions/validations/preuves. Ne défile pas en page ; seule la liste de messages défile.
// N'est PAS le Global Cockpit. Ne remplace pas Pierre : CloneOS oriente, Pierre exécute le RH.

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Command, Bot, Building2, Cpu, Database, UserRound, ArrowRight, Sparkles, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CloneOsAppShell } from "@/components/cloneos/CloneOsAppShell";
import { CLONEROOM_PARTICIPANTS, CLONEOS_ROUTES, type RoomParticipantKind } from "@/lib/clonestore/cloneos/cloneos-app-shell-contract";

const PARTICIPANT_ICON: Record<RoomParticipantKind, typeof Command> = {
  cloneos: Command, employee_ai: Bot, footprint: Building2, technology: Cpu, company_memory: Database, human: UserRound,
};

interface RoomMessage { id: string; senderKind: RoomParticipantKind; sender: string; text: string; actionable: boolean; sourceText?: string }

let seq = 0;
const nextId = () => `m${++seq}`;

// Extraction d'action RÉELLE : transporte le contenu du message vers le VRAI composer de Pierre
// (/cockpit/pierre/missions?compose=<texte>). Ce n'est PAS une route statique — le texte diffère
// selon le message. Aucune logique RH ici : Pierre exécute, CloneOS oriente.
const composeMissionRoute = (text: string) =>
  text.trim() ? `${CLONEOS_ROUTES.pierreMissions}?compose=${encodeURIComponent(text.trim())}` : CLONEOS_ROUTES.pierreMissions;

export function CloneRoomConsole() {
  const router = useRouter();
  const params = useSearchParams();
  const seed = params?.get("seed") ?? null;
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [lastHuman, setLastHuman] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  // Message d'accueil du salon + amorce éventuelle (?seed depuis CloneOS).
  useEffect(() => {
    const base: RoomMessage[] = [
      { id: nextId(), senderKind: "cloneos", sender: "CloneOS", text: "Bienvenue dans CloneRoom — le salon de votre entreprise IA. Parlez à CloneOS, à Pierre (RH), à votre empreinte ou à vos technologies. Une demande peut devenir une mission.", actionable: false },
    ];
    if (seed && seed.trim()) {
      const s = seed.trim();
      base.push({ id: nextId(), senderKind: "human", sender: "Vous", text: s, actionable: true, sourceText: s });
      base.push({ id: nextId(), senderKind: "cloneos", sender: "CloneOS", text: "J'ai orienté votre demande. Si c'est du RH, Pierre peut la prendre en mission (avec votre validation).", actionable: true, sourceText: s });
      setLastHuman(s);
    }
    setMessages(base);
  }, [seed]);

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); }, [messages]);

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    // Chaque message porte son propre contenu (sourceText) : « en faire une mission » transporte CE texte.
    setMessages((prev) => [
      ...prev,
      { id: nextId(), senderKind: "human", sender: "Vous", text: clean, actionable: true, sourceText: clean },
      { id: nextId(), senderKind: "cloneos", sender: "CloneOS", text: "Compris. Je coordonne : voulez-vous en faire une mission RH avec Pierre ?", actionable: true, sourceText: clean },
    ]);
    setLastHuman(clean);
    setDraft("");
  };

  // Rail de participants (chips) — panneau de contexte.
  const context = (
    <div className="space-y-3" data-testid="cloneroom-context">
      <div>
        <p className="cs-eyebrow mb-1.5">Participants</p>
        <div className="flex flex-col gap-1.5" data-testid="cloneroom-participants">
          {CLONEROOM_PARTICIPANTS.map((p) => {
            const I = PARTICIPANT_ICON[p.kind];
            return (
              <span key={p.kind} className="inline-flex items-center gap-2 rounded-full border border-[var(--cs-line-soft)] bg-white/50 px-2.5 py-1.5 text-[0.78rem] text-[var(--cs-ink-2)]" data-participant={p.kind}>
                <I className="h-3.5 w-3.5 text-[var(--cs-violet)]" /> {p.label}
              </span>
            );
          })}
        </div>
      </div>
      <div>
        <p className="cs-eyebrow mb-1.5">Actions extraites</p>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => router.push(composeMissionRoute(lastHuman))} className="cs-liquid-button justify-start" data-testid="cloneroom-create-mission"><Sparkles className="h-4 w-4" /> Créer une mission RH</button>
          <button type="button" onClick={() => router.push(CLONEOS_ROUTES.pierre)} className="cs-liquid-button justify-start"><Bot className="h-4 w-4" /> Demander à Pierre</button>
          <button type="button" onClick={() => router.push(CLONEOS_ROUTES.pierreDocuments)} className="cs-liquid-button justify-start"><FileCheck2 className="h-4 w-4" /> Ouvrir les preuves</button>
        </div>
      </div>
      <div>
        <p className="cs-eyebrow mb-1.5">Sources / empreinte</p>
        <p className="text-[0.78rem] text-[var(--cs-ink-3)]">Empreinte Entreprise + mémoire de l'entreprise alimentent le contexte du salon.</p>
      </div>
    </div>
  );

  const main = (
    <>
      <div className="flex items-center gap-2 border-b border-[var(--cs-line-soft)] px-4 py-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--cs-violet)]/12 text-[var(--cs-violet)]"><Command className="h-4 w-4" /></span>
        <div>
          <h1 className="text-[1rem] font-semibold tracking-[-0.02em] text-[var(--cs-ink-1)]">CloneRoom</h1>
          <p className="text-[0.74rem] text-[var(--cs-ink-3)]">Le salon de votre entreprise IA</p>
        </div>
      </div>

      {/* Liste de messages (défile en interne uniquement) */}
      <div ref={threadRef} className="cos-main-scroll space-y-3 p-4" data-testid="cloneroom-thread" aria-live="polite">
        {messages.map((m) => {
          const I = PARTICIPANT_ICON[m.senderKind];
          const mine = m.senderKind === "human";
          return (
            <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-violet)]"><I className="h-3.5 w-3.5" /></span>
              <div className={cn("max-w-[80%] rounded-[1rem] border border-[var(--cs-line-soft)] px-3 py-2", mine ? "bg-[var(--cs-violet)]/10" : "bg-white/50")}>
                <p className="text-[0.72rem] font-medium text-[var(--cs-ink-3)]">{m.sender}</p>
                <p className="text-[0.88rem] leading-6 text-[var(--cs-ink-1)]">{m.text}</p>
                {m.actionable && !mine ? (
                  <button type="button" onClick={() => router.push(composeMissionRoute(m.sourceText ?? m.text))} className="mt-1.5 inline-flex items-center gap-1 text-[0.74rem] font-medium text-[var(--cs-violet)]">
                    En faire une mission <ArrowRight className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer (collant) */}
      <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex items-end gap-2 border-t border-[var(--cs-line-soft)] p-3" data-testid="cloneroom-composer">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }}
          rows={1}
          aria-label="Message CloneRoom"
          placeholder="Écrivez au salon (CloneOS, Pierre, empreinte…)"
          className="max-h-28 min-h-[44px] flex-1 resize-none rounded-[1rem] border border-[var(--cs-line-soft)] bg-white/60 px-3 py-2.5 text-[0.9rem] leading-6 text-[var(--cs-ink-1)] outline-none"
        />
        <button type="submit" aria-label="Envoyer" disabled={!draft.trim()} className={cn("cs-liquid-button cs-liquid-button--primary h-[44px]", !draft.trim() && "pointer-events-none opacity-50")}>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </>
  );

  return <CloneOsAppShell companyLabel={null} main={main} context={context} contextTitle="Salon" surfaceTestId="cloneroom-console" />;
}
