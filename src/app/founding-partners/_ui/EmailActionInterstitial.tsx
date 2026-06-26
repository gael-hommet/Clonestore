// CloneStory — page intermédiaire d'action par lien email (CS-FINAL 4).
// Le GET affiche cet écran NON destructif ; la mutation n'a lieu que sur clic humain
// (POST same-origin). Immunise contre les scanners/prefetch GET. Sans JS requis.

import Link from "next/link";
import { StoryEyebrow, StoryDisplay } from "@/components/clonestory/primitives";

export type LinkActionState = "ready" | "expired" | "used" | "invalid";

export interface InterstitialProps {
  state: LinkActionState;
  token: string;
  postAction: string;
  eyebrow: string;
  readyTitle: string;
  readyBody: React.ReactNode;
  actionLabel: string;
  secondary?: { label: string; postAction: string } | null;
  usedTitle: string;
  usedBody: string;
  expiredBody: string;
  invalidBody: string;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="csy-canvas">
      <section className="csy-section csy-section--hero">
        <div className="csy-shell csy-shell--narrow">{children}</div>
      </section>
    </main>
  );
}

function BackLink() {
  return (
    <div style={{ marginTop: 28 }}>
      <Link href="/" className="csy-link">Retour à CloneStore <span className="csy-link__arrow" aria-hidden="true">→</span></Link>
    </div>
  );
}

export default function EmailActionInterstitial(p: InterstitialProps) {
  if (p.state === "ready") {
    return (
      <Shell>
        <StoryEyebrow>{p.eyebrow}</StoryEyebrow>
        <div style={{ marginTop: 22 }}><StoryDisplay>{p.readyTitle}</StoryDisplay></div>
        <p className="csy-copy" style={{ marginTop: 22 }}>{p.readyBody}</p>
        <form method="post" action={p.postAction} style={{ marginTop: 28 }}>
          <input type="hidden" name="token" value={p.token} />
          <button type="submit" className="csy-button">{p.actionLabel}</button>
        </form>
        {p.secondary ? (
          <form method="post" action={p.secondary.postAction} style={{ marginTop: 14 }}>
            <input type="hidden" name="token" value={p.token} />
            <button type="submit" className="csy-link" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              {p.secondary.label}
            </button>
          </form>
        ) : null}
        <p className="csy-copy" style={{ marginTop: 22, fontSize: "0.85rem", opacity: 0.7 }}>
          Cette confirmation n'est enregistrée que lorsque vous cliquez vous-même.
        </p>
      </Shell>
    );
  }

  const title = p.state === "used" ? p.usedTitle : "Ce lien n'est plus valide.";
  const body = p.state === "used" ? p.usedBody : p.state === "expired" ? p.expiredBody : p.invalidBody;
  return (
    <Shell>
      <StoryEyebrow>{p.eyebrow}</StoryEyebrow>
      <div style={{ marginTop: 22 }}><StoryDisplay>{title}</StoryDisplay></div>
      <p className="csy-copy" style={{ marginTop: 22 }}>{body}</p>
      <BackLink />
    </Shell>
  );
}
