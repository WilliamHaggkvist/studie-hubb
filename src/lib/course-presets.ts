// Modern 15-color ultra-high contrast palette without overlapping shades.
export const PALETTE = [
  { name: "Stark Röd", value: "#ef4444", token: "c-1" },
  { name: "Terracotta", value: "#ea580c", token: "c-2" },
  { name: "Bärnsten", value: "#d97706", token: "c-3" },
  { name: "Solgul", value: "#facc15", token: "c-4" },
  { name: "Lime", value: "#84cc16", token: "c-5" },
  { name: "Barrgrön", value: "#15803d", token: "c-6" },
  { name: "Aquaturkos", value: "#0f766e", token: "c-7" },
  { name: "Himmelsblå", value: "#60a5fa", token: "c-8" },
  { name: "Kornblå", value: "#2563eb", token: "c-9" },
  { name: "Skiffergrå", value: "#64748b", token: "c-10" },
  { name: "Kungsviolett", value: "#7c3aed", token: "c-11" },
  { name: "Fuchsia", value: "#d946ef", token: "c-12" },
  { name: "Smultronrosa", value: "#ec4899", token: "c-13" },
  { name: "Sienna", value: "#7c2d12", token: "c-14" },
  { name: "Skugg-Plommon", value: "#701a75", token: "c-15" },
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

