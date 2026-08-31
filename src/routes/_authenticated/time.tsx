import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { timerStore, formatDuration, formatHoursCompact } from "@/lib/timer-store";
import { format, parseISO, subDays, startOfWeek } from "date-fns";
import { sv } from "date-fns/locale";
import { Play, Square, CheckCircle2, CalendarPlus, Trash2, Target, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";
import { coursesQuery, tasksQuery, durationSeconds, type Course, type Task } from "@/lib/queries";

import { z } from "zod";

const timeSearchSchema = z.object({
  period: z.enum(["week", "30"]).optional(),
});

export const Route = createFileRoute("/_authenticated/time")({
  validateSearch: timeSearchSchema,
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
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [period, setPeriod] = useState<"week" | "30">(search.period ?? "week");

  useEffect(() => {
    if (search.period) {
      setPeriod(search.period);
    }
  }, [search.period]);

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const courses = allCourses.filter((c) => !c.archived && !c.completed);
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

  const { data: aggSessionTasks = [] } = useQuery({
    queryKey: ["study_session_tasks", "agg"],
    queryFn: async () => {
      const { data } = await supabase.from("study_session_tasks").select("session_id,task_id");
      return (data ?? []) as { session_id: string; task_id: string }[];
    },
  });

  // Date range for period
  const cutoffDate = useMemo(() => {
    if (period === "week") return startOfWeek(new Date(), { weekStartsOn: 1 });
    return subDays(new Date(), 30);
  }, [period]);
  const cutoff = cutoffDate.getTime();

  const coursesMap = useMemo(() => new Map(allCourses.map((c) => [c.id, c])), [allCourses]);

  const sessionSeconds = (s: SessionAgg): number => {
    const start = s.actual_start ? new Date(s.actual_start) : new Date(s.planned_start);
    const end = s.actual_end ? new Date(s.actual_end) : new Date(s.planned_end);
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  };

  // 1. GENOMFÖRD STUDIETID: Loggad tid & slutförda pass fram till nu
  const inPeriod = entries.filter((e) => {
    const t = new Date(e.started_at).getTime();
    if (t < cutoff || t > Date.now() || e.source === "session") return false;
    if (e.course_id) {
      const course = coursesMap.get(e.course_id);
      if (course?.archived) return false;
    }
    return true;
  });

  const sessionsInPeriod = allSessions.filter((s) => {
    const start = s.actual_start ? new Date(s.actual_start) : new Date(s.planned_start);
    const t = start.getTime();
    if (t < cutoff || t > Date.now()) return false;
    if (s.course_id) {
      const course = coursesMap.get(s.course_id);
      if (course?.archived) return false;
    }
    return true;
  });

  const entrySeconds = inPeriod.reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
  const sessionSecs = sessionsInPeriod.reduce((s, x) => s + sessionSeconds(x), 0);
  const completedSecs = entrySeconds + sessionSecs;

  // 2. PLANERAD STUDIETID (KVAR): studiepass som ligger kvar att genomföras i kalendern
  const remainingPlannedSessions = useMemo(() => {
    const now = Date.now();
    return allSessions.filter((s) => {
      const start = s.actual_start ? new Date(s.actual_start) : new Date(s.planned_start);
      const end = s.actual_end ? new Date(s.actual_end) : new Date(s.planned_end);
      if (start.getTime() < cutoff) return false;
      if (end.getTime() <= now) return false; // Enbart framtida / återstående pass
      if (s.course_id) {
        const course = coursesMap.get(s.course_id);
        if (course?.archived) return false;
      }
      return true;
    });
  }, [allSessions, cutoff, coursesMap]);

  const remainingPlannedSecs = remainingPlannedSessions.reduce((s, x) => s + sessionSeconds(x), 0);

  // 3. STUDIETIDSMÅL: Summan av alla aktiva kursers veckomål
  const rawGoalHours = courses.reduce((sum, c) => sum + (c.weekly_goal_hours ?? 0), 0);
  const goalSecs = rawGoalHours * 3600;

  const totalAccountedSecs = completedSecs + remainingPlannedSecs;
  const goalPct = goalSecs > 0 ? Math.min(100, Math.round((totalAccountedSecs / goalSecs) * 100)) : 0;
  const completedPct = goalSecs > 0 ? Math.min(100, (completedSecs / goalSecs) * 100) : 0;
  const remainingPlannedPct = goalSecs > 0 ? Math.min(100 - completedPct, (remainingPlannedSecs / goalSecs) * 100) : 0;

  const byCourse = useMemo(() => {
    const map = new Map<string, { completedSecs: number; remainingPlannedSecs: number }>();
    for (const c of courses) {
      map.set(c.id, { completedSecs: 0, remainingPlannedSecs: 0 });
    }

    for (const e of inPeriod) {
      if (!e.course_id) continue;
      const curr = map.get(e.course_id) ?? { completedSecs: 0, remainingPlannedSecs: 0 };
      curr.completedSecs += e.duration_seconds ?? 0;
      map.set(e.course_id, curr);
    }

    for (const s of sessionsInPeriod) {
      if (!s.course_id) continue;
      const curr = map.get(s.course_id) ?? { completedSecs: 0, remainingPlannedSecs: 0 };
      curr.completedSecs += sessionSeconds(s);
      map.set(s.course_id, curr);
    }

    for (const s of remainingPlannedSessions) {
      if (!s.course_id) continue;
      const curr = map.get(s.course_id) ?? { completedSecs: 0, remainingPlannedSecs: 0 };
      curr.remainingPlannedSecs += sessionSeconds(s);
      map.set(s.course_id, curr);
    }

    return courses
      .map((c) => {
        const data = map.get(c.id) ?? { completedSecs: 0, remainingPlannedSecs: 0 };
        return {
          id: c.id,
          name: c.name,
          color: c.color ?? "#64748b",
          completedSecs: data.completedSecs,
          remainingPlannedSecs: data.remainingPlannedSecs,
          goalHours: c.weekly_goal_hours ?? 0,
        };
      })
      .filter((c) => c.remainingPlannedSecs > 0 || c.completedSecs > 0)
      .sort((a, b) => b.completedSecs - a.completedSecs || b.remainingPlannedSecs - a.remainingPlannedSecs);
  }, [courses, inPeriod, sessionsInPeriod, remainingPlannedSessions]);

  const byTask = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of inPeriod) {
      if (!e.task_id) continue;
      m.set(e.task_id, (m.get(e.task_id) ?? 0) + (e.duration_seconds ?? 0));
    }
    for (const s of sessionsInPeriod) {
      const tids = aggSessionTasks.filter((st) => st.session_id === s.id).map((st) => st.task_id);
      if (tids.length === 0) continue;
      const dur = sessionSeconds(s);
      const per = Math.floor(dur / tids.length);
      for (const tid of tids) {
        m.set(tid, (m.get(tid) ?? 0) + per);
      }
    }
    return Array.from(m.entries())
      .map(([id, secs]) => {
        const t = allTasks.find((tt) => tt.id === id);
        return { id, title: t?.title ?? "Okänd uppgift", seconds: secs };
      })
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5);
  }, [inPeriod, sessionsInPeriod, aggSessionTasks, allTasks]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Studietid</h1>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as "week" | "30")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Denna vecka</SelectItem>
            <SelectItem value="30">Senaste 30 dagar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Kompakt Översiktsmodul för Studietid */}
      <Card className="border-border/60 bg-surface/60 backdrop-blur-md rounded-2xl mb-6 p-4">
        {/* Övre rad: 2 nyckeltal (Genomfört & Planerat) */}
        <div className="grid grid-cols-2 gap-3 pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Genomfört
            </div>
            <div className="font-display text-2xl font-bold tabular-nums text-foreground">
              {formatHoursCompact(completedSecs)}
            </div>
          </div>

          <div className="space-y-0.5 border-l border-white/5 pl-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-sky-400">
              <CalendarPlus className="h-3.5 w-3.5" /> Planerat
            </div>
            <div className="font-display text-2xl font-bold tabular-nums text-foreground">
              {formatHoursCompact(remainingPlannedSecs)}
            </div>
          </div>
        </div>

        {/* Undre rad: Enkel staplad förloppsbar för Veckomål */}
        {period === "week" && (
          <div className="pt-3 text-xs space-y-2 border-t border-white/5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                Veckomål: <strong className="text-foreground">{formatHoursCompact(totalAccountedSecs)}</strong> / {goalSecs > 0 ? formatHoursCompact(goalSecs) : "—"}
              </span>
              <span className="font-semibold text-amber-400">
                {goalPct}%
              </span>
            </div>

            <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden border border-white/5 flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${completedPct}%` }}
                title={`Genomfört: ${formatHoursCompact(completedSecs)}`}
              />
              <div
                className="h-full bg-sky-400 transition-all duration-500"
                style={{ width: `${remainingPlannedPct}%` }}
                title={`Planerat: ${formatHoursCompact(remainingPlannedSecs)}`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Genomfört ({formatHoursCompact(completedSecs)})
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  Planerat ({formatHoursCompact(remainingPlannedSecs)})
                </span>
              </div>
              {goalSecs > 0 && (
                <span>
                  {totalAccountedSecs < goalSecs
                    ? `Saknas i schemat: ${formatHoursCompact(goalSecs - totalAccountedSecs)}`
                    : "Veckomålet uppnått! 🎉"}
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <div className="rounded-xl border border-border/60 bg-surface/40 p-4">
          <div className="mb-2.5 font-display text-sm font-semibold flex items-center justify-between">
            <span>Tid per kurs</span>
            <span className="text-[10px] font-normal text-muted-foreground">Genomfört (Planerat)</span>
          </div>
          {byCourse.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Ingen tid loggad</div>
          ) : (
            <div className="space-y-2">
              {byCourse.slice(0, 5).map((c) => {
                return (
                  <div key={c.id} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2 truncate font-medium">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: c.color }}
                      />
                      <span className="truncate">{c.name}</span>
                    </div>
                    <div className="text-right text-[11px] tabular-nums shrink-0">
                      <span className="font-semibold text-emerald-400">{formatHoursCompact(c.completedSecs)}</span>
                      {c.remainingPlannedSecs > 0 && (
                        <span className="text-sky-400/90 ml-1.5">({formatHoursCompact(c.remainingPlannedSecs)})</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
          <div className="rounded-xl border border-border/60 bg-surface/40 p-4">
            <div className="mb-2 font-display text-sm font-semibold">Toppuppgifter</div>
            {byTask.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Ingen tid loggad på uppgifter
              </div>
            ) : (
              <div className="space-y-2">
                {byTask.map((t) => {
                  const pct = completedSecs > 0 ? (t.seconds / completedSecs) * 100 : 0;
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
        .select(
          "id,course_id,planned_start,planned_end,actual_start,actual_end,notes,completed,source,needs_review",
        )
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
      const start = s.actual_start ? new Date(s.actual_start) : new Date(s.planned_start);
      const end = s.actual_end ? new Date(s.actual_end) : new Date(s.planned_end);
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
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const confirmInbox = useMutation({
    mutationFn: async ({
      sessionId,
      courseId,
      taskIds,
    }: {
      sessionId: string;
      courseId: string | null;
      taskIds: string[];
    }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { error: eUpd } = await supabase
        .from("study_sessions")
        .update({ needs_review: false, course_id: courseId })
        .eq("id", sessionId);
      if (eUpd) throw eUpd;
      await supabase.from("study_session_tasks").delete().eq("session_id", sessionId);
      if (taskIds.length > 0) {
        const rows = taskIds.map((task_id) => ({
          session_id: sessionId,
          task_id,
          user_id: u.user!.id,
        }));
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

  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      await supabase.from("study_session_tasks").delete().eq("session_id", sessionId);
      const { error } = await supabase.from("study_sessions").delete().eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_sessions"] });
      qc.invalidateQueries({ queryKey: ["study_session_tasks"] });
      qc.invalidateQueries({ queryKey: ["study_sessions", "agg"] });
      qc.invalidateQueries({ queryKey: ["time_entries"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Studiepass borttaget");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const sync = useMutation({
    mutationFn: async () => {
      const { syncGoogleCalendar } = await import("@/lib/google-calendar.functions");
      return await syncGoogleCalendar();
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["study_sessions"] });
      qc.invalidateQueries({ queryKey: ["study_sessions", "agg"] });
      qc.invalidateQueries({ queryKey: ["time_entries"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(
        `Synkat ${r.calendars} kalender(-rar): ${r.imported} händelser, ${r.sessions} studiepass`,
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Synkfel"),
  });

  const activeCourseIds = new Set(courses.map((c) => c.id));
  const filteredSessions = sessions.filter((s) => !s.course_id || activeCourseIds.has(s.course_id));

  const inbox = filteredSessions.filter((s) => s.needs_review);
  const reviewed = filteredSessions.filter((s) => !s.needs_review);
  const planned = reviewed.filter((s) => !s.completed);
  const completed = reviewed.filter((s) => s.completed);

  const autoCompleted = useRef<Set<string>>(new Set());
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const s of planned) {
        if (autoCompleted.current.has(s.id)) continue;
        if (new Date(s.planned_end).getTime() <= now) {
          autoCompleted.current.add(s.id);
          complete.mutate(s.id);
        }
      }
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [planned, complete]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {inbox.length > 0 && (
            <span className="mr-2 text-sunset-amber">{inbox.length} i inkorg · </span>
          )}
          {planned.length} planerade · {completed.length} genomförda
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Studiepass schemaläggs i Google Kalender
          </span>
          <Button
            size="sm"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="gap-1 rounded-xl gradient-sunset text-white hover:opacity-90"
          >
            {sync.isPending ? "Synkar…" : "Synka nu"}
          </Button>
        </div>
      </div>

      {inbox.length > 0 && (
        <div>
          <div className="mb-2 font-display text-sm font-semibold text-sunset-amber">
            Inkorg – koppla till uppgifter
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Nya studiepass från Google Kalender räknas som studietid först när du valt kurs och
            uppgifter.
          </p>
          <div className="space-y-2">
            {inbox.map((s) => (
              <InboxRow
                key={s.id}
                s={s}
                courses={courses}
                allTasks={allTasks}
                onConfirm={(courseId, taskIds) =>
                  confirmInbox.mutate({ sessionId: s.id, courseId, taskIds })
                }
              />
            ))}
          </div>
        </div>
      )}

      {reviewed.length === 0 && inbox.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 p-12 text-center">
          <div className="mx-auto mb-3 text-muted-foreground">
            <CalendarPlus className="h-8 w-8 mx-auto" />
          </div>
          <div className="font-display text-lg">Inga studiepass än</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Lägg in ett pass i Google Kalender så synkas det hit.
          </p>
        </div>
      )}

      {planned.length > 0 && (
        <div>
          <div className="mb-2 font-display text-sm font-semibold">Planerade</div>
          <div className="space-y-2">
            {planned.map((s) => (
              <SessionRow
                key={s.id}
                s={s}
                courses={courses}
                allTasks={allTasks}
                sessionTasks={sessionTasks}
                onDelete={(id) => deleteSession.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <div className="mb-2 font-display text-sm font-semibold text-muted-foreground">
            Genomförda
          </div>
          <div className="space-y-2 opacity-80">
            {completed.map((s) => (
              <SessionRow
                key={s.id}
                s={s}
                courses={courses}
                allTasks={allTasks}
                sessionTasks={sessionTasks}
                onDelete={(id) => deleteSession.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InboxRow({
  s,
  courses,
  allTasks,
  onConfirm,
}: {
  s: Session;
  courses: Course[];
  allTasks: Task[];
  onConfirm: (courseId: string | null, taskIds: string[]) => void;
}) {
  const [courseId, setCourseId] = useState<string>(s.course_id ?? "none");
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const start = parseISO(s.planned_start);
  const end = parseISO(s.planned_end);
  const dur = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  const availableTasks =
    courseId === "none"
      ? []
      : allTasks.filter((t) => t.course_id === courseId && t.status !== "done");
  const c = courses.find((cc) => cc.id === (courseId === "none" ? "" : courseId));

  return (
    <div className="rounded-xl border border-sunset-amber/40 bg-sunset-amber/5 p-3">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <span className="rounded bg-sunset-amber/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-sunset-amber">
          Ny
        </span>
        <div className="font-medium">{s.notes || "Studiepass"}</div>
        <div className="text-xs text-muted-foreground">
          {format(start, "yyyy-MM-dd HH:mm", { locale: sv })}–{format(end, "HH:mm")} (
          {formatHoursCompact(dur)})
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Kurs</Label>
          <Select
            value={courseId}
            onValueChange={(v) => {
              setCourseId(v);
              setTaskIds([]);
            }}
          >
            <SelectTrigger>
              <SelectValue>
                {c ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: c.color }}
                    />
                    {c.name}
                  </span>
                ) : (
                  "Ingen kurs"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ingen kurs</SelectItem>
              {courses
                .filter((cc) => !cc.completed)
                .map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Uppgifter</Label>
          {courseId === "none" ? (
            <div className="rounded-xl border border-dashed border-border/60 p-2 text-xs text-muted-foreground">
              Välj kurs först
            </div>
          ) : availableTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-2 text-xs text-muted-foreground">
              Inga öppna uppgifter i kursen
            </div>
          ) : (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
              {availableTasks.map((t) => {
                const checked = taskIds.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setTaskIds((prev) =>
                          e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                        )
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
        <Button
          size="sm"
          className="gap-1 gradient-sunset text-white hover:opacity-90"
          onClick={() => onConfirm(courseId === "none" ? null : courseId, taskIds)}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Bekräfta
        </Button>
      </div>
    </div>
  );
}

function SessionRow({
  s,
  courses,
  allTasks,
  sessionTasks,
  onDelete,
}: {
  s: Session;
  courses: Course[];
  allTasks: Task[];
  sessionTasks: SessionTask[];
  onDelete?: (id: string) => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const c = courses.find((cc) => cc.id === s.course_id);
  const tids = sessionTasks.filter((st) => st.session_id === s.id).map((st) => st.task_id);
  const titles = tids
    .map((id) => allTasks.find((t) => t.id === id)?.title)
    .filter(Boolean) as string[];
  const start = parseISO(s.planned_start);
  const end = parseISO(s.planned_end);
  const dur = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
      <span
        className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: c?.color ?? "var(--muted-foreground)" }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <div className="font-medium flex flex-wrap items-center gap-2">
            <span>{c?.name ?? "Studiepass"}</span>
            {s.source === "local" ? (
              <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[9px] font-semibold text-primary uppercase tracking-wider">
                Timer
              </span>
            ) : (
              <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                Google
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(start, "yyyy-MM-dd HH:mm", { locale: sv })}–{format(end, "HH:mm")} (
            {formatHoursCompact(dur)})
          </div>
        </div>
        {titles.length > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">Uppgifter: {titles.join(", ")}</div>
        )}
        {s.notes && <div className="mt-1 text-sm">{s.notes}</div>}
      </div>
      {s.source === "local" && onDelete && (
        <div className="flex items-center gap-1 shrink-0">
          {isConfirming ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onDelete(s.id);
                  setIsConfirming(false);
                }}
                className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
              >
                Ja
              </button>
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="rounded-lg bg-white/5 px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-white/10 transition-colors"
              >
                Nej
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirming(true)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-destructive transition-colors relative z-10"
              title="Ta bort pass"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================ Timer ================================= */

function TimerPanel({ courses, allTasks }: { courses: Course[]; allTasks: Task[] }) {
  const qc = useQueryClient();
  const running = useSyncExternalStore(
    timerStore.subscribe,
    timerStore.getSnapshot,
    timerStore.getServerSnapshot,
  );
  const [now, setNow] = useState(Date.now());
  const [courseId, setCourseId] = useState("none");
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const availableTasks =
    courseId === "none"
      ? []
      : allTasks.filter((t) => t.course_id === courseId && t.status !== "done");

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
    if (duration < 5) {
      toast.info("Under 5s – sparades inte");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const { data: sessionData, error: sessionError } = await supabase
      .from("study_sessions")
      .insert({
        user_id: u.user.id,
        course_id: prev.courseId,
        completed: true,
        needs_review: false,
        source: "local",
        notes: prev.description || null,
        planned_start: startedAt.toISOString(),
        planned_end: endedAt.toISOString(),
        actual_start: startedAt.toISOString(),
        actual_end: endedAt.toISOString(),
      })
      .select("id")
      .single();

    if (!sessionError && sessionData && prev.taskIds.length > 0) {
      const taskRows = prev.taskIds.map((task_id) => ({
        session_id: sessionData.id,
        task_id,
        user_id: u.user!.id,
      }));
      const { error: tasksError } = await supabase.from("study_session_tasks").insert(taskRows);
      if (tasksError) {
        toast.error(tasksError.message);
      }
    }

    if (sessionError) {
      toast.error(sessionError.message);
    } else {
      toast.success(`Tid sparad: ${formatDuration(duration)}`);
      qc.invalidateQueries({ queryKey: ["study_sessions"] });
      qc.invalidateQueries({ queryKey: ["study_session_tasks"] });
      qc.invalidateQueries({ queryKey: ["time_entries"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    }
  }

  if (running) {
    const seconds = Math.floor((now - running.startedAt) / 1000);
    const c = courses.find((cc) => cc.id === running.courseId);
    const titles = running.taskIds
      .map((id) => allTasks.find((t) => t.id === id)?.title)
      .filter(Boolean) as string[];
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
        <div className="space-y-2">
          <Label>Kurs</Label>
          <Select
            value={courseId}
            onValueChange={(v) => {
              setCourseId(v);
              setTaskIds([]);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ingen kurs</SelectItem>
              {courses
                .filter((c) => !c.completed)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        {availableTasks.length > 0 && (
          <div className="space-y-2">
            <Label>Uppgifter (valfritt)</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
              {availableTasks.map((t) => {
                const checked = taskIds.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setTaskIds((prev) =>
                          e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                        )
                      }
                    />
                    <span className="truncate">{t.title}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label>Beskrivning</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="T.ex. Läsa kap 3"
          />
        </div>
        <Button
          onClick={start}
          className="w-full gap-1 gradient-sunset text-white hover:opacity-90"
        >
          <Play className="h-4 w-4" /> Starta timer
        </Button>
      </div>
    </div>
  );
}
