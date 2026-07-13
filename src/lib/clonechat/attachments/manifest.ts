// src/lib/clonechat/attachments/manifest.ts
// C1.7 §10 — MANIFESTE DE PIÈCES JOINTES (pur, testable, sans réseau).
//
// Trois vérités que l'interface doit refléter, et que ce module rend structurelles :
//   · SÉLECTIONNER n'est pas TÉLÉVERSER ;
//   · TÉLÉVERSER n'est pas ANALYSER ;
//   · un fichier n'est « analysé » que lorsque le serveur l'a réellement analysé.
//
// Rien ici n'exécute quoi que ce soit : on classe, on borne, on refuse. Le SERVEUR reste
// l'autorité (il re-détecte le MIME par signature) ; cette validation client est un confort
// honnête qui évite d'envoyer ce qui sera de toute façon refusé.

export type AttachmentCategory = "image" | "pdf" | "document" | "spreadsheet" | "text" | "unsupported";

export type AttachmentState =
  | "selected"    // choisi, PAS encore envoyé
  | "validating"
  | "ready"       // prêt à partir avec le prochain message
  | "uploading"
  | "processing"
  | "analysed"    // le serveur l'a RÉELLEMENT analysé
  | "rejected"
  | "error";

export type RejectionCode =
  | "TYPE_UNSUPPORTED" | "EXECUTABLE_BLOCKED" | "ARCHIVE_BLOCKED"
  | "FILE_TOO_LARGE" | "BATCH_TOO_LARGE" | "TOO_MANY_FILES"
  | "FOLDER_TOO_DEEP" | "HIDDEN_FILE" | "EMPTY_FILE" | "EXTENSION_MISMATCH";

export interface AttachmentInput {
  readonly name: string;
  readonly mime: string;
  readonly size: number;
  /** Chemin RELATIF dans le dossier choisi (jamais un chemin absolu du disque). */
  readonly relativePath?: string;
}

export interface AttachmentEntry {
  readonly id: string;
  readonly displayName: string;
  readonly relativePath: string;
  readonly mime: string;
  readonly size: number;
  readonly category: AttachmentCategory;
  readonly state: AttachmentState;
  readonly rejection: { readonly code: RejectionCode; readonly message: string } | null;
}

// ── Bornes ───────────────────────────────────────────────────────────────────
export const MAX_FILE_BYTES = 20 * 1024 * 1024;      // 20 Mo par fichier
export const MAX_BATCH_BYTES = 60 * 1024 * 1024;     // 60 Mo au total
export const MAX_FILES = 20;
export const MAX_FOLDER_DEPTH = 6;

// ── Types réellement pris en charge (jamais une promesse creuse) ─────────────
const BY_EXT: Record<string, AttachmentCategory> = {
  png: "image", jpg: "image", jpeg: "image", webp: "image", gif: "image",
  pdf: "pdf",
  docx: "document", doc: "document", rtf: "document", odt: "document", pptx: "document", ppt: "document",
  xlsx: "spreadsheet", xls: "spreadsheet", csv: "spreadsheet",
  txt: "text", md: "text", json: "text", html: "text", xml: "text", ts: "text", js: "text", py: "text", sql: "text", yml: "text", yaml: "text",
};

/** Exécutables / archives : refusés catégoriquement. Rien n'est jamais exécuté ni décompressé. */
const EXECUTABLE_EXT = new Set(["exe", "dll", "bat", "cmd", "com", "msi", "sh", "app", "scr", "ps1", "vbs", "jar", "apk", "bin", "dmg"]);
const ARCHIVE_EXT = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso"]);

const MESSAGES: Record<RejectionCode, string> = {
  TYPE_UNSUPPORTED: "Format non pris en charge.",
  EXECUTABLE_BLOCKED: "Les exécutables ne sont jamais acceptés.",
  ARCHIVE_BLOCKED: "Les archives ne sont pas acceptées.",
  FILE_TOO_LARGE: "Fichier trop lourd (20 Mo maximum).",
  BATCH_TOO_LARGE: "L'ensemble dépasse 60 Mo.",
  TOO_MANY_FILES: `Maximum ${MAX_FILES} fichiers.`,
  FOLDER_TOO_DEEP: "Dossier trop profond.",
  HIDDEN_FILE: "Fichier masqué ou système ignoré.",
  EMPTY_FILE: "Fichier vide.",
  EXTENSION_MISMATCH: "L'extension ne correspond pas au contenu déclaré.",
};

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Nom d'affichage SÛR : jamais un chemin absolu, jamais de remontée de dossier. */
export function safeDisplayName(name: string): string {
  return name.split(/[\\/]/).pop()?.replace(/^\.+/, "") || "fichier";
}

/** Chemin relatif SÛR : `..` et racines absolues supprimés. */
export function safeRelativePath(path: string | undefined, fallbackName: string): string {
  if (!path) return safeDisplayName(fallbackName);
  const parts = path.split(/[\\/]/).filter((p) => p && p !== "." && p !== "..");
  // Une lettre de lecteur (« C: ») ou une racine ne doit jamais survivre.
  const cleaned = parts.filter((p) => !/^[a-z]:$/i.test(p));
  return cleaned.join("/") || safeDisplayName(fallbackName);
}

function isHidden(path: string): boolean {
  return path.split("/").some((p) => p.startsWith(".") || p === "__MACOSX" || p.toLowerCase() === "thumbs.db" || p.toLowerCase() === "desktop.ini");
}

export function categoryOf(name: string): AttachmentCategory {
  const ext = extensionOf(name);
  return BY_EXT[ext] ?? "unsupported";
}

/** Classe UN fichier isolément (hors contraintes de lot). */
export function classifyFile(input: AttachmentInput): { category: AttachmentCategory; rejection: { code: RejectionCode; message: string } | null } {
  const name = safeDisplayName(input.name);
  const ext = extensionOf(name);
  const rel = safeRelativePath(input.relativePath, name);

  const reject = (code: RejectionCode) => ({ category: "unsupported" as const, rejection: { code, message: MESSAGES[code] } });

  if (isHidden(rel)) return reject("HIDDEN_FILE");
  if (EXECUTABLE_EXT.has(ext)) return reject("EXECUTABLE_BLOCKED");
  if (ARCHIVE_EXT.has(ext)) return reject("ARCHIVE_BLOCKED");
  if (input.size <= 0) return reject("EMPTY_FILE");
  if (input.size > MAX_FILE_BYTES) return reject("FILE_TOO_LARGE");
  if (rel.split("/").length - 1 > MAX_FOLDER_DEPTH) return reject("FOLDER_TOO_DEEP");

  const category = categoryOf(name);
  if (category === "unsupported") return reject("TYPE_UNSUPPORTED");

  // Extension déguisée : « facture.pdf.exe » a déjà été bloqué ci-dessus ; ici on refuse une
  // extension d'image portant un MIME manifestement non-image (et réciproquement).
  const mime = (input.mime ?? "").toLowerCase();
  if (mime.startsWith("application/x-msdownload") || mime.startsWith("application/x-executable")) return reject("EXECUTABLE_BLOCKED");
  if (category === "image" && mime && !mime.startsWith("image/")) return reject("EXTENSION_MISMATCH");

  return { category, rejection: null };
}

/**
 * Construit le manifeste d'un LOT. Les fichiers refusés sont CONSERVÉS dans le manifeste, avec
 * leur motif : l'utilisateur doit VOIR ce qui a été écarté — un silence serait malhonnête.
 */
export function buildManifest(inputs: readonly AttachmentInput[], idFor: (i: number) => string = (i) => `att-${i + 1}`): AttachmentEntry[] {
  const out: AttachmentEntry[] = [];
  let acceptedCount = 0;
  let acceptedBytes = 0;

  inputs.forEach((input, i) => {
    const displayName = safeDisplayName(input.name);
    const relativePath = safeRelativePath(input.relativePath, input.name);
    const base = { id: idFor(i), displayName, relativePath, mime: input.mime, size: input.size };

    const { category, rejection } = classifyFile(input);
    if (rejection) {
      out.push({ ...base, category, state: "rejected", rejection });
      return;
    }
    if (acceptedCount >= MAX_FILES) {
      out.push({ ...base, category, state: "rejected", rejection: { code: "TOO_MANY_FILES", message: MESSAGES.TOO_MANY_FILES } });
      return;
    }
    if (acceptedBytes + input.size > MAX_BATCH_BYTES) {
      out.push({ ...base, category, state: "rejected", rejection: { code: "BATCH_TOO_LARGE", message: MESSAGES.BATCH_TOO_LARGE } });
      return;
    }
    acceptedCount += 1;
    acceptedBytes += input.size;
    // « selected » : choisi, mais RIEN n'a encore été envoyé ni analysé.
    out.push({ ...base, category, state: "selected", rejection: null });
  });

  return out;
}

export function manifestSummary(entries: readonly AttachmentEntry[]): {
  accepted: number; rejected: number; totalBytes: number; categories: Record<string, number>;
} {
  const accepted = entries.filter((e) => e.state !== "rejected");
  const categories: Record<string, number> = {};
  for (const e of accepted) categories[e.category] = (categories[e.category] ?? 0) + 1;
  return {
    accepted: accepted.length,
    rejected: entries.length - accepted.length,
    totalBytes: accepted.reduce((s, e) => s + e.size, 0),
    categories,
  };
}

/**
 * Détail visuel d'une image : ÉCONOMIQUE par défaut (§10B). Le détail fin coûte cher — il n'est
 * justifié que lorsque la question porte réellement sur du texte fin, un graphique ou un schéma.
 */
const FINE_DETAIL_HINT = /\b(petit|fin|illisible|zoom|lis|lire|texte|chiffre|montant|graphique|courbe|diagramme|schéma|tableau|capture|écran)\b/iu;

export function imageDetailFor(question: string): "low" | "high" {
  return FINE_DETAIL_HINT.test(question ?? "") ? "high" : "low";
}
