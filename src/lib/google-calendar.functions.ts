import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

type GEvent = {
  id: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
};

export const syncGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_CALENDAR_API_KEY;
    if (!lovableKey || !connKey) {
      throw new Error(
        "Google Calendar-connectorn är inte kopplad. Länka den via Lovables inställningar för att aktivera synk.",
      );
    }

    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString();

    // List calendarIds — use primary only for v0
    const url = new URL(`${GATEWAY_URL}/calendars/primary/events`);
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "500");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connKey,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Calendar API-fel (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { items?: GEvent[] };
    const items = json.items ?? [];

    let imported = 0;
    let sessions = 0;
    const rows: Array<Record<string, unknown>> = [];

    for (const ev of items) {
      if (ev.status === "cancelled") continue;
      const startsRaw = ev.start?.dateTime ?? ev.start?.date;
      const endsRaw = ev.end?.dateTime ?? ev.end?.date ?? startsRaw;
      if (!startsRaw || !endsRaw) continue;
      const allDay = !ev.start?.dateTime;
      const title = ev.summary ?? "(utan titel)";
      const isSession = title.startsWith("[Studiepass]");

      if (isSession) {
        const { error } = await context.supabase
          .from("study_sessions")
          .upsert(
            {
              user_id: context.userId,
              planned_start: new Date(startsRaw).toISOString(),
              planned_end: new Date(endsRaw).toISOString(),
              notes: title.replace("[Studiepass]", "").trim() || null,
              source: "google",
              google_event_id: ev.id,
            },
            { onConflict: "google_event_id" },
          );
        if (!error) sessions++;
        continue;
      }

      rows.push({
        user_id: context.userId,
        title,
        location: ev.location ?? null,
        starts_at: new Date(startsRaw).toISOString(),
        ends_at: new Date(endsRaw).toISOString(),
        all_day: allDay,
        source: "google",
        external_id: ev.id,
        counts_as_study: false,
      });
    }

    if (rows.length > 0) {
      const { error, count } = await context.supabase
        .from("calendar_events")
        .upsert(rows, { onConflict: "external_id", count: "exact" });
      if (error) throw new Error(error.message);
      imported = count ?? rows.length;
    }

    return { imported, sessions, total: items.length };
  });
