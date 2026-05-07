import type { SupabaseClient } from "@supabase/supabase-js";

import type { PierreRunnableTask } from "@/lib/pierre/tasks/executors";
import { buildPierreEmailPayload } from "@/lib/pierre/email/build-payload";
import { resolvePierreSenderProfile } from "@/lib/pierre/email/sender-profile";

export async function createPierreEmailDraft(
  supabase: SupabaseClient,
  input: {
    task: PierreRunnableTask;
  }
) {
  const senderProfile = await resolvePierreSenderProfile(supabase, {
    userId: input.task.user_id,
    payload: input.task.payload_json,
  });

  const emailPayload = buildPierreEmailPayload({
    senderProfile,
    payload: input.task.payload_json,
  });

  let draftId: string | null = null;

  try {
    const { data } = await supabase
      .from("pierre_outbound_emails")
      .insert({
        user_id: input.task.user_id,
        mission_id: input.task.mission_id,
        task_id: input.task.id,
        agent_slug: "pierre",
        from_email: emailPayload.from.email,
        from_name: emailPayload.from.name,
        to_json: emailPayload.to,
        cc_json: emailPayload.cc,
        bcc_json: emailPayload.bcc,
        subject: emailPayload.subject,
        body_text: emailPayload.body_text,
        body_html: emailPayload.body_html,
        status: "draft",
        provider: "draft_only",
      })
      .select("id")
      .maybeSingle();

    draftId = (data?.id as string | undefined) || null;
  } catch (error) {
    console.error("[PIERRE_EMAIL_DRAFT_INSERT_ERROR]", error);
  }

  return {
    draft_id: draftId,
    sender_email: emailPayload.from.email,
    sender_name: emailPayload.from.name,
    to: emailPayload.to,
    cc: emailPayload.cc,
    bcc: emailPayload.bcc,
    subject: emailPayload.subject,
    body_text: emailPayload.body_text,
    body_html: emailPayload.body_html,
  };
}