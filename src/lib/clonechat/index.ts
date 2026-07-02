// src/lib/clonechat/index.ts
// P9.4 — CloneChat couche cliente pure (barrel). Client-safe, testable node.
export * from "./types";
export * from "./intent";
export * from "./action-policy";
export * from "./context-boundary";
export * from "./engine";
// NB: le cerveau de connaissance (src/lib/clonechat/knowledge/**) est SERVER-ONLY (il
// lit le canon P8 en lecture seule) — il n'est PAS réexporté ici pour rester hors du
// bundle client. Les modules serveur l'importent via "@/lib/clonechat/knowledge".
export * from "./bug-memory";
export * from "./tool-executor";
