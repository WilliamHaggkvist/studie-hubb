import { ApplicationServerKeys, generatePushHTTPRequest } from "webpush-webcrypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let cachedKeys: ApplicationServerKeys | null = null;

async function getKeys(): Promise<ApplicationServerKeys> {
  if (cachedKeys) return cachedKeys;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID-nycklar saknas på servern");
  cachedKeys = await ApplicationServerKeys.fromJSON({ publicKey, privateKey });
  return cachedKeys;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

/**
 * Send a push notification to a set of subscriptions.
 * Dead subscriptions (404/410) are deleted; other failures bump failure_count.
 */
export async function sendPushToSubscriptions(
  supabase: SupabaseClient<any, any>,
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<{ sent: number; removed: number; failed: number }> {
  if (subscriptions.length === 0) return { sent: 0, removed: 0, failed: 0 };

  const keys = await getKeys();
  const adminContact = process.env.VAPID_SUBJECT || "mailto:noreply@studiehubb.xyz";
  const json = JSON.stringify(payload);

  let sent = 0;
  let removed = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      const { headers, body, endpoint } = await generatePushHTTPRequest({
        applicationServerKeys: keys,
        payload: json,
        target: {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        adminContact,
        ttl: 12 * 3600,
        urgency: "normal",
      });

      const res = await fetch(endpoint, { method: "POST", headers, body });

      if (res.ok) {
        sent++;
        await supabase
          .from("push_subscriptions")
          .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq("id", sub.id);
        continue;
      }

      if (res.status === 404 || res.status === 410) {
        removed++;
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        continue;
      }

      failed++;
      const text = await res.text();
      console.error("Push send failed", { status: res.status, body: text.slice(0, 500) });
      await supabase.rpc("noop").catch(() => {});
      const { data: row } = await supabase
        .from("push_subscriptions")
        .select("failure_count")
        .eq("id", sub.id)
        .maybeSingle();
      const nextCount = ((row?.failure_count as number | undefined) ?? 0) + 1;
      if (nextCount >= 10) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        await supabase
          .from("push_subscriptions")
          .update({ failure_count: nextCount })
          .eq("id", sub.id);
      }
    } catch (error) {
      failed++;
      console.error("Push send threw", error);
    }
  }

  return { sent, removed, failed };
}

/** Fetch all push subscriptions for the given users, grouped by user id. */
export async function loadSubscriptionsByUser(
  supabase: SupabaseClient<any, any>,
  userIds: string[],
): Promise<Map<string, PushSubscriptionRow[]>> {
  const map = new Map<string, PushSubscriptionRow[]>();
  if (userIds.length === 0) return map;
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .in("user_id", userIds);
  if (error) {
    console.error("Failed to load push subscriptions", error);
    return map;
  }
  for (const row of data ?? []) {
    const list = map.get(row.user_id) ?? [];
    list.push({ id: row.id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
    map.set(row.user_id, list);
  }
  return map;
}
