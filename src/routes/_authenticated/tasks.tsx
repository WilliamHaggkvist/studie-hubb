import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Calendar as CalIcon, Flag } from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "doing" | "done";
  priority: "low" | "medium" | "high";
  due_at: string | null;
  course_id: string | null;
};
type Course = { id: string; name: string; color: string };

const COLUMNS: { key: Task["status"]; label: string; accent: string }[] = [
  { key: "todo", label: "Att göra", accent: "var(--sunset-coral)" },
  { key: "doing", label: "Pågår", accent: "var(--sunset-amber)" },
  { key: "done", label: "Klar", accent: "var(--sunset-violet)" },
];

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  low: "var(--muted-foreground)",
  medium: "var(--sunset-amber)",
  high: "var(--sunset-rose)",
};

function TasksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [dueAt, setDueAt] = useState("");
  const [courseId, setCourseId] = useState<string>("none");
  const [filterCourse, setFilterCourse] = useState<string>("all");

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id,name,color").eq("archived", false);
      return (data ?? []) as Course[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", filterCourse],
    queryFn: async () => {
      let q = supabase.from("tasks").select("id,title,description,status,priority,due_at,course_id").order("due_at", { ascending: true, nullsFirst: false });
      if (filterCourse !== "all") q = q.eq("course_id", filterCourse);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { error } = await supabase.from("tasks").insert({
        user_id: u.user.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        course_id: courseId === "none" ? null : courseId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setTitle(""); setDescription(""); setDueAt(""); setPriority("medium"); setCourseId("none");
      toast.success("Uppgift skapad");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const update = useMutation({
    mutationFn: async (v: { id: string; patch: Partial<Task> & { completed_at?: string | null } }) => {
      const patch = { ...v.patch };
      if (v.patch.status === "done") patch.completed_at = new Date().toISOString();
      if (v.patch.status && v.patch.status !== "done") patch.completed_at = null;
      const { error } = await supabase.from("tasks").update(patch).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Uppgifter</h1>
          <p className="text-sm text-muted-foreground">Ordna dina att-göra i lista eller kanban.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla kurser</SelectItem>
              {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1 gradient-sunset text-white hover:opacity-90"><Plus className="h-4 w-4" /> Ny uppgift</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Ny uppgift</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
                <div className="space-y-2"><Label>Beskrivning</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Deadline</Label>
                    <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Prioritet</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Låg</SelectItem>
                        <SelectItem value="medium">Medel</SelectItem>
                        <SelectItem value="high">Hög</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Kurs</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen kurs</SelectItem>
                      {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
                <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()} className="gradient-sunset text-white hover:opacity-90">Skapa</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="board">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <div className="space-y-1 rounded-xl border border-border/60 bg-surface/40 p-2">
            {tasks.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Inga uppgifter. Skapa din första!</div>}
            {tasks.map((t) => {
              const c = courses.find((c) => c.id === t.course_id);
              const overdue = t.due_at && isPast(parseISO(t.due_at)) && t.status !== "done" && !isToday(parseISO(t.due_at));
              return (
                <div key={t.id} className="group flex items-center gap-3 rounded-md px-3 py-2 hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={t.status === "done"}
                    onChange={(e) => update.mutate({ id: t.id, patch: { status: e.target.checked ? "done" : "todo" } })}
                    className="h-4 w-4 accent-sunset-coral"
                  />
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</div>
                    {t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}
                  </div>
                  {c && <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px]"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />{c.name}</span>}
                  <Flag className="h-3 w-3" style={{ color: PRIORITY_COLOR[t.priority] }} />
                  {t.due_at && (
                    <span className={cn("inline-flex items-center gap-1 text-xs", overdue ? "text-sunset-rose" : "text-muted-foreground")}>
                      <CalIcon className="h-3 w-3" /> {format(parseISO(t.due_at), "d MMM", { locale: sv })}
                    </span>
                  )}
                  <button onClick={() => remove.mutate(t.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="board" className="mt-4">
          <div className="grid gap-3 md:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.key} className="rounded-xl border border-border/60 bg-surface/40 p-2">
                <div className="mb-2 flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: col.accent }} />
                  {col.label}
                  <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {tasks.filter((t) => t.status === col.key).length}
                  </span>
                </div>
                <div className="space-y-2">
                  {tasks.filter((t) => t.status === col.key).map((t) => {
                    const c = courses.find((c) => c.id === t.course_id);
                    return (
                      <div key={t.id} className="group rounded-lg border border-border/60 bg-surface p-3 shadow-sm">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <div className={cn("text-sm font-medium", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</div>
                          <Flag className="h-3 w-3 shrink-0" style={{ color: PRIORITY_COLOR[t.priority] }} />
                        </div>
                        {t.description && <div className="mb-2 line-clamp-2 text-xs text-muted-foreground">{t.description}</div>}
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          {c && <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />{c.name}</span>}
                          {t.due_at && <span className="inline-flex items-center gap-1"><CalIcon className="h-2.5 w-2.5" /> {format(parseISO(t.due_at), "d MMM", { locale: sv })}</span>}
                        </div>
                        <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100">
                          {COLUMNS.filter((cc) => cc.key !== col.key).map((cc) => (
                            <button key={cc.key} onClick={() => update.mutate({ id: t.id, patch: { status: cc.key } })} className="rounded border border-border/60 px-2 py-0.5 text-[10px] hover:bg-accent">
                              → {cc.label}
                            </button>
                          ))}
                          <button onClick={() => remove.mutate(t.id)} className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
