// scripts/pierre-tick.mjs
import "dotenv/config";

const BASE = process.env.CLONESTORE_BASE_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET || CRON_SECRET.length < 10) {
  console.error("❌ Missing CRON_SECRET (min 10 chars)");
  console.error("➡️ Fix: add CRON_SECRET=... in .env.local then run:");
  console.error("   node --env-file .env.local scripts/pierre-tick.mjs");
  process.exit(1);
}

const url = new URL(`${BASE}/api/pierre/tick`);
url.searchParams.set("secret", CRON_SECRET);
url.searchParams.set("limit", "5");

const res = await fetch(url.toString(), { method: "GET" });
const text = await res.text();

console.log("Status:", res.status);
console.log(text);






