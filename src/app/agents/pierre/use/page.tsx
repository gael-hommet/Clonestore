// src/app/agents/pierre/use/page.tsx
// Pierre Cockpit B31 — Mission Center root page.
// Uses usePierreCockpit hook → PierreCockpitShell for full layout.

"use client";

import { usePierreCockpit } from "./hooks/usePierreCockpit";
import { PierreCockpitShell } from "./components/PierreCockpitShell";
import { useRequireAuth } from "@/lib/auth/useRequireAuth";

export default function PierreCockpitPage() {
  useRequireAuth();
  const cockpit = usePierreCockpit();
  return <PierreCockpitShell cockpit={cockpit} />;
}
