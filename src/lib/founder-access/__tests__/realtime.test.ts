// §3 — Temps réel : compteur de connexions + état de la source serveur.
import { describe, it, expect, beforeEach } from "vitest";
import { liveConnections, realtimeHealth } from "../realtime";

beforeEach(() => { while (liveConnections.count > 0) liveConnections.dec(); });

describe("realtime — connexions live + santé", () => {
  it("inc/dec reflètent le nombre de flux actifs", () => {
    expect(liveConnections.count).toBe(0);
    liveConnections.inc(); liveConnections.inc();
    expect(liveConnections.count).toBe(2);
    liveConnections.dec();
    expect(liveConnections.count).toBe(1);
  });
  it("ne descend jamais sous zéro", () => {
    liveConnections.dec(); liveConnections.dec();
    expect(liveConnections.count).toBe(0);
  });
  it("aucune connexion → connecté (transport prêt)", () => {
    const h = realtimeHealth();
    expect(h.state).toBe("connected");
    expect(h.detail).toMatch(/disponible/i);
  });
  it("connexion active → connecté (flux actif, compte exposé)", () => {
    liveConnections.inc();
    const h = realtimeHealth();
    expect(h.state).toBe("connected");
    expect(h.detail).toMatch(/actif/i);
    expect(h.detail).toMatch(/1 connexion/);
  });
});
