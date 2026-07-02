"use client";

// Empreinte continue — surface human-in-the-loop (P9.2, Étape 3).
//
// Branchée sur les cœurs purs continuous-footprint. INVARIANT : aucune
// proposition n'est appliquée sans action humaine explicite. En Production,
// aucune source réelle → état vide réel (texte exact). Les fixtures ne servent
// qu'aux tests composants ; jamais dans le produit final (entries vide = vide).

import { useState } from "react";
import { Check, Pencil, Sparkles, X } from "lucide-react";
import {
  CONTINUOUS_EMPTY_MESSAGE,
  acceptEntry,
  isEmpty,
  refuseEntry,
  replaceEntry,
  requiresValidation,
  type ContinuousEntry,
} from "@/lib/client-onboarding";
import { ProfileEmptyState } from "../../_ui/profile-primitives";

const DECISION_LABEL: Record<ContinuousEntry["decision"], string> = {
  to_verify: "À vérifier",
  accepted: "Acceptée",
  refused: "Refusée",
  replaced: "Remplacée",
};

export function ContinuousFootprintSurface({
  entries = [],
}: {
  /** Vide en Production (aucune source réelle). Les tests injectent des fixtures. */
  entries?: ContinuousEntry[];
}) {
  const [items, setItems] = useState<ContinuousEntry[]>(entries);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const apply = (id: string, fn: (e: ContinuousEntry) => ContinuousEntry) =>
    setItems((list) => list.map((e) => (e.id === id ? fn(e) : e)));

  return (
    <section data-tour-id="mycs-continuous" className="cs-panel p-5">
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <p className="cs-eyebrow">Informations à confirmer</p>
          <p className="text-[0.86rem] leading-6 text-[var(--cs-ink-3)]">
            Les informations proposées pendant l'usage — validées par vous, jamais appliquées en silence.
          </p>
        </div>

        {isEmpty(items) ? (
          <ProfileEmptyState
            title="Aucune information à confirmer"
            text={CONTINUOUS_EMPTY_MESSAGE + " Les propositions de Pierre apparaîtront ici pour votre validation."}
            actions={
              <span className="inline-flex items-center gap-2 text-[0.82rem] text-[var(--cs-ink-4)]">
                <Sparkles className="h-4 w-4" />
                Rien n'est ajouté à votre empreinte sans votre accord.
              </span>
            }
          />
        ) : (
          <ul className="grid gap-3">
            {items.map((e) => (
              <li key={e.id} className="cs-card cs-card-tight">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[0.9rem] font-semibold text-[var(--cs-ink-1)]">{e.field}</p>
                    <span className="cs-status">{DECISION_LABEL[e.decision]}</span>
                  </div>
                  <p className="text-[0.84rem] leading-6 text-[var(--cs-ink-3)]">
                    Proposé : <span className="font-medium text-[var(--cs-ink-1)]">{e.value}</span>
                  </p>
                  <p className="text-[0.76rem] text-[var(--cs-ink-4)]">
                    Source : {e.provenance} · {new Date(e.recordedAt).toLocaleDateString("fr-FR")}
                    {requiresValidation(e) ? " · validation humaine requise" : ""}
                  </p>

                  {editing === e.id ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        value={editValue}
                        onChange={(ev) => setEditValue(ev.target.value)}
                        aria-label="Nouvelle valeur"
                        className="min-h-[40px] flex-1 rounded-[1rem] border border-[var(--cs-line-soft)] bg-white/60 px-3 text-[0.85rem] outline-none focus-visible:border-[var(--cs-violet)]"
                      />
                      <button
                        type="button"
                        className="cs-liquid-button cs-liquid-button--primary"
                        onClick={() => { apply(e.id, (x) => replaceEntry(x, editValue)); setEditing(null); }}
                      >
                        <Check className="h-4 w-4" /><span>Valider</span>
                      </button>
                    </div>
                  ) : e.decision === "to_verify" ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button type="button" className="cs-liquid-button cs-liquid-button--primary" onClick={() => apply(e.id, acceptEntry)}>
                        <Check className="h-4 w-4" /><span>Accepter</span>
                      </button>
                      <button type="button" className="cs-liquid-button" onClick={() => { setEditing(e.id); setEditValue(e.value); }}>
                        <Pencil className="h-4 w-4" /><span>Modifier</span>
                      </button>
                      <button type="button" className="cs-liquid-button" onClick={() => apply(e.id, refuseEntry)}>
                        <X className="h-4 w-4" /><span>Refuser</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
