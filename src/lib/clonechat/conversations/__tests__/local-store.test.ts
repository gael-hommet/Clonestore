// src/lib/clonechat/conversations/__tests__/local-store.test.ts
// C1.8 FINAL PART 2 §5B/§9 — Historique anonyme : local, borné, honnête, isolé.

import { describe, it, expect, beforeEach } from "vitest";
import {
  loadLocalConversations, createLocalConversation, appendLocalMessage,
  deleteLocalConversation, getLocalConversation, clearLocalHistory,
  deriveTitle, LOCAL_LIMITS, LOCAL_KEY, LOCAL_HISTORY_DISCLAIMER,
  type LocalStorageLike,
} from "../local-store";

function mem(): LocalStorageLike & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}
const userMsg = (text: string) => ({ role: "user" as const, content: [{ type: "text", text }], at: "2026-07-14T10:00:00Z" });
const botMsg = (text: string) => ({ role: "assistant" as const, content: [{ type: "text", text }], at: "2026-07-14T10:00:01Z" });

let s: ReturnType<typeof mem>;
beforeEach(() => { s = mem(); });

describe("C1.8 P2 — l'historique anonyme existe vraiment", () => {
  it("créer, écrire, relire : le fil survit dans le même navigateur", () => {
    createLocalConversation(s, "c1");
    appendLocalMessage(s, "c1", userMsg("Tu sers à quoi ?"));
    appendLocalMessage(s, "c1", botMsg("Je suis CloneChat."));

    const list = loadLocalConversations(s);
    expect(list).toHaveLength(1);
    expect(list[0].messages).toHaveLength(2);
    expect(getLocalConversation(s, "c1")!.messages[1].role).toBe("assistant");
  });

  it("le titre vient du PREMIER message réel — jamais inventé", () => {
    appendLocalMessage(s, "c1", userMsg("Comment activer Pierre ?"));
    expect(getLocalConversation(s, "c1")!.title).toBe("Comment activer Pierre ?");
    // Il ne change plus ensuite.
    appendLocalMessage(s, "c1", userMsg("Et le prix ?"));
    expect(getLocalConversation(s, "c1")!.title).toBe("Comment activer Pierre ?");
  });

  it("un titre trop long est tronqué proprement, un titre vide reste neutre", () => {
    expect(deriveTitle("x".repeat(200))).toHaveLength(48);
    expect(deriveTitle("   ")).toBe("Nouvelle conversation");
  });

  it("la plus récemment active remonte en tête", () => {
    appendLocalMessage(s, "a", userMsg("premier"), new Date("2026-07-14T09:00:00Z"));
    appendLocalMessage(s, "b", userMsg("second"), new Date("2026-07-14T11:00:00Z"));
    expect(loadLocalConversations(s).map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("deux conversations ne mélangent JAMAIS leurs messages", () => {
    appendLocalMessage(s, "a", userMsg("sujet A"));
    appendLocalMessage(s, "b", userMsg("sujet B"));
    expect(getLocalConversation(s, "a")!.messages).toHaveLength(1);
    expect(JSON.stringify(getLocalConversation(s, "a"))).not.toContain("sujet B");
  });
});

describe("C1.8 P2 — les bornes sont RÉELLES (un stockage local n'est pas un dépotoir)", () => {
  it(`au plus ${LOCAL_LIMITS.maxConversations} conversations — les plus anciennes tombent`, () => {
    for (let i = 0; i < LOCAL_LIMITS.maxConversations + 8; i++) {
      appendLocalMessage(s, `c${i}`, userMsg(`sujet ${i}`), new Date(Date.parse("2026-07-14T00:00:00Z") + i * 60000));
    }
    const list = loadLocalConversations(s);
    expect(list).toHaveLength(LOCAL_LIMITS.maxConversations);
    expect(list[0].id).toBe(`c${LOCAL_LIMITS.maxConversations + 7}`); // la plus récente survit
  });

  it(`au plus ${LOCAL_LIMITS.maxMessagesPerConversation} messages — on garde les plus RÉCENTS`, () => {
    for (let i = 0; i < LOCAL_LIMITS.maxMessagesPerConversation + 15; i++) {
      appendLocalMessage(s, "c1", userMsg(`msg ${i}`));
    }
    const msgs = getLocalConversation(s, "c1")!.messages;
    expect(msgs).toHaveLength(LOCAL_LIMITS.maxMessagesPerConversation);
    expect(JSON.stringify(msgs[msgs.length - 1])).toContain(`msg ${LOCAL_LIMITS.maxMessagesPerConversation + 14}`);
  });

  it("une conversation expirée (> TTL) n'appartient plus à personne", () => {
    const old = new Date("2026-01-01T00:00:00Z");
    appendLocalMessage(s, "vieux", userMsg("ancien"), old);
    appendLocalMessage(s, "recent", userMsg("récent"), new Date("2026-07-14T10:00:00Z"));
    const list = loadLocalConversations(s, new Date("2026-07-14T10:00:00Z"));
    expect(list.map((c) => c.id)).toEqual(["recent"]);
  });

  it("un stockage corrompu ne fait JAMAIS planter le chat", () => {
    s.setItem(LOCAL_KEY, "{ ceci n'est pas du JSON");
    expect(loadLocalConversations(s)).toEqual([]);
  });

  it("un quota dépassé ne perd pas TOUT l'historique", () => {
    let calls = 0;
    const strict: LocalStorageLike = {
      getItem: s.getItem, removeItem: s.removeItem,
      setItem: (k, v) => { calls += 1; if (calls === 1) throw new Error("QuotaExceededError"); s.setItem(k, v); },
    };
    appendLocalMessage(s, "a", userMsg("A"));
    appendLocalMessage(s, "b", userMsg("B"));
    const kept = appendLocalMessage(strict, "c", userMsg("C"));
    expect(kept.length).toBeGreaterThan(0); // on garde une moitié plutôt que rien
  });
});

describe("C1.8 P2 — suppression, et aucune promesse mensongère", () => {
  it("la suppression est IDEMPOTENTE et ne ressuscite rien", () => {
    appendLocalMessage(s, "a", userMsg("A"));
    appendLocalMessage(s, "b", userMsg("B"));
    expect(deleteLocalConversation(s, "a").map((c) => c.id)).toEqual(["b"]);
    expect(deleteLocalConversation(s, "a").map((c) => c.id)).toEqual(["b"]); // 2e fois : rien ne casse
    expect(getLocalConversation(s, "a")).toBeNull();
  });

  it("l'effacement complet ne laisse aucune trace", () => {
    appendLocalMessage(s, "a", userMsg("A"));
    clearLocalHistory(s);
    expect(loadLocalConversations(s)).toEqual([]);
    expect(s.dump()[LOCAL_KEY]).toBeUndefined();
  });

  it("l'interface DOIT dire que cet historique ne suit pas l'utilisateur ailleurs", () => {
    expect(LOCAL_HISTORY_DISCLAIMER).toMatch(/ce navigateur uniquement/i);
    expect(LOCAL_HISTORY_DISCLAIMER).toMatch(/autre appareil/i);
  });
});

describe("C1.8 P2 §9 — isolation : l'anonyme n'invente aucune identité", () => {
  it("aucun identifiant utilisateur, aucune entreprise, nulle part", () => {
    appendLocalMessage(s, "a", userMsg("bonjour"));
    const blob = JSON.stringify(loadLocalConversations(s));
    for (const forbidden of ["userId", "user_id", "companyId", "company_id", "tenant", "token"]) {
      expect(blob).not.toContain(forbidden);
    }
  });

  it("la clé locale est DISTINCTE de tout stockage authentifié (aucune fusion possible)", () => {
    expect(LOCAL_KEY).toContain("local-history");
    // Le fil authentifié utilise une autre clé : les deux ne peuvent pas se marcher dessus.
    expect(LOCAL_KEY).not.toBe("clonestore.clonechat.thread.v1");
  });
});
