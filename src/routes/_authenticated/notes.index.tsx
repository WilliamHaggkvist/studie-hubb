import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Star, Search, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/notes/")({
  component: NotesList,
});

type NoteRow = {
  id: string;
  title: string;
  icon: string | null;
  is_favorite: boolean;
  course_id: string | null;
  updated_at: string;
};
type Course = { id: string; name: string; color: string };

function NotesList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");

  const { data: allCourses = [] } = useQuery({
    queryKey: ["courses", "all-for-notes"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id,name,color,archived,completed").order("name", { ascending: true });
      return (data ?? []) as (Course & { archived: boolean; completed: boolean })[];
    },
  });

  const activeCourses = allCourses.filter((c) => !c.archived && !c.completed);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pages")
        .select("id,title,icon,is_favorite,course_id,updated_at")
        .eq("archived", false)
        .order("updated_at", { ascending: false });
      return (data ?? []) as NoteRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { data, error } = await supabase
        .from("pages")
        .insert({
          user_id: u.user.id,
          title: "Utan titel",
          course_id: courseFilter !== "all" ? courseFilter : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["notes-list"] });
      navigate({ to: "/notes/$noteId", params: { noteId: id } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("pages").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["notes-list"] });
      toast.success("Anteckning borttagen");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel vid borttagning"),
  });

  const filtered = notes.filter((n) => {
    if (courseFilter === "all") {
    } else if (courseFilter === "none") {
      if (n.course_id) return false;
    } else if (n.course_id !== courseFilter) return false;
    if (q && !(n.title || "").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Anteckningar</h1>
          <p className="text-sm text-muted-foreground">Alla dina anteckningar på ett ställe.</p>
        </div>
        <Button size="sm" className="gap-1 gradient-sunset text-white hover:opacity-90" onClick={() => create.mutate()}>
          <Plus className="h-3.5 w-3.5" /> Ny anteckning
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[16rem]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Sök titel…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-[12rem]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla kurser</SelectItem>
            <SelectItem value="none">Utan kurs</SelectItem>
            {activeCourses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          Inga anteckningar. Klicka "Ny anteckning" för att komma igång.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((n) => {
          const c = allCourses.find((c) => c.id === n.course_id);
          return (
            <Link
              key={n.id}
              to="/notes/$noteId"
              params={{ noteId: n.id }}
              className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-border/60 bg-surface/50 p-3.5 transition-all hover:border-transparent hover:shadow-lg hover:shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2/60 text-muted-foreground group-hover:text-primary transition-colors">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold tracking-tight truncate flex-1 text-left">
                    {n.title || "Utan titel"}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {n.is_favorite && <Star className="h-3 w-3 fill-sunset-amber text-sunset-amber" />}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        if (confirm("Ta bort anteckningen?")) deleteNote.mutate(n.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{format(new Date(n.updated_at), "d MMM", { locale: sv })}</span>
                  <span>•</span>
                  {c ? (
                    <span className="truncate max-w-[120px]" style={{ color: c.color }}>
                      {c.name}
                    </span>
                  ) : (
                    <span>Övrig</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
