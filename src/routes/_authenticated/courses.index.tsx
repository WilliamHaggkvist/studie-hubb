import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, GraduationCap, CheckCircle2, BookOpen, AlertTriangle, Trash2 } from "lucide-react";
import {
  PALETTE,
  COURSE_PERIODS,
  ARSKURS_OPTIONS,
  PERIOD_TO_TERM,
  TERM_LABELS,
  sortPeriods,
  firstPeriod,
  formatPeriods,
  type CoursePeriod,
  type Term,
} from "@/lib/course-presets";
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
  periods: string[] | null;
  arskurs: number | null;
  university_id: string | null;
  weekly_goal_hours: number | null;
  completed: boolean;
  final_grade: string | null;
  is_standalone: boolean;
  mode: "campus" | "distans";
};

import {
  EnrollmentsEditor,
  emptyEnrollment,
  type EnrollmentDraft,
} from "@/components/courses/enrollments-editor";
import { mirroredCourseFields, saveEnrollments } from "@/lib/enrollments";

function CoursesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: universities = [] } = useUniversities();

  // form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [hp, setHp] = useState<string>("");
  const [enrollments, setEnrollments] = useState<EnrollmentDraft[]>([emptyEnrollment()]);
  const [universityId, setUniversityId] = useState<string>("");
  const [weeklyGoal, setWeeklyGoal] = useState<string>("");
  const [isStandalone, setIsStandalone] = useState(false);
  const [mode, setMode] = useState<"campus" | "distans">("campus");
  const [teacherName, setTeacherName] = useState("");
  const [teacherContact, setTeacherContact] = useState("");
  const [literature, setLiterature] = useState("");
  const [modules, setModules] = useState<Array<{ name: string; hp: string }>>([]);
  const [color, setColor] = useState("");

  function resetForm() {
    setName("");
    setCode("");
    setHp("");
    setEnrollments([emptyEnrollment()]);
    setUniversityId("");
    setWeeklyGoal("");
    setIsStandalone(false);
    setMode("campus");
    setTeacherName("");
    setTeacherContact("");
    setLiterature("");
    setModules([]);
    setColor("");
  }

  const { data: courses = [] } = useQuery(coursesQuery);

  const trimmedName = name.trim().toLowerCase();
  const trimmedCode = code.trim().toLowerCase();

  const duplicateNameCourse = trimmedName
    ? courses.find((c) => c.name.trim().toLowerCase() === trimmedName)
    : undefined;

  const duplicateCodeCourse = trimmedCode
    ? courses.find((c) => c.code && c.code.trim().toLowerCase() === trimmedCode)
    : undefined;

  const nameExists = Boolean(duplicateNameCourse);
  const codeExists = Boolean(duplicateCodeCourse);
  const hasDuplicate = nameExists || codeExists;

  const activeModules = modules.filter((m) => m.name.trim());
  const moduleHpSum = activeModules.reduce((sum, m) => sum + (Number(m.hp) || 0), 0);
  const courseHp = hp ? Number(hp) : null;
  const hpMismatch =
    activeModules.length > 0 &&
    (courseHp === null || Math.abs(moduleHpSum - courseHp) > 0.001);

  const create = useMutation({
    mutationFn: async () => {
      if (hasDuplicate) {
        if (nameExists && codeExists) {
          throw new Error("En kurs med samma namn och kurskod finns redan");
        }
        if (nameExists) {
          throw new Error(`En kurs med namnet "${duplicateNameCourse?.name}" finns redan`);
        }
        throw new Error(`En kurs med kurskoden "${duplicateCodeCourse?.code}" finns redan`);
      }
      if (hpMismatch) {
        throw new Error(
          courseHp === null
            ? "Ange kursens högskolepoäng innan du lägger till rapporteringsmoment"
            : `Momenten summerar till ${moduleHpSum} hp men kursen är ${courseHp} hp`,
        );
      }
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("no user");
      const usedColors = courses.filter((c) => !c.archived).map((c) => c.color);
      const availableColors = PALETTE.filter((p) => !usedColors.includes(p.value));
      const chosenColor = color
        ? color
        : availableColors.length > 0
          ? availableColors[0].value
          : PALETTE[Math.floor(Math.random() * PALETTE.length)].value;
      const { data, error } = await supabase
        .from("courses")
        .insert({
          user_id: u.user.id,
          name: name.trim(),
          code: code.trim() || null,
          color: chosenColor,
          hp: hp ? Number(hp) : null,
          ...mirroredCourseFields(enrollments),
          university_id: universityId || null,
          weekly_goal_hours: weeklyGoal ? Number(weeklyGoal) : 0,
          literature: literature.trim() || null,
          teacher_name: teacherName.trim() || null,
          teacher_contact: teacherContact.trim() || null,
          is_standalone: isStandalone,
          mode,
        })
        .select("id")
        .single();
      if (error) throw error;

      for (let i = 0; i < activeModules.length; i++) {
        const m = activeModules[i];
        const payload = { name: m.name.trim(), hp: Number(m.hp) || 0, sort_order: i };
        const { error: insError } = await supabase
          .from("course_reporting_modules")
          .insert({ ...payload, course_id: data.id as string, user_id: u.user.id });
        if (insError) throw insError;
      }

      await saveEnrollments({
        courseId: data.id as string,
        userId: u.user.id,
        rows: enrollments,
        existing: [],
      });
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["course_reporting_modules"] });
      qc.invalidateQueries({ queryKey: ["course_reg_enrollments"] });
      qc.invalidateQueries({ queryKey: ["courses", "all"] });
      toast.success("Kurs tillagd");
      setOpen(false);
      resetForm();
      navigate({ to: "/courses/$courseId", params: { courseId: id } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  const toggleArchive = useMutation({
    mutationFn: async (c: CourseRow) => {
      const { error } = await supabase
        .from("courses")
        .update({ archived: !c.archived })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });

  const active = courses.filter((c) => !c.completed && !c.archived);
  const completed = courses.filter((c) => c.completed && !c.archived);
  const archived = courses.filter((c) => c.archived);

  // Auto-assign unique palette colors to active courses if there are duplicate or legacy colors
  useEffect(() => {
    if (!courses || courses.length === 0) return;
    const activeCourses = courses.filter((c) => !c.archived && !c.completed);
    if (activeCourses.length === 0) return;

    const validPaletteValues = new Set<string>(PALETTE.map((p) => p.value));
    const usedColors = new Set<string>();
    const updates: { id: string; color: string }[] = [];

    const availablePaletteColors = PALETTE.map((p) => p.value);

    for (const course of activeCourses) {
      if (validPaletteValues.has(course.color) && !usedColors.has(course.color)) {
        usedColors.add(course.color);
      } else {
        const nextColor = availablePaletteColors.find((col) => !usedColors.has(col)) || PALETTE[usedColors.size % PALETTE.length].value;
        usedColors.add(nextColor);
        updates.push({ id: course.id, color: nextColor });
      }
    }

    if (updates.length > 0) {
      Promise.all(
        updates.map((u) =>
          supabase.from("courses").update({ color: u.color }).eq("id", u.id),
        ),
      ).then(() => {
        qc.invalidateQueries({ queryKey: ["courses"] });
      });
    }
  }, [courses, qc]);

  // Group active courses by period
  const groupedCourses = active.reduce(
    (acc, c) => {
      const p = c.period || "Övriga";
      if (!acc[p]) acc[p] = [];
      acc[p].push(c);
      return acc;
    },
    {} as Record<string, typeof active>,
  );

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
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-1 rounded-xl">
              <Plus className="h-4 w-4" /> Ny kurs
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg glass rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Ny kurs</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              {hasDuplicate && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Kan inte skapa kurs</AlertTitle>
                  <AlertDescription>
                    {nameExists && codeExists
                      ? `En kurs med samma namn ("${duplicateNameCourse?.name}") och kurskod ("${duplicateCodeCourse?.code}") finns redan.`
                      : nameExists
                      ? `En kurs med namnet "${duplicateNameCourse?.name}" finns redan.`
                      : `En kurs med kurskoden "${duplicateCodeCourse?.code}" finns redan.`}
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label className={cn(nameExists && "text-destructive font-medium")}>
                  Namn {nameExists && "(finns redan)"}
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="T.ex. Analys i en variabel"
                  className={cn("rounded-xl", nameExists && "border-destructive focus-visible:ring-destructive")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className={cn(codeExists && "text-destructive font-medium")}>
                    Kurskod {codeExists && "(finns redan)"}
                  </Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="MMG200"
                    className={cn("rounded-xl", codeExists && "border-destructive focus-visible:ring-destructive")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Högskolepoäng</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={hp}
                    onChange={(e) => setHp(e.target.value)}
                    placeholder="7.5"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <EnrollmentsEditor rows={enrollments} onChange={setEnrollments} />
              <div className="space-y-1.5">
                <Label>Universitet</Label>
                <Select value={universityId} onValueChange={setUniversityId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Välj universitet" />
                  </SelectTrigger>
                  <SelectContent>
                    {universities.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kurstyp</Label>
                  <Select
                    value={isStandalone ? "standalone" : "program"}
                    onValueChange={(v) => setIsStandalone(v === "standalone")}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Välj typ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="program">Programkurs</SelectItem>
                      <SelectItem value="standalone">Fristående kurs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Undervisningsform</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as "campus" | "distans")}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Välj form" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="campus">Campus</SelectItem>
                      <SelectItem value="distans">Distans</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Veckomål (h)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={weeklyGoal}
                    onChange={(e) => setWeeklyGoal(e.target.value)}
                    placeholder="ex. 8"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Lärare (namn)</Label>
                <Input
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Lärarens kontakt (e-post, tel, …)</Label>
                <Input
                  value={teacherContact}
                  onChange={(e) => setTeacherContact(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kurslitteratur</Label>
                <Textarea
                  rows={4}
                  value={literature}
                  onChange={(e) => setLiterature(e.target.value)}
                  className="rounded-xl"
                  placeholder="En bok per rad, gärna med författare och upplaga…"
                />
              </div>
              <div className="space-y-2 rounded-xl border border-border/60 bg-surface/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>Rapporteringsmoment</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 rounded-lg text-xs"
                    onClick={() => setModules([...modules, { name: "", hp: "" }])}
                  >
                    <Plus className="h-3.5 w-3.5" /> Lägg till
                  </Button>
                </div>
                {modules.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Inga moment. Lägg till t.ex. TEN1, LAB1 med respektive högskolepoäng.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {modules.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={m.name}
                          placeholder="TEN1"
                          onChange={(e) =>
                            setModules(
                              modules.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                            )
                          }
                          className="rounded-xl"
                        />
                        <Input
                          type="number"
                          step="0.5"
                          value={m.hp}
                          placeholder="hp"
                          onChange={(e) =>
                            setModules(
                              modules.map((x, j) => (j === i ? { ...x, hp: e.target.value } : x)),
                            )
                          }
                          className="w-24 rounded-xl"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground"
                          onClick={() => setModules(modules.filter((_, j) => j !== i))}
                          aria-label="Ta bort moment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <p
                      className={cn(
                        "text-[11px]",
                        hpMismatch ? "text-sunset-rose" : "text-muted-foreground",
                      )}
                    >
                      {moduleHpSum} av {courseHp ?? "–"} hp fördelat
                      {hpMismatch ? " · måste stämma med kursens hp för att kunna spara" : ""}
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Färg</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {PALETTE.map((c) => (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => setColor(c.value)}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-all cursor-pointer",
                        (color ? color === c.value : false)
                          ? "border-foreground scale-110 shadow-lg ring-2 ring-primary/40"
                          : "border-transparent opacity-80 hover:opacity-100 hover:scale-105",
                      )}
                      style={{ background: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" className="rounded-xl" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
              <Button
                disabled={!name.trim() || create.isPending || hasDuplicate || hpMismatch}
                onClick={() => create.mutate()}
                className="rounded-xl"
              >
                Skapa kurs
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-[380px] grid-cols-3 rounded-xl bg-surface-2 p-1 mb-6">
          <TabsTrigger
            value="active"
            className="rounded-lg text-xs flex items-center gap-1.5 py-1.5"
          >
            Aktiva{" "}
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {active.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="completed"
            className="rounded-lg text-xs flex items-center gap-1.5 py-1.5"
          >
            Avklarade{" "}
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {completed.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="archived"
            className="rounded-lg text-xs flex items-center gap-1.5 py-1.5"
          >
            Arkiv{" "}
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {archived.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {active.length === 0 ? (
            <Card className="border-dashed border-border/60 bg-surface/40 rounded-2xl">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-display text-lg font-semibold">Inga aktiva kurser</div>
                  <div className="text-sm text-muted-foreground">
                    Alla dina kurser är avklarade eller inaktiva!
                  </div>
                </div>
                <Button onClick={() => setOpen(true)} className="gap-1 rounded-xl">
                  <Plus className="h-4 w-4" /> Skapa ny kurs
                </Button>
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
                            className="relative flex items-center gap-3 w-full overflow-hidden rounded-xl border border-border/60 bg-surface/50 p-3 text-left transition-all hover:border-transparent hover:shadow-lg hover:shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <div
                              className="absolute inset-x-0 top-0 h-1"
                              style={{ background: c.color }}
                            />
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2/60">
                              <GraduationCap className="h-5 w-5" style={{ color: c.color }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-display text-sm font-semibold tracking-tight truncate">
                                {c.name}
                              </h3>
                              <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                                {c.code && <span>{c.code}</span>}
                                {c.hp != null && <span>• {c.hp} HP</span>}
                                {(() => { const l = formatPeriods(c.periods, c.period); return l ? <span>• {l}</span> : null; })()}
                                {c.arskurs != null && <span>• Åk {c.arskurs}</span>}
                              </div>
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
            <CompletedList courses={completed} universities={universities} />
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
                    className="relative flex items-center gap-3 w-full overflow-hidden rounded-xl border border-border/60 bg-surface/50 p-3 text-left transition-all hover:border-transparent hover:shadow-lg hover:shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2/60">
                      <GraduationCap className="h-5 w-5" style={{ color: c.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-sm font-semibold tracking-tight truncate">
                        {c.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {c.code && <span>{c.code}</span>}
                        {c.hp != null && <span>• {c.hp} HP</span>}
                        {(() => { const l = formatPeriods(c.periods, c.period); return l ? <span>• {l}</span> : null; })()}
                        {c.arskurs != null && <span>• Åk {c.arskurs}</span>}
                      </div>
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

/* ─── Compact completed-courses list ─── */

const PERIOD_ORDER: CoursePeriod[] = ["P1", "P2", "P3", "P4", "P5"];
const TERM_ORDER: Term[] = ["HT", "VT", "ST"];

function CompletedList({
  courses,
  universities,
}: {
  courses: CourseRow[];
  universities: { id: string; name: string }[];
}) {
  const uniMap = new Map(universities.map((u) => [u.id, u.name]));

  // Sort courses by period within each group
  const sorted = [...courses].sort((a, b) => {
    const pa = PERIOD_ORDER.indexOf(a.period as CoursePeriod);
    const pb = PERIOD_ORDER.indexOf(b.period as CoursePeriod);
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
  });

  // Group by årskurs → term
  type Group = { arskurs: number | null; term: Term | null; courses: CourseRow[] };
  const groups: Group[] = [];
  const key = (ak: number | null, t: Term | null) => `${ak ?? "x"}-${t ?? "x"}`;
  const map = new Map<string, Group>();

  for (const c of sorted) {
    const t = c.period ? (PERIOD_TO_TERM[c.period as CoursePeriod] ?? null) : null;
    const k = key(c.arskurs, t);
    let g = map.get(k);
    if (!g) {
      g = { arskurs: c.arskurs, term: t, courses: [] };
      map.set(k, g);
      groups.push(g);
    }
    g.courses.push(c);
  }

  // Sort groups: by årskurs asc then term order
  groups.sort((a, b) => {
    const akA = a.arskurs ?? 99;
    const akB = b.arskurs ?? 99;
    if (akA !== akB) return akA - akB;
    const tA = a.term ? TERM_ORDER.indexOf(a.term) : 99;
    const tB = b.term ? TERM_ORDER.indexOf(b.term) : 99;
    return tA - tB;
  });

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const label =
          [g.arskurs != null ? `Årskurs ${g.arskurs}` : null, g.term ? TERM_LABELS[g.term] : null]
            .filter(Boolean)
            .join(" · ") || "Övriga";

        return (
          <div key={`${g.arskurs}-${g.term}`}>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
              <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px]">
                {g.courses.length}
              </span>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface/40 divide-y divide-border/40">
              {g.courses.map((c) => {
                const uni = c.university_id ? uniMap.get(c.university_id) : null;
                return (
                  <Link
                    key={c.id}
                    to="/courses/$courseId"
                    params={{ courseId: c.id }}
                    className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-white/5 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-c-7" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                      {[c.code?.toUpperCase(), uni, c.hp != null ? `${c.hp} HP` : null, formatPeriods(c.periods, c.period)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {c.final_grade ? (
                      <span className="shrink-0 rounded-full bg-c-7/15 border border-c-7/30 px-2 py-0.5 text-[10px] font-bold text-c-7 tabular-nums">
                        {c.final_grade}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground">
                        –
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
