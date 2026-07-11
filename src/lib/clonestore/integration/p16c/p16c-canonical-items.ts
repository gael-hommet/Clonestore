// src/lib/clonestore/integration/p16c/p16c-canonical-items.ts
// P16C — les 10 items d'intégration CANONIQUES, RÉCUPÉRÉS de la source réelle : la catégorie C
// (INTEGRATION) du P16_MASTER_SPLIT (P16.0) + la table des 10 adaptateurs du plan canonique
// (P16C_PIERRE_TECHNOLOGIES_INTEGRATION_PLAN.md). On ne redéclare JAMAIS l'ensemble : getIntegrationItems()
// est la source de vérité et crossCheckCanonicalIntegrationItems() échoue si ce module dérive. Chaque item
// porte les métadonnées P16C : couche source → couche destination, technologies T1/T2 réellement résolues,
// exigence de gouvernance, dépendance externe/live. Aucune invention, aucune omission.

import {
  getIntegrationItems, itemById, type P16Item,
} from "@/lib/clonestore/ultimate/p16-master-split";
import { getTechnologyRegistryEntry } from "@/lib/clonestore/technologies/t1";
import { getProductTechnologyRegistryEntry } from "@/lib/clonestore/product-technologies/t2/product-technology-registry";
import type { TechnologyId } from "@/lib/clonestore/technologies/t1";
import type { ProductTechnologyId } from "@/lib/clonestore/product-technologies/t2";
import type { P16CCanonicalIntegrationId, P16CIntegrationStatus } from "./p16c-types";

export interface P16CItemMeta {
  readonly id: P16CCanonicalIntegrationId;      // MUST match a P16_MASTER_SPLIT integration id
  readonly title: string;                       // canonical adapter title (plan doc)
  readonly sourceLayer: "pierre";               // Pierre déclare le besoin (P16A)
  readonly destinationLayer: "t1" | "t1_t2";    // technologie(s) consommée(s)
  readonly t1: readonly TechnologyId[];          // technologies T1 réelles résolues par cet adaptateur
  readonly t2: readonly ProductTechnologyId[];   // product-technologies T2 réelles résolues
  readonly governanceRequirement: string;        // ce que P16C garantit avant tout usage
  readonly externalDependency: string | null;    // blocage live/externe (jamais levé par P16C)
  readonly expectedStatus: P16CIntegrationStatus; // niveau visé (dérivé du master split)
}

// P16C metadata, keyed by the canonical master-split integration id. The SET of keys is asserted equal to
// the real master-split integration ids by crossCheckCanonicalIntegrationItems() — no invention/omission.
const META: Readonly<Record<P16CCanonicalIntegrationId, Omit<P16CItemMeta, "id">>> = {
  "int.document_adapter": {
    title: "PierreDocumentTechAdapter",
    sourceLayer: "pierre", destinationLayer: "t1_t2",
    t1: ["document", "export"], t2: ["cloneadn", "clonereview", "clonebrief"],
    governanceRequirement: "Document préparé localement ; validation humaine obligatoire ; aucune garantie légale.",
    externalDependency: null,
    expectedStatus: "integrated_local_safe",
  },
  "int.mail_adapter": {
    title: "PierreMailTechAdapter",
    sourceLayer: "pierre", destinationLayer: "t1",
    t1: ["mail"], t2: [],
    governanceRequirement: "Brouillon préparé ; « préparé » ne devient JAMAIS « envoyé » ; envoi live bloqué.",
    externalDependency: "Domaine/provider email live non vérifié — envoi bloqué.",
    expectedStatus: "integrated_local_safe",
  },
  "int.calendar_adapter": {
    title: "PierreCalendarTechAdapter",
    sourceLayer: "pierre", destinationLayer: "t1",
    t1: ["calendar"], t2: [],
    governanceRequirement: "Événement préparé ; action provider live bloquée ; l'humain copie/valide.",
    externalDependency: "Provider calendrier live indisponible.",
    expectedStatus: "integrated_local_safe",
  },
  "int.signature_adapter": {
    title: "PierreSignatureTechAdapter",
    sourceLayer: "pierre", destinationLayer: "t1",
    t1: ["signature"], t2: [],
    governanceRequirement: "Paquet de signature préparé (circuit manuel) ; « préparé » ≠ « signé » ; Yousign live bloqué.",
    externalDependency: "Signature live (Yousign P8.7.4) bloquée — fallback préparé.",
    expectedStatus: "integrated_local_safe",
  },
  "int.voice_adapter": {
    title: "PierreVoiceTechAdapter",
    sourceLayer: "pierre", destinationLayer: "t1_t2",
    t1: ["voice"], t2: ["clonevoice"],
    governanceRequirement: "Entrée texte AUTORITAIRE ; aucun audio traité ; aucune revendication voix live.",
    externalDependency: "Aucun provider vocal vérifié — voix live bloquée (roadmap).",
    expectedStatus: "architecture_ready",
  },
  "int.notification_adapter": {
    title: "PierreNotificationTechAdapter",
    sourceLayer: "pierre", destinationLayer: "t1_t2",
    t1: ["notification"], t2: ["clonesignals"],
    governanceRequirement: "Rappel cockpit préparé ; « rappel créé » ≠ « push délivré » ; push live bloqué.",
    externalDependency: "Aucun provider push — rappels cockpit uniquement.",
    expectedStatus: "integrated_local_safe",
  },
  "int.analytics_adapter": {
    title: "PierreAnalyticsTechAdapter",
    sourceLayer: "pierre", destinationLayer: "t1",
    t1: ["analytics"], t2: [],
    governanceRequirement: "Métriques locales préparées ; ROI = ESTIMATION (jamais garanti) ; calcul réel via analytics.compute (RLS).",
    externalDependency: null,
    expectedStatus: "integrated_local_safe",
  },
  "int.evidence_adapter": {
    title: "PierreEvidenceTechAdapter",
    sourceLayer: "pierre", destinationLayer: "t1_t2",
    t1: ["evidence"], t2: ["clonetrace"],
    governanceRequirement: "Trace/preuve d'audit disponible pour toute action (même fallback) ; provenance préservée ; aucun secret.",
    externalDependency: null,
    expectedStatus: "integrated_local_safe",
  },
  "int.workflow_adapter": {
    title: "PierreWorkflowTechAdapter",
    sourceLayer: "pierre", destinationLayer: "t1_t2",
    t1: ["workflow"], t2: ["cloneos", "clonecontinuum"],
    governanceRequirement: "Orchestration générique (CloneOS) ; NE décide JAMAIS d'issue RH ; le raisonnement RH reste V1.",
    externalDependency: null,
    expectedStatus: "integrated_local_safe",
  },
  "int.permission_adapter": {
    title: "PierrePermissionTechAdapter",
    sourceLayer: "pierre", destinationLayer: "t1_t2",
    t1: ["permission"], t2: ["clonepolicy", "cloneguard", "clonetrust"],
    governanceRequirement: "Décision de permission fail-closed ; complète (jamais ne remplace) RLS + requireCompanyUser.",
    externalDependency: null,
    expectedStatus: "integrated_local_safe",
  },
};

/** The canonical 10 integration items (master split rows) joined with P16C metadata. Recovered, never invented. */
export function canonicalIntegrationItems(): ReadonlyArray<{ item: P16Item; meta: P16CItemMeta }> {
  return getIntegrationItems().map((item) => {
    const m = META[item.id as P16CCanonicalIntegrationId];
    if (!m) throw new Error(`P16C: no metadata for canonical integration item "${item.id}" — recovery drift.`);
    return { item, meta: { id: item.id as P16CCanonicalIntegrationId, ...m } };
  });
}

export function canonicalIntegrationItemIds(): P16CCanonicalIntegrationId[] {
  return getIntegrationItems().map((i) => i.id as P16CCanonicalIntegrationId);
}

export function metaForIntegrationItem(id: string): P16CItemMeta | undefined {
  const m = META[id as P16CCanonicalIntegrationId];
  return m ? { id: id as P16CCanonicalIntegrationId, ...m } : undefined;
}

export type P16CRecoveryCrossCheck = {
  readonly ok: boolean;
  readonly masterSplitCount: number;
  readonly recoveredCount: number;
  readonly missing: string[];    // in master split but not covered by P16C meta (silent omission)
  readonly invented: string[];   // in P16C meta but not in master split (invention)
  readonly technologyDrift: string[]; // a declared T1/T2 id not present in the real registry
  readonly issues: string[];
};

/** Fail-closed cross-check: P16C meta keys === master-split integration ids, and every declared T1/T2 id
 *  resolves against the REAL registry (no invented technology). Pure. */
export function crossCheckCanonicalIntegrationItems(): P16CRecoveryCrossCheck {
  const masterIds = new Set(getIntegrationItems().map((i) => i.id));
  const metaIds = new Set(Object.keys(META));
  const missing = [...masterIds].filter((id) => !metaIds.has(id));
  const invented = [...metaIds].filter((id) => !masterIds.has(id) || !itemById(id));

  const technologyDrift: string[] = [];
  for (const [id, m] of Object.entries(META)) {
    for (const t1 of m.t1) {
      if (!getTechnologyRegistryEntry(t1)) technologyDrift.push(`${id}: T1 « ${t1} » absent du registre réel.`);
    }
    for (const t2 of m.t2) {
      if (!getProductTechnologyRegistryEntry(t2)) technologyDrift.push(`${id}: T2 « ${t2} » absent du registre réel.`);
    }
  }

  const issues: string[] = [];
  if (missing.length) issues.push(`Items du master split non couverts par P16C : ${missing.join(", ")}`);
  if (invented.length) issues.push(`Items P16C absents du master split (inventés) : ${invented.join(", ")}`);
  issues.push(...technologyDrift);

  return {
    ok: missing.length === 0 && invented.length === 0 && technologyDrift.length === 0,
    masterSplitCount: masterIds.size,
    recoveredCount: metaIds.size,
    missing, invented, technologyDrift, issues,
  };
}
