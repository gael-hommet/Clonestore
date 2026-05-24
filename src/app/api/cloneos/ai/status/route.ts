// src/app/api/cloneos/ai/status/route.ts
// CloneOS AI Runtime status — returns provider health and registered contracts.
// Read-only, no secrets exposed.

import { NextResponse } from "next/server";
import { getCloneAIRuntimeStatus } from "../../../../../lib/cloneos/ai/runtime";

export async function GET(): Promise<NextResponse> {
  try {
    const status = getCloneAIRuntimeStatus();
    return NextResponse.json({ ok: true, status }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Failed to retrieve AI runtime status.", detail: String(err) },
      { status: 500 },
    );
  }
}
