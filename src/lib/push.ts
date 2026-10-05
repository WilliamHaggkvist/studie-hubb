/** Client helpers for browser/phone push notifications (Web Push + VAPID). */

export type PushStatus =
  | "unsupported"
  | "open-in-new-tab"
  | "denied"
  | "not-configured"
  | "subscribed"
  | "unsubscribed";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function inIframe(): boolean {
  return typeof window !== "undefined" && window.top !== window.self;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android-telefon";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows-dator";
  return "Enhet";
}

export async function enablePush(): Promise<{ status: PushStatus }> {
  if (!pushSupported()) return { status: "unsupported" };
  if (inIframe()) return { status: "open-in-new-tab" };

  const { getPushPublicKey, savePushSubscription } = await import("@/lib/push.functions");
  const { publicKey } = await getPushPublicKey();
  if (!publicKey) return { status: "not-configured" };

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const reg = await registration();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    });
  }

  await savePushSubscription({
    data: {
      endpoint: sub.endpoint,
      p256dh: bufToBase64Url(sub.getKey("p256dh")),
      auth: bufToBase64Url(sub.getKey("auth")),
      userAgent: navigator.userAgent,
      deviceLabel: deviceLabel(),
    },
  });

  return { status: "subscribed" };
}

export async function disablePush(): Promise<{ status: PushStatus }> {
  const sub = await getExistingSubscription();
  if (sub) {
    const { removePushSubscription } = await import("@/lib/push.functions");
    try {
      await removePushSubscription({ data: { endpoint: sub.endpoint } });
    } catch {
      /* ignore */
    }
    await sub.unsubscribe();
  }
  return { status: "unsubscribed" };
}
