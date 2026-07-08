import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHoursCompact } from "@/lib/timer-store";
import { Clock, ListTodo, Calendar as CalendarIcon, GraduationCap, AlertCircle } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, isSameDay, differenceInCalendarDays, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { useUserSettings } from "@/lib/settings";
import { coursesQuery, tasksQuery, termsQuery, type TermRow } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type TimeEntry = { id: string; started_at: string; duration_seconds: number | null; course_id: string | null; source: string };
type Session = { id: string; planned_start: string; planned_end: string; completed: boolean; course_id: string | null; actual_start?: string | null; actual_end?: string | null };

function todayPeriod(terms: TermRow[]): TermRow["term"] | null {
  const today = new Date().toISOString().slice(0, 10);
  const active = terms.find((t) => today >= t.start_date && today <= t.end_date);
  return active?.term ?? null;
}

function periodMatches(coursePeriod: string | null, activePeriod: TermRow["term"] | null): boolean {
  if (!activePeriod || !coursePeriod) return true;
  if (coursePeriod === "helar") return true;
  if (activePeriod === "host" && (coursePeriod.startsWith("host") || coursePeriod === "period-1" || coursePeriod === "period-2")) return true;
  if (activePeriod === "var" && (coursePeriod.startsWith("var") || coursePeriod === "period-3" || coursePeriod === "period-4")) return true;
  if (activePeriod === "sommar" && coursePeriod.startsWith("sommar")) return true;
  return false;
}

function Dashboard() {
  const { data: settings } = useUserSettings();
  const currentYear = settings?.current_year ?? null;

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const courses = allCourses.filter((c) => !c.archived);
  const coursesMap = new Map(allCourses.map((c) => [c.id, c]));
  const { data: terms = [] } = useQuery(termsQuery);
  const { data: allTasks = [] } = useQuery(tasksQuery);
  const openTasks = allTasks.filter((t) => {
    if (t.status === "done") return false;
    if (t.course_id) {
      const course = coursesMap.get(t.course_id);
      if (course?.archived) return false;
    }
    return true;
  });
  const pendingReview = allTasks.filter((t) => {
    if (!t.pending_review || t.status === "done") return false;
    if (t.course_id) {
      const course = coursesMap.get(t.course_id);
      if (course?.archived) return false;
    }
    return true;
  });

  const activePeriod = todayPeriod(terms);
  const activeCourses = courses.filter((c) =>
    !c.completed && (currentYear === null || c.arskurs === null || c.arskurs === currentYear)
  );

  const groupedCourses = activeCourses.reduce((acc, c) => {
    const p = c.period || "Övriga";
    if (!acc[p]) acc[p] = [];
    acc[p].push(c);
    return acc;
  }, {} as Record<string, typeof courses>);

  const periodOrder = ["P1", "P2", "P3", "P4", "P5", "helar", "Övriga"];
  const sortedPeriods = Object.keys(groupedCourses).sort((a, b) => {
    const idxA = periodOrder.indexOf(a);
    const idxB = periodOrder.indexOf(b);
    const orderA = idxA !== -1 ? idxA : 999;
    const orderB = idxB !== -1 ? idxB : 999;
    return orderA - orderB;
  });


  const { data: weekEntries = [] } = useQuery({
    queryKey: ["time_entries", "week", weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("id,started_at,duration_seconds,course_id,source")
        .gte("started_at", weekStart.toISOString())
        .lte("started_at", weekEnd.toISOString());
      return (data ?? []) as TimeEntry[];
    },
  });

  const { data: weekSessions = [] } = useQuery({
    queryKey: ["study_sessions", "week", weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("id,course_id,planned_start,planned_end,actual_start,actual_end,completed")
        .eq("needs_review", false)
        .gte("planned_start", weekStart.toISOString())
        .lte("planned_start", weekEnd.toISOString());
      return (data ?? []) as Session[];
    },
  });

  const weekCombinedEntries = useMemo(() => {
    const out: Array<{ started_at: string; duration_seconds: number; course_id: string | null }> = [];
    for (const e of weekEntries) {
      if (e.source === "session") continue;
      if (e.course_id) {
        const course = coursesMap.get(e.course_id);
        if (course?.archived) continue;
      }
      out.push({
        started_at: e.started_at,
        duration_seconds: e.duration_seconds ?? 0,
        course_id: e.course_id,
      });
    }
    for (const s of weekSessions) {
      if (s.course_id) {
        const course = coursesMap.get(s.course_id);
        if (course?.archived) continue;
      }
      const start = s.actual_start ?? s.planned_start;
      const end = s.actual_end ?? s.planned_end;
      const dur = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
      out.push({
        started_at: start,
        duration_seconds: dur,
        course_id: s.course_id,
      });
    }
    return out;
  }, [weekEntries, weekSessions, coursesMap]);

  const { data: rawTodaysSessions = [] } = useQuery({
    queryKey: ["sessions", "today"],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("id,planned_start,planned_end,completed,course_id")
        .eq("needs_review", false)
        .gte("planned_start", startOfDay(new Date()).toISOString())
        .lte("planned_start", endOfDay(new Date()).toISOString())
        .order("planned_start");
      return (data ?? []) as Session[];
    },
  });

  const todaysSessions = useMemo(() => {
    return rawTodaysSessions.filter((s) => {
      if (!s.course_id) return true;
      const course = coursesMap.get(s.course_id);
      return course ? !course.archived : true;
    });
  }, [rawTodaysSessions, coursesMap]);

  const todayTasks = openTasks.filter((t) => t.due_at && isSameDay(parseISO(t.due_at), new Date()));

  const perDay = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(weekStart, i);
    const total = weekCombinedEntries
      .filter((e) => e.started_at >= startOfDay(d).toISOString() && e.started_at <= endOfDay(d).toISOString())
      .reduce((s, e) => s + e.duration_seconds, 0);
    return { d, hours: total / 3600 };
  });
  const maxDayH = Math.max(1, ...perDay.map((p) => p.hours));

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 6 ? "God natt" : hour < 12 ? "God morgon" : hour < 18 ? "God dag" : "God kväll";
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{format(now, "EEEE d MMMM", { locale: sv })}</div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          {greeting}. <span className="gradient-text">Vad ska vi jobba med idag?</span>
        </h1>
      </div>

      {/* Aktiva kurser */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Aktiva kurser</h2>
          <Link to="/courses" className="text-xs text-muted-foreground hover:text-foreground">Se alla →</Link>
        </div>
        {activeCourses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Inga kurser matchar aktuell årskurs. <Link to="/courses" className="underline">Lägg till en</Link>.
          </div>
        ) : (
          <div className="space-y-4">
            {sortedPeriods.map((periodName) => {
              const periodCourses = groupedCourses[periodName];
              if (!periodCourses || periodCourses.length === 0) return null;

              let displayPeriod = periodName;
              if (periodName.startsWith("P")) {
                displayPeriod = `Period ${periodName.slice(1)}`;
              } else if (periodName === "helar") {
                displayPeriod = "Helår";
              } else if (periodName === "Övriga") {
                displayPeriod = "Övriga kurser";
              }

              return (
                <div key={periodName} className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5 pl-1">
                    {displayPeriod}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {periodCourses.map((c) => {
                      const hoursThisWeek = weekCombinedEntries.filter((e) => e.course_id === c.id).reduce((s, e) => s + e.duration_seconds, 0) / 3600;
                      const goal = c.weekly_goal_hours ?? 0;
                      const pct = goal > 0 ? Math.min(100, (hoursThisWeek / goal) * 100) : 0;
                      return (
                        <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="group rounded-xl glass border-white/5 p-4 transition-colors hover:border-primary/40 hover:bg-white/5">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 shrink-0" style={{ color: c.color }} />
                            <span className="min-w-0 flex-1 truncate font-display font-semibold">{c.name}</span>
                          </div>
                          {goal > 0 ? (
                            <>
                              <div className="mt-3 flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Vecka</span>
                                <span className="tabular-nums">{hoursThisWeek.toFixed(2)} / {goal} h</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                              </div>
                            </>
                          ) : (
                            <div className="mt-3 text-xs text-muted-foreground">Inget veckomål · {hoursThisWeek.toFixed(2)} h denna vecka</div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Idag */}
        <Card className="glass border-white/5 shadow-lg">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Clock className="h-4 w-4" style={{ color: "var(--c-7)" }} /> Idag
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              {formatHoursCompact(weekCombinedEntries.filter((e) => isSameDay(new Date(e.started_at), new Date())).reduce((s, e) => s + e.duration_seconds, 0))} loggat
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Studiepass</div>
              {todaysSessions.length === 0 && <div className="text-sm text-muted-foreground">Inga planerade pass.</div>}
              {todaysSessions.map((s) => {
                const c = courses.find((c) => c.id === s.course_id);
                return (
                  <div key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5">
                    <GraduationCap className="h-3.5 w-3.5" style={{ color: c?.color ?? "var(--sunset-violet)" }} />
                    <span className="tabular-nums text-xs text-muted-foreground">{format(parseISO(s.planned_start), "HH:mm")}–{format(parseISO(s.planned_end), "HH:mm")}</span>
                    <span className="min-w-0 flex-1 truncate">{c?.name ?? "Ingen kurs"}</span>
                    {s.completed && <span className="text-[10px] uppercase font-bold" style={{ color: "var(--c-7)" }}>Klart</span>}
                  </div>
                );
              })}
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Deadlines idag</div>
              {todayTasks.length === 0 && <div className="text-sm text-muted-foreground">Inga deadlines idag.</div>}
              {todayTasks.map((t) => {
                return (
                  <Link key={t.id} to="/tasks" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5">
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    {t.task_kind === "exam" && <span className="rounded-full bg-sunset-rose/20 px-1.5 py-0.5 text-[9px] uppercase text-sunset-rose">Exam</span>}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Denna vecka */}
        <Card className="glass border-white/5 shadow-lg">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" style={{ color: "var(--c-10)" }} /> Denna vecka
            </CardTitle>
            <Link to="/stats" className="text-xs text-muted-foreground hover:text-foreground">Statistik →</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Studietid</div>
              <div className="flex items-end gap-1.5">
                {perDay.map((p) => (
                  <div key={p.d.toISOString()} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-16 w-full items-end">
                      <div className="w-full rounded-t bg-gradient-to-t from-[var(--c-10)] to-[var(--c-6)]" style={{ height: `${Math.max(4, (p.hours / maxDayH) * 100)}%` }} />
                    </div>
                    <div className={`text-[10px] uppercase ${isSameDay(p.d, new Date()) ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{format(p.d, "EEEEE", { locale: sv })}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/5 px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><ListTodo className="h-3.5 w-3.5 text-sunset-amber" /> Uppgifter kvar</span>
              <span className="tabular-nums font-semibold">{openTasks.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/5 px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" style={{ color: "var(--c-10)" }} /> Total studietid</span>
              <span className="tabular-nums font-semibold">{formatHoursCompact(weekCombinedEntries.reduce((s, e) => s + e.duration_seconds, 0))}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Väntar på bedömning */}
      {pendingReview.length > 0 && (
        <Card className="mt-6 glass border-sunset-amber/30 shadow-lg">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2"><AlertCircle className="h-4 w-4 text-sunset-amber" /> Väntar på bedömning</CardTitle>
            <Link to="/tasks" className="text-xs text-muted-foreground hover:text-foreground">Se alla →</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {pendingReview.map((t) => {
                return (
                  <Link key={t.id} to="/tasks" className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-white/5">
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    {t.due_at && (
                      <span className="text-xs text-muted-foreground">
                        {(() => { const d = differenceInCalendarDays(parseISO(t.due_at), new Date()); return d < 0 ? `försenad ${Math.abs(d)} d` : d === 0 ? "idag" : d === 1 ? "imorgon" : `${d} d`; })()}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kommande uppgifter */}
      <Card className="mt-6 glass border-white/5 shadow-lg">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <ListTodo className="h-4 w-4" style={{ color: "var(--c-4)" }} /> Kommande uppgifter
          </CardTitle>
          <Link to="/tasks" className="text-xs text-muted-foreground hover:text-foreground">Se alla →</Link>
        </CardHeader>
        <CardContent>
          {openTasks.length === 0 && <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">Inga öppna uppgifter. Bra jobbat!</div>}
          <div className="space-y-1">
            {openTasks.slice(0, 8).map((t) => {
              return (
                <Link key={t.id} to="/tasks" className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-white/5">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {t.task_kind === "exam" && <span className="rounded-full bg-sunset-rose/20 px-1.5 py-0.5 text-[9px] uppercase text-sunset-rose">Exam</span>}
                  {t.due_at && (
                    <span className="text-xs text-muted-foreground">{format(new Date(t.due_at), "d MMM", { locale: sv })}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
