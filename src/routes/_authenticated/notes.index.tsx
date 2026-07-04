import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Star, Search, Trash2 } from "lucide-react";
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

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id,name,color").eq("archived", false);
      return (data ?? []) as Course[];
    },
  });

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
            {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
          const c = courses.find((c) => c.id === n.course_id);
          return (
            <Link
              key={n.id}
              to="/notes/$noteId"
              params={{ noteId: n.id }}
              className="group rounded-xl border border-border/60 bg-surface/60 p-4 transition-colors hover:border-sunset-coral/40 hover:bg-surface focus:outline-none focus:ring-2 focus:ring-sunset-amber"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="text-2xl">{n.icon || "📄"}</div>
                {n.is_favorite && <Star className="h-3.5 w-3.5 fill-sunset-amber text-sunset-amber" />}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    if (confirm("Ta bort anteckningen?")) deleteNote.mutate(n.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="block text-left">
                <div className="line-clamp-2 font-display text-base font-semibold">{n.title || "Utan titel"}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  {c ? (
                    <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />{c.name}</span>
                  ) : <span>Ingen kurs</span>}
                  <span>{format(new Date(n.updated_at), "d MMM", { locale: sv })}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
