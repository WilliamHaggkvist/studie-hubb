import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "course-files";
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const SIGN_MARKER = `/storage/v1/object/sign/${BUCKET}/`;

/** Extracts the storage path from a stored URL, if it points at our bucket. */
export function storagePathFromUrl(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return null;
  for (const marker of [PUBLIC_MARKER, SIGN_MARKER]) {
    const i = url.indexOf(marker);
    if (i !== -1) return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  }
  if (!/^https?:\/\//.test(url)) return url.replace(/^\/+/, "");
  return null;
}

/**
 * Returns a usable URL for display/download. Storage files get a fresh
 * signed URL (the bucket is private); data-URLs and external links pass through.
 */
export async function resolveFileUrl(url: string): Promise<string | null> {
  const path = storagePathFromUrl(url);
  if (!path) return url || null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

export function useSignedUrl(url?: string | null) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!url) {
      setResolved(null);
      return;
    }
    resolveFileUrl(url).then((u) => {
      if (active) setResolved(u);
    });
    return () => {
      active = false;
    };
  }, [url]);

  return resolved;
}

/** <img> that resolves private storage URLs to signed URLs before rendering. */
export function SignedImage({
  url,
  ...props
}: { url?: string | null } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src">) {
  const src = useSignedUrl(url);
  if (!src) return null;
  return <img src={src} {...props} />;
}
