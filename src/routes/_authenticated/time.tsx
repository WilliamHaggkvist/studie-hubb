import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDuration, formatHoursCompact } from "@/lib/timer-store";
import { format, parseISO, startOfDay, isSameDay } from "date-fns";
import { sv } from "date-fns/locale";
import { Plus, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/time")({
  component: TimePage,
});

type Entry = {
  id: string;
  course_id: string | null;
  task_id: string | null;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  source: string;
};
type Course = { id: string; name: string; color: string };

function TimePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState("none");
  const [description, setDescription] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id,name,color").eq("archived", false);
      return (data ?? []) as Course[];
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["time_entries", "list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("id,course_id,task_id,description,started_at,ended_at,duration_seconds,source")
        .not("duration_seconds", "is", null)
        .order("started_at", { ascending: false })
        .limit(100);
      return (data ?? []) as Entry[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const s = new Date(startedAt);
      const e = new Date(endedAt);
      const dur = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
      const { error } = await supabase.from("time_entries").insert({
        user_id: u.user.id,
        course_id: courseId === "none" ? null : courseId,
        description: description.trim() || null,
        started_at: s.toISOString(),
        ended_at: e.toISOString(),
        duration_seconds: dur,
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time_entries"] });
      setOpen(false); setCourseId("none"); setDescription(""); setStartedAt(""); setEndedAt("");
      toast.success("Tidspost tillagd");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time_entries"] }),
  });

  // Group by day
  const grouped = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = format(startOfDay(parseISO(e.started_at)), "yyyy-MM-dd");
    const arr = grouped.get(key) ?? [];
    arr.push(e);
    grouped.set(key, arr);
  }

  const total7Days = entries
    .filter((e) => new Date(e.started_at).getTime() > Date.now() - 7 * 24 * 3600 * 1000)
    .reduce((s, e) => s + (e.duration_seconds ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Tid</h1>
          <p className="text-sm text-muted-foreground">Historik och manuella tidsposter — <span className="text-sunset-amber">{formatHoursCompact(total7Days)}</span> senaste 7 dagarna.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1 gradient-sunset text-white hover:opacity-90"><Plus className="h-4 w-4" /> Manuell tid</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Manuell tidspost</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Kurs</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen kurs</SelectItem>
                    {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Beskrivning</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Start</Label><Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} /></div>
                <div className="space-y-2"><Label>Slut</Label><Input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
              <Button disabled={!startedAt || !endedAt} onClick={() => create.mutate()} className="gradient-sunset text-white hover:opacity-90">Spara</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 p-12 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <div className="font-display text-lg">Ingen tid loggad än</div>
          <p className="mt-1 text-sm text-muted-foreground">Starta en timer i toppfältet eller lägg till manuellt.</p>
        </div>
      )}

      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([day, list]) => {
          const total = list.reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
          const d = parseISO(day);
          return (
            <div key={day}>
              <div className="mb-2 flex items-baseline justify-between">
                <div className="font-display text-sm font-semibold">
                  {isSameDay(d, new Date()) ? "Idag" : format(d, "EEEE d MMMM", { locale: sv })}
                </div>
                <div className="font-mono tabular-nums text-xs text-muted-foreground">{formatHoursCompact(total)}</div>
              </div>
              <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/60 bg-surface/40">
                {list.map((e) => {
                  const c = courses.find((cc) => cc.id === e.course_id);
                  return (
                    <div key={e.id} className="group flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: c?.color ?? "var(--muted-foreground)" }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{e.description || (c?.name ?? "Studietid")}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {c?.name && `${c.name} • `}
                          {format(parseISO(e.started_at), "HH:mm")}
                          {e.ended_at && `–${format(parseISO(e.ended_at), "HH:mm")}`}
                          {e.source === "manual" && " • manuell"}
                          {e.source === "calendar" && " • från kalender"}
                        </div>
                      </div>
                      <div className="font-mono tabular-nums text-xs text-muted-foreground">
                        {formatDuration(e.duration_seconds ?? 0)}
                      </div>
                      <button onClick={() => remove.mutate(e.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
