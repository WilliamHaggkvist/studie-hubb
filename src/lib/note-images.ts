import { supabase } from "@/integrations/supabase/client";

/**
 * Upload an image file for notes to Supabase Storage 'course-files' bucket.
 * Returns the permanent public URL for the uploaded image.
 */
export async function uploadNoteImage(file: File): Promise<string> {
  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr || !u.user) {
    throw new Error("Du måste vara inloggad för att ladda upp bilder.");
  }

  // Validate image type
  if (!file.type.startsWith("image/")) {
    throw new Error("Endast bildfiler stöds (PNG, JPG, WebP, GIF, etc).");
  }

  // 15 MB max
  const maxBytes = 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("Bilden är för stor (max 15 MB).");
  }

  const ext = file.name.split(".").pop() || "png";
  const cleanBase = file.name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 30);
  const path = `${u.user.id}/notes/${Date.now()}-${cleanBase}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("course-files")
    .upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });

  if (upErr) {
    throw new Error(`Kunde inte ladda upp bild: ${upErr.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("course-files")
    .getPublicUrl(path);

  if (!urlData?.publicUrl) {
    throw new Error("Kunde inte hämta publik URL för den uppladdade bilden.");
  }

  return urlData.publicUrl;
}
