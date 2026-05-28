// B44 — POST /api/pierre/empreinte/validate
// Validates enterprise and/or pierre patches without persisting.
// Useful for client-side validation in the setup wizard.

import { NextRequest, NextResponse } from "next/server";
import { validateEnterpriseEmpreintePatch } from "../../../../../lib/clonestore/empreinte/enterprise-validation";
import { validatePierreEmpreintePatch } from "../../../../../lib/pierre/empreinte/pierre-validation";
import { validateEnterpriseEmpreinte } from "../../../../../lib/clonestore/empreinte/enterprise-validation";
import { validatePierreEmpreinte } from "../../../../../lib/pierre/empreinte/pierre-validation";
import { normalizeEnterpriseEmpreinte } from "../../../../../lib/clonestore/empreinte/enterprise-normalizer";
import { normalizePierreEmpreinte } from "../../../../../lib/pierre/empreinte/pierre-normalizer";
import type { EnterpriseEmpreintePatch } from "../../../../../lib/clonestore/empreinte/types";
import type { PierreEmpreintePatch } from "../../../../../lib/pierre/empreinte/types";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: SECURITY_HEADERS });
    }

    const { enterprise: enterprisePatch, pierre: pierrePatch } = body as {
      enterprise?: EnterpriseEmpreintePatch | Record<string, unknown>;
      pierre?: PierreEmpreintePatch | Record<string, unknown>;
    };

    const results: Record<string, unknown> = {};

    if (enterprisePatch) {
      const patchValidation = validateEnterpriseEmpreintePatch(enterprisePatch as EnterpriseEmpreintePatch);
      const normalized = normalizeEnterpriseEmpreinte(enterprisePatch, "validate");
      const fullValidation = validateEnterpriseEmpreinte(normalized);
      results.enterprise = {
        patch_valid: patchValidation.valid,
        full_valid: fullValidation.valid,
        issues: [...patchValidation.issues, ...fullValidation.issues],
        error_count: patchValidation.error_count + fullValidation.error_count,
        warning_count: patchValidation.warning_count + fullValidation.warning_count,
        completion: normalized.completion,
      };
    }

    if (pierrePatch) {
      const normalized = normalizePierreEmpreinte(pierrePatch, "validate", "validate_enterprise");
      const fullValidation = validatePierreEmpreinte(normalized);
      results.pierre = {
        valid: fullValidation.valid,
        issues: fullValidation.issues,
        error_count: fullValidation.error_count,
        warning_count: fullValidation.warning_count,
        completion: normalized.completion,
      };
    }

    if (!enterprisePatch && !pierrePatch) {
      return NextResponse.json({ error: "Provide 'enterprise' or 'pierre' to validate." }, { status: 400, headers: SECURITY_HEADERS });
    }

    return NextResponse.json({ validated: true, results }, { headers: SECURITY_HEADERS });
  } catch (_err) {
    return NextResponse.json({ error: "Validation failed." }, { status: 500, headers: SECURITY_HEADERS });
  }
}
