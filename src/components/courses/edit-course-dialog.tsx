import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PALETTE, sortPeriods, type CoursePeriod } from "@/lib/course-presets";
import { useUniversities } from "@/lib/settings";
import { reportingModulesQuery, enrollmentsQuery, coursesQuery } from "@/lib/queries";
import {
  EnrollmentsEditor,
  emptyEnrollment,
  type EnrollmentDraft,
} from "@/components/courses/enrollments-editor";
import { mirroredCourseFields, saveEnrollments } from "@/lib/enrollments";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

type ModuleRow = { id?: string; name: string; hp: string };

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
  literature: string | null;
  teacher_name: string | null;
  teacher_contact: string | null;
  completed: boolean;
  final_grade: string | null;
  is_standalone: boolean;
  mode: "campus" | "distans";
};

export function EditCourseDialog({
  open,
  onOpenChange,
  course,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  course: CourseRow;
}) {
  const qc = useQueryClient();
  const { data: universities = [] } = useUniversities();
  const { data: allModules = [] } = useQuery(reportingModulesQuery);
  const { data: allEnrollments = [] } = useQuery(enrollmentsQuery);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentDraft[]>([]);

  useEffect(() => {
    if (!open) return;
    const rows = allEnrollments
      .filter((e) => e.course_id === course.id)
      .map((e) => ({
        id: e.id,
        arskurs: e.arskurs?.toString() ?? "",
        periods: sortPeriods(e.periods) as CoursePeriod[],
      }));
    setEnrollments(
      rows.length > 0
        ? rows
        : [
            {
              arskurs: course.arskurs?.toString() ?? "",
              periods: sortPeriods(
                course.periods ?? (course.period ? [course.period] : []),
              ) as CoursePeriod[],
            },
          ],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, course.id, allEnrollments.length]);

  useEffect(() => {
    if (!open) return;
    setModules(
      allModules
        .filter((m) => m.course_id === course.id)
        .map((m) => ({ id: m.id, name: m.name, hp: String(m.hp ?? "") })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, course.id, allModules.length]);
  const [form, setForm] = useState({
    name: course.name,
    code: course.code ?? "",
    color: course.color,
    hp: course.hp?.toString() ?? "",
    periods: sortPeriods(course.periods ?? (course.period ? [course.period] : [])) as CoursePeriod[],
    arskurs: course.arskurs?.toString() ?? "",
    university_id: course.university_id ?? "",
    weekly_goal_hours: course.weekly_goal_hours?.toString() ?? "",
    literature: course.literature ?? "",
    teacher_name: course.teacher_name ?? "",
    teacher_contact: course.teacher_contact ?? "",
    is_standalone: course.is_standalone,
    mode: course.mode ?? "campus",
  });

  const { data: allCourses = [] } = useQuery(coursesQuery);
  const otherCourses = allCourses.filter((c) => c.id !== course.id);

  const trimmedName = form.name.trim().toLowerCase();
  const trimmedCode = form.code.trim().toLowerCase();

  const duplicateNameCourse = trimmedName
    ? otherCourses.find((c) => c.name.trim().toLowerCase() === trimmedName)
    : undefined;

  const duplicateCodeCourse = trimmedCode
    ? otherCourses.find((c) => c.code && c.code.trim().toLowerCase() === trimmedCode)
    : undefined;

  const nameExists = Boolean(duplicateNameCourse);
  const codeExists = Boolean(duplicateCodeCourse);
  const hasDuplicate = nameExists || codeExists;

  const activeModules = modules.filter((m) => m.name.trim());
  const moduleHpSum = activeModules.reduce((sum, m) => sum + (Number(m.hp) || 0), 0);
  const courseHp = form.hp ? Number(form.hp) : null;
  const hpMismatch =
    activeModules.length > 0 &&
    (courseHp === null || Math.abs(moduleHpSum - courseHp) > 0.001);

  const save = useMutation({
    mutationFn: async () => {
      if (hasDuplicate) {
        if (nameExists && codeExists) {
          throw new Error("En annan kurs med samma namn och kurskod finns redan");
        }
        if (nameExists) {
          throw new Error(`En annan kurs med namnet "${duplicateNameCourse?.name}" finns redan`);
        }
        throw new Error(`En annan kurs med kurskoden "${duplicateCodeCourse?.code}" finns redan`);
      }
      if (hpMismatch) {
        throw new Error(
          courseHp === null
            ? "Ange kursens högskolepoäng innan du lägger till rapporteringsmoment"
            : `Momenten summerar till ${moduleHpSum} hp men kursen är ${courseHp} hp`,
        );
      }
      const { error } = await supabase
        .from("courses")
        .update({
          name: form.name.trim(),
          code: form.code.trim() || null,
          color: form.color,
          hp: form.hp ? Number(form.hp) : null,
          ...mirroredCourseFields(enrollments),
          university_id: form.university_id || null,
          weekly_goal_hours: form.weekly_goal_hours ? Number(form.weekly_goal_hours) : 0,
          literature: form.literature.trim() || null,
          teacher_name: form.teacher_name.trim() || null,
          teacher_contact: form.teacher_contact.trim() || null,
          is_standalone: form.is_standalone,
          mode: form.mode,
        })
        .eq("id", course.id);
      if (error) throw error;

      const existing = allModules.filter((m) => m.course_id === course.id);
      const keptIds = new Set(activeModules.filter((m) => m.id).map((m) => m.id!));
      const removed = existing.filter((m) => !keptIds.has(m.id));
      if (removed.length > 0) {
        const { error: delError } = await supabase
          .from("course_reporting_modules")
          .delete()
          .in("id", removed.map((m) => m.id));
        if (delError) throw delError;
      }

      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Ingen användare");

      for (let i = 0; i < activeModules.length; i++) {
        const m = activeModules[i];
        const payload = { name: m.name.trim(), hp: Number(m.hp) || 0, sort_order: i };
        if (m.id) {
          const { error: upError } = await supabase
            .from("course_reporting_modules")
            .update(payload)
            .eq("id", m.id);
          if (upError) throw upError;
        } else {
          const { error: insError } = await supabase
            .from("course_reporting_modules")
            .insert({ ...payload, course_id: course.id, user_id: u.user.id });
          if (insError) throw insError;
        }
      }

      await saveEnrollments({
        courseId: course.id,
        userId: u.user.id,
        rows: enrollments,
        existing: allEnrollments,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course_reporting_modules"] });
      qc.invalidateQueries({ queryKey: ["course_reg_enrollments"] });
      qc.invalidateQueries({ queryKey: ["course", course.id] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Sparat");
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Redigera kurs</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {hasDuplicate && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Kan inte spara kursen</AlertTitle>
              <AlertDescription>
                {nameExists && codeExists
                  ? `En annan kurs med samma namn ("${duplicateNameCourse?.name}") och kurskod ("${duplicateCodeCourse?.code}") finns redan.`
                  : nameExists
                  ? `En annan kurs med namnet "${duplicateNameCourse?.name}" finns redan.`
                  : `En annan kurs med kurskoden "${duplicateCodeCourse?.code}" finns redan.`}
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label className={cn(nameExists && "text-destructive font-medium")}>
              Namn {nameExists && "(finns redan)"}
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={cn("rounded-xl", nameExists && "border-destructive focus-visible:ring-destructive")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={cn(codeExists && "text-destructive font-medium")}>
                Kurskod {codeExists && "(finns redan)"}
              </Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className={cn("rounded-xl", codeExists && "border-destructive focus-visible:ring-destructive")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>HP</Label>
              <Input
                type="number"
                step="0.5"
                value={form.hp}
                onChange={(e) => setForm({ ...form, hp: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>
          <EnrollmentsEditor rows={enrollments} onChange={setEnrollments} />
          <div className="space-y-1.5">
            <Label>Universitet</Label>
            <Select
              value={form.university_id}
              onValueChange={(v) => setForm({ ...form, university_id: v })}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Välj" />
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
                value={form.is_standalone ? "standalone" : "program"}
                onValueChange={(v) => setForm({ ...form, is_standalone: v === "standalone" })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Välj" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="program">Programkurs</SelectItem>
                  <SelectItem value="standalone">Fristående kurs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Undervisningsform</Label>
              <Select
                value={form.mode}
                onValueChange={(v) => setForm({ ...form, mode: v as "campus" | "distans" })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Välj" />
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
                value={form.weekly_goal_hours}
                onChange={(e) => setForm({ ...form, weekly_goal_hours: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Lärare (namn)</Label>
            <Input
              value={form.teacher_name}
              onChange={(e) => setForm({ ...form, teacher_name: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Lärarens kontakt (e-post, tel, …)</Label>
            <Input
              value={form.teacher_contact}
              onChange={(e) => setForm({ ...form, teacher_contact: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Kurslitteratur</Label>
            <Textarea
              rows={4}
              value={form.literature}
              onChange={(e) => setForm({ ...form, literature: e.target.value })}
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
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={cn(
                    "h-8 w-8 rounded-full border-2",
                    form.color === c.value ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ background: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            className="rounded-xl"
            onClick={() => save.mutate()}
            disabled={!form.name.trim() || save.isPending || hpMismatch || hasDuplicate}
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
