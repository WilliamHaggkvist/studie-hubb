import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { addDays, addMonths, endOfMonth, format, getDay, isSameDay, isSameMonth, startOfMonth, subMonths, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

type EventRow = {
  id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  course_id: string | null;
  source: string;
  counts_as_study: boolean;
};
type Course = { id: string; name: string; color: string };

function CalendarPage() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);

  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);
  const gridStart = addDays(start, -((getDay(start) + 6) % 7));
  const days = Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i));

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id,name,color").eq("archived", false);
      return (data ?? []) as Course[];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events", format(cursor, "yyyy-MM")],
    queryFn: async () => {
      const { data } = await supabase
        .from("calendar_events")
        .select("id,title,location,starts_at,ends_at,all_day,course_id,source,counts_as_study")
        .gte("starts_at", gridStart.toISOString())
        .lte("starts_at", addDays(gridStart, 42).toISOString())
        .order("starts_at");
      return (data ?? []) as EventRow[];
    },
  });

  const { data: tasksDue = [] } = useQuery({
    queryKey: ["tasks", "due", format(cursor, "yyyy-MM")],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,due_at,course_id,status")
        .gte("due_at", gridStart.toISOString())
        .lte("due_at", addDays(gridStart, 42).toISOString());
      return data ?? [];
    },
  });

  // Add event
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [courseId, setCourseId] = useState("none");
  const [countsAsStudy, setCountsAsStudy] = useState(true);

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { error } = await supabase.from("calendar_events").insert({
        user_id: u.user.id,
        title: title.trim(),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt || startsAt).toISOString(),
        course_id: courseId === "none" ? null : courseId,
        counts_as_study: countsAsStudy,
        source: "local",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setOpen(false); setTitle(""); setStartsAt(""); setEndsAt(""); setCourseId("none");
      toast.success("Händelse tillagd");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const selectedEvents = events.filter((e) => isSameDay(parseISO(e.starts_at), selected));
  const selectedTasks = tasksDue.filter((t) => t.due_at && isSameDay(parseISO(t.due_at), selected));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Kalender</h1>
          <p className="text-sm text-muted-foreground">Se dina uppgifter, deadlines och studiehändelser.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-[10rem] text-center font-display text-lg">{format(cursor, "MMMM yyyy", { locale: sv })}</div>
          <Button variant="ghost" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => { setCursor(new Date()); setSelected(new Date()); }}>Idag</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 gradient-sunset text-white hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Ny händelse</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Ny händelse</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Start</Label><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Slut</Label><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Kurs</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen kurs</SelectItem>
                      {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={countsAsStudy} onCheckedChange={(v) => setCountsAsStudy(!!v)} />
                  Räkna in tiden i kursens studiestatistik
                </label>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
                <Button disabled={!title.trim() || !startsAt || create.isPending} onClick={() => create.mutate()} className="gradient-sunset text-white hover:opacity-90">Skapa</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-surface/40">
          <div className="grid grid-cols-7 border-b border-border/60 bg-surface/60 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {["Mån","Tis","Ons","Tor","Fre","Lör","Sön"].map((d) => (
              <div key={d} className="px-2 py-2 text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {days.map((d) => {
              const inMonth = isSameMonth(d, cursor);
              const dayEvents = events.filter((e) => isSameDay(parseISO(e.starts_at), d));
              const dayTasks = tasksDue.filter((t) => t.due_at && isSameDay(parseISO(t.due_at), d));
              const isSel = isSameDay(d, selected);
              const isToday = isSameDay(d, new Date());
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelected(d)}
                  className={cn(
                    "flex min-h-[6rem] flex-col gap-1 border-b border-r border-border/40 p-1.5 text-left transition-colors",
                    !inMonth && "bg-background/40 text-muted-foreground/50",
                    isSel && "bg-surface-2",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "grid h-6 w-6 place-items-center rounded-full text-xs font-medium",
                      isToday && "gradient-sunset text-white",
                    )}>{format(d, "d")}</span>
                    {(dayEvents.length + dayTasks.length) > 0 && (
                      <span className="text-[9px] text-muted-foreground">{dayEvents.length + dayTasks.length}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => {
                      const c = courses.find((c) => c.id === e.course_id);
                      return (
                        <div key={e.id} className="truncate rounded px-1 py-0.5 text-[10px]" style={{ background: `${c?.color ?? "#8B5CF6"}33`, color: c?.color ?? "var(--sunset-violet)" }}>
                          {format(parseISO(e.starts_at), "HH:mm")} {e.title}
                        </div>
                      );
                    })}
                    {dayTasks.slice(0, 3 - Math.min(3, dayEvents.length)).map((t) => (
                      <div key={t.id} className="truncate rounded border border-dashed px-1 py-0.5 text-[10px] text-sunset-amber" style={{ borderColor: "var(--sunset-amber)" }}>
                        ⚑ {t.title}
                      </div>
                    ))}
                    {dayEvents.length + dayTasks.length > 3 && <div className="text-[9px] text-muted-foreground">+{dayEvents.length + dayTasks.length - 3} till</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-xl border border-border/60 bg-surface/40 p-4">
          <div className="mb-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{format(selected, "EEEE", { locale: sv })}</div>
            <div className="font-display text-2xl font-bold">{format(selected, "d MMMM", { locale: sv })}</div>
          </div>
          {selectedEvents.length === 0 && selectedTasks.length === 0 && (
            <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">Inget planerat.</div>
          )}
          <div className="space-y-2">
            {selectedEvents.map((e) => {
              const c = courses.find((c) => c.id === e.course_id);
              return (
                <div key={e.id} className="rounded-lg border border-border/60 bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{e.title}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(e.starts_at), "HH:mm")}–{format(parseISO(e.ends_at), "HH:mm")}
                      </div>
                      {c && <div className="mt-1 inline-flex items-center gap-1 text-xs" style={{ color: c.color }}><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />{c.name}</div>}
                    </div>
                    {e.counts_as_study && <span className="rounded-full bg-sunset-coral/20 px-2 py-0.5 text-[9px] uppercase tracking-wider text-sunset-coral">Studie</span>}
                  </div>
                </div>
              );
            })}
            {selectedTasks.map((t) => (
              <div key={t.id} className="rounded-lg border border-dashed border-sunset-amber/60 bg-surface p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-sunset-amber">Deadline</div>
                <div>{t.title}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
            <div className="mb-1 font-semibold text-foreground">Google Calendar</div>
            Koppla din Google-kalender för att importera föreläsningar och tentor. Studiehändelser räknas in i tid per kurs.
            <div className="mt-2 text-[10px] italic">Kommer i nästa etapp.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
