import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  subDays,
  subMonths,
  subWeeks,
  parseISO,
  differenceInCalendarDays,
  getDay,
} from "date-fns";
import { sv } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  GraduationCap,
  Calendar as CalendarIcon,
  RefreshCw,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  ListTodo,
  ArrowRight,
  Layers,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { coursesQuery, TYPE_LABELS, TYPE_COLORS, type TaskType, type Course } from "@/lib/queries";
import { formatHoursCompact } from "@/lib/timer-store";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type FilterKind = "all" | "sessions" | "tasks" | "events";
type ViewMode = "month" | "month_list" | "week" | "day";

function CalendarPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [filterKind, setFilterKind] = useState<FilterKind>("all");
  const [filterCourse, setFilterCourse] = useState<string>("all");

  // Synka Google Calendar
  const sync = useMutation({
    mutationFn: async () => {
      const { syncGoogleCalendar } = await import("@/lib/google-calendar.functions");
      return await syncGoogleCalendar();
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["study_sessions"] });
      toast.success(
        `Synkat ${r.calendars} kalender(-rar): ${r.imported} händelser, ${r.sessions} studiepass`,
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Synkfel"),
  });

  // Beräkna gränser för vald kalendervy (veckor börjar alltid på måndag och slutar söndag)
  const { monthGridDays, allMonthDays, weekDays, rangeStart, rangeEnd } = useMemo(() => {
    const mStart = startOfMonth(cursor);
    const mEnd = endOfMonth(cursor);

    // Månadens alla faktiska kalenderdagar (1 till 28/30/31)
    const monthDaysCount = differenceInCalendarDays(mEnd, mStart) + 1;
    const allMDays = Array.from({ length: monthDaysCount }).map((_, i) => addDays(mStart, i));

    // Månadsrutnät (startar på måndag före/på mStart, slutar på söndag på/efter mEnd)
    const gStart = startOfWeek(mStart, { weekStartsOn: 1 });
    const gEnd = endOfWeek(mEnd, { weekStartsOn: 1 });
    const gCount = differenceInCalendarDays(gEnd, gStart) + 1;
    const gDays = Array.from({ length: gCount }).map((_, i) => addDays(gStart, i));

    // Veckans 7 dagar för veckovyn
    const wStart = startOfWeek(cursor, { weekStartsOn: 1 });
    const wDays = Array.from({ length: 7 }).map((_, i) => addDays(wStart, i));

    if (view === "month") {
      return {
        monthGridDays: gDays,
        allMonthDays: allMDays,
        weekDays: wDays,
        rangeStart: startOfDay(gStart).toISOString(),
        rangeEnd: endOfDay(gEnd).toISOString(),
      };
    }

    if (view === "month_list") {
      return {
        monthGridDays: gDays,
        allMonthDays: allMDays,
        weekDays: wDays,
        rangeStart: startOfDay(mStart).toISOString(),
        rangeEnd: endOfDay(mEnd).toISOString(),
      };
    }

    if (view === "week") {
      return {
        monthGridDays: gDays,
        allMonthDays: allMDays,
        weekDays: wDays,
        rangeStart: startOfDay(wStart).toISOString(),
        rangeEnd: endOfDay(wDays[6]).toISOString(),
      };
    }

    // "day"
    return {
      monthGridDays: gDays,
      allMonthDays: allMDays,
      weekDays: wDays,
      rangeStart: startOfDay(selected).toISOString(),
      rangeEnd: endOfDay(selected).toISOString(),
    };
  }, [view, cursor, selected]);

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const courses = allCourses.filter((c) => !c.archived && !c.completed);
  const coursesMap = useMemo(() => new Map(allCourses.map((c) => [c.id, c])), [allCourses]);

  const { data: events = [] } = useQuery({
    queryKey: ["events", rangeStart, rangeEnd],
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
    queryKey: ["tasks", "due", rangeStart, rangeEnd],
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
    queryKey: ["sessions", rangeStart, rangeEnd],
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

  // Filtrera efter kurs och icke-arkiverade kurser
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterKind !== "all" && filterKind !== "events") return false;
      if (filterCourse !== "all" && e.course_id !== filterCourse) return false;
      if (e.course_id && coursesMap.get(e.course_id)?.archived) return false;
      return true;
    });
  }, [events, filterKind, filterCourse, coursesMap]);

  const filteredTasksDue = useMemo(() => {
    return tasksDue.filter((t) => {
      if (filterKind !== "all" && filterKind !== "tasks") return false;
      if (filterCourse !== "all" && t.course_id !== filterCourse) return false;
      if (t.course_id && coursesMap.get(t.course_id)?.archived) return false;
      return true;
    });
  }, [tasksDue, filterKind, filterCourse, coursesMap]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterKind !== "all" && filterKind !== "sessions") return false;
      if (filterCourse !== "all" && s.course_id !== filterCourse) return false;
      if (s.course_id && coursesMap.get(s.course_id)?.archived) return false;
      return true;
    });
  }, [sessions, filterKind, filterCourse, coursesMap]);

  // Händelser för den valda dagen
  const selectedEvents = useMemo(() => {
    return filteredEvents.filter((e) => isSameDay(parseISO(e.starts_at), selected));
  }, [filteredEvents, selected]);

  const selectedTasks = useMemo(() => {
    return filteredTasksDue.filter((t) => t.due_at && isSameDay(parseISO(t.due_at), selected));
  }, [filteredTasksDue, selected]);

  const selectedSessions = useMemo(() => {
    return filteredSessions.filter((s) => isSameDay(parseISO(s.planned_start), selected));
  }, [filteredSessions, selected]);

  // Stega fram och tillbaka i kalendern
  const shift = (dir: -1 | 1) => {
    if (view === "month" || view === "month_list") {
      const nextMonth = dir > 0 ? addMonths(cursor, 1) : subMonths(cursor, 1);
      setCursor(nextMonth);
      if (!isSameMonth(selected, nextMonth)) {
        setSelected(startOfMonth(nextMonth));
      }
    } else if (view === "week") {
      const nextWeek = dir > 0 ? addWeeks(cursor, 1) : subWeeks(cursor, 1);
      setCursor(nextWeek);
      setSelected(addWeeks(selected, dir));
    } else {
      const nextDay = dir > 0 ? addDays(selected, 1) : subDays(selected, 1);
      setSelected(nextDay);
      setCursor(nextDay);
    }
  };

  const jumpToToday = () => {
    const today = new Date();
    setCursor(today);
    setSelected(today);
  };

  const handleSelectDay = (day: Date) => {
    setSelected(day);
    if ((view === "month" || view === "month_list") && !isSameMonth(day, cursor)) {
      setCursor(day);
    }
  };

  // Hjälpfunktion för att hämta alla aktiviteter för en given dag
  const getDayItems = (d: Date) => {
    const daySessions = filteredSessions.filter((s) => isSameDay(parseISO(s.planned_start), d));
    const dayEvents = filteredEvents.filter((e) => isSameDay(parseISO(e.starts_at), d));
    const dayTasks = filteredTasksDue.filter((t) => t.due_at && isSameDay(parseISO(t.due_at), d));

    return [
      ...daySessions.map((s) => ({ kind: "session" as const, ref: s, time: s.planned_start })),
      ...dayEvents.map((e) => ({ kind: "event" as const, ref: e, time: e.starts_at })),
      ...dayTasks.map((t) => ({ kind: "task" as const, ref: t, time: t.due_at || "" })),
    ].sort((a, b) => (a.time > b.time ? 1 : -1));
  };

  // Summera planerad tid för vald dag
  const selectedPlannedStudySecs = useMemo(() => {
    return selectedSessions.reduce((acc, s) => {
      const start = new Date(s.planned_start).getTime();
      const end = new Date(s.planned_end).getTime();
      return acc + Math.max(0, Math.floor((end - start) / 1000));
    }, 0);
  }, [selectedSessions]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 space-y-6">
      {/* ── Sidhuvud & Huvudkontroller ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">Kalender</h1>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border border-white/5">
              Vecka {format(cursor, "I")}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Översikt över alla dagar, studiepass, inlämningar och Google Kalender-händelser.
          </p>
        </div>

        {/* Funktionsknappar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Vy-väljare: Månad / Månadslista / Vecka / Dag */}
          <div className="flex rounded-xl border border-border/60 bg-surface/60 p-0.5 text-xs">
            <button
              onClick={() => setView("month")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-all",
                view === "month"
                  ? "bg-surface-2 text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Månad</span>
            </button>
            <button
              onClick={() => setView("month_list")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-all",
                view === "month_list"
                  ? "bg-surface-2 text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ListTodo className="h-3.5 w-3.5" />
              <span>Månadslista</span>
            </button>
            <button
              onClick={() => setView("week")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-all",
                view === "week"
                  ? "bg-surface-2 text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              <span>Vecka</span>
            </button>
            <button
              onClick={() => setView("day")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-all",
                view === "day"
                  ? "bg-surface-2 text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              <span>Dag</span>
            </button>
          </div>

          {/* Stega bakåt / framåt */}
          <div className="flex items-center rounded-xl border border-border/60 bg-surface/60 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => shift(-1)}
              title="Föregående"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[9.5rem] px-2 text-center font-display text-sm font-semibold tracking-tight">
              {(view === "month" || view === "month_list") &&
                format(cursor, "MMMM yyyy", { locale: sv })}
              {view === "week" &&
                `V. ${format(cursor, "I")} · ${format(cursor, "MMM yyyy", { locale: sv })}`}
              {view === "day" && format(selected, "d MMMM yyyy", { locale: sv })}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => shift(1)}
              title="Nästa"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={jumpToToday}
            className="rounded-xl border-border/60 bg-surface/60 hover:bg-surface-2 h-9"
          >
            Idag
          </Button>

          <Button
            size="sm"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="gap-1.5 rounded-xl gradient-sunset text-white hover:opacity-90 h-9"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", sync.isPending && "animate-spin")} />
            <span>{sync.isPending ? "Synkar…" : "Synka kalender"}</span>
          </Button>
        </div>
      </div>

      {/* ── Filterrad ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface/30 p-2.5 rounded-2xl border border-border/40">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> Filter:
          </span>
          <button
            onClick={() => setFilterKind("all")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
              filterKind === "all"
                ? "bg-foreground/15 text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-surface/60",
            )}
          >
            Alla ({filteredSessions.length + filteredEvents.length + filteredTasksDue.length})
          </button>
          <button
            onClick={() => setFilterKind("sessions")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
              filterKind === "sessions"
                ? "bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-surface/60",
            )}
          >
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            Studiepass ({sessions.length})
          </button>
          <button
            onClick={() => setFilterKind("tasks")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
              filterKind === "tasks"
                ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-surface/60",
            )}
          >
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Deadlines ({tasksDue.length})
          </button>
          <button
            onClick={() => setFilterKind("events")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
              filterKind === "events"
                ? "bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-surface/60",
            )}
          >
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Kalenderhändelser ({events.length})
          </button>
        </div>

        {/* Filtrera på specifik kurs */}
        <div className="flex items-center gap-2">
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-48 h-8 text-xs rounded-xl border-border/60 bg-surface/60">
              <SelectValue placeholder="Alla kurser" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla aktiva kurser</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    <span className="truncate">{c.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Kalendervy + Detaljpanel ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* Vänster: Huvudinnehåll */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-surface/40 shadow-sm">
          {/* 1. MÅNADSRUTNÄT: Visar månadens alla 7 veckodagar (Mån–Sön) utan att klippa */}
          {view === "month" && (
            <div className="w-full">
              {/* Kolumnrubriker: Mån–Sön */}
              <div className="grid grid-cols-7 border-b border-border/60 bg-surface/80 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground select-none">
                {[
                  { label: "Mån", full: "Måndag" },
                  { label: "Tis", full: "Tisdag" },
                  { label: "Ons", full: "Onsdag" },
                  { label: "Tor", full: "Torsdag" },
                  { label: "Fre", full: "Fredag" },
                  { label: "Lör", full: "Lördag" },
                  { label: "Sön", full: "Söndag" },
                ].map((d) => (
                  <div key={d.label} className="py-2.5 text-center truncate" title={d.full}>
                    <span className="hidden sm:inline">{d.full}</span>
                    <span className="sm:hidden">{d.label}</span>
                  </div>
                ))}
              </div>

              {/* Själva rutnätet: 7 kolumner, alla dagar i månaden */}
              <div className="grid grid-cols-7 w-full">
                {monthGridDays.map((d) => {
                  const inMonth = isSameMonth(d, cursor);
                  const items = getDayItems(d);
                  const isSel = isSameDay(d, selected);
                  const isToday = isSameDay(d, new Date());
                  const isMonday = getDay(d) === 1;
                  const weekNum = isMonday ? format(d, "I") : null;

                  return (
                    <button
                      type="button"
                      key={d.toISOString()}
                      onClick={() => handleSelectDay(d)}
                      className={cn(
                        "group relative flex min-h-[5.5rem] sm:min-h-[6.5rem] flex-col justify-between border-b border-r border-border/40 p-1.5 sm:p-2 text-left transition-all cursor-pointer",
                        !inMonth && "bg-background/25 text-muted-foreground/35 hover:bg-surface/30",
                        inMonth && "bg-surface/20 hover:bg-surface-2/60 text-foreground",
                        isSel &&
                          "bg-primary/15 ring-2 ring-primary border-primary/50 shadow-inner z-10",
                      )}
                    >
                      {/* Övre rad: Datum + Veckonummer + Räknare */}
                      <div className="flex items-center justify-between gap-1 w-full">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "grid h-6 w-6 place-items-center rounded-full text-xs font-semibold transition-all",
                              isToday && "gradient-sunset text-white shadow-xs font-bold",
                              !isToday && isSel && "bg-primary text-primary-foreground font-bold shadow-xs",
                              !isToday && !isSel && inMonth && "text-foreground group-hover:bg-surface-2",
                              !isToday && !isSel && !inMonth && "text-muted-foreground/45",
                            )}
                          >
                            {format(d, "d")}
                          </span>
                          {weekNum && (
                            <span className="hidden sm:inline-block rounded bg-surface-2 px-1 py-0.2 text-[9px] font-semibold text-muted-foreground/60 border border-white/5">
                              v.{weekNum}
                            </span>
                          )}
                        </div>

                        {items.length > 0 ? (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.2 text-[9px] font-bold tabular-nums",
                              isSel
                                ? "bg-primary/25 text-primary"
                                : "bg-surface-2 text-muted-foreground border border-white/5",
                            )}
                          >
                            {items.length}
                          </span>
                        ) : (
                          inMonth && (
                            <span className="text-[9px] text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity">
                              Ledigt
                            </span>
                          )
                        )}
                      </div>

                      {/* Händelsepiller i cellen */}
                      <div className="space-y-1 mt-1 overflow-hidden w-full flex-1">
                        {items.slice(0, 3).map((it, idx) => {
                          if (it.kind === "session") {
                            const c = courses.find((cc) => cc.id === it.ref.course_id);
                            return (
                              <div
                                key={`s-${it.ref.id}-${idx}`}
                                className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium flex items-center gap-1 border-l-2"
                                style={{
                                  background: `${c?.color ?? "#8B5CF6"}18`,
                                  borderColor: c?.color ?? "#8B5CF6",
                                  color: c?.color ?? "#A78BFA",
                                }}
                                title={`Studiepass: ${format(parseISO(it.ref.planned_start), "HH:mm")} ${c?.name ?? ""}`}
                              >
                                <GraduationCap className="h-2.5 w-2.5 shrink-0" />
                                <span className="tabular-nums shrink-0">
                                  {format(parseISO(it.ref.planned_start), "HH:mm")}
                                </span>
                                <span className="truncate">{c?.name || "Pass"}</span>
                              </div>
                            );
                          }

                          if (it.kind === "event") {
                            return (
                              <div
                                key={`e-${it.ref.id}-${idx}`}
                                className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium flex items-center gap-1 bg-sky-500/15 text-sky-300 border-l-2 border-sky-400"
                                title={`Händelse: ${format(parseISO(it.ref.starts_at), "HH:mm")} ${it.ref.title}`}
                              >
                                <Clock className="h-2.5 w-2.5 shrink-0 text-sky-400" />
                                <span className="tabular-nums shrink-0">
                                  {format(parseISO(it.ref.starts_at), "HH:mm")}
                                </span>
                                <span className="truncate">{it.ref.title}</span>
                              </div>
                            );
                          }

                          // Task / Deadline
                          const dueTime = it.ref.due_at
                            ? format(parseISO(it.ref.due_at), "HH:mm")
                            : null;
                          return (
                            <div
                              key={`t-${it.ref.id}-${idx}`}
                              className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium flex items-center gap-1 bg-amber-500/15 text-amber-300 border-l-2 border-amber-400"
                              title={`Deadline: ${dueTime ? dueTime + " " : ""}${it.ref.title}`}
                            >
                              <Flag className="h-2.5 w-2.5 shrink-0 text-amber-400" />
                              {dueTime && <span className="tabular-nums shrink-0">{dueTime}</span>}
                              <span className="truncate">{it.ref.title}</span>
                            </div>
                          );
                        })}

                        {items.length > 3 && (
                          <div className="text-[9px] text-muted-foreground font-medium px-0.5">
                            +{items.length - 3} till
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. MÅNADSLISTA: Visar ALLA dagar i aktuell kalendermånad (1..31) även de utan något inlagt */}
          {view === "month_list" && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="font-display text-base font-semibold">
                  Månadens alla dagar ({format(cursor, "MMMM yyyy", { locale: sv })})
                </div>
                <div className="text-xs text-muted-foreground">
                  Totalt {allMonthDays.length} dagar
                </div>
              </div>

              <div className="space-y-2 max-h-[46rem] overflow-y-auto pr-1">
                {allMonthDays.map((d) => {
                  const items = getDayItems(d);
                  const isSel = isSameDay(d, selected);
                  const isToday = isSameDay(d, new Date());
                  const daySessionSecs = items
                    .filter((it) => it.kind === "session")
                    .reduce((sum, it) => {
                      const s = it.ref as SessionRow;
                      const start = new Date(s.planned_start).getTime();
                      const end = new Date(s.planned_end).getTime();
                      return sum + Math.max(0, Math.floor((end - start) / 1000));
                    }, 0);

                  return (
                    <button
                      type="button"
                      key={d.toISOString()}
                      onClick={() => handleSelectDay(d)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
                        isSel
                          ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/60"
                          : "border-border/50 bg-surface/50 hover:bg-surface-2/60",
                      )}
                    >
                      {/* Vänster: Datum och dag */}
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold tabular-nums",
                            isToday
                              ? "gradient-sunset text-white shadow-xs"
                              : isSel
                              ? "bg-primary text-primary-foreground font-bold"
                              : "bg-surface-2 text-foreground border border-white/5",
                          )}
                        >
                          {format(d, "d")}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize text-sm">
                              {format(d, "EEEE", { locale: sv })}
                            </span>
                            {isToday && (
                              <span className="rounded-full gradient-sunset text-white text-[9px] font-bold px-2 py-0.5">
                                Idag
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              v.{format(d, "I")}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(d, "d MMMM yyyy", { locale: sv })}
                          </div>
                        </div>
                      </div>

                      {/* Höger: Aktiviteter eller "Ledigt" */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {items.length === 0 ? (
                          <span className="text-xs text-muted-foreground/60 italic px-2 py-1 rounded-lg bg-surface/40">
                            Ledigt · Inga aktiviteter
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            {daySessionSecs > 0 && (
                              <span className="text-xs font-medium text-purple-300 bg-purple-500/15 border border-purple-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                                <GraduationCap className="h-3 w-3" />
                                {formatHoursCompact(daySessionSecs)} studietid
                              </span>
                            )}
                            {items
                              .filter((it) => it.kind === "task")
                              .map((it, idx) => (
                                <span
                                  key={`t-badge-${idx}`}
                                  className="text-xs font-medium text-amber-300 bg-amber-500/15 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 max-w-[14rem] truncate"
                                >
                                  <Flag className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{it.ref.title}</span>
                                </span>
                              ))}
                            {items
                              .filter((it) => it.kind === "event")
                              .map((it, idx) => (
                                <span
                                  key={`e-badge-${idx}`}
                                  className="text-xs font-medium text-sky-300 bg-sky-500/15 border border-sky-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 max-w-[14rem] truncate"
                                >
                                  <Clock className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{it.ref.title}</span>
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. VECKOVY (Rymlig 7-dagars vy: Mån–Sön) */}
          {view === "week" && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {weekDays.map((d) => {
                  const items = getDayItems(d);
                  const isSel = isSameDay(d, selected);
                  const isToday = isSameDay(d, new Date());

                  const daySessionSecs = items
                    .filter((it) => it.kind === "session")
                    .reduce((sum, it) => {
                      const s = it.ref as SessionRow;
                      const start = new Date(s.planned_start).getTime();
                      const end = new Date(s.planned_end).getTime();
                      return sum + Math.max(0, Math.floor((end - start) / 1000));
                    }, 0);

                  const dayTaskCount = items.filter((it) => it.kind === "task").length;

                  return (
                    <button
                      type="button"
                      key={d.toISOString()}
                      onClick={() => handleSelectDay(d)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all flex flex-col justify-between min-h-[14rem]",
                        isSel
                          ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/60"
                          : "border-border/60 bg-surface/50 hover:bg-surface-2/60",
                      )}
                    >
                      <div>
                        {/* Dag-huvud */}
                        <div className="flex items-center justify-between pb-2 border-b border-border/40">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {format(d, "EEEE", { locale: sv })}
                            </div>
                            <div className="flex items-baseline gap-1.5">
                              <span
                                className={cn(
                                  "font-display text-xl font-bold tabular-nums",
                                  isToday && "text-sunset-amber",
                                )}
                              >
                                {format(d, "d MMM", { locale: sv })}
                              </span>
                            </div>
                          </div>
                          {isToday && (
                            <span className="rounded-full gradient-sunset text-white text-[9px] font-bold px-2 py-0.5">
                              Idag
                            </span>
                          )}
                        </div>

                        {/* Statistik för dagen */}
                        <div className="flex items-center gap-2 pt-2 text-[10px] text-muted-foreground">
                          {daySessionSecs > 0 && (
                            <span className="font-semibold text-purple-400">
                              📚 {formatHoursCompact(daySessionSecs)}
                            </span>
                          )}
                          {dayTaskCount > 0 && (
                            <span className="font-semibold text-amber-400">
                              ⚑ {dayTaskCount} deadline
                            </span>
                          )}
                          {daySessionSecs === 0 && dayTaskCount === 0 && items.length === 0 && (
                            <span className="italic">Ledigt</span>
                          )}
                        </div>

                        {/* Listade händelser i dagkolumnen */}
                        <div className="mt-3 space-y-1.5">
                          {items.map((it, idx) => {
                            if (it.kind === "session") {
                              const c = courses.find((cc) => cc.id === it.ref.course_id);
                              return (
                                <div
                                  key={`w-s-${it.ref.id}-${idx}`}
                                  className="rounded-lg p-2 text-xs font-medium border-l-3 space-y-0.5"
                                  style={{
                                    background: `${c?.color ?? "#8B5CF6"}18`,
                                    borderColor: c?.color ?? "#8B5CF6",
                                  }}
                                >
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span style={{ color: c?.color ?? "#A78BFA" }}>
                                      {c?.name ?? "Studiepass"}
                                    </span>
                                    <span className="tabular-nums text-muted-foreground">
                                      {format(parseISO(it.ref.planned_start), "HH:mm")}
                                    </span>
                                  </div>
                                  {it.ref.notes && (
                                    <div className="text-[11px] text-foreground truncate">
                                      {it.ref.notes}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            if (it.kind === "task") {
                              return (
                                <div
                                  key={`w-t-${it.ref.id}-${idx}`}
                                  className="rounded-lg p-2 text-xs font-medium border-l-3 bg-amber-500/15 border-amber-400 text-amber-300"
                                >
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-bold">Deadline</span>
                                    {it.ref.due_at && (
                                      <span className="tabular-nums">
                                        {format(parseISO(it.ref.due_at), "HH:mm")}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-foreground truncate mt-0.5">
                                    {it.ref.title}
                                  </div>
                                </div>
                              );
                            }

                            // Event
                            return (
                              <div
                                key={`w-e-${it.ref.id}-${idx}`}
                                className="rounded-lg p-2 text-xs font-medium border-l-3 bg-sky-500/15 border-sky-400 text-sky-300"
                              >
                                <div className="flex items-center justify-between text-[10px]">
                                  <span>Händelse</span>
                                  <span className="tabular-nums">
                                    {format(parseISO(it.ref.starts_at), "HH:mm")}
                                  </span>
                                </div>
                                <div className="text-[11px] text-foreground truncate mt-0.5">
                                  {it.ref.title}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-muted-foreground text-center font-medium">
                        Klicka för detaljer →
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. DAGVY (Fokuserad tidslinje för vald dag) */}
          {view === "day" && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div>
                  <h2 className="font-display text-2xl font-bold">
                    {format(selected, "EEEE d MMMM yyyy", { locale: sv })}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Detaljerat schema för hela dagen
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSelectDay(subDays(selected, 1))}
                  >
                    ← Föregående dag
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSelectDay(addDays(selected, 1))}
                  >
                    Nästa dag →
                  </Button>
                </div>
              </div>

              {getDayItems(selected).length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border/60">
                  <CalendarCheck className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <div className="font-display text-base font-semibold">Ledig dag</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Inga studiepass, händelser eller deadlines inlagda för denna dag.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getDayItems(selected).map((it, idx) => (
                    <div
                      key={`day-${it.kind}-${it.ref.id}-${idx}`}
                      className="p-4 rounded-xl border border-border/60 bg-surface/60 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {it.kind === "session" && (
                            <span className="rounded-md bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 font-medium flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" /> Studiepass
                            </span>
                          )}
                          {it.kind === "task" && (
                            <span className="rounded-md bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 font-medium flex items-center gap-1">
                              <Flag className="h-3 w-3" /> Deadline
                            </span>
                          )}
                          {it.kind === "event" && (
                            <span className="rounded-md bg-sky-500/20 text-sky-300 text-xs px-2 py-0.5 font-medium flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Händelse
                            </span>
                          )}
                          <span className="text-xs font-semibold tabular-nums text-foreground">
                            {it.kind === "session" &&
                              `${format(parseISO(it.ref.planned_start), "HH:mm")} – ${format(parseISO(it.ref.planned_end), "HH:mm")}`}
                            {it.kind === "event" &&
                              `${format(parseISO(it.ref.starts_at), "HH:mm")} – ${format(parseISO(it.ref.ends_at), "HH:mm")}`}
                            {it.kind === "task" &&
                              (it.ref.due_at
                                ? `Deadline kl. ${format(parseISO(it.ref.due_at), "HH:mm")}`
                                : "Deadline")}
                          </span>
                        </div>
                        <div className="font-medium text-base text-foreground pt-1">
                          {it.kind === "session"
                            ? it.ref.notes || "Studiepass"
                            : (it.ref as any).title}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Höger: Detaljpanel för vald dag (Inspektör) ── */}
        <aside className="rounded-2xl border border-border/60 bg-surface/60 p-5 backdrop-blur-md shadow-sm space-y-5 h-fit lg:sticky lg:top-6">
          {/* Vald dag rubrik */}
          <div className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {format(selected, "EEEE", { locale: sv })}
              </span>
              {isSameDay(selected, new Date()) && (
                <span className="rounded-full gradient-sunset text-white text-[10px] font-bold px-2 py-0.5">
                  Idag
                </span>
              )}
            </div>
            <div className="font-display text-2xl font-bold tracking-tight text-foreground mt-0.5">
              {format(selected, "d MMMM yyyy", { locale: sv })}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>Vecka {format(selected, "I")}</span>
              <span>·</span>
              <span>
                {selectedSessions.length + selectedEvents.length + selectedTasks.length} aktiviteter
              </span>
            </div>
          </div>

          {/* Snabbsummering för dagen */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-surface/80 border border-white/5 p-2.5 space-y-0.5">
              <div className="text-[10px] uppercase font-bold text-purple-400">Planerad tid</div>
              <div className="font-display text-lg font-bold tabular-nums">
                {selectedPlannedStudySecs > 0 ? formatHoursCompact(selectedPlannedStudySecs) : "0 h"}
              </div>
            </div>
            <div className="rounded-xl bg-surface/80 border border-white/5 p-2.5 space-y-0.5">
              <div className="text-[10px] uppercase font-bold text-amber-400">Deadlines</div>
              <div className="font-display text-lg font-bold tabular-nums">
                {selectedTasks.length} st
              </div>
            </div>
          </div>

          {/* Listning av dagens aktiviteter */}
          <div className="space-y-3">
            {selectedSessions.length + selectedEvents.length + selectedTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-6 text-center space-y-2 bg-surface/30">
                <CalendarCheck className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
                <div className="text-sm font-semibold text-foreground">Ledig dag</div>
                <p className="text-xs text-muted-foreground">
                  Inga studiepass, händelser eller deadlines inlagda för denna dag.
                </p>
                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    to="/tasks"
                    className="inline-flex items-center justify-center gap-1.5 text-xs text-foreground bg-surface-2 hover:bg-surface-3 py-1.5 px-3 rounded-xl border border-white/5 font-medium transition-colors"
                  >
                    <Flag className="h-3 w-3 text-amber-400" /> Skapa uppgift
                  </Link>
                  <Link
                    to="/time"
                    search={{ period: "week" }}
                    className="inline-flex items-center justify-center gap-1.5 text-xs text-foreground bg-surface-2 hover:bg-surface-3 py-1.5 px-3 rounded-xl border border-white/5 font-medium transition-colors"
                  >
                    <GraduationCap className="h-3 w-3 text-purple-400" /> Öppna studietid
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[26rem] overflow-y-auto pr-1">
                {/* 1. Studiepass */}
                {selectedSessions.map((s) => {
                  const c = courses.find((cc) => cc.id === s.course_id);
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl border p-3 bg-surface/80 transition-all space-y-1.5"
                      style={{
                        borderLeftWidth: "4px",
                        borderLeftColor: c?.color ?? "#8B5CF6",
                      }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className="font-semibold flex items-center gap-1.5"
                          style={{ color: c?.color ?? "var(--sunset-violet)" }}
                        >
                          <GraduationCap className="h-3.5 w-3.5" />
                          {c?.name ?? "Studiepass"}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] font-semibold",
                            s.completed
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-purple-500/20 text-purple-300",
                          )}
                        >
                          {s.completed ? "Genomfört" : "Planerat"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(s.planned_start), "HH:mm")} –{" "}
                        {format(parseISO(s.planned_end), "HH:mm")}
                      </div>

                      {s.notes && (
                        <div className="text-xs text-foreground/90 font-medium">{s.notes}</div>
                      )}
                    </div>
                  );
                })}

                {/* 2. Deadlines / Uppgifter */}
                {selectedTasks.map((t) => {
                  const c = courses.find((cc) => cc.id === t.course_id);
                  const typeLabel = t.task_type
                    ? TYPE_LABELS[t.task_type as TaskType] || t.task_type
                    : null;
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs text-amber-400">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Flag className="h-3.5 w-3.5" /> Deadline
                        </span>
                        {typeLabel && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[9px] font-medium border border-white/5",
                              t.task_type
                                ? TYPE_COLORS[t.task_type as TaskType]
                                : "bg-amber-500/20 text-amber-300",
                            )}
                          >
                            {typeLabel}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-medium text-foreground">{t.title}</div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                        <span className="flex items-center gap-1 tabular-nums">
                          <Clock className="h-3 w-3" />
                          {t.due_at ? format(parseISO(t.due_at), "HH:mm") : "--:--"}
                        </span>
                        {c && (
                          <span
                            className="inline-flex items-center gap-1 font-medium"
                            style={{ color: c.color }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: c.color }}
                            />
                            {c.name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* 3. Kalenderhändelser */}
                {selectedEvents.map((e) => {
                  const c = courses.find((cc) => cc.id === e.course_id);
                  return (
                    <div
                      key={e.id}
                      className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs text-sky-400">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> Kalenderhändelse
                        </span>
                        {e.source === "google" && (
                          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] uppercase font-bold text-sky-300">
                            Google
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-medium text-foreground">{e.title}</div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          {format(parseISO(e.starts_at), "HH:mm")} –{" "}
                          {format(parseISO(e.ends_at), "HH:mm")}
                        </span>
                        {c && (
                          <span
                            className="inline-flex items-center gap-1 font-medium"
                            style={{ color: c.color }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
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
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
