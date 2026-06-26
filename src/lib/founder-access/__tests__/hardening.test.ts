// Phase E — tests unitaires du hardening E.2 (cookies signés, anti-injection CSV).
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET = "test-reservation-secret-0123456789";
  process.env.CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET = "test-owner-gate-secret-0123456789";
});

describe("signed-cookie (§3.3/§4.4)", () => {
  it("signe et vérifie une valeur (roundtrip)", async () => {
    const { signCookie, verifyCookie } = await import("../signed-cookie");
    const token = signCookie("abc-123", "secret", 60_000);
    expect(verifyCookie(token, "secret")).toBe("abc-123");
  });

  it("rejette un jeton falsifié", async () => {
    const { signCookie, verifyCookie } = await import("../signed-cookie");
    const token = signCookie("abc", "secret", 60_000);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyCookie(tampered, "secret")).toBeNull();
  });

  it("rejette un mauvais secret", async () => {
    const { signCookie, verifyCookie } = await import("../signed-cookie");
    const token = signCookie("abc", "secret-A", 60_000);
    expect(verifyCookie(token, "secret-B")).toBeNull();
  });

  it("rejette un jeton expiré", async () => {
    const { signCookie, verifyCookie } = await import("../signed-cookie");
    const token = signCookie("abc", "secret", -1);
    expect(verifyCookie(token, "secret")).toBeNull();
  });

  it("la preuve de réservation est liée à un id précis", async () => {
    const { buildReservationCookie, reservationCookieAuthorizes, RESERVATION_COOKIE } = await import("../signed-cookie");
    const setCookie = buildReservationCookie("res-1")!;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    const value = setCookie.split(";")[0].slice(RESERVATION_COOKIE.length + 1);
    const header = `${RESERVATION_COOKIE}=${value}`;
    expect(reservationCookieAuthorizes(header, "res-1")).toBe(true);
    expect(reservationCookieAuthorizes(header, "res-2")).toBe(false); // autre réservation refusée
    expect(reservationCookieAuthorizes(null, "res-1")).toBe(false);
  });

  it("la porte propriétaire se déverrouille puis se verrouille", async () => {
    const { buildOwnerGateCookie, ownerGateUnlocked, clearOwnerGateCookie, OWNER_GATE_COOKIE } = await import("../signed-cookie");
    const setCookie = buildOwnerGateCookie()!;
    expect(setCookie).toContain("SameSite=Strict");
    const value = setCookie.split(";")[0].slice(OWNER_GATE_COOKIE.length + 1);
    expect(ownerGateUnlocked(`${OWNER_GATE_COOKIE}=${value}`)).toBe(true);
    expect(clearOwnerGateCookie()).toContain("Max-Age=0");
  });
});

describe("owner-gate — mot de passe (§4.2)", () => {
  it("hache puis vérifie un mot de passe (scrypt + sel)", async () => {
    const { hashOwnerPassword, verifyOwnerPasswordAgainst } = await import("../owner-gate");
    const hash = hashOwnerPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(verifyOwnerPasswordAgainst("correct horse battery staple", hash)).toBe(true);
    expect(verifyOwnerPasswordAgainst("mauvais", hash)).toBe(false);
  });
  it("deux hachages du même mot de passe diffèrent (sel aléatoire)", async () => {
    const { hashOwnerPassword } = await import("../owner-gate");
    expect(hashOwnerPassword("abcabcabcabc")).not.toBe(hashOwnerPassword("abcabcabcabc"));
  });
  it("échoue fermé quand aucune empreinte n'est configurée", async () => {
    const { verifyOwnerPasswordAgainst } = await import("../owner-gate");
    expect(verifyOwnerPasswordAgainst("x", null)).toBe(false);
    expect(verifyOwnerPasswordAgainst("x", "garbage")).toBe(false);
  });
});

describe("cockpit — porte d'accès (E-R1 §1/§2, FAIL-CLOSED)", () => {
  it("porte NON configurée → 'misconfigured' (jamais d'accès, ni page ni API)", async () => {
    const saved = { h: process.env.CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH, s: process.env.CLONESTORE_OWNER_COCKPIT_SLUG };
    delete process.env.CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH;
    delete process.env.CLONESTORE_OWNER_COCKPIT_SLUG;
    const { resolveOwnerGateState } = await import("../admin-guard");
    expect(resolveOwnerGateState(null)).toBe("misconfigured");
    process.env.CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH = saved.h;
    process.env.CLONESTORE_OWNER_COCKPIT_SLUG = saved.s;
  });

  it("porte configurée → 'locked' sans cookie, 'unlocked' avec cookie valide", async () => {
    process.env.CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH = "scrypt$16384$8$1$aa$bb";
    process.env.CLONESTORE_OWNER_COCKPIT_SLUG = "secret-slug";
    const { resolveOwnerGateState } = await import("../admin-guard");
    const { buildOwnerGateCookie, OWNER_GATE_COOKIE } = await import("../signed-cookie");
    expect(resolveOwnerGateState(null)).toBe("locked");
    expect(resolveOwnerGateState("cs_owner_gate=falsifié")).toBe("locked");
    const setCookie = buildOwnerGateCookie()!;
    const value = setCookie.split(";")[0].slice(OWNER_GATE_COOKIE.length + 1);
    expect(resolveOwnerGateState(`${OWNER_GATE_COOKIE}=${value}`)).toBe("unlocked");
  });
});

describe("csvCell — neutralisation des formules (§3.1)", () => {
  it("préfixe les cellules commençant par =,+,-,@", async () => {
    const { csvCell } = await import("../store");
    expect(csvCell("=SUM(A1)")).toMatch(/^'?["]?=/); // commence par apostrophe ou guillemet
    expect(csvCell("=1+1").startsWith("'")).toBe(true);
    expect(csvCell("+33")).toBe("'+33");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });
  it("échappe les guillemets et entoure les séparateurs", async () => {
    const { csvCell } = await import("../store");
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell("simple")).toBe("simple");
  });
});
