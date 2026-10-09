import { isSessionDone, sessionBounds, sessionDayKey, sessionSeconds, splitSeconds, localDayStart, localDayEnd } from "@/lib/study-time";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  Archive,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
  ListTodo,
  Flame,
  Zap,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Award,
  School,
  Building2,
  Landmark,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ExternalLink,
  AlertCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  useCsnPeriods,
  calculateCsnMetrics,
  getCsnPeriodStatus,
  type CsnPeriod,
  type CsnPeriodProgress,
  type RegisteredModuleForCsn,
} from "@/lib/csn";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatPeriods } from "@/lib/course-presets";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  differenceInCalendarDays,
  startOfWeek,
  endOfWeek,
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
import { useMemo, useState, useEffect } from "react";
import {
  coursesQuery,
  tasksQuery,
  termsQuery,
  enrollmentsQuery,
  reportingModulesQuery,
  enrollmentsForCourse,
  type TermRow,
} from "@/lib/queries";
import { periodWindows, resolvePeriod, makeArskursMapper, getArskursFromDate } from "@/lib/academic-periods";
import { formatDateYYYYMMDD } from "@/lib/date-utils";
import { PERIOD_TO_TERM, type CoursePeriod } from "@/lib/course-presets";
import { cn, hasEnteredValue } from "@/lib/utils";
import { useUniversities } from "@/lib/settings";

import { z } from "zod";

const isModuleDone = (m: { completed?: boolean | null; grade?: string | null; registered_on?: string | null; points?: string | null }) =>
  Boolean(m.completed || hasEnteredValue(m.grade) || m.registered_on || hasEnteredValue(m.points));

const statsSearchSchema = z.object({
  period: z.string().optional(),
  tab: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/stats")({
  validateSearch: statsSearchSchema,
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
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeTab = search.tab ?? "time";
  const period = search.period ?? "30";
  const [includeArchived, setIncludeArchived] = useState<boolean>(true);

  const setPeriod = (p: string) => {
    navigate({ search: (prev) => ({ ...prev, period: p }) });
  };
  const setActiveTab = (t: string) => {
    navigate({ search: (prev) => ({ ...prev, tab: t }) });
  };

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const { data: terms = [] } = useQuery(termsQuery);
  const { data: allEnrollments = [] } = useQuery(enrollmentsQuery);
  const { data: allModules = [] } = useQuery(reportingModulesQuery);
  const { periods: csnPeriods = [] } = useCsnPeriods();
  const { data: universities = [] } = useUniversities();
  const [selectedUniFilter, setSelectedUniFilter] = useState<string>("all");
  const [expandedCsnPeriodIds, setExpandedCsnPeriodIds] = useState<Record<string, boolean>>({});
  const togglePeriodExpanded = (id: string) => {
    setExpandedCsnPeriodIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const courseHasCompletedModule = useMemo(() => {
    const ids = new Set<string>();
    for (const m of allModules) {
      if (isModuleDone(m)) {
        ids.add(m.course_id);
      }
    }
    return (id: string) => ids.has(id);
  }, [allModules]);

  const courses = useMemo(() => {
    return includeArchived
      ? allCourses
      : allCourses.filter((c) => !c.archived || courseHasCompletedModule(c.id));
  }, [allCourses, includeArchived, courseHasCompletedModule]);

  const heatmapStart = useMemo(() => subDays(new Date(), 364), []);
  const heatmapEnd = useMemo(() => new Date(), []);

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
    const now = Date.now();

    for (const s of heatmapSessions) {
      if (!isSessionDone(s, now)) continue;
      const day = sessionDayKey(s);
      dailyHours[day] = (dailyHours[day] ?? 0) + sessionSeconds(s) / 3600;
    }

    return dailyHours;
  }, [heatmapSessions]);

  const heatmapDays = useMemo(() => {
    const days = [];
    let curr = heatmapStart;
    while (curr <= heatmapEnd) {
      const dayStr = formatDateYYYYMMDD(curr);
      days.push({
        date: curr,
        dateStr: dayStr,
        hours: heatmapData[dayStr] ?? 0,
      });
      curr = new Date(curr.getTime() + 86400000);
    }
    return days;
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

  const isAllTime = period === "all";

  // range måste definieras FÖRE queries som använder den som queryKey
  const range = useMemo(() => {
    if (period === "all") {
      // Använd fast startdatum för att undvika cirkulär beroende (entries -> range -> entries)
      return { start: new Date("2020-01-01"), end: new Date(), label: "All tid (totalt)" };
    }
    if (period === "7") return { start: subDays(new Date(), 6), end: new Date(), label: "7 dagar" };
    if (period === "30")
      return { start: subDays(new Date(), 29), end: new Date(), label: "30 dagar" };
    if (period === "week") {
      const s = startOfWeek(new Date(), { weekStartsOn: 1 });
      const e = endOfWeek(new Date(), { weekStartsOn: 1 });
      return { start: s, end: e, label: "Denna vecka" };
    }
    if (period.startsWith("term:")) {
      const id = period.slice(5);
      const t = terms.find((x) => x.id === id);
      if (t)
        return { start: localDayStart(t.start_date), end: localDayEnd(t.end_date), label: termLabel(t) };
    }
    return { start: subDays(new Date(), 29), end: new Date(), label: "30 dagar" };
  }, [period, terms]);

  // Stabil sträng-nyckel för queries (undviker ny Date() på varje render)
  const rangeStartKey = isAllTime ? "all" : range.start.toISOString().slice(0, 10);
  const rangeEndKey = range.end.toISOString().slice(0, 10);

  const { data: sessionRows = [] } = useQuery({
    queryKey: ["stats", "sessions-rows", rangeStartKey, rangeEndKey],
    queryFn: async () => {
      let q = supabase
        .from("study_sessions")
        .select("id,course_id,planned_start,planned_end,actual_start,actual_end,completed")
        .eq("needs_review", false)
        .lte("planned_start", range.end.toISOString());

      if (!isAllTime) {
        q = q.gte("planned_start", range.start.toISOString());
      }

      const { data } = await q;
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

  // earliestDate beräknas ur faktisk data men används bara för display, inte för query-nycklar
  const earliestDateTimestamp = useMemo(() => {
    let minTime = Infinity;
    const now = Date.now();
    for (const s of sessionRows) {
      if (!isSessionDone(s, now)) continue;
      const t = sessionBounds(s).start.getTime();
      if (!isNaN(t) && t < minTime) minTime = t;
    }
    return minTime === Infinity ? subDays(new Date(), 30).getTime() : minTime;
  }, [sessionRows]);

  // Visa faktiskt startdatum i UI ("All tid sedan YYYY-MM-DD")
  const displayRangeStart = isAllTime && earliestDateTimestamp
    ? new Date(earliestDateTimestamp)
    : range.start;

  const { data: sessionTaskRows = [] } = useQuery({
    queryKey: ["stats", "session-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("study_session_tasks").select("session_id,task_id");
      return (data ?? []) as { session_id: string; task_id: string }[];
    },
  });

  const coursesMap = useMemo(
    () => new Map(allCourses.map((c) => [c.id, c])),
    [allCourses],
  );

  const filteredSessionRows = useMemo(
    () => sessionRows,
    [sessionRows],
  );

  const tasksBySession = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const st of sessionTaskRows) {
      const arr = m.get(st.session_id) ?? [];
      arr.push(st.task_id);
      m.set(st.session_id, arr);
    }
    return m;
  }, [sessionTaskRows]);

  // Endast genomförda studiepass (där slut-tid har passerats) räknas i statistiken.
  const derivedEntries: Entry[] = useMemo(() => {
    const out: Entry[] = [];
    const now = Date.now();
    for (const s of filteredSessionRows) {
      // Exkludera alla framtida/planerade pass som inte avslutats än!
      if (!isSessionDone(s, now)) continue;
      const start = sessionBounds(s).start.toISOString();
      const dur = sessionSeconds(s);
      const tids = tasksBySession.get(s.id) ?? [];
      if (tids.length === 0) {
        out.push({
          id: `sess:${s.id}`,
          started_at: start,
          duration_seconds: dur,
          course_id: s.course_id,
          task_id: null,
        });
      } else {
        const parts = splitSeconds(dur, tids.length);
        tids.forEach((task_id, i) => {
          out.push({
            id: `sess:${s.id}:${i}`,
            started_at: start,
            duration_seconds: parts[i],
            course_id: s.course_id,
            task_id,
          });
        });
      }
    }
    return out;
  }, [filteredSessionRows, tasksBySession]);

  const combined = useMemo(
    () => derivedEntries,
    [derivedEntries],
  );

  const { data: allTasks = [] } = useQuery(tasksQuery);
  const tasks = useMemo(() => {
    return allTasks;
  }, [allTasks]);

  const sessionsCount = useMemo(() => {
    const now = Date.now();
    return filteredSessionRows.filter((s) => isSessionDone(s, now)).length;
  }, [filteredSessionRows]);

  const totalDays = Math.max(1, differenceInCalendarDays(range.end, range.start) + 1);
  const days = useMemo(() => {
    const grouped = new Map<string, Map<string, number>>();

    for (const e of combined) {
      if (!e.course_id || !e.duration_seconds || !e.started_at) continue;
      const d = new Date(e.started_at);
      if (isNaN(d.getTime())) continue;
      const dayKey = format(d, "yyyy-MM-dd");
      if (!grouped.has(dayKey)) grouped.set(dayKey, new Map());
      const courseMap = grouped.get(dayKey)!;
      courseMap.set(e.course_id, (courseMap.get(e.course_id) ?? 0) + e.duration_seconds);
    }

    return Array.from({ length: totalDays }).map((_, i) => {
      const d = subDays(range.end, totalDays - 1 - i);
      const dayKey = format(d, "yyyy-MM-dd");
      const row: Record<string, number | string> = { day: format(d, "yyyy-MM-dd", { locale: sv }) };

      let total = 0;
      const courseMap = grouped.get(dayKey);

      for (const c of courses) {
        const seconds = courseMap?.get(c.id) ?? 0;
        const h = seconds / 3600;
        row[c.id] = +h.toFixed(2);
        total += h;
      }
      row.total = +total.toFixed(2);
      return row;
    });
  }, [totalDays, range.end, courses, combined]);

  // Pedagogisk tidslinje: bara kurser med tid i intervallet, grupperat per dag/vecka/månad.
  const courseTimeline = useMemo(() => {
    const unit: "day" | "week" | "month" =
      totalDays <= 31 ? "day" : totalDays <= 180 ? "week" : "month";
    const keyOf = (d: Date) =>
      unit === "day"
        ? format(d, "yyyy-MM-dd")
        : unit === "week"
          ? format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd")
          : format(d, "yyyy-MM");
    const labelOf = (d: Date) =>
      unit === "day"
        ? format(d, "d MMM", { locale: sv })
        : unit === "week"
          ? `v. ${format(d, "I")}`
          : format(d, "MMM yy", { locale: sv });

    const totals = new Map<string, number>();
    const grouped = new Map<string, Map<string, number>>();
    for (const e of combined) {
      if (!e.course_id || !e.duration_seconds || !e.started_at) continue;
      const d = new Date(e.started_at);
      if (isNaN(d.getTime())) continue;
      const k = keyOf(d);
      if (!grouped.has(k)) grouped.set(k, new Map());
      const m = grouped.get(k)!;
      m.set(e.course_id, (m.get(e.course_id) ?? 0) + e.duration_seconds);
      totals.set(e.course_id, (totals.get(e.course_id) ?? 0) + e.duration_seconds);
    }
    const active = courses
      .filter((c) => (totals.get(c.id) ?? 0) > 0)
      .sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0));

    const seen = new Set<string>();
    const rows: Record<string, number | string>[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = subDays(range.end, totalDays - 1 - i);
      const k = keyOf(d);
      if (seen.has(k)) continue;
      seen.add(k);
      const m = grouped.get(k);
      const row: Record<string, number | string> = { label: labelOf(d) };
      for (const c of active) row[c.id] = +(((m?.get(c.id) ?? 0) / 3600).toFixed(2));
      rows.push(row);
    }
    return { rows, active, totals, unit };
  }, [totalDays, range.end, courses, combined]);

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

  const tasksInPeriod = tasks.filter((t) => {
    if (period === "all") return true;
    if (!t.due_at) return false;
    const d = new Date(t.due_at);
    return d >= range.start && d <= range.end;
  });

  const statusCounts = {
    todo: tasksInPeriod.filter((t) => t.status === "todo").length,
    doing: tasksInPeriod.filter((t) => t.status === "doing").length,
    done: tasksInPeriod.filter((t) => t.status === "done").length,
  };
  const statusData = [
    { name: "Ej startad", value: statusCounts.todo, color: "#FF7A59" },
    { name: "Pågår", value: statusCounts.doing, color: "#FFB84D" },
    { name: "Klar", value: statusCounts.done, color: "#8B5CF6" },
  ];

  // --- Veckodag-fördelning ---
  const weekdayData = useMemo(() => {
    const labels = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
    const totals = [0, 0, 0, 0, 0, 0, 0];
    for (const e of combined) {
      if (!e.started_at || !e.duration_seconds) continue;
      const d = new Date(e.started_at);
      if (isNaN(d.getTime())) continue;
      let dow = d.getDay(); // 0=Sön
      dow = dow === 0 ? 6 : dow - 1; // 0=Mån, 6=Sön
      totals[dow] += e.duration_seconds / 3600;
    }
    return labels.map((name, i) => ({ name, timmar: +totals[i].toFixed(2) }));
  }, [combined]);

  // --- Klockslags-fördelning ---
  const hourData = useMemo(() => {
    const totals = Array.from({ length: 24 }, (_, h) => ({ hour: h, timmar: 0 }));
    for (const e of combined) {
      if (!e.started_at || !e.duration_seconds) continue;
      const d = new Date(e.started_at);
      if (isNaN(d.getTime())) continue;
      totals[d.getHours()].timmar += e.duration_seconds / 3600;
    }
    return totals.map((r) => ({ ...r, timmar: +r.timmar.toFixed(2), label: r.hour.toString().padStart(2, "0") }));
  }, [combined]);

  // --- Studiestreaks (från heatmapData – senaste 364 dagarna) ---
  const streaks = useMemo(() => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const hasStudyToday = (heatmapData[todayKey] ?? 0) > 0;

    // Nuvarande streak
    let currentStreak = 0;
    const cur = new Date();
    if (!hasStudyToday) cur.setDate(cur.getDate() - 1);
    while (true) {
      const key = format(cur, "yyyy-MM-dd");
      if ((heatmapData[key] ?? 0) > 0) {
        currentStreak++;
        cur.setDate(cur.getDate() - 1);
      } else {
        break;
      }
    }

    // Längsta streak
    const sortedKeys = Object.keys(heatmapData)
      .filter((k) => heatmapData[k] > 0)
      .sort();
    let longest = 0;
    let running = 0;
    let prevMs: number | null = null;
    for (const k of sortedKeys) {
      const ms = new Date(k).getTime();
      if (prevMs !== null && ms - prevMs === 86400000) {
        running++;
      } else {
        running = 1;
      }
      if (running > longest) longest = running;
      prevMs = ms;
    }

    return { current: currentStreak, longest };
  }, [heatmapData]);

  // --- Planerat vs Faktiskt per dag ---
  const goalVsActual = useMemo(() => {
    const grouped = new Map<string, { planned: number; actual: number }>();
    for (const s of filteredSessionRows) {
      if (!s.planned_start || !s.planned_end) continue;
      const d = new Date(s.planned_start);
      if (isNaN(d.getTime())) continue;
      const key = format(d, "yyyy-MM-dd");
      if (!grouped.has(key)) grouped.set(key, { planned: 0, actual: 0 });
      const entry = grouped.get(key)!;
      const planned = Math.max(0, (new Date(s.planned_end).getTime() - new Date(s.planned_start).getTime()) / 3600000);
      const isDone = isSessionDone(s);
      const actual =
        s.actual_start && s.actual_end
          ? Math.max(0, (new Date(s.actual_end).getTime() - new Date(s.actual_start).getTime()) / 3600000)
          : isDone
          ? planned
          : 0;
      entry.planned += planned;
      entry.actual += actual;
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, { planned, actual }]) => ({
        day: format(new Date(day), "yyyy-MM-dd", { locale: sv }),
        Planerat: +planned.toFixed(2),
        Faktiskt: +actual.toFixed(2),
      }));
  }, [filteredSessionRows]);

  // --- Slutförandegrad per kurs ---
  const courseCompletion = useMemo(() => {
    return courses
      .map((c) => {
        const courseTasks = tasks.filter((t) => t.course_id === c.id);
        const total = courseTasks.length;
        const done = courseTasks.filter((t) => t.status === "done").length;
        const hours = +(
          combined.filter((e) => e.course_id === c.id).reduce((s, e) => s + (e.duration_seconds ?? 0), 0) / 3600
        ).toFixed(1);
        return {
          name: c.name,
          color: c.color,
          done,
          total,
          pct: total > 0 ? Math.round((done / total) * 100) : 0,
          hours,
        };
      })
      .filter((c) => c.total > 0)
      .sort((a, b) => b.pct - a.pct);
  }, [courses, tasks, combined]);

  // --- Period-jämförelse (nuvarande vs föregående period, via heatmapData) ---
  const periodComparison = useMemo(() => {
    if (isAllTime) return null;
    const periodLen = Math.max(1, differenceInCalendarDays(range.end, range.start) + 1);
    const prevStart = subDays(range.start, periodLen);
    const prevEnd = subDays(range.start, 1);

    let currentHours = 0;
    let prevHours = 0;

    const cur = new Date(range.start);
    while (cur <= range.end) {
      currentHours += heatmapData[format(cur, "yyyy-MM-dd")] ?? 0;
      cur.setDate(cur.getDate() + 1);
    }
    const prev = new Date(prevStart);
    while (prev <= prevEnd) {
      prevHours += heatmapData[format(prev, "yyyy-MM-dd")] ?? 0;
      prev.setDate(prev.getDate() + 1);
    }

    const change = prevHours > 0 ? Math.round(((currentHours - prevHours) / prevHours) * 100) : null;
    return {
      current: +currentHours.toFixed(1),
      previous: +prevHours.toFixed(1),
      change,
      prevLabel: `${format(prevStart, "yyyy-MM-dd", { locale: sv })} – ${format(prevEnd, "yyyy-MM-dd", { locale: sv })}`,
    };
  }, [isAllTime, range, heatmapData]);

  // --- Högskolepoäng (HP) & Terminsstatistik (Antagna) ---
  const hpStats = useMemo(() => {
    let completedHp = 0;
    let ongoingHp = 0;
    let totalHp = 0;
    let completedCount = 0;
    let ongoingCount = 0;

    let programHp = 0;
    let programCompletedHp = 0;
    let programCount = 0;
    let standaloneHp = 0;
    let standaloneCompletedHp = 0;
    let standaloneCount = 0;

    let campusHp = 0;
    let campusCompletedHp = 0;
    let campusCount = 0;
    let distansHp = 0;
    let distansCompletedHp = 0;
    let distansCount = 0;

    let excludedCoursesCount = 0;

    type CourseItem = (typeof courses)[number];

    type PeriodStat = {
      period: "P1" | "P2" | "P3" | "P4" | "P5";
      name: string;
      termKey: "HT" | "VT" | "ST";
      completedHp: number;
      ongoingHp: number;
      totalHp: number;
      courses: Array<{ course: CourseItem; hpInPeriod: number }>;
    };

    type TermStat = {
      key: "HT" | "VT" | "ST";
      name: string;
      shortName: string;
      color: string;
      completedHp: number;
      ongoingHp: number;
      totalHp: number;
      periods: PeriodStat[];
    };

    type YearStat = {
      arskurs: number;
      label: string;
      completedHp: number;
      ongoingHp: number;
      totalHp: number;
      terms: TermStat[];
    };

    const createDefaultTerms = (): TermStat[] => [
      {
        key: "HT",
        name: "Hösttermin",
        shortName: "Höst",
        color: "text-amber-400",
        completedHp: 0,
        ongoingHp: 0,
        totalHp: 0,
        periods: [
          { period: "P1", name: "P1", termKey: "HT", completedHp: 0, ongoingHp: 0, totalHp: 0, courses: [] },
          { period: "P2", name: "P2", termKey: "HT", completedHp: 0, ongoingHp: 0, totalHp: 0, courses: [] },
        ],
      },
      {
        key: "VT",
        name: "Vårtermin",
        shortName: "Vår",
        color: "text-sky-400",
        completedHp: 0,
        ongoingHp: 0,
        totalHp: 0,
        periods: [
          { period: "P3", name: "P3", termKey: "VT", completedHp: 0, ongoingHp: 0, totalHp: 0, courses: [] },
          { period: "P4", name: "P4", termKey: "VT", completedHp: 0, ongoingHp: 0, totalHp: 0, courses: [] },
        ],
      },
      {
        key: "ST",
        name: "Sommartermin",
        shortName: "Sommar",
        color: "text-emerald-400",
        completedHp: 0,
        ongoingHp: 0,
        totalHp: 0,
        periods: [
          { period: "P5", name: "P5", termKey: "ST", completedHp: 0, ongoingHp: 0, totalHp: 0, courses: [] },
        ],
      },
    ];

    const validPeriodKeys = ["P1", "P2", "P3", "P4", "P5"] as const;
    const yearsMap = new Map<number, YearStat>();
    const windows = periodWindows(terms);

    // HP Antagen baseras på samtliga kurser (allCourses) och deras antagningsomgångar.
    // HP antagen blandas inte ihop med rapporteringsmoment.
    for (const c of allCourses) {
      const isInactive = Boolean(c.archived);
      const courseHp = c.hp ?? 0;
      const courseEnrollments = enrollmentsForCourse(c, allEnrollments);

      // En kurs ingår i HP - Antagen om och endast om den har minst en omgång
      // där BÅDE årskurs och period(er) är valda
      const validEnrollments = courseEnrollments.filter((enr) => {
        const hasArskurs = enr.arskurs != null && Number(enr.arskurs) > 0;
        const validPs = (enr.periods ?? []).filter((p) =>
          validPeriodKeys.includes(p as any)
        );
        return hasArskurs && validPs.length > 0;
      });

      if (validEnrollments.length === 0) {
        excludedCoursesCount++;
        continue;
      }

      totalHp += courseHp;
      if (c.completed) {
        completedHp += courseHp;
        completedCount++;
      } else if (!isInactive) {
        ongoingHp += courseHp;
        ongoingCount++;
      }

      if (c.is_standalone) {
        standaloneHp += courseHp;
        standaloneCount++;
        if (c.completed) standaloneCompletedHp += courseHp;
      } else {
        programHp += courseHp;
        programCount++;
        if (c.completed) programCompletedHp += courseHp;
      }

      if (c.mode === "distans") {
        distansHp += courseHp;
        distansCount++;
        if (c.completed) distansCompletedHp += courseHp;
      } else {
        campusHp += courseHp;
        campusCount++;
        if (c.completed) campusCompletedHp += courseHp;
      }

      for (const enr of validEnrollments) {
        const arskurs = Number(enr.arskurs);
        if (!yearsMap.has(arskurs)) {
          yearsMap.set(arskurs, {
            arskurs,
            label: `Årskurs ${arskurs}`,
            completedHp: 0,
            ongoingHp: 0,
            totalHp: 0,
            terms: createDefaultTerms(),
          });
        }
        const yearObj = yearsMap.get(arskurs)!;

        const validPs = (enr.periods ?? []).filter((p): p is CoursePeriod =>
          validPeriodKeys.includes(p as any)
        );
        if (validPs.length === 0) continue;

        // För varje antagningsomgång delas kursens HP lika över omgångens valda läsperioder
        const hpPerPeriod = courseHp / validPs.length;

        for (const p of validPs) {
          const termKey = PERIOD_TO_TERM[p] as "HT" | "VT" | "ST";
          const termObj = yearObj.terms.find((t) => t.key === termKey);
          if (!termObj) continue;
          const periodObj = termObj.periods.find((item) => item.period === p);
          if (!periodObj) continue;

          periodObj.totalHp += hpPerPeriod;
          termObj.totalHp += hpPerPeriod;
          yearObj.totalHp += hpPerPeriod;

          if (c.completed) {
            periodObj.completedHp += hpPerPeriod;
            termObj.completedHp += hpPerPeriod;
            yearObj.completedHp += hpPerPeriod;
          } else if (!isInactive) {
            periodObj.ongoingHp += hpPerPeriod;
            termObj.ongoingHp += hpPerPeriod;
            yearObj.ongoingHp += hpPerPeriod;
          }

          const existingCourseInPeriod = periodObj.courses.find((item) => item.course.id === c.id);
          if (existingCourseInPeriod) {
            existingCourseInPeriod.hpInPeriod = +(existingCourseInPeriod.hpInPeriod + hpPerPeriod).toFixed(1);
          } else {
            periodObj.courses.push({ course: c, hpInPeriod: +hpPerPeriod.toFixed(1) });
          }
        }
      }
    }

    const yearStatsList = Array.from(yearsMap.values())
      .sort((a, b) => a.arskurs - b.arskurs)
      .map((y) => ({
        ...y,
        completedHp: +y.completedHp.toFixed(1),
        ongoingHp: +y.ongoingHp.toFixed(1),
        totalHp: +y.totalHp.toFixed(1),
        terms: y.terms.map((t) => ({
          ...t,
          completedHp: +t.completedHp.toFixed(1),
          ongoingHp: +t.ongoingHp.toFixed(1),
          totalHp: +t.totalHp.toFixed(1),
          periods: t.periods.map((p) => ({
            ...p,
            completedHp: +p.completedHp.toFixed(1),
            ongoingHp: +p.ongoingHp.toFixed(1),
            totalHp: +p.totalHp.toFixed(1),
          })),
        })),
      }));

    const chartPeriodData = yearStatsList.flatMap((y) =>
      y.terms.flatMap((t) =>
        t.periods.map((p) => ({
          period: p.period,
          label: `År ${y.arskurs} ${p.period}`,
          "Avklarade HP": p.completedHp,
          "Pågående HP": p.ongoingHp,
          totalHp: p.totalHp,
        }))
      )
    );

    const pctCompleted = totalHp > 0 ? Math.round((completedHp / totalHp) * 100) : 0;

    return {
      completedHp: +completedHp.toFixed(1),
      ongoingHp: +ongoingHp.toFixed(1),
      totalHp: +totalHp.toFixed(1),
      completedCount,
      ongoingCount,
      pctCompleted,
      programHp: +programHp.toFixed(1),
      programCompletedHp: +programCompletedHp.toFixed(1),
      programCount,
      standaloneHp: +standaloneHp.toFixed(1),
      standaloneCompletedHp: +standaloneCompletedHp.toFixed(1),
      standaloneCount,
      campusHp: +campusHp.toFixed(1),
      campusCompletedHp: +campusCompletedHp.toFixed(1),
      campusCount,
      distansHp: +distansHp.toFixed(1),
      distansCompletedHp: +distansCompletedHp.toFixed(1),
      distansCount,
      excludedCoursesCount,
      yearStats: yearStatsList,
      chartPeriodData,
    };
  }, [allCourses, allEnrollments, terms]);

  // --- Högskolepoäng (HP) Registrerade statistik ---
  const registeredStats = useMemo(() => {
    // Registrerade kurser = alla kurser inkl. inaktiva (archived), de ska alltid visas i statistiken
    const registeredCourses = courses;

    let completedHp = 0;
    let ongoingHp = 0;
    let totalHp = 0;
    let completedCount = 0;
    let ongoingCount = 0;

    let programHp = 0;
    let programCompletedHp = 0;
    let programCount = 0;
    let standaloneHp = 0;
    let standaloneCompletedHp = 0;
    let standaloneCount = 0;

    let campusHp = 0;
    let campusCompletedHp = 0;
    let campusCount = 0;
    let distansHp = 0;
    let distansCompletedHp = 0;
    let distansCount = 0;

    for (const c of registeredCourses) {
      const courseHp = c.hp ?? 0;
      totalHp += courseHp;
      if (c.completed) {
        completedHp += courseHp;
        completedCount++;
      } else {
        ongoingHp += courseHp;
        ongoingCount++;
      }

      if (c.is_standalone) {
        standaloneHp += courseHp;
        standaloneCount++;
        if (c.completed) standaloneCompletedHp += courseHp;
      } else {
        programHp += courseHp;
        programCount++;
        if (c.completed) programCompletedHp += courseHp;
      }

      if (c.mode === "distans") {
        distansHp += courseHp;
        distansCount++;
        if (c.completed) distansCompletedHp += courseHp;
      } else {
        campusHp += courseHp;
        campusCount++;
        if (c.completed) campusCompletedHp += courseHp;
      }
    }

    const pctCompleted = totalHp > 0 ? Math.round((completedHp / totalHp) * 100) : 0;

    return {
      completedHp: +completedHp.toFixed(1),
      ongoingHp: +ongoingHp.toFixed(1),
      totalHp: +totalHp.toFixed(1),
      completedCount,
      ongoingCount,
      pctCompleted,
      programHp: +programHp.toFixed(1),
      programCompletedHp: +programCompletedHp.toFixed(1),
      programCount,
      standaloneHp: +standaloneHp.toFixed(1),
      standaloneCompletedHp: +standaloneCompletedHp.toFixed(1),
      standaloneCount,
      campusHp: +campusHp.toFixed(1),
      campusCompletedHp: +campusCompletedHp.toFixed(1),
      campusCount,
      distansHp: +distansHp.toFixed(1),
      distansCompletedHp: +distansCompletedHp.toFixed(1),
      distansCount,
      registeredCourses,
    };
  }, [courses]);

  // --- Registrerade HP per Årskurs & Termin (ENDAST rapporteringsmoment) ---
  const registeredHpStats = useMemo(() => {
    type RegisteredModuleItem = {
      id: string;
      moduleName: string;
      courseName: string;
      courseCode: string | null;
      courseColor: string;
      hp: number;
      grade: string | null;
      points: string | null;
      registeredOn: string;
      isStandalone: boolean;
      mode: "campus" | "distans";
      isLateReporting: boolean;
      isArchived: boolean;
      universityId: string | null;
      universityName: string;
    };

    type UniversityHpStat = {
      id: string | null;
      name: string;
      totalHp: number;
      moduleCount: number;
      courseCount: number;
      percentageOfTotal: number;
    };

    type RegTermStat = {
      key: "HT" | "VT" | "ST";
      name: string;
      color: string;
      totalHp: number;
      programHp: number;
      programCount: number;
      standaloneHp: number;
      standaloneCount: number;
      campusHp: number;
      campusCount: number;
      distansHp: number;
      distansCount: number;
      modules: RegisteredModuleItem[];
    };

    type RegYearStat = {
      arskurs: number;
      label: string;
      totalHp: number;
      programHp: number;
      programCount: number;
      standaloneHp: number;
      standaloneCount: number;
      campusHp: number;
      campusCount: number;
      distansHp: number;
      distansCount: number;
      terms: RegTermStat[];
    };

    const windows = periodWindows(terms);
    const toArskurs = makeArskursMapper(windows, [
      ...allEnrollments.map((e) => e.arskurs),
      ...allCourses.map((c) => c.arskurs),
    ]);

    const courseById = new Map(allCourses.map((c) => [c.id, c]));
    const uniMap = new Map(universities.map((u) => [u.id, u.name]));
    const uniStatsMap = new Map<string, {
      id: string | null;
      name: string;
      totalHp: number;
      moduleCount: number;
      courseIds: Set<string>;
    }>();
    const yearsMap = new Map<number, RegYearStat>();

    const createDefaultTerms = (): RegTermStat[] => [
      {
        key: "HT",
        name: "Hösttermin",
        color: "text-amber-400",
        totalHp: 0,
        programHp: 0,
        programCount: 0,
        standaloneHp: 0,
        standaloneCount: 0,
        campusHp: 0,
        campusCount: 0,
        distansHp: 0,
        distansCount: 0,
        modules: [],
      },
      {
        key: "VT",
        name: "Vårtermin",
        color: "text-sky-400",
        totalHp: 0,
        programHp: 0,
        programCount: 0,
        standaloneHp: 0,
        standaloneCount: 0,
        campusHp: 0,
        campusCount: 0,
        distansHp: 0,
        distansCount: 0,
        modules: [],
      },
      {
        key: "ST",
        name: "Sommartermin",
        color: "text-emerald-400",
        totalHp: 0,
        programHp: 0,
        programCount: 0,
        standaloneHp: 0,
        standaloneCount: 0,
        campusHp: 0,
        campusCount: 0,
        distansHp: 0,
        distansCount: 0,
        modules: [],
      },
    ];

    let grandTotalHp = 0;
    let grandModuleCount = 0;

    let programModulesCount = 0;
    let programModulesHp = 0;
    let standaloneModulesCount = 0;
    let standaloneModulesHp = 0;

    let campusModulesCount = 0;
    let campusModulesHp = 0;
    let distansModulesCount = 0;
    let distansModulesHp = 0;

    // Bygg ett set av kurs-IDs som har minst en giltig antagningsomgång (arskurs + period)
    const validPeriodKeysSet = new Set(["P1", "P2", "P3", "P4", "P5"]);
    const validCourseIds = new Set<string>();
    for (const c of allCourses) {
      const enrs = enrollmentsForCourse(c, allEnrollments);
      const hasValid = enrs.some(
        (e) =>
          e.arskurs != null &&
          Number(e.arskurs) > 0 &&
          (e.periods ?? []).some((p) => validPeriodKeysSet.has(p)),
      );
      if (hasValid) validCourseIds.add(c.id);
    }

    // Beräkna antal moduler totalt vs avklarade per kurs (endast kurser med giltig enrollment)
    const courseModuleTotals = new Map<string, { total: number; done: number }>();
    for (const m of allModules) {
      if (!validCourseIds.has(m.course_id)) continue;
      const entry = courseModuleTotals.get(m.course_id) ?? { total: 0, done: 0 };
      entry.total++;
      if (isModuleDone(m)) entry.done++;
      courseModuleTotals.set(m.course_id, entry);
    }
    // Kurser med ≥1 avklarat moment
    const coursesWithAnyDone = Array.from(courseModuleTotals.values()).filter((v) => v.done >= 1).length;
    // Kurser där inte alla moment är avklarade (dvs. något kvarstår)
    const coursesWithIncomplete = Array.from(courseModuleTotals.values()).filter(
      (v) => v.total > 0 && v.done < v.total,
    ).length;

    // Processera ENDAST course_reporting_modules (klarmarkerade eller med betyg/datum/poäng)
    // och ENDAST för kurser med giltig antagningsomgång
    for (const m of allModules) {
      const isDone = isModuleDone(m);
      if (!isDone) continue;
      if (!validCourseIds.has(m.course_id)) continue;
      const course = courseById.get(m.course_id);
      if (!course) continue;

      const hp = Number(m.hp) || 0;
      const regDate = m.registered_on ? m.registered_on.slice(0, 10) : null;
      const win = resolvePeriod(m.registered_on, windows);

      let termKey: "HT" | "VT" | "ST" = "HT";
      if (win) {
        termKey = PERIOD_TO_TERM[win.period] as "HT" | "VT" | "ST";
      } else if (regDate) {
        const month = parseInt(regDate.split("-")[1], 10);
        if (month >= 1 && month <= 5) termKey = "VT";
        else if (month >= 6 && month <= 8) termKey = "ST";
        else termKey = "HT";
      } else {
        // Fallback när datum saknas: använd kursens schemalagda perioder
        const enrs = enrollmentsForCourse(course, allEnrollments);
        const periods = enrs.flatMap((e) =>
          e.periods && e.periods.length > 0
            ? e.periods
            : course.periods ?? (course.period ? [course.period] : []),
        );
        if (periods.some((p) => p === "P3" || p === "P4")) {
          termKey = "VT";
        } else if (periods.some((p) => p === "P5")) {
          termKey = "ST";
        } else {
          termKey = "HT";
        }
      }

      let arskurs: number | null = null;
      if (win) {
        arskurs = toArskurs(win.academicYear);
      } else if (regDate) {
        arskurs = getArskursFromDate(regDate);
      }

      if (arskurs == null || arskurs <= 0) {
        const enrs = enrollmentsForCourse(course, allEnrollments);
        arskurs = enrs.find((e) => e.arskurs != null && e.arskurs > 0)?.arskurs ?? course.arskurs ?? 1;
      }

      if (!yearsMap.has(arskurs)) {
        yearsMap.set(arskurs, {
          arskurs,
          label: `Årskurs ${arskurs}`,
          totalHp: 0,
          programHp: 0,
          programCount: 0,
          standaloneHp: 0,
          standaloneCount: 0,
          campusHp: 0,
          campusCount: 0,
          distansHp: 0,
          distansCount: 0,
          terms: createDefaultTerms(),
        });
      }

      const yearObj = yearsMap.get(arskurs)!;
      const termObj = yearObj.terms.find((t) => t.key === termKey)!;

      if (course.is_standalone) {
        standaloneModulesCount++;
        standaloneModulesHp += hp;
        termObj.standaloneHp += hp;
        termObj.standaloneCount++;
        yearObj.standaloneHp += hp;
        yearObj.standaloneCount++;
      } else {
        programModulesCount++;
        programModulesHp += hp;
        termObj.programHp += hp;
        termObj.programCount++;
        yearObj.programHp += hp;
        yearObj.programCount++;
      }

      if (course.mode === "distans") {
        distansModulesCount++;
        distansModulesHp += hp;
        termObj.distansHp += hp;
        termObj.distansCount++;
        yearObj.distansHp += hp;
        yearObj.distansCount++;
      } else {
        campusModulesCount++;
        campusModulesHp += hp;
        termObj.campusHp += hp;
        termObj.campusCount++;
        yearObj.campusHp += hp;
        yearObj.campusCount++;
      }

      // Avgör om momentet är "Sen rapportering" (rapporterat i en termin/årskurs när kursen inte läses)
      const courseEnrs = enrollmentsForCourse(course, allEnrollments);
      const courseTermsSet = new Set<"HT" | "VT" | "ST">();
      const scheduledSlots: Array<{ arskurs: number | null; term: "HT" | "VT" | "ST" }> = [];

      for (const e of courseEnrs) {
        const periods =
          e.periods && e.periods.length > 0
            ? e.periods
            : course.periods ?? (course.period ? [course.period] : []);
        for (const p of periods) {
          if (p === "helar") {
            courseTermsSet.add("HT");
            courseTermsSet.add("VT");
            courseTermsSet.add("ST");
            scheduledSlots.push({ arskurs: e.arskurs, term: "HT" });
            scheduledSlots.push({ arskurs: e.arskurs, term: "VT" });
            scheduledSlots.push({ arskurs: e.arskurs, term: "ST" });
          } else {
            const t = PERIOD_TO_TERM[p as CoursePeriod];
            if (t) {
              courseTermsSet.add(t);
              scheduledSlots.push({ arskurs: e.arskurs, term: t });
            }
          }
        }
      }

      let isLateReporting = false;
      // Kontrollera endast sen rapportering om ett faktiskt datum finns
      if (regDate && courseTermsSet.size > 0) {
        if (!courseTermsSet.has(termKey)) {
          isLateReporting = true;
        } else {
          const hasExactMatch = scheduledSlots.some(
            (slot) => (slot.arskurs == null || slot.arskurs === arskurs) && slot.term === termKey,
          );
          if (!hasExactMatch) {
            const termOrder = { HT: 1, VT: 2, ST: 3 };
            const latestScheduled = scheduledSlots.reduce((max, slot) => {
              const slotYr = slot.arskurs ?? 1;
              const maxYr = max.arskurs ?? 1;
              if (slotYr > maxYr) return slot;
              if (slotYr === maxYr && termOrder[slot.term] > termOrder[max.term]) return slot;
              return max;
            }, scheduledSlots[0]);

            if (latestScheduled) {
              const latestYr = latestScheduled.arskurs ?? 1;
              if (
                arskurs > latestYr ||
                (arskurs === latestYr && termOrder[termKey] > termOrder[latestScheduled.term])
              ) {
                isLateReporting = true;
              }
            }
          }
        }
      }

      const uniId = course.university_id ?? null;
      const uniName = uniId ? (uniMap.get(uniId) ?? "Okänt lärosäte") : "Inget lärosäte angivet";
      const uniKey = uniId ?? "none";

      if (!uniStatsMap.has(uniKey)) {
        uniStatsMap.set(uniKey, {
          id: uniId,
          name: uniName,
          totalHp: 0,
          moduleCount: 0,
          courseIds: new Set<string>(),
        });
      }
      const uStat = uniStatsMap.get(uniKey)!;
      uStat.totalHp += hp;
      uStat.moduleCount += 1;
      uStat.courseIds.add(course.id);

      const item: RegisteredModuleItem = {
        id: m.id,
        moduleName: m.name,
        courseName: course.name,
        courseCode: course.code,
        courseColor: course.color ?? "#3b82f6",
        hp,
        grade: m.grade,
        points: m.points,
        registeredOn: regDate ? formatDateYYYYMMDD(regDate) : "Saknar datum",
        isStandalone: Boolean(course.is_standalone),
        mode: course.mode === "distans" ? "distans" : "campus",
        isLateReporting,
        isArchived: Boolean(course.archived),
        universityId: uniId,
        universityName: uniName,
      };

      termObj.totalHp += hp;
      yearObj.totalHp += hp;
      grandTotalHp += hp;
      grandModuleCount++;

      termObj.modules.push(item);
    }

    const universitiesStats: UniversityHpStat[] = Array.from(uniStatsMap.values())
      .map((u) => ({
        id: u.id,
        name: u.name,
        totalHp: +u.totalHp.toFixed(1),
        moduleCount: u.moduleCount,
        courseCount: u.courseIds.size,
        percentageOfTotal: grandTotalHp > 0 ? Math.round((u.totalHp / grandTotalHp) * 100) : 0,
      }))
      .sort((a, b) => b.totalHp - a.totalHp);

    const yearStatsList = Array.from(yearsMap.values())
      .sort((a, b) => a.arskurs - b.arskurs)
      .map((y) => ({
        ...y,
        totalHp: +y.totalHp.toFixed(1),
        programHp: +y.programHp.toFixed(1),
        standaloneHp: +y.standaloneHp.toFixed(1),
        campusHp: +y.campusHp.toFixed(1),
        distansHp: +y.distansHp.toFixed(1),
        terms: y.terms.map((t) => ({
          ...t,
          totalHp: +t.totalHp.toFixed(1),
          programHp: +t.programHp.toFixed(1),
          standaloneHp: +t.standaloneHp.toFixed(1),
          campusHp: +t.campusHp.toFixed(1),
          distansHp: +t.distansHp.toFixed(1),
          modules: t.modules.sort((a, b) => a.registeredOn.localeCompare(b.registeredOn)),
        })),
      }));

    return {
      grandTotalHp: +grandTotalHp.toFixed(1),
      grandModuleCount,
      coursesWithAnyDone,
      coursesWithIncomplete,
      programModulesCount,
      programModulesHp: +programModulesHp.toFixed(1),
      standaloneModulesCount,
      standaloneModulesHp: +standaloneModulesHp.toFixed(1),
      campusModulesCount,
      campusModulesHp: +campusModulesHp.toFixed(1),
      distansModulesCount,
      distansModulesHp: +distansModulesHp.toFixed(1),
      universitiesStats,
      yearStats: yearStatsList,
    };
  }, [allModules, allCourses, terms, allEnrollments, universities]);

  const displayedYearStats = useMemo(() => {
    if (selectedUniFilter === "all") return registeredHpStats.yearStats;
    return registeredHpStats.yearStats
      .map((y) => {
        const terms = y.terms.map((t) => {
          const filteredModules = t.modules.filter((m) =>
            selectedUniFilter === "none"
              ? !m.universityId
              : m.universityId === selectedUniFilter
          );
          const termHp = +filteredModules.reduce((s, m) => s + m.hp, 0).toFixed(1);
          const programHp = +filteredModules.filter((m) => !m.isStandalone).reduce((s, m) => s + m.hp, 0).toFixed(1);
          const standaloneHp = +filteredModules.filter((m) => m.isStandalone).reduce((s, m) => s + m.hp, 0).toFixed(1);
          const campusHp = +filteredModules.filter((m) => m.mode === "campus").reduce((s, m) => s + m.hp, 0).toFixed(1);
          const distansHp = +filteredModules.filter((m) => m.mode === "distans").reduce((s, m) => s + m.hp, 0).toFixed(1);

          return {
            ...t,
            totalHp: termHp,
            programHp,
            standaloneHp,
            campusHp,
            distansHp,
            modules: filteredModules,
          };
        });
        const totalHp = +terms.reduce((s, t) => s + t.totalHp, 0).toFixed(1);
        const programHp = +terms.reduce((s, t) => s + t.programHp, 0).toFixed(1);
        const standaloneHp = +terms.reduce((s, t) => s + t.standaloneHp, 0).toFixed(1);
        const campusHp = +terms.reduce((s, t) => s + t.campusHp, 0).toFixed(1);
        const distansHp = +terms.reduce((s, t) => s + t.distansHp, 0).toFixed(1);

        return {
          ...y,
          totalHp,
          programHp,
          standaloneHp,
          campusHp,
          distansHp,
          terms,
        };
      })
      .filter((y) => y.terms.some((t) => t.modules.length > 0));
  }, [registeredHpStats.yearStats, selectedUniFilter]);

  // --- CSN-statistik per CSN-period (baserat på registrerade moment och studiekrav) ---
  const csnStats = useMemo(() => {
    const courseById = new Map(allCourses.map((c) => [c.id, c]));

    const periodResults: CsnPeriodProgress[] = csnPeriods.map((period) => {
      const status = getCsnPeriodStatus(period);
      const metrics = calculateCsnMetrics(period.weeks, period.requirementPercent ?? 75);
      const pStart = period.startDate ? period.startDate.slice(0, 10) : "";
      const pEnd = period.endDate ? period.endDate.slice(0, 10) : "";

      const matchingModules: RegisteredModuleForCsn[] = [];
      let periodRegisteredHp = 0;

      for (const m of allModules) {
        const isDone = isModuleDone(m);
        if (!isDone) continue;

        const regDate = m.registered_on ? m.registered_on.slice(0, 10) : null;
        if (!regDate) continue;

        if (pStart && regDate < pStart) continue;
        if (pEnd && regDate > pEnd) continue;

        const course = courseById.get(m.course_id);
        const hp = Number(m.hp) || 0;
        periodRegisteredHp += hp;

        matchingModules.push({
          id: m.id,
          moduleName: m.name,
          courseName: course?.name ?? "Okänd kurs",
          courseCode: course?.code ?? null,
          courseColor: course?.color ?? "#3b82f6",
          hp,
          grade: m.grade,
          points: m.points,
          registeredOn: formatDateYYYYMMDD(regDate),
          isArchived: Boolean(course?.archived),
        });
      }

      // Sortera moment kronologiskt
      matchingModules.sort((a, b) => b.registeredOn.localeCompare(a.registeredOn));

      const registeredHp = +periodRegisteredHp.toFixed(1);
      const requiredHp = metrics.requiredHp;
      const totalHp = metrics.totalHp;
      const remainingHp = Math.max(0, +(requiredHp - registeredHp).toFixed(1));
      const surplusHp = Math.max(0, +(registeredHp - requiredHp).toFixed(1));
      const isFulfilled = registeredHp >= requiredHp;
      const requirementPercentReached =
        requiredHp > 0 ? Math.round((registeredHp / requiredHp) * 100) : 0;
      const totalPercentReached =
        totalHp > 0 ? Math.round((registeredHp / totalHp) * 100) : 0;

      return {
        period,
        status,
        weeks: period.weeks,
        requirementPercent: metrics.requirementPercent,
        totalHp,
        requiredHp,
        exactRequiredHp: metrics.exactRequiredHp,
        registeredHp,
        remainingHp,
        surplusHp,
        requirementPercentReached,
        totalPercentReached,
        isFulfilled,
        modules: matchingModules,
      };
    });

    // Aktiv period eller första
    const activePeriod =
      periodResults.find((p) => p.status === "active") ??
      periodResults[0] ??
      null;

    const grandTotalRegisteredHp = +periodResults
      .reduce((sum, p) => sum + p.registeredHp, 0)
      .toFixed(1);
    const grandTotalRequiredHp = +periodResults
      .reduce((sum, p) => sum + p.requiredHp, 0)
      .toFixed(1);
    const grandTotalCsnHp = +periodResults
      .reduce((sum, p) => sum + p.totalHp, 0)
      .toFixed(1);
    const grandTotalWeeks = periodResults.reduce((sum, p) => sum + p.weeks, 0);

    return {
      periods: periodResults,
      activePeriod,
      grandTotalRegisteredHp,
      grandTotalRequiredHp,
      grandTotalCsnHp,
      grandTotalWeeks,
    };
  }, [csnPeriods, allModules, allCourses]);

  // --- Betygsstatistik ---
  const gradeStats = useMemo(() => {
    const gradedCourses = courses.filter((c) => c.final_grade && c.final_grade.trim() !== "");

    const gradeCounts: Record<string, { count: number; totalHp: number }> = {};
    let weightedGradeSum = 0;
    let totalGradeHp = 0;

    const parseGradeNumeric = (g: string): number | null => {
      const trimmed = g.trim().toUpperCase();
      if (trimmed === "5" || trimmed === "A") return 5.0;
      if (trimmed === "4" || trimmed === "B") return 4.0;
      if (trimmed === "3" || trimmed === "C") return 3.0;
      if (trimmed === "D") return 2.0;
      if (trimmed === "E") return 1.0;
      const num = parseFloat(trimmed);
      return isNaN(num) ? null : num;
    };

    for (const c of gradedCourses) {
      const g = c.final_grade!.trim().toUpperCase();
      const hp = c.hp ?? 0;

      if (!gradeCounts[g]) {
        gradeCounts[g] = { count: 0, totalHp: 0 };
      }
      gradeCounts[g].count++;
      gradeCounts[g].totalHp += hp;

      const numVal = parseGradeNumeric(g);
      if (numVal !== null && hp > 0) {
        weightedGradeSum += numVal * hp;
        totalGradeHp += hp;
      }
    }

    const weightedAverage = totalGradeHp > 0 ? +(weightedGradeSum / totalGradeHp).toFixed(2) : null;
    const simpleAverage = (() => {
      const numGrades = gradedCourses
        .map((c) => parseGradeNumeric(c.final_grade!))
        .filter((val): val is number => val !== null);
      if (numGrades.length === 0) return null;
      return +(numGrades.reduce((a, b) => a + b, 0) / numGrades.length).toFixed(2);
    })();

    const gradeDistributionData = Object.entries(gradeCounts)
      .map(([grade, data]) => ({
        grade,
        Antal: data.count,
        HP: data.totalHp,
      }))
      .sort((a, b) => b.Antal - a.Antal);

    const gradedTasks = tasks.filter(
      (t) => hasEnteredValue(t.grade) || hasEnteredValue(t.points),
    );

    return {
      gradedCourses,
      gradedTasks,
      totalGradedCourses: gradedCourses.length,
      weightedAverage,
      simpleAverage,
      gradeDistributionData,
    };
  }, [courses, tasks]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Statistik</h1>
            {activeTab === "time" && <p className="text-sm text-muted-foreground">{range.label}</p>}
          </div>
          {activeTab === "time" && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/60 px-3 py-1.5 shadow-sm">
                <Switch
                  id="include-archived"
                  checked={includeArchived}
                  onCheckedChange={setIncludeArchived}
                />
                <Label
                  htmlFor="include-archived"
                  className="cursor-pointer text-xs font-medium text-muted-foreground"
                >
                  Inkludera arkiverade
                </Label>
              </div>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[14rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tid (totalt)</SelectItem>
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
          )}
        </div>

        <TabsList className="mb-6 inline-flex h-auto justify-start gap-1 p-1">
          <TabsTrigger value="time" className="gap-2 justify-start text-left">
            <Clock className="h-4 w-4" /> Studietid
          </TabsTrigger>
          <TabsTrigger value="hp" className="gap-2 justify-start text-left">
            <GraduationCap className="h-4 w-4" /> Högskolepoäng
          </TabsTrigger>
          <TabsTrigger value="betyg" className="gap-2 justify-start text-left">
            <Award className="h-4 w-4" /> Betyg
          </TabsTrigger>
        </TabsList>

        <TabsContent value="time" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-border/60 bg-surface/60">
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Clock className="h-4 w-4 text-primary" /> Total tid
            </div>
            <div className="font-display text-3xl font-bold tabular-nums">
              {formatHoursCompact(totalSec)}
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-border/60 bg-surface/60">
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-sunset-orange" /> Snitt per dag
            </div>
            <div className="font-display text-3xl font-bold tabular-nums">
              {formatHoursCompact(avgPerDay)}
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-border/60 bg-surface/60">
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Target className="h-4 w-4 text-emerald-500" /> Studiepass
            </div>
            <div className="font-display text-3xl font-bold tabular-nums">{sessionsCount}</div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-border/60 bg-surface/60">
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-purple-500" /> Klara uppgifter
            </div>
            <div className="font-display text-3xl font-bold tabular-nums">{statusCounts.done}</div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Med deadline {range.label.toLowerCase()}
            </p>
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
                      key={day.dateStr}
                      className={cn(
                        "w-[10px] h-[10px] rounded-[1.5px] transition-all cursor-pointer",
                        colorClass,
                      )}
                      title={`${format(day.date, "yyyy-MM-dd", { locale: sv })}: ${day.hours.toFixed(2)} h`}
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
                <AreaChart data={days}>
                  <defs>
                    {courses.map((c) => (
                      <linearGradient key={c.id} id={`color-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={c.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
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
                    formatter={(v: any) => [`${v} h`, ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {courses.map((c) => (
                    <Area
                      key={c.id}
                      type="monotone"
                      dataKey={c.id}
                      name={c.name}
                      stroke={c.color}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill={`url(#color-${c.id})`}
                      dot={false}
                    />
                  ))}
                </AreaChart>
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
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={4}
                      stroke="none"
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
                      formatter={(v: any, n: any) => [`${v} h`, n]}
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
                <div
                  key={t.id}
                  className="group relative rounded-xl border border-border/40 bg-surface-2/30 p-2 transition-colors hover:bg-surface-2/60"
                >
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: t.color }}
                      />
                      <span className="truncate font-medium">{t.title}</span>
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {t.hours}h
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-in-out"
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

      {/* ── Streaks & Period-jämförelse ── */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Nuvarande streak */}
        <Card className="relative overflow-hidden border-border/60 bg-surface/60">
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Flame className="h-4 w-4 text-orange-400" /> Nuvarande streak
            </div>
            <div className="font-display text-3xl font-bold tabular-nums">{streaks.current}</div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {streaks.current === 1 ? "dag i rad" : "dagar i rad"}
            </p>
          </CardContent>
        </Card>

        {/* Längsta streak */}
        <Card className="relative overflow-hidden border-border/60 bg-surface/60">
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Zap className="h-4 w-4 text-yellow-400" /> Längsta streak
            </div>
            <div className="font-display text-3xl font-bold tabular-nums">{streaks.longest}</div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {streaks.longest === 1 ? "dag i rad (rekord)" : "dagar i rad (rekord)"}
            </p>
          </CardContent>
        </Card>

        {/* Period-jämförelse */}
        {periodComparison && (
          <>
            <Card className="relative overflow-hidden border-border/60 bg-surface/60">
              <CardContent className="p-5">
                <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <CalendarDays className="h-4 w-4 text-sky-400" /> Denna period
                </div>
                <div className="font-display text-3xl font-bold tabular-nums">
                  {periodComparison.current}h
                </div>
                {periodComparison.change !== null && (
                  <p
                    className={cn(
                      "mt-1 text-[10px] font-medium",
                      periodComparison.change >= 0 ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {periodComparison.change >= 0 ? "+" : ""}
                    {periodComparison.change}% vs föregående
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border-border/60 bg-surface/60">
              <CardContent className="p-5">
                <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" /> Föregående period
                </div>
                <div className="font-display text-3xl font-bold tabular-nums">
                  {periodComparison.previous}h
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{periodComparison.prevLabel}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Aktivitetsmönster: Veckodag & Klockslag ── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-surface/60">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Studietid per veckodag</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    tickFormatter={(v: number) => `${v}h`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--foreground)",
                    }}
                    formatter={(v: any) => [`${v} h`, "Studietid"]}
                  />
                  <Bar dataKey="timmar" radius={[4, 4, 0, 0]}>
                    {weekdayData.map((d, i) => (
                      <Cell
                        key={d.name}
                        fill={
                          i <= 4
                            ? "var(--primary)"
                            : "var(--muted-foreground)"
                        }
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-surface/60">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Studietid per klockslag</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourData} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    tickFormatter={(v: number) => `${v}h`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--foreground)",
                    }}
                    formatter={(v: any, _: any, props: { payload?: { hour: number } }) => [
                      `${v} h`,
                      `Kl. ${props.payload?.hour?.toString().padStart(2, "0") ?? ""}:00`,
                    ]}
                    labelFormatter={() => ""}
                  />
                  <ReferenceLine x="06" stroke="var(--border)" strokeDasharray="3 3" />
                  <ReferenceLine x="12" stroke="var(--border)" strokeDasharray="3 3" />
                  <ReferenceLine x="18" stroke="var(--border)" strokeDasharray="3 3" />
                  <Bar dataKey="timmar" radius={[3, 3, 0, 0]} fill="var(--primary)" fillOpacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-around text-[9px] text-muted-foreground select-none">
              <span>🌙 Natt (0–6)</span>
              <span>☀️ Morgon (6–12)</span>
              <span>🌤 Middag (12–18)</span>
              <span>🌆 Kväll (18–24)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Slutförandegrad per kurs ── */}
      {courseCompletion.length > 0 && (
        <Card className="mt-4 border-border/60 bg-surface/60">
          <CardHeader className="pb-2">
            <CardTitle className="font-display flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-primary" /> Slutförandegrad per kurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {courseCompletion.map((c) => (
                <div key={c.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: c.color }}
                      />
                      {c.name}
                    </span>
                    <span className="flex items-center gap-3 text-muted-foreground">
                      <span className="font-mono tabular-nums">{c.hours}h studerad</span>
                      <span className="font-medium text-foreground">
                        {c.done}/{c.total} uppg.
                      </span>
                      <span
                        className="w-10 text-right font-bold"
                        style={{ color: c.pct >= 80 ? "#34d399" : c.pct >= 40 ? "#fbbf24" : "#f87171" }}
                      >
                        {c.pct}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-in-out"
                      style={{
                        width: `${c.pct}%`,
                        background: c.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Planerat vs Faktiskt ── */}
      {goalVsActual.length > 0 && (
        <Card className="mt-4 border-border/60 bg-surface/60">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Planerat vs Faktiskt (studiepass)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={goalVsActual} barGap={2} barCategoryGap="30%">
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
                    tickFormatter={(v: number) => `${v}h`}
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
                    formatter={(v: any, name: any) => [`${v} h`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Planerat" fill="#6366f1" fillOpacity={0.5} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Faktiskt" fill="#8b5cf6" fillOpacity={0.9} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="hp" className="space-y-10">
          {/* Snabbnavigering till HP-huvudrubriker */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-surface/70 backdrop-blur shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" />
              Snabblänkar till rubriker
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => document.getElementById("hp-oversikt")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2/80 hover:bg-primary/15 hover:text-primary border border-border/50 px-3 py-1.5 text-xs font-medium text-foreground transition-all cursor-pointer"
              >
                <GraduationCap className="h-3.5 w-3.5 text-primary" />
                1. Översikt
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("hp-antagen")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2/80 hover:bg-sky-500/15 hover:text-sky-400 border border-border/50 px-3 py-1.5 text-xs font-medium text-foreground transition-all cursor-pointer"
              >
                <BookOpen className="h-3.5 w-3.5 text-sky-400" />
                2. Antagen
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("hp-registrerade")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2/80 hover:bg-emerald-500/15 hover:text-emerald-400 border border-border/50 px-3 py-1.5 text-xs font-medium text-foreground transition-all cursor-pointer"
              >
                <Award className="h-3.5 w-3.5 text-emerald-400" />
                3. Registrerade
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("hp-csn")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2/80 hover:bg-amber-500/15 hover:text-amber-400 border border-border/50 px-3 py-1.5 text-xs font-medium text-foreground transition-all cursor-pointer"
              >
                <GraduationCap className="h-3.5 w-3.5 text-amber-400" />
                4. CSN
              </button>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* HUVUDRUBRIK 1: Högskolepoäng - Översikt                       */}
          {/* ───────────────────────────────────────────────────────────── */}
          <section id="hp-oversikt" className="space-y-3">
            <div className="border-b border-border/40 pb-2">
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <GraduationCap className="h-4.5 w-4.5 text-primary" />
                Högskolepoäng - Översikt
              </h2>
            </div>

            {/* Ultrakompakt KPI-nätverk */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/60 bg-surface/60 p-3.5">
                <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Avklarat
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium">{registeredHpStats.coursesWithAnyDone} kurser</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-display text-2xl font-bold tabular-nums text-emerald-400">
                    {registeredHpStats.grandTotalHp} <span className="text-xs font-normal text-muted-foreground">HP</span>
                  </span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${hpStats.totalHp > 0 ? Math.min(100, Math.round((registeredHpStats.grandTotalHp / hpStats.totalHp) * 100)) : 0}%` }}
                  />
                </div>
              </Card>

              <Card className="border-border/60 bg-surface/60 p-3.5">
                <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
                    <BookOpen className="h-3.5 w-3.5" /> Pågående
                  </span>
                  <span className="text-[10px] text-sky-400 font-medium">{registeredHpStats.coursesWithIncomplete} kurser</span>
                </div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums text-sky-400">
                  {hpStats.ongoingHp} <span className="text-xs font-normal text-muted-foreground">HP</span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground truncate">Aktiva kurser just nu</p>
              </Card>

              <Card className="border-border/60 bg-surface/60 p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5 text-purple-400" /> Totalt antaget
                </div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums text-purple-300">
                  {hpStats.totalHp} <span className="text-xs font-normal text-muted-foreground">HP</span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground truncate">Avklarade & pågående</p>
              </Card>

              <Card className="border-border/60 bg-surface/60 p-3.5">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <Award className="h-3.5 w-3.5" /> Slutförandegrad
                  </span>
                </div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums text-amber-400">
                  {hpStats.totalHp > 0 ? Math.min(100, Math.round((registeredHpStats.grandTotalHp / hpStats.totalHp) * 100)) : 0}%
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground truncate">Registrerade av totala</p>
              </Card>
            </div>

            {/* Ultrakompakt fördelning för Kurstyp & Studieform */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border-border/60 bg-surface/60 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <School className="h-3.5 w-3.5 text-purple-400" /> Kurstyp
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-surface-2/30 p-2">
                    <span className="text-[11px] text-muted-foreground block">Program</span>
                    <span className="font-bold text-foreground font-mono">{hpStats.programHp} HP</span>
                    <span className="text-[9px] text-emerald-400 block font-medium">({registeredHpStats.programModulesHp} HP klara)</span>
                  </div>
                  <div className="rounded bg-surface-2/30 p-2">
                    <span className="text-[11px] text-muted-foreground block">Fristående</span>
                    <span className="font-bold text-foreground font-mono">{hpStats.standaloneHp} HP</span>
                    <span className="text-[9px] text-emerald-400 block font-medium">({registeredHpStats.standaloneModulesHp} HP klara)</span>
                  </div>
                </div>
              </Card>

              <Card className="border-border/60 bg-surface/60 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <Building2 className="h-3.5 w-3.5 text-sky-400" /> Studieform
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-surface-2/30 p-2">
                    <span className="text-[11px] text-muted-foreground block">Campus</span>
                    <span className="font-bold text-foreground font-mono">{hpStats.campusHp} HP</span>
                    <span className="text-[9px] text-emerald-400 block font-medium">({registeredHpStats.campusModulesHp} HP klara)</span>
                  </div>
                  <div className="rounded bg-surface-2/30 p-2">
                    <span className="text-[11px] text-muted-foreground block">Distans</span>
                    <span className="font-bold text-foreground font-mono">{hpStats.distansHp} HP</span>
                    <span className="text-[9px] text-emerald-400 block font-medium">({registeredHpStats.distansModulesHp} HP klara)</span>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* HUVUDRUBRIK 2: Högskolepoäng - Antagen                         */}
          {/* ───────────────────────────────────────────────────────────── */}
          <section id="hp-antagen" className="space-y-6">
            <div className="border-b border-border/40 pb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Högskolepoäng - Antagen
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Samtliga antagna poäng uppdelade per termin (Sommar, Höst, Vår) och läsperiod.
                </p>
              </div>
              {hpStats.excludedCoursesCount > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-medium text-amber-400">
                  <span>
                    {hpStats.excludedCoursesCount}{" "}
                    {hpStats.excludedCoursesCount === 1 ? "kurs" : "kurser"} exkluderades (saknar årskurs/period)
                  </span>
                </div>
              )}
            </div>

            {/* Termins- & Periodstatistik per Årskurs */}
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                  <CalendarDays className="h-4.5 w-4.5 text-primary" />
                  HP per Årskurs, Termin & Period
                </h3>
                <span className="text-xs text-muted-foreground">
                  Sorterat efter Årskurs → Termin → Period
                </span>
              </div>

              {hpStats.yearStats.length === 0 ? (
                <Card className="border-border/60 bg-surface/60 p-8 text-center text-xs text-muted-foreground">
                  Inga antagna kurser med både årskurs och period registrerade än.
                </Card>
              ) : (
                hpStats.yearStats.map((y) => (
                  <div
                    key={y.arskurs}
                    className="relative overflow-hidden space-y-3 rounded-xl border border-border/60 bg-surface/40 p-4 pl-11 shadow-sm"
                  >
                    {/* Vänster vertikal linje med upprepad årskurstext */}
                    <div className="absolute top-0 bottom-0 left-0 h-full w-7 bg-primary/15 border-r border-primary/30 flex flex-col items-center justify-start py-3 gap-5 overflow-hidden select-none pointer-events-none">
                      {Array.from({ length: 16 }).map((_, idx) => (
                        <span
                          key={idx}
                          className="font-display text-[9px] font-extrabold uppercase tracking-widest text-primary/80 [writing-mode:vertical-lr] rotate-180 whitespace-nowrap leading-none shrink-0"
                        >
                          {y.label}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-1 font-display font-bold text-sm text-primary">
                          {y.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-emerald-400 font-semibold">{y.completedHp} HP klart</span>
                        {y.ongoingHp > 0 && <span className="text-sky-400 font-semibold">+{y.ongoingHp} HP pågår</span>}
                        <span className="text-muted-foreground font-bold">({y.totalHp} HP tot)</span>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      {y.terms.map((term) => (
                        <Card
                          key={`${y.arskurs}-${term.key}`}
                          className={cn(
                            "border-border/60 bg-surface/60 overflow-hidden flex flex-col justify-between transition-all",
                            term.totalHp === 0 && "opacity-60"
                          )}
                        >
                          <CardHeader className="pb-3 border-b border-border/40 bg-surface-2/30">
                            <div className="flex items-center justify-between">
                              <span className={cn("font-bold text-sm font-display", term.color)}>
                                {term.name}
                              </span>
                              <span className="text-xs font-mono font-bold text-foreground tabular-nums">
                                {term.totalHp} HP
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="text-emerald-400 font-medium">{term.completedHp} HP klart</span>
                              {term.ongoingHp > 0 && (
                                <span className="text-sky-400 font-medium">{term.ongoingHp} HP pågår</span>
                              )}
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                                style={{
                                  width: `${
                                    term.totalHp > 0
                                      ? Math.min(100, Math.round((term.completedHp / term.totalHp) * 100))
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </CardHeader>

                          <CardContent className="p-3 space-y-2.5 flex-1">
                            {term.periods.map((pStat) => (
                              <div
                                key={`${y.arskurs}-${pStat.period}`}
                                className="rounded-lg border border-border/40 bg-surface-2/20 p-2 space-y-1.5"
                              >
                                <div className="flex items-center justify-between border-b border-border/30 pb-1">
                                  <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[11px] font-bold font-mono text-primary">
                                    {pStat.period}
                                  </span>
                                  <span className="text-xs font-mono font-semibold tabular-nums text-foreground">
                                    {pStat.totalHp} HP
                                  </span>
                                </div>

                                {pStat.courses.length === 0 ? (
                                  <div className="py-1 text-center text-[10px] text-muted-foreground/60 italic">
                                    Inga kurser i {pStat.period}
                                  </div>
                                ) : (
                                  <div className="space-y-1 pt-0.5">
                                    {pStat.courses.map(({ course: c, hpInPeriod }) => (
                                      <div
                                        key={`${y.arskurs}-${pStat.period}-${c.id}`}
                                        className="flex items-center justify-between gap-2 rounded-lg bg-surface/80 px-2 py-1 text-xs"
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <span
                                            className="h-2 w-2 shrink-0 rounded-full"
                                            style={{ background: c.color }}
                                          />
                                          {c.code && (
                                            <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                                              {c.code}
                                            </span>
                                          )}
                                          <span className="truncate font-medium text-foreground">{c.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
                                            {hpInPeriod} HP
                                          </span>
                                          {c.completed ? (
                                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                                              <CheckCircle2 className="h-2.5 w-2.5" /> Klart
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-0.5 rounded bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-sky-400">
                                              Pågår
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Visualiseringsdiagram per Läsperiod (P1-P5) */}
            <Card className="border-border/60 bg-surface/60">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base flex items-center justify-between">
                  <span>HP-fördelning per Läsperiod</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    P1, P2 (Höst) • P3, P4 (Vår) • P5 (Sommar)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hpStats.chartPeriodData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                        tickFormatter={(v: number) => `${v} HP`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "var(--foreground)",
                        }}
                        formatter={(v: any, name: any) => [`${v} HP`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Avklarade HP" stackId="hp" fill="#10b981" radius={[0, 0, 3, 3]} />
                      <Bar
                        dataKey="Pågående HP"
                        stackId="hp"
                        fill="#3b82f6"
                        fillOpacity={0.85}
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* HUVUDRUBRIK 3: Högskolepoäng - Registrerade                   */}
          {/* ───────────────────────────────────────────────────────────── */}
          <section id="hp-registrerade" className="space-y-4 pt-4 border-t border-border/40">
            <div className="border-b border-border/40 pb-3">
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Award className="h-5 w-5 text-sky-400" />
                Högskolepoäng - Registrerade
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Rapporterade HP per termin (Sommar, Höst, Vår) baserat på registreringsdatum och dina terminsdatum. Moment som registreras under en termin eller årskurs då kursen inte var schemalagd märks med en Sen-märkning.
              </p>
            </div>

            {/* Full-width sammanfogad enhetlig modul för Totalt, Kurstyp & Studieform */}
            <div className="rounded-xl border border-border/60 bg-surface/80 p-4 backdrop-blur-sm w-full shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <School className="h-4 w-4 text-purple-400" />
                  <span>Registrerade Högskolepoäng • Översikt &amp; Fördelning</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-muted-foreground font-medium">Totalt registrerat:</span>
                  <span className="font-bold text-sky-400 text-sm">{registeredHpStats.grandTotalHp} HP</span>
                  <span className="text-[11px] text-muted-foreground">({registeredHpStats.grandModuleCount} moment)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="flex flex-col rounded-lg bg-surface-2/40 border border-border/30 p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Program</span>
                  <span className="font-mono font-extrabold text-base text-foreground mt-0.5">
                    {registeredHpStats.programModulesHp} <span className="text-xs font-normal text-muted-foreground">HP</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {registeredHpStats.programModulesCount} {registeredHpStats.programModulesCount === 1 ? "moment" : "moment"}
                  </span>
                </div>
                <div className="flex flex-col rounded-lg bg-surface-2/40 border border-border/30 p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fristående</span>
                  <span className="font-mono font-extrabold text-base text-foreground mt-0.5">
                    {registeredHpStats.standaloneModulesHp} <span className="text-xs font-normal text-muted-foreground">HP</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {registeredHpStats.standaloneModulesCount} {registeredHpStats.standaloneModulesCount === 1 ? "moment" : "moment"}
                  </span>
                </div>
                <div className="flex flex-col rounded-lg bg-surface-2/40 border border-border/30 p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Campus</span>
                  <span className="font-mono font-extrabold text-base text-foreground mt-0.5">
                    {registeredHpStats.campusModulesHp} <span className="text-xs font-normal text-muted-foreground">HP</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {registeredHpStats.campusModulesCount} {registeredHpStats.campusModulesCount === 1 ? "moment" : "moment"}
                  </span>
                </div>
                <div className="flex flex-col rounded-lg bg-surface-2/40 border border-border/30 p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Distans</span>
                  <span className="font-mono font-extrabold text-base text-foreground mt-0.5">
                    {registeredHpStats.distansModulesHp} <span className="text-xs font-normal text-muted-foreground">HP</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {registeredHpStats.distansModulesCount} {registeredHpStats.distansModulesCount === 1 ? "moment" : "moment"}
                  </span>
                </div>
              </div>
            </div>

            {/* Sammanställning av avklarade HP per Lärosäte / Universitet */}
            {registeredHpStats.universitiesStats.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-surface/80 p-4 backdrop-blur-sm w-full shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Landmark className="h-4 w-4 text-emerald-400" />
                    <span>Avklarade Högskolepoäng per Lärosäte</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">
                      {registeredHpStats.universitiesStats.length} {registeredHpStats.universitiesStats.length === 1 ? "lärosäte" : "lärosäten"}
                    </span>
                    {selectedUniFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setSelectedUniFilter("all")}
                        className="text-[11px] text-emerald-400 hover:underline font-medium ml-2 cursor-pointer"
                      >
                        Visa alla ({registeredHpStats.grandTotalHp} HP)
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {registeredHpStats.universitiesStats.map((uni) => {
                    const isSelected = selectedUniFilter === (uni.id ?? "none");
                    return (
                      <button
                        key={uni.name}
                        type="button"
                        onClick={() =>
                          setSelectedUniFilter((prev) =>
                            prev === (uni.id ?? "none") ? "all" : (uni.id ?? "none")
                          )
                        }
                        className={cn(
                          "group text-left rounded-xl border p-3.5 transition-all cursor-pointer space-y-2.5 flex flex-col justify-between",
                          isSelected
                            ? "border-emerald-500/70 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30"
                            : "border-border/40 bg-surface-2/30 hover:border-border/70 hover:bg-surface-2/60"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-display font-bold text-sm text-foreground flex items-center gap-1.5 break-words line-clamp-1 group-hover:text-emerald-400 transition-colors">
                              <Landmark
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0",
                                  isSelected ? "text-emerald-400" : "text-muted-foreground group-hover:text-emerald-400"
                                )}
                              />
                              {uni.name}
                            </span>
                            <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded shrink-0">
                              {uni.totalHp} HP
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {uni.moduleCount} {uni.moduleCount === 1 ? "moment" : "moment"} · {uni.courseCount} {uni.courseCount === 1 ? "kurs" : "kurser"}
                          </p>
                        </div>

                        <div className="space-y-1 pt-1.5 border-t border-border/20">
                          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                            <span>Andel av totalt</span>
                            <span className="font-semibold text-foreground">{uni.percentageOfTotal}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, uni.percentageOfTotal))}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Registrerad HP uppdelad per Årskurs & Termin */}
            <div className="space-y-6 pt-2">
              {displayedYearStats.length === 0 ? (
                <Card className="border-border/60 bg-surface/60 p-8 text-center text-xs text-muted-foreground">
                  {selectedUniFilter !== "all" ? (
                    <div className="space-y-2">
                      <p>Inga registrerade moment för det valda lärosätet.</p>
                      <button
                        type="button"
                        onClick={() => setSelectedUniFilter("all")}
                        className="text-xs text-primary underline cursor-pointer"
                      >
                        Återställ filter och visa alla lärosäten
                      </button>
                    </div>
                  ) : (
                    "Inga registrerade rapporteringsmoment än."
                  )}
                </Card>
              ) : (
                displayedYearStats.map((y) => {
                  const hasSummerModules = y.terms.some(
                    (term) => term.key === "ST" && term.modules.length > 0
                  );
                  const activeTerms = hasSummerModules
                    ? y.terms
                    : y.terms.filter((term) => term.key !== "ST");

                  return (
                    <div
                      key={y.arskurs}
                      className="relative overflow-hidden space-y-4 rounded-xl border border-border/60 bg-surface/40 p-4 pl-11 shadow-sm"
                    >
                      {/* Vänster vertikal linje med upprepad årskurstext */}
                      <div className="absolute top-0 bottom-0 left-0 h-full w-7 bg-sky-500/15 border-r border-sky-500/30 flex flex-col items-center justify-start py-3 gap-5 overflow-hidden select-none pointer-events-none">
                        {Array.from({ length: 16 }).map((_, idx) => (
                          <span
                            key={idx}
                            className="font-display text-[9px] font-extrabold uppercase tracking-widest text-sky-400/80 [writing-mode:vertical-lr] rotate-180 whitespace-nowrap leading-none shrink-0"
                          >
                            {y.label}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between border-b border-border/40 pb-2.5 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-1 font-display font-bold text-sm text-sky-400">
                            {y.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[11px] font-medium text-purple-400">
                            Program: {y.programHp} HP
                          </span>
                          <span className="rounded bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[11px] font-medium text-purple-400">
                            Fristående: {y.standaloneHp} HP
                          </span>
                          <span className="rounded bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[11px] font-medium text-sky-400">
                            Campus: {y.campusHp} HP
                          </span>
                          <span className="rounded bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[11px] font-medium text-sky-400">
                            Distans: {y.distansHp} HP
                          </span>
                          <span className="text-sky-400 font-bold font-mono text-xs ml-1">
                            ({y.totalHp} HP tot)
                          </span>
                        </div>
                      </div>

                      {/* Terminskort med smart responsiv grid */}
                      <div
                        className={cn(
                          "grid gap-4 grid-cols-1",
                          hasSummerModules ? "lg:grid-cols-3" : "lg:grid-cols-2"
                        )}
                      >
                        {activeTerms.map((term) => (
                          <Card
                            key={`${y.arskurs}-${term.key}`}
                            className={cn(
                              "border-border/60 bg-surface/60 overflow-hidden flex flex-col justify-between transition-all",
                              term.totalHp === 0 && "opacity-60"
                            )}
                          >
                            <CardHeader className="pb-3 border-b border-border/40 bg-surface-2/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={cn("font-bold text-sm font-display", term.color)}>
                                    {term.name}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground font-medium">
                                    ({term.modules.length} {term.modules.length === 1 ? "moment" : "moment"})
                                  </span>
                                </div>
                                <span className="text-xs font-mono font-bold text-foreground tabular-nums bg-surface-2/80 px-2 py-0.5 rounded border border-border/40">
                                  {term.totalHp} HP
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                {term.programHp > 0 && (
                                  <span className="rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-purple-400 font-medium">
                                    Program: {term.programHp} HP
                                  </span>
                                )}
                                {term.standaloneHp > 0 && (
                                  <span className="rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-purple-400 font-medium">
                                    Fristående: {term.standaloneHp} HP
                                  </span>
                                )}
                                {term.campusHp > 0 && (
                                  <span className="rounded bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-sky-400 font-medium">
                                    Campus: {term.campusHp} HP
                                  </span>
                                )}
                                {term.distansHp > 0 && (
                                  <span className="rounded bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-sky-400 font-medium">
                                    Distans: {term.distansHp} HP
                                  </span>
                                )}
                                {term.totalHp === 0 && (
                                  <span className="text-muted-foreground/60 italic">0 HP i terminen</span>
                                )}
                              </div>
                            </CardHeader>

                            <CardContent className="p-3.5 space-y-2.5 flex-1">
                              {term.modules.length === 0 ? (
                                <div className="py-6 text-center text-xs text-muted-foreground/60 italic">
                                  Inga moment registrerade för {term.name.toLowerCase()}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {term.modules.map((m) => (
                                    <div
                                      key={m.id}
                                      className={cn(
                                        "group rounded-xl border border-border/40 bg-surface/80 p-3 transition-all hover:bg-surface/95 hover:border-border/70 hover:shadow-xs space-y-2",
                                        m.isLateReporting && "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60"
                                      )}
                                    >
                                      {/* Huvudrad: Kurs & Moment med tydlig typografi och HP-badge */}
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                          <span
                                            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-xs"
                                            style={{ background: m.courseColor }}
                                            title={m.courseName}
                                          />
                                          <div className="min-w-0 flex-1 space-y-0.5 break-words">
                                            <div className="flex flex-wrap items-center gap-1.5 leading-snug">
                                              {m.courseCode && (
                                                <span className="font-mono text-[10px] font-bold text-muted-foreground bg-surface-2/90 px-1.5 py-0.5 rounded border border-border/40 shrink-0">
                                                  {m.courseCode}
                                                </span>
                                              )}
                                              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors break-words">
                                                {m.courseName}
                                              </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                              <span className="font-medium text-foreground/90 break-words">{m.moduleName}</span>
                                              {hasEnteredValue(m.grade) && (
                                                <span className="rounded bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.2 text-[10px] font-bold text-emerald-400 shrink-0">
                                                  Betyg: {m.grade}
                                                </span>
                                              )}
                                              {hasEnteredValue(m.points) && (
                                                <span className="rounded bg-purple-500/10 border border-purple-500/25 px-1.5 py-0.2 text-[10px] font-medium text-purple-300 shrink-0">
                                                  Poäng: {m.points}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* HP-badge */}
                                        <div className="shrink-0 flex items-center">
                                          <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-lg tabular-nums shadow-xs">
                                            {m.hp} HP
                                          </span>
                                        </div>
                                      </div>

                                      {/* Inforad: Datum, Sen & studieform */}
                                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-1.5 border-t border-border/20 text-[11px]">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground min-w-0">
                                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground/90 shrink-0">
                                            <CalendarDays className="h-3 w-3 text-muted-foreground/60" />
                                            {m.registeredOn}
                                          </span>
                                          <span className="text-border/60 text-[10px]">•</span>
                                          <span className="text-[10px] rounded bg-surface-2/50 border border-border/30 px-1.5 py-0.2 text-muted-foreground/90 shrink-0">
                                            {m.isStandalone ? "Fristående" : "Program"}
                                          </span>
                                          <span className="text-border/60 text-[10px]">•</span>
                                          <span className="text-[10px] rounded bg-surface-2/50 border border-border/30 px-1.5 py-0.2 text-muted-foreground/90 shrink-0">
                                            {m.mode === "distans" ? "Distans" : "Campus"}
                                          </span>
                                          {m.isArchived && (
                                            <>
                                              <span className="text-border/60 text-[10px]">•</span>
                                              <span className="text-[10px] rounded bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.2 text-amber-400 font-medium shrink-0">
                                                Inaktiv kurs
                                              </span>
                                            </>
                                          )}
                                        </div>

                                        {m.isLateReporting && (
                                          <span
                                            className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0"
                                            title="Sen rapportering: Inrapporterat under en termin då kursen inte var schemalagd"
                                          >
                                            <Clock className="h-2.5 w-2.5 text-amber-400" />
                                            Sen
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Om sommarterminen är tom visas den som en stilren kompakt rad istället för att stjäla 33% av skärmen */}
                      {!hasSummerModules && (
                        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-surface-2/20 px-3.5 py-2.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400/50" />
                            <span className="font-semibold text-foreground/90 font-display">Sommartermin</span>
                            <span className="text-[11px] font-mono text-muted-foreground">(0 HP)</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground/60 italic">Inga inrapporterade moment under sommaren</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* HUVUDRUBRIK 4: Högskolepoäng - Studiekrav CSN                 */}
          {/* ───────────────────────────────────────────────────────────── */}
          <section id="hp-csn" className="space-y-4 pt-4 border-t border-border/40">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-amber-400" />
                  Högskolepoäng - Studiekrav CSN
                </h2>
              </div>
            </div>

            {csnStats.periods.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-surface/40 p-8 text-center space-y-4 backdrop-blur-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="font-display text-base font-bold text-foreground">
                    Inga CSN-perioder inlagda än
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    För att sammanställa hur många HP du har fått registrerade och hur du ligger till gentemot studiekravet (75 %) behöver du ställa in dina CSN-perioder.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 max-w-lg mx-auto text-left pt-2">
                  <div className="rounded-xl border border-border/50 bg-surface-2/40 p-3 space-y-1">
                    <span className="text-[11px] font-semibold text-amber-300 block">
                      📅 Period mellan två datum
                    </span>
                    <span className="text-[11px] text-muted-foreground block leading-snug">
                      Från när beslutet kommit till sista veckan med utbetalning. Slutdatumet kan uppdateras vid nytt beslut.
                    </span>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-surface-2/40 p-3 space-y-1">
                    <span className="text-[11px] font-semibold text-amber-300 block">
                      🎯 75 % studiekrav
                    </span>
                    <span className="text-[11px] text-muted-foreground block leading-snug">
                      1 vecka = 1,5 HP. Exempel: 20 veckor ger 30 HP, där studiekravet är 22 HP (avrundat nedåt).
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Övergripande KPI-sammanställning för aktiv/senaste CSN-period */}
                {csnStats.activePeriod && (
                  <div className="rounded-2xl border border-border/60 bg-surface/80 p-4.5 backdrop-blur-sm space-y-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          <GraduationCap className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <span className="text-xs font-bold text-foreground block">
                            {csnStats.activePeriod.period.name || "Aktiv CSN-period"}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {formatDateYYYYMMDD(csnStats.activePeriod.period.startDate)} →{" "}
                            {formatDateYYYYMMDD(csnStats.activePeriod.period.endDate)} (
                            {csnStats.activePeriod.weeks} veckor)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {csnStats.activePeriod.status === "active" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Aktiv period
                          </span>
                        )}
                        {csnStats.activePeriod.isFulfilled ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Studiekrav uppnått
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                            <Clock className="h-3.5 w-3.5" /> {csnStats.activePeriod.remainingHp} HP kvar till kravet
                          </span>
                        )}
                      </div>
                    </div>

                    {/* KPI-kort */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {/* KPI 1: Registrerade HP */}
                      <Card className="border-border/60 bg-surface-2/40 p-3.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                            Registrerat i perioden
                          </span>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className={cn(
                              "font-display text-2xl font-extrabold tabular-nums",
                              csnStats.activePeriod.isFulfilled ? "text-emerald-400" : "text-sky-400"
                            )}>
                              {csnStats.activePeriod.registeredHp}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              / {csnStats.activePeriod.requiredHp} HP krav
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-muted-foreground">
                          {csnStats.activePeriod.modules.length} godkända moment inrapporterade
                        </div>
                      </Card>

                      {/* KPI 2: Studiekrav */}
                      <Card className="border-border/60 bg-surface-2/40 p-3.5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Studiekrav CSN
                            </span>
                            <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                              75 %
                            </span>
                          </div>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="font-display text-2xl font-extrabold tabular-nums text-amber-400">
                              {csnStats.activePeriod.requiredHp}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              HP krävs
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-muted-foreground truncate font-mono">
                          Baserat på {csnStats.activePeriod.weeks} v
                        </div>
                      </Card>

                      {/* KPI 3: Status / Marginal */}
                      <Card className="border-border/60 bg-surface-2/40 p-3.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                            Kravstatus
                          </span>
                          <div className="mt-1">
                            {csnStats.activePeriod.isFulfilled ? (
                              <div className="font-display text-xl font-bold text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="h-5 w-5" /> Klart!
                              </div>
                            ) : (
                              <div className="font-display text-xl font-bold text-amber-400 flex items-center gap-1.5">
                                <Clock className="h-5 w-5" /> Pågår
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 text-[11px] font-mono">
                          {csnStats.activePeriod.isFulfilled ? (
                            <span className="text-emerald-400 font-medium">
                              +{csnStats.activePeriod.surplusHp} HP marginal över kravet
                            </span>
                          ) : (
                            <span className="text-amber-300 font-medium">
                              {csnStats.activePeriod.remainingHp} HP kvar att registrera
                            </span>
                          )}
                        </div>
                      </Card>

                      {/* KPI 4: Beviljat studiemedel */}
                      <Card className="border-border/60 bg-surface-2/40 p-3.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                            Beviljat studiemedel
                          </span>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="font-display text-2xl font-extrabold tabular-nums text-foreground">
                              {csnStats.activePeriod.totalHp}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              HP ({csnStats.activePeriod.weeks} v)
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-muted-foreground font-mono">
                          1 heltidsvecka = 1,5 HP
                        </div>
                      </Card>
                    </div>

                    {/* Visuell Progress Bar mot 75%-kravet och 100% */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex flex-wrap items-center justify-between text-xs font-mono">
                        <span className="text-muted-foreground">
                          Framsteg:{" "}
                          <strong className={csnStats.activePeriod.isFulfilled ? "text-emerald-400" : "text-sky-300"}>
                            {csnStats.activePeriod.requirementPercentReached}%
                          </strong>{" "}
                          av studiekravet uppnått ({csnStats.activePeriod.registeredHp} av {csnStats.activePeriod.requiredHp} HP)
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          Totalt beviljat: {csnStats.activePeriod.totalHp} HP
                        </span>
                      </div>

                      {/* Bar med CSN-kravmarkör */}
                      {(() => {
                        const totalHp = csnStats.activePeriod.totalHp || 1;
                        const reqPct = Math.min(100, Math.max(0, (csnStats.activePeriod.requiredHp / totalHp) * 100));
                        const regPct = Math.min(100, Math.max(0, (csnStats.activePeriod.registeredHp / totalHp) * 100));
                        return (
                          <div>
                            <div className="relative h-4 w-full overflow-hidden rounded-full bg-surface-2 border border-border/50">
                              {/* Fyllning för registrerade HP i relation till beviljat (100%) */}
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  csnStats.activePeriod.isFulfilled
                                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                                    : "bg-gradient-to-r from-sky-500 to-amber-400"
                                )}
                                style={{ width: `${regPct}%` }}
                              />

                              {/* Vertikalt CSN krav-streck */}
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                                style={{ left: `${reqPct}%` }}
                                title={`CSN Studiekrav (75% = ${csnStats.activePeriod.requiredHp} HP, avrundat nedåt till heltal)`}
                              />
                            </div>

                            <div className="relative flex justify-between text-[10px] font-mono text-muted-foreground pt-0.5">
                              <span>0 HP</span>
                              <span
                                className="absolute -translate-x-1/2 text-amber-400 font-bold whitespace-nowrap"
                                style={{ left: `${reqPct}%` }}
                              >
                                ▲ Krav 75% ({csnStats.activePeriod.requiredHp} HP)
                              </span>
                              <span>100% beviljat ({csnStats.activePeriod.totalHp} HP)</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* 2. Sammanställning av alla CSN-perioder */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                    <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                      <span>Alla CSN-perioder</span>
                      <span className="rounded-full bg-surface-2 border border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground font-mono">
                        {csnStats.periods.length} {csnStats.periods.length === 1 ? "period" : "perioder"}
                      </span>
                    </h3>

                    <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                      <span>
                        Totalt registrerat:{" "}
                        <strong className="text-foreground">{csnStats.grandTotalRegisteredHp} HP</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Totalt beviljat:{" "}
                        <strong className="text-foreground">{csnStats.grandTotalCsnHp} HP</strong> ({csnStats.grandTotalWeeks} v)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {csnStats.periods.map((p) => {
                      const isExpanded = Boolean(expandedCsnPeriodIds[p.period.id]);

                      return (
                        <div
                          key={p.period.id}
                          className="rounded-xl border border-border/60 bg-surface/50 overflow-hidden shadow-sm transition-all hover:border-border/90"
                        >
                          {/* Period-huvud */}
                          <div className="p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-display text-sm font-bold text-foreground">
                                    {p.period.name || `CSN-period (${formatDateYYYYMMDD(p.period.startDate)} – ${formatDateYYYYMMDD(p.period.endDate)})`}
                                  </span>
                                  {p.status === "active" && (
                                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                      Aktiv period
                                    </span>
                                  )}
                                  {p.status === "upcoming" && (
                                    <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                                      Kommande
                                    </span>
                                  )}
                                  {p.status === "past" && (
                                    <span className="rounded-full bg-muted/40 border border-border/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                      Avslutad
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {formatDateYYYYMMDD(p.period.startDate)} → {formatDateYYYYMMDD(p.period.endDate)}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {p.isFulfilled ? (
                                  <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Krav uppnått ({p.registeredHp} / {p.requiredHp} HP)
                                  </span>
                                ) : (
                                  <span className={cn(
                                    "rounded-lg px-2.5 py-1 text-xs font-bold font-mono flex items-center gap-1.5",
                                    p.status === "past"
                                      ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                                      : "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                                  )}>
                                    <Clock className="h-3.5 w-3.5" />
                                    {p.registeredHp} / {p.requiredHp} HP ({p.remainingHp} HP kvar)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Detalj-grid för perioden */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                              <div className="rounded-lg bg-surface-2/40 border border-border/30 p-2.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                                  Veckor med CSN
                                </span>
                                <span className="font-mono font-bold text-sm text-foreground mt-0.5 block">
                                  {p.weeks} veckor
                                </span>
                              </div>
                              <div className="rounded-lg bg-surface-2/40 border border-border/30 p-2.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                                  Beviljade poäng
                                </span>
                                <span className="font-mono font-bold text-sm text-sky-400 mt-0.5 block">
                                  {p.totalHp} HP
                                </span>
                              </div>
                              <div className="rounded-lg bg-surface-2/40 border border-border/30 p-2.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                                  Studiekrav (75 %)
                                </span>
                                <span className="font-mono font-bold text-sm text-amber-400 mt-0.5 block">
                                  {p.requiredHp} HP
                                </span>
                              </div>
                              <div className="rounded-lg bg-surface-2/40 border border-border/30 p-2.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                                  Registrerat i perioden
                                </span>
                                <span className={cn(
                                  "font-mono font-bold text-sm mt-0.5 block",
                                  p.isFulfilled ? "text-emerald-400" : "text-foreground"
                                )}>
                                  {p.registeredHp} HP{" "}
                                  <span className="text-[10px] font-normal text-muted-foreground">
                                    ({p.modules.length} moment)
                                  </span>
                                </span>
                              </div>
                            </div>

                            {/* Mini progress bar */}
                            {(() => {
                              const tHp = p.totalHp || 1;
                              const reqPct = Math.min(100, Math.max(0, (p.requiredHp / tHp) * 100));
                              const regPct = Math.min(100, Math.max(0, (p.registeredHp / tHp) * 100));
                              return (
                                <div className="space-y-1">
                                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all duration-300",
                                        p.isFulfilled ? "bg-emerald-500" : "bg-amber-400"
                                      )}
                                      style={{ width: `${regPct}%` }}
                                    />
                                    <div
                                      className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                                      style={{ left: `${reqPct}%` }}
                                      title={`Studiekrav (${p.requiredHp} HP, avrundat nedåt)`}
                                    />
                                  </div>
                                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                                    <span>{p.requirementPercentReached} % av studiekravet</span>
                                    <span>Krav: {p.requiredHp} HP (75 %)</span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Toggle-knapp för att fälla ut registrerade moment & Ändra-knapp */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                              <button
                                type="button"
                                onClick={() => togglePeriodExpanded(p.period.id)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-3.5 w-3.5" /> Dölj registrerade moment ({p.modules.length} st)
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3.5 w-3.5" /> Visa registrerade moment under perioden ({p.modules.length} st • {p.registeredHp} HP)
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Utfällbar lista över moment som registrerats under perioden */}
                          {isExpanded && (
                            <div className="border-t border-border/40 bg-surface-2/30 p-3.5 space-y-2.5">
                              <div className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
                                <span>Inrapporterade moment under perioden</span>
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {p.modules.length} st • {p.registeredHp} HP totalt
                                </span>
                              </div>

                              {p.modules.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                                  Inga moment har registrerats med datum mellan{" "}
                                  <span className="font-mono text-foreground">{formatDateYYYYMMDD(p.period.startDate)}</span> och{" "}
                                  <span className="font-mono text-foreground">{formatDateYYYYMMDD(p.period.endDate)}</span>.
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    Gå till respektive kurs och ange registreringsdatum för godkända rapporteringsmoment för att de ska kopplas hit.
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {p.modules.map((mod) => (
                                    <div
                                      key={mod.id}
                                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-surface/70 px-3 py-2 text-xs"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-[200px]">
                                        <span
                                          className="h-2 w-2 rounded-full shrink-0"
                                          style={{ backgroundColor: mod.courseColor }}
                                        />
                                        <div>
                                          <div className="font-medium text-foreground flex items-center gap-1.5">
                                            <span>{mod.moduleName}</span>
                                            {mod.courseCode && (
                                              <span className="rounded bg-surface-2 px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                                                {mod.courseCode}
                                              </span>
                                            )}
                                            {mod.isArchived && (
                                              <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-amber-400">
                                                Inaktiv
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[11px] text-muted-foreground truncate">
                                            {mod.courseName}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3 text-xs font-mono ml-auto sm:ml-0">
                                        <span className="text-muted-foreground text-[11px]">
                                          Reg: {mod.registeredOn}
                                        </span>
                                        {hasEnteredValue(mod.grade) && (
                                          <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                            Betyg: {mod.grade}
                                          </span>
                                        )}
                                        {hasEnteredValue(mod.points) && (
                                          <span className="rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
                                            Poäng: {mod.points}
                                          </span>
                                        )}
                                        <span className="font-bold text-foreground">
                                          {mod.hp} HP
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="betyg" className="space-y-6">
          <div className="border-b border-border/40 pb-3">
            <h2 className="font-display text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-400" />
              Betyg & Resultat
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Översikt över dina slutbetyg i kurser och godkända moment.
            </p>
          </div>

          {/* KPI Kort for Betyg */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="relative overflow-hidden border-border/60 bg-surface/60">
              <CardContent className="p-5">
                <div className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <Award className="h-4 w-4" /> Viktat Medelbetyg
                  </span>
                </div>
                <div className="font-display text-3xl font-bold tabular-nums text-amber-400">
                  {gradeStats.weightedAverage !== null ? gradeStats.weightedAverage : "—"}{" "}
                  {gradeStats.weightedAverage !== null && (
                    <span className="text-sm font-normal text-muted-foreground">/ 5.0</span>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">Viktat efter kursernas HP</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-border/60 bg-surface/60">
              <CardContent className="p-5">
                <div className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-sky-400">
                    <GraduationCap className="h-4 w-4" /> Betygssatta Kurser
                  </span>
                </div>
                <div className="font-display text-3xl font-bold tabular-nums text-sky-400">
                  {gradeStats.totalGradedCourses}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Av totalt {hpStats.completedCount} avklarade
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-border/60 bg-surface/60">
              <CardContent className="p-5">
                <div className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> Enkelt Medelbetyg
                  </span>
                </div>
                <div className="font-display text-3xl font-bold tabular-nums text-emerald-400">
                  {gradeStats.simpleAverage !== null ? gradeStats.simpleAverage : "—"}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">Ovägt genomsnitt</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-border/60 bg-surface/60">
              <CardContent className="p-5">
                <div className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <Target className="h-4 w-4" /> Betygssatta Moment
                  </span>
                </div>
                <div className="font-display text-3xl font-bold tabular-nums text-purple-300">
                  {gradeStats.gradedTasks.length}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">Tentor & uppgifter med betyg</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Betygsfördelning Diagram */}
            <Card className="border-border/60 bg-surface/60 lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">Betygsfördelning</CardTitle>
              </CardHeader>
              <CardContent>
                {gradeStats.gradeDistributionData.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Inga kursbetyg registrerade än.
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gradeStats.gradeDistributionData} barSize={28}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="grade"
                          stroke="var(--muted-foreground)"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="var(--muted-foreground)"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          width={24}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "var(--popover)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "var(--foreground)",
                          }}
                          formatter={(v: any, name: any) => [
                            name === "Antal" ? `${v} kurser` : `${v} HP`,
                            name,
                          ]}
                        />
                        <Bar dataKey="Antal" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Slutbetyg i Kurser */}
            <Card className="border-border/60 bg-surface/60 lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">Slutbetyg i Kurser</CardTitle>
              </CardHeader>
              <CardContent>
                {gradeStats.gradedCourses.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Du har inga registrerade slutbetyg i dina kurser än.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {gradeStats.gradedCourses.map((c) => {
                      const periodStr = formatPeriods(c.periods, c.period);
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-surface-2/30 px-3.5 py-2.5 text-xs transition-colors hover:bg-surface-2/60"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: c.color }}
                            />
                            {c.code && (
                              <span className="font-mono text-xs font-semibold text-muted-foreground">
                                {c.code}
                              </span>
                            )}
                            <span className="truncate font-medium text-sm">{c.name}</span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {c.arskurs && (
                              <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                                År {c.arskurs}
                              </span>
                            )}
                            {periodStr && (
                              <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                                {periodStr}
                              </span>
                            )}
                            {c.hp != null && (
                              <span className="font-mono font-semibold text-xs tabular-nums text-muted-foreground">
                                {c.hp} HP
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-400 font-mono">
                              Betyg {c.final_grade}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Uppgifts- & Tentabetyg */}
          {gradeStats.gradedTasks.length > 0 && (
            <Card className="border-border/60 bg-surface/60">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">
                  Betygsatta Uppgifter & Tentor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {gradeStats.gradedTasks.map((t) => {
                    const c = courses.find((course) => course.id === t.course_id);
                    return (
                      <div
                        key={t.id}
                        className="rounded-lg border border-border/40 bg-surface-2/30 p-3 text-xs flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium truncate text-foreground">{t.title}</span>
                            {hasEnteredValue(t.grade) && (
                              <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-bold font-mono text-[11px] text-emerald-400 shrink-0">
                                {t.grade}
                              </span>
                            )}
                          </div>
                          {c && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: c.color }}
                              />
                              <span className="truncate">{c.name}</span>
                            </div>
                          )}
                        </div>
                        {hasEnteredValue(t.points) && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            Poäng: {t.points}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
