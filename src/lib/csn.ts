import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseDateInputToISO, formatDateYYYYMMDD } from "@/lib/date-utils";
import { differenceInCalendarDays, parseISO, isValid } from "date-fns";

export type CsnPeriod = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  weeks: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CsnPeriodStatus = "active" | "past" | "upcoming";

export type RegisteredModuleForCsn = {
  id: string;
  moduleName: string;
  courseName: string;
  courseCode: string | null;
  courseColor: string;
  hp: number;
  grade: string | null;
  points: string | null;
  registeredOn: string;
};

export type CsnPeriodProgress = {
  period: CsnPeriod;
  status: CsnPeriodStatus;
  weeks: number;
  totalHp: number; // e.g. 20 * 1.5 = 30 HP
  requiredHp: number; // 75% of totalHp, e.g. 22.5 HP
  registeredHp: number; // sum of modules registered in period
  remainingHp: number; // max(0, requiredHp - registeredHp)
  surplusHp: number; // max(0, registeredHp - requiredHp)
  requirementPercentReached: number; // (registeredHp / requiredHp) * 100
  totalPercentReached: number; // (registeredHp / totalHp) * 100
  isFulfilled: boolean;
  modules: RegisteredModuleForCsn[];
};

/**
 * Beräknar antal studieveckor mellan två datum.
 * Inkluderar start- och slutdag. Avrundas till närmaste hel vecka (minst 1).
 */
export function calculateWeeksFromDates(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const sIso = parseDateInputToISO(startDate) ?? startDate;
  const eIso = parseDateInputToISO(endDate) ?? endDate;
  const dStart = parseISO(sIso.length === 10 ? `${sIso}T00:00:00` : sIso);
  const dEnd = parseISO(eIso.length === 10 ? `${eIso}T23:59:59` : eIso);

  if (!isValid(dStart) || !isValid(dEnd) || dEnd < dStart) return 1;

  const days = differenceInCalendarDays(dEnd, dStart) + 1;
  const weeks = Math.round(days / 7);
  return Math.max(1, weeks);
}

/**
 * Beräknar CSN HP-mått baserat på veckor.
 * Heltid (100%) = 1,5 HP per vecka.
 * CSN studiekrav = 75 % av beviljade HP.
 */
export function calculateCsnMetrics(weeks: number) {
  const safeWeeks = Math.max(0, Number(weeks) || 0);
  const totalHp = +(safeWeeks * 1.5).toFixed(1);
  const requiredHp = +(totalHp * 0.75).toFixed(2);
  return {
    weeks: safeWeeks,
    totalHp,
    requiredHp,
  };
}

/**
 * Returnerar status för CSN-perioden utifrån dagens datum.
 */
export function getCsnPeriodStatus(period: CsnPeriod): CsnPeriodStatus {
  const todayIso = new Date().toISOString().slice(0, 10);
  const start = period.startDate ? period.startDate.slice(0, 10) : "";
  const end = period.endDate ? period.endDate.slice(0, 10) : "";

  if (start && todayIso < start) return "upcoming";
  if (end && todayIso > end) return "past";
  return "active";
}

const STORAGE_KEY_PREFIX = "studiehubb_csn_periods_";

function getStorageKey(userId?: string): string {
  return userId ? `${STORAGE_KEY_PREFIX}${userId}` : `${STORAGE_KEY_PREFIX}guest`;
}

export function loadCsnPeriodsFromLocal(userId?: string): CsnPeriod[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getStorageKey(userId);
    const raw = localStorage.getItem(key) ?? localStorage.getItem("studiehubb_csn_periods");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as CsnPeriod[];
    }
  } catch (e) {
    console.warn("Failed to load CSN periods from localStorage", e);
  }
  return [];
}

export function saveCsnPeriodsToLocal(periods: CsnPeriod[], userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(periods));
    localStorage.setItem("studiehubb_csn_periods", JSON.stringify(periods));
    window.dispatchEvent(new CustomEvent("csn_periods_updated", { detail: periods }));
  } catch (e) {
    console.warn("Failed to save CSN periods to localStorage", e);
  }
}

/**
 * Hook för att hämta och hantera CSN-perioder.
 */
export function useCsnPeriods() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["csn_periods"],
    queryFn: async (): Promise<CsnPeriod[]> => {
      let userId: string | undefined;
      try {
        const { data: u } = await supabase.auth.getUser();
        userId = u.user?.id;
      } catch {
        // Ignorera auth-fel i preview
      }

      // Försök läsa från Supabase ifall tabellen existerar
      try {
        if (userId) {
          const { data, error } = await supabase
            .from("csn_periods" as never)
            .select("*")
            .eq("user_id" as never, userId)
            .order("start_date" as never, { ascending: false });

          if (!error && data && Array.isArray(data)) {
            const mapped: CsnPeriod[] = data.map((row: any) => ({
              id: row.id,
              name: row.name ?? "",
              startDate: row.start_date,
              endDate: row.end_date,
              weeks: Number(row.weeks) || calculateWeeksFromDates(row.start_date, row.end_date),
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            }));
            saveCsnPeriodsToLocal(mapped, userId);
            return mapped;
          }
        }
      } catch {
        // Tabell finns eventuellt inte i Supabase än
      }

      // Läs från local storage
      return loadCsnPeriodsFromLocal(userId);
    },
    staleTime: 1000 * 60 * 5,
  });

  const saveMutation = useMutation({
    mutationFn: async (periods: CsnPeriod[]) => {
      let userId: string | undefined;
      try {
        const { data: u } = await supabase.auth.getUser();
        userId = u.user?.id;
      } catch {
        // ignore
      }

      saveCsnPeriodsToLocal(periods, userId);

      // Försök spara till Supabase i bakgrunden om tabellen finns
      if (userId) {
        try {
          for (const p of periods) {
            await supabase.from("csn_periods" as never).upsert(
              {
                id: p.id,
                user_id: userId,
                name: p.name,
                start_date: p.startDate,
                end_date: p.endDate,
                weeks: p.weeks,
                updated_at: new Date().toISOString(),
              } as never,
              { onConflict: "id" },
            );
          }
        } catch {
          // Tabellen kan saknas
        }
      }
      return periods;
    },
    onSuccess: (periods) => {
      qc.setQueryData(["csn_periods"], periods);
      qc.invalidateQueries({ queryKey: ["csn_periods"] });
    },
  });

  const addPeriod = async (newPeriod: Omit<CsnPeriod, "id" | "createdAt" | "updatedAt">) => {
    const current = query.data ?? [];
    const item: CsnPeriod = {
      ...newPeriod,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [item, ...current].sort((a, b) => b.startDate.localeCompare(a.startDate));
    return saveMutation.mutateAsync(updated);
  };

  const updatePeriod = async (updatedItem: CsnPeriod) => {
    const current = query.data ?? [];
    const updated = current.map((p) =>
      p.id === updatedItem.id
        ? { ...updatedItem, updatedAt: new Date().toISOString() }
        : p,
    ).sort((a, b) => b.startDate.localeCompare(a.startDate));
    return saveMutation.mutateAsync(updated);
  };

  const deletePeriod = async (id: string) => {
    const current = query.data ?? [];
    const updated = current.filter((p) => p.id !== id);

    let userId: string | undefined;
    try {
      const { data: u } = await supabase.auth.getUser();
      userId = u.user?.id;
    } catch {
      // ignore
    }

    saveCsnPeriodsToLocal(updated, userId);

    if (userId) {
      try {
        await supabase.from("csn_periods" as never).delete().eq("id" as never, id);
      } catch {
        // ignore
      }
    }

    qc.setQueryData(["csn_periods"], updated);
    qc.invalidateQueries({ queryKey: ["csn_periods"] });
  };

  return {
    periods: query.data ?? [],
    isLoading: query.isLoading,
    isSaving: saveMutation.isPending,
    addPeriod,
    updatePeriod,
    deletePeriod,
  };
}
