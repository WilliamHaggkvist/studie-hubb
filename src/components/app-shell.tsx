import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore, useEffect, useState, type ReactNode } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { supabase } from "@/integrations/supabase/client";
import { useUserSettings } from "@/lib/settings";
import { coursesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { timerStore, formatDuration } from "@/lib/timer-store";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  ChevronDown,
  Clock,
  FileText,
  Home,
  ListTodo,
  Plus,
  Search,
  LogOut,
  Play,
  Square,
  Menu,
  X,
  BarChart3,
  Star,
  Settings,
  StickyNote,
  Lightbulb,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";

type PageRow = {
  id: string;
  title: string;
  icon: string | null;
  parent_id: string | null;
  course_id: string | null;
  is_favorite: boolean;
  sort_order: number;
};
type CourseRow = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  code: string | null;
  period: string | null;
  periods: string[] | null;
  arskurs: number | null;
  completed: boolean;
};

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const checkNotifications = async () => {
      if (localStorage.getItem("web_notifications_enabled") !== "true") return;
      if (Notification.permission !== "granted") return;

      const now = new Date();

      // Check for study sessions
      if (localStorage.getItem("web_notify_sessions_enabled") !== "false") {
        const sessionsMins = parseInt(localStorage.getItem("web_notify_sessions_minutes") || "10", 10);
        if (!isNaN(sessionsMins) && sessionsMins >= 0) {
          try {
            const { data: sessions } = await supabase
              .from("study_sessions")
              .select("id, planned_start, completed")
              .eq("completed", false)
              .eq("needs_review", false)
              .gte("planned_start", now.toISOString())
              .lte("planned_start", new Date(now.getTime() + sessionsMins * 60 * 1000).toISOString());

            if (sessions && sessions.length > 0) {
              for (const session of sessions) {
                const key = `notified_session_${session.id}`;
                if (!localStorage.getItem(key)) {
                  new Notification("Studiepass startar snart!", {
                    body: `Ett av dina planerade studiepass startar om mindre än ${sessionsMins} minuter.`,
                    icon: "/favicon.ico"
                  });
                  localStorage.setItem(key, "true");
                }
              }
            }
          } catch (err) {
            console.error("Error checking sessions for notifications:", err);
          }
        }
      }

      // Check for tasks due
      if (localStorage.getItem("web_notify_tasks_enabled") !== "false") {
        const tasksMins = parseInt(localStorage.getItem("web_notify_tasks_minutes") || "60", 10);
        if (!isNaN(tasksMins) && tasksMins >= 0) {
          try {
            const { data: tasks } = await supabase
              .from("tasks")
              .select("id, title, due_at, status")
              .neq("status", "done")
              .gte("due_at", now.toISOString())
              .lte("due_at", new Date(now.getTime() + tasksMins * 60 * 1000).toISOString());

            if (tasks && tasks.length > 0) {
              for (const task of tasks) {
                const key = `notified_task_${task.id}`;
                if (!localStorage.getItem(key)) {
                  new Notification("Deadline närmar sig!", {
                    body: `Uppgiften "${task.title}" har deadline om mindre än ${tasksMins} minuter.`,
                    icon: "/favicon.ico"
                  });
                  localStorage.setItem(key, "true");
                }
              }
            }
          } catch (err) {
            console.error("Error checking tasks for notifications:", err);
          }
        }
      }
    };

    // Run immediately and then every 2 minutes
    checkNotifications();
    const interval = setInterval(checkNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Ambient background blobs for liquid glass feel */}
      <div className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] h-[600px] w-[600px] rounded-full bg-[#f9c74f]/07 blur-[130px] animate-blob-1" />
        <div className="absolute top-[45%] -right-[10%] h-[600px] w-[600px] rounded-full bg-[#43aa8b]/08 blur-[130px] animate-blob-2" />
        <div className="absolute -bottom-[10%] left-[20%] h-[600px] w-[600px] rounded-full bg-[#277da1]/08 blur-[130px] animate-blob-3" />
      </div>

      {/* Sidebar — desktop */}
      <aside className="hidden w-72 shrink-0 border-r border-sidebar-border/30 bg-sidebar/55 backdrop-blur-xl lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-sidebar-border/30 bg-sidebar/70 backdrop-blur-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto relative">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: settings } = useUserSettings();
  const currentYear = settings?.current_year ?? null;

  const { data: courses = [] } = useQuery(coursesQuery);

  // Filter to active courses for current year, sorted by period
  const periodOrder = ["P1", "P2", "P3", "P4", "P5"];
  const sidebarCourses = courses
    .filter((c) => !c.completed)
    .filter((c) => currentYear == null || c.arskurs === currentYear)
    .sort((a, b) => {
      const ia = a.period ? periodOrder.indexOf(a.period) : 999;
      const ib = b.period ? periodOrder.indexOf(b.period) : 999;
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

  const { data: pages = [] } = useQuery({
    queryKey: ["pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages")
        .select("id,title,icon,parent_id,course_id,is_favorite,sort_order")
        .eq("archived", false)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PageRow[];
    },
  });

  const createPage = useMutation({
    mutationFn: async (parent_id: string | null) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("No user");
      const { data, error } = await supabase
        .from("pages")
        .insert({ user_id: u.user.id, parent_id, title: "Utan titel" })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      navigate({ to: "/notes/$noteId", params: { noteId: id } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Kunde inte skapa sida"),
  });

  const rootPages = pages.filter((p) => !p.parent_id && !p.course_id);
  const favorites = pages.filter((p) => p.is_favorite);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary text-sm font-bold border border-primary/30">
          S
        </div>
        <div className="min-w-0">
          <div className="font-display text-sm font-bold tracking-tight">StudieHubb</div>
          <div className="truncate text-xs text-muted-foreground">Din arbetsyta</div>
        </div>
      </div>

      <nav className="px-2">
        <NavItem
          to="/dashboard"
          icon={<Home className="h-4 w-4" />}
          label="Översikt"
          activeColor="var(--c-7)"
        />
        <NavItem
          to="/tasks"
          icon={<ListTodo className="h-4 w-4" />}
          label="Uppgifter"
          activeColor="var(--c-4)"
        />
        <NavItem
          to="/calendar"
          icon={<Calendar className="h-4 w-4" />}
          label="Kalender"
          activeColor="var(--c-10)"
        />
        <NavItem
          to="/time"
          icon={<Clock className="h-4 w-4" />}
          label="Studietid"
          activeColor="var(--c-5)"
        />
        <NavItem
          to="/stats"
          icon={<BarChart3 className="h-4 w-4" />}
          label="Statistik"
          activeColor="var(--c-6)"
        />
        <NavItem
          to="/notes"
          icon={<StickyNote className="h-4 w-4" />}
          label="Anteckningar"
          activeColor="var(--c-8)"
        />
        <NavItem
          to="/tips"
          icon={<Lightbulb className="h-4 w-4" />}
          label="Tips och guider"
          activeColor="var(--c-3)"
        />
        <NavItem
          to="/settings"
          icon={<Settings className="h-4 w-4" />}
          label="Inställningar"
          activeColor="var(--c-9)"
        />
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-4">
        {favorites.length > 0 && (
          <Section label="Favoriter">
            {favorites.map((p) => (
              <PageLink key={p.id} page={p} />
            ))}
          </Section>
        )}

        <Section label="Kurser" labelLink="/courses">
          {sidebarCourses.length === 0 && (
            <Link
              to="/courses"
              className="mx-2 block rounded-md border border-dashed border-sidebar-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              + Lägg till din första kurs
            </Link>
          )}
          {sidebarCourses.map((c) => (
            <CourseNode key={c.id} course={c} />
          ))}
        </Section>
      </div>

      <UserFooter />
    </div>
  );
}

function Section({
  label,
  action,
  children,
  labelLink,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
  labelLink?: string;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {labelLink ? (
          <Link to={labelLink} className="hover:text-foreground transition-colors cursor-pointer">
            {label}
          </Link>
        ) : (
          <span>{label}</span>
        )}
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  activeColor,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  activeColor: string;
}) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground transition-colors",
        active
          ? "bg-sidebar-accent text-foreground"
          : "hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <span
        className="text-muted-foreground group-hover:text-foreground transition-colors"
        style={active ? { color: activeColor } : undefined}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function CourseNode({ course }: { course: CourseRow }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const active = pathname === `/courses/${course.id}`;
  return (
    <Link
      to="/courses/$courseId"
      params={{ courseId: course.id }}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground transition-colors",
        active
          ? "bg-sidebar-accent text-foreground"
          : "hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <GraduationCap className="h-4 w-4 shrink-0" style={{ color: course.color }} />
      <span className="truncate">{course.name}</span>
      {course.code && (
        <span className="ml-auto shrink-0 text-[10px] text-sidebar-foreground/60">
          {course.code}
        </span>
      )}
    </Link>
  );
}

function PageLink({ page }: { page: PageRow }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const active = pathname === `/notes/${page.id}`;
  return (
    <Link
      to="/notes/$noteId"
      params={{ noteId: page.id }}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1 text-sm text-sidebar-foreground",
        active
          ? "bg-sidebar-accent text-foreground"
          : "hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <span className="text-sm">{page.icon || "📄"}</span>
      <span className="truncate">{page.title || "Utan titel"}</span>
      {page.is_favorite && <Star className="ml-auto h-3 w-3 fill-sunset-amber text-sunset-amber" />}
    </Link>
  );
}

function PageTree({
  page,
  allPages,
  depth,
}: {
  page: PageRow;
  allPages: PageRow[];
  depth: number;
}) {
  const children = allPages.filter((p) => p.parent_id === page.id);
  const [open, setOpen] = useState(depth < 1);
  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded-md pl-1 pr-2 hover:bg-sidebar-accent/60"
        style={{ marginLeft: depth * 10 }}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground",
            children.length === 0 && "opacity-0",
          )}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <PageLink page={page} />
      </div>
      {open &&
        children.map((c) => <PageTree key={c.id} page={c} allPages={allPages} depth={depth + 1} />)}
    </div>
  );
}

function UserFooter() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState<string>("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="border-t border-sidebar-border px-3 py-3">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/20 text-primary text-xs font-bold border border-primary/30">
          {email.slice(0, 1).toUpperCase() || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        </div>
        <button
          onClick={signOut}
          className="rounded p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          title="Logga ut"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-white/5 bg-background/55 px-3 backdrop-blur-xl lg:px-6">
      <button
        onClick={onMenuClick}
        className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <GlobalSearch />
      <div className="flex-1" />
      <TimerWidget />
    </header>
  );
}

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const navigate = useNavigate();

  type SearchResult = {
    id: string;
    title: string;
    icon?: string | null;
    type: "note" | "task" | "course";
    courseColor?: string;
    archived?: boolean;
    completed?: boolean;
  };

  const { data: results = [] } = useQuery({
    queryKey: ["search", debouncedQ],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!debouncedQ.trim()) return [];

      const [pagesRes, tasksRes, coursesRes] = await Promise.all([
        supabase
          .from("pages")
          .select("id,title,icon")
          .ilike("title", `%${debouncedQ}%`)
          .eq("archived", false)
          .limit(5),
        supabase
          .from("tasks")
          .select("id,title,course_id")
          .ilike("title", `%${debouncedQ}%`)
          .limit(5),
        supabase
          .from("courses")
          .select("id,name,code,color,icon,archived,completed")
          .or(`name.ilike.%${debouncedQ}%,code.ilike.%${debouncedQ}%`)
          .limit(5),
      ]);

      const list: SearchResult[] = [];

      if (coursesRes.data) {
        for (const c of coursesRes.data) {
          list.push({
            id: c.id,
            title: c.code ? `${c.code} - ${c.name}` : c.name,
            icon: c.icon || "📚",
            type: "course",
            courseColor: c.color,
            archived: c.archived,
            completed: c.completed,
          });
        }
      }

      if (tasksRes.data) {
        for (const t of tasksRes.data) {
          list.push({
            id: t.id,
            title: t.title,
            icon: "📋",
            type: "task",
          });
        }
      }

      if (pagesRes.data) {
        for (const p of pagesRes.data) {
          list.push({
            id: p.id,
            title: p.title || "Utan titel",
            icon: p.icon || "📝",
            type: "note",
          });
        }
      }

      return list;
    },
    enabled: debouncedQ.trim().length > 0,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-border/60 bg-surface px-3 text-sm text-muted-foreground hover:border-border">
          <Search className="h-4 w-4" />
          <span>Sök…</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
        <div className="border-b border-border/60 p-2">
          <Input
            autoFocus
            placeholder="Sök efter kurser, uppgifter, anteckningar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {results.length === 0 && q && (
            <div className="p-3 text-sm text-muted-foreground">Inga träffar</div>
          )}
          {!q && (
            <div className="p-3 text-sm text-muted-foreground">
              Sök på kurser, uppgifter eller anteckningar.
            </div>
          )}
          {results.map((r) => (
            <button
              key={`${r.type}:${r.id}`}
              onClick={() => {
                setOpen(false);
                setQ("");
                if (r.type === "course") {
                  navigate({ to: "/courses/$courseId", params: { courseId: r.id } });
                } else if (r.type === "task") {
                  navigate({ to: "/tasks" });
                } else {
                  navigate({ to: "/notes/$noteId", params: { noteId: r.id } });
                }
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <div className="flex items-center gap-2 min-w-0">
                {r.type === "course" ? (
                  <GraduationCap className="h-4 w-4 shrink-0" style={{ color: r.courseColor }} />
                ) : r.type === "task" ? (
                  <ListTodo className="h-4 w-4 shrink-0 text-sunset-amber" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-purple-400" />
                )}
                <span className="truncate">{r.title}</span>
              </div>
              <span
                className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  r.type === "course"
                    ? r.archived
                      ? "bg-muted text-muted-foreground"
                      : r.completed
                        ? "bg-c-7/15 text-c-7 border border-c-7/30"
                        : "bg-primary/10 text-primary"
                    : r.type === "task"
                      ? "bg-sunset-amber/10 text-sunset-amber"
                      : "bg-purple-500/10 text-purple-400"
                }`}
              >
                {r.type === "course"
                  ? r.archived
                    ? "Kurs (Arkiv)"
                    : r.completed
                      ? "Kurs (Avklarad)"
                      : "Kurs"
                  : r.type === "task"
                    ? "Uppgift"
                    : "Anteckning"}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimerWidget() {
  const qc = useQueryClient();
  const running = useSyncExternalStore(
    timerStore.subscribe,
    timerStore.getSnapshot,
    timerStore.getServerSnapshot,
  );
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState<string>("none");
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id,name,color,completed")
        .eq("archived", false)
        .eq("completed", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: courseTasks = [] } = useQuery({
    queryKey: ["tasks", "for-course", courseId],
    enabled: courseId !== "none",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,status")
        .eq("course_id", courseId)
        .neq("status", "done")
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function start() {
    timerStore.start({
      courseId: courseId === "none" ? null : courseId,
      taskIds,
      description,
    });
    setOpen(false);
    setTaskIds([]);
    toast.success("Timer startad");
  }

  async function stop() {
    const prev = timerStore.stop();
    if (!prev) return;
    const endedAt = new Date();
    const startedAt = new Date(prev.startedAt);
    const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
    if (duration < 5) {
      toast.info("Timer stoppad (under 5s – sparades inte)");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const { data: sessionData, error: sessionError } = await supabase
      .from("study_sessions")
      .insert({
        user_id: u.user.id,
        course_id: prev.courseId,
        completed: true,
        needs_review: false,
        source: "local",
        notes: prev.description || null,
        planned_start: startedAt.toISOString(),
        planned_end: endedAt.toISOString(),
        actual_start: startedAt.toISOString(),
        actual_end: endedAt.toISOString(),
      })
      .select("id")
      .single();

    if (!sessionError && sessionData && prev.taskIds.length > 0) {
      const taskRows = prev.taskIds.map((task_id) => ({
        session_id: sessionData.id,
        task_id,
        user_id: u.user!.id,
      }));
      const { error: tasksError } = await supabase.from("study_session_tasks").insert(taskRows);
      if (tasksError) {
        toast.error(tasksError.message);
      }
    }

    if (sessionError) {
      toast.error(sessionError.message);
    } else {
      toast.success(`Tid sparad: ${formatDuration(duration)}`);
      qc.invalidateQueries({ queryKey: ["study_sessions"] });
      qc.invalidateQueries({ queryKey: ["study_session_tasks"] });
      qc.invalidateQueries({ queryKey: ["time_entries"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    }
  }

  if (running) {
    const seconds = Math.floor((now - running.startedAt) / 1000);
    const course = courses.find((c) => c.id === running.courseId);
    return (
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-1 text-sm sm:flex">
          {course && (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: course.color }}
            />
          )}
          <span className="font-mono tabular-nums text-foreground">{formatDuration(seconds)}</span>
          {course && <span className="truncate text-xs text-muted-foreground">{course.name}</span>}
        </div>
        <Button size="sm" variant="destructive" onClick={stop} className="gap-1">
          <Square className="h-3.5 w-3.5" /> Stopp
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" className="gap-1 gradient-sunset text-white hover:opacity-90">
          <Play className="h-3.5 w-3.5" /> Starta timer
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div className="text-sm font-semibold">Ny tidssession</div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Kurs</label>
            <Select
              value={courseId}
              onValueChange={(v) => {
                setCourseId(v);
                setTaskIds([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj kurs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ingen kurs</SelectItem>
                {courses
                  .filter((c) => !c.completed)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {courseId !== "none" && courseTasks.length > 0 && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Uppgifter (valfritt)
              </label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
                {courseTasks.map((t) => {
                  const checked = taskIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setTaskIds((prev) =>
                            e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                          );
                        }}
                      />
                      <span className="truncate">{t.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Beskrivning (valfritt)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="T.ex. Läsa kap 3"
            />
          </div>
          <Button className="w-full gradient-sunset text-white hover:opacity-90" onClick={start}>
            <Play className="mr-1 h-3.5 w-3.5" /> Starta
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
