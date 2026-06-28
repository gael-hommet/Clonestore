"use client";

// CloneStory — inscription au Cercle + ÉCRAN D'ATTENTE dynamique (onboarding seamless).
// Le formulaire soumet à /api/founding-partners/register (réponse uniforme). En cas de
// succès, on bascule sur un écran d'attente qui interroge le statut et redirige
// AUTOMATIQUEMENT vers le registre dès que la session CloneStore est établie (même
// navigateur). Aucun second email. Aucune PII complète exposée au polling.

import { useCallback, useEffect, useRef, useState } from "react";
import { getSessionClient } from "@/lib/auth/session-client";

const STATUS_KEY = "csy.registration.statusToken.v1";

export default function JoinForm({ refToken, refCode }: { refToken?: string | null; refCode?: string | null }) {
  const [status, setStatus] = useState<"idle" | "sending" | "waiting" | "error">("idle");
  const [code, setCode] = useState(refCode ?? "");
  const [email, setEmail] = useState("");
  const [statusToken, setStatusToken] = useState<string | null>(null);

  const submit = useCallback(async (payload: Record<string, unknown>): Promise<{ ok: boolean; statusToken?: string }> => {
    const res = await fetch("/api/founding-partners/register", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; statusToken?: string };
    return { ok: Boolean(res.ok && json.ok), statusToken: json.statusToken };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const data = new FormData(e.currentTarget);
    const emailVal = String(data.get("email") ?? "").trim();
    setEmail(emailVal);
    setStatus("sending");
    try {
      const r = await submit({
        firstName: data.get("firstName"), lastName: data.get("lastName"), email: emailVal,
        phone: data.get("phone") || null, company: data.get("company") || null, role: data.get("role") || null,
        displayName: data.get("displayName") || null, refToken: refToken ?? null,
        refCode: (data.get("refCode") as string) || null, acceptTerms: data.get("acceptTerms") === "on",
        website: data.get("website") || "",
      });
      if (r.ok) {
        if (r.statusToken) { try { sessionStorage.setItem(STATUS_KEY, r.statusToken); } catch { /* ok */ } setStatusToken(r.statusToken); }
        setStatus("waiting");
      } else setStatus("error");
    } catch { setStatus("error"); }
  }

  if (status === "waiting") {
    return <WaitingScreen email={email} statusToken={statusToken} onChangeAddress={() => { setStatus("idle"); try { sessionStorage.removeItem(STATUS_KEY); } catch { /* ok */ } }} resend={(em) => submit({ email: em, acceptTerms: true, website: "" })} />;
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
        <input className="csy-input" id="refCode" name="refCode" placeholder="Code personnel reçu, le cas échéant"
          value={code} onChange={(e) => setCode(e.target.value)} readOnly={Boolean(refToken)} />
      </div>

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

      {/* Transparence : création/connexion du compte CloneStore lors de la confirmation. */}
      <p className="csy-copy" style={{ fontSize: "0.82rem", opacity: 0.78 }}>
        En confirmant ton adresse, un compte CloneStore sera créé ou connecté avec cette adresse
        afin de te donner accès à ton registre. Un seul email te sera envoyé.
      </p>

      {status === "error" ? (
        <div className="csy-notice" role="alert">Une erreur est survenue. Vérifie tes informations et réessaie.</div>
      ) : null}

      <div>
        <button className="csy-button" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Envoi…" : "Demander mon entrée"}
        </button>
      </div>
    </form>
  );
}

function maskEmail(e: string): string {
  if (!e.includes("@")) return "ton adresse";
  const [l, d] = e.split("@");
  return `${l.slice(0, 1)}•••@${d}`;
}

function WaitingScreen({ email, statusToken, onChangeAddress, resend }: {
  email: string; statusToken: string | null;
  onChangeAddress: () => void; resend: (email: string) => Promise<{ ok: boolean; statusToken?: string }>;
}) {
  const [phase, setPhase] = useState<"pending" | "other_device" | "expired" | "neterror">("pending");
  const [cooldown, setCooldown] = useState(0);
  const tokenRef = useRef<string | null>(statusToken);

  // Compte à rebours du bouton « Renvoyer ».
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Polling du statut toutes les 2,5 s ; redirection auto dès que la session locale existe.
  useEffect(() => {
    let alive = true;
    const token = tokenRef.current ?? (() => { try { return sessionStorage.getItem(STATUS_KEY); } catch { return null; } })();
    if (!token) { setPhase("expired"); return; }
    const poll = async () => {
      try {
        const res = await fetch("/api/founding-partners/registration-status", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }), cache: "no-store",
        });
        const j = (await res.json().catch(() => ({}))) as { status?: string };
        if (!alive) return;
        if (j.status === "linked") {
          // La session CloneStore est-elle présente DANS CE navigateur ? (même appareil)
          const { data } = await getSessionClient().auth.getSession();
          if (!alive) return;
          if (data.session) { window.location.replace("/founding-partners/my-registry?welcome=1"); return; }
          setPhase("other_device"); return; // confirmé sur un autre appareil
        }
        if (j.status === "expired" || j.status === "failed") { setPhase("expired"); return; }
        // pending / verified → on continue.
      } catch {
        if (alive) setPhase("neterror");
      }
    };
    void poll();
    const id = setInterval(() => { if (phase === "pending" || phase === "neterror") void poll(); }, 2500);
    return () => { alive = false; clearInterval(id); };
  }, [phase]);

  const onResend = async () => {
    if (cooldown > 0) return;
    setCooldown(30);
    try { const r = await resend(email); if (r.statusToken) { tokenRef.current = r.statusToken; try { sessionStorage.setItem(STATUS_KEY, r.statusToken); } catch { /* ok */ } setPhase("pending"); } } catch { /* le cooldown protège */ }
  };

  if (phase === "other_device") {
    return (
      <div className="csy-notice csy-notice--ok" role="status">
        <strong>Ton inscription a bien été confirmée sur un autre appareil.</strong>
        <p className="csy-copy" style={{ marginTop: 8 }}>
          Tu peux continuer ici en te connectant avec la même adresse, ou retrouver ton registre
          depuis l'appareil qui a ouvert l'email.
        </p>
        <p style={{ marginTop: 12 }}><a className="csy-link" href="/login?redirect=/founding-partners/my-registry">Se connecter</a></p>
      </div>
    );
  }

  return (
    <div className="csy-notice csy-notice--ok" role="status" aria-live="polite">
      <strong>Vérifie ta boîte mail</strong>
      <p className="csy-copy" style={{ marginTop: 8 }}>
        Nous avons envoyé un lien à <strong>{maskEmail(email)}</strong>. Ouvre-le et clique sur
        « Confirmer et accéder à mon espace » : cette page te redirigera automatiquement vers ton registre.
      </p>
      <p className="csy-copy" style={{ marginTop: 8, fontSize: "0.82rem", opacity: 0.75 }}>
        Pense à regarder dans les courriers indésirables. Le lien expire après quelques heures.
        {phase === "neterror" ? " (Connexion instable — nouvelle tentative en cours.)" : ""}
        {phase === "expired" ? " Ce lien semble expiré ; renvoie l'email." : ""}
      </p>
      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="csy-button" onClick={() => void onResend()} disabled={cooldown > 0}>
          {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : "Renvoyer l'email"}
        </button>
        <button type="button" className="csy-link" onClick={onChangeAddress} style={{ background: "none", border: "none", cursor: "pointer" }}>
          Modifier l'adresse
        </button>
      </div>
    </div>
  );
}
