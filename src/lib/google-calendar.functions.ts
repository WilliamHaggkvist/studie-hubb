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

type GCalendarListEntry = {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
};

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error(
      "Google Calendar-connectorn är inte kopplad. Länka den via Lovables inställningar för att aktivera synk.",
    );
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
  };
}

/** Plockar första [KURSKOD] ur en titel (2–10 tecken, bokstäver/siffror). */
export function parseCourseCode(title: string): string | null {
  const m = title.match(/\[([A-Za-zÅÄÖåäö0-9]{2,10})\]/);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Hämtar användarens Google-kalendrar och upsertar dem i google_calendar_prefs.
 * Bevarar sync_enabled / counts_as_study för befintliga rader.
 */
export const listGoogleCalendars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const res = await fetch(`${GATEWAY_URL}/users/me/calendarList`, {
      headers: gatewayHeaders(),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Calendar API-fel (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { items?: GCalendarListEntry[] };
    const items = json.items ?? [];

    // Läs befintliga prefs så vi inte överskriver toggles
    const { data: existing } = await context.supabase
      .from("google_calendar_prefs")
      .select("google_calendar_id, sync_enabled, counts_as_study")
      .eq("user_id", context.userId);
    const existingMap = new Map(
      (existing ?? []).map((r) => [r.google_calendar_id, r]),
    );

    const rows = items.map((c) => {
      const prev = existingMap.get(c.id);
      return {
        user_id: context.userId,
        google_calendar_id: c.id,
        name: c.summaryOverride ?? c.summary ?? c.id,
        background_color: c.backgroundColor ?? null,
        sync_enabled: prev?.sync_enabled ?? c.primary === true,
        counts_as_study: prev?.counts_as_study ?? false,
      };
    });

    if (rows.length > 0) {
      const { error } = await context.supabase
        .from("google_calendar_prefs")
        .upsert(rows, { onConflict: "user_id,google_calendar_id" });
      if (error) throw new Error(error.message);
    }

    const { data: prefs, error: prefsErr } = await context.supabase
      .from("google_calendar_prefs")
      .select("id, google_calendar_id, name, background_color, sync_enabled, counts_as_study")
      .eq("user_id", context.userId)
      .order("name");
    if (prefsErr) throw new Error(prefsErr.message);

    return { calendars: prefs ?? [] };
  });

/** Uppdaterar sync_enabled / counts_as_study för en kalender. */
export const updateCalendarPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; sync_enabled?: boolean; counts_as_study?: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const patch: { sync_enabled?: boolean; counts_as_study?: boolean } = {};
    if (typeof data.sync_enabled === "boolean") patch.sync_enabled = data.sync_enabled;
    if (typeof data.counts_as_study === "boolean") patch.counts_as_study = data.counts_as_study;
    const { error } = await context.supabase
      .from("google_calendar_prefs")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Synkar events från alla kalendrar där sync_enabled = true. */
export const syncGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const headers = gatewayHeaders();

    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString();

    // Hämta valda kalendrar
    const { data: prefs, error: prefsErr } = await context.supabase
      .from("google_calendar_prefs")
      .select("google_calendar_id, counts_as_study, sync_enabled")
      .eq("user_id", context.userId)
      .eq("sync_enabled", true);
    if (prefsErr) throw new Error(prefsErr.message);

    // Fallback: om inga prefs finns alls → använd 'primary' (bakåtkompatibelt)
    const targets =
      prefs && prefs.length > 0
        ? prefs
        : [{ google_calendar_id: "primary", counts_as_study: false, sync_enabled: true }];

    // Ladda kurs → id map
    const { data: courses } = await context.supabase
      .from("courses")
      .select("id, code")
      .eq("user_id", context.userId)
      .not("code", "is", null);
    const codeMap = new Map<string, string>();
    for (const c of courses ?? []) {
      if (c.code) codeMap.set(c.code.toUpperCase(), c.id);
    }

    type EventRow = {
      user_id: string;
      title: string;
      location: string | null;
      starts_at: string;
      ends_at: string;
      all_day: boolean;
      source: string;
      external_id: string;
      counts_as_study: boolean;
      course_id: string | null;
    };
    const rows: EventRow[] = [];
    let sessions = 0;
    let mapped = 0;
    let unmapped = 0;
    let totalItems = 0;

    for (const t of targets) {
      const url = new URL(
        `${GATEWAY_URL}/calendars/${encodeURIComponent(t.google_calendar_id)}/events`,
      );
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "500");
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        // Hoppa över kalendrar som t.ex. inte längre finns
        continue;
      }
      const json = (await res.json()) as { items?: GEvent[] };
      const items = json.items ?? [];
      totalItems += items.length;

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

        const code = parseCourseCode(title);
        const courseId = code ? codeMap.get(code) ?? null : null;
        if (courseId) mapped++;
        else unmapped++;

        rows.push({
          user_id: context.userId,
          title,
          location: ev.location ?? null,
          starts_at: new Date(startsRaw).toISOString(),
          ends_at: new Date(endsRaw).toISOString(),
          all_day: allDay,
          source: "google",
          external_id: ev.id,
          counts_as_study: !!t.counts_as_study,
          course_id: courseId,
        });
      }
    }

    let imported = 0;
    if (rows.length > 0) {
      const { error, count } = await context.supabase
        .from("calendar_events")
        .upsert(rows, { onConflict: "user_id,external_id", count: "exact" });
      if (error) throw new Error(error.message);
      imported = count ?? rows.length;
    }

    return {
      imported,
      sessions,
      mapped,
      unmapped,
      calendars: targets.length,
      total: totalItems,
    };
  });
