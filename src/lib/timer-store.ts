// Simple global running-timer store using React 18 useSyncExternalStore.
// Persists the running session to localStorage so it survives refresh.
type RunningTimer = {
  startedAt: number; // ms
  courseId: string | null;
  taskIds: string[];
  description: string;
};

const STORAGE_KEY = "studyos.running_timer";
const listeners = new Set<() => void>();
let state: RunningTimer | null = null;

function load(): RunningTimer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RunningTimer> & { taskId?: string | null };
    // Back-compat: old shape had a single `taskId`
    const taskIds = Array.isArray(parsed.taskIds)
      ? parsed.taskIds
      : parsed.taskId
        ? [parsed.taskId]
        : [];
    return {
      startedAt: parsed.startedAt ?? Date.now(),
      courseId: parsed.courseId ?? null,
      taskIds,
      description: parsed.description ?? "",
    };
  } catch {
    return null;
  }
}
function persist(next: RunningTimer | null) {
  if (typeof window === "undefined") return;
  if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  else window.localStorage.removeItem(STORAGE_KEY);
}

if (typeof window !== "undefined") {
  state = load();
}

export const timerStore = {
  getSnapshot(): RunningTimer | null {
    return state;
  },
  getServerSnapshot(): RunningTimer | null {
    return null;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  start(input: { courseId?: string | null; taskIds?: string[]; description?: string }) {
    state = {
      startedAt: Date.now(),
      courseId: input.courseId ?? null,
      taskIds: input.taskIds ?? [],
      description: input.description ?? "",
    };
    persist(state);
    listeners.forEach((l) => l());
  },
  stop(): RunningTimer | null {
    const prev = state;
    state = null;
    persist(null);
    listeners.forEach((l) => l());
    return prev;
  },
  update(patch: Partial<Omit<RunningTimer, "startedAt">>) {
    if (!state) return;
    state = { ...state, ...patch };
    persist(state);
    listeners.forEach((l) => l());
  },
};

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatHoursCompact(seconds: number): string {
  const h = seconds / 3600;
  if (h < 1) return `${Math.round(seconds / 60)}m`;
  return `${h.toFixed(1)}h`;
}
