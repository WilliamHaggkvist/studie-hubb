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
  now?: Date;
}): AppNotification[] {
  const now = input.now ?? new Date();
  const out: AppNotification[] = [];
  const courseName = new Map(input.courses.map((c) => [c.id, c.code || c.name]));
  const today = ymd(now);
  const tomorrow = ymd(new Date(now.getTime() + DAY));

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
      if (since && now.getTime() - new Date(since).getTime() > 14 * DAY) {
        out.push({
          key: `review:${t.id}`,
          category: "tasks",
          severity: "action",
          title: `Fyll i resultat: ${t.title}`,
          body: `${prefix}Har väntat på bedömning i över 14 dagar`,
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
    if (!c.completed && !input.tasks.some((t) => t.course_id === c.id)) {
      out.push({
        key: `course-no-tasks:${c.id}`,
        category: "courses",
        severity: "info",
        title: `Inga uppgifter: ${label}`,
        body: "Lägg till uppgifter så att du har koll på deadlines",
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
      severity: "action",
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

  const cats = (st?.notif_categories ?? {}) as Record<string, boolean>;
  const rank = { urgent: 0, action: 1, info: 2 };
  return out
    .filter((n) => cats[n.category] !== false)
    .sort((a, b) => rank[a.severity] - rank[b.severity]);
}
