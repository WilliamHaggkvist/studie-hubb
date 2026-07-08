import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BlockEditor, type Block } from "@/components/block-editor";
import { useEffect, useState } from "react";
import { Star, MoreHorizontal, Trash2, FileText, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/notes/$noteId")({
  component: PageDetail,
});

type PageFull = {
  id: string;
  title: string;
  parent_id: string | null;
  content: Block[] | null;
  is_favorite: boolean;
  updated_at: string;
  course_id: string | null;
};

function PageDetail() {
  const { noteId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: page, isLoading } = useQuery({
    queryKey: ["page", noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages")
        .select("id,title,parent_id,content,is_favorite,updated_at,course_id")
        .eq("id", noteId)
        .maybeSingle();
      if (error) throw error;
      return data as PageFull | null;
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses", "active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id,name,color")
        .eq("archived", false);
      return (data ?? []) as { id: string; name: string; color: string }[];
    },
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<Block[]>([]);

  useEffect(() => {
    if (page) {
      setTitle(page.title || "");
      setContent(Array.isArray(page.content) ? page.content : []);
    }
  }, [page?.id]); // eslint-disable-line

  const save = useMutation({
    mutationFn: async (patch: Partial<PageFull>) => {
      const { error } = await supabase.from("pages").update(patch).eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["notes-list"] });
      qc.invalidateQueries({ queryKey: ["page", noteId] });
    },
  });

  // Debounced autosave for title + content
  useEffect(() => {
    if (!page) return;
    const t = setTimeout(() => {
      const nextTitle = title.trim() || "Utan titel";
      if (nextTitle !== page.title || JSON.stringify(content) !== JSON.stringify(page.content)) {
        save.mutate({ title: nextTitle, content: content as unknown as Block[] });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [title, content]); // eslint-disable-line

  const deletePage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pages").update({ archived: true }).eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["notes-list"] });
      
      toast.success("Anteckning borttagen", {
        action: {
          label: "Ångra",
          onClick: async () => {
            const { error } = await supabase.from("pages").update({ archived: false }).eq("id", noteId);
            if (!error) {
              qc.invalidateQueries({ queryKey: ["pages"] });
              qc.invalidateQueries({ queryKey: ["notes-list"] });
              qc.invalidateQueries({ queryKey: ["page", noteId] });
              toast.success("Återställd");
            }
          }
        }
      });
      navigate({ to: "/notes" });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Laddar sida…</div>;
  }
  if (!page) {
    return <div className="p-8 text-sm text-muted-foreground">Sidan hittades inte.</div>;
  }

  const connectedCourse = courses.find((c) => c.id === page.course_id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/notes">Anteckningar</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{page.title || "Utan titel"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="mb-6 flex items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="text-xs text-muted-foreground">
          Uppdaterad {format(new Date(page.updated_at), "d MMM HH:mm", { locale: sv })}
          {save.isPending && <span className="ml-2 text-sunset-amber">Sparar…</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => save.mutate({ is_favorite: !page.is_favorite })}
            className="gap-1 text-xs h-8"
          >
            <Star className={page.is_favorite ? "h-3.5 w-3.5 fill-sunset-amber text-sunset-amber" : "h-3.5 w-3.5"} />
            {page.is_favorite ? "Favorit" : "Favorisera"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <BookOpen className="mr-2 h-4 w-4" /> Koppla till kurs
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-[180px]">
                  <DropdownMenuRadioGroup
                    value={page.course_id || "none"}
                    onValueChange={(val) => {
                      const nextCourseId = val === "none" ? null : val;
                      save.mutate({ course_id: nextCourseId });
                    }}
                  >
                    <DropdownMenuRadioItem value="none">
                      Ingen kurs
                    </DropdownMenuRadioItem>
                    {courses.map((c) => (
                      <DropdownMenuRadioItem key={c.id} value={c.id}>
                        <span className="truncate">{c.name}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { if (confirm("Ta bort sidan?")) deletePage.mutate(); }} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Ta bort
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2/80 text-muted-foreground">
            <FileText className="h-6 w-6" />
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Utan titel"
            className="w-full bg-transparent font-display text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
          />
        </div>
        <div className="flex items-center gap-2 pl-[52px]">
          {connectedCourse ? (
            <span 
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border"
              style={{ 
                borderColor: `${connectedCourse.color}40`, 
                backgroundColor: `${connectedCourse.color}15`, 
                color: connectedCourse.color 
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: connectedCourse.color }} />
              {connectedCourse.name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border border-border/40 bg-surface/30 text-muted-foreground">
              Övrig anteckning
            </span>
          )}
        </div>
      </div>

      <BlockEditor value={content} onChange={setContent} />
    </div>
  );
}
