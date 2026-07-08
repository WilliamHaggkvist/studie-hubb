import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Calendar as CalIcon, Inbox } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { sv } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { coursesQuery } from "@/lib/queries";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

type TaskType =
  | "annat"
  | "inlamningsuppgift"
  | "kontrollskrivning"
  | "laboration"
  | "modul"
  | "quiz"
  | "redovisning"
  | "seminarie"
  | "tenta"
  | "ovning";

type TaskStatus = "todo" | "doing" | "done";
type TaskKind = "task" | "exam";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_at: string | null;
  course_id: string | null;
  task_type: TaskType;
  task_kind: TaskKind;
  grade: string | null;
  points: string | null;
  pending_review: boolean;
};
type Course = { id: string; name: string; color: string };

const TYPE_LABELS: Record<TaskType, string> = {
  annat: "Annat",
  inlamningsuppgift: "Inlämning",
  kontrollskrivning: "Kontrollskrivning",
  laboration: "Laboration",
  modul: "Modul",
  quiz: "Quiz",
  redovisning: "Redovisning",
  seminarie: "Seminarie",
  tenta: "Tenta",
  ovning: "Övning",
};
const TYPES_ALPHA: TaskType[] = [
  "annat",
  "inlamningsuppgift",
  "kontrollskrivning",
  "laboration",
  "modul",
  "quiz",
  "redovisning",
  "seminarie",
  "tenta",
  "ovning",
];
const EXAM_TYPES = new Set<TaskType>([
  "inlamningsuppgift",
  "kontrollskrivning",
  "laboration",
  "quiz",
  "redovisning",
  "seminarie",
  "tenta",
  "ovning",
]);

const COLUMNS: { key: TaskStatus; label: string; accent: string }[] = [
  { key: "todo", label: "Ej startad", accent: "var(--sunset-coral, #f94144)" },
  { key: "doing", label: "Pågår", accent: "var(--sunset-amber, #f8961e)" },
  { key: "done", label: "Klar", accent: "var(--sunset-violet, #43aa8b)" },
];

function daysLeftLabel(due: string): string {
  const d = differenceInCalendarDays(parseISO(due), new Date());
  if (d === 0) return "Idag";
  if (d === 1) return "Imorgon";
  if (d === -1) return "Försenad 1 d";
  if (d < 0) return `Försenad ${-d} d`;
  return `${d} dagar`;
}

function TasksPage() {
  const qc = useQueryClient();
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDue, setFilterDue] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [completeFor, setCompleteFor] = useState<Task | null>(null);

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const courses = allCourses.filter((c) => !c.archived);

  const { data: allTasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,description,status,due_at,course_id,task_type,task_kind,grade,points,pending_review")
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const filtered = useMemo(() => {
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    const coursesMap = new Map(allCourses.map((c) => [c.id, c]));
    return allTasks.filter((t) => {
      if (t.course_id) {
        const course = coursesMap.get(t.course_id);
        if (course?.archived) return false;
      }
      if (filterCourse !== "all" && t.course_id !== filterCourse) return false;
      if (filterType !== "all" && t.task_type !== filterType) return false;
      if (filterDue !== "all" && t.due_at) {
        const diff = parseISO(t.due_at).getTime() - now;
        if (filterDue === "overdue" && diff >= 0) return false;
        if (filterDue === "today" && (diff < 0 || diff > day)) return false;
        if (filterDue === "week" && (diff < 0 || diff > 7 * day)) return false;
        if (filterDue === "month" && (diff < 0 || diff > 30 * day)) return false;
      } else if (filterDue !== "all" && !t.due_at) {
        return false;
      }
      return true;
    });
  }, [allTasks, allCourses, filterCourse, filterType, filterDue]);

  const pending = filtered.filter((t) => t.pending_review && t.status !== "done");
  const board = filtered.filter((t) => !t.pending_review);

  const upsert = useMutation({
    mutationFn: async (patch: Partial<Task> & { id?: string }) => {
      if (patch.id) {
        const { id, ...rest } = patch;
        const { error } = await supabase.from("tasks").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("no user");
        const { error } = await supabase.from("tasks").insert({
          user_id: u.user.id,
          title: patch.title ?? "",
          description: patch.description ?? null,
          due_at: patch.due_at ?? null,
          course_id: patch.course_id ?? null,
          task_type: patch.task_type ?? "annat",
          task_kind: patch.task_kind ?? "task",
          status: patch.status ?? "todo",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const setStatus = (t: Task, s: TaskStatus) => {
    if (s === "done") {
      if (t.task_type === "annat" || t.task_type === "modul") {
        upsert.mutate({
          id: t.id,
          status: "done",
          completed_at: new Date().toISOString(),
          grade: null,
          points: null,
          pending_review: false,
        });
      } else {
        setCompleteFor(t);
      }
      return;
    }
    const wasCompleted = t.status === "done";
    const patch: Partial<Task> & { id: string; completed_at?: string | null; grade?: string | null; points?: string | null; pending_review?: boolean } = {
      id: t.id,
      status: s,
      completed_at: null,
      ...(wasCompleted && { grade: null, points: null, pending_review: false }),
    };
    upsert.mutate(patch);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const t = filtered.find((x) => x.id === e.active.id);
    const target = e.over?.id as TaskStatus | undefined;
    if (!t || !target || t.status === target) return;
    setStatus(t, target);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Uppgifter</h1>
          <p className="text-sm text-muted-foreground">Håll koll på allt du ska göra.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla kurser</SelectItem>
              {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla typer</SelectItem>
              {TYPES_ALPHA.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDue} onValueChange={setFilterDue}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla deadlines</SelectItem>
              <SelectItem value="overdue">Försenade</SelectItem>
              <SelectItem value="today">Idag</SelectItem>
              <SelectItem value="week">Denna vecka</SelectItem>
              <SelectItem value="month">Denna månad</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)} className="gap-1 gradient-sunset text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Ny
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid gap-3 md:grid-cols-3">
            {COLUMNS.map((col) => (
              <Column key={col.key} col={col} tasks={board.filter((t) => t.status === col.key)} courses={courses} onOpen={setEditing} />
            ))}
          </div>

          {pending.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-surface/40 p-3">
              <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Inbox className="h-3.5 w-3.5" /> Väntar på bedömning
                <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px]">{pending.length}</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {pending.map((t) => (
                  <DraggableCard key={t.id} task={t} courses={courses} onOpen={setCompleteFor} />
                ))}
              </div>
            </div>
          )}
        </DndContext>

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-10 text-center text-sm text-muted-foreground">
            Inga uppgifter här. Skapa din första!
          </div>
        )}
      </div>

      <TaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        courses={courses}
        
        onSave={(v) => {
          upsert.mutate(v, {
            onSuccess: () => {
              setCreateOpen(false);
              toast.success("Skapad");
            },
          });
        }}
      />
      <TaskDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        courses={courses}
        task={editing ?? undefined}
        onDelete={editing ? () => { remove.mutate(editing.id); setEditing(null); } : undefined}
        onSave={(v) => {
          upsert.mutate({ ...v, id: editing!.id }, {
            onSuccess: () => { setEditing(null); toast.success("Sparat"); },
          });
        }}
      />
      <CompleteDialog
        task={completeFor}
        onClose={() => setCompleteFor(null)}
        onPending={(t) => {
          upsert.mutate({ id: t.id, pending_review: true }, { onSuccess: () => setCompleteFor(null) });
        }}
        onDone={(t, grade, points) => {
          const patch: Record<string, unknown> = { id: t.id, grade, points, pending_review: false };
          if (grade.trim() && points.trim()) {
            patch.status = "done";
            patch.completed_at = new Date().toISOString();
          }
          upsert.mutate(patch as Partial<Task> & { id: string }, { onSuccess: () => setCompleteFor(null) });
        }}
      />
    </div>
  );
}

function Column({
  col, tasks, courses, onOpen,
}: {
  col: { key: TaskStatus; label: string; accent: string };
  tasks: Task[];
  courses: Course[];
  onOpen: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div ref={setNodeRef} className={cn("rounded-2xl border border-border/60 bg-surface/40 p-2 transition", isOver && "ring-2 ring-primary/50")}>
      <div className="mb-2 flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: col.accent }} />
        {col.label}
        <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px]">{tasks.length}</span>
      </div>
      <div className="space-y-2 min-h-[80px]">
        {tasks.map((t) => <DraggableCard key={t.id} task={t} courses={courses} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function DraggableCard({ task, courses, onOpen }: { task: Task; courses: Course[]; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn("touch-none", isDragging && "opacity-50")}>
      <Card task={task} courses={courses} onOpen={onOpen} />
    </div>
  );
}

function Card({ task, courses, onOpen }: { task: Task; courses: Course[]; onOpen: (t: Task) => void }) {
  const c = courses.find((x) => x.id === task.course_id);
  const overdue = task.due_at && parseISO(task.due_at).getTime() < Date.now() && task.status !== "done";
  return (
    <button
      onClick={() => onOpen(task)}
      className="w-full rounded-xl border border-border/60 bg-surface p-3 text-left shadow-sm hover:border-primary/40"
    >
      <div className={cn("mb-1 text-sm font-medium", task.status === "done" && "line-through text-muted-foreground")}>
        {task.title}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        {c && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
            {c.name}
          </span>
        )}
        <span className="rounded-full border border-border/60 px-1.5 py-0.5">{TYPE_LABELS[task.task_type]}</span>
        {task.due_at && (
          <span className={cn("inline-flex items-center gap-1", overdue && "text-sunset-rose")}>
            <CalIcon className="h-2.5 w-2.5" /> {format(parseISO(task.due_at), "d MMM", { locale: sv })} · {daysLeftLabel(task.due_at)}
          </span>
        )}
        {task.grade && task.task_type !== "annat" && task.task_type !== "modul" && <span className="rounded-full bg-surface-2 px-1.5 py-0.5">Betyg: {task.grade}</span>}
      </div>
    </button>
  );
}

function TaskDialog({
  open, onOpenChange, courses, task, defaultKind, onSave, onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courses: Course[];
  task?: Task;
  defaultKind?: TaskKind;
  onSave: (v: Partial<Task>) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueAt, setDueAt] = useState(task?.due_at ? task.due_at.slice(0, 16) : "");
  const [courseId, setCourseId] = useState(task?.course_id ?? "none");
  const [type, setType] = useState<TaskType>(task?.task_type ?? "annat");
  const kind: TaskKind = EXAM_TYPES.has(type) ? "exam" : "task";

  // Reset when task changes
  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setDueAt(task?.due_at ? task.due_at.slice(0, 16) : "");
    setCourseId(task?.course_id ?? "none");
    setType(task?.task_type ?? "annat");
  }, [task, defaultKind]);

  const submit = () => {
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      course_id: courseId === "none" ? null : courseId,
      task_type: type,
      task_kind: kind,
      ...(task ? {} : { status: "todo" as TaskStatus, pending_review: false }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display">{task ? "Redigera" : "Ny"} {kind === "exam" ? "examination" : "uppgift"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
          <div className="space-y-1.5"><Label>Beskrivning</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <div className="space-y-1.5">
            <Label>Typ</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES_ALPHA.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Deadline</Label><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
            <div className="space-y-1.5">
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
        </div>
        <DialogFooter className="gap-2">
          {onDelete && <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}><Trash2 className="mr-1 h-4 w-4" /> Ta bort</Button>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button disabled={!title.trim()} onClick={submit} className="gradient-sunset text-white hover:opacity-90">Spara</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteDialog({
  task, onClose, onPending, onDone,
}: {
  task: Task | null;
  onClose: () => void;
  onPending: (t: Task) => void;
  onDone: (t: Task, grade: string, points: string) => void;
}) {
  const [grade, setGrade] = useState("");
  const [points, setPoints] = useState("");
  useEffect(() => { setGrade(task?.grade ?? ""); setPoints(task?.points ?? ""); }, [task]);
  if (!task) return null;
  const noGrade = task.task_type === "annat" || task.task_type === "modul";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="font-display">Markera som klar</DialogTitle></DialogHeader>
        {noGrade ? (
          <p className="text-sm text-muted-foreground">Uppgiften markeras som klar utan betyg eller poäng.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Fyll i betyg och poäng. Använd <code>-</code> om det inte gäller. När båda är ifyllda markeras uppgiften som klar.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Betyg</Label><Input autoFocus value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="A / 5 / -" /></div>
              <div className="space-y-1.5"><Label>Poäng</Label><Input value={points} onChange={(e) => setPoints(e.target.value)} placeholder="18/20 / -" /></div>
            </div>
          </>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Avbryt</Button>
          {!noGrade && <Button variant="outline" onClick={() => onPending(task)}>Väntar på bedömning</Button>}
          <Button onClick={() => onDone(task, grade, points)} className="gradient-sunset text-white hover:opacity-90">Spara</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
