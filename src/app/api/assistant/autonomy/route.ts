// src/app/api/assistant/autonomy/route.ts
// P9.5 — Réglage d'AUTONOMIE de Pierre pour l'entreprise (surface produit CloneStore).
//   GET  → mode courant (dérivé de la colonne P8 default_autonomy_mode) + les 5 modes produit +
//          la matrice « ce que Pierre fait seul / valide / réservé humain » DÉRIVÉE de decideValidation.
//   POST → { productModeId } : le SERVEUR mappe le mode PRODUIT → mode MOTEUR P8 (jamais l'inverse ;
//          le client ne fournit pas de mode moteur), puis PATCH la colonne P8 company (version-checkée).
// Source de vérité UNIQUE = la colonne P8 (consommée via l'API V1). AUCUN 2e cerveau, AUCUNE
// réimplémentation de logique RH. P8 impose la permission d'écriture (PATCH /company gouverné) →
// pas d'escalade d'autonomie forgée côté client. no-store.

import { requireCompanyUser, ccNoStore } from "@/lib/clonechat/server/auth";
import { buildV1Ctx, readCompanyAutonomyV1, patchCompanyAutonomyV1 } from "@/lib/clonechat/server/v1-loopback";
import {
  PRODUCT_AUTONOMY_MODES, deriveAutonomyMatrix, engineModeFor, productModeForEngine, getProductMode,
  isProductModeId, BUCKET_LABEL, PIERRE_PRODUCT_FRAMING, type ProductAutonomyModeId,
} from "@/lib/clonestore/pierre-autonomy/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function modesView() {
  return PRODUCT_AUTONOMY_MODES.map((m) => ({ id: m.id, label: m.label, tagline: m.tagline, description: m.description, engineMode: m.engineMode, supervisor: m.supervisor, order: m.order }));
}
function matrixView(id: ProductAutonomyModeId) {
  const mtx = deriveAutonomyMatrix(id);
  return { productModeId: mtx.productModeId, engineMode: mtx.engineMode, supervisor: mtx.supervisor, entries: mtx.entries.map((e) => ({ key: e.key, label: e.label, decision: e.decision, bucket: e.bucket, bucketLabel: BUCKET_LABEL[e.bucket] })) };
}

export async function GET(req: Request) {
  const auth = await requireCompanyUser(req);
  if ("error" in auth) return auth.error;
  const { companyId } = auth.identity;
  const v1 = buildV1Ctx(req, companyId);
  const c = await readCompanyAutonomyV1(v1);
  // GRACIEUX : les modes + la matrice (dérivés du moteur) sont TOUJOURS renvoyés (pédagogique).
  // `current` + `companyResolved` ne sont posés que si l'entreprise est résolue (sinon défaut 'validation',
  // et l'écriture reste bloquée côté serveur tant qu'il n'y a pas d'entreprise).
  const engineMode = c?.engineMode ?? "normal";
  const current = productModeForEngine(engineMode);
  return ccNoStore({
    ok: true, framing: PIERRE_PRODUCT_FRAMING, companyResolved: !!c,
    current: { productModeId: current.id, engineMode, version: c?.version ?? 0 },
    modes: modesView(), matrix: matrixView(current.id),
  });
}

export async function POST(req: Request) {
  const auth = await requireCompanyUser(req);
  if ("error" in auth) return auth.error;
  const { companyId } = auth.identity;
  const body = (await req.json().catch(() => null)) as { productModeId?: string } | null;
  const productModeId = body?.productModeId;
  if (!isProductModeId(productModeId)) return ccNoStore({ ok: false, code: "BAD_MODE", error: "Mode d'autonomie inconnu." }, 400);

  // Le SERVEUR mappe le mode PRODUIT → mode MOTEUR P8 (validé). Le client ne peut pas forger un mode moteur.
  const engineMode = engineModeFor(productModeId as ProductAutonomyModeId);
  const v1 = buildV1Ctx(req, companyId);

  // Version optimiste : lit la version courante puis PATCH ; un 409 (concurrence) → relit + réessaie une fois.
  let cur = await readCompanyAutonomyV1(v1);
  if (!cur) return ccNoStore({ ok: false, code: "COMPANY_UNAVAILABLE" }, 503);
  let res = await patchCompanyAutonomyV1(v1, engineMode, cur.version);
  if (!res.ok && res.status === 409) { cur = await readCompanyAutonomyV1(v1); if (cur) res = await patchCompanyAutonomyV1(v1, engineMode, cur.version); }
  if (!res.ok) {
    // 403 = permission insuffisante (P8 gouverne l'écriture) → pas d'escalade possible côté client.
    const code = res.status === 403 ? "FORBIDDEN" : res.status === 409 ? "VERSION_CONFLICT" : "PATCH_FAILED";
    const msg = res.status === 403 ? "Votre rôle ne permet pas de changer le niveau d'autonomie de Pierre." : "Le réglage n'a pas pu être enregistré. Réessayez.";
    return ccNoStore({ ok: false, code, error: msg }, res.status === 403 ? 403 : res.status === 409 ? 409 : 502);
  }
  // Écho du mode PRODUIT demandé quand son mode moteur correspond à celui appliqué (ex. « dirigeant »
  // partage enterprise_autonomous avec « governed » : on garde le choix de l'utilisateur juste après
  // l'enregistrement). NB : au rechargement, la colonne P8 ne stocke que le mode MOTEUR → enterprise_autonomous
  // se réaffiche en « governed » (présentation canonique) ; documenté.
  const engineApplied = res.engineMode ?? engineMode;
  const applied = engineModeFor(productModeId as ProductAutonomyModeId) === engineApplied ? (getProductMode(productModeId as ProductAutonomyModeId) ?? productModeForEngine(engineApplied)) : productModeForEngine(engineApplied);
  return ccNoStore({ ok: true, current: { productModeId: applied.id, engineMode: engineApplied, version: res.version }, matrix: matrixView(applied.id) });
}
