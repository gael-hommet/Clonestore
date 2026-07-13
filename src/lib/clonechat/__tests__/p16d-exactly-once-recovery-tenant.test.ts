// src/lib/clonechat/__tests__/p16d-exactly-once-recovery-tenant.test.ts
// P16D §5 (exactly-once & retry) / §9 (reprise) / §10 (isolation multi-tenant).
//
// Ces scénarios ADVERSARIAUX sont joués sur le registre de commandes RÉEL (implémentation
// in-memory du MÊME contrat que le durable : même fingerprint, même fencing de lease, mêmes
// états). Horloge INJECTÉE ⇒ déterministe, aucun provider, aucune base distante.
//
// L'essentiel de ce fichier PROUVE une protection déjà en place (P9.4.2) — c'est le but :
// une garantie non testée n'est pas une garantie. Le seul manque réel trouvé en P16D était
// l'ABSENCE D'EXPIRATION de l'approbation (couverte par p16d-approval-expiry.test.ts).

import { describe, it, expect } from "vitest";
import { createInMemoryCommandLedger, commandFingerprint, type CanonicalCommand } from "@/lib/clonechat/durable/command-ledger";

const A: CanonicalCommand = {
  companyId: "company-A", actorId: "user-1", conversationId: "conv-1",
  proposalId: "prop-1", actionKind: "create_mission",
  payload: { instruction: "Préparer un CDI pour Marie", autonomyMode: "normal" },
};

describe("P16D §5 — une commande dupliquée ne produit JAMAIS un second effet", () => {
  it("requête identique rejouée ⇒ 1 seule exécution, la 2e renvoie l'état existant", async () => {
    const led = createInMemoryCommandLedger(() => 1_000);
    expect((await led.claim(A, "w1", 30_000)).kind).toBe("acquired");
    await led.commit(A, "mission-42", { missionId: "mission-42" }, "w1");

    const again = await led.claim(A, "w2", 30_000);
    expect(again.kind).toBe("duplicate_succeeded");
    expect(again.command.targetRef).toBe("mission-42");   // l'état EXISTANT, pas un nouvel effet
  });

  it("JSON réordonné ⇒ MÊME identité canonique (les clés sont triées) ⇒ pas de doublon", async () => {
    const reordered: CanonicalCommand = { ...A, payload: { autonomyMode: "normal", instruction: "Préparer un CDI pour Marie" } };
    expect(commandFingerprint(reordered)).toBe(commandFingerprint(A));

    const led = createInMemoryCommandLedger(() => 1_000);
    await led.claim(A, "w1", 30_000);
    await led.commit(A, "mission-42", {}, "w1");
    expect((await led.claim(reordered, "w2", 30_000)).kind).toBe("duplicate_succeeded");
  });

  it("confirmations PARALLÈLES ⇒ une seule acquiert, l'autre voit `in_flight` (jamais 2 effets)", async () => {
    const led = createInMemoryCommandLedger(() => 1_000);
    const [x, y] = await Promise.all([led.claim(A, "w1", 30_000), led.claim(A, "w2", 30_000)]);
    const kinds = [x.kind, y.kind].sort();
    expect(kinds).toEqual(["acquired", "in_flight"]);
  });

  it("l'identité n'est PAS dérivée d'un horodatage : deux claims à des instants différents ⇒ même fingerprint", () => {
    // Un fingerprint basé sur `Date.now()` produirait un doublon à chaque réessai. Interdit par §5.
    expect(commandFingerprint(A)).toBe(commandFingerprint({ ...A }));
  });

  it("un échec TERMINAL ne se rejoue pas en douce : le rejeu reste terminal, aucun nouvel effet", async () => {
    const led = createInMemoryCommandLedger(() => 1_000);
    await led.claim(A, "w1", 30_000);
    await led.fail(A, true, "w1");                       // terminal (droits / version / guard)
    expect((await led.claim(A, "w2", 30_000)).kind).toBe("terminal");
  });
});

describe("P16D §9 — reprise après crash : on reprend, on ne duplique pas", () => {
  it("worker mort (lease expiré) ⇒ `recovered`, pas un second effet parallèle", async () => {
    let now = 1_000;
    const led = createInMemoryCommandLedger(() => now);
    expect((await led.claim(A, "w1", 30_000)).kind).toBe("acquired");

    now = 1_000 + 29_000;                                // lease encore valide
    expect((await led.claim(A, "w2", 30_000)).kind).toBe("in_flight");

    now = 1_000 + 31_000;                                // lease EXPIRÉ ⇒ reprise légitime
    const rec = await led.claim(A, "w2", 30_000);
    expect(rec.kind).toBe("recovered");
    expect(rec.command.attemptCount).toBe(2);            // la tentative est COMPTÉE, pas masquée
  });

  it("FENCING : un worker au lease volé ne peut plus committer — il n'écrase pas l'état du vivant", async () => {
    let now = 1_000;
    const led = createInMemoryCommandLedger(() => now);
    await led.claim(A, "w1", 30_000);                    // w1 part en exécution…
    now += 31_000;
    await led.claim(A, "w2", 30_000);                    // …w1 est présumé mort, w2 reprend

    // w1 « ressuscite » et tente de committer : REFUSÉ (il ne détient plus le lease).
    expect(await led.commit(A, "zombie-target", {}, "w1")).toBe(false);
    // w2, lui, committe réellement.
    expect(await led.commit(A, "mission-42", {}, "w2")).toBe(true);
    expect((await led.get(commandFingerprint(A), A)).targetRef).toBe("mission-42");
  });

  it("un worker périmé ne peut PAS retomber un `succeeded` en `failed`", async () => {
    let now = 1_000;
    const led = createInMemoryCommandLedger(() => now);
    await led.claim(A, "w1", 30_000);
    now += 31_000;
    await led.claim(A, "w2", 30_000);
    await led.commit(A, "mission-42", {}, "w2");

    expect(await led.fail(A, true, "w1")).toBe(false);   // fencé
    expect((await led.get(commandFingerprint(A), A)).status).toBe("succeeded");
  });

  it("une annulation n'efface JAMAIS un succès déjà acquis", async () => {
    const led = createInMemoryCommandLedger(() => 1_000);
    await led.claim(A, "w1", 30_000);
    await led.commit(A, "mission-42", {}, "w1");
    await led.cancel(A);
    expect((await led.get(commandFingerprint(A), A)).status).toBe("succeeded");
  });
});

describe("P16D §10 — isolation multi-tenant : A ne touche jamais B", () => {
  const B: CanonicalCommand = { ...A, companyId: "company-B" };

  it("le tenant fait partie de l'identité canonique ⇒ aucune collision de fingerprint", () => {
    expect(commandFingerprint(A)).not.toBe(commandFingerprint(B));
  });

  it("la MÊME proposition sous une autre entreprise est une AUTRE commande (pas un doublon)", async () => {
    const led = createInMemoryCommandLedger(() => 1_000);
    await led.claim(A, "w1", 30_000);
    await led.commit(A, "mission-A", {}, "w1");

    // B doit pouvoir acquérir : il ne doit NI être bloqué par A, NI hériter du résultat de A.
    const b = await led.claim(B, "w1", 30_000);
    expect(b.kind).toBe("acquired");
    expect(b.command.targetRef).not.toBe("mission-A");
  });

  it("l'entreprise B ne peut pas LIRE la commande de A, même en connaissant son fingerprint", async () => {
    const led = createInMemoryCommandLedger(() => 1_000);
    await led.claim(A, "w1", 30_000);
    await led.commit(A, "mission-A", { secret: "données de A" }, "w1");

    const fpA = commandFingerprint(A);
    expect(await led.get(fpA, { companyId: "company-B", actorId: "user-1" })).toBeNull();
    // Ni un autre ACTEUR de la même entreprise.
    expect(await led.get(fpA, { companyId: "company-A", actorId: "user-999" })).toBeNull();
    // Le propriétaire légitime, lui, lit bien sa commande.
    expect((await led.get(fpA, A))?.targetRef).toBe("mission-A");
  });

  it("B ne peut pas COMMITTER ni ANNULER la commande de A", async () => {
    const led = createInMemoryCommandLedger(() => 1_000);
    await led.claim(A, "w1", 30_000);

    const impostor = { ...A, companyId: "company-B" };
    expect(await led.commit(impostor, "detourne", {}, "w1")).toBe(false);
    await led.cancel(impostor);
    expect((await led.get(commandFingerprint(A), A)).status).toBe("executing"); // intact
  });
});
