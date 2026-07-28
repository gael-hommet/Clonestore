// generate-corpus.gen.ts — NON un test de vérification : un GÉNÉRATEUR exécuté via vitest pour
// réutiliser sa résolution d'alias `@` déjà éprouvée (voir vitest.config.ts). Actif uniquement
// sous CLONECHAT_GENERATE_CORPUS=1 (jamais dans une exécution normale de la suite de tests).
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { corpus } from "../knowledge-corpus";

const ACTIVE = process.env.CLONECHAT_GENERATE_CORPUS === "1";
const describeIfActive = ACTIVE ? describe : describe.skip;
const OUT_DIR = "audit-clonechat-unified/corpus";
const REQUIRED_CATEGORIES = [
  "identity", "employees", "pierre_capabilities", "pricing", "faq",
  "technologies", "security_governance", "data_privacy", "support", "missions",
];

// Les 6 registres réels dont le corpus dérive (voir knowledge-corpus.ts, en-tête). Un hash par
// fichier source donne une preuve de fraîcheur/traçabilité même sans numéro de version explicite
// dans le code produit — si un registre change, son hash change, donc celui du manifeste aussi.
const SOURCE_REGISTRIES = [
  "src/lib/clonestore/pricing/country-pricing.ts",
  "src/lib/catalog/public-catalog.ts",
  "src/lib/demo/presentation/commercial-state.ts",
  "src/lib/nav/route-registry.ts",
  "src/lib/clonestore/technologies/registry.ts",
  "src/lib/pierre/v1/hr-canon/capability-registry.ts",
];

function readGitHeadSha(): string | null {
  try {
    const headRef = readFileSync(".git/HEAD", "utf8").trim();
    const m = headRef.match(/^ref:\s*(.+)$/);
    if (!m) return headRef || null; // HEAD détaché : contient directement le SHA
    const refPath = `.git/${m[1]}`;
    if (existsSync(refPath)) return readFileSync(refPath, "utf8").trim();
    return null;
  } catch {
    return null;
  }
}

describeIfActive("CloneChat Unified — génération du corpus (script, pas une vérification produit)", () => {
  it("écrit corpus.json + manifest.json depuis le module runtime réel", () => {
    const units = corpus();
    const byCategory: Record<string, number> = {};
    for (const u of units) byCategory[u.category] = (byCategory[u.category] ?? 0) + 1;

    const missing = REQUIRED_CATEGORIES.filter((c) => !byCategory[c]);
    expect(missing, `catégories obligatoires absentes: ${missing.join(", ")}`).toEqual([]);

    const contentHash = createHash("sha256").update(JSON.stringify(units)).digest("hex").slice(0, 16);
    const sourceRegistryVersions: Record<string, string> = {};
    for (const f of SOURCE_REGISTRIES) {
      try {
        sourceRegistryVersions[f] = createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 12);
      } catch {
        sourceRegistryVersions[f] = "UNREADABLE";
      }
    }
    const manifest = {
      generatedAt: new Date().toISOString(),
      sourceCommitSha: readGitHeadSha(),
      unitCount: units.length,
      categories: byCategory,
      corpusHash: contentHash,
      contentHash, // conservé pour compatibilité avec les lecteurs existants
      sourceRegistryVersions,
      requiredCategoriesPresent: REQUIRED_CATEGORIES,
    };

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(`${OUT_DIR}/corpus.json`, JSON.stringify(units, null, 2));
    writeFileSync(`${OUT_DIR}/manifest.json`, JSON.stringify(manifest, null, 2));
    console.log(`CORPUS_OK units=${units.length} categories=${Object.keys(byCategory).length} hash=${contentHash} sha=${manifest.sourceCommitSha}`);
  });
});
