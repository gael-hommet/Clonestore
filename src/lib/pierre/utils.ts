export function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function detectEmailInText(input: string) {
  const match = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return match?.[0] || "";
}

export function containsAny(text: string, needles: string[]) {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

export function buildJsonResponse<T extends Record<string, unknown>>(status: number, body: T) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}