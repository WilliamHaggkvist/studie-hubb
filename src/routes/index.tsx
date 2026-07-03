import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Only runs client-side reliably; SSR won't have session. We still redirect from client.
    if (typeof window !== "undefined") {
      const { data } = await supabase.auth.getSession();
      if (data.session) throw redirect({ to: "/dashboard" });
      throw redirect({ to: "/auth" });
    }
  },
  component: () => null,
});
