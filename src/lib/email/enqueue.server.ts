import * as React from "react";
import { render } from "@react-email/render";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "studie-hubb";
const SENDER_DOMAIN = "notify.studiehubb.xyz";
const FROM_DOMAIN = "studiehubb.xyz";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface EnqueueInput {
  supabase: SupabaseClient;
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, unknown>;
}

export interface EnqueueResult {
  success: boolean;
  reason?: string;
  messageId?: string;
}

/** Enqueue a transactional email using service-role client. Skips duplicates via email_reminders_sent — caller must handle idempotency. */
export async function enqueueTemplateEmail({
  supabase,
  templateName,
  recipientEmail,
  idempotencyKey,
  templateData = {},
}: EnqueueInput): Promise<EnqueueResult> {
  const template = TEMPLATES[templateName];
  if (!template) return { success: false, reason: "template_not_found" };
  const effectiveRecipient = template.to || recipientEmail;
  if (!effectiveRecipient) return { success: false, reason: "no_recipient" };

  const normalizedEmail = effectiveRecipient.toLowerCase();
  const messageId = crypto.randomUUID();

  const { data: suppressed } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (suppressed) return { success: false, reason: "email_suppressed" };

  // Unsubscribe token (reuse existing)
  let unsubscribeToken: string;
  const { data: existing } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token;
  } else if (!existing) {
    unsubscribeToken = generateToken();
    await supabase
      .from("email_unsubscribe_tokens")
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: "email", ignoreDuplicates: true },
      );
    const { data: stored } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (stored) unsubscribeToken = stored.token;
  } else {
    return { success: false, reason: "unsubscribed" };
  }

  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: "pending",
  });

  const { error: enqueueError } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken!,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqueueError) {
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "failed",
      error_message: enqueueError.message,
    });
    return { success: false, reason: "enqueue_failed" };
  }

  return { success: true, messageId };
}
