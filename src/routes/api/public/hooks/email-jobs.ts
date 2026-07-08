import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { enqueueTemplateEmail } from '@/lib/email/enqueue.server'

/**
 * Runs every 15 minutes via pg_cron. Handles:
 *  - Deadline reminders (per-user + per-task offsets)
 *  - Daily summary (fires ~07:00 local per user)
 *  - Weekly summary (fires Sunday ~19:00 local per user)
 *
 * Idempotency via public.email_reminders_sent (user_id, dedupe_key) unique.
 */
export const Route = createFileRoute('/api/public/hooks/email-jobs')({
  server: {
    handlers: {
      POST: async () => {
        const supabaseUrl = process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server not configured' }, { status: 500 })
        }
        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })

        const now = new Date()

        // 1. Fetch users with any notification enabled
        const { data: settings, error: settingsError } = await supabase
          .from('user_settings')
          .select('user_id,email_reminders_enabled,reminder_offsets,reminder_fallback_hour,daily_summary_enabled,weekly_summary_enabled,timezone,reminder_email,reminder_email_verified')
        if (settingsError) return Response.json({ error: settingsError.message }, { status: 500 })
        const activeUsers = (settings ?? []).filter(
          (s) => s.email_reminders_enabled || s.daily_summary_enabled || s.weekly_summary_enabled
        )
        if (activeUsers.length === 0) return Response.json({ ok: true, users: 0 })

        // 2. Build user_id → email map via admin listUsers (paginated).
        const emails = new Map<string, { email: string; displayName: string | null }>()
        {
          let page = 1
          while (true) {
            const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
            if (error) break
            for (const u of data.users) {
              if (u.email) {
                emails.set(u.id, {
                  email: u.email,
                  displayName: (u.user_metadata?.display_name as string | undefined) ?? null,
                })
              }
            }
            if (data.users.length < 1000) break
            page++
          }
        }

        // 3. Fetch profiles for display names (fallback)
        const userIds = activeUsers.map((u) => u.user_id)
        const { data: profiles } = await supabase.from('profiles').select('id,display_name').in('id', userIds)
        const displayNames = new Map<string, string | null>()
        for (const p of profiles ?? []) displayNames.set(p.id, p.display_name ?? null)

        // 4. Fetch tasks (open) + overrides + courses + sessions for these users
        const [{ data: tasks }, { data: overrides }, { data: courses }, { data: sessions }] = await Promise.all([
          supabase
            .from('tasks')
            .select('id,user_id,title,due_at,course_id,task_type,status')
            .in('user_id', userIds)
            .neq('status', 'done')
            .not('due_at', 'is', null)
            .gte('due_at', now.toISOString())
            .lte('due_at', new Date(now.getTime() + 14 * 86400_000).toISOString()),
          supabase.from('task_reminder_overrides').select('task_id,offsets,disabled').in('user_id', userIds),
          supabase.from('courses').select('id,name').in('user_id', userIds),
          supabase
            .from('study_sessions')
            .select('id,user_id,course_id,planned_start')
            .in('user_id', userIds)
            .gte('planned_start', new Date(now.getTime() - 12 * 3600_000).toISOString())
            .lte('planned_start', new Date(now.getTime() + 24 * 3600_000).toISOString()),
        ])

        const overrideMap = new Map<string, { offsets: number[] | null; disabled: boolean }>()
        for (const o of overrides ?? []) overrideMap.set(o.task_id, { offsets: o.offsets, disabled: o.disabled })
        const courseMap = new Map<string, string>()
        for (const c of courses ?? []) courseMap.set(c.id, c.name)

        // Helper: is a datetime string "date-only" (midnight in user tz)?
        function isMidnightInTz(iso: string, tz: string): boolean {
          try {
            const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso))
            const h = parts.find((p) => p.type === 'hour')?.value
            const m = parts.find((p) => p.type === 'minute')?.value
            return h === '00' && m === '00'
          } catch { return false }
        }
        function localHour(d: Date, tz: string): number {
          try {
            const s = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(d)
            return parseInt(s, 10)
          } catch { return d.getUTCHours() }
        }
        function localDayOfWeek(d: Date, tz: string): number {
          const wk = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d)
          return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(wk)
        }
        function localDateStr(d: Date, tz: string): string {
          const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
          const y = parts.find(p => p.type === 'year')?.value ?? ''
          const m = parts.find(p => p.type === 'month')?.value ?? ''
          const day = parts.find(p => p.type === 'day')?.value ?? ''
          return `${y}-${m}-${day}`
        }
        function isoWeek(d: Date): string {
          const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
          const dayNum = (t.getUTCDay() + 6) % 7
          t.setUTCDate(t.getUTCDate() - dayNum + 3)
          const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
          const week = 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
          return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
        }
        function daysLeftLabel(due: Date, ref: Date): string {
          const diff = Math.round((due.getTime() - ref.getTime()) / 60000)
          if (diff < 60) return `${Math.max(1, diff)} min kvar`
          if (diff < 24 * 60) return `${Math.round(diff / 60)} h kvar`
          const days = Math.round(diff / (60 * 24))
          if (days === 1) return '1 dag kvar'
          return `${days} dagar kvar`
        }
        function fmtDue(iso: string, tz: string): string {
          return new Intl.DateTimeFormat('sv-SE', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
        }

        // Loop users
        const results: Record<string, number> = { reminders: 0, daily: 0, weekly: 0, skipped_no_email: 0 }

        for (const settings of activeUsers) {
          const info = emails.get(settings.user_id)
          const recipientEmail = (settings.reminder_email && settings.reminder_email_verified)
            ? settings.reminder_email
            : info?.email

          if (!recipientEmail) { results.skipped_no_email++; continue }
          const tz = settings.timezone || 'Europe/Stockholm'
          const displayName = info?.displayName || displayNames.get(settings.user_id) || recipientEmail.split('@')[0]

          const userTasks = (tasks ?? []).filter((t) => t.user_id === settings.user_id)

          // --- Deadline reminders ---
          if (settings.email_reminders_enabled) {
            for (const t of userTasks) {
              if (!t.due_at) continue
              const ov = overrideMap.get(t.id)
              if (ov?.disabled) continue
              const offsets = ov?.offsets ?? settings.reminder_offsets ?? [10080, 4320, 1440, 120]
              const dueDate = new Date(t.due_at)
              const noTime = isMidnightInTz(t.due_at, tz)

              for (const offsetMin of offsets) {
                // If task has no time and offset is < 1 day, skip (fallback needs day granularity)
                let scheduledTime: Date
                if (noTime) {
                  if (offsetMin < 60) continue
                  // days before due date, fired at fallback_hour local
                  const daysBefore = Math.round(offsetMin / (60 * 24))
                  const targetLocalDateStr = localDateStr(new Date(dueDate.getTime() - daysBefore * 86400_000), tz)
                  // Rough conversion: assume tz offset from Europe/Stockholm ~ +1/+2. Simpler: compute epoch by iterating.
                  scheduledTime = new Date(`${targetLocalDateStr}T${String(settings.reminder_fallback_hour).padStart(2, '0')}:00:00`)
                } else {
                  scheduledTime = new Date(dueDate.getTime() - offsetMin * 60_000)
                }

                // Fire window: within 20 minutes of scheduled time and not in past >20min
                const diff = now.getTime() - scheduledTime.getTime()
                if (diff < 0 || diff > 20 * 60_000) continue

                const dedupeKey = `reminder:${t.id}:${offsetMin}`
                const { error: dupErr } = await supabase
                  .from('email_reminders_sent')
                  .insert({ user_id: settings.user_id, task_id: t.id, kind: 'reminder', dedupe_key: dedupeKey })
                if (dupErr) continue // already sent

                const courseName = t.course_id ? courseMap.get(t.course_id) ?? null : null
                const res = await enqueueTemplateEmail({
                  supabase,
                  templateName: 'deadline-reminder',
                  recipientEmail: recipientEmail,
                  idempotencyKey: dedupeKey,
                  templateData: {
                    taskTitle: t.title,
                    courseName,
                    dueLabel: fmtDue(t.due_at, tz),
                    timeLeftLabel: daysLeftLabel(dueDate, now),
                    taskType: t.task_type ?? '',
                    appUrl: 'https://studiehubb.lovable.app/tasks',
                  },
                })
                if (res.success) results.reminders++
              }
            }
          }

          // --- Daily summary (fires at local hour 7) ---
          if (settings.daily_summary_enabled && localHour(now, tz) === 7) {
            const dateStr = localDateStr(now, tz)
            const dedupeKey = `daily:${dateStr}`
            const { error: dupErr } = await supabase
              .from('email_reminders_sent')
              .insert({ user_id: settings.user_id, kind: 'daily', dedupe_key: dedupeKey })
            if (!dupErr) {
              const todayEnd = new Date(now.getTime() + 48 * 3600_000)
              const dayTasks = userTasks
                  .filter((t) => t.due_at && new Date(t.due_at) <= todayEnd)
                  .map((t) => ({
                    title: t.title,
                    courseName: t.course_id ? courseMap.get(t.course_id) ?? null : null,
                    dueLabel: t.due_at ? fmtDue(t.due_at, tz) : '',
                  }))
              const todaySessions = (sessions ?? [])
                  .filter((s) => s.user_id === settings.user_id && s.planned_start && localDateStr(new Date(s.planned_start), tz) === dateStr)
                  .map((s) => ({
                    title: (s.course_id && courseMap.get(s.course_id)) || 'Studiepass',
                    startLabel: new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(s.planned_start!)),
                  }))

              const dateLabel = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now)
              const res = await enqueueTemplateEmail({
                supabase,
                templateName: 'daily-summary',
                recipientEmail: recipientEmail,
                idempotencyKey: dedupeKey,
                templateData: { displayName, dateLabel, tasks: dayTasks, sessions: todaySessions, appUrl: 'https://studiehubb.lovable.app' },
              })
              if (res.success) results.daily++
            }
          }

          // --- Weekly summary (Sunday 19:00 local) ---
          if (settings.weekly_summary_enabled && localDayOfWeek(now, tz) === 0 && localHour(now, tz) === 19) {
            const wk = isoWeek(now)
            const dedupeKey = `weekly:${wk}`
            const { error: dupErr } = await supabase
              .from('email_reminders_sent')
              .insert({ user_id: settings.user_id, kind: 'weekly', dedupe_key: dedupeKey })
            if (!dupErr) {
              const weekEnd = new Date(now.getTime() + 7 * 86400_000)
              const weekTasks = userTasks
                  .filter((t) => t.due_at && new Date(t.due_at) <= weekEnd)
                  .map((t) => ({
                    title: t.title,
                    courseName: t.course_id ? courseMap.get(t.course_id) ?? null : null,
                    dueLabel: t.due_at ? fmtDue(t.due_at, tz) : '',
                  }))
              // Study hours last 7 days
              const weekStart = new Date(now.getTime() - 7 * 86400_000)
              const { data: entries } = await supabase
                  .from('time_entries')
                  .select('duration_seconds')
                  .eq('user_id', settings.user_id)
                  .gte('started_at', weekStart.toISOString())
              const totalSec = (entries ?? []).reduce((a, e) => a + ((e as { duration_seconds: number }).duration_seconds ?? 0), 0)
              const hours = Math.round(totalSec / 360) / 10

              const res = await enqueueTemplateEmail({
                supabase,
                templateName: 'weekly-summary',
                recipientEmail: recipientEmail,
                idempotencyKey: dedupeKey,
                templateData: { displayName, weekLabel: wk, tasks: weekTasks, studyHours: hours, appUrl: 'https://studiehubb.lovable.app' },
              })
              if (res.success) results.weekly++
            }
          }
        }

        return Response.json({ ok: true, ...results })
      },
    },
  },
})
