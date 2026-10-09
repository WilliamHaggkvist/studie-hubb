import { format } from "date-fns";

/** Minsta fält som behövs för att räkna studietid från ett studiepass. */
export type SessionTimes = {
  planned_start: string;
  planned_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
};

/** Faktisk tid om den finns, annars planerad. */
export function sessionBounds(s: SessionTimes): { start: Date; end: Date } {
  return {
    start: new Date(s.actual_start ?? s.planned_start),
    end: new Date(s.actual_end ?? s.planned_end),
  };
}

/** Ett pass räknas som genomfört först när sluttiden har passerat. */
export function isSessionDone(s: SessionTimes, now: number = Date.now()): boolean {
  const { end } = sessionBounds(s);
  return !Number.isNaN(end.getTime()) && end.getTime() <= now;
}

/** Passets längd i sekunder (aldrig negativ). */
export function sessionSeconds(s: SessionTimes): number {
  const { start, end } = sessionBounds(s);
  const d = Math.floor((end.getTime() - start.getTime()) / 1000);
  return Number.isFinite(d) ? Math.max(0, d) : 0;
}

/** Lokal dag (svensk tid i webbläsaren) för passets start, YYYY-MM-DD. */
export function sessionDayKey(s: SessionTimes): string {
  return format(sessionBounds(s).start, "yyyy-MM-dd");
}

/** Lokal datumgräns för terminsdatum (start 00:00, slut 23:59:59). */
export function localDayStart(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}
export function localDayEnd(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T23:59:59.999`);
}

/** Delar sekunder jämnt mellan n uppgifter utan att tappa sekunder. */
export function splitSeconds(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}
