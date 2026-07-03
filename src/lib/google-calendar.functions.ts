import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

type GCalendarListEntry = {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
};

function gatewayHeadersLocal() {
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

export const listGoogleCalendars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const res = await fetch(`${GATEWAY_URL}/users/me/calendarList`, {
      headers: gatewayHeadersLocal(),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Calendar API-fel (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { items?: GCalendarListEntry[] };
    const items = json.items ?? [];

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

export const syncGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncGoogleCalendarForUser } = await import("@/lib/google-calendar.server");
    return await syncGoogleCalendarForUser(context.supabase, context.userId);
  });
