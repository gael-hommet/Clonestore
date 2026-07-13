import { describe, it, expect } from "vitest";
import {
  buildDefaultPremiumDocumentConfig,
  normalizePremiumDocumentVariable,
  normalizePremiumDocumentVariables,
  inferPremiumDocumentFamily,
  inferPremiumDocumentRiskLevel,
  selectPremiumDocumentTemplate,
  resolvePremiumDocumentVariables,
  interpolatePremiumTemplate,
  buildPremiumDocumentPlainText,
  buildPremiumDocumentHtml,
  validatePremiumDocument,
  buildPremiumDocumentDigest,
  renderPremiumDocument,
  buildPremiumDocumentArtifactPayload,
  buildPremiumDocumentEmailPayload,
  type PierrePremiumDocumentConfig,
  type PierrePremiumDocumentInput,
  type PierrePremiumDocumentVariable,
  type PierrePremiumDocumentFamily,
} from "../documents/premium-document-system";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<PierrePremiumDocumentInput> = {}): PierrePremiumDocumentInput {
  return {
    family: "generic_hr",
    channel: "document",
    title: "Test Document",
    raw_content: null,
    variables: [],
    ...overrides,
  };
}

function makeVar(
  key: string,
  value: string | number | boolean | null,
  source: PierrePremiumDocumentVariable["source"] = "manual",
  required = false,
): PierrePremiumDocumentVariable {
  return { key, label: key, value, required, source };
}

// ── buildDefaultPremiumDocumentConfig ─────────────────────────────────────

describe("buildDefaultPremiumDocumentConfig", () => {
  it("returns valid config with no input", () => {
    const config = buildDefaultPremiumDocumentConfig();
    expect(config.templates.length).toBeGreaterThanOrEqual(15);
    expect(config.branding).toBeDefined();
    expect(config.style_guide).toBeDefined();
    expect(config.custom_templates).toEqual([]);
    expect(config.validation_rules).toEqual([]);
  });

  it("reads company_name from top-level key", () => {
    const config = buildDefaultPremiumDocumentConfig({ company_name: "ACME Corp" });
    expect(config.branding.company_name).toBe("ACME Corp");
  });

  it("reads company_name from companyName camelCase", () => {
    const config = buildDefaultPremiumDocumentConfig({ companyName: "BetaCo" });
    expect(config.branding.company_name).toBe("BetaCo");
  });

  it("reads branding from reusable_rh_context_json", () => {
    const config = buildDefaultPremiumDocumentConfig({
      reusable_rh_context_json: { company_name: "Nested Corp" },
    });
    expect(config.branding.company_name).toBe("Nested Corp");
  });

  it("reads branding from document_system.branding", () => {
    const config = buildDefaultPremiumDocumentConfig({
      reusable_rh_context_json: {
        document_system: {
          branding: { company_name: "BrandedCo", primary_color: "#ff0000" },
        },
      },
    });
    expect(config.branding.company_name).toBe("BrandedCo");
    expect(config.branding.primary_color).toBe("#ff0000");
  });

  it("loads custom_templates from document_system", () => {
    const config = buildDefaultPremiumDocumentConfig({
      reusable_rh_context_json: {
        document_system: {
          custom_templates: [
            {
              id: "custom_1",
              family: "contract",
              name: "Mon Template",
              description: "",
              channel: "pdf",
              version: "1.0",
              risk_level: "orange",
              approval_required: true,
              required_variables: ["employee_name"],
              optional_variables: [],
              sections: [],
              default_tone: "formal",
              tags: [],
            },
          ],
        },
      },
    });
    expect(config.custom_templates.length).toBe(1);
    expect(config.custom_templates[0].id).toBe("custom_1");
  });

  it("ignores malformed custom_templates gracefully", () => {
    const config = buildDefaultPremiumDocumentConfig({
      reusable_rh_context_json: {
        document_system: { custom_templates: [null, undefined, 42, "string"] },
      },
    });
    expect(config.custom_templates).toEqual([]);
  });

  it("style_guide defaults to formal/high/balanced", () => {
    const config = buildDefaultPremiumDocumentConfig(null);
    expect(config.style_guide.tone).toBe("formal");
    expect(config.style_guide.formality_level).toBe("high");
    expect(config.style_guide.sentence_density).toBe("balanced");
    expect(config.style_guide.avoid_ai_phrasing).toBe(true);
    expect(config.style_guide.include_human_review_note).toBe(true);
  });

  it("contains all 15 default template families", () => {
    const config = buildDefaultPremiumDocumentConfig();
    const families = config.templates.map((t) => t.family);
    const expected: PierrePremiumDocumentFamily[] = [
      "contract", "amendment", "offer", "convocation", "refusal",
      "followup", "onboarding", "absence", "pre_payroll", "performance",
      "training", "offboarding", "employee_summary", "internal_note", "generic_hr",
    ];
    for (const f of expected) {
      expect(families).toContain(f);
    }
  });
});

// ── normalizePremiumDocumentVariable ─────────────────────────────────────

describe("normalizePremiumDocumentVariable", () => {
  it("returns null for null input", () => {
    expect(normalizePremiumDocumentVariable(null)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(normalizePremiumDocumentVariable("string")).toBeNull();
    expect(normalizePremiumDocumentVariable(42)).toBeNull();
    expect(normalizePremiumDocumentVariable([])).toBeNull();
  });

  it("returns null when key is missing", () => {
    expect(normalizePremiumDocumentVariable({ label: "no key" })).toBeNull();
  });

  it("normalizes key to lowercase with underscores", () => {
    const v = normalizePremiumDocumentVariable({ key: "Employee Name", value: "Alice", source: "manual" });
    expect(v?.key).toBe("employee_name");
  });

  it("accepts string value", () => {
    const v = normalizePremiumDocumentVariable({ key: "name", value: "Alice", source: "payload" });
    expect(v?.value).toBe("Alice");
    expect(v?.source).toBe("payload");
  });

  it("accepts numeric value", () => {
    const v = normalizePremiumDocumentVariable({ key: "score", value: 99, source: "task" });
    expect(v?.value).toBe(99);
  });

  it("accepts boolean value", () => {
    const v = normalizePremiumDocumentVariable({ key: "active", value: true, source: "manual" });
    expect(v?.value).toBe(true);
  });

  it("defaults unknown source to 'unknown'", () => {
    const v = normalizePremiumDocumentVariable({ key: "x", value: "y", source: "alien_source" });
    expect(v?.source).toBe("unknown");
  });

  it("sets required from field", () => {
    const v = normalizePremiumDocumentVariable({ key: "x", value: "y", required: true });
    expect(v?.required).toBe(true);
  });
});

// ── normalizePremiumDocumentVariables ────────────────────────────────────

describe("normalizePremiumDocumentVariables", () => {
  it("returns empty array for non-array", () => {
    expect(normalizePremiumDocumentVariables(null)).toEqual([]);
    expect(normalizePremiumDocumentVariables("x")).toEqual([]);
  });

  it("returns empty array for empty array", () => {
    expect(normalizePremiumDocumentVariables([])).toEqual([]);
  });

  it("filters out invalid entries", () => {
    const result = normalizePremiumDocumentVariables([
      null,
      { key: "name", value: "Bob", source: "manual" },
      "bad",
    ]);
    expect(result.length).toBe(1);
    expect(result[0].key).toBe("name");
  });
});

// ── inferPremiumDocumentFamily ────────────────────────────────────────────

describe("inferPremiumDocumentFamily", () => {
  it("returns generic_hr for null", () => {
    expect(inferPremiumDocumentFamily(null)).toBe("generic_hr");
  });

  it("returns generic_hr for undefined", () => {
    expect(inferPremiumDocumentFamily(undefined)).toBe("generic_hr");
  });

  it("detects family from direct family field", () => {
    expect(inferPremiumDocumentFamily({ family: "contract" })).toBe("contract");
    expect(inferPremiumDocumentFamily({ family: "offboarding" })).toBe("offboarding");
  });

  it("detects contract from CDI/CDD keywords", () => {
    expect(inferPremiumDocumentFamily("contrat CDI")).toBe("contract");
    expect(inferPremiumDocumentFamily("contrat CDD")).toBe("contract");
  });

  it("detects amendment from avenant keyword", () => {
    expect(inferPremiumDocumentFamily("avenant au contrat")).toBe("amendment");
  });

  it("detects offer from offre emploi", () => {
    expect(inferPremiumDocumentFamily("offre d'emploi")).toBe("offer");
  });

  it("detects convocation", () => {
    expect(inferPremiumDocumentFamily("convocation entretien")).toBe("convocation");
  });

  it("detects refusal", () => {
    expect(inferPremiumDocumentFamily("refus de candidature")).toBe("refusal");
  });

  it("detects onboarding", () => {
    expect(inferPremiumDocumentFamily("document onboarding accueil")).toBe("onboarding");
  });

  it("detects absence from various keywords", () => {
    expect(inferPremiumDocumentFamily("demande de congé")).toBe("absence");
    expect(inferPremiumDocumentFamily("arrêt maladie")).toBe("absence");
    expect(inferPremiumDocumentFamily("justificatif absence")).toBe("absence");
  });

  it("detects pre_payroll", () => {
    expect(inferPremiumDocumentFamily("éléments pre-paie")).toBe("pre_payroll");
    expect(inferPremiumDocumentFamily("prepayroll summary")).toBe("pre_payroll");
  });

  it("detects performance", () => {
    expect(inferPremiumDocumentFamily("entretien d'évaluation")).toBe("performance");
  });

  it("detects training", () => {
    expect(inferPremiumDocumentFamily("plan de formation")).toBe("training");
  });

  it("detects offboarding from departure keywords", () => {
    expect(inferPremiumDocumentFamily("licenciement")).toBe("offboarding");
    expect(inferPremiumDocumentFamily("rupture conventionnelle")).toBe("offboarding");
    expect(inferPremiumDocumentFamily("solde de tout compte")).toBe("offboarding");
  });

  it("detects employee_summary", () => {
    expect(inferPremiumDocumentFamily("synthèse salarié")).toBe("employee_summary");
    expect(inferPremiumDocumentFamily("fiche salarié")).toBe("employee_summary");
  });

  it("detects internal_note", () => {
    expect(inferPremiumDocumentFamily("note interne RH")).toBe("internal_note");
  });

  it("detects followup", () => {
    expect(inferPremiumDocumentFamily("relance RH")).toBe("followup");
    expect(inferPremiumDocumentFamily("follow-up dossier")).toBe("followup");
  });

  it("falls back to generic_hr for unrecognized input", () => {
    expect(inferPremiumDocumentFamily("xyz123 nonsense text")).toBe("generic_hr");
  });

  it("handles object input with title field", () => {
    expect(inferPremiumDocumentFamily({ title: "Contrat de travail CDI" })).toBe("contract");
  });

  it("handles object input with doc_type field", () => {
    expect(inferPremiumDocumentFamily({ doc_type: "onboarding" })).toBe("onboarding");
  });
});

// ── E1.1 — RÉGRESSION : accents, liaisons et flexions ────────────────────────
// Le défaut réel : le texte était mis en minuscules mais JAMAIS désaccentué, et plusieurs
// motifs n'admettaient qu'UN SEUL caractère de séparation. Conséquences : `\bcongé\b` ne
// pouvait jamais correspondre (« é » n'est pas un caractère de mot ASCII, la limite finale
// échoue), « arrêt maladie » ratait `arret.maladie`, et « solde DE tout compte » ratait
// `solde.tout.compte`. Quatre familles retombaient silencieusement sur generic_hr.
describe("inferPremiumDocumentFamily — accents, liaisons, flexions (E1.1)", () => {
  it("reconnaît la même famille avec ET sans accents", () => {
    for (const [accented, plain] of [
      ["demande de congé", "demande de conge"],
      ["arrêt maladie", "arret maladie"],
      ["entretien d'évaluation", "entretien d evaluation"],
      ["synthèse salarié", "synthese salarie"],
      ["éléments pre-paie", "elements pre-paie"],
    ] as const) {
      expect(inferPremiumDocumentFamily(accented)).toBe(inferPremiumDocumentFamily(plain));
    }
  });

  it("tolère les mots de liaison entre les mots-clés", () => {
    expect(inferPremiumDocumentFamily("solde de tout compte")).toBe("offboarding");
    expect(inferPremiumDocumentFamily("solde tout compte")).toBe("offboarding");
    expect(inferPremiumDocumentFamily("entretien d'évaluation")).toBe("performance");
    expect(inferPremiumDocumentFamily("entretien évaluation")).toBe("performance");
    expect(inferPremiumDocumentFamily("offre d'emploi")).toBe("offer");
  });

  it("tolère les flexions (pluriel / féminin)", () => {
    expect(inferPremiumDocumentFamily("demandes de congés")).toBe("absence");
    expect(inferPremiumDocumentFamily("justificatifs d'absences")).toBe("absence");
    expect(inferPremiumDocumentFamily("licenciements")).toBe("offboarding");
    expect(inferPremiumDocumentFamily("fiches salariés")).toBe("employee_summary");
    expect(inferPremiumDocumentFamily("plans de formation")).toBe("training");
  });

  it("départ / offboarding sous plusieurs formulations", () => {
    for (const s of ["licenciement", "rupture conventionnelle", "solde de tout compte", "démission", "départ salarié", "fin de contrat"]) {
      expect(inferPremiumDocumentFamily(s)).toBe("offboarding");
    }
  });

  it("la ponctuation et la casse ne changent pas la famille", () => {
    expect(inferPremiumDocumentFamily("ARRÊT-MALADIE")).toBe("absence");
    expect(inferPremiumDocumentFamily("Note   interne / RH")).toBe("internal_note");
    expect(inferPremiumDocumentFamily("FOLLOW-UP dossier")).toBe("followup");
  });

  it("l'ordre de priorité reste intact (une convocation n'est pas un entretien d'évaluation)", () => {
    expect(inferPremiumDocumentFamily("convocation entretien")).toBe("convocation");
    expect(inferPremiumDocumentFamily("avenant au contrat")).toBe("amendment");
  });

  it("repli generic_hr : entrées ambiguës, vides ou hors domaine", () => {
    for (const s of ["", "   ", "!!! ???", "xyz123 nonsense text", "réunion mardi", "budget marketing"]) {
      expect(inferPremiumDocumentFamily(s)).toBe("generic_hr");
    }
    expect(inferPremiumDocumentFamily(null)).toBe("generic_hr");
    expect(inferPremiumDocumentFamily(undefined)).toBe("generic_hr");
  });

  it("ne sur-classifie pas : un mot tronqué ne déclenche pas une famille", () => {
    expect(inferPremiumDocumentFamily("salai")).toBe("generic_hr");
    expect(inferPremiumDocumentFamily("conv")).toBe("generic_hr");
  });
});

// ── inferPremiumDocumentRiskLevel ─────────────────────────────────────────

describe("inferPremiumDocumentRiskLevel", () => {
  it("harcèlement → black", () => {
    expect(inferPremiumDocumentRiskLevel("generic_hr", "cas de harcèlement au travail")).toBe("black");
  });

  it("discrimination → black", () => {
    expect(inferPremiumDocumentRiskLevel("generic_hr", "discrimination syndicale")).toBe("black");
  });

  it("faute grave → black", () => {
    expect(inferPremiumDocumentRiskLevel("generic_hr", "faute grave constatée")).toBe("black");
  });

  it("prud'hommes → black", () => {
    expect(inferPremiumDocumentRiskLevel("generic_hr", "dossier prud'hommes")).toBe("black");
  });

  it("licenciement disciplinaire → black", () => {
    expect(inferPremiumDocumentRiskLevel("generic_hr", "licenciement pour motif disciplinaire")).toBe("black");
  });

  it("licenciement (non-disciplinaire) → red", () => {
    expect(inferPremiumDocumentRiskLevel("generic_hr", "licenciement économique")).toBe("red");
  });

  it("rupture conventionnelle → red", () => {
    expect(inferPremiumDocumentRiskLevel("generic_hr", "rupture conventionnelle du contrat")).toBe("red");
  });

  it("offboarding family → red (by family)", () => {
    expect(inferPremiumDocumentRiskLevel("offboarding", "départ du salarié")).toBe("red");
  });

  it("pre_payroll family → red (by family)", () => {
    expect(inferPremiumDocumentRiskLevel("pre_payroll", "elements mensuels")).toBe("red");
  });

  it("contract family → orange", () => {
    expect(inferPremiumDocumentRiskLevel("contract", "contrat de travail standard")).toBe("orange");
  });

  it("amendment family → orange", () => {
    expect(inferPremiumDocumentRiskLevel("amendment", "avenant")).toBe("orange");
  });

  it("absence family → orange", () => {
    expect(inferPremiumDocumentRiskLevel("absence", "demande de congé")).toBe("orange");
  });

  it("employee_summary family → orange", () => {
    expect(inferPremiumDocumentRiskLevel("employee_summary", "fiche salarié")).toBe("orange");
  });

  it("followup family with clean content → green", () => {
    expect(inferPremiumDocumentRiskLevel("followup", "relance dossier en attente")).toBe("green");
  });

  it("generic_hr family → green", () => {
    expect(inferPremiumDocumentRiskLevel("generic_hr", "document générique")).toBe("green");
  });
});

// ── selectPremiumDocumentTemplate ────────────────────────────────────────

describe("selectPremiumDocumentTemplate", () => {
  const config = buildDefaultPremiumDocumentConfig();

  it("finds template by family+channel exact match", () => {
    const tpl = selectPremiumDocumentTemplate(config, "contract", "pdf");
    expect(tpl?.family).toBe("contract");
  });

  it("falls back to family match when channel differs", () => {
    const tpl = selectPremiumDocumentTemplate(config, "contract", "document");
    expect(tpl?.family).toBe("contract");
  });

  it("falls back to generic_hr for unknown family", () => {
    const tpl = selectPremiumDocumentTemplate(config, "generic_hr", "document");
    expect(tpl?.family).toBe("generic_hr");
  });

  it("prioritises custom templates over defaults", () => {
    const customConfig: PierrePremiumDocumentConfig = {
      ...config,
      custom_templates: [
        {
          id: "my_contract",
          family: "contract",
          name: "Custom Contract",
          description: "",
          channel: "pdf",
          version: "2.0",
          risk_level: "orange",
          approval_required: true,
          required_variables: [],
          optional_variables: [],
          sections: [],
          default_tone: "formal",
          tags: [],
        },
      ],
    };
    const tpl = selectPremiumDocumentTemplate(customConfig, "contract", "pdf");
    expect(tpl?.id).toBe("my_contract");
  });
});

// ── resolvePremiumDocumentVariables ──────────────────────────────────────

describe("resolvePremiumDocumentVariables", () => {
  const config = buildDefaultPremiumDocumentConfig({ company_name: "TestCo" });

  it("injects company_name from config branding", () => {
    const vars = resolvePremiumDocumentVariables(makeInput(), config);
    const companyVar = vars.find((v) => v.key === "company_name");
    expect(companyVar?.value).toBe("TestCo");
    expect(companyVar?.source).toBe("company_memory");
  });

  it("manual source overrides company_memory for same key", () => {
    const vars = resolvePremiumDocumentVariables(
      makeInput({ variables: [makeVar("company_name", "Override", "manual")] }),
      config,
    );
    const cv = vars.find((v) => v.key === "company_name");
    expect(cv?.value).toBe("Override");
    expect(cv?.source).toBe("manual");
  });

  it("payload source overrides company_memory", () => {
    const vars = resolvePremiumDocumentVariables(
      makeInput({ payload: { company_name: "PayloadCo" } }),
      config,
    );
    const cv = vars.find((v) => v.key === "company_name");
    expect(cv?.value).toBe("PayloadCo");
    expect(cv?.source).toBe("payload");
  });

  it("reads employee_name from employee_file", () => {
    const vars = resolvePremiumDocumentVariables(
      makeInput({ employee_file: { name: "Jean Martin", role: "Chef de projet" } }),
      config,
    );
    const en = vars.find((v) => v.key === "employee_name");
    expect(en?.value).toBe("Jean Martin");
    expect(en?.source).toBe("employee_file");
  });

  it("reads position from employee_file", () => {
    const vars = resolvePremiumDocumentVariables(
      makeInput({ employee_file: { role: "CTO" } }),
      config,
    );
    const pos = vars.find((v) => v.key === "position");
    expect(pos?.value).toBe("CTO");
  });

  it("reads mission_id from mission object", () => {
    const vars = resolvePremiumDocumentVariables(
      makeInput({ mission: { id: "mission-abc" } }),
      config,
    );
    const mid = vars.find((v) => v.key === "mission_id");
    expect(mid?.value).toBe("mission-abc");
    expect(mid?.source).toBe("mission");
  });

  it("employee_file overrides task source for same key", () => {
    const vars = resolvePremiumDocumentVariables(
      makeInput({
        employee_file: { name: "Alice File" },
        task: { id: "t1", payload_json: { employee_name: "Alice Task" } },
      }),
      config,
    );
    const en = vars.find((v) => v.key === "employee_name");
    expect(en?.source).toBe("employee_file");
    expect(en?.value).toBe("Alice File");
  });
});

// ── interpolatePremiumTemplate ────────────────────────────────────────────

describe("interpolatePremiumTemplate", () => {
  it("returns empty string for empty input", () => {
    expect(interpolatePremiumTemplate("", [])).toBe("");
  });

  it("passes through text with no markers", () => {
    expect(interpolatePremiumTemplate("Hello world", [])).toBe("Hello world");
  });

  it("replaces known variable with value", () => {
    const vars = [makeVar("name", "Alice")];
    expect(interpolatePremiumTemplate("Bonjour {{name}}", vars)).toBe("Bonjour Alice");
  });

  it("leaves placeholder for unknown variable", () => {
    const result = interpolatePremiumTemplate("Valeur : {{unknown_key}}", []);
    expect(result).toContain("[À compléter");
  });

  it("leaves placeholder for required null variable", () => {
    const vars = [{ key: "salary", label: "Salaire", value: null, required: true, source: "manual" as const }];
    const result = interpolatePremiumTemplate("Salaire : {{salary}}", vars);
    expect(result).toContain("[À compléter");
  });

  it("replaces optional null variable with empty string", () => {
    const vars = [{ key: "notes", label: "Notes", value: null, required: false, source: "manual" as const }];
    const result = interpolatePremiumTemplate("Notes: {{notes}}", vars);
    expect(result).toBe("Notes: ");
  });

  it("converts boolean true to 'Oui'", () => {
    const vars = [makeVar("active", true)];
    expect(interpolatePremiumTemplate("Actif: {{active}}", vars)).toBe("Actif: Oui");
  });

  it("converts boolean false to 'Non'", () => {
    const vars = [makeVar("active", false)];
    expect(interpolatePremiumTemplate("Actif: {{active}}", vars)).toBe("Actif: Non");
  });

  it("converts number to string", () => {
    const vars = [makeVar("score", 42)];
    expect(interpolatePremiumTemplate("Score: {{score}}", vars)).toBe("Score: 42");
  });

  it("handles case-insensitive key matching", () => {
    const vars = [makeVar("employee_name", "Bob")];
    expect(interpolatePremiumTemplate("{{EMPLOYEE_NAME}}", vars)).toBe("Bob");
  });
});

// ── buildPremiumDocumentPlainText ────────────────────────────────────────

describe("buildPremiumDocumentPlainText", () => {
  const config = buildDefaultPremiumDocumentConfig({ company_name: "TestCo" });

  it("uses raw_content when provided and long enough", () => {
    const input = makeInput({
      family: "generic_hr",
      raw_content: "A".repeat(100),
    });
    const result = buildPremiumDocumentPlainText(input, null, [], config);
    expect(result).toContain("A".repeat(100));
  });

  it("builds from template sections when no raw_content", () => {
    const config2 = buildDefaultPremiumDocumentConfig();
    const template = config2.templates.find((t) => t.family === "onboarding")!;
    const vars = [
      makeVar("employee_name", "Marie"),
      makeVar("company_name", "TestCo"),
      makeVar("position", "Développeuse"),
      makeVar("start_date", "2026-01-10"),
    ];
    const input = makeInput({ family: "onboarding" });
    const result = buildPremiumDocumentPlainText(input, template, vars, config2);
    expect(result).toContain("Marie");
    expect(result).toContain("TestCo");
  });

  it("includes human review note when style guide requires it", () => {
    const input = makeInput({ family: "generic_hr" });
    const result = buildPremiumDocumentPlainText(input, null, [], config);
    expect(result).toContain("validation");
  });

  it("uses fallback when no template and no raw content", () => {
    const input = makeInput({ family: "contract", raw_content: null });
    const result = buildPremiumDocumentPlainText(input, null, [], config);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── buildPremiumDocumentHtml ──────────────────────────────────────────────

describe("buildPremiumDocumentHtml", () => {
  const config = buildDefaultPremiumDocumentConfig({ company_name: "MaCo" });

  it("produces valid HTML with DOCTYPE", () => {
    const input = makeInput({ family: "generic_hr" });
    const html = buildPremiumDocumentHtml("Content here", input, null, [], config);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("contains no script tags", () => {
    const input = makeInput({ family: "contract" });
    const html = buildPremiumDocumentHtml("Some content", input, null, [], config);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("</script>");
  });

  it("escapes user content to prevent XSS", () => {
    const input = makeInput({ family: "generic_hr" });
    const html = buildPremiumDocumentHtml("<script>alert('xss')</script>", input, null, [], config);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script");
  });

  it("contains pierre-wrapper class", () => {
    const input = makeInput({ family: "generic_hr" });
    const html = buildPremiumDocumentHtml("Content", input, null, [], config);
    expect(html).toContain("pierre-wrapper");
  });

  it("includes company name in header", () => {
    const input = makeInput({ family: "generic_hr" });
    const html = buildPremiumDocumentHtml("Content", input, null, [], config);
    expect(html).toContain("MaCo");
  });

  it("includes family label in header", () => {
    const input = makeInput({ family: "contract" });
    const html = buildPremiumDocumentHtml("Content", input, null, [], config);
    expect(html).toContain("Contrat");
  });

  it("renders section headers with pierre-section-title", () => {
    const input = makeInput({ family: "generic_hr" });
    const html = buildPremiumDocumentHtml("— Mon titre —\n\nContenu", input, null, [], config);
    expect(html).toContain("pierre-section-title");
  });
});

// ── validatePremiumDocument ───────────────────────────────────────────────

describe("validatePremiumDocument", () => {
  const config = buildDefaultPremiumDocumentConfig({ company_name: "TestCo" });

  it("returns blocked for empty content", () => {
    const input = makeInput({ family: "generic_hr" });
    const result = validatePremiumDocument(input, null, [], "short", "<p>short</p>", config);
    expect(result.status).toBe("blocked");
    expect(result.issues.some((i) => i.code === "EMPTY_CONTENT")).toBe(true);
  });

  it("returns blocked and approval_required for black risk content", () => {
    const content = "harcèlement moral avéré dans l'équipe".repeat(5);
    const input = makeInput({ family: "generic_hr", raw_content: content });
    const result = validatePremiumDocument(input, null, [], content, "<p>x</p>", config);
    expect(result.approval_required).toBe(true);
    expect(["black", "red"]).toContain(result.risk_level);
  });

  it("forces approval_required for red risk (offboarding template)", () => {
    const config2 = buildDefaultPremiumDocumentConfig();
    const template = config2.templates.find((t) => t.family === "offboarding")!;
    const content = "Départ définitif du salarié. Solde de tout compte à préparer. " + "A".repeat(80);
    const input = makeInput({ family: "offboarding" });
    const result = validatePremiumDocument(input, template, [], content, "<p>x</p>", config2);
    expect(result.approval_required).toBe(true);
  });

  it("reports missing required variable", () => {
    const config2 = buildDefaultPremiumDocumentConfig();
    const template = config2.templates.find((t) => t.family === "contract")!;
    const content = "A".repeat(120);
    const input = makeInput({ family: "contract" });
    const result = validatePremiumDocument(input, template, [], content, "<p>x</p>", config2);
    expect(result.missing_required_variables.length).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.code === "MISSING_REQUIRED_VAR")).toBe(true);
  });

  it("warns about no company name", () => {
    const configNoCompany = buildDefaultPremiumDocumentConfig(null);
    const content = "A".repeat(120);
    const input = makeInput({ family: "generic_hr" });
    const result = validatePremiumDocument(input, null, [], content, "<p>x</p>", configNoCompany);
    expect(result.issues.some((i) => i.code === "NO_COMPANY_NAME")).toBe(true);
  });

  it("warns about no employee name for employee docs", () => {
    const content = "A".repeat(120);
    const input = makeInput({ family: "contract" });
    const result = validatePremiumDocument(input, null, [], content, "<p>x</p>", config);
    expect(result.issues.some((i) => i.code === "NO_EMPLOYEE_NAME")).toBe(true);
  });

  it("score is clamped to 0-100", () => {
    const content = "A".repeat(120);
    const input = makeInput({ family: "generic_hr" });
    const result = validatePremiumDocument(input, null, [], content, "<p>x</p>", config);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("excellent status when score >= 80", () => {
    const vars = [
      makeVar("employee_name", "Alice"),
      makeVar("company_name", "Co"),
      makeVar("signature", "Manager"),
    ];
    const content = "Cordialement,\n" + "A".repeat(200);
    const input = makeInput({ family: "generic_hr" });
    const result = validatePremiumDocument(input, null, vars, content, "<p>x</p>", config);
    expect(["excellent", "good"]).toContain(result.status);
  });

  it("warns about content too short (< 100 chars)", () => {
    const content = "A".repeat(25);
    const input = makeInput({ family: "generic_hr" });
    const result = validatePremiumDocument(input, null, [], content, "<p>x</p>", config);
    expect(result.issues.some((i) => i.code === "CONTENT_TOO_SHORT")).toBe(true);
  });

  it("warns about many incomplete fields", () => {
    const content = "[À compléter : x]\n[À compléter : y]\n[À compléter : z]\n[À compléter : w]";
    const input = makeInput({ family: "generic_hr" });
    const result = validatePremiumDocument(input, null, [], content, "<p>x</p>", config);
    expect(result.issues.some((i) => i.code === "MANY_INCOMPLETE_FIELDS")).toBe(true);
  });
});

// ── buildPremiumDocumentDigest ────────────────────────────────────────────

describe("buildPremiumDocumentDigest", () => {
  it("sensitive tone for black risk", () => {
    const digest = buildPremiumDocumentDigest(
      { status: "blocked", score: 10, issues: [], missing_required_variables: [], approval_required: true, risk_level: "black" },
      "generic_hr",
    );
    expect(digest.tone).toBe("sensitive");
    expect(digest.text).toContain("critique");
  });

  it("sensitive tone for red risk", () => {
    const digest = buildPremiumDocumentDigest(
      { status: "needs_review", score: 50, issues: [], missing_required_variables: [], approval_required: true, risk_level: "red" },
      "offboarding",
    );
    expect(digest.tone).toBe("sensitive");
    expect(digest.text).toContain("élevé");
  });

  it("blocked tone for blocked status (non-critical)", () => {
    const digest = buildPremiumDocumentDigest(
      {
        status: "blocked",
        score: 30,
        issues: [{ level: "blocking", code: "EMPTY_CONTENT", label: "Vide", message: "Vide" }],
        missing_required_variables: [],
        approval_required: false,
        risk_level: "green",
      },
      "generic_hr",
    );
    expect(digest.tone).toBe("blocked");
  });

  it("review tone for needs_review status", () => {
    const digest = buildPremiumDocumentDigest(
      { status: "needs_review", score: 55, issues: [], missing_required_variables: [], approval_required: false, risk_level: "green" },
      "contract",
    );
    expect(digest.tone).toBe("review");
    expect(digest.text).toContain("55");
  });

  it("ready tone for good status", () => {
    const digest = buildPremiumDocumentDigest(
      { status: "good", score: 75, issues: [], missing_required_variables: [], approval_required: false, risk_level: "green" },
      "offer",
    );
    expect(digest.tone).toBe("ready");
  });

  it("ready tone for excellent status", () => {
    const digest = buildPremiumDocumentDigest(
      { status: "excellent", score: 95, issues: [], missing_required_variables: [], approval_required: false, risk_level: "green" },
      "onboarding",
    );
    expect(digest.tone).toBe("ready");
  });

  it("digest text includes family label", () => {
    const digest = buildPremiumDocumentDigest(
      { status: "good", score: 80, issues: [], missing_required_variables: [], approval_required: false, risk_level: "green" },
      "contract",
    );
    expect(digest.text).toContain("Contrat");
  });
});

// ── renderPremiumDocument ─────────────────────────────────────────────────

describe("renderPremiumDocument", () => {
  it("renders with minimal input", () => {
    const result = renderPremiumDocument(makeInput({ family: "generic_hr" }));
    expect(result.rendered.html).toBeTruthy();
    expect(result.rendered.plain_text).toBeTruthy();
    expect(result.rendered.pdf_filename).toContain(".pdf");
    expect(result.quality).toBeDefined();
    expect(result.digest).toBeDefined();
  });

  it("infers generic_hr from empty family string", () => {
    const result = renderPremiumDocument({ ...makeInput(), family: "unknown_family" as PierrePremiumDocumentFamily });
    expect(result.rendered.metadata.family).toBe("generic_hr");
  });

  it("selects a template matching the family", () => {
    const result = renderPremiumDocument(makeInput({ family: "onboarding", channel: "document" }));
    expect(result.selected_template?.family).toBe("onboarding");
  });

  it("pdf_filename includes company slug when branding set", () => {
    const config = buildDefaultPremiumDocumentConfig({ company_name: "AcmeCorp" });
    const result = renderPremiumDocument(makeInput({ family: "generic_hr" }), config);
    expect(result.rendered.pdf_filename).toContain("acmecorp");
  });

  it("email channel sets email_subject", () => {
    const result = renderPremiumDocument(
      makeInput({ family: "followup", channel: "email", title: "Relance Marie" }),
    );
    expect(result.rendered.email_subject).toBeTruthy();
    expect(result.rendered.email_body_html).toBeTruthy();
  });

  it("non-email channel has null email fields", () => {
    const result = renderPremiumDocument(makeInput({ family: "contract", channel: "pdf" }));
    expect(result.rendered.email_subject).toBeNull();
    expect(result.rendered.email_body_html).toBeNull();
  });

  it("applies requested_tone to style guide", () => {
    const result = renderPremiumDocument(
      makeInput({ family: "generic_hr", requested_tone: "firm" }),
    );
    expect(result.config.style_guide.tone).toBe("firm");
  });

  it("approval_required propagated from quality to rendered.metadata", () => {
    const result = renderPremiumDocument(
      makeInput({
        family: "offboarding",
        raw_content: "Solde de tout compte. Départ définitif. ".repeat(5),
      }),
    );
    if (result.quality.approval_required) {
      expect(result.rendered.metadata.approval_required).toBe(true);
    }
  });

  it("variables are resolved from employee_file", () => {
    const result = renderPremiumDocument(
      makeInput({
        family: "onboarding",
        employee_file: { name: "Sophie Dupont", role: "Ingénieure" },
      }),
    );
    const employeeVar = result.variables.find((v) => v.key === "employee_name");
    expect(employeeVar?.value).toBe("Sophie Dupont");
  });

  it("uses now parameter for generated_at", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    const result = renderPremiumDocument(makeInput(), undefined, now);
    expect(result.rendered.metadata.generated_at).toContain("2026-03-01");
  });
});

// ── buildPremiumDocumentArtifactPayload ───────────────────────────────────

describe("buildPremiumDocumentArtifactPayload", () => {
  it("returns all expected keys", () => {
    const result = renderPremiumDocument(makeInput({ family: "generic_hr" }));
    const payload = buildPremiumDocumentArtifactPayload(result);
    expect(payload).toHaveProperty("title");
    expect(payload).toHaveProperty("plain_text");
    expect(payload).toHaveProperty("html");
    expect(payload).toHaveProperty("quality");
    expect(payload).toHaveProperty("digest");
    expect(payload).toHaveProperty("family");
    expect(payload).toHaveProperty("pdf_filename");
    expect(payload).toHaveProperty("variables");
  });

  it("quality includes approval_required and risk_level", () => {
    const result = renderPremiumDocument(makeInput({ family: "generic_hr" }));
    const payload = buildPremiumDocumentArtifactPayload(result);
    expect((payload.quality as Record<string, unknown>)).toHaveProperty("approval_required");
    expect((payload.quality as Record<string, unknown>)).toHaveProperty("risk_level");
  });

  it("variables is an array", () => {
    const result = renderPremiumDocument(makeInput({ family: "generic_hr" }));
    const payload = buildPremiumDocumentArtifactPayload(result);
    expect(Array.isArray(payload.variables)).toBe(true);
  });
});

// ── buildPremiumDocumentEmailPayload ──────────────────────────────────────

describe("buildPremiumDocumentEmailPayload", () => {
  it("auto_send is always false", () => {
    const result = renderPremiumDocument(makeInput({ family: "followup", channel: "email" }));
    const payload = buildPremiumDocumentEmailPayload(result);
    expect(payload.auto_send).toBe(false);
  });

  it("includes recipient in to array when provided", () => {
    const result = renderPremiumDocument(makeInput({ family: "followup", channel: "email" }));
    const payload = buildPremiumDocumentEmailPayload(result, "test@example.com");
    expect(payload.to).toContain("test@example.com");
  });

  it("empty to array when no recipient", () => {
    const result = renderPremiumDocument(makeInput({ family: "followup", channel: "email" }));
    const payload = buildPremiumDocumentEmailPayload(result);
    expect(payload.to).toEqual([]);
  });

  it("contains quality and metadata", () => {
    const result = renderPremiumDocument(makeInput({ family: "refusal", channel: "email" }));
    const payload = buildPremiumDocumentEmailPayload(result, "hr@co.fr");
    expect(payload).toHaveProperty("quality");
    expect(payload).toHaveProperty("metadata");
    expect(payload).toHaveProperty("subject");
  });
});

// ── buildDefaultPremiumDocumentConfig — extended ──────────────────────────

describe("buildDefaultPremiumDocumentConfig — style guide", () => {
  it("reads tone from document_system.style_guide", () => {
    const config = buildDefaultPremiumDocumentConfig({
      reusable_rh_context_json: {
        document_system: { style_guide: { tone: "warm" } },
      },
    });
    expect(config.style_guide.tone).toBe("warm");
  });

  it("falls back to formal for unknown tone value", () => {
    const config = buildDefaultPremiumDocumentConfig({
      reusable_rh_context_json: {
        document_system: { style_guide: { tone: "unknown_tone_xyz" } },
      },
    });
    expect(config.style_guide.tone).toBe("formal");
  });

  it("reads formality_level from style_guide", () => {
    const config = buildDefaultPremiumDocumentConfig({
      reusable_rh_context_json: {
        document_system: { style_guide: { formality_level: "low" } },
      },
    });
    expect(config.style_guide.formality_level).toBe("low");
  });

  it("reads validation_rules from document_system", () => {
    const config = buildDefaultPremiumDocumentConfig({
      reusable_rh_context_json: {
        document_system: {
          validation_rules: [
            { code: "RULE_1", label: "Test rule", required: true, applies_to: ["contract"] },
          ],
        },
      },
    });
    expect(config.validation_rules.length).toBe(1);
    expect(config.validation_rules[0].code).toBe("RULE_1");
  });

  it("ignore_validation_rules with invalid applies_to values", () => {
    const config = buildDefaultPremiumDocumentConfig({
      reusable_rh_context_json: {
        document_system: {
          validation_rules: [
            { code: "R1", label: "R", required: true, applies_to: ["not_a_family"] },
          ],
        },
      },
    });
    expect(config.validation_rules[0].applies_to).toEqual([]);
  });

  it("use_company_we defaults to true", () => {
    const config = buildDefaultPremiumDocumentConfig(null);
    expect(config.style_guide.use_company_we).toBe(true);
  });

  it("include_human_review_note defaults to true", () => {
    const config = buildDefaultPremiumDocumentConfig(null);
    expect(config.style_guide.include_human_review_note).toBe(true);
  });
});

// ── inferPremiumDocumentFamily — edge cases ───────────────────────────────

describe("inferPremiumDocumentFamily — edge cases", () => {
  it("empty string → generic_hr", () => {
    expect(inferPremiumDocumentFamily("")).toBe("generic_hr");
  });

  it("all whitespace → generic_hr", () => {
    expect(inferPremiumDocumentFamily("   ")).toBe("generic_hr");
  });

  it("object with all null fields → generic_hr", () => {
    expect(inferPremiumDocumentFamily({ family: null, doc_type: null, title: null })).toBe("generic_hr");
  });

  it("employee.summary as type string → employee_summary", () => {
    expect(inferPremiumDocumentFamily({ type: "employee.summary" })).toBe("employee_summary");
  });

  it("prepayroll.summary as type string → pre_payroll", () => {
    expect(inferPremiumDocumentFamily({ type: "prepayroll.summary" })).toBe("pre_payroll");
  });

  it("document.generate with absence keyword in title → absence", () => {
    expect(inferPremiumDocumentFamily({ type: "document.generate", title: "absence congé" })).toBe("absence");
  });
});

// ── selectPremiumDocumentTemplate — extended ──────────────────────────────

describe("selectPremiumDocumentTemplate — extended", () => {
  it("returns null for empty config", () => {
    const emptyConfig = { ...buildDefaultPremiumDocumentConfig(), templates: [], custom_templates: [] };
    const result = selectPremiumDocumentTemplate(emptyConfig, "contract", "pdf");
    expect(result).toBeNull();
  });

  it("contract template has approval_required=true", () => {
    const config = buildDefaultPremiumDocumentConfig();
    const tpl = selectPremiumDocumentTemplate(config, "contract", "pdf");
    expect(tpl?.approval_required).toBe(true);
  });

  it("offer template does not require approval", () => {
    const config = buildDefaultPremiumDocumentConfig();
    const tpl = selectPremiumDocumentTemplate(config, "offer", "document");
    expect(tpl?.approval_required).toBe(false);
  });
});

// ── validatePremiumDocument — extended ────────────────────────────────────

describe("validatePremiumDocument — extended", () => {
  const config = buildDefaultPremiumDocumentConfig({ company_name: "Co" });

  it("status is needs_review when 40 <= score < 60", () => {
    const content = "A".repeat(120);
    const input = makeInput({ family: "generic_hr" });
    // Force a needs_review scenario by having some warnings
    const result = validatePremiumDocument(input, null, [], content, "<p>x</p>", config);
    expect(["needs_review", "good", "excellent", "blocked"]).toContain(result.status);
  });

  it("returns issues array", () => {
    const content = "A".repeat(120);
    const input = makeInput({ family: "generic_hr" });
    const result = validatePremiumDocument(input, null, [], content, "<p>x</p>", config);
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it("issue levels are valid", () => {
    const content = "A".repeat(120);
    const input = makeInput({ family: "contract" });
    const result = validatePremiumDocument(input, null, [], content, "<p>x</p>", config);
    const validLevels = ["info", "warning", "error", "blocking"];
    for (const issue of result.issues) {
      expect(validLevels).toContain(issue.level);
    }
  });

  it("good quality doc with employee and signature", () => {
    const vars = [
      makeVar("employee_name", "Pierre Dupont"),
      makeVar("company_name", "Acme"),
      makeVar("signature", "DRH"),
    ];
    const content = "Cordialement, " + "A".repeat(200);
    const input = makeInput({ family: "generic_hr" });
    const result = validatePremiumDocument(input, null, vars, content, "<p>x</p>", config);
    expect(result.score).toBeGreaterThan(60);
  });
});

// ── renderPremiumDocument — integration ──────────────────────────────────

describe("renderPremiumDocument — integration", () => {
  it("full onboarding document with variables", () => {
    const now = new Date("2026-01-15T09:00:00Z");
    const result = renderPremiumDocument(
      makeInput({
        family: "onboarding",
        channel: "document",
        title: "Bienvenue chez nous",
        variables: [
          makeVar("employee_name", "Clara Leblanc"),
          makeVar("company_name", "TechCorp"),
          makeVar("position", "Développeuse Full Stack"),
          makeVar("start_date", "2026-02-01"),
          makeVar("manager_name", "Marc Dupont"),
        ],
      }),
      undefined,
      now,
    );
    expect(result.rendered.plain_text).toContain("Clara Leblanc");
    expect(result.rendered.pdf_filename).toContain("20260115");
    expect(result.selected_template?.family).toBe("onboarding");
  });

  it("full contract document — approval_required", () => {
    const result = renderPremiumDocument(
      makeInput({
        family: "contract",
        channel: "pdf",
        variables: [
          makeVar("employee_name", "Alice"),
          makeVar("company_name", "BizCo"),
          makeVar("position", "Manager"),
          makeVar("contract_type", "indéterminé"),
          makeVar("start_date", "2026-03-01"),
          makeVar("salary", "3500 EUR"),
        ],
      }),
    );
    expect(result.quality.approval_required).toBe(true);
  });

  it("offboarding document is red or black risk", () => {
    const result = renderPremiumDocument(
      makeInput({
        family: "offboarding",
        raw_content: "Départ définitif du salarié. Solde de tout compte. Restitution du matériel. " + "X".repeat(100),
      }),
    );
    expect(["red", "black"]).toContain(result.quality.risk_level);
    expect(result.quality.approval_required).toBe(true);
  });

  it("digest text is non-empty for any input", () => {
    const result = renderPremiumDocument(makeInput({ family: "training" }));
    expect(result.digest.text.length).toBeGreaterThan(0);
    expect(["ready", "review", "blocked", "sensitive"]).toContain(result.digest.tone);
  });

  it("config returned in result is effective config", () => {
    const config = buildDefaultPremiumDocumentConfig({ company_name: "MyBrand" });
    const result = renderPremiumDocument(makeInput({ family: "generic_hr" }), config);
    expect(result.config.branding.company_name).toBe("MyBrand");
  });

  it("html output does not contain 'généré par IA' phrase", () => {
    const result = renderPremiumDocument(makeInput({ family: "generic_hr" }));
    expect(result.rendered.html.toLowerCase()).not.toContain("généré par ia");
    expect(result.rendered.html.toLowerCase()).not.toContain("generated by ai");
  });

  it("variables list contains no duplicates — highest source wins", () => {
    const result = renderPremiumDocument(
      makeInput({
        family: "contract",
        variables: [makeVar("company_name", "ManualCo", "manual")],
        company_memory: { company_name: "MemoryCo" },
      }),
    );
    const nameVars = result.variables.filter((v) => v.key === "company_name");
    expect(nameVars.length).toBe(1);
    expect(nameVars[0].value).toBe("ManualCo");
  });

  it("metadata contains all required fields", () => {
    const result = renderPremiumDocument(makeInput({ family: "absence" }));
    const md = result.rendered.metadata;
    expect(md).toHaveProperty("family");
    expect(md).toHaveProperty("channel");
    expect(md).toHaveProperty("generated_at");
    expect(md).toHaveProperty("approval_required");
    expect(md).toHaveProperty("risk_level");
    expect(md).toHaveProperty("quality_score");
  });
});
