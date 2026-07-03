import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { format, subDays, startOfDay, endOfDay, differenceInCalendarDays, startOfWeek } from "date-fns";
import { sv } from "date-fns/locale";
import { formatHoursCompact } from "@/lib/timer-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { coursesQuery, tasksQuery, termsQuery, type TermRow } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/stats")({
  component: StatsPage,
});

type Entry = { id: string; started_at: string; duration_seconds: number | null; course_id: string | null; task_id: string | null };

function termLabel(t: TermRow) {
  const term = t.term === "host" ? "Hösttermin" : t.term === "var" ? "Vårtermin" : "Sommar";
  return `${term} ${t.year}`;
}

function StatsPage() {
  const [period, setPeriod] = useState<string>("30");

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const courses = allCourses.filter((c) => !c.archived);
  const { data: terms = [] } = useQuery(termsQuery);


  const range = useMemo(() => {
    if (period === "7") return { start: subDays(new Date(), 6), end: new Date(), label: "7 dagar" };
    if (period === "30") return { start: subDays(new Date(), 29), end: new Date(), label: "30 dagar" };
    if (period === "week") {
      const s = startOfWeek(new Date(), { weekStartsOn: 1 });
      return { start: s, end: new Date(), label: "Denna vecka" };
    }
    if (period.startsWith("term:")) {
      const id = period.slice(5);
      const t = terms.find((x) => x.id === id);
      if (t) return { start: new Date(t.start_date), end: new Date(t.end_date), label: termLabel(t) };
    }
    return { start: subDays(new Date(), 29), end: new Date(), label: "30 dagar" };
  }, [period, terms]);

  const { data: entries = [] } = useQuery({
    queryKey: ["stats", "entries", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("id,started_at,duration_seconds,course_id,task_id")
        .gte("started_at", range.start.toISOString())
        .lte("started_at", range.end.toISOString());
      return (data ?? []) as Entry[];
    },
  });

  const { data: calEvents = [] } = useQuery({
    queryKey: ["stats", "cal", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("calendar_events")
        .select("id,starts_at,ends_at,course_id,counts_as_study")
        .eq("counts_as_study", true)
        .gte("starts_at", range.start.toISOString())
        .lte("starts_at", range.end.toISOString());
      return (data ?? []) as { id: string; starts_at: string; ends_at: string; course_id: string | null; counts_as_study: boolean }[];
    },
  });

  const { data: sessionRows = [] } = useQuery({
    queryKey: ["stats", "sessions-rows", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("id,course_id,planned_start,planned_end,actual_start,actual_end,completed")
        .eq("needs_review", false)
        .gte("planned_start", range.start.toISOString())
        .lte("planned_start", range.end.toISOString());
      return (data ?? []) as { id: string; course_id: string | null; planned_start: string; planned_end: string; actual_start: string | null; actual_end: string | null; completed: boolean }[];
    },
  });

  // Synthesize pseudo-entries from calendar events (counts_as_study) and uncompleted study sessions,
  // so all planned/imported study time is reflected in the charts alongside logged time.
  const derivedEntries: Entry[] = useMemo(() => {
    const out: Entry[] = [];
    for (const e of calEvents) {
      const dur = Math.max(0, Math.floor((new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()) / 1000));
      out.push({ id: `cal:${e.id}`, started_at: e.starts_at, duration_seconds: dur, course_id: e.course_id, task_id: null });
    }
    for (const s of sessionRows) {
      if (s.completed) continue; // completed sessions already produced a time_entries row
      const start = s.actual_start ?? s.planned_start;
      const end = s.actual_end ?? s.planned_end;
      const dur = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
      out.push({ id: `sess:${s.id}`, started_at: start, duration_seconds: dur, course_id: s.course_id, task_id: null });
    }
    return out;
  }, [calEvents, sessionRows]);

  const combined = useMemo(() => [...entries, ...derivedEntries], [entries, derivedEntries]);

  const { data: tasks = [] } = useQuery(tasksQuery);


  const { data: sessionsCount = 0 } = useQuery({
    queryKey: ["stats", "sessions", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { count } = await supabase
        .from("study_sessions")
        .select("id", { count: "exact", head: true })
        .eq("needs_review", false)
        .gte("planned_start", range.start.toISOString())
        .lte("planned_start", range.end.toISOString());
      return count ?? 0;
    },
  });

  const totalDays = Math.max(1, differenceInCalendarDays(range.end, range.start) + 1);
  const days = Array.from({ length: totalDays }).map((_, i) => {
    const d = subDays(range.end, totalDays - 1 - i);
    const row: Record<string, number | string> = { day: format(d, "d/M", { locale: sv }) };
    let total = 0;
    for (const c of courses) {
      const h = combined.filter((e) => e.course_id === c.id && e.started_at >= startOfDay(d).toISOString() && e.started_at <= endOfDay(d).toISOString())
        .reduce((s, e) => s + (e.duration_seconds ?? 0), 0) / 3600;
      row[c.id] = +h.toFixed(2);
      total += h;
    }
    row.total = +total.toFixed(2);
    return row;
  });

  const perCourse = courses.map((c) => ({
    name: c.name,
    color: c.color,
    value: +(combined.filter((e) => e.course_id === c.id).reduce((s, e) => s + (e.duration_seconds ?? 0), 0) / 3600).toFixed(2),
  })).filter((r) => r.value > 0);
  const noCourseHours = +(combined.filter((e) => !e.course_id).reduce((s, e) => s + (e.duration_seconds ?? 0), 0) / 3600).toFixed(2);
  if (noCourseHours > 0) perCourse.push({ name: "Övrigt", color: "#94A3B8", value: noCourseHours });

  const perTask = (() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      if (!e.task_id || !e.duration_seconds) continue;
      m.set(e.task_id, (m.get(e.task_id) ?? 0) + e.duration_seconds);
    }
    return [...m.entries()]
      .map(([id, sec]) => {
        const t = tasks.find((x) => x.id === id);
        const c = courses.find((c) => c.id === t?.course_id);
        return { id, title: t?.title ?? "Okänd", hours: +(sec / 3600).toFixed(2), color: c?.color ?? "#94A3B8" };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  })();

  const totalSec = combined.reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
  const avgPerDay = totalSec / totalDays;


  const statusCounts = {
    not_started: tasks.filter((t) => t.status === "not_started").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };
  const statusData = [
    { name: "Ej startad", value: statusCounts.not_started, color: "#FF7A59" },
    { name: "Pågår", value: statusCounts.in_progress, color: "#FFB84D" },
    { name: "Klar", value: statusCounts.done, color: "#8B5CF6" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Statistik</h1>
          <p className="text-sm text-muted-foreground">{range.label}</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[14rem]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Denna vecka</SelectItem>
            <SelectItem value="7">Senaste 7 dagarna</SelectItem>
            <SelectItem value="30">Senaste 30 dagarna</SelectItem>
            {terms.map((t) => <SelectItem key={t.id} value={`term:${t.id}`}>{termLabel(t)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60 bg-surface/60">
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total tid</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">{formatHoursCompact(totalSec)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-surface/60">
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Snitt per dag</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">{formatHoursCompact(avgPerDay)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-surface/60">
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Studiepass</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">{sessionsCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-surface/60 lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="font-display text-base">Studietid per kurs över tid</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={28} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} h`, ""]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {courses.map((c) => (
                    <Line key={c.id} type="monotone" dataKey={c.id} name={c.name} stroke={c.color} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60">
          <CardHeader className="pb-2"><CardTitle className="font-display text-base">Tid per kurs</CardTitle></CardHeader>
          <CardContent>
            {perCourse.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">Ingen tid loggad än.</div>}
            {perCourse.length > 0 && (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={perCourse} dataKey="value" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {perCourse.map((r) => <Cell key={r.name} fill={r.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number, n: string) => [`${v} h`, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60 lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="font-display text-base">Topp uppgifter</CardTitle></CardHeader>
          <CardContent>
            {perTask.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">Ingen tid loggad på uppgifter än.</div>}
            <div className="space-y-2">
              {perTask.map((t) => (
                <div key={t.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 min-w-0"><span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} /><span className="truncate">{t.title}</span></span>
                    <span className="font-mono tabular-nums text-muted-foreground">{t.hours}h</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (t.hours / (perTask[0]?.hours || 1)) * 100)}%`, background: t.color }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60">
          <CardHeader className="pb-2"><CardTitle className="font-display text-base">Uppgiftsstatus</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical">
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                    {statusData.map((r) => <Cell key={r.name} fill={r.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
