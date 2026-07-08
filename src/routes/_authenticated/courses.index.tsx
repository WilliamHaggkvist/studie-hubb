import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, BookOpen, CheckCircle2 } from "lucide-react";
import { PALETTE, DEFAULT_COURSE_ICONS, COURSE_PERIODS, ARSKURS_OPTIONS } from "@/lib/course-presets";
import { useUniversities } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { coursesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/courses/")({
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
  const [icon, setIcon] = useState<string>(DEFAULT_COURSE_ICONS[0]);
  const [hp, setHp] = useState<string>("");
  const [period, setPeriod] = useState<string>("");
  const [arskurs, setArskurs] = useState<string>("");
  const [universityId, setUniversityId] = useState<string>("");
  const [weeklyGoal, setWeeklyGoal] = useState<string>("");

  function resetForm() {
    setName(""); setCode(""); setHp(""); setPeriod(""); setArskurs("");
    setUniversityId(""); setWeeklyGoal("");
    setIcon(DEFAULT_COURSE_ICONS[0]);
  }



  const { data: courses = [] } = useQuery(coursesQuery);


  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const colors = ["#f94144", "#f3722c", "#f8961e", "#f9844a", "#f9c74f", "#90be6d", "#43aa8b", "#4d908e", "#577590", "#277da1"];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const { data, error } = await supabase.from("courses").insert({
        user_id: u.user.id,
        name: name.trim(),
        code: code.trim() || null,
        color: randomColor,
        icon,
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



  const active = courses.filter((c) => !c.completed && !c.archived);
  const completed = courses.filter((c) => c.completed && !c.archived);
  const archived = courses.filter((c) => c.archived);

  // Group active courses by period
  const groupedCourses = active.reduce((acc, c) => {
    const p = c.period || "Övriga";
    if (!acc[p]) acc[p] = [];
    acc[p].push(c);
    return acc;
  }, {} as Record<string, typeof active>);

  const periodOrder = ["P1", "P2", "P3", "P4", "P5", "helar", "Övriga"];
  const sortedPeriods = Object.keys(groupedCourses).sort((a, b) => {
    const idxA = periodOrder.indexOf(a);
    const idxB = periodOrder.indexOf(b);
    const orderA = idxA !== -1 ? idxA : 999;
    const orderB = idxB !== -1 ? idxB : 999;
    return orderA - orderB;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Kurser</h1>
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
            </div>
            <DialogFooter>
              <Button variant="ghost" className="rounded-xl" onClick={() => setOpen(false)}>Avbryt</Button>
              <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()} className="rounded-xl">Skapa kurs</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-[380px] grid-cols-3 rounded-xl bg-surface-2 p-1 mb-6">
          <TabsTrigger value="active" className="rounded-lg text-xs flex items-center gap-1.5 py-1.5">
            Aktiva <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{active.length}</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg text-xs flex items-center gap-1.5 py-1.5">
            Avklarade <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{completed.length}</span>
          </TabsTrigger>
          <TabsTrigger value="archived" className="rounded-lg text-xs flex items-center gap-1.5 py-1.5">
            Arkiv <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{archived.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {active.length === 0 ? (
            <Card className="border-dashed border-border/60 bg-surface/40 rounded-2xl">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary"><BookOpen className="h-6 w-6" /></div>
                <div>
                  <div className="font-display text-lg font-semibold">Inga aktiva kurser</div>
                  <div className="text-sm text-muted-foreground">Alla dina kurser är avklarade eller inaktiva!</div>
                </div>
                <Button onClick={() => setOpen(true)} className="gap-1 rounded-xl"><Plus className="h-4 w-4" /> Skapa ny kurs</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
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
                  <div key={periodName} className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5 pl-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                      {displayPeriod}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {periodCourses.map((c) => (
                        <div key={c.id} className="group relative">
                          <Link
                            to="/courses/$courseId"
                            params={{ courseId: c.id }}
                            aria-label={`Öppna ${c.name}`}
                            className="relative block w-full overflow-hidden rounded-2xl border border-border/60 bg-surface/60 backdrop-blur-md p-5 text-left transition-all hover:border-transparent hover:shadow-lg hover:shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <div className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-3xl">{c.icon}</span>
                            </div>
                            <div className="font-display text-lg font-semibold flex items-center gap-1.5">
                              {c.name}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                              {c.code && <span>{c.code}</span>}
                              {c.hp != null && <span>• {c.hp} HP</span>}
                              {c.period && <span>• {c.period}</span>}
                              {c.arskurs != null && <span>• Åk {c.arskurs}</span>}
                            </div>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-6">
          {completed.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-12 text-center text-sm text-muted-foreground">
              Inga avklarade kurser än. När du markerar en kurs som avklarad hamnar den här!
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completed.map((c) => (
                <div key={c.id} className="group relative">
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: c.id }}
                    aria-label={`Öppna ${c.name}`}
                    className="relative block w-full overflow-hidden rounded-2xl border border-border/60 bg-surface/60 backdrop-blur-md p-5 text-left transition-all hover:border-transparent hover:shadow-lg hover:shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-c-7" />
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-3xl">{c.icon}</span>
                      {c.final_grade && (
                        <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                          Betyg: {c.final_grade}
                        </span>
                      )}
                    </div>
                    <div className="font-display text-lg font-semibold flex items-center gap-1.5">
                      {c.name}
                      <CheckCircle2 className="h-4 w-4 text-c-7 shrink-0" />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.code && <span>{c.code}</span>}
                      {c.hp != null && <span>• {c.hp} HP</span>}
                      {c.period && <span>• {c.period}</span>}
                      {c.arskurs != null && <span>• Åk {c.arskurs}</span>}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="space-y-6">
          {archived.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-12 text-center text-sm text-muted-foreground">
              Inga inaktiva kurser eller utkast i arkivet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {archived.map((c) => (
                <div key={c.id} className="group relative">
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: c.id }}
                    aria-label={`Öppna ${c.name}`}
                    className="relative block w-full overflow-hidden rounded-2xl border border-border/60 bg-surface/60 backdrop-blur-md p-5 text-left transition-all hover:border-transparent hover:shadow-lg hover:shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-3xl">{c.icon}</span>
                    </div>
                    <div className="font-display text-lg font-semibold flex items-center gap-1.5">
                      {c.name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.code && <span>{c.code}</span>}
                      {c.hp != null && <span>• {c.hp} HP</span>}
                      {c.period && <span>• {c.period}</span>}
                      {c.arskurs != null && <span>• Åk {c.arskurs}</span>}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}

// silence unused type import warnings
void Textarea;
