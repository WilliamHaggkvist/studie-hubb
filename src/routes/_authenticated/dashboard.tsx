import { useMemo, useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatHoursCompact } from "@/lib/timer-store";
import { Clock, ListTodo, Calendar as CalendarIcon, GraduationCap, AlertCircle, ExternalLink, Plus, Trash2, Globe, Link as LinkIcon, MessageSquare, Mail, FileText, Play, BookOpen, Settings } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, isSameDay, differenceInCalendarDays, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { useUserSettings } from "@/lib/settings";
import { coursesQuery, tasksQuery, termsQuery, type TermRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type TimeEntry = { id: string; started_at: string; duration_seconds: number | null; course_id: string | null; source: string };
type Session = { id: string; planned_start: string; planned_end: string; completed: boolean; course_id: string | null; actual_start?: string | null; actual_end?: string | null };

function todayPeriod(terms: TermRow[]): TermRow["term"] | null {
  const today = new Date().toISOString().slice(0, 10);
  const active = terms.find((t) => today >= t.start_date && today <= t.end_date);
  return active?.term ?? null;
}

function periodMatches(coursePeriod: string | null, activePeriod: TermRow["term"] | null): boolean {
  if (!activePeriod || !coursePeriod) return true;
  if (coursePeriod === "helar") return true;
  if (activePeriod === "host" && (coursePeriod.startsWith("host") || coursePeriod === "period-1" || coursePeriod === "period-2")) return true;
  if (activePeriod === "var" && (coursePeriod.startsWith("var") || coursePeriod === "period-3" || coursePeriod === "period-4")) return true;
  if (activePeriod === "sommar" && coursePeriod.startsWith("sommar")) return true;
  return false;
}

const AVAILABLE_ICONS = [
  { name: "globe", Icon: Globe, label: "Webb" },
  { name: "school", Icon: GraduationCap, label: "Skola" },
  { name: "book", Icon: BookOpen, label: "Bok" },
  { name: "calendar", Icon: CalendarIcon, label: "Kalender" },
  { name: "link", Icon: LinkIcon, label: "Länk" },
  { name: "message", Icon: MessageSquare, label: "Chatt" },
  { name: "mail", Icon: Mail, label: "Mejl" },
  { name: "file", Icon: FileText, label: "Fil" },
  { name: "video", Icon: Play, label: "Video" },
];

function QuickLinksCard() {
  type QuickLink = { id: string; title: string; url: string; icon?: string };
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("globe");
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("studiehubb.quick_links");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setLinks(parsed);
          return;
        }
      } catch (err) {
        console.error("Error parsing saved quick links", err);
      }
    }
    const defaults: QuickLink[] = [
      { id: "1", title: "Canvas", url: "https://canvas.instructure.com", icon: "school" },
      { id: "2", title: "Ladok", url: "https://www.student.ladok.se", icon: "book" },
      { id: "3", url: "https://www.google.se", title: "Sök", icon: "globe" },
    ];
    setLinks(defaults);
    localStorage.setItem("studiehubb.quick_links", JSON.stringify(defaults));
  }, []);

  const saveLinks = (nextLinks: QuickLink[]) => {
    setLinks(nextLinks);
    localStorage.setItem("studiehubb.quick_links", JSON.stringify(nextLinks));
  };

  const addLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    let formattedUrl = newUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = "https://" + formattedUrl;
    }

    const newItem: QuickLink = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      url: formattedUrl,
      icon: selectedIcon,
    };

    const next = [...links, newItem];
    saveLinks(next);
    setNewTitle("");
    setNewUrl("");
    setSelectedIcon("globe");
    setIsAdding(false);
    toast.success("Länk tillagd");
  };

  const deleteLink = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = links.filter((l) => l.id !== id);
    saveLinks(next);
    toast.success("Länk borttagen");
  };

  const renderIcon = (iconName?: string) => {
    const match = AVAILABLE_ICONS.find((i) => i.name === iconName);
    const IconComp = match ? match.Icon : Globe;
    return <IconComp className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-foreground" />;
  };

  return (
    <Card className="glass border-white/5 shadow-lg flex flex-col h-full min-h-[220px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-[var(--c-6)]" /> Snabblänkar
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className={cn("h-7 w-7 rounded-xl p-0 hover:bg-white/5", isEditing && "bg-white/10 text-primary")}
            onClick={() => {
              setIsEditing(!isEditing);
              setIsAdding(false);
            }}
            title="Redigera snabblänkar"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 rounded-xl p-0 hover:bg-white/5"
            onClick={() => {
              setIsAdding(!isAdding);
              setIsEditing(false);
            }}
            title="Lägg till länk"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between p-4 pt-0">
        {isAdding ? (
          <form onSubmit={addLink} className="space-y-2 mt-1">
            <div className="space-y-1">
              <Input
                placeholder="Namn (t.ex. Canvas)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="rounded-xl h-7 text-xs bg-background/50 border-white/5 px-2.5"
                required
              />
            </div>
            <div className="space-y-1">
              <Input
                placeholder="URL (t.ex. canvas.se)"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="rounded-xl h-7 text-xs bg-background/50 border-white/5 px-2.5"
                required
              />
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-9 gap-1">
                {AVAILABLE_ICONS.map((i) => {
                  const Icon = i.Icon;
                  const isSelected = selectedIcon === i.name;
                  return (
                    <button
                      key={i.name}
                      type="button"
                      onClick={() => setSelectedIcon(i.name)}
                      className={cn(
                        "flex items-center justify-center p-0 rounded-lg border text-muted-foreground hover:text-foreground transition-all cursor-pointer h-6 w-6 shrink-0",
                        isSelected ? "bg-primary/20 border-primary text-primary" : "border-white/5 bg-white/5"
                      )}
                      title={i.label}
                    >
                      <Icon className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" size="sm" variant="ghost" className="rounded-xl h-6 px-2 text-[10px] hover:bg-white/5" onClick={() => setIsAdding(false)}>
                Avbryt
              </Button>
              <Button type="submit" size="sm" className="rounded-xl h-6 px-2.5 text-[10px] gradient-sunset text-white">
                Spara
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {links.length === 0 && (
              <div className="col-span-2 py-6 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
                Inga länkar tillagda ännu.
              </div>
            )}
            {links.map((link) => {
              const content = (
                <>
                  {renderIcon(link.icon)}
                  <span className="min-w-0 flex-1 truncate font-medium">{link.title}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {isEditing ? (
                      <span
                        role="button"
                        className="p-0.5 text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                        onClick={(e) => deleteLink(link.id, e)}
                        title="Ta bort länk"
                      >
                        <Trash2 className="h-3 w-3" />
                      </span>
                    ) : (
                      <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                    )}
                  </div>
                </>
              );

              if (isEditing) {
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/5 px-2 py-1 text-[11px] h-7"
                  >
                    {content}
                  </div>
                );
              }

              return (
                <a
                  key={link.id}
                  href={link.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10 transition-colors h-7"
                >
                  {content}
                </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type TaskType =
  | "annat"
  | "inlamningsuppgift"
  | "kontrollskrivning"
  | "laboration"
  | "modul"
  | "quiz"
  | "redovisning"
  | "seminarie"
  | "tenta"
  | "ovning";

type TaskStatus = "todo" | "doing" | "done";
type TaskKind = "task" | "exam";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_at: string | null;
  course_id: string | null;
  task_type: TaskType;
  task_kind: TaskKind;
  grade: string | null;
  points: string | null;
  pending_review: boolean;
};

type Course = { id: string; name: string; color: string };

const TYPE_LABELS: Record<TaskType, string> = {
  annat: "Annat",
  inlamningsuppgift: "Inlämning",
  kontrollskrivning: "Kontrollskrivning",
  laboration: "Laboration",
  modul: "Modul",
  quiz: "Quiz",
  redovisning: "Redovisning",
  seminarie: "Seminarie",
  tenta: "Tenta",
  ovning: "Övning",
};
const TYPES_ALPHA: TaskType[] = [
  "annat",
  "inlamningsuppgift",
  "kontrollskrivning",
  "laboration",
  "modul",
  "quiz",
  "redovisning",
  "seminarie",
  "tenta",
  "ovning",
];
const EXAM_TYPES = new Set<TaskType>([
  "inlamningsuppgift",
  "kontrollskrivning",
  "laboration",
  "quiz",
  "redovisning",
  "seminarie",
  "tenta",
  "ovning",
]);

function TaskDialog({
  open, onOpenChange, courses, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courses: Course[];
  onSave: (v: Partial<Task>) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [courseId, setCourseId] = useState("none");
  const [type, setType] = useState<TaskType>("annat");
  const kind: TaskKind = EXAM_TYPES.has(type) ? "exam" : "task";

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setDueAt("");
      setCourseId("none");
      setType("annat");
    }
  }, [open]);

  const submit = () => {
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      course_id: courseId === "none" ? null : courseId,
      task_type: type,
      task_kind: kind,
      status: "todo",
      pending_review: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Ny {kind === "exam" ? "examination" : "uppgift"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
          <div className="space-y-1.5"><Label>Beskrivning</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <div className="space-y-1.5">
            <Label>Typ</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES_ALPHA.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Deadline</Label><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Kurs</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen kurs</SelectItem>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button disabled={!title.trim()} onClick={submit} className="gradient-sunset text-white hover:opacity-90">Spara</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Dashboard() {
  const { data: settings } = useUserSettings();
  const currentYear = settings?.current_year ?? null;

  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const createTask = useMutation({
    mutationFn: async (patch: Partial<Task>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { error } = await supabase.from("tasks").insert({
        user_id: u.user.id,
        title: patch.title ?? "",
        description: patch.description ?? null,
        due_at: patch.due_at ?? null,
        course_id: patch.course_id ?? null,
        task_type: patch.task_type ?? "annat",
        task_kind: patch.task_kind ?? "task",
        status: patch.status ?? "todo",
        pending_review: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Uppgift skapad!");
      setCreateOpen(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const [completeFor, setCompleteFor] = useState<Task | null>(null);

  const updateTaskStatus = useMutation({
    mutationFn: async (patch: Partial<Task> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase
        .from("tasks")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Status uppdaterad");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const courses = allCourses.filter((c) => !c.archived);
  const coursesMap = new Map(allCourses.map((c) => [c.id, c]));
  const { data: terms = [] } = useQuery(termsQuery);
  const { data: allTasks = [] } = useQuery(tasksQuery);
  const openTasks = allTasks.filter((t) => {
    if (t.status === "done") return false;
    if (t.course_id) {
      const course = coursesMap.get(t.course_id);
      if (course?.archived) return false;
    }
    return true;
  });
  const pendingReview = allTasks.filter((t) => {
    if (!t.pending_review || t.status === "done") return false;
    if (t.course_id) {
      const course = coursesMap.get(t.course_id);
      if (course?.archived) return false;
    }
    return true;
  });

  const activePeriod = todayPeriod(terms);
  const activeCourses = courses.filter((c) =>
    !c.completed && (currentYear === null || c.arskurs === null || c.arskurs === currentYear)
  );

  const groupedCourses = activeCourses.reduce((acc, c) => {
    const p = c.period || "Övriga";
    if (!acc[p]) acc[p] = [];
    acc[p].push(c);
    return acc;
  }, {} as Record<string, typeof courses>);

  const periodOrder = ["P1", "P2", "P3", "P4", "P5", "helar", "Övriga"];
  const sortedPeriods = Object.keys(groupedCourses).sort((a, b) => {
    const idxA = periodOrder.indexOf(a);
    const idxB = periodOrder.indexOf(b);
    const orderA = idxA !== -1 ? idxA : 999;
    const orderB = idxB !== -1 ? idxB : 999;
    return orderA - orderB;
  });


  const { data: weekEntries = [] } = useQuery({
    queryKey: ["time_entries", "week", weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("id,started_at,duration_seconds,course_id,source")
        .gte("started_at", weekStart.toISOString())
        .lte("started_at", weekEnd.toISOString());
      return (data ?? []) as TimeEntry[];
    },
  });

  const { data: weekSessions = [] } = useQuery({
    queryKey: ["study_sessions", "week", weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("id,course_id,planned_start,planned_end,actual_start,actual_end,completed")
        .eq("needs_review", false)
        .gte("planned_start", weekStart.toISOString())
        .lte("planned_start", weekEnd.toISOString());
      return (data ?? []) as Session[];
    },
  });

  const weekCombinedEntries = useMemo(() => {
    const out: Array<{ started_at: string; duration_seconds: number; course_id: string | null }> = [];
    for (const e of weekEntries) {
      if (e.source === "session") continue;
      if (e.course_id) {
        const course = coursesMap.get(e.course_id);
        if (course?.archived) continue;
      }
      out.push({
        started_at: e.started_at,
        duration_seconds: e.duration_seconds ?? 0,
        course_id: e.course_id,
      });
    }
    for (const s of weekSessions) {
      if (s.course_id) {
        const course = coursesMap.get(s.course_id);
        if (course?.archived) continue;
      }
      const start = s.actual_start ?? s.planned_start;
      const end = s.actual_end ?? s.planned_end;
      const dur = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
      out.push({
        started_at: start,
        duration_seconds: dur,
        course_id: s.course_id,
      });
    }
    return out;
  }, [weekEntries, weekSessions, coursesMap]);

  const { data: rawTodaysSessions = [] } = useQuery({
    queryKey: ["sessions", "today"],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_sessions")
        .select("id,planned_start,planned_end,completed,course_id")
        .eq("needs_review", false)
        .gte("planned_start", startOfDay(new Date()).toISOString())
        .lte("planned_start", endOfDay(new Date()).toISOString())
        .order("planned_start");
      return (data ?? []) as Session[];
    },
  });

  const todaysSessions = useMemo(() => {
    return rawTodaysSessions.filter((s) => {
      if (!s.course_id) return true;
      const course = coursesMap.get(s.course_id);
      return course ? !course.archived : true;
    });
  }, [rawTodaysSessions, coursesMap]);

  const todayTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (!t.due_at) return false;
      if (t.course_id) {
        const course = coursesMap.get(t.course_id);
        if (course?.archived) return false;
      }
      return isSameDay(parseISO(t.due_at), new Date());
    });
  }, [allTasks, coursesMap]);

  const loggedSecondsToday = useMemo(() => {
    return weekCombinedEntries
      .filter((e) => isSameDay(new Date(e.started_at), new Date()))
      .reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
  }, [weekCombinedEntries]);

  const plannedSecondsToday = useMemo(() => {
    return todaysSessions.reduce((acc, s) => {
      const start = new Date(s.planned_start).getTime();
      const end = new Date(s.planned_end).getTime();
      const diff = (end - start) / 1000;
      return acc + (diff > 0 ? diff : 0);
    }, 0);
  }, [todaysSessions]);

  const perDay = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(weekStart, i);
    const total = weekCombinedEntries
      .filter((e) => e.started_at >= startOfDay(d).toISOString() && e.started_at <= endOfDay(d).toISOString())
      .reduce((s, e) => s + e.duration_seconds, 0);
    return { d, hours: total / 3600 };
  });
  const maxDayH = Math.max(1, ...perDay.map((p) => p.hours));

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 6 ? "God natt" : hour < 12 ? "God morgon" : hour < 18 ? "God dag" : "God kväll";
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{format(now, "EEEE d MMMM", { locale: sv })}</div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            {greeting}. <span className="gradient-text">Vad ska vi jobba med idag?</span>
          </h1>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gradient-sunset text-white hover:opacity-90 rounded-xl sm:self-end gap-1.5 self-start">
          <Plus className="h-4 w-4" /> Ny uppgift
        </Button>
      </div>

      {/* Aktiva kurser */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Aktiva kurser</h2>
          <Link to="/courses" className="text-xs text-muted-foreground hover:text-foreground">Se alla →</Link>
        </div>
        {activeCourses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Inga kurser matchar aktuell årskurs. <Link to="/courses" className="underline">Lägg till en</Link>.
          </div>
        ) : (
          <div className="space-y-4">
            {sortedPeriods.map((periodName) => {
              const periodCourses = groupedCourses[periodName];
              if (!periodCourses || periodCourses.length === 0) return null;

              let displayPeriod = periodName;
              if (periodName.startsWith("P")) {
                displayPeriod = `Period ${periodName.slice(1)}`;
              } else if (periodName === "helar") {
                displayPeriod = "Helår";
              } else if (periodName === "Övriga") {
                displayPeriod = "Övriga kurser";
              }

              return (
                <div key={periodName} className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5 pl-1">
                    {displayPeriod}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {periodCourses.map((c) => {
                      const hoursThisWeek = weekCombinedEntries.filter((e) => e.course_id === c.id).reduce((s, e) => s + e.duration_seconds, 0) / 3600;
                      const goal = c.weekly_goal_hours ?? 0;
                      const pct = goal > 0 ? Math.min(100, (hoursThisWeek / goal) * 100) : 0;
                      return (
                        <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="group rounded-xl glass border-white/5 p-4 transition-colors hover:border-primary/40 hover:bg-white/5">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 shrink-0" style={{ color: c.color }} />
                            <span className="min-w-0 flex-1 truncate font-display font-semibold">{c.name}</span>
                          </div>
                          {goal > 0 ? (
                            <>
                              <div className="mt-3 flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Vecka</span>
                                <span className="tabular-nums">{hoursThisWeek.toFixed(2)} / {goal} h</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                              </div>
                            </>
                          ) : (
                            <div className="mt-3 text-xs text-muted-foreground">Inget veckomål · {hoursThisWeek.toFixed(2)} h denna vecka</div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Idag */}
        <Card className="glass border-white/5 shadow-lg">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Clock className="h-4 w-4" style={{ color: "var(--c-7)" }} /> Idag
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              {formatHoursCompact(plannedSecondsToday)} planerat
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Studiepass</div>
              {todaysSessions.length === 0 && <div className="text-sm text-muted-foreground">Inga planerade pass.</div>}
              {todaysSessions.map((s) => {
                const c = courses.find((c) => c.id === s.course_id);
                return (
                  <div key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5">
                    <GraduationCap className="h-3.5 w-3.5" style={{ color: c?.color ?? "var(--sunset-violet)" }} />
                    <span className="tabular-nums text-xs text-muted-foreground">{format(parseISO(s.planned_start), "HH:mm")}–{format(parseISO(s.planned_end), "HH:mm")}</span>
                    <span className="min-w-0 flex-1 truncate">{c?.name ?? "Ingen kurs"}</span>
                    {s.completed && <span className="text-[10px] uppercase font-bold" style={{ color: "var(--c-7)" }}>Klart</span>}
                  </div>
                );
              })}
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Deadlines idag</div>
              {todayTasks.length === 0 && <div className="text-sm text-muted-foreground">Inga deadlines idag.</div>}
              {todayTasks.map((t) => {
                const c = courses.find((x) => x.id === t.course_id);
                
                const statusConfig: Record<TaskStatus, { label: string; style: string }> = {
                  todo: { label: "Ej startad", style: "border-sunset-rose/30 text-sunset-rose bg-sunset-rose/10 hover:bg-sunset-rose/20" },
                  doing: { label: "Pågår", style: "border-sunset-amber/30 text-sunset-amber bg-sunset-amber/10 hover:bg-sunset-amber/20" },
                  done: { label: "Klar", style: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20" },
                };
                let statusInfo = statusConfig[t.status] || statusConfig.todo;
                if (t.pending_review) {
                  statusInfo = { label: "Väntar på bedömning", style: "border-sunset-amber/30 text-sunset-amber bg-sunset-amber/10 hover:bg-sunset-amber/20" };
                }

                const toggleStatus = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (t.pending_review) {
                    setCompleteFor(t);
                  } else if (t.status === "todo") {
                    updateTaskStatus.mutate({ id: t.id, status: "doing", pending_review: false });
                  } else if (t.status === "doing") {
                    if (t.task_type === "annat" || t.task_type === "modul") {
                      updateTaskStatus.mutate({ id: t.id, status: "done", pending_review: false, grade: "-", points: "-" });
                    } else {
                      setCompleteFor(t);
                    }
                  } else {
                    updateTaskStatus.mutate({ id: t.id, status: "todo", pending_review: false, grade: null, points: null });
                  }
                };

                return (
                  <Link key={t.id} to="/tasks" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c?.color ?? "var(--sunset-violet)" }} />
                    <span className="tabular-nums text-xs text-muted-foreground shrink-0">
                      {t.due_at ? format(parseISO(t.due_at), "HH:mm") : "--:--"}
                    </span>
                    <span className="rounded-full border border-white/5 bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">
                      {TYPE_LABELS[t.task_type]}
                    </span>
                    <button
                      type="button"
                      onClick={toggleStatus}
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[9px] font-medium transition-all shrink-0 cursor-pointer",
                        statusInfo.style
                      )}
                      title="Klicka för att ändra status"
                    >
                      {statusInfo.label}
                    </button>
                    <span className={cn("min-w-0 flex-1 truncate", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</span>
                    {c && (
                      <span className="text-[10px] text-muted-foreground/60 truncate max-w-[80px] shrink-0 font-medium">
                        {c.name}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Denna vecka */}
        <Card className="glass border-white/5 shadow-lg">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" style={{ color: "var(--c-10)" }} /> Denna vecka
            </CardTitle>
            <Link to="/stats" className="text-xs text-muted-foreground hover:text-foreground">Statistik →</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Studietid</div>
              <div className="flex items-end gap-1.5">
                {perDay.map((p) => (
                  <div key={p.d.toISOString()} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-16 w-full items-end">
                      <div className="w-full rounded-t bg-gradient-to-t from-[var(--c-10)] to-[var(--c-6)]" style={{ height: `${Math.max(4, (p.hours / maxDayH) * 100)}%` }} />
                    </div>
                    <div className={`text-[10px] uppercase ${isSameDay(p.d, new Date()) ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{format(p.d, "EEEEE", { locale: sv })}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/5 px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><ListTodo className="h-3.5 w-3.5 text-sunset-amber" /> Uppgifter kvar</span>
              <span className="tabular-nums font-semibold">{openTasks.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/5 px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" style={{ color: "var(--c-10)" }} /> Total studietid</span>
              <span className="tabular-nums font-semibold">{formatHoursCompact(weekCombinedEntries.reduce((s, e) => s + e.duration_seconds, 0))}</span>
            </div>
          </CardContent>
        </Card>

        {/* Snabblänkar */}
        <QuickLinksCard />
      </div>


      {/* Kommande uppgifter */}
      <Card className="mt-6 glass border-white/5 shadow-lg">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <ListTodo className="h-4 w-4" style={{ color: "var(--c-4)" }} /> Kommande uppgifter
          </CardTitle>
          <Link to="/tasks" className="text-xs text-muted-foreground hover:text-foreground">Se alla →</Link>
        </CardHeader>
        <CardContent>
          {openTasks.length === 0 && <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">Inga öppna uppgifter. Bra jobbat!</div>}
          <div className="space-y-1">
            {openTasks.slice(0, 8).map((t) => {
              return (
                <Link key={t.id} to="/tasks" className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-white/5">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {t.task_kind === "exam" && <span className="rounded-full bg-sunset-rose/20 px-1.5 py-0.5 text-[9px] uppercase text-sunset-rose">Exam</span>}
                  {t.due_at && (
                    <span className="text-xs text-muted-foreground">{format(new Date(t.due_at), "d MMM", { locale: sv })}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <TaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        courses={courses}
        onSave={(v) => createTask.mutate(v)}
      />
      <CompleteDialog
        task={completeFor}
        onClose={() => setCompleteFor(null)}
        onPending={(t) => {
          updateTaskStatus.mutate({ id: t.id, pending_review: true, status: "todo" });
          setCompleteFor(null);
        }}
        onDone={(t, grade, points) => {
          const patch: Record<string, any> = { id: t.id, grade, points, pending_review: false };
          if (grade.trim() && points.trim()) {
            patch.status = "done";
          }
          updateTaskStatus.mutate(patch as Partial<Task> & { id: string });
          setCompleteFor(null);
        }}
      />
    </div>
  );
}

function CompleteDialog({
  task, onClose, onPending, onDone,
}: {
  task: Task | null;
  onClose: () => void;
  onPending: (t: Task) => void;
  onDone: (t: Task, grade: string, points: string) => void;
}) {
  const [grade, setGrade] = useState("");
  const [points, setPoints] = useState("");
  useEffect(() => { setGrade(task?.grade ?? ""); setPoints(task?.points ?? ""); }, [task]);
  if (!task) return null;
  const noGrade = task.task_type === "annat" || task.task_type === "modul";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="font-display">Markera som klar</DialogTitle></DialogHeader>
        {noGrade ? (
          <p className="text-sm text-muted-foreground">Uppgiften markeras som klar utan betyg eller poäng.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Fyll i betyg och poäng. Använd <code>-</code> om det inte gäller. När båda är ifyllda markeras uppgiften som klar.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Betyg</Label><Input autoFocus value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="A / 5 / -" /></div>
              <div className="space-y-1.5"><Label>Poäng</Label><Input value={points} onChange={(e) => setPoints(e.target.value)} placeholder="18/20 / -" /></div>
            </div>
          </>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Avbryt</Button>
          {!noGrade && <Button variant="outline" onClick={() => onPending(task)}>Väntar på bedömning</Button>}
          <Button onClick={() => onDone(task, grade, points)} className="gradient-sunset text-white hover:opacity-90">Spara</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
