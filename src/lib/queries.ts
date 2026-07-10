import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Delade query-options så alla sidor kan använda samma cache (samma queryKey → 1 fetch).
// Håll projections så breda att alla konsumenter täcks – tabellerna är små per användare.

export type Course = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  icon: string | null;
  archived: boolean;
  hp: number | null;
  period: string | null;
  arskurs: number | null;
  university_id: string | null;
  weekly_goal_hours: number | null;
  completed: boolean;
  final_grade: string | null;
};

export const coursesQuery = queryOptions({
  queryKey: ["courses"] as const,
  queryFn: async (): Promise<Course[]> => {
    const { data, error } = await supabase
      .from("courses")
      .select(
        "id,name,code,color,icon,archived,hp,period,arskurs,university_id,weekly_goal_hours,completed,final_grade",
      )
      .order("created_at");
    if (error) throw error;
    return (data ?? []) as Course[];
  },
});

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "doing" | "done";
  due_at: string | null;
  course_id: string | null;
  task_type: TaskType;
  task_kind: "task" | "exam";
  grade: string | null;
  points: string | null;
  pending_review: boolean;
};

export const tasksQuery = queryOptions({
  queryKey: ["tasks"] as const,
  queryFn: async (): Promise<Task[]> => {
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id,title,description,status,due_at,course_id,task_type,task_kind,grade,points,pending_review",
      )
      .order("due_at", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as Task[];
  },
});

export type TermRow = {
  id: string;
  year: number;
  term: "host" | "var" | "sommar";
  start_date: string;
  end_date: string;
};

export const termsQuery = queryOptions({
  queryKey: ["term_dates"] as const,
  queryFn: async (): Promise<TermRow[]> => {
    const { data, error } = await supabase
      .from("term_dates")
      .select("id,year,term,start_date,end_date")
      .order("year", { ascending: false })
      .order("term");
    if (error) throw error;
    return (data ?? []) as TermRow[];
  },
});

/** Sekunder mellan två ISO-tider (aldrig negativt). */
export const durationSeconds = (start: string, end: string): number =>
  Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));

export type TaskType =
  | "annat"
  | "inlamningsuppgift"
  | "kontrollskrivning"
  | "laboration"
  | "modul"
  | "quiz"
  | "redovisning"
  | "seminarie"
  | "tenta"
  | "ovning";

export const TYPE_LABELS: Record<TaskType, string> = {
  annat: "Annat",
  inlamningsuppgift: "Inlämning",
  kontrollskrivning: "Kontrollskrivning",
  laboration: "Laboration",
  modul: "Modul",
  quiz: "Quiz",
  redovisning: "Redovisning",
  seminarie: "Seminarie",
  tenta: "Tenta",
  ovning: "Övning",
};

export const TYPE_COLORS: Record<TaskType, string> = {
  annat: "bg-zinc-500/20 text-zinc-400",
  inlamningsuppgift: "bg-sky-500/20 text-sky-400",
  kontrollskrivning: "bg-amber-500/20 text-amber-400",
  laboration: "bg-emerald-500/20 text-emerald-400",
  modul: "bg-violet-500/20 text-violet-400",
  quiz: "bg-pink-500/20 text-pink-400",
  redovisning: "bg-orange-500/20 text-orange-400",
  seminarie: "bg-teal-500/20 text-teal-400",
  tenta: "bg-rose-500/20 text-rose-400",
  ovning: "bg-indigo-500/20 text-indigo-400",
};

export const TYPES_ALPHA: TaskType[] = [
  "annat",
  "inlamningsuppgift",
  "kontrollskrivning",
  "laboration",
  "modul",
  "quiz",
  "redovisning",
  "seminarie",
  "tenta",
  "ovning",
];
