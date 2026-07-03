// New palette — sunset-to-ocean. Used for course color pickers, charts, chips.
export const PALETTE = [
  { name: "Röd",     value: "#f94144", token: "c-1" },
  { name: "Orange",  value: "#f3722c", token: "c-2" },
  { name: "Amber",   value: "#f8961e", token: "c-3" },
  { name: "Peach",   value: "#f9844a", token: "c-4" },
  { name: "Gul",     value: "#f9c74f", token: "c-5" },
  { name: "Grön",    value: "#90be6d", token: "c-6" },
  { name: "Teal",    value: "#43aa8b", token: "c-7" },
  { name: "Djuphav", value: "#4d908e", token: "c-8" },
  { name: "Blågrå",  value: "#577590", token: "c-9" },
  { name: "Blå",     value: "#277da1", token: "c-10" },
] as const;

// Backwards-compat alias used by older imports.
export const SUNSET_COLORS = PALETTE;

export const DEFAULT_COURSE_ICONS = ["📚", "🧮", "🧪", "💻", "🎨", "🧠", "📊", "🌐", "⚙️", "📝", "🔬", "📐"];

export const COURSE_PERIODS = ["P1", "P2", "P3", "P4", "P5"] as const;
export type CoursePeriod = (typeof COURSE_PERIODS)[number];

export const ARSKURS_OPTIONS = [1, 2, 3, 4, 5, 6] as const;
