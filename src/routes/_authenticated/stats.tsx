import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { sv } from "date-fns/locale";
import { formatHoursCompact } from "@/lib/timer-store";

export const Route = createFileRoute("/_authenticated/stats")({
  component: StatsPage,
});

type Course = { id: string; name: string; color: string };
type Entry = { id: string; started_at: string; duration_seconds: number | null; course_id: string | null };
type Task = { id: string; status: string; course_id: string | null };

function StatsPage() {
  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id,name,color").eq("archived", false);
      return (data ?? []) as Course[];
    },
  });

  const since = subDays(new Date(), 29);
  const { data: entries = [] } = useQuery({
    queryKey: ["stats", "entries", since.toISOString().slice(0, 10)],
    queryFn: async () => {
      const { data } = await supabase.from("time_entries").select("id,started_at,duration_seconds,course_id").gte("started_at", since.toISOString());
      return (data ?? []) as Entry[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["stats", "tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("id,status,course_id");
      return (data ?? []) as Task[];
    },
  });

  const days = Array.from({ length: 30 }).map((_, i) => {
    const d = subDays(new Date(), 29 - i);
    const total = entries
      .filter((e) => e.started_at >= startOfDay(d).toISOString() && e.started_at <= endOfDay(d).toISOString())
      .reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
    return { day: format(d, "d/M", { locale: sv }), hours: +(total / 3600).toFixed(2) };
  });

  const perCourse = courses.map((c) => ({
    name: c.name,
    color: c.color,
    value: +(entries.filter((e) => e.course_id === c.id).reduce((s, e) => s + (e.duration_seconds ?? 0), 0) / 3600).toFixed(2),
  })).filter((r) => r.value > 0);

  const noCourseHours = +(entries.filter((e) => !e.course_id).reduce((s, e) => s + (e.duration_seconds ?? 0), 0) / 3600).toFixed(2);
  if (noCourseHours > 0) perCourse.push({ name: "Övrigt", color: "#94A3B8", value: noCourseHours });

  const totalSec = entries.reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
  const avgPerDay = totalSec / 30;

  const statusCounts = {
    todo: tasks.filter((t) => t.status === "todo").length,
    doing: tasks.filter((t) => t.status === "doing").length,
    done: tasks.filter((t) => t.status === "done").length,
  };
  const statusData = [
    { name: "Att göra", value: statusCounts.todo, color: "#FF7A59" },
    { name: "Pågår", value: statusCounts.doing, color: "#FFB84D" },
    { name: "Klar", value: statusCounts.done, color: "#8B5CF6" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">Statistik</h1>
      <p className="mb-8 text-sm text-muted-foreground">Senaste 30 dagarna.</p>

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
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Sessioner</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">{entries.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-surface/60 lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="font-display text-base">Studietid senaste 30 dagarna</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={days}>
                  <defs>
                    <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--sunset-coral)" />
                      <stop offset="100%" stopColor="var(--sunset-violet)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={28} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} h`, "Tid"]} />
                  <Line type="monotone" dataKey="hours" stroke="url(#line-grad)" strokeWidth={2.5} dot={false} />
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
              <div className="h-64">
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

        <Card className="border-border/60 bg-surface/60 lg:col-span-3">
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
      {/* silence unused */}
      <div className="hidden">{Legend.name}</div>
    </div>
  );
}
