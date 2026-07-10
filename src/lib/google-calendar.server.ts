import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

type GEvent = {
  id: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
};

export function parseCourseCode(title: string): string | null {
  const m = title.match(/\[([A-Za-zÅÄÖåäö0-9]{2,10})\]/);
  return m ? m[1].toUpperCase() : null;
}

export function gatewayHeaders() {
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

/**
 * Kör synk för en specifik användare. supabase-klienten måste ha rättigheter att
 * läsa/skriva raderna för användaren (RLS-scoped user client eller service-role).
 */
export async function syncGoogleCalendarForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const headers = gatewayHeaders();
  const now = new Date();
  const timeMin = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString();

  const { data: prefs, error: prefsErr } = await supabase
    .from("google_calendar_prefs")
    .select("google_calendar_id, counts_as_study, sync_enabled")
    .eq("user_id", userId)
    .eq("sync_enabled", true);
  if (prefsErr) throw new Error(prefsErr.message);

  const targets =
    prefs && prefs.length > 0
      ? prefs
      : [{ google_calendar_id: "primary", counts_as_study: false, sync_enabled: true }];

  const { data: courses } = await supabase
    .from("courses")
    .select("id, code")
    .eq("user_id", userId)
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
  const seenSessionIds = new Set<string>();
  const seenEventIds = new Set<string>();
  let sessions = 0;
  let mapped = 0;
  let unmapped = 0;
  let totalItems = 0;

  let fetchFailed = false;

  for (const t of targets) {
    let pageToken: string | undefined = undefined;

    do {
      const url = new URL(
        `${GATEWAY_URL}/calendars/${encodeURIComponent(t.google_calendar_id)}/events`,
      );
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "250");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        fetchFailed = true;
        break; // Avbryt denna kalender
      }

      const json = (await res.json()) as { items?: GEvent[]; nextPageToken?: string };
      const items = json.items ?? [];
      totalItems += items.length;
      pageToken = json.nextPageToken;

      for (const ev of items) {
        if (ev.status === "cancelled") continue;
        const startsRaw = ev.start?.dateTime ?? ev.start?.date;
        const endsRaw = ev.end?.dateTime ?? ev.end?.date ?? startsRaw;
        if (!startsRaw || !endsRaw) continue;
        const allDay = !ev.start?.dateTime;
        const title = ev.summary ?? "(utan titel)";
        const isTaggedSession = title.startsWith("[Studiepass]");
        const isSession = isTaggedSession || !!t.counts_as_study;

        if (isSession) {
          seenSessionIds.add(ev.id);
          const code = parseCourseCode(title);
          const courseId = code ? (codeMap.get(code) ?? null) : null;
          // Scope by user_id — annars kan sync (som service_role via cron)
          // matcha en annan användares rad med samma google_event_id.
          const { data: existingRecords } = await supabase
            .from("study_sessions")
            .select("id")
            .eq("user_id", userId)
            .eq("google_event_id", ev.id);

          const base = {
            user_id: userId,
            planned_start: new Date(startsRaw).toISOString(),
            planned_end: new Date(endsRaw).toISOString(),
            notes: isTaggedSession ? title.replace("[Studiepass]", "").trim() || null : title,
            source: "google",
            google_event_id: ev.id,
          };

          if (existingRecords && existingRecords.length > 0) {
            const existing = existingRecords[0];

            if (existingRecords.length > 1) {
              const duplicateIds = existingRecords.slice(1).map((r) => r.id);
              await supabase
                .from("study_sessions")
                .delete()
                .eq("user_id", userId)
                .in("id", duplicateIds);
            }

            const { error } = await supabase
              .from("study_sessions")
              .update(base)
              .eq("id", existing.id)
              .eq("user_id", userId);
            if (!error) sessions++;
          } else {
            const { error } = await supabase
              .from("study_sessions")
              .insert({ ...base, course_id: courseId, needs_review: true });
            if (!error) sessions++;
          }
          continue;
        }

        seenEventIds.add(ev.id);
        const code = parseCourseCode(title);
        const courseId = code ? (codeMap.get(code) ?? null) : null;
        if (courseId) mapped++;
        else unmapped++;

        rows.push({
          user_id: userId,
          title,
          location: ev.location ?? null,
          starts_at: new Date(startsRaw).toISOString(),
          ends_at: new Date(endsRaw).toISOString(),
          all_day: allDay,
          source: "google",
          external_id: ev.id,
          counts_as_study: false,
          course_id: courseId,
        });
      }
    } while (pageToken);
  }

  let imported = 0;
  if (rows.length > 0) {
    const { error, count } = await supabase
      .from("calendar_events")
      .upsert(rows, { onConflict: "user_id,external_id", count: "exact" });
    if (error) throw new Error(error.message);
    imported = count ?? rows.length;
  }

  // Google är källan – ta bort pass/event som inte längre finns där inom synkfönstret.
  // Skydd:
  //  * fetchFailed = någon kalender-sida gav fel → hoppa över radering (undvik dataförlust)
  //  * totalItems === 0 = Google returnerade inget alls → misstänkt tomt svar, hoppa över
  //  * Bara rader med google_event_id/external_id satt raderas
  //  * Studiepass som användaren redan har startat/genomfört behålls oavsett
  if (!fetchFailed && totalItems > 0) {
    const inList = (ids: string[]) => `(${ids.map((id) => `"${id.replace(/"/g, "")}"`).join(",")})`;

    {
      let q = supabase
        .from("study_sessions")
        .delete()
        .eq("user_id", userId)
        .eq("source", "google")
        .not("google_event_id", "is", null)
        .is("actual_start", null)
        .eq("completed", false)
        .gte("planned_start", timeMin)
        .lte("planned_start", timeMax);
      if (seenSessionIds.size > 0) {
        q = q.not("google_event_id", "in", inList(Array.from(seenSessionIds)));
      }
      await q;
    }
    {
      let q = supabase
        .from("calendar_events")
        .delete()
        .eq("user_id", userId)
        .eq("source", "google")
        .not("external_id", "is", null)
        .gte("starts_at", timeMin)
        .lte("starts_at", timeMax);
      if (seenEventIds.size > 0) {
        q = q.not("external_id", "in", inList(Array.from(seenEventIds)));
      }
      await q;
    }
  }

  return {
    imported,
    sessions,
    mapped,
    unmapped,
    calendars: targets.length,
    total: totalItems,
  };
}
