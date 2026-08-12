import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<string>("time");
  const [period, setPeriod] = useState<string>("30");
  const [includeArchived, setIncludeArchived] = useState<boolean>(true);

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const courses = includeArchived ? allCourses : allCourses.filter((c) => !c.archived);
  const { data: terms = [] } = useQuery(termsQuery);
  const { data: allEnrollments = [] } = useQuery(enrollmentsQuery);
  const { data: allModules = [] } = useQuery(reportingModulesQuery);

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
      if (!isoString) return;
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return;
      const dayKey = format(d, "yyyy-MM-dd");
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

  // Stabil sträng-nyckel för queries (undviker ny Date() på varje render)
  const rangeStartKey = isAllTime ? "all" : range.start.toISOString().slice(0, 10);
  const rangeEndKey = range.end.toISOString().slice(0, 10);

  const { data: entries = [] } = useQuery({
    queryKey: ["stats", "entries", rangeStartKey, rangeEndKey],
    queryFn: async () => {
      let q = supabase
        .from("time_entries")
        .select("id,started_at,duration_seconds,course_id,task_id,source")
        .neq("source", "session")
        .lte("started_at", new Date().toISOString());

      if (!isAllTime) {
        q = q.gte("started_at", range.start.toISOString());
      }

      const { data } = await q;
      return (data ?? []) as Entry[];
    },
  });

  const { data: sessionRows = [] } = useQuery({
    queryKey: ["stats", "sessions-rows", rangeStartKey, rangeEndKey],
    queryFn: async () => {
      let q = supabase
        .from("study_sessions")
        .select("id,course_id,planned_start,planned_end,actual_start,actual_end,completed")
        .eq("needs_review", false)
        .lte("planned_start", new Date().toISOString());

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
    for (const e of entries) {
      if (!e.started_at) continue;
      const t = new Date(e.started_at).getTime();
      if (!isNaN(t) && t < minTime) minTime = t;
    }
    for (const s of sessionRows) {
      const start = s.actual_start ?? s.planned_start;
      if (!start) continue;
      const t = new Date(start).getTime();
      if (!isNaN(t) && t < minTime) minTime = t;
    }
    return minTime === Infinity ? subDays(new Date(), 30).getTime() : minTime;
  }, [entries, sessionRows]);

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

  const filteredEntries = useMemo(
    () =>
      entries.filter((e) => {
        if (!e.course_id) return true;
        const course = coursesMap.get(e.course_id);
        return course ? (includeArchived ? true : !course.archived) : true;
      }),
    [entries, coursesMap, includeArchived],
  );

  const filteredSessionRows = useMemo(
    () =>
      sessionRows.filter((s) => {
        if (!s.course_id) return true;
        const course = coursesMap.get(s.course_id);
        return course ? (includeArchived ? true : !course.archived) : true;
      }),
    [sessionRows, coursesMap, includeArchived],
  );

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
      return course ? (includeArchived ? true : !course.archived) : true;
    });
  }, [allTasks, coursesMap, includeArchived]);

  const sessionsCount = filteredSessionRows.length;

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
      const actual =
        s.actual_start && s.actual_end
          ? Math.max(0, (new Date(s.actual_end).getTime() - new Date(s.actual_start).getTime()) / 3600000)
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

    for (const c of courses) {
      const courseHp = c.hp ?? 0;
      const courseEnrollments = enrollmentsForCourse(c, allEnrollments);

      // En kurs ingår i statistiken om och endast om den har minst en omgång
      // där BÅDE årskurs och period(er) är valda.
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
          } else {
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
  }, [courses, allEnrollments]);

  // --- Högskolepoäng (HP) Registrerade statistik ---
  const registeredStats = useMemo(() => {
    // Registrerade kurser = aktiva (icke-arkiverade) samt slutförda kurser
    const registeredCourses = courses.filter((c) => !c.archived || c.completed);

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

    // Processera ENDAST course_reporting_modules (klarmarkerade eller med betyg/datum/poäng)
    for (const m of allModules) {
      const isDone = Boolean(m.completed || m.grade || m.registered_on || m.points);
      if (!isDone) continue;
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
      };

      termObj.totalHp += hp;
      yearObj.totalHp += hp;
      grandTotalHp += hp;
      grandModuleCount++;

      termObj.modules.push(item);
    }

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
          modules: t.modules.sort((a, b) => b.registeredOn.localeCompare(a.registeredOn)),
        })),
      }));

    return {
      grandTotalHp: +grandTotalHp.toFixed(1),
      grandModuleCount,
      programModulesCount,
      programModulesHp: +programModulesHp.toFixed(1),
      standaloneModulesCount,
      standaloneModulesHp: +standaloneModulesHp.toFixed(1),
      campusModulesCount,
      campusModulesHp: +campusModulesHp.toFixed(1),
      distansModulesCount,
      distansModulesHp: +distansModulesHp.toFixed(1),
      yearStats: yearStatsList,
    };
  }, [allModules, allCourses, terms, allEnrollments]);

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
      (t) => (t.grade && t.grade.trim() !== "") || (t.points && t.points.trim() !== ""),
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
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
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
                      key={day.dayKey}
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
                    formatter={(v: number) => [`${v} h`, ""]}
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
                <div
                  key={t.id}
                  className="group relative rounded-md border border-border/40 bg-surface-2/30 p-2 transition-colors hover:bg-surface-2/60"
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
                    formatter={(v: number) => [`${v} h`, "Studietid"]}
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
                    formatter={(v: number, _: string, props: { payload?: { hour: number } }) => [
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
                    formatter={(v: number, name: string) => [`${v} h`, name]}
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
                  <span className="text-[10px] text-emerald-400 font-medium">{hpStats.completedCount} kurser</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-display text-2xl font-bold tabular-nums text-emerald-400">
                    {hpStats.completedHp} <span className="text-xs font-normal text-muted-foreground">HP</span>
                  </span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, hpStats.pctCompleted)}%` }}
                  />
                </div>
              </Card>

              <Card className="border-border/60 bg-surface/60 p-3.5">
                <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
                    <BookOpen className="h-3.5 w-3.5" /> Pågående
                  </span>
                  <span className="text-[10px] text-sky-400 font-medium">{hpStats.ongoingCount} kurser</span>
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
                  {hpStats.pctCompleted}%
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground truncate">Av totala poäng</p>
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
                    <span className="text-[9px] text-emerald-400 block font-medium">({hpStats.programCompletedHp} HP klara)</span>
                  </div>
                  <div className="rounded bg-surface-2/30 p-2">
                    <span className="text-[11px] text-muted-foreground block">Fristående</span>
                    <span className="font-bold text-foreground font-mono">{hpStats.standaloneHp} HP</span>
                    <span className="text-[9px] text-emerald-400 block font-medium">({hpStats.standaloneCompletedHp} HP klara)</span>
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
                    <span className="text-[9px] text-emerald-400 block font-medium">({hpStats.campusCompletedHp} HP klara)</span>
                  </div>
                  <div className="rounded bg-surface-2/30 p-2">
                    <span className="text-[11px] text-muted-foreground block">Distans</span>
                    <span className="font-bold text-foreground font-mono">{hpStats.distansHp} HP</span>
                    <span className="text-[9px] text-emerald-400 block font-medium">({hpStats.distansCompletedHp} HP klara)</span>
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
                                        className="flex items-center justify-between gap-2 rounded-md bg-surface/80 px-2 py-1 text-xs"
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
                        formatter={(v: number, name: string) => [`${v} HP`, name]}
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
              <p className="text-xs text-muted-foreground mt-0.5">
                Rapporterade HP per termin (Sommar, Höst, Vår) baserat på registreringsdatum och dina terminsdatum.
              </p>
            </div>

            {/* Full-width sammanfogad enhetlig modul för Totalt & Kurstyp */}
            <div className="rounded-xl border border-border/60 bg-surface/80 p-3.5 backdrop-blur-sm w-full shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <School className="h-4 w-4 text-purple-400" />
                  <span>Kurstyp &amp; Totalt</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-muted-foreground font-medium">Totalt registrerat:</span>
                  <span className="font-bold text-sky-400 text-sm">{registeredHpStats.grandTotalHp} HP</span>
                  <span className="text-[11px] text-muted-foreground">({registeredHpStats.grandModuleCount} moment)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex flex-col rounded-lg bg-surface-2/40 border border-border/30 p-3">
                  <span className="text-xs font-medium text-muted-foreground">Program</span>
                  <span className="font-mono font-extrabold text-base text-foreground mt-0.5">
                    {registeredHpStats.programModulesHp} <span className="text-xs font-normal text-muted-foreground">HP</span>
                  </span>
                </div>
                <div className="flex flex-col rounded-lg bg-surface-2/40 border border-border/30 p-3">
                  <span className="text-xs font-medium text-muted-foreground">Fristående</span>
                  <span className="font-mono font-extrabold text-base text-foreground mt-0.5">
                    {registeredHpStats.standaloneModulesHp} <span className="text-xs font-normal text-muted-foreground">HP</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Registrerad HP uppdelad per Årskurs & Termin */}
            <div className="space-y-6 pt-2">
              {registeredHpStats.yearStats.length === 0 ? (
                <Card className="border-border/60 bg-surface/60 p-8 text-center text-xs text-muted-foreground">
                  Inga registrerade rapporteringsmoment än.
                </Card>
              ) : (
                registeredHpStats.yearStats.map((y) => (
                  <div
                    key={y.arskurs}
                    className="relative overflow-hidden space-y-3 rounded-xl border border-border/60 bg-surface/40 p-4 pl-11 shadow-sm"
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

                    <div className="flex flex-wrap items-center justify-between border-b border-border/40 pb-2 gap-2">
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

                    <div className="grid gap-4 lg:grid-cols-3">
                      {y.terms.map((term) => (
                        <Card
                          key={`${y.arskurs}-${term.key}`}
                          className={cn(
                            "border-border/60 bg-surface/60 overflow-hidden flex flex-col justify-between transition-all",
                            term.totalHp === 0 && "opacity-60"
                          )}
                        >
                          <CardHeader className="pb-3 border-b border-border/40 bg-surface-2/30 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className={cn("font-bold text-sm font-display", term.color)}>
                                {term.name}
                              </span>
                              <span className="text-xs font-mono font-bold text-foreground tabular-nums bg-surface-2/80 px-2 py-0.5 rounded border border-border/40">
                                {term.totalHp} HP
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              <span className="rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-purple-400 font-medium">
                                Program: {term.programHp} HP
                              </span>
                              <span className="rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-purple-400 font-medium">
                                Fristående: {term.standaloneHp} HP
                              </span>
                              <span className="rounded bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-sky-400 font-medium">
                                Campus: {term.campusHp} HP
                              </span>
                              <span className="rounded bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-sky-400 font-medium">
                                Distans: {term.distansHp} HP
                              </span>
                            </div>
                          </CardHeader>

                          <CardContent className="p-3 space-y-2 flex-1">
                            {term.modules.length === 0 ? (
                              <div className="py-4 text-center text-[11px] text-muted-foreground/60 italic">
                                Inga moment för {term.name.toLowerCase()}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {term.modules.map((m) => (
                                  <div
                                    key={m.id}
                                    className="flex items-center justify-between gap-2 rounded-md bg-surface/80 px-2.5 py-1.5 text-xs border border-border/30"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ background: m.courseColor }}
                                      />
                                      {m.courseCode && (
                                        <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                                          {m.courseCode}
                                        </span>
                                      )}
                                      <span className="truncate font-medium text-foreground">
                                        {m.moduleName}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="font-mono text-[10px] text-muted-foreground">
                                        {m.registeredOn}
                                      </span>
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2/60 border border-border/40 text-muted-foreground hidden sm:inline">
                                        {m.isStandalone ? "Fristående" : "Program"}
                                      </span>
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2/60 border border-border/40 text-muted-foreground hidden sm:inline">
                                        {m.mode === "distans" ? "Distans" : "Campus"}
                                      </span>
                                      <span className="font-mono text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">
                                        {m.hp} HP
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
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
                          formatter={(v: number, name: string) => [
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
                            {t.grade && (
                              <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-bold font-mono text-[11px] text-emerald-400 shrink-0">
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
                        {t.points && (
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
