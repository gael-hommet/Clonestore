"use client";
// src/components/clonechat/HistoryPanel.tsx
// C1.8 FINAL PART 2 §5C — L'HISTORIQUE DEVIENT VISIBLE.
//
// Le store de conversations existait déjà (serveur pour les comptes, local pour les anonymes) —
// mais l'interface n'en montrait RIEN : un utilisateur ne pouvait ni revoir, ni rouvrir, ni
// supprimer un fil. Une fonctionnalité qu'on ne peut pas voir n'existe pas pour le client.
//
// Ce panneau ne crée aucun second store : il AFFICHE celui qui existe.
//
// Honnêteté : pour un visiteur anonyme, on DIT que l'historique ne vit que dans ce navigateur.
// On ne laisse jamais croire à une durabilité qu'on n'assure pas.

import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Trash2, X, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { LOCAL_HISTORY_DISCLAIMER } from "@/lib/clonechat/conversations/local-store";

export interface HistoryConversation {
  readonly id: string;
  readonly title: string;
  readonly lastActivityAt: string;
}

/** Date utile et lisible — jamais un horodatage technique. */
function whenLabel(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} jours`;
  return new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

interface Props {
  conversations: readonly HistoryConversation[];
  activeId: string | null;
  anonymous: boolean;
  loading?: boolean;
  error?: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function HistoryList({ conversations, activeId, anonymous, loading, error, onNew, onOpen, onDelete }: Props) {
  // La suppression demande une CONFIRMATION : un fil effacé ne revient pas.
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col gap-2">
      <button
        type="button"
        onClick={onNew}
        className="cs-liquid-button cs-liquid-button--primary flex w-full items-center justify-center gap-2 py-2 text-[0.82rem]"
        data-testid="history-new"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Nouvelle conversation
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto" role="list" aria-label="Historique des conversations">
        {loading ? (
          <p className="px-1 py-3 text-[0.78rem] text-[var(--cs-ink-4)]">Chargement de l'historique…</p>
        ) : error ? (
          // Un échec se DIT. Il ne se déguise pas en « aucune conversation ».
          <p className="px-1 py-3 text-[0.78rem] text-[var(--cs-warn)]" data-testid="history-error">
            {error}
          </p>
        ) : conversations.length === 0 ? (
          <p className="px-1 py-3 text-[0.78rem] text-[var(--cs-ink-4)]" data-testid="history-empty">
            Aucune conversation pour l'instant. Posez une question : elle apparaîtra ici.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conversations.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id} role="listitem">
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-lg px-2 py-1.5 transition",
                      active ? "bg-[var(--cs-surface-2)]" : "hover:bg-[var(--cs-surface-2)]/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(c.id)}
                      aria-current={active ? "true" : undefined}
                      className="min-w-0 flex-1 text-left"
                      data-testid="history-item"
                      data-conversation-id={c.id}
                    >
                      <span className="block truncate text-[0.82rem] text-[var(--cs-ink-1)]">{c.title}</span>
                      <span className="block text-[0.7rem] text-[var(--cs-ink-4)]">{whenLabel(c.lastActivityAt)}</span>
                    </button>

                    {confirming === c.id ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { onDelete(c.id); setConfirming(null); }}
                          aria-label={`Confirmer la suppression de ${c.title}`}
                          className="rounded px-1.5 py-0.5 text-[0.7rem] text-[var(--cs-warn)] hover:underline"
                          data-testid="history-delete-confirm"
                        >
                          Supprimer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          aria-label="Annuler la suppression"
                          className="rounded p-1 text-[var(--cs-ink-4)]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirming(c.id)}
                        aria-label={`Supprimer la conversation ${c.title}`}
                        // P17 — sur TACTILE (aucun hover), `opacity-0 group-hover` rendait ce bouton
                        // INVISIBLE et introuvable. On ne masque au repos QUE sur les pointeurs fins
                        // (`@media (hover:hover)`) ; sur tactile il reste visible par défaut.
                        className="shrink-0 rounded p-1 text-[var(--cs-ink-4)] opacity-100 transition [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus:opacity-100"
                        data-testid="history-delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {anonymous ? (
        <p className="border-t border-[var(--cs-line)] pt-2 text-[0.68rem] leading-4 text-[var(--cs-ink-4)]" data-testid="history-local-disclaimer">
          {LOCAL_HISTORY_DISCLAIMER}
        </p>
      ) : null}
    </div>
  );
}

/** Panneau DESKTOP (colonne) — discret, jamais encombrant. */
export function HistoryPanel(props: Props) {
  return (
    <aside
      className="hidden w-60 shrink-0 border-r border-[var(--cs-line)] px-2 py-3 lg:flex lg:flex-col"
      aria-label="Historique"
      data-testid="history-panel"
    >
      <HistoryList {...props} />
    </aside>
  );
}

/** Tiroir MOBILE — même contenu, même code, aucune seconde implémentation. */
export function HistoryDrawer(props: Props & { open: boolean; onClose: () => void }) {
  const { open, onClose, ...rest } = props;
  const drawerRef = useRef<HTMLDivElement | null>(null);
  // P17 — le tiroir déclarait `aria-modal="true"` SANS aucun comportement modal : pas de focus-in,
  // pas de piège Tab, pas d'Escape, pas de restauration du focus. Sur le SEUL chemin mobile vers
  // l'historique, un utilisateur clavier/lecteur d'écran tabulait hors du tiroir dans la page
  // masquée. On reprend le contrat modal déjà éprouvé de MissionComposer.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const SEL = 'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])';
    drawerRef.current?.querySelector<HTMLElement>(SEL)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab" && drawerRef.current) {
        const f = drawerRef.current.querySelectorAll<HTMLElement>(SEL);
        if (f.length === 0) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; prev?.focus?.(); };
  }, [open, onClose]);
  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Historique">
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
          <div ref={drawerRef} className="absolute left-0 top-0 h-full w-72 bg-[var(--cs-surface-1)] px-3 py-4 shadow-xl" data-testid="history-drawer">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[0.85rem] font-medium text-[var(--cs-ink-1)]">
                <History className="h-4 w-4" /> Historique
              </span>
              <button type="button" onClick={onClose} aria-label="Fermer l'historique" className="rounded p-1 text-[var(--cs-ink-3)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[calc(100%-2.5rem)]">
              <HistoryList {...rest} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
