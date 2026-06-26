// CloneStory — tests unitaires de la session membre + cookie d'attribution.

import { describe, it, expect } from "vitest";

// Mode local explicite : autorise un secret de développement hors production.
process.env.CLONESTORY_LOCAL_MODE = "1";

import {
  MEMBER_COOKIE,
  REF_COOKIE,
  buildMemberCookie,
  buildRefCookie,
  clearMemberCookie,
  readMemberSession,
  readRefCookie,
} from "../session";

const UUID = "3f1a9c2e-1b4d-4c8a-9e2f-7a6b5c4d3e2f";

function cookieHeaderFrom(setCookie: string): string {
  return setCookie.split(";")[0]; // "name=value"
}

describe("session membre", () => {
  it("signe et relit l'id de partenaire", () => {
    const header = cookieHeaderFrom(buildMemberCookie(UUID));
    expect(header.startsWith(`${MEMBER_COOKIE}=`)).toBe(true);
    expect(readMemberSession(header)).toBe(UUID);
  });

  it("rejette un cookie falsifié ou absent", () => {
    expect(readMemberSession(`${MEMBER_COOKIE}=falsifie.invalide`)).toBeNull();
    expect(readMemberSession(null)).toBeNull();
    expect(readMemberSession("autre=chose")).toBeNull();
  });

  it("ne stocke pas l'id en clair dans le cookie", () => {
    const header = cookieHeaderFrom(buildMemberCookie(UUID));
    expect(header.includes(UUID)).toBe(false); // valeur signée, pas l'UUID brut
  });

  it("efface la session", () => {
    expect(clearMemberCookie()).toContain(`${MEMBER_COOKIE}=;`);
    expect(clearMemberCookie()).toContain("Max-Age=0");
  });
});

describe("cookie d'attribution de branche", () => {
  it("signe et relit l'introducteur", () => {
    const header = cookieHeaderFrom(buildRefCookie(UUID));
    expect(header.startsWith(`${REF_COOKIE}=`)).toBe(true);
    expect(readRefCookie(header)).toBe(UUID);
    expect(header.includes(UUID)).toBe(false);
  });
});
