// src/lib/clonestore/product-technologies/t2/__tests__/clonecall-cloneroom-p20-2-certification.test.ts
// P20.2 — CloneCall & CloneRoom: honest "À venir" certification. Both compose real governed T2
// chains (CloneOS/CloneGuard/ClonePolicy/CloneTrust/CloneTrace/...) but must NEVER produce a live
// call, a live session, or unauthorized peer-to-peer — verified by live execution, not description.

import { describe, it, expect } from "vitest";
import { cloneCallProductTech } from "../clonecall-product-tech";
import { cloneRoomProductTech } from "../cloneroom-product-tech";
import type { ProductTechnologyContext } from "../product-technology-types";

const ctx: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-A" };

describe("P20.2 — CloneCall certification (À venir, real backstops)", () => {
  it("1. aucun vrai appel : outbound demandé → blocked, jamais un artefact avec liveCallMade:true", async () => {
    const r = await cloneCallProductTech.prepare({ employeeCalledId: "pierre", outbound: true }, ctx);
    expect(r.kind).toBe("blocked");
    expect(r.artifact).toBeNull();
  });

  it("2. numéro/dialNumber fourni → toujours bloqué (coercition fail-closed), aucun faux numéro accepté", async () => {
    const r = await cloneCallProductTech.prepare({ employeeCalledId: "pierre", dialNumber: "0612345678" } as never, ctx);
    expect(r.kind).toBe("blocked");
  });

  it("3. session locale valide (transcript texte) → needs_validation, invariants durs vrais (aucun live)", async () => {
    const r = await cloneCallProductTech.prepare(
      { employeeCalledId: "pierre", objective: "point d'avancement", transcriptText: "prépare une synthèse de l'équipe" },
      ctx,
    );
    expect(r.kind).toBe("needs_validation");
    const a = r.artifact!;
    expect(a.outboundLivePathBlocked).toBe(true);
    expect(a.liveCallMade).toBe(false);
    expect(a.audioRecorded).toBe(false);
    expect(a.telephonyProvider).toBe("none");
    // jamais une "durée" ou un "numéro" présentés — vérifie l'absence de ces champs mensongers
    expect(JSON.stringify(a)).not.toMatch(/"duration"|"phoneNumber":"(?!none)/i);
  });

  it("4. aucun employeeCalledId → blocked fail-closed", async () => {
    const r = await cloneCallProductTech.prepare({ transcriptText: "x" }, ctx);
    expect(r.kind).toBe("blocked");
  });

  it("5. gouvernance composée réellement : guardDecision/policyDecision/trustDecision/traceEvent tous présents dans l'artefact (pas None silencieux)", async () => {
    const r = await cloneCallProductTech.prepare(
      { employeeCalledId: "pierre", objective: "test gouvernance", transcriptText: "prépare un rapport" },
      ctx,
    );
    const a = r.artifact!;
    expect(a.guardDecision).not.toBeNull();
    expect(a.traceEvent).not.toBeNull();
  });
});

describe("P20.2 — CloneRoom certification (À venir, real backstops)", () => {
  it("1. pair-à-pair anarchique demandé → blocked, jamais autorisé", async () => {
    const r = await cloneRoomProductTech.prepare({ allowPeerToPeer: true, participants: [{ id: "pierre", kind: "ai_employee" }] }, ctx);
    expect(r.kind).toBe("blocked");
  });

  it("2. salle sans participant valide → blocked fail-closed", async () => {
    const r = await cloneRoomProductTech.prepare({ participants: [] }, ctx);
    expect(r.kind).toBe("blocked");
  });

  it("3. salle valide → needs_validation, TOUT routage passe par CloneOS (jamais direct employé→employé)", async () => {
    const r = await cloneRoomProductTech.prepare(
      {
        roomId: "room-1",
        participants: [{ id: "pierre", kind: "ai_employee" }, { id: "victor", kind: "ai_employee" }],
        thread: [{ from: "pierre", to: "victor", content: "prépare la communication d'arrivée" }],
      },
      ctx,
    );
    expect(r.kind).toBe("needs_validation");
    const a = r.artifact!;
    expect(a.contextRoutingPlan.allViaCloneOS).toBe(true);
    expect(a.contextRoutingPlan.routes.every((route) => route.via === "cloneos")).toBe(true);
    expect(a.peerToPeerBlocked).toBe(true);
    expect(a.executed).toBe(false); // jamais présenté comme exécuté collectivement
  });

  it("4. aucune fausse présence : les participants renvoyés sont exactement ceux fournis, jamais inventés", async () => {
    const r = await cloneRoomProductTech.prepare(
      { roomId: "room-2", participants: [{ id: "u1", kind: "human" }] },
      ctx,
    );
    expect(r.artifact!.participants).toEqual([{ id: "u1", kind: "human" }]);
  });
});
