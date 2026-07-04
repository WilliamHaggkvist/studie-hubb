import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BlockEditor, type Block } from "@/components/block-editor";
import { useEffect, useState } from "react";
import { Star, MoreHorizontal, Trash2, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/notes/$noteId")({
  component: PageDetail,
});

type PageFull = {
  id: string;
  title: string;
  icon: string | null;
  parent_id: string | null;
  content: Block[] | null;
  is_favorite: boolean;
  updated_at: string;
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
        .select("id,title,icon,parent_id,content,is_favorite,updated_at")
        .eq("id", noteId)
        .maybeSingle();
      if (error) throw error;
      return data as PageFull | null;
    },
  });

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📄");
  const [content, setContent] = useState<Block[]>([]);

  useEffect(() => {
    if (page) {
      setTitle(page.title || "");
      setIcon(page.icon || "📄");
      setContent(Array.isArray(page.content) ? page.content : []);
    }
  }, [page?.id]); // eslint-disable-line

  const save = useMutation({
    mutationFn: async (patch: Partial<PageFull>) => {
      const { error } = await supabase.from("pages").update(patch).eq("id", pageId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page", pageId] });
    },
  });

  // Debounced autosave for title + content
  useEffect(() => {
    if (!page) return;
    const t = setTimeout(() => {
      const nextTitle = title.trim() || "Utan titel";
      if (nextTitle !== page.title || JSON.stringify(content) !== JSON.stringify(page.content) || icon !== page.icon) {
        save.mutate({ title: nextTitle, content: content as unknown as Block[], icon });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [title, content, icon]); // eslint-disable-line

  const createChild = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { data, error } = await supabase.from("pages").insert({ user_id: u.user.id, parent_id: pageId, title: "Utan titel" }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      navigate({ to: "/pages/$pageId", params: { pageId: id } });
    },
  });

  const deletePage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pages").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      toast.success("Anteckning borttagen");
      navigate({ to: "/notes" });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Laddar sida…</div>;
  }
  if (!page) {
    return <div className="p-8 text-sm text-muted-foreground">Sidan hittades inte.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Uppdaterad {format(new Date(page.updated_at), "d MMM HH:mm", { locale: sv })}
          {save.isPending && <span className="ml-2 text-sunset-amber">Sparar…</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => save.mutate({ is_favorite: !page.is_favorite })}
            className="gap-1 text-xs"
          >
            <Star className={page.is_favorite ? "h-3.5 w-3.5 fill-sunset-amber text-sunset-amber" : "h-3.5 w-3.5"} />
            {page.is_favorite ? "Favorit" : "Favorisera"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => createChild.mutate()} className="gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" /> Undersida
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { if (confirm("Ta bort sidan och alla undersidor?")) deletePage.mutate(); }} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Ta bort
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <button
            className="grid h-14 w-14 place-items-center rounded-xl bg-surface text-3xl hover:bg-surface-2"
            onClick={() => {
              const next = prompt("Emoji för sidan?", icon);
              if (next) setIcon(next.slice(0, 4));
            }}
          >
            {icon}
          </button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Utan titel"
          className="w-full bg-transparent font-display text-4xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
        />
      </div>

      <BlockEditor value={content} onChange={setContent} />

      <div className="mt-16 flex items-center justify-center">
        <Button variant="ghost" size="sm" onClick={() => createChild.mutate()} className="gap-1 text-xs text-muted-foreground">
          <ChevronRight className="h-3 w-3" /> Skapa undersida
        </Button>
      </div>
    </div>
  );
}
