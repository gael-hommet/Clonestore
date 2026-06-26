// CloneStory — « Mon Registre » : espace privé du membre (institutionnel, sobre).
// Pas un dashboard SaaS : un registre personnel. Aucun score fictif, aucun anneau.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { StoryEyebrow, StoryHeading, StoryRule } from "@/components/clonestory/primitives";
import { Credential, IntroduceCta, RevokeRenew } from "./RegistryActions";
import { readMemberSession } from "@/lib/clonestory/founding-partners/server/session";
import { getMyRegistry } from "@/lib/clonestory/founding-partners/server/store";
import { formatSinceLine, TITLE_FR, buildIdentity } from "@/lib/clonestory/founding-partners/vocabulary";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mon Registre — CloneStory", robots: { index: false, follow: false } };

const EVENT_LABEL: Record<string, string> = {
  introduction_declared: "Introduction déclarée",
  introduction_confirmed: "Introduction confirmée",
  prospect_registered: "Prospect inscrit",
  company_created: "Compte entreprise créé",
  purchase_captured: "Achat encaissé",
  activation_completed: "Activation terminée",
  contribution_verified: "Contribution vérifiée",
  contribution_canceled: "Introduction annulée",
  contribution_disputed: "Mise en revue",
  manual_validation: "Validation administrative",
};

const INTRO_LABEL: Record<string, { text: string; cls: string }> = {
  declared: { text: "En attente de confirmation", cls: "csy-tag--declared" },
  prospect_confirmed: { text: "Confirmée", cls: "csy-tag--confirmed" },
  prospect_registered: { text: "Prospect inscrit", cls: "csy-tag--confirmed" },
  company_created: { text: "Entreprise créée", cls: "csy-tag--confirmed" },
  purchase_captured: { text: "Achat encaissé", cls: "csy-tag--confirmed" },
  activation_completed: { text: "Activation terminée", cls: "csy-tag--confirmed" },
  validation_pending: { text: "En attente de validation", cls: "csy-tag--confirmed" },
  verified: { text: "Contribution vérifiée", cls: "csy-tag--confirmed" },
  canceled: { text: "Annulée", cls: "csy-tag--declared" },
  disputed: { text: "En revue", cls: "csy-tag--disputed" },
  expired: { text: "Expirée", cls: "csy-tag--declared" },
};

function frDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function LedgerRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="csy-ledger__row">
      <span className="csy-ledger__label">{label}</span>
      <span className="csy-ledger__dots" aria-hidden="true" />
      <span className={`csy-ledger__value${value === 0 ? " csy-ledger__value--muted" : ""}`}>{value}</span>
    </div>
  );
}

export default async function MyRegistryPage() {
  const h = await headers();
  const partnerId = readMemberSession(h.get("cookie"));
  if (!partnerId) redirect("/founding-partners/join?acces=requis");

  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "clonestore.pro";
  const origin = `${proto}://${host}`;

  const view = await getMyRegistry(partnerId!, origin);
  if (!view) redirect("/founding-partners/join?acces=requis");

  const p = view.partner;
  const isFounding = p.status === "founding_partner" && p.registry_number;
  const seal = isFounding ? buildIdentity(p.registry_number!, new Date(p.joined_at)) : null;

  return (
    <main className="csy-canvas">
      <section className="csy-section" style={{ paddingTop: "clamp(56px,9vh,120px)" }}>
        <div className="csy-shell">
          <StoryEyebrow>Mon Registre · {TITLE_FR.replace("de CloneStore", "").trim()}</StoryEyebrow>
          <div style={{ marginTop: 22 }}>
            <h1 className="csy-display" style={{ fontSize: "clamp(2.2rem,5vw,4rem)" }}>
              <span className="csy-name">{p.display_name}</span>
            </h1>
          </div>
          <div className="csy-registre-head" style={{ marginTop: 16 }}>
            {seal ? (
              <p className="csy-copy" style={{ color: "var(--csy-metal)" }}>{seal.badge} · {seal.titleFr} · {seal.since}</p>
            ) : (
              <p className="csy-copy">
                Membre du Cercle Fondateur · {formatSinceLine(new Date(p.joined_at))}
                {p.status === "suspended" ? " · compte suspendu" : ""}
              </p>
            )}
            {view.introducerName ? (
              <p className="csy-copy" style={{ color: "var(--csy-stone-3)" }}>
                Origine de branche : <span className="csy-name">{view.introducerName}</span>
              </p>
            ) : null}
          </div>

        </div>
      </section>

      {/* Le registre lui-même : entrées chiffrées, dérivées des événements (jamais saisies). */}
      <section className="csy-section" style={{ paddingTop: "clamp(36px,5vh,64px)", paddingBottom: 0 }}>
        <div className="csy-shell csy-shell--narrow">
          <StoryEyebrow>État du registre</StoryEyebrow>
          <div className="csy-ledger" style={{ marginTop: 22 }}>
            <LedgerRow label="Introductions en cours" value={view.stats.inProgress} />
            <LedgerRow label="Introductions confirmées" value={view.stats.confirmed} />
            <LedgerRow label="En attente de validation" value={view.stats.pendingValidation} />
            <LedgerRow label="Contributions vérifiées" value={view.stats.verifiedDirect} />
            {view.stats.networkConfirmed > 0 ? (
              <LedgerRow label="Impact de votre branche" value={view.stats.networkConfirmed} />
            ) : null}
          </div>
        </div>
      </section>

      <div className="csy-shell"><StoryRule metal /></div>

      {/* CTA principal unique. */}
      <section className="csy-section" style={{ paddingBlock: "clamp(40px,6vh,80px)" }}>
        <div className="csy-shell csy-shell--narrow">
          <StoryHeading>Faire une introduction</StoryHeading>
          <p className="csy-copy" style={{ margin: "16px 0 26px" }}>
            Présentez une entreprise à CloneStore. Le contact recevra une demande de confirmation. Tant qu'il n'a
            pas confirmé, aucune contribution n'est créditée et aucune vente n'est revendiquée.
          </p>
          <IntroduceCta />
        </div>
      </section>

      {/* Lien et code personnels. */}
      <section className="csy-section" style={{ paddingTop: 0 }}>
        <div className="csy-shell csy-shell--narrow">
          <StoryEyebrow>Votre lien et votre code</StoryEyebrow>
          <div style={{ display: "grid", gap: 4, marginTop: 20 }}>
            {view.publicLink ? <Credential k="Lien personnel" value={view.publicLink} copyLabel="Copier" /> : null}
            {view.personalCode ? <Credential k="Code personnel" value={view.personalCode} copyLabel="Copier" /> : null}
            <p className="csy-copy" style={{ fontSize: "0.86rem", color: "var(--csy-stone-3)", marginTop: 14 }}>
              Partagez votre lien ou votre code : toute personne arrivant par votre intermédiaire vous sera rattachée
              comme origine de branche. Ce lien ne donne aucun accès à votre registre. <RevokeRenew />
            </p>
          </div>
        </div>
      </section>

      {/* Introductions. */}
      <section className="csy-section" style={{ paddingTop: 0 }}>
        <div className="csy-shell">
          <StoryEyebrow>Vos introductions</StoryEyebrow>
          <div style={{ marginTop: 18 }}>
            {view.introductions.length === 0 ? (
              <p className="csy-copy">Aucune introduction pour l'instant. Votre première introduction prend moins de deux minutes.</p>
            ) : (
              view.introductions.map((i) => {
                const tag = INTRO_LABEL[i.status] ?? { text: i.status, cls: "csy-tag--declared" };
                return (
                  <div className="csy-introrow" key={i.id}>
                    <span className="csy-introrow__co">{i.prospect_company}</span>
                    <span className={`csy-tag ${tag.cls}`}>{tag.text}</span>
                    <span className="csy-archive__when" style={{ marginLeft: "auto" }}>{frDate(i.declared_at)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Historique chronologique (ligne d'archive). */}
      {view.recentEvents.length > 0 ? (
        <section className="csy-section" style={{ paddingTop: 0 }}>
          <div className="csy-shell">
            <StoryEyebrow>Historique</StoryEyebrow>
            <div className="csy-archive" style={{ marginTop: 18 }}>
              {view.recentEvents.map((e, idx) => (
                <div className="csy-archive__row" key={idx}>
                  <span className="csy-archive__when">{frDate(e.occurred_at)}</span>
                  <span className="csy-archive__what">{EVENT_LABEL[e.type] ?? e.type}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
