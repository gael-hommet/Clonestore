// CS-FINAL 4 (clôture) — alias court du lien partenaire /r/<code> → page canonique.
import { describe, it, expect } from "vitest";
import { GET } from "@/app/r/[token]/route";

describe("alias court du lien partenaire /r/<code>", () => {
  it("redirige (307) vers /founding-partners/r/<code> (cible canonique unique)", async () => {
    const res = await GET(new Request("https://clonestore.pro/r/ABCD-2K9M"), { params: Promise.resolve({ token: "ABCD-2K9M" }) });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://clonestore.pro/founding-partners/r/ABCD-2K9M");
  });

  it("encode le token (aucune injection d'URL via le segment)", async () => {
    const res = await GET(new Request("https://clonestore.pro/r/a%2Fb"), { params: Promise.resolve({ token: "a/b" }) });
    expect(res.headers.get("location")).toBe("https://clonestore.pro/founding-partners/r/a%2Fb");
    expect(res.status).toBe(307);
  });

  it("conserve l'origine de la requête (prod ou autre)", async () => {
    const res = await GET(new Request("https://example.test/r/X"), { params: Promise.resolve({ token: "X" }) });
    expect(res.headers.get("location")).toBe("https://example.test/founding-partners/r/X");
  });
});
