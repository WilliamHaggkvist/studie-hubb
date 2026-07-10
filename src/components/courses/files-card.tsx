import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Plus, FileText, Download, Trash2 } from "lucide-react";

type CourseFile = {
  id: string;
  storage_path: string;
  name: string;
  size_bytes: number | null;
  created_at: string;
};

export function FilesCard({
  courseId,
  files,
  color,
}: {
  courseId: string;
  files: CourseFile[];
  color: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setUploading(false);
      return;
    }
    const path = `${u.user.id}/${courseId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("course-files")
      .upload(path, file, { upsert: false });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    const { error: insErr } = await supabase.from("course_files").insert({
      user_id: u.user.id,
      course_id: courseId,
      storage_path: path,
      name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });
    if (insErr) toast.error(insErr.message);
    else {
      toast.success("Fil uppladdad");
      qc.invalidateQueries({ queryKey: ["course_files", courseId] });
    }
    setUploading(false);
  }

  async function download(f: CourseFile) {
    const { data, error } = await supabase.storage
      .from("course-files")
      .createSignedUrl(f.storage_path, 60);
    if (error || !data) return toast.error("Kunde inte hämta fil");
    window.open(data.signedUrl, "_blank");
  }

  async function remove(f: CourseFile) {
    if (!confirm(`Ta bort ${f.name}?`)) return;
    await supabase.storage.from("course-files").remove([f.storage_path]);
    await supabase.from("course_files").delete().eq("id", f.id);
    qc.invalidateQueries({ queryKey: ["course_files", courseId] });
  }

  return (
    <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl lg:col-span-2">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Upload className="h-4 w-4" style={{ color }} /> Kursfiler
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 rounded-xl"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Plus className="h-3.5 w-3.5" /> {uploading ? "Laddar upp…" : "Ladda upp"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </CardHeader>
      <CardContent>
        {files.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            Inga filer — ladda upp kurs-PM, schema och andra dokument.
          </div>
        )}
        <div className="space-y-1">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2/60"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {f.size_bytes ? `${Math.round(f.size_bytes / 1024)} kB` : ""}
              </span>
              <button
                className="p-1 text-muted-foreground hover:text-foreground"
                onClick={() => download(f)}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                className="p-1 text-muted-foreground hover:text-destructive"
                onClick={() => remove(f)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
