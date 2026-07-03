import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHoursCompact } from "@/lib/timer-store";
import { Clock, ListTodo, BookOpen, Calendar as CalendarIcon, TrendingUp } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, isSameDay } from "date-fns";
import { sv } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type CourseLite = { id: string; name: string; color: string; icon: string | null };
type TaskLite = { id: string; title: string; due_at: string | null; status: string; course_id: string | null };
type TimeEntry = { id: string; started_at: string; duration_seconds: number | null; course_id: string | null };

function Dashboard() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id,name,color,icon").eq("archived", false);
      return (data ?? []) as CourseLite[];
    },
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ["tasks", "upcoming"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,due_at,status,course_id")
        .neq("status", "done")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(8);
      return (data ?? []) as TaskLite[];
    },
  });

  const { data: weekEntries = [] } = useQuery({
    queryKey: ["time_entries", "week", weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("id,started_at,duration_seconds,course_id")
        .gte("started_at", weekStart.toISOString())
        .lte("started_at", weekEnd.toISOString());
      return (data ?? []) as TimeEntry[];
    },
  });

  const totalWeekSec = weekEntries.reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0);
  const todayEntries = weekEntries.filter((e) => isSameDay(new Date(e.started_at), new Date()));
  const totalTodaySec = todayEntries.reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0);

  const perDay = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(weekStart, i);
    const total = weekEntries
      .filter((e) => e.started_at >= startOfDay(d).toISOString() && e.started_at <= endOfDay(d).toISOString())
      .reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
    return { day: format(d, "EEE", { locale: sv }), hours: +(total / 3600).toFixed(2) };
  });

  const perCourse = courses
    .map((c) => ({
      name: c.name,
      color: c.color,
      hours: +(weekEntries.filter((e) => e.course_id === c.id).reduce((s, e) => s + (e.duration_seconds ?? 0), 0) / 3600).toFixed(2),
    }))
    .filter((r) => r.hours > 0)
    .sort((a, b) => b.hours - a.hours);

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Idag" value={formatHoursCompact(totalTodaySec)} sub="studietid" icon={<Clock className="h-4 w-4" />} accent="var(--sunset-coral)" />
        <StatCard label="Denna vecka" value={formatHoursCompact(totalWeekSec)} sub={`${weekEntries.length} sessioner`} icon={<TrendingUp className="h-4 w-4" />} accent="var(--sunset-amber)" />
        <StatCard label="Öppna uppgifter" value={String(upcoming.length)} sub="att göra / pågår" icon={<ListTodo className="h-4 w-4" />} accent="var(--sunset-violet)" />
        <StatCard label="Aktiva kurser" value={String(courses.length)} sub="i din arbetsyta" icon={<BookOpen className="h-4 w-4" />} accent="var(--sunset-rose)" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-surface/60 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Veckans studietid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perDay}>
                  <defs>
                    <linearGradient id="grad-hours" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--sunset-coral)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="var(--sunset-violet)" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    cursor={{ fill: "var(--accent)" }}
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v} h`, "Tid"]}
                  />
                  <Bar dataKey="hours" fill="url(#grad-hours)" radius={[6, 6, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="font-display text-base">Tid per kurs</CardTitle>
          </CardHeader>
          <CardContent>
            {perCourse.length === 0 && (
              <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                Ingen tid loggad än den här veckan.
              </div>
            )}
            {perCourse.length > 0 && (
              <div className="space-y-2">
                {perCourse.map((r) => (
                  <div key={r.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
                        {r.name}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">{r.hours}h</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (r.hours / Math.max(...perCourse.map((p) => p.hours))) * 100)}%`, background: r.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-surface/60">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2"><ListTodo className="h-4 w-4 text-sunset-coral" /> Kommande uppgifter</CardTitle>
            <Link to="/tasks" className="text-xs text-muted-foreground hover:text-foreground">Se alla →</Link>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 && <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">Inga öppna uppgifter. Bra jobbat!</div>}
            <div className="space-y-1">
              {upcoming.map((t) => {
                const c = courses.find((c) => c.id === t.course_id);
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: c?.color ?? "var(--muted-foreground)" }} />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    {t.due_at && (
                      <span className="text-xs text-muted-foreground">{format(new Date(t.due_at), "d MMM", { locale: sv })}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-sunset-violet" /> Snabbstart</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <QuickAction to="/tasks" label="Ny uppgift" icon={<ListTodo className="h-4 w-4" />} />
            <QuickAction to="/courses" label="Ny kurs" icon={<BookOpen className="h-4 w-4" />} />
            <QuickAction to="/calendar" label="Kalender" icon={<CalendarIcon className="h-4 w-4" />} />
            <QuickAction to="/time" label="Tidshistorik" icon={<Clock className="h-4 w-4" />} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub: string; icon: React.ReactNode; accent: string }) {
  return (
    <Card className="relative overflow-hidden border-border/60 bg-surface/60">
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <span style={{ color: accent }}>{icon}</span>
          {label}
        </div>
        <div className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-2 rounded-md border border-border/60 bg-surface px-3 py-3 text-sm hover:border-sunset-coral/40 hover:bg-surface-2"
    >
      <span className="text-muted-foreground group-hover:text-sunset-coral">{icon}</span>
      {label}
    </Link>
  );
}

// silence unused import in Cell
void Cell;
