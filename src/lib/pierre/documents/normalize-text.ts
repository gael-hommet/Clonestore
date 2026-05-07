import { normalizeSpaces } from "@/lib/pierre/utils";

export function normalizePierreDocumentText(value: string) {
  return value
    .split("\n")
    .map((line) => normalizeSpaces(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}