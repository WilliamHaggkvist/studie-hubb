// New palette — sunset-to-ocean. Used for course color pickers, charts, chips.
export const PALETTE = [
  { name: "Röd", value: "#f94144", token: "c-1" },
  { name: "Orange", value: "#f3722c", token: "c-2" },
  { name: "Amber", value: "#f8961e", token: "c-3" },
  { name: "Peach", value: "#f9844a", token: "c-4" },
  { name: "Gul", value: "#f9c74f", token: "c-5" },
  { name: "Grön", value: "#90be6d", token: "c-6" },
  { name: "Teal", value: "#43aa8b", token: "c-7" },
  { name: "Djuphav", value: "#4d908e", token: "c-8" },
  { name: "Blågrå", value: "#577590", token: "c-9" },
  { name: "Blå", value: "#277da1", token: "c-10" },
] as const;

// Backwards-compat alias used by older imports.
export const SUNSET_COLORS = PALETTE;

export const DEFAULT_COURSE_ICONS = [
  "📚",
  "🧮",
  "🧪",
  "💻",
  "🎨",
  "🧠",
  "📊",
  "🌐",
  "⚙️",
  "📝",
  "🔬",
  "📐",
];

export const COURSE_PERIODS = ["P1", "P2", "P3", "P4", "P5"] as const;
export type CoursePeriod = (typeof COURSE_PERIODS)[number];

/** Academic terms (terminer). */
export const TERMS = ["HT", "VT", "ST"] as const;
export type Term = (typeof TERMS)[number];

export const TERM_LABELS: Record<Term, string> = {
  HT: "Hösttermin",
  VT: "Vårtermin",
  ST: "Sommartermin",
};

/** Maps each study period to its parent term. */
export const PERIOD_TO_TERM: Record<CoursePeriod, Term> = {
  P1: "HT",
  P2: "HT",
  P3: "VT",
  P4: "VT",
  P5: "ST",
};

/** Returns which periods belong to a given term. */
export const TERM_PERIODS: Record<Term, readonly CoursePeriod[]> = {
  HT: ["P1", "P2"],
  VT: ["P3", "P4"],
  ST: ["P5"],
};

/** Get the term for a period, or null if period is undefined/null. */
export function getTermForPeriod(period: CoursePeriod | null | undefined): Term | null {
  if (!period) return null;
  return PERIOD_TO_TERM[period] ?? null;
}

export const ARSKURS_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

/** Sort a list of periods in canonical P1 → P5 order and drop unknown values. */
export function sortPeriods(arr: readonly (string | null | undefined)[]): CoursePeriod[] {
  const set = new Set<CoursePeriod>();
  for (const p of arr) {
    if (p && (COURSE_PERIODS as readonly string[]).includes(p)) {
      set.add(p as CoursePeriod);
    }
  }
  return [...set].sort(
    (a, b) => COURSE_PERIODS.indexOf(a) - COURSE_PERIODS.indexOf(b),
  );
}

/** The earliest period in a list (used for grouping/sorting). */
export function firstPeriod(
  arr: readonly (string | null | undefined)[] | null | undefined,
): CoursePeriod | null {
  if (!arr) return null;
  return sortPeriods(arr)[0] ?? null;
}

/** Display string for a course's periods (e.g. "P1, P2"). Falls back to legacy single period. */
export function formatPeriods(
  arr: readonly (string | null | undefined)[] | null | undefined,
  fallback: string | null | undefined,
): string | null {
  const sorted = arr ? sortPeriods(arr) : [];
  if (sorted.length > 0) return sorted.join(", ");
  return fallback ?? null;
}

