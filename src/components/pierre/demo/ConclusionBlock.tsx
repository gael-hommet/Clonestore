"use client";

// PIERRE FINAL INTERACTIVE DEMO — beat 08 · CONCLUSION.
// One honest, side-by-side contrast that names the difference the whole demo just
// proved: a chatbot answers and forgets; Pierre carries missions, refuses to
// invent, stays governed, and leaves traced deliverables. Folds in the single
// reassurance line (Pierre never replaces the human decision).

import { MessageSquare, Sparkles, ShieldCheck } from "lucide-react";
import { BeatHeading } from "./parts";

const CONTRASTS = [
  { chatbot: "Répond, puis oublie.", pierre: "Garde la mission active : attend, relance, reprend." },
  { chatbot: "Invente pour combler un trou.", pierre: "Signale ce qui manque. Jamais d'invention." },
  { chatbot: "Agit ou refuse sans cadre.", pierre: "Sait ce qu'il fait seul, soumet, ou refuse." },
  { chatbot: "Produit du texte à copier-coller.", pierre: "Produit des livrables tracés et validés." },
] as const;

export function ConclusionBlock() {
  return (
    <section aria-label="Pourquoi Pierre n'est pas un chatbot">
      <BeatHeading
        n="08"
        eyebrow="La différence"
        title="Ce n'est pas un chatbot. C'est un poste tenu."
        caption="La même demande, deux mondes."
        align="center"
      />

      <div className="pd-conclude">
        <div className="pd-conclude__col pd-conclude__col--bot">
          <div className="pd-conclude__h">
            <MessageSquare className="h-4 w-4" aria-hidden /> Une IA généraliste
          </div>
          <ul>
            {CONTRASTS.map((c) => <li key={c.chatbot}>{c.chatbot}</li>)}
          </ul>
        </div>
        <div className="pd-conclude__col pd-conclude__col--pierre">
          <div className="pd-conclude__h">
            <Sparkles className="h-4 w-4" aria-hidden /> Pierre, employé RH
          </div>
          <ul>
            {CONTRASTS.map((c) => <li key={c.pierre}>{c.pierre}</li>)}
          </ul>
        </div>
      </div>

      <p className="pdc-note" style={{ marginTop: 14, justifyContent: "center", textAlign: "center" }}>
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden style={{ color: "var(--pd-ok)", flex: "none" }} />
        Pierre ne remplace pas la décision humaine : il prépare le travail et vous sollicite quand un arbitrage s&apos;impose.
      </p>
    </section>
  );
}
