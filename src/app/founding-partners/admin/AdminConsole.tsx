"use client";

// CloneStory — console d'administration (sobre). Toute action exige une RAISON,
// saisie explicitement (aucun dialogue natif). Envoi à /api/founding-partners/admin/action.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Partner = {
  id: string; display_name: string; email: string; status: string;
  personal_code: string | null; link_revoked_at: string | null; joined_at: string;
};
type Conflict = { id: string; prospect_company: string; partner_id: string; status: string };
type Audit = { actor: string; action: string; reason: string; occurred_at: string };

type Pending =
  | { kind: "suspend" | "reinstate" | "revoke_link"; partnerId: string; label: string }
  | { kind: "resolve_dispute"; introductionId: string; decision: "verified" | "canceled"; label: string }
  | null;

export default function AdminConsole({ partners, conflicts, audit, query }: {
  partners: Partner[]; conflicts: Conflict[]; audit: Audit[]; query: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function confirm() {
    if (!pending || !reason.trim()) { setErr("Une raison est obligatoire."); return; }
    setBusy(true); setErr("");
    const body: Record<string, unknown> = { action: pending.kind, reason: reason.trim() };
    if ("partnerId" in pending) body.partnerId = pending.partnerId;
    if (pending.kind === "resolve_dispute") { body.introductionId = pending.introductionId; body.decision = pending.decision; }
    try {
      const res = await fetch("/api/founding-partners/admin/action", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) { setPending(null); setReason(""); router.refresh(); }
      else setErr("Action refusée.");
    } catch { setErr("Erreur réseau."); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "grid", gap: 40 }}>
      <form method="get" style={{ display: "flex", gap: 12 }}>
        <input className="csy-input" name="q" defaultValue={query} placeholder="Rechercher un membre (email, nom, code)" />
        <button className="csy-button csy-button--ghost" type="submit">Rechercher</button>
      </form>

      {pending ? (
        <div className="csy-notice" role="dialog" aria-label="Confirmation">
          <p style={{ marginTop: 0 }}>{pending.label}</p>
          <input className="csy-input" placeholder="Raison (obligatoire)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {err ? <p style={{ color: "#c89b6a", marginBottom: 0 }}>{err}</p> : null}
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button className="csy-button" type="button" onClick={confirm} disabled={busy}>{busy ? "…" : "Confirmer"}</button>
            <button className="csy-button csy-button--ghost" type="button" onClick={() => { setPending(null); setErr(""); }}>Annuler</button>
          </div>
        </div>
      ) : null}

      <div>
        <p className="csy-eyebrow">Membres</p>
        <table className="csy-admin-table" style={{ marginTop: 14 }}>
          <thead><tr><th>Nom</th><th>Email</th><th>Statut</th><th>Code</th><th>Actions</th></tr></thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id}>
                <td>{p.display_name}</td>
                <td>{p.email}</td>
                <td>{p.status}{p.link_revoked_at ? " · lien révoqué" : ""}</td>
                <td>{p.personal_code ?? "—"}</td>
                <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {p.status === "suspended" ? (
                    <button className="csy-copybtn" onClick={() => setPending({ kind: "reinstate", partnerId: p.id, label: `Réintégrer ${p.display_name} ?` })}>Réintégrer</button>
                  ) : (
                    <button className="csy-copybtn" onClick={() => setPending({ kind: "suspend", partnerId: p.id, label: `Suspendre ${p.display_name} ?` })}>Suspendre</button>
                  )}
                  <button className="csy-copybtn" onClick={() => setPending({ kind: "revoke_link", partnerId: p.id, label: `Révoquer le lien de ${p.display_name} ?` })}>Révoquer le lien</button>
                </td>
              </tr>
            ))}
            {partners.length === 0 ? <tr><td colSpan={5}>Aucun membre.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div>
        <p className="csy-eyebrow">Conflits en revue</p>
        <table className="csy-admin-table" style={{ marginTop: 14 }}>
          <thead><tr><th>Entreprise</th><th>Statut</th><th>Décision</th></tr></thead>
          <tbody>
            {conflicts.map((c) => (
              <tr key={c.id}>
                <td>{c.prospect_company}</td>
                <td>{c.status}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button className="csy-copybtn" onClick={() => setPending({ kind: "resolve_dispute", introductionId: c.id, decision: "verified", label: `Valider l'attribution de ${c.prospect_company} ?` })}>Valider</button>
                  <button className="csy-copybtn" onClick={() => setPending({ kind: "resolve_dispute", introductionId: c.id, decision: "canceled", label: `Annuler ${c.prospect_company} ?` })}>Annuler</button>
                </td>
              </tr>
            ))}
            {conflicts.length === 0 ? <tr><td colSpan={3}>Aucun conflit.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div>
        <p className="csy-eyebrow">Journal (immuable)</p>
        <table className="csy-admin-table" style={{ marginTop: 14 }}>
          <thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Raison</th></tr></thead>
          <tbody>
            {audit.map((a, i) => (
              <tr key={i}>
                <td>{new Date(a.occurred_at).toLocaleString("fr-FR")}</td>
                <td>{a.actor}</td>
                <td>{a.action}</td>
                <td>{a.reason}</td>
              </tr>
            ))}
            {audit.length === 0 ? <tr><td colSpan={4}>Journal vide.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
