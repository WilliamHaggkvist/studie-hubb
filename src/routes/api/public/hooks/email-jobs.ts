import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { enqueueTemplateEmail } from "@/lib/email/enqueue.server";
import {
  loadSubscriptionsByUser,
  sendPushToSubscriptions,
  type PushSubscriptionRow,
} from "@/lib/push/send.server";

/**
 * Runs every 15 minutes via pg_cron. Handles, per user:
 *  - Deadline reminders (email + push, per-user + per-task offsets)
 *  - Study session start reminders (push only)
 *  - Daily summary (fires ~07:00 local per user)
 *  - Weekly summary (fires Sunday ~19:00 local per user)
 *
 * Idempotency via public.email_reminders_sent (user_id, dedupe_key) unique.
 */
export const Route = createFileRoute("/api/public/hooks/email-jobs")({
  server: {
    handlers: {
      POST: async () => {
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: "Server not configured" }, { status: 500 });
        }
        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const now = new Date();
        const APP_URL = "https://studiehubb-xyz.lovable.app";

        // 1. Fetch users with any notification enabled
        const { data: settings, error: settingsError } = await supabase
          .from("user_settings")
          .select(
            "user_id,email_reminders_enabled,reminder_offsets,reminder_fallback_hour,daily_summary_enabled,weekly_summary_enabled,timezone,reminder_email,reminder_email_verified,push_enabled,push_deadline_reminders,push_offsets,push_daily_summary,push_weekly_summary,push_session_reminders,push_session_offset_minutes,push_quiet_hours_enabled,push_quiet_start_hour,push_quiet_end_hour",
          );
        if (settingsError) return Response.json({ error: settingsError.message }, { status: 500 });
        const activeUsers = (settings ?? []).filter(
          (s) =>
            s.email_reminders_enabled ||
            s.daily_summary_enabled ||
            s.weekly_summary_enabled ||
            s.push_enabled,
        );
        if (activeUsers.length === 0) return Response.json({ ok: true, users: 0 });

        // 2. Build user_id → email map via admin listUsers (paginated).
        const emails = new Map<string, { email: string; displayName: string | null }>();
        {
          let page = 1;
          while (true) {
            const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
            if (error) break;
            for (const u of data.users) {
              if (u.email) {
                emails.set(u.id, {
                  email: u.email,
                  displayName: (u.user_metadata?.display_name as string | undefined) ?? null,
                });
              }
            }
            if (data.users.length < 1000) break;
            page++;
          }
        }

        // 3. Fetch profiles for display names (fallback)
        const userIds = activeUsers.map((u) => u.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,display_name")
          .in("id", userIds);
        const displayNames = new Map<string, string | null>();
        for (const p of profiles ?? []) displayNames.set(p.id, p.display_name ?? null);

        // 4. Fetch tasks (open) + overrides + courses + sessions + push subscriptions
        const [{ data: tasks }, { data: overrides }, { data: courses }, { data: sessions }, pushSubs] =
          await Promise.all([
            supabase
              .from("tasks")
              .select("id,user_id,title,due_at,course_id,task_type,status")
              .in("user_id", userIds)
              .neq("status", "done")
              .not("due_at", "is", null)
              .gte("due_at", now.toISOString())
              .lte("due_at", new Date(now.getTime() + 14 * 86400_000).toISOString()),
            supabase
              .from("task_reminder_overrides")
              .select("task_id,offsets,disabled")
              .in("user_id", userIds),
            supabase.from("courses").select("id,name,code").in("user_id", userIds),
            supabase
              .from("study_sessions")
              .select("id,user_id,course_id,planned_start,planned_end")
              .in("user_id", userIds)
              .gte("planned_start", new Date(now.getTime() - 12 * 3600_000).toISOString())
              .lte("planned_start", new Date(now.getTime() + 24 * 3600_000).toISOString()),
            loadSubscriptionsByUser(supabase, userIds),
          ]);

        const overrideMap = new Map<string, { offsets: number[] | null; disabled: boolean }>();
        for (const o of overrides ?? [])
          overrideMap.set(o.task_id, { offsets: o.offsets, disabled: o.disabled });
        const courseMap = new Map<string, { name: string; code: string | null }>();
        for (const c of courses ?? []) courseMap.set(c.id, { name: c.name, code: c.code ?? null });

        // ---- helpers ----
        function isMidnightInTz(iso: string, tz: string): boolean {
          try {
            const parts = new Intl.DateTimeFormat("en-GB", {
              timeZone: tz,
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).formatToParts(new Date(iso));
            const h = parts.find((p) => p.type === "hour")?.value;
            const m = parts.find((p) => p.type === "minute")?.value;
            return h === "00" && m === "00";
          } catch {
            return false;
          }
        }
        /** Offset in minutes between UTC and the given time zone at instant d. */
        function tzOffsetMinutes(d: Date, tz: string): number {
          try {
            const parts = new Intl.DateTimeFormat("en-US", {
              timeZone: tz,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }).formatToParts(d);
            const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
            const asUTC = Date.UTC(
              get("year"),
              get("month") - 1,
              get("day"),
              get("hour") % 24,
              get("minute"),
              get("second"),
            );
            return (asUTC - d.getTime()) / 60000;
          } catch {
            return 0;
          }
        }
        /** Convert a local wall-clock time (y-m-d h:m in tz) to a UTC Date. */
        function zonedTimeToUtc(dateStr: string, hour: number, tz: string): Date {
          const naive = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00Z`);
          const offset = tzOffsetMinutes(naive, tz);
          return new Date(naive.getTime() - offset * 60_000);
        }
        function localHour(d: Date, tz: string): number {
          try {
            const s = new Intl.DateTimeFormat("en-GB", {
              timeZone: tz,
              hour: "2-digit",
              hour12: false,
            }).format(d);
            return parseInt(s, 10);
          } catch {
            return d.getUTCHours();
          }
        }
        function localDayOfWeek(d: Date, tz: string): number {
          const wk = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
          return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wk);
        }
        function localDateStr(d: Date, tz: string): string {
          const parts = new Intl.DateTimeFormat("sv-SE", {
            timeZone: tz,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).formatToParts(d);
          const y = parts.find((p) => p.type === "year")?.value ?? "";
          const m = parts.find((p) => p.type === "month")?.value ?? "";
          const day = parts.find((p) => p.type === "day")?.value ?? "";
          return `${y}-${m}-${day}`;
        }
        function isoWeek(d: Date): string {
          const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
          const dayNum = (t.getUTCDay() + 6) % 7;
          t.setUTCDate(t.getUTCDate() - dayNum + 3);
          const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
          const week =
            1 +
            Math.round(
              ((t.getTime() - firstThursday.getTime()) / 86400000 -
                3 +
                ((firstThursday.getUTCDay() + 6) % 7)) /
                7,
            );
          return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
        }
        function daysLeftLabel(due: Date, ref: Date): string {
          const diff = Math.round((due.getTime() - ref.getTime()) / 60000);
          if (diff < 60) return `${Math.max(1, diff)} min kvar`;
          if (diff < 24 * 60) return `${Math.round(diff / 60)} h kvar`;
          const days = Math.round(diff / (60 * 24));
          if (days === 1) return "1 dag kvar";
          return `${days} dagar kvar`;
        }
        function fmtDue(iso: string, tz: string): string {
          return new Intl.DateTimeFormat("sv-SE", {
            timeZone: tz,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(iso));
        }
        function fmtTime(iso: string, tz: string): string {
          return new Intl.DateTimeFormat("sv-SE", {
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(iso));
        }
        /** Reserve a dedupe key; returns true when this job may proceed. */
        async function reserve(
          userId: string,
          kind: string,
          dedupeKey: string,
          taskId?: string | null,
        ): Promise<boolean> {
          const { error } = await supabase.from("email_reminders_sent").insert({
            user_id: userId,
            task_id: taskId ?? null,
            kind,
            dedupe_key: dedupeKey,
          });
          return !error;
        }

        const results: Record<string, number> = {
          reminders: 0,
          daily: 0,
          weekly: 0,
          push_reminders: 0,
          push_sessions: 0,
          push_summaries: 0,
          skipped_no_email: 0,
        };

        for (const s of activeUsers) {
          const info = emails.get(s.user_id);
          const recipientEmail =
            s.reminder_email && s.reminder_email_verified ? s.reminder_email : info?.email;
          const tz = s.timezone || "Europe/Stockholm";
          const displayName =
            info?.displayName ||
            displayNames.get(s.user_id) ||
            recipientEmail?.split("@")[0] ||
            "du";

          const subs: PushSubscriptionRow[] = pushSubs.get(s.user_id) ?? [];
          const quietNow = (() => {
            if (!s.push_quiet_hours_enabled) return false;
            const h = localHour(now, tz);
            const start = s.push_quiet_start_hour ?? 23;
            const end = s.push_quiet_end_hour ?? 7;
            return start <= end ? h >= start && h < end : h >= start || h < end;
          })();
          const canPush = !!s.push_enabled && subs.length > 0 && !quietNow;

          const sendPush = async (payload: {
            title: string;
            body: string;
            url?: string;
            tag?: string;
          }) => {
            const res = await sendPushToSubscriptions(supabase, subs, payload);
            return res.sent > 0;
          };

          if (!recipientEmail && !canPush) {
            results.skipped_no_email++;
            continue;
          }

          const userTasks = (tasks ?? []).filter((t) => t.user_id === s.user_id);

          // --- Deadline reminders (email + push) ---
          const wantEmailReminders = !!s.email_reminders_enabled && !!recipientEmail;
          const wantPushReminders = canPush && !!s.push_deadline_reminders;

          if (wantEmailReminders || wantPushReminders) {
            for (const t of userTasks) {
              if (!t.due_at) continue;
              const ov = overrideMap.get(t.id);
              if (ov?.disabled) continue;
              const dueDate = new Date(t.due_at);
              const noTime = isMidnightInTz(t.due_at, tz);
              const cInfo = t.course_id ? courseMap.get(t.course_id) : null;

              const scheduleFor = (offsetMin: number): Date | null => {
                if (noTime) {
                  if (offsetMin < 60) return null;
                  const daysBefore = Math.round(offsetMin / (60 * 24));
                  const targetLocalDateStr = localDateStr(
                    new Date(dueDate.getTime() - daysBefore * 86400_000),
                    tz,
                  );
                  return zonedTimeToUtc(targetLocalDateStr, s.reminder_fallback_hour ?? 8, tz);
                }
                return new Date(dueDate.getTime() - offsetMin * 60_000);
              };
              const inWindow = (scheduled: Date | null): boolean => {
                if (!scheduled) return false;
                const diff = now.getTime() - scheduled.getTime();
                return diff >= 0 && diff <= 20 * 60_000;
              };

              if (wantEmailReminders) {
                const offsets = ov?.offsets ?? s.reminder_offsets ?? [10080, 4320, 1440, 120];
                for (const offsetMin of offsets) {
                  if (!inWindow(scheduleFor(offsetMin))) continue;
                  const dedupeKey = `reminder:${t.id}:${offsetMin}`;
                  if (!(await reserve(s.user_id, "reminder", dedupeKey, t.id))) continue;
                  const res = await enqueueTemplateEmail({
                    supabase,
                    templateName: "deadline-reminder",
                    recipientEmail: recipientEmail!,
                    idempotencyKey: dedupeKey,
                    templateData: {
                      taskTitle: t.title,
                      courseName: cInfo?.name ?? null,
                      courseCode: cInfo?.code ?? null,
                      dueLabel: fmtDue(t.due_at, tz),
                      timeLeftLabel: daysLeftLabel(dueDate, now),
                      taskType: t.task_type ?? "",
                      appUrl: APP_URL,
                    },
                  });
                  if (res.success) results.reminders++;
                }
              }

              if (wantPushReminders) {
                const pushOffsets = ov?.offsets ?? s.push_offsets ?? [1440, 120];
                for (const offsetMin of pushOffsets) {
                  if (!inWindow(scheduleFor(offsetMin))) continue;
                  const dedupeKey = `push-reminder:${t.id}:${offsetMin}`;
                  if (!(await reserve(s.user_id, "push_reminder", dedupeKey, t.id))) continue;
                  const ok = await sendPush({
                    title: `${daysLeftLabel(dueDate, now)}: ${t.title}`,
                    body: [cInfo?.code, cInfo?.name, fmtDue(t.due_at, tz)]
                      .filter(Boolean)
                      .join(" · "),
                    url: "/tasks",
                    tag: `task-${t.id}`,
                  });
                  if (ok) results.push_reminders++;
                }
              }
            }
          }

          // --- Study session start reminders (push only) ---
          if (canPush && s.push_session_reminders) {
            const offsetMin = s.push_session_offset_minutes ?? 15;
            const userSessions = (sessions ?? []).filter(
              (x) => x.user_id === s.user_id && x.planned_start,
            );
            for (const session of userSessions) {
              const start = new Date(session.planned_start);
              const scheduled = new Date(start.getTime() - offsetMin * 60_000);
              const diff = now.getTime() - scheduled.getTime();
              if (diff < 0 || diff > 20 * 60_000) continue;
              if (start.getTime() < now.getTime()) continue;
              const dedupeKey = `push-session:${session.id}:${offsetMin}`;
              if (!(await reserve(s.user_id, "push_session", dedupeKey))) continue;
              const cInfo = session.course_id ? courseMap.get(session.course_id) : null;
              const ok = await sendPush({
                title: "Studiepass snart",
                body: `${cInfo?.name ?? "Studiepass"} startar ${fmtTime(session.planned_start, tz)}`,
                url: "/time",
                tag: `session-${session.id}`,
              });
              if (ok) results.push_sessions++;
            }
          }

          const dateStr = localDateStr(now, tz);

          // --- Daily summary (fires at local hour 7) ---
          if (localHour(now, tz) === 7) {
            const todayEnd = new Date(now.getTime() + 48 * 3600_000);
            const dayTasks = userTasks
              .filter((t) => t.due_at && new Date(t.due_at) <= todayEnd)
              .map((t) => ({
                title: t.title,
                courseName: t.course_id ? (courseMap.get(t.course_id)?.name ?? null) : null,
                dueLabel: t.due_at ? fmtDue(t.due_at, tz) : "",
              }));
            const todaySessions = (sessions ?? [])
              .filter(
                (x) =>
                  x.user_id === s.user_id &&
                  x.planned_start &&
                  localDateStr(new Date(x.planned_start), tz) === dateStr,
              )
              .map((x) => ({
                title: (x.course_id && courseMap.get(x.course_id)?.name) || "Studiepass",
                startLabel: fmtTime(x.planned_start, tz),
              }));

            if (s.daily_summary_enabled && recipientEmail) {
              const dedupeKey = `daily:${dateStr}`;
              if (await reserve(s.user_id, "daily", dedupeKey)) {
                const res = await enqueueTemplateEmail({
                  supabase,
                  templateName: "daily-summary",
                  recipientEmail,
                  idempotencyKey: dedupeKey,
                  templateData: {
                    displayName,
                    dateLabel: dateStr,
                    tasks: dayTasks,
                    sessions: todaySessions,
                    appUrl: APP_URL,
                  },
                });
                if (res.success) results.daily++;
              }
            }

            if (canPush && s.push_daily_summary) {
              const dedupeKey = `push-daily:${dateStr}`;
              if (await reserve(s.user_id, "push_daily", dedupeKey)) {
                const ok = await sendPush({
                  title: "Dagens överblick",
                  body: `${dayTasks.length} deadline(s) närmast · ${todaySessions.length} studiepass idag`,
                  url: "/dashboard",
                  tag: `daily-${dateStr}`,
                });
                if (ok) results.push_summaries++;
              }
            }
          }

          // --- Weekly summary (Sunday 19:00 local) ---
          if (localDayOfWeek(now, tz) === 0 && localHour(now, tz) === 19) {
            const wk = isoWeek(now);
            const weekEnd = new Date(now.getTime() + 7 * 86400_000);
            const weekTasks = userTasks
              .filter((t) => t.due_at && new Date(t.due_at) <= weekEnd)
              .map((t) => ({
                title: t.title,
                courseName: t.course_id ? (courseMap.get(t.course_id)?.name ?? null) : null,
                dueLabel: t.due_at ? fmtDue(t.due_at, tz) : "",
              }));

            // Study hours last 7 days, derived from completed study sessions.
            const weekStart = new Date(now.getTime() - 7 * 86400_000);
            const { data: weekSessions } = await supabase
              .from("study_sessions")
              .select("planned_start,planned_end,actual_start,actual_end,completed")
              .eq("user_id", s.user_id)
              .eq("completed", true)
              .gte("planned_start", weekStart.toISOString());
            const totalMs = (weekSessions ?? []).reduce((acc, row) => {
              const start = new Date(row.actual_start ?? row.planned_start).getTime();
              const end = new Date(row.actual_end ?? row.planned_end).getTime();
              const dur = end - start;
              return acc + (Number.isFinite(dur) && dur > 0 ? dur : 0);
            }, 0);
            const hours = Math.round(totalMs / 360_000) / 10;

            if (s.weekly_summary_enabled && recipientEmail) {
              const dedupeKey = `weekly:${wk}`;
              if (await reserve(s.user_id, "weekly", dedupeKey)) {
                const res = await enqueueTemplateEmail({
                  supabase,
                  templateName: "weekly-summary",
                  recipientEmail,
                  idempotencyKey: dedupeKey,
                  templateData: {
                    displayName,
                    weekLabel: wk,
                    tasks: weekTasks,
                    studyHours: hours,
                    appUrl: APP_URL,
                  },
                });
                if (res.success) results.weekly++;
              }
            }

            if (canPush && s.push_weekly_summary) {
              const dedupeKey = `push-weekly:${wk}`;
              if (await reserve(s.user_id, "push_weekly", dedupeKey)) {
                const ok = await sendPush({
                  title: `Veckan ${wk}`,
                  body: `${hours} h studietid senaste veckan · ${weekTasks.length} deadlines framåt`,
                  url: "/stats",
                  tag: `weekly-${wk}`,
                });
                if (ok) results.push_summaries++;
              }
            }
          }
        }

        return Response.json({ ok: true, ...results });
      },
    },
  },
});
