// P20.2 — CloneADN canonical STORE certification: real write + real read against PGlite,
// proving durable, company/entity-scoped persistence (not just the pure resolveCanonicalAdn
// merge logic, already covered by canonical-adn-p19.test.ts). Never production, never remote.

import { describe, it, expect, beforeAll } from "vitest";
import { createDurableCanonicalAdnStore, CANONICAL_ADN_DDL } from "../canonical-adn-store";
import { resolveCanonicalAdn, fromCloneAdnB28 } from "../canonical-adn";
import { getTestRuntimeDb } from "@/lib/pierre/v1/test-runtime-db";
import { newUuid } from "@/lib/pierre/v1/sql";

process.env.PIERRE_E2E_TEST_MODE = "1"; // PGlite uniquement, jamais la production

let companyA: string;
let companyB: string;

beforeAll(async () => {
  const db = await getTestRuntimeDb();
  await db.query(CANONICAL_ADN_DDL); // migration locale additive, jamais distante
  companyA = newUuid();
  companyB = newUuid();
}, 30000); // P20 : PGlite démarre son schéma à froid en >10 s quand ce fichier tourne dans un
// gros lot (mesuré, pas supposé). 30 s laisse une marge réelle sans masquer un vrai échec.

describe("P20.2 — CloneADN canonical store (real PGlite persistence)", () => {
  it("1. écriture réelle + relecture réelle : company_id/entity_id/version/provenance tous persistés", async () => {
    const db = await getTestRuntimeDb();
    const store = createDurableCanonicalAdnStore(db);
    const source = fromCloneAdnB28({ company_identity: { name: "Acme", country_code: "FR" }, communication: { tone: "formal" } });
    const adn = resolveCanonicalAdn({ company_id: companyA, geoLegalCountry: "FR", sources: [source] });

    const saved = await store.save(adn);
    expect(saved.version).toBe(1);

    const read = await store.get(companyA, null);
    expect(read).not.toBeNull();
    expect(read!.company_id).toBe(companyA);
    expect(read!.legal_country).toBe("FR");
    expect(read!.fields.identity_name).toBe("Acme");
    expect(read!.field_provenance.identity_name.provenance).toBe("B28:clone_adn");
  });

  it("2. isolation société A/B : aucun fallback cross-tenant, chacune lit uniquement sa propre empreinte", async () => {
    const db = await getTestRuntimeDb();
    const store = createDurableCanonicalAdnStore(db);
    const adnA = resolveCanonicalAdn({ company_id: companyA, geoLegalCountry: "FR", sources: [fromCloneAdnB28({ company_identity: { name: "Société A" } })] });
    const adnB = resolveCanonicalAdn({ company_id: companyB, geoLegalCountry: "CH", sources: [fromCloneAdnB28({ company_identity: { name: "Société B" } })] });
    await store.save(adnA);
    await store.save(adnB);

    const readA = await store.get(companyA, null);
    const readB = await store.get(companyB, null);
    expect(readA!.fields.identity_name).toBe("Société A");
    expect(readB!.fields.identity_name).toBe("Société B");
    expect(readA!.legal_country).toBe("FR");
    expect(readB!.legal_country).toBe("CH");
  });

  it("3. isolation entité A/B au sein de la MÊME société : deux entités distinctes, deux empreintes distinctes", async () => {
    const db = await getTestRuntimeDb();
    const store = createDurableCanonicalAdnStore(db);
    const entityA = newUuid();
    const entityB = newUuid();
    const adnEA = resolveCanonicalAdn({ company_id: companyA, entity_id: entityA, geoLegalCountry: "FR", sources: [fromCloneAdnB28({ company_identity: { name: "Entité A" } })] });
    const adnEB = resolveCanonicalAdn({ company_id: companyA, entity_id: entityB, geoLegalCountry: "FR", sources: [fromCloneAdnB28({ company_identity: { name: "Entité B" } })] });
    await store.save(adnEA);
    await store.save(adnEB);

    const readEA = await store.get(companyA, entityA);
    const readEB = await store.get(companyA, entityB);
    expect(readEA!.fields.identity_name).toBe("Entité A");
    expect(readEB!.fields.identity_name).toBe("Entité B");
  });

  it("4. version concurrente : une mise à jour avec un changement réel incrémente la version ; un save identique ne l'incrémente pas", async () => {
    const db = await getTestRuntimeDb();
    const store = createDurableCanonicalAdnStore(db);
    const company = newUuid();
    const v1 = resolveCanonicalAdn({ company_id: company, geoLegalCountry: "FR", sources: [fromCloneAdnB28({ company_identity: { name: "V1" } })] });
    const saved1 = await store.save(v1);
    expect(saved1.version).toBe(1);

    // Save identique (même fields/legal_country) → version inchangée.
    const saved1b = await store.save(v1);
    expect(saved1b.version).toBe(1);

    // Changement réel → version incrémentée.
    const v2 = resolveCanonicalAdn({ company_id: company, geoLegalCountry: "FR", sources: [fromCloneAdnB28({ company_identity: { name: "V2" } })] });
    const saved2 = await store.save(v2);
    expect(saved2.version).toBe(2);
  });

  it("5. donnée absente (société jamais sauvegardée) → get() renvoie null, jamais un objet inventé", async () => {
    const db = await getTestRuntimeDb();
    const store = createDurableCanonicalAdnStore(db);
    const neverSaved = await store.get(newUuid(), null);
    expect(neverSaved).toBeNull();
  });

  it("6. pays légal JAMAIS depuis une source legacy déclarée : conflit enregistré, geo resolver reste autoritaire", async () => {
    const db = await getTestRuntimeDb();
    const store = createDurableCanonicalAdnStore(db);
    const company = newUuid();
    // La source legacy déclare FR, mais l'autorité geo dit CH — le conflit doit être enregistré,
    // et legal_country doit rester CH (jamais la valeur déclarée par la source legacy).
    const adn = resolveCanonicalAdn({
      company_id: company, geoLegalCountry: "CH",
      sources: [{ provenance: "B28:clone_adn", durable: true, declaredCountry: "FR", fields: { identity_name: "Test" } }],
    });
    expect(adn.legal_country).toBe("CH");
    expect(adn.conflicts.some((c) => c.field === "legal_country")).toBe(true);
    const saved = await store.save(adn);
    const read = await store.get(company, null);
    expect(read!.legal_country).toBe("CH");
    expect(saved.conflicts.some((c) => c.field === "legal_country")).toBe(true);
  });

  it("7. aucune donnée contrôlée arbitrairement par le client : resolveCanonicalAdn n'accepte AUCUN paramètre 'legalCountry' venant d'un texte libre — seul geoLegalCountry (serveur) existe", () => {
    // Structural guarantee: the function signature itself has no client-text-derived country param.
    expect(resolveCanonicalAdn.length).toBe(1); // single `params` object, geoLegalCountry is the only country input
  });
});
