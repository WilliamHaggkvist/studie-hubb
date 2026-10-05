import type { SupabaseClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

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

async function logSend(
  supabase: SupabaseClient,
  row: { template_name: string; recipient_email: string; status: string; error_message?: string },
) {
  const { error } = await supabase.from("email_send_log").insert({ message_id: null, ...row });
  if (error) console.error("Failed to write email_send_log", { code: error.code, message: error.message });
}

/** Sends a registered template via Lovable's managed email API and logs the outcome. */
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

  try {
    const res = await sendTemplateEmail(templateName, effectiveRecipient, {
      templateData,
      idempotencyKey,
    });
    if (!res.sent) {
      await logSend(supabase, {
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: "suppressed",
      });
      return { success: false, reason: "email_suppressed" };
    }
    await logSend(supabase, {
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "sent",
    });
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logSend(supabase, {
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "failed",
      error_message: msg.slice(0, 1000),
    });
    return { success: false, reason: "send_failed" };
  }
}
