// ONBOARDING SEAMLESS — structure & sécurité (un email, GET non destructif, no-steal).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const VERIFY_POST = read("src/app/api/founding-partners/verify/route.ts");
const BRIDGE = read("src/lib/clonestory/founding-partners/server/auth-onboarding-supabase.ts");
const CORE = read("src/lib/clonestory/founding-partners/server/auth-onboarding.ts");
const REGISTER = read("src/app/api/founding-partners/register/route.ts");
const STATUS = read("src/app/api/founding-partners/registration-status/route.ts");
const JOINFORM = read("src/app/founding-partners/join/JoinForm.tsx");
const VERIFY_PAGE = read("src/app/founding-partners/verify/page.tsx");

describe("un seul email : pas de second email d'auth", () => {
  it("le pont auth utilise generateLink (génère SANS envoyer) + verifyOtp ; jamais signInWithOtp", () => {
    expect(BRIDGE).toContain("generateLink");
    expect(BRIDGE).toContain("verifyOtp");
    expect(BRIDGE).not.toContain("signInWithOtp"); // signInWithOtp ENVERRAIT un email
    expect(BRIDGE).not.toContain("resetPasswordForEmail");
  });
  it("le register n'envoie qu'UN email (vérification CloneStory) et renvoie un statusToken", () => {
    expect(REGISTER).toContain("statusToken");
    expect(REGISTER).toContain("buildStatusToken");
  });
});

describe("anti-scanner conservé : GET non destructif, POST same-origin", () => {
  it("verify route = POST only, same-origin, jamais GET destructif", () => {
    expect(VERIFY_POST).toMatch(/export async function POST/);
    expect(VERIFY_POST).not.toMatch(/export async function GET/);
    expect(VERIFY_POST).toContain("sameOrigin");
    expect(VERIFY_POST).toContain("runSeamlessConfirm");
  });
  it("page intermédiaire = interstitiel (CTA accéder à mon espace), aucune mutation au rendu", () => {
    expect(VERIFY_PAGE).toContain("Confirmer et accéder à mon espace");
    expect(VERIFY_PAGE).toContain("peekVerification"); // GET = peek non destructif
  });
});

describe("liaison sûre + dégradation gracieuse", () => {
  it("la confirmation pose TOUJOURS le cookie membre (registre accessible même si auth échoue)", () => {
    expect(VERIFY_POST).toContain("buildMemberCookie");
    expect(VERIFY_POST).toMatch(/welcome=/);
  });
  it("no-steal : conflit (autre adresse) ne lie jamais ; account_taken refusé", () => {
    expect(CORE).toContain("conflict");
    expect(CORE).toContain("account_taken");
    expect(CORE).toMatch(/decideAuthAction/);
  });
});

describe("page d'attente : polling sans PII, redirection auto, un seul email", () => {
  it("poll la route de statut, redirige vers le registre, propose renvoyer/modifier", () => {
    expect(JOINFORM).toContain("registration-status");
    expect(JOINFORM).toContain("my-registry?welcome=1");
    expect(JOINFORM).toContain("Renvoyer");
    expect(JOINFORM).toContain("Modifier l'adresse");
    expect(JOINFORM).toContain("getSession"); // détecte la session locale (même appareil)
    expect(JOINFORM).toContain("un compte CloneStore sera créé ou connecté"); // transparence
  });
  it("la route de statut ne renvoie qu'un état + email masqué (aucune PII complète)", () => {
    expect(STATUS).toContain("emailMasked");
    expect(STATUS).toContain("readStatusToken");
    expect(STATUS).not.toMatch(/prospect_email|\.email\b(?!Masked)/);
  });
});
