import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
};

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar — desktop */}
      <aside className="hidden w-72 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id,name,color,icon")
        .eq("archived", false)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CourseRow[];
    },
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
      navigate({ to: "/pages/$pageId", params: { pageId: id } });
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
          <div className="font-display text-sm font-bold tracking-tight">StudyOS</div>
          <div className="truncate text-xs text-muted-foreground">Din arbetsyta</div>
        </div>
      </div>

      <nav className="px-2">
        <NavItem to="/dashboard" icon={<Home className="h-4 w-4" />} label="Översikt" />
        <NavItem to="/tasks" icon={<ListTodo className="h-4 w-4" />} label="Uppgifter" />
        <NavItem to="/calendar" icon={<Calendar className="h-4 w-4" />} label="Kalender" />
        <NavItem to="/time" icon={<Clock className="h-4 w-4" />} label="Studietid" />
        <NavItem to="/stats" icon={<BarChart3 className="h-4 w-4" />} label="Statistik" />
        <NavItem to="/settings" icon={<Settings className="h-4 w-4" />} label="Inställningar" />
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-4">
        {favorites.length > 0 && (
          <Section label="Favoriter">
            {favorites.map((p) => (
              <PageLink key={p.id} page={p} />
            ))}
          </Section>
        )}

        <Section
          label="Kurser"
          action={
            <Link
              to="/courses"
              className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              title="Hantera kurser"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {courses.length === 0 && (
            <Link
              to="/courses"
              className="mx-2 block rounded-md border border-dashed border-sidebar-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              + Lägg till din första kurs
            </Link>
          )}
          {courses.map((c) => (
            <CourseNode key={c.id} course={c} pages={pages.filter((p) => p.course_id === c.id)} />
          ))}
        </Section>

        <Section
          label="Sidor"
          action={
            <button
              onClick={() => createPage.mutate(null)}
              className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              title="Ny sida"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          }
        >
          {rootPages.length === 0 && (
            <button
              onClick={() => createPage.mutate(null)}
              className="mx-2 block w-[calc(100%-1rem)] rounded-md border border-dashed border-sidebar-border px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              + Skapa din första sida
            </button>
          )}
          {rootPages.map((p) => (
            <PageTree key={p.id} page={p} allPages={pages} depth={0} />
          ))}
        </Section>
      </div>

      <UserFooter />
    </div>
  );
}

function Section({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
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
      <span className={cn("text-muted-foreground group-hover:text-foreground", active && "text-sunset-coral")}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function CourseNode({ course, pages }: { course: CourseRow; pages: PageRow[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div className="group flex items-center gap-1 rounded-md px-1 py-1 text-sm hover:bg-sidebar-accent/60">
        <button onClick={() => setOpen((o) => !o)} className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <Link
          to="/courses/$courseId"
          params={{ courseId: course.id }}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: course.color }} />
          <span className="text-sm">{course.icon || "📚"}</span>
          <span className="truncate">{course.name}</span>
        </Link>
      </div>
      {open && (
        <div className="ml-5 border-l border-sidebar-border/50 pl-1">
          {pages.length === 0 && (
            <div className="px-3 py-1 text-xs text-muted-foreground/70">Inga sidor än</div>
          )}
          {pages.map((p) => (
            <PageLink key={p.id} page={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PageLink({ page }: { page: PageRow }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const active = pathname === `/pages/${page.id}`;
  return (
    <Link
      to="/pages/$pageId"
      params={{ pageId: page.id }}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1 text-sm text-sidebar-foreground",
        active ? "bg-sidebar-accent text-foreground" : "hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <span className="text-sm">{page.icon || "📄"}</span>
      <span className="truncate">{page.title || "Utan titel"}</span>
      {page.is_favorite && <Star className="ml-auto h-3 w-3 fill-sunset-amber text-sunset-amber" />}
    </Link>
  );
}

function PageTree({ page, allPages, depth }: { page: PageRow; allPages: PageRow[]; depth: number }) {
  const children = allPages.filter((p) => p.parent_id === page.id);
  const [open, setOpen] = useState(depth < 1);
  return (
    <div>
      <div className="group flex items-center gap-1 rounded-md pl-1 pr-2 hover:bg-sidebar-accent/60" style={{ marginLeft: depth * 10 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn("grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground", children.length === 0 && "opacity-0")}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <PageLink page={page} />
      </div>
      {open && children.map((c) => <PageTree key={c.id} page={c} allPages={allPages} depth={depth + 1} />)}
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
        <button onClick={signOut} className="rounded p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" title="Logga ut">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-xl lg:px-6">
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
  const navigate = useNavigate();
  const { data: results = [] } = useQuery({
    queryKey: ["search", q],
    queryFn: async () => {
      if (!q.trim()) return [];
      const { data, error } = await supabase
        .from("pages")
        .select("id,title,icon")
        .ilike("title", `%${q}%`)
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: q.trim().length > 0,
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-border/60 bg-surface px-3 text-sm text-muted-foreground hover:border-border">
          <Search className="h-4 w-4" />
          <span>Sök sidor…</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
        <div className="border-b border-border/60 p-2">
          <Input autoFocus placeholder="Sök i alla sidor…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {results.length === 0 && q && <div className="p-3 text-sm text-muted-foreground">Inga träffar</div>}
          {!q && <div className="p-3 text-sm text-muted-foreground">Börja skriv för att söka bland dina sidor.</div>}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setOpen(false);
                setQ("");
                navigate({ to: "/pages/$pageId", params: { pageId: r.id } });
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span>{r.icon || "📄"}</span>
              <span className="truncate">{r.title || "Utan titel"}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimerWidget() {
  const qc = useQueryClient();
  const running = useSyncExternalStore(timerStore.subscribe, timerStore.getSnapshot, timerStore.getServerSnapshot);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState<string>("none");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id,name,color").eq("archived", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function start() {
    timerStore.start({ courseId: courseId === "none" ? null : courseId, description });
    setOpen(false);
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
    const { error } = await supabase.from("time_entries").insert({
      user_id: u.user.id,
      course_id: prev.courseId,
      task_id: prev.taskId,
      description: prev.description || null,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_seconds: duration,
      source: "timer",
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Tid sparad: ${formatDuration(duration)}`);
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
          {course && <span className="inline-block h-2 w-2 rounded-full" style={{ background: course.color }} />}
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
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <div className="text-sm font-semibold">Ny tidssession</div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Kurs</label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Välj kurs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ingen kurs</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Beskrivning (valfritt)</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="T.ex. Läsa kap 3" />
          </div>
          <Button className="w-full gradient-sunset text-white hover:opacity-90" onClick={start}>
            <Play className="mr-1 h-3.5 w-3.5" /> Starta
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
