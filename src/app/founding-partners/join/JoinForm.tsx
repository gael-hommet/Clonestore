"use client";

// CloneStory — formulaire d'inscription au Cercle (extrêmement simple).
// Soumet à /api/founding-partners/register. Réponse uniforme → message générique.

import { useState } from "react";

export default function JoinForm({ refToken, refCode }: { refToken?: string | null; refCode?: string | null }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [code, setCode] = useState(refCode ?? "");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    try {
      const res = await fetch("/api/founding-partners/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          email: data.get("email"),
          phone: data.get("phone") || null,
          company: data.get("company") || null,
          role: data.get("role") || null,
          displayName: data.get("displayName") || null,
          refToken: refToken ?? null,
          refCode: (data.get("refCode") as string) || null,
          acceptTerms: data.get("acceptTerms") === "on",
          website: data.get("website") || "", // honeypot
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) setStatus("done");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="csy-notice csy-notice--ok" role="status">
        Votre demande a été enregistrée. Confirmez votre adresse pour ouvrir votre registre personnel.
        {" "}Si vous étiez déjà inscrit, ce lien vous y reconduit directement.
      </div>
    );
  }

  return (
    <form className="csy-form" onSubmit={onSubmit} noValidate>
      <div className="csy-row2">
        <div className="csy-field">
          <label className="csy-label" htmlFor="firstName">Prénom</label>
          <input className="csy-input" id="firstName" name="firstName" required autoComplete="given-name" />
        </div>
        <div className="csy-field">
          <label className="csy-label" htmlFor="lastName">Nom</label>
          <input className="csy-input" id="lastName" name="lastName" required autoComplete="family-name" />
        </div>
      </div>

      <div className="csy-field">
        <label className="csy-label" htmlFor="email">Adresse email</label>
        <input className="csy-input" id="email" name="email" type="email" required autoComplete="email" inputMode="email" />
      </div>

      <div className="csy-field">
        <label className="csy-label" htmlFor="displayName">Nom public futur <span>— facultatif</span></label>
        <input className="csy-input" id="displayName" name="displayName" placeholder="Tel qu'il figurerait au registre" />
      </div>

      <div className="csy-row2">
        <div className="csy-field">
          <label className="csy-label" htmlFor="phone">Téléphone <span>— facultatif</span></label>
          <input className="csy-input" id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        <div className="csy-field">
          <label className="csy-label" htmlFor="company">Entreprise / fonction <span>— facultatif</span></label>
          <input className="csy-input" id="company" name="company" autoComplete="organization" />
        </div>
      </div>

      <div className="csy-field">
        <label className="csy-label" htmlFor="refCode">
          Personne vous ayant fait découvrir CloneStory <span>— facultatif</span>
        </label>
        <input
          className="csy-input"
          id="refCode"
          name="refCode"
          placeholder="Code personnel reçu, le cas échéant"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          readOnly={Boolean(refToken)}
        />
      </div>

      {/* Honeypot anti-bot */}
      <div className="csy-hp" aria-hidden="true">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="csy-check">
        <input type="checkbox" name="acceptTerms" required />
        <span>
          J'accepte les <a href="/founding-partners/conditions" className="csy-link" style={{ borderBottomColor: "var(--csy-metal-line)" }}>conditions du Cercle</a>.
          Le Cercle est un registre honorifique : aucune part, action, rémunération ni mandat.
        </span>
      </label>

      {status === "error" ? (
        <div className="csy-notice" role="alert">Une erreur est survenue. Vérifiez vos informations et réessayez.</div>
      ) : null}

      <div>
        <button className="csy-button" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Envoi…" : "Demander mon entrée"}
        </button>
      </div>
    </form>
  );
}
