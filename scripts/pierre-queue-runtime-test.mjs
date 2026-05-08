/**
 * Pierre Queue Runtime Smoke Test
 *
 * Usage:
 *   PIERRE_RUNTIME_TEST_ENABLED=true node scripts/pierre-queue-runtime-test.mjs
 *
 * Optional cleanup:
 *   PIERRE_RUNTIME_TEST_CLEANUP=true PIERRE_RUNTIME_TEST_ENABLED=true node scripts/pierre-queue-runtime-test.mjs
 *
 * Required env vars (loaded from .env.local automatically via --env-file if node >= 20.6,
 * or set manually in your shell):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PIERRE_QUEUE_WORKER_SECRET  (optional, needed if configured)
 */

import { createClient } from "@supabase/supabase-js";

// ── Guard ────────────────────────────────────────────────────────────────────

if (process.env.PIERRE_RUNTIME_TEST_ENABLED !== "true") {
  console.error(
    "\nThis script requires explicit opt-in:\n" +
      "  PIERRE_RUNTIME_TEST_ENABLED=true node scripts/pierre-queue-runtime-test.mjs\n",
  );
  process.exit(1);
}

// ── Env ──────────────────────────────────────────────────────────────────────

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || "";
const WORKER_SECRET = process.env.PIERRE_QUEUE_WORKER_SECRET || "";
const CLEANUP = process.env.PIERRE_RUNTIME_TEST_CLEANUP === "true";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "\nMissing env vars:\n  NEXT_PUBLIC_SUPABASE_URL\n  SUPABASE_SERVICE_ROLE_KEY\n",
  );
  process.exit(1);
}

// ── Supabase ──────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(label) {
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`    ${detail}`);
}

function section(title) {
  console.log(`\n── ${title} ─────────────────────────────────────────────────`);
}

async function insertTestUser() {
  const { data: users, error } = await supabase.auth.admin.listUsers({ perPage: 1 });
  if (error || !users?.users?.length) throw new Error("No user found in Supabase auth.");
  return users.users[0];
}

async function cleanup(missionId) {
  if (!CLEANUP || !missionId) return;
  section("Cleanup");

  const tables = [
    "pierre_task_logs",
    "pierre_outbound_emails",
    "pierre_documents",
    "pierre_tasks",
    "pierre_missions",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("mission_id", missionId);
    if (error) {
      fail(`Cleanup ${table}`, error.message);
    } else {
      ok(`Cleaned ${table}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Pierre Queue Runtime Smoke Test");
  console.log("  " + new Date().toISOString());
  console.log("═══════════════════════════════════════════════════════");

  const report = {
    missionId: null,
    taskIds: [],
    tasksCompleted: 0,
    documentsCreated: 0,
    emailsCreated: 0,
    logsCreated: 0,
    errors: [],
  };

  // 1) Get a real user
  section("Step 1 — Resolve test user");
  let user;
  try {
    user = await insertTestUser();
    ok(`User: ${user.email} (${user.id})`);
  } catch (err) {
    fail("Cannot resolve user", err.message);
    process.exit(1);
  }

  // 2) Insert test mission
  section("Step 2 — Create test mission");
  const { data: mission, error: missionErr } = await supabase
    .from("pierre_missions")
    .insert({
      user_id: user.id,
      agent_slug: "pierre",
      source: "smoke_test",
      raw_input: "Test runtime: génère un document RH, un PDF et un brouillon email.",
      mission_summary: "[SMOKE TEST] Validation queue → executor → artifacts",
      intent: "smoke_test",
      understanding_status: "understood",
      risk_level: "low",
      approval_required: false,
      status: "active",
    })
    .select("*")
    .single();

  if (missionErr || !mission?.id) {
    fail("Insert mission", missionErr?.message ?? "No data returned");
    process.exit(1);
  }

  report.missionId = mission.id;
  ok(`Mission created: ${mission.id}`);

  // 3) Insert 3 test tasks
  section("Step 3 — Create 3 test tasks");

  const taskDefs = [
    {
      type: "doc.generate",
      title: "[SMOKE] Document RH test",
      payload_json: {
        kind: "document",
        title: "Document RH smoke test",
        text_content: "Contenu de test généré automatiquement par le smoke test Pierre.",
        doc_type: "document_rh",
        artifact_request: {
          kind: "document",
          title: "Document RH smoke test",
          text_content: "Contenu de test généré automatiquement par le smoke test Pierre.",
          doc_type: "document_rh",
        },
      },
    },
    {
      type: "pdf.generate",
      title: "[SMOKE] PDF test",
      payload_json: {
        kind: "pdf",
        title: "Export PDF smoke test",
        text_content: "Export PDF généré par le smoke test Pierre.",
        doc_type: "pdf_export",
        artifact_request: {
          kind: "pdf",
          title: "Export PDF smoke test",
          text_content: "Export PDF généré par le smoke test Pierre.",
          doc_type: "pdf_export",
        },
      },
    },
    {
      type: "email.draft",
      title: "[SMOKE] Email brouillon test",
      payload_json: {
        kind: "email_draft",
        subject: "Email smoke test Pierre",
        body_text: "Corps de l'email de test.",
        body_html: "<p>Corps de l'email de test.</p>",
        artifact_request: {
          kind: "email_draft",
          subject: "Email smoke test Pierre",
          body_text: "Corps de l'email de test.",
          body_html: "<p>Corps de l'email de test.</p>",
        },
      },
    },
  ];

  const insertedTasks = [];
  for (const def of taskDefs) {
    const { data: task, error: taskErr } = await supabase
      .from("pierre_tasks")
      .insert({
        mission_id: mission.id,
        user_id: user.id,
        agent_slug: "pierre",
        type: def.type,
        title: def.title,
        status: "ready",
        priority: 50,
        approval_required: false,
        payload_json: def.payload_json,
        result_json: {},
        retry_count: 0,
        max_retries: 3,
      })
      .select("*")
      .single();

    if (taskErr || !task?.id) {
      fail(`Insert task ${def.type}`, taskErr?.message ?? "No data");
      report.errors.push(`task_insert:${def.type}`);
    } else {
      ok(`Task created: ${task.id} (${def.type})`);
      insertedTasks.push(task);
      report.taskIds.push(task.id);
    }
  }

  if (insertedTasks.length === 0) {
    fail("No tasks created — aborting", "");
    await cleanup(mission.id);
    process.exit(1);
  }

  // 4) Run queue for each task via run-next
  section("Step 4 — Process tasks via run-next");

  const ORIGIN = SUPABASE_URL.includes("localhost")
    ? "http://localhost:3000"
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(WORKER_SECRET ? { "x-pierre-worker-secret": WORKER_SECRET } : {}),
  };

  for (let i = 0; i < insertedTasks.length; i++) {
    const task = insertedTasks[i];
    console.log(`\n  Processing task ${i + 1}/${insertedTasks.length}: ${task.type}`);

    try {
      const res = await fetch(`${ORIGIN}/api/pierre/queue/run-next`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          workerId: "smoke-test-worker",
          onlyUserId: user.id,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok) {
        fail(`run-next for ${task.type}`, `HTTP ${res.status}: ${JSON.stringify(payload)}`);
        report.errors.push(`run_next:${task.type}`);
      } else {
        ok(`run-next OK: ${payload?.result?.phase ?? "unknown phase"}`);
      }
    } catch (err) {
      fail(`run-next fetch error (${task.type})`, err.message);
      report.errors.push(`run_next_fetch:${task.type}`);
    }

    // Small delay between tasks
    await new Promise((r) => setTimeout(r, 500));
  }

  // 5) Verify results in DB
  section("Step 5 — Verify DB state");

  await new Promise((r) => setTimeout(r, 1000));

  const { data: finalTasks } = await supabase
    .from("pierre_tasks")
    .select("id, type, status")
    .eq("mission_id", mission.id);

  report.tasksCompleted = (finalTasks ?? []).filter(
    (t) => t.status === "done" || t.status === "completed",
  ).length;

  console.log(`\n  Tasks status:`);
  for (const t of finalTasks ?? []) {
    const symbol = t.status === "done" ? "✓" : "⚠";
    console.log(`    ${symbol} ${t.type} → ${t.status}`);
  }

  const { data: docs } = await supabase
    .from("pierre_documents")
    .select("id, doc_type")
    .eq("mission_id", mission.id);

  report.documentsCreated = (docs ?? []).length;

  const { data: emails } = await supabase
    .from("pierre_outbound_emails")
    .select("id, status")
    .eq("mission_id", mission.id);

  report.emailsCreated = (emails ?? []).length;

  const { data: logs } = await supabase
    .from("pierre_task_logs")
    .select("id")
    .eq("mission_id", mission.id);

  report.logsCreated = (logs ?? []).length;

  // 6) Summary
  section("Step 6 — Report");

  const checks = [
    {
      label: "3 tasks completed (done)",
      pass: report.tasksCompleted >= 3,
      detail: `${report.tasksCompleted}/3`,
    },
    {
      label: "≥ 2 documents created (doc + pdf)",
      pass: report.documentsCreated >= 2,
      detail: `${report.documentsCreated} found`,
    },
    {
      label: "≥ 1 email draft created",
      pass: report.emailsCreated >= 1,
      detail: `${report.emailsCreated} found`,
    },
    {
      label: "Task logs created",
      pass: report.logsCreated > 0,
      detail: `${report.logsCreated} logs`,
    },
    {
      label: "No errors during test",
      pass: report.errors.length === 0,
      detail: report.errors.length > 0 ? report.errors.join(", ") : "none",
    },
  ];

  let allPassed = true;
  for (const check of checks) {
    if (check.pass) {
      ok(`${check.label} [${check.detail}]`);
    } else {
      fail(`${check.label} [${check.detail}]`);
      allPassed = false;
    }
  }

  console.log("\n  Documents:");
  for (const d of docs ?? []) {
    console.log(`    - ${d.id} (${d.doc_type})`);
  }

  console.log("\n  Emails:");
  for (const e of emails ?? []) {
    console.log(`    - ${e.id} (${e.status})`);
  }

  // 7) Cleanup
  await cleanup(mission.id);

  console.log("\n═══════════════════════════════════════════════════════");
  if (allPassed) {
    console.log("  ✓ SMOKE TEST PASSED");
  } else {
    console.log("  ✗ SMOKE TEST FAILED — check errors above");
  }
  console.log("═══════════════════════════════════════════════════════\n");

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
