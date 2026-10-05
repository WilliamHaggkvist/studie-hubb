import type { Course, Task, ReportingModule, CourseEnrollment, TermRow } from "@/lib/queries";
import type { UserSettings } from "@/lib/settings";
import { calculateCsnMetrics, type CsnPeriod } from "@/lib/csn";
import { periodWindows } from "@/lib/academic-periods";
import { CHANGELOG } from "@/lib/changelog";

export type NotifCategory = "tasks" | "courses" | "sessions" | "system" | "progress" | "csn";
export type NotifSeverity = "urgent" | "action" | "info";

export const NOTIF_CATEGORIES: { key: NotifCategory; label: string; description: string }[] = [
  { key: "tasks", label: "Uppgifter", description: "Försenade, deadline snart, väntar på bedömning" },
  { key: "courses", label: "Kurser", description: "Tomma kurser, HP-fel, ej avslutade kurser" },
  { key: "progress", label: "Framsteg & mål", description: "HP-milstolpar, veckomål, kurs nästan klar" },
  { key: "csn", label: "CSN", description: "Varning när CSN-kravet riskerar att missas" },
  { key: "sessions", label: "Studiepass", description: "Okopplade pass, pass snart, inget pass på länge" },
  { key: "system", label: "System", description: "Kalendersynk, push, e-post, nyheter, ny inloggning" },
];

export type AppNotification = {
  key: string;
  category: NotifCategory;
  severity: NotifSeverity;
  title: string;
  body?: string;
  to: string;
  search?: Record<string, string>;
  params?: Record<string, string>;
};

export type SessionLite = {
  id: string;
  course_id: string | null;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  needs_review: boolean;
  completed: boolean;
  created_at: string;
};

export type DeviceLite = { device_id: string; user_agent: string | null; first_seen_at: string };

const DAY = 86400000;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtH = (h: number) => (Math.round(h * 10) / 10).toString().replace(".", ",");
function mondayOf(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}
function sessionHours(s: SessionLite) {
  const a = new Date(s.actual_start ?? s.planned_start).getTime();
  const b = new Date(s.actual_end ?? s.planned_end).getTime();
  return Math.max(0, (b - a) / 3600000);
}
function deviceName(ua: string | null) {
  if (!ua) return "okänd enhet";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "okänt system";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox/.test(ua) ? "Firefox" : /Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "webbläsare";
  return `${br} på ${os}`;
}

export function buildNotifications(input: {
  courses: Course[];
  tasks: Task[];
  modules: ReportingModule[];
  enrollments: CourseEnrollment[];
  sessions: SessionLite[];
  terms: TermRow[];
  settings: UserSettings | null | undefined;
  pushOnThisDevice: boolean | null;
  csnPeriods?: CsnPeriod[];
  devices?: DeviceLite[];
  currentDeviceId?: string | null;
  now?: Date;
}): AppNotification[] {
  const now = input.now ?? new Date();
  const out: AppNotification[] = [];
  const courseName = new Map(input.courses.map((c) => [c.id, c.code || c.name]));
  const today = ymd(now);
  const tomorrow = ymd(new Date(now.getTime() + DAY));
  const reviewDays = input.settings?.notif_review_days ?? 14;

  // ---- Uppgifter
  for (const t of input.tasks) {
    const cn = t.course_id ? courseName.get(t.course_id) : undefined;
    const prefix = cn ? `${cn} · ` : "";
    if (t.status !== "done" && t.due_at && !t.pending_review) {
      const due = new Date(t.due_at);
      const dueDay = t.due_at.slice(0, 10);
      const dateOnly = t.due_at.length <= 10 || /T00:00:00/.test(t.due_at);
      const overdue = dateOnly ? dueDay < today : due.getTime() < now.getTime();
      if (overdue) {
        out.push({
          key: `overdue:${t.id}`,
          category: "tasks",
          severity: "urgent",
          title: `Försenad: ${t.title}`,
          body: `${prefix}Deadline ${dueDay}`,
          to: "/tasks",
        });
      } else if (dueDay === today || dueDay === tomorrow) {
        out.push({
          key: `due:${t.id}:${dueDay}`,
          category: "tasks",
          severity: "action",
          title: `${dueDay === today ? "Deadline idag" : "Deadline imorgon"}: ${t.title}`,
          body: cn,
          to: "/tasks",
        });
      }
    }
    if (t.pending_review && t.status !== "done") {
      const since = t.completed_at ?? t.due_at;
      if (since && now.getTime() - new Date(since).getTime() > reviewDays * DAY) {
        out.push({
          key: `review:${t.id}`,
          category: "tasks",
          severity: "action",
          title: `Fyll i resultat: ${t.title}`,
          body: `${prefix}Har väntat på bedömning i över ${reviewDays} dagar`,
          to: "/tasks",
        });
      }
    }
  }
  // Överuppgift med alla deluppgifter klara
  const children = new Map<string, Task[]>();
  for (const t of input.tasks) if (t.parent_id) {
    const a = children.get(t.parent_id) ?? [];
    a.push(t);
    children.set(t.parent_id, a);
  }
  for (const t of input.tasks) {
    const kids = children.get(t.id);
    if (t.status !== "done" && kids && kids.length > 0 && kids.every((k) => k.status === "done")) {
      out.push({
        key: `parent-done:${t.id}`,
        category: "tasks",
        severity: "action",
        title: `Alla deluppgifter klara: ${t.title}`,
        body: "Markera huvuduppgiften som klar",
        to: "/tasks",
      });
    }
  }

  // ---- Kurser
  const windows = periodWindows(input.terms);
  for (const c of input.courses) {
    if (c.archived) continue;
    const link = { to: "/courses/$courseId", params: { courseId: c.id } };
    const label = c.code ? `${c.code} ${c.name}` : c.name;
    const mods = input.modules.filter((m) => m.course_id === c.id);
    const missing: string[] = [];
    if (c.hp == null) missing.push("HP");
    const hasEnroll = input.enrollments.some((e) => e.course_id === c.id);
    if (!hasEnroll && c.arskurs == null) missing.push("årskurs");
    if (!hasEnroll && !(c.periods?.length || c.period)) missing.push("period");
    if (missing.length && !c.completed) {
      out.push({
        key: `course-missing:${c.id}:${missing.join(",")}`,
        category: "courses",
        severity: "action",
        title: `Kursinfo saknas: ${label}`,
        body: `Saknar ${missing.join(", ")}`,
        ...link,
      });
    }
    if (mods.length && c.hp != null) {
      const sum = mods.reduce((a, m) => a + Number(m.hp || 0), 0);
      if (Math.abs(sum - Number(c.hp)) > 0.01) {
        out.push({
          key: `hp-mismatch:${c.id}:${sum}:${c.hp}`,
          category: "courses",
          severity: "action",
          title: `HP stämmer inte: ${label}`,
          body: `Momenten summerar till ${sum} hp, kursen har ${c.hp} hp`,
          ...link,
        });
      }
    }
    if (mods.length && mods.every((m) => m.completed) && (!c.completed || !c.final_grade)) {
      out.push({
        key: `course-finish:${c.id}`,
        category: "courses",
        severity: "info",
        title: `Alla moment klara: ${label}`,
        body: c.completed ? "Slutbetyg saknas" : "Markera kursen som avklarad",
        ...link,
      });
    }
    if (!c.completed && !mods.length && !input.tasks.some((t) => t.course_id === c.id)) {
      const ps = new Set<string>([
        ...input.enrollments.filter((e) => e.course_id === c.id).flatMap((e) => e.periods),
        ...(c.periods ?? []),
        ...(c.period ? [c.period] : []),
      ]);
      const end = windows.find(
        (w) => ps.has(w.period) && w.end.getTime() > now.getTime() && w.end.getTime() - now.getTime() < 21 * DAY && w.start.getTime() < now.getTime(),
      );
      if (end) {
        out.push({
          key: `course-empty:${c.id}:${ymd(end.end)}`,
          category: "courses",
          severity: "action",
          title: `Tom kurs: ${label}`,
          body: `${end.period} slutar ${ymd(end.end)} – inga uppgifter eller moment inlagda`,
          ...link,
        });
      }
    }
    // Kurs nästan klar
    if (mods.length >= 2 && mods.filter((m) => !m.completed).length === 1 && !c.completed) {
      const left = mods.find((m) => !m.completed)!;
      out.push({
        key: `course-almost:${c.id}:${left.id}`,
        category: "progress",
        severity: "info",
        title: `Nästan klar: ${label}`,
        body: `Bara ${left.name} (${left.hp} hp) kvar`,
        ...link,
      });
    }
  }

  // ---- Studiepass
  const inbox = input.sessions.filter((s) => s.needs_review);
  if (inbox.length) {
    out.push({
      key: `session-inbox:${inbox.map((s) => s.id).sort().join(",").slice(0, 200)}`,
      category: "sessions",
      severity: inbox.some((s) => now.getTime() - new Date(s.created_at).getTime() > 2 * DAY) ? "urgent" : "action",
      title: `${inbox.length} studiepass att koppla`,
      body: "Koppla passen till uppgifter i Inkorgen",
      to: "/time",
    });
  }
  for (const s of input.sessions) {
    const diff = new Date(s.planned_start).getTime() - now.getTime();
    if (diff > 0 && diff <= 15 * 60000) {
      out.push({
        key: `session-soon:${s.id}`,
        category: "sessions",
        severity: "info",
        title: "Studiepass startar snart",
        body: `Om ${Math.max(1, Math.round(diff / 60000))} min`,
        to: "/time",
      });
    }
  }

  // ---- System
  const st = input.settings;
  if (st?.google_connected && st.google_last_sync_error) {
    out.push({
      key: `gcal-error:${st.google_last_sync_at ?? ""}`,
      category: "system",
      severity: "urgent",
      title: "Google Kalender-synken misslyckades",
      body: st.google_last_sync_error.slice(0, 140),
      to: "/settings",
    });
  }
  if (st?.reminder_email && !st.reminder_email_verified) {
    out.push({
      key: `email-unverified:${st.reminder_email}`,
      category: "system",
      severity: "action",
      title: "E-postadressen för påminnelser är inte verifierad",
      to: "/settings",
    });
  }
  if (st?.push_enabled && input.pushOnThisDevice === false) {
    out.push({
      key: "push-off-device",
      category: "system",
      severity: "info",
      title: "Push-notiser är avstängda på den här enheten",
      to: "/settings",
    });
  }
  const latestEnd = input.terms.reduce((m, t) => (t.end_date > m ? t.end_date : m), "");
  if (!latestEnd || new Date(latestEnd).getTime() - now.getTime() < 30 * DAY) {
    out.push({
      key: `terms-missing:${latestEnd}`,
      category: "system",
      severity: "action",
      title: "Lägg in terminsdatum för nästa termin",
      body: "Behövs för att perioder och statistik ska räknas rätt",
      to: "/settings",
    });
  }

  if (st?.google_connected && !st.google_last_sync_error) {
    const last = st.google_last_sync_at ? new Date(st.google_last_sync_at).getTime() : 0;
    if (now.getTime() - last > 9 * 3600000) {
      out.push({
        key: `gcal-stale:${st.google_last_sync_at ?? ""}`,
        category: "system",
        severity: "action",
        title: "Kalendersynken har inte kört på över 2 timmar",
        body: st.google_last_sync_at ? `Senast ${st.google_last_sync_at.slice(0, 16).replace("T", " ")}` : "Har aldrig kört",
        to: "/settings",
      });
    }
  }
  for (const e of CHANGELOG) {
    out.push({ key: `changelog:${e.id}`, category: "system", severity: "info", title: `Nytt: ${e.title}`, body: e.body, to: "/dashboard" });
  }
  const devs = input.devices ?? [];
  if (devs.length > 1) {
    const firstSeen = Math.min(...devs.map((d) => new Date(d.first_seen_at).getTime()));
    for (const d of devs) {
      const t = new Date(d.first_seen_at).getTime();
      if (t === firstSeen || now.getTime() - t > 14 * DAY) continue;
      out.push({
        key: `new-device:${d.device_id}`,
        category: "system",
        severity: d.device_id === input.currentDeviceId ? "info" : "action",
        title: `Ny inloggning: ${deviceName(d.user_agent)}`,
        body: `${d.first_seen_at.slice(0, 16).replace("T", " ")}${d.device_id === input.currentDeviceId ? " · den här enheten" : " · var det du?"}`,
        to: "/settings",
      });
    }
  }

  // ---- Framsteg: HP-milstolpar
  let doneHp = 0;
  for (const c of input.courses) {
    const mods = input.modules.filter((m) => m.course_id === c.id);
    if (mods.length) doneHp += mods.filter((m) => m.completed).reduce((a, m) => a + Number(m.hp || 0), 0);
    else if (c.completed) doneHp += Number(c.hp || 0);
  }
  const milestone = [180, 150, 120, 90, 60, 30].find((m) => doneHp >= m);
  if (milestone) {
    out.push({
      key: `hp-milestone:${milestone}`,
      category: "progress",
      severity: "info",
      title: `Grattis, du har klarat ${milestone} HP!`,
      body: `Totalt ${fmtH(doneHp)} hp avklarade`,
      to: "/stats",
    });
  }

  // ---- Veckomål (sön kväll → mån) och inget pass på länge
  const dow = now.getDay();
  const showWeek = (dow === 0 && now.getHours() >= 18) || dow === 1;
  const weekStart = dow === 1 ? new Date(mondayOf(now).getTime() - 7 * DAY) : mondayOf(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY);
  const done = input.sessions.filter((s) => s.completed && s.course_id);
  for (const c of input.courses) {
    const goal = Number(c.weekly_goal_hours || 0);
    if (c.archived || c.completed || goal <= 0) continue;
    const label = c.code || c.name;
    const link = { to: "/courses/$courseId", params: { courseId: c.id } };
    const cs = done.filter((s) => s.course_id === c.id);
    if (showWeek) {
      const h = cs
        .filter((s) => { const t = new Date(s.planned_start).getTime(); return t >= weekStart.getTime() && t < weekEnd.getTime(); })
        .reduce((a, s) => a + sessionHours(s), 0);
      const wk = ymd(weekStart);
      if (h >= goal) {
        out.push({ key: `week-goal:${c.id}:${wk}`, category: "progress", severity: "info", title: `Veckomål nått: ${label}`, body: `${fmtH(h)}/${fmtH(goal)} h`, ...link });
      } else if (h < goal * 0.75) {
        out.push({ key: `week-goal:${c.id}:${wk}`, category: "progress", severity: "action", title: `Veckomål missat: ${label}`, body: `${fmtH(h)}/${fmtH(goal)} h`, ...link });
      }
    }
    const last = cs.reduce((m, s) => Math.max(m, new Date(s.planned_start).getTime()), 0);
    if (now.getTime() - last > 10 * DAY) {
      out.push({
        key: `no-session:${c.id}:${last}`,
        category: "sessions",
        severity: "action",
        title: `Inget studiepass på länge: ${label}`,
        body: last ? `Senaste genomförda pass ${ymd(new Date(last))}` : "Inget genomfört pass senaste 60 dagarna",
        ...link,
      });
    }
  }

  // ---- CSN
  for (const p of input.csnPeriods ?? []) {
    if (!p.endDate) continue;
    const end = new Date(`${p.endDate.slice(0, 10)}T23:59:59`);
    const left = end.getTime() - now.getTime();
    if (left < 0 || left > 30 * DAY) continue;
    const { requiredHp } = calculateCsnMetrics(p.weeks);
    const start = p.startDate.slice(0, 10), endD = p.endDate.slice(0, 10);
    const reg = input.modules
      .filter((m) => m.completed && m.registered_on && m.registered_on.slice(0, 10) >= start && m.registered_on.slice(0, 10) <= endD)
      .reduce((a, m) => a + Number(m.hp || 0), 0);
    if (reg < requiredHp) {
      out.push({
        key: `csn:${p.id}:${reg}`,
        category: "csn",
        severity: left < 14 * DAY ? "urgent" : "action",
        title: `CSN: ${fmtH(requiredHp - reg)} hp kvar till kravet`,
        body: `${p.name ? p.name + " · " : ""}${fmtH(reg)}/${requiredHp} hp registrerade, perioden slutar ${endD}`,
        to: "/stats",
      });
    }
  }

  const cats = (st?.notif_categories ?? {}) as Record<string, boolean>;
  const rank = { urgent: 0, action: 1, info: 2 };
  return out
    .filter((n) => cats[n.category] !== false)
    .sort((a, b) => rank[a.severity] - rank[b.severity]);
}
