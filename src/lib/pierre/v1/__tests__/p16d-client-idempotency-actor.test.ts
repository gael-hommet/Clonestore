// src/lib/pierre/v1/__tests__/p16d-client-idempotency-actor.test.ts
// P16D §5/§10 — la clé d'idempotence de création de mission lie l'ACTEUR.
//
// DÉFAUT CORRIGÉ (HIGH) — le client cockpit envoyait `ui|<companyId>|<instruction>`, SANS acteur.
// Le serveur (mission-service) utilise la clé fournie par le client si présente ; deux
// utilisateurs d'une même entreprise tapant la même instruction partageaient donc la même clé,
// et la 2e mission fusionnait avec celle du 1er (l'un récupérait la mission de l'autre).
//
// Correction : le client ne transmet PLUS de clé sans acteur. Absente, le serveur dérive sa clé
// `[company_id, user_id, "mission", instruction]` (liée à l'acteur authentifié). Le double-clic
// reste protégé (clé serveur déterministe par entreprise+acteur+instruction).

import { describe, it, expect, vi } from "vitest";
import { createPierreClient } from "@/lib/pierre/v1/client";

function fakeFetch(capture: { bodies: unknown[] }) {
  // On se moque de la validité de la RÉPONSE : seul le corps de la REQUÊTE nous intéresse,
  // et il est capturé avant tout parsing de réponse. `retrySafe` peut rejouer : on lit bodies[0].
  return vi.fn(async (_url: string, init?: { body?: string }) => {
    capture.bodies.push(init?.body ? JSON.parse(init.body) : null);
    return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

async function captureCreateBody(client: ReturnType<typeof createPierreClient>, input: Parameters<ReturnType<typeof createPierreClient>["createMission"]>[0]): Promise<void> {
  try { await client.createMission(input); } catch { /* la validation de réponse échoue : sans importance, le corps est déjà capturé */ }
}

describe("P16D §5/§10 — aucune clé d'idempotence sans acteur n'est envoyée par le client", () => {
  it("sans clé fournie, le client N'ENVOIE PAS de `ui|<company>|...` — le serveur liera l'acteur", async () => {
    const capture = { bodies: [] as unknown[] };
    const client = createPierreClient({ companyId: "company-A", fetchImpl: fakeFetch(capture) });
    await captureCreateBody(client, { instruction: "Prépare une synthèse" });

    const body = capture.bodies[0] as Record<string, unknown>;
    // La clé actor-less d'antan ne doit plus apparaître.
    expect(String(body.idempotency_key ?? "")).not.toContain("ui|");
    // Aucune clé transmise ⇒ le serveur dérive la sienne (liée à l'acteur).
    expect("idempotency_key" in body).toBe(false);
  });

  it("une clé EXPLICITEMENT fournie par l'appelant est toujours transmise (ex. reprise gouvernée)", async () => {
    const capture = { bodies: [] as unknown[] };
    const client = createPierreClient({ companyId: "company-A", fetchImpl: fakeFetch(capture) });
    await captureCreateBody(client, { instruction: "X", idempotency_key: "clef-serveur-explicite" });

    const body = capture.bodies[0] as Record<string, unknown>;
    expect(body.idempotency_key).toBe("clef-serveur-explicite");
  });
});
