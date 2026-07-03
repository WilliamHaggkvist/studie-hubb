import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Archive, Play, Plus, Clock, ListTodo, FileText, Trash2, Upload, Download, CheckCircle2, Pencil, GraduationCap, StickyNote, CalendarClock, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { formatHoursCompact } from "@/lib/timer-store";
import { timerStore } from "@/lib/timer-store";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { sv } from "date-fns/locale";
import { PALETTE, DEFAULT_COURSE_ICONS, COURSE_PERIODS, ARSKURS_OPTIONS } from "@/lib/course-presets";
import { useUniversities } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  component: CourseDetail,
});

type CourseRow = {
  id: string; name: string; code: string | null; color: string; icon: string | null;
  archived: boolean; hp: number | null; period: string | null; arskurs: number | null;
  university_id: string | null; weekly_goal_hours: number | null; literature: string | null;
  teacher_name: string | null; teacher_contact: string | null; completed: boolean;
  final_grade: string | null;
};

type CourseFile = { id: string; storage_path: string; name: string; size_bytes: number | null; created_at: string };

function CourseDetail() {
  const { courseId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: universities = [] } = useUniversities();

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses")
        .select("id,name,code,color,icon,archived,hp,period,arskurs,university_id,weekly_goal_hours,literature,teacher_name,teacher_contact,completed,final_grade")
        .eq("id", courseId).maybeSingle();
      if (error) throw error;
      return data as CourseRow | null;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "course", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("tasks")
        .select("id,title,status,due_at,task_kind")
        .eq("course_id", courseId)
        .order("due_at", { ascending: true, nullsFirst: false });
      return (data ?? []) as { id: string; title: string; status: string; due_at: string | null; task_kind: string | null }[];
    },
  });

  const { data: allTime = [] } = useQuery({
    queryKey: ["time", "course", courseId, "all"],
    queryFn: async () => {
      const { data } = await supabase.from("time_entries").select("duration_seconds,started_at").eq("course_id", courseId);
      return data ?? [];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["study_sessions", "course", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("study_sessions")
        .select("id,planned_start,planned_end,actual_start,actual_end,completed")
        .eq("needs_review", false)
        .eq("course_id", courseId)
        .order("planned_start", { ascending: false })
        .limit(10);
      return (data ?? []) as { id: string; planned_start: string | null; planned_end: string | null; actual_start: string | null; actual_end: string | null; completed: boolean }[];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["pages", "course", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("pages")
        .select("id,title,icon,updated_at")
        .eq("course_id", courseId)
        .eq("archived", false)
        .order("updated_at", { ascending: false });
      return (data ?? []) as { id: string; title: string; icon: string | null; updated_at: string }[];
    },
  });

  const { data: files = [] } = useQuery({
    queryKey: ["course_files", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("course_files").select("id,storage_path,name,size_bytes,created_at").eq("course_id", courseId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CourseFile[];
    },
  });

  const stats = useMemo(() => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    const we = endOfWeek(new Date(), { weekStartsOn: 1 });
    let weekSec = 0;
    const byWeek = new Map<string, { start: Date; sec: number }>();
    for (const e of allTime) {
      const d = new Date(e.started_at);
      const sec = e.duration_seconds ?? 0;
      if (d >= ws && d <= we) weekSec += sec;
      const wkStart = startOfWeek(d, { weekStartsOn: 1 });
      const key = wkStart.toISOString();
      const prev = byWeek.get(key);
      if (prev) prev.sec += sec; else byWeek.set(key, { start: wkStart, sec });
    }
    const weeks = [...byWeek.values()].filter((w) => w.sec > 0);
    const totals = weeks.map((w) => w.sec);
    const total = allTime.reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
    const avgSec = weeks.length ? totals.reduce((a, b) => a + b, 0) / weeks.length : 0;
    const maxW = weeks.length ? weeks.reduce((a, b) => (b.sec > a.sec ? b : a)) : null;
    const minW = weeks.length ? weeks.reduce((a, b) => (b.sec < a.sec ? b : a)) : null;
    return { weekSec, total, avgSec, maxW, minW };
  }, [allTime]);

  const goalHours = Number(course?.weekly_goal_hours ?? 0);
  const weekHours = stats.weekSec / 3600;
  const goalPct = goalHours > 0 ? Math.min(100, (weekHours / goalHours) * 100) : 0;
  const goalColor = goalPct >= 100 ? "#43aa8b" : goalPct >= 60 ? "#f9c74f" : goalPct >= 30 ? "#f3722c" : "#f94144";

  const [editOpen, setEditOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [gradeInput, setGradeInput] = useState(course?.final_grade ?? "");

  const archive = useMutation({
    mutationFn: async () => {
      if (!course) return;
      const { error } = await supabase.from("courses").update({ archived: !course.archived }).eq("id", courseId);
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
      toast.success("Kurs borttagen");
      navigate({ to: "/courses" });
    },
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
      const { data, error } = await supabase.from("pages").insert({
        user_id: u.user.id, course_id: courseId, title: "Ny anteckning", icon: "📝",
      }).select("id").single();
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

  if (!course) return <div className="p-8 text-sm text-muted-foreground">Laddar…</div>;

  const assignments = tasks;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/courses">Kurser</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{course.name}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* HEADER */}
      <div className="relative mb-4 overflow-hidden rounded-2xl border border-border/60 bg-surface/60 backdrop-blur-xl p-5">
        <div className="absolute inset-0 opacity-25 pointer-events-none" style={{ background: `radial-gradient(circle at 15% 15%, ${course.color}, transparent 55%)` }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl" style={{ background: `${course.color}22`, border: `1px solid ${course.color}55` }}>
              {course.icon}
            </div>
            <div className="min-w-0">
              {course.code && <div className="text-xs uppercase tracking-widest text-muted-foreground">{course.code}</div>}
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <span className="truncate">{course.name}</span>
                {course.completed && <CheckCircle2 className="h-5 w-5 text-c-7 shrink-0" />}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                {course.hp != null && <Chip>{course.hp} HP</Chip>}
                {course.period && <Chip>{course.period}</Chip>}
                {course.arskurs != null && <Chip>Årskurs {course.arskurs}</Chip>}
                {universityName && <Chip>{universityName}</Chip>}
                {goalHours > 0 && <Chip>Mål {goalHours} h/v</Chip>}
                {course.completed && course.final_grade && <Chip highlight>Slutbetyg: {course.final_grade}</Chip>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" className="gap-1 rounded-xl" onClick={() => { timerStore.start({ courseId }); toast.success("Timer startad"); }}>
              <Play className="h-3.5 w-3.5" /> Starta timer
            </Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Redigera
            </Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => archive.mutate()}>
              <Archive className="mr-1 h-3.5 w-3.5" /> {course.archived ? "Återställ" : "Arkivera"}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive rounded-xl" onClick={() => { if (confirm("Ta bort kursen?")) remove.mutate(); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Complete toggle */}
        <div className="relative mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={course.completed}
            onCheckedChange={() => {
              if (!course.completed) { setGradeInput(course.final_grade ?? ""); setCompleteOpen(true); }
              else toggleComplete.mutate({ completed: false, final_grade: null });
            }}
          />
          <span>Markera kursen som avklarad</span>
        </div>
      </div>

      {/* STATS PANEL */}
      <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Denna vecka</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="font-display text-2xl font-bold tabular-nums">{weekHours.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">/ {goalHours || "—"} h</div>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${goalPct}%`, background: goalColor }} />
          </div>
        </div>
        <StatBox label="Snitt / vecka" value={stats.avgSec > 0 ? `${(stats.avgSec / 3600).toFixed(1)} h` : "—"} sub={`Totalt ${formatHoursCompact(stats.total)}`} />
        <StatBox
          label="Max vecka"
          value={stats.maxW ? `${(stats.maxW.sec / 3600).toFixed(1)} h` : "—"}
          sub={stats.maxW ? format(stats.maxW.start, "'v.'w", { locale: sv }) : ""}
        />
        <StatBox
          label="Min vecka"
          value={stats.minW ? `${(stats.minW.sec / 3600).toFixed(1)} h` : "—"}
          sub={stats.minW ? format(stats.minW.start, "'v.'w", { locale: sv }) : ""}
        />
      </div>

      {/* CONTENT GRID */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2"><ListTodo className="h-4 w-4" style={{ color: course.color }} /> Uppgifter <span className="ml-auto text-xs text-muted-foreground">{assignments.length}</span></CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">Inga uppgifter.</div>
            ) : (
              <div className="space-y-1">
                {assignments.slice(0, 8).map((t) => (
                  <TaskRow key={t.id} title={t.title} due={t.due_at} done={t.status === "done"} />
                ))}
              </div>
            )}
            <div className="mt-2 text-right">
              <Link to="/tasks" className="text-[11px] text-muted-foreground hover:text-foreground">Öppna uppgifter →</Link>
            </div>
          </CardContent>
        </Card>


        <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" style={{ color: course.color }} /> Studiepass <span className="ml-auto text-xs text-muted-foreground">{sessions.length}</span></CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">Inga studiepass.</div>
            ) : (
              <div className="space-y-1">
                {sessions.map((s) => {
                  const start = s.actual_start ?? s.planned_start;
                  const end = s.actual_end ?? s.planned_end;
                  return (
                    <div key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
                      {s.completed ? <CheckCircle2 className="h-3.5 w-3.5 text-c-7" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="truncate">{start ? format(new Date(start), "EEE d MMM", { locale: sv }) : "—"}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                        {start && end ? `${format(new Date(start), "HH:mm")}–${format(new Date(end), "HH:mm")}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-2 text-right">
              <Link to="/time" className="text-[11px] text-muted-foreground hover:text-foreground">Öppna studietid →</Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="font-display text-base flex items-center gap-2"><StickyNote className="h-4 w-4" style={{ color: course.color }} /> Anteckningar <span className="ml-1 text-xs text-muted-foreground">{notes.length}</span></CardTitle>
            <Button size="sm" variant="ghost" className="gap-1 rounded-xl" onClick={() => createNote.mutate()} disabled={createNote.isPending}>
              <Plus className="h-3.5 w-3.5" /> Ny
            </Button>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">Inga anteckningar.</div>
            ) : (
              <div className="space-y-1">
                {notes.slice(0, 8).map((n) => (
                  <Link key={n.id} to="/notes/$noteId" params={{ noteId: n.id }} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2/60">
                    <span className="text-base leading-none">{n.icon ?? "📝"}</span>
                    <span className="truncate">{n.title || "Utan titel"}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{format(new Date(n.updated_at), "d MMM", { locale: sv })}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" style={{ color: course.color }} /> Lärare & litteratur</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Lärare</div>
              {course.teacher_name || course.teacher_contact ? (
                <div className="space-y-1">
                  {course.teacher_name && <div>{course.teacher_name}</div>}
                  {course.teacher_contact && <div className="text-muted-foreground">{course.teacher_contact}</div>}
                </div>
              ) : <div className="text-xs text-muted-foreground">Ingen information.</div>}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Kurslitteratur</div>
              {course.literature ? (
                <div className="whitespace-pre-wrap text-foreground/90">{course.literature}</div>
              ) : <div className="text-xs text-muted-foreground">Ingen litteratur inlagd.</div>}
            </div>
          </CardContent>
        </Card>

        <FilesCard courseId={courseId} files={files} color={course.color} />
      </div>

      <EditCourseDialog open={editOpen} onOpenChange={setEditOpen} course={course} />

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="glass rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Slutbetyg</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Betyg (t.ex. A, 5, VG)</Label>
            <Input value={gradeInput} onChange={(e) => setGradeInput(e.target.value)} placeholder="Slutbetyg" autoFocus className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setCompleteOpen(false)}>Avbryt</Button>
            <Button className="rounded-xl" onClick={() => toggleComplete.mutate({ completed: true, final_grade: gradeInput.trim() || null })}>Markera avklarad</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function TaskRow({ title, due, done }: { title: string; due: string | null; done: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
      <span className={cn("h-1.5 w-1.5 rounded-full", done ? "bg-c-7" : "bg-muted-foreground/50")} />
      <span className={cn("truncate", done && "line-through text-muted-foreground")}>{title}</span>
      <span className="ml-auto text-[10px] text-muted-foreground">
        {due ? format(new Date(due), "d MMM", { locale: sv }) : "—"}
      </span>
    </div>
  );
}

function Chip({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 border",
      highlight
        ? "bg-c-7/15 border-c-7/40 text-c-7"
        : "bg-surface-2/60 border-border/60 text-muted-foreground",
    )}>{children}</span>
  );
}

function FilesCard({ courseId, files, color }: { courseId: string; files: CourseFile[]; color: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setUploading(false); return; }
    const path = `${u.user.id}/${courseId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("course-files").upload(path, file, { upsert: false });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { error: insErr } = await supabase.from("course_files").insert({
      user_id: u.user.id, course_id: courseId, storage_path: path, name: file.name, mime_type: file.type, size_bytes: file.size,
    });
    if (insErr) toast.error(insErr.message);
    else { toast.success("Fil uppladdad"); qc.invalidateQueries({ queryKey: ["course_files", courseId] }); }
    setUploading(false);
  }

  async function download(f: CourseFile) {
    const { data, error } = await supabase.storage.from("course-files").createSignedUrl(f.storage_path, 60);
    if (error || !data) return toast.error("Kunde inte hämta fil");
    window.open(data.signedUrl, "_blank");
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
        <CardTitle className="font-display text-base flex items-center gap-2"><Upload className="h-4 w-4" style={{ color }} /> Kursfiler</CardTitle>
        <Button size="sm" variant="ghost" className="gap-1 rounded-xl" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <Plus className="h-3.5 w-3.5" /> {uploading ? "Laddar upp…" : "Ladda upp"}
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </CardHeader>
      <CardContent>
        {files.length === 0 && <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">Inga filer — ladda upp kurs-PM, schema och andra dokument.</div>}
        <div className="space-y-1">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2/60">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-[10px] text-muted-foreground">{f.size_bytes ? `${Math.round(f.size_bytes / 1024)} kB` : ""}</span>
              <button className="p-1 text-muted-foreground hover:text-foreground" onClick={() => download(f)}><Download className="h-3.5 w-3.5" /></button>
              <button className="p-1 text-muted-foreground hover:text-destructive" onClick={() => remove(f)}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EditCourseDialog({ open, onOpenChange, course }: { open: boolean; onOpenChange: (b: boolean) => void; course: CourseRow }) {
  const qc = useQueryClient();
  const { data: universities = [] } = useUniversities();
  const [form, setForm] = useState({
    name: course.name,
    code: course.code ?? "",
    icon: course.icon ?? DEFAULT_COURSE_ICONS[0],
    color: course.color,
    hp: course.hp?.toString() ?? "",
    period: course.period ?? "",
    arskurs: course.arskurs?.toString() ?? "",
    university_id: course.university_id ?? "",
    weekly_goal_hours: course.weekly_goal_hours?.toString() ?? "",
    literature: course.literature ?? "",
    teacher_name: course.teacher_name ?? "",
    teacher_contact: course.teacher_contact ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("courses").update({
        name: form.name.trim(),
        code: form.code.trim() || null,
        icon: form.icon,
        color: form.color,
        hp: form.hp ? Number(form.hp) : null,
        period: (form.period || null) as "P1" | "P2" | "P3" | "P4" | "P5" | null,
        arskurs: form.arskurs ? Number(form.arskurs) : null,
        university_id: form.university_id || null,
        weekly_goal_hours: form.weekly_goal_hours ? Number(form.weekly_goal_hours) : 0,
        literature: form.literature.trim() || null,
        teacher_name: form.teacher_name.trim() || null,
        teacher_contact: form.teacher_contact.trim() || null,
      }).eq("id", course.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course", course.id] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Sparat");
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Redigera kurs</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Namn</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Kurskod</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label>HP</Label><Input type="number" step="0.5" value={form.hp} onChange={(e) => setForm({ ...form, hp: e.target.value })} className="rounded-xl" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Välj" /></SelectTrigger>
                <SelectContent>{COURSE_PERIODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Årskurs</Label>
              <Select value={form.arskurs} onValueChange={(v) => setForm({ ...form, arskurs: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Välj" /></SelectTrigger>
                <SelectContent>{ARSKURS_OPTIONS.map((a) => <SelectItem key={a} value={String(a)}>Årskurs {a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Universitet</Label>
            <Select value={form.university_id} onValueChange={(v) => setForm({ ...form, university_id: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Välj" /></SelectTrigger>
              <SelectContent>{universities.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Veckomål (h)</Label>
            <Input type="number" step="0.5" value={form.weekly_goal_hours} onChange={(e) => setForm({ ...form, weekly_goal_hours: e.target.value })} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Lärare (namn)</Label>
            <Input value={form.teacher_name} onChange={(e) => setForm({ ...form, teacher_name: e.target.value })} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Lärarens kontakt (e-post, tel, …)</Label>
            <Input value={form.teacher_contact} onChange={(e) => setForm({ ...form, teacher_contact: e.target.value })} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Kurslitteratur</Label>
            <Textarea rows={4} value={form.literature} onChange={(e) => setForm({ ...form, literature: e.target.value })} className="rounded-xl" placeholder="En bok per rad, gärna med författare och upplaga…" />
          </div>
          <div className="space-y-1.5">
            <Label>Ikon</Label>
            <div className="flex flex-wrap gap-1">
              {DEFAULT_COURSE_ICONS.map((i) => (
                <button type="button" key={i} onClick={() => setForm({ ...form, icon: i })} className={cn("grid h-9 w-9 place-items-center rounded-xl border text-lg", form.icon === i ? "border-primary bg-surface-2" : "border-border/60 hover:bg-surface")}>{i}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Färg</Label>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button type="button" key={c.value} onClick={() => setForm({ ...form, color: c.value })} className={cn("h-8 w-8 rounded-full border-2", form.color === c.value ? "border-foreground scale-110" : "border-transparent")} style={{ background: c.value }} title={c.name} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="rounded-xl" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button className="rounded-xl" onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>Spara</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
