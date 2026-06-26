"use client";

// CloneStory — actions de « Mon Registre » : copie du lien/code en un geste,
// formulaire « Faire une introduction » (< 2 min), rotation du lien.

import { useState } from "react";
import { useRouter } from "next/navigation";

function Copy({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="csy-copybtn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* copie manuelle possible */
        }
      }}
    >
      {copied ? "Copié" : label}
    </button>
  );
}

export function Credential({ k, value, copyLabel }: { k: string; value: string; copyLabel: string }) {
  return (
    <div className="csy-field-line">
      <span className="csy-field-line__k">{k}</span>
      <span className="csy-field-line__v">
        <span>{value}</span>
        <Copy value={value} label={copyLabel} />
      </span>
    </div>
  );
}

export function IntroduceCta() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const data = new FormData(e.currentTarget);
    if (data.get("confirmKnown") !== "on") {
      setError("Veuillez confirmer que le contact vous connaît ou a accepté la mise en relation.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/founding-partners/introduce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prospectFirstName: data.get("prospectFirstName") || null,
          prospectCompany: data.get("prospectCompany"),
          prospectEmail: data.get("prospectEmail"),
          note: data.get("note") || null,
          confirmKnown: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setStatus("done");
        setTimeout(() => router.refresh(), 1200);
      } else {
        setError(
          json.error === "self_attribution" ? "Vous ne pouvez pas vous introduire vous-même."
          : json.error === "already_introduced" ? "Vous avez déjà introduit ce contact."
          : "Introduction impossible. Vérifiez les informations.",
        );
        setStatus("error");
      }
    } catch {
      setError("Une erreur réseau est survenue.");
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <button type="button" className="csy-button" onClick={() => setOpen(true)}>
        Faire une introduction
      </button>
    );
  }

  if (status === "done") {
    return (
      <div className="csy-notice csy-notice--ok" role="status">
        Demande envoyée. Le contact recevra un message lui demandant de confirmer. Tant qu'il n'a pas confirmé,
        aucune contribution n'est créditée.
      </div>
    );
  }

  return (
    <form className="csy-form" onSubmit={onSubmit} noValidate style={{ marginTop: 8 }}>
      <div className="csy-row2">
        <div className="csy-field">
          <label className="csy-label" htmlFor="prospectFirstName">Nom du contact <span>— facultatif</span></label>
          <input className="csy-input" id="prospectFirstName" name="prospectFirstName" />
        </div>
        <div className="csy-field">
          <label className="csy-label" htmlFor="prospectCompany">Entreprise</label>
          <input className="csy-input" id="prospectCompany" name="prospectCompany" required />
        </div>
      </div>
      <div className="csy-field">
        <label className="csy-label" htmlFor="prospectEmail">Email professionnel</label>
        <input className="csy-input" id="prospectEmail" name="prospectEmail" type="email" required inputMode="email" />
      </div>
      <div className="csy-field">
        <label className="csy-label" htmlFor="note">Note <span>— facultatif</span></label>
        <textarea className="csy-textarea" id="note" name="note" maxLength={600} />
      </div>
      <label className="csy-check">
        <input type="checkbox" name="confirmKnown" required />
        <span>Je confirme que ce contact me connaît ou a accepté cette mise en relation.</span>
      </label>
      {status === "error" ? <div className="csy-notice" role="alert">{error}</div> : null}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="csy-button" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Envoi…" : "Envoyer l'introduction"}
        </button>
        <button className="csy-button csy-button--ghost" type="button" onClick={() => setOpen(false)}>Annuler</button>
      </div>
    </form>
  );
}

// Le lien personnel est STABLE et toujours visible (rendu côté serveur). Cette action
// secondaire le révoque et en émet un nouveau, sur confirmation explicite — jamais
// automatiquement. L'ancien lien cesse alors de fonctionner.
export function RevokeRenew() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/founding-partners/rotate-link", { method: "POST" });
      router.refresh(); // le registre se re-rend avec le nouveau lien/code
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="csy-copybtn" onClick={() => setConfirming(true)}>
        Révoquer et renouveler
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span className="csy-copy" style={{ fontSize: "0.82rem", color: "var(--csy-stone-2)", margin: 0 }}>
        Cela invalidera votre lien et votre code actuels. Confirmer ?
      </span>
      <button type="button" className="csy-copybtn" onClick={run} disabled={busy}>
        {busy ? "…" : "Confirmer"}
      </button>
      <button type="button" className="csy-copybtn" onClick={() => setConfirming(false)} disabled={busy}>
        Annuler
      </button>
    </span>
  );
}
