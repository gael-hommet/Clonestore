// src/lib/clonechat/openai/index.ts
// P9.4 — Couche OpenAI CloneChat (barrel). `client.ts` (répondeur réel) est
// server-only via import dynamique du SDK ; les autres modules sont client-safe.
export * from "./config";
export * from "./budget-gate";
export * from "./usage-accounting";
export * from "./tool-registry";
export * from "./structured-output";
export * from "./client";
export * from "./governed-turn";
export * from "./multimodal";
export * from "./screenshot";
