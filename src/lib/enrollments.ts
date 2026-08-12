import { supabase } from "@/integrations/supabase/client";
import { sortPeriods, firstPeriod, type CoursePeriod } from "@/lib/course-presets";
import type { CourseEnrollment } from "@/lib/queries";
import { sortEnrollments, type EnrollmentDraft } from "@/components/courses/enrollments-editor";

type Period = "P1" | "P2" | "P3" | "P4" | "P5";

/** Fält på kursen som speglas från den tidigaste omgången (för gruppering/visning). */
export function mirroredCourseFields(rows: EnrollmentDraft[]): {
  arskurs: number | null;
  period: Period | null;
  periods: Period[] | null;
} {
  const first = sortEnrollments(rows.filter((r) => r.arskurs || r.periods.length > 0))[0];
  const periods = first ? (sortPeriods(first.periods) as Period[]) : [];
  return {
    arskurs: first?.arskurs ? Number(first.arskurs) : null,
    period: (firstPeriod(periods) ?? null) as Period | null,
    periods: periods.length > 0 ? periods : null,
  };
}

/** Skriver omgångar till databasen: tar bort borttagna, uppdaterar/lägger till resten. */
export async function saveEnrollments(opts: {
  courseId: string;
  userId: string;
  rows: EnrollmentDraft[];
  existing: readonly CourseEnrollment[];
}): Promise<void> {
  const { courseId, userId, existing } = opts;
  const rows = sortEnrollments(
    opts.rows.filter((r) => r.arskurs || r.periods.length > 0),
  );

  const keptIds = new Set(rows.filter((r) => r.id).map((r) => r.id!));
  const removed = existing.filter((e) => e.course_id === courseId && !keptIds.has(e.id));
  if (removed.length > 0) {
    const { error } = await supabase
      .from("course_reg_enrollments")
      .delete()
      .in(
        "id",
        removed.map((r) => r.id),
      );
    if (error) throw error;
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const payload = {
      arskurs: r.arskurs ? Number(r.arskurs) : null,
      periods: sortPeriods(r.periods) as CoursePeriod[],
      sort_order: i,
    };
    if (r.id) {
      const { error } = await supabase
        .from("course_reg_enrollments")
        .update(payload)
        .eq("id", r.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("course_reg_enrollments")
        .insert({ ...payload, course_id: courseId, user_id: userId });
      if (error) throw error;
    }
  }
}
