import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requestReminderEmailVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new Error("Ogiltig e-postadress");
    }

    // Generera 6-siffrig kod
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const sentAt = new Date().toISOString();

    // Spara i user_settings
    const { error: dbErr } = await context.supabase
      .from("user_settings")
      .update({
        reminder_email: email,
        reminder_email_verified: false,
        reminder_email_verification_code: code,
        reminder_email_verification_sent_at: sentAt,
      })
      .eq("user_id", context.userId);

    if (dbErr) throw new Error(dbErr.message);

    // Skapa service-role klient för e-postutskick (eftersom e-posttabeller kräver service_role)
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Servern saknar konfiguration för e-postutskick (SUPABASE_SERVICE_ROLE_KEY)");
    }
    const { createClient } = await import("@supabase/supabase-js");
    const serviceRoleSupabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Skicka verifieringsmejl
    const { enqueueTemplateEmail } = await import("@/lib/email/enqueue.server");
    const emailRes = await enqueueTemplateEmail({
      supabase: serviceRoleSupabase,
      templateName: "verify-reminder-email",
      recipientEmail: email,
      idempotencyKey: `verify:${context.userId}:${sentAt}`,
      templateData: { code },
    });

    if (!emailRes.success) {
      throw new Error(emailRes.reason ?? "Kunde inte skicka verifieringsmejl");
    }

    return { success: true };
  });

export const verifyReminderEmailCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const code = data.code.trim();

    // Hämta inställningar
    const { data: settings, error: getErr } = await context.supabase
      .from("user_settings")
      .select("reminder_email_verification_code, reminder_email_verification_sent_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (getErr || !settings) {
      throw new Error("Kunde inte hämta inställningar");
    }

    const savedCode = settings.reminder_email_verification_code;
    const sentAt = settings.reminder_email_verification_sent_at;

    if (!savedCode || savedCode !== code) {
      throw new Error("Felaktig verifieringskod");
    }

    if (sentAt) {
      const diffMin = (Date.now() - new Date(sentAt).getTime()) / 60000;
      if (diffMin > 15) {
        throw new Error("Koden har gått ut (giltig i 15 minuter)");
      }
    }

    // Verifiera i databasen
    const { error: updErr } = await context.supabase
      .from("user_settings")
      .update({
        reminder_email_verified: true,
        reminder_email_verification_code: null,
        reminder_email_verification_sent_at: null,
      })
      .eq("user_id", context.userId);

    if (updErr) throw new Error(updErr.message);

    return { success: true };
  });

export const sendTestReminderEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Hämta inställningar för att se om det finns en verifierad e-post
    const { data: settings, error: getErr } = await context.supabase
      .from("user_settings")
      .select("reminder_email, reminder_email_verified")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (getErr || !settings) {
      throw new Error("Kunde inte hämta inställningar");
    }

    let recipientEmail = "";
    if (settings.reminder_email && settings.reminder_email_verified) {
      recipientEmail = settings.reminder_email;
    } else {
      // Hämta primär e-post från auth
      const { data: u } = await context.supabase.auth.getUser();
      if (!u.user?.email) throw new Error("Kunde inte hitta inloggad e-postadress");
      recipientEmail = u.user.email;
    }

    const now = new Date();
    const mockDedupeKey = `test-reminder:${context.userId}:${now.getTime()}`;

    // Skapa service-role klient för e-postutskick
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Servern saknar konfiguration för e-postutskick (SUPABASE_SERVICE_ROLE_KEY)");
    }
    const { createClient } = await import("@supabase/supabase-js");
    const serviceRoleSupabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Skicka testmejl
    const { enqueueTemplateEmail } = await import("@/lib/email/enqueue.server");
    const emailRes = await enqueueTemplateEmail({
      supabase: serviceRoleSupabase,
      templateName: "deadline-reminder",
      recipientEmail,
      idempotencyKey: mockDedupeKey,
      templateData: {
        taskTitle: "Testpåminnelse: Öva på datastrukturer",
        courseName: "KTH - Programutveckling",
        dueLabel: new Intl.DateTimeFormat("sv-SE", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(now.getTime() + 2 * 3600_000)),
        timeLeftLabel: "2 timmar kvar",
        taskType: "Övning",
        appUrl: "https://studiehubb-xyz.lovable.app",
      },
    });

    if (!emailRes.success) {
      throw new Error(emailRes.reason ?? "Kunde inte skicka testmejl");
    }

    return { success: true, email: recipientEmail };
  });
