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
  const [includeArchived, setIncludeArchived] = useState<boolean>(true);

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const courses = includeArchived ? allCourses : allCourses.filter((c) => !c.archived);
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
      const row: Record<string, number | string> = { day: format(d, "d/M", { locale: sv }) };

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
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
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
        day: format(new Date(day), "d/M", { locale: sv }),
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
      prevLabel: `${format(prevStart, "d MMM", { locale: sv })} – ${format(prevEnd, "d MMM", { locale: sv })}`,
    };
  }, [isAllTime, range, heatmapData]);

  // --- Högskolepoäng (HP) & Terminsstatistik ---
  const hpStats = useMemo(() => {
    let completedHp = 0;
    let ongoingHp = 0;
    let totalHp = 0;
    let completedCount = 0;
    let ongoingCount = 0;

    type CourseItem = (typeof courses)[number];
    const termMap = new Map<
      string,
      {
        label: string;
        sortKey: string;
        completedHp: number;
        ongoingHp: number;
        totalHp: number;
        courses: CourseItem[];
      }
    >();

    const periodMap = new Map<
      string,
      { label: string; completedHp: number; ongoingHp: number; totalHp: number }
    >([
      ["P1", { label: "P1 (Höst)", completedHp: 0, ongoingHp: 0, totalHp: 0 }],
      ["P2", { label: "P2 (Höst)", completedHp: 0, ongoingHp: 0, totalHp: 0 }],
      ["P3", { label: "P3 (Vår)", completedHp: 0, ongoingHp: 0, totalHp: 0 }],
      ["P4", { label: "P4 (Vår)", completedHp: 0, ongoingHp: 0, totalHp: 0 }],
      ["P5", { label: "P5 (Sommar)", completedHp: 0, ongoingHp: 0, totalHp: 0 }],
    ]);

    for (const c of courses) {
      const courseHp = c.hp ?? 0;
      totalHp += courseHp;

      if (c.completed) {
        completedHp += courseHp;
        completedCount++;
      } else {
        ongoingHp += courseHp;
        ongoingCount++;
      }

      // Bestäm termin (e.g. "År 1 HT", "År 1 VT", "HT", "VT" etc.)
      const firstP = c.periods && c.periods.length > 0 ? c.periods[0] : c.period;
      let termType = "";
      if (firstP === "P1" || firstP === "P2") termType = "HT";
      else if (firstP === "P3" || firstP === "P4") termType = "VT";
      else if (firstP === "P5") termType = "ST";

      let termKey = "övrigt";
      let termLabelStr = "Övriga kurser";
      let sortKey = "99-9";

      if (c.arskurs && termType) {
        termKey = `ar${c.arskurs}-${termType}`;
        termLabelStr = `År ${c.arskurs} ${termType === "HT" ? "Hösttermin" : termType === "VT" ? "Vårtermin" : "Sommartermin"}`;
        sortKey = `${c.arskurs}-${termType === "HT" ? "1" : termType === "VT" ? "2" : "3"}`;
      } else if (c.arskurs) {
        termKey = `ar${c.arskurs}`;
        termLabelStr = `Årskurs ${c.arskurs}`;
        sortKey = `${c.arskurs}-0`;
      } else if (termType) {
        termKey = termType;
        termLabelStr = termType === "HT" ? "Hösttermin" : termType === "VT" ? "Vårtermin" : "Sommartermin";
        sortKey = `50-${termType === "HT" ? "1" : termType === "VT" ? "2" : "3"}`;
      }

      if (!termMap.has(termKey)) {
        termMap.set(termKey, {
          label: termLabelStr,
          sortKey,
          completedHp: 0,
          ongoingHp: 0,
          totalHp: 0,
          courses: [],
        });
      }

      const tObj = termMap.get(termKey)!;
      tObj.totalHp += courseHp;
      if (c.completed) {
        tObj.completedHp += courseHp;
      } else {
        tObj.ongoingHp += courseHp;
      }
      tObj.courses.push(c);

      // Period map aggregation
      const coursePeriods = c.periods && c.periods.length > 0 ? c.periods : c.period ? [c.period] : [];
      for (const p of coursePeriods) {
        if (periodMap.has(p)) {
          const pObj = periodMap.get(p)!;
          pObj.totalHp += courseHp;
          if (c.completed) pObj.completedHp += courseHp;
          else pObj.ongoingHp += courseHp;
        }
      }
    }

    const termData = Array.from(termMap.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((t) => ({
        ...t,
        completedHp: +t.completedHp.toFixed(1),
        ongoingHp: +t.ongoingHp.toFixed(1),
        totalHp: +t.totalHp.toFixed(1),
      }));

    const periodData = Array.from(periodMap.entries()).map(([p, data]) => ({
      period: p,
      name: data.label,
      "Avklarade HP": +data.completedHp.toFixed(1),
      "Pågående HP": +data.ongoingHp.toFixed(1),
      totalHp: +data.totalHp.toFixed(1),
    }));

    const pctCompleted = totalHp > 0 ? Math.round((completedHp / totalHp) * 100) : 0;

    return {
      completedHp: +completedHp.toFixed(1),
      ongoingHp: +ongoingHp.toFixed(1),
      totalHp: +totalHp.toFixed(1),
      completedCount,
      ongoingCount,
      pctCompleted,
      termData,
      periodData,
    };
  }, [courses]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Statistik</h1>
          <p className="text-sm text-muted-foreground">{range.label}</p>
        </div>
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
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* ── Högskolepoäng & Terminsöversikt (HP) ── */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold tracking-tight">
            Högskolepoäng & Terminsöversikt
          </h2>
        </div>

        {/* HP KPI Kort */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden border-border/60 bg-surface/60">
            <CardContent className="p-5">
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Avklarade HP
                </span>
                <span className="text-[10px] font-semibold text-emerald-400/90">
                  {hpStats.completedCount} kurser
                </span>
              </div>
              <div className="font-display text-3xl font-bold tabular-nums text-emerald-400">
                {hpStats.completedHp}{" "}
                <span className="text-sm font-normal text-muted-foreground">HP</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, hpStats.pctCompleted)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/60 bg-surface/60">
            <CardContent className="p-5">
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5 text-sky-400">
                  <BookOpen className="h-4 w-4" /> Pågående HP
                </span>
                <span className="text-[10px] font-semibold text-sky-400/90">
                  {hpStats.ongoingCount} kurser
                </span>
              </div>
              <div className="font-display text-3xl font-bold tabular-nums text-sky-400">
                {hpStats.ongoingHp}{" "}
                <span className="text-sm font-normal text-muted-foreground">HP</span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Läses just nu i aktiva kurser</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/60 bg-surface/60">
            <CardContent className="p-5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <GraduationCap className="h-4 w-4 text-purple-400" /> Totalt registrerat
              </div>
              <div className="font-display text-3xl font-bold tabular-nums text-purple-300">
                {hpStats.totalHp}{" "}
                <span className="text-sm font-normal text-muted-foreground">HP</span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Totalt i din studieplan</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/60 bg-surface/60">
            <CardContent className="p-5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Award className="h-4 w-4 text-amber-400" /> Slutförandegrad
              </div>
              <div className="font-display text-3xl font-bold tabular-nums text-amber-400">
                {hpStats.pctCompleted}%
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Avklarat av totala antalet poäng
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Diagram: HP per Termin & Läsperiod */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Stapeldiagram per Termin */}
          <Card className="border-border/60 bg-surface/60 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">HP per Termin & Årskurs</CardTitle>
            </CardHeader>
            <CardContent>
              {hpStats.termData.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Inga kurser med HP registrerade än.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hpStats.termData} barSize={32}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
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
                        formatter={(v: number, name: string) => [
                          `${v} HP`,
                          name === "completedHp" ? "Avklarat" : "Pågående",
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11 }}
                        formatter={(value) =>
                          value === "completedHp" ? "Avklarade HP" : "Pågående HP"
                        }
                      />
                      <Bar dataKey="completedHp" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                      <Bar
                        dataKey="ongoingHp"
                        stackId="a"
                        fill="#3b82f6"
                        fillOpacity={0.85}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Läsperioder (P1-P5) */}
          <Card className="border-border/60 bg-surface/60">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">HP per Läsperiod</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hpStats.periodData} barSize={20}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="period"
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
                      tickFormatter={(v: number) => `${v}`}
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
                    <Bar dataKey="Avklarade HP" stackId="b" fill="#10b981" radius={[0, 0, 3, 3]} />
                    <Bar
                      dataKey="Pågående HP"
                      stackId="b"
                      fill="#8b5cf6"
                      fillOpacity={0.85}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detaljerad terminsuppdelning med kurser */}
        {hpStats.termData.length > 0 && (
          <Card className="border-border/60 bg-surface/60">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">Kursfördelning per Termin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {hpStats.termData.map((term) => (
                  <div
                    key={term.label}
                    className="rounded-xl border border-border/50 bg-surface-2/30 p-4 transition-colors"
                  >
                    <div className="mb-3 flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="font-display font-semibold text-sm flex items-center gap-2">
                        <span>{term.label}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-emerald-400 font-medium">
                          {term.completedHp} HP klart
                        </span>
                        {term.ongoingHp > 0 && (
                          <span className="text-sky-400 font-medium">
                            + {term.ongoingHp} HP pågår
                          </span>
                        )}
                        <span className="text-muted-foreground">({term.totalHp} HP tot)</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {term.courses.map((c) => {
                        const periodStr = formatPeriods(c.periods, c.period);
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-surface/60 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: c.color }}
                              />
                              {c.code && (
                                <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                                  {c.code}
                                </span>
                              )}
                              <span className="truncate font-medium">{c.name}</span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {periodStr && (
                                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {periodStr}
                                </span>
                              )}
                              {c.hp != null && (
                                <span className="font-mono font-semibold tabular-nums text-foreground">
                                  {c.hp} HP
                                </span>
                              )}
                              {c.completed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {c.final_grade ? `Betyg ${c.final_grade}` : "Klart"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-400">
                                  Pågår
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
