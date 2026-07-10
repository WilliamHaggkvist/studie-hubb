import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw redirect({ to: "/auth" });
      return { session: data.session };
    }
    return { session: null };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
