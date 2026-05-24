// src/app/api/cloneos/ai/contracts/route.ts
// CloneOS AI prompt contracts listing — returns safe contract metadata without full prompts.
// system_prompt_preview is capped at 200 chars.

import { NextResponse } from "next/server";
import { listCloneAIPromptContracts } from "../../../../../lib/cloneos/ai/prompt-registry";

export async function GET(): Promise<NextResponse> {
  try {
    const contracts = listCloneAIPromptContracts();

    const safe = contracts.map((c) => ({
      id: c.id,
      use_case: c.use_case,
      version: c.version,
      model_profile: c.model_profile,
      output_mode: c.output_mode,
      required_variables: c.required_variables,
      json_schema_keys: c.json_schema ? Object.keys(c.json_schema) : [],
      system_prompt_preview: typeof c.system_prompt === "string"
        ? c.system_prompt.slice(0, 200)
        : null,
    }));

    return NextResponse.json({ ok: true, contracts: safe, count: safe.length }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Failed to retrieve AI contracts.", detail: String(err) },
      { status: 500 },
    );
  }
}
