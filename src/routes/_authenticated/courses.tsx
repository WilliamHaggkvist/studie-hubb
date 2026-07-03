import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, BookOpen, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { PALETTE, DEFAULT_COURSE_ICONS, COURSE_PERIODS, ARSKURS_OPTIONS } from "@/lib/course-presets";
import { useUniversities } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/courses")({
  component: CoursesPage,
});

type CourseRow = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  icon: string | null;
  archived: boolean;
  hp: number | null;
  period: string | null;
  arskurs: number | null;
  university_id: string | null;
  weekly_goal_hours: number | null;
  completed: boolean;
  final_grade: string | null;
};

function CoursesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: universities = [] } = useUniversities();

  // form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState<string>(PALETTE[1].value);
  const [icon, setIcon] = useState<string>(DEFAULT_COURSE_ICONS[0]);
  const [hp, setHp] = useState<string>("");
  const [period, setPeriod] = useState<string>("");
  const [arskurs, setArskurs] = useState<string>("");
  const [universityId, setUniversityId] = useState<string>("");
  const [weeklyGoal, setWeeklyGoal] = useState<string>("");

  function resetForm() {
    setName(""); setCode(""); setHp(""); setPeriod(""); setArskurs("");
    setUniversityId(""); setWeeklyGoal("");
    setColor(PALETTE[1].value); setIcon(DEFAULT_COURSE_ICONS[0]);
  }

  const { data: courses = [] } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id,name,code,color,icon,archived,hp,period,arskurs,university_id,weekly_goal_hours,completed,final_grade")
        .order("created_at");
      return (data ?? []) as CourseRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const { data, error } = await supabase.from("courses").insert({
        user_id: u.user.id,
        name: name.trim(),
        code: code.trim() || null,
        color, icon,
        hp: hp ? Number(hp) : null,
        period: (period || null) as "P1" | "P2" | "P3" | "P4" | "P5" | null,
        arskurs: arskurs ? Number(arskurs) : null,
        university_id: universityId || null,
        weekly_goal_hours: weeklyGoal ? Number(weeklyGoal) : 0,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["courses", "all"] });
      toast.success("Kurs tillagd");
      setOpen(false); resetForm();
      navigate({ to: "/courses/$courseId", params: { courseId: id } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const toggleArchive = useMutation({
    mutationFn: async (c: CourseRow) => {
      const { error } = await supabase.from("courses").update({ archived: !c.archived }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });

  const active = courses.filter((c) => !c.archived);
  const archived = courses.filter((c) => c.archived);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Kurser</h1>
          <p className="text-sm text-muted-foreground">Organisera dina studier per kurs.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-1 rounded-xl"><Plus className="h-4 w-4" /> Ny kurs</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg glass rounded-2xl">
            <DialogHeader><DialogTitle className="font-display">Ny kurs</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label>Namn</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="T.ex. Analys i en variabel" className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kurskod</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MMG200" className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Högskolepoäng</Label>
                  <Input type="number" step="0.5" value={hp} onChange={(e) => setHp(e.target.value)} placeholder="7.5" className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Period</Label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Välj period" /></SelectTrigger>
                    <SelectContent>{COURSE_PERIODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Årskurs</Label>
                  <Select value={arskurs} onValueChange={setArskurs}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Välj årskurs" /></SelectTrigger>
                    <SelectContent>{ARSKURS_OPTIONS.map((a) => <SelectItem key={a} value={String(a)}>Årskurs {a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Universitet</Label>
                <Select value={universityId} onValueChange={setUniversityId}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Välj universitet" /></SelectTrigger>
                  <SelectContent>{universities.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Veckomål (h)</Label>
                <Input type="number" step="0.5" value={weeklyGoal} onChange={(e) => setWeeklyGoal(e.target.value)} placeholder="ex. 8" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Ikon</Label>
                <div className="flex flex-wrap gap-1">
                  {DEFAULT_COURSE_ICONS.map((i) => (
                    <button type="button" key={i} onClick={() => setIcon(i)} className={cn("grid h-9 w-9 place-items-center rounded-xl border text-lg transition", icon === i ? "border-primary bg-surface-2" : "border-border/60 hover:bg-surface")}>{i}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Färg</Label>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map((c) => (
                    <button type="button" key={c.value} onClick={() => setColor(c.value)} className={cn("h-8 w-8 rounded-full border-2 transition", color === c.value ? "border-foreground scale-110" : "border-transparent")} style={{ background: c.value }} title={c.name} />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" className="rounded-xl" onClick={() => setOpen(false)}>Avbryt</Button>
              <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()} className="rounded-xl">Skapa kurs</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {active.length === 0 && (
        <Card className="border-dashed border-border/60 bg-surface/40 rounded-2xl">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary"><BookOpen className="h-6 w-6" /></div>
            <div>
              <div className="font-display text-lg font-semibold">Inga kurser än</div>
              <div className="text-sm text-muted-foreground">Lägg till dina kurser för terminen för att komma igång.</div>
            </div>
            <Button onClick={() => setOpen(true)} className="gap-1 rounded-xl"><Plus className="h-4 w-4" /> Skapa första kursen</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate({ to: "/courses/$courseId", params: { courseId: c.id } })}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-surface/60 backdrop-blur-md p-5 text-left transition-all hover:border-transparent hover:shadow-lg hover:shadow-black/40"
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
            <div className="mb-2 flex items-center justify-between">
              <span className="text-3xl">{c.icon}</span>
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.color, boxShadow: `0 0 20px ${c.color}80` }} />
            </div>
            <div className="font-display text-lg font-semibold flex items-center gap-1.5">
              {c.name}
              {c.completed && <CheckCircle2 className="h-4 w-4 text-c-7" />}
            </div>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {c.code && <span>{c.code}</span>}
              {c.hp != null && <span>• {c.hp} HP</span>}
              {c.period && <span>• {c.period}</span>}
              {c.arskurs != null && <span>• Åk {c.arskurs}</span>}
            </div>
          </button>
        ))}
      </div>

      {archived.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Arkiverade</h2>
          <div className="space-y-1">
            {archived.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/40 px-3 py-2 text-sm">
                <span>{c.icon}</span>
                <span className="flex-1 text-muted-foreground">{c.name}</span>
                <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => toggleArchive.mutate(c)}>Återställ</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// silence unused type import warnings
void Textarea;
