#!/usr/bin/env node
// scripts/p87-provider-proof.mjs — P8.7.3 REAL provider proofs (Resend send + Yousign sandbox request).
// --apply required to perform the real calls. Synthetic content only; sends exactly ONE email to the
// pre-authorized test recipient; creates ONE Yousign sandbox signature request (delivery_mode=none → no real
// signer emails). Never prints a secret. Writes a redacted report to .p87-proofs/step3/provider-proof.json.
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
const APPLY = process.argv.includes("--apply");
const report = { phase: "P8.7.3", resend: {}, yousign: {} };

// ── Resend: one real smoke email ──
const rk = process.env.RESEND_API_KEY || "";
const from = process.env.CLONESTORE_EMAIL_FROM || process.env.PIERRE_DEFAULT_SENDER_EMAIL || "pierre@clonestore.pro";
const to = process.env.FOUNDER_EMAIL_SMOKE_RECIPIENT || "";
report.resend.recipient_configured = !!to;
if (rk && to && APPLY) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: `Bearer ${rk}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: "P8.7.3 PROVIDER PROOF", text: "P8.7.3 synthetic provider proof. No personal data. No action required." }),
  });
  let b = null; try { b = await r.json(); } catch {}
  report.resend.send_status = r.status;
  report.resend.accepted = r.ok && !!b?.id;
  report.resend.message_id_present = !!b?.id;
  report.resend.error = r.ok ? null : (b?.message || `http_${r.status}`);
} else if (!APPLY) { report.resend.send_status = "DRY_RUN"; }

// ── Yousign: one real sandbox signature request (write-capability proof) ──
const yk = process.env.CLONESTORE_SIGNATURE_API_KEY || process.env.YOUSIGN_API_KEY || "";
const yurl = (process.env.CLONESTORE_SIGNATURE_API_URL || process.env.YOUSIGN_API_URL || "").replace(/\/$/, "");
report.yousign.env = /sandbox|staging/i.test(yurl) ? "sandbox" : (yurl ? "production" : "missing");
if (yk && /^https:\/\//.test(yurl) && APPLY) {
  const r = await fetch(`${yurl}/signature_requests`, {
    method: "POST", headers: { authorization: `Bearer ${yk}`, "content-type": "application/json" },
    body: JSON.stringify({ name: "P8.7.3 Synthetic Signature Proof", delivery_mode: "none" }),
  });
  let b = null; try { b = await r.json(); } catch {}
  report.yousign.create_status = r.status;
  report.yousign.created = r.ok && !!b?.id;
  report.yousign.request_status = b?.status || null;
  report.yousign.error = r.ok ? null : (b?.detail || b?.message || `http_${r.status}`);
  // best-effort cleanup: delete the draft request so no synthetic artifact lingers (keep evidence in report)
  if (r.ok && b?.id) {
    try { const d = await fetch(`${yurl}/signature_requests/${b.id}`, { method: "DELETE", headers: { authorization: `Bearer ${yk}` } }); report.yousign.cleanup_status = d.status; } catch {}
  }
} else if (!APPLY) { report.yousign.create_status = "DRY_RUN"; }

mkdirSync(resolve(process.cwd(), ".p87-proofs/step3"), { recursive: true });
writeFileSync(resolve(process.cwd(), ".p87-proofs/step3/provider-proof.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
// §2 — fail closed: a green proof is impossible unless every required real operation actually succeeded.
// (This proves API send/create only; it is NOT the canonical webhook-delivered proof required for READY_LIVE.)
if (APPLY) {
  const ok = report.resend.accepted === true && report.yousign.created === true;
  if (!ok) { process.stderr.write("[p87-provider-proof] FAILED — a required provider operation did not succeed\n"); process.exitCode = 1; }
}
