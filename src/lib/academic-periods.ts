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
 * Översätter läsår → årskurs. Ankaret är det tidigaste läsåret med
 * terminsdatum, som antas motsvara den lägsta årskurs som finns registrerad.
 */
export function makeArskursMapper(
  windows: readonly PeriodWindow[],
  arskursValues: readonly (number | null | undefined)[],
): (academicYear: number) => number | null {
  const years = windows.map((w) => w.academicYear);
  const arskurser = arskursValues.filter((a): a is number => typeof a === "number");
  if (years.length === 0 || arskurser.length === 0) return () => null;
  const baseYear = Math.min(...years);
  const baseArskurs = Math.min(...arskurser);
  return (academicYear: number) => baseArskurs + (academicYear - baseYear);
}
