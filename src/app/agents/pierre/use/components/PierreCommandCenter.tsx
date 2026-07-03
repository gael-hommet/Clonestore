// src/app/agents/pierre/use/components/PierreCommandCenter.tsx
// Chat + mission input center — Pierre Cockpit B31.
// Never auto-submits. User must press enter or click send.

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PierreCockpitMessage } from "@/lib/pierre/cockpit/types";

const EXAMPLE_MISSIONS = [
  "Prépare le contrat de travail CDI pour Marie Dupont, RH senior",
  "Analyse les risques RH de notre équipe tech",
  "Génère un email d'onboarding pour notre nouveau développeur",
  "Synthèse de l'état de santé de tous mes employés",
];

function MessageBubble({ msg }: { msg: PierreCockpitMessage }) {
  const isUser = msg.role === "user";
  const isPending = msg.status === "pending";
  const isError = msg.status === "error";

  return (
    <div
      className={cn(
        "flex gap-3 px-2",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {!isUser && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: "var(--cs-graphite)", color: "#f8f4ec" }}
          aria-hidden="true"
        >
          P
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm"
            : "rounded-tl-sm",
        )}
        style={
          isUser
            ? {
                background: "var(--cs-graphite)",
                color: "var(--cs-ivory)",
              }
            : {
                background: isError
                  ? "var(--cs-danger-bg)"
                  : "var(--cs-surface-strong)",
                color: isError ? "var(--cs-danger)" : "var(--cs-ink-1)",
                border: "1px solid",
                borderColor: isError ? "var(--cs-danger-bg)" : "var(--cs-line)",
              }
        }
      >
        {isPending ? (
          <span className="flex items-center gap-2" style={{ color: "var(--cs-ink-4)" }}>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
            Pierre analyse…
          </span>
        ) : (
          msg.content
        )}
      </div>
    </div>
  );
}

export function PierreCommandCenter({
  messages,
  inputDraft,
  loadingSubmit,
  onInputChange,
  onSubmit,
}: {
  messages: PierreCockpitMessage[];
  inputDraft: string;
  loadingSubmit: boolean;
  onInputChange: (val: string) => void;
  onSubmit: (input: string) => void;
}) {
  const chatRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !loadingSubmit && inputDraft.trim()) {
      e.preventDefault();
      onSubmit(inputDraft);
    }
  };

  const handleExampleClick = (mission: string) => {
    onInputChange(mission);
    textareaRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* ── Message feed ─────────────────────────────────── */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ scrollBehavior: "smooth" }}
        aria-live="polite"
        aria-label="Conversation avec Pierre"
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div className="text-center">
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold"
                style={{ background: "var(--cs-graphite)", color: "var(--cs-ivory)" }}
              >
                P
              </div>
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--cs-ink-1)" }}
              >
                Confier une mission à Pierre
              </h2>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--cs-ink-4)" }}
              >
                Votre employé IA RH. Décrivez votre besoin en langage naturel.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 w-full max-w-xl">
              {EXAMPLE_MISSIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => handleExampleClick(m)}
                  className="rounded-xl px-4 py-3 text-left text-xs font-medium transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: "var(--cs-surface-strong)",
                    border: "1px solid var(--cs-line)",
                    color: "var(--cs-ink-2)",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </div>
        )}
      </div>

      {/* ── Input bar ───────────────────────────────────── */}
      <div
        className="shrink-0 border-t px-4 py-3"
        style={{ borderColor: "var(--cs-line)", background: "var(--cs-surface-soft)" }}
      >
        <div
          className="flex items-end gap-2 rounded-2xl px-4 py-2"
          style={{
            background: "var(--cs-surface-strong)",
            border: "1px solid var(--cs-line)",
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputDraft}
            onChange={(e) => {
              onInputChange(e.target.value);
              // auto-resize
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Confiez une mission RH à Pierre…"
            disabled={loadingSubmit}
            aria-label="Mission à confier à Pierre"
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:opacity-50 leading-relaxed"
            style={{
              color: "var(--cs-ink-1)",
              maxHeight: 160,
              minHeight: 24,
            }}
          />
          <button
            onClick={() => {
              if (!loadingSubmit && inputDraft.trim()) onSubmit(inputDraft);
            }}
            disabled={loadingSubmit || !inputDraft.trim()}
            aria-label="Envoyer la mission"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
              loadingSubmit || !inputDraft.trim()
                ? "opacity-40 cursor-not-allowed"
                : "hover:scale-105 active:scale-95",
            )}
            style={{ background: "var(--cs-graphite)", color: "var(--cs-ivory)" }}
          >
            {loadingSubmit ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
        <p
          className="mt-1.5 text-center text-[11px]"
          style={{ color: "var(--cs-ink-4)" }}
        >
          Entrée pour envoyer · Shift+Entrée pour nouvelle ligne
        </p>
      </div>
    </div>
  );
}
