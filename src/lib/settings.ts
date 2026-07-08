import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UserSettings = {
  user_id: string;
  current_year: number;
  density: string;
  translucent: boolean;
  google_connected: boolean;
  google_calendar_id: string | null;
  email_reminders_enabled: boolean;
  reminder_offsets: number[];
  reminder_fallback_hour: number;
  daily_summary_enabled: boolean;
  weekly_summary_enabled: boolean;
  timezone: string;
};

export type University = {
  id: string;
  name: string;
  sort_order: number;
};

export function useUserSettings() {
  return useQuery({
    queryKey: ["user_settings"],
    queryFn: async (): Promise<UserSettings | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        // Ensure row exists (may not for pre-existing users).
        const { data: created } = await supabase
          .from("user_settings")
          .insert({ user_id: u.user.id })
          .select("*")
          .single();
        return created;
      }
      return data;
    },
  });
}

export function useUniversities() {
  return useQuery({
    queryKey: ["universities"],
    queryFn: async (): Promise<University[]> => {
      const { data, error } = await supabase
        .from("universities")
        .select("id,name,sort_order")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}
