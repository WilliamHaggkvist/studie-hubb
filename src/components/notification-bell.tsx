import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, X, AlertTriangle, CircleAlert, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserSettings } from "@/lib/settings";
import {
  coursesQuery,
  tasksQuery,
  reportingModulesQuery,
  enrollmentsQuery,
  termsQuery,
} from "@/lib/queries";
import { buildNotifications, type AppNotification, type SessionLite } from "@/lib/notifications";
import { getExistingSubscription } from "@/lib/push";
import { useCsnPeriods } from "@/lib/csn";
import type { DeviceLite } from "@/lib/notifications";
import { cn } from "@/lib/utils";

type StateRow = { key: string; read_at: string | null; dismissed_at: string | null };

export function NotificationBell() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [pushOnDevice, setPushOnDevice] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const csn = useCsnPeriods();
  const csnPeriods = (csn as { data?: unknown }).data as import("@/lib/csn").CsnPeriod[] | undefined;

  useEffect(() => {
    let id = localStorage.getItem("studiehubb_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("studiehubb_device_id", id);
    }
    setDeviceId(id);
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase.from("user_devices").upsert(
        { user_id: u.user.id, device_id: id!, user_agent: navigator.userAgent, last_seen_at: new Date().toISOString() },
        { onConflict: "user_id,device_id" },
      );
      qc.invalidateQueries({ queryKey: ["user_devices"] });
    })();
  }, [qc]);
  const { data: devices = [] } = useQuery({
    queryKey: ["user_devices"],
    queryFn: async (): Promise<DeviceLite[]> => {
      const { data, error } = await supabase.from("user_devices").select("device_id,user_agent,first_seen_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: typeof window !== "undefined",
  });

  useEffect(() => {
    getExistingSubscription()
      .then((s) => setPushOnDevice(!!s))
      .catch(() => setPushOnDevice(null));
    const i = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(i);
  }, []);

  const { data: courses = [] } = useQuery(coursesQuery);
  const { data: tasks = [] } = useQuery(tasksQuery);
  const { data: modules = [] } = useQuery(reportingModulesQuery);
  const { data: enrollments = [] } = useQuery(enrollmentsQuery);
  const { data: terms = [] } = useQuery(termsQuery);
  const { data: settings } = useUserSettings();
  const { data: sessions = [] } = useQuery({
    queryKey: ["study_sessions", "notif"],
    queryFn: async (): Promise<SessionLite[]> => {
      const from = new Date(Date.now() - 60 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("study_sessions")
        .select("id,course_id,planned_start,planned_end,actual_start,actual_end,needs_review,completed,created_at")
        .gte("planned_start", from);
      if (error) throw error;
      return data ?? [];
    },
    enabled: typeof window !== "undefined",
  });
  const { data: states = [] } = useQuery({
    queryKey: ["notification_states"],
    queryFn: async (): Promise<StateRow[]> => {
      const { data, error } = await supabase
        .from("notification_states")
        .select("key,read_at,dismissed_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: typeof window !== "undefined",
  });

  const all = useMemo(
    () =>
      buildNotifications({
        courses,
        tasks,
        modules,
        enrollments,
        sessions,
        terms,
        settings,
        pushOnThisDevice: pushOnDevice,
        csnPeriods,
        devices,
        currentDeviceId: deviceId,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses, tasks, modules, enrollments, sessions, terms, settings, pushOnDevice, tick, csnPeriods, devices, deviceId],
  );
  const stateMap = useMemo(() => new Map(states.map((s) => [s.key, s])), [states]);
  const visible = all.filter((n) => !stateMap.get(n.key)?.dismissed_at);
  const unread = visible.filter((n) => !stateMap.get(n.key)?.read_at);

  const upsert = async (keys: string[], patch: Partial<StateRow>) => {
    if (!keys.length) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase
      .from("notification_states")
      .upsert(keys.map((key) => ({ user_id: u.user!.id, key, ...stateMap.get(key), ...patch })), {
        onConflict: "user_id,key",
      });
    qc.invalidateQueries({ queryKey: ["notification_states"] });
  };
  const now = () => new Date().toISOString();
  const markRead = (k: string) => upsert([k], { read_at: now() });
  const dismiss = (k: string) => upsert([k], { dismissed_at: now(), read_at: now() });
  const markAll = () => upsert(unread.map((n) => n.key), { read_at: now() });

  const groups: { label: string; sev: AppNotification["severity"] }[] = [
    { label: "Brådskande", sev: "urgent" },
    { label: "Att åtgärda", sev: "action" },
    { label: "Info", sev: "info" },
  ];

  const list = (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <span className="font-display text-sm font-semibold">Notiser</span>
        {unread.length > 0 && (
          <button onClick={markAll} className="text-xs text-muted-foreground hover:text-foreground">
            Markera alla som lästa
          </button>
        )}
      </div>
      <div className="overflow-y-auto">
        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Allt ser bra ut – inga notiser.
          </p>
        )}
        {groups.map((g) => {
          const items = visible.filter((n) => n.severity === g.sev);
          if (!items.length) return null;
          return (
            <div key={g.sev} className="py-1">
              <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </div>
              {items.map((n) => {
                const isUnread = !stateMap.get(n.key)?.read_at;
                const Icon =
                  n.severity === "urgent" ? AlertTriangle : n.severity === "action" ? CircleAlert : Info;
                return (
                  <div
                    key={n.key}
                    className="group flex items-start gap-3 px-4 py-2.5 hover:bg-accent/50"
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        n.severity === "urgent"
                          ? "text-destructive"
                          : n.severity === "action"
                            ? "text-primary"
                            : "text-muted-foreground",
                      )}
                    />
                    <Link
                      to={n.to as never}
                      params={n.params as never}
                      onClick={() => {
                        markRead(n.key);
                        setOpen(false);
                      }}
                      className="min-w-0 flex-1"
                    >
                      <div className={cn("text-sm", isUnread ? "font-medium text-foreground" : "text-muted-foreground")}>
                        {n.title}
                      </div>
                      {n.body && <div className="truncate text-xs text-muted-foreground">{n.body}</div>}
                    </Link>
                    <div className="flex shrink-0 gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      {isUnread && (
                        <button
                          title="Markera som läst"
                          onClick={() => markRead(n.key)}
                          className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        title="Avfärda"
                        onClick={() => dismiss(n.key)}
                        className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  const trigger = (
    <button
      aria-label="Notiser"
      onClick={isMobile ? () => setOpen(true) : undefined}
      className="relative grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-surface hover:text-foreground"
    >
      <Bell className="h-5 w-5" />
      {unread.length > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {unread.length > 99 ? "99+" : unread.length}
        </span>
      )}
    </button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Notiser</SheetTitle>
            </SheetHeader>
            {list}
          </SheetContent>
        </Sheet>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        {list}
      </PopoverContent>
    </Popover>
  );
}
