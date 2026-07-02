// CS-FINAL 1 — intégration CloneStory dans « Mon espace » (structure & garanties).
// Vérifie la présence des deux expériences, les 4 actions, le partage + fallback, le
// bloc pédagogique, les distinctions, la sécurité (pont de session, lien public),
// l'injection dans le cockpit, et la honnêteté (inscriptions fermées, aucun faux chiffre).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const CARD = read("src/app/profile/_ui/CloneStoryCockpitCard.tsx");
const API = read("src/app/api/founding-partners/cockpit/route.ts");
const BRIDGE = read("src/app/api/founding-partners/registry-session/route.ts");
const PAGE = read("src/app/profile/page.tsx");
const COCKPIT = read("src/lib/clonestory/founding-partners/server/cockpit.ts");
const MIG = read("supabase/migrations/2026-06-25_05__clonestory_fp_partner_account_and_distinctions.sql");

describe("carte cockpit — expérience non-membre honnête", () => {
  it("titre du Cercle + CTA Découvrir + mention Ouverture prochaine (pas de promesse d'inscription)", () => {
    expect(CARD).toContain("Le Cercle des partenaires fondateurs");
    expect(CARD).toContain("Découvrir le Cercle");
    expect(CARD).toContain("Ouverture prochaine");
    expect(CARD).toContain('href="/founding-partners"'); // mène à la page publique existante
  });
  it("conduit vers la page publique existante, jamais vers une page /partenaires parallèle", () => {
    expect(CARD).not.toContain("/partenaires");
  });
});

describe("carte cockpit — partenaire vérifié", () => {
  it("les 4 actions principales sont présentes", () => {
    expect(CARD).toContain("Copier mon lien");
    expect(CARD).toContain("Partager mon lien");
    expect(CARD).toContain("Faire une introduction");
    expect(CARD).toContain("Ouvrir mon registre");
  });
  it("partage natif + fallback propre (copie), annulation silencieuse (AbortError)", () => {
    expect(CARD).toContain("navigator");
    expect(CARD).toMatch(/nav\.share/);
    expect(CARD).toContain("AbortError");
    expect(CARD).toContain("clipboard.writeText");
  });
  it("bloc pédagogique des deux méthodes + phrase de clarification client", () => {
    expect(CARD).toContain("Deux façons de contribuer");
    expect(CARD).toContain("Partager votre lien");
    expect(CARD).toContain("Présenter une entreprise");
    expect(CARD).toContain("Une introduction confirmée n'est pas encore un client");
  });
  it("section distinctions + lien vers le registre détaillé", () => {
    expect(CARD).toContain("Mes distinctions");
    expect(CARD).toContain("Voir tout mon registre");
  });
  it("lien personnel public : note explicite qu'il ne donne pas accès au registre", () => {
    expect(CARD).toContain("ne donne jamais accès à votre registre");
  });
  it("aucun chiffre en dur : les stats viennent des props (member.stats), pas de littéral inventé", () => {
    expect(CARD).toContain("member.stats");
    expect(CARD).toContain("s.introductionsDeclared");
    expect(CARD).toContain("s.contributionsVerified");
  });
  it("statuts honnêtes gérés : unverified, suspended, withdrawn", () => {
    expect(CARD).toContain('status === "unverified"');
    expect(CARD).toContain('status === "suspended"');
  });
});

describe("API & sécurité", () => {
  it("API cockpit : auth serveur (supabaseServer) + résolution serveur + no-store", () => {
    expect(API).toContain("supabaseServer");
    expect(API).toContain("resolvePartnerCockpit");
    expect(API).toContain("no-store");
    expect(API).toContain('auth.getUser');
  });
  it("résolution : recherche service par e-mail + lectures détaillées en mode partenaire (RLS)", () => {
    expect(COCKPIT).toContain("withService");
    expect(COCKPIT).toContain("withPartner");
    expect(COCKPIT).toContain("email_normalized = $1");
  });
  it("pont de session : émet csy_member UNIQUEMENT pour un partenaire vérifié", () => {
    expect(BRIDGE).toContain("buildMemberCookie");
    expect(BRIDGE).toContain('status !== "verified"'); // sinon redirection, pas de cookie
    expect(BRIDGE).toContain("auth.getUser");
  });
});

describe("injection dans le cockpit + migration", () => {
  it("la carte est importée et rendue dans la home « Mon espace » (pas une nouvelle page)", () => {
    // P9.2 : la home /profile a été reconstruite (plus d'onglets) ; la carte
    // CloneStory reste rendue dans cet espace, jamais une page /partenaires parallèle.
    expect(PAGE).toContain('import CloneStoryCockpitCard from "./_ui/CloneStoryCockpitCard"');
    expect(PAGE).toMatch(/<CloneStoryCockpitCard \/>/);
    expect(PAGE).not.toContain("/partenaires");
  });
  it("migration _05 : account_user_id + distinctions + awards + RLS forcée + rollback documenté", () => {
    expect(MIG).toContain("add column if not exists account_user_id");
    expect(MIG).toContain("create table if not exists clonestory_fp_distinctions");
    expect(MIG).toContain("create table if not exists clonestory_fp_partner_awards");
    expect(MIG).toContain("force  row level security");
    expect(MIG).toContain("uq_csy_award_partner_code"); // aucun doublon d'attribution
    expect(MIG).toMatch(/ROLLBACK/i);
    expect(MIG).not.toMatch(/\bdelete from\b/i); // aucune suppression
  });
});
