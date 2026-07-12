import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { PALETTE, COURSE_PERIODS, ARSKURS_OPTIONS, sortPeriods, firstPeriod, type CoursePeriod } from "@/lib/course-presets";
import { useUniversities } from "@/lib/settings";

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
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("courses")
        .update({
          name: form.name.trim(),
          code: form.code.trim() || null,
          color: form.color,
          hp: form.hp ? Number(form.hp) : null,
          period: (firstPeriod(form.periods) ?? null) as "P1" | "P2" | "P3" | "P4" | "P5" | null,
          periods: form.periods.length > 0 ? (sortPeriods(form.periods) as unknown as ("P1" | "P2" | "P3" | "P4" | "P5")[]) : null,
          arskurs: form.arskurs ? Number(form.arskurs) : null,
          university_id: form.university_id || null,
          weekly_goal_hours: form.weekly_goal_hours ? Number(form.weekly_goal_hours) : 0,
          literature: form.literature.trim() || null,
          teacher_name: form.teacher_name.trim() || null,
          teacher_contact: form.teacher_contact.trim() || null,
          is_standalone: form.is_standalone,
        })
        .eq("id", course.id);
      if (error) throw error;
    },
    onSuccess: () => {
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
          <div className="space-y-1.5">
            <Label>Namn</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kurskod</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="rounded-xl"
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Period</Label>
              <div className="flex flex-wrap gap-1.5">
                {COURSE_PERIODS.map((p) => {
                  const active = form.periods.includes(p);
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() =>
                        setForm({
                          ...form,
                          periods: active
                            ? form.periods.filter((x) => x !== p)
                            : (sortPeriods([...form.periods, p]) as CoursePeriod[]),
                        })
                      }
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/60 bg-surface/40 text-muted-foreground hover:border-border",
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">Välj en eller flera perioder.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Årskurs</Label>
              <Select value={form.arskurs} onValueChange={(v) => setForm({ ...form, arskurs: v })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Välj" />
                </SelectTrigger>
                <SelectContent>
                  {ARSKURS_OPTIONS.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      Årskurs {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
            disabled={!form.name.trim() || save.isPending}
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
