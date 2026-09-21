import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public VAPID key so the browser can create a push subscription. */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null };
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      endpoint: string;
      p256dh: string;
      auth: string;
      userAgent?: string | null;
      deviceLabel?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    if (!data.endpoint || !data.p256dh || !data.auth) {
      throw new Error("Ogiltig push-prenumeration");
    }
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
        device_label: data.deviceLabel ?? null,
        failure_count: 0,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const listPushDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("push_subscriptions")
      .select("id,endpoint,device_label,created_at,last_success_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: subs, error } = await context.supabase
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    if (!subs || subs.length === 0) {
      throw new Error("Ingen enhet är registrerad för push-notiser");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) throw new Error("Servern saknar konfiguration");
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { sendPushToSubscriptions } = await import("@/lib/push/send.server");
    const result = await sendPushToSubscriptions(admin, subs, {
      title: "StudieHubb – testnotis",
      body: "Push-notiser fungerar på den här enheten.",
      url: "/dashboard",
      tag: "test",
    });

    if (result.sent === 0) {
      throw new Error("Notisen kunde inte levereras till någon enhet");
    }
    return result;
  });
