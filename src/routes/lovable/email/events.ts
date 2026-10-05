import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'

type Reason = 'bounce' | 'complaint' | 'unsubscribe'

const STATUS: Record<Reason, string> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}
const MESSAGE: Record<Reason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

async function getAdmin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  return supabaseAdmin
}

async function record(eventId: string, recipient: string, reason: Reason, messageId?: string | null) {
  const supabase = await getAdmin()
  const email = recipient.toLowerCase()

  const { error: supErr } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })
  if (supErr) {
    console.error('Failed to upsert suppressed email', { code: supErr.code, message: supErr.message, event_id: eventId })
    throw new Error('suppression write failed')
  }

  const { error: logErr } = await supabase.from('email_send_log').insert({
    message_id: messageId ?? null,
    template_name: 'system',
    recipient_email: email,
    status: STATUS[reason],
    error_message: MESSAGE[reason],
    metadata: null,
  })
  if (logErr) {
    console.error('Failed to insert email_send_log', { code: logErr.code, message: logErr.message, event_id: eventId })
    throw new Error('log write failed')
  }
}

// Custom behaviour: disable reminder emails for the user whose address unsubscribed.
async function disableReminders(eventId: string, recipient: string) {
  const supabase = await getAdmin()
  const email = recipient.toLowerCase()
  const { error } = await supabase
    .from('user_settings')
    .update({ email_reminders_enabled: false })
    .eq('reminder_email', email)
  if (error) {
    console.error('Failed to disable reminders', { code: error.code, message: error.message, event_id: eventId })
    throw new Error('settings update failed')
  }
  let page = 1
  while (true) {
    const { data, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (listErr) break
    const found = data.users.find((u) => u.email?.toLowerCase() === email)
    if (found) {
      const { error: upErr } = await supabase
        .from('user_settings')
        .update({ email_reminders_enabled: false })
        .eq('user_id', found.id)
      if (upErr) {
        console.error('Failed to disable reminders', { code: upErr.code, message: upErr.message, event_id: eventId })
        throw new Error('settings update failed')
      }
      break
    }
    if (data.users.length < 1000) break
    page++
  }
}

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            'email.bounced': async (event) => {
              await record(event.event_id, event.data.recipient, 'bounce', event.data.message_id)
            },
            'email.complaint': async (event) => {
              await record(event.event_id, event.data.recipient, 'complaint', event.data.message_id)
            },
            'email.unsubscribed': async (event) => {
              await record(event.event_id, event.data.recipient, 'unsubscribe', event.data.message_id)
              await disableReminders(event.event_id, event.data.recipient)
            },
          },
        })
        return handler(request)
      },
    },
  },
})
