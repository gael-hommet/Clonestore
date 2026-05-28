// B48 — Launch Readiness Block Registry
// Tracks completion status of all blocs B33–B47.
// Pure: no Supabase, no Next, no async. No throw.

export type BlocStatus = "complete" | "partial" | "missing";

export type BlocEntry = {
  id: string;
  name: string;
  status: BlocStatus;
  test_count: number;
  has_routes: boolean;
  has_docs: boolean;
  notes: string | null;
};

const BLOC_REGISTRY: BlocEntry[] = [
  { id: "B33", name: "Pierre Auth & Access Layer", status: "complete", test_count: 89, has_routes: true, has_docs: true, notes: null },
  { id: "B34", name: "Pierre Billing & Stripe Integration", status: "complete", test_count: 92, has_routes: true, has_docs: true, notes: null },
  { id: "B35", name: "Pierre Onboarding & Setup Flow", status: "complete", test_count: 87, has_routes: true, has_docs: true, notes: null },
  { id: "B36", name: "Pierre Demo Mode & Sandbox", status: "complete", test_count: 95, has_routes: true, has_docs: true, notes: null },
  { id: "B37", name: "Pierre Document Generation System", status: "complete", test_count: 102, has_routes: true, has_docs: true, notes: null },
  { id: "B38", name: "Pierre Email Draft & Send Guards", status: "complete", test_count: 110, has_routes: true, has_docs: true, notes: "email.send always requires approval" },
  { id: "B39", name: "Pierre Payroll Pre-Processing Engine", status: "complete", test_count: 98, has_routes: true, has_docs: true, notes: "no official payslip generation" },
  { id: "B40", name: "Pierre HR Mission Engine", status: "complete", test_count: 115, has_routes: true, has_docs: true, notes: null },
  { id: "B41", name: "Pierre Absence & Leave Management", status: "complete", test_count: 88, has_routes: true, has_docs: true, notes: null },
  { id: "B42", name: "Pierre Contract & Clause Engine", status: "complete", test_count: 93, has_routes: true, has_docs: true, notes: "human validation required" },
  { id: "B43", name: "Pierre Sensitive HR Case Handler", status: "complete", test_count: 97, has_routes: true, has_docs: true, notes: "13 sensitive categories" },
  { id: "B44", name: "Pierre CloneADN Identity & Brand Engine", status: "complete", test_count: 84, has_routes: true, has_docs: true, notes: "no Logo in identifiers" },
  { id: "B45", name: "Pierre Document Style Kit & PDF Premium", status: "complete", test_count: 91, has_routes: true, has_docs: true, notes: null },
  { id: "B46", name: "CloneStore Technologies Configuration", status: "complete", test_count: 269, has_routes: true, has_docs: true, notes: "cloneguard+clonetrace locked" },
  { id: "B47", name: "Legal & Commercial Guardrails", status: "complete", test_count: 271, has_routes: true, has_docs: true, notes: "449€/month, legal_review_required=true" },
];

export function getAllBlocs(): BlocEntry[] {
  return [...BLOC_REGISTRY];
}

export function getBlocById(id: string): BlocEntry | null {
  return BLOC_REGISTRY.find((b) => b.id === id) ?? null;
}

export function getCompleteBlocs(): BlocEntry[] {
  return BLOC_REGISTRY.filter((b) => b.status === "complete");
}

export function getMissingOrPartialBlocs(): BlocEntry[] {
  return BLOC_REGISTRY.filter((b) => b.status !== "complete");
}

export function getBlocRegistrySummary(): {
  total: number;
  complete: number;
  partial: number;
  missing: number;
  total_tests: number;
} {
  const complete = BLOC_REGISTRY.filter((b) => b.status === "complete").length;
  const partial = BLOC_REGISTRY.filter((b) => b.status === "partial").length;
  const missing = BLOC_REGISTRY.filter((b) => b.status === "missing").length;
  const total_tests = BLOC_REGISTRY.reduce((acc, b) => acc + b.test_count, 0);
  return { total: BLOC_REGISTRY.length, complete, partial, missing, total_tests };
}

export function areAllBlocsComplete(): boolean {
  return BLOC_REGISTRY.every((b) => b.status === "complete");
}
