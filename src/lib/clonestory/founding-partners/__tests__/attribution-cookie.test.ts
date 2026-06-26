// CS-FINAL 2 — cookie d'attribution (unitaire). Signé/vérifié, opaque, falsification rejetée.
import { describe, it, expect } from "vitest";

process.env.CLONESTORY_LOCAL_MODE = "1";

import {
  buildAttributionCookie,
  readAttributionCookie,
  newVisitorId,
  ATTRIBUTION_COOKIE,
} from "../server/attribution-cookie";

describe("cookie d'attribution", () => {
  it("newVisitorId = 32 hex opaques", () => {
    expect(newVisitorId()).toMatch(/^[a-f0-9]{32}$/);
    expect(newVisitorId()).not.toBe(newVisitorId());
  });

  it("aller-retour signé : le visiteur est récupéré du cookie", () => {
    const vid = newVisitorId();
    const setCookie = buildAttributionCookie(vid);
    expect(setCookie).toContain(`${ATTRIBUTION_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Max-Age=7776000"); // 90 jours
    const header = `${ATTRIBUTION_COOKIE}=` + setCookie.split(`${ATTRIBUTION_COOKIE}=`)[1].split(";")[0];
    expect(readAttributionCookie(header)).toBe(vid);
  });

  it("cookie falsifié / absent / non-hex → null", () => {
    expect(readAttributionCookie(`${ATTRIBUTION_COOKIE}=tampered.value`)).toBeNull();
    expect(readAttributionCookie(null)).toBeNull();
    const vid = newVisitorId();
    const token = buildAttributionCookie(vid).split(`${ATTRIBUTION_COOKIE}=`)[1].split(";")[0];
    expect(readAttributionCookie(`${ATTRIBUTION_COOKIE}=${token.slice(0, -4)}AAAA`)).toBeNull(); // HMAC altéré
  });

  it("ne contient ni e-mail ni nom (opaque)", () => {
    const c = buildAttributionCookie(newVisitorId());
    expect(c.toLowerCase()).not.toContain("@");
  });
});
