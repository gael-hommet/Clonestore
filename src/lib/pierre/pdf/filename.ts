import { safeString } from "@/lib/pierre/utils";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function buildPierrePdfFilename(input: {
  title?: string | null;
  fallback?: string | null;
}) {
  const base =
    safeString(input.title) ||
    safeString(input.fallback) ||
    "document-pierre";

  const slug = slugify(base) || "document-pierre";

  return `${slug}.pdf`;
}