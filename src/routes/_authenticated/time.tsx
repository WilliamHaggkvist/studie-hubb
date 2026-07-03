import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { timerStore, formatDuration, formatHoursCompact } from "@/lib/timer-store";
import { format, parseISO, subDays, startOfWeek } from "date-fns";
import { sv } from "date-fns/locale";
import { Trash2, Play, Square, CheckCircle2, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { coursesQuery, tasksQuery, durationSeconds, type Course, type Task } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/time")({
  component: TimePage,
});

type Entry = {
  id: string;
  course_id: string | null;
  task_id: string | null;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  source: string;
};
type Session = {
  id: string;
  course_id: string | null;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
  completed: boolean;
  source: string;
  needs_review: boolean;
};
type SessionTask = { session_id: string; task_id: string };

type SessionAgg = {
  id: string;
  course_id: string | null;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  completed: boolean;
};

function TimePage() {
  const [period, setPeriod] = useState<"week" | "30">("week");

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const courses = allCourses.filter((c) => !c.archived);
  const { data: allTasks = [] } = useQuery(tasksQuery);


  const { data: entries = [] } = useQuery({
    queryKey: ["time_entries", "list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("id,course_id,task_id,description,started_at,ended_at,duration_seconds,source")
        .not("duration_seconds", "is", null)
        .order("started_at", { ascending: false })
        .limit(200);
      return (data ?? []) as Entry[];
    },
  });

  const { data: allSessions = [] } = useQuery({
    queryKey: ["study_sessions", "agg"],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("id,course_id,planned_start,planned_end,actual_start,actual_end,completed")
        .eq("needs_review", false)
        .order("planned_start", { ascending: false })
        .limit(500);
      return (data ?? []) as SessionAgg[];
    },
  });

  // Date range for period
  const cutoffDate = useMemo(() => {
    if (period === "week") return startOfWeek(new Date(), { weekStartsOn: 1 });
    return subDays(new Date(), 30);
  }, [period]);
  const cutoff = cutoffDate.getTime();

  const inPeriod = entries.filter((e) => new Date(e.started_at).getTime() >= cutoff);
  const sessionsInPeriod = allSessions.filter(
    (s) => new Date(s.planned_start).getTime() >= cutoff,
  );

  const sessionSeconds = (s: SessionAgg): number => {
    const start = s.actual_start ? new Date(s.actual_start) : new Date(s.planned_start);
    const end = s.actual_end ? new Date(s.actual_end) : new Date(s.planned_end);
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  };

  const entrySeconds = inPeriod.reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
  // Undvik dubbelräkning: genomförda pass skapar time_entries med source="session".
  const sessionsOnly = sessionsInPeriod.filter((s) => !s.completed);
  const sessionSecs = sessionsOnly.reduce((s, x) => s + sessionSeconds(x), 0);
  const totalPeriod = entrySeconds + sessionSecs;

  const byCourse = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of inPeriod) {
      const key = e.course_id ?? "__none__";
      m.set(key, (m.get(key) ?? 0) + (e.duration_seconds ?? 0));
    }
    for (const s of sessionsOnly) {
      const key = s.course_id ?? "__none__";
      m.set(key, (m.get(key) ?? 0) + sessionSeconds(s));
    }
    return Array.from(m.entries())
      .map(([id, secs]) => {
        const c = courses.find((cc) => cc.id === id);
        return { id, name: c?.name ?? "Ingen kurs", color: c?.color ?? "#64748b", hours: +(secs / 3600).toFixed(2), seconds: secs };
      })
      .sort((a, b) => b.hours - a.hours);
  }, [inPeriod, sessionsOnly, courses]);



  const byTask = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of inPeriod) {
      if (!e.task_id) continue;
      m.set(e.task_id, (m.get(e.task_id) ?? 0) + (e.duration_seconds ?? 0));
    }
    return Array.from(m.entries())
      .map(([id, secs]) => {
        const t = allTasks.find((tt) => tt.id === id);
        return { id, title: t?.title ?? "Uppgift borttagen", seconds: secs };
      })
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5);
  }, [inPeriod, allTasks]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Studietid</h1>
          <p className="text-sm text-muted-foreground">
            <span className="text-sunset-amber">{formatHoursCompact(totalPeriod)}</span>{" "}
            {period === "week" ? "denna vecka" : "senaste 30 dagarna"}
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as "week" | "30")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Denna vecka</SelectItem>
            <SelectItem value="30">Senaste 30 dagar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Weekly hours per course – prominent */}
      {period === "week" && (
        <div className="mb-6 rounded-xl border border-border/60 bg-surface/60 p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Studietimmar denna vecka
            </div>
            <div className="font-display text-2xl font-bold tabular-nums text-sunset-amber">
              {formatHoursCompact(totalPeriod)}
            </div>
          </div>
          {byCourse.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Inga studietimmar än denna vecka.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {byCourse.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-2/60 px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="text-sm">{c.name}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums">{formatHoursCompact(c.seconds)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* Summary */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-surface/40 p-4">
          <div className="mb-2 font-display text-sm font-semibold">Tid per kurs</div>
          {byCourse.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Ingen tid loggad</div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={byCourse} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit="h" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={100} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--accent))" }}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v} h`, "Tid"]}
                  />
                  <Bar dataKey="hours" radius={[0, 4, 4, 0]} fill="url(#sunset-bar)" />
                  <defs>
                    <linearGradient id="sunset-bar" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--sunset-amber))" />
                      <stop offset="100%" stopColor="hsl(var(--sunset-coral))" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border/60 bg-surface/40 p-4">
          <div className="mb-2 font-display text-sm font-semibold">Toppuppgifter</div>
          {byTask.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Ingen tid loggad på uppgifter</div>
          ) : (
            <div className="space-y-2">
              {byTask.map((t) => {
                const pct = totalPeriod > 0 ? (t.seconds / totalPeriod) * 100 : 0;
                return (
                  <div key={t.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <div className="truncate text-sm">{t.title}</div>
                      <div className="font-mono tabular-nums text-xs text-muted-foreground">
                        {formatHoursCompact(t.seconds)}
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full gradient-sunset" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList>
          <TabsTrigger value="sessions">Studiepass</TabsTrigger>
          <TabsTrigger value="timer">Timer</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-4">
          <SessionsPanel courses={courses} allTasks={allTasks} />
        </TabsContent>

        <TabsContent value="timer" className="mt-4">
          <TimerPanel courses={courses} allTasks={allTasks} />
        </TabsContent>
      </Tabs>

    </div>
  );
}

/* ============================== Studiepass ============================== */

function SessionsPanel({ courses, allTasks }: { courses: Course[]; allTasks: Task[] }) {
  const qc = useQueryClient();


  const { data: sessions = [] } = useQuery({
    queryKey: ["study_sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("id,course_id,planned_start,planned_end,actual_start,actual_end,notes,completed,source,needs_review")
        .order("planned_start", { ascending: false })
        .limit(200);
      return (data ?? []) as Session[];
    },
  });


  const { data: sessionTasks = [] } = useQuery({
    queryKey: ["study_session_tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("study_session_tasks").select("session_id,task_id");
      return (data ?? []) as SessionTask[];
    },
  });




  const complete = useMutation({
    mutationFn: async (sessionId: string) => {
      const s = sessions.find((x) => x.id === sessionId);
      if (!s) return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const start = s.actual_start ? new Date(s.actual_start) : new Date(s.planned_start);
      const end = s.actual_end ? new Date(s.actual_end) : new Date(s.planned_end);
      const duration = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));

      const tids = sessionTasks.filter((st) => st.session_id === s.id).map((st) => st.task_id);
      const base = {
        user_id: u.user.id,
        course_id: s.course_id,
        description: s.notes,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        duration_seconds: duration,
        source: "session",
      };
      const rows: Array<typeof base & { task_id: string | null }> =
        tids.length > 0 ? tids.map((task_id) => ({ ...base, task_id })) : [{ ...base, task_id: null }];
      const { error: eIns } = await supabase.from("time_entries").insert(rows);
      if (eIns) throw eIns;

      const { error: eUpd } = await supabase
        .from("study_sessions")
        .update({
          completed: true,
          actual_start: start.toISOString(),
          actual_end: end.toISOString(),
        })
        .eq("id", s.id);
      if (eUpd) throw eUpd;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_sessions"] });
      qc.invalidateQueries({ queryKey: ["time_entries"] });
      toast.success("Pass markerat som genomfört");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_sessions"] }),
  });

  const confirmInbox = useMutation({
    mutationFn: async ({ sessionId, courseId, taskIds }: { sessionId: string; courseId: string | null; taskIds: string[] }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { error: eUpd } = await supabase
        .from("study_sessions")
        .update({ needs_review: false, course_id: courseId })
        .eq("id", sessionId);
      if (eUpd) throw eUpd;
      await supabase.from("study_session_tasks").delete().eq("session_id", sessionId);
      if (taskIds.length > 0) {
        const rows = taskIds.map((task_id) => ({ session_id: sessionId, task_id, user_id: u.user!.id }));
        const { error } = await supabase.from("study_session_tasks").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_sessions"] });
      qc.invalidateQueries({ queryKey: ["study_session_tasks"] });
      qc.invalidateQueries({ queryKey: ["study_sessions", "agg"] });
      qc.invalidateQueries({ queryKey: ["time_entries"] });
      toast.success("Studiepass bekräftat");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const inbox = sessions.filter((s) => s.needs_review);
  const reviewed = sessions.filter((s) => !s.needs_review);
  const merged = [...reviewed, ...calSessions].sort(
    (a, b) => new Date(b.planned_start).getTime() - new Date(a.planned_start).getTime(),
  );
  const planned = merged.filter((s) => !s.completed);
  const completed = merged.filter((s) => s.completed);
  const isReadonly = (s: Session) => s.id.startsWith("cal:");


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {inbox.length > 0 && <span className="mr-2 text-sunset-amber">{inbox.length} i inkorg · </span>}
          {planned.length} planerade · {completed.length} genomförda
        </div>
        <div className="text-xs text-muted-foreground">Studiepass schemaläggs i Google Kalender</div>
      </div>

      {inbox.length > 0 && (
        <div>
          <div className="mb-2 font-display text-sm font-semibold text-sunset-amber">
            Inkorg – koppla till uppgifter
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Nya studiepass från Google Kalender räknas som studietid först när du valt kurs och uppgifter.
          </p>
          <div className="space-y-2">
            {inbox.map((s) => (
              <InboxRow
                key={s.id}
                s={s}
                courses={courses}
                allTasks={allTasks}
                onConfirm={(courseId, taskIds) => confirmInbox.mutate({ sessionId: s.id, courseId, taskIds })}
                onDelete={() => remove.mutate(s.id)}
              />
            ))}
          </div>
        </div>
      )}

      {merged.length === 0 && inbox.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 p-12 text-center">
          <div className="mx-auto mb-3 text-muted-foreground"><CalendarPlus className="h-8 w-8 mx-auto" /></div>
          <div className="font-display text-lg">Inga studiepass än</div>
          <p className="mt-1 text-sm text-muted-foreground">Lägg in ett pass i Google Kalender så synkas det hit.</p>
        </div>
      )}

      {planned.length > 0 && (
        <div>
          <div className="mb-2 font-display text-sm font-semibold">Planerade</div>
          <div className="space-y-2">
            {planned.map((s) => (
              <SessionRow key={s.id} s={s} courses={courses} allTasks={allTasks} sessionTasks={sessionTasks}
                onComplete={isReadonly(s) ? undefined : () => complete.mutate(s.id)}
                onDelete={isReadonly(s) ? undefined : () => remove.mutate(s.id)}
                fromCalendar={isReadonly(s)}
              />
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <div className="mb-2 font-display text-sm font-semibold text-muted-foreground">Genomförda</div>
          <div className="space-y-2 opacity-80">
            {completed.map((s) => (
              <SessionRow key={s.id} s={s} courses={courses} allTasks={allTasks} sessionTasks={sessionTasks}
                onDelete={isReadonly(s) ? undefined : () => remove.mutate(s.id)}
                fromCalendar={isReadonly(s)}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function InboxRow({
  s, courses, allTasks, onConfirm, onDelete,
}: {
  s: Session;
  courses: Course[];
  allTasks: Task[];
  onConfirm: (courseId: string | null, taskIds: string[]) => void;
  onDelete: () => void;
}) {
  const [courseId, setCourseId] = useState<string>(s.course_id ?? "none");
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const start = parseISO(s.planned_start);
  const end = parseISO(s.planned_end);
  const dur = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  const availableTasks = courseId === "none" ? [] : allTasks.filter((t) => t.course_id === courseId && t.status !== "done");
  const c = courses.find((cc) => cc.id === (courseId === "none" ? "" : courseId));

  return (
    <div className="rounded-xl border border-sunset-amber/40 bg-sunset-amber/5 p-3">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <span className="rounded bg-sunset-amber/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-sunset-amber">Ny</span>
        <div className="font-medium">{s.notes || "Studiepass"}</div>
        <div className="text-xs text-muted-foreground">
          {format(start, "EEE d MMM · HH:mm", { locale: sv })}–{format(end, "HH:mm")} ({formatHoursCompact(dur)})
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Kurs</Label>
          <Select value={courseId} onValueChange={(v) => { setCourseId(v); setTaskIds([]); }}>
            <SelectTrigger>
              <SelectValue>
                {c ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </span>
                ) : "Ingen kurs"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ingen kurs</SelectItem>
              {courses.map((cc) => <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Uppgifter</Label>
          {courseId === "none" ? (
            <div className="rounded-md border border-dashed border-border/60 p-2 text-xs text-muted-foreground">Välj kurs först</div>
          ) : availableTasks.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-2 text-xs text-muted-foreground">Inga öppna uppgifter i kursen</div>
          ) : (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
              {availableTasks.map((t) => {
                const checked = taskIds.includes(t.id);
                return (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setTaskIds((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)))
                      }
                    />
                    <span className="truncate">{t.title}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" className="gap-1 gradient-sunset text-white hover:opacity-90"
          onClick={() => onConfirm(courseId === "none" ? null : courseId, taskIds)}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Bekräfta
        </Button>
      </div>
    </div>
  );
}

function SessionRow({
  s, courses, allTasks, sessionTasks, onComplete, onDelete, fromCalendar,
}: {
  s: Session; courses: Course[]; allTasks: Task[]; sessionTasks: SessionTask[];
  onComplete?: () => void; onDelete?: () => void; fromCalendar?: boolean;
}) {
  const c = courses.find((cc) => cc.id === s.course_id);
  const tids = sessionTasks.filter((st) => st.session_id === s.id).map((st) => st.task_id);
  const titles = tids.map((id) => allTasks.find((t) => t.id === id)?.title).filter(Boolean) as string[];
  const start = parseISO(s.planned_start);
  const end = parseISO(s.planned_end);
  const dur = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
      <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: c?.color ?? "var(--muted-foreground)" }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <div className="font-medium">{c?.name ?? "Studiepass"}</div>
          {fromCalendar && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Kalender</span>
          )}
          <div className="text-xs text-muted-foreground">
            {format(start, "EEE d MMM · HH:mm", { locale: sv })}–{format(end, "HH:mm")} ({formatHoursCompact(dur)})
          </div>
        </div>
        {titles.length > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">Uppgifter: {titles.join(", ")}</div>
        )}
        {s.notes && <div className="mt-1 text-sm">{s.notes}</div>}
      </div>
      <div className="flex items-center gap-1">
        {onComplete && (
          <Button size="sm" variant="outline" className="gap-1" onClick={onComplete}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Genomfört
          </Button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="opacity-0 transition-opacity group-hover:opacity-100">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        )}
      </div>

    </div>
  );
}

/* ================================ Timer ================================= */

function TimerPanel({ courses, allTasks }: { courses: Course[]; allTasks: Task[] }) {
  const qc = useQueryClient();
  const running = useSyncExternalStore(timerStore.subscribe, timerStore.getSnapshot, timerStore.getServerSnapshot);
  const [now, setNow] = useState(Date.now());
  const [courseId, setCourseId] = useState("none");
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const availableTasks = courseId === "none" ? [] : allTasks.filter((t) => t.course_id === courseId && t.status !== "done");

  async function start() {
    timerStore.start({ courseId: courseId === "none" ? null : courseId, taskIds, description });
    setTaskIds([]);
    toast.success("Timer startad");
  }
  async function stop() {
    const prev = timerStore.stop();
    if (!prev) return;
    const startedAt = new Date(prev.startedAt);
    const endedAt = new Date();
    const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
    if (duration < 5) { toast.info("Under 5s – sparades inte"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const base = {
      user_id: u.user.id,
      course_id: prev.courseId,
      description: prev.description || null,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_seconds: duration,
      source: "timer",
    };
    const rows: Array<typeof base & { task_id: string | null }> =
      prev.taskIds.length > 0
        ? prev.taskIds.map((task_id) => ({ ...base, task_id }))
        : [{ ...base, task_id: null }];
    const { error } = await supabase.from("time_entries").insert(rows);
    if (error) toast.error(error.message);
    else {
      toast.success(`Tid sparad: ${formatDuration(duration)}`);
      qc.invalidateQueries({ queryKey: ["time_entries"] });
    }
  }

  if (running) {
    const seconds = Math.floor((now - running.startedAt) / 1000);
    const c = courses.find((cc) => cc.id === running.courseId);
    const titles = running.taskIds.map((id) => allTasks.find((t) => t.id === id)?.title).filter(Boolean) as string[];
    return (
      <div className="rounded-xl border border-border/60 bg-surface/40 p-8 text-center">
        <div className="font-mono text-5xl tabular-nums">{formatDuration(seconds)}</div>
        {c && (
          <div className="mt-3 inline-flex items-center gap-2 text-sm">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.name}
          </div>
        )}
        {titles.length > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">{titles.join(" · ")}</div>
        )}
        {running.description && <div className="mt-1 text-sm">{running.description}</div>}
        <Button variant="destructive" onClick={stop} className="mt-6 gap-1">
          <Square className="h-4 w-4" /> Stoppa och spara
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 p-6">
      <div className="mx-auto max-w-md space-y-4">
        <div className="space-y-2"><Label>Kurs</Label>
          <Select value={courseId} onValueChange={(v) => { setCourseId(v); setTaskIds([]); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ingen kurs</SelectItem>
              {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {availableTasks.length > 0 && (
          <div className="space-y-2">
            <Label>Uppgifter (valfritt)</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
              {availableTasks.map((t) => {
                const checked = taskIds.includes(t.id);
                return (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setTaskIds((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)))
                      }
                    />
                    <span className="truncate">{t.title}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        <div className="space-y-2"><Label>Beskrivning</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="T.ex. Läsa kap 3" />
        </div>
        <Button onClick={start} className="w-full gap-1 gradient-sunset text-white hover:opacity-90">
          <Play className="h-4 w-4" /> Starta timer
        </Button>
      </div>
    </div>
  );
}
