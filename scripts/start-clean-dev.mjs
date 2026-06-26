#!/usr/bin/env node
// Démarrage Next PROPRE : tue l'ancien serveur sur 3000/3001 (config potentiellement
// obsolète), supprime .next, puis lance `next dev` (qui charge .env.local). Imprime l'état
// owner-gate SANS secret (longueur + empreinte tronquée du hash uniquement).
import { spawnSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { resolveHashInfo, parseEnvFile } from "./owner-hash-util.mjs";

const PORTS = [3000, 3001];

function killPort(port) {
  if (process.platform === "win32") {
    const r = spawnSync("cmd", ["/c", `netstat -ano | findstr :${port} | findstr LISTENING`], { encoding: "utf8" });
    const pids = new Set();
    for (const line of (r.stdout || "").split(/\r?\n/)) {
      const m = line.trim().match(/(\d+)\s*$/);
      if (m) pids.add(m[1]);
    }
    for (const pid of pids) {
      spawnSync("taskkill", ["/F", "/PID", pid], { stdio: "ignore" });
      console.log(`[dev:clean] arrêt PID ${pid} sur :${port}`);
    }
  } else {
    const r = spawnSync("bash", ["-c", `lsof -ti tcp:${port} 2>/dev/null`], { encoding: "utf8" });
    for (const pid of (r.stdout || "").split(/\s+/).filter(Boolean)) {
      spawnSync("kill", ["-9", pid], { stdio: "ignore" });
      console.log(`[dev:clean] arrêt PID ${pid} sur :${port}`);
    }
  }
}

for (const p of PORTS) killPort(p);
try { rmSync(".next", { recursive: true, force: true }); console.log("[dev:clean] .next supprimé"); } catch {}

const env = parseEnvFile(".env.local");
const info = resolveHashInfo(env);
const configured = info.present && Boolean(env.CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET) && Boolean(env.CLONESTORE_OWNER_COCKPIT_SLUG);

console.log(`[dev:clean] owner gate configurée : ${configured ? "OUI" : "NON"}`);
console.log(`[dev:clean] hash : length=${info.length} parts=${info.parts} format_valid=${info.formatValid} fingerprint=${info.fingerprint ?? "-"}`);
console.log(`[dev:clean] port : 3000`);
console.log(`[dev:clean] cockpit : http://localhost:3000/founder`);
if (!configured) console.log(`[dev:clean] ⚠ Porte NON configurée — renseignez CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH (node scripts/security/hash-owner-cockpit-password.mjs).`);
console.log(`[dev:clean] démarrage de next dev …\n`);

const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
