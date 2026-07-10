import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
  parseISO,
} from "date-fns";
import { sv } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Flag, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { coursesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  course_id: string | null;
  source: string;
  counts_as_study: boolean;
};
type SessionRow = {
  id: string;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  completed: boolean;
  course_id: string | null;
  notes: string | null;
};
type TaskRow = {
  id: string;
  title: string;
  due_at: string | null;
  course_id: string | null;
  task_kind: string;
  task_type: string | null;
};

function CalendarPage() {
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());

  const monthStart = startOfMonth(cursor);
  const gridStart =
    view === "month"
      ? addDays(monthStart, -((getDay(monthStart) + 6) % 7))
      : startOfWeek(cursor, { weekStartsOn: 1 });
  const cellCount = view === "month" ? 42 : 7;
  const days = Array.from({ length: cellCount }).map((_, i) => addDays(gridStart, i));
  const rangeStart = gridStart.toISOString();
  const rangeEnd = addDays(gridStart, cellCount).toISOString();

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const courses = allCourses.filter((c) => !c.archived && !c.completed);

  const { data: events = [] } = useQuery({
    queryKey: ["events", view, rangeStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("calendar_events")
        .select("id,title,starts_at,ends_at,all_day,course_id,source,counts_as_study")
        .gte("starts_at", rangeStart)
        .lte("starts_at", rangeEnd)
        .order("starts_at");
      return (data ?? []) as EventRow[];
    },
  });

  const { data: tasksDue = [] } = useQuery({
    queryKey: ["tasks", "due", view, rangeStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,due_at,course_id,task_kind,task_type")
        .gte("due_at", rangeStart)
        .lte("due_at", rangeEnd);
      return (data ?? []) as TaskRow[];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", view, rangeStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("id,planned_start,planned_end,actual_start,actual_end,completed,course_id,notes")
        .eq("needs_review", false)
        .gte("planned_start", rangeStart)
        .lte("planned_start", rangeEnd)
        .order("planned_start");
      return (data ?? []) as SessionRow[];
    },
  });

  const coursesMap = new Map(allCourses.map((c) => [c.id, c]));

  const filteredEvents = events.filter((e) => {
    if (!e.course_id) return true;
    const course = coursesMap.get(e.course_id);
    return course ? !course.archived : true;
  });

  const filteredTasksDue = tasksDue.filter((t) => {
    if (!t.course_id) return true;
    const course = coursesMap.get(t.course_id);
    return course ? !course.archived : true;
  });

  const filteredSessions = sessions.filter((s) => {
    if (!s.course_id) return true;
    const course = coursesMap.get(s.course_id);
    return course ? !course.archived : true;
  });

  const selectedEvents = filteredEvents.filter((e) => isSameDay(parseISO(e.starts_at), selected));
  const selectedTasks = filteredTasksDue.filter(
    (t) => t.due_at && isSameDay(parseISO(t.due_at), selected),
  );
  const selectedSessions = filteredSessions.filter((s) =>
    isSameDay(parseISO(s.planned_start), selected),
  );

  const shift = (dir: -1 | 1) => {
    if (view === "month") setCursor(dir > 0 ? addMonths(cursor, 1) : subMonths(cursor, 1));
    else setCursor(dir > 0 ? addWeeks(cursor, 1) : subWeeks(cursor, 1));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Kalender</h1>
          <p className="text-sm text-muted-foreground">
            Deadlines, händelser och studiepass — samlat och skrivskyddat. Skapa uppgifter/pass från
            respektive vy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border/60 p-0.5 text-xs">
            <button
              onClick={() => setView("month")}
              className={cn("rounded px-2 py-1", view === "month" && "bg-surface-2 font-medium")}
            >
              Månad
            </button>
            <button
              onClick={() => setView("week")}
              className={cn("rounded px-2 py-1", view === "week" && "bg-surface-2 font-medium")}
            >
              Vecka
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[10rem] text-center font-display text-lg">
            {view === "month"
              ? format(cursor, "MMMM yyyy", { locale: sv })
              : `Vecka ${format(cursor, "w")} · ${format(cursor, "MMM yyyy", { locale: sv })}`}
          </div>
          <Button variant="ghost" size="icon" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCursor(new Date());
              setSelected(new Date());
            }}
          >
            Idag
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-surface/40">
          <div className="grid grid-cols-7 border-b border-border/60 bg-surface/60 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((d) => (
              <div key={d} className="px-2 py-2 text-center">
                {d}
              </div>
            ))}
          </div>
          <div
            className={cn(
              "grid grid-cols-7",
              view === "month" ? "auto-rows-fr" : "auto-rows-[10rem]",
            )}
          >
            {days.map((d) => {
              const inMonth = view === "week" || isSameMonth(d, cursor);
              const dayEvents = filteredEvents.filter((e) => isSameDay(parseISO(e.starts_at), d));
              const dayTasks = filteredTasksDue.filter(
                (t) => t.due_at && isSameDay(parseISO(t.due_at), d),
              );
              const daySessions = filteredSessions.filter((s) =>
                isSameDay(parseISO(s.planned_start), d),
              );
              const isSel = isSameDay(d, selected);
              const isToday = isSameDay(d, new Date());
              const items = [
                ...daySessions.map((s) => ({ kind: "session" as const, ref: s })),
                ...dayEvents.map((e) => ({ kind: "event" as const, ref: e })),
                ...dayTasks.map((t) => ({ kind: "task" as const, ref: t })),
              ];
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelected(d)}
                  className={cn(
                    "flex min-h-[6rem] flex-col gap-1 border-b border-r border-border/40 p-1.5 text-left transition-colors",
                    !inMonth && "bg-background/40 text-muted-foreground/50",
                    isSel && "bg-surface-2",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full text-xs font-medium",
                        isToday && "gradient-sunset text-white",
                      )}
                    >
                      {format(d, "d")}
                    </span>
                    {items.length > 0 && (
                      <span className="text-[9px] text-muted-foreground">{items.length}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {items.slice(0, 3).map((it) => {
                      if (it.kind === "session") {
                        const c = courses.find((c) => c.id === it.ref.course_id);
                        return (
                          <div
                            key={"s" + it.ref.id}
                            className="truncate rounded px-1 py-0.5 text-[10px]"
                            style={{
                              background: `${c?.color ?? "#8B5CF6"}22`,
                              borderLeft: `2px solid ${c?.color ?? "#8B5CF6"}`,
                            }}
                          >
                            📚 {format(parseISO(it.ref.planned_start), "HH:mm")} pass
                          </div>
                        );
                      }
                      if (it.kind === "event") {
                        const c = courses.find((c) => c.id === it.ref.course_id);
                        return (
                          <div
                            key={"e" + it.ref.id}
                            className="truncate rounded px-1 py-0.5 text-[10px]"
                            style={{
                              background: `${c?.color ?? "#8B5CF6"}33`,
                              color: c?.color ?? "var(--sunset-violet)",
                            }}
                          >
                            {format(parseISO(it.ref.starts_at), "HH:mm")} {it.ref.title}
                          </div>
                        );
                      }
                      return (
                        <div
                          key={"t" + it.ref.id}
                          className="truncate rounded border border-dashed px-1 py-0.5 text-[10px] text-sunset-amber"
                          style={{ borderColor: "var(--sunset-amber)" }}
                        >
                          ⚑ {it.ref.title}
                        </div>
                      );
                    })}
                    {items.length > 3 && (
                      <div className="text-[9px] text-muted-foreground">
                        +{items.length - 3} till
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-xl border border-border/60 bg-surface/40 p-4">
          <div className="mb-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {format(selected, "EEEE", { locale: sv })}
            </div>
            <div className="font-display text-2xl font-bold">
              {format(selected, "d MMMM", { locale: sv })}
            </div>
          </div>
          {selectedEvents.length + selectedTasks.length + selectedSessions.length === 0 && (
            <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              Inget planerat.
            </div>
          )}
          <div className="space-y-2">
            {selectedSessions.map((s) => {
              const c = courses.find((c) => c.id === s.course_id);
              return (
                <div key={s.id} className="rounded-lg border border-border/60 bg-surface p-3">
                  <div
                    className="flex items-center gap-2 text-xs uppercase tracking-wider"
                    style={{ color: c?.color ?? "var(--sunset-violet)" }}
                  >
                    <GraduationCap className="h-3 w-3" /> Studiepass {s.completed && "· Genomfört"}
                  </div>
                  <div className="mt-1 text-sm">{c?.name ?? "Ingen kurs"}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(parseISO(s.planned_start), "HH:mm")}–
                    {format(parseISO(s.planned_end), "HH:mm")}
                  </div>
                  {s.notes && <div className="mt-1 text-xs text-muted-foreground">{s.notes}</div>}
                </div>
              );
            })}
            {selectedEvents.map((e) => {
              const c = courses.find((c) => c.id === e.course_id);
              return (
                <div key={e.id} className="rounded-lg border border-border/60 bg-surface p-3">
                  <div className="text-sm font-medium">{e.title}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(parseISO(e.starts_at), "HH:mm")}–{format(parseISO(e.ends_at), "HH:mm")}
                  </div>
                  {c && (
                    <div
                      className="mt-1 inline-flex items-center gap-1 text-xs"
                      style={{ color: c.color }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: c.color }}
                      />
                      {c.name}
                    </div>
                  )}
                  {e.source === "google" && (
                    <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                      Google
                    </span>
                  )}
                </div>
              );
            })}
            {selectedTasks.map((t) => {
              const c = courses.find((c) => c.id === t.course_id);
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-dashed border-sunset-amber/60 bg-surface p-3 text-sm"
                >
                  <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-sunset-amber">
                    <Flag className="h-3 w-3" /> Deadline
                  </div>
                  <div>{t.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(parseISO(t.due_at!), "HH:mm")}
                    {c && (
                      <span className="inline-flex items-center gap-1" style={{ color: c.color }}>
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: c.color }}
                        />
                        {c.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
