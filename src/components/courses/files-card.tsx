import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Plus, FileText, Download, Trash2, Eye } from "lucide-react";

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

  // Preview state
  const [previewFile, setPreviewFile] = useState<CourseFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
  const isPdf = (name: string) => /\.pdf$/i.test(name);

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

  async function openPreview(f: CourseFile) {
    setPreviewFile(f);
    setLoadingPreview(true);
    const { data, error } = await supabase.storage
      .from("course-files")
      .createSignedUrl(f.storage_path, 3600); // 1 hour access
    if (error || !data) {
      toast.error("Kunde inte öppna förhandsvisning");
      setPreviewFile(null);
      setLoadingPreview(false);
      return;
    }
    setPreviewUrl(data.signedUrl);
    setLoadingPreview(false);
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
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2/60 group"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <button
                type="button"
                className="min-w-0 flex-1 text-left truncate hover:underline cursor-pointer font-medium"
                onClick={() => openPreview(f)}
                title="Klicka för att förhandsvisa"
              >
                {f.name}
              </button>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {f.size_bytes ? `${Math.round(f.size_bytes / 1024)} kB` : ""}
              </span>
              <button
                type="button"
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => openPreview(f)}
                title="Förhandsvisa"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => download(f)}
                title="Ladda ned"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                onClick={() => remove(f)}
                title="Ta bort"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog
        open={!!previewFile}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewFile(null);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[90vw] h-[85vh] flex flex-col p-6 glass rounded-2xl border-white/5">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/10 space-y-0 shrink-0">
            <DialogTitle className="font-display truncate pr-8 text-base">
              {previewFile?.name}
            </DialogTitle>
            {previewFile && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 rounded-xl mr-6 cursor-pointer"
                onClick={() => download(previewFile)}
              >
                <Download className="h-3.5 w-3.5" /> Ladda ned
              </Button>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0 mt-4 relative">
            {loadingPreview ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Laddar förhandsvisning...
              </div>
            ) : previewUrl ? (
              isImage(previewFile?.name || "") ? (
                <div className="w-full h-full flex items-center justify-center bg-black/10 rounded-lg p-2 overflow-auto">
                  <img
                    src={previewUrl}
                    alt={previewFile?.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                  />
                </div>
              ) : isPdf(previewFile?.name || "") ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full rounded-lg bg-white"
                  title={previewFile?.name}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Förhandsvisning stöds ej för denna filtyp.
                  </p>
                  <Button
                    onClick={() => download(previewFile!)}
                    className="gap-2 rounded-xl"
                  >
                    <Download className="h-4 w-4" /> Ladda ned och läs
                  </Button>
                </div>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
