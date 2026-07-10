import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { syncGoogleCalendarForUser } from "@/lib/google-calendar.server";

export const Route = createFileRoute("/api/public/hooks/sync-google-calendar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        // Hämta alla distinkta användare med minst en aktiv kalender-pref
        const { data: prefs, error } = await supabase
          .from("google_calendar_prefs")
          .select("user_id")
          .eq("sync_enabled", true);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const userIds = Array.from(new Set((prefs ?? []).map((p) => p.user_id)));

        const results: Array<{ user_id: string; ok: boolean; error?: string; imported?: number }> =
          [];
        for (const uid of userIds) {
          try {
            const r = await syncGoogleCalendarForUser(supabase, uid);
            results.push({ user_id: uid, ok: true, imported: r.imported });
          } catch (e) {
            results.push({
              user_id: uid,
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        return new Response(JSON.stringify({ users: userIds.length, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
