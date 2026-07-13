import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Calendar as CalIcon, Inbox, ChevronDown, ChevronRight, Check } from "lucide-react";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { QuickStatusDialog } from "@/components/tasks/quick-status-dialog";
import { CompleteDialog } from "@/components/tasks/complete-dialog";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { sv } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  coursesQuery,
  tasksQuery,
  type Task,
  type TaskStatus,
  TYPE_LABELS,
  TYPE_COLORS,
  TYPES_ALPHA,
} from "@/lib/queries";
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

type Course = { id: string; name: string; color: string };

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [completeFor, setCompleteFor] = useState<Task | null>(null);
  const [quickActionFor, setQuickActionFor] = useState<Task | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const courses = allCourses.filter((c) => !c.archived && !c.completed);

  const { data: allTasks = [] } = useQuery(tasksQuery);

  // Barn per förälder
  const childrenByParent = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of allTasks) {
      if (t.parent_id) {
        const arr = m.get(t.parent_id) ?? [];
        arr.push(t);
        m.set(t.parent_id, arr);
      }
    }
    return m;
  }, [allTasks]);

  // Filtrera alla uppgifter (för både rot- och underuppgifter)
  const filteredAllTasks = useMemo(() => {
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    const coursesMap = new Map(allCourses.map((c) => [c.id, c]));
    return allTasks.filter((t) => {
      if (t.course_id) {
        const course = coursesMap.get(t.course_id);
        if (course?.archived || course?.completed) return false;
      }
      if (filterCourse !== "all") {
        if (filterCourse === "none") {
          if (t.course_id) return false;
        } else if (t.course_id !== filterCourse) {
          return false;
        }
      }
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

  const filteredRoots = useMemo(() => {
    return filteredAllTasks.filter((t) => t.parent_id === null);
  }, [filteredAllTasks]);

  const pending = useMemo(() => {
    return filteredAllTasks.filter((t) => t.pending_review && t.status !== "done");
  }, [filteredAllTasks]);

  const board = useMemo(() => {
    return filteredRoots.filter((t) => !t.pending_review);
  }, [filteredRoots]);

  const upsert = useMutation({
    mutationFn: async (patch: Partial<Task> & { id?: string }) => {
      if (patch.id) {
        const { id, ...rest } = patch;
        const { error } = await supabase.from("tasks").update(rest).eq("id", id);
        if (error) throw error;

        if (rest.status === "done" || rest.pending_review === true) {
          const { error: subtasksError } = await supabase
            .from("tasks")
            .update({
              status: "done",
              completed_at: new Date().toISOString(),
              grade: null,
              points: null,
              pending_review: false,
            })
            .eq("parent_id", id);
          if (subtasksError) throw subtasksError;
        } else if (rest.status === "todo") {
          const { error: subtasksError } = await supabase
            .from("tasks")
            .update({
              status: "todo",
              completed_at: null,
              grade: null,
              points: null,
              pending_review: false,
            })
            .eq("parent_id", id);
          if (subtasksError) throw subtasksError;
        }
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
          parent_id: patch.parent_id ?? null,
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
          grade: null,
          points: null,
          pending_review: false,
          completed_at: new Date().toISOString(),
        });
      } else {
        setCompleteFor(t);
      }
      return;
    }
    const wasPending = t.pending_review || t.status === "done";
    const patch: Partial<Task> & { id: string } = {
      id: t.id,
      status: s,
      completed_at: null,
      ...(wasPending && { grade: null, points: null, pending_review: false }),
    };
    upsert.mutate(patch);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const t = filteredRoots.find((x) => x.id === e.active.id);
    const target = e.over?.id as TaskStatus | undefined;
    if (!t || !target || t.status === target) return;
    setStatus(t, target);
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openCreateChild = (parentId: string) => {
    setCreateParentId(parentId);
    setCreateOpen(true);
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
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla kurser</SelectItem>
              <SelectItem value="none">Utan kurs</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla typer</SelectItem>
              {TYPES_ALPHA.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDue} onValueChange={setFilterDue}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla deadlines</SelectItem>
              <SelectItem value="overdue">Försenade</SelectItem>
              <SelectItem value="today">Idag</SelectItem>
              <SelectItem value="week">Denna vecka</SelectItem>
              <SelectItem value="month">Denna månad</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setCreateParentId(null);
              setCreateOpen(true);
            }}
            className="gap-1 gradient-sunset text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Ny
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid gap-3 md:grid-cols-3">
            {COLUMNS.map((col) => (
              <Column
                key={col.key}
                col={col}
                tasks={board.filter((t) => t.status === col.key)}
                courses={courses}
                childrenByParent={childrenByParent}
                expanded={expanded}
                onToggleExpand={toggleExpand}
                onOpen={setQuickActionFor}
                onToggleChild={setStatus}
                allTasks={allTasks}
              />
            ))}
          </div>

          {pending.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-surface/40 p-3">
              <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Inbox className="h-3.5 w-3.5" /> Väntar på bedömning
                <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px]">
                  {pending.length}
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {pending.map((t) => (
                  <DraggableCard
                    key={t.id}
                    task={t}
                    courses={courses}
                    childrenByParent={childrenByParent}
                    expanded={expanded}
                    onToggleExpand={toggleExpand}
                    onOpen={setQuickActionFor}
                    onToggleChild={setStatus}
                    allTasks={allTasks}
                  />
                ))}
              </div>
            </div>
          )}
        </DndContext>

        {filteredRoots.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-10 text-center text-sm text-muted-foreground">
            Inga uppgifter här. Skapa din första!
          </div>
        )}
      </div>

      <TaskDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setCreateParentId(null);
        }}
        courses={courses}
        rootTasks={allTasks.filter((t) => t.parent_id === null)}
        defaultParentId={createParentId}
        onSave={(v) => {
          upsert.mutate(v, {
            onSuccess: () => {
              setCreateOpen(false);
              setCreateParentId(null);
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
        rootTasks={allTasks.filter(
          (t) => t.parent_id === null && t.id !== editing?.id,
        )}
        hasChildren={editing ? (childrenByParent.get(editing.id)?.length ?? 0) > 0 : false}
        onDelete={
          editing
            ? () => {
                remove.mutate(editing.id);
                setEditing(null);
              }
            : undefined
        }
        onSave={(v) => {
          upsert.mutate(
            { ...v, id: editing!.id },
            {
              onSuccess: () => {
                setEditing(null);
                toast.success("Sparat");
              },
            },
          );
        }}
      />
      <CompleteDialog
        task={completeFor}
        onClose={() => setCompleteFor(null)}
        onPending={(t) => {
          upsert.mutate(
            { id: t.id, pending_review: true },
            { onSuccess: () => setCompleteFor(null) },
          );
        }}
        onDone={(t, grade, points) => {
          const patch: Partial<Task> & { id: string } = {
            id: t.id,
            grade,
            points,
            pending_review: false,
          };
          if (grade.trim() && points.trim()) {
            patch.status = "done";
            patch.completed_at = new Date().toISOString();
          }
          upsert.mutate(patch, {
            onSuccess: () => setCompleteFor(null),
          });
        }}
      />
      <QuickStatusDialog
        task={quickActionFor}
        onClose={() => setQuickActionFor(null)}
        onChangeStatus={(t, s) => {
          setQuickActionFor(null);
          setStatus(t, s);
        }}
        onEdit={(t) => {
          setQuickActionFor(null);
          setEditing(t);
        }}
        onAddSubtask={(t) => {
          setQuickActionFor(null);
          openCreateChild(t.id);
        }}
      />
    </div>
  );
}

type CardCommon = {
  courses: Course[];
  childrenByParent: Map<string, Task[]>;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onOpen: (t: Task) => void;
  onToggleChild: (t: Task, s: TaskStatus) => void;
  allTasks: Task[];
};

function Column({
  col,
  tasks,
  ...rest
}: {
  col: { key: TaskStatus; label: string; accent: string };
  tasks: Task[];
} & CardCommon) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border border-border/60 bg-surface/40 p-2 transition",
        isOver && "ring-2 ring-primary/50",
      )}
    >
      <div className="mb-2 flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: col.accent }} />
        {col.label}
        <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px]">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2 min-h-[80px]">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} {...rest} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({
  task,
  ...rest
}: {
  task: Task;
} & CardCommon) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("touch-none", isDragging && "opacity-50")}
    >
      <Card task={task} dragHandle={{ ...listeners, ...attributes }} {...rest} />
    </div>
  );
}

function Card({
  task,
  dragHandle,
  courses,
  childrenByParent,
  expanded,
  onToggleExpand,
  onOpen,
  onToggleChild,
  allTasks,
}: {
  task: Task;
  dragHandle: Record<string, unknown>;
} & CardCommon) {
  const c = courses.find((x) => x.id === task.course_id);
  const overdue =
    task.due_at && parseISO(task.due_at).getTime() < Date.now() && task.status !== "done";
  const kids = childrenByParent.get(task.id) ?? [];
  const doneKids = kids.filter((k) => k.status === "done").length;
  const isOpen = expanded.has(task.id);
  const parent = task.parent_id ? allTasks.find((x) => x.id === task.parent_id) : null;
  return (
    <div className="rounded-xl border border-border/60 bg-surface shadow-sm">
      <div className="flex items-start gap-1 p-1">
        {kids.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(task.id);
            }}
            className="mt-1 rounded-md p-1 text-muted-foreground hover:bg-surface-2"
            aria-label={isOpen ? "Fäll ihop" : "Fäll ut"}
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpen(task)}
          {...dragHandle}
          className={cn(
            "flex-1 rounded-lg p-2 text-left hover:bg-white/5",
            kids.length === 0 && "pl-2",
          )}
        >
          {parent && (
            <div className="text-[10px] text-muted-foreground mb-0.5">
              Deluppgift till: <span className="italic font-medium">{parent.title}</span>
            </div>
          )}
          <div
            className={cn(
              "mb-1 text-sm font-medium",
              task.status === "done" && "line-through text-muted-foreground",
            )}
          >
            {task.title}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            {c && (
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: c.color }}
                />
                {c.name}
              </span>
            )}
            <span className={`rounded-full px-1.5 py-0.5 ${TYPE_COLORS[task.task_type]}`}>
              {TYPE_LABELS[task.task_type]}
            </span>
            {task.due_at && (
              <span className={cn("inline-flex items-center gap-1", overdue && "text-sunset-rose")}>
                <CalIcon className="h-2.5 w-2.5" />{" "}
                {format(parseISO(task.due_at), "d MMM", { locale: sv })} ·{" "}
                {daysLeftLabel(task.due_at)}
              </span>
            )}
            {kids.length > 0 && (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5">
                {doneKids}/{kids.length} klara
              </span>
            )}
            {task.grade && task.task_type !== "annat" && task.task_type !== "modul" && (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5">Betyg: {task.grade}</span>
            )}
          </div>
        </button>
      </div>
      {kids.length > 0 && isOpen && (
        <div className="border-t border-border/40 px-2 py-2 space-y-1">
          {kids.map((k) => (
            <ChildRow key={k.id} child={k} onToggle={onToggleChild} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildRow({
  child,
  onToggle,
  onOpen,
}: {
  child: Task;
  onToggle: (t: Task, s: TaskStatus) => void;
  onOpen: (t: Task) => void;
}) {
  const isDone = child.status === "done";
  return (
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(child, isDone ? "todo" : "done");
        }}
        className={cn(
          "flex h-4 w-4 flex-none items-center justify-center rounded-md border transition",
          isDone
            ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400"
            : "border-border/60 hover:border-primary/60",
        )}
        aria-label={isDone ? "Markera ej klar" : "Markera klar"}
      >
        {isDone && <Check className="h-3 w-3" />}
      </button>
      <button
        type="button"
        onClick={() => onOpen(child)}
        className={cn(
          "flex-1 truncate text-left text-xs",
          isDone && "line-through text-muted-foreground",
        )}
      >
        {child.title}
      </button>
      <span className={cn("rounded-full px-1.5 py-0.25 text-[9px] border border-white/5 shrink-0", TYPE_COLORS[child.task_type])}>
        {TYPE_LABELS[child.task_type]}
      </span>
      {child.grade && child.task_type !== "annat" && child.task_type !== "modul" && (
        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] shrink-0">
          Betyg: {child.grade}
        </span>
      )}
      {child.pending_review && (
        <span className="rounded-full border border-sunset-amber/30 text-sunset-amber bg-sunset-amber/10 px-1.5 py-0.5 text-[9px] shrink-0 font-medium">
          Väntar på bedömning
        </span>
      )}
      {child.due_at && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {format(parseISO(child.due_at), "d MMM", { locale: sv })}
        </span>
      )}
    </div>
  );
}
