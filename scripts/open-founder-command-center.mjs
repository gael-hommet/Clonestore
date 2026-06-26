#!/usr/bin/env node
// Ouvre l'entrée OFFICIELLE du Founder Command Center : <BASE_URL>/founder.
// Aucun slug n'est lu, demandé ni affiché. Base via --url=, sinon CLONESTORE_PUBLIC_APP_URL,
// sinon http://localhost:3000.
import { spawn } from "child_process";

const base = (process.argv.find((a) => a.startsWith("--url="))?.slice(6)
  ?? process.env.CLONESTORE_PUBLIC_APP_URL
  ?? "http://localhost:3000").replace(/\/$/, "");
const target = `${base}/founder`;

console.log(`[open:cockpit] Founder Command Center → ${target}`);

const platform = process.platform;
try {
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", target], { stdio: "ignore", detached: true }).unref();
  } else {
    spawn(platform === "darwin" ? "open" : "xdg-open", [target], { stdio: "ignore", detached: true }).unref();
  }
} catch {
  console.log(`[open:cockpit] Ouvrez manuellement : ${target}`);
}
