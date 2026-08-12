import type { CoursePeriod, Term } from "./course-presets";
import type { TermRow } from "./queries";

/**
 * Datumfönster för en läsperiod. Höstterminen delas i P1/P2, vårterminen i
 * P3/P4 och sommaren är P5. `academicYear` är läsårets startår (HT-året).
 */
export type PeriodWindow = {
  period: CoursePeriod;
  term: Term;
  academicYear: number;
  start: Date;
  end: Date;
};

const dayStart = (iso: string) => new Date(`${iso}T00:00:00`);
const dayEnd = (iso: string) => new Date(`${iso}T23:59:59`);

/** Läsårets startår för en terminsrad (VT/sommar hör till föregående höst). */
export function academicYearOf(t: Pick<TermRow, "year" | "term">): number {
  return t.term === "host" ? t.year : t.year - 1;
}

/** Bygger datumfönster per läsperiod från användarens terminsdatum. */
export function periodWindows(terms: readonly TermRow[]): PeriodWindow[] {
  const out: PeriodWindow[] = [];
  for (const t of terms) {
    if (!t.start_date || !t.end_date) continue;
    const start = dayStart(t.start_date);
    const end = dayEnd(t.end_date);
    if (end <= start) continue;
    const ay = academicYearOf(t);
    const mid = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);

    if (t.term === "sommar") {
      out.push({ period: "P5", term: "ST", academicYear: ay, start, end });
    } else {
      const [a, b]: [CoursePeriod, CoursePeriod] =
        t.term === "host" ? ["P1", "P2"] : ["P3", "P4"];
      const term: Term = t.term === "host" ? "HT" : "VT";
      out.push({ period: a, term, academicYear: ay, start, end: mid });
      out.push({ period: b, term, academicYear: ay, start: mid, end });
    }
  }
  return out.sort((x, y) => x.start.getTime() - y.start.getTime());
}

/** Vilken läsperiod ett datum (YYYY-MM-DD) faller inom, eller null. */
export function resolvePeriod(
  date: string | null | undefined,
  windows: readonly PeriodWindow[],
): PeriodWindow | null {
  if (!date) return null;
  const d = dayStart(date.slice(0, 10));
  if (Number.isNaN(d.getTime())) return null;
  for (const w of windows) {
    if (d >= w.start && d <= w.end) return w;
  }
  return null;
}

/**
 * Översätter läsår (HT-startår) → årskurs.
 * En årskurs består av tre terminer i ordningen: Höst, Vår, Sommar.
 * Årskurs 1 inleds hösten 2024 (läsår 2024: HT 2024, VT 2025, ST 2025).
 */
export function getArskursFromAcademicYear(academicYear: number): number | null {
  const arskurs = academicYear - 2024 + 1;
  return arskurs > 0 ? arskurs : null;
}

export function makeArskursMapper(
  _windows?: readonly PeriodWindow[],
  _arskursValues?: readonly (number | null | undefined)[],
): (academicYear: number) => number | null {
  return getArskursFromAcademicYear;
}

/** Beräknar årskurs utifrån kalenderdatum (YYYY-MM-DD). */
export function getArskursFromDate(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.slice(0, 10));
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const academicYear = month >= 9 ? year : year - 1;
  return getArskursFromAcademicYear(academicYear);
}
