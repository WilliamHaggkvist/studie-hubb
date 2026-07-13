import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Archive,
  Play,
  Plus,
  Clock,
  ListTodo,
  FileText,
  Trash2,
  Upload,
  Download,
  CheckCircle2,
  Pencil,
  GraduationCap,
  StickyNote,
  CalendarClock,
  TrendingUp,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { formatHoursCompact } from "@/lib/timer-store";
import { timerStore } from "@/lib/timer-store";
import { format, startOfWeek, endOfWeek, differenceInCalendarDays, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { QuickStatusDialog } from "@/components/tasks/quick-status-dialog";
import { CompleteDialog } from "@/components/tasks/complete-dialog";
import { type Task, type TaskStatus, TYPE_LABELS, TYPE_COLORS } from "@/lib/queries";
import {
  PALETTE,
  DEFAULT_COURSE_ICONS,
  COURSE_PERIODS,
  ARSKURS_OPTIONS,
  formatPeriods,
} from "@/lib/course-presets";
import { useUniversities } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { EditCourseDialog } from "@/components/courses/edit-course-dialog";
import { FilesCard } from "@/components/courses/files-card";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  component: CourseDetail,
});

type CourseRow = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  icon: string | null;
  archived: boolean;
  hp: number | null;
  period: string | null;
  periods: string[] | null;
  arskurs: number | null;
  university_id: string | null;
  weekly_goal_hours: number | null;
  literature: string | null;
  teacher_name: string | null;
  teacher_contact: string | null;
  completed: boolean;
  final_grade: string | null;
  is_standalone: boolean;
};

type CourseFile = {
  id: string;
  storage_path: string;
  name: string;
  size_bytes: number | null;
  created_at: string;
};

function CourseDetail() {
  const { courseId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: universities = [] } = useUniversities();

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(
          "id,name,code,color,icon,archived,hp,period,periods,arskurs,university_id,weekly_goal_hours,literature,teacher_name,teacher_contact,completed,final_grade,is_standalone",
        )
        .eq("id", courseId)
        .maybeSingle();
      if (error) throw error;
      return data as CourseRow | null;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "course", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,description,status,due_at,course_id,task_type,task_kind,grade,points,pending_review,completed_at,parent_id")
        .eq("course_id", courseId)
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("title", { ascending: true });
      return (data ?? []) as Task[];
    },
  });

  const { data: allTime = [] } = useQuery({
    queryKey: ["time", "course", courseId, "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("duration_seconds,started_at,source")
        .eq("course_id", courseId);
      return (data ?? []) as Array<{
        duration_seconds: number | null;
        started_at: string;
        source: string;
      }>;
    },
  });

  const { data: allSessions = [] } = useQuery({
    queryKey: ["study_sessions", "course", courseId, "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("id,planned_start,planned_end,actual_start,actual_end,completed,source")
        .eq("needs_review", false)
        .eq("course_id", courseId);
      return (data ?? []) as Array<{
        id: string;
        planned_start: string;
        planned_end: string;
        actual_start: string | null;
        actual_end: string | null;
        completed: boolean;
        source: string;
      }>;
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["study_sessions", "course", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("id,planned_start,planned_end,actual_start,actual_end,completed,source")
        .eq("needs_review", false)
        .eq("course_id", courseId)
        .order("planned_start", { ascending: false })
        .limit(10);
      return (data ?? []) as Array<{
        id: string;
        planned_start: string;
        planned_end: string;
        actual_start: string | null;
        actual_end: string | null;
        completed: boolean;
        source: string;
      }>;
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["pages", "course", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pages")
        .select("id,title,icon,updated_at")
        .eq("course_id", courseId)
        .eq("archived", false)
        .order("updated_at", { ascending: false });
      return (data ?? []) as {
        id: string;
        title: string;
        icon: string | null;
        updated_at: string;
      }[];
    },
  });

  const { data: files = [] } = useQuery({
    queryKey: ["course_files", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_files")
        .select("id,storage_path,name,size_bytes,created_at")
        .eq("course_id", courseId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CourseFile[];
    },
  });

  const combinedTime = useMemo(() => {
    const out: Array<{ started_at: string; duration_seconds: number }> = [];
    for (const e of allTime) {
      if (e.source === "session") continue;
      if (!e.started_at) continue;
      out.push({
        started_at: e.started_at,
        duration_seconds: e.duration_seconds ?? 0,
      });
    }
    for (const s of allSessions) {
      const start = s.actual_start ?? s.planned_start;
      const end = s.actual_end ?? s.planned_end;
      if (!start) continue;
      const startMs = new Date(start).getTime();
      const endMs = end ? new Date(end).getTime() : startMs;
      if (isNaN(startMs)) continue;
      const dur = Math.max(0, Math.floor((endMs - startMs) / 1000));
      out.push({
        started_at: start,
        duration_seconds: dur || 0,
      });
    }
    return out;
  }, [allTime, allSessions]);

  const stats = useMemo(() => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    const we = endOfWeek(new Date(), { weekStartsOn: 1 });
    let weekSec = 0;
    const byWeek = new Map<string, { start: Date; sec: number }>();
    for (const e of combinedTime) {
      if (!e.started_at) continue;
      const d = new Date(e.started_at);
      if (isNaN(d.getTime())) continue;
      const sec = e.duration_seconds;
      if (d >= ws && d <= we) weekSec += sec;
      const wkStart = startOfWeek(d, { weekStartsOn: 1 });
      const key = wkStart.toISOString();
      const prev = byWeek.get(key);
      if (prev) prev.sec += sec;
      else byWeek.set(key, { start: wkStart, sec });
    }
    const weeks = [...byWeek.values()].filter((w) => w.sec > 0);
    const totals = weeks.map((w) => w.sec);
    const total = combinedTime.reduce((s, r) => s + r.duration_seconds, 0);
    const avgSec = weeks.length ? totals.reduce((a, b) => a + b, 0) / weeks.length : 0;
    const maxW = weeks.length ? weeks.reduce((a, b) => (b.sec > a.sec ? b : a)) : null;
    const minW = weeks.length ? weeks.reduce((a, b) => (b.sec < a.sec ? b : a)) : null;
    return { weekSec, total, avgSec, maxW, minW };
  }, [combinedTime]);

  const goalHours = Number(course?.weekly_goal_hours ?? 0);
  const weekHours = stats.weekSec / 3600;
  const goalPct = goalHours > 0 ? Math.min(100, (weekHours / goalHours) * 100) : 0;
  const goalColor =
    goalPct >= 100 ? "#43aa8b" : goalPct >= 60 ? "#f9c74f" : goalPct >= 30 ? "#f3722c" : "#f94144";

  const [editOpen, setEditOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [gradeInput, setGradeInput] = useState(course?.final_grade ?? "");

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completeFor, setCompleteFor] = useState<Task | null>(null);
  const [quickActionFor, setQuickActionFor] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const rootTasks = useMemo(() => {
    return tasks.filter((t) => t.parent_id === null);
  }, [tasks]);

  const childrenByParent = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.parent_id) {
        const arr = m.get(t.parent_id) ?? [];
        arr.push(t);
        m.set(t.parent_id, arr);
      }
    }
    return m;
  }, [tasks]);

  const toggleExpandTask = (id: string) =>
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const coursesOption = useMemo(() => {
    return course ? [{ id: course.id, name: course.name, color: course.color }] : [];
  }, [course]);

  const upsertTask = useMutation({
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
          course_id: courseId,
          task_type: patch.task_type ?? "annat",
          task_kind: patch.task_kind ?? "task",
          status: patch.status ?? "todo",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", "course", courseId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Uppgift sparad");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const removeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", "course", courseId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Uppgift borttagen");
    },
  });

  const setTaskStatus = (t: Task, s: TaskStatus) => {
    if (s === "done") {
      if (t.task_type === "annat" || t.task_type === "modul") {
        upsertTask.mutate({
          id: t.id,
          status: "done",
          grade: null,
          points: null,
          pending_review: false,
        });
      } else {
        setCompleteFor(t);
      }
      return;
    }
    const wasPending = t.pending_review || t.status === "done";
    const patch = {
      id: t.id,
      status: s,
      ...(wasPending && { grade: null, points: null, pending_review: false }),
    };
    upsertTask.mutate(patch);
  };

  const archive = useMutation({
    mutationFn: async () => {
      if (!course) return;
      const { error } = await supabase
        .from("courses")
        .update({ archived: !course.archived })
        .eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      toast.success("Uppdaterad");
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("courses").delete().eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["study_sessions"] });
      qc.invalidateQueries({ queryKey: ["time_entries"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Kurs borttagen");
      navigate({ to: "/courses" });
    },
  });

  const toggleArchive = useMutation({
    mutationFn: async () => {
      const nextArchived = !course?.archived;
      const update: { archived: boolean; completed?: boolean; final_grade?: string | null } = {
        archived: nextArchived,
      };
      if (nextArchived) {
        update.completed = false;
        update.final_grade = null;
      }
      const { error } = await supabase.from("courses").update(update).eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success(
        course?.archived ? "Kurs markerad som aktiv" : "Kurs arkiverad / markerad som inaktiv",
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const toggleComplete = useMutation({
    mutationFn: async (payload: { completed: boolean; final_grade: string | null }) => {
      const { error } = await supabase.from("courses").update(payload).eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      setCompleteOpen(false);
      toast.success("Uppdaterad");
    },
  });

  const createNote = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Ej inloggad");
      const { data, error } = await supabase
        .from("pages")
        .insert({
          user_id: u.user.id,
          course_id: courseId,
          title: "Ny anteckning",
          icon: "📝",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["pages", "course", courseId] });
      qc.invalidateQueries({ queryKey: ["pages"] });
      navigate({ to: "/notes/$noteId", params: { noteId: id } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const universityName = universities.find((u) => u.id === course?.university_id)?.name;

  const assignments = tasks;

  const examTasks = useMemo(() => {
    return tasks.filter((t) => t.task_type !== "annat" && t.task_type !== "modul");
  }, [tasks]);

  const completedExamTasks = useMemo(() => {
    return examTasks.filter((t) => t.status === "done");
  }, [examTasks]);

  const examProgressPct =
    examTasks.length > 0 ? (completedExamTasks.length / examTasks.length) * 100 : 0;

  if (!course) return <div className="p-8 text-sm text-muted-foreground">Laddar…</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/courses">Kurser</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{course.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* HEADER */}
      <div className="relative mb-4 overflow-hidden rounded-2xl border border-border/60 bg-surface/60 backdrop-blur-xl p-5">
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 15% 15%, ${course.color}, transparent 55%)`,
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl select-none"
              style={{ background: `${course.color}22`, border: `1px solid ${course.color}55` }}
            >
              <GraduationCap className="h-7 w-7" style={{ color: course.color }} />
            </div>
            <div className="min-w-0 flex-1">
              {course.code && (
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {course.code}
                </div>
              )}
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <span className="truncate">{course.name}</span>
                {course.completed && <CheckCircle2 className="h-5 w-5 text-c-7 shrink-0" />}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                {course.hp != null && <Chip>{course.hp} HP</Chip>}
                {(() => { const label = formatPeriods(course.periods, course.period); return label ? <Chip>{label}</Chip> : null; })()}
                {course.arskurs != null && <Chip>Årskurs {course.arskurs}</Chip>}
                {universityName && <Chip>{universityName}</Chip>}
                {goalHours > 0 && <Chip>Mål {goalHours} h/v</Chip>}
                {course.is_standalone ? (
                  <Chip highlight>Fristående kurs</Chip>
                ) : (
                  <Chip>Programkurs</Chip>
                )}
                {!course.archived && course.completed && course.final_grade && (
                  <Chip highlight>Slutbetyg: {course.final_grade}</Chip>
                )}
              </div>
              {examTasks.length > 0 && (
                <div className="mt-4 space-y-2 max-w-sm">
                  <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                    <span>
                      Examinationsframsteg ({completedExamTasks.length} av {examTasks.length}{" "}
                      avklarade)
                    </span>
                    <span className="font-semibold tabular-nums text-foreground shrink-0">
                      {Math.round(examProgressPct)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${examProgressPct}%`, backgroundColor: course.color }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              className="gap-1 rounded-xl"
              onClick={() => {
                timerStore.start({ courseId });
                toast.success("Timer startad");
              }}
            >
              <Play className="h-3.5 w-3.5" /> Starta timer
            </Button>
            {!course.archived &&
              (course.completed ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 rounded-xl border-c-7/40 bg-c-7/10 text-c-7 hover:bg-c-7/20 hover:text-c-7"
                  onClick={() => toggleComplete.mutate({ completed: false, final_grade: null })}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-c-7" /> Avklarad
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 rounded-xl hover:text-c-7 hover:bg-c-7/10"
                  onClick={() => {
                    setGradeInput(course.final_grade ?? "");
                    setCompleteOpen(true);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Markera avklarad
                </Button>
              ))}
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 rounded-xl"
              onClick={() => toggleArchive.mutate()}
              disabled={toggleArchive.isPending}
            >
              <Archive className="h-3.5 w-3.5" />{" "}
              {course.archived ? "Markera som aktiv" : "Markera som inaktiv"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl"
              onClick={() => setEditOpen(true)}
              disabled={course.completed}
              title={course.completed ? "Inställningar är låsta för en avklarad kurs" : undefined}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" /> Redigera
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive rounded-xl"
              onClick={() => {
                if (confirm("Ta bort kursen?")) remove.mutate();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* STATS PANEL */}
      <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Denna vecka
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="font-display text-2xl font-bold tabular-nums">
              {weekHours.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">/ {goalHours || "—"} h</div>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${goalPct}%`, background: goalColor }}
            />
          </div>
        </div>
        <StatBox
          label="Snitt / vecka"
          value={stats.avgSec > 0 ? `${(stats.avgSec / 3600).toFixed(2)} h` : "—"}
          sub={`Totalt ${formatHoursCompact(stats.total)}`}
        />
        <StatBox
          label="Max vecka"
          value={stats.maxW ? `${(stats.maxW.sec / 3600).toFixed(2)} h` : "—"}
          sub={stats.maxW && !isNaN(stats.maxW.start.getTime()) ? format(stats.maxW.start, "'v.'I", { locale: sv }) : ""}
        />
        <StatBox
          label="Min vecka"
          value={stats.minW ? `${(stats.minW.sec / 3600).toFixed(2)} h` : "—"}
          sub={stats.minW && !isNaN(stats.minW.start.getTime()) ? format(stats.minW.start, "'v.'I", { locale: sv }) : ""}
        />
      </div>

      {/* CONTENT GRID */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <ListTodo className="h-4 w-4" style={{ color: course.color }} /> Uppgifter{" "}
              <span className="ml-auto text-xs text-muted-foreground">{assignments.length}</span>
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 rounded-xl"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Ny
            </Button>
          </CardHeader>
          <CardContent>
            {rootTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Inga uppgifter.
              </div>
            ) : (
              <div className="space-y-2">
                {rootTasks.slice(0, 15).map((t) => {
                  const kids = childrenByParent.get(t.id) ?? [];
                  const isExpanded = expandedTasks.has(t.id);
                  return (
                    <div key={t.id} className={cn(kids.length > 0 && "rounded-xl border border-border/40 bg-surface/30 overflow-hidden")}>
                      <div className="flex items-center">
                        {kids.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpandTask(t.id)}
                            className="p-2.5 text-muted-foreground hover:text-foreground shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <TaskRow
                            task={t}
                            onClick={() => setQuickActionFor(t)}
                            hasChevron={kids.length > 0}
                          />
                        </div>
                      </div>
                      {isExpanded && kids.length > 0 && (
                        <div className="border-t border-border/40 bg-black/10 px-4 py-2 space-y-1.5">
                          {kids.map((k) => {
                            const kDue = k.due_at ? new Date(k.due_at) : null;
                            const kValidDue = kDue && !isNaN(kDue.getTime());
                            const kDone = k.status === "done";
                            const kOverdue = kValidDue && kDue.getTime() < Date.now() && !kDone;
                            return (
                              <div key={k.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-white/5">
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full shrink-0",
                                    k.status === "done"
                                      ? "bg-c-7"
                                      : k.status === "doing"
                                      ? "bg-amber-500"
                                      : "bg-muted-foreground/40"
                                  )}
                                />
                                <button
                                  onClick={() => setQuickActionFor(k)}
                                  className={cn(
                                    "flex-1 text-left truncate font-medium",
                                    k.status === "done" && "line-through text-muted-foreground"
                                  )}
                                >
                                  {k.title}
                                </button>
                                <span className={cn("rounded-full px-1.5 py-0.25 text-[9px] border border-white/5 shrink-0", TYPE_COLORS[k.task_type])}>
                                  {TYPE_LABELS[k.task_type]}
                                </span>
                                {k.grade && k.task_type !== "annat" && k.task_type !== "modul" && (
                                  <span className="rounded-full bg-surface-2 px-1 py-0.25 text-[9px] shrink-0">
                                    Betyg: {k.grade}
                                  </span>
                                )}
                                {kValidDue && (
                                  <span className={cn("text-[10px] text-muted-foreground shrink-0", kOverdue && "text-sunset-rose font-medium")}>
                                    {format(kDue, "d MMM", { locale: sv })}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 text-right">
              <Link to="/tasks" className="text-[11px] text-muted-foreground hover:text-foreground">
                Öppna alla uppgifter i listvy →
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" style={{ color: course.color }} /> Studiepass{" "}
              <span className="ml-auto text-xs text-muted-foreground">{sessions.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Inga studiepass.
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((s) => {
                  const start = s.actual_start ?? s.planned_start;
                  const end = s.actual_end ?? s.planned_end;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                    >
                      {s.completed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-c-7" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="truncate">
                        {start && !isNaN(new Date(start).getTime()) ? format(new Date(start), "EEE d MMM", { locale: sv }) : "—"}
                      </span>
                      <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                        {start && end && !isNaN(new Date(start).getTime()) && !isNaN(new Date(end).getTime())
                          ? `${format(new Date(start), "HH:mm")}–${format(new Date(end), "HH:mm")}`
                          : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-2 text-right">
              <Link to="/time" className="text-[11px] text-muted-foreground hover:text-foreground">
                Öppna studietid →
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <StickyNote className="h-4 w-4" style={{ color: course.color }} /> Anteckningar{" "}
              <span className="ml-1 text-xs text-muted-foreground">{notes.length}</span>
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 rounded-xl"
              onClick={() => createNote.mutate()}
              disabled={createNote.isPending}
            >
              <Plus className="h-3.5 w-3.5" /> Ny
            </Button>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Inga anteckningar.
              </div>
            ) : (
              <div className="space-y-1">
                {notes.slice(0, 8).map((n) => (
                  <Link
                    key={n.id}
                    to="/notes/$noteId"
                    params={{ noteId: n.id }}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2/60"
                  >
                    <span className="text-base leading-none">{n.icon ?? "📝"}</span>
                    <span className="truncate">{n.title || "Utan titel"}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {n.updated_at && !isNaN(new Date(n.updated_at).getTime()) ? format(new Date(n.updated_at), "d MMM", { locale: sv }) : ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: course.color }} /> Lärare & litteratur
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Lärare
              </div>
              {course.teacher_name || course.teacher_contact ? (
                <div className="space-y-1">
                  {course.teacher_name && <div>{course.teacher_name}</div>}
                  {course.teacher_contact && (
                    <div className="text-muted-foreground">{course.teacher_contact}</div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Ingen information.</div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Kurslitteratur
              </div>
              {course.literature ? (
                <div className="whitespace-pre-wrap text-foreground/90">{course.literature}</div>
              ) : (
                <div className="text-xs text-muted-foreground">Ingen litteratur inlagd.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <FilesCard courseId={courseId} files={files} color={course.color} />
      </div>

      <EditCourseDialog open={editOpen} onOpenChange={setEditOpen} course={course} />

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="glass rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Slutbetyg</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Betyg (t.ex. A, 5, VG)</Label>
            <Input
              value={gradeInput}
              onChange={(e) => setGradeInput(e.target.value)}
              placeholder="Slutbetyg"
              autoFocus
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setCompleteOpen(false)}>
              Avbryt
            </Button>
            <Button
              className="rounded-xl"
              onClick={() =>
                toggleComplete.mutate({ completed: true, final_grade: gradeInput.trim() || null })
              }
            >
              Markera avklarad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickStatusDialog
        task={quickActionFor}
        onClose={() => setQuickActionFor(null)}
        onChangeStatus={(t, s) => {
          setQuickActionFor(null);
          setTaskStatus(t, s);
        }}
        onEdit={(t) => {
          setQuickActionFor(null);
          setEditingTask(t);
        }}
        onAddSubtask={(t) => {
          setQuickActionFor(null);
          setCreateParentId(t.id);
          setCreateOpen(true);
        }}
      />

      <TaskDialog
        open={!!editingTask}
        onOpenChange={(o) => !o && setEditingTask(null)}
        courses={coursesOption}
        task={editingTask ?? undefined}
        rootTasks={tasks.filter((t) => t.parent_id === null && t.id !== editingTask?.id)}
        hasChildren={editingTask ? (childrenByParent.get(editingTask.id)?.length ?? 0) > 0 : false}
        onDelete={
          editingTask
            ? () => {
                removeTask.mutate(editingTask.id);
                setEditingTask(null);
              }
            : undefined
        }
        onSave={(v) => {
          upsertTask.mutate(
            { ...v, id: editingTask!.id },
            {
              onSuccess: () => {
                setEditingTask(null);
              },
            },
          );
        }}
      />

      <TaskDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setCreateParentId(null);
        }}
        courses={coursesOption}
        rootTasks={tasks.filter((t) => t.parent_id === null)}
        defaultParentId={createParentId}
        onSave={(v) => {
          upsertTask.mutate({ ...v, parent_id: createParentId }, {
            onSuccess: () => {
              setCreateOpen(false);
              setCreateParentId(null);
              toast.success("Uppgift skapad");
            },
          });
        }}
      />

      <CompleteDialog
        task={completeFor}
        onClose={() => setCompleteFor(null)}
        onPending={(t) => {
          upsertTask.mutate(
            { id: t.id, pending_review: true },
            { onSuccess: () => setCompleteFor(null) },
          );
        }}
        onDone={(t, grade, points) => {
          const patch: Record<string, any> = { id: t.id, grade, points, pending_review: false };
          if (grade.trim() && points.trim()) {
            patch.status = "done";
            patch.completed_at = new Date().toISOString();
          }
          upsertTask.mutate(patch as Partial<Task> & { id: string }, {
            onSuccess: () => setCompleteFor(null),
          });
        }}
      />
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function TaskRow({
  task,
  onClick,
  hasChevron,
}: {
  task: Task;
  onClick: () => void;
  hasChevron?: boolean;
}) {
  const done = task.status === "done";
  const due = task.due_at ? new Date(task.due_at) : null;
  const validDue = due && !isNaN(due.getTime());

  let daysLeftStr = "";
  if (validDue && !done) {
    const d = differenceInCalendarDays(due, new Date());
    if (d === 0) daysLeftStr = "Idag";
    else if (d === 1) daysLeftStr = "Imorgon";
    else if (d === -1) daysLeftStr = "Försenad 1 d";
    else if (d < 0) daysLeftStr = `Försenad ${-d} d`;
    else daysLeftStr = `${d} d kvar`;
  }

  const overdue = validDue && due.getTime() < Date.now() && !done;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 text-left text-sm hover:bg-surface-2/40 transition-all cursor-pointer",
        hasChevron
          ? "pl-1 hover:text-primary"
          : "rounded-xl border border-border/40 bg-surface/30 hover:border-primary/30"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            task.status === "done"
              ? "bg-c-7"
              : task.status === "doing"
              ? "bg-amber-500"
              : "bg-muted-foreground/40"
          )}
        />
        <span className={cn("truncate font-medium", done && "line-through text-muted-foreground")}>
          {task.title}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 shrink-0 text-[10px]">
        <span className={cn("rounded-full px-2 py-0.5 font-medium border border-white/5", TYPE_COLORS[task.task_type])}>
          {TYPE_LABELS[task.task_type]}
        </span>
        {validDue && (
          <span className={cn("inline-flex items-center gap-1 text-muted-foreground", overdue && "text-sunset-rose font-medium")}>
            <span>{format(due, "d MMM", { locale: sv })}</span>
            {daysLeftStr && <span>· {daysLeftStr}</span>}
          </span>
        )}
      </div>
    </button>
  );
}

function Chip({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 border",
        highlight
          ? "bg-c-7/15 border-c-7/40 text-c-7"
          : "bg-surface-2/60 border-border/60 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
