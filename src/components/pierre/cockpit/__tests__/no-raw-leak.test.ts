// P9.3 — Garde-fou : les composants du cockpit client ne doivent JAMAIS afficher
// de JSON brut, de request/provider IDs, de hash, de payload ou de nom de table.
// Scan statique des sources de vues (présentation). Les mappers défensifs
// (client-cockpit) LISENT des champs bruts — c'est leur rôle — et ne sont pas ici.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const DIR = resolve(process.cwd(), "src/components/pierre/cockpit");

function viewFiles(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith(".tsx"));
}

const FORBIDDEN: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /JSON\.stringify\s*\(/, label: "JSON brut (JSON.stringify)" },
  { pattern: /request_id|requestId/, label: "request id" },
  { pattern: /trace_reference/, label: "trace reference" },
  { pattern: /payload_json/, label: "payload brut" },
  { pattern: /provider_request|provider_id/, label: "provider id" },
  { pattern: /pierre_rt_|pierre_missions|pierre_tasks|pierre_company_memory/, label: "nom de table" },
  { pattern: /\.metadata\b/, label: "metadata brute" },
];

describe("cockpit — aucune fuite technique dans les vues", () => {
  const files = viewFiles();

  it("des composants de vue existent", () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(FORBIDDEN)("aucun composant n'expose : $label", ({ pattern }) => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(resolve(DIR, f), "utf8");
      if (pattern.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it("affiche des libellés humains français (au moins un composant avec 'mission' humaine)", () => {
    const overview = readFileSync(resolve(DIR, "OverviewView.tsx"), "utf8");
    expect(overview).toContain("Pierre n'a aucune mission active");
  });
});
