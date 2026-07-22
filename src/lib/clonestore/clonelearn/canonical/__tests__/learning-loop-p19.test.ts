// src/lib/clonestore/clonelearn/canonical/__tests__/learning-loop-p19.test.ts
// P19 — CloneLearn controlled cycle: corrections → candidate → review → versioned CloneADN patch.
// Invariants: never silent, never cross-tenant, never generalize on a single critical example.

import { describe, it, expect } from "vitest";
import {
  aggregateLearningCandidates, buildLearningProposal, reviewLearningProposal,
  applyApprovedLearningToAdn, revertLastLearning, type LearningEvent, type VersionedAdnLike,
} from "../learning-loop";

const ev = (o: Partial<LearningEvent> & Pick<LearningEvent, "company_id" | "field" | "after" | "actor_user_id" | "occurred_at">): LearningEvent =>
  ({ kind: "document_correction", ...o });

describe("P19 — CloneLearn full controlled scenario (8 steps)", () => {
  it("repeated tone correction → proposal → approval → versioned CloneADN update; company B untouched", () => {
    // 1-2. Pierre produced content; humans corrected the tone the same way 3× (2 distinct actors) for company A.
    const events: LearningEvent[] = [
      ev({ company_id: "A", field: "tone", after: "chaleureux", actor_user_id: "u1", occurred_at: "2026-07-01T09:00:00Z", kind: "tone_change" }),
      ev({ company_id: "A", field: "tone", after: "chaleureux", actor_user_id: "u2", occurred_at: "2026-07-02T09:00:00Z", kind: "tone_change" }),
      ev({ company_id: "A", field: "tone", after: "chaleureux", actor_user_id: "u1", occurred_at: "2026-07-03T09:00:00Z", kind: "tone_change" }),
      // company B corrected differently — must never merge with A
      ev({ company_id: "B", field: "tone", after: "formel", actor_user_id: "b1", occurred_at: "2026-07-03T09:00:00Z", kind: "tone_change" }),
    ];

    // 3. Candidate
    const candidates = aggregateLearningCandidates(events);
    const aCand = candidates.find((c) => c.company_id === "A" && c.field === "tone")!;
    expect(aCand.occurrences).toBe(3);
    expect(aCand.distinct_actors).toBe(2);
    expect(aCand.classification).toBe("repetition");
    expect(aCand.confidence).toBeGreaterThanOrEqual(0.6);

    // 4. Proposal (never silent — status pending_review)
    const proposal = buildLearningProposal(aCand)!;
    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposed_value).toBe("chaleureux");

    // 5. Human review → approve → 6. versioned CloneADN patch
    const approved = reviewLearningProposal(proposal, { action: "approve", reviewer_user_id: "owner", reviewed_at: "2026-07-04T09:00:00Z" });
    expect(approved.status).toBe("approved");

    const adnA: VersionedAdnLike = { company_id: "A", version: 1, fields: { tone: "neutre" }, provenance: [] };
    const adnA2 = applyApprovedLearningToAdn(adnA, approved as Extract<typeof approved, { status: "approved" }>);
    expect(adnA2.version).toBe(2);
    expect(adnA2.fields.tone).toBe("chaleureux");            // 7. next generation would use the preference
    expect(adnA2.provenance).toHaveLength(1);
    expect(adnA2.provenance[0].source).toBe("clonelearn");
    expect(adnA2.provenance[0].from_version).toBe(1);
    expect(adnA2.provenance[0].to_version).toBe(2);

    // 8. Company B unchanged: its candidate is an exception (1 occurrence), no proposal.
    const bCand = candidates.find((c) => c.company_id === "B")!;
    expect(bCand.classification).toBe("exception");
    expect(buildLearningProposal(bCand)).toBeNull();
  });
});

describe("P19 — CloneLearn invariants", () => {
  it("never silent: a single correction is an exception, no proposal", () => {
    const [c] = aggregateLearningCandidates([ev({ company_id: "A", field: "signature", after: "Cordialement", actor_user_id: "u1", occurred_at: "2026-07-01T00:00:00Z" })]);
    expect(c.classification).toBe("exception");
    expect(buildLearningProposal(c)).toBeNull();
  });

  it("never generalizes a single critical example, even repeated by one actor", () => {
    const events = [1, 2, 3, 4].map((n) => ev({ company_id: "A", field: "salary_policy", after: "x", actor_user_id: "u1", occurred_at: `2026-07-0${n}T00:00:00Z`, critical: true }));
    const [c] = aggregateLearningCandidates(events);
    // 4 occurrences but a SINGLE actor on a critical field → exception, never a proposal.
    expect(c.critical).toBe(true);
    expect(c.classification).toBe("exception");
    expect(buildLearningProposal(c)).toBeNull();
  });

  it("critical field becomes a repetition only with enough evidence AND actor diversity", () => {
    const events = [
      ev({ company_id: "A", field: "validation_circuit.contract", after: "director", actor_user_id: "u1", occurred_at: "2026-07-01T00:00:00Z", critical: true }),
      ev({ company_id: "A", field: "validation_circuit.contract", after: "director", actor_user_id: "u2", occurred_at: "2026-07-02T00:00:00Z", critical: true }),
      ev({ company_id: "A", field: "validation_circuit.contract", after: "director", actor_user_id: "u3", occurred_at: "2026-07-03T00:00:00Z", critical: true }),
    ];
    const [c] = aggregateLearningCandidates(events);
    expect(c.classification).toBe("repetition");
    expect(buildLearningProposal(c)).not.toBeNull();
  });

  it("cross-tenant apply is refused", () => {
    const approved = { status: "approved" as const, company_id: "A", field: "tone", value: "x", reviewer_user_id: "o", reviewed_at: "2026-07-04T00:00:00Z", confidence: 0.9 };
    const adnB: VersionedAdnLike = { company_id: "B", version: 1, fields: {}, provenance: [] };
    expect(() => applyApprovedLearningToAdn(adnB, approved)).toThrow(/cross-tenant/);
  });

  it("rejected review never yields an applicable change; revert restores prior value", () => {
    const proposal = buildLearningProposal(aggregateLearningCandidates([
      ev({ company_id: "A", field: "tone", after: "vif", actor_user_id: "u1", occurred_at: "2026-07-01T00:00:00Z" }),
      ev({ company_id: "A", field: "tone", after: "vif", actor_user_id: "u2", occurred_at: "2026-07-02T00:00:00Z" }),
      ev({ company_id: "A", field: "tone", after: "vif", actor_user_id: "u3", occurred_at: "2026-07-03T00:00:00Z" }),
    ])[0])!;
    const rejected = reviewLearningProposal(proposal, { action: "reject", reviewer_user_id: "owner", reviewed_at: "t", reason: "trop tôt" });
    expect(rejected.status).toBe("rejected");

    // revert path
    let adn: VersionedAdnLike = { company_id: "A", version: 1, fields: { tone: "neutre" }, provenance: [] };
    adn = applyApprovedLearningToAdn(adn, { status: "approved", company_id: "A", field: "tone", value: "vif", reviewer_user_id: "o", reviewed_at: "t", confidence: 0.9 });
    expect(adn.fields.tone).toBe("vif");
    const reverted = revertLastLearning(adn, "tone");
    expect(reverted.fields.tone).toBe("neutre");
  });
});
