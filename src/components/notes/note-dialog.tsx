import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BlockEditor, type Block } from "@/components/block-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  Check,
  Loader2,
  Maximize2,
  MoreHorizontal,
  Star,
  Trash2,
  BookOpen,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PageFull = {
  id: string;
  title: string;
  icon: string | null;
  parent_id: string | null;
  content: Block[] | null;
  is_favorite: boolean;
  updated_at: string;
  course_id: string | null;
};

interface NoteDialogProps {
  noteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId?: string;
  courseName?: string;
  courseColor?: string;
  onDeleted?: () => void;
}

export function NoteDialog({
  noteId,
  open,
  onOpenChange,
  courseId,
  courseName,
  courseColor,
  onDeleted,
}: NoteDialogProps) {
  const qc = useQueryClient();

  const { data: page, isLoading } = useQuery({
    queryKey: ["page", noteId],
    queryFn: async () => {
      if (!noteId) return null;
      const { data, error } = await supabase
        .from("pages")
        .select("id,title,icon,parent_id,content,is_favorite,updated_at,course_id")
        .eq("id", noteId)
        .maybeSingle();
      if (error) throw error;
      return data as PageFull | null;
    },
    enabled: !!noteId && open,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses", "active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id,name,color,completed")
        .eq("archived", false);
      return (data ?? []) as { id: string; name: string; color: string; completed: boolean }[];
    },
    enabled: open,
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<Block[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTriggerRef = useRef<((file: File) => Promise<void>) | null>(null);

  // Keep a ref to flush pending changes on close/unmount
  const latestRef = useRef({ title, content, page });
  latestRef.current = { title, content, page };

  // Sync state when page loads or noteId changes
  useEffect(() => {
    if (page) {
      setTitle(page.title || "");
      setContent(Array.isArray(page.content) ? page.content : []);
      setSaveStatus("saved");
    }
  }, [page?.id]);

  const save = useMutation({
    mutationFn: async (patch: Partial<PageFull>) => {
      if (!noteId) return;
      const { error } = await supabase.from("pages").update(patch).eq("id", noteId);
      if (error) throw error;
    },
    onMutate: () => {
      setSaveStatus("saving");
    },
    onSuccess: () => {
      setSaveStatus("saved");
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["notes-list"] });
      qc.invalidateQueries({ queryKey: ["page", noteId] });
      if (courseId) {
        qc.invalidateQueries({ queryKey: ["pages", "course", courseId] });
      }
    },
    onError: (e: unknown) => {
      setSaveStatus("unsaved");
      toast.error(e instanceof Error ? e.message : "Kunde inte spara anteckningen");
    },
  });

  // Debounced autosave
  useEffect(() => {
    if (!page || !open) return;
    const nextTitle = title.trim() || "Utan titel";
    const titleChanged = nextTitle !== page.title;
    const contentChanged = JSON.stringify(content) !== JSON.stringify(page.content);

    if (!titleChanged && !contentChanged) return;

    setSaveStatus("saving");
    const t = setTimeout(() => {
      save.mutate({ title: nextTitle, content: content as unknown as Block[] });
    }, 600);

    return () => clearTimeout(t);
  }, [title, content, page, open]);

  // Flush any unsaved changes immediately before closing
  const flushSave = useCallback(() => {
    const { title: curTitle, content: curContent, page: curPage } = latestRef.current;
    if (!curPage || !noteId) return;
    const nextTitle = curTitle.trim() || "Utan titel";
    const titleChanged = nextTitle !== curPage.title;
    const contentChanged = JSON.stringify(curContent) !== JSON.stringify(curPage.content);
    if (titleChanged || contentChanged) {
      save.mutate({ title: nextTitle, content: curContent as unknown as Block[] });
    }
  }, [noteId, save]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      flushSave();
    }
    onOpenChange(nextOpen);
  };

  const deletePage = useMutation({
    mutationFn: async () => {
      if (!noteId) return;
      const { error } = await supabase.from("pages").update({ archived: true }).eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["notes-list"] });
      if (courseId) {
        qc.invalidateQueries({ queryKey: ["pages", "course", courseId] });
      }

      const deletedId = noteId;
      toast.success("Anteckning borttagen", {
        action: {
          label: "Ångra",
          onClick: async () => {
            if (!deletedId) return;
            const { error } = await supabase
              .from("pages")
              .update({ archived: false })
              .eq("id", deletedId);
            if (!error) {
              qc.invalidateQueries({ queryKey: ["pages"] });
              qc.invalidateQueries({ queryKey: ["notes-list"] });
              qc.invalidateQueries({ queryKey: ["page", deletedId] });
              if (courseId) {
                qc.invalidateQueries({ queryKey: ["pages", "course", courseId] });
              }
              toast.success("Återställd");
            }
          },
        },
      });

      onOpenChange(false);
      onDeleted?.();
    },
  });

  const connectedCourse =
    courses.find((c) => c.id === page?.course_id) ??
    (courseId && page?.course_id === courseId
      ? { id: courseId, name: courseName || "Kurs", color: courseColor || "#6366f1" }
      : null);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-4xl sm:max-w-5xl w-[95vw] h-[85vh] max-h-[90vh] p-0 flex flex-col rounded-2xl glass border-white/10 shadow-2xl overflow-hidden gap-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title || "Anteckning"}</DialogTitle>
          <DialogDescription>Redigera kursanteckning</DialogDescription>
        </DialogHeader>

        {/* Toppfält / Kontrollrad */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border/40 bg-surface/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-8">
            {connectedCourse ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border shrink-0"
                style={{
                  borderColor: `${connectedCourse.color}40`,
                  backgroundColor: `${connectedCourse.color}15`,
                  color: connectedCourse.color,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: connectedCourse.color }}
                />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                  {connectedCourse.name}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border border-border/40 bg-surface/30 text-muted-foreground shrink-0">
                Övrig anteckning
              </span>
            )}

            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              {saveStatus === "saving" ? (
                <span className="inline-flex items-center gap-1 text-sunset-amber font-medium">
                  <Loader2 className="h-3 w-3 animate-spin" /> Sparar…
                </span>
              ) : saveStatus === "saved" ? (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <Check className="h-3 w-3" /> Sparad
                </span>
              ) : (
                <span className="text-destructive">Osparade ändringar</span>
              )}

              {page?.updated_at && !isNaN(new Date(page.updated_at).getTime()) && (
                <span className="text-muted-foreground/60 hidden md:inline">
                  · Uppdaterad{" "}
                  {format(new Date(page.updated_at), "yyyy-MM-dd HH:mm", { locale: sv })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 pr-8">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && uploadTriggerRef.current) {
                  uploadTriggerRef.current(f);
                }
                e.target.value = "";
              }}
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1 text-xs h-8 rounded-lg cursor-pointer px-2 text-muted-foreground hover:text-foreground"
              title="Infoga bild"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Infoga bild</span>
            </Button>

            {page && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => save.mutate({ is_favorite: !page.is_favorite })}
                className="gap-1 text-xs h-8 rounded-lg cursor-pointer px-2"
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    page.is_favorite
                      ? "fill-sunset-amber text-sunset-amber"
                      : "text-muted-foreground",
                  )}
                />
                <span className="hidden sm:inline">
                  {page.is_favorite ? "Favorit" : "Favorisera"}
                </span>
              </Button>
            )}

            {noteId && (
              <Link
                to="/notes/$noteId"
                params={{ noteId }}
                onClick={() => flushSave()}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-8 px-2 rounded-lg hover:bg-surface-2/60 transition-colors cursor-pointer"
                title="Öppna helskärmssida"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Öppna sida</span>
              </Link>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg cursor-pointer">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <BookOpen className="mr-2 h-4 w-4" /> Koppla till kurs
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-[200px] rounded-xl">
                    <DropdownMenuRadioGroup
                      value={page?.course_id || "none"}
                      onValueChange={(val) => {
                        const nextCourseId = val === "none" ? null : val;
                        save.mutate({ course_id: nextCourseId });
                      }}
                    >
                      <DropdownMenuRadioItem value="none">Ingen kurs</DropdownMenuRadioItem>
                      {courses
                        .filter((c) => !c.completed || c.id === page?.course_id)
                        .map((c) => (
                          <DropdownMenuRadioItem key={c.id} value={c.id}>
                            <span className="truncate">{c.name}</span>
                          </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (confirm("Ta bort anteckningen?")) deletePage.mutate();
                  }}
                  className="text-destructive cursor-pointer"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Ta bort
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Huvudinnehåll */}
        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Laddar anteckning…
            </div>
          ) : !page ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Anteckningen hittades inte.
            </div>
          ) : (
            <>
              {/* Titelrad */}
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2/80 text-2xl select-none shadow-sm">
                  {page.icon || "📝"}
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Utan titel"
                  className="w-full bg-transparent font-display text-2xl sm:text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/35"
                  autoFocus
                />
              </div>

              {/* Redigerare */}
              <div className="pt-2 min-h-[300px]">
                <BlockEditor
                  value={content}
                  onChange={setContent}
                  onRegisterUploadImage={(fn) => {
                    uploadTriggerRef.current = fn;
                  }}
                />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
