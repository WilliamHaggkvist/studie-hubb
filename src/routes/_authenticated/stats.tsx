import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  differenceInCalendarDays,
  startOfWeek,
} from "date-fns";
import { sv } from "date-fns/locale";
import { formatHoursCompact } from "@/lib/timer-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState } from "react";
import { coursesQuery, tasksQuery, termsQuery, type TermRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/stats")({
  component: StatsPage,
});

type Entry = {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  course_id: string | null;
  task_id: string | null;
  source?: string;
};

function termLabel(t: TermRow) {
  const term = t.term === "host" ? "Hösttermin" : t.term === "var" ? "Vårtermin" : "Sommar";
  return `${term} ${t.year}`;
}

function StatsPage() {
  const [period, setPeriod] = useState<string>("30");

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const courses = allCourses.filter((c) => !c.archived);
  const { data: terms = [] } = useQuery(termsQuery);

  const heatmapStart = useMemo(() => subDays(new Date(), 364), []);
  const heatmapEnd = useMemo(() => new Date(), []);

  const { data: heatmapEntries = [] } = useQuery({
    queryKey: ["stats", "heatmap-entries", heatmapStart.toISOString(), heatmapEnd.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("started_at,duration_seconds")
        .neq("source", "session")
        .gte("started_at", heatmapStart.toISOString())
        .lte("started_at", heatmapEnd.toISOString());
      return (data ?? []) as Array<{ started_at: string; duration_seconds: number | null }>;
    },
  });

  const { data: heatmapSessions = [] } = useQuery({
    queryKey: ["stats", "heatmap-sessions", heatmapStart.toISOString(), heatmapEnd.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("planned_start,planned_end,actual_start,actual_end")
        .eq("needs_review", false)
        .gte("planned_start", heatmapStart.toISOString())
        .lte("planned_start", heatmapEnd.toISOString());
      return (data ?? []) as Array<{
        planned_start: string;
        planned_end: string;
        actual_start: string | null;
        actual_end: string | null;
      }>;
    },
  });

  const heatmapData = useMemo(() => {
    const dailyHours: Record<string, number> = {};

    const addHours = (isoString: string, seconds: number) => {
      const dayKey = format(new Date(isoString), "yyyy-MM-dd");
      dailyHours[dayKey] = (dailyHours[dayKey] ?? 0) + seconds / 3600;
    };

    for (const e of heatmapEntries) {
      if (e.duration_seconds) {
        addHours(e.started_at, e.duration_seconds);
      }
    }

    for (const s of heatmapSessions) {
      const start = s.actual_start ?? s.planned_start;
      const end = s.actual_end ?? s.planned_end;
      const dur = Math.max(
        0,
        Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000),
      );
      addHours(start, dur);
    }

    return dailyHours;
  }, [heatmapEntries, heatmapSessions]);

  const heatmapDays = useMemo(() => {
    const arr = [];
    const curr = new Date(startOfWeek(heatmapStart, { weekStartsOn: 1 }));
    const end = heatmapEnd;

    while (curr <= end) {
      const dayKey = format(curr, "yyyy-MM-dd");
      const hours = heatmapData[dayKey] ?? 0;
      arr.push({
        date: new Date(curr),
        dayKey,
        hours,
      });
      curr.setDate(curr.getDate() + 1);
    }
    return arr;
  }, [heatmapStart, heatmapEnd, heatmapData]);

  const heatmapWeeks = useMemo(() => {
    const weeks = [];
    let currentWeek = [];
    for (const d of heatmapDays) {
      currentWeek.push(d);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    return weeks;
  }, [heatmapDays]);

  const range = useMemo(() => {
    if (period === "7") return { start: subDays(new Date(), 6), end: new Date(), label: "7 dagar" };
    if (period === "30")
      return { start: subDays(new Date(), 29), end: new Date(), label: "30 dagar" };
    if (period === "week") {
      const s = startOfWeek(new Date(), { weekStartsOn: 1 });
      return { start: s, end: new Date(), label: "Denna vecka" };
    }
    if (period.startsWith("term:")) {
      const id = period.slice(5);
      const t = terms.find((x) => x.id === id);
      if (t)
        return { start: new Date(t.start_date), end: new Date(t.end_date), label: termLabel(t) };
    }
    return { start: subDays(new Date(), 29), end: new Date(), label: "30 dagar" };
  }, [period, terms]);

  const { data: entries = [] } = useQuery({
    queryKey: ["stats", "entries", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("id,started_at,duration_seconds,course_id,task_id,source")
        .neq("source", "session")
        .gte("started_at", range.start.toISOString())
        .lte("started_at", range.end.toISOString());
      return (data ?? []) as Entry[];
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
      return (data ?? []) as {
        id: string;
        course_id: string | null;
        planned_start: string;
        planned_end: string;
        actual_start: string | null;
        actual_end: string | null;
        completed: boolean;
      }[];
    },
  });

  const { data: sessionTaskRows = [] } = useQuery({
    queryKey: ["stats", "session-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("study_session_tasks").select("session_id,task_id");
      return (data ?? []) as { session_id: string; task_id: string }[];
    },
  });

  const coursesMap = new Map(allCourses.map((c) => [c.id, c]));

  const filteredEntries = entries.filter((e) => {
    if (!e.course_id) return true;
    const course = coursesMap.get(e.course_id);
    return course ? !course.archived : true;
  });

  const filteredSessionRows = sessionRows.filter((s) => {
    if (!s.course_id) return true;
    const course = coursesMap.get(s.course_id);
    return course ? !course.archived : true;
  });

  // Studiepass (bekräftade) räknas som studietid, oavsett completed-status.
  // Timer-poster (time_entries) räknas separat men vi filtrerar bort source="session"
  // för att undvika dubbelräkning av äldre historik.
  const derivedEntries: Entry[] = useMemo(() => {
    const out: Entry[] = [];
    for (const s of filteredSessionRows) {
      const start = s.actual_start ?? s.planned_start;
      const end = s.actual_end ?? s.planned_end;
      const dur = Math.max(
        0,
        Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000),
      );
      const tids = sessionTaskRows.filter((st) => st.session_id === s.id).map((st) => st.task_id);
      if (tids.length === 0) {
        out.push({
          id: `sess:${s.id}`,
          started_at: start,
          duration_seconds: dur,
          course_id: s.course_id,
          task_id: null,
        });
      } else {
        // Fördela passets tid jämnt mellan kopplade uppgifter så byTask får rätt tal.
        const per = Math.floor(dur / tids.length);
        tids.forEach((task_id, i) => {
          out.push({
            id: `sess:${s.id}:${i}`,
            started_at: start,
            duration_seconds: per,
            course_id: s.course_id,
            task_id,
          });
        });
      }
    }
    return out;
  }, [filteredSessionRows, sessionTaskRows]);

  const combined = useMemo(
    () => [...filteredEntries, ...derivedEntries],
    [filteredEntries, derivedEntries],
  );

  const { data: allTasks = [] } = useQuery(tasksQuery);
  const tasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (!t.course_id) return true;
      const course = coursesMap.get(t.course_id);
      return course ? !course.archived : true;
    });
  }, [allTasks, coursesMap]);

  const sessionsCount = filteredSessionRows.length;

  const totalDays = Math.max(1, differenceInCalendarDays(range.end, range.start) + 1);
  const days = Array.from({ length: totalDays }).map((_, i) => {
    const d = subDays(range.end, totalDays - 1 - i);
    const row: Record<string, number | string> = { day: format(d, "d/M", { locale: sv }) };
    let total = 0;
    for (const c of courses) {
      const h =
        combined
          .filter(
            (e) =>
              e.course_id === c.id &&
              e.started_at >= startOfDay(d).toISOString() &&
              e.started_at <= endOfDay(d).toISOString(),
          )
          .reduce((s, e) => s + (e.duration_seconds ?? 0), 0) / 3600;
      row[c.id] = +h.toFixed(2);
      total += h;
    }
    row.total = +total.toFixed(2);
    return row;
  });

  const perCourse = courses
    .map((c) => ({
      name: c.name,
      color: c.color,
      value: +(
        combined
          .filter((e) => e.course_id === c.id)
          .reduce((s, e) => s + (e.duration_seconds ?? 0), 0) / 3600
      ).toFixed(2),
    }))
    .filter((r) => r.value > 0);
  const noCourseHours = +(
    combined.filter((e) => !e.course_id).reduce((s, e) => s + (e.duration_seconds ?? 0), 0) / 3600
  ).toFixed(2);
  if (noCourseHours > 0) perCourse.push({ name: "Övrigt", color: "#94A3B8", value: noCourseHours });

  const perTask = (() => {
    const m = new Map<string, number>();
    for (const e of combined) {
      if (!e.task_id || !e.duration_seconds) continue;
      m.set(e.task_id, (m.get(e.task_id) ?? 0) + e.duration_seconds);
    }
    return [...m.entries()]
      .map(([id, sec]) => {
        const t = tasks.find((x) => x.id === id);
        const c = courses.find((c) => c.id === t?.course_id);
        return {
          id,
          title: t?.title ?? "Okänd",
          hours: +(sec / 3600).toFixed(2),
          color: c?.color ?? "#94A3B8",
        };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  })();

  const totalSec = combined.reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
  const avgPerDay = totalSec / totalDays;

  const statusCounts = {
    todo: tasks.filter((t) => t.status === "todo").length,
    doing: tasks.filter((t) => t.status === "doing").length,
    done: tasks.filter((t) => t.status === "done").length,
  };
  const statusData = [
    { name: "Ej startad", value: statusCounts.todo, color: "#FF7A59" },
    { name: "Pågår", value: statusCounts.doing, color: "#FFB84D" },
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
          <SelectTrigger className="w-[14rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Denna vecka</SelectItem>
            <SelectItem value="7">Senaste 7 dagarna</SelectItem>
            <SelectItem value="30">Senaste 30 dagarna</SelectItem>
            {terms.map((t) => (
              <SelectItem key={t.id} value={`term:${t.id}`}>
                {termLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60 bg-surface/60">
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total tid</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">
              {formatHoursCompact(totalSec)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-surface/60">
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Snitt per dag
            </div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">
              {formatHoursCompact(avgPerDay)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-surface/60">
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Studiepass</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">{sessionsCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Studie-Heatmap */}
      <Card className="mb-6 border-border/60 bg-surface/60">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base">Studieaktivitet senaste året</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-[3px] overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {/* Day labels (Mån - Sön) */}
            <div className="grid grid-rows-7 gap-[3px] pr-2 text-[8px] text-muted-foreground select-none font-medium">
              <div className="h-[10px] flex items-center justify-end">Mån</div>
              <div className="h-[10px] flex items-center justify-end">Tis</div>
              <div className="h-[10px] flex items-center justify-end">Ons</div>
              <div className="h-[10px] flex items-center justify-end">Tor</div>
              <div className="h-[10px] flex items-center justify-end">Fre</div>
              <div className="h-[10px] flex items-center justify-end">Lör</div>
              <div className="h-[10px] flex items-center justify-end">Sön</div>
            </div>

            {/* Weeks */}
            {heatmapWeeks.map((week, wIdx) => (
              <div key={wIdx} className="grid grid-rows-7 gap-[3px]">
                {week.map((day) => {
                  let colorClass = "bg-white/5 border border-white/5 hover:border-white/20";
                  if (day.hours > 0 && day.hours <= 1)
                    colorClass =
                      "bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-400";
                  else if (day.hours > 1 && day.hours <= 3)
                    colorClass =
                      "bg-indigo-500/40 border border-indigo-500/50 hover:border-indigo-300";
                  else if (day.hours > 3 && day.hours <= 6)
                    colorClass = "bg-indigo-500 border border-indigo-400 hover:border-indigo-300";
                  else if (day.hours > 6)
                    colorClass =
                      "bg-indigo-300 border border-indigo-200 hover:border-white text-indigo-950";

                  return (
                    <div
                      key={day.dayKey}
                      className={cn(
                        "w-[10px] h-[10px] rounded-[1.5px] transition-all cursor-pointer",
                        colorClass,
                      )}
                      title={`${format(day.date, "d MMMM yyyy", { locale: sv })}: ${day.hours.toFixed(2)} h`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
            <span>Mindre</span>
            <div className="w-[10px] h-[10px] rounded-[1.5px] bg-white/5 border border-white/5" />
            <div className="w-[10px] h-[10px] rounded-[1.5px] bg-indigo-500/20 border border-indigo-500/30" />
            <div className="w-[10px] h-[10px] rounded-[1.5px] bg-indigo-500/40 border border-indigo-500/50" />
            <div className="w-[10px] h-[10px] rounded-[1.5px] bg-indigo-500 border border-indigo-400" />
            <div className="w-[10px] h-[10px] rounded-[1.5px] bg-indigo-300 border border-indigo-200" />
            <span>Mer</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-surface/60 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Studietid per kurs över tid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--foreground)",
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                    formatter={(v: number) => [`${v} h`, ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {courses.map((c) => (
                    <Line
                      key={c.id}
                      type="monotone"
                      dataKey={c.id}
                      name={c.name}
                      stroke={c.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Tid per kurs</CardTitle>
          </CardHeader>
          <CardContent>
            {perCourse.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Ingen tid loggad än.
              </div>
            )}
            {perCourse.length > 0 && (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={perCourse}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {perCourse.map((r) => (
                        <Cell key={r.name} fill={r.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--foreground)",
                      }}
                      itemStyle={{ color: "var(--foreground)" }}
                      labelStyle={{ color: "var(--muted-foreground)" }}
                      formatter={(v: number, n: string) => [`${v} h`, n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Topp uppgifter</CardTitle>
          </CardHeader>
          <CardContent>
            {perTask.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Ingen tid loggad på uppgifter än.
              </div>
            )}
            <div className="space-y-2">
              {perTask.map((t) => (
                <div key={t.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: t.color }}
                      />
                      <span className="truncate">{t.title}</span>
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground">{t.hours}h</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (t.hours / (perTask[0]?.hours || 1)) * 100)}%`,
                        background: t.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Uppgiftsstatus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical">
                  <XAxis
                    type="number"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--foreground)",
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                    {statusData.map((r) => (
                      <Cell key={r.name} fill={r.color} />
                    ))}
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
