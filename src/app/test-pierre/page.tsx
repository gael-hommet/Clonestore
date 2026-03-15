"use client";

import { useMemo, useState } from "react";

type Tone = "pro" | "convivial";

const EXAMPLES: { label: string; input: string; tone: Tone }[] = [
  {
    label: "Refus candidat (junior)",
    tone: "convivial",
    input:
      "Mail de refus pour un candidat junior. Ton humain. Poste: assistant commercial. Raison: nous avons retenu un profil plus expérimenté.",
  },
  {
    label: "Convocation entretien",
    tone: "pro",
    input:
      "Mail de convocation entretien. Poste: technicien maintenance. Date: mardi. Heure: 10h. Lieu: Nanterre (sur site). Durée: 45 min. Interlocuteurs: Responsable maintenance + RH.",
  },
  {
    label: "Relance candidat",
    tone: "pro",
    input:
      "Relance candidat qui n'a pas répondu. Poste: développeur front. Créneaux: mardi 10h, jeudi 15h.",
  },
  {
    label: "Onboarding avant arrivée",
    tone: "convivial",
    input:
      "Mail onboarding avant arrivée. Poste: comptable. Date arrivée: 3 mars. Heure: 9h. Lieu: Boulogne. Contact: Sarah (RH). Documents: pièce d’identité, RIB, carte vitale.",
  },
  {
    label: "Mail insolite (report entretien)",
    tone: "pro",
    input:
      "Mail pour décaler l’entretien au dernier moment, s’excuser, proposer 2 nouveaux créneaux. Poste: chef de projet. Ton pro et rassurant.",
  },
];

export default function TestPierrePage() {
  const [tone, setTone] = useState<Tone>("convivial");
  const [companyName, setCompanyName] = useState("CloneStore");
  const [text, setText] = useState(EXAMPLES[0].input);

  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<any>(null);
  const [raw, setRaw] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const payload = useMemo(
    () => ({
      input: text,
      tone,
      company_name: companyName,
    }),
    [text, tone, companyName]
  );

  async function run() {
    setLoading(true);
    setErr(null);
    setOut(null);
    setRaw("");

    try {
      const res = await fetch("/api/pierre/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const txt = await res.text();
      setRaw(txt);

      // essaie de parser JSON seulement si possible
      let data: any = null;
      try {
        data = txt ? JSON.parse(txt) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg = data?.error || data?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      if (!data) {
        throw new Error("Réponse non-JSON reçue (voir RAW).");
      }

      setOut(data);
    } catch (e: any) {
      setErr(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }

  function applyExample(i: number) {
    const ex = EXAMPLES[i];
    setText(ex.input);
    setTone(ex.tone);
  }

  return (
    <div style={{ padding: 28, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>
        Test Pierre — Generate (emails + insolites)
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <div>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
            Entreprise (signature)
          </label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
            Ton
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
            }}
          >
            <option value="pro">pro</option>
            <option value="convivial">convivial</option>
          </select>
        </div>
      </div>

      <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
        Brief
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        style={{
          width: "100%",
          padding: "12px 12px",
          borderRadius: 12,
          border: "1px solid #ddd",
          fontFamily: "inherit",
        }}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        {EXAMPLES.map((ex, idx) => (
          <button
            key={ex.label}
            onClick={() => applyExample(idx)}
            style={{
              padding: "8px 10px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
            }}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={run}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: loading ? "#f3f3f3" : "white",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {loading ? "Génération..." : "Générer"}
        </button>

        {err && <span style={{ color: "crimson", fontWeight: 700 }}>{err}</span>}
      </div>

      <div style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>RAW réponse (debug)</h2>
        <pre
          style={{
            background: "#111",
            color: "#fff",
            padding: 12,
            borderRadius: 12,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {raw || "(vide)"}
        </pre>
      </div>

      {out && (
        <>
          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>JSON reçu</h2>
            <pre
              style={{
                background: "#111",
                color: "#fff",
                padding: 12,
                borderRadius: 12,
                overflowX: "auto",
              }}
            >
              {JSON.stringify(out, null, 2)}
            </pre>
          </div>

          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Aperçu HTML</h2>
            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 16,
                background: "white",
                lineHeight: 1.5,
              }}
              dangerouslySetInnerHTML={{ __html: out.final_text_html || "" }}
            />
          </div>
        </>
      )}
    </div>
  );
}