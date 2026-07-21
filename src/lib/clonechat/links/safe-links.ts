// src/lib/clonechat/links/safe-links.ts
// C1.8 FINAL §7 — LIENS CLIQUABLES, ET SÛRS. Module PUR (aucun React) : donc testable seul.
//
// Défaut reproduit : à « Donne-moi le lien direct. », CloneChat répondait
//     « Les pages clés : /demo (démo), /agents/pierre (produit), /reserver/pierre … »
// …en TEXTE BRUT. Le client voyait une adresse, mais ne pouvait pas cliquer. La route renvoyait
// pourtant déjà `relevantLinks` et `suggestedCTA` — l'interface ne les lisait simplement jamais.
//
// RÈGLE CARDINALE : on ne rend cliquable QUE ce qui est PROUVÉ. Une route absente du registre
// canonique n'est pas transformée en lien : elle reste du texte. Un lien mort est pire qu'un
// texte brut — et une route inventée par le modèle ne doit jamais devenir un lien cliquable.

import { getRouteEntry, routeLabel } from "@/lib/nav/route-registry";

export type LinkSegment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "internal"; readonly href: string; readonly label: string }
  | { readonly kind: "external"; readonly href: string; readonly label: string };

/** Hôtes externes autorisés. Tout le reste reste du TEXTE — jamais un lien. */
const EXTERNAL_ALLOWLIST: ReadonlySet<string> = new Set([
  "clonestore.pro", "www.clonestore.pro",
]);

/**
 * Un schéma dangereux ne devient JAMAIS un lien : `javascript:`, `data:`, `vbscript:`,
 * et leurs déguisements (espaces, tabulations, retours ligne, casse).
 */
export function isDangerousHref(raw: string): boolean {
  const s = raw.replace(/[\s\u0000-\u001f\u007f-]/g, "").toLowerCase();
  return s.startsWith("javascript:") || s.startsWith("data:") || s.startsWith("vbscript:") || s.startsWith("file:");
}

/** Une route interne n'est cliquable que si le REGISTRE la connaît. Sinon : texte. */
export function isKnownInternalRoute(path: string): boolean {
  const clean = path.split("?")[0].split("#")[0];
  return getRouteEntry(clean) !== null;
}

export function internalLabelFor(path: string): string {
  const clean = path.split("?")[0].split("#")[0];
  return routeLabel(clean, clean);
}

function externalOk(href: string): boolean {
  if (isDangerousHref(href)) return false;
  try {
    const u = new URL(href);
    return u.protocol === "https:" && EXTERNAL_ALLOWLIST.has(u.hostname);
  } catch { return false; }
}

// [libellé](/route) ─ lien markdown
const MD_LINK = /\[([^\]\n]{1,80})\]\(([^)\s]{1,300})\)/g;
// /route interne nue (lettres, chiffres, tirets, slashes) — bornée
const BARE_ROUTE = /(?<![\w/])(\/[a-z0-9][a-z0-9\-/]{1,60})/gi;
// URL https nue
const BARE_URL = /(https:\/\/[^\s<>()]{4,200})/gi;

interface Hit { start: number; end: number; seg: LinkSegment }

/**
 * Découpe un texte en segments rendus. AUCUN HTML n'est produit ici : la couche React reçoit des
 * données, jamais du balisage. Il est donc structurellement impossible d'injecter du HTML ou du
 * JavaScript par la réponse du modèle.
 */
export function parseSafeLinks(input: string): readonly LinkSegment[] {
  const text = input ?? "";
  if (text.length === 0) return [];

  const hits: Hit[] = [];

  for (const m of text.matchAll(MD_LINK)) {
    const [, label, href] = m;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (isDangerousHref(href)) {
      // Lien markdown hostile : on garde le LIBELLÉ en texte, on jette la cible.
      hits.push({ start, end, seg: { kind: "text", text: label } });
    } else if (href.startsWith("/") && isKnownInternalRoute(href)) {
      hits.push({ start, end, seg: { kind: "internal", href, label } });
    } else if (externalOk(href)) {
      hits.push({ start, end, seg: { kind: "external", href, label } });
    } else {
      hits.push({ start, end, seg: { kind: "text", text: label } });
    }
  }

  const overlaps = (s: number, e: number) => hits.some((h) => s < h.end && e > h.start);

  for (const m of text.matchAll(BARE_ROUTE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (overlaps(start, end)) continue;
    const href = m[1];
    // Route INCONNUE du registre ⇒ reste du texte. On ne fabrique jamais un lien mort.
    if (isKnownInternalRoute(href)) {
      // §7 — « un lien a un libellé humain VISIBLE ». Une adresse nue n'est pas un libellé :
      // on affiche le nom que le REGISTRE donne à la page (« Réserver Pierre »), pas « /reserver/pierre ».
      hits.push({ start, end, seg: { kind: "internal", href, label: internalLabelFor(href) } });
    }
  }

  for (const m of text.matchAll(BARE_URL)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (overlaps(start, end)) continue;
    const href = m[1];
    if (externalOk(href)) hits.push({ start, end, seg: { kind: "external", href, label: href } });
  }

  hits.sort((a, b) => a.start - b.start);

  const out: LinkSegment[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start < cursor) continue;
    if (h.start > cursor) out.push({ kind: "text", text: text.slice(cursor, h.start) });
    out.push(h.seg);
    cursor = h.end;
  }
  if (cursor < text.length) out.push({ kind: "text", text: text.slice(cursor) });

  return Object.freeze(out.filter((s) => s.kind !== "text" || s.text.length > 0));
}

/** Normalise les liens renvoyés par la route en cartes cliquables VÉRIFIÉES. */
export function validatedLinks(
  raw: ReadonlyArray<{ route?: string; href?: string; label?: string }> | null | undefined,
): ReadonlyArray<{ id: string; href: string; label: string; internal: boolean }> {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Array<{ id: string; href: string; label: string; internal: boolean }> = [];
  for (const r of raw) {
    const href = (r?.route ?? r?.href ?? "").trim();
    if (!href || isDangerousHref(href) || seen.has(href)) continue;
    if (href.startsWith("/")) {
      if (!isKnownInternalRoute(href)) continue; // jamais une route inventée
      seen.add(href);
      out.push({ id: `lnk${out.length}`, href, label: (r?.label ?? "").trim() || internalLabelFor(href), internal: true });
    } else if (externalOk(href)) {
      seen.add(href);
      out.push({ id: `lnk${out.length}`, href, label: (r?.label ?? "").trim() || href, internal: false });
    }
  }
  return Object.freeze(out.slice(0, 6));
}
