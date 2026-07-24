// generate-corpus.gen.ts — NON un test de vérification : un GÉNÉRATEUR exécuté via vitest pour
// réutiliser sa résolution d'alias `@` déjà éprouvée (voir vitest.config.ts). Actif uniquement
// sous CLONECHAT_GENERATE_CORPUS=1 (jamais dans une exécution normale de la suite de tests).
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { corpus } from "../knowledge-corpus";

const ACTIVE = process.env.CLONECHAT_GENERATE_CORPUS === "1";
const describeIfActive = ACTIVE ? describe : describe.skip;
const OUT_DIR = "audit-clonechat-unified/corpus";
const REQUIRED_CATEGORIES = [
  "identity", "employees", "pierre_capabilities", "pricing", "faq",
  "technologies", "security_governance", "data_privacy", "support", "missions",
];

describeIfActive("CloneChat Unified — génération du corpus (script, pas une vérification produit)", () => {
  it("écrit corpus.json + manifest.json depuis le module runtime réel", () => {
    const units = corpus();
    const byCategory: Record<string, number> = {};
    for (const u of units) byCategory[u.category] = (byCategory[u.category] ?? 0) + 1;

    const missing = REQUIRED_CATEGORIES.filter((c) => !byCategory[c]);
    expect(missing, `catégories obligatoires absentes: ${missing.join(", ")}`).toEqual([]);

    const contentHash = createHash("sha256").update(JSON.stringify(units)).digest("hex").slice(0, 16);
    const manifest = {
      generatedAt: new Date().toISOString(),
      unitCount: units.length,
      categories: byCategory,
      contentHash,
      requiredCategoriesPresent: REQUIRED_CATEGORIES,
    };

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(`${OUT_DIR}/corpus.json`, JSON.stringify(units, null, 2));
    writeFileSync(`${OUT_DIR}/manifest.json`, JSON.stringify(manifest, null, 2));
    // eslint-disable-next-line no-console
    console.log(`CORPUS_OK units=${units.length} categories=${Object.keys(byCategory).length} hash=${contentHash}`);
  });
});
