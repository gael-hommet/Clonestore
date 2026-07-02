import { describe, it, expect } from "vitest";
import {
  mapOrderStatusToOperationalState,
  ownsFromStatus,
  summarizeOwnedEmployee,
} from "../order-mapping";

describe("mapOrderStatusToOperationalState", () => {
  it("active/trialing → employee_active + possédé", () => {
    expect(mapOrderStatusToOperationalState("active")).toBe("employee_active");
    expect(mapOrderStatusToOperationalState("trialing")).toBe("employee_active");
    expect(ownsFromStatus("active")).toBe(true);
    expect(ownsFromStatus("trialing")).toBe(true);
  });

  it("incomplete/unpaid → payment_pending (non possédé)", () => {
    expect(mapOrderStatusToOperationalState("incomplete")).toBe("payment_pending");
    expect(mapOrderStatusToOperationalState("unpaid")).toBe("payment_pending");
    expect(ownsFromStatus("incomplete")).toBe(false);
  });

  it("past_due/paused → suspended ; canceled/expired → ended", () => {
    expect(mapOrderStatusToOperationalState("past_due")).toBe("subscription_suspended");
    expect(mapOrderStatusToOperationalState("paused")).toBe("subscription_suspended");
    expect(mapOrderStatusToOperationalState("canceled")).toBe("subscription_ended");
    expect(mapOrderStatusToOperationalState("incomplete_expired")).toBe("subscription_ended");
  });

  it("vide/none/inconnu → authenticated_without_employee", () => {
    expect(mapOrderStatusToOperationalState(null)).toBe("authenticated_without_employee");
    expect(mapOrderStatusToOperationalState("none")).toBe("authenticated_without_employee");
    expect(mapOrderStatusToOperationalState("wat")).toBe("authenticated_without_employee");
  });
});

describe("summarizeOwnedEmployee", () => {
  it("aucune commande pour le slug → non possédé", () => {
    const s = summarizeOwnedEmployee([{ agent_slug: "clara", status: "active" }], "pierre");
    expect(s.ownsEmployee).toBe(false);
    expect(s.operationalState).toBe("authenticated_without_employee");
  });

  it("retient le meilleur statut (active > pending > ended)", () => {
    const s = summarizeOwnedEmployee(
      [
        { agent_slug: "pierre", status: "canceled" },
        { agent_slug: "pierre", status: "active" },
      ],
      "pierre",
    );
    expect(s.operationalState).toBe("employee_active");
    expect(s.ownsEmployee).toBe(true);
    expect(s.rawStatus).toBe("active");
  });

  it("commande pending seule → payment_pending, non possédé", () => {
    const s = summarizeOwnedEmployee([{ agent_slug: "pierre", status: "incomplete" }], "pierre");
    expect(s.operationalState).toBe("payment_pending");
    expect(s.ownsEmployee).toBe(false);
  });
});
