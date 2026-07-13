// src/app/api/pierre/email/__tests__/p16d-email-send-truthful.test.ts
// P16D §5/§6 — POST /api/pierre/email/send : « préparé » ne vaut JAMAIS « envoyé ».
//
// DÉFAUT CORRIGÉ (CRITIQUE, confirmé 3/3) — cette route n'importe AUCUN fournisseur d'envoi
// (grep resend|sendEmail|provider = 0). Elle fabriquait pourtant un `provider_message_id`,
// insérait `status:"sent"` avec cet ID inventé, écrivait un log « Email envoyé : … » et
// répondait `deliveryAccepted:true` — une PREUVE d'envoi entièrement inventée alors qu'aucun
// octet ne partait. Une entreprise pouvait ensuite s'appuyer sur cette ligne (« nous avons
// notifié le salarié à cette date ») : preuve fabriquée, sans aucun état d'échec/inconnu.
//
// Correction : fail-closed véridique — `status:"prepared"`, aucun `provider_message_id`, log
// « Email préparé (non envoyé …) », réponse `sent:false` / `deliveryAccepted:false` + disclosure.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Faux client Supabase : capture les insertions, simule auth + lectures ───────────────────
const inserts: Array<{ table: string; payload: Record<string, unknown> }> = [];

function makeFakeClient() {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })),
    },
    from(table: string) {
      const api: Record<string, unknown> = {
        select: () => api,
        eq: () => api,
        order: () => api,
        limit: () => api,
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => {
          // Renvoie la dernière ligne insérée dans cette table (comme .insert().select().single()).
          const last = [...inserts].reverse().find((i) => i.table === table);
          return { data: { id: "email-1", ...(last?.payload ?? {}) }, error: null };
        },
        insert(payload: Record<string, unknown>) {
          inserts.push({ table, payload });
          return api; // permet .insert().select("*").single()
        },
      };
      return api;
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => makeFakeClient(),
}));

// Import APRÈS le mock.
import { POST } from "@/app/api/pierre/email/send/route";

function req(body: Record<string, unknown>): import("next/server").NextRequest {
  const r = new Request("http://localhost/api/pierre/email/send", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-token" },
    body: JSON.stringify(body),
  });
  return r as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  inserts.length = 0;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
});

describe("P16D §5/§6 — la route email/send ne prétend jamais avoir envoyé", () => {
  it("réponse VÉRIDIQUE : sent=false, deliveryAccepted=false, status=prepared, disclosure présente", async () => {
    const res = await POST(req({ to: "paul@ex.com", subject: "Fin de période d'essai", body: "Bonjour" }));
    expect(res.status).toBe(200);
    const d = await res.json() as Record<string, unknown>;

    expect(d.sent).toBe(false);
    expect(d.status).toBe("prepared");
    expect((d.provider as Record<string, unknown>)?.deliveryAccepted).toBe(false);
    expect((d.provider as Record<string, unknown>)?.acknowledgement).toBe("none");
    expect(String(d.disclosure)).toMatch(/non envoy/i);
  });

  it("la LIGNE persistée n'est jamais status='sent' et n'a pas d'accusé fournisseur fabriqué", async () => {
    await POST(req({ to: "paul@ex.com", subject: "Test", body: "x" }));
    const emailRow = inserts.find((i) => i.table === "pierre_outbound_emails");
    expect(emailRow).toBeTruthy();
    expect(emailRow!.payload.status).toBe("prepared");
    expect(emailRow!.payload.status).not.toBe("sent");
    expect(emailRow!.payload.provider_message_id).toBeNull();
  });

  it("aucun log de mission ne prétend « Email envoyé »", async () => {
    await POST(req({ to: "paul@ex.com", subject: "Notif", body: "x", missionId: "m-1" }));
    // verifyMissionOwnershipIfNeeded interroge la mission ; le fake renvoie une ligne → log écrit.
    const logRow = inserts.find((i) => i.table === "pierre_task_logs");
    if (logRow) {
      expect(logRow.payload.event).not.toBe("email_sent_direct");
      expect(String(logRow.payload.message ?? "")).not.toMatch(/^Email envoyé/);
      expect(String(logRow.payload.message ?? "")).toMatch(/prépar/i);
      expect((logRow.payload.payload as Record<string, unknown>)?.sent).toBe(false);
    }
  });
});
