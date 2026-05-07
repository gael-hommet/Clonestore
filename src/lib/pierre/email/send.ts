import type { SupabaseClient } from "@supabase/supabase-js";

import type { PierreRunnableTask } from "@/lib/pierre/tasks/executors";
import { buildPierreEmailPayload } from "@/lib/pierre/email/build-payload";
import { resolvePierreSenderProfile } from "@/lib/pierre/email/sender-profile";
import { sendPierreEmailWithProvider } from "@/lib/pierre/email/provider";

async function persistPierreOutboundEmail(
  supabase: SupabaseClient,
  input: {
    task: PierreRunnableTask;
    sender_email: string;
    sender_name: string;
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    body_text: string;
    body_html: string;
    provider: string;
    provider_message_id: string | null;
    status: string;
    provider_response_json: Record<string, unknown>;
  }
) {
  try {
    await supabase.from("pierre_outbound_emails").insert({
      user_id: input.task.user_id,
      mission_id: input.task.mission_id,
      task_id: input.task.id,
      agent_slug: "pierre",
      from_email: input.sender_email,
      from_name: input.sender_name,
      to_json: input.to,
      cc_json: input.cc,
      bcc_json: input.bcc,
      subject: input.subject,
      body_text: input.body_text,
      body_html: input.body_html,
      provider: input.provider,
      provider_message_id: input.provider_message_id,
      status: input.status,
      provider_response_json: input.provider_response_json,
    });
  } catch (error) {
    console.error("[PIERRE_OUTBOUND_EMAIL_INSERT_ERROR]", error);
  }
}

export async function sendPierreEmail(
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

  const providerResult = await sendPierreEmailWithProvider({
    senderProfile,
    email: emailPayload,
  });

  await persistPierreOutboundEmail(supabase, {
    task: input.task,
    sender_email: emailPayload.from.email,
    sender_name: emailPayload.from.name,
    to: emailPayload.to,
    cc: emailPayload.cc,
    bcc: emailPayload.bcc,
    subject: emailPayload.subject,
    body_text: emailPayload.body_text,
    body_html: emailPayload.body_html,
    provider: providerResult.provider,
    provider_message_id: providerResult.message_id,
    status: providerResult.status,
    provider_response_json: providerResult.response_json,
  });

  return {
    provider: providerResult.provider,
    provider_message_id: providerResult.message_id,
    sender_email: emailPayload.from.email,
    sender_name: emailPayload.from.name,
    to: emailPayload.to,
    cc: emailPayload.cc,
    bcc: emailPayload.bcc,
    subject: emailPayload.subject,
    status: providerResult.status,
    response_json: providerResult.response_json,
  };
}