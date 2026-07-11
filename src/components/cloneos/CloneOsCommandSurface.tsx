"use client";

// src/components/cloneos/CloneOsCommandSurface.tsx
// P12 §5 — Surface de commande CloneOS (premier écran du Global Cockpit). Accueil + composer +
// commandes suggérées. CloneOS ROUTE / RÉSUME / COORDONNE — il n'exécute PAS la logique RH (Pierre
// le fait). Les commandes de navigation ouvrent la bonne surface ; une demande libre est routée
// vers CloneRoom (le salon) où la conversation multi-participants a lieu.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Command, ArrowRight, Bot, ShieldCheck, MessagesSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CLONEOS_WELCOME, CLONEOS_SUGGESTED_COMMANDS, CLONEOS_ROUTES,
} from "@/lib/clonestore/cloneos/cloneos-app-shell-contract";

// Route directe pour les commandes de navigation connues (sinon → CloneRoom avec la demande).
function routeForCommand(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("ouvre pierre") || t.includes("pierre")) return CLONEOS_ROUTES.pierre;
  if (t.includes("validation")) return CLONEOS_ROUTES.pierreValidations;
  if (t.includes("cloneroom") || t.includes("salon")) return CLONEOS_ROUTES.cloneRoom;
  if (t.includes("mission")) return CLONEOS_ROUTES.pierreMissions;
  if (t.includes("bloque") || t.includes("risque")) return CLONEOS_ROUTES.cockpit;
  return null;
}

export function CloneOsCommandSurface() {
  const router = useRouter();
  const [draft, setDraft] = useState("");

  const run = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const direct = routeForCommand(clean);
    // Commande de navigation connue → ouvre la surface ; sinon → route la demande vers CloneRoom.
    if (direct && direct !== CLONEOS_ROUTES.cloneRoom) { router.push(direct); return; }
    router.push(`${CLONEOS_ROUTES.cloneRoom}?seed=${encodeURIComponent(clean)}`);
  };

  return (
    <div className="cos-main-scroll" data-testid="cloneos-command-surface">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-6 px-5 py-8">
        <div className="space-y-2 text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--cs-violet)]/12 text-[var(--cs-violet)]">
            <Command className="h-5 w-5" />
          </span>
          <h1 className="text-[1.6rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]" data-testid="cloneos-title">{CLONEOS_WELCOME.title}</h1>
          <p className="text-[1rem] text-[var(--cs-ink-2)]">{CLONEOS_WELCOME.subtitle}</p>
          <p className="text-[0.86rem] leading-6 text-[var(--cs-ink-3)]">{CLONEOS_WELCOME.prompt}</p>
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => { e.preventDefault(); run(draft); }}
          className="cs-panel flex items-end gap-2 p-2"
          data-testid="cloneos-composer"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(draft); } }}
            rows={1}
            aria-label="Commande CloneOS"
            placeholder="Demandez une mission, ouvrez un dossier, appelez un employé IA…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-[1rem] bg-transparent px-3 py-2.5 text-[0.9rem] leading-6 text-[var(--cs-ink-1)] outline-none"
          />
          <button type="submit" aria-label="Envoyer" disabled={!draft.trim()} className={cn("cs-liquid-button cs-liquid-button--primary h-[44px]", !draft.trim() && "pointer-events-none opacity-50")}>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Commandes suggérées */}
        <div className="flex flex-wrap justify-center gap-2" data-testid="cloneos-suggested">
          {CLONEOS_SUGGESTED_COMMANDS.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => run(cmd)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cs-line-soft)] bg-white/50 px-3 py-1.5 text-[0.8rem] text-[var(--cs-ink-2)] hover:bg-white/80"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
              {cmd}
            </button>
          ))}
        </div>

        {/* Raccourcis explicites (routage, pas exécution RH) */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <a href={CLONEOS_ROUTES.pierre} className="cs-card cs-card-tight flex items-center gap-2 text-left"><Bot className="h-4 w-4 text-[var(--cs-violet)]" /> Ouvrir Pierre — RH</a>
          <a href={CLONEOS_ROUTES.pierreValidations} className="cs-card cs-card-tight flex items-center gap-2 text-left"><ShieldCheck className="h-4 w-4 text-[var(--cs-violet)]" /> Mes validations</a>
          <a href={CLONEOS_ROUTES.cloneRoom} className="cs-card cs-card-tight flex items-center gap-2 text-left"><MessagesSquare className="h-4 w-4 text-[var(--cs-violet)]" /> Ouvrir CloneRoom</a>
        </div>

        <p className="text-center text-[0.72rem] text-[var(--cs-ink-4)]">
          CloneOS coordonne et oriente. Pierre — employé IA RH — exécute le travail RH.
        </p>
      </div>
    </div>
  );
}
